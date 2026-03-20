"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  app/server.py — Flask + WebSocket Server                                   ║
║                                                                              ║
║  FIXED BUGS (v2 → v3):                                                      ║
║  ─────────────────────────────────────────────────────────────────────────  ║
║  BUG 1 — Dealer only accepted one card:                                     ║
║    OLD: elif target == 'dealer' and current_dealer_upcard is None           ║
║         → Silently dropped every dealer card after the first one            ║
║    FIX: Dealer now has a full Hand object (current_dealer_hand).            ║
║         First card = upcard (face-up). Second = hole card. Third+ = hits.  ║
║                                                                              ║
║  BUG 2 — Count reset on every hand (required reshuffle each round):        ║
║    OLD: 'new_hand' event was being used to also trigger count resets,      ║
║         and shuffle was called between hands, wiping the count.             ║
║    FIX: 'new_hand' ONLY clears player hand and dealer hand — never count.  ║
║         counter.reset() is ONLY called on a real 'shuffle' event.          ║
║         The count persists across ALL hands within the same shoe.           ║
║                                                                              ║
║  CORRECT FLOW:                                                               ║
║    Deal hand → click New Hand → deal next hand → repeat until real shuffle ║
║    Real shuffle by dealer → click Shuffle button → count resets to 0       ║
║                                                                              ║
║  INSURANCE (v3 addition):                                                    ║
║    Insurance is NOT a side bet — it is a core game mechanic.                ║
║    Computed separately in _get_insurance_data() and sent as its own         ║
║    top-level key "insurance" in the state, not inside "side_bets".         ║
║    Only available when dealer upcard is an Ace. Pays 2:1. Costs half       ║
║    the main bet. Profitable when True Count >= +3.                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from blackjack.card import Card, Shoe, Rank, Suit, ShuffleType
from blackjack.counting import CardCounter
from blackjack.strategy import BasicStrategy
from blackjack.deviations import DeviationEngine
from blackjack.betting import BettingEngine
from blackjack.side_bets import SideBetAnalyzer
from blackjack.game import Hand, Action
from ml_model.shuffle_tracker import ShuffleTracker
from ml_model.model import BlackjackDecisionModel
from config import GameConfig, CountingConfig, BettingConfig, MLConfig


app = Flask(__name__)
app.config['SECRET_KEY'] = 'blackjack-ml-counter-secret'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')  # threading mode: Ctrl+C works on Windows

# ── JSON safety net ────────────────────────────────────────────────────────────
# Converts numpy/torch scalar types to Python natives before JSON encoding.
# Prevents "Object of type float32 is not JSON serializable" from ML models.
import json as _json
import numpy as _np

class _SafeEncoder(_json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, _np.integer):  return int(obj)
        if isinstance(obj, _np.floating): return float(obj)
        if isinstance(obj, _np.ndarray):  return obj.tolist()
        try:
            import torch as _t
            if isinstance(obj, _t.Tensor): return obj.tolist()
        except ImportError:
            pass
        return super().default(obj)

def _safe_emit(event, data):
    """Serialize numpy/torch types before emitting via SocketIO.
    Round-trips through JSON to guarantee all numpy scalars are converted
    to native Python types (float32, int64, etc. are not JSON-serializable).
    """
    try:
        clean = _json.loads(_json.dumps(data, cls=_SafeEncoder))
        emit(event, clean)
    except (TypeError, ValueError) as e:
        # Fallback: deep-walk and cast manually
        def _cast(obj):
            if isinstance(obj, dict):   return {k: _cast(v) for k, v in obj.items()}
            if isinstance(obj, list):   return [_cast(v) for v in obj]
            if isinstance(obj, _np.integer):  return int(obj)
            if isinstance(obj, _np.floating): return float(obj)
            if isinstance(obj, _np.ndarray):  return obj.tolist()
            if isinstance(obj, _np.bool_):    return bool(obj)
            return obj
        emit(event, _cast(data))


# ══════════════════════════════════════════════════════════════
# GLOBAL GAME STATE
# ══════════════════════════════════════════════════════════════

game_config       = GameConfig()
shoe              = Shoe(game_config.NUM_DECKS, game_config.PENETRATION)
counter           = CardCounter(CountingConfig.DEFAULT_SYSTEM, game_config.NUM_DECKS)
strategy          = BasicStrategy(game_config)
deviation_engine  = DeviationEngine(strategy)
betting_engine    = BettingEngine()
side_bet_analyzer = SideBetAnalyzer()
shuffle_tracker   = ShuffleTracker(game_config.NUM_DECKS)

# ── Load trained ML model ──────────────────────────────────────────────────────
# Looks for best_model.pt in the models/ folder next to ml_model/.
# Falls back gracefully to rule-based engine if the file is missing.
_model_path = os.path.join(os.path.dirname(__file__), '..', 'models', 'best_model.pt')
ml_decision_model = BlackjackDecisionModel(model_path=_model_path if os.path.exists(_model_path) else None)
_ml_available = ml_decision_model.is_trained
if _ml_available:
    print(f"  ✅  ML model loaded from {_model_path}")
else:
    print(f"  ⚠️   ML model not found at {_model_path} — using rule-based engine only")

# FIX BUG 1: dealer now has a full Hand, not just a single upcard Card.
current_player_hand = Hand()
current_dealer_hand = Hand()   # was: current_dealer_upcard = None

session_history = []


# ══════════════════════════════════════════════════════════════
# CARD MAPPING
# ══════════════════════════════════════════════════════════════

RANK_MAP = {
    '2': Rank.TWO,   '3': Rank.THREE, '4': Rank.FOUR,  '5': Rank.FIVE,
    '6': Rank.SIX,   '7': Rank.SEVEN, '8': Rank.EIGHT, '9': Rank.NINE,
    '10': Rank.TEN,  'J': Rank.JACK,  'Q': Rank.QUEEN, 'K': Rank.KING,
    'A': Rank.ACE,
}

SUIT_MAP = {
    'hearts':   Suit.HEARTS,
    'diamonds': Suit.DIAMONDS,
    'clubs':    Suit.CLUBS,
    'spades':   Suit.SPADES,
}

SUIT_IDX = {'hearts': 0, 'diamonds': 1, 'clubs': 2, 'spades': 3}


# ══════════════════════════════════════════════════════════════
# INSURANCE HELPER
# ══════════════════════════════════════════════════════════════

def _get_insurance_data(dealer_upcard_card):
    """
    Compute insurance offer data — separate from side bets.

    Insurance is a core blackjack game mechanic, not a side bet:
      • Only offered when dealer upcard is an Ace
      • Costs exactly half the main bet (not an independent stake)
      • Pays 2:1 if dealer has blackjack (hole card is a 10-value)
      • Settled BEFORE the main hand plays out
      • Not available when dealer shows a 10 or face card
      • Profitable when True Count >= +3 (shoe is rich in 10-value cards)
        because: EV = 3 × P(ten) − 1, which is positive when P(ten) > 1/3

    Returns a dict with:
        available        — bool: True only when dealer upcard is Ace
        recommended      — bool: True when TC >= +3
        ev               — float: expected value as percentage
        ten_probability  — float: % chance hole card is a 10-value
        true_count       — float: current true count
        reason           — str: human-readable recommendation reason
    """
    # Insurance only offered when dealer shows an Ace
    if dealer_upcard_card is None or not dealer_upcard_card.is_ace:
        return {
            "available":       False,
            "recommended":     False,
            "ev":              None,
            "ten_probability": None,
            "true_count":      None,
            "reason":          "",
        }

    tc = counter.true_count
    remaining = counter.get_remaining_estimate()
    ten_prob = remaining.get(10, 0.0)

    # Insurance EV formula: pays 2:1 on a half-bet
    # EV = P(ten) × 2 − P(not ten) × 1 = 3 × P(ten) − 1
    ev = round((3 * ten_prob - 1) * 100, 2)
    recommended = tc >= 3.0  # Standard card-counting threshold

    return {
        "available":       True,
        "recommended":     recommended,
        "ev":              ev,
        "ten_probability": round(ten_prob * 100, 2),
        "true_count":      round(tc, 1),
        "reason": (
            f"TC={tc:.1f} ≥ +3 — shoe rich in 10s, take insurance"
            if recommended else
            f"TC={tc:.1f} < +3 — not enough 10s remaining, decline insurance"
        ),
    }


# ══════════════════════════════════════════════════════════════
# ML RECOMMENDATION HELPER
# ══════════════════════════════════════════════════════════════

def _get_ml_recommendation(player_hand, dealer_upcard_card):
    """
    Get play recommendation from the trained ML model.

    The ML model uses all 28 features including true count, penetration,
    remaining card probabilities, and running count — giving it full
    count-aware decision making beyond basic strategy.

    Falls back to None if model is not loaded or hand is incomplete.
    """
    if not _ml_available:
        return None
    if not player_hand.cards or dealer_upcard_card is None:
        return None

    try:
        remaining = counter.get_remaining_estimate()
        remaining_probs = [remaining.get(i, 0.0) for i in range(2, 12)]  # [8-17]

        available_actions = player_hand.available_actions(game_config)
        available_names   = [a.value for a in available_actions]

        bankroll_ratio = min(
            betting_engine.bankroll / BettingConfig.INITIAL_BANKROLL, 2.0
        )

        features = ml_decision_model.extract_features(
            hand_value        = player_hand.best_value,
            is_soft           = player_hand.is_soft,
            is_pair           = player_hand.is_pair,
            pair_value        = player_hand.cards[0].count_key if player_hand.is_pair else 0,
            dealer_upcard     = dealer_upcard_card.count_key,
            true_count        = counter.true_count,
            shuffle_adjustment= shuffle_tracker.get_count_adjustment(),
            penetration       = counter.penetration,
            remaining_probs   = remaining_probs,
            num_cards         = len(player_hand.cards),
            can_double        = player_hand.can_double,
            can_split         = player_hand.can_split,
            can_surrender     = Action.SURRENDER in available_actions,
            num_hands         = 1,
            bankroll_ratio    = bankroll_ratio,
            advantage         = counter.advantage,
            running_count     = counter.running_count,
            decks_remaining   = counter.decks_remaining,
        )

        prediction = ml_decision_model.predict(features, available_names)

        return {
            "action":       prediction["action"].upper(),
            "confidence":   prediction["confidence"],
            "all_scores":   prediction["all_scores"],
            "is_confident": prediction["is_confident"],
            "source":       "ml",
        }

    except Exception as e:
        print(f"[ML] prediction failed: {e}")
        return None


# ══════════════════════════════════════════════════════════════
# STATE BUILDER
# ══════════════════════════════════════════════════════════════

def get_full_state():
    """
    Build the complete game state JSON sent to the browser after every event.
    Raises exceptions — callers should catch them.

    Changes from v2:
    • dealer_upcard  — still the first card string (UI backward-compat)
    • dealer_hand    — NEW: full dealer hand (all cards + value + flags)
    • insurance      — NEW: separate top-level key, not inside side_bets.
                       Insurance is a game mechanic, not a side bet.
    • ml_recommendation — NEW: ML model play decision with confidence score.
                       Falls back to rule-based if model not loaded.
    """
    tc          = counter.true_count
    enhanced_tc = shuffle_tracker.get_enhanced_true_count(tc)
    penetration = counter.penetration

    # Dealer upcard = first card in the dealer hand
    dealer_upcard_card = current_dealer_hand.cards[0] if current_dealer_hand.cards else None

    # ── Rule-based strategy recommendation (always computed) ──────────────
    recommendation = None
    if current_player_hand.cards and dealer_upcard_card:
        available   = current_player_hand.available_actions(game_config)
        action_info = deviation_engine.get_action_with_info(
            current_player_hand, dealer_upcard_card, tc, available
        )
        recommendation = {
            "action":         action_info["action"].value.upper(),
            "is_deviation":   action_info["is_deviation"],
            "basic_action":   action_info["basic_strategy_action"].value.upper(),
            "deviation_info": action_info.get("deviation"),
            "source":         "rules",
        }
        if recommendation.get("deviation_info"):
            dev = recommendation["deviation_info"]
            dev["description_short"] = f"TC {dev['direction']} {dev['tc_threshold']}"

    # ── ML model recommendation (uses full 28-feature state with count) ───
    # If model is confident (≥75%), it overrides the rule-based recommendation.
    # If not confident, rule-based recommendation is used as fallback.
    ml_rec = _get_ml_recommendation(current_player_hand, dealer_upcard_card)
    if ml_rec and ml_rec["is_confident"] and recommendation is not None:
        # ML overrides rules — surface both so UI can show the difference
        final_recommendation = {
            **ml_rec,
            "basic_action":   recommendation["basic_action"],
            "is_deviation":   ml_rec["action"] != recommendation["basic_action"],
            "rule_action":    recommendation["action"],
            "deviation_info": recommendation.get("deviation_info"),
        }
    else:
        # Fall back to rule-based
        final_recommendation = recommendation

    # ── Side bets (Perfect Pairs, 21+3, Lucky Ladies — NOT insurance) ──
    # Insurance is computed separately below and sent as its own key.
    side_bets = side_bet_analyzer.analyze_all(
        shoe, counter,
        current_player_hand.cards if current_player_hand.cards else None,
        dealer_upcard_card,
    )

    # ── Bet recommendation — now includes penetration for accurate sizing ──
    # ── Bet recommendation — now includes penetration for accurate sizing ──
    bet_rec = betting_engine.get_bet_recommendation(enhanced_tc, penetration=penetration)

    # ── Dealer hand data ───────────────────────────────────────────────
    dealer_hand_data = {
        "cards":        [str(c) for c in current_dealer_hand.cards],
        "value":        current_dealer_hand.best_value  if current_dealer_hand.cards else 0,
        "is_soft":      current_dealer_hand.is_soft     if current_dealer_hand.cards else False,
        "is_blackjack": current_dealer_hand.is_blackjack if current_dealer_hand.cards else False,
        "is_bust":      current_dealer_hand.is_bust     if current_dealer_hand.cards else False,
        "card_count":   len(current_dealer_hand.cards),
        # S17 rule: dealer must draw on 16 or less, stands on 17+
        "must_draw":    (
            len(current_dealer_hand.cards) >= 2 and
            not current_dealer_hand.is_bust and
            not current_dealer_hand.is_blackjack and
            current_dealer_hand.best_value < 17
        ),
        "dealer_stands": (
            len(current_dealer_hand.cards) >= 2 and
            not current_dealer_hand.is_bust and
            current_dealer_hand.best_value >= 17
        ),
    }

    return {
        "count": {
            "running":            counter.running_count,
            "true":               round(tc, 2),
            "enhanced_true":      round(enhanced_tc, 2),
            "shuffle_adjustment": round(shuffle_tracker.get_count_adjustment(), 2),
            "system":             counter.system_name,
            "advantage":          round(counter.advantage * 100, 2),
            "is_favorable":       counter.is_favorable,
            "penetration":        round(counter.penetration * 100, 1),
            "decks_remaining":    round(counter.decks_remaining, 2),
        },
        "shoe": {
            "cards_remaining":   shoe.cards_remaining,
            "cards_dealt":       shoe.cards_dealt,
            "decks_remaining":   round(shoe.decks_remaining, 1),
            "penetration":       round(shoe.penetration_pct * 100, 1),
            "needs_shuffle":     shoe.needs_shuffle,
            "remaining_by_rank": shoe.remaining_by_rank(),
        },
        "recommendation":    final_recommendation,
        "ml_recommendation": ml_rec,
        "betting":           bet_rec,
        "side_bets":         side_bets,
        "shuffle_tracker":   shuffle_tracker.get_state(),
        "session":           betting_engine.get_session_stats(),
        "player_hand": {
            "cards":        [str(c) for c in current_player_hand.cards],
            "value":        current_player_hand.best_value  if current_player_hand.cards else 0,
            "is_soft":      current_player_hand.is_soft     if current_player_hand.cards else False,
            "is_pair":      current_player_hand.is_pair     if current_player_hand.cards else False,
            "can_double":   current_player_hand.can_double  if current_player_hand.cards else False,
            "can_split":    current_player_hand.can_split   if current_player_hand.cards else False,
            "is_blackjack": current_player_hand.is_blackjack if current_player_hand.cards else False,
            "is_bust":      current_player_hand.is_bust     if current_player_hand.cards else False,
        },
        # dealer_upcard: first dealer card as a string (UI backward compat)
        "dealer_upcard": str(current_dealer_hand.cards[0]) if current_dealer_hand.cards else None,
        # dealer_hand: full dealer hand including all hit cards
        "dealer_hand":   dealer_hand_data,
        "count_history": counter.count_history[-60:],
        # insurance: separate from side_bets — it is a game mechanic.
        # Only available when dealer upcard is Ace. Pays 2:1 on half the bet.
        "insurance":     _get_insurance_data(dealer_upcard_card),
        "ml_available":  _ml_available,
    }


# ══════════════════════════════════════════════════════════════
# HTTP ROUTES
# ══════════════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/state')
def api_state():
    return jsonify(get_full_state())


@app.route('/api/detect_cards', methods=['POST'])
def api_detect_cards():
    """
    Computer vision card detection endpoint.

    Accepts a base64-encoded screenshot frame, runs the CV pipeline,
    and returns a list of detected cards with confidence scores.

    Request JSON:  { "frame": "<base64 image string>" }
    Response JSON: { "cards": [ {rank, suit, confidence, bbox}, ... ] }

    The browser captures the frame via getDisplayMedia() (screen share)
    or getUserMedia() (webcam) and sends one JPEG frame here.
    The UI shows a confirmation dialog before cards are applied.
    """
    try:
        from app.cv_detector import detect_from_base64
    except ImportError:
        try:
            from cv_detector import detect_from_base64
        except ImportError:
            return jsonify({'error': 'cv_detector module not found', 'cards': []}), 500

    try:
        data      = request.get_json(force=True) or {}
        frame_b64 = data.get('frame', '')
        if not frame_b64:
            return jsonify({'error': 'No frame data', 'cards': []}), 400

        detections = detect_from_base64(frame_b64)
        return jsonify({'cards': detections})

    except Exception as exc:
        return jsonify({'error': str(exc), 'cards': []}), 500


# ══════════════════════════════════════════════════════════════
# WEBSOCKET EVENT HANDLERS
# ══════════════════════════════════════════════════════════════

@socketio.on('connect')
def handle_connect(*args, **kwargs):
    _safe_emit('state_update', get_full_state())


@socketio.on('deal_card')
def handle_deal_card(data):
    """
    Handle a card being entered into the system.
    Wrapped in try/except so any crash surfaces as an error toast in the UI
    instead of silently failing (which made cards appear to not register).
    """
    global current_player_hand, current_dealer_hand
    try:
        rank_str = data.get('rank', '')
        suit_str = data.get('suit', 'spades')
        target   = data.get('target', 'seen')

        rank = RANK_MAP.get(rank_str)
        suit = SUIT_MAP.get(suit_str, Suit.SPADES)

        if rank is None:
            emit('error', {'message': f'Invalid rank: {rank_str}'})
            return

        card = Card(rank, suit)

        # Count every card that comes out of the shoe
        counter.count_card(card)

        # Update ML shuffle tracker
        shuffle_tracker.observe_card(card.count_key, card.is_ace, SUIT_IDX.get(suit_str, 0))

        # Remove from shoe tracking (manual entry — just remove first matching card)
        for i, c in enumerate(shoe.cards):
            if c.rank == rank and c.suit == suit:
                shoe.cards.pop(i)
                shoe.dealt.append(c)
                break

        # Route card to correct hand
        if target == 'player':
            current_player_hand.add_card(card)
        elif target == 'dealer':
            current_dealer_hand.add_card(card)
        # 'seen': counted above, not added to any displayed hand

        _safe_emit('state_update', get_full_state())

    except Exception as e:
        import traceback
        print(f'[ERROR] handle_deal_card crashed: {e}')
        traceback.print_exc()
        emit('error', {'message': f'Server error processing card: {str(e)}'})


@socketio.on('new_hand')
def handle_new_hand(data=None):
    """
    Clear current hand state to start a new hand.

    FIX (Bug 2):
        Only clears player hand and dealer hand.
        Does NOT reset counter or shoe.
        The running count continues across all hands in the same shoe —
        exactly as a real card counter does at the casino table.

    Correct usage:
        Between every hand → emit 'new_hand'
        When dealer physically shuffles → emit 'shuffle' (resets count)
    """
    global current_player_hand, current_dealer_hand
    current_player_hand = Hand()
    current_dealer_hand = Hand()
    # counter and shoe are intentionally NOT touched here
    _safe_emit('state_update', get_full_state())


@socketio.on('shuffle')
def handle_shuffle(data=None):
    """
    Handle a real physical shoe shuffle by the casino dealer.

    This is the ONLY event that resets counter.reset().
    Only click this when you see the actual dealer collect and reshuffle
    all the cards into a new shoe. Not between hands.
    """
    global shoe, current_player_hand, current_dealer_hand

    shuffle_type = data.get('type', 'machine') if data else 'machine'

    shoe.reshuffle(ShuffleType(shuffle_type))
    counter.reset()                   # ← Correct: new shoe = fresh count
    current_player_hand = Hand()      # Clear display
    current_dealer_hand = Hand()

    shuffle_tracker.on_shuffle(shuffle_type)

    _safe_emit('state_update', get_full_state())
    emit('notification', {
        'type': 'info',
        'message': (
            f'Shoe shuffled ({shuffle_type}). Count reset to 0. '
            f'Bayesian confidence: {shuffle_tracker.bayesian.confidence:.0%}'
        )
    })


@socketio.on('change_system')
def handle_change_system(data):
    """Switch counting system — replays card log through new system tags."""
    global counter
    system = data.get('system', 'hi_lo')

    if system in CountingConfig.SYSTEMS:
        old_log = counter._card_log
        counter = CardCounter(system, game_config.NUM_DECKS)
        for key in old_log:
            counter.running_count += counter.values.get(key, 0)
            counter.cards_seen    += 1
            counter._card_log.append(key)

        _safe_emit('state_update', get_full_state())


@socketio.on('record_result')
def handle_record_result(data):
    """
    Record financial result of a completed hand.
    Does NOT clear hands or count. Call 'new_hand' separately after this.
    """
    bet = data.get('bet', BettingConfig.TABLE_MIN)
    profit = data.get('profit', 0)
    betting_engine.record_result(bet, profit)
    session_history.append({'bet': bet, 'profit': profit})
    _safe_emit('state_update', get_full_state())


# ══════════════════════════════════════════════════════════════
# SERVER STARTUP
# ══════════════════════════════════════════════════════════════

def start_server(host: str = '0.0.0.0', port: int = 5000, debug: bool = False):
    import signal, sys

    def _graceful_exit(sig, frame):
        print('\n\n  ♠  BlackjackML stopped. Goodbye!\n')
        sys.exit(0)

    # Register Ctrl+C handler — fixes Windows PowerShell not responding to Ctrl+C
    signal.signal(signal.SIGINT,  _graceful_exit)
    signal.signal(signal.SIGTERM, _graceful_exit)

    print(f"\n{'='*60}")
    print(f"  ♠  BLACKJACKML — Live Card Counter & AI Advisor")
    print(f"  → Open in browser: http://localhost:{port}")
    print(f"  → Press Ctrl+C to stop")
    print(f"{'='*60}\n")

    socketio.run(
        app,
        host=host,
        port=port,
        debug=debug,
        use_reloader=False,        # prevents double-process on Windows (breaks Ctrl+C)
        allow_unsafe_werkzeug=True,
    )


if __name__ == '__main__':
    start_server(debug=True)
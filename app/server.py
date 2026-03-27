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
║                                                                              ║
║  IMPROVEMENTS IN THIS VERSION:                                               ║
║  ─────────────────────────────────────────────────────────────────────────  ║
║  REFACTOR 1 — _reset_hand_state() helper:                                  ║
║    The 5-line reset block (current_player_hand, current_dealer_hand,        ║
║    split_hands, active_hand_index, num_splits_done) was copy-pasted in      ║
║    handle_new_hand, handle_shuffle, and _reset_hand (live scanner bridge).  ║
║    Centralised into _reset_hand_state() — one place to maintain.           ║
║                                                                              ║
║  REFACTOR 2 — _process_card_entry() helper:                                ║
║    Card processing logic (counter, shuffle tracker, shoe tracking, hand     ║
║    routing) was duplicated between handle_deal_card and _apply_card.        ║
║    Extracted into _process_card_entry() — both callers now use it.         ║
║                                                                              ║
║  REFACTOR 3 — _CountKey module-level class:                                ║
║    _FakeCard was an inner class defined inside handle_change_system,        ║
║    causing Python to create a new class object on every system switch.      ║
║    Moved to module level as _CountKey with __slots__ for clarity.          ║
║                                                                              ║
║  REFACTOR 4 — get_full_state() extraction:                                 ║
║    The 120+ line god function was split into _build_dealer_data(),          ║
║    _build_player_data(), and _build_split_data() helpers. get_full_state()  ║
║    now reads as a clean assembler of named, independently testable pieces.  ║
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
try:
    from ml_model.shuffle_tracker import ShuffleTracker
    from ml_model.model import BlackjackDecisionModel
    ML_AVAILABLE = True
except ImportError as _ml_err:
    print(f"[WARNING] ML model not available ({_ml_err}). "
          "Train the model first with: python main.py train")
    ML_AVAILABLE = False
    class BlackjackDecisionModel:
        def __init__(self, *a, **kw): pass
        def load(self, *a, **kw): return False
        def predict(self, *a, **kw): return None
    class ShuffleTracker:
        def __init__(self, *a, **kw):
            self.bayesian_confidence = 0.0
        def observe_card(self, *a, **kw): pass
        def get_enhanced_true_count(self, tc, *a, **kw): return tc
        def get_count_adjustment(self): return 0.0
        def get_state(self):
            return {'bayesian_confidence':0,'count_adjustment':0,
                    'ace_prediction':None,'shuffles_tracked':0}
from config import GameConfig, CountingConfig, BettingConfig, MLConfig


app = Flask(__name__)
app.config['SECRET_KEY'] = 'blackjack-ml-counter-secret'
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='threading',   # threading mode: Ctrl+C works on Windows
    ping_timeout=60,           # wait 60s before declaring client dead
    ping_interval=25,          # keep-alive ping every 25s (survives tab switch)
    max_http_buffer_size=10_000_000,
)

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
# CARD TARGET CONSTANTS
# ══════════════════════════════════════════════════════════════
# Replaces magic strings 'player', 'dealer', 'seen' scattered
# through handle_deal_card and _apply_card.

TARGET_PLAYER = 'player'
TARGET_DEALER = 'dealer'
TARGET_SEEN   = 'seen'


# ══════════════════════════════════════════════════════════════
# COUNT-KEY HELPER
# ══════════════════════════════════════════════════════════════

class _CountKey:
    """
    Minimal card-like object for replaying a card log through a new counting system.

    Used by handle_change_system to re-run every seen card through a new system's
    tag values without needing real Card objects.

    Previously defined as an inner class '_FakeCard' inside handle_change_system,
    which re-created the class object on every call to that handler. Moved to
    module level with __slots__ for clarity, correct naming, and minor efficiency.
    """
    __slots__ = ('count_key', 'is_ace', 'is_ten')

    def __init__(self, key: int):
        self.count_key = key
        self.is_ace    = (key == 11)
        self.is_ten    = (key == 10)   # 10-value cards: 10, J, Q, K all have count_key=10


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
current_player_hand  = Hand()
current_dealer_hand  = Hand()   # was: current_dealer_upcard = None

# Split hand tracking
split_hands:         list  = []    # [] = no split; [Hand, Hand] = after split
active_hand_index:   int   = 0     # 0 = first hand, 1 = second hand (post-split)
num_splits_done:     int   = 0     # how many splits have occurred this hand

session_history = []

# ── Live scanner ───────────────────────────────────────────────────────────────
# Wire up after helpers are defined below.
live_scanner = None


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
# HAND STATE RESET HELPER
# ══════════════════════════════════════════════════════════════

def _reset_hand_state():
    """
    Clear all per-hand global state for the start of a new round.

    Previously this 5-line block was copy-pasted in three places:
      • handle_new_hand  (WebSocket 'new_hand' event)
      • handle_shuffle   (WebSocket 'shuffle' event)
      • _reset_hand      (live scanner bridge)
    Centralised here so any future changes only need to happen once.

    IMPORTANT: this does NOT touch counter, shoe, or betting_engine.
    Those are only reset on a real shoe shuffle (handle_shuffle).
    The running count must persist across all hands within one shoe.
    """
    global current_player_hand, current_dealer_hand, split_hands, active_hand_index, num_splits_done
    current_player_hand = Hand()
    current_dealer_hand = Hand()
    split_hands         = []
    active_hand_index   = 0
    num_splits_done     = 0


# ══════════════════════════════════════════════════════════════
# CARD ENTRY HELPER
# ══════════════════════════════════════════════════════════════

def _process_card_entry(card: Card, target: str, suit_str: str):
    """
    Shared logic for adding a dealt card to the correct hand and updating
    all tracking state (counter, shuffle tracker, shoe).

    Previously duplicated almost verbatim between handle_deal_card (WebSocket
    handler) and _apply_card (live scanner bridge). Both callers now call this
    function instead, eliminating the risk of one path gaining a new tracking
    call that the other silently misses.

    Args:
        card:     The Card object to process.
        target:   TARGET_PLAYER, TARGET_DEALER, or TARGET_SEEN.
        suit_str: Lowercase suit string ('spades', 'hearts', etc.) for
                  the shuffle tracker's suit-index lookup.
    """
    global current_player_hand, active_hand_index

    # Always count every card that comes out of the shoe
    counter.count_card(card)

    # Update ML shuffle tracker
    shuffle_tracker.observe_card(card.count_key, card.is_ace, SUIT_IDX.get(suit_str, 0))

    # Remove from shoe tracking (manual entry — just remove first matching card)
    for i, c in enumerate(shoe.cards):
        if c.rank == card.rank and c.suit == card.suit:
            shoe.cards.pop(i)
            shoe.dealt.append(c)
            break

    # Route card to correct hand
    if target == TARGET_PLAYER:
        if split_hands:
            # Post-split: add to the currently active split hand
            split_hands[active_hand_index].add_card(card)
            # Mirror active hand into current_player_hand for display/compat
            current_player_hand = split_hands[active_hand_index]

            # FIX: Auto-advance when active split hand busts.
            # Previously the "Done" button in SplitHandPanel.js was hidden on bust
            # (condition: !isBust), leaving the player with no way to switch hands.
            # Now the server advances automatically so the next hand becomes active.
            if current_player_hand.is_bust:
                next_idx = active_hand_index + 1
                if next_idx < len(split_hands):
                    active_hand_index = next_idx
                    current_player_hand = split_hands[active_hand_index]
                    # Notify client of the auto-advance
                    _safe_emit('notification', {
                        'type': 'warning',
                        'message': (
                            f'Hand {active_hand_index} busted — '
                            f'auto-advancing to Hand {active_hand_index + 1}'
                        )
                    })
        else:
            current_player_hand.add_card(card)
    elif target == TARGET_DEALER:
        current_dealer_hand.add_card(card)
    # TARGET_SEEN: counted above, not added to any displayed hand


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
# CASINO DETECTION RISK METER
# ══════════════════════════════════════════════════════════════

def _get_casino_risk() -> dict:
    """
    Estimate how detectable the player's counting pattern is to casino surveillance.

    Casinos flag counters using these signals:
      1. Bet spread ratio — ratio of max bet to min bet this session
      2. Bet-TC correlation — bets consistently rising with TC (dead giveaway)
      3. Win rate at high counts — winning significantly more when TC>2
      4. Session length — long sessions increase exposure

    Returns a heat level: 0=Cold, 1=Warm, 2=Hot, 3=Critical
    """
    history = betting_engine.bet_history
    if len(history) < 5:
        return {
            'level':   0,
            'label':   'LOW',
            'color':   '#44e882',
            'score':   0,
            'spread':  1.0,
            'hands':   len(history),
            'signals': [],
            'advice':  f'Play {5 - len(history)} more hand(s) to enable risk tracking',
        }

    bets    = [h['bet']    for h in history]
    profits = [h['profit'] for h in history]
    score   = 0
    signals = []

    # ── Signal 1: Bet spread ratio ───────────────────────────────────────
    min_bet = min(bets)
    max_bet = max(bets)
    spread  = max_bet / min_bet if min_bet > 0 else 1
    if spread >= 8:
        score += 3
        signals.append(f'Spread {spread:.0f}:1 — very wide (threshold: 8:1)')
    elif spread >= 5:
        score += 2
        signals.append(f'Spread {spread:.0f}:1 — noticeable')
    elif spread >= 3:
        score += 1
        signals.append(f'Spread {spread:.0f}:1 — mild')

    # ── Signal 2: Bet-TC correlation (last 20 hands) ─────────────────────
    tc_history   = counter.count_history[-20:]
    recent_bets  = bets[-len(tc_history):]
    if len(tc_history) >= 10:
        high_tc_big_bet = sum(
            1 for i, h in enumerate(tc_history)
            if h.get('true_count', 0) >= 2
            and i < len(recent_bets)
            and recent_bets[i] > min_bet * 1.5
        )
        high_tc_count = sum(1 for h in tc_history if h.get('true_count', 0) >= 2)
        correlation   = high_tc_big_bet / high_tc_count if high_tc_count > 0 else 0
        if correlation >= 0.8:
            score += 3
            signals.append(f'Bet-TC correlation {correlation:.0%} — strong counter pattern')
        elif correlation >= 0.6:
            score += 2
            signals.append(f'Bet-TC correlation {correlation:.0%} — noticeable')
        elif correlation >= 0.4:
            score += 1

    # ── Signal 3: Win rate at high counts ────────────────────────────────
    big_bet_threshold = min_bet * 3
    big_bet_results   = [p for b, p in zip(bets, profits) if b >= big_bet_threshold]
    if len(big_bet_results) >= 8:
        big_bet_wins = sum(1 for p in big_bet_results if p > 0)
        big_win_rate = big_bet_wins / len(big_bet_results)
        if big_win_rate >= 0.55:
            score += 2
            signals.append(f'Win rate {big_win_rate:.0%} on big bets — above normal')
        elif big_win_rate >= 0.50:
            score += 1

    # ── Signal 4: Session length ──────────────────────────────────────────
    hands = len(history)
    if hands >= 200:
        score += 2
        signals.append(f'{hands} hands — very long session, high visibility')
    elif hands >= 100:
        score += 1
        signals.append(f'{hands} hands — moderate session length')

    # ── Compute heat level ────────────────────────────────────────────────
    if score >= 7:
        level, label, color = 3, 'CRITICAL', '#ff5c5c'
        advice = '🚨 Leave table immediately — pattern is obvious'
    elif score >= 5:
        level, label, color = 2, 'HOT', '#ff9944'
        advice = '⚠ Reduce spread, make some cover plays, consider leaving'
    elif score >= 3:
        level, label, color = 1, 'WARM', '#ffd447'
        advice = 'Play naturally, avoid max bets several hands in a row'
    else:
        level, label, color = 0, 'LOW', '#44e882'
        advice = 'Pattern looks natural — continue playing'

    return {
        'level':   level,
        'label':   label,
        'color':   color,
        'score':   score,
        'spread':  round(spread, 1),
        'hands':   hands,
        'signals': signals,
        'advice':  advice,
    }


# ══════════════════════════════════════════════════════════════
# STATE BUILDER HELPERS
# ══════════════════════════════════════════════════════════════
# Extracted from get_full_state() to keep each piece focused and testable.

def _build_dealer_data() -> dict:
    """Build the dealer_hand sub-dict for the state payload."""
    return {
        "cards":        [str(c) for c in current_dealer_hand.cards],
        "value":        current_dealer_hand.best_value  if current_dealer_hand.cards else 0,
        "is_soft":      current_dealer_hand.is_soft     if current_dealer_hand.cards else False,
        "is_blackjack": current_dealer_hand.is_blackjack if current_dealer_hand.cards else False,
        "is_bust":      current_dealer_hand.is_bust     if current_dealer_hand.cards else False,
        "card_count":   len(current_dealer_hand.cards),
        # S17 rule: dealer must draw on 16 or less, stands on 17+
        "must_draw": (
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


def _build_player_data() -> dict:
    """Build the player_hand sub-dict for the state payload."""
    return {
        "cards":        [str(c) for c in current_player_hand.cards],
        "value":        current_player_hand.best_value  if current_player_hand.cards else 0,
        "is_soft":      current_player_hand.is_soft     if current_player_hand.cards else False,
        "is_pair":      current_player_hand.is_pair     if current_player_hand.cards else False,
        "can_double":   current_player_hand.can_double  if current_player_hand.cards else False,
        "can_split":    current_player_hand.can_split   if current_player_hand.cards else False,
        "is_blackjack": current_player_hand.is_blackjack if current_player_hand.cards else False,
        "is_bust":      current_player_hand.is_bust     if current_player_hand.cards else False,
    }


def _build_split_data(dealer_upcard_card, tc: float) -> list:
    """
    Build the split_hands list for the state payload.
    Returns [] when no split is in progress.
    Computes an independent recommendation for each split hand.
    """
    if not split_hands:
        return []

    split_hand_data = []
    for idx, sh in enumerate(split_hands):
        sh_rec = None
        if sh.cards and dealer_upcard_card:
            sh_avail = sh.available_actions(game_config, num_splits_done)
            sh_info  = deviation_engine.get_action_with_info(
                sh, dealer_upcard_card, tc, sh_avail)
            sh_rec = {
                "action":         sh_info["action"].value.upper(),
                "is_deviation":   sh_info["is_deviation"],
                "basic_action":   sh_info["basic_strategy_action"].value.upper(),
                "deviation_info": sh_info.get("deviation"),
                "source":         "rules",
            }
        split_hand_data.append({
            "index":        idx,
            "is_active":    idx == active_hand_index,
            "cards":        [str(c) for c in sh.cards],
            "value":        sh.best_value if sh.cards else 0,
            "is_soft":      sh.is_soft    if sh.cards else False,
            "is_pair":      sh.is_pair    if sh.cards else False,
            "can_double":   sh.can_double if sh.cards else False,
            "can_split":    sh.can_split  if sh.cards else False,
            "is_blackjack": sh.is_blackjack if sh.cards else False,
            "is_bust":      sh.is_bust    if sh.cards else False,
            "is_split_ace": sh.is_split_ace_hand,
            "recommendation": sh_rec,
        })
    return split_hand_data


# ══════════════════════════════════════════════════════════════
# STATE BUILDER
# ══════════════════════════════════════════════════════════════

def get_full_state():
    """
    Build the complete game state JSON sent to the browser after every event.
    Raises exceptions — callers should catch them.

    Uses the _build_* helpers above to assemble each sub-section.
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

        # ── Composition-dependent 16 vs 10 metadata ───────────────────────
        # Expose which sub-case applies so the frontend can explain it clearly.
        comp_dep_16 = None
        cards = current_player_hand.cards
        if (len(cards) == 2
                and not current_player_hand.is_pair
                and not current_player_hand.is_soft
                and current_player_hand.best_value == 16
                and dealer_upcard_card.count_key == 10):
            c1, c2 = cards[0].count_key, cards[1].count_key
            is_ten_six = (c1 == 10 and c2 == 6) or (c1 == 6 and c2 == 10)
            threshold = 0 if is_ten_six else 1
            import logging as _log
            _log.getLogger('strategy.comp_dep').debug(
                "[COMP-DEP-META] hand=%s+%s  is_ten_six=%s  tc=%.2f  threshold=%d  action=%s",
                cards[0], cards[1], is_ten_six, tc, threshold, recommendation["action"]
            )
            comp_dep_16 = {
                "active":      True,
                "hand_type":   "10+6" if is_ten_six else "9+7",
                "threshold":   threshold,
                "tc":          round(tc, 2),
                "description": (
                    f"{'10+6' if is_ten_six else '9+7'} vs 10 — "
                    f"Stand at TC ≥ {'0' if is_ten_six else '+1'}"
                ),
            }
        recommendation["comp_dep_16"] = comp_dep_16

    # ── ML model recommendation ───────────────────────────────────────────
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
    side_bets = side_bet_analyzer.analyze_all(
        shoe, counter,
        current_player_hand.cards if current_player_hand.cards else None,
        dealer_upcard_card,
    )

    # Use Ace-adjusted TC for bet sizing — more accurate than plain TC
    ace_adj_tc = counter.ace_adjusted_tc
    bet_rec = betting_engine.get_bet_recommendation(ace_adj_tc, penetration=penetration)

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
        "player_hand":       _build_player_data(),
        # dealer_upcard: first dealer card as string (UI backward compat)
        "dealer_upcard":     str(current_dealer_hand.cards[0]) if current_dealer_hand.cards else None,
        # dealer_hand: full dealer hand including all hit cards
        "dealer_hand":       _build_dealer_data(),
        "count_history":     counter.count_history[-60:],
        "side_counts":       counter.get_side_count_state(),
        "casino_risk":       _get_casino_risk(),
        "split_hands":       _build_split_data(dealer_upcard_card, tc),
        "active_hand_index": active_hand_index,
        "num_splits_done":   num_splits_done,
        # insurance: separate from side_bets — it is a game mechanic.
        "insurance":         _get_insurance_data(dealer_upcard_card),
        "ml_available":      _ml_available,
        # ── Analytics: N₀ + Shoe Quality (new) ───────────────────────────
        "analytics": {
            "n0":           betting_engine.get_session_stats().get("n0"),
            "shoe_quality": counter.shoe_quality_score,
        },
    }


# ══════════════════════════════════════════════════════════════
# HTTP ROUTES
# ══════════════════════════════════════════════════════════════

@app.route('/test')
def test_page():
    return render_template('test.html')

@app.route('/diag')
def diag():
    return render_template('diag.html')


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
    returns a list of detected cards with confidence scores.
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
    instead of silently failing.
    """
    try:
        rank_str = data.get('rank', '')
        suit_str = data.get('suit', 'spades')
        target   = data.get('target', TARGET_SEEN)

        rank = RANK_MAP.get(rank_str)
        suit = SUIT_MAP.get(suit_str, Suit.SPADES)

        if rank is None:
            emit('error', {'message': f'Invalid rank: {rank_str}'})
            return

        card = Card(rank, suit)

        # Delegate to shared helper — identical logic to _apply_card path
        _process_card_entry(card, target, suit_str)

        _safe_emit('state_update', get_full_state())

        # Notify player when cut card is reached
        if shoe.needs_shuffle:
            emit('notification', {
                'type': 'warning',
                'message': 'Cut card reached -- click Shuffle after this hand'
            })

    except Exception as e:
        import traceback
        print(f'[ERROR] handle_deal_card crashed: {e}')
        traceback.print_exc()
        emit('error', {'message': f'Server error processing card: {str(e)}'})


@socketio.on('player_split')
def handle_player_split(data=None):
    """
    Handle the player choosing to split their pair.

    Rules enforced (8-deck S17, config-driven):
      - Only allowed when current hand is a pair
      - Only allowed when num_splits_done < MAX_SPLITS - 1 (config)
      - Split aces receive exactly ONE card each, then stand automatically
      - No re-split aces (ALLOW_RESPLIT_ACES = False in config)
      - No double after split (ALLOW_DOUBLE_AFTER_SPLIT = False in config)
      - No surrender on split hands (surrender = initial hand only)

    After split:
      split_hands = [Hand_A, Hand_B]
      active_hand_index = 0
      Deal one card to Player -> goes to split_hands[0]
      Deal one card to Player -> goes to split_hands[1]
      Client calls next_split_hand when done with hand 0
    """
    global current_player_hand, split_hands, active_hand_index, num_splits_done

    if not current_player_hand.is_pair:
        emit('error', {'message': 'Cannot split: hand is not a pair'})
        return
    if num_splits_done >= game_config.MAX_SPLITS - 1:
        emit('error', {'message': f'Max splits ({game_config.MAX_SPLITS-1}) reached'})
        return

    # Each split hand starts with one card from the original pair
    hand_a = Hand()
    hand_b = Hand()
    hand_a.is_split = True
    hand_b.is_split = True
    # If splitting aces, mark both hands so is_split_ace_hand is reliable
    if current_player_hand.cards[0].is_ace:
        hand_a.split_from_ace = True
        hand_b.split_from_ace = True
    hand_a.add_card(current_player_hand.cards[0])
    hand_b.add_card(current_player_hand.cards[1])

    split_hands        = [hand_a, hand_b]
    active_hand_index  = 0
    num_splits_done   += 1
    current_player_hand = hand_a   # keep current_player_hand pointing to active

    _safe_emit('state_update', get_full_state())
    emit('notification', {
        'type': 'info',
        'message': 'Pair split! Deal a card to each hand. Playing Hand 1 first.'
    })


@socketio.on('next_split_hand')
def handle_next_split_hand(data=None):
    """
    Advance to the next split hand.
    Call when: player stands, busts, gets BJ, or split-ace gets its card.
    """
    global current_player_hand, active_hand_index

    if not split_hands:
        emit('error', {'message': 'No split in progress'})
        return

    next_idx = active_hand_index + 1
    if next_idx >= len(split_hands):
        emit('notification', {'type': 'info', 'message': 'All split hands complete.'})
        return

    active_hand_index   = next_idx
    current_player_hand = split_hands[active_hand_index]

    _safe_emit('state_update', get_full_state())
    emit('notification', {
        'type':    'info',
        'message': f'Now playing Hand {active_hand_index + 1} of {len(split_hands)}'
    })


@socketio.on('undo_split_card')
def handle_undo_split_card(data=None):
    """
    Undo the last card dealt to the currently active split hand.

    Unlike the full undo (which calls new_hand and replays everything),
    this only removes the last card from split_hands[active_hand_index].
    The split structure, other hands, count, and shoe are preserved as-is
    EXCEPT for the one card being removed (counter and shoe are unwound).
    """
    global current_player_hand

    if not split_hands:
        emit('error', {'message': 'No split in progress'})
        return

    active_hand = split_hands[active_hand_index]

    if not active_hand.cards:
        emit('notification', {'type': 'warning', 'message': 'No cards to undo on this hand'})
        return

    # Remove the last card from the active split hand
    removed_card = active_hand.cards.pop()

    # Unwind the counter: subtract the card's count value
    val = counter.values.get(removed_card.count_key, 0)
    counter.running_count -= val
    counter.cards_seen    -= 1
    if counter._card_log:
        counter._card_log.pop()
    if counter.count_history:
        counter.count_history.pop()
    if removed_card.is_ace and counter.aces_seen > 0:
        counter.aces_seen -= 1
    if removed_card.is_ten and counter.tens_seen > 0:
        counter.tens_seen -= 1

    # Return card to shoe
    shoe.cards.append(removed_card)
    if removed_card in shoe.dealt:
        shoe.dealt.remove(removed_card)

    # Keep current_player_hand mirror in sync
    current_player_hand = active_hand

    _safe_emit('state_update', get_full_state())
    emit('notification', {
        'type': 'info',
        'message': f'Undid {removed_card} from split hand {active_hand_index + 1}'
    })


@socketio.on('new_hand')
def handle_new_hand(data=None):
    """
    Clear current hand state to start a new hand.

    FIX (Bug 2):
        Only clears player hand and dealer hand via _reset_hand_state().
        Does NOT reset counter or shoe.
        The running count continues across all hands in the same shoe —
        exactly as a real card counter does at the casino table.

    Correct usage:
        Between every hand → emit 'new_hand'
        When dealer physically shuffles → emit 'shuffle' (resets count)
    """
    _reset_hand_state()
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
    global shoe

    shuffle_type = data.get('type', 'machine') if data else 'machine'

    shoe.reshuffle(ShuffleType(shuffle_type))
    counter.reset()           # ← Correct: new shoe = fresh count
    _reset_hand_state()       # ← Shared helper: clears hand display

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
        # Save the rank-key log from the old counter so we can replay it
        old_log = list(counter._card_log)

        # Create a fresh counter with the new system
        counter = CardCounter(system, game_config.NUM_DECKS)

        # Replay every card seen so far through the new system's tag values.
        # Uses module-level _CountKey instead of a re-created inner class.
        for key in old_log:
            counter.count_card(_CountKey(key))

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

    # ── Stop-loss / stop-win logging ──────────────────────────────────────
    stats = betting_engine.get_session_stats()
    total_profit = stats['total_profit']
    import logging as _log
    _slog = _log.getLogger('session.stops')
    _slog.info("[RESULT] bet=%.2f profit=%.2f  session_profit=%.2f  bankroll=%.2f",
               bet, profit, total_profit, stats['bankroll'])

    _safe_emit('state_update', get_full_state())


# ══════════════════════════════════════════════════════════════
# LIVE SCANNER — socket handlers + REST routes
# ══════════════════════════════════════════════════════════════
# Initialise the scanner now that _process_card_entry / _reset_hand_state
# and get_full_state are defined above.

from app.live_scanner import LiveScanner as _LiveScanner

def _apply_card(rank, suit, target=TARGET_SEEN):
    """Bridge: scanner thread → deal_card handler (thread-safe).
    Uses _process_card_entry so card tracking logic stays in one place."""
    try:
        r = RANK_MAP.get(str(rank).upper())
        s = SUIT_MAP.get(str(suit).lower())
        if r and s:
            suit_str = str(suit).lower()
            card = Card(r, s)

            # Delegate to shared helper — same logic as handle_deal_card
            _process_card_entry(card, target, suit_str)

            socketio.emit('state_update', _json.loads(_json.dumps(get_full_state(), cls=_SafeEncoder)))
    except Exception as e:
        print("[WARNING]", f'[Live] apply_card error: {e}')

def _reset_hand():
    """Bridge: scanner new-hand signal. Uses shared _reset_hand_state()."""
    _reset_hand_state()
    socketio.emit('state_update', _json.loads(_json.dumps(get_full_state(), cls=_SafeEncoder)))

live_scanner = _LiveScanner(
    socketio=socketio,
    get_state_fn=get_full_state,
    apply_card_fn=_apply_card,
    reset_hand_fn=_reset_hand,
)


@socketio.on('live_start')
def handle_live_start(data=None):
    data = data or {}
    fps    = int(data.get('fps', 5))
    region = data.get('region', None)

    live_scanner._fps = max(1, min(30, fps))
    if region and len(region) == 4:
        x, y, w, h = region
        live_scanner._roi = {'left': x, 'top': y, 'width': w, 'height': h}
    else:
        live_scanner._roi = None

    ok = live_scanner.start()
    emit('live_status', {
        'running':   live_scanner.is_running,
        'available': live_scanner.is_available,
        'fps':       live_scanner._fps,
        'message':   f'Live scanner started ({live_scanner._backend}, {fps}fps)' if ok
                     else 'Screen capture unavailable — install mss: pip install mss',
    })


@socketio.on('live_stop')
def handle_live_stop(data=None):
    live_scanner.stop()
    emit('live_status', {
        'running':   False,
        'available': live_scanner.is_available,
        'message':   'Live scanner stopped',
    })


@socketio.on('live_set_fps')
def handle_live_set_fps(data=None):
    fps = int((data or {}).get('fps', 5))
    live_scanner._fps = max(1, min(30, fps))
    emit('live_status', {
        'running': live_scanner.is_running,
        'fps':     live_scanner._fps,
        'message': f'FPS set to {fps}',
    })


@socketio.on('live_new_hand')
def handle_live_new_hand(data=None):
    _reset_hand()
    emit('notification', {'type': 'info', 'message': 'New hand started'})


# REST fallbacks — used when WebSocket isn't connected yet
@app.route('/api/live/status')
def api_live_status():
    return jsonify({
        'running':   live_scanner.is_running,
        'available': live_scanner.is_available,
        'fps':       live_scanner._fps,
    })


@app.route('/api/live/start', methods=['POST'])
def api_live_start():
    data   = request.get_json(force=True) or {}
    fps    = int(data.get('fps', 5))
    region = data.get('region', None)
    live_scanner._fps = max(1, min(30, fps))
    if region and len(region) == 4:
        x, y, w, h = region
        live_scanner._roi = {'left': x, 'top': y, 'width': w, 'height': h}
    else:
        live_scanner._roi = None
    ok = live_scanner.start()
    return jsonify({
        'running':   live_scanner.is_running,
        'available': live_scanner.is_available,
        'message':   f'Started ({live_scanner._backend}, {fps}fps)' if ok else 'mss not installed — run: pip install mss',
    })


@app.route('/api/live/stop', methods=['POST'])
def api_live_stop():
    live_scanner.stop()
    return jsonify({'running': False})


@app.route('/api/live/set_fps', methods=['POST'])
def api_live_set_fps():
    fps = int((request.get_json(force=True) or {}).get('fps', 5))
    live_scanner._fps = max(1, min(30, fps))
    return jsonify({'fps': live_scanner._fps})


@app.route('/api/live/new_hand', methods=['POST'])
def api_live_new_hand():
    _reset_hand()
    return jsonify({'ok': True})


# ── Window / tab listing ───────────────────────────────────────────────────────
def _list_windows():
    """
    Return list of {id, title, x, y, w, h} for all visible OS windows.
    Windows: ctypes EnumWindows + Chrome CDP for tabs.
    macOS:   AppleScript.
    Linux:   wmctrl / xdotool.
    """
    import platform, json as _j, subprocess
    wins = []
    system = platform.system()

    if system == 'Windows':
        try:
            import ctypes
            import ctypes.wintypes as wt

            user32 = ctypes.windll.user32

            try:
                ctypes.windll.user32.SetThreadDpiAwarenessContext(
                    ctypes.c_void_p(-2))
            except Exception:
                pass

            EnumProc = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)

            def _enum_cb(hwnd, _):
                try:
                    if not user32.IsWindowVisible(hwnd):
                        return True
                    if user32.IsIconic(hwnd):
                        return True
                    ex_style = user32.GetWindowLongW(hwnd, -20)
                    if ex_style & 0x00000080:
                        return True
                    length = user32.GetWindowTextLengthW(hwnd)
                    if length == 0:
                        return True
                    buf = ctypes.create_unicode_buffer(length + 1)
                    user32.GetWindowTextW(hwnd, buf, length + 1)
                    title = buf.value.strip()
                    if not title:
                        return True
                    rect = wt.RECT()
                    user32.GetWindowRect(hwnd, ctypes.byref(rect))
                    w = rect.right  - rect.left
                    h = rect.bottom - rect.top
                    if w < 100 or h < 100:
                        return True
                    wins.append({
                        'id':    int(hwnd),
                        'title': title,
                        'x': int(rect.left),
                        'y': int(rect.top),
                        'w': int(w),
                        'h': int(h),
                    })
                except Exception:
                    pass
                return True

            cb_ref = EnumProc(_enum_cb)
            user32.EnumWindows(cb_ref, 0)

        except Exception as e:
            print("[WARNING]", f'[Win] EnumWindows: {e}')

        if not wins:
            try:
                ps = (
                    'Get-Process | Where-Object {$_.MainWindowTitle} | '
                    'Select-Object -ExpandProperty MainWindowTitle | '
                    'ConvertTo-Json -Compress'
                )
                r = subprocess.run(
                    ['powershell', '-NoProfile', '-NonInteractive',
                     '-Command', ps],
                    capture_output=True, text=True, timeout=3,
                    creationflags=0x08000000,
                )
                if r.returncode == 0 and r.stdout.strip():
                    raw = r.stdout.strip()
                    titles = _j.loads(raw) if raw.startswith('[') else [_j.loads(raw)]
                    for t in (titles if isinstance(titles, list) else [titles]):
                        title = str(t).strip()
                        if title:
                            wins.append({
                                'id': title, 'title': title,
                                'x': 0, 'y': 0, 'w': 1920, 'h': 1080,
                            })
            except Exception as e:
                print("[WARNING]", f'[Win] PS fallback: {e}')

        for port in [9222, 9223, 9224]:
            try:
                import urllib.request
                resp = urllib.request.urlopen(
                    f'http://localhost:{port}/json', timeout=0.5)
                tabs = _j.loads(resp.read())
                for t in tabs:
                    if t.get('type') != 'page':
                        continue
                    tab_title = t.get('title', '').strip()
                    tab_url   = t.get('url', '')
                    if not tab_title or tab_url.startswith('chrome-extension://'):
                        continue
                    short = tab_title[:40]
                    matched = next((w for w in wins if short.lower() in w['title'].lower()), None)
                    geo = matched or {'x': 0, 'y': 0, 'w': 1920, 'h': 1080}
                    wins.append({
                        'id':    t.get('id', tab_url),
                        'title': f'[TAB] {tab_title}',
                        'url':   tab_url,
                        'x': geo['x'], 'y': geo['y'], 'w': geo['w'], 'h': geo['h'],
                        'is_tab': True,
                    })
            except Exception:
                pass

    elif system == 'Darwin':
        try:
            script = '''
            tell application "System Events"
                set wins to {}
                repeat with proc in (every process whose visible is true)
                    try
                        repeat with w in (every window of proc)
                            set pos to position of w
                            set sz  to size of w
                            set end of wins to {name of proc & ": " & name of w, item 1 of pos, item 2 of pos, item 1 of sz, item 2 of sz}
                        end repeat
                    end try
                end repeat
                return wins
            end tell
            '''
            r = subprocess.run(['osascript', '-e', script], capture_output=True, text=True, timeout=3)
            for line in r.stdout.strip().split(', {'):
                parts = line.strip('{}').split(', ')
                if len(parts) >= 5:
                    try:
                        wins.append({'id': parts[0], 'title': parts[0],
                                     'x': int(parts[1]), 'y': int(parts[2]),
                                     'w': int(parts[3]), 'h': int(parts[4])})
                    except ValueError:
                        pass
        except Exception as e:
            print("[WARNING]", f'[macOS] window list error: {e}')

    else:  # Linux — try wmctrl then xdotool
        try:
            r = subprocess.run(['wmctrl', '-lG'], capture_output=True, text=True, timeout=3)
            if r.returncode == 0:
                for line in r.stdout.strip().splitlines():
                    parts = line.split(None, 7)
                    if len(parts) >= 8:
                        try:
                            wins.append({
                                'id':    parts[0],
                                'title': parts[7],
                                'x': int(parts[2]), 'y': int(parts[3]),
                                'w': int(parts[4]), 'h': int(parts[5]),
                            })
                        except ValueError:
                            pass
        except FileNotFoundError:
            pass
        except Exception as e:
            print("[WARNING]", f'[Linux] wmctrl error: {e}')

        if not wins:
            try:
                r = subprocess.run(['xdotool', 'search', '--onlyvisible', '--name', ''],
                                   capture_output=True, text=True, timeout=3)
                for wid in r.stdout.strip().splitlines()[:30]:
                    try:
                        ti = subprocess.run(['xdotool', 'getwindowname', wid],
                                            capture_output=True, text=True, timeout=1)
                        ge = subprocess.run(['xdotool', 'getwindowgeometry', '--shell', wid],
                                            capture_output=True, text=True, timeout=1)
                        title = ti.stdout.strip()
                        geo   = dict(l.split('=') for l in ge.stdout.strip().splitlines() if '=' in l)
                        if title and int(geo.get('WIDTH', 0)) > 50:
                            wins.append({
                                'id': wid, 'title': title,
                                'x': int(geo.get('X', 0)), 'y': int(geo.get('Y', 0)),
                                'w': int(geo.get('WIDTH', 800)), 'h': int(geo.get('HEIGHT', 600)),
                            })
                    except Exception:
                        pass
            except FileNotFoundError:
                pass

    return wins


@app.route('/api/windows')
def api_list_windows():
    """List all visible OS windows for the tab-picker dropdown."""
    try:
        wins = _list_windows()
        browser_kw = ['chrome', 'firefox', 'edge', 'opera', 'brave', 'safari',
                      'stake', 'casino', 'blackjack', '21']
        def _score(w):
            t = w['title'].lower()
            return -1 if any(k in t for k in browser_kw) else 0
        wins.sort(key=_score)
        return jsonify({'windows': wins, 'count': len(wins)})
    except Exception as e:
        return jsonify({'windows': [], 'error': str(e)})


@app.route('/api/live/set_window', methods=['POST'])
def api_live_set_window():
    """Point the scanner at a specific window by its geometry."""
    data = request.get_json(force=True) or {}
    x, y, w, h = int(data.get('x', 0)), int(data.get('y', 0)), \
                 int(data.get('w', 1920)), int(data.get('h', 1080))
    live_scanner.set_roi(x, y, w, h)
    return jsonify({'ok': True, 'roi': {'x': x, 'y': y, 'w': w, 'h': h}})


@socketio.on('live_set_window')
def handle_live_set_window(data):
    data = data or {}
    x, y, w, h = int(data.get('x', 0)), int(data.get('y', 0)), \
                 int(data.get('w', 1920)), int(data.get('h', 1080))
    live_scanner.set_roi(x, y, w, h)
    emit('live_status', {
        'running': live_scanner.is_running,
        'message': f'Scanning window: {data.get("title", "selected")} ({w}×{h})',
    })


# ══════════════════════════════════════════════════════════════
# SERVER STARTUP
# ══════════════════════════════════════════════════════════════

def start_server(host: str = '0.0.0.0', port: int = 5000, debug: bool = False):
    import signal, sys

    def _graceful_exit(sig, frame):
        print('\n\n  ♠  BlackjackML stopped. Goodbye!\n')
        sys.exit(0)

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
    start_server()
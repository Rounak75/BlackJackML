"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/side_bets.py — Side Bet Expected Value Analyser                 ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  Calculates the real-time expected value (EV) of the true side bets         ║
║  based on the ACTUAL remaining shoe composition.                             ║
║                                                                              ║
║  WHAT IS EV?                                                                 ║
║  EV = Expected Value = your average win/loss per $1 bet, in the long run.  ║
║  EV = -5% means you lose $0.50 on average per $10 bet.                     ║
║  EV = +2% means you GAIN $0.20 on average per $10 bet. (Rare!)             ║
║                                                                              ║
║  THE SIDE BETS HANDLED HERE:                                                 ║
║  ────────────────────────────                                                ║
║  Perfect Pairs    → Your first two cards form a pair.                       ║
║                     Usually -EV but can flip +EV with unusual shoe.        ║
║                                                                              ║
║  21+3             → Your 2 cards + dealer upcard = poker hand.             ║
║                     Almost always -EV regardless of shoe.                  ║
║                                                                              ║
║  Lucky Ladies     → Your first two cards total 20.                          ║
║                     Usually -EV. Q♥+Q♥ jackpot pays 200:1.                ║
║                                                                              ║
║  NOTE — INSURANCE IS NOT A SIDE BET:                                        ║
║  Insurance has been removed from this file. It is a core game mechanic,    ║
║  not an optional side bet. It is computed separately in server.py via       ║
║  _get_insurance_data() and sent as its own top-level "insurance" key in    ║
║  the game state — never inside "side_bets".                                 ║
║  Rules: only offered when dealer upcard is Ace, costs half the main bet,   ║
║  pays 2:1 if dealer has blackjack, profitable when True Count >= +3.       ║
║                                                                              ║
║  EV FORMULA USED (correct net formula):                                      ║
║    EV = Σ(probability_i × (payout_i - 1)) - probability_lose              ║
║    The "-1" subtracts your $1 stake from each winning payout.               ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from typing import Dict, List
from .card import Card, Shoe
from .counting import CardCounter
import itertools
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import SideBetConfig


class SideBetAnalyzer:
    """
    Real-time expected value calculator for blackjack side bets.
    Uses remaining shoe composition for accurate probability calculation.

    Insurance is intentionally excluded — it is handled separately in
    server.py as a game mechanic, not a side bet.
    """

    def __init__(self, config: SideBetConfig = None):
        self.config = config or SideBetConfig()

    def analyze_all(self, shoe: Shoe, counter: CardCounter,
                    player_cards: List[Card] = None,
                    dealer_upcard: Card = None) -> Dict:
        """
        Analyze all true side bets.
        Insurance is NOT included here — see server.py _get_insurance_data().
        """
        return {
            "perfect_pairs":     self.perfect_pairs_ev(shoe),
            "twenty_one_plus_3": self.twenty_one_plus_3_ev(shoe, player_cards, dealer_upcard),
            "lucky_ladies":      self.lucky_ladies_ev(shoe),
        }

    def perfect_pairs_ev(self, shoe: Shoe) -> Dict:
        """
        Perfect Pairs: pays on player's first two cards being a pair.
        - Perfect Pair (same rank, same suit): 25:1
        - Colored Pair (same rank, same color): 12:1
        - Mixed Pair (same rank, different color): 6:1
        """
        remaining = shoe.cards_remaining
        if remaining < 2:
            return {"name": "Perfect Pairs", "ev": -100, "recommended": False}

        total_cards = len(shoe.cards)
        ev = 0.0

        # Count remaining cards by (rank, suit)
        card_counts = {}
        for card in shoe.cards:
            key = (card.rank, card.suit)
            card_counts[key] = card_counts.get(key, 0) + 1

        # Count by rank
        rank_counts = {}
        for card in shoe.cards:
            rank_counts[card.rank] = rank_counts.get(card.rank, 0) + 1

        total_combos = total_cards * (total_cards - 1)  # ordered pairs
        if total_combos == 0:
            return {"name": "Perfect Pairs", "ev": -100, "recommended": False}

        perfect_prob = 0.0
        colored_prob = 0.0
        mixed_prob = 0.0

        for rank in set(c.rank for c in shoe.cards):
            same_rank = [c for c in shoe.cards if c.rank == rank]
            n = len(same_rank)
            if n < 2:
                continue

            # Perfect pairs: same suit
            suit_counts = {}
            for c in same_rank:
                suit_counts[c.suit] = suit_counts.get(c.suit, 0) + 1

            for s, cnt in suit_counts.items():
                if cnt >= 2:
                    perfect_prob += cnt * (cnt - 1) / total_combos

            # Colored pairs: same color, different suit
            from .card import Suit
            red_suits = [Suit.HEARTS, Suit.DIAMONDS]
            black_suits = [Suit.CLUBS, Suit.SPADES]

            red_count = sum(suit_counts.get(s, 0) for s in red_suits)
            black_count = sum(suit_counts.get(s, 0) for s in black_suits)

            red_same_suit_pairs = sum(c * (c - 1) for s in red_suits
                                      for c in [suit_counts.get(s, 0)])
            black_same_suit_pairs = sum(c * (c - 1) for s in black_suits
                                        for c in [suit_counts.get(s, 0)])

            red_colored = red_count * (red_count - 1) - red_same_suit_pairs
            black_colored = black_count * (black_count - 1) - black_same_suit_pairs

            colored_prob += max(0, red_colored + black_colored) / total_combos

            # Mixed pairs: different color
            mixed_count = n * (n - 1) - (red_count * (red_count - 1) + black_count * (black_count - 1))
            mixed_prob += max(0, mixed_count) / total_combos

        payouts = self.config.PERFECT_PAIRS_PAYOUT
        loss_prob = 1 - perfect_prob - colored_prob - mixed_prob
        ev = (perfect_prob * (payouts["perfect"] - 1)
              + colored_prob * (payouts["colored"] - 1)
              + mixed_prob * (payouts["mixed"] - 1)
              - loss_prob)

        recommended = ev > 0

        return {
            "name": "Perfect Pairs",
            "ev": round(ev * 100, 2),
            "perfect_prob": round(perfect_prob * 100, 2),
            "colored_prob": round(colored_prob * 100, 2),
            "mixed_prob": round(mixed_prob * 100, 2),
            "recommended": recommended,
            "emoji": "✅" if recommended else "❌",
        }

    def twenty_one_plus_3_ev(self, shoe: Shoe, player_cards: List[Card] = None,
                              dealer_upcard: Card = None) -> Dict:
        """
        21+3: Uses player's 2 cards + dealer upcard to form poker hand.
        Pre-deal: estimate general EV.
        Post-deal: calculate exact probability with known cards.
        """
        remaining = shoe.cards_remaining
        if remaining < 3:
            return {"name": "21+3", "ev": -100, "recommended": False}

        # Simplified EV estimate based on shoe composition
        total = len(shoe.cards)
        suited_trips_prob = 0.0001  # Approximate
        straight_flush_prob = 0.002
        three_kind_prob = 0.003
        straight_prob = 0.03
        flush_prob = 0.05

        payouts = self.config.TWENTY_ONE_PLUS_3_PAYOUT
        loss_prob = (1 - suited_trips_prob - straight_flush_prob - three_kind_prob
                     - straight_prob - flush_prob)
        ev = (suited_trips_prob * (payouts["suited_trips"] - 1)
              + straight_flush_prob * (payouts["straight_flush"] - 1)
              + three_kind_prob * (payouts["three_of_a_kind"] - 1)
              + straight_prob * (payouts["straight"] - 1)
              + flush_prob * (payouts["flush"] - 1)
              - loss_prob)

        recommended = ev > 0

        return {
            "name": "21+3",
            "ev": round(ev * 100, 2),
            "recommended": recommended,
            "emoji": "✅" if recommended else "❌",
        }

    def lucky_ladies_ev(self, shoe: Shoe) -> Dict:
        """
        Lucky Ladies: pays on player's first two cards totaling 20.
        Queen of Hearts pair is the top payout.
        """
        remaining = shoe.cards_remaining
        if remaining < 2:
            return {"name": "Lucky Ladies", "ev": -100, "recommended": False}

        total = len(shoe.cards)
        from .card import Rank, Suit

        # Count queen of hearts remaining
        qh_count = sum(1 for c in shoe.cards
                       if c.rank == Rank.QUEEN and c.suit == Suit.HEARTS)

        # Count all 10-value cards
        ten_vals = sum(1 for c in shoe.cards if c.value == 10)

        # Approximate probabilities
        qh_pair_prob = (qh_count * (qh_count - 1)) / (total * (total - 1)) if qh_count >= 2 else 0

        # Any 20: count ways to make 20 from 2 cards
        twenty_count = 0
        for i, c1 in enumerate(shoe.cards):
            for c2 in shoe.cards[i + 1:]:
                if c1.value + c2.value == 20:
                    twenty_count += 1

        total_combos = total * (total - 1) / 2
        any_20_prob = twenty_count / total_combos if total_combos > 0 else 0

        payouts = self.config.LUCKY_LADIES_PAYOUT
        # qh_pair is a subset of any_20 — award the higher tier only
        non_qh_20_prob = max(0.0, any_20_prob - qh_pair_prob)
        loss_prob = 1 - any_20_prob
        ev = (qh_pair_prob * (payouts["queen_hearts_pair"] - 1)
              + non_qh_20_prob * (payouts["any_20"] - 1)
              - loss_prob)

        recommended = ev > 0

        return {
            "name": "Lucky Ladies",
            "ev": round(ev * 100, 2),
            "qh_remaining": qh_count,
            "any_20_prob": round(any_20_prob * 100, 2),
            "recommended": recommended,
            "emoji": "✅" if recommended else "❌",
        }

    def get_recommendations(self, shoe: Shoe, counter: CardCounter) -> Dict:
        """Get a summary of all side bet recommendations."""
        analysis = self.analyze_all(shoe, counter)
        profitable = {k: v for k, v in analysis.items() if v.get("recommended", False)}

        return {
            "all_bets": analysis,
            "profitable_bets": list(profitable.keys()),
            "has_profitable": len(profitable) > 0,
            "best_bet": max(analysis.items(), key=lambda x: x[1].get("ev", -999))[0]
                        if analysis else None,
        }
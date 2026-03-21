"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/counting.py — Card Counting Engine                               ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  Implements card counting: tracking a running count, converting to          ║
║  true count, estimating player advantage, and signalling when to bet up.   ║
║                                                                              ║
║  HOW CARD COUNTING WORKS:                                                    ║
║  ─────────────────────────                                                   ║
║  1. Every card you see gets a +1, 0, or -1 tag (per system in config.py)   ║
║  2. You add these tags to a Running Count (RC)                              ║
║  3. Divide RC by Decks Remaining → True Count (TC)                          ║
║  4. TC > 0: shoe is rich in high cards → good for player → BET MORE        ║
║  5. TC < 0: shoe is rich in low cards → bad for player → BET MINIMUM       ║
║                                                                              ║
║  TRUE COUNT → PLAYER ADVANTAGE (approximate, Hi-Lo):                       ║
║    TC = -2  →  house edge ~1.5%                                             ║
║    TC =  0  →  house edge ~0.5% (basic strategy only)                       ║
║    TC = +1  →  roughly break even                                            ║
║    TC = +2  →  player edge ~0.5%                                            ║
║    TC = +4  →  player edge ~1.5% (bet 8 units!)                             ║
║                                                                              ║
║  HOW TO USE:                                                                 ║
║    counter = CardCounter(system="hi_lo", num_decks=8)                       ║
║    counter.count_card(card)           # process one dealt card              ║
║    print(counter.true_count)          # current TC                          ║
║    print(counter.advantage * 100)     # player edge as percentage           ║
║    print(counter.should_take_insurance())  # True/False                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from typing import List, Dict, Optional
from .card import Card
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import CountingConfig


class CardCounter:
    """
    Multi-system card counter with running/true count tracking.
    """

    SYSTEMS = CountingConfig.SYSTEMS

    def __init__(self, system: str = "hi_lo", num_decks: int = 6):
        # Validate system name against those defined in config.py
        if system not in self.SYSTEMS:
            raise ValueError(f"Unknown system: {system}. Choose from {list(self.SYSTEMS.keys())}")

        self.system_name = system
        self.values = self.SYSTEMS[system]
        self.num_decks = num_decks
        self.running_count = 0      # The live count you keep in your head
        self.cards_seen = 0         # Total cards counted (for true count calc)
        self.count_history: List[Dict] = []
        self._card_log: List[int] = []  # Rank keys of every card seen

        # ── Side counts ────────────────────────────────────────────────────
        # Track Aces and 10-value cards separately from the main count.
        # Hi-Lo treats Aces as -1 (same as 10s) but Aces are uniquely powerful
        # because they enable Blackjack (3:2 payout). Tracking them separately
        # lets us compute an "Ace-adjusted TC" for betting decisions.
        self.aces_seen = 0          # How many Aces have been dealt
        self.tens_seen = 0          # How many 10/J/Q/K have been dealt

    def count_card(self, card: Card):
        """Process a single dealt card."""
        val = self.values.get(card.count_key, 0)
        self.running_count += val
        self.cards_seen += 1
        self._card_log.append(card.count_key)
        # Side counts — tracked independently of main counting system
        if card.is_ace:
            self.aces_seen += 1
        if card.is_ten:
            self.tens_seen += 1
        self.count_history.append({
            "card": str(card),
            "count_value": val,
            "running_count": self.running_count,
            "true_count": self.true_count,
            "cards_seen": self.cards_seen,
        })

    def count_cards(self, cards: List[Card]):
        """Process multiple cards at once."""
        for card in cards:
            self.count_card(card)

    @property
    def decks_remaining(self) -> float:
        total = self.num_decks * 52
        remaining = total - self.cards_seen
        return max(remaining / 52.0, 0.25)  # Floor at 0.25 (13 cards) — more accurate late-shoe TC

    @property
    def true_count(self) -> float:
        """True Count = Running Count / Decks Remaining.
        This normalises the count for different numbers of decks — a RC of +6
        with 3 decks left (TC=2) is the same strength as RC=+2 with 1 deck.
        """
        return self.running_count / self.decks_remaining

    @property
    def true_count_int(self) -> int:
        """Floored true count for strategy lookups."""
        return int(self.true_count)

    @property
    def penetration(self) -> float:
        total = self.num_decks * 52
        return self.cards_seen / total if total > 0 else 0.0

    # ── Side count properties ───────────────────────────────────────────────

    @property
    def aces_remaining(self) -> int:
        """How many Aces are still in the shoe."""
        return max(0, self.num_decks * 4 - self.aces_seen)

    @property
    def tens_remaining(self) -> int:
        """How many 10-value cards (10/J/Q/K) are still in the shoe."""
        return max(0, self.num_decks * 16 - self.tens_seen)

    @property
    def aces_expected(self) -> float:
        """Expected Aces remaining based on cards_seen (null hypothesis)."""
        total_cards = self.num_decks * 52
        total_aces  = self.num_decks * 4
        remaining   = total_cards - self.cards_seen
        return total_aces * (remaining / total_cards) if total_cards > 0 else 0.0

    @property
    def tens_expected(self) -> float:
        """Expected 10-value cards remaining based on cards_seen."""
        total_cards = self.num_decks * 52
        total_tens  = self.num_decks * 16
        remaining   = total_cards - self.cards_seen
        return total_tens * (remaining / total_cards) if total_cards > 0 else 0.0

    @property
    def ace_adjustment(self) -> float:
        """
        How many extra/fewer Aces remain vs expectation, normalised per deck.
        Positive = Ace-rich shoe (add to TC for betting decisions).
        Negative = Ace-poor shoe (subtract from TC for betting decisions).
        Rule of thumb: each +1 Ace-per-deck above expectation ≈ +0.4 TC units.
        """
        decks_left = self.decks_remaining
        if decks_left <= 0:
            return 0.0
        extra_aces = self.aces_remaining - self.aces_expected
        return round(extra_aces / decks_left * 0.4, 2)

    @property
    def ten_adjustment(self) -> float:
        """
        How many extra/fewer 10-value cards remain vs expectation per deck.
        Positive = Ten-rich shoe. Negative = Ten-poor.
        Each extra 10 per deck ≈ +0.1 TC units (less impactful than Aces).
        """
        decks_left = self.decks_remaining
        if decks_left <= 0:
            return 0.0
        extra_tens = self.tens_remaining - self.tens_expected
        return round(extra_tens / decks_left * 0.1, 2)

    @property
    def ace_adjusted_tc(self) -> float:
        """
        True Count adjusted for Ace richness/poorness.
        Use THIS for bet sizing decisions (not for strategy plays).
        For strategy plays, always use plain true_count.
        """
        return round(self.true_count + self.ace_adjustment + self.ten_adjustment, 2)

    def get_side_count_state(self) -> dict:
        """Full side count state for the frontend."""
        return {
            "aces_seen":       self.aces_seen,
            "aces_remaining":  self.aces_remaining,
            "aces_expected":   round(self.aces_expected, 1),
            "ace_rich":        self.aces_remaining > self.aces_expected,
            "ace_adjustment":  self.ace_adjustment,
            "tens_seen":       self.tens_seen,
            "tens_remaining":  self.tens_remaining,
            "tens_expected":   round(self.tens_expected, 1),
            "ten_rich":        self.tens_remaining > self.tens_expected,
            "ten_adjustment":  self.ten_adjustment,
            "ace_adjusted_tc": self.ace_adjusted_tc,
        }

    @property
    def advantage(self) -> float:
        """
        Estimated player advantage based on true count.
        Each +1 TC ≈ +0.5% player advantage (Hi-Lo).
        Base house edge = -0.50% with perfect basic strategy (8-deck S17).
        Per casino rules: house edge ~2% without strategy, 0.5% with perfect play (RTP 99.50%).
        Break-even at TC = +1.
        """
        base_edge = -0.0043          # House edge 8-deck S17: 0.43% (Griffin/WoO reference)
        tc_advantage = self.true_count * 0.005  # Each +1 TC ≈ +0.5% to player (Hi-Lo system)
        return base_edge + tc_advantage

    @property
    def is_favorable(self) -> bool:
        """Is the count favorable for the player?"""
        return self.advantage > 0

    def should_take_insurance(self) -> bool:
        """Insurance is +EV at true count >= +3."""
        return self.true_count >= CountingConfig.INSURANCE_THRESHOLD

    def should_wong_in(self) -> bool:
        return self.true_count >= CountingConfig.WONGING_ENTER_TC

    def should_wong_out(self) -> bool:
        return self.true_count < CountingConfig.WONGING_EXIT_TC

    def reset(self):
        """Reset for a new shoe."""
        self.running_count = 0
        self.cards_seen = 0
        self.count_history = []
        self._card_log = []
        self.aces_seen = 0
        self.tens_seen = 0

    def get_remaining_estimate(self) -> Dict[int, float]:
        """
        Estimate remaining card composition based on dealt cards.
        Returns probability of each rank value remaining.
        """
        total_per_rank = {
            2: 4 * self.num_decks, 3: 4 * self.num_decks, 4: 4 * self.num_decks,
            5: 4 * self.num_decks, 6: 4 * self.num_decks, 7: 4 * self.num_decks,
            8: 4 * self.num_decks, 9: 4 * self.num_decks,
            10: 16 * self.num_decks,  # 10, J, Q, K
            11: 4 * self.num_decks,   # Ace
        }

        seen_counts = {i: 0 for i in range(2, 12)}
        for key in self._card_log:
            seen_counts[key] = seen_counts.get(key, 0) + 1

        remaining = {}
        total_remaining = sum(total_per_rank[k] - seen_counts.get(k, 0) for k in total_per_rank)
        if total_remaining <= 0:
            return {k: 1.0 / len(total_per_rank) for k in total_per_rank}

        for rank_val, total in total_per_rank.items():
            left = total - seen_counts.get(rank_val, 0)
            remaining[rank_val] = max(left, 0) / total_remaining

        return remaining

    def get_state_vector(self) -> List[float]:
        """
        Get current count state as a feature vector for ML models.
        Returns: [running_count, true_count, penetration, advantage,
                  remaining_prob_2, ..., remaining_prob_11]
        """
        remaining = self.get_remaining_estimate()
        return [
            float(self.running_count),
            float(self.true_count),
            float(self.penetration),
            float(self.advantage),
        ] + [remaining.get(i, 0.0) for i in range(2, 12)]

    def __repr__(self) -> str:
        return (f"CardCounter({self.system_name}: RC={self.running_count}, "
                f"TC={self.true_count:.1f}, seen={self.cards_seen})")
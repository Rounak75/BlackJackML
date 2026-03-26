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
║                                                                              ║
║  IMPROVEMENTS IN THIS VERSION:                                               ║
║  ────────────────────────────                                                ║
║  PERF 1 — _total_per_rank pre-computed in __init__:                        ║
║    Previously get_remaining_estimate() rebuilt the entire rank-total dict   ║
║    on every call. Since num_decks never changes after construction, this    ║
║    dict is now computed once in __init__ and reused. This matters because   ║
║    get_remaining_estimate() is called once per get_full_state() call        ║
║    (i.e., every card dealt event).                                           ║
║                                                                              ║
║  PERF 2 — count_history capped at _MAX_HISTORY (500 entries):              ║
║    The history list was unbounded. In a long session (8+ hours, 300+        ║
║    hands, 4+ cards/hand) it would grow to 3000+ entries. The frontend       ║
║    only reads the last 60 entries (server.py: counter.count_history[-60:]). ║
║    Capping at 500 wastes nothing visible while bounding memory use.         ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from typing import List, Dict, Optional
from .card import Card
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import CountingConfig

# Maximum count_history entries to keep in memory.
# The frontend only reads the last 60 (server.py: counter.count_history[-60:]).
# Capping at 500 prevents unbounded memory growth in long multi-hour sessions
# while keeping 8× more history than the UI ever needs (safe margin).
_MAX_HISTORY = 500


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

        # ── Pre-computed rank totals ────────────────────────────────────────
        # PERF: Previously rebuilt inside get_remaining_estimate() on every
        # call. num_decks is fixed at construction time, so we compute once.
        self._total_per_rank: Dict[int, int] = {
            2:  4 * num_decks,
            3:  4 * num_decks,
            4:  4 * num_decks,
            5:  4 * num_decks,
            6:  4 * num_decks,
            7:  4 * num_decks,
            8:  4 * num_decks,
            9:  4 * num_decks,
            10: 16 * num_decks,   # 10, J, Q, K — four ranks × four suits × num_decks
            11: 4 * num_decks,    # Ace
        }

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
        # PERF: Cap history to prevent unbounded memory growth.
        # _MAX_HISTORY (500) is 8× the 60 entries the frontend reads,
        # so no displayed information is ever lost.
        if len(self.count_history) > _MAX_HISTORY:
            self.count_history = self.count_history[-_MAX_HISTORY:]

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

        PERF: Uses self._total_per_rank (pre-computed in __init__) instead of
        rebuilding the dict on every call. The dict is identical across all calls
        since num_decks is fixed at construction time.
        """
        seen_counts = {i: 0 for i in range(2, 12)}
        for key in self._card_log:
            seen_counts[key] = seen_counts.get(key, 0) + 1

        remaining = {}
        total_remaining = sum(
            self._total_per_rank[k] - seen_counts.get(k, 0)
            for k in self._total_per_rank
        )
        if total_remaining <= 0:
            return {k: 1.0 / len(self._total_per_rank) for k in self._total_per_rank}

        for rank_val, total in self._total_per_rank.items():
            left = total - seen_counts.get(rank_val, 0)
            remaining[rank_val] = max(left, 0) / total_remaining

        return remaining

    @property
    def shoe_quality_score(self) -> dict:
        """
        Feature 4 — Shoe Quality Score (0–100).

        A single number combining the four signals that determine how
        profitable and reliable the current shoe is for advantage play.
        Uses ONLY existing properties — no new tracking state.

        Component weights (sum to 100):
          TC component     (40 pts) — dominant signal; TC drives EV directly.
                                      Scaled: TC=-4→0pts, TC=0→20pts, TC=+5→40pts.
          Penetration      (25 pts) — deeper shoe = more reliable TC.
                                      Scaled: 0%→0pts, 75%→18.75pts, 100%→25pts.
          Ace richness     (20 pts) — Ace surplus above expectation adds EV.
                                      Neutral = 10pts; +1 ace/deck above = +5pts.
                                      Clamped [0, 20].
          Ten richness     (15 pts) — Ten surplus above expectation adds EV
                                      (independently from TC).
                                      Neutral = 7.5pts. Clamped [0, 15].

        Returns:
            {
              "score":        78,       # 0–100
              "label":        "GOOD",   # POOR / FAIR / GOOD / EXCELLENT
              "components": {
                "true_count":   28.0,
                "penetration":  18.75,
                "ace_richness": 12.0,
                "ten_richness": 8.5,
              }
            }
        """
        # ── TC component (0–40) ───────────────────────────────────────────────
        # Linear from TC=-4 (0pts) to TC=0 (20pts) to TC=+5 (40pts).
        # Clamped so extreme TC values don't push above 40 or below 0.
        tc = self.true_count
        tc_score = max(0.0, min(40.0, (tc + 4) / 9 * 40))

        # ── Penetration component (0–25) ──────────────────────────────────────
        # Linear: 0% dealt = 0pts, 100% dealt = 25pts.
        pen_score = self.penetration * 25.0

        # ── Ace richness component (0–20) ─────────────────────────────────────
        # Neutral (actual = expected) → 10pts.
        # Each extra ace per remaining deck above expectation → +5pts.
        # Each ace per deck below → -5pts. Clamped [0, 20].
        decks_left = max(self.decks_remaining, 0.25)
        extra_aces_per_deck = (self.aces_remaining - self.aces_expected) / decks_left
        ace_score = max(0.0, min(20.0, 10.0 + extra_aces_per_deck * 5.0))

        # ── Ten richness component (0–15) ─────────────────────────────────────
        # Neutral → 7.5pts. Each extra ten per remaining deck → +2pts. Clamped [0,15].
        extra_tens_per_deck = (self.tens_remaining - self.tens_expected) / decks_left
        ten_score = max(0.0, min(15.0, 7.5 + extra_tens_per_deck * 2.0))

        total = tc_score + pen_score + ace_score + ten_score  # max possible = 100

        if total >= 75:
            label = "EXCELLENT"
        elif total >= 55:
            label = "GOOD"
        elif total >= 35:
            label = "FAIR"
        else:
            label = "POOR"

        return {
            "score": round(total, 1),
            "label": label,
            "components": {
                "true_count":   round(tc_score, 2),
                "penetration":  round(pen_score, 2),
                "ace_richness": round(ace_score, 2),
                "ten_richness": round(ten_score, 2),
            },
        }

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
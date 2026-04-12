"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/counting.py — Card Counting Engine                                ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  Implements card counting: tracking a running count, converting to           ║
║  true count, estimating player advantage, and signalling when to bet up.     ║
║                                                                              ║
║  HOW CARD COUNTING WORKS:                                                    ║
║  ─────────────────────────                                                   ║
║  1. Every card you see gets a tag (per system in config.py)                  ║
║     Hi-Lo: +1/0/-1 | Wong Halves: +0.5/+1/+1.5/0/-0.5/-1                     ║
║  2. You add these tags to a Running Count (RC)                               ║
║  3. Divide RC by Decks Remaining → True Count (TC)                           ║
║  4. TC > 0: shoe is rich in high cards → good for player → BET MORE          ║
║  5. TC < 0: shoe is rich in low cards → bad for player → BET MINIMUM         ║
║                                                                              ║
║  TRUE COUNT → PLAYER ADVANTAGE (approximate, Hi-Lo):                         ║
║    TC = -2  →  house edge ~1.5%                                              ║
║    TC =  0  →  house edge ~0.5% (basic strategy only)                        ║
║    TC = +1  →  roughly break even                                            ║
║    TC = +2  →  player edge ~0.5%                                             ║
║    TC = +4  →  player edge ~1.5% (bet 8 units!)                              ║
║                                                                              ║
║  HOW TO USE:                                                                 ║
║    counter = CardCounter(system="hi_lo", num_decks=8)                        ║
║    counter = CardCounter(system="wong_halves", num_decks=6)  # fractional    ║
║    counter.count_card(card)           # process one dealt card               ║
║    print(counter.true_count)          # current TC                           ║
║    print(counter.advantage * 100)     # player edge as percentage            ║
║    print(counter.should_take_insurance())  # True/False                      ║
║                                                                              ║
║  IMPROVEMENTS IN THIS VERSION:                                               ║
║  ────────────────────────────                                                ║
║  PERF 1 — _total_per_rank pre-computed in __init__:                          ║
║    Previously get_remaining_estimate() rebuilt the entire rank-total dict    ║
║    on every call. Since num_decks never changes after construction, this     ║
║    dict is now computed once in __init__ and reused. This matters because    ║
║    get_remaining_estimate() is called once per get_full_state() call         ║
║    (i.e., every card dealt event).                                           ║
║                                                                              ║
║  PERF 2 — count_history capped at _MAX_HISTORY (500 entries):                ║
║    The history list was unbounded. In a long session (8+ hours, 300+         ║
║    hands, 4+ cards/hand) it would grow to 3000+ entries. The frontend        ║
║    only reads the last 60 entries (server.py: counter.count_history[-60:]).  ║
║    Capping at 500 wastes nothing visible while bounding memory use.          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from typing import List, Dict, Optional
from collections import deque
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

    def __init__(self, system: str = "hi_lo", num_decks: int = 6, burn_cards: int = 1):
        # Validate system name against those defined in config.py
        if system not in self.SYSTEMS:
            raise ValueError(f"Unknown system: {system}. Choose from {list(self.SYSTEMS.keys())}")

        self.system_name = system
        self.values = self.SYSTEMS[system]
        self.num_decks = num_decks
        # Subtract burn card(s) from the total so decks_remaining and true_count
        # match the Shoe's actual card count. Without this, the counter assumes
        # num_decks*52 cards exist but the Shoe removes burn_cards on init,
        # causing decks_remaining to be inflated by burn_cards/52 for the
        # entire session — a small but systematic true count error.
        self._total_cards = num_decks * 52 - burn_cards

        # FIX C3 — KO Initial Running Count (IRC).
        # KO is an UNBALANCED system: a full N-deck shoe sums to +4*(N-1),
        # not 0.  Players start at IRC = -4*(N-1) so that the Running Count
        # crosses 0 ("the pivot") at roughly the same EV advantage as Hi-Lo
        # TC = +1.  Starting at 0 makes the RC 28 units high in an 8-deck
        # shoe — every bet signal is completely wrong.
        # Reference: Olaf Vancura & Ken Fuchs, "Knock-Out Blackjack" (1998).
        KO_IRC = {1: 0, 2: -4, 4: -12, 6: -20, 8: -28}
        if system == 'ko':
            self.running_count = KO_IRC.get(num_decks, -(4 * (num_decks - 1)))
        else:
            self.running_count = 0      # Balanced systems start at 0
        self._ko_irc = self.running_count  # Store for reset()

        self.cards_seen = 0         # Total cards counted (for true count calc)
        # FIX M10: deque(maxlen) drops oldest entry O(1) vs list slice O(N)
        self.count_history: deque = deque(maxlen=_MAX_HISTORY)
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
        # deque(maxlen=_MAX_HISTORY) auto-drops the oldest entry — no manual slice needed.

    def count_cards(self, cards: List[Card]):
        """Process multiple cards at once."""
        for card in cards:
            self.count_card(card)

    @property
    def decks_remaining(self) -> float:
        remaining = self._total_cards - self.cards_seen
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
    def effective_tc(self) -> float:
        """
        Effective True Count — the count value used for all EV-dependent
        decisions: advantage, insurance, wonging, bet sizing.

        For BALANCED systems (Hi-Lo, Omega II, Zen, Wong Halves, Uston APC):
            effective_tc == true_count  (no adjustment needed)

        For KO (UNBALANCED):
            KO's running count starts at IRC = -4*(N-1) not 0.
            Using raw TC distorts all EV calculations at the start of the shoe.
            Example: 8-deck KO, 0 cards dealt:
              raw TC = -28 / 7.98 = -3.51  → shows -2.2% player edge (wrong!)
              effective TC = (-28 - (-28)) / 7.98 = 0  → correct: neutral shoe

            Formula: (running_count - _ko_irc) / decks_remaining
            This measures how far RC has moved from the IRC baseline,
            equivalent to a balanced system's TC from 0.

        Use effective_tc for: advantage, insurance, wonging, bet ramp.
        Use raw true_count for: display purposes, TC history chart.
        """
        if self.system_name == 'ko':
            return (self.running_count - self._ko_irc) / self.decks_remaining
        return self.true_count

    @property
    def penetration(self) -> float:
        return self.cards_seen / self._total_cards if self._total_cards > 0 else 0.0

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
        total_aces  = self.num_decks * 4
        remaining   = self._total_cards - self.cards_seen
        return total_aces * (remaining / self._total_cards) if self._total_cards > 0 else 0.0

    @property
    def tens_expected(self) -> float:
        """Expected 10-value cards remaining based on cards_seen."""
        total_tens  = self.num_decks * 16
        remaining   = self._total_cards - self.cards_seen
        return total_tens * (remaining / self._total_cards) if self._total_cards > 0 else 0.0

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
        # Base on effective_tc so KO Ace-adjusted count is also IRC-corrected
        return round(self.effective_tc + self.ace_adjustment + self.ten_adjustment, 2)

    @property
    def shoe_quality_score(self) -> int:
        """
        Composite shoe quality score (0-100). Higher = better for the player.

        Weights:
          60% — True Count  (primary signal; clamped -5..+5 mapped to 0..100)
          25% — Penetration (deeper shoe = count more reliable = higher quality)
          15% — Ace richness (ace-rich shoe improves BJ probability)

        Thresholds:  0-40 Bad (Red)  |  40-70 Neutral (Yellow)  |  70-100 Strong (Green)
        """
        # Use effective_tc so KO shoe quality reflects real count strength
        tc_clamped = max(-5.0, min(5.0, self.effective_tc))
        tc_score   = (tc_clamped + 5.0) / 10.0 * 100.0   # -5..+5  -> 0..100
        pen_score  = self.penetration * 100.0              # 0..1    -> 0..100
        # ace_adjustment typically -0.5..+0.5; normalise to 0..1 then scale
        ace_norm   = max(0.0, min(1.0, (self.ace_adjustment + 1.0) / 2.0))
        ace_score  = ace_norm * 100.0

        raw   = 0.60 * tc_score + 0.25 * pen_score + 0.15 * ace_score
        score = max(0, min(100, int(raw)))
        # FIX M7: removed per-card debug log — this property is called once per
        # card dealt (via get_full_state), generating 1200+ log entries per session.
        # Use the dedicated log_shoe_quality() method below for explicit logging.
        return score

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

        FIX C5: The previous formula used TC * 0.005 directly, which is only
        calibrated for Hi-Lo (max TC ≈ ±10 per deck).  Level-2 systems
        (Omega II, Zen) produce TCs ~2× larger for the same shoe composition
        because their tags are ±2 vs ±1.  Applying the same multiplier doubled
        the displayed edge for those systems.

        Fix: normalize the TC into "Hi-Lo equivalent" units using the per-system
        max-TC scalar from CountingConfig.COUNT_NORM_SCALARS before computing
        advantage.  Hi-Lo scalar = 10.0 (baseline), so Hi-Lo is unchanged.
        Omega II scalar = 20.0, so its TC is halved before the formula.

        Base house edge = 0.43% for 8-deck S17 perfect basic strategy.
        Each +1 Hi-Lo-equivalent TC ≈ +0.5% player advantage.
        """
        # For KO: use effective_tc (IRC-adjusted) so advantage starts at
        # -0.43% (neutral shoe) not -2.2% (distorted by IRC offset).
        # For balanced systems: effective_tc == true_count (no change).
        tc = self.effective_tc

        # Normalize to Hi-Lo-equivalent units (C5 fix for Level-2/3 systems)
        scalars = CountingConfig.COUNT_NORM_SCALARS.get(self.system_name, (10.0, 20.0, 0.10))
        tc_scalar = scalars[0]                          # 10.0 Hi-Lo, 20.0 Omega II/Zen, etc.
        normalized_tc = tc / (tc_scalar / 10.0)

        base_edge    = -0.0043                          # House edge 8-deck S17
        tc_advantage = normalized_tc * 0.005            # Each +1 normalized TC ≈ +0.5%
        return base_edge + tc_advantage

    @property
    def is_favorable(self) -> bool:
        """Is the count favorable for the player?"""
        return self.advantage > 0

    def should_take_insurance(self) -> bool:
        """Insurance is +EV at effective true count >= +3.
        Uses effective_tc so KO gives correct results (IRC-adjusted)."""
        return self.effective_tc >= CountingConfig.INSURANCE_THRESHOLD

    def should_wong_in(self) -> bool:
        """Uses effective_tc so KO wonging thresholds work correctly."""
        return self.effective_tc >= CountingConfig.WONGING_ENTER_TC

    def should_wong_out(self) -> bool:
        """Uses effective_tc so KO wonging thresholds work correctly."""
        return self.effective_tc < CountingConfig.WONGING_EXIT_TC

    def reset(self):
        """Reset for a new shoe.
        FIX C3: KO resets to IRC (Initial Running Count), not 0.
        Balanced systems reset to 0 as before."""
        self.running_count = self._ko_irc  # 0 for balanced systems, IRC for KO
        self.cards_seen = 0
        self.count_history = deque(maxlen=_MAX_HISTORY)
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
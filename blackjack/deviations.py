"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/deviations.py — Count-Based Strategy Deviations                 ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  When the True Count is high or low enough, the optimal play CHANGES        ║
║  from basic strategy. These overrides are called "deviations."             ║
║                                                                              ║
║  TWO DEVIATION SETS:                                                         ║
║  ────────────────────                                                        ║
║  ILLUSTRIOUS 18 (I18):                                                       ║
║    The 18 most valuable play deviations. Combined worth ~0.15% extra edge. ║
║    Example: Hard 16 vs dealer 10 → basic strategy says HIT                 ║
║             But at TC ≥ 0, the shoe is rich enough in 10s that STAND       ║
║             is actually better (you want the dealer to bust).               ║
║                                                                              ║
║  FAB 4 SURRENDERS:                                                           ║
║    4 count-based surrender plays worth an additional ~0.05% edge.          ║
║    These are checked BEFORE I18 because surrender is always evaluated first.║
║                                                                              ║
║  TOTAL EXTRA EDGE FROM DEVIATIONS: ~0.15-0.20%                              ║
║  (On top of the ~0.5-1.0% from counting + bet spread alone)                ║
║                                                                              ║
║  HOW TO USE:                                                                 ║
║    engine = DeviationEngine()                                                ║
║    action = engine.get_action(hand, dealer_upcard, true_count=3.5)         ║
║    info   = engine.get_action_with_info(...)   # includes deviation details ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from typing import Optional
from .game import Action, Hand
from .card import Card
from .strategy import BasicStrategy


class Deviation:
    """A single strategy deviation triggered by true count."""

    def __init__(self, hand_type: str, hand_value: int, dealer_upcard: int,
                 action: Action, tc_threshold: float, direction: str = ">="):
        """
        Args:
            hand_type: "hard", "soft", or "pair"
            hand_value: player hand total or pair card value
            dealer_upcard: dealer upcard value (2-11, 11=Ace)
            action: action to take when deviation triggers
            tc_threshold: true count threshold
            direction: ">=" means take action at TC >= threshold,
                       "<" means take action at TC < threshold
        """
        self.hand_type = hand_type
        self.hand_value = hand_value
        self.dealer_upcard = dealer_upcard
        self.action = action
        self.tc_threshold = tc_threshold
        self.direction = direction

    def matches(self, hand: Hand, dealer_upcard: Card) -> bool:
        """Check if this deviation applies to the given hand situation."""
        upcard_val = dealer_upcard.count_key

        if upcard_val != self.dealer_upcard:
            return False

        if self.hand_type == "pair":
            if hand.is_pair and hand.cards[0].count_key == self.hand_value:
                return True
            return False
        elif self.hand_type == "soft":
            if hand.is_soft and hand.best_value == self.hand_value:
                return True
            return False
        else:  # hard
            # Exclude pairs — they are handled by PAIR_TABLE, never by hard deviations.
            # e.g. 8-8 vs 10 is hard 16 but should SPLIT, not trigger the hard 16 Stand deviation.
            if hand.is_pair:
                return False
            if not hand.is_soft and hand.best_value == self.hand_value:
                return True
            return False

    def should_deviate(self, true_count: float) -> bool:
        """Check if the true count triggers this deviation."""
        if self.direction == ">=":
            return true_count >= self.tc_threshold
        else:
            return true_count < self.tc_threshold

    def __repr__(self) -> str:
        return (f"Deviation({self.hand_type} {self.hand_value} vs {self.dealer_upcard}: "
                f"{self.action.value} at TC {self.direction} {self.tc_threshold})")


# ══════════════════════════════════════════════════════════════
# ILLUSTRIOUS 18 — Top 18 count-based play deviations
# These are the most valuable deviations from basic strategy.
# ══════════════════════════════════════════════════════════════
ILLUSTRIOUS_18 = [
    # Insurance (handled separately, but listed for completeness)
    # Take insurance at TC >= +3

    # 1. 16 vs 10: Stand at TC >= 0 (basic says Hit)
    Deviation("hard", 16, 10, Action.STAND, 0, ">="),

    # 2. 15 vs 10: Stand at TC >= 4 when surrender is NOT available.
    #    FIX (AUDIT finding #4): This was missing from the I18 list.
    #    The FAB_4 entry (15 vs 10 Surrender at TC >= 0) is checked first —
    #    if surrender IS available it fires there and this line is never reached.
    #    When surrender is unavailable (Action.SURRENDER not in available_actions),
    #    FAB_4 is skipped entirely and we fall through to I18 here.
    #    At TC >= 4 the shoe is so 10-rich that Standing is better than Hitting
    #    even without the surrender option — this is a top-5 I18 play by EV.
    Deviation("hard", 15, 10, Action.STAND, 4, ">="),

    # 3. 10,10 vs 5: Split at TC >= +5
    Deviation("pair", 10, 5, Action.SPLIT, 5, ">="),

    # 4. 10,10 vs 6: Split at TC >= +4
    Deviation("pair", 10, 6, Action.SPLIT, 4, ">="),

    # 5. 10 vs 10: Double at TC >= +4
    Deviation("hard", 10, 10, Action.DOUBLE, 4, ">="),

    # 6. 12 vs 3: Stand at TC >= +2
    Deviation("hard", 12, 3, Action.STAND, 2, ">="),

    # 7. 12 vs 2: Stand at TC >= +3
    Deviation("hard", 12, 2, Action.STAND, 3, ">="),

    # 8. 11 vs A: Double at TC >= +1
    Deviation("hard", 11, 11, Action.DOUBLE, 1, ">="),

    # 9. 9 vs 2: Double at TC >= +1
    Deviation("hard", 9, 2, Action.DOUBLE, 1, ">="),

    # 10. 10 vs A: Double at TC >= +4
    Deviation("hard", 10, 11, Action.DOUBLE, 4, ">="),

    # 11. 9 vs 7: Double at TC >= +3
    Deviation("hard", 9, 7, Action.DOUBLE, 3, ">="),

    # 12. 16 vs 9: Stand at TC >= +5
    Deviation("hard", 16, 9, Action.STAND, 5, ">="),

    # 13. 13 vs 2: Hit at TC < -1 (basic says Stand)
    Deviation("hard", 13, 2, Action.HIT, -1, "<"),

    # 14. 12 vs 4: Hit at TC < 0 (basic says Stand)
    Deviation("hard", 12, 4, Action.HIT, 0, "<"),

    # 15. 12 vs 5: Hit at TC < -2
    Deviation("hard", 12, 5, Action.HIT, -2, "<"),

    # 16. 12 vs 6: Hit at TC < -1
    Deviation("hard", 12, 6, Action.HIT, -1, "<"),

    # 17. 13 vs 3: Hit at TC < -2
    Deviation("hard", 13, 3, Action.HIT, -2, "<"),

    # 18. 10 vs 9: Double at TC >= +2 (added from expanded list)
    Deviation("hard", 10, 9, Action.DOUBLE, 2, ">="),
]


# ══════════════════════════════════════════════════════════════
# FAB 4 SURRENDER DEVIATIONS
# Count-based surrender plays beyond basic strategy.
# ══════════════════════════════════════════════════════════════
FAB_4_SURRENDERS = [
    # 14 vs 10: Surrender at TC >= +3
    Deviation("hard", 14, 10, Action.SURRENDER, 3, ">="),

    # 15 vs 10: Surrender at TC >= 0 (basic already says surrender at some counts)
    Deviation("hard", 15, 10, Action.SURRENDER, 0, ">="),

    # 15 vs 9: Surrender at TC >= +2
    Deviation("hard", 15, 9, Action.SURRENDER, 2, ">="),

    # 15 vs A: Surrender at TC >= +1
    Deviation("hard", 15, 11, Action.SURRENDER, 1, ">="),
]



# ── Composition-dependent sentinel objects ─────────────────────────────────────
# Used only as last_deviation_used markers so get_action_with_info() can
# surface composition-dependent plays to the UI with proper descriptions.
# They are NOT added to the main deviations list — they are matched inline
# inside get_action() before the I18 loop runs.
_COMP_DEV_10_6 = Deviation("hard", 16, 10, Action.STAND, 0,  ">=")
_COMP_DEV_9_7  = Deviation("hard", 16, 10, Action.STAND, 1,  ">=")


class DeviationEngine:
    """
    Combines Illustrious 18 + Fab 4 with basic strategy.
    Uses true count to override basic strategy when warranted.
    """

    def __init__(self, basic_strategy: BasicStrategy = None):
        self.basic_strategy = basic_strategy or BasicStrategy()
        self.deviations = ILLUSTRIOUS_18 + FAB_4_SURRENDERS
        self.last_deviation_used: Optional[Deviation] = None

    def get_action(self, hand: Hand, dealer_upcard: Card,
               true_count: float, available_actions: list = None,
               num_splits: int = 0) -> Action:
        """
        Get the optimal action considering count-based deviations.

        Check order:
        1. FAB 4 surrender deviations (surrender first — highest priority)
        2. Illustrious 18 play deviations
        3. Basic strategy fallback
        """
        if available_actions is None:
            available_actions = hand.available_actions(
                self.basic_strategy.config, num_splits)

        self.last_deviation_used = None

        # ── 0. Composition-dependent: Hard 16 vs Dealer 10 (2-card hands only) ──
        # Standard I18 says: Hard 16 vs 10 → Stand at TC ≥ 0.
        # But "Hard 16" covers TWO meaningfully different hands:
        #   • 10+6 — the 10 is already out; fewer 10s remain → Stand is better
        #            even at TC = 0 because one large card is already in your hand.
        #   • 9+7  — neither card removes a 10; shoe composition unchanged relative
        #            to TC → the standard Stand threshold is TC ≥ +1, not 0.
        # This matters: at TC exactly 0, the two hands have opposite correct plays.
        # Only applies to exactly 2 non-pair cards totalling 16 vs dealer 10.
        if (len(hand.cards) == 2
                and not hand.is_pair
                and not hand.is_soft
                and hand.best_value == 16
                and dealer_upcard.count_key == 10):

            card_values = sorted(c.value for c in hand.cards)  # e.g. [6, 10] or [7, 9]

            if card_values == [6, 10]:
                # 10+6: Ten already dealt from shoe → stand at TC ≥ 0 (standard I18)
                if true_count >= 0 and Action.STAND in available_actions:
                    self.last_deviation_used = _COMP_DEV_10_6
                    return Action.STAND
            elif card_values == [7, 9]:
                # 9+7: No ten removed → correct threshold is TC ≥ +1 (one step higher)
                if true_count >= 1 and Action.STAND in available_actions:
                    self.last_deviation_used = _COMP_DEV_9_7
                    return Action.STAND
                elif true_count < 1:
                    # Explicitly HIT — must block the I18 Hard 16 vs 10 Stand at TC≥0
                    # which would otherwise fire incorrectly for this composition
                    return Action.HIT
            # Any other 2-card 16 (e.g. 8+8 is a pair, handled elsewhere;
            # edge cases like A+5 soft 16 filtered by is_soft above)
            # falls through to the normal I18 loop below.

        # ── 1. FAB 4: Count-based surrender overrides ──────────────────────
        if Action.SURRENDER in available_actions:
            for dev in FAB_4_SURRENDERS:
                if dev.matches(hand, dealer_upcard) and dev.should_deviate(true_count):
                    self.last_deviation_used = dev
                    return Action.SURRENDER

        # ── 2. Illustrious 18: Play deviations ────────────────────────────
        for dev in ILLUSTRIOUS_18:
            if dev.matches(hand, dealer_upcard) and dev.should_deviate(true_count):
                if dev.action in available_actions:
                    # FIX: Removed the incorrect `continue` guard that suppressed
                    # I18 STAND deviations (e.g. Hard 16 vs 10 at TC>=0) whenever
                    # surrender was available. The I18 deviation IS the correct play
                    # at the given TC — it overrides surrender, not the other way around.
                    # The old guard caused test_deviation_info_populated_when_fired to fail
                    # because last_deviation_used was never set.
                    self.last_deviation_used = dev
                    return dev.action

        # ── 3. Basic strategy fallback ─────────────────────────────────────
        return self.basic_strategy.get_action(
            hand, dealer_upcard, available_actions, num_splits)

    def get_action_with_info(self, hand: Hand, dealer_upcard: Card,
                             true_count: float,
                             available_actions: list = None) -> dict:
        """Get action with explanation of whether a deviation was used."""
        action = self.get_action(hand, dealer_upcard, true_count, available_actions)
        basic_action = self.basic_strategy.get_action(hand, dealer_upcard, available_actions)

        info = {
            "action": action,
            "is_deviation": self.last_deviation_used is not None,
            "basic_strategy_action": basic_action,
            "deviation": None,
            "true_count": true_count,
        }

        if self.last_deviation_used:
            dev = self.last_deviation_used
            info["deviation"] = {
                "description": str(dev),
                "tc_threshold": dev.tc_threshold,
                "direction": dev.direction,
            }

        return info
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
║                                                                              ║
║  STATELESS (post GAP-01/GAP-07 fix):                                         ║
║    DeviationEngine no longer mutates instance state during get_action().    ║
║    Two threads can call it concurrently without corrupting each other's     ║
║    "is_deviation" reading. Split-hand iterations are also safe.             ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import logging as _log
from typing import Optional
from .game import Action, Hand
from .card import Card
from .strategy import BasicStrategy


class Deviation:
    """A single strategy deviation triggered by true count."""

    def __init__(self, hand_type: str, hand_value: int, dealer_upcard: int,
                 action: Action, tc_threshold: float, direction: str = ">="):
        self.hand_type = hand_type
        self.hand_value = hand_value
        self.dealer_upcard = dealer_upcard
        self.action = action
        self.tc_threshold = tc_threshold
        self.direction = direction

    def matches(self, hand: Hand, dealer_upcard: Card) -> bool:
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
        else:
            if hand.is_pair:
                return False
            if not hand.is_soft and hand.best_value == self.hand_value:
                return True
            return False

    def should_deviate(self, true_count: float) -> bool:
        if self.direction == ">=":
            return true_count >= self.tc_threshold
        else:
            return true_count < self.tc_threshold

    def __repr__(self) -> str:
        return (f"Deviation({self.hand_type} {self.hand_value} vs {self.dealer_upcard}: "
                f"{self.action.value} at TC {self.direction} {self.tc_threshold})")


ILLUSTRIOUS_18 = [
    Deviation("hard", 16, 10, Action.STAND, 0, ">="),
    Deviation("pair", 10, 5, Action.SPLIT, 5, ">="),
    Deviation("pair", 10, 6, Action.SPLIT, 4, ">="),
    Deviation("hard", 10, 10, Action.DOUBLE, 4, ">="),
    Deviation("hard", 12, 3, Action.STAND, 2, ">="),
    Deviation("hard", 12, 2, Action.STAND, 3, ">="),
    Deviation("hard", 11, 11, Action.DOUBLE, 1, ">="),
    Deviation("hard", 9, 2, Action.DOUBLE, 1, ">="),
    Deviation("hard", 10, 11, Action.DOUBLE, 4, ">="),
    Deviation("hard", 9, 7, Action.DOUBLE, 3, ">="),
    Deviation("hard", 16, 9, Action.STAND, 5, ">="),
    Deviation("hard", 13, 2, Action.HIT, -1, "<"),
    Deviation("hard", 12, 4, Action.HIT, 0, "<"),
    Deviation("hard", 12, 5, Action.HIT, -2, "<"),
    Deviation("hard", 12, 6, Action.HIT, -1, "<"),
    Deviation("hard", 13, 3, Action.HIT, -2, "<"),
    Deviation("hard", 10, 9, Action.DOUBLE, 2, ">="),
]


FAB_4_SURRENDERS = [
    Deviation("hard", 14, 10, Action.SURRENDER, 3, ">="),
    Deviation("hard", 15, 10, Action.SURRENDER, 0, ">="),
    Deviation("hard", 15, 9, Action.SURRENDER, 2, ">="),
    Deviation("hard", 15, 11, Action.SURRENDER, 1, ">="),
]


class DeviationEngine:
    """
    Combines Illustrious 18 + Fab 4 with basic strategy.
    Stateless: no instance fields mutate during get_action().
    """

    def __init__(self, basic_strategy: BasicStrategy = None):
        self.basic_strategy = basic_strategy or BasicStrategy()
        self.deviations = ILLUSTRIOUS_18 + FAB_4_SURRENDERS
        # `last_deviation_used` removed (GAP-01, GAP-07).
        # Use get_action_and_deviation() to receive both action and matched dev.

    def get_action_and_deviation(self, hand: Hand, dealer_upcard: Card,
               true_count: float, available_actions: list = None,
               num_splits: int = 0):
        """Stateless: returns (action, matched_deviation_or_None)."""
        return self._compute(hand, dealer_upcard, true_count,
                             available_actions, num_splits)

    def get_action(self, hand: Hand, dealer_upcard: Card,
               true_count: float, available_actions: list = None,
               num_splits: int = 0) -> Action:
        action, _dev = self._compute(hand, dealer_upcard, true_count,
                                     available_actions, num_splits)
        return action

    def _compute(self, hand: Hand, dealer_upcard: Card,
                 true_count: float, available_actions: list = None,
                 num_splits: int = 0):
        """Internal stateless: returns (action, matched_deviation_or_None)."""
        if available_actions is None:
            available_actions = hand.available_actions(
                self.basic_strategy.config, num_splits)

        # ── 0. Composition-dependent: Hard 16 vs 10 ───────────────────────
        if (len(hand.cards) == 2
                and not hand.is_pair
                and not hand.is_soft
                and hand.best_value == 16
                and dealer_upcard.count_key == 10):
            c1, c2 = hand.cards[0].count_key, hand.cards[1].count_key
            is_ten_six = (c1 == 10 and c2 == 6) or (c1 == 6 and c2 == 10)
            threshold = 0 if is_ten_six else 1
            _log.getLogger(__name__).debug(
                "[COMP-DEP] Hard 16 vs 10: %s  TC=%.2f  threshold=%d",
                "10+6" if is_ten_six else "9+7", true_count, threshold
            )
            if true_count >= threshold and Action.STAND in available_actions:
                matched_dev = next(
                    d for d in ILLUSTRIOUS_18
                    if d.hand_value == 16 and d.dealer_upcard == 10
                )
                return Action.STAND, matched_dev
            else:
                basic = self.basic_strategy.get_action(
                    hand, dealer_upcard, available_actions, num_splits)
                return basic, None

        # ── 1. FAB 4: Count-based surrender overrides ──────────────────────
        if Action.SURRENDER in available_actions:
            for dev in FAB_4_SURRENDERS:
                if dev.matches(hand, dealer_upcard) and dev.should_deviate(true_count):
                    return Action.SURRENDER, dev

        # ── 2. Illustrious 18: Play deviations ────────────────────────────
        for dev in ILLUSTRIOUS_18:
            if dev.matches(hand, dealer_upcard) and dev.should_deviate(true_count):
                if dev.action in available_actions:
                    return dev.action, dev

        # ── 3. Basic strategy fallback ─────────────────────────────────────
        basic = self.basic_strategy.get_action(
            hand, dealer_upcard, available_actions, num_splits)
        return basic, None

    def get_action_with_info(self, hand: Hand, dealer_upcard: Card,
                             true_count: float,
                             available_actions: list = None,
                             num_splits: int = 0) -> dict:
        """Get action with explanation of whether a deviation was used.
        Stateless — safe under threading and across split-hand iterations.
        """
        action, dev = self._compute(hand, dealer_upcard, true_count,
                                    available_actions, num_splits)
        basic_action = self.basic_strategy.get_action(
            hand, dealer_upcard, available_actions)

        info = {
            "action": action,
            "is_deviation": dev is not None,
            "basic_strategy_action": basic_action,
            "deviation": None,
            "true_count": true_count,
        }

        if dev is not None:
            info["deviation"] = {
                "description": str(dev),
                "tc_threshold": dev.tc_threshold,
                "direction": dev.direction,
            }

        return info

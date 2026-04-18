"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/strategy.py — Perfect Basic Strategy Engine                      ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  Implements mathematically perfect basic strategy via lookup tables.        ║
║  For EVERY combination of player hand vs. dealer upcard, it returns the    ║
║  statistically optimal action.                                               ║
║                                                                              ║
║  WHAT IS BASIC STRATEGY?                                                     ║
║  ─────────────────────────                                                   ║
║  A pre-computed table of the BEST play for every possible hand situation.   ║
║  Following it perfectly reduces the house edge to ~0.5%.                   ║
║  It is the FOUNDATION — counting on top of it makes it profitable.          ║
║                                                                              ║
║  THE THREE TABLES:                                                           ║
║  HARD_TABLE  → player has no usable Ace (e.g., 10+6=16)                    ║
║  SOFT_TABLE  → player has Ace counting as 11 (e.g., A+6=soft 17)           ║
║  PAIR_TABLE  → player has two cards of the same rank (split decision)       ║
║                                                                              ║
║  ACTION CODES:                                                               ║
║    H   = Hit                                                                 ║
║    S   = Stand                                                               ║
║    D   = Double down if allowed, otherwise Hit                               ║
║    Ds  = Double down if allowed, otherwise Stand                             ║
║    SP  = Split                                                               ║
║    SPD = Split only if Double After Split is allowed, else treat as hard     ║
║    SUR = Surrender                                                           ║
║                                                                              ║
║  HOW TO USE:                                                                 ║
║    strategy = BasicStrategy()                                                ║
║    action = strategy.get_action(hand, dealer_upcard)                        ║
║    print(action)  # Action.HIT, Action.STAND, etc.                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from typing import Optional
from .game import Action, Hand
from .card import Card
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import GameConfig

# Action codes
H = Action.HIT
S = Action.STAND
D = "D"     # Double if allowed, otherwise hit
Ds = "Ds"   # Double if allowed, otherwise stand
SP = Action.SPLIT
SPD = "Y/N" # Split if DAS allowed, otherwise don't split
SUR = Action.SURRENDER

# Dealer upcard index: 2,3,4,5,6,7,8,9,10,A (columns)
DEALER_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]


def _dc(upcard_value: int) -> int:
    """Map dealer upcard value to column index."""
    if upcard_value == 11 or upcard_value == 1:
        return 9  # Ace
    return upcard_value - 2


# ══════════════════════════════════════════════════════════════
# HARD TOTALS (player total vs dealer upcard)
# Rows: 5-17+ (values ≤8 always hit, 17+ always stand)
# Cols: dealer 2,3,4,5,6,7,8,9,10,A
# ══════════════════════════════════════════════════════════════
HARD_TABLE = {
    #       2   3   4   5   6   7   8   9  10   A
    5:  [  H,  H,  H,  H,  H,  H,  H,  H,  H,  H],
    6:  [  H,  H,  H,  H,  H,  H,  H,  H,  H,  H],
    7:  [  H,  H,  H,  H,  H,  H,  H,  H,  H,  H],
    8:  [  H,  H,  H,  H,  H,  H,  H,  H,  H,  H],
    9:  [  H,  D,  D,  D,  D,  H,  H,  H,  H,  H],
    10: [  D,  D,  D,  D,  D,  D,  D,  D,  H,  H],
    11: [  D,  D,  D,  D,  D,  D,  D,  D,  D,  H],  # vs Ace = Hit (8-deck S17; Double is H17 play)
    12: [  H,  H,  S,  S,  S,  H,  H,  H,  H,  H],
    13: [  S,  S,  S,  S,  S,  H,  H,  H,  H,  H],
    14: [  S,  S,  S,  S,  S,  H,  H,  H,  H,  H],
    15: [  S,  S,  S,  S,  S,  H,  H,  H,SUR,SUR],  # vs 10,A: Surrender
    16: [  S,  S,  S,  S,  S,  H,  H,  H,SUR,SUR],  # vs 10,A: Surrender
    17: [  S,  S,  S,  S,  S,  S,  S,  S,  S,  S],
    18: [  S,  S,  S,  S,  S,  S,  S,  S,  S,  S],
    19: [  S,  S,  S,  S,  S,  S,  S,  S,  S,  S],
    20: [  S,  S,  S,  S,  S,  S,  S,  S,  S,  S],
    21: [  S,  S,  S,  S,  S,  S,  S,  S,  S,  S],
}


# ══════════════════════════════════════════════════════════════
# SOFT TOTALS (Ace + X)
# A,2 through A,9
# ══════════════════════════════════════════════════════════════
SOFT_TABLE = {
    #             2    3    4    5    6    7    8    9   10    A
    13:  [       H,   H,   H,   D,   D,   H,   H,   H,   H,   H],  # A,2
    14:  [       H,   H,   H,   D,   D,   H,   H,   H,   H,   H],  # A,3
    15:  [       H,   H,   D,   D,   D,   H,   H,   H,   H,   H],  # A,4
    16:  [       H,   H,   D,   D,   D,   H,   H,   H,   H,   H],  # A,5
    17:  [       H,   D,   D,   D,   D,   H,   H,   H,   H,   H],  # A,6
    18:  [       S,  Ds,  Ds,  Ds,  Ds,   S,   S,   H,   H,   H],  # A,7 — 8-deck S17 strict: S vs 2, Ds vs 3-6
    19:  [       S,   S,   S,   S,   S,   S,   S,   S,   S,   S],  # A,8 — always Stand (8-deck S17)
    20:  [       S,   S,   S,   S,   S,   S,   S,   S,   S,   S],  # A,9
}


# ══════════════════════════════════════════════════════════════
# PAIR SPLITTING
# Keys are the card value (2-11 where 11=Ace)
# Values: SP=split, SPD=split only with DAS, H/S=don't split
# ══════════════════════════════════════════════════════════════
PAIR_TABLE = {
    #           2    3    4    5    6    7    8    9   10    A
    2:   [    SPD, SPD,  SP,  SP,  SP,  SP,   H,   H,   H,   H],
    3:   [    SPD, SPD,  SP,  SP,  SP,  SP,   H,   H,   H,   H],
    4:   [      H,   H,   H, SPD, SPD,   H,   H,   H,   H,   H],
    5:   [      D,   D,   D,   D,   D,   D,   D,   D,   H,   H],
    6:   [    SPD,  SP,  SP,  SP,  SP,   H,   H,   H,   H,   H],
    7:   [     SP,  SP,  SP,  SP,  SP,  SP,   H,   H,   H,   H],
    8:   [     SP,  SP,  SP,  SP,  SP,  SP,  SP,  SP,  SP,  SP],
    9:   [     SP,  SP,  SP,  SP,  SP,   S,  SP,  SP,   S,   S],
    10:  [      S,   S,   S,   S,   S,   S,   S,   S,   S,   S],
    11:  [     SP,  SP,  SP,  SP,  SP,  SP,  SP,  SP,  SP,  SP],  # Aces
}


# ══════════════════════════════════════════════════════════════
# LATE SURRENDER
# ══════════════════════════════════════════════════════════════
SURRENDER_TABLE = {
    # (player_total, dealer_upcard_value) -> True means surrender
    # 8-deck S17 late surrender chart
    (16, 9): True,
    (16, 10): True,
    (16, 11): True,   # 16 vs Ace
    (15, 10): True,
    (15, 11): True,   # 15 vs Ace — surrender in 8-deck S17
}


class BasicStrategy:
    """
    Perfect basic strategy engine.
    Returns the optimal action for any hand vs dealer upcard.
    """

    def __init__(self, config: GameConfig = None):
        self.config = config or GameConfig()

    def get_action(self, hand: Hand, dealer_upcard: Card,
                   available_actions: list = None,
                   num_splits: int = 0) -> Action:
        """
        Get the optimal basic strategy action.

        Args:
            hand: Player's current hand
            dealer_upcard: Dealer's face-up card
            available_actions: List of currently available actions
            num_splits: Number of splits already done this round

        Returns:
            The optimal Action
        """
        if available_actions is None:
            available_actions = hand.available_actions(self.config, num_splits)

        upcard_val = dealer_upcard.count_key  # 2-11
        col = _dc(upcard_val)
        hand_val = hand.best_value

        # Check pair splitting FIRST — before surrender.
        # Pairs must be evaluated against PAIR_TABLE before anything else.
        # Example: 8-8 vs 10 has best_value=16 which would trigger
        # surrender, but PAIR_TABLE says always split 8s — correct play.
        if hand.is_pair and Action.SPLIT in available_actions:
            pair_val = hand.cards[0].count_key
            action = self._pair_action(pair_val, col, available_actions)
            if action is not None:
                return action

        # Check surrender (only for non-pair hands, or pairs where split is unavailable)
        if Action.SURRENDER in available_actions:
            if self._should_surrender(hand_val, upcard_val):
                return Action.SURRENDER

        # Check soft totals
        if hand.is_soft and hand_val in SOFT_TABLE:
            return self._resolve_action(SOFT_TABLE[hand_val][col], available_actions)

        # Hard totals
        if hand_val <= 4:
            return Action.HIT
        if hand_val >= 17:
            return Action.STAND
        if hand_val in HARD_TABLE:
            return self._resolve_action(HARD_TABLE[hand_val][col], available_actions)

        return Action.STAND

    def _should_surrender(self, hand_val: int, upcard_val: int) -> bool:
        """Check if late surrender is optimal."""
        if not self.config.ALLOW_LATE_SURRENDER:
            return False
        return SURRENDER_TABLE.get((hand_val, upcard_val), False)

    def _pair_action(self, pair_val: int, col: int,
                     available_actions: list) -> Optional[Action]:
        """Get pair splitting action."""
        if pair_val not in PAIR_TABLE:
            return None

        action = PAIR_TABLE[pair_val][col]

        if action == SP:
            return Action.SPLIT
        elif action == SPD:
            if self.config.ALLOW_DOUBLE_AFTER_SPLIT:
                return Action.SPLIT
            else:
                return None  # Fall through to hard/soft total
        elif action == "D":
            # Pair of 5s: treat as hard 10, double if possible
            if Action.DOUBLE in available_actions:
                return Action.DOUBLE
            return Action.HIT
        elif action in (H, S):
            return action

        return None

    def _resolve_action(self, table_action, available_actions: list) -> Action:
        """Resolve chart action codes (D, Ds, SUR) to actual actions,
        respecting which actions are currently available."""
        if table_action == "D":
            if Action.DOUBLE in available_actions:
                return Action.DOUBLE
            return Action.HIT
        elif table_action == "Ds":
            if Action.DOUBLE in available_actions:
                return Action.DOUBLE
            return Action.STAND
        elif table_action == Action.SURRENDER:
            # Surrender is only available on initial 2-card non-split hands.
            # If not available, fall back: hard 15/16 vs strong dealer → Hit
            if Action.SURRENDER in available_actions:
                return Action.SURRENDER
            return Action.HIT
        elif isinstance(table_action, Action):
            return table_action
        return Action.STAND

    def get_action_name(self, hand: Hand, dealer_upcard: Card,
                        available_actions: list = None) -> str:
        """Get human-readable action name."""
        action = self.get_action(hand, dealer_upcard, available_actions)
        names = {
            Action.HIT: "HIT",
            Action.STAND: "STAND",
            Action.DOUBLE: "DOUBLE DOWN",
            Action.SPLIT: "SPLIT",
            Action.SURRENDER: "SURRENDER",
            Action.INSURANCE: "INSURANCE",
        }
        return names.get(action, str(action))
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/game.py — Hand, Round, and Table                                 ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  • Action     = the five things a player can do (hit/stand/double/etc.)    ║
║  • HandResult = the six possible outcomes of a hand                         ║
║  • Hand       = a player or dealer hand (cards + bet + state flags)        ║
║  • Round      = one complete round: deal → play → resolve                  ║
║  • BlackjackTable = the table: manages shoe, rounds, and running totals     ║
║                                                                              ║
║  KEY CONCEPTS FOR BEGINNERS:                                                 ║
║  ────────────────────────────                                                ║
║  A Hand stores cards and computes blackjack values automatically.           ║
║  It handles the Ace being worth 1 or 11 via the values property.           ║
║                                                                              ║
║  Soft hand = has a usable Ace worth 11 (A+6 = "soft 17")                   ║
║  Hard hand = Ace worth 1, or no Ace (10+7 = "hard 17")                     ║
║                                                                              ║
║  HOW TO USE:                                                                 ║
║    from blackjack.game import Hand, Round, Action                           ║
║    hand = Hand(bet=25)                                                       ║
║    hand.add_card(card1)                                                      ║
║    hand.add_card(card2)                                                      ║
║    print(hand.best_value)     # highest non-bust total                      ║
║    print(hand.is_soft)        # True if Ace counts as 11                    ║
║    print(hand.is_blackjack)   # True for natural 21                         ║
║                                                                              ║
║  BUGS FIXED IN THIS VERSION:                                                 ║
║  ────────────────────────────                                                ║
║  BUG 1 — Hand.is_soft returned False for multi-ace soft hands:             ║
║    OLD: used `if total > 21: return False` where total counted all aces    ║
║         as 11 first. This made A+A+6 (soft 18) return is_soft=False,       ║
║         causing HARD_TABLE[18] (Stand) instead of SOFT_TABLE[18] (Ds).    ║
║    FIX: removed the premature early return. Now uses only the correct       ║
║         hard_total (all aces as 1) + 10 <= 21 check.                       ║
║                                                                              ║
║  BUG 2 — Round.player_split() never set split_from_ace:                    ║
║    OLD: split_from_ace was left False on both resulting hands even when     ║
║         splitting Aces, so the one-card-per-ace rule could never fire       ║
║         through the Round API.                                               ║
║    FIX: detect is_ace_split before the card pop, set split_from_ace on     ║
║         both hands before inserting into player_hands.                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
from typing import List, Optional, Tuple
from .card import Card, Shoe, ShuffleType
from enum import Enum
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import GameConfig


class Action(Enum):
    HIT = "hit"
    STAND = "stand"
    DOUBLE = "double"
    SPLIT = "split"
    SURRENDER = "surrender"
    INSURANCE = "insurance"


class HandResult(Enum):
    WIN = "win"
    LOSS = "loss"
    PUSH = "push"
    BLACKJACK = "blackjack"
    SURRENDER = "surrender"
    PENDING = "pending"


class Hand:
    """A blackjack hand (player or dealer)."""

    def __init__(self, bet: float = 0):
        self.cards: List[Card] = []
        self.bet = bet
        self.is_split = False
        self.split_from_ace = False  # True ONLY when this hand was created by splitting Aces
        self.is_doubled = False
        self.is_surrendered = False
        self.is_insured = False
        self.insurance_bet = 0.0
        self.result = HandResult.PENDING

    def add_card(self, card: Card):
        self.cards.append(card)

    @property
    def values(self) -> List[int]:
        """All possible hand values (handling soft aces)."""
        total = 0
        aces = 0
        for card in self.cards:
            if card.is_ace:
                aces += 1
                total += 11
            else:
                total += card.value

        results = [total]
        for _ in range(aces):
            results.append(results[-1] - 10)

        return sorted(set(r for r in results if r <= 21) or [min(results)])

    @property
    def best_value(self) -> int:
        """Best (highest non-bust) value."""
        vals = self.values
        non_bust = [v for v in vals if v <= 21]
        return max(non_bust) if non_bust else min(vals)

    @property
    def is_soft(self) -> bool:
        """Whether the hand contains a usable ace (counts as 11 without busting).

        FIX: The previous implementation had a premature early-return:
            total = sum(11 if c.is_ace else c.value ...)
            if total > 21: return False   ← WRONG for hands like A+A+6

        This incorrectly marked A+A+6 (soft 18), A+A+7 (soft 19), etc. as
        hard hands, causing the strategy engine to use HARD_TABLE instead of
        SOFT_TABLE for those hands.

        Correct logic: a hand is soft if it has at least one Ace AND counting
        exactly one of those Aces as 11 (all others as 1) keeps the total ≤ 21.
        That is: hard_total (all aces=1) + 10 <= 21.

        Note: Blackjack (A+10-value on initial 2 cards) is NOT considered soft
        for strategy purposes — it resolves immediately as BJ.
        """
        if self.is_blackjack:
            return False
        aces = sum(1 for c in self.cards if c.is_ace)
        if aces == 0:
            return False
        # Count all aces as 1, then check if upgrading exactly one to 11 stays ≤ 21
        hard_total = sum(1 if c.is_ace else c.value for c in self.cards)
        return (hard_total + 10) <= 21

    @property
    def is_pair(self) -> bool:
        return len(self.cards) == 2 and self.cards[0].rank == self.cards[1].rank

    @property
    def is_ten_pair(self) -> bool:
        """Pair of ten-value cards (may differ in rank, e.g., J-Q)."""
        return len(self.cards) == 2 and self.cards[0].is_ten and self.cards[1].is_ten

    @property
    def is_blackjack(self) -> bool:
        return (len(self.cards) == 2 and self.best_value == 21
                and not self.is_split)

    @property
    def is_bust(self) -> bool:
        return self.best_value > 21

    @property
    def can_double(self) -> bool:
        return len(self.cards) == 2 and not self.is_doubled

    @property
    def can_split(self) -> bool:
        """Rule: Split only same-rank pairs (A-A, 8-8, K-K etc.).
        Standard casino rules require matching rank to split."""
        return self.is_pair

    @property
    def is_split_ace_hand(self) -> bool:
        """True when this hand was formed by splitting Aces.
        Rule: single card dealt to each split ace — no further hits allowed.
        Uses the explicit split_from_ace flag set at split time, not card inference,
        so it stays correct even if an Ace happens to be the first card on a non-ace split."""
        return self.split_from_ace

    def available_actions(self, config: GameConfig = None,
                          num_splits_done: int = 0) -> List[Action]:
        """Get available actions for this hand given current state."""
        if config is None:
            config = GameConfig()

        # Rule: Single card dealt to each Split Ace — no hit, no double allowed
        # Once the hand has 2 cards (Ace + dealt card), player must stand.
        if self.is_split_ace_hand and len(self.cards) >= 2:
            return [Action.STAND]

        actions = [Action.HIT, Action.STAND]

        # Rule: No Double after Split
        if self.can_double:
            if not self.is_split or config.ALLOW_DOUBLE_AFTER_SPLIT:
                actions.append(Action.DOUBLE)

        # Rule: Only one Split per hand (MAX_SPLITS=2 means 1 split creates 2 hands)
        if self.can_split and num_splits_done < config.MAX_SPLITS - 1:
            if not (self.cards[0].is_ace and self.is_split
                    and not config.ALLOW_RESPLIT_ACES):
                actions.append(Action.SPLIT)

        # Rule: Surrender only on initial 2-card non-split hand
        if (len(self.cards) == 2 and not self.is_split
                and config.ALLOW_LATE_SURRENDER):
            actions.append(Action.SURRENDER)

        return actions

    def __repr__(self) -> str:
        cards_str = " ".join(str(c) for c in self.cards)
        return f"Hand({cards_str} = {self.best_value})"


class Round:
    """A single round of blackjack."""

    def __init__(self, shoe: Shoe, base_bet: float = 10):
        self.shoe = shoe
        self.player_hands: List[Hand] = [Hand(bet=base_bet)]
        self.dealer_hand = Hand()
        self.is_complete = False
        self.total_profit = 0.0
        self.cards_dealt_this_round: List[Card] = []

    def deal_initial(self) -> Tuple[List[Card], Card]:
        """Deal initial cards in correct casino order: P → D → P → D.

        FIX M6: The previous implementation dealt PP then DD (two loops).
        Real blackjack alternates: one card to each position per round.
        Correct order matters for shuffle tracking (card position in shoe)
        and any ML model that models positional card dependency.
        """
        dealt = []
        for _ in range(2):
            # Player card
            p_card = self.shoe.deal()
            self.player_hands[0].add_card(p_card)
            dealt.append(p_card)
            self.cards_dealt_this_round.append(p_card)
            # Dealer card (second dealer card is the hole card)
            d_card = self.shoe.deal()
            self.dealer_hand.add_card(d_card)
            dealt.append(d_card)
            self.cards_dealt_this_round.append(d_card)

        dealer_upcard = self.dealer_hand.cards[0]
        return dealt, dealer_upcard

    @property
    def dealer_upcard(self) -> Optional[Card]:
        if self.dealer_hand.cards:
            return self.dealer_hand.cards[0]
        return None

    @property
    def dealer_hole_card(self) -> Optional[Card]:
        if len(self.dealer_hand.cards) >= 2:
            return self.dealer_hand.cards[1]
        return None

    def player_hit(self, hand_idx: int = 0) -> Card:
        card = self.shoe.deal()
        self.player_hands[hand_idx].add_card(card)
        self.cards_dealt_this_round.append(card)
        return card

    def player_double(self, hand_idx: int = 0) -> Card:
        hand = self.player_hands[hand_idx]
        hand.bet *= 2
        hand.is_doubled = True
        card = self.shoe.deal()
        hand.add_card(card)
        self.cards_dealt_this_round.append(card)
        return card

    def player_split(self, hand_idx: int = 0, new_bet: float = None) -> Tuple[Card, Card]:
        hand = self.player_hands[hand_idx]
        if new_bet is None:
            new_bet = hand.bet

        # FIX: detect ace split BEFORE popping the second card, so both resulting
        # hands get split_from_ace=True and the one-card-per-hand rule fires correctly.
        # Previously split_from_ace was never set here, meaning the Round API silently
        # allowed unlimited hitting on split aces.
        is_ace_split = len(hand.cards) >= 1 and hand.cards[0].is_ace

        # Create new hand with second card
        new_hand = Hand(bet=new_bet)
        new_hand.is_split = True
        new_hand.split_from_ace = is_ace_split   # FIX: was missing
        new_hand.add_card(hand.cards.pop())

        hand.is_split = True
        hand.split_from_ace = is_ace_split        # FIX: was missing

        # Deal one card to each
        card1 = self.shoe.deal()
        hand.add_card(card1)
        self.cards_dealt_this_round.append(card1)

        card2 = self.shoe.deal()
        new_hand.add_card(card2)
        self.cards_dealt_this_round.append(card2)

        self.player_hands.insert(hand_idx + 1, new_hand)
        return card1, card2

    def player_surrender(self, hand_idx: int = 0):
        hand = self.player_hands[hand_idx]
        hand.is_surrendered = True
        hand.result = HandResult.SURRENDER

    def player_insurance(self, hand_idx: int = 0):
        hand = self.player_hands[hand_idx]
        hand.is_insured = True
        hand.insurance_bet = hand.bet / 2

    def play_dealer(self, h17: bool = False) -> List[Card]:
        """Play out the dealer's hand according to rules.
        Rule: Dealer hits on 16 or less, stands on soft 17 or more (S17).
        h17=False (default) = Dealer STANDS on all 17s including soft 17.
        h17=True  = Dealer HITS soft 17 only (not used for this casino).
        """
        dealt = []
        while True:
            val = self.dealer_hand.best_value
            is_soft = self.dealer_hand.is_soft
            # Must stand on 17+ (hard or soft) when h17=False (S17 rules)
            if val > 17:
                break
            if val == 17:
                if h17 and is_soft:
                    pass  # H17 rule: hit soft 17 only
                else:
                    break  # S17 rule: stand on all 17s
            # val <= 16: always hit
            card = self.shoe.deal()
            self.dealer_hand.add_card(card)
            dealt.append(card)
            self.cards_dealt_this_round.append(card)
        return dealt

    def resolve(self, config: GameConfig = None) -> float:
        """Resolve all hands and calculate profit/loss."""
        if config is None:
            config = GameConfig()

        dealer_val = self.dealer_hand.best_value
        dealer_bj = self.dealer_hand.is_blackjack
        total_profit = 0.0

        for hand in self.player_hands:
            if hand.result == HandResult.SURRENDER:
                total_profit -= hand.bet / 2
                continue

            # Insurance resolution
            if hand.is_insured:
                if dealer_bj:
                    total_profit += hand.insurance_bet * config.INSURANCE_PAYS
                else:
                    total_profit -= hand.insurance_bet

            # Main bet resolution
            if hand.is_blackjack:
                if dealer_bj:
                    hand.result = HandResult.PUSH
                else:
                    hand.result = HandResult.BLACKJACK
                    total_profit += hand.bet * config.BLACKJACK_PAYS
            elif hand.is_bust:
                hand.result = HandResult.LOSS
                total_profit -= hand.bet
            elif dealer_bj:
                hand.result = HandResult.LOSS
                total_profit -= hand.bet
            elif self.dealer_hand.is_bust:
                hand.result = HandResult.WIN
                total_profit += hand.bet
            elif hand.best_value > dealer_val:
                hand.result = HandResult.WIN
                total_profit += hand.bet
            elif hand.best_value < dealer_val:
                hand.result = HandResult.LOSS
                total_profit -= hand.bet
            else:
                hand.result = HandResult.PUSH

        self.total_profit = total_profit
        self.is_complete = True
        return total_profit


class BlackjackTable:
    """
    Full blackjack table managing shoe, rounds, and game flow.
    """

    def __init__(self, config: GameConfig = None):
        self.config = config or GameConfig()
        self.shoe = Shoe(
            num_decks=self.config.NUM_DECKS,
            penetration=self.config.PENETRATION,
            burn_cards=self.config.BURN_CARDS,
        )
        self.round_history: List[Round] = []
        self.current_round: Optional[Round] = None
        self.total_hands_played = 0
        self.total_profit = 0.0

    def start_round(self, bet: float = None) -> Round:
        """Start a new round."""
        if self.shoe.needs_shuffle:
            self.shoe.reshuffle()

        if bet is None:
            from config import BettingConfig
            bet = BettingConfig.TABLE_MIN

        self.current_round = Round(self.shoe, base_bet=bet)
        return self.current_round

    def finish_round(self) -> float:
        """Finish the current round and return profit."""
        if self.current_round is None:
            return 0.0

        profit = self.current_round.total_profit
        self.total_profit += profit
        self.total_hands_played += 1
        self.round_history.append(self.current_round)
        self.current_round = None
        return profit
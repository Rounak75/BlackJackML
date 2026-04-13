"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/card.py — Cards, Decks, and the Shoe                             ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  • Defines a playing Card (rank + suit)                                     ║
║  • Defines a 52-card Deck factory                                            ║
║  • Defines the Shoe: multi-deck container that the game deals from          ║
║                                                                              ║
║  BEGINNER CONCEPTS:                                                          ║
║  ──────────────────                                                          ║
║  Enum  = a set of named constants (Suit.HEARTS, Rank.ACE etc.)             ║
║  @property = a method you access like an attribute (card.value not          ║
║              card.value()) — Python auto-calls it                           ║
║  __slots__ = memory optimisation: tells Python the exact attributes         ║
║              this class will have, saving ~40 bytes per Card instance       ║
║                                                                              ║
║  HOW TO USE:                                                                 ║
║    from blackjack.card import Card, Rank, Suit, Shoe                        ║
║    shoe = Shoe(num_decks=6)       # create a 6-deck shoe                    ║
║    card = shoe.deal()             # deal one card                           ║
║    print(card)                    # "A♠", "10♥", "K♦" etc.                 ║
║    print(card.value)              # blackjack value (Ace=11, K=10, etc.)    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import random
from enum import Enum
from typing import List, Optional


class Suit(Enum):
    HEARTS = "♥"
    DIAMONDS = "♦"
    CLUBS = "♣"
    SPADES = "♠"


class Rank(Enum):
    TWO = 2
    THREE = 3
    FOUR = 4
    FIVE = 5
    SIX = 6
    SEVEN = 7
    EIGHT = 8
    NINE = 9
    TEN = 10
    JACK = 11
    QUEEN = 12
    KING = 13
    ACE = 14

    @property
    def bj_value(self) -> int:
        """Blackjack numeric value (face cards = 10, ace = 11)."""
        if self.value >= 10 and self.value <= 13:
            return 10
        elif self.value == 14:
            return 11
        return self.value

    @property
    def count_value(self) -> int:
        """Value used for counting system lookups (10 for faces, 11 for ace)."""
        if self.value >= 10 and self.value <= 13:
            return 10
        elif self.value == 14:
            return 11
        return self.value

    @property
    def display(self) -> str:
        names = {11: "J", 12: "Q", 13: "K", 14: "A"}
        return names.get(self.value, str(self.value))


class Card:
    """A single playing card."""
    __slots__ = ("rank", "suit")

    def __init__(self, rank: Rank, suit: Suit):
        self.rank = rank
        self.suit = suit

    @property
    def value(self) -> int:
        return self.rank.bj_value

    @property
    def count_key(self) -> int:
        return self.rank.count_value

    @property
    def is_ace(self) -> bool:
        return self.rank == Rank.ACE

    @property
    def is_ten(self) -> bool:
        return self.rank.bj_value == 10

    def __repr__(self) -> str:
        return f"{self.rank.display}{self.suit.value}"

    def __eq__(self, other) -> bool:
        if not isinstance(other, Card):
            return False
        return self.rank == other.rank and self.suit == other.suit

    def __hash__(self) -> int:
        return hash((self.rank, self.suit))


class Deck:
    """A standard 52-card deck."""

    @staticmethod
    def create() -> List[Card]:
        return [Card(rank, suit) for suit in Suit for rank in Rank]


class ShuffleType(Enum):
    """Types of shuffle procedures."""
    RIFFLE = "riffle"
    STRIP = "strip"
    BOX = "box"
    WASH = "wash"
    MACHINE = "machine"


class Shoe:
    """
    Multi-deck shoe with penetration tracking and shuffle simulation.
    Supports various shuffle types for the shuffle-tracking ML model.
    """

    def __init__(self, num_decks: int = 6, penetration: float = 0.75,
                 burn_cards: int = 1):
        self.num_decks = num_decks
        self.penetration = penetration
        self.burn_cards = burn_cards
        self.total_cards = num_decks * 52
        self.cards: List[Card] = []
        self.dealt: List[Card] = []
        self.burned: List[Card] = []
        self._cut_position = 0
        self.shuffle_history: List[ShuffleType] = []
        self.pre_shuffle_order: List[Card] = []
        self.reshuffle()

    def reshuffle(self, shuffle_type: ShuffleType = ShuffleType.MACHINE):
        """Shuffle the shoe using a specified shuffle type."""
        self.pre_shuffle_order = list(self.cards) + list(self.dealt) + list(self.burned)
        self.cards = []
        for _ in range(self.num_decks):
            self.cards.extend(Deck.create())

        if shuffle_type == ShuffleType.RIFFLE:
            self._riffle_shuffle()
        elif shuffle_type == ShuffleType.STRIP:
            self._strip_shuffle()
        elif shuffle_type == ShuffleType.BOX:
            self._box_shuffle()
        elif shuffle_type == ShuffleType.WASH:
            self._wash_shuffle()
        else:
            random.shuffle(self.cards)

        self.shuffle_history.append(shuffle_type)
        self._cut_position = int(self.total_cards * self.penetration)
        self.dealt = []

        # M2 perf fix: reverse so pop() deals from the "top" in O(1)
        self.cards.reverse()

        # Burn cards
        self.burned = []
        for _ in range(self.burn_cards):
            if self.cards:
                self.burned.append(self.cards.pop())

    def _riffle_shuffle(self, imperfection: float = 0.1):
        """Simulate imperfect riffle shuffle — cards maintain some clumping."""
        mid = len(self.cards) // 2
        left = self.cards[:mid]
        right = self.cards[mid:]
        result = []
        li, ri = 0, 0
        while li < len(left) and ri < len(right):
            # Imperfect interleave: sometimes drop 2-3 cards from same half
            if random.random() < 0.5 + imperfection:
                count = random.choices([1, 2, 3], weights=[0.6, 0.3, 0.1])[0]
                for _ in range(min(count, len(left) - li)):
                    result.append(left[li])
                    li += 1
            else:
                count = random.choices([1, 2, 3], weights=[0.6, 0.3, 0.1])[0]
                for _ in range(min(count, len(right) - ri)):
                    result.append(right[ri])
                    ri += 1
        result.extend(left[li:])
        result.extend(right[ri:])
        self.cards = result

    def _strip_shuffle(self, num_strips: int = 7):
        """Strip/cut shuffle — pulls groups of cards from top and places them."""
        result = []
        remaining = list(self.cards)
        for _ in range(num_strips):
            if len(remaining) < 10:
                break
            strip_size = random.randint(15, 40)
            strip_size = min(strip_size, len(remaining))
            strip = remaining[:strip_size]
            remaining = remaining[strip_size:]
            result = strip + result  # Place strip on top
        result = remaining + result
        self.cards = result

    def _box_shuffle(self, num_boxes: int = 5):
        """Box shuffle — divides into boxes and reassembles."""
        boxes = []
        remaining = list(self.cards)
        box_size = len(remaining) // num_boxes
        for i in range(num_boxes):
            if i == num_boxes - 1:
                boxes.append(remaining)
            else:
                boxes.append(remaining[:box_size])
                remaining = remaining[box_size:]
        random.shuffle(boxes)
        self.cards = [card for box in boxes for card in box]

    def _wash_shuffle(self):
        """Wash/scramble — most thorough, close to true random."""
        random.shuffle(self.cards)

    def deal(self) -> Optional[Card]:
        """Deal one card from the shoe."""
        if not self.cards:
            return None
        card = self.cards.pop()
        self.dealt.append(card)
        return card

    @property
    def cards_remaining(self) -> int:
        return len(self.cards)

    @property
    def cards_dealt(self) -> int:
        return len(self.dealt)

    @property
    def decks_remaining(self) -> float:
        """FIX M8: Floor at 0.25 to match CardCounter.decks_remaining.
        Without this, the UI shows a different value than what TC is computed with
        when the shoe is nearly empty, causing a visible display mismatch."""
        return max(self.cards_remaining / 52.0, 0.25)

    @property
    def penetration_pct(self) -> float:
        """Current shoe penetration as a percentage."""
        if self.total_cards == 0:
            return 0.0
        return self.cards_dealt / self.total_cards

    @property
    def needs_shuffle(self) -> bool:
        """Whether the cut card has been reached."""
        return self.cards_dealt >= self._cut_position

    def remaining_by_rank(self) -> dict:
        """Count remaining cards by rank value (for ML features)."""
        counts = {i: 0 for i in range(2, 12)}  # 2-11 (11=Ace)
        for card in self.cards:
            counts[card.count_key] = counts.get(card.count_key, 0) + 1
        return counts

    def dealt_by_rank(self) -> dict:
        """Count dealt cards by rank value."""
        counts = {i: 0 for i in range(2, 12)}
        for card in self.dealt:
            counts[card.count_key] = counts.get(card.count_key, 0) + 1
        return counts
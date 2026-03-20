"""
blackjack/__init__.py — Core Game Engine Package
─────────────────────────────────────────────────
This package contains the pure Python game engine — no ML required.

HOW TO USE DIRECTLY (without the web UI):
    from blackjack import Shoe, CardCounter, BasicStrategy

    shoe    = Shoe(num_decks=6)
    counter = CardCounter(system="hi_lo", num_decks=6)
    strategy = BasicStrategy()

    card = shoe.deal()
    counter.count_card(card)
    print(f"True Count: {counter.true_count:.1f}")

WHAT EACH MODULE CONTAINS:
    card.py       → Card, Deck, Shoe, Rank, Suit, ShuffleType
    game.py       → Hand, Round, BlackjackTable, Action, HandResult
    counting.py   → CardCounter (Hi-Lo, KO, Omega II, Zen)
    strategy.py   → BasicStrategy (hard/soft/pair/surrender tables)
    deviations.py → DeviationEngine (Illustrious 18 + Fab 4)
    betting.py    → BettingEngine (Kelly Criterion + spread)
    side_bets.py  → SideBetAnalyzer (Insurance, Perfect Pairs, 21+3, LL)
"""

from .card     import Card, Deck, Shoe
from .game     import Hand, Round, BlackjackTable
from .counting import CardCounter
from .strategy import BasicStrategy
from .deviations import DeviationEngine
from .betting  import BettingEngine
from .side_bets import SideBetAnalyzer

# __all__ controls what gets imported with "from blackjack import *"
__all__ = [
    'Card', 'Deck', 'Shoe',
    'Hand', 'Round', 'BlackjackTable',
    'CardCounter',
    'BasicStrategy',
    'DeviationEngine',
    'BettingEngine',
    'SideBetAnalyzer',
]

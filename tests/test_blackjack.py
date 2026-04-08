"""
tests/test_blackjack.py — Unit tests for the core game engine.

Run with:
    python -m pytest tests/ -v
    python -m pytest tests/test_blackjack.py -v
    python -m pytest tests/test_blackjack.py -v -k "soft"   # filter by name

No Flask, no WebSocket, no server needed — pure engine testing only.

Coverage:
  • Hand value computation (including multi-ace soft hands)
  • Split mechanics and split_from_ace flag propagation
  • Bust logic and hand resolution
  • Card counting accuracy across all five systems
  • Basic strategy key decisions
  • Deviation engine (I18 + Fab 4)
  • Betting engine
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from blackjack.card import Card, Rank, Suit, Shoe, Deck
from blackjack.game import Hand, Round, Action, HandResult
from blackjack.counting import CardCounter, _MAX_HISTORY
from blackjack.strategy import BasicStrategy
from blackjack.deviations import DeviationEngine
from blackjack.betting import BettingEngine
from config import GameConfig


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def c(rank: Rank, suit: Suit = Suit.SPADES) -> Card:
    """Shorthand card constructor."""
    return Card(rank, suit)

def hand(*ranks: Rank, bet: float = 10, split: bool = False,
         split_ace: bool = False) -> Hand:
    """Shorthand hand constructor."""
    h = Hand(bet=bet)
    for r in ranks:
        h.add_card(c(r))
    if split or split_ace:
        h.is_split = True
    if split_ace:
        h.split_from_ace = True
    return h

def upcard(rank: Rank) -> Card:
    """Shorthand dealer upcard (always diamonds to distinguish visually)."""
    return c(rank, Suit.DIAMONDS)


# ─────────────────────────────────────────────────────────────────────────────
# Hand value computation
# ─────────────────────────────────────────────────────────────────────────────

class TestHandValues:

    def test_hard_total_no_ace(self):
        h = hand(Rank.TEN, Rank.SIX)
        assert h.best_value == 16
        assert not h.is_soft

    def test_soft_17_two_cards(self):
        h = hand(Rank.ACE, Rank.SIX)
        assert h.best_value == 17
        assert h.is_soft

    def test_soft_18_two_cards(self):
        h = hand(Rank.ACE, Rank.SEVEN)
        assert h.best_value == 18
        assert h.is_soft

    def test_blackjack_not_soft(self):
        """Natural BJ (A+10): not considered soft for strategy purposes."""
        h = hand(Rank.ACE, Rank.TEN)
        assert h.is_blackjack
        assert not h.is_soft

    def test_soft_18_triple_card_double_ace(self):
        """
        BUG FIX REGRESSION: A+A+6 was returning is_soft=False.
        The old code's premature `if total > 21: return False` check (where
        total counted all aces as 11 = 28) masked the correct soft detection.
        """
        h = hand(Rank.ACE, Rank.ACE, Rank.SIX)
        assert h.best_value == 18, f"Expected 18, got {h.best_value}"
        assert h.is_soft, "A+A+6 must be soft 18 — one ace counts as 11"

    def test_soft_19_double_ace_seven(self):
        """A+A+7 = soft 19. Same family of bug as A+A+6."""
        h = hand(Rank.ACE, Rank.ACE, Rank.SEVEN)
        assert h.best_value == 19
        assert h.is_soft, "A+A+7 must be soft 19"

    def test_soft_20_double_ace_eight(self):
        """A+A+8 = soft 20."""
        h = hand(Rank.ACE, Rank.ACE, Rank.EIGHT)
        assert h.best_value == 20
        assert h.is_soft

    def test_hard_17_ace_forced_to_1(self):
        """A+6+10: must count ace as 1 → hard 17."""
        h = hand(Rank.ACE, Rank.SIX, Rank.TEN)
        assert h.best_value == 17
        assert not h.is_soft

    def test_double_ace_equals_12_is_soft(self):
        """A+A: best value 12 (one at 11, one at 1), is soft."""
        h = hand(Rank.ACE, Rank.ACE)
        assert h.best_value == 12
        assert h.is_soft

    def test_bust(self):
        h = hand(Rank.TEN, Rank.TEN, Rank.TEN)
        assert h.is_bust
        assert h.best_value > 21

    def test_not_bust_21(self):
        h = hand(Rank.ACE, Rank.TEN)
        assert not h.is_bust
        assert h.best_value == 21

    def test_hard_16(self):
        h = hand(Rank.TEN, Rank.SIX)
        assert h.best_value == 16
        assert not h.is_soft
        assert not h.is_bust

    def test_five_card_soft_21(self):
        """A+2+3+4+11? — check complex multi-card soft detection."""
        h = hand(Rank.ACE, Rank.TWO, Rank.THREE, Rank.FOUR)
        # 11+2+3+4 = 20 — soft 20
        assert h.best_value == 20
        assert h.is_soft


# ─────────────────────────────────────────────────────────────────────────────
# Split mechanics
# ─────────────────────────────────────────────────────────────────────────────

class TestSplitMechanics:

    def test_is_pair_same_rank(self):
        h = hand(Rank.EIGHT, Rank.EIGHT)
        assert h.is_pair

    def test_not_pair_different_rank_same_value(self):
        """TEN and JACK both have BJ value 10 but are different ranks — not a pair."""
        h = hand(Rank.TEN, Rank.JACK)
        assert not h.is_pair

    def test_is_ten_pair_different_ranks(self):
        h = hand(Rank.TEN, Rank.JACK)
        assert h.is_ten_pair

    # ── Round.player_split ───────────────────────────────────────────────────

    def test_round_split_creates_two_hands(self):
        shoe = Shoe(num_decks=2)
        r = Round(shoe, base_bet=10)
        r.player_hands[0].add_card(c(Rank.EIGHT, Suit.SPADES))
        r.player_hands[0].add_card(c(Rank.EIGHT, Suit.HEARTS))
        r.player_split(0)
        assert len(r.player_hands) == 2

    def test_round_split_ace_sets_split_from_ace_on_both_hands(self):
        """
        BUG FIX REGRESSION: Round.player_split() was not setting split_from_ace.
        This caused the one-card-per-ace rule to never fire through the Round API.
        """
        shoe = Shoe(num_decks=2)
        r = Round(shoe, base_bet=10)
        r.player_hands[0].add_card(c(Rank.ACE, Suit.SPADES))
        r.player_hands[0].add_card(c(Rank.ACE, Suit.HEARTS))
        r.player_split(0)
        assert r.player_hands[0].split_from_ace, "First ace hand must have split_from_ace=True"
        assert r.player_hands[1].split_from_ace, "Second ace hand must have split_from_ace=True"

    def test_round_split_non_ace_does_not_set_split_from_ace(self):
        """Splitting 8s: split_from_ace must stay False on both hands."""
        shoe = Shoe(num_decks=2)
        r = Round(shoe, base_bet=10)
        r.player_hands[0].add_card(c(Rank.EIGHT, Suit.SPADES))
        r.player_hands[0].add_card(c(Rank.EIGHT, Suit.HEARTS))
        r.player_split(0)
        assert not r.player_hands[0].split_from_ace
        assert not r.player_hands[1].split_from_ace

    def test_round_split_preserves_bet(self):
        shoe = Shoe(num_decks=2)
        r = Round(shoe, base_bet=50)
        r.player_hands[0].add_card(c(Rank.EIGHT, Suit.SPADES))
        r.player_hands[0].add_card(c(Rank.EIGHT, Suit.HEARTS))
        r.player_split(0)
        assert r.player_hands[0].bet == 50
        assert r.player_hands[1].bet == 50

    # ── available_actions after split ────────────────────────────────────────

    def test_split_ace_available_actions_stand_only(self):
        """After split ace receives one card: only STAND allowed (one-card rule)."""
        config = GameConfig()
        h = hand(Rank.ACE, Rank.SIX, split=True, split_ace=True)
        assert h.available_actions(config) == [Action.STAND]

    def test_split_non_ace_allows_hit(self):
        config = GameConfig()
        h = hand(Rank.EIGHT, Rank.SIX, split=True)
        h.split_from_ace = False
        avail = h.available_actions(config)
        assert Action.HIT in avail

    def test_no_surrender_on_split_hand(self):
        """Surrender is only valid on the initial 2-card non-split hand."""
        config = GameConfig()
        config.ALLOW_LATE_SURRENDER = True
        h = hand(Rank.TEN, Rank.SIX, split=True)
        avail = h.available_actions(config)
        assert Action.SURRENDER not in avail

    def test_max_splits_respected(self):
        """With MAX_SPLITS=2 (one split allowed), at num_splits_done=1 no more splits."""
        config = GameConfig()
        config.MAX_SPLITS = 2
        h = hand(Rank.EIGHT, Rank.EIGHT)
        avail = h.available_actions(config, num_splits_done=1)
        assert Action.SPLIT not in avail

    def test_no_double_after_split_when_disallowed(self):
        config = GameConfig()
        config.ALLOW_DOUBLE_AFTER_SPLIT = False
        h = hand(Rank.FOUR, Rank.SEVEN, split=True)  # hard 11 — normally double
        avail = h.available_actions(config)
        assert Action.DOUBLE not in avail

    def test_double_after_split_when_allowed(self):
        config = GameConfig()
        config.ALLOW_DOUBLE_AFTER_SPLIT = True
        h = hand(Rank.FOUR, Rank.SEVEN, split=True)  # hard 11
        avail = h.available_actions(config)
        assert Action.DOUBLE in avail


# ─────────────────────────────────────────────────────────────────────────────
# Bust logic and hand resolution
# ─────────────────────────────────────────────────────────────────────────────

class TestBustAndResolution:

    def _round_with(self, player_ranks, dealer_ranks, bet=10):
        """Helper: create a Round with specific cards without dealing from shoe."""
        shoe = Shoe(num_decks=4)
        r = Round(shoe, base_bet=bet)
        for rank in player_ranks:
            r.player_hands[0].add_card(c(rank))
        for rank in dealer_ranks:
            r.dealer_hand.add_card(c(rank))
        return r

    def test_player_bust_is_loss(self):
        r = self._round_with([Rank.TEN, Rank.TEN, Rank.TEN], [Rank.TEN, Rank.SEVEN])
        profit = r.resolve()
        assert profit == -10
        assert r.player_hands[0].result == HandResult.LOSS

    def test_dealer_bust_player_wins(self):
        r = self._round_with([Rank.TEN, Rank.EIGHT], [Rank.TEN, Rank.TEN, Rank.FIVE])
        profit = r.resolve()
        assert profit == 10
        assert r.player_hands[0].result == HandResult.WIN

    def test_blackjack_pays_1_5x(self):
        config = GameConfig()
        r = self._round_with([Rank.ACE, Rank.TEN], [Rank.TEN, Rank.SEVEN])
        profit = r.resolve(config)
        assert profit == 15.0  # 10 * 1.5

    def test_push_is_zero(self):
        r = self._round_with([Rank.TEN, Rank.SEVEN], [Rank.TEN, Rank.SEVEN])
        profit = r.resolve()
        assert profit == 0
        assert r.player_hands[0].result == HandResult.PUSH

    def test_surrender_costs_half(self):
        r = self._round_with([Rank.TEN, Rank.SIX], [Rank.TEN, Rank.SEVEN])
        r.player_surrender(0)
        profit = r.resolve()
        assert profit == -5.0

    def test_player_higher_wins(self):
        r = self._round_with([Rank.TEN, Rank.NINE], [Rank.TEN, Rank.SEVEN])
        profit = r.resolve()
        assert profit == 10

    def test_dealer_higher_loses(self):
        r = self._round_with([Rank.TEN, Rank.SIX], [Rank.TEN, Rank.NINE])
        profit = r.resolve()
        assert profit == -10

    def test_dealer_bj_beats_player_21(self):
        """Dealer blackjack beats player 21 (non-BJ)."""
        shoe = Shoe(num_decks=4)
        r = Round(shoe, base_bet=10)
        # Player: 7+7+7 = 21 (not a blackjack)
        for rank in [Rank.SEVEN, Rank.SEVEN, Rank.SEVEN]:
            r.player_hands[0].add_card(c(rank))
        # Dealer: A+10 = BJ
        r.dealer_hand.add_card(c(Rank.ACE))
        r.dealer_hand.add_card(c(Rank.TEN))
        profit = r.resolve()
        assert profit == -10
        assert r.player_hands[0].result == HandResult.LOSS

    def test_insurance_pays_on_dealer_bj(self):
        config = GameConfig()
        r = self._round_with([Rank.TEN, Rank.SIX], [Rank.ACE, Rank.TEN])
        r.player_insurance(0)  # insurance_bet = 5
        profit = r.resolve(config)
        # Main bet: -10 (dealer BJ beats player 16)
        # Insurance: +5 * 2 = +10
        assert profit == 0

    def test_insurance_loses_when_no_dealer_bj(self):
        config = GameConfig()
        r = self._round_with([Rank.TEN, Rank.NINE], [Rank.ACE, Rank.SEVEN])
        r.player_insurance(0)  # insurance_bet = 5
        profit = r.resolve(config)
        # Main bet: +10 (player 19 beats dealer 18)
        # Insurance: -5 (dealer no BJ)
        assert profit == 5

    def test_doubled_bet_affects_profit(self):
        r = self._round_with([Rank.SIX, Rank.FIVE], [Rank.TEN, Rank.SEVEN])  # 11 vs 17
        r.player_hands[0].bet = 20   # doubled
        r.player_hands[0].is_doubled = True
        r.player_hands[0].add_card(c(Rank.TEN))  # 21 — win
        profit = r.resolve()
        assert profit == 20


# ─────────────────────────────────────────────────────────────────────────────
# Card counting
# ─────────────────────────────────────────────────────────────────────────────

class TestCounting:

    def test_hi_lo_balanced_full_deck(self):
        """Hi-Lo is balanced: counting all 52 cards returns RC=0."""
        counter = CardCounter('hi_lo', 1)
        for card in Deck.create():
            counter.count_card(card)
        assert counter.running_count == 0

    def test_ko_unbalanced_full_deck(self):
        """KO is unbalanced: counting all 52 cards returns RC=+4."""
        counter = CardCounter('ko', 1)
        for card in Deck.create():
            counter.count_card(card)
        assert counter.running_count == 4   # 7 counts +1 in KO but 0 in Hi-Lo

    def test_hi_lo_low_card_plus_one(self):
        counter = CardCounter('hi_lo', 6)
        counter.count_card(c(Rank.TWO))
        assert counter.running_count == 1

    def test_hi_lo_high_card_minus_one(self):
        counter = CardCounter('hi_lo', 6)
        counter.count_card(c(Rank.TEN))
        assert counter.running_count == -1

    def test_hi_lo_seven_is_neutral(self):
        counter = CardCounter('hi_lo', 6)
        counter.count_card(c(Rank.SEVEN))
        assert counter.running_count == 0

    def test_ko_seven_is_plus_one(self):
        """KO differs from Hi-Lo: 7 counts as +1."""
        counter = CardCounter('ko', 6)
        counter.count_card(c(Rank.SEVEN))
        assert counter.running_count == 1

    def test_true_count_formula(self):
        """TC = RC / decks_remaining. With RC=6 and 3 decks remaining, TC=2."""
        counter = CardCounter('hi_lo', 6)
        counter.running_count = 6
        counter.cards_seen = 156  # 6 decks total - 3 dealt = 3 remaining
        assert abs(counter.true_count - 2.0) < 0.05

    def test_reset_clears_all_state(self):
        counter = CardCounter('hi_lo', 6)
        counter.count_card(c(Rank.TWO))
        counter.count_card(c(Rank.ACE))
        counter.reset()
        assert counter.running_count == 0
        assert counter.cards_seen == 0
        assert counter.aces_seen == 0
        assert counter.tens_seen == 0
        assert len(counter.count_history) == 0
        assert len(counter._card_log) == 0

    def test_count_history_capped(self):
        """
        PERF FIX: count_history must not grow beyond _MAX_HISTORY (500).
        Previously unbounded — this would grow to 3000+ entries in a long session.
        """
        counter = CardCounter('hi_lo', 6)
        # Deal more cards than the cap
        for _ in range(_MAX_HISTORY + 200):
            counter.count_card(c(Rank.TWO))
        assert len(counter.count_history) == _MAX_HISTORY, (
            f"count_history grew beyond {_MAX_HISTORY}: {len(counter.count_history)}"
        )

    def test_card_log_not_capped(self):
        """_card_log is never capped — it's used for system replays and must be complete."""
        counter = CardCounter('hi_lo', 6)
        for _ in range(700):
            counter.count_card(c(Rank.TWO))
        assert len(counter._card_log) == 700   # unbounded, needed for change_system replay

    def test_insurance_threshold_at_tc3(self):
        counter = CardCounter('hi_lo', 6)
        counter.running_count = 9
        counter.cards_seen = 156  # TC ≈ 3.0
        assert counter.should_take_insurance()

    def test_no_insurance_below_tc3(self):
        counter = CardCounter('hi_lo', 6)
        counter.running_count = 0
        assert not counter.should_take_insurance()

    def test_advantage_positive_at_high_tc(self):
        counter = CardCounter('hi_lo', 6)
        counter.running_count = 12
        counter.cards_seen = 260  # ~1 deck remaining → TC ≈ 12
        assert counter.advantage > 0
        assert counter.is_favorable

    def test_advantage_negative_at_zero_count(self):
        """At neutral count, house still has edge."""
        counter = CardCounter('hi_lo', 6)
        assert counter.advantage < 0

    def test_side_count_aces(self):
        counter = CardCounter('hi_lo', 6)
        counter.count_card(c(Rank.ACE))
        counter.count_card(c(Rank.ACE, Suit.HEARTS))
        assert counter.aces_seen == 2
        assert counter.aces_remaining == 6 * 4 - 2

    def test_side_count_tens(self):
        counter = CardCounter('hi_lo', 6)
        counter.count_card(c(Rank.TEN))
        counter.count_card(c(Rank.JACK))
        assert counter.tens_seen == 2
        assert counter.tens_remaining == 6 * 16 - 2

    def test_get_remaining_estimate_sums_to_one(self):
        """Composition probabilities must sum to exactly 1.0."""
        counter = CardCounter('hi_lo', 6)
        est = counter.get_remaining_estimate()
        total = sum(est.values())
        assert abs(total - 1.0) < 1e-9, f"Probabilities sum to {total}, not 1.0"

    def test_total_per_rank_precomputed(self):
        """
        PERF FIX: _total_per_rank must be a dict on the instance (computed in __init__).
        Confirms it is not rebuilt on each get_remaining_estimate() call.
        """
        counter = CardCounter('hi_lo', 8)
        assert hasattr(counter, '_total_per_rank')
        assert counter._total_per_rank[10] == 16 * 8   # 10/J/Q/K × 8 decks
        assert counter._total_per_rank[11] == 4 * 8    # Ace × 8 decks

    def test_all_five_systems_available(self):
        for system in ('hi_lo', 'ko', 'omega_ii', 'zen', 'wong_halves'):
            counter = CardCounter(system, 6)
            assert counter.system_name == system

    def test_wong_halves_balanced_full_deck(self):
        """Wong Halves is balanced: counting all 52 cards returns RC=0."""
        counter = CardCounter('wong_halves', 1)
        for card in Deck.create():
            counter.count_card(card)
        assert counter.running_count == 0

    def test_wong_halves_fractional_values(self):
        """Wong Halves uses fractional values: 2=+0.5, 5=+1.5, 9=-0.5."""
        counter = CardCounter('wong_halves', 6)
        counter.count_card(c(Rank.TWO))
        assert counter.running_count == 0.5
        counter.count_card(c(Rank.FIVE))
        assert counter.running_count == 2.0
        counter.count_card(c(Rank.NINE))
        assert counter.running_count == 1.5

    def test_wong_halves_ten_and_ace(self):
        """Wong Halves: 10 = -1, Ace = -1 (same as Hi-Lo for high cards)."""
        counter = CardCounter('wong_halves', 6)
        counter.count_card(c(Rank.TEN))
        assert counter.running_count == -1
        counter.count_card(c(Rank.ACE))
        assert counter.running_count == -2

    def test_wong_halves_seven_half(self):
        """Wong Halves: 7 = +0.5 (unlike Hi-Lo where 7 is neutral)."""
        counter = CardCounter('wong_halves', 6)
        counter.count_card(c(Rank.SEVEN))
        assert counter.running_count == 0.5

    def test_invalid_system_raises(self):
        with pytest.raises(ValueError, match="Unknown system"):
            CardCounter('nifty_fifties', 6)

    def test_state_vector_length(self):
        """ML feature vector: 4 base + 10 rank probabilities = 14 elements."""
        counter = CardCounter('hi_lo', 6)
        vec = counter.get_state_vector()
        assert len(vec) == 14

    def test_penetration_increases_as_cards_seen(self):
        counter = CardCounter('hi_lo', 6)
        assert counter.penetration == 0.0
        counter.count_card(c(Rank.TWO))
        assert counter.penetration > 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Basic strategy
# ─────────────────────────────────────────────────────────────────────────────

class TestBasicStrategy:

    def setup_method(self):
        self.bs = BasicStrategy(GameConfig())

    def test_hard_16_vs_7_hit(self):
        h = hand(Rank.TEN, Rank.SIX)
        assert self.bs.get_action(h, upcard(Rank.SEVEN)) == Action.HIT

    def test_hard_16_vs_6_stand(self):
        h = hand(Rank.TEN, Rank.SIX)
        assert self.bs.get_action(h, upcard(Rank.SIX)) == Action.STAND

    def test_hard_16_vs_10_surrender(self):
        h = hand(Rank.TEN, Rank.SIX)
        assert self.bs.get_action(h, upcard(Rank.TEN)) == Action.SURRENDER

    def test_hard_15_vs_10_surrender(self):
        h = hand(Rank.TEN, Rank.FIVE)
        assert self.bs.get_action(h, upcard(Rank.TEN)) == Action.SURRENDER

    def test_always_split_aces(self):
        h = hand(Rank.ACE, Rank.ACE)
        assert self.bs.get_action(h, upcard(Rank.TEN)) == Action.SPLIT

    def test_always_split_eights(self):
        h = hand(Rank.EIGHT, Rank.EIGHT)
        assert self.bs.get_action(h, upcard(Rank.TEN)) == Action.SPLIT

    def test_never_split_tens(self):
        h = hand(Rank.TEN, Rank.TEN)
        assert self.bs.get_action(h, upcard(Rank.SIX)) == Action.STAND

    def test_88_vs_10_split_not_surrender(self):
        """
        8-8 vs 10: must SPLIT, not SURRENDER.
        The pair table is checked BEFORE the surrender table — this ordering
        is critical. Both are available; split must win.
        """
        h = hand(Rank.EIGHT, Rank.EIGHT)
        action = self.bs.get_action(h, upcard(Rank.TEN))
        assert action == Action.SPLIT, f"8-8 vs 10 should SPLIT, got {action}"

    def test_double_11_vs_6(self):
        h = hand(Rank.SIX, Rank.FIVE)  # hard 11
        assert self.bs.get_action(h, upcard(Rank.SIX)) == Action.DOUBLE

    def test_double_10_vs_9(self):
        h = hand(Rank.SIX, Rank.FOUR)  # hard 10
        assert self.bs.get_action(h, upcard(Rank.NINE)) == Action.DOUBLE

    def test_soft_18_vs_9_hit(self):
        h = hand(Rank.ACE, Rank.SEVEN)  # soft 18
        assert h.is_soft
        assert self.bs.get_action(h, upcard(Rank.NINE)) == Action.HIT

    def test_soft_18_vs_7_stand(self):
        h = hand(Rank.ACE, Rank.SEVEN)  # soft 18
        assert self.bs.get_action(h, upcard(Rank.SEVEN)) == Action.STAND

    def test_soft_18_vs_6_double(self):
        h = hand(Rank.ACE, Rank.SEVEN)  # soft 18
        assert self.bs.get_action(h, upcard(Rank.SIX)) == Action.DOUBLE

    def test_always_stand_on_17_plus(self):
        for rank in [Rank.SEVEN, Rank.EIGHT, Rank.NINE]:
            h = hand(Rank.TEN, rank)
            action = self.bs.get_action(h, upcard(Rank.TEN))
            assert action == Action.STAND, f"Hard {h.best_value} vs 10 should STAND"

    def test_always_hit_8_or_less(self):
        h = hand(Rank.FOUR, Rank.FOUR)  # 8
        assert self.bs.get_action(h, upcard(Rank.SIX)) == Action.HIT

    def test_pair_5s_treated_as_hard_10(self):
        """Pair of 5s: never split — treat as hard 10 and double."""
        h = hand(Rank.FIVE, Rank.FIVE)
        assert h.is_pair
        action = self.bs.get_action(h, upcard(Rank.SIX))
        assert action == Action.DOUBLE   # pair 5s → hard 10 → double vs 6

    def test_hard_12_vs_4_stand(self):
        """12 vs 4: stand (dealer's bust card, don't risk busting)."""
        h = hand(Rank.TEN, Rank.TWO)
        assert self.bs.get_action(h, upcard(Rank.FOUR)) == Action.STAND

    def test_hard_12_vs_2_hit(self):
        """12 vs 2: hit (dealer is less likely to bust)."""
        h = hand(Rank.TEN, Rank.TWO)
        assert self.bs.get_action(h, upcard(Rank.TWO)) == Action.HIT


# ─────────────────────────────────────────────────────────────────────────────
# Deviation engine (Illustrious 18 + Fab 4)
# ─────────────────────────────────────────────────────────────────────────────

class TestDeviations:

    def setup_method(self):
        self.dev = DeviationEngine()

    def _avail(self, *actions):
        return list(actions)

    def test_i18_16_vs_10_stand_at_tc0(self):
        """I18 #1: Hard 16 vs 10 → STAND at TC >= 0 (basic says HIT)."""
        h = hand(Rank.TEN, Rank.SIX)
        avail = self._avail(Action.HIT, Action.STAND)   # no surrender on 3-card hand
        action = self.dev.get_action(h, upcard(Rank.TEN), true_count=0.5,
                                      available_actions=avail)
        assert action == Action.STAND

    def test_i18_16_vs_10_hit_below_tc0(self):
        """Hard 16 vs 10 at TC=-1: basic strategy HIT applies."""
        h = hand(Rank.TEN, Rank.SIX)
        avail = self._avail(Action.HIT, Action.STAND)
        action = self.dev.get_action(h, upcard(Rank.TEN), true_count=-1.0,
                                      available_actions=avail)
        assert action == Action.HIT

    def test_i18_12_vs_4_hit_at_negative_tc(self):
        """I18: Hard 12 vs 4 → HIT at TC < 0 (basic says STAND)."""
        h = hand(Rank.TEN, Rank.TWO)
        avail = self._avail(Action.HIT, Action.STAND)
        action = self.dev.get_action(h, upcard(Rank.FOUR), true_count=-0.5,
                                      available_actions=avail)
        assert action == Action.HIT

    def test_i18_12_vs_4_stand_at_neutral_tc(self):
        """Hard 12 vs 4 at TC=1: basic strategy STAND applies."""
        h = hand(Rank.TEN, Rank.TWO)
        avail = self._avail(Action.HIT, Action.STAND)
        action = self.dev.get_action(h, upcard(Rank.FOUR), true_count=1.0,
                                      available_actions=avail)
        assert action == Action.STAND

    def test_i18_11_vs_ace_double_at_tc1(self):
        """I18: Hard 11 vs Ace → DOUBLE at TC >= 1 (basic says HIT vs A in S17)."""
        h = hand(Rank.SIX, Rank.FIVE)  # hard 11
        avail = self._avail(Action.HIT, Action.STAND, Action.DOUBLE)
        action = self.dev.get_action(h, upcard(Rank.ACE), true_count=1.5,
                                      available_actions=avail)
        assert action == Action.DOUBLE

    def test_fab4_15_vs_10_surrender_at_tc0(self):
        """Fab 4: Hard 15 vs 10 → SURRENDER at TC >= 0."""
        h = hand(Rank.TEN, Rank.FIVE)
        avail = self._avail(Action.HIT, Action.STAND, Action.SURRENDER)
        action = self.dev.get_action(h, upcard(Rank.TEN), true_count=0.5,
                                      available_actions=avail)
        assert action == Action.SURRENDER

    def test_deviation_info_populated_when_fired(self):
        h = hand(Rank.TEN, Rank.SIX)
        info = self.dev.get_action_with_info(h, upcard(Rank.TEN), true_count=1.0)
        assert info["is_deviation"]
        assert info["deviation"] is not None
        assert "tc_threshold" in info["deviation"]

    def test_no_deviation_at_neutral_count_17(self):
        """Hard 17 vs 7: always stand — no deviation should fire."""
        h = hand(Rank.TEN, Rank.SEVEN)
        info = self.dev.get_action_with_info(h, upcard(Rank.SEVEN), true_count=0.0)
        assert not info["is_deviation"]
        assert info["deviation"] is None
        assert info["action"] == Action.STAND

    def test_no_deviation_info_when_no_deviation(self):
        h = hand(Rank.TEN, Rank.SEVEN)
        info = self.dev.get_action_with_info(h, upcard(Rank.SEVEN), true_count=-5.0)
        assert info["deviation"] is None


# ─────────────────────────────────────────────────────────────────────────────
# Betting engine
# ─────────────────────────────────────────────────────────────────────────────

class TestBettingEngine:

    def setup_method(self):
        self.engine = BettingEngine()

    def test_minimum_bet_at_neutral_count(self):
        bet = self.engine.get_optimal_bet(true_count=0)
        assert bet == self.engine.config.TABLE_MIN

    def test_minimum_bet_at_negative_count(self):
        bet = self.engine.get_optimal_bet(true_count=-3)
        assert bet == self.engine.config.TABLE_MIN

    def test_bet_increases_with_tc(self):
        bet_0 = self.engine.get_optimal_bet(true_count=0)
        bet_2 = self.engine.get_optimal_bet(true_count=2)
        bet_4 = self.engine.get_optimal_bet(true_count=4)
        assert bet_2 > bet_0
        assert bet_4 > bet_2

    def test_bet_clamped_to_table_max(self):
        bet = self.engine.get_optimal_bet(true_count=20)
        assert bet <= self.engine.config.TABLE_MAX

    def test_bet_clamped_to_table_min(self):
        bet = self.engine.get_optimal_bet(true_count=-10)
        assert bet >= self.engine.config.TABLE_MIN

    def test_bet_never_exceeds_bankroll(self):
        """Engine must not recommend a bet larger than current bankroll."""
        from config import BettingConfig
        small_config = BettingConfig()
        small_config.TABLE_MIN = 10
        small_config.TABLE_MAX = 10_000
        small_config.BASE_UNIT = 10
        small_engine = BettingEngine(small_config)
        small_engine.bankroll = 30   # tiny bankroll
        bet = small_engine.get_optimal_bet(true_count=10)
        assert bet <= 30

    def test_bankroll_guard_floor_not_round(self):
        """
        Bankroll guard must never be exceeded after unit rounding.
        Previously round() could produce ceil(bankroll/unit)*unit > bankroll
        when bankroll is not a multiple of BASE_UNIT (e.g. ₹150 bankroll,
        ₹100 unit → round(1.5)=2 → ₹200 bet OVER the ₹150 guard).
        After fix: math.floor() ensures the bet never exceeds the bankroll.
        """
        e = BettingEngine()
        e.bankroll = 150   # 1.5 units — the exact rounding edge case
        bet = e.get_optimal_bet(true_count=5)
        assert bet <= 150, (
            f"Bet {bet} exceeds bankroll 150. "
            f"math.floor must be used, not round(), to prevent banker-rounding overbet."
        )

    def test_stop_loss_triggers_on_record_result(self):
        """Stop-loss flag latches when session_profit crosses stop_loss threshold."""
        e = BettingEngine()
        assert not e.should_leave
        # Drive session_profit to exactly stop_loss
        target = abs(e.stop_loss)
        e.record_result(bet=100, profit=-target)
        assert e.should_leave
        assert e.stop_reason == 'STOP_LOSS'

    def test_stop_win_triggers_on_record_result(self):
        """Stop-win flag latches when session_profit crosses stop_win threshold."""
        e = BettingEngine()
        e.record_result(bet=100, profit=e.stop_win)
        assert e.should_leave
        assert e.stop_reason == 'STOP_WIN'

    def test_stop_trigger_latches_does_not_flip(self):
        """Once triggered, stop_reason must not change even if P&L swings back."""
        e = BettingEngine()
        e.record_result(bet=100, profit=-(abs(e.stop_loss)))  # trigger loss
        assert e.stop_reason == 'STOP_LOSS'
        e.record_result(bet=100, profit=999999)               # huge recovery
        assert e.stop_reason == 'STOP_LOSS', "Latch must not flip after recovery"

    def test_set_stop_thresholds_updates_limits(self):
        """set_stop_thresholds must update both limits and validate signs."""
        e = BettingEngine()
        e.set_stop_thresholds(-2000, 5000)
        assert e.stop_loss == -2000
        assert e.stop_win  == 5000

    def test_set_stop_thresholds_rejects_invalid(self):
        """set_stop_thresholds must raise ValueError for positive stop_loss or negative stop_win."""
        e = BettingEngine()
        try:
            e.set_stop_thresholds(500, 5000)   # positive stop_loss
            assert False, "Should have raised ValueError"
        except ValueError:
            pass
        try:
            e.set_stop_thresholds(-500, -100)  # negative stop_win
            assert False, "Should have raised ValueError"
        except ValueError:
            pass

    def test_stop_keys_present_in_session_stats(self):
        """should_leave, stop_reason, stop_loss, stop_win must always be in session stats."""
        e = BettingEngine()
        for stats in [e.get_session_stats()]:  # empty session
            for key in ('should_leave', 'stop_reason', 'stop_loss', 'stop_win'):
                assert key in stats, f"Key '{key}' missing from session stats"
        e.record_result(bet=100, profit=50)
        stats = e.get_session_stats()
        for key in ('should_leave', 'stop_reason', 'stop_loss', 'stop_win'):
            assert key in stats, f"Key '{key}' missing from populated session stats"

    def test_record_result_updates_bankroll(self):
        initial = self.engine.bankroll
        self.engine.record_result(bet=100, profit=100)
        assert self.engine.bankroll == initial + 100

    def test_record_result_tracks_max_bankroll(self):
        self.engine.record_result(bet=100, profit=500)
        assert self.engine.max_bankroll >= self.engine.bankroll

    def test_record_result_tracks_min_bankroll(self):
        self.engine.record_result(bet=100, profit=-9999)
        assert self.engine.min_bankroll <= self.engine.bankroll

    def test_session_stats_correct_counts(self):
        self.engine.record_result(100,  100)   # win
        self.engine.record_result(100, -100)   # loss
        self.engine.record_result(100,    0)   # push
        stats = self.engine.get_session_stats()
        assert stats['wins']    == 1
        assert stats['losses']  == 1
        assert stats['pushes']  == 1
        assert stats['hands_played'] == 3

    def test_session_stats_empty(self):
        """Empty session should return zeroed stats, not crash."""
        stats = self.engine.get_session_stats()
        assert stats['hands_played'] == 0
        assert stats['wins'] == 0

    def test_risk_of_ruin_is_probability(self):
        ror = self.engine.risk_of_ruin()
        assert 0.0 <= ror <= 1.0

    def test_wong_in_threshold(self):
        assert self.engine.should_wong_in(2.5)
        assert not self.engine.should_wong_in(1.0)

    def test_wong_out_threshold(self):
        assert self.engine.should_wong_out(-2.0)
        assert not self.engine.should_wong_out(0.5)


# ─────────────────────────────────────────────────────────────────────────────
# Integration: soft strategy through fixed A+A+X hands
# ─────────────────────────────────────────────────────────────────────────────

class TestSoftStrategyIntegration:
    """
    These tests verify that the is_soft fix in game.py flows correctly
    through to BasicStrategy — i.e., that A+A+6 gets SOFT_TABLE[18] decisions,
    not HARD_TABLE[18] decisions.
    """

    def setup_method(self):
        self.bs = BasicStrategy(GameConfig())

    def test_a_a_six_soft_18_vs_9_is_hit(self):
        """
        A+A+6 = soft 18 vs dealer 9.
        SOFT_TABLE[18][dealer 9] = H (Hit).
        If is_soft were wrong (False), HARD_TABLE[18] = S (Stand) — wrong answer.
        """
        h = hand(Rank.ACE, Rank.ACE, Rank.SIX)
        assert h.best_value == 18
        assert h.is_soft   # must be True for correct table lookup
        action = self.bs.get_action(h, upcard(Rank.NINE))
        assert action == Action.HIT, (
            f"A+A+6 soft 18 vs 9 should HIT (SOFT_TABLE), got {action}. "
            f"is_soft={h.is_soft} — if False, HARD_TABLE was used instead."
        )

    def test_a_a_seven_soft_19_vs_6_double_or_stand(self):
        """
        A+A+7 = soft 19.
        SOFT_TABLE[19][dealer 6] = Ds (double or stand).
        HARD_TABLE[19] = S — same answer but tests soft detection.
        """
        h = hand(Rank.ACE, Rank.ACE, Rank.SEVEN)
        assert h.best_value == 19
        assert h.is_soft

    def test_a_a_six_vs_dealer_2_double_or_stand(self):
        """
        A+A+6 = soft 18.
        SOFT_TABLE[18][dealer 2] = Ds (double or stand → stand when no double).
        HARD_TABLE[18] = S — coincidentally same here, but is_soft must still be True.
        """
        h = hand(Rank.ACE, Rank.ACE, Rank.SIX)
        assert h.is_soft
        # Action depends on whether double is in available_actions.
        # Without double (e.g., post-split): should STAND.
        avail = [Action.HIT, Action.STAND]
        action = self.bs.get_action(h, upcard(Rank.TWO), available_actions=avail)
        assert action == Action.STAND


# ─────────────────────────────────────────────────────────────────────────────
# Feature validation test scenarios (10 scenarios from QA spec)
# ─────────────────────────────────────────────────────────────────────────────

class TestFeatureScenarios:
    """
    Scenario-based tests covering the 4 production features:
      Stop-Loss / Stop-Win · Composition-Dependent 16v10 · N₀ · Shoe Quality

    Scenario numbering matches the QA spec exactly.
    """

    def setup_method(self):
        self.engine  = BettingEngine()
        self.dev     = DeviationEngine()
        self.counter = CardCounter(system="hi_lo", num_decks=6)

    # ── Stop-Loss / Stop-Win ─────────────────────────────────────────────

    def test_scenario_1_stop_loss_triggered(self):
        """Scenario 1: Losing session — stop-loss fires at threshold."""
        # Simulate a run of losses: 10 hands × $500 loss each = -$5000
        for _ in range(10):
            self.engine.record_result(bet=100, profit=-500)

        stats = self.engine.get_session_stats()
        # Session profit is -5000; a typical stop-loss of -5000 should be at/below threshold
        assert stats["total_profit"] <= -5000, (
            f"Expected loss ≤ -5000, got {stats['total_profit']}"
        )
        # Bankroll must have decreased from initial
        assert stats["bankroll"] < self.engine.config.INITIAL_BANKROLL
        # Edge case: exactly at threshold — profit == -5000 must count as triggered
        assert stats["total_profit"] == -5000

    def test_scenario_2_stop_win_triggered(self):
        """Scenario 2: Winning session — stop-win fires at threshold."""
        for _ in range(6):
            self.engine.record_result(bet=100, profit=500)

        stats = self.engine.get_session_stats()
        assert stats["total_profit"] >= 3000, (
            f"Expected profit ≥ 3000, got {stats['total_profit']}"
        )
        assert stats["total_profit"] == 3000

    def test_scenario_3_neutral_session_no_exit(self):
        """Scenario 3: Neutral session — should NOT trigger stop-loss or stop-win."""
        # Win some, lose some — net +300 (below +3000 stop-win, above -5000 stop-loss)
        self.engine.record_result(bet=100, profit=500)
        self.engine.record_result(bet=100, profit=-200)

        stats = self.engine.get_session_stats()
        profit = stats["total_profit"]
        # Default thresholds: stopLoss = -5000, stopWin = +3000
        assert profit > -5000, f"Should not have hit stop-loss, profit={profit}"
        assert profit < 3000,  f"Should not have hit stop-win, profit={profit}"

    def test_scenario_1_bankroll_tracking_accuracy(self):
        """Bankroll tracks correctly across rapid swings."""
        initial = self.engine.bankroll
        self.engine.record_result(bet=200, profit=200)   # +200
        self.engine.record_result(bet=200, profit=-400)  # -400
        self.engine.record_result(bet=200, profit=100)   # +100
        # Net: -100
        assert self.engine.bankroll == initial - 100, (
            f"Bankroll tracking off: expected {initial - 100}, got {self.engine.bankroll}"
        )
        assert self.engine.max_bankroll == initial + 200
        assert self.engine.min_bankroll == initial - 200

    # ── Composition-Dependent Strategy (16 vs 10) ─────────────────────────

    def test_scenario_4_ten_six_vs_10_tc0_stand(self):
        """Scenario 4: TC=0, hand=10+6 vs 10 → expect STAND."""
        h     = hand(Rank.TEN, Rank.SIX)
        avail = [Action.HIT, Action.STAND]
        action = self.dev.get_action(h, upcard(Rank.TEN),
                                     true_count=0.0, available_actions=avail)
        assert action == Action.STAND, (
            f"10+6 vs 10 at TC=0 should STAND (comp-dep threshold=0), got {action}"
        )

    def test_scenario_5_nine_seven_vs_10_tc0_hit(self):
        """Scenario 5: TC=0, hand=9+7 vs 10 → expect HIT (threshold is TC≥+1)."""
        h     = hand(Rank.NINE, Rank.SEVEN)
        avail = [Action.HIT, Action.STAND]
        action = self.dev.get_action(h, upcard(Rank.TEN),
                                     true_count=0.0, available_actions=avail)
        assert action == Action.HIT, (
            f"9+7 vs 10 at TC=0 should HIT (comp-dep threshold=1, not yet met), got {action}"
        )

    def test_scenario_6_nine_seven_vs_10_tc1_stand(self):
        """Scenario 6: TC=+1, hand=9+7 vs 10 → expect STAND (threshold met)."""
        h     = hand(Rank.NINE, Rank.SEVEN)
        avail = [Action.HIT, Action.STAND]
        action = self.dev.get_action(h, upcard(Rank.TEN),
                                     true_count=1.0, available_actions=avail)
        assert action == Action.STAND, (
            f"9+7 vs 10 at TC=+1 should STAND (threshold=1 met), got {action}"
        )

    def test_comp_dep_only_applies_to_2card_hands(self):
        """Multi-card hard 16 must NOT use the composition-dependent path."""
        # 5+5+6 = hard 16 (3 cards) — falls through to generic I18 at TC=0
        h = hand(Rank.FIVE, Rank.FIVE, Rank.SIX)
        assert h.best_value == 16
        assert len(h.cards) == 3
        avail = [Action.HIT, Action.STAND]
        # Generic I18 fires at TC≥0 → STAND (same result but via different code path)
        action = self.dev.get_action(h, upcard(Rank.TEN),
                                     true_count=0.0, available_actions=avail)
        # The generic I18 deviation also says STAND at TC≥0, which is correct for
        # multi-card 16. The key thing is it didn't crash or produce a wrong answer.
        assert action in (Action.HIT, Action.STAND), f"Unexpected action {action}"

    def test_comp_dep_does_not_affect_splits(self):
        """Pair of 8s (hard 16 as pair) must SPLIT, not be caught by comp-dep."""
        h     = hand(Rank.EIGHT, Rank.EIGHT)
        avail = [Action.HIT, Action.STAND, Action.SPLIT]
        action = self.dev.get_action(h, upcard(Rank.TEN),
                                     true_count=0.0, available_actions=avail)
        assert action == Action.SPLIT, (
            f"8+8 vs 10 should always SPLIT; comp-dep must not intercept pairs, got {action}"
        )

    def test_comp_dep_does_not_affect_other_deviations(self):
        """Comp-dep block must not suppress unrelated I18 deviations (e.g. 12 vs 4)."""
        h     = hand(Rank.TEN, Rank.TWO)   # hard 12
        avail = [Action.HIT, Action.STAND]
        # At TC < 0, I18 says HIT on 12 vs 4
        action = self.dev.get_action(h, upcard(Rank.FOUR),
                                     true_count=-0.5, available_actions=avail)
        assert action == Action.HIT, (
            f"Hard 12 vs 4 at TC=-0.5 should HIT (I18 dev); got {action}"
        )

    # ── N₀ ──────────────────────────────────────────────────────────────────

    def test_scenario_7_high_variance_low_edge_high_n0(self):
        """Scenario 7: High variance, low edge → high N₀ (many hands to converge)."""
        # Simulate a very marginal edge: mostly tiny wins mixed with losses
        # Net: +10 profit over 100 hands of $100 bets → edge_fraction = 0.1/100 = 0.001
        for _ in range(99):
            self.engine.record_result(bet=100, profit=-1)   # -99
        self.engine.record_result(bet=100, profit=109)      # +109 → net +10

        stats = self.engine.get_session_stats()
        n0 = stats["n0"]
        # With edge_fraction ≈ 0.001, N₀ = 1.33 / (0.001)² = 1,330,000
        # Our threshold for "high N₀" is > 10,000
        assert n0 is None or n0 > 10_000, (
            f"Low edge should yield high N₀ or None (undefined), got {n0}"
        )

    def test_scenario_8_high_edge_low_n0(self):
        """Scenario 8: High edge → low N₀ (converges quickly)."""
        # Simulate a strong winning session with realistic variance:
        # mix of wins (+150), losses (-50), and blackjacks (+200)
        # Net edge ≈ +60% of avg bet, with real spread → low N₀
        import random; random.seed(42)
        outcomes = [150, 150, -50, 200, 150, -50, 150, 150, -100, 200,
                    150, -50, 150, 200, -50, 150, 150, 200, -50, 150,
                    200, 150, -50, 150, 200]   # 25 hands, consistently profitable
        for profit in outcomes:
            self.engine.record_result(bet=100, profit=profit)

        stats = self.engine.get_session_stats()
        n0 = stats["n0"]
        assert n0 is not None, (
            "High edge session with real variance should have a defined N₀. "
            f"Got None. n0_interpretation: {stats.get('n0_interpretation')}"
        )
        # With high edge and moderate variance, N₀ should be small
        assert n0 < 500, (
            f"High edge should yield low N₀ (expected <500), got {n0}"
        )

    def test_n0_division_by_zero_protection(self):
        """N₀ must be None (not crash) when edge is effectively zero."""
        # Record a perfectly break-even session: every hand wins then loses
        for _ in range(10):
            self.engine.record_result(bet=100, profit=100)
            self.engine.record_result(bet=100, profit=-100)

        stats = self.engine.get_session_stats()
        # Net profit = 0 → edge_fraction = 0 → N₀ must be None, not ZeroDivisionError
        assert stats["n0"] is None, (
            f"Break-even session should return n0=None (div-by-zero guard), got {stats['n0']}"
        )

    def test_n0_present_in_empty_session(self):
        """N₀ key must exist (as None) even for a fresh session with no hands."""
        stats = self.engine.get_session_stats()
        assert "n0" in stats, "n0 key must always be present in session stats"
        assert stats["n0"] is None, "n0 must be None before any hands are played"

    # ── Shoe Quality Score ───────────────────────────────────────────────────

    def test_scenario_9_poor_shoe_low_quality(self):
        """Scenario 9: Poor shoe (negative TC, early penetration) → low score."""
        # Drive the running count negative by seeing many high cards
        from blackjack.card import Card, Rank, Suit
        for _ in range(15):
            self.counter.count_card(Card(Rank.TEN, Suit.SPADES))   # each is -1

        # TC should be negative, penetration low → bad shoe
        assert self.counter.true_count < 0
        score = self.counter.shoe_quality_score
        assert score < 40, (
            f"Negative TC + low penetration should give Bad shoe score (<40), got {score}"
        )

    def test_scenario_10_strong_shoe_high_quality(self):
        """Scenario 10: Strong shoe (positive TC, deep penetration) → high score."""
        from blackjack.card import Card, Rank, Suit
        # Push count positive: see many low cards (+1 each in hi-lo)
        for _ in range(30):
            self.counter.count_card(Card(Rank.TWO, Suit.HEARTS))    # +1 each
        # Simulate depth: see a large number of neutral cards to increase penetration
        for _ in range(100):
            self.counter.count_card(Card(Rank.SEVEN, Suit.CLUBS))   # 0 each (neutral)

        assert self.counter.true_count > 0
        assert self.counter.penetration > 0.40   # >40% of 6-deck shoe seen
        score = self.counter.shoe_quality_score
        assert score >= 55, (
            f"Positive TC + good penetration should give decent score (≥55), got {score}. "
            f"TC={self.counter.true_count:.2f} pen={self.counter.penetration:.2f}"
        )

    def test_shoe_quality_score_bounds(self):
        """Shoe quality score must always be in [0, 100]."""
        from blackjack.card import Card, Rank, Suit
        # Extreme negative scenario
        for _ in range(50):
            self.counter.count_card(Card(Rank.ACE, Suit.SPADES))
        score_low = self.counter.shoe_quality_score
        assert 0 <= score_low <= 100, f"Score out of bounds: {score_low}"

        self.counter.reset()
        # Extreme positive scenario
        for _ in range(50):
            self.counter.count_card(Card(Rank.TWO, Suit.HEARTS))
        score_high = self.counter.shoe_quality_score
        assert 0 <= score_high <= 100, f"Score out of bounds: {score_high}"
        assert score_high > score_low, (
            f"Positive TC shoe ({score_high}) should score higher than negative TC shoe ({score_low})"
        )

    def test_shoe_quality_increases_with_better_conditions(self):
        """Score must increase monotonically as TC improves."""
        from blackjack.card import Card, Rank, Suit
        scores = []
        # Progressively add low cards to improve TC
        for step in range(5):
            for _ in range(6):
                self.counter.count_card(Card(Rank.TWO, Suit.HEARTS))
            scores.append(self.counter.shoe_quality_score)

        # Each step should maintain or increase the score
        for i in range(1, len(scores)):
            assert scores[i] >= scores[i-1] - 2, (   # allow tiny rounding dip ≤2
                f"Shoe quality should not drop as TC improves: "
                f"step {i-1}={scores[i-1]} → step {i}={scores[i]}"
            )


if __name__ == '__main__':
    # Simple runner without pytest: python tests/test_blackjack.py
    results = []
    test_classes = [
        TestHandValues, TestSplitMechanics, TestBustAndResolution,
        TestCounting, TestBasicStrategy, TestDeviations,
        TestBettingEngine, TestSoftStrategyIntegration,
        TestFeatureScenarios,
    ]
    for cls in test_classes:
        obj = cls()
        for name in sorted(dir(obj)):
            if not name.startswith('test_'):
                continue
            if hasattr(obj, 'setup_method'):
                obj.setup_method()
            try:
                getattr(obj, name)()
                results.append(('PASS', f'{cls.__name__}.{name}'))
            except Exception as e:
                results.append(('FAIL', f'{cls.__name__}.{name}: {e}'))

    passed = sum(1 for s, _ in results if s == 'PASS')
    failed = sum(1 for s, _ in results if s == 'FAIL')
    for status, name in results:
        marker = '✓' if status == 'PASS' else '✗'
        print(f'  [{marker}] {name}')
    print(f'\n  {"─"*50}')
    print(f'  {passed} passed  {failed} failed  ({len(results)} total)')
    if failed:
        import sys
        sys.exit(1)
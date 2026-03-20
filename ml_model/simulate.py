"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ml_model/simulate.py — Monte Carlo Simulation Engine                       ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  Simulates millions of blackjack hands at machine speed. Used for:          ║
║  1. Generating training data for the neural network                         ║
║  2. Validating strategy performance (measuring real house/player edge)      ║
║                                                                              ║
║  WHAT IS MONTE CARLO SIMULATION?                                             ║
║  ──────────────────────────────────                                          ║
║  Instead of doing complex math, you play millions of random hands and       ║
║  measure the actual outcomes. With enough hands, the result converges        ║
║  to the true mathematical expectation.                                       ║
║                                                                              ║
║  ACCURACY OF RESULTS (by number of simulated hands):                        ║
║    10,000 hands  → ±0.5% accuracy  (rough estimate, takes ~1 second)       ║
║    100,000 hands → ±0.15% accuracy (takes ~5-10 seconds)                   ║
║    1,000,000     → ±0.05% accuracy (takes ~30-60 seconds)                  ║
║                                                                              ║
║  WHAT run_validation() REPORTS:                                              ║
║    Test 1: Basic Strategy only (flat minimum bets)                          ║
║    Test 2: Basic Strategy + Card Counting (bet spread 1-12)                 ║
║    Test 3: Full System (counting + Illustrious 18 deviations)               ║
║    For each: total profit, win rate, player/house edge                       ║
║                                                                              ║
║  TYPICAL RESULTS (500k hands, 6 decks, H17, DAS, LS):                      ║
║    Basic Strategy:     edge ≈ -0.5%  (house wins ~0.5% of wagered amount)  ║
║    + Counting:         edge ≈ +0.2%  (player has slight edge!)             ║
║    + Full System:      edge ≈ +0.4%  (best achievable with counting)       ║
║                                                                              ║
║  HOW TO RUN:                                                                 ║
║    python main.py simulate --hands 100000                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import numpy as np
import random
from typing import Dict, List, Tuple, Optional
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from blackjack.card import Shoe, ShuffleType
from blackjack.game import Hand, Round, BlackjackTable, Action, HandResult
from blackjack.counting import CardCounter
from blackjack.strategy import BasicStrategy
from blackjack.deviations import DeviationEngine
from blackjack.betting import BettingEngine
from config import GameConfig, MLConfig, BettingConfig


class Simulator:
    """
    Monte Carlo blackjack simulator for ML training and strategy validation.
    """

    def __init__(self, config: GameConfig = None):
        self.config = config or GameConfig()
        self.table = BlackjackTable(self.config)
        self.counter = CardCounter("hi_lo", self.config.NUM_DECKS)
        self.strategy = BasicStrategy(self.config)
        self.deviation_engine = DeviationEngine(self.strategy)
        self.betting_engine = BettingEngine()

    def simulate_hands(self, num_hands: int = 100000, use_counting: bool = True,
                       use_deviations: bool = True,
                       verbose: bool = False) -> Dict:
        """
        Simulate many hands and collect statistics.

        Returns training data and performance metrics.
        """
        training_data = []
        results = {
            "hands": 0,
            "wins": 0,
            "losses": 0,
            "pushes": 0,
            "blackjacks": 0,
            "surrenders": 0,
            "total_wagered": 0.0,
            "total_profit": 0.0,
            "max_profit": float("-inf"),
            "min_profit": float("inf"),
            "profit_history": [],
        }

        cumulative_profit = 0.0

        for hand_num in range(num_hands):
            # If the cut card has been reached, reshuffle before starting the hand
            if self.table.shoe.needs_shuffle:
                self.table.shoe.reshuffle()
                self.counter.reset()

            # Bet sizing: use counting engine when counting is enabled,
            # otherwise flat minimum bet (for the basic-strategy-only baseline)
            if use_counting:
                bet = self.betting_engine.get_optimal_bet(self.counter.true_count)
            else:
                bet = BettingConfig.TABLE_MIN

            results["total_wagered"] += bet

            # Start round
            round = self.table.start_round(bet)
            dealt_cards, dealer_upcard = round.deal_initial()

            # Count dealt cards: in a real casino you see both player cards and
            # the dealer's face-up card immediately. The dealer's hole card
            # is only revealed and counted AFTER the player finishes playing.
            for card in dealt_cards[:3]:  # Player's 2 + dealer upcard
                self.counter.count_card(card)

            # Play each hand
            for hand_idx in range(len(round.player_hands)):
                hand = round.player_hands[hand_idx]

                # FIX: was `hand.best_value < 21` which silently skipped all
                # blackjack hands and any hand hit to exactly 21, leaving
                # training_data empty. Now we only skip natural blackjacks
                # (no player decision exists for them).
                while not hand.is_bust and not hand.is_blackjack:
                    # num_splits_done = (total hands - 1) because each split creates one more hand
                    # This is critical: hand_idx (loop counter) ≠ splits done
                    num_splits_done = len(round.player_hands) - 1
                    available = hand.available_actions(self.config, num_splits_done)

                    # Collect features for training
                    state = self._extract_state(
                        hand, dealer_upcard, num_splits_done,
                        num_hands=len(round.player_hands),
                    )

                    # Get action
                    if use_deviations:
                        action = self.deviation_engine.get_action(
                            hand, dealer_upcard, self.counter.true_count,
                            available, num_splits_done)
                    else:
                        action = self.strategy.get_action(
                            hand, dealer_upcard, available, num_splits_done)

                    # Record training data BEFORE executing the action
                    training_data.append({
                        "state": state,
                        "action": action.value,
                        "hand_value": hand.best_value,
                    })

                    # Execute action
                    if action == Action.HIT:
                        card = round.player_hit(hand_idx)
                        self.counter.count_card(card)
                        # FIX: if we just hit to 21, no further actions are
                        # possible — break explicitly to avoid infinite loop.
                        if hand.best_value == 21:
                            break

                    elif action == Action.DOUBLE:
                        card = round.player_double(hand_idx)
                        self.counter.count_card(card)
                        break

                    elif action == Action.SPLIT:
                        card1, card2 = round.player_split(hand_idx)
                        self.counter.count_card(card1)
                        self.counter.count_card(card2)
                        break  # Will handle new hands in outer loop

                    elif action == Action.SURRENDER:
                        round.player_surrender(hand_idx)
                        break

                    elif action == Action.STAND:
                        break

            # Dealer plays
            any_active = any(
                not h.is_bust and not h.is_surrendered and not h.is_blackjack
                for h in round.player_hands
            )
            if any_active:
                dealer_cards = round.play_dealer(self.config.DEALER_HITS_SOFT_17)
                for card in dealer_cards:
                    self.counter.count_card(card)

            # Count dealer hole card
            if round.dealer_hole_card:
                self.counter.count_card(round.dealer_hole_card)

            # Resolve
            profit = round.resolve(self.config)
            self.table.finish_round()
            self.betting_engine.record_result(bet, profit)

            cumulative_profit += profit
            results["total_profit"] = cumulative_profit
            results["hands"] += 1
            results["max_profit"] = max(results["max_profit"], cumulative_profit)
            results["min_profit"] = min(results["min_profit"], cumulative_profit)

            for hand in round.player_hands:
                if hand.result == HandResult.WIN:
                    results["wins"] += 1
                elif hand.result == HandResult.LOSS:
                    results["losses"] += 1
                elif hand.result == HandResult.PUSH:
                    results["pushes"] += 1
                elif hand.result == HandResult.BLACKJACK:
                    results["blackjacks"] += 1
                elif hand.result == HandResult.SURRENDER:
                    results["surrenders"] += 1

            if hand_num % 10000 == 0:
                results["profit_history"].append({
                    "hand": hand_num,
                    "profit": cumulative_profit,
                    "true_count": self.counter.true_count,
                })

            if verbose and hand_num % 50000 == 0 and hand_num > 0:
                edge = (cumulative_profit / results["total_wagered"]) * 100
                print(f"  Hand {hand_num:>8,}: Profit=${cumulative_profit:>10,.2f} "
                      f"Edge={edge:.3f}%")

        # Final stats
        total_decisions = results["wins"] + results["losses"] + results["pushes"] + results["blackjacks"] + results["surrenders"]
        results["win_rate"] = results["wins"] / max(total_decisions, 1)
        results["house_edge"] = -(results["total_profit"] / max(results["total_wagered"], 1)) * 100
        results["player_edge"] = -results["house_edge"]

        return {
            "results": results,
            "training_data": training_data,
            "session_stats": self.betting_engine.get_session_stats(),
        }

    def _extract_state(self, hand: Hand, dealer_upcard, hand_idx: int,
                       num_hands: int = 1) -> List[float]:
        """Extract state features for ML training.

        Returns a 28-element feature vector matching BlackjackNet's input_dim.
        Feature layout matches the order documented in model.py / BlackjackNet.
        """
        remaining = self.counter.get_remaining_estimate()
        return [
            hand.best_value / 21.0,                                      # [0]
            float(hand.is_soft),                                          # [1]
            float(hand.is_pair),                                          # [2]
            (hand.cards[0].count_key / 11.0) if hand.is_pair else 0.0,  # [3]
            dealer_upcard.count_key / 11.0,                              # [4]
            self.counter.true_count / 10.0,                              # [5]
            0.0,  # shuffle adjustment (filled during actual play)        # [6]
            self.counter.penetration,                                     # [7]
        ] + [remaining.get(i, 0.0) for i in range(2, 12)] + [           # [8-17]
            len(hand.cards) / 10.0,                                      # [18]
            float(hand.can_double),                                      # [19]
            float(hand.can_split),                                       # [20]
            float(hand.available_actions(self.config, hand_idx).__contains__(
                __import__('blackjack.game', fromlist=['Action']).Action.SURRENDER
            )),                                                           # [21] can_surrender
            float(num_hands) / 4.0,                                     # [22] active split hands
            min(self.betting_engine.bankroll / self.betting_engine.config.INITIAL_BANKROLL, 2.0),  # [23] bankroll ratio (capped at 2x)
            self.counter.advantage,                                      # [24]
            self.counter.running_count / 20.0,                          # [25]
            self.counter.decks_remaining / 8.0,                         # [26]
            float(hand.is_split),                                        # [27] is this a post-split hand
        ]

    def run_validation(self, num_hands: int = 100000) -> Dict:
        """Run validation comparing basic strategy vs counting vs deviations."""
        print("=" * 60)
        print("BLACKJACK STRATEGY VALIDATION")
        print("=" * 60)

        # Reset
        self.counter.reset()
        self.betting_engine = BettingEngine()
        self.table = BlackjackTable(self.config)

        # Test 1: Basic strategy only (flat bet)
        print("\n> Testing: Basic Strategy (flat bet)...")
        self.counter.reset()
        self.betting_engine = BettingEngine()
        self.table = BlackjackTable(self.config)
        basic_results = self.simulate_hands(num_hands, use_counting=False, use_deviations=False, verbose=True)

        # Test 2: With counting + bet spread
        print("\n> Testing: Basic Strategy + Card Counting...")
        self.counter.reset()
        self.betting_engine = BettingEngine()
        self.table = BlackjackTable(self.config)
        counting_results = self.simulate_hands(num_hands, use_counting=True, use_deviations=False, verbose=True)

        # Test 3: Full system
        print("\n> Testing: Full System (Counting + Deviations)...")
        self.counter.reset()
        self.betting_engine = BettingEngine()
        self.table = BlackjackTable(self.config)
        full_results = self.simulate_hands(num_hands, use_counting=True, use_deviations=True, verbose=True)

        print("\n" + "=" * 60)
        print("RESULTS COMPARISON")
        print("=" * 60)

        for name, data in [("Basic Strategy", basic_results),
                           ("w/ Counting", counting_results),
                           ("Full System", full_results)]:
            r = data["results"]
            print(f"\n  {name}:")
            print(f"    Profit:     ${r['total_profit']:>10,.2f}")
            print(f"    Win Rate:   {r['win_rate']*100:.1f}%")
            print(f"    Player Edge: {r['player_edge']:.3f}%")
            print(f"    Wagered:    ${r['total_wagered']:>10,.2f}")

        return {
            "basic": basic_results,
            "counting": counting_results,
            "full": full_results,
        }
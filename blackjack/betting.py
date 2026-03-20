"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  blackjack/betting.py — Bet Sizing Engine                                   ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  Calculates the mathematically optimal bet for each hand based on:          ║
║  • The current True Count (count-based bet spread)                          ║
║  • Your remaining bankroll (Kelly Criterion)                                ║
║  It also tracks session results, bankroll changes, and risk of ruin.       ║
║                                                                              ║
║  TWO BET SIZING METHODS (system uses the more conservative of the two):     ║
║  ────────────────────────────────────────────────────────────────────────   ║
║  1. COUNT-BASED SPREAD                                                       ║
║     TC ≤ 0  →  1 unit  (minimum — count is unfavourable)                   ║
║     TC = 1  →  2 units                                                       ║
║     TC = 2  →  4 units                                                       ║
║     TC = 3  →  8 units                                                       ║
║     TC = 4  →  12 units                                                      ║
║     TC ≥ 5  →  16 units (maximum spread)                                    ║
║                                                                              ║
║  2. KELLY CRITERION                                                          ║
║     Optimal fraction = edge / odds variance                                 ║
║     We use THREE-QUARTER Kelly (0.75) — better growth than half Kelly      ║
║     while keeping variance manageable.                                      ║
║                                                                              ║
║  HOW TO USE:                                                                 ║
║    engine = BettingEngine()                                                  ║
║    bet = engine.get_optimal_bet(true_count=3.5)   # → $80 (8 units)        ║
║    engine.record_result(bet=80, profit=80)         # won the hand          ║
║    stats = engine.get_session_stats()              # session summary        ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import math
from typing import Dict, Optional
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import BettingConfig, CountingConfig


class BettingEngine:
    """
    Advanced betting strategy engine combining count-based spreading
    with Kelly Criterion and bankroll management.
    """

    def __init__(self, config: BettingConfig = None):
        self.config = config or BettingConfig()
        self.bankroll = self.config.INITIAL_BANKROLL
        self.session_profit = 0.0
        self.max_bankroll = self.bankroll
        self.min_bankroll = self.bankroll
        self.bet_history = []
        self.hands_played = 0

    def get_optimal_bet(self, true_count: float, advantage: float = None, penetration: float = 0.75) -> float:
        """
        Calculate the optimal bet based on true count and advantage.

        Uses a combination of:
        1. Count-based bet spread (primary)
        2. Kelly Criterion (secondary, for sizing validation)
        """
        if advantage is None:
            # House edge 0.50% with perfect basic strategy (8-deck S17, RTP 99.50%)
            # Each +1 true count = +0.5% player advantage
            advantage = -0.005 + (true_count * 0.005)

        # Calculate spread-based bet
        spread_bet = self._spread_bet(true_count)

        # Calculate Kelly-based bet
        kelly_bet = self._kelly_bet(advantage)

        # At strong positive counts take the higher of the two for max profit.
        # At neutral/negative counts stay at minimum to preserve bankroll.
        if advantage > 0 and true_count >= 3:
            optimal = max(spread_bet, kelly_bet)
        elif advantage > 0:
            optimal = (spread_bet + kelly_bet) / 2
        else:
            optimal = spread_bet

        # Penetration multiplier — the deeper into the shoe, the more reliable
        # the true count, so scale bets up confidently at high penetration.
        # Below 50% penetration: scale down (count unreliable)
        # 50-70% penetration: neutral
        # Above 70% penetration: scale up (count very reliable)
        if true_count > 0:
            if penetration >= 0.85:
                optimal *= 1.25
            elif penetration >= 0.70:
                optimal *= 1.10
            elif penetration < 0.50:
                optimal *= 0.75

        # Clamp to table limits
        optimal = max(self.config.TABLE_MIN, min(optimal, self.config.TABLE_MAX))

        # Don't bet more than we can afford
        optimal = min(optimal, self.bankroll)

        return round(optimal / self.config.BASE_UNIT) * self.config.BASE_UNIT or self.config.TABLE_MIN

    def _spread_bet(self, true_count: float) -> float:
        """
        Bet spread based on true count.

        TC <= 0: 1 unit (minimum)
        TC = 1: 2 units
        TC = 2: 4 units
        TC = 3: 8 units
        TC = 4: 12 units
        TC >= 5: max spread (16 units)
        """
        if true_count <= 0:
            return self.config.BASE_UNIT

        # Aggressive ramp: steeper increase at TC 3+ where edge is meaningful
        if true_count >= 5:
            units = self.config.BET_SPREAD
        elif true_count >= 4:
            units = 12
        elif true_count >= 3:
            units = 8
        elif true_count >= 2:
            units = 4
        else:
            units = 2

        return units * self.config.BASE_UNIT

    def _kelly_bet(self, advantage: float) -> float:
        """
        Kelly Criterion optimal bet sizing.

        Full Kelly: f* = advantage / odds
        We use fractional Kelly (default 75%) for safety.
        """
        if advantage <= 0:
            return self.config.TABLE_MIN

        # For even-money bets: f = edge / 1 = edge
        kelly_fraction = advantage * self.config.KELLY_FRACTION
        optimal = self.bankroll * kelly_fraction

        return max(optimal, self.config.TABLE_MIN)

    def should_wong_in(self, true_count: float) -> bool:
        """Should we enter the table (back-counting)?"""
        return true_count >= CountingConfig.WONGING_ENTER_TC

    def should_wong_out(self, true_count: float) -> bool:
        """Should we leave the table?"""
        return true_count < CountingConfig.WONGING_EXIT_TC

    def record_result(self, bet: float, profit: float):
        """Record a hand result for tracking."""
        self.bankroll += profit
        self.session_profit += profit
        self.max_bankroll = max(self.max_bankroll, self.bankroll)
        self.min_bankroll = min(self.min_bankroll, self.bankroll)
        self.hands_played += 1
        self.bet_history.append({
            "hand": self.hands_played,
            "bet": bet,
            "profit": profit,
            "bankroll": self.bankroll,
        })

    def risk_of_ruin(self) -> float:
        """
        Estimate risk of ruin using the formula:
        RoR = ((1 - edge) / (1 + edge)) ^ (bankroll / unit)

        For card counting with ~1% edge and $10 unit, with $10000 bankroll:
        RoR ≈ (0.99/1.01)^1000 ≈ very low
        """
        avg_edge = 0.005  # Average edge when spreading (0.5% base + counting premium)
        if avg_edge <= 0:
            return 1.0

        ratio = (1 - avg_edge) / (1 + avg_edge)
        units = self.bankroll / self.config.BASE_UNIT

        if ratio >= 1 or units <= 0:
            return 1.0

        return max(0, min(1, ratio ** units))

    def get_session_stats(self) -> Dict:
        """Get session statistics."""
        if not self.bet_history:
            return {"hands": 0, "profit": 0, "avg_bet": 0}

        bets = [h["bet"] for h in self.bet_history]
        profits = [h["profit"] for h in self.bet_history]

        wins = sum(1 for p in profits if p > 0)
        losses = sum(1 for p in profits if p < 0)
        pushes = sum(1 for p in profits if p == 0)

        return {
            "hands_played": self.hands_played,
            "total_profit": self.session_profit,
            "bankroll": self.bankroll,
            "max_bankroll": self.max_bankroll,
            "min_bankroll": self.min_bankroll,
            "avg_bet": sum(bets) / len(bets),
            "max_bet": max(bets),
            "win_rate": wins / len(profits) if profits else 0,
            "wins": wins,
            "losses": losses,
            "pushes": pushes,
            "risk_of_ruin": self.risk_of_ruin(),
            "hourly_rate": (self.session_profit / max(self.hands_played, 1)) * 80,  # ~80 hands/hr
        }

    def get_bet_recommendation(self, true_count: float, penetration: float = 0.75) -> Dict:
        """Get a full bet recommendation with reasoning."""
        # 8-deck S17 base house edge = 0.43%
        # Each +1 true count = +0.5% player advantage
        advantage = -0.0043 + (true_count * 0.005)
        optimal = self.get_optimal_bet(true_count, advantage, penetration)

        return {
            "recommended_bet":  optimal,
            "true_count":       round(true_count, 2),
            "penetration":      round(penetration * 100, 1),
            "player_advantage": round(advantage * 100, 2),
            "kelly_bet":        round(self._kelly_bet(advantage), 2),
            "spread_bet":       round(self._spread_bet(true_count), 2),
            "units":            optimal / self.config.BASE_UNIT,
            "wong_in":          self.should_wong_in(true_count),
            "wong_out":         self.should_wong_out(true_count),
            "bankroll":         self.bankroll,
            "risk_of_ruin":     round(self.risk_of_ruin() * 100, 2),
            "action":           self._bet_action_text(true_count, advantage),
        }

    def _bet_action_text(self, tc: float, advantage: float) -> str:
        """Human-readable bet action."""
        if self.should_wong_out(tc):
            return "🚫 WONG OUT — Leave the table"
        if tc <= 0:
            return "⬇️ MINIMUM BET — Count is negative/neutral"
        if tc >= 5:
            return "🔥 MAXIMUM BET — Very favorable count!"
        if tc >= 3:
            return "⬆️ BIG BET — Strong positive count"
        if tc >= 1:
            return "📈 INCREASE BET — Slight advantage"
        return "➡️ TABLE MINIMUM"
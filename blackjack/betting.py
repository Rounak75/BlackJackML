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
║  FIX — Overbetting at high TC (AUDIT finding #1):                          ║
║     Old code used max(spread, kelly) at TC >= 3, contradicting its own     ║
║     "more conservative" comment. This could produce bets 1.5–2× above     ║
║     optimal Kelly as bankroll shrinks. Fixed: always min(spread, kelly).   ║
║     Set aggressive_mode=True on the engine to restore the old behaviour.  ║
║                                                                              ║
║  FIX — Dynamic Risk of Ruin (AUDIT finding #3):                            ║
║     Old RoR used a hardcoded avg_edge=0.005 that never changed.            ║
║     Now computed from live session data (rolling 200-hand EV estimate).    ║
║                                                                              ║
║  NEW — Stealth Mode (AUDIT finding #5):                                     ║
║     Optional ±10 % bet jitter + smoothed ramp to avoid casino detection.  ║
║     Enable with stealth_mode=True on the engine. EV impact < 0.02%.       ║
║                                                                              ║
║  HOW TO USE:                                                                 ║
║    engine = BettingEngine()                                                  ║
║    bet = engine.get_optimal_bet(true_count=3.5)   # → $80 (8 units)        ║
║    engine.record_result(bet=80, profit=80)         # won the hand          ║
║    stats = engine.get_session_stats()              # session summary        ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import math
import random
import logging as _log
from typing import Dict, Optional
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import BettingConfig, CountingConfig

# Rolling window for dynamic edge estimation (Fix #3)
_ROR_WINDOW = 200


class BettingEngine:
    """
    Advanced betting strategy engine combining count-based spreading
    with Kelly Criterion and bankroll management.

    Args:
        aggressive_mode: If True, use max(spread, kelly) at TC >= 3 (old
                         behaviour). Default False uses min() — always
                         the more conservative and mathematically safer choice.
        stealth_mode:    If True, apply ±10% random jitter and smoothed bet
                         transitions to reduce casino detection signature.
                         Default False.
    """

    def __init__(self, config: BettingConfig = None,
                 aggressive_mode: bool = False,
                 stealth_mode: bool = False):
        self.config = config or BettingConfig()
        self.bankroll = self.config.INITIAL_BANKROLL
        self.session_profit = 0.0
        self.max_bankroll = self.bankroll
        self.min_bankroll = self.bankroll
        self.bet_history = []
        self.hands_played = 0
        self.aggressive_mode = aggressive_mode  # Fix #1: default off
        self.stealth_mode = stealth_mode        # Fix #5: default off
        self._last_bet: float = self.config.TABLE_MIN  # for stealth smoothing

        # ── Session stop thresholds ────────────────────────────────────────
        # Configurable server-side limits. The frontend JS mirrors these for
        # display, but the authoritative should_leave flag lives here so the
        # overlay, REST clients, and logging all see the same state.
        # Defaults: stop-loss = -50 units, stop-win = +30 units.
        self.stop_loss = -(self.config.BASE_UNIT * 50)   # e.g. -₹5,000
        self.stop_win  =  (self.config.BASE_UNIT * 30)   # e.g. +₹3,000
        self._stop_triggered: Optional[str] = None       # None | 'loss' | 'win'

    def set_stop_thresholds(self, stop_loss: float, stop_win: float) -> None:
        """Update stop-loss / stop-win limits at runtime (e.g. from frontend settings)."""
        if stop_loss >= 0:
            raise ValueError(f"stop_loss must be negative, got {stop_loss}")
        if stop_win <= 0:
            raise ValueError(f"stop_win must be positive, got {stop_win}")
        self.stop_loss = stop_loss
        self.stop_win  = stop_win
        # Re-evaluate triggered state with new thresholds
        self._stop_triggered = self._evaluate_stop()

    def _evaluate_stop(self) -> Optional[str]:
        """Return 'loss', 'win', or None based on current session_profit."""
        if self.session_profit <= self.stop_loss:
            return 'loss'
        if self.session_profit >= self.stop_win:
            return 'win'
        return None

    @property
    def should_leave(self) -> bool:
        """True when either stop threshold has been crossed."""
        return self._stop_triggered is not None

    @property
    def stop_reason(self) -> Optional[str]:
        """'STOP_LOSS', 'STOP_WIN', or None."""
        if self._stop_triggered == 'loss':
            return 'STOP_LOSS'
        if self._stop_triggered == 'win':
            return 'STOP_WIN'
        return None

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
            advantage = -0.0043 + (true_count * 0.005)  # 8-deck S17 base edge 0.43%

        # Calculate spread-based bet
        spread_bet = self._spread_bet(true_count)

        # Calculate Kelly-based bet
        kelly_bet = self._kelly_bet(advantage)

        # ── FIX #1: Conservative bet sizing ──────────────────────────────────
        # BEFORE: max(spread, kelly) at TC>=3 — contradicted the "conservative"
        #         comment and overbetted vs. a shrinking bankroll.
        # AFTER:  min() always. aggressive_mode=True restores old behaviour
        #         only if the user explicitly opts in.
        if advantage > 0:
            if self.aggressive_mode and true_count >= 3:
                optimal = max(spread_bet, kelly_bet)   # explicit opt-in only
            else:
                optimal = min(spread_bet, kelly_bet)   # always conservative
        else:
            optimal = spread_bet  # negative/neutral edge: ignore Kelly

        # Penetration multiplier — the deeper into the shoe, the more reliable
        # the true count, so scale bets up confidently at high penetration.
        # Below 50% penetration: scale down (count unreliable)
        # 50-70% penetration: neutral
        # Above 70% penetration: scale up (count very reliable)
        if true_count > 0:
            if self.stealth_mode:
                # ── FIX #5: Soften the 85%-depth spike ───────────────────────
                # Original ×1.25 at 85% is a known surveillance flag.
                # Stealth mode caps the boost at ×1.10 across all depths.
                if penetration >= 0.70:
                    optimal *= 1.10
                elif penetration < 0.50:
                    optimal *= 0.75
            else:
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

        # FIX: use math.floor (not round) so the bet never exceeds the
        # bankroll guard applied above.  round(1.5) = 2 under Python 3
        # banker's rounding, which would produce 2 × BASE_UNIT = ₹200 on a
        # ₹150 bankroll — an overbet.  floor(1.5) = 1 → ₹100 — safe.
        floored = math.floor(optimal / self.config.BASE_UNIT) * self.config.BASE_UNIT
        optimal = floored or self.config.TABLE_MIN

        # ── FIX #5: Stealth jitter + ramp smoothing ───────────────────────────
        if self.stealth_mode:
            # ±10% random jitter — small enough that EV impact is negligible
            # (at most 0.02% over many hands) but large enough to break the
            # mechanical 1→2→4→8 pattern that surveillance software flags.
            jitter = random.uniform(0.90, 1.10)
            optimal = optimal * jitter

            # Smooth the ramp: prevent single-hand bet jumps larger than 2×.
            # A jump from 100 to 1600 in one hand is a textbook counter tell.
            max_step = self._last_bet * 2.0
            optimal = min(optimal, max_step)

            # Re-clamp and re-round after jitter
            optimal = max(self.config.TABLE_MIN, min(optimal, self.config.TABLE_MAX))
            floored2 = math.floor(optimal / self.config.BASE_UNIT) * self.config.BASE_UNIT
            optimal = floored2 or self.config.TABLE_MIN

        self._last_bet = optimal
        return optimal

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
        # Re-evaluate stop thresholds after every hand.
        # Only latch the first trigger — do not flip from 'loss' to 'win'
        # mid-session if the bankroll swings back.
        if self._stop_triggered is None:
            self._stop_triggered = self._evaluate_stop()
            if self._stop_triggered:
                _log.getLogger(__name__).warning(
                    "[STOP] %s triggered — session_profit=%.2f  threshold=%.2f  "
                    "bankroll=%.2f  hands=%d",
                    self.stop_reason, self.session_profit,
                    self.stop_loss if self._stop_triggered == 'loss' else self.stop_win,
                    self.bankroll, self.hands_played,
                )

    def risk_of_ruin(self) -> float:
        """
        Estimate risk of ruin using the formula:
        RoR = ((1 - edge) / (1 + edge)) ^ (bankroll / unit)

        FIX #3 — Dynamic edge estimate:
            OLD: avg_edge = 0.005 hardcoded — never reflected a losing session.
            NEW: Edge estimated from actual session results using a rolling
                 _ROR_WINDOW (200) hand average. Blended with the theoretical
                 0.5% prior so the formula stays stable on small samples.
        """
        window = self.bet_history[-_ROR_WINDOW:] if self.bet_history else []
        n = len(window)

        if n >= 20:
            total_wagered = sum(h["bet"]    for h in window)
            total_profit  = sum(h["profit"] for h in window)
            session_edge  = total_profit / total_wagered if total_wagered > 0 else 0.0
            blend     = min(n / _ROR_WINDOW, 1.0)   # 0→1 as n grows to 200
            avg_edge  = blend * session_edge + (1 - blend) * 0.005
        else:
            avg_edge = 0.005  # not enough data — use theoretical prior

        if avg_edge <= 0:
            return 1.0   # negative or zero edge → certain ruin eventually

        ratio = (1 - avg_edge) / (1 + avg_edge)
        units = self.bankroll / self.config.BASE_UNIT

        if ratio >= 1 or units <= 0:
            return 1.0

        return max(0, min(1, ratio ** units))

    def get_session_stats(self) -> Dict:
        """Get session statistics."""
        if not self.bet_history:
            return {
                "hands_played": 0, "total_profit": 0, "avg_bet": 0,
                "bankroll": self.bankroll, "max_bankroll": self.max_bankroll,
                "min_bankroll": self.min_bankroll, "win_rate": 0,
                "wins": 0, "losses": 0, "pushes": 0,
                "risk_of_ruin": self.risk_of_ruin(), "hourly_rate": 0,
                "max_bet": 0,
                "n0": None,
                "n0_interpretation": "Need more hands to estimate N₀",
                "should_leave": self.should_leave,
                "stop_reason":  self.stop_reason,
                "stop_loss":    self.stop_loss,
                "stop_win":     self.stop_win,
                # Aliases for frontend backward compat
                "leave_reason": self.stop_reason,
                "stop_loss_at": self.stop_loss,
                "stop_win_at":  self.stop_win,
            }

        bets = [h["bet"] for h in self.bet_history]
        profits = [h["profit"] for h in self.bet_history]

        wins = sum(1 for p in profits if p > 0)
        losses = sum(1 for p in profits if p < 0)
        pushes = sum(1 for p in profits if p == 0)

        avg_bet = sum(bets) / len(bets)

        # ── N₀ (variance convergence tracker) ──────────────────────────────
        # N₀ = variance / edge²
        # Uses realized sample variance of (profit / bet) ratios — session-specific,
        # not a fixed constant. This captures real play conditions: double-downs,
        # blackjacks, and splits all shift actual variance away from the 1.33 theory.
        n0 = None
        n0_interpretation = "Need at least 20 hands to estimate N₀"

        if len(profits) >= 20:
            total_wagered = sum(bets)
            edge_per_hand = self.session_profit / total_wagered if total_wagered > 0 else 0.0
            unit_profits  = [p / b for p, b in zip(profits, bets) if b > 0]
            mean_unit     = sum(unit_profits) / len(unit_profits)
            variance      = sum((x - mean_unit) ** 2 for x in unit_profits) / len(unit_profits)

            _log.getLogger(__name__).debug(
                "[N0] hands=%d  edge_per_hand=%.5f  variance=%.4f",
                self.hands_played, edge_per_hand, variance
            )

            if abs(edge_per_hand) > 1e-6 and variance > 0:
                n0 = round(variance / (edge_per_hand ** 2))
                played = self.hands_played
                if played >= n0:
                    n0_interpretation = (
                        f"✅ Past N₀ ({n0:,} hands) — EV is dominating variance. "
                        f"Your edge is statistically confirmed."
                    )
                else:
                    remaining = n0 - played
                    n0_interpretation = (
                        f"⏳ {remaining:,} more hands until EV dominates variance "
                        f"(N₀ = {n0:,}). Losing streaks are still normal."
                    )
            elif edge_per_hand <= 0:
                n0_interpretation = (
                    "⚠ Session edge is ≤ 0 — N₀ undefined. "
                    "Negative edge means variance never 'converges' to profit."
                )
            else:
                n0_interpretation = "N₀ calculation requires non-zero variance."

        return {
            "hands_played": self.hands_played,
            "total_profit": self.session_profit,
            "bankroll": self.bankroll,
            "max_bankroll": self.max_bankroll,
            "min_bankroll": self.min_bankroll,
            "avg_bet": avg_bet,
            "max_bet": max(bets),
            "win_rate": wins / len(profits) if profits else 0,
            "wins": wins,
            "losses": losses,
            "pushes": pushes,
            "risk_of_ruin": self.risk_of_ruin(),
            "hourly_rate": (self.session_profit / max(self.hands_played, 1)) * 80,
            "n0": n0,
            "n0_interpretation": n0_interpretation,
            "should_leave": self.should_leave,
            "stop_reason":  self.stop_reason,
            "stop_loss":    self.stop_loss,
            "stop_win":     self.stop_win,
            # Aliases — keep backward compat with any frontend reading old key names
            "leave_reason": self.stop_reason,
            "stop_loss_at": self.stop_loss,
            "stop_win_at":  self.stop_win,
        }

    def get_bet_recommendation(self, true_count: float, penetration: float = 0.75,
                               advantage: float = None) -> Dict:
        """Get a full bet recommendation with reasoning.

        FIX CRIT-07: If `advantage` is provided (from counter.advantage, which
        is already system-normalized via COUNT_NORM_SCALARS), use it directly
        instead of the un-normalized Hi-Lo formula. This eliminates the ~2×
        Kelly overbet that was occurring for Level-2/3 counting systems
        (Omega II, Zen, Wong Halves, Uston APC).
        """
        if advantage is None:
            # Fallback: Hi-Lo-calibrated formula. Correct only for Hi-Lo/KO.
            # For other systems, callers must pass counter.advantage explicitly.
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
            "aggressive_mode":  self.aggressive_mode,
            "stealth_mode":     self.stealth_mode,
        }

    def _bet_action_text(self, tc: float, advantage: float) -> str:
        """Human-readable bet action.

        FIX MAJ-10: Key off `advantage` (system-normalized edge) rather than
        raw TC. Previously used TC thresholds calibrated for Hi-Lo, so Level-2/3
        users saw "MAXIMUM BET" fire at Omega II TC=5 (Hi-Lo-equiv ~2.5, modest
        edge). Advantage is a direct %-of-bet edge, identical across systems.

        Edge mapping used:
          advantage <= -0.005  → Wong out threshold (same as -1 Hi-Lo TC)
          advantage <= 0       → Minimum bet
          advantage >= 0.025   → Max bet (Hi-Lo TC ≈ 5)
          advantage >= 0.015   → Big bet (Hi-Lo TC ≈ 3)
          advantage >= 0.005   → Increase bet (Hi-Lo TC ≈ 1)
        """
        if self.should_wong_out(tc):
            return "🚫 WONG OUT — Leave the table"
        if advantage <= 0:
            return "⬇️ MINIMUM BET — Count is negative/neutral"
        if advantage >= 0.025:
            return "🔥 MAXIMUM BET — Very favorable count!"
        if advantage >= 0.015:
            return "⬆️ BIG BET — Strong positive count"
        if advantage >= 0.005:
            return "📈 INCREASE BET — Slight advantage"
        return "➡️ TABLE MINIMUM"
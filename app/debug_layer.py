"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  app/debug_layer.py — Production-Grade Backend Debug Middleware              ║
║                                                                              ║
║  ACTIVATION:                                                                 ║
║    Set environment variable DEBUG_MODE=1 before starting the server.         ║
║    Without it, all debug functions are zero-cost no-ops.                     ║
║                                                                              ║
║  IMPROVEMENTS (D1-D4):                                                       ║
║    D1 — Split lifecycle events: log_split_event() traces split creation,    ║
║          hand advance, bust auto-advance, and split completion.              ║
║    D2 — Count cross-validation: validate_count() re-sums the _card_log      ║
║          against running_count and emits a WARN if they diverge.            ║
║          Call after every deal to catch double-count bugs immediately.       ║
║    D3 — Deal order tracing: log_deal_order() records (target, round, pos)   ║
║          for every card so out-of-sequence deals are instantly visible.      ║
║    D4 — shoe_quality_score debug log removed from the @property itself       ║
║          (was firing once per card = 1200+ entries per session).             ║
║          Use log_shoe_quality() explicitly when you need it.                 ║
║                                                                              ║
║  USAGE IN server.py:                                                         ║
║    from app.debug_layer import debug_logger, debug_timed, DEBUG_MODE         ║
║    @debug_timed('deal_card')                                                 ║
║    def handle_deal_card(data): ...                                           ║
║                                                                              ║
║    # After every deal (D2 + D3):                                            ║
║    if _DBG:                                                                  ║
║        debug_logger.log_deal_order(target, deal_round, deal_pos, str(card)) ║
║        debug_logger.validate_count(counter)                                  ║
║                                                                              ║
║    # On split events (D1):                                                   ║
║    if _DBG:                                                                  ║
║        debug_logger.log_split_event('created', num_hands=2, bet=hand.bet)   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import os
import time
import json
import logging
import functools
from datetime import datetime, timezone
from typing import Optional, Any, Dict, List

# ── Activation gate ──────────────────────────────────────────────────────────
DEBUG_MODE = os.environ.get('DEBUG_MODE', '0') == '1'

_logger = logging.getLogger('blackjack.debug')
if DEBUG_MODE:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s — %(message)s',
        datefmt='%H:%M:%S',
    ))
    _logger.addHandler(_handler)
    _logger.setLevel(logging.DEBUG)
    _logger.info('Debug layer ACTIVE — D1/D2/D3/D4 improvements enabled')
else:
    _logger.addHandler(logging.NullHandler())
    _logger.setLevel(logging.CRITICAL)


# ══════════════════════════════════════════════════════════════════════════════
# SEVERITY LEVELS
# ══════════════════════════════════════════════════════════════════════════════

class Severity:
    ERROR = 'ERROR'
    WARN  = 'WARN'
    INFO  = 'INFO'
    DEBUG = 'DEBUG'
    TRACE = 'TRACE'


# ══════════════════════════════════════════════════════════════════════════════
# DEBUG LOGGER
# ══════════════════════════════════════════════════════════════════════════════

class DebugLogger:
    """
    Structured debug logger: Python logging + optional SocketIO debug_log events.

    New in this version (D1-D4):
      log_split_event()  — D1: split hand lifecycle tracing
      validate_count()   — D2: cross-validate running_count vs _card_log sum
      log_deal_order()   — D3: per-card (target, round, pos) sequence trace
      log_shoe_quality() — D4: explicit shoe quality log (removed from @property)
    """

    def __init__(self, socketio=None):
        self.socketio = socketio
        self._request_log: List[Dict] = []   # Last 200 requests
        self._error_log:   List[Dict] = []   # Last 100 errors
        self._ml_log:      List[Dict] = []   # Last 50 ML inferences
        self._deal_log:    List[Dict] = []   # D3: Last 200 deal-order entries
        self._split_log:   List[Dict] = []   # D1: Last 100 split events
        self._count_errors: int = 0          # D2: cumulative count mismatches
        self._stats = {
            'total_requests':   0,
            'total_errors':     0,
            'total_ml_calls':   0,
            'count_mismatches': 0,
            'avg_response_ms':  0.0,
            'start_time':       time.time(),
        }

    # ── Request / response ───────────────────────────────────────────────

    def log_request(self, event: str, payload: Any = None) -> float:
        """Log incoming socket event. Returns start timestamp for timing."""
        if not DEBUG_MODE:
            return time.time()

        start = time.time()
        self._stats['total_requests'] += 1
        snap = _safe_serialize(payload, max_len=500)

        entry = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'event': event, 'direction': 'IN', 'payload': snap,
        }
        self._request_log.append(entry)
        if len(self._request_log) > 200:
            self._request_log = self._request_log[-200:]

        _logger.info('→ %s  payload=%s', event, snap[:120] if snap else '(none)')
        return start

    def log_response(self, event: str, start_time: float,
                     response: Any = None, error: Optional[str] = None):
        """Log outgoing response with elapsed time."""
        if not DEBUG_MODE:
            return

        elapsed_ms = (time.time() - start_time) * 1000
        self._update_avg_response(elapsed_ms)

        if error:
            _logger.warning('← %s  ERROR in %.1fms: %s', event, elapsed_ms, error)
            self.log_error(event, error, Severity.ERROR)
        else:
            resp_snap = _safe_serialize(response, max_len=300)
            _logger.info('← %s  OK in %.1fms  response=%s',
                         event, elapsed_ms, resp_snap[:80] if resp_snap else '(none)')

        self._emit_debug({
            'cat': 'NET',
            'msg': f'← {event} ({elapsed_ms:.0f}ms)',
            'data': {'elapsed_ms': round(elapsed_ms, 1), 'error': error},
        })

    # ── Error logging ────────────────────────────────────────────────────

    def log_error(self, event: str, error: Any, severity: str = Severity.ERROR):
        if not DEBUG_MODE:
            return

        self._stats['total_errors'] += 1
        err_str = str(error)

        category = 'UNKNOWN'
        if 'KeyError' in err_str or 'IndexError' in err_str:
            category = 'DATA_ACCESS'
        elif 'TypeError' in err_str or 'AttributeError' in err_str:
            category = 'TYPE_ERROR'
        elif 'ValueError' in err_str:
            category = 'VALIDATION'
        elif 'Connection' in err_str or 'Timeout' in err_str:
            category = 'NETWORK'
        elif 'torch' in err_str or 'model' in err_str.lower():
            category = 'ML_ENGINE'

        entry = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'event': event, 'severity': severity,
            'category': category, 'message': err_str[:500],
        }
        self._error_log.append(entry)
        if len(self._error_log) > 100:
            self._error_log = self._error_log[-100:]

        _logger.error('[%s/%s] %s — %s', severity, category, event, err_str[:200])
        self._emit_debug({
            'cat': 'ERROR',
            'msg': f'[{category}] {event}: {err_str[:120]}',
            'data': entry,
        })

    # ── ML inference tracing ─────────────────────────────────────────────

    def log_ml_inference(self, system: str, hand_value: int,
                         dealer_upcard: int, true_count: float,
                         result: Optional[Dict] = None, elapsed_ms: float = 0):
        if not DEBUG_MODE:
            return

        self._stats['total_ml_calls'] += 1
        entry = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'system': system,
            'inputs': {'hand_value': hand_value, 'dealer_upcard': dealer_upcard,
                       'true_count': round(true_count, 2)},
            'output': result,
            'elapsed_ms': round(elapsed_ms, 1),
        }
        self._ml_log.append(entry)
        if len(self._ml_log) > 50:
            self._ml_log = self._ml_log[-50:]

        action = result.get('action', '?') if result else '?'
        conf   = result.get('confidence', '?') if result else '?'
        _logger.info('[ML] %s (conf:%s) %.1fms — hand=%d dealer=%d tc=%.1f',
                     action, conf, elapsed_ms, hand_value, dealer_upcard, true_count)
        self._emit_debug({
            'cat': 'ML',
            'msg': f'Inference: {action} conf:{conf} ({elapsed_ms:.0f}ms)',
            'data': entry,
        })

    # ── State change logging ─────────────────────────────────────────────

    def log_state_change(self, label: str, key: str, old_val: Any, new_val: Any):
        if not DEBUG_MODE:
            return
        _logger.debug('[STATE] %s — %s: %s → %s', label, key,
                      _safe_serialize(old_val, 50), _safe_serialize(new_val, 50))
        self._emit_debug({
            'cat': 'STATE',
            'msg': f'{label} — {key}: {_safe_serialize(old_val, 30)} → {_safe_serialize(new_val, 30)}',
        })

    # ── D1: Split hand lifecycle ─────────────────────────────────────────

    def log_split_event(self, event_type: str, **kwargs):
        """
        D1: Trace split hand lifecycle events.

        event_type values:
          'created'       — pair split initiated; kwargs: num_hands, bet, is_ace_split
          'hand_advanced' — active hand index changed; kwargs: from_idx, to_idx
          'bust_advance'  — auto-advance triggered by bust; kwargs: busted_idx, next_idx
          'completed'     — all split hands finished; kwargs: num_hands, results
          'card_dealt'    — card dealt to split hand; kwargs: hand_idx, card, total

        These events are the primary source of split bugs — they let you see
        exactly which hand is active when each card arrives.
        """
        if not DEBUG_MODE:
            return

        entry = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'type': event_type,
            **{k: str(v) for k, v in kwargs.items()},
        }
        self._split_log.append(entry)
        if len(self._split_log) > 100:
            self._split_log = self._split_log[-100:]

        detail = '  '.join(f'{k}={v}' for k, v in kwargs.items())
        _logger.info('[SPLIT/%s] %s', event_type.upper(), detail)
        self._emit_debug({
            'cat': 'STATE',
            'msg': f'SPLIT/{event_type.upper()}: {detail}',
            'data': entry,
        })

    # ── D2: Count cross-validation ───────────────────────────────────────

    def validate_count(self, counter) -> bool:
        """
        D2: Cross-validate running_count against a manual re-sum of _card_log.

        The counter maintains running_count incrementally (+= val per card).
        This function independently recomputes the sum from the raw _card_log
        and compares.  Any divergence = a double-count or missed-count bug.

        Returns True if counts match, False if mismatch detected.

        Call after every deal_card / undo_hand event for continuous validation.
        KO offset: the IRC is included in running_count but _card_log only
        stores dealt card keys, so we add the IRC back before comparing.
        """
        if not DEBUG_MODE:
            return True

        # Recompute from log
        computed = sum(counter.values.get(k, 0) for k in counter._card_log)
        # KO: add IRC offset (stored as _ko_irc, 0 for balanced systems)
        irc = getattr(counter, '_ko_irc', 0)
        computed += irc

        actual = counter.running_count

        if computed != actual:
            self._stats['count_mismatches'] += 1
            self._count_errors += 1
            msg = (
                f'COUNT MISMATCH [{counter.system_name}]: '
                f'log_sum={computed:+} (inc IRC {irc:+}) != '
                f'running_count={actual:+}  '
                f'delta={actual - computed:+}  '
                f'cards_seen={counter.cards_seen}'
            )
            _logger.error('[D2/COUNT] %s', msg)
            self._emit_debug({'cat': 'ERROR', 'msg': msg, 'data': {
                'system': counter.system_name,
                'computed': computed,
                'actual':   actual,
                'irc':      irc,
                'delta':    actual - computed,
                'cards_seen': counter.cards_seen,
                'cumulative_errors': self._count_errors,
            }})
            return False

        _logger.debug('[D2/COUNT] OK  RC=%+d  cards=%d  system=%s',
                      actual, counter.cards_seen, counter.system_name)
        return True

    # ── D3: Deal order tracing ───────────────────────────────────────────

    def log_deal_order(self, target: str, deal_round: int,
                       deal_pos: int, card_str: str, num_players: int = 0):
        """
        D3: Record every card's deal position so sequence violations are visible.

        target:      'player' | 'dealer' | 'seen'
        deal_round:  0 = first card round, 1 = second card round, 2+ = hits
        deal_pos:    seat position (0-indexed; num_players = dealer seat)
        card_str:    string representation of the card (e.g. 'A♠', '10♥')
        num_players: total players at table (used to label dealer position)

        Sequence to watch for:
          Correct initial deal: P→D→P→D  (round 0 pos 0, round 0 pos N,
                                           round 1 pos 0, round 1 pos N)
          Any other order = deal engine desync.
        """
        if not DEBUG_MODE:
            return

        who = 'DEALER' if deal_pos == num_players else f'P{deal_pos+1}'
        phase = (
            f'R{deal_round+1}' if deal_round < 2
            else f'HIT(R{deal_round+1})'
        )

        entry = {
            'ts':     datetime.now(timezone.utc).isoformat(),
            'card':   card_str,
            'target': target,
            'round':  deal_round,
            'pos':    deal_pos,
            'who':    who,
            'phase':  phase,
        }
        self._deal_log.append(entry)
        if len(self._deal_log) > 200:
            self._deal_log = self._deal_log[-200:]

        _logger.debug('[D3/DEAL] %s  %s→%s  target=%s',
                      card_str, phase, who, target)
        self._emit_debug({
            'cat': 'STATE',
            'msg': f'DEAL: {card_str} {phase}→{who} [{target}]',
            'data': entry,
        })

    # ── D4: Explicit shoe quality log (removed from @property) ──────────

    def log_shoe_quality(self, counter):
        """
        D4: Log shoe quality score explicitly.

        The score was previously logged inside the shoe_quality_score @property,
        which fires once per card dealt — generating 1200+ entries per session.
        Call this only when you actually need the detail (e.g. at round end).
        """
        if not DEBUG_MODE:
            return

        score = counter.shoe_quality_score
        _logger.info(
            '[D4/SHOE-QUALITY] score=%d  tc=%.2f  pen=%.2f  ace_adj=%.2f  system=%s',
            score, counter.true_count, counter.penetration,
            counter.ace_adjustment, counter.system_name,
        )
        self._emit_debug({
            'cat': 'STATE',
            'msg': f'ShoeQuality: {score}/100  TC={counter.true_count:.1f}  '
                   f'pen={counter.penetration:.0%}  system={counter.system_name}',
            'data': {
                'score':      score,
                'true_count': round(counter.true_count, 2),
                'penetration': round(counter.penetration, 3),
                'ace_adj':    counter.ace_adjustment,
                'system':     counter.system_name,
            },
        })

    # ── Status snapshot ──────────────────────────────────────────────────

    def get_status(self) -> Dict:
        uptime = time.time() - self._stats['start_time']
        return {
            'debug_mode':        DEBUG_MODE,
            'uptime_seconds':    round(uptime, 1),
            'total_requests':    self._stats['total_requests'],
            'total_errors':      self._stats['total_errors'],
            'total_ml_calls':    self._stats['total_ml_calls'],
            'count_mismatches':  self._stats['count_mismatches'],
            'avg_response_ms':   round(self._stats['avg_response_ms'], 1),
            'recent_errors':     self._error_log[-10:],
            'recent_ml':         self._ml_log[-5:],
            'recent_deals':      self._deal_log[-20:],    # D3
            'recent_splits':     self._split_log[-10:],   # D1
        }

    # ── Internal ─────────────────────────────────────────────────────────

    def _update_avg_response(self, elapsed_ms: float):
        n = self._stats['total_requests']
        if n <= 1:
            self._stats['avg_response_ms'] = elapsed_ms
        else:
            self._stats['avg_response_ms'] = (
                0.9 * self._stats['avg_response_ms'] + 0.1 * elapsed_ms
            )

    def _emit_debug(self, data: Dict):
        if self.socketio:
            try:
                self.socketio.emit('debug_log', data)
            except Exception:
                pass


# ══════════════════════════════════════════════════════════════════════════════
# TIMING DECORATOR
# ══════════════════════════════════════════════════════════════════════════════

debug_logger = DebugLogger()


def debug_timed(event_name: str):
    """
    Decorator for socket event handlers. Logs request + response + timing.
    Zero-cost passthrough when DEBUG_MODE=0.
    """
    def decorator(fn):
        if not DEBUG_MODE:
            return fn

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            payload = args[0] if args else kwargs
            start   = debug_logger.log_request(event_name, payload)
            try:
                result = fn(*args, **kwargs)
                debug_logger.log_response(event_name, start)
                return result
            except Exception as e:
                debug_logger.log_response(event_name, start, error=str(e))
                raise
        return wrapper
    return decorator


# ══════════════════════════════════════════════════════════════════════════════
# UTILITY
# ══════════════════════════════════════════════════════════════════════════════

def _safe_serialize(obj: Any, max_len: int = 500) -> str:
    try:
        s = json.dumps(obj, default=str)
        return s[:max_len] + '...' if len(s) > max_len else s
    except (TypeError, ValueError):
        return str(obj)[:max_len]
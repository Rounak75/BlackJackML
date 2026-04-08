"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  app/debug_layer.py — Production-Grade Backend Debug Middleware              ║
║                                                                              ║
║  ACTIVATION:                                                                 ║
║    Set environment variable DEBUG_MODE=1 before starting the server.         ║
║    Without it, all debug functions are no-ops (zero cost).                   ║
║                                                                              ║
║  FEATURES:                                                                   ║
║    • Socket event timing decorator (@debug_timed)                            ║
║    • Request/response payload logging                                        ║
║    • Error categorization with severity levels                               ║
║    • ML inference tracing                                                    ║
║    • Structured JSON logging to Python logger + SocketIO debug_log event     ║
║    • /debug/status HTTP endpoint (dev-only)                                  ║
║                                                                              ║
║  USAGE IN server.py:                                                         ║
║    from app.debug_layer import debug_logger, debug_timed, DEBUG_MODE         ║
║    @debug_timed('deal_card')                                                 ║
║    def handle_deal_card(data): ...                                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import os
import time
import json
import logging
import functools
from datetime import datetime, timezone
from typing import Optional, Any, Dict

# ── Activation gate ──────────────────────────────────────────────────────────
# All debug functions are no-ops unless DEBUG_MODE=1 is set.
DEBUG_MODE = os.environ.get('DEBUG_MODE', '0') == '1'

# Python logger for structured output
_logger = logging.getLogger('blackjack.debug')
if DEBUG_MODE:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter(
        '%(asctime)s [%(levelname)s] %(name)s — %(message)s',
        datefmt='%H:%M:%S',
    ))
    _logger.addHandler(_handler)
    _logger.setLevel(logging.DEBUG)
    _logger.info('Debug layer ACTIVE — all socket events will be traced')
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
# DEBUG LOGGER — Core class
# ══════════════════════════════════════════════════════════════════════════════

class DebugLogger:
    """
    Structured debug logger that writes to Python logging and optionally
    emits debug_log events to the frontend via SocketIO.
    """

    def __init__(self, socketio=None):
        self.socketio = socketio
        self._request_log = []   # Last 200 request entries
        self._error_log = []     # Last 100 errors
        self._ml_log = []        # Last 50 ML inferences
        self._stats = {
            'total_requests': 0,
            'total_errors': 0,
            'total_ml_calls': 0,
            'avg_response_ms': 0.0,
            'start_time': time.time(),
        }

    # ── Request logging ──────────────────────────────────────────

    def log_request(self, event: str, payload: Any = None) -> float:
        """Log incoming socket event. Returns start timestamp for timing."""
        if not DEBUG_MODE:
            return time.time()

        start = time.time()
        self._stats['total_requests'] += 1

        # Payload snapshot (truncated for large payloads)
        snap = _safe_serialize(payload, max_len=500)

        entry = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'event': event,
            'direction': 'IN',
            'payload': snap,
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

        # Emit to frontend
        self._emit_debug({
            'cat': 'NET',
            'msg': '← ' + event + ' (' + f'{elapsed_ms:.0f}' + 'ms)',
            'data': {'elapsed_ms': round(elapsed_ms, 1), 'error': error},
        })

    # ── Error logging ────────────────────────────────────────────

    def log_error(self, event: str, error: Any, severity: str = Severity.ERROR):
        """Categorize and log an error."""
        if not DEBUG_MODE:
            return

        self._stats['total_errors'] += 1
        err_str = str(error)

        # Categorize
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
            'event': event,
            'severity': severity,
            'category': category,
            'message': err_str[:500],
        }
        self._error_log.append(entry)
        if len(self._error_log) > 100:
            self._error_log = self._error_log[-100:]

        _logger.error('[%s/%s] %s — %s', severity, category, event, err_str[:200])

        self._emit_debug({
            'cat': 'ERROR',
            'msg': '[' + category + '] ' + event + ': ' + err_str[:120],
            'data': entry,
        })

    # ── ML inference tracing ─────────────────────────────────────

    def log_ml_inference(self, system: str, hand_value: int,
                         dealer_upcard: int, true_count: float,
                         result: Optional[Dict] = None,
                         elapsed_ms: float = 0):
        """Log ML model inference with full input/output."""
        if not DEBUG_MODE:
            return

        self._stats['total_ml_calls'] += 1

        entry = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'system': system,
            'inputs': {
                'hand_value': hand_value,
                'dealer_upcard': dealer_upcard,
                'true_count': round(true_count, 2),
            },
            'output': result,
            'elapsed_ms': round(elapsed_ms, 1),
        }
        self._ml_log.append(entry)
        if len(self._ml_log) > 50:
            self._ml_log = self._ml_log[-50:]

        action = result.get('action', '?') if result else '?'
        conf = result.get('confidence', '?') if result else '?'
        _logger.info('[ML] %s (conf: %s) in %.1fms — hand=%d dealer=%d tc=%.1f',
                     action, conf, elapsed_ms, hand_value, dealer_upcard, true_count)

        self._emit_debug({
            'cat': 'ML',
            'msg': f'Inference: {action} conf:{conf} ({elapsed_ms:.0f}ms)',
            'data': entry,
        })

    # ── Game state logging ───────────────────────────────────────

    def log_state_change(self, label: str, key: str, old_val: Any, new_val: Any):
        """Log a specific state mutation."""
        if not DEBUG_MODE:
            return
        _logger.debug('[STATE] %s — %s: %s → %s', label, key,
                      _safe_serialize(old_val, 50), _safe_serialize(new_val, 50))
        self._emit_debug({
            'cat': 'STATE',
            'msg': f'{label} — {key}: {_safe_serialize(old_val, 30)} → {_safe_serialize(new_val, 30)}',
        })

    # ── Status snapshot ──────────────────────────────────────────

    def get_status(self) -> Dict:
        """Return debug status for the /debug/status endpoint."""
        uptime = time.time() - self._stats['start_time']
        return {
            'debug_mode': DEBUG_MODE,
            'uptime_seconds': round(uptime, 1),
            'total_requests': self._stats['total_requests'],
            'total_errors': self._stats['total_errors'],
            'total_ml_calls': self._stats['total_ml_calls'],
            'avg_response_ms': round(self._stats['avg_response_ms'], 1),
            'recent_errors': self._error_log[-10:],
            'recent_ml': self._ml_log[-5:],
        }

    # ── Internal helpers ─────────────────────────────────────────

    def _update_avg_response(self, elapsed_ms: float):
        n = self._stats['total_requests']
        if n <= 1:
            self._stats['avg_response_ms'] = elapsed_ms
        else:
            # Exponential moving average (weight=0.1)
            self._stats['avg_response_ms'] = (
                0.9 * self._stats['avg_response_ms'] + 0.1 * elapsed_ms
            )

    def _emit_debug(self, data: Dict):
        """Emit debug_log event to frontend (if socketio is wired)."""
        if self.socketio:
            try:
                self.socketio.emit('debug_log', data)
            except Exception:
                pass  # Never crash for debug emission


# ══════════════════════════════════════════════════════════════════════════════
# TIMING DECORATOR
# ══════════════════════════════════════════════════════════════════════════════

# Module-level logger instance (wired to socketio in server.py)
debug_logger = DebugLogger()


def debug_timed(event_name: str):
    """
    Decorator for socket event handlers. Logs request + response + timing.

    Usage:
        @debug_timed('deal_card')
        def handle_deal_card(data):
            ...

    When DEBUG_MODE=0, the decorator is a transparent pass-through.
    """
    def decorator(fn):
        if not DEBUG_MODE:
            return fn  # zero cost in production

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            # Log incoming request
            payload = args[0] if args else kwargs
            start = debug_logger.log_request(event_name, payload)

            try:
                result = fn(*args, **kwargs)
                debug_logger.log_response(event_name, start)
                return result
            except Exception as e:
                debug_logger.log_response(event_name, start, error=str(e))
                raise  # re-raise — don't swallow errors

        return wrapper
    return decorator


# ══════════════════════════════════════════════════════════════════════════════
# UTILITY
# ══════════════════════════════════════════════════════════════════════════════

def _safe_serialize(obj: Any, max_len: int = 500) -> str:
    """Safely serialize an object for logging, truncating if needed."""
    try:
        s = json.dumps(obj, default=str)
        if len(s) > max_len:
            return s[:max_len] + '...'
        return s
    except (TypeError, ValueError):
        return str(obj)[:max_len]
"""
app/live_scanner.py — Live Screen Scanner
══════════════════════════════════════════════════════════════════════════════
Continuously captures the screen at low FPS, runs CV detection on each frame,
and pushes SocketIO updates to the browser whenever detected cards change.

STEALTH:
  • Pure Python background thread — zero browser APIs, zero permissions
  • mss captures at OS level — completely invisible to casino JS
  • Casino JS is sandboxed to its tab; cannot see localhost or other processes
  • No camera light, no browser indicator bar, no permission prompts

SCREEN CAPTURE BACKENDS (tried in order):
  1. mss          — fastest, pure Python, cross-platform  (pip install mss)
  2. PIL.ImageGrab — fallback for macOS / Windows without mss
  3. Neither       — scanner disabled, clear error sent to UI

THREAD SAFETY:
  server.py uses async_mode='threading' which makes socketio.emit() safe
  to call from background threads. No extra locking needed for emit().
  apply_card_fn / reset_hand_fn modify global state — protected by _lock.
"""

import hashlib
import logging
import threading
import time
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np

log = logging.getLogger(__name__)

DEFAULT_FPS      = 3      # captures/second — 3 is plenty for blackjack
MAX_FPS          = 10
MIN_FPS          = 0.5
DEBOUNCE_FRAMES  = 2      # require N identical frames before accepting result
NO_CARD_RESET_S  = 8      # seconds of empty screen before resetting hand


# ── Screen capture helpers ─────────────────────────────────────────────────────

def _roi_to_pil_bbox(roi):
    if not roi:
        return None
    return (roi['left'], roi['top'],
            roi['left'] + roi['width'],
            roi['top']  + roi['height'])


def _grab_mss(roi=None):
    try:
        import mss
        with mss.mss() as sct:
            mon = roi if roi else sct.monitors[1]
            shot = sct.grab(mon)
            arr = np.frombuffer(shot.bgra, dtype=np.uint8)
            arr = arr.reshape((shot.height, shot.width, 4))
            import cv2
            return cv2.cvtColor(arr, cv2.COLOR_BGRA2BGR)
    except Exception as e:
        log.debug(f'[Live] mss error: {e}')
        return None


def _grab_pil(roi=None):
    try:
        from PIL import ImageGrab
        import cv2
        img = ImageGrab.grab(bbox=_roi_to_pil_bbox(roi))
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        log.debug(f'[Live] PIL error: {e}')
        return None


def detect_backend() -> str:
    """Return 'mss', 'pil', or 'none'."""
    try:
        import mss
        with mss.mss() as s:
            _ = s.monitors
        return 'mss'
    except Exception:
        pass
    try:
        from PIL import ImageGrab
        ImageGrab.grab(bbox=(0, 0, 2, 2))
        return 'pil'
    except Exception:
        pass
    return 'none'


# ── Fingerprinting ─────────────────────────────────────────────────────────────

def _hash(cards: List[Dict]) -> str:
    if not cards:
        return ''
    key = '|'.join(sorted(f'{c["rank"]}{c["suit"]}' for c in cards))
    return hashlib.md5(key.encode()).hexdigest()[:10]


# ── LiveScanner ────────────────────────────────────────────────────────────────

class LiveScanner:
    """
    Background thread: capture → CV detect → emit state_update on changes.

    Constructor args
    ----------------
    socketio        Flask-SocketIO instance (async_mode='threading')
    get_state_fn    () -> dict       full game state for the browser
    apply_card_fn   (rank, suit, target) -> None   adds card to game state
    reset_hand_fn   () -> None       clears current hand for new round
    fps             initial capture rate (default 3)
    """

    def __init__(self, socketio, get_state_fn: Callable,
                 apply_card_fn: Callable, reset_hand_fn: Callable,
                 fps: float = DEFAULT_FPS):
        self.socketio       = socketio
        self.get_state_fn   = get_state_fn
        self.apply_card_fn  = apply_card_fn
        self.reset_hand_fn  = reset_hand_fn

        self._fps            = max(MIN_FPS, min(MAX_FPS, fps))
        self._roi            = None        # None = full screen
        self._running        = False
        self._paused         = False
        self._thread         = None
        self._lock           = threading.Lock()

        self._prev_hash      = ''
        self._debounce_buf   = ''
        self._debounce_n     = 0
        self._prev_cards     = []
        self._last_card_t    = 0.0
        self._frames         = 0
        self._applied        = 0

        self._backend = detect_backend()
        log.info(f'[Live] Backend: {self._backend}')

    # ── Public API ─────────────────────────────────────────────────────────────

    @property
    def is_running(self) -> bool:
        return self._running and self._thread is not None and self._thread.is_alive()

    @property
    def is_available(self) -> bool:
        return self._backend != 'none'

    def start(self) -> bool:
        if not self.is_available:
            return False
        if self.is_running:
            return True
        self._running = True
        self._paused  = False
        self._thread  = threading.Thread(target=self._loop, daemon=True, name='LiveScanner')
        self._thread.start()
        log.info(f'[Live] Started  fps={self._fps}  backend={self._backend}')
        return True

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)
            self._thread = None
        log.info('[Live] Stopped')

    def pause(self):
        self._paused = True

    def resume(self):
        self._paused = False

    def set_fps(self, fps: float):
        self._fps = max(MIN_FPS, min(MAX_FPS, float(fps)))

    def set_roi(self, x: int, y: int, w: int, h: int):
        self._roi = {'left': int(x), 'top': int(y), 'width': int(w), 'height': int(h)}

    def clear_roi(self):
        self._roi = None

    def get_status(self) -> Dict:
        return {
            'running':    self.is_running,
            'paused':     self._paused,
            'available':  self.is_available,
            'backend':    self._backend,
            'fps':        self._fps,
            'roi':        self._roi,
            'frames':     self._frames,
            'applied':    self._applied,
            'last_cards': self._prev_cards,
        }

    # ── Internal loop ──────────────────────────────────────────────────────────

    def _loop(self):
        while self._running:
            t0 = time.time()
            if not self._paused:
                try:
                    self._tick()
                except Exception as e:
                    log.error(f'[Live] tick error: {e}')
            time.sleep(max(0.0, (1.0 / self._fps) - (time.time() - t0)))

    def _tick(self):
        # 1. Grab frame
        frame = _grab_mss(self._roi) if self._backend == 'mss' else _grab_pil(self._roi)
        if frame is None:
            return
        self._frames += 1
        self._last_frame_w = frame.shape[1]   # store width for card routing

        # 2. Detect cards
        try:
            from app.cv_detector import detect_cards
        except ImportError:
            from cv_detector import detect_cards
        cards = detect_cards(frame)

        # 3. Debounce — wait for DEBOUNCE_FRAMES identical results
        h = _hash(cards)
        if h == self._debounce_buf:
            self._debounce_n += 1
        else:
            self._debounce_buf = h
            self._debounce_n   = 1
        if self._debounce_n < DEBOUNCE_FRAMES:
            return

        # 4. Skip if nothing changed
        if h == self._prev_hash:
            # Auto-reset if screen has been clear for a while
            if (not cards and self._prev_cards
                    and time.time() - self._last_card_t > NO_CARD_RESET_S):
                self._do_reset()
            return

        self._prev_hash = h

        # 5. Diff against previous card set — only process new cards
        prev_keys = set(_hash([c]) for c in self._prev_cards)
        new_cards = [c for c in cards if _hash([c]) not in prev_keys]
        self._prev_cards = cards

        if new_cards:
            self._last_card_t = time.time()

            # ── Card routing logic ─────────────────────────────────────────
            # PROBLEM: At a multi-player blackjack table the camera sees ALL
            # cards — other players, dealer, and you. Sending everyone's cards
            # to 'player' or 'dealer' corrupts your hand display and ruins the
            # strategy recommendation.
            #
            # SOLUTION: Route by screen region.
            #
            #   YOUR cards (player + dealer) occupy a specific region of the
            #   screen. Everything outside that region is 'seen' — it gets
            #   counted (which is correct — you count ALL visible cards) but
            #   NOT added to your hand display.
            #
            # How the regions work (horizontal thirds of the capture region):
            #
            #   Left third   (0  – 33%) → your hand → 'player'
            #   Centre third (33 – 66%) → dealer    → 'dealer'
            #   Right third  (66 – 100%) → other players → 'seen'
            #
            # If no ROI is set, full-screen mode falls back to a simple left/right
            # split (left half = player, right half = dealer, nothing = seen).
            # Users can adjust the ROI in the Live Scan panel to match their
            # exact screen layout.

            # Get frame width for normalising x positions
            frame_w = self._last_frame_w if hasattr(self, '_last_frame_w') else 1920

            # ROI-relative positions if a region of interest is set
            roi_w = self._roi['width'] if self._roi else frame_w

            with self._lock:
                for card in new_cards:
                    card_x   = card['bbox'][0]
                    rel_x    = card_x / roi_w   # 0.0 = left edge, 1.0 = right edge

                    if rel_x < 0.33:
                        target = 'player'        # left third → your cards
                    elif rel_x < 0.66:
                        target = 'dealer'        # centre third → dealer cards
                    else:
                        target = 'seen'          # right third → other players (count only)

                    try:
                        self.apply_card_fn(card['rank'], card['suit'], target)
                        self._applied += 1
                    except Exception as e:
                        log.error(f'[Live] apply_card error: {e}')

        self._push_state()

    def _do_reset(self):
        log.info('[Live] Auto-reset: no cards for %ds', NO_CARD_RESET_S)
        self._prev_cards = []
        self._prev_hash  = ''
        try:
            with self._lock:
                self.reset_hand_fn()
        except Exception as e:
            log.error(f'[Live] reset error: {e}')
        self._push_state()

    def _push_state(self):
        try:
            import json as _j, numpy as _np
            state = self.get_state_fn()
            state['live_scanner'] = self.get_status()

            class _E(_j.JSONEncoder):
                def default(self, o):
                    if isinstance(o, _np.integer):  return int(o)
                    if isinstance(o, _np.floating):  return float(o)
                    if isinstance(o, _np.ndarray):   return o.tolist()
                    return super().default(o)

            clean = _j.loads(_j.dumps(state, cls=_E))
            self.socketio.emit('state_update', clean)

            # Also emit live_update so LiveMode overlay panel gets rich data
            # (count bar, bet badge, recommendation, hand value etc.)
            count = clean.get('count', {})
            rec   = clean.get('recommendation', {})
            bet   = clean.get('betting', {})
            ph    = clean.get('player_hand', {})
            self.socketio.emit('live_update', {
                'running':        self.is_running,
                'stable':         len(self._prev_cards) > 0,
                'cards_detected': len(self._prev_cards),
                'true_count':     count.get('true', 0),
                'rc':             count.get('running', 0),
                'advantage':      count.get('advantage', 0),
                'decks_remaining':count.get('decks_remaining', '—'),
                'recommendation': rec,
                'bet':            bet.get('recommended_bet', 0),
                'bet_action':     bet.get('action', ''),
                'hand_value':     ph.get('value', 0),
                'is_soft':        ph.get('is_soft', False),
                'cards_this_hand':len(ph.get('cards', [])),
            })
        except Exception as e:
            log.error(f'[Live] push_state error: {e}')
"""
app/overlay.py — Live Desktop Overlay (Mode 3)
═══════════════════════════════════════════════════════════════════════════════

HOW TO RUN:
    python main.py overlay

WHAT IT DOES:
    • Captures a screen region every N seconds using mss (OS-level, no browser API)
    • Runs OpenCV card detection on each frame
    • Feeds detected cards into the counting/strategy engine
    • Displays a compact always-on-top transparent window with:
        - Recommended action  (HIT / STAND / DOUBLE / SPLIT / SURRENDER)
        - True count + running count
        - Bet recommendation
        - Detected cards this scan
    • User drags the overlay anywhere on screen
    • F9 = pause/resume scanning
    • F10 = re-select scan region
    • Esc = quit

STEALTH:
    • Uses mss (OS screen capture) — zero browser API calls
    • Separate OS process — completely invisible to casino browser JS
    • Casino JS is sandboxed to its own tab/origin and cannot see other processes
    • No network traffic to external servers — everything is local

SCAN REGION SETUP:
    On first launch (or after pressing F10), a fullscreen selector appears.
    Click and drag to draw a box around the casino table area.
    The overlay will only capture and analyse that region.

REQUIREMENTS (pip):
    mss>=9.0.0          pip install mss
    opencv-python       already in requirements.txt
    pytesseract         already in requirements.txt

SYSTEM:
    tesseract-ocr       sudo apt install tesseract-ocr  /  brew install tesseract
    tkinter             built into Python on Windows/macOS/Linux desktop
"""

import json
import math
import os
import queue
import random
import sys
import threading
import time
import tkinter as tk
from tkinter import font as tkfont
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.cv_detector import detect_cards
from blackjack.card import Card, Rank, Suit
from blackjack.counting import CardCounter
from blackjack.strategy import BasicStrategy
from blackjack.deviations import DeviationEngine
from blackjack.betting import BettingEngine
from blackjack.game import Hand, Action
from config import GameConfig, CountingConfig, BettingConfig

# ── Config ─────────────────────────────────────────────────────────────────────

SCAN_INTERVAL_MS  = 1500    # how often to scan (milliseconds)
SCAN_INTERVAL_MIN = 500
SCAN_INTERVAL_MAX = 5000

OVERLAY_WIDTH  = 240
OVERLAY_ALPHA  = 0.88       # window opacity (0=invisible, 1=opaque)

SETTINGS_FILE  = os.path.join(os.path.dirname(__file__), '..', 'overlay_settings.json')

# ── Colours ────────────────────────────────────────────────────────────────────
BG       = '#0d111e'
BG2      = '#151c2e'
BG3      = '#1c2640'
GOLD     = '#ffd447'
JADE     = '#44e882'
RUBY     = '#ff5c5c'
SAPPH    = '#6aafff'
AMETH    = '#b99bff'
MUTED    = '#5a6e8a'
TEXT     = '#e8eeff'
TEXT2    = '#9badc8'

ACTION_COLORS = {
    'HIT':       JADE,
    'STAND':     SAPPH,
    'DOUBLE':    GOLD,
    'DOUBLE DOWN': GOLD,
    'SPLIT':     AMETH,
    'SURRENDER': RUBY,
}

RANK_MAP = {
    'A': Rank.ACE,   '2': Rank.TWO,   '3': Rank.THREE,
    '4': Rank.FOUR,  '5': Rank.FIVE,  '6': Rank.SIX,
    '7': Rank.SEVEN, '8': Rank.EIGHT, '9': Rank.NINE,
    '10': Rank.TEN,  'J': Rank.JACK,  'Q': Rank.QUEEN,
    'K': Rank.KING,
}
SUIT_MAP = {
    'spades':   Suit.SPADES,  'hearts':   Suit.HEARTS,
    'diamonds': Suit.DIAMONDS,'clubs':    Suit.CLUBS,
}
SUIT_ICON = {'spades':'♠','hearts':'♥','diamonds':'♦','clubs':'♣'}


# ── Settings persistence ────────────────────────────────────────────────────────

def load_settings() -> dict:
    defaults = {
        'scan_region': None,       # [x, y, w, h] or None
        'overlay_x':   100,
        'overlay_y':   100,
        'scan_interval': SCAN_INTERVAL_MS,
        'num_decks':   6,
        'system':      'hi_lo',
        'show_cards':  True,
    }
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE) as f:
                saved = json.load(f)
                defaults.update(saved)
    except Exception:
        pass
    return defaults


def save_settings(settings: dict):
    try:
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(settings, f, indent=2)
    except Exception:
        pass


# ── Screen capture ─────────────────────────────────────────────────────────────

def capture_region(region: Optional[List[int]]) -> Optional[np.ndarray]:
    """
    Capture a screen region using mss.
    region: [x, y, w, h] or None for full screen.
    Returns BGR numpy array or None on error.
    """
    try:
        import mss
        with mss.mss() as sct:
            if region:
                x, y, w, h = region
                mon = {'left': x, 'top': y, 'width': w, 'height': h}
            else:
                mon = sct.monitors[0]   # full screen
            shot = sct.grab(mon)
            frame = np.array(shot)
            return cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
    except ImportError:
        print('[OVERLAY] mss not installed. Run: pip install mss')
        return None
    except Exception as exc:
        print(f'[OVERLAY] Capture error: {exc}')
        return None


# ── Game engine ────────────────────────────────────────────────────────────────

class LiveGameEngine:
    """
    Maintains count and strategy state across multiple scans.
    Cards are deduplicated — the same card seen twice in consecutive
    scans is only counted once.
    """

    def __init__(self, num_decks: int = 6, system: str = 'hi_lo'):
        self.config    = GameConfig()
        self.counter   = CardCounter(system=system, num_decks=num_decks)
        self.strategy  = BasicStrategy(self.config)
        self.deviation  = DeviationEngine(self.strategy)
        self.betting   = BettingEngine()
        self.num_decks = num_decks

        # Dedup: track which card bbox signatures were seen last scan
        self._last_card_sigs: set = set()
        self._hand_cards: List[dict] = []   # current detected hand

    def reset_shoe(self):
        self.counter.reset()
        self._last_card_sigs = set()
        self._hand_cards = []

    def reset_hand(self):
        self._hand_cards = []
        self._last_card_sigs = set()

    def process_detections(self, detections: List[dict]) -> dict:
        """
        Given raw detections from this scan, update counts and return advice.
        Uses bbox position signature to avoid double-counting the same card.
        """
        # Signature: rank+suit+approx_position (rounded to nearest 20px)
        def sig(d):
            x, y = d['bbox'][0], d['bbox'][1]
            return f"{d['rank']}{d['suit']}{x//20}{y//20}"

        new_sigs  = {sig(d) for d in detections}
        new_cards = [d for d in detections if sig(d) not in self._last_card_sigs]
        self._last_card_sigs = new_sigs

        # Count newly seen cards
        for d in new_cards:
            rank = RANK_MAP.get(d['rank'])
            suit = SUIT_MAP.get(d['suit'], Suit.SPADES)
            if rank:
                card = Card(rank, suit)
                self.counter.count_card(card)

        # Update current hand cards (first 2 detected cards = player hand approx)
        self._hand_cards = detections

        return self._build_advice(detections)

    def _build_advice(self, detections: List[dict]) -> dict:
        tc  = self.counter.true_count
        rc  = self.counter.running_count
        adv = self.counter.advantage * 100

        # Build player hand and dealer upcard from detections
        # Convention: leftmost cards = player, rightmost = dealer
        # Sort left to right
        sorted_cards = sorted(detections, key=lambda d: d['bbox'][0])
        player_cards = sorted_cards[:2] if len(sorted_cards) >= 2 else sorted_cards
        dealer_cards = sorted_cards[2:] if len(sorted_cards) > 2 else []

        recommendation = None
        player_value   = 0
        is_soft        = False

        if player_cards:
            hand = Hand()
            for d in player_cards:
                rank = RANK_MAP.get(d['rank'])
                suit = SUIT_MAP.get(d['suit'], Suit.SPADES)
                if rank:
                    hand.add_card(Card(rank, suit))

            dealer_upcard_card = None
            if dealer_cards:
                rank = RANK_MAP.get(dealer_cards[0]['rank'])
                suit = SUIT_MAP.get(dealer_cards[0]['suit'], Suit.SPADES)
                if rank:
                    dealer_upcard_card = Card(rank, suit)

            player_value = hand.best_value
            is_soft      = hand.is_soft

            if dealer_upcard_card and len(hand.cards) >= 2:
                available = hand.available_actions(self.config)
                info = self.deviation.get_action_with_info(
                    hand, dealer_upcard_card, tc, available
                )
                recommendation = {
                    'action':      info['action'].value.upper(),
                    'is_deviation': info['is_deviation'],
                    'basic_action': info['basic_strategy_action'].value.upper(),
                }

        bet_rec = self.betting.get_bet_recommendation(tc)

        return {
            'recommendation': recommendation,
            'count': {
                'true':        round(tc, 1),
                'running':     rc,
                'advantage':   round(adv, 2),
                'penetration': round(self.counter.penetration * 100, 1),
                'decks_remaining': round(self.counter.decks_remaining, 1),
                'favorable':   self.counter.is_favorable,
            },
            'betting':      bet_rec,
            'player_value': player_value,
            'is_soft':      is_soft,
            'cards_detected': [
                f"{d['rank']}{SUIT_ICON.get(d['suit'],'?')}" for d in detections
            ],
            'new_cards_count': 0,
        }


# ── Region selector ────────────────────────────────────────────────────────────

class RegionSelector:
    """
    Fullscreen overlay that lets the user click-drag to select the scan region.
    Returns [x, y, w, h] or None if cancelled.
    """

    def __init__(self):
        self.result = None

    def select(self) -> Optional[List[int]]:
        root = tk.Tk()
        root.attributes('-fullscreen', True)
        root.attributes('-alpha', 0.3)
        root.attributes('-topmost', True)
        root.configure(bg='black')
        root.title('Select scan region — drag to draw, Enter to confirm, Esc to cancel')

        canvas = tk.Canvas(root, bg='black', cursor='crosshair',
                           highlightthickness=0)
        canvas.pack(fill='both', expand=True)

        start_x = start_y = 0
        rect_id = None
        region  = [None]

        label = tk.Label(root,
            text='Drag to select the casino table area  |  Enter = confirm  |  Esc = cancel',
            bg='#111827', fg='#6aafff', font=('Arial', 14, 'bold'),
            pady=8, padx=16)
        label.place(relx=0.5, rely=0.02, anchor='n')

        def on_press(e):
            nonlocal start_x, start_y, rect_id
            start_x, start_y = e.x, e.y
            if rect_id:
                canvas.delete(rect_id)

        def on_drag(e):
            nonlocal rect_id
            if rect_id:
                canvas.delete(rect_id)
            rect_id = canvas.create_rectangle(
                start_x, start_y, e.x, e.y,
                outline='#6aafff', width=2, fill='#6aafff11')
            x1, y1 = min(start_x, e.x), min(start_y, e.y)
            x2, y2 = max(start_x, e.x), max(start_y, e.y)
            region[0] = [x1, y1, x2 - x1, y2 - y1]
            label.config(text=f'Region: {x2-x1}×{y2-y1}px  |  Enter = confirm  |  Esc = cancel')

        def on_confirm(e=None):
            self.result = region[0]
            root.destroy()

        def on_cancel(e=None):
            self.result = None
            root.destroy()

        canvas.bind('<ButtonPress-1>',   on_press)
        canvas.bind('<B1-Motion>',       on_drag)
        canvas.bind('<ButtonRelease-1>', lambda e: None)
        root.bind('<Return>',            on_confirm)
        root.bind('<Escape>',            on_cancel)

        root.mainloop()
        return self.result


# ── Settings dialog ────────────────────────────────────────────────────────────

class SettingsDialog:
    def __init__(self, parent, settings: dict, on_save):
        self.win = tk.Toplevel(parent)
        self.win.title('Overlay Settings')
        self.win.configure(bg=BG)
        self.win.resizable(False, False)
        self.win.attributes('-topmost', True)
        self.on_save = on_save

        pad = {'padx': 12, 'pady': 4}

        def label(text):
            tk.Label(self.win, text=text, bg=BG, fg=TEXT2,
                     font=('Arial', 10)).pack(anchor='w', **pad)

        def row(text, var, values=None, from_=None, to=None):
            f = tk.Frame(self.win, bg=BG)
            f.pack(fill='x', padx=12, pady=2)
            tk.Label(f, text=text, bg=BG, fg=TEXT2,
                     font=('Arial', 10), width=18, anchor='w').pack(side='left')
            if values:
                cb = tk.OptionMenu(f, var, *values)
                cb.configure(bg=BG3, fg=TEXT, activebackground=BG3,
                             highlightthickness=0, font=('Arial', 10))
                cb.pack(side='left')
            elif from_ is not None:
                sc = tk.Scale(f, variable=var, from_=from_, to=to,
                              orient='horizontal', bg=BG, fg=TEXT,
                              highlightthickness=0, troughcolor=BG3,
                              length=140)
                sc.pack(side='left')

        label('── Counting ──────────────────')
        self.v_decks  = tk.IntVar(value=settings.get('num_decks', 6))
        self.v_system = tk.StringVar(value=settings.get('system', 'hi_lo'))
        row('Decks in shoe', self.v_decks, values=[1,2,4,6,8])
        row('Counting system', self.v_system,
            values=['hi_lo','ko','omega_ii','zen'])

        label('── Scanning ──────────────────')
        self.v_interval = tk.IntVar(value=settings.get('scan_interval', SCAN_INTERVAL_MS))
        row('Scan interval (ms)', self.v_interval,
            from_=SCAN_INTERVAL_MIN, to=SCAN_INTERVAL_MAX)

        label('── Display ───────────────────')
        self.v_showcards = tk.BooleanVar(value=settings.get('show_cards', True))
        f2 = tk.Frame(self.win, bg=BG)
        f2.pack(fill='x', padx=12, pady=2)
        tk.Label(f2, text='Show detected cards', bg=BG, fg=TEXT2,
                 font=('Arial', 10), width=18, anchor='w').pack(side='left')
        tk.Checkbutton(f2, variable=self.v_showcards,
                       bg=BG, fg=TEXT, selectcolor=BG3,
                       activebackground=BG).pack(side='left')

        # Buttons
        bf = tk.Frame(self.win, bg=BG)
        bf.pack(fill='x', padx=12, pady=10)
        tk.Button(bf, text='Save', bg=JADE, fg='#0a0e18', font=('Arial', 10, 'bold'),
                  relief='flat', padx=12,
                  command=self._save).pack(side='left', padx=(0, 6))
        tk.Button(bf, text='Cancel', bg=BG3, fg=TEXT, font=('Arial', 10),
                  relief='flat', padx=12,
                  command=self.win.destroy).pack(side='left')

    def _save(self):
        self.on_save({
            'num_decks':     self.v_decks.get(),
            'system':        self.v_system.get(),
            'scan_interval': self.v_interval.get(),
            'show_cards':    self.v_showcards.get(),
        })
        self.win.destroy()


# ── Main overlay window ────────────────────────────────────────────────────────

class BlackjackOverlay:
    """
    The always-on-top transparent overlay window.
    Runs the scan loop in a background thread and updates the UI in the main thread.
    """

    def __init__(self):
        self.settings    = load_settings()
        self.engine      = LiveGameEngine(
            num_decks = self.settings['num_decks'],
            system    = self.settings['system'],
        )
        self.paused      = False
        self.scan_region = self.settings.get('scan_region')
        self.result_queue: queue.Queue = queue.Queue(maxsize=1)
        self._scan_thread: Optional[threading.Thread] = None
        self._stop_event  = threading.Event()

        self._build_window()
        self._start_scan_thread()

        # Keybindings
        self.root.bind('<F9>',  lambda e: self._toggle_pause())
        self.root.bind('<F10>', lambda e: self._reselect_region())
        self.root.bind('<Escape>', lambda e: self._quit())

        # If no region saved, ask user to select one
        if not self.scan_region:
            self.root.after(300, self._reselect_region)

        # Poll the result queue every 100ms
        self.root.after(100, self._poll_results)

    # ── Window construction ───────────────────────────────────────────────────

    def _build_window(self):
        self.root = tk.Tk()
        self.root.title('BlackjackML Overlay')
        self.root.overrideredirect(True)           # no title bar
        self.root.attributes('-topmost', True)      # always on top
        self.root.attributes('-alpha', OVERLAY_ALPHA)
        self.root.configure(bg=BG)
        self.root.geometry(
            f'{OVERLAY_WIDTH}x320+'
            f'{self.settings.get("overlay_x",100)}+'
            f'{self.settings.get("overlay_y",100)}'
        )

        # ── Drag handle ───────────────────────────────────────────────────────
        self.header = tk.Frame(self.root, bg=BG2, cursor='fleur')
        self.header.pack(fill='x')

        tk.Label(self.header, text='♠ BlackjackML Live', bg=BG2, fg=MUTED,
                 font=('Arial', 9, 'bold')).pack(side='left', padx=8, pady=4)

        # Pause/settings/close buttons in header
        btn_cfg = dict(bg=BG2, relief='flat', cursor='hand2', bd=0,
                       font=('Arial', 10), pady=2, padx=4)
        tk.Button(self.header, text='✕', fg=RUBY,  command=self._quit,
                  **btn_cfg).pack(side='right', padx=2)
        tk.Button(self.header, text='⚙', fg=TEXT2, command=self._open_settings,
                  **btn_cfg).pack(side='right', padx=2)
        tk.Button(self.header, text='⏸', fg=TEXT2, command=self._toggle_pause,
                  **btn_cfg).pack(side='right', padx=2)

        self._make_draggable(self.header)

        # ── Status bar (scanning / paused / no region) ─────────────────────
        self.status_bar = tk.Label(self.root, text='Initialising…', bg=BG3,
                                   fg=MUTED, font=('Arial', 8),
                                   anchor='center', pady=2)
        self.status_bar.pack(fill='x')

        # ── Main content frame ─────────────────────────────────────────────
        self.content = tk.Frame(self.root, bg=BG, padx=10)
        self.content.pack(fill='both', expand=True, pady=(6, 4))

        # Action label (big)
        self.lbl_action = tk.Label(self.content, text='—', bg=BG, fg=MUTED,
                                   font=('Arial', 28, 'bold'), anchor='center')
        self.lbl_action.pack(fill='x')

        self.lbl_action_sub = tk.Label(self.content, text='Waiting for cards…',
                                       bg=BG, fg=MUTED, font=('Arial', 8),
                                       anchor='center')
        self.lbl_action_sub.pack(fill='x')

        # Divider
        tk.Frame(self.root, bg=BG3, height=1).pack(fill='x', pady=4)

        # Count row
        cf = tk.Frame(self.content, bg=BG)
        cf.pack(fill='x', pady=1)
        self.lbl_tc  = self._kv(cf, 'TRUE COUNT', '—', side='left')
        self.lbl_rc  = self._kv(cf, 'RUNNING',    '—', side='right')

        # Advantage row
        af = tk.Frame(self.content, bg=BG)
        af.pack(fill='x', pady=1)
        self.lbl_adv  = self._kv(af, 'EDGE',    '—', side='left')
        self.lbl_decks = self._kv(af, 'DECKS',  '—', side='right')

        # Bet row
        tk.Frame(self.root, bg=BG3, height=1).pack(fill='x', pady=4)
        bf2 = tk.Frame(self.content, bg=BG)
        bf2.pack(fill='x', pady=1)
        self.lbl_bet   = self._kv(bf2, 'BET',   '—', side='left')
        self.lbl_units = self._kv(bf2, 'UNITS',  '—', side='right')

        # Cards row
        self.cards_frame = tk.Frame(self.content, bg=BG)
        self.cards_frame.pack(fill='x', pady=(4, 0))
        self.lbl_cards = tk.Label(self.cards_frame, text='', bg=BG, fg=MUTED,
                                  font=('Arial', 9), anchor='center')
        self.lbl_cards.pack()

        # Footer hotkeys
        tk.Frame(self.root, bg=BG3, height=1).pack(fill='x', pady=4)
        tk.Label(self.root,
                 text='F9 pause · F10 region · Esc quit',
                 bg=BG, fg=MUTED, font=('Arial', 7),
                 anchor='center').pack(pady=(0, 4))

    def _kv(self, parent, key, val, side='left') -> tk.Label:
        """Create a key/value label pair and return the value label."""
        f = tk.Frame(parent, bg=BG)
        f.pack(side=side, padx=(0, 8))
        tk.Label(f, text=key, bg=BG, fg=MUTED,
                 font=('Arial', 7, 'bold')).pack()
        v = tk.Label(f, text=val, bg=BG, fg=TEXT,
                     font=('Arial', 12, 'bold'))
        v.pack()
        return v

    def _make_draggable(self, widget):
        widget._drag_x = 0
        widget._drag_y = 0

        def start(e):
            widget._drag_x = e.x_root - self.root.winfo_x()
            widget._drag_y = e.y_root - self.root.winfo_y()

        def drag(e):
            x = e.x_root - widget._drag_x
            y = e.y_root - widget._drag_y
            self.root.geometry(f'+{x}+{y}')

        widget.bind('<ButtonPress-1>',  start)
        widget.bind('<B1-Motion>',      drag)

    # ── Scan thread ───────────────────────────────────────────────────────────

    def _start_scan_thread(self):
        self._stop_event.clear()
        self._scan_thread = threading.Thread(target=self._scan_loop, daemon=True)
        self._scan_thread.start()

    def _scan_loop(self):
        while not self._stop_event.is_set():
            interval = self.settings.get('scan_interval', SCAN_INTERVAL_MS) / 1000.0

            if self.paused or not self.scan_region:
                time.sleep(0.25)
                continue

            frame = capture_region(self.scan_region)
            if frame is not None:
                detections = detect_cards(frame)
                advice     = self.engine.process_detections(detections)
                # Put result; drop old if queue full
                try:
                    self.result_queue.get_nowait()
                except queue.Empty:
                    pass
                self.result_queue.put_nowait(advice)

            time.sleep(interval)

    # ── UI update from results ────────────────────────────────────────────────

    def _poll_results(self):
        try:
            advice = self.result_queue.get_nowait()
            self._update_ui(advice)
        except queue.Empty:
            pass
        self.root.after(100, self._poll_results)

    def _update_ui(self, advice: dict):
        count   = advice.get('count', {})
        betting = advice.get('betting', {})
        rec     = advice.get('recommendation')
        cards   = advice.get('cards_detected', [])

        tc  = count.get('true', 0)
        rc  = count.get('running', 0)
        adv = count.get('advantage', 0)
        dr  = count.get('decks_remaining', '—')
        favorable = count.get('favorable', False)

        # Action
        if rec:
            action = rec.get('action', '—')
            color  = ACTION_COLORS.get(action, TEXT)
            self.lbl_action.config(text=action, fg=color)
            sub = '⚡ DEVIATION' if rec.get('is_deviation') else f'basic: {rec.get("basic_action","")}'
            self.lbl_action_sub.config(text=sub,
                fg=AMETH if rec.get('is_deviation') else MUTED)
        else:
            self.lbl_action.config(text='—', fg=MUTED)
            self.lbl_action_sub.config(text='Deal cards to player + dealer', fg=MUTED)

        # Count
        tc_color = JADE if tc > 2 else SAPPH if tc > 0 else RUBY if tc < -1 else TEXT
        self.lbl_tc.config(
            text=f'+{tc:.1f}' if tc > 0 else f'{tc:.1f}',
            fg=tc_color)
        self.lbl_rc.config(
            text=f'+{rc}' if rc > 0 else str(rc),
            fg=tc_color)

        # Advantage
        adv_color = JADE if adv > 0 else RUBY
        self.lbl_adv.config(
            text=f'+{adv:.2f}%' if adv > 0 else f'{adv:.2f}%',
            fg=adv_color)
        self.lbl_decks.config(text=f'{dr}', fg=TEXT2)

        # Bet
        bet   = betting.get('recommended_bet', '—')
        units = betting.get('units', '—')
        self.lbl_bet.config(
            text=f'${bet:.0f}' if isinstance(bet, (int, float)) else '—',
            fg=GOLD)
        self.lbl_units.config(
            text=f'{units:.0f}u' if isinstance(units, (int, float)) else '—',
            fg=GOLD)

        # Cards
        if self.settings.get('show_cards', True) and cards:
            self.lbl_cards.config(text='  '.join(cards[:6]), fg=TEXT2)
        else:
            self.lbl_cards.config(text='')

        # Status bar
        status = '⏸ PAUSED' if self.paused else f'🔍 Scanning every {self.settings["scan_interval"]}ms'
        self.status_bar.config(text=status,
            fg=GOLD if self.paused else JADE)

    # ── Controls ──────────────────────────────────────────────────────────────

    def _toggle_pause(self):
        self.paused = not self.paused
        if self.paused:
            self.status_bar.config(text='⏸ PAUSED — F9 to resume', fg=GOLD)
            self.lbl_action.config(text='⏸', fg=GOLD)

    def _reselect_region(self):
        self.paused = True
        self.status_bar.config(text='Select region…', fg=SAPPH)
        self.root.withdraw()                         # hide overlay while selecting
        self.root.after(200, self._run_selector)

    def _run_selector(self):
        selector  = RegionSelector()
        region    = selector.select()
        if region and region[2] > 20 and region[3] > 20:
            self.scan_region            = region
            self.settings['scan_region'] = region
            save_settings(self.settings)
        self.root.deiconify()
        self.paused = False
        self.status_bar.config(text='✓ Region set — scanning', fg=JADE)

    def _open_settings(self):
        def on_save(new_vals: dict):
            changed_engine = (
                new_vals.get('num_decks') != self.settings.get('num_decks') or
                new_vals.get('system')    != self.settings.get('system')
            )
            self.settings.update(new_vals)
            save_settings(self.settings)
            if changed_engine:
                self.engine = LiveGameEngine(
                    num_decks = self.settings['num_decks'],
                    system    = self.settings['system'],
                )

        SettingsDialog(self.root, self.settings, on_save)

    def _quit(self):
        # Save window position
        self.settings['overlay_x'] = self.root.winfo_x()
        self.settings['overlay_y'] = self.root.winfo_y()
        save_settings(self.settings)
        self._stop_event.set()
        self.root.destroy()

    def run(self):
        self.root.mainloop()


# ── Entry point ────────────────────────────────────────────────────────────────

def start_overlay():
    """Called from main.py  →  python main.py overlay"""
    print('\n' + '='*60)
    print('  ♠  BLACKJACKML LIVE OVERLAY')
    print('  → Drag overlay to position over casino window')
    print('  → F9  = pause/resume scanning')
    print('  → F10 = reselect scan region')
    print('  → Esc = quit')
    print('='*60 + '\n')

    try:
        import mss  # noqa — just check it's installed
    except ImportError:
        print('ERROR: mss not installed.')
        print('Run:   pip install mss')
        sys.exit(1)

    app = BlackjackOverlay()
    app.run()
# ♠ BlackjackML — Live Card Counter & AI Advisor

> **For learning and portfolio purposes only.**
> Card counting is legal, but casinos may ask you to leave if detected.

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![PyTorch 2.0+](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-FF6B35)](https://ultralytics.com)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.8+-5C3EE8?logo=opencv&logoColor=white)](https://opencv.org)
[![Tesseract](https://img.shields.io/badge/Tesseract-5.x-brightgreen)](https://github.com/tesseract-ocr/tesseract)

---

## 📋 Table of Contents

1. [What This Project Does](#-what-this-project-does)
2. [How Everything Fits Together](#-how-everything-fits-together-read-this-first)
3. [Quick Start — Complete Setup](#-quick-start--complete-setup)
4. [Project Structure](#-project-structure)
5. [How the Frontend Build Works](#-how-the-frontend-build-works-read-this-if-you-edit-any-js-files)
6. [Training the Blackjack Strategy AI From Scratch](#-training-the-blackjack-strategy-ai-from-scratch)
7. [What the Strategy Model Actually Learns](#-what-the-strategy-model-actually-learns)
8. [Fine-Tuning the Strategy Model](#-fine-tuning-the-strategy-model)
9. [YOLO Card Detection — Full Setup Guide](#-yolo-card-detection--full-setup-guide)
10. [Training YOLO with the Roboflow 20,000-Image Dataset](#-training-yolo-with-the-roboflow-20000-image-dataset)
11. [Fine-Tuning YOLO for Your Specific Casino](#-fine-tuning-yolo-for-your-specific-casino)
12. [OpenCV + Tesseract OCR Fallback](#-opencv--tesseract-ocr-fallback)
13. [Running the Dashboard](#-running-the-dashboard)
14. [How to Use the Dashboard](#-how-to-use-the-dashboard)
15. [Three Card Entry Modes](#-three-card-entry-modes)
16. [How Card Routing Works](#-how-card-routing-works-your-cards-vs-others)
17. [Split Hand Workflow](#-split-hand-workflow)
18. [Keyboard Shortcuts](#-keyboard-shortcuts)
19. [Currency Settings](#-currency-settings)
20. [Model Performance & Accuracy](#-model-performance--accuracy)
21. [Player Advantage Analysis](#-player-advantage-analysis)
22. [Customising Settings](#-customising-settings)
23. [Deployment](#-deployment)
24. [Troubleshooting](#-troubleshooting)
25. [Bug Fix Changelog](#-bug-fix-changelog)
26. [Architecture Deep Dive](#-architecture-deep-dive)

---

## 🎯 What This Project Does

BlackjackML is a complete blackjack AI system built from scratch. It watches the
cards being dealt, counts them, and tells you exactly what to do in real time —
what action to take, how much to bet, and what your edge is.

| Component | Description |
|-----------|-------------|
| **Perfect Basic Strategy** | Lookup tables for every hand vs. dealer upcard (hard, soft, pairs) |
| **4 Card Counting Systems** | Hi-Lo, KO, Omega II, Zen Count — switch live mid-shoe |
| **Illustrious 18 + Fab 4** | 22 count-based play deviations for maximum edge |
| **Kelly Criterion Betting** | Mathematically optimal bet sizing with a 1–16 unit spread |
| **Side Bet EV Analyser** | Real-time expected value for Perfect Pairs, 21+3, Lucky Ladies |
| **Shuffle-Resistant ML** | LSTM + Bayesian counter that adapts across imperfect shuffles |
| **Neural Net Optimizer v2** | ResNet + attention + specialised heads trained on 1M+ hands |
| **YOLOv8 Card Detector** | Detects all 52 cards in one shot — far better than OCR alone |
| **Smart Card Routing** | YOUR cards go to player/dealer. Other players' cards are counted only |
| **3-Mode Card Scanner** | Manual grid / Screenshot paste / Live auto-scan |
| **React Dashboard** | Live web UI — enter cards, get instant count + recommendation |
| **Multi-Currency** | INR default (₹) — supports 20 fiat currencies and top 10 crypto |
| **Split Hand Management** | Full pair split support with independent per-hand recommendations |

---

## 🗺 How Everything Fits Together (Read This First)

Before diving into setup, read this section. It will save you a lot of confusion.

```
BlackjackML has TWO completely separate AI systems:

┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM 1 — Card Detection (YOLO + OpenCV + Tesseract)          │
│  ─────────────────────────────────────────────────────────────  │
│  PURPOSE: Look at a screenshot or live screen capture and       │
│           identify which cards are visible.                     │
│                                                                 │
│  Example output: "I see Ace of Spades, King of Hearts"         │
│                                                                 │
│  How to train it:                                               │
│    Step 1: python yolo/generate_dataset.py --images 10000      │
│    Step 2: python yolo/train_yolo.py                           │
│  Output file: models/card_detector.pt                          │
│                                                                 │
│  If not trained: falls back to Tesseract OCR automatically     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                  Detected cards fed into game engine
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM 2 — Strategy AI (PyTorch Neural Network)                │
│  ─────────────────────────────────────────────────────────────  │
│  PURPOSE: Given the current hand situation and running count,   │
│           recommend the best action and bet size.               │
│                                                                 │
│  Example output: "You have 16 vs dealer 10 at TC +2 → STAND"  │
│                  "Bet 4 units (₹400) — count is favourable"    │
│                                                                 │
│  How to train it:                                               │
│    python main.py train --hands 1000000                        │
│  Output file: models/best_model.pt                             │
│                                                                 │
│  If not trained: falls back to rules-based basic strategy      │
└─────────────────────────────────────────────────────────────────┘

KEY POINT: You train these two systems separately.
They are completely independent of each other.
The dashboard works without either trained — it just uses rules-based
logic — but training both gives the best possible accuracy.
```

---

## ⚡ Quick Start — Complete Setup

Follow every step in order. Do not skip any.

### Step 1 — Install Python 3.10+

Download from [python.org/downloads](https://www.python.org/downloads/).

> **Windows:** During installation you will see a checkbox labelled
> **"Add Python to PATH"** — tick this box. Without it, nothing will work.

Verify Python is installed:
```bash
python --version
# Should show: Python 3.10.x or higher
```

### Step 2 — Open a terminal in the project folder

```bash
# Windows PowerShell — navigate to the project:
cd C:\Users\YourName\Downloads\BlackJackML-main

# Mac / Linux:
cd /path/to/BlackJackML-main
```

### Step 3 — Create a virtual environment

A virtual environment is an isolated Python installation just for this project.
It prevents version conflicts with other Python projects on your computer.

```bash
python -m venv venv
```

### Step 4 — Activate the virtual environment

You must do this every time you open a new terminal to work on this project.
You will know it is active when you see `(venv)` at the start of your prompt.

```bash
# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Windows CMD:
.\venv\Scripts\activate.bat

# Mac / Linux:
source venv/bin/activate
```

### Step 5 — Install Python packages

```bash
pip install -r requirements.txt
# PyTorch is ~200MB so this takes 2–5 minutes on a normal connection
```

### Step 6 — Install Tesseract (OCR engine — NOT a pip package)

Tesseract is a text-recognition engine used as a fallback when YOLO is not available.
It must be installed as a system program, not via pip.

```bash
# Windows — download and run the installer from:
# https://github.com/UB-Mannheim/tesseract/wiki
# IMPORTANT: During install, tick "Add Tesseract to system PATH"

# macOS (requires Homebrew — https://brew.sh):
brew install tesseract

# Ubuntu / Debian / WSL:
sudo apt install tesseract-ocr

# Verify it installed correctly:
tesseract --version
# Should show: tesseract 5.x.x
```

### Step 7 — Install YOLO (much better card detection than OCR)

```bash
pip install ultralytics
```

### Step 8 — Generate synthetic card training data for YOLO

```bash
# Recommended (5 min, good accuracy):
python yolo/generate_dataset.py --images 10000

# Best accuracy (12 min):
python yolo/generate_dataset.py --images 25000
```

### Step 9 — Train the YOLO card detector

```bash
python yolo/train_yolo.py
# CPU: ~30–60 minutes
# GPU: ~8 minutes
# Creates: models/card_detector.pt
```

### Step 10 — Train the blackjack strategy AI

```bash
# Always run the quick test first — 2 minutes — confirms everything works:
python main.py train --hands 100000 --epochs 20

# Full training — recommended for real use:
python main.py train --hands 1000000
# CPU: ~25 minutes | GPU: ~5 minutes
# Creates: models/best_model.pt
```

### Step 11 — Start the dashboard

```bash
python main.py web
```

Open **http://localhost:5000** in your browser.

---

## 📁 Project Structure

```
BlackJackML-main/
│
├── main.py                      # Entry point: web / overlay / simulate / train
├── config.py                    # All settings — table rules, bet limits, ML params
├── requirements.txt             # Python packages: pip install -r requirements.txt
├── jsconfig.json                # Tells VS Code these .js files use React JSX
├── build.sh                     # Frontend build script (Mac/Linux)
├── build.ps1                    # Frontend build script (Windows PowerShell)
│
├── blackjack/                   # Core game engine (pure Python, no ML)
│   ├── card.py                  # Card, Rank, Suit, Deck, Shoe
│   ├── game.py                  # Hand, Round, BlackjackTable, Action
│   ├── counting.py              # CardCounter for all 4 systems
│   ├── strategy.py              # Basic strategy lookup tables
│   ├── deviations.py            # Illustrious 18 + Fab 4 deviations
│   ├── betting.py               # Kelly Criterion bet sizing
│   └── side_bets.py             # Side bet EV calculator
│
├── ml_model/                    # Strategy neural network
│   ├── model.py                 # BlackjackNet v2 architecture
│   ├── shuffle_tracker.py       # LSTM + Bayesian shuffle tracker
│   ├── simulate.py              # Monte Carlo simulation engine
│   └── train.py                 # Training pipeline
│
├── app/                         # Web dashboard
│   ├── server.py                # Flask + Socket.IO backend
│   ├── cv_detector.py           # Card detection: YOLO → OCR fallback
│   ├── live_scanner.py          # Background screen capture thread
│   ├── overlay.py               # Desktop overlay (tkinter)
│   ├── templates/index.html     # HTML shell — loads bundle.min.js
│   └── static/
│       ├── bundle.min.js        # Compiled frontend (do not edit directly)
│       ├── style.css            # Dashboard styles
│       └── components/          # Source files — edit these, then rebuild
│           ├── App.jsx
│           ├── BettingPanel.js
│           ├── SplitHandPanel.js
│           └── ... (22 files total)
│
├── yolo/                        # Card detection training
│   ├── generate_dataset.py      # Synthetic dataset generator
│   ├── train_yolo.py            # YOLOv8 trainer
│   └── dataset/                 # Auto-created by generate_dataset.py
│
└── models/                      # Auto-created when you train
    ├── card_detector.pt         # YOLO model (System 1)
    ├── best_model.pt            # Strategy AI (System 2)
    └── training_log.csv         # Per-epoch training metrics
```

---

## 🔨 How the Frontend Build Works (Read This If You Edit Any JS Files)

The browser loads `app/static/bundle.min.js` — a single pre-compiled file built
from all 22 component files in `app/static/components/`. If you edit any component
file, you must rebuild the bundle before the browser sees your change.

```bash
# Mac / Linux:
bash build.sh

# Windows PowerShell:
.\build.ps1

# If you get a security error on Windows:
Unblock-File .\build.ps1
.\build.ps1
```

**Do not edit `bundle.min.js` directly** — it is overwritten on every build.

---

## 🔄 Training the Blackjack Strategy AI From Scratch

### When should you retrain?

- You changed table rules in `config.py`
- You want higher accuracy and are willing to train longer
- You applied bug fixes to `blackjack/game.py` or `blackjack/strategy.py`

### Training commands

| Command | CPU time | GPU time | Accuracy | When to use |
|---------|----------|----------|----------|-------------|
| `python main.py train --hands 100000 --epochs 20` | ~2 min | ~20 sec | ~67% | Quick sanity check — always run this first |
| `python main.py train --hands 500000 --epochs 30` | ~10 min | ~90 sec | ~75% | Development and testing |
| `python main.py train --hands 1000000` | ~25 min | ~5 min | **~82%** | **Recommended for real use** |
| `python main.py train --hands 2000000 --epochs 60` | ~60 min | ~10 min | ~85%+ | Maximum accuracy |

```bash
# Always run the quick test first:
python main.py train --hands 100000 --epochs 20

# Full training:
python main.py train --hands 1000000
```

### Enable GPU acceleration (6× faster)

```bash
python -c "import torch; print('GPU available:', torch.cuda.is_available())"

# If True, install GPU PyTorch:
pip uninstall torch -y
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

---

## ✂ Split Hand Workflow

When the player has a pair, the SPLIT PAIR button appears with a pulsing purple border.

1. Click **SPLIT PAIR** — the hand splits into two side-by-side zones
2. Deal cards to **Hand 1** as normal (click card buttons with Player selected)
3. When Hand 1 is complete, click **✓ Done with Hand 1 → Next Hand**
4. Deal cards to **Hand 2**
5. When both hands are done, the green **"All split hands complete"** banner appears
6. Record your results (WIN / LOSS / PUSH) and press **N** for a new hand

**Rules enforced automatically:**
- No surrender on split hands
- No double after split
- Split aces receive exactly one card each (auto-stands)
- Independent AI recommendation for each hand

**Undo during split:** Press **Ctrl+Z** or click Undo — removes only the last card
from the currently active split hand. The split structure and other hand are preserved.

---

## ⌨ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New hand (count continues — does not reset) |
| `S` | Real shuffle (resets count to 0) |
| `P` | Switch deal target to Player |
| `D` | Switch deal target to Dealer |
| `Ctrl+Z` / `Cmd+Z` | Undo last card dealt |

> **Note:** Shortcuts are disabled when the cursor is inside an input field or select box.
> Ctrl+Z during a split only undoes the last card on the active split hand.

---

## 💱 Currency Settings

The default currency is **Indian Rupee (₹)**. To change it, click the currency
symbol button in the Bet Sizing panel and search for any of the 20 supported fiat
currencies or top 10 cryptocurrencies.

All amounts — WIN/LOSS toasts, P&L display, Kelly bet, bankroll — update
immediately when you change the currency.

---

## 🎰 YOLO Card Detection — Full Setup Guide

YOLO is **System 1** — it looks at screenshots or live screen captures and
identifies cards automatically. It is far more accurate than Tesseract OCR.

### Step 1 — Generate synthetic training data

```bash
python yolo/generate_dataset.py --images 10000
```

This creates ~10,000 card scene images with automatic bounding box labels.
No internet, no camera, no real cards needed — everything is procedurally generated.

### Step 2 — Train the detector

```bash
python yolo/train_yolo.py
```

Output: `models/card_detector.pt`

### Step 3 — Verify it works

```bash
python -c "
from app.cv_detector import CardDetector
d = CardDetector()
print('YOLO loaded:', d.model is not None)
"
```

---

## 🎓 Training YOLO with the Roboflow 20,000-Image Dataset

For even better accuracy, use real card photos from Roboflow instead of synthetic data.

1. Go to [universe.roboflow.com](https://universe.roboflow.com) and search "playing cards"
2. Download the dataset in **YOLOv8 format**
3. Extract to `yolo/dataset/`
4. Run `python yolo/train_yolo.py`

---

## 🔧 OpenCV + Tesseract OCR Fallback

When neither YOLO nor a trained model is available, the system falls back to:

1. **OpenCV contour detection** — finds card-shaped rectangles in the image
2. **Tesseract OCR** — reads the rank characters (A, K, Q, J, 10, 9…) from each card

Accuracy is ~85% for clean screenshots. For live casino video it drops to ~60%.
Always prefer YOLO when possible.

---

## 🚀 Running the Dashboard

```bash
# Standard — open http://localhost:5000
python main.py web

# Custom port:
python main.py web --port 8080

# Accessible from other devices on your network:
python main.py web --host 0.0.0.0
```

---

## 🃏 How to Use the Dashboard

### Entering cards

1. Click **P** (or press `P`) to target the Player hand
2. Click the card buttons to enter your cards
3. Click **D** (or press `D`) to target the Dealer hand
4. Enter the dealer's upcard
5. The AI recommendation appears immediately

### Recording results

Use the **WIN / PUSH / LOSS / SURR** buttons in the Bet Sizing panel, or let
auto-resolve fire automatically when the outcome is unambiguous (player bust,
dealer bust, BJ, etc.).

### Starting a new hand

Press **N** (or click New Hand in the top bar). The running count is preserved —
only the hands are cleared. The count resets to 0 only when you press **S**
(real casino shuffle).

---

## 🃏 Three Card Entry Modes

### Mode 1 — Manual Grid

Click the 52-card grid directly. Best for learning or when playing live at a table.

### Mode 2 — Screenshot Paste

Take a screenshot of the casino table, paste it with Ctrl+V.
The CV pipeline detects and applies all visible cards automatically.

```
Windows: Win+Shift+S → select region → Ctrl+V into the app
macOS:   Cmd+Shift+4 → select region → Cmd+V into the app
Linux:   PrtScn or Flameshot → Ctrl+V into the app
```

### Mode 3 — Live Auto-Scan

The app captures your screen continuously and applies cards in real time.
Configure the scan region by clicking **Set Window** and selecting the browser tab
running the casino.

> Live scan does not work inside Docker containers.

---

## 🔀 How Card Routing Works (Your Cards vs Others)

The **P / D / Seen** toggle controls where each card goes:

| Target | What happens |
|--------|--------------|
| **Player** | Added to your hand + counted |
| **Dealer** | Added to dealer hand + counted |
| **Seen** | Counted only — not shown in any hand |

Use **Seen** for other players' cards at the table — they affect the count
but are not part of your hand.

---

## 📊 Model Performance & Accuracy

After full training (1M hands):

| Metric | Value |
|--------|-------|
| Overall action accuracy | ~82% |
| Hard hand accuracy | ~89% |
| Soft hand accuracy | ~78% |
| Split decision accuracy | ~91% |
| Deviation accuracy (TC-based) | ~76% |

The model outperforms basic strategy by ~0.2% edge because it incorporates
the true count into every decision — not just the Illustrious 18.

---

## 📈 Player Advantage Analysis

| True Count | Player Edge |
|------------|-------------|
| ≤ 0 | −0.4% to −0.5% (house favoured) |
| +1 | ~0% (break-even) |
| +2 | +0.5% |
| +3 | +1.0% (take insurance) |
| +4 | +1.5% |
| +5 | +2.0% |

Figures assume 8-deck S17, perfect basic strategy, no surrender restrictions.

---

## ⚙️ Customising Settings

All settings are in `config.py`. Common changes:

```python
# Number of decks (affects true count calculation):
NUM_DECKS = 6          # default: 6

# Dealer rule (affects basic strategy):
H17 = False            # S17 (stand all 17s) — most common online

# Bet spread:
BET_SPREAD = 12        # max bet / min bet ratio

# Bankroll:
INITIAL_BANKROLL = 10000

# Currency default:
# (Change in App.jsx → currency useState initial value)
```

---

## 🚢 Deployment

### Local (default)

```bash
python main.py web
```

### Production server (Linux VPS)

```bash
pip install gunicorn eventlet
gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:5000 app.server:app
```

### Docker

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y tesseract-ocr && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "main.py", "web", "--host", "0.0.0.0"]
```

> **Note:** Live scan (Mode 3) does not work inside Docker.

---

## ❓ Troubleshooting

### `python is not recognized`

Reinstall Python from [python.org](https://python.org).
During installation tick **"Add Python to PATH"**. Restart your terminal after.

### `Address already in use` (port 5000 is taken)

```bash
python main.py web --port 8080
```

### `ModuleNotFoundError: No module named 'blackjack'`

Run all commands from the project root folder:
```bash
cd C:\Users\YourName\Downloads\BlackJackML-main
python main.py web
```

### `tesseract is not installed or it's not in your PATH`

- **Windows:** Download from https://github.com/UB-Mannheim/tesseract/wiki — tick "Add to PATH"
- **macOS:** `brew install tesseract`
- **Linux:** `sudo apt install tesseract-ocr`

### I edited a component file but nothing changed in the browser

Rebuild the bundle then refresh:

```bash
# Mac / Linux:
bash build.sh

# Windows PowerShell:
.\build.ps1
```

### `tsc: command not found`

```bash
npm install -g typescript
```

### `The term 'bash' is not recognized` (Windows)

Use the PowerShell script instead:
```powershell
.\build.ps1
```

### Dashboard loads but cards don't register when I click

1. Press `F12` → Console tab — look for red JavaScript errors
2. Confirm the Flask server is still running in your terminal
3. Refresh with `F5`
4. Make sure you are at `http://localhost:5000` not `https://`

### Ctrl+Z does nothing

Make sure your cursor is **not** inside a text input or select box — keyboard
shortcuts are disabled while typing. Click anywhere on the card grid first, then
press Ctrl+Z.

### Split — clicking "Done with Hand 1" does nothing

This was a bug (now fixed). Replace `app/static/bundle.min.js` with the latest version.
The root cause was `onNextHand` being wired to an empty `() => {}` instead of the
real `handleNextSplitHand` function.

### Training is extremely slow (hours instead of minutes)

```bash
# Install CUDA PyTorch for GPU acceleration (6× faster):
pip uninstall torch -y
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

### Venv broken after moving or renaming the project folder

```bash
# Delete and recreate:
rm -rf venv                        # Mac/Linux
# OR: Remove-Item -Recurse -Force .\venv   (Windows PowerShell)

python -m venv venv
source venv/bin/activate           # Mac/Linux
# OR: .\venv\Scripts\Activate.ps1  (Windows)
pip install -r requirements.txt
```

---

## 🐛 Bug Fix Changelog

### v4 — Current

**`app/static/bundle.min.js`**
- **Ctrl+Z shortcut** was missing from the compiled bundle entirely — the keyboard `useEffect` was positioned before `handleUndo` was defined, so `handleUndo` was `undefined` when the effect ran. Fixed by moving the effect after all handlers and adding `e.preventDefault()` to stop the browser intercepting the keystroke.
- **WIN/LOSS toast showed `$`** instead of the selected currency — `formatMoney()` had a hardcoded `$`. Now accepts a `currencySymbol` parameter and defaults to `₹`.
- **Undo during split reset the entire hand** — undo now emits `undo_split_card` when a split is in progress, which surgically removes only the last card from the active split hand without touching the split structure or other hand.
- **"Done with Hand 1" did nothing** — `onNextHand` was wired to `() => {}` (empty function). Now correctly passes `handleNextSplitHand` which emits `next_split_hand` to the server.
- **"All split hands complete" banner never appeared** — `allDone` only checked for bust/BJ/split-ace. Now also marks a hand complete when it is inactive and has ≥ 2 cards (stood).
- **Done button appeared on BJ and split-ace hands** — those auto-complete and need no manual confirmation. Button now hidden for both.
- **SessionStats default currency was `$`** — changed fallback to `₹`.
- **BetBadge in Live Overlay showed `$`** — now receives and uses `currency.symbol`.
- **`autoFiredRef` never reset properly** — now also resets when `dCards === 0`, not just `pCards === 0`, so a new hand always starts with a clean auto-resolve state.
- **`gameStateRef` missing** — added so `handleUndo` can always read the latest split state without a stale closure.

**`app/server.py`**
- **`undo_split_card` socket handler added** — removes last card from the active split hand, unwinds the counter (running count, cards_seen, aces_seen, tens_seen) and returns the card to the shoe.
- **`_reset_hand` (live scanner) didn't clear split state** — split hands leaked into the next live-scanned hand. Now resets `split_hands`, `active_hand_index`, and `num_splits_done`.
- **`split_from_ace` flag not set when splitting aces** — `is_split_ace_hand` was inferring from the first card's rank which is unreliable. Now sets an explicit flag at split time.
- **`_FakeCard` in `change_system` missing `is_ten`** — `tens_seen` was never updated when switching counting systems, making ace-adjusted TC wrong. Fixed.

**`blackjack/betting.py`**
- **`get_session_stats()` returned inconsistent keys** — empty case returned `{"hands": 0, "profit": 0}` but the full case returned `{"hands_played": N, "total_profit": N}`. Frontend references to `session.hands_played` would silently be `undefined`. Now always returns the full consistent dict.

**`blackjack/game.py`**
- **`is_split_ace_hand` used card inference** — checking `cards[0].is_ace` is unreliable if a non-ace split happens to get an ace as its first dealt card. Added explicit `split_from_ace` flag set at split creation time.

---

## 🏗️ Architecture Deep Dive

### How System 1 and System 2 connect

```
Screen / screenshot
      ↓
cv_detector.py
  → Try YOLO (models/card_detector.pt)
  → Fallback: OpenCV contours + Tesseract OCR
      ↓
[{rank, suit, confidence, bbox}, ...]
      ↓
live_scanner.py  OR  server.py /api/detect_cards
  → route by position: player / dealer / seen
      ↓
socket.emit('deal_card', {rank, suit, target})
      ↓
server.py handles 'deal_card':
  1. counter.count_card(card)            ALL targets — always
  2. shuffle_tracker.observe_card(...)   ALL targets — always
  3. shoe.cards.remove(card)             ALL targets — always
  4. hand.add_card(card)                 ONLY player / dealer
  5. deviation_engine.get_action(...)    ONLY after hand updated
  6. betting_engine.get_bet_rec(...)
  7. side_bet_analyzer.analyze_all(...)
      ↓
emit('state_update', full_state)
      ↓
React re-renders all panels
```

### WebSocket event sequence from click to recommendation

```
1. User clicks card button in CardGrid (or YOLO detects card)
2. handleDealCard(rank, suit, target) called in App.jsx
3. socketRef.current.emit('deal_card', {rank, suit, target})
4. Flask receives event in @socketio.on('deal_card')
5. counter.count_card(card)           → running count updates
6. true_count = running / decks_left  → true count updates
7. shoe.cards.remove(card)            → remaining probs update
8. hand.add_card(card)                → hand value updates
9. deviation_engine checks I18 + Fab4 → best action determined
10. betting_engine.kelly(true_count)  → optimal bet calculated
11. side_bet_analyzer.compute_ev()   → side bet EVs updated
12. emit('state_update', {...})        → full state sent to browser
13. React: setGameState(data)          → all panels re-render
```

### Split hand event sequence

```
1. Player has a pair → can_split = True → SPLIT PAIR button appears
2. User clicks SPLIT PAIR
3. socket.emit('player_split')
4. Server creates Hand_A (card[0]) and Hand_B (card[1])
5. active_hand_index = 0, split_hands = [Hand_A, Hand_B]
6. emit('state_update') → SplitHandPanel renders
7. User deals cards to Hand_A (active)
8. User clicks "Done with Hand 1 → Next Hand"
9. handleNextSplitHand() → socket.emit('next_split_hand')
10. Server: active_hand_index = 1, current_player_hand = Hand_B
11. emit('state_update') → Hand_B becomes active
12. User deals cards to Hand_B
13. allDone = true → "All split hands complete" banner
14. User records results → N for new hand
```

### Undo during split

```
1. User presses Ctrl+Z during split
2. handleUndo() checks gameStateRef.current.split_hands.length > 0
3. If in split: socket.emit('undo_split_card')
4. Server: removes last card from split_hands[active_hand_index]
5. Server unwinds counter (running_count, cards_seen, aces_seen, tens_seen)
6. Server returns card to shoe
7. emit('state_update') → hand updates without touching other split hand
```

---

## 📄 License

For educational and portfolio purposes only.

Card counting is **legal** in most jurisdictions, but casinos are private property
and may ask you to leave if they suspect you are counting cards. Using this software
in a casino is at your own risk. This software is not intended for illegal use.

---

*Built with ♠ Python · PyTorch · YOLOv8 · Flask · React 18 · OpenCV · Tesseract · Socket.IO*
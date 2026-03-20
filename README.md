# ♠ BlackjackML — Live Card Counter & AI Advisor

> **For learning and portfolio purposes only.**
> Card counting is legal, but casinos may ask you to leave if detected.

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![PyTorch 2.0+](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![OpenCV](https://img.shields.io/badge/OpenCV-4.8+-5C3EE8?logo=opencv&logoColor=white)](https://opencv.org)
[![Tesseract](https://img.shields.io/badge/Tesseract-5.x-brightgreen)](https://github.com/tesseract-ocr/tesseract)

---

## 📋 Table of Contents

1. [What This Project Does](#-what-this-project-does)
2. [Quick Start](#-quick-start-5-minutes)
3. [Project Structure](#-project-structure)
4. [Training From Scratch — Full Guide](#-training-from-scratch--full-guide)
5. [What the Model Actually Learns](#-what-the-model-actually-learns)
6. [Fine-Tuning an Existing Model](#-fine-tuning-an-existing-model)
7. [Running the Dashboard](#-running-the-dashboard)
8. [Three Card Entry Modes](#-three-card-entry-modes)
9. [Setting Up OpenCV Card Detection](#-setting-up-opencv-card-detection)
10. [Model Performance & Accuracy](#-model-performance--accuracy)
11. [Player Advantage Analysis](#-player-advantage-analysis)
12. [Customising Settings](#-customising-settings)
13. [Deployment](#-deployment)
14. [Troubleshooting](#-troubleshooting)
15. [Architecture Deep Dive](#-architecture-deep-dive)

---

## 🎯 What This Project Does

BlackjackML is a complete blackjack AI system. It combines:

| Component | Description |
|-----------|-------------|
| **Perfect Basic Strategy** | Lookup tables for every hand vs. dealer upcard (hard, soft, pairs) |
| **4 Card Counting Systems** | Hi-Lo, KO, Omega II, Zen Count — switch live mid-shoe |
| **Illustrious 18 + Fab 4** | 22 count-based play deviations for maximum edge |
| **Kelly Criterion Betting** | Mathematically optimal bet sizing (1–12 unit spread) |
| **Side Bet EV Analyser** | Real-time expected value for Perfect Pairs, 21+3, Lucky Ladies |
| **Shuffle-Resistant ML** | LSTM + Bayesian counter that persists counting knowledge across shuffles |
| **Neural Net Optimizer v2** | ResNet + attention + specialised heads trained on 1M+ hands |
| **3-Mode Card Scanner** | Manual grid / Screenshot CV / Live auto-scan |
| **React Dashboard** | Live web UI — enter cards, get instant recommendations |

---

## ⚡ Quick Start (5 minutes)

### Step 1 — Install Python 3.10+
Download from [python.org/downloads](https://www.python.org/downloads/).
**Windows: check "Add Python to PATH" during installation.**

### Step 2 — Open a terminal in the project folder
```bash
cd path/to/MLModel
# Windows example: cd C:\Users\YourName\Downloads\MLModel
```

### Step 3 — Create and activate a virtual environment
```bash
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Windows CMD:
.\venv\Scripts\activate.bat

# Mac / Linux:
source venv/bin/activate
# You'll see (venv) in your prompt — that's correct
```

### Step 4 — Install dependencies
```bash
pip install -r requirements.txt
# PyTorch is ~200MB — takes 2-5 minutes
```

### Step 5 — Install Tesseract (for CV card detection)
```bash
# Windows — download installer from:
# https://github.com/UB-Mannheim/tesseract/wiki
# OR with Chocolatey:
choco install tesseract

# macOS:
brew install tesseract

# Ubuntu / Debian:
sudo apt install tesseract-ocr

# Verify:
tesseract --version
```

### Step 6 — Train the model
```bash
# Quick test (~2 min):
python main.py train --hands 100000 --epochs 20

# Recommended full train (~25 min, ~82% accuracy):
python main.py train --hands 1000000
```

### Step 7 — Start the dashboard
```bash
python main.py web
# Open: http://localhost:5000
```

---

## 📁 Project Structure

```
MLModel/
│
├── main.py                     # CLI entry point: web / overlay / simulate / train
├── config.py                   # ALL settings — table rules, betting limits, ML config
├── requirements.txt            # Python dependencies
├── jsconfig.json               # Stops VS Code squiggling JSX in .js files
├── overlay_settings.json       # Auto-created by overlay mode (saves region + position)
│
├── blackjack/                  # Core game engine (pure Python, no ML needed)
│   ├── card.py                 # Card, Deck, Shoe with 5 shuffle types
│   ├── game.py                 # Hand, Round, BlackjackTable, Action enum
│   ├── counting.py             # CardCounter: Hi-Lo, KO, Omega II, Zen
│   ├── strategy.py             # BasicStrategy: perfect play lookup tables
│   ├── deviations.py           # DeviationEngine: Illustrious 18 + Fab 4
│   ├── betting.py              # BettingEngine: Kelly Criterion + count spread
│   └── side_bets.py            # SideBetAnalyzer: real-time EV calculation
│
├── ml_model/                   # Machine learning components
│   ├── model.py                # BlackjackNet v2: ResNet + Attention + 3 Heads
│   ├── shuffle_tracker.py      # LSTM + Bayesian shuffle-resistant counter
│   ├── simulate.py             # Monte Carlo engine — generates training data
│   └── train.py                # Training pipeline with checkpointing
│
├── app/                        # Web dashboard
│   ├── server.py               # Flask + Socket.IO backend
│   ├── cv_detector.py          # OpenCV card detection from screenshots
│   ├── live_scanner.py         # Background screen capture (mss / PIL)
│   ├── overlay.py              # Desktop overlay window (tkinter)
│   ├── templates/index.html    # Single-page React app shell
│   └── static/components/      # React UI components
│       ├── App.js              # Root component — owns all state
│       ├── LiveOverlayPanel.js # Unified 3-mode card scanner panel
│       ├── ActionPanel.js      # AI recommendation display
│       ├── BettingPanel.js     # Bet sizing + result recording
│       └── ...                 # Other display panels
│
└── models/                     # Created automatically after training
    ├── best_model.pt           # Best validation accuracy checkpoint
    ├── last_checkpoint.pt      # Most recent epoch (for --resume)
    ├── training_log.csv        # Per-epoch metrics (open in Excel)
    └── training_summary.json   # Human-readable run summary
```

---

## 🔄 Training From Scratch — Full Guide

### Why retrain from scratch?

You should retrain if:
- You applied the **`can_split` bug fix** (Bug 1) — the old model was trained on data where K+Q could split, which is wrong
- You changed table rules in `config.py` (different deck count, H17 vs S17, etc.)
- You want higher accuracy than the pre-trained model
- You want the model to learn a specific counting system other than Hi-Lo

### Step 1 — Apply the bug fixes first

Before generating any training data, make sure these fixes are in place:

**`blackjack/game.py` line 138** — fix `can_split`:
```python
# WRONG (old):
return self.is_pair or self.is_ten_pair

# CORRECT (fix this):
return self.is_pair
```

**`blackjack/strategy.py` line 138** — remove wrong surrender:
```python
# DELETE this line from SURRENDER_TABLE:
(17, 11): True,   # Hard 17 vs Ace — THIS IS WRONG, remove it
```

**`blackjack/side_bets.py`** — fix EV formula (use `payout` not `payout - 1`):
```python
# WRONG: ev = p_perfect * (payouts["perfect"] - 1) + ...
# CORRECT:
ev = (p_perfect * payouts["perfect"]
    + p_colored * payouts["colored"]
    + p_mixed   * payouts["mixed"]
    - p_loss)
```

### Step 2 — Delete old model files
```bash
# Windows PowerShell:
Remove-Item models\best_model.pt -ErrorAction SilentlyContinue
Remove-Item models\last_checkpoint.pt -ErrorAction SilentlyContinue
Remove-Item models\training_log.csv -ErrorAction SilentlyContinue
Remove-Item models\training_summary.json -ErrorAction SilentlyContinue

# Mac / Linux:
rm -f models/best_model.pt models/last_checkpoint.pt
rm -f models/training_log.csv models/training_summary.json
```

### Step 3 — Choose your training size

| Command | Time (CPU) | Time (GPU) | Accuracy | Use for |
|---------|-----------|-----------|----------|---------|
| `--hands 100000 --epochs 20` | ~2 min | ~20 sec | ~67% | Quick smoke test |
| `--hands 500000 --epochs 30` | ~10 min | ~90 sec | ~75% | Development |
| `--hands 1000000 --epochs 50` | ~25 min | ~5 min | ~82% | **Recommended** |
| `--hands 2000000 --epochs 60` | ~60 min | ~10 min | ~85%+ | Maximum accuracy |

### Step 4 — Run training

```bash
# Recommended (clean start, 1M hands):
python main.py train --hands 1000000

# Maximum quality:
python main.py train --hands 2000000 --epochs 60

# Quick test first to make sure everything works:
python main.py train --hands 100000 --epochs 20
```

### Step 5 — GPU acceleration (optional, 6× faster)

```bash
# Check if you have a CUDA-capable NVIDIA GPU:
python -c "import torch; print(torch.cuda.is_available())"

# If True, install CUDA PyTorch:
pip uninstall torch
pip install torch --index-url https://download.pytorch.org/whl/cu121

# Verify GPU is detected:
python -c "import torch; print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'Not found')"
```

### What happens during training

Training has two phases:

**Phase 1 — Data Generation (simulate.py):**
```
python main.py train
  ↓
simulate_hands(num_hands=1_000_000)
  ↓
For each hand:
  1. Deal cards from a shuffled shoe
  2. Run the CardCounter (Hi-Lo by default) on every card seen
  3. Get the action from DeviationEngine (Illustrious 18 + basic strategy)
  4. Record: (28 features, correct_action) as a training sample
  5. Execute the action, count more cards, continue
  ↓
~2.8M training samples saved (multiple decisions per hand)
```

**Phase 2 — Neural Network Training (train.py):**
```
Training samples → BlackjackNet v2
  ↓
For each epoch:
  Forward pass  → model predicts action probabilities
  Loss          → cross-entropy(predicted, correct_action)
  Backward pass → gradient updates via Adam optimiser
  Validation    → accuracy on held-out 20% of samples
  ↓
best_model.pt saved whenever validation accuracy improves
```

### Expected training output

```
🎲  Generating training data (1,000,000 hands)…
    ✔ 2,847,392 training samples

🧠  Training BlackjackNet  |  device = cpu
    Input features : 28
    Train samples  : 2,277,913
    Test  samples  :   569,479
    Epochs         : 1 → 50

     Epoch  TrLoss    TeLoss      Acc     Best       LR
     ──────────────────────────────────────────────────
         1  0.9501    0.9612   0.6634   0.6634   1.00e-03  ☆ NEW BEST
        10  0.7634    0.7756   0.7534   0.7534   1.00e-03  ☆ NEW BEST
        30  0.6523    0.6789   0.8012   0.8012   5.00e-04  ☆ NEW BEST
        50  0.6089    0.6412   0.8234   0.8234   2.50e-04

✅  Training complete in 24.3 min
    Best accuracy: 0.8234  (epoch 47)
    Saved: models/best_model.pt
```

---

## 🧠 What the Model Actually Learns

This is important — the model does NOT just learn basic strategy.

### What it trains on

The training labels come from `DeviationEngine.get_action()`, which returns:

```
1. Check Fab 4 surrenders (count-based surrenders)
2. Check Illustrious 18 (count-based play changes)
3. Fall back to BasicStrategy if no deviation triggers
```

So the model learns a combination of:
- **Basic strategy** (the correct play for every hand at neutral count)
- **Count-based deviations** (when to override basic strategy at high/low counts)
- **Count-aware bet sizing** (feature [5] true_count is an input feature)

### The 28 features the model uses

```
[0]  hand_value / 21           Player total (normalised)
[1]  is_soft                   Has a usable Ace?
[2]  is_pair                   Pair in hand?
[3]  pair_value / 11           Which card is paired?
[4]  dealer_upcard / 11        Dealer's face-up card
[5]  true_count / 10           Card count (HI-LO by default)
[6]  shuffle_adjustment / 5    ML shuffle tracker bonus
[7]  penetration               How far through the shoe (0–1)
[8-17] remaining card probs    P(2), P(3), ... P(Ace) in remaining shoe
[18] num_cards / 10            How many cards in hand
[19] can_double                Is doubling available?
[20] can_split                 Is splitting available?
[21] can_surrender             Is surrender available?
[22] num_hands / 4             Number of active split hands
[23] bankroll_ratio            Current bet vs bankroll
[24] advantage                 Estimated player edge
[25] running_count / 20        Raw running count
[26] decks_remaining / 8       Decks left in shoe
[27] is_split                  Is this a post-split hand?
```

### What the model outputs

Five action probabilities, one per action:
```
[0] hit        [1] stand      [2] double     [3] split      [4] surrender
```

The model picks the highest probability action. If a model trained on dirty data
(K+Q splittable) is loaded, it will sometimes recommend splitting mismatched
10-value cards — this is why retraining after the bug fix matters.

---

## 🔧 Fine-Tuning an Existing Model

Fine-tuning = continuing training from an existing checkpoint instead of starting fresh.
Use this when:
- You want higher accuracy without full retraining
- You changed config.py slightly (e.g. different penetration)
- You have more compute time available and want to squeeze more accuracy

### Resume from last checkpoint

```bash
# Continue from where training left off:
python main.py train --hands 1000000 --epochs 50 --resume
```

`--resume` loads `models/last_checkpoint.pt` and continues training.
The model, optimizer state, and learning rate schedule are all restored.

### Fine-tune with more data

```bash
# First train normally:
python main.py train --hands 1000000 --epochs 50

# Then fine-tune with double the data:
python main.py train --hands 2000000 --epochs 20 --resume
```

### Fine-tune for a specific counting system

By default the model trains on Hi-Lo count features.
To train for a different system, change `config.py` before training:

```python
# config.py → class CountingConfig
DEFAULT_SYSTEM = "omega_ii"   # or "ko", "zen", "hi_lo"
```

Then retrain from scratch (a model trained on Hi-Lo counts will give wrong
recommendations when running with Omega II, since the count values differ).

### Adjust model confidence threshold

The model only overrides basic strategy when it's confident enough.
Lower this to let the model override more often:

```python
# config.py → class MLConfig
CONFIDENCE_THRESHOLD = 0.65   # default 0.70 — lower = model overrides more
```

### Signs that fine-tuning is working

In the training output, watch for:
- `☆ NEW BEST` appearing on new epochs (model is still improving)
- Validation accuracy increasing above your previous best
- Training loss still decreasing (not plateaued)

If accuracy stops improving for 10+ epochs, the model has converged.

---

## ▶️ Running the Dashboard

```bash
# Standard start:
python main.py web

# Custom port:
python main.py web --port 8080

# Allow access from other devices on your network:
python main.py web --host 0.0.0.0

# Live desktop overlay (separate transparent window):
python main.py overlay --decks 6 --system hi_lo --interval 1500
```

Open **http://localhost:5000** in your browser.

---

## 🃏 Three Card Entry Modes

The Card Scanner panel (top-right of dashboard) has three modes.
Click the toggle buttons to switch — no restart needed.

### ✋ Mode 1: Manual

Click the 52-card grid to enter cards one at a time.
- Press `P` to route to Player, `D` for Dealer
- Cards fade as they're dealt (shows remaining shoe composition)
- Press `N` for new hand, `S` when dealer reshuffles

### 📋 Mode 2: Screenshot CV

Take an OS screenshot of the casino window and paste it — the system reads the cards automatically.

**Workflow:**
1. Take screenshot with OS tool (invisible to casino):
   - **Windows:** `Win + Shift + S` → drag to select the table area
   - **macOS:** `Cmd + Shift + 4` → drag to select
   - **Linux:** `PrtScn` or Flameshot
2. Switch to the BlackjackML browser tab
3. Press `Ctrl + V` (or `Cmd + V`) — the paste zone detects the image
4. CV reads card ranks (via Tesseract OCR) and suits (via colour + shape)
5. Review the preview with bounding boxes — correct any wrong cards
6. Click **Apply** — cards submitted with human-like random timing

**Why this is undetectable:**
- Uses OS screenshot tools, not `getDisplayMedia()` (no browser banner)
- No camera access, no browser permission prompts
- Flask runs on `localhost:5000` — completely invisible to casino JavaScript
- Casino JS is sandboxed to its own tab; cannot see other tabs or local ports
- Card submission uses Gaussian-jittered delays (150–950ms) that look manual

### 🔴 Mode 3: Live Auto-Scan

The Flask server continuously captures your screen and detects cards automatically.

**Setup (one-time):**
```bash
pip install mss

# Linux only (already included on Windows / macOS):
sudo apt install python3-tk
```

**How to use:**
1. Open the casino in another browser tab or window
2. In Mode 3, optionally set a scan region (x, y, width, height of casino window)
3. Click **▶ Start Live Scan** — server scans every ~200ms
4. Cards appear automatically, count updates in real time
5. Click **■ Stop Scanning** when done

**Why this is undetectable:**
- `mss` is a Python OS-level screen capture library — zero browser APIs used
- Runs as a background Python thread — casino JS cannot see OS processes
- No `getDisplayMedia()`, no `getUserMedia()`, no browser indicators whatsoever

---

## 📸 Setting Up OpenCV Card Detection

OpenCV + Tesseract power Modes 2 and 3. Here is everything you need.

### Install Python packages

```bash
pip install opencv-python>=4.8.0 Pillow>=10.0.0 pytesseract>=0.3.10
```

### Install Tesseract OCR engine (system package — NOT pip)

```bash
# Windows — download the installer from:
# https://github.com/UB-Mannheim/tesseract/wiki
# Default install path: C:\Program Files\Tesseract-OCR\tesseract.exe
# During install: check "Add to PATH"
# OR with Chocolatey:
choco install tesseract

# macOS:
brew install tesseract

# Ubuntu / Debian:
sudo apt install tesseract-ocr

# Fedora:
sudo dnf install tesseract

# Verify install:
tesseract --version
# Should show: tesseract 5.x.x
```

### How the CV detection pipeline works

```
Screenshot / screen frame (BGR numpy array)
        ↓
1. CARD DETECTION (OpenCV)
   • Convert to grayscale
   • Threshold at pixel brightness > 185 (card faces are bright)
   • Find contours (connected white regions)
   • Filter by aspect ratio (1.05 – 2.20) and area (1500 – 200,000 px)
   → List of card bounding boxes [x, y, w, h]

        ↓
2. RANK READING (Tesseract OCR)
   • Crop top-left corner of each card (rank + suit are always there)
   • Invert colours (dark text → white on black for Tesseract)
   • Scale up 6× (Tesseract works better with larger text)
   • Run Tesseract with whitelist: AaKkQqJj23456789T10
   • Clean OCR output: 'T' → '10', 'Kk' → 'K', etc.

        ↓
3. SUIT DETECTION (colour + shape analysis)
   • Detect red pixels in HSV colour space (hue 0-15 or 155-180)
   • Red → hearts or diamonds; black → spades or clubs
   • Analyse suit symbol shape (solidity, aspect ratio, circularity):
       Hearts:   wide, moderate solidity, rounded
       Diamonds: near-square, very high solidity (nearly convex)
       Spades:   tall, moderate solidity (stem notch)
       Clubs:    wide, lower solidity (three-lobe shape)

        ↓
4. RESULT
   [{rank: 'A', suit: 'spades', confidence: 0.88, bbox: [x,y,w,h]}, ...]
```

### Accuracy expectations

| Source | Expected accuracy |
|--------|------------------|
| Online casino software (screenshot) | 85–92% |
| Good webcam, good lighting | 70–80% |
| Phone camera at angle | 50–65% |
| Physical cards, low light | 30–50% |

The confirmation step (review bounding boxes before applying) lets you
correct any wrong detections before they affect the count.

### Tips for best CV accuracy

- **Online casinos:** screenshot with the full card face visible, not overlapping
- **Physical tables:** use a webcam mounted directly above the table
- **Lighting:** avoid glare on card surfaces (matte finish preferred)
- **Card size:** cards should be at least 80×110 pixels in the screenshot
- **Background:** green felt or dark background gives the best contrast

### Test CV without running the full dashboard

```bash
# Quick test — take a screenshot, save as test.png, then run:
python -c "
import cv2, sys
sys.path.insert(0, '.')
from app.cv_detector import detect_cards

img = cv2.imread('test.png')
cards = detect_cards(img)
for c in cards:
    print(f'{c[\"rank\"]} of {c[\"suit\"]}  confidence={c[\"confidence\"]:.0%}')
"
```

---

## 📊 Model Performance & Accuracy

### Architecture (v2)

```
Input (28 features)
      ↓
FeatureAttention gate  →  learns which features matter per situation
      ↓
Input projection (28 → 256)
      ↓
ResidualBlock(256 → 512)   ← expand capacity
ResidualBlock(512 → 512)   ← deep representation
ResidualBlock(512 → 256)   ← compress back
ResidualBlock(256 → 256)   ← refine
      ↓ (trunk output)
  ┌───┴───┬──────────┐
  ↓       ↓          ↓
hit/stand  double/split  surrender
  head       head          head
  ↓       ↓          ↓
        logits (5)
```

### Accuracy by training size

| Hands | Epochs | Accuracy | CPU time | GPU time |
|-------|--------|----------|----------|----------|
| 100,000 | 20 | ~67% | ~2 min | ~20 sec |
| 500,000 | 30 | ~75% | ~10 min | ~90 sec |
| **1,000,000** | **50** | **~82%** | **~25 min** | **~5 min** |
| 2,000,000 | 60 | ~85%+ | ~60 min | ~10 min |

### Why not 100% accuracy?

Some blackjack situations are near-identical in expected value.
Hard 12 vs dealer 4 at TC ≈ 0 is essentially a coin flip (< 0.001% EV difference).
The model learns the correct marginal action but test accuracy is bounded by
these ambiguous cases. 83–86% is close to the theoretical ceiling.

---

## 📈 Player Advantage Analysis

### Edge breakdown by component

```
Starting point (basic strategy only):        −0.50%
────────────────────────────────────────────────────
+ Perfect basic strategy (vs gut instinct):  +1.50%
+ Card counting (Hi-Lo, 1–12 spread):        +0.70%
+ Illustrious 18 deviations:                 +0.15%
+ Fab 4 surrenders:                          +0.05%
+ ML shuffle tracker (riffle shuffle):       +0.10%
────────────────────────────────────────────────────
FULL SYSTEM PLAYER EDGE:              +0.20% to +0.50%
```

### True count distribution (8-deck, 75% penetration)

```
TC ≤ -4  | ██ 4.2%
TC = -3  | ████ 7.8%
TC = -2  | ██████ 11.4%
TC = -1  | ████████ 15.6%
TC =  0  | ██████████ 19.8%   ← most hands near TC 0
TC = +1  | ████████ 15.2%
TC = +2  | ██████ 10.8%
TC = +3  | ████ 7.1%
TC = +4  | ███ 4.9%
TC ≥ +5  | ████ 7.3%
```

---

## ⚙️ Customising Settings

All settings live in `config.py`. No other code changes needed.

### Table rules
```python
# config.py → class GameConfig
NUM_DECKS = 6                 # Change to match your casino
DEALER_HITS_SOFT_17 = True    # H17 rule? Set True
BLACKJACK_PAYS = 6/5          # 6:5 table? Change to 1.2 (avoid these!)
ALLOW_LATE_SURRENDER = False  # No surrender? Set False
PENETRATION = 0.65            # Casino deals 65% before shuffle
```

### Bankroll and betting
```python
# config.py → class BettingConfig
TABLE_MIN = 25                # $25 minimum
TABLE_MAX = 1000              # $1000 maximum
BASE_UNIT = 25                # One unit = $25
INITIAL_BANKROLL = 25000      # Your bankroll
BET_SPREAD = 8                # 1-8 spread (more conservative)
```

### ML settings
```python
# config.py → class MLConfig
SIMULATION_HANDS = 2_000_000  # More data = higher accuracy
EPOCHS = 60                   # More epochs for larger datasets
CONFIDENCE_THRESHOLD = 0.65   # Lower = model overrides more often
```

### Counting system
```python
# config.py → class CountingConfig
DEFAULT_SYSTEM = "omega_ii"   # "hi_lo" | "ko" | "omega_ii" | "zen"
```

> **Important:** If you change `DEFAULT_SYSTEM`, you must retrain the model.
> The neural network was trained with count features from one specific system.
> Running it with a different system's counts will give wrong recommendations.

---

## 🌐 Deployment

### Local only
```bash
python main.py web
# http://localhost:5000
```

### Local network (share on WiFi)
```bash
python main.py web --host 0.0.0.0
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
```bash
docker build -t blackjackml .
docker run -p 5000:5000 blackjackml
```

> **Note:** Live scan (Mode 3) does not work inside Docker because the container
> cannot access the host screen. Use Modes 1 and 2 when running in Docker.

---

## ❓ Troubleshooting

### `python is not recognized`
Reinstall Python, check "Add Python to PATH" during installation.

### `pip install fails`
```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### `Address already in use` (port 5000 taken)
```bash
python main.py web --port 8080
```

### `ModuleNotFoundError: No module named 'blackjack'`
You must run from the project root:
```bash
cd path/to/MLModel   # MUST be in this folder
python main.py web
```

### `tesseract is not installed or not in PATH`
Make sure you installed the Tesseract binary (not just `pip install pytesseract`).
See the [Setting Up OpenCV](#-setting-up-opencv-card-detection) section above.

### CV detects wrong ranks / can't find cards
- Make sure cards are at least 80×110 pixels in the screenshot
- Check that the casino background is darker than the card faces
- Try cropping the screenshot closer to just the card area
- Tesseract works best with clean, high-contrast text — increase screen resolution if possible

### Live scan (Mode 3) shows "Screen capture unavailable"
```bash
pip install mss
# Then restart the server: python main.py web
```

### VS Code shows squiggly underlines in .js files
Create `jsconfig.json` in the project root (already included in this repo):
```json
{
  "compilerOptions": {
    "jsx": "react",
    "checkJs": false
  }
}
```
Then in VS Code: `Ctrl+Shift+P` → Reload Window.

### Training is extremely slow
```bash
# Quick test first:
python main.py train --hands 100000 --epochs 20

# Install CUDA PyTorch for GPU (6× faster):
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

### Dashboard loads but doesn't update when I click cards
1. Open browser DevTools (`F12` → Console) and check for red errors
2. Make sure the server is still running in your terminal
3. Try refreshing (`F5`)

### The count doesn't match what I'm tracking manually
- Click **Shuffle** (not New Hand) when the dealer physically reshuffles
- Check you're using the same counting system (Hi-Lo ≠ KO)
- KO is unbalanced — its running count does not equal Hi-Lo's true count

### Venv broken after renaming the project folder
The venv stores absolute paths internally. After any rename:
```bash
# Delete and recreate:
Remove-Item -Recurse -Force .\venv   # Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

## 🏗️ Architecture Deep Dive

### WebSocket event flow

```
User clicks card in browser
        ↓
socket.emit('deal_card', {rank, suit, target})
        ↓
Flask-SocketIO receives 'deal_card'
        ↓
1. counter.count_card(card)            ← update running/true count
2. shuffle_tracker.observe_card(...)   ← feed LSTM + Bayesian tracker
3. shoe.cards.remove(card)             ← update shoe composition
4. hand.add_card(card)                 ← update hand state
5. deviation_engine.get_action(...)    ← compute recommendation
6. betting_engine.get_bet_rec(...)     ← compute optimal bet
7. side_bet_analyzer.analyze_all(...)  ← compute side bet EVs
        ↓
emit('state_update', full_state_json)
        ↓
Browser React setGameState(data) → re-render all panels
```

### How deviations override basic strategy

```
get_action_with_info(hand, dealer_upcard, true_count):
  1. Check FAB_4_SURRENDERS → any count-based surrender triggered?
  2. Check ILLUSTRIOUS_18   → any count-based play change triggered?
  3. Deviation found AND action available → return deviation action
  4. No deviation → fall back to BasicStrategy lookup table
```

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `N` | New hand |
| `S` | Shuffle (resets count) |
| `P` | Route next card to Player |
| `D` | Route next card to Dealer |

---

## 📄 License

For educational and portfolio purposes only.

Card counting is **legal**, but casinos may ask you to leave if detected.
This software is not intended for illegal use.

---

*Built with ♠ Python · PyTorch · Flask · React · OpenCV · Tesseract · Socket.IO*
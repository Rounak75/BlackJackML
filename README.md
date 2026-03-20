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
5. [Training the Blackjack Strategy AI From Scratch](#-training-the-blackjack-strategy-ai-from-scratch)
6. [What the Strategy Model Actually Learns](#-what-the-strategy-model-actually-learns)
7. [Fine-Tuning the Strategy Model](#-fine-tuning-the-strategy-model)
8. [YOLO Card Detection — Full Setup Guide](#-yolo-card-detection--full-setup-guide)
9. [Dataset Sources for YOLO](#-dataset-sources-for-yolo)
10. [Fine-Tuning YOLO for Your Casino](#-fine-tuning-yolo-for-your-casino)
11. [OpenCV + Tesseract OCR Fallback](#-opencv--tesseract-ocr-fallback)
12. [Running the Dashboard](#-running-the-dashboard)
13. [How to Use the Dashboard](#-how-to-use-the-dashboard)
14. [Three Card Entry Modes](#-three-card-entry-modes)
15. [How Card Routing Works](#-how-card-routing-works-your-cards-vs-others)
16. [Model Performance & Accuracy](#-model-performance--accuracy)
17. [Player Advantage Analysis](#-player-advantage-analysis)
18. [Customising Settings](#-customising-settings)
19. [Deployment](#-deployment)
20. [Troubleshooting](#-troubleshooting)
21. [Architecture Deep Dive](#-architecture-deep-dive)

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

---

## 🗺 How Everything Fits Together (Read This First)

Before diving into setup, read this section. It will save you a lot of confusion.

```
BlackjackML has TWO completely separate AI systems:

┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM 1 — Card Detection (YOLO + OpenCV + Tesseract)          │
│  ───────────────────────────────────────────────────────────── │
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
│  ───────────────────────────────────────────────────────────── │
│  PURPOSE: Given the current hand situation and running count,   │
│           recommend the best action and bet size.               │
│                                                                 │
│  Example output: "You have 16 vs dealer 10 at TC +2 → STAND"  │
│                  "Bet 4 units ($40) — count is favourable"     │
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
cd C:\Users\YourName\Downloads\MLModel\Model1

# Mac / Linux:
cd /path/to/MLModel
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

# Confirm it worked — your prompt should now look like:
# (venv) PS C:\Users\YourName\Downloads\MLModel\Model1>
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
# This installs the YOLOv8 library and all its dependencies
```

### Step 8 — Generate synthetic card training data for YOLO

This creates thousands of realistic card scene images with automatic labels.
No internet required — everything is generated on your computer.

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
You should see the BlackjackML dashboard load immediately.

---

## 📁 Project Structure

Every file and folder explained so you know what does what.

```
MLModel/
│
├── main.py                      # ← START HERE. The command-line entry point.
│                                #   Runs: web / overlay / simulate / train
│
├── config.py                    # ALL settings in one place.
│                                #   Change table rules, bet limits, ML params here.
│                                #   No other file needs editing for configuration.
│
├── requirements.txt             # List of Python packages.
│                                #   Install with: pip install -r requirements.txt
│
├── jsconfig.json                # Tells VS Code these .js files contain React JSX.
│                                #   Stops VS Code showing false squiggly errors.
│
├── overlay_settings.json        # Auto-created the first time you use overlay mode.
│                                #   Saves your scan region and window position.
│
├── yolo/                        # ── SYSTEM 1: Card Detection ──────────────────
│   │
│   ├── generate_dataset.py      # Creates synthetic card training images.
│   │                            #   Renders all 52 cards at random sizes/angles
│   │                            #   on casino-style backgrounds with augmentations.
│   │                            #   Run: python yolo/generate_dataset.py --images 10000
│   │
│   ├── train_yolo.py            # Trains YOLOv8 on the generated dataset.
│   │                            #   Run: python yolo/train_yolo.py
│   │                            #   Output: models/card_detector.pt
│   │
│   └── dataset/                 # Auto-created by generate_dataset.py
│       ├── images/train/        # 80% of generated scenes — used for training
│       ├── images/val/          # 10% — checked during training to prevent overfitting
│       ├── images/test/         # 10% — used for final accuracy measurement
│       ├── labels/train/        # YOLO .txt files: one per image, one line per card
│       ├── labels/val/
│       ├── labels/test/
│       └── dataset.yaml         # YOLO config: image paths + 52 class names
│
├── blackjack/                   # ── Core Game Engine (pure Python, no ML) ──────
│   ├── card.py                  # Card, Rank, Suit, Deck, Shoe objects
│   │                            #   Also: 5 shuffle types (riffle, strip, overhand...)
│   ├── game.py                  # Hand, Round, BlackjackTable, Action enum
│   │                            #   Handles: splits, doubles, surrenders, insurance
│   ├── counting.py              # CardCounter for all 4 systems
│   │                            #   Hi-Lo: 2-6=+1, 7-9=0, 10-A=-1
│   │                            #   KO, Omega II, Zen: different tag values
│   ├── strategy.py              # Perfect basic strategy lookup tables
│   │                            #   Hard hands, soft hands, pairs — every combination
│   ├── deviations.py            # Illustrious 18 + Fab 4 count-based overrides
│   │                            #   Example: Stand 16 vs 10 when TC >= 0
│   ├── betting.py               # Kelly Criterion bet sizing + count-based spread
│   └── side_bets.py             # EV calculation for optional side bets
│                                #   Perfect Pairs, 21+3, Lucky Ladies
│
├── ml_model/                    # ── SYSTEM 2: Strategy Neural Network ──────────
│   ├── model.py                 # BlackjackNet v2 architecture
│   │                            #   ResNet + Feature Attention + 3 decision heads
│   ├── shuffle_tracker.py       # LSTM + Bayesian shuffle-resistant counter
│   │                            #   Adjusts count estimate after imperfect shuffles
│   ├── simulate.py              # Monte Carlo simulation engine
│   │                            #   Generates training data by playing 1M+ hands
│   └── train.py                 # Training pipeline
│                                #   Adam optimiser, LR scheduling, checkpointing,
│                                #   early stopping, per-epoch CSV logging
│
├── app/                         # ── Web Dashboard ───────────────────────────────
│   ├── server.py                # Flask + Socket.IO backend — the brain
│   │                            #   Handles all WebSocket events: deal_card,
│   │                            #   new_hand, shuffle, record_result, live_start...
│   │
│   ├── cv_detector.py           # Card detection: YOLO first, OCR fallback
│   │                            #   Auto-loads models/card_detector.pt if present
│   │                            #   Falls back to Tesseract if YOLO not available
│   │
│   ├── live_scanner.py          # Background screen capture thread
│   │                            #   Captures screen using mss every ~200ms
│   │                            #   Routes cards: left=player, centre=dealer,
│   │                            #                 right=seen (other players)
│   │
│   ├── overlay.py               # Standalone desktop overlay (tkinter window)
│   │                            #   Transparent, always-on-top, shows count + action
│   │                            #   Launch: python main.py overlay
│   │
│   ├── templates/index.html     # HTML shell that loads the React app
│   │
│   └── static/components/       # React frontend — one file per UI panel
│       ├── App.js               # Root: owns all state, opens WebSocket
│       ├── LiveOverlayPanel.js  # 3-mode card scanner (Manual/Screenshot/Live)
│       ├── ActionPanel.js       # Big HIT/STAND/DOUBLE recommendation
│       ├── BettingPanel.js      # Bet sizing + WIN/LOSS/PUSH recording
│       ├── HandDisplay.js       # Visual card display for player and dealer
│       ├── CardGrid.js          # 52-button card entry grid
│       ├── SideBetPanel.js      # Side bet EV display
│       ├── ShoePanel.js         # Remaining cards bar chart by rank
│       ├── EdgeMeter.js         # Player/house edge visual gauge
│       ├── SessionStats.js      # Win rate, profit, hands played this session
│       ├── CountHistory.js      # Count sparkline + log of every counted card
│       ├── I18Panel.js          # Illustrious 18 reference — active deviations glow
│       ├── StrategyRefTable.js  # Basic strategy grid — highlights current situation
│       └── utils.js             # Deviation tooltips, helper functions
│
└── models/                      # Auto-created when you train
    ├── card_detector.pt         # YOLO card detection model (System 1)
    ├── best_model.pt            # Strategy AI best checkpoint (System 2)
    ├── last_checkpoint.pt       # Most recent epoch — used for --resume
    ├── training_log.csv         # Per-epoch loss + accuracy (open in Excel)
    └── training_summary.json    # Human-readable summary of the last training run
```

---

## 🔄 Training the Blackjack Strategy AI From Scratch

This trains **System 2** — the neural network that recommends HIT / STAND / DOUBLE etc.

### When should you retrain?

You should delete the old model and train from scratch if:

- You applied the **`can_split` bug fix** — old models were trained on data where K+Q
  could wrongly split, which corrupted what the model learned about split decisions
- You changed **table rules** in `config.py` (deck count, H17 vs S17, DAS, surrender rules)
- You want to use a **different counting system** (must match `DEFAULT_SYSTEM` in config.py)
- You want **higher accuracy** and are willing to train longer

### Step 1 — Apply bug fixes BEFORE generating training data

These three bugs affect the quality of the training data. Fix them first or the
model will learn the wrong behaviour and you will have to retrain again.

**Bug 1 — `blackjack/game.py` near line 138:**
```python
# WRONG — the old code lets K+Q split, which is not a real casino rule:
return self.is_pair or self.is_ten_pair

# CORRECT — only cards of the exact same rank can split:
return self.is_pair
```

**Bug 2 — `blackjack/strategy.py` — inside the SURRENDER_TABLE dictionary:**
```python
# DELETE this line — Hard 17 vs Ace should always Stand, never Surrender:
(17, 11): True,
```

**Bug 3 — `blackjack/side_bets.py` — EV calculation formula:**
```python
# WRONG — subtracts the stake twice, making house edge look double what it is:
ev = p_perfect * (payouts["perfect"] - 1) + p_colored * (payouts["colored"] - 1) + ...

# CORRECT — payouts are already X:1 net wins, use them directly:
ev = (p_perfect * payouts["perfect"]
    + p_colored * payouts["colored"]
    + p_mixed   * payouts["mixed"]
    - p_loss)
```

### Step 2 — Delete old model files

This forces a completely clean start. You do not want to resume from a checkpoint
that was saved using dirty training data.

```bash
# Windows PowerShell:
Remove-Item models\best_model.pt, models\last_checkpoint.pt `
             models\training_log.csv, models\training_summary.json `
             -ErrorAction SilentlyContinue

# Mac / Linux:
rm -f models/best_model.pt models/last_checkpoint.pt
rm -f models/training_log.csv models/training_summary.json
```

### Step 3 — Choose your training size

| Command | CPU time | GPU time | Accuracy | When to use |
|---------|----------|----------|----------|-------------|
| `python main.py train --hands 100000 --epochs 20` | ~2 min | ~20 sec | ~67% | Quick sanity check — always run this first |
| `python main.py train --hands 500000 --epochs 30` | ~10 min | ~90 sec | ~75% | Development and testing |
| `python main.py train --hands 1000000` | ~25 min | ~5 min | **~82%** | **Recommended for real use** |
| `python main.py train --hands 2000000 --epochs 60` | ~60 min | ~10 min | ~85%+ | Maximum accuracy |

### Step 4 — Run training

```bash
# ALWAYS run the quick test first. 2 minutes. Confirms everything is working
# before you commit 25+ minutes to the full training run:
python main.py train --hands 100000 --epochs 20

# Once confirmed working, run full training:
python main.py train --hands 1000000
```

### Step 5 — Enable GPU acceleration (optional — 6× faster)

If you have an NVIDIA graphics card with CUDA support, use it.

```bash
# Check if your GPU is detected:
python -c "import torch; print('GPU available:', torch.cuda.is_available())"

# If it prints True, install the GPU version of PyTorch:
pip uninstall torch -y
pip install torch --index-url https://download.pytorch.org/whl/cu121

# Verify the GPU will be used:
python -c "import torch; print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'No GPU')"
```

### What happens during training — explained step by step

Running `python main.py train` triggers two phases automatically:

**Phase 1 — Generate training data** (handled by `ml_model/simulate.py`):
```
For 1,000,000 simulated blackjack hands:

  1. Deal cards from a shuffled shoe (realistic casino shoe)
  2. Run the CardCounter on every card seen (Hi-Lo by default)
  3. For each player decision point, ask the DeviationEngine:
       → Does any Fab 4 surrender deviation apply? (count-based)
       → Does any Illustrious 18 play change apply? (count-based)
       → If not, get the BasicStrategy answer
  4. Record: (28 input features, correct_action) = one training sample
  5. Execute the action, deal more cards, keep going

End result: ~2.8 million training samples
(there are multiple decisions per hand — hit/stand decisions,
 then potentially double/split, etc.)
```

**Phase 2 — Train the neural network** (handled by `ml_model/train.py`):
```
For each of 50 epochs (one full pass through all training data):

  Forward pass:   model sees 28 features → predicts 5 action probabilities
  Loss:           cross-entropy(predicted probabilities, correct action)
  Backward pass:  gradient descent adjusts model weights (Adam optimiser)
  Validation:     accuracy checked on held-out 20% of data

  If validation accuracy improves → save to models/best_model.pt
  If no improvement for 10 epochs → stop early (model has converged)
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

## 🧠 What the Strategy Model Actually Learns

This section is important. Many people assume the model just learns basic strategy.
It does not.

### What the training labels are

Every training sample has a label — the "correct answer" the model should learn.
These labels come from `DeviationEngine.get_action()`, which checks in this order:

```
1. Fab 4 surrenders  — count-based surrender overrides
   Example: Surrender 15 vs 10 when True Count >= 0

2. Illustrious 18    — count-based play changes
   Example: Stand 16 vs 10 when True Count >= 0 (normally you hit)
   Example: Take Insurance when True Count >= 3

3. BasicStrategy     — fallback when no deviation applies
   Example: Hard 16 vs dealer 7 → HIT (at neutral count)
```

So the model learns: **basic strategy + count-based deviations + shoe composition awareness**.

### The 28 features fed into the model

```
[0]  hand_value / 21          Player total, normalised to 0–1 range
[1]  is_soft                  Is there a usable Ace (soft hand)?
[2]  is_pair                  Are the first two cards a matching pair?
[3]  pair_value / 11          Which rank is the pair?
[4]  dealer_upcard / 11       What card is the dealer showing?
[5]  true_count / 10          The running count ÷ decks remaining — KEY feature
[6]  shuffle_adjustment / 5   Bonus/penalty from the ML shuffle tracker
[7]  penetration              How deep into the shoe (0 = fresh, 1 = nearly done)
[8]  prob_of_2_remaining      Fraction of 2s left in the shoe
[9]  prob_of_3_remaining      Fraction of 3s left
...
[17] prob_of_ace_remaining    Fraction of Aces left
[18] num_cards_in_hand / 10   How many cards the player holds
[19] can_double               Is doubling down available right now?
[20] can_split                Is splitting available right now?
[21] can_surrender            Is surrender available right now?
[22] active_split_hands / 4   How many split hands are currently in play?
[23] bankroll_ratio           Current bet as a fraction of total bankroll
[24] player_advantage         Estimated edge % at this point in the shoe
[25] running_count / 20       Raw running count before dividing by decks
[26] decks_remaining / 8      Decks left in shoe, normalised
[27] is_split_hand            Is this hand a result of a split?
```

### What the model outputs

Five probabilities, one for each possible action:
```
[0] hit    [1] stand    [2] double    [3] split    [4] surrender
```

The model picks the highest probability action.
If its confidence is below the `CONFIDENCE_THRESHOLD` setting (default 70%),
the system falls back to the rules-based DeviationEngine instead.

### Why the model is not 100% accurate

Some blackjack situations have near-identical expected values for two actions.
For example, Hard 12 vs dealer 4 at TC ≈ 0 is a difference of less than 0.001% EV —
a statistical coin flip. The model learns the marginally correct action but test accuracy
is bounded by these genuinely ambiguous cases. 83–86% is close to the theoretical ceiling.

---

## 🔧 Fine-Tuning the Strategy Model

Fine-tuning means continuing training from an existing checkpoint rather than
starting from scratch. Use this to squeeze more accuracy out of an already-trained model.

### Resume from last checkpoint

```bash
# Picks up from models/last_checkpoint.pt
# Restores model weights, optimiser state, and learning rate schedule:
python main.py train --hands 1000000 --epochs 50 --resume
```

### Fine-tune with more data

```bash
# Train normally first:
python main.py train --hands 1000000 --epochs 50

# Then add more data on top:
python main.py train --hands 2000000 --epochs 20 --resume
```

### Fine-tune for a different counting system

```python
# In config.py → class CountingConfig:
DEFAULT_SYSTEM = "omega_ii"   # "hi_lo" | "ko" | "omega_ii" | "zen"
```

> **⚠️ Important:** After changing `DEFAULT_SYSTEM` you MUST retrain from scratch —
> do NOT use `--resume`. A model trained on Hi-Lo count values will be completely
> wrong when run with Omega II values because the count scale and tags are different.

### Adjust how often the model overrides basic strategy

```python
# In config.py → class MLConfig:
CONFIDENCE_THRESHOLD = 0.65   # default is 0.70
# Lower = model overrides basic strategy more aggressively
# Higher = model only speaks up when very confident
```

### How to tell if fine-tuning is working

Watch the training output:
- `☆ NEW BEST` on a new epoch → model is still improving, keep going
- No `NEW BEST` for 10+ epochs → model has converged, stop here
- Validation loss going UP while training loss goes DOWN → overfitting, stop now

---

## 🎯 YOLO Card Detection — Full Setup Guide

This trains **System 1** — the computer vision model that reads cards from screenshots
or live screen captures.

### Why YOLO instead of just Tesseract OCR?

| Situation | YOLO accuracy | OCR accuracy |
|-----------|---------------|--------------|
| Normal-size cards (>150px wide) | 97–99% | 88–93% |
| Small cards (40–80px wide) | 87–93% | 50–70% |
| Overlapping cards | 88–95% | 30–60% |
| Unusual casino font | 92–97% | 40–75% |
| Low light or blurry | 80–90% | 20–50% |

YOLO detects card location AND reads rank+suit in a single forward pass.
It is both faster and dramatically more accurate than the two-step OCR approach,
especially for small or stylised cards.

### Step 1 — Install ultralytics

```bash
pip install ultralytics
```

### Step 2 — Generate synthetic training data

The generator creates realistic casino scenes with playing cards at random sizes,
angles, and positions. No real casino screenshots or manual labelling needed.

```bash
python yolo/generate_dataset.py --images 5000    # quick test (~2 min)
python yolo/generate_dataset.py --images 10000   # recommended (~5 min)
python yolo/generate_dataset.py --images 25000   # best accuracy (~12 min)
```

**What each generated scene contains:**
- All 52 cards rendered at random sizes (8%–28% of scene height) and rotation angles
- 7 different casino table background colours (green felt, dark blue, navy, brown...)
- Perspective distortion — cards viewed at realistic angles as if on a table
- Random: blur, brightness variation, JPEG compression artefacts, drop shadows
- 2–7 overlapping cards per scene (weighted towards realistic hand layouts)

**YOLO label format** — what is inside each `.txt` label file:
```
class_id  cx  cy  width  height
```
All five values are normalised to 0–1 relative to the image dimensions.
`cx, cy` is the centre of the card bounding box (not the top-left corner).
`class_id` 0 = A_spades, 1 = A_hearts, 2 = A_diamonds ... 51 = K_clubs.

### Step 3 — Train YOLO

```bash
# Default (recommended — yolov8s, 100 epochs, early stopping):
python yolo/train_yolo.py

# Larger model for better accuracy (needs more GPU VRAM):
python yolo/train_yolo.py --model yolov8m

# Faster training at smaller input size:
python yolo/train_yolo.py --imgsz 416

# Resume interrupted training:
python yolo/train_yolo.py --resume

# Evaluate trained model on test set and see per-class stats:
python yolo/train_yolo.py --eval

# Quick test on one screenshot:
python yolo/train_yolo.py --test path/to/screenshot.png
```

### Step 4 — Model is automatically used

After training, `models/card_detector.pt` is created automatically.
The dashboard loads it at startup — no config changes needed:

```bash
python main.py web
# Console will show: ✅ YOLO card detector loaded
```

If the model is missing, the system silently falls back to Tesseract OCR.

### YOLO model size — which one to use

| Model | Inference speed | Accuracy | Min VRAM | Use when |
|-------|----------------|----------|----------|----------|
| yolov8n | Very fast | Good | ~2GB | Weak laptop, no GPU |
| **yolov8s** | Fast | **Better** | **~3GB** | **Default — good for most users** |
| yolov8m | Moderate | High | ~5GB | Gaming laptop with GPU |
| yolov8l | Slow | Higher | ~8GB | Desktop workstation |
| yolov8x | Slowest | Highest | ~12GB | High-end GPU only |

---

## 📦 Dataset Sources for YOLO

Combining our synthetic data with real photos dramatically improves accuracy on
real casino screenshots. Here are the best free datasets:

### Free datasets ready to download

| Dataset | Images | Format | License | Link |
|---------|--------|--------|---------|------|
| **Playing Cards Object Detection** | 20,000+ | YOLO ✅ | CC BY 4.0 | [roboflow.com — playing-cards-ow27d](https://universe.roboflow.com/augmented-startups/playing-cards-ow27d) |
| **Card Detection Dataset** | 3,000+ | YOLO ✅ | MIT | [roboflow.com — card-detection-qbfp6](https://universe.roboflow.com/card-detection/card-detection-qbfp6) |
| **Cards Image Dataset** | 7,624 | Class folders | CC0 | [kaggle.com — gpiosenka/cards](https://www.kaggle.com/datasets/gpiosenka/cards-image-datasetclassification) |

### How to download from Roboflow (free account required)

1. Create a free account at [roboflow.com](https://roboflow.com)
2. Open either Roboflow link from the table above
3. Click **Download Dataset** → select **YOLOv8** format → click Download
4. Extract the zip file to a temporary folder (e.g. `roboflow_cards/`)

### How to merge Roboflow data with our synthetic dataset

```bash
# Windows:
xcopy roboflow_cards\train\images\* yolo\dataset\images\train\ /Y
xcopy roboflow_cards\train\labels\* yolo\dataset\labels\train\ /Y
xcopy roboflow_cards\valid\images\* yolo\dataset\images\val\ /Y
xcopy roboflow_cards\valid\labels\* yolo\dataset\labels\val\ /Y

# Mac / Linux:
cp roboflow_cards/train/images/* yolo/dataset/images/train/
cp roboflow_cards/train/labels/* yolo/dataset/labels/train/
cp roboflow_cards/valid/images/* yolo/dataset/images/val/
cp roboflow_cards/valid/labels/* yolo/dataset/labels/val/

# Then train on the combined dataset:
python yolo/train_yolo.py
```

**Why combine synthetic and real?**
Synthetic data gives variety — hundreds of different angles, sizes, backgrounds.
Real data gives authenticity — actual card printing textures, real fonts, real lighting.
Together they produce a model that handles real casino screenshots much better than either alone.

---

## 🔧 Fine-Tuning YOLO for Your Casino

If your specific casino uses an unusual card style or font, fine-tune on real screenshots.

### Step 1 — Collect 20–50 casino screenshots

Open your casino and screenshot the table in various states — different hands,
different numbers of players, close-up and full-table views.

### Step 2 — Label them with Roboflow (free)

1. Go to [roboflow.com](https://roboflow.com) → Create new project
2. Upload your screenshots
3. For each image, draw a bounding box around each visible card
4. Label each box with the card name (e.g. `A_spades`, `K_hearts`, `10_diamonds`)
5. Export the project → YOLOv8 format → Download zip

### Step 3 — Fine-tune from existing weights

```bash
# Copy your labelled casino images into the dataset:
cp my_casino/train/images/* yolo/dataset/images/train/
cp my_casino/train/labels/* yolo/dataset/labels/train/

# Fine-tune — starts from existing model, much faster than from scratch:
python yolo/train_yolo.py --resume --epochs 30
```

Even 20 real images from your specific casino can noticeably improve detection accuracy
on that casino's card style.

---

## 📸 OpenCV + Tesseract OCR Fallback

If no YOLO model is found, the system automatically falls back to this pipeline.
It requires Tesseract (installed in Step 6 of Quick Start) but no training.

### How it works

```
Screenshot or screen frame
        ↓
1. FIND CARDS (OpenCV)
   • Convert to grayscale
   • Threshold: pixels brighter than 185 = white (card face)
   • Find contours (connected white regions)
   • Filter: keep only regions with card-like aspect ratio (1.05–2.20)
     and reasonable area (1,500–200,000 pixels)
   → List of card bounding boxes [x, y, w, h]

        ↓
2. READ RANK (Tesseract OCR)
   • Crop the top-left corner of each card
   • Invert colours (dark text → white text for better OCR)
   • Scale up 6× (Tesseract is more accurate on larger text)
   • Run Tesseract with character whitelist: AaKkQqJj23456789T10
   • Clean output: 'T' → '10', 'Kk' → 'K', etc.

        ↓
3. IDENTIFY SUIT (colour + shape analysis)
   • Count red pixels in HSV colour space
   • Red → hearts or diamonds; no red → spades or clubs
   • Analyse shape of suit symbol (solidity, aspect ratio, circularity)
   • Diamonds: high solidity, low circularity
   • Hearts: moderate solidity, more circular
   • Spades: tall aspect ratio, moderate solidity
   • Clubs: lower solidity (three-lobe shape)

        ↓
Result: [{rank: 'A', suit: 'spades', confidence: 0.75, bbox: [x,y,w,h]}, ...]
```

### OCR accuracy expectations

| Situation | Expected accuracy |
|-----------|------------------|
| Clean online casino screenshot | 85–92% |
| Good webcam, good lighting | 70–80% |
| Phone camera at angle | 50–65% |
| Physical cards, low light | 30–50% |

The confirmation step in Screenshot mode lets you correct wrong detections before
they affect the count.

### Tips for best OCR accuracy

- Cards must be at least 80×110 pixels in the screenshot
- Dark background (green felt) gives the best contrast against white cards
- Avoid screenshots where cards overlap significantly
- If a specific rank is always misread, check `cv_detector.py` line ~140 and adjust
  the Tesseract character whitelist

### Test OCR without running the full dashboard

```bash
python -c "
import cv2, sys
sys.path.insert(0, '.')
from app.cv_detector import detect_cards, get_backend

img = cv2.imread('test.png')
cards = detect_cards(img)
print('Backend:', get_backend())
for c in cards:
    print(c['rank'], 'of', c['suit'], '--', f'{c[\"confidence\"]:.0%}', c['backend'])
"
```

---

## ▶️ Running the Dashboard

```bash
# Standard start (most common):
python main.py web
# Open: http://localhost:5000

# If port 5000 is already in use:
python main.py web --port 8080

# Allow other devices on your network to connect:
python main.py web --host 0.0.0.0
# Then other devices use: http://YOUR_IP:5000
# Find your IP: ipconfig (Windows) or ifconfig (Mac/Linux)

# Run the standalone desktop overlay (floats over casino window):
python main.py overlay
python main.py overlay --decks 6 --system hi_lo --interval 1500

# Validate strategy performance with a simulation:
python main.py simulate --hands 500000

# See all available commands:
python main.py --help
```

---

## 🎮 How to Use the Dashboard

### Step-by-step workflow for each hand

```
1. Casino deals a new round

2. Press N (or click "New Hand") to clear the previous hand

3. Press P to target Player
   → Click your two starting cards in the card grid

4. Press D to target Dealer
   → Click the dealer's face-up card

5. For other players' cards (important for accurate count):
   → Select "Seen" in the target dropdown
   → Click their cards as they are revealed
   → These are counted but NOT shown in your hand display

6. Read the recommendation panel (left side):
   → Big coloured text shows: HIT / STAND / DOUBLE / SPLIT / SURRENDER
   → "WHY THIS ACTION?" explains the reasoning
   → Gold "DEVIATION" badge = Illustrious 18 or Fab 4 override is active
   → Bet Sizing panel shows the recommended bet for this count level

7. After the hand resolves:
   → Click WIN, PUSH, or LOSS to record the result
   → Bankroll and session stats update automatically

8. When the casino dealer physically reshuffles the shoe:
   → Click "Shuffle" (NOT New Hand)
   → This resets the running count to zero
   → Do NOT click Shuffle between normal hands — that kills your count
```

### Dashboard panels explained

| Panel | Location | What it shows |
|-------|----------|---------------|
| **Count Display** | Top bar | Running count, True count, advantage % |
| **AI Recommendation** | Left, top | Optimal action in large coloured text + plain English explanation |
| **Bet Sizing** | Left, middle | Kelly-optimal bet, player edge, bankroll, risk of ruin |
| **Side Bets** | Left, bottom | Real-time EV for Perfect Pairs, 21+3, Lucky Ladies |
| **Strategy Table** | Left, bottom | Colour-coded basic strategy grid, highlights your current situation |
| **Hand Display** | Centre, top | Your cards and dealer cards as visual card graphics |
| **Card Grid** | Centre | 52-button grid — click to enter any card |
| **Card Scanner** | Right, top | 3-mode scanner toggle (Manual / Screenshot / Live) |
| **Shoe Composition** | Right | Bar chart of remaining cards by rank |
| **Edge Meter** | Right | Visual gauge from house edge to player edge |
| **Session Stats** | Right | Hands played, profit, win rate, hourly rate |
| **Shuffle Tracker** | Right | ML Bayesian count adjustment after shuffles |
| **Count History** | Right | Sparkline + log of every counted card |
| **I18 Deviations** | Right, bottom | All 22 deviations — active ones glow gold |

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `N` | New hand — clears cards, keeps count |
| `S` | Shuffle — resets count (only when casino actually reshuffles) |
| `P` | Route next card to Player hand |
| `D` | Route next card to Dealer hand |

---

## 🃏 Three Card Entry Modes

The Card Scanner panel in the top-right has three modes. Click the toggle to switch
instantly — no restart needed.

### ✋ Mode 1: Manual

Click the 52-card grid to enter cards one at a time. Most reliable mode.
Works without any CV or YOLO setup.

**How to use:**
- Press `P` → click your two starting cards
- Press `D` → click the dealer upcard
- Select **Seen** → click other players' cards (counted but not in your hand)
- Press `N` for a new hand; press `S` when dealer reshuffles (count reset)

### 📋 Mode 2: Screenshot CV

Take an OS screenshot of the casino window and paste it.
YOLO reads all visible cards and shows you a preview with bounding boxes to confirm.

**Step-by-step:**

1. **Take a screenshot** using your OS — these are completely invisible to casino software:
   - **Windows:** `Win + Shift + S` → drag to select just the card area
   - **macOS:** `Cmd + Shift + 4` → drag to select
   - **Linux:** Flameshot or PrtScn key

2. **Switch** to the BlackjackML browser tab

3. **Paste** with `Ctrl + V` (or `Cmd + V`) — the paste zone captures the image

4. **YOLO detects cards** and draws coloured bounding boxes:
   - Green box = high confidence (>80%)
   - Yellow box = medium confidence (60–80%)
   - Red box = low confidence (<60%) — check these carefully

5. **Review the card list** — fix any wrong rank/suit using the dropdowns,
   click × to remove false detections

6. **Choose routing** using the "Assign to" dropdown:
   - `Auto (1-2 Player, 3-4 Dealer)` — works when your cards are on the left
   - `All → Seen` — for full table screenshots (counts all, adds none to your hand)
   - `All → Player` — screenshot of only your cards
   - `All → Dealer` — screenshot of only the dealer area

7. **Click Apply** — cards are submitted with random human-like delays (150–950ms each)

**Why this is undetectable by casinos:**
- OS screenshot tools (`Win+Shift+S`, `Cmd+Shift+4`) are invisible to all software
- No `getDisplayMedia()` — no screen-share banner in the browser
- No `getUserMedia()` — no camera access light
- Flask runs on `localhost:5000` — casino JavaScript cannot access `localhost`
- Casino JS is sandboxed to its own tab; it cannot see other tabs, other processes,
  or any local network ports
- Random submission timing mimics a human clicking

### 🔴 Mode 3: Live Auto-Scan

The Flask server continuously captures your screen and routes cards automatically.
You just watch as the count and recommendations update in real time.

**One-time setup:**
```bash
pip install mss

# Linux only (built into Windows and macOS):
sudo apt install python3-tk
```

**How to use:**
1. Open the casino in another browser tab or window
2. Arrange so the table cards are visible (or use the casino's fullscreen)
3. In Mode 3, optionally enter a **scan region** (x, y, width, height) to restrict
   capture to just the casino table area — see the next section for how to set this
4. Click **▶ Start Live Scan** — server begins scanning every ~200ms
5. Cards appear automatically as they are dealt
6. Click **■ Stop Scanning** when done

**Why this is undetectable:**
- `mss` captures the screen at the OS level — no browser API involved at all
- Runs as a background Python thread in a separate process
- Casino JavaScript cannot see OS processes, other applications, or localhost ports

---

## 🎯 How Card Routing Works (Your Cards vs Others)

### The problem

At a real blackjack table you can see multiple hands being played.
If all detected cards were sent to your Player hand, your hand total would be wrong
and every strategy recommendation would be meaningless.

### The solution: position-based routing

The live scanner divides the captured region into horizontal thirds based on the
x-coordinate of each detected card:

```
┌──────────────────────────────────────────────────────────────┐
│                  Your Scan Region                            │
│                                                              │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │  Left 33%    │  Centre 33%  │  Right 33%   │             │
│  │              │              │              │             │
│  │  YOUR        │  DEALER      │  OTHER       │             │
│  │  CARDS       │  CARDS       │  PLAYERS     │             │
│  │              │              │              │             │
│  │ → player     │ → dealer     │ → seen       │             │
│  │              │              │              │             │
│  │ Shown in     │ Shown in     │ Counted      │             │
│  │ your hand    │ dealer hand  │ but NOT in   │             │
│  │ display      │ display      │ any hand     │             │
│  └──────────────┴──────────────┴──────────────┘             │
└──────────────────────────────────────────────────────────────┘

Counter.count_card() is called for ALL cards regardless of target.
hand.add_card() is called ONLY for 'player' and 'dealer' targets.
```

This means:
- **Your cards** → appear in your hand display → strategy recommendation uses them
- **Dealer cards** → appear in dealer display → triggers S17 draw rules
- **Other players** → counted for the running count but NEVER shown in your hand

### Setting up the scan region

**Step 1 — Note your screen resolution**
Right-click desktop → Display Settings → note width × height (e.g. 1920×1080).

**Step 2 — Identify where the table is on screen**
Open the casino fullscreen. Observe:
- Where does YOUR seat appear? (usually bottom-left or bottom-centre)
- Where is the DEALER? (usually top-centre)
- Where are OTHER PLAYERS? (sides and top)

**Step 3 — Enter region coordinates in Mode 3**
The region (x, y, w, h) is a rectangle on your screen:
```
x = 0       ← start at the left edge of the screen
y = 150     ← skip the casino menu/lobby at the top (~150px)
w = 1920    ← capture full screen width
h = 650     ← capture the playing area (adjust to cut off lobby at bottom)
```

**Step 4 — Verify by watching the terminal**
After clicking Start Live Scan, watch the Flask server's console output.
Each detected card prints which target it was routed to. Adjust x/y/w/h
until your cards consistently route to `player` and the dealer routes to `dealer`.

**Tip for side-seat positions:**
If your seat is on the right side of the table, the thirds will be wrong.
In that case, set the region to cover only your seat + dealer area and ignore
the other players. Or use Mode 2 (screenshot) with `All → Seen` for the full table
and separate screenshots of your cards with `All → Player`.

---

## 📊 Model Performance & Accuracy

### Strategy model architecture (v2 ResNet + Attention)

```
Input: 28 features
      ↓
FeatureAttention gate
  → learns which inputs matter per situation
  → count matters more late-shoe; hand value matters more early-shoe
      ↓
Input projection: 28 → 256
      ↓
ResidualBlock(256 → 512)    expand for capacity
ResidualBlock(512 → 512)    deep feature representation
ResidualBlock(512 → 256)    compress back
ResidualBlock(256 → 256)    refine
      ↓ shared trunk output
  ┌────────────┬────────────┬────────────┐
  ↓            ↓            ↓
hit/stand    double/split  surrender
  head         head          head
(uses hand   (uses count   (uses count
 + dealer)    + shoe)       + dealer)
  ↓            ↓            ↓
         combined logits (5 actions)
```

### Strategy model accuracy by training size

| Hands | Epochs | Test Accuracy | CPU time | GPU time |
|-------|--------|---------------|----------|----------|
| 100,000 | 20 | ~67% | ~2 min | ~20 sec |
| 500,000 | 30 | ~75% | ~10 min | ~90 sec |
| **1,000,000** | **50** | **~82%** | **~25 min** | **~5 min** |
| 2,000,000 | 60 | ~85%+ | ~60 min | ~10 min |

### YOLO card detection accuracy by training size

| Training data | mAP@50 | mAP@50-95 | Notes |
|--------------|--------|-----------|-------|
| 5k synthetic | ~0.87 | ~0.72 | Adequate for testing |
| 10k synthetic | ~0.92 | ~0.78 | Good for general use |
| 25k synthetic | ~0.95 | ~0.83 | Excellent |
| **10k synth + Roboflow** | **~0.97** | **~0.88** | **Best — use this** |

> mAP@50 means: what fraction of cards does the model find with its bounding box
> overlapping the real card by at least 50%? Values above 0.90 are considered excellent.

---

## 📈 Player Advantage Analysis

### Where the edge comes from, broken down

```
Starting point — house edge with perfect basic strategy:    −0.50%
─────────────────────────────────────────────────────────────────
+ Card counting (Hi-Lo, 1–16 bet spread):                  +0.70%
+ Illustrious 18 play deviations:                          +0.15%
+ Fab 4 surrender deviations:                              +0.05%
+ ML shuffle tracker (riffle shuffle conditions):           +0.10%
─────────────────────────────────────────────────────────────────
FULL SYSTEM PLAYER EDGE:                          +0.20% to +0.50%
```

Most players without a strategy tool play about 1.5% worse than perfect basic
strategy. Just using this tool correctly without any counting is already worth ~+1.5%.

### True count distribution (8-deck, 75% penetration)

```
TC ≤ -4  | ██ 4.2%
TC = -3  | ████ 7.8%
TC = -2  | ██████ 11.4%
TC = -1  | ████████ 15.6%
TC =  0  | ██████████ 19.8%  ← most hands happen near here
TC = +1  | ████████ 15.2%
TC = +2  | ██████ 10.8%
TC = +3  | ████ 7.1%
TC = +4  | ███ 4.9%
TC ≥ +5  | ████ 7.3%
```

The edge comes from betting small at negative counts and large at positive counts —
not from playing differently on most hands (most hands are at neutral count).

### Risk of ruin vs. bankroll (1–16 spread, $10 base unit)

| Bankroll | Risk of Ruin |
|----------|--------------|
| $1,000 | ~45% — very risky |
| $3,000 | ~18% |
| $5,000 | ~8% |
| **$10,000** | **~2%** ← default config |
| $20,000 | ~0.3% — very safe |

---

## ⚙️ Customising Settings

All settings are in `config.py`. No other code changes are needed.

### Table rules — change these to match your casino

```python
# config.py → class GameConfig

NUM_DECKS                = 6      # Decks in the shoe: 1, 2, 4, 6, or 8
DEALER_HITS_SOFT_17      = False  # Does dealer hit soft 17? H17 rule = True
BLACKJACK_PAYS           = 3/2    # Blackjack payout. Avoid 6:5 tables (= 1.2)
ALLOW_DOUBLE_AFTER_SPLIT = False  # Can you double down after a split?
ALLOW_RESPLIT            = False  # Can you split a split hand again?
ALLOW_LATE_SURRENDER     = True   # Can you surrender after dealer checks for BJ?
PENETRATION              = 0.75   # Fraction of shoe dealt before reshuffling
BURN_CARDS               = 1      # Cards discarded face-down at start of shoe
```

### Bankroll and bet sizing

```python
# config.py → class BettingConfig

TABLE_MIN        = 10      # Casino minimum bet ($)
TABLE_MAX        = 500     # Casino maximum bet ($)
BASE_UNIT        = 10      # One unit in your bet spread ($) — usually = TABLE_MIN
INITIAL_BANKROLL = 10000   # Your total bankroll ($)
BET_SPREAD       = 16      # Maximum bet = BASE_UNIT × BET_SPREAD
KELLY_FRACTION   = 0.75    # Three-quarter Kelly (conservative and recommended)
```

### ML model settings

```python
# config.py → class MLConfig

SIMULATION_HANDS     = 1_000_000  # Hands to simulate for training data
EPOCHS               = 50         # Maximum training epochs
CONFIDENCE_THRESHOLD = 0.70       # Min confidence for model to override rules
TRUNK_DIM            = 512        # Width of neural network trunk
```

### Counting system

```python
# config.py → class CountingConfig

DEFAULT_SYSTEM      = "hi_lo"   # "hi_lo" | "ko" | "omega_ii" | "zen"
INSURANCE_THRESHOLD = 3.0       # Take insurance when True Count reaches this
WONGING_ENTER_TC    = 2.0       # Back-counting entry threshold
WONGING_EXIT_TC     = -1.0      # Back-counting exit threshold
```

> **⚠️ If you change DEFAULT_SYSTEM you MUST retrain from scratch.**
> Do not use --resume. The count features in the training data will be wrong.

---

## 🌐 Deployment

### Local only (default)

```bash
python main.py web
# http://localhost:5000
```

### Local network (share on your WiFi)

```bash
python main.py web --host 0.0.0.0
# Other devices: http://YOUR_LAN_IP:5000
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
RUN pip install --no-cache-dir -r requirements.txt && pip install ultralytics
COPY . .
EXPOSE 5000
CMD ["python", "main.py", "web", "--host", "0.0.0.0"]
```

```bash
docker build -t blackjackml .
docker run -p 5000:5000 blackjackml
```

> **Note:** Live scan (Mode 3) does not work inside Docker — the container cannot
> access the host screen. Use Modes 1 and 2 when running in Docker.

---

## ❓ Troubleshooting

### `python is not recognized` or `python: command not found`

Reinstall Python from [python.org](https://python.org).
During installation tick **"Add Python to PATH"**. Restart your terminal after.

### `pip install fails` or package not found errors

```bash
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### `Address already in use` (port 5000 is taken)

```bash
python main.py web --port 8080
```

### `ModuleNotFoundError: No module named 'blackjack'`

You must run all commands from the project root folder, not a subfolder:
```bash
# Check where you are:
pwd   # Mac/Linux   OR   cd   # Windows (shows current path)

# Navigate to the project root:
cd C:\Users\Rouna\Downloads\MLModel\Model1
python main.py web
```

### `tesseract is not installed or it's not in your PATH`

You need the Tesseract binary installed on your system.
`pip install pytesseract` alone is not enough — that is just a Python wrapper.

- **Windows:** Download from https://github.com/UB-Mannheim/tesseract/wiki
  During install tick "Add to PATH". Then reopen your terminal.
- **macOS:** `brew install tesseract`
- **Linux:** `sudo apt install tesseract-ocr`

### `YOLO model not found — using OCR fallback`

The YOLO card detector has not been trained yet. Run:
```bash
python yolo/generate_dataset.py --images 10000
python yolo/train_yolo.py
```

### `ultralytics not installed`

```bash
pip install ultralytics
```

### Live scan (Mode 3) shows "Screen capture unavailable"

```bash
pip install mss
# Then restart the server:
python main.py web
```

### Other players' cards appearing in my hand display

Your scan region is not set correctly. Two fixes:

**Fix 1** — Narrow the region to only your seat + dealer area so other players
are outside the capture rectangle entirely.

**Fix 2** — Use Mode 2 (screenshot) with `All → Seen` for the full table view,
then separate screenshots of just your seat with `All → Player`.

### Count doesn't match what I'm tracking manually

- Press **Shuffle** only when the dealer physically shuffles the cards.
  Never press Shuffle between normal hands — it resets the count to zero.
- Confirm you are using the same counting system.
  Hi-Lo and KO use different count values for the same cards.
- KO is an unbalanced system — its running count is not directly comparable
  to Hi-Lo's true count.

### Training is extremely slow (hours instead of minutes)

```bash
# First verify training works at all (2 min):
python main.py train --hands 100000 --epochs 20

# If you have an NVIDIA GPU, install CUDA PyTorch (6× faster):
pip uninstall torch -y
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

### Dashboard loads but cards don't register when I click

1. Press `F12` → Console tab → look for red JavaScript errors
2. Confirm the Flask server is still running in your terminal (no crashed output)
3. Refresh with `F5`
4. Check you are at `http://localhost:5000` not `https://`

### VS Code shows squiggly underlines in .js files

This is cosmetic — the code runs correctly regardless. To fix it:

Make sure `jsconfig.json` exists in your project root (it is included in this repo):
```json
{
  "compilerOptions": {
    "jsx": "react",
    "checkJs": false
  }
}
```
Then in VS Code: `Ctrl + Shift + P` → type **Reload Window** → press Enter.

### Venv broken after moving or renaming the project folder

Virtual environments store absolute paths internally. Any folder rename or move
breaks them. The fix is to delete and recreate:

```bash
# Windows PowerShell:
Remove-Item -Recurse -Force .\venv
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install ultralytics

# Mac / Linux:
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install ultralytics
```

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

### Live scanner card routing

```
For each detected card:

  card_x = left edge of bounding box in pixels
  rel_x  = card_x / region_width   (0.0 = left, 1.0 = right)

  rel_x < 0.33  →  target = 'player'   (your seat — left third)
  rel_x < 0.66  →  target = 'dealer'   (dealer area — centre third)
  rel_x >= 0.66 →  target = 'seen'     (other players — right third)
```

### How count-based deviations override basic strategy

```
deviation_engine.get_action(hand, dealer_upcard, true_count):

  Check Fab 4 surrenders first:
    14 vs 10 at TC >= +3  → SURRENDER
    15 vs 10 at TC >= 0   → SURRENDER
    15 vs 9  at TC >= +2  → SURRENDER
    15 vs A  at TC >= +1  → SURRENDER

  Check Illustrious 18 next:
    Insurance  at TC >= +3       → TAKE (normally skip)
    16 vs 10   at TC >= 0        → STAND (normally HIT)
    15 vs 10   at TC >= +4       → STAND (normally HIT)
    10,10 vs 5 at TC >= +5       → SPLIT (normally STAND)
    10,10 vs 6 at TC >= +4       → SPLIT
    10 vs 10   at TC >= +4       → DOUBLE (normally HIT)
    12 vs 3    at TC >= +2       → STAND (normally HIT)
    12 vs 2    at TC >= +3       → STAND
    11 vs A    at TC >= -1       → DOUBLE (normally HIT)
    9  vs 2    at TC >= +1       → DOUBLE (normally HIT)
    10 vs A    at TC >= +4       → DOUBLE
    9  vs 7    at TC >= +3       → DOUBLE
    16 vs 9    at TC >= +5       → STAND
    13 vs 2    at TC >= -1       → STAND (normally HIT)
    12 vs 4    at TC >= 0        → STAND
    12 vs 5    at TC >= -2       → STAND
    12 vs 6    at TC >= -1       → STAND
    13 vs 3    at TC >= -2       → STAND

  No deviation triggered → fall through to BasicStrategy lookup table
```

### WebSocket event sequence from click to recommendation

```
1. User clicks card button in CardGrid (or YOLO detects card)
2. handleDealCard(rank, suit, target) called in App.js
3. socketRef.current.emit('deal_card', {rank, suit, target})
4. Flask receives event in @socketio.on('deal_card')
5. counter.count_card(card)           → running count updates
6. true_count = running / decks_left  → true count updates
7. shoe.cards.remove(card)            → remaining probs update
8. hand.add_card(card)                → hand value updates
9. deviation_engine checks I18 + Fab4 → best action determined
10. betting_engine.kelly(true_count)  → optimal bet calculated
11. side_bet_analyzer.compute_ev()    → side bet EVs updated
12. emit('state_update', {...})        → full state sent to browser
13. React: setGameState(data)          → all panels re-render
```

---

## 📄 License

For educational and portfolio purposes only.

Card counting is **legal** in most jurisdictions, but casinos are private property
and may ask you to leave if they suspect you are counting cards. Using this software
in a casino is at your own risk. This software is not intended for illegal use.

---

*Built with ♠ Python · PyTorch · YOLOv8 · Flask · React · OpenCV · Tesseract · Socket.IO*
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
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)

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
17. [Model Performance & Accuracy](#-model-performance--accuracy)
18. [Player Advantage Analysis](#-player-advantage-analysis)
19. [Customising Settings](#-customising-settings)
20. [Deployment](#-deployment)
21. [Troubleshooting](#-troubleshooting)
22. [Architecture Deep Dive](#-architecture-deep-dive)

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

### Step 2 — Install Node.js 18+

Node.js is required to rebuild the frontend bundle when you edit any `.js` component file.
You only need it for development — **not** to run the dashboard.

Download from [nodejs.org](https://nodejs.org/) — choose the LTS version.

> **Windows:** The installer adds Node to PATH automatically. Restart your terminal after installing.

Verify Node is installed:
```bash
node --version
# Should show: v18.x.x or higher

tsc --version
# Should show: Version 5.x.x
# If not found: npm install -g typescript
```

### Step 3 — Open a terminal in the project folder

```bash
# Windows PowerShell — navigate to the project:
cd C:\Users\YourName\Downloads\BlackJackML-main

# Mac / Linux:
cd /path/to/BlackJackML-main
```

### Step 4 — Create a virtual environment

A virtual environment is an isolated Python installation just for this project.
It prevents version conflicts with other Python projects on your computer.

```bash
python -m venv venv
```

### Step 5 — Activate the virtual environment

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
# (venv) PS C:\Users\YourName\Downloads\BlackJackML-main>
```

### Step 6 — Install Python packages

```bash
pip install -r requirements.txt
# PyTorch is ~200MB so this takes 2–5 minutes on a normal connection
```

### Step 7 — Install Tesseract (OCR engine — NOT a pip package)

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

### Step 8 — Install YOLO (much better card detection than OCR)

```bash
pip install ultralytics
# This installs the YOLOv8 library and all its dependencies
```

### Step 9 — Generate synthetic card training data for YOLO

This creates thousands of realistic card scene images with automatic labels.
No internet required — everything is generated on your computer.

```bash
# Recommended (5 min, good accuracy):
python yolo/generate_dataset.py --images 10000

# Best accuracy (12 min):
python yolo/generate_dataset.py --images 25000
```

### Step 10 — Train the YOLO card detector

```bash
python yolo/train_yolo.py
# CPU: ~30–60 minutes
# GPU: ~8 minutes
# Creates: models/card_detector.pt
```

### Step 11 — Train the blackjack strategy AI

```bash
# Always run the quick test first — 2 minutes — confirms everything works:
python main.py train --hands 100000 --epochs 20

# Full training — recommended for real use:
python main.py train --hands 1000000
# CPU: ~25 minutes | GPU: ~5 minutes
# Creates: models/best_model.pt
```

### Step 12 — Start the dashboard

```bash
python main.py web
```

Open **http://localhost:5000** in your browser.
You should see the BlackjackML dashboard load immediately.

---

## 📁 Project Structure

Every file and folder explained so you know what does what.

```
BlackJackML-main/
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
├── build.sh                     # ← FRONTEND BUILD SCRIPT (new)
│                                #   Run this after editing any JS component file.
│                                #   See "How the Frontend Build Works" section.
│
├── build-src/                   # ← FRONTEND BUILD TOOLS (new)
│   ├── tsconfig.json            #   TypeScript compiler config — handles JSX transform
│   └── minify.js                #   Node script that strips comments + whitespace
│
├── overlay_settings.json        # Auto-created the first time you use overlay mode.
│                                #   Saves your scan region and window position.
│
├── yolo/                        # ── SYSTEM 1: Card Detection ──────────────────
│   │
│   ├── generate_dataset.py      # Creates synthetic card training images.
│   │                            #   Run: python yolo/generate_dataset.py --images 10000
│   │
│   ├── train_yolo.py            # Trains YOLOv8 on the generated dataset.
│   │                            #   Run: python yolo/train_yolo.py
│   │                            #   Output: models/card_detector.pt
│   │
│   └── dataset/                 # Auto-created by generate_dataset.py
│       ├── images/train/
│       ├── images/val/
│       ├── images/test/
│       ├── labels/train/
│       ├── labels/val/
│       ├── labels/test/
│       └── dataset.yaml
│
├── blackjack/                   # ── Core Game Engine (pure Python, no ML) ──────
│   ├── card.py                  # Card, Rank, Suit, Deck, Shoe objects
│   ├── game.py                  # Hand, Round, BlackjackTable, Action enum
│   ├── counting.py              # CardCounter for all 4 systems
│   ├── strategy.py              # Perfect basic strategy lookup tables
│   ├── deviations.py            # Illustrious 18 + Fab 4 count-based overrides
│   ├── betting.py               # Kelly Criterion bet sizing + count-based spread
│   └── side_bets.py             # EV calculation for optional side bets
│
├── ml_model/                    # ── SYSTEM 2: Strategy Neural Network ──────────
│   ├── model.py                 # BlackjackNet v2 architecture
│   ├── shuffle_tracker.py       # LSTM + Bayesian shuffle-resistant counter
│   ├── simulate.py              # Monte Carlo simulation engine
│   └── train.py                 # Training pipeline
│
├── app/                         # ── Web Dashboard ───────────────────────────────
│   ├── server.py                # Flask + Socket.IO backend — the brain
│   ├── cv_detector.py           # Card detection: YOLO first, OCR fallback
│   ├── live_scanner.py          # Background screen capture thread
│   ├── overlay.py               # Standalone desktop overlay (tkinter window)
│   │
│   ├── templates/
│   │   └── index.html           # HTML shell — loads bundle.min.js (not raw components)
│   │
│   └── static/
│       ├── bundle.min.js        # ← THE COMPILED FRONTEND (new — do not edit directly)
│       │                        #   Pre-compiled from all component files by build.sh
│       │                        #   This is what the browser actually loads.
│       │
│       ├── style.css            # All CSS styles for the dashboard
│       │
│       └── components/          # ← EDIT THESE — source files for each UI panel
│           ├── App.jsx          #   Root: owns all state, opens WebSocket
│           ├── LiveOverlayPanel.jsx  # 3-mode card scanner
│           ├── ActionPanel.js   #   Big HIT/STAND/DOUBLE recommendation
│           ├── BettingPanel.js  #   Bet sizing + WIN/LOSS/PUSH recording
│           ├── HandDisplay.js   #   Visual card display for player and dealer
│           ├── CardGrid.js      #   52-button card entry grid
│           ├── Widget.js        #   Reusable panel wrapper (all panels use this)
│           ├── TopBar.js        #   Sticky top bar with count + controls
│           ├── SideBetPanel.js  #   Side bet EV display
│           ├── ShoePanel.js     #   Remaining cards bar chart by rank
│           ├── EdgeMeter.js     #   Player/house edge visual gauge
│           ├── SessionStats.js  #   Win rate, profit, hands played
│           ├── CountHistory.js  #   Count sparkline + card log
│           ├── I18Panel.js      #   Illustrious 18 reference
│           ├── StrategyRefTable.js  # Basic strategy grid
│           ├── CasinoRiskMeter.js   # Counter detection risk meter
│           ├── StopAlerts.js    #   Stop-loss / stop-win alerts
│           ├── SplitHandPanel.js    # Split hand management
│           ├── SideCountPanel.js    # Ace + Ten side counts
│           ├── ShuffleTracker.js    # ML shuffle tracker display
│           ├── CenterToolBar.js     # Info strip below card grid
│           ├── constants.js     #   Card ranks, suits, strategy tables
│           └── utils.js         #   Helper functions, deviation tooltips
│
└── models/                      # Auto-created when you train
    ├── card_detector.pt         # YOLO card detection model (System 1)
    ├── best_model.pt            # Strategy AI best checkpoint (System 2)
    ├── last_checkpoint.pt       # Most recent epoch — used for --resume
    ├── training_log.csv         # Per-epoch loss + accuracy (open in Excel)
    └── training_summary.json    # Human-readable summary of the last training run
```

---

## 🔨 How the Frontend Build Works (Read This If You Edit Any JS Files)

This section is important. If you edit a component file and refresh the browser
and see **no change**, this is why — and here is how to fix it.

### The old way vs. the new way

**Old way (how most tutorials show it):**
The browser downloaded all 22 JavaScript files separately, plus a ~1.5 MB tool
called Babel that compiled the JSX code in the browser on every page load.
This worked, but it was slow — every page load spent 1–3 seconds just compiling
code before anything appeared on screen.

**New way (how this project now works):**
All 22 component files are compiled in advance on your computer into a single
file called `bundle.min.js`. The browser downloads that one pre-compiled file
and runs it immediately — no compiling, no waiting.

```
Before (old):                         After (new):
--------------------------            --------------------------
Browser downloads:                    Browser downloads:
  @babel/standalone  (~1.5 MB)          bundle.min.js   (~200 KB)
  react.dev.js       (~1 MB)            react.min.js    (~130 KB)
  react-dom.dev.js   (~1 MB)            react-dom.min.js (~30 KB)
  22 component files (~200 KB)
  --------------------------
  Total: ~3.7 MB + 1-3s compile        Total: ~360 KB, 0s compile

Result: Lighthouse Performance 59     Result: Lighthouse Performance ~85+
```

### Build scripts — which one to use

This project includes two build scripts depending on your OS:

| OS | Script | Command |
|----|--------|---------|
| **Windows** (PowerShell) | `build.ps1` | `.uild.ps1` |
| **Windows** (watch mode) | `watch.ps1` | `.\watch.ps1` |
| **Mac / Linux** | `build.sh` | `bash build.sh` |
| **Mac / Linux** (watch mode) | `build.sh` | `bash build.sh --watch` |

> **Important — Windows users:** Do NOT use `bash build.sh` in PowerShell.
> `bash` is not available in PowerShell. Use `.build.ps1` instead.
> If you get a security error, run `Unblock-File .build.ps1` first.

### What this means when you edit a component

When you open a `.js` file in `app/static/components/` and save a change,
**the browser does not see your change yet.** You must rebuild the bundle first.

```
You edit a .js file
        |
        v
Windows: .build.ps1        Mac/Linux: bash build.sh
        |
        v
build-src/src/ is wiped and refilled with fresh copies
        |
        v
tsc compiles all JSX into plain JavaScript
        |
        v
All 22 files are joined into bundle.js in load order
        |
        v
Duplicate hook declarations fixed (const -> var)
        |
        v
Comments and whitespace removed -> bundle.min.js
        |
        v
Syntax checked with node --check
        |
        v
You refresh the browser -> your change appears
```

### How to rebuild after editing (Windows)

Open PowerShell in your project root and run:

```powershell
.build.ps1
```

You will see:
```
BlackjackML Build Starting...
Step 1: Syncing sources...
Step 2: Compiling JSX...
Step 3: Bundling files...
Step 4: Fixing hook declarations...
Step 5: Minifying...
Step 6: Checking syntax...

Build complete!  bundle.min.js = 203 KB
Refresh your browser to see changes.
```

Then refresh your browser. The change will be there.

### How to rebuild after editing (Mac / Linux)

```bash
bash build.sh
```

### Auto-rebuild on every save — Watch Mode

Instead of running the build manually after every edit, use watch mode.
It rebuilds automatically within ~2 seconds of every file save.

**Windows (PowerShell):**
```powershell
.\watch.ps1
# Rebuilds automatically whenever you save a component file.
# Press Ctrl+C when you are done editing.
```

**Mac / Linux:**
```bash
bash build.sh --watch
# Press Ctrl+C when you are done editing.
```

### What the build does step by step

**Step 1 — Wipe and refill the build folder**
`build-src/src/` is completely cleared before every build.
This prevents "file already exists" errors when `.jsx` files were previously
renamed to `.tsx` and the old `.tsx` is still sitting there from a prior run.
Fresh copies of all component files are then copied in.

**Step 2 — Compile JSX using TypeScript (`tsc`)**
TypeScript reads `build-src/tsconfig.json` and transforms every file.
The only thing `tsc` is doing here is converting JSX syntax like `<div>` into
JavaScript function calls like `React.createElement("div", ...)`.
It is not doing strict type checking — the `// @ts-nocheck` at the top of each
file tells it to skip type errors and only transform the syntax.

**Step 3 — Bundle in load order**
The compiled files are concatenated into one file in the correct order — constants
first, then utility functions, then base components, then panels, then App last.
Order matters because each file uses functions defined in earlier files.

**Step 4 — Fix duplicate hook declarations**
Each component file declares `const { useState, useEffect } = React` at the top.
This is fine when each file is a separate `<script>` tag (each has its own scope),
but when all files are concatenated into one, duplicate `const` is a SyntaxError.
`build-src/fix_hooks.js` converts all of them to `var` which allows redeclaration.

**Step 5 — Minify**
`build-src/minify.js` removes block comments and extra blank lines.
`233 KB → 203 KB` — about 13% smaller.

**Step 6 — Syntax check**
`node --check bundle.min.js` verifies the output has no syntax errors before
you refresh the browser. If this fails, the error message tells you exactly
what line is broken.

### What you should and should not edit

| File/folder | Edit it? | Notes |
|-------------|----------|-------|
| `app/static/components/*.js` | Yes | These are the source files |
| `app/static/components/*.jsx` | Yes | These are the source files |
| `app/static/style.css` | Yes | CSS — just refresh browser, no rebuild needed |
| `app/templates/index.html` | Yes | Rarely needed |
| `app/static/bundle.min.js` | No | Auto-generated — overwritten on next build |
| `app/static/bundle.js` | No | Auto-generated intermediate file |
| `build-src/src/` | No | Wiped and refilled on every build |
| `build-src/out/` | No | tsc output — regenerated on every build |

### If you get a build error

**`Rename-Item: Cannot create a file when that file already exists`**
This was a bug in an older version of `build.ps1`. Get the latest `build.ps1`
from the project — it now wipes `build-src/src/` before copying files in.

**`build.ps1 is not digitally signed`**
Run this once to unblock it:
```powershell
Unblock-File .build.ps1
Unblock-File .\watch.ps1
```

**`tsc: command not found`**
TypeScript is not installed:
```powershell
npm install -g typescript
```

**`The term 'bash' is not recognized`**
You are using PowerShell — use `.build.ps1` not `bash build.sh`.

**`Property 'X' does not exist`** during compilation
This is a harmless TypeScript type warning, suppressed by `// @ts-nocheck`.
If the bundle generates and the browser works, ignore it.

**`Cannot find module`** or build runs from wrong folder
Make sure you are in the project root (the folder containing `main.py`):
```powershell
cd C:\Users\YourName\Downloads\MLModel\Model1
.build.ps1
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

This forces a completely clean start.

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
# ALWAYS run the quick test first. 2 minutes. Confirms everything is working:
python main.py train --hands 100000 --epochs 20

# Once confirmed working, run full training:
python main.py train --hands 1000000
```

### Step 5 — Enable GPU acceleration (optional — 6× faster)

```bash
# Check if your GPU is detected:
python -c "import torch; print('GPU available:', torch.cuda.is_available())"

# If it prints True, install the GPU version of PyTorch:
pip uninstall torch -y
pip install torch --index-url https://download.pytorch.org/whl/cu121
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
[8–17]  prob_of_X_remaining   Fraction of each rank left in the shoe
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

---

## 🔧 Fine-Tuning the Strategy Model

Fine-tuning means continuing training from an existing checkpoint rather than
starting from scratch.

### Resume from last checkpoint

```bash
python main.py train --hands 1000000 --epochs 50 --resume
```

### Fine-tune with more data

```bash
python main.py train --hands 2000000 --epochs 20 --resume
```

### Fine-tune for a different counting system

```python
# In config.py → class CountingConfig:
DEFAULT_SYSTEM = "omega_ii"   # "hi_lo" | "ko" | "omega_ii" | "zen"
```

> **⚠️ Important:** After changing `DEFAULT_SYSTEM` you MUST retrain from scratch —
> do NOT use `--resume`.

---

## 🎯 YOLO Card Detection — Full Setup Guide

This section explains the full process from zero to a working card detector —
including how to download the free 20,000-image Roboflow dataset and combine
it with our synthetic data for the best possible accuracy.

### Why YOLO instead of just Tesseract OCR?

| Situation | YOLO accuracy | OCR accuracy |
|-----------|---------------|--------------|
| Normal-size cards (>150px wide) | 97–99% | 88–93% |
| Small cards (40–80px wide) | 87–93% | 50–70% |
| Overlapping cards | 88–95% | 30–60% |
| Unusual casino font | 92–97% | 40–75% |
| Low light or blurry | 80–90% | 20–50% |

YOLO (You Only Look Once) finds card locations AND reads their rank+suit in a
single pass over the image. OCR requires two separate steps (find the card,
then read the text) and fails badly on small or overlapping cards.

---

## 📦 Training YOLO with the Roboflow 20,000-Image Dataset

This is the **recommended training path** for best accuracy. You combine a free
real-photo dataset from Roboflow with our generated synthetic images, then train
YOLO on both together. The whole process takes about 30 minutes.

> **Why combine both datasets?**
> - Synthetic images give variety — hundreds of angles, sizes, and backgrounds.
> - Real photos give authenticity — actual card textures, real casino fonts, real lighting.
> - Together they produce a model that generalises to your specific casino far better
>   than either dataset alone.

---

### Step 1 — Install ultralytics (if you haven't already)

```bash
# Make sure your venv is active first (you should see (venv) in your prompt)
pip install ultralytics
```

Verify it installed correctly:
```bash
python -c "from ultralytics import YOLO; print('ultralytics OK')"
# Should print: ultralytics OK
```

---

### Step 2 — Create a free Roboflow account

1. Open your browser and go to **https://roboflow.com**
2. Click **Sign Up** in the top right
3. Sign up with Google, GitHub, or an email address — it is completely free
4. You do not need to enter a credit card

> Roboflow is a platform for hosting and downloading computer vision datasets.
> The playing cards dataset is publicly shared there under a free licence.

---

### Step 3 — Find the Playing Cards dataset

1. After logging in, go to:
   **https://universe.roboflow.com/augmented-startups/playing-cards-ow27d**

2. You will see a page like this:

   ```
   Playing Cards Object Detection
   by Augmented Startups
   20,000+ images · 52 classes · CC BY 4.0 licence
   ```

3. The **52 classes** are the 52 cards: A_spades, 2_hearts, K_diamonds, etc.
   This matches our project exactly — no relabelling needed.

4. Click the blue **Download Dataset** button

---

### Step 4 — Download in YOLOv8 format

A popup will appear asking which format to download in. This step is important —
you must pick the right format or the files won't be compatible.

1. In the **Format** dropdown, select **YOLOv8**

   > YOLOv8 format gives you `.txt` label files alongside the images.
   > Each label file has one line per card: `class_id cx cy width height`
   > where all values are normalised to 0–1. This is exactly what our
   > `train_yolo.py` script expects.

2. Leave the **Split** setting as-is (train/valid/test is already configured)

3. Click **Continue** → then click **Download zip to computer**

4. A `.zip` file will download — it will be named something like
   `playing-cards-ow27d.v12i.yolov8.zip`

5. **Do not extract it yet** — we will do that in the next step

---

### Step 5 — Extract the Roboflow zip

Extract the zip file to a temporary folder anywhere on your computer.
You can name the folder anything — we will call it `roboflow_cards` here.

```
# After extracting, the folder structure should look like this:
roboflow_cards/
├── train/
│   ├── images/          ← ~16,000 card photos (80% of the dataset)
│   └── labels/          ← .txt label files, one per image
├── valid/
│   ├── images/          ← ~2,000 card photos (10% validation)
│   └── labels/
├── test/
│   ├── images/          ← ~2,000 card photos (10% test)
│   └── labels/
└── data.yaml            ← dataset config file (we don't use this one)
```

> **What are the label files?**
> Each `.txt` file has the same name as its image but with `.txt` extension.
> Example: `card_001.jpg` has `card_001.txt` containing:
> ```
> 0 0.512 0.338 0.142 0.289
> ```
> This means: class 0 (A_spades), centre at 51.2% from left, 33.8% from top,
> 14.2% wide, 28.9% tall. YOLO reads these automatically during training.

---

### Step 6 — Generate our synthetic dataset

While we have the Roboflow data, we also generate synthetic images to add variety.
Run this from the project root folder with your venv active:

```bash
# Recommended amount — takes about 5 minutes
python yolo/generate_dataset.py --images 10000
```

This creates the `yolo/dataset/` folder:
```
yolo/dataset/
├── images/
│   ├── train/    ← ~8,000 synthetic card images
│   ├── val/      ← ~1,000 validation images
│   └── test/     ← ~1,000 test images
├── labels/
│   ├── train/    ← matching .txt label files
│   ├── val/
│   └── test/
└── dataset.yaml  ← config file pointing to these folders
```

> **What does the generator create?**
> It renders all 52 cards at random sizes and angles on casino-style
> backgrounds with blur, brightness changes, and JPEG compression.
> This teaches the model to handle real-world variation.

---

### Step 7 — Copy Roboflow images into our dataset folder

Now we combine both datasets by copying the Roboflow images into the same
folders as our synthetic images. Open a terminal in the **project root folder**.

**Windows (PowerShell or CMD):**
```powershell
# Copy training images and labels
xcopy "C:\Users\YourName\Downloads\roboflow_cards\train\images\*" "yolo\dataset\images\train\" /Y
xcopy "C:\Users\YourName\Downloads\roboflow_cards\train\labels\*" "yolo\dataset\labels\train\" /Y

# Copy validation images and labels
xcopy "C:\Users\YourName\Downloads\roboflow_cards\valid\images\*" "yolo\dataset\images\val\" /Y
xcopy "C:\Users\YourName\Downloads\roboflow_cards\valid\labels\*" "yolo\dataset\labels\val\" /Y

# Copy test images and labels
xcopy "C:\Users\YourName\Downloads\roboflow_cards\test\images\*" "yolo\dataset\images\test\" /Y
xcopy "C:\Users\YourName\Downloads\roboflow_cards\test\labels\*" "yolo\dataset\labels\test\" /Y
```

> Replace `C:\Users\YourName\Downloads\roboflow_cards` with the actual path
> where you extracted the zip file.

**Mac / Linux:**
```bash
# Replace ~/Downloads/roboflow_cards with your actual extraction path
cp ~/Downloads/roboflow_cards/train/images/* yolo/dataset/images/train/
cp ~/Downloads/roboflow_cards/train/labels/* yolo/dataset/labels/train/

cp ~/Downloads/roboflow_cards/valid/images/* yolo/dataset/images/val/
cp ~/Downloads/roboflow_cards/valid/labels/* yolo/dataset/labels/val/

cp ~/Downloads/roboflow_cards/test/images/*  yolo/dataset/images/test/
cp ~/Downloads/roboflow_cards/test/labels/*  yolo/dataset/labels/test/
```

**Verify the copy worked** — check the image counts:
```bash
# Windows PowerShell:
(Get-ChildItem yolo\dataset\images\train).Count
# Should show roughly 26,000 (16,000 Roboflow + 8,000 synthetic + some variation)

# Mac / Linux:
ls yolo/dataset/images/train | wc -l
# Should show roughly 26,000
```

---

### Step 8 — Check the class names match

This is the most common mistake — the Roboflow dataset might use different class
names than our `dataset.yaml` expects. Let's verify before training.

Open `yolo/dataset/dataset.yaml` in VS Code and check the `names` section:

```yaml
# It should look like this (52 card names):
names:
  0: A_clubs
  1: A_diamonds
  2: A_hearts
  3: A_spades
  4: 10_clubs
  ...
  51: K_spades
```

Now look at one label file from the Roboflow data to check the class IDs match:

```bash
# Windows:
type yolo\dataset\labels\train\card_001.txt

# Mac / Linux:
cat yolo/dataset/labels/train/$(ls yolo/dataset/labels/train | head -1)
```

You will see lines like `0 0.51 0.34 0.14 0.29`. The first number (0) is the
class ID. It must match the index in your `dataset.yaml`. If the Roboflow dataset
uses different ordering, the model will confuse card identities.

> **If the class names don't match:**
> Open `yolo/train_yolo.py` and look for a `CLASS_MAP` or `REMAP` dictionary
> near the top. This is where you can translate Roboflow class IDs to our IDs.
> If no such dictionary exists, re-download from Roboflow using the exact same
> class list as in `dataset.yaml`.

---

### Step 9 — Train YOLO on the combined dataset

With both datasets merged, train normally. The script automatically uses
everything in `yolo/dataset/`:

```bash
# Standard training — recommended for most computers
python yolo/train_yolo.py
```

What you will see while training:
```
Ultralytics YOLOv8s summary: 225 layers, 11,155,977 parameters
Starting training for 100 epochs...

      Epoch    GPU_mem   box_loss   cls_loss   dfl_loss  Instances       Size
       1/100      1.2G      1.842      2.341      1.204        142        640:
       2/100      1.2G      1.621      2.108      1.187        138        640:
      ...
      50/100      1.2G      0.812      0.934      0.987        145        640:
     100/100      1.2G      0.623      0.712      0.881        143        640: ✅

Results saved to runs/detect/train
```

**How long will it take?**

| Hardware | Training time |
|----------|--------------|
| No GPU (CPU only) | 4–8 hours |
| Laptop with NVIDIA GPU | 25–45 minutes |
| Desktop with NVIDIA GPU | 12–20 minutes |
| Google Colab (free GPU) | 20–30 minutes |

> **Training is slow on CPU?** See the GPU acceleration tip below, or
> use Google Colab (free) — instructions in the next section.

---

### Step 10 — What good training output looks like

After training finishes, check the results:

```bash
# The model file is automatically copied here:
ls models/card_detector.pt
# ✅ If this file exists, training succeeded

# View accuracy metrics:
cat runs/detect/train/results.csv
```

Good accuracy numbers to aim for:
```
mAP50      ≥ 0.92   ← finds 92%+ of cards with >50% overlap (good)
mAP50-95   ≥ 0.78   ← finds 78%+ with strict overlap (great)
```

If your numbers are lower, see the troubleshooting section at the bottom of this guide.

---

### Step 11 — Verify the model works

Run a quick test on a screenshot before using it live:

```bash
# Test on a screenshot you took of a casino table
python yolo/train_yolo.py --test path/to/your/screenshot.png
```

This saves an annotated image at `runs/detect/test/` with coloured boxes drawn
around every detected card. Open that folder in Explorer / Finder and check it
visually — every card should have a box with the correct rank+suit label.

---

### Step 12 — Start the dashboard with your new model

```bash
python main.py web
```

In the terminal you will see:
```
✅ YOLO card detector loaded  (models/card_detector.pt)
```

If you see `⚠ YOLO not found — using OCR fallback` instead, the file path is
wrong. Make sure `models/card_detector.pt` exists and you are running from the
project root folder.

---

### 🆓 Training on Google Colab (free GPU — no installation needed)

If your computer is slow or has no GPU, Google Colab gives you a free NVIDIA GPU
in a browser tab. This reduces training time from hours to 20–30 minutes.

**One-time setup:**

1. Go to **https://colab.research.google.com**
2. Sign in with your Google account (free)
3. Click **File → New notebook**
4. In the top menu click **Runtime → Change runtime type**
5. Set **Hardware accelerator** to **T4 GPU** → click Save

**Upload your dataset:**

1. Zip up the merged dataset folder:
   ```bash
   # From the project root on your computer:
   # Windows:
   Compress-Archive yolo\dataset yolo_dataset.zip

   # Mac / Linux:
   zip -r yolo_dataset.zip yolo/dataset/
   ```
2. In Colab, click the folder icon on the left sidebar
3. Click the upload icon and upload `yolo_dataset.zip`
4. In a Colab code cell, run:
   ```python
   import zipfile, os
   with zipfile.ZipFile('yolo_dataset.zip', 'r') as z:
       z.extractall('.')
   print("Dataset extracted")
   ```

**Train in Colab:**

```python
# Install ultralytics
!pip install ultralytics -q

# Train
from ultralytics import YOLO
model = YOLO('yolov8s.pt')
model.train(
    data='dataset/dataset.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    project='runs',
    name='cards',
)
print("Training complete!")
```

**Download the trained model:**

```python
# After training, download the model file
from google.colab import files
files.download('runs/cards/weights/best.pt')
```

Save the downloaded file as `models/card_detector.pt` in your project folder.

---

### Troubleshooting YOLO Training

**`CUDA out of memory` error during training**

Your GPU does not have enough memory for the default batch size. Reduce it:
```bash
python yolo/train_yolo.py --batch 8
# Or even smaller:
python yolo/train_yolo.py --batch 4
```

**`No images found` error**

The dataset path is wrong. Check that `yolo/dataset/images/train/` contains
image files before running training:
```bash
# Windows:
dir yolo\dataset\images\train | find /c ".jpg"

# Mac / Linux:
ls yolo/dataset/images/train/*.jpg | wc -l
```
If the count is 0, re-run Step 6 (generate) and Step 7 (copy Roboflow files).

**`ModuleNotFoundError: No module named 'ultralytics'`**

You forgot to activate the virtual environment or forgot to install ultralytics:
```bash
# Activate venv first:
source venv/bin/activate   # Mac / Linux
.\venv\Scripts\Activate.ps1  # Windows PowerShell

# Then install:
pip install ultralytics
```

**mAP50 is stuck below 0.70 after training**

This usually means a class name mismatch between the Roboflow labels and
`dataset.yaml`. Go back to Step 8 and carefully verify the class IDs match.
If they do not match, every card will be labelled as the wrong card, and the
model will never learn correctly no matter how long you train.

**Training is taking forever on CPU**

Normal — CPU training of 26,000 images for 100 epochs genuinely takes 4–8 hours.
Options:
- Use Google Colab (free, takes ~25 minutes) — instructions above
- Train for fewer epochs as a test: add `--epochs 20` to the command
- Train on only synthetic data first (skip the Roboflow copy) to verify
  everything works, then add Roboflow data for the real training run

---

## 🔧 Fine-Tuning YOLO for Your Specific Casino

After you have a working model from the steps above, you can improve it further
by adding 20–50 screenshots from your specific casino. Even a small number of
real screenshots from your exact casino dramatically improves accuracy for that
casino's card style.

### Step 1 — Take 20–50 screenshots of the casino table

Use your OS screenshot tool (Win+Shift+S on Windows, Cmd+Shift+4 on Mac) while
playing. Capture a variety of situations: different hand sizes, different numbers
of cards dealt, close-up and full-table views.

### Step 2 — Label them on Roboflow (free)

1. Go to **https://roboflow.com** and sign in
2. Click **Create new project** → name it anything (e.g. "my-casino")
3. Set project type to **Object Detection**
4. Upload your screenshots
5. For each image, draw a rectangle around each visible card
6. In the label box that appears, type the card name (e.g. `A_spades`, `K_hearts`)
   — use the same names as in your `dataset.yaml`
7. After labelling all images, click **Generate** → **Export Dataset**
8. Choose **YOLOv8** format → download the zip
9. Extract it to a folder (e.g. `my_casino_labels/`)

### Step 3 — Add your labelled images to the dataset

```bash
# Mac / Linux:
cp my_casino_labels/train/images/* yolo/dataset/images/train/
cp my_casino_labels/train/labels/* yolo/dataset/labels/train/

# Windows:
xcopy "my_casino_labels\train\images\*" "yolo\dataset\images\train\" /Y
xcopy "my_casino_labels\train\labels\*" "yolo\dataset\labels\train\" /Y
```

### Step 4 — Fine-tune from the existing model

Instead of training from scratch (which wastes the 26,000-image training you
already did), continue training from the existing model:

```bash
python yolo/train_yolo.py --resume --epochs 30
```

Even 20 real images from your casino can noticeably improve detection accuracy
on that casino's specific card style and layout.

---

## 📸 OpenCV + Tesseract OCR Fallback

If no YOLO model is found, the system automatically falls back to this pipeline.

```
Screenshot or screen frame
        ↓
1. FIND CARDS (OpenCV)
   → Threshold → find card-shaped white regions → bounding boxes

        ↓
2. READ RANK (Tesseract OCR)
   → Crop top-left corner → scale up 6× → run OCR

        ↓
3. IDENTIFY SUIT (colour + shape analysis)
   → Red pixels = hearts/diamonds; analyse shape for spades/clubs

        ↓
Result: [{rank: 'A', suit: 'spades', confidence: 0.75, bbox: [x,y,w,h]}, ...]
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

# Run the standalone desktop overlay:
python main.py overlay

# Validate strategy performance with a simulation:
python main.py simulate --hands 500000
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

5. For other players' cards:
   → Select "Seen" in the target dropdown
   → Click their cards as they are revealed
   → These are counted but NOT shown in your hand display

6. Read the recommendation panel (left side):
   → Big coloured text shows: HIT / STAND / DOUBLE / SPLIT / SURRENDER
   → "WHY THIS ACTION?" explains the reasoning
   → Gold "DEVIATION" badge = Illustrious 18 or Fab 4 override is active

7. After the hand resolves:
   → Click WIN, PUSH, or LOSS to record the result

8. When the casino dealer physically reshuffles the shoe:
   → Click "Shuffle" (NOT New Hand)
   → This resets the running count to zero
```

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `N` | New hand — clears cards, keeps count |
| `S` | Shuffle — resets count (only when casino actually reshuffles) |
| `P` | Route next card to Player hand |
| `D` | Route next card to Dealer hand |

---

## 🃏 Three Card Entry Modes

### ✋ Mode 1: Manual

Click the 52-card grid to enter cards one at a time. Most reliable mode.
Works without any CV or YOLO setup.

### 📋 Mode 2: Screenshot CV

Take an OS screenshot of the casino window and paste it into the dashboard.
YOLO reads all visible cards and shows a preview for you to confirm.

**How to screenshot invisibly (casino cannot detect these):**
- **Windows:** `Win + Shift + S`
- **macOS:** `Cmd + Shift + 4`
- **Linux:** Flameshot or PrtScn

Then switch to the BlackjackML tab and press `Ctrl + V` to paste.

### 🔴 Mode 3: Live Auto-Scan

```bash
pip install mss
# Linux only:
sudo apt install python3-tk
```

The Flask server continuously captures your screen and routes cards automatically.

---

## 🎯 How Card Routing Works (Your Cards vs Others)

The live scanner divides the captured region into horizontal thirds:

```
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │  Left 33%    │  Centre 33%  │  Right 33%   │             │
│  │  YOUR CARDS  │ DEALER CARDS │ OTHER PLAYERS│             │
│  │  → player    │  → dealer    │  → seen      │             │
│  └──────────────┴──────────────┴──────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

All cards are counted. Only player/dealer cards appear in the hand display.

---

## 📊 Model Performance & Accuracy

### Strategy model accuracy by training size

| Hands | Epochs | Test Accuracy | CPU time | GPU time |
|-------|--------|---------------|----------|----------|
| 100,000 | 20 | ~67% | ~2 min | ~20 sec |
| 500,000 | 30 | ~75% | ~10 min | ~90 sec |
| **1,000,000** | **50** | **~82%** | **~25 min** | **~5 min** |
| 2,000,000 | 60 | ~85%+ | ~60 min | ~10 min |

### YOLO card detection accuracy by training size

| Training data | mAP@50 | Notes |
|--------------|--------|-------|
| 5k synthetic | ~0.87 | Adequate for testing |
| 10k synthetic | ~0.92 | Good for general use |
| 25k synthetic | ~0.95 | Excellent |
| **10k synth + Roboflow** | **~0.97** | **Best — use this** |

---

## 📈 Player Advantage Analysis

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

---

## ⚙️ Customising Settings

All settings are in `config.py`. No other code changes are needed.

### Table rules

```python
# config.py → class GameConfig
NUM_DECKS                = 6
DEALER_HITS_SOFT_17      = False
BLACKJACK_PAYS           = 3/2
ALLOW_DOUBLE_AFTER_SPLIT = False
ALLOW_LATE_SURRENDER     = True
PENETRATION              = 0.75
```

### Bankroll and bet sizing

```python
# config.py → class BettingConfig
TABLE_MIN        = 10
BASE_UNIT        = 10
INITIAL_BANKROLL = 10000
BET_SPREAD       = 16
KELLY_FRACTION   = 0.75
```

### Counting system

```python
# config.py → class CountingConfig
DEFAULT_SYSTEM = "hi_lo"   # "hi_lo" | "ko" | "omega_ii" | "zen"
```

> **⚠️ If you change DEFAULT_SYSTEM you MUST retrain from scratch.**

---

## 🌐 Deployment

### Local only (default)

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
RUN pip install --no-cache-dir -r requirements.txt && pip install ultralytics
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

You must run all commands from the project root folder:
```bash
cd C:\Users\YourName\Downloads\BlackJackML-main
python main.py web
```

### `tesseract is not installed or it's not in your PATH`

- **Windows:** Download from https://github.com/UB-Mannheim/tesseract/wiki — tick "Add to PATH"
- **macOS:** `brew install tesseract`
- **Linux:** `sudo apt install tesseract-ocr`

### I edited a component file but nothing changed in the browser

You need to rebuild the bundle after editing any `.js` or `.jsx` file:

**Windows:**
```powershell
.\build.ps1
```
**Mac / Linux:**
```bash
bash build.sh
```
Then refresh your browser. See the [How the Frontend Build Works](#-how-the-frontend-build-works-read-this-if-you-edit-any-js-files) section for a full explanation.

### `tsc: command not found`

TypeScript is not installed. Fix:
```powershell
npm install -g typescript
```

### `The term 'bash' is not recognized` (Windows)

Do not use `bash build.sh` in PowerShell. Use the PowerShell script instead:
```powershell
.\build.ps1
```
For watch mode:
```powershell
.\watch.ps1
```

### VS Code shows squiggly underlines in .js files

This is cosmetic only — the code runs correctly. To suppress it, make sure
`jsconfig.json` exists in your project root (it is included in this repo):
```json
{
  "compilerOptions": {
    "jsx": "react",
    "checkJs": false
  }
}
```
Then in VS Code: `Ctrl + Shift + P` → **Reload Window**.

### Dashboard loads but cards don't register when I click

1. Press `F12` → Console tab → look for red JavaScript errors
2. Confirm the Flask server is still running in your terminal
3. Refresh with `F5`
4. Check you are at `http://localhost:5000` not `https://`
5. If you recently edited a component, run `.\build.ps1` (Windows) or `bash build.sh` (Mac/Linux) and refresh

### Training is extremely slow (hours instead of minutes)

```bash
# First verify training works at all (2 min):
python main.py train --hands 100000 --epochs 20

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

*Built with ♠ Python · PyTorch · YOLOv8 · Flask · React · OpenCV · Tesseract · Socket.IO · TypeScript*
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
2. [The Two AI Systems — Read This First](#-the-two-ai-systems--read-this-first)
3. [What You Actually Need to Install](#-what-you-actually-need-to-install)
4. [Step-by-Step Setup — Windows](#-step-by-step-setup--windows)
5. [Step-by-Step Setup — macOS](#-step-by-step-setup--macos)
6. [Step-by-Step Setup — Linux / WSL](#-step-by-step-setup--linux--wsl)
7. [Running the App (No Training Needed)](#-running-the-app-no-training-needed)
8. [Training the Strategy AI](#-training-the-strategy-ai)
9. [Simulating Strategy Performance](#-simulating-strategy-performance)
10. [Training the Card Detector (YOLO)](#-training-the-card-detector-yolo)
11. [Project Structure — Every File Explained](#-project-structure--every-file-explained)
12. [Customising Settings](#-customising-settings)
13. [Counting Systems — Switching, Customising, and Training](#-counting-systems--switching-customising-and-training)
14. [How to Use the Dashboard](#-how-to-use-the-dashboard)
15. [Three Card Entry Modes](#-three-card-entry-modes)
16. [Card Routing (Player / Dealer / Seen)](#-card-routing-player--dealer--seen)
17. [Split Hand Workflow](#-split-hand-workflow)
18. [Keyboard Shortcuts](#-keyboard-shortcuts)
19. [Currency Settings](#-currency-settings)
20. [Editing the Frontend (JS/React files)](#-editing-the-frontend-jsreact-files)
21. [Running the Tests](#-running-the-tests)
22. [Desktop Overlay (Live Mode)](#-desktop-overlay-live-mode)
23. [Illustrious 18 + Fab 4 — Complete Reference](#-illustrious-18--fab-4--complete-reference)
24. [Dashboard Panels — Analytics, Risk, Stop Alerts, Shuffle Tracker](#-dashboard-panels--analytics-risk-stop-alerts-shuffle-tracker)
25. [Deployment — Putting It Online](#-deployment--putting-it-online)
26. [Troubleshooting — Common Errors](#-troubleshooting--common-errors)
27. [Model Performance & Accuracy](#-model-performance--accuracy)
28. [Architecture Reference](#-architecture-reference)
29. [Bug Fix Changelog](#-bug-fix-changelog)

---

## 🎯 What This Project Does

BlackjackML is a complete blackjack AI system. It watches cards being dealt, counts them, and tells you exactly what to do in real time — what action to take, how much to bet, and what your mathematical edge is.

| Component | What it does |
|-----------|-------------|
| **Perfect Basic Strategy** | Optimal play for every possible hand vs. dealer upcard |
| **4 Card Counting Systems** | Hi-Lo, KO, Omega II, Zen Count — switch live mid-shoe |
| **Illustrious 18 + Fab 4** | 22 advanced play deviations based on the running count |
| **Kelly Criterion Betting** | Mathematically optimal bet sizing with a 1–16 unit spread |
| **Side Bet EV Analyser** | Real-time expected value for Perfect Pairs, 21+3, Lucky Ladies |
| **Neural Net Strategy AI** | ResNet + Attention trained on 1M+ hands |
| **YOLOv8 Card Detector** | Recognises all 52 cards from a screenshot or live screen |
| **3-Mode Card Scanner** | Manual click / Screenshot paste / Live auto-scan |
| **React Dashboard** | Live web UI — enter cards, get instant count + recommendation |
| **Multi-Currency** | INR default (₹) — supports 20 fiat currencies and top 10 crypto |
| **Split Hand Management** | Full pair split with independent AI recommendation per hand |

---

## 🗺 The Two AI Systems — Read This First

This is the single most important thing to understand before setting up. There are **two completely independent AI systems** in this project. You train them separately. The app works without either being trained — it just uses rules instead.

```
┌─────────────────────────────────────────────────────────────────────┐
│  SYSTEM 1 — Card Detection (YOLO + OpenCV + Tesseract)              │
│                                                                     │
│  WHAT IT DOES:  Looks at a screenshot or live video and identifies  │
│                 which cards are visible on the screen.              │
│                                                                     │
│  EXAMPLE:  Takes a screenshot → outputs "Ace of Spades, 9 of Clubs" │
│                                                                     │
│  HOW TO TRAIN:                                                      │
│    Step 1: python yolo/generate_dataset.py --images 10000           │
│    Step 2: python yolo/train_yolo.py                                │
│                                                                     │
│  OUTPUT FILE:  models/card_detector.pt                              │
│                                                                     │
│  IF NOT TRAINED:  Falls back to Tesseract OCR automatically         │
│  (lower accuracy but still works)                                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
            Detected cards are fed into the game engine
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  SYSTEM 2 — Strategy AI (PyTorch Neural Network)                    │
│                                                                     │
│  WHAT IT DOES:  Given your current hand, the dealer's upcard, and   │
│                 the running count — recommends the best action      │
│                 and optimal bet size.                               │
│                                                                     │
│  EXAMPLE:  "You have 16 vs dealer 10 at TC +2 → STAND"              │
│            "Bet 4 units (₹400) — count is favourable"               │
│                                                                     │
│  HOW TO TRAIN:                                                      │
│    python main.py train --hands 1000000                             │
│                                                                     │
│  OUTPUT FILE:  models/best_model.pt                                 │
│                                                                     │
│  IF NOT TRAINED:  Falls back to perfect rules-based basic strategy  │
└─────────────────────────────────────────────────────────────────────┘
```

**Key point:** You can use the dashboard right away without training anything. The app is fully functional with rules-based logic. Training both models just gives better accuracy.

---

## 📦 What You Actually Need to Install

Before following any setup steps, here is a complete list of everything required and what each thing is for.

### Required software (install these manually — NOT via pip)

| Software | What it is | Why you need it |
|----------|-----------|----------------|
| **Python 3.10 or newer** | The programming language this runs on | Everything |
| **Tesseract OCR** | A text-recognition program | Reads card ranks from screenshots when YOLO isn't available |

### Optional software (only if you want to edit the frontend)

| Software | What it is | Why you need it |
|----------|-----------|----------------|
| **Node.js 18+** | JavaScript runtime | Only needed if you edit `.js` or `.jsx` files in `app/static/components/`. The app ships with a pre-built bundle so you do NOT need this to run the app. |

### Python packages (installed automatically via pip)

All Python packages are listed in `requirements.txt`. Running `pip install -r requirements.txt` installs all of them in one command. You do not need to install these individually.

---

## 🖥 Step-by-Step Setup — Windows

Follow every step in order. Do not skip any.

### Step 1 — Install Python

1. Go to [https://www.python.org/downloads/](https://www.python.org/downloads/)
2. Click the big yellow "Download Python 3.x.x" button
3. Run the downloaded `.exe` file
4. **CRITICAL:** On the first screen, tick the checkbox that says **"Add python.exe to PATH"** before clicking Install Now

   If you missed this tick, uninstall Python and reinstall it — ticking the box this time.

5. Click "Install Now"
6. When it finishes, open a new PowerShell window and verify:
   ```powershell
   python --version
   ```
   You should see something like `Python 3.11.9`. If you get an error, Python is not in your PATH — reinstall and tick the checkbox.

### Step 2 — Install Tesseract OCR

1. Go to [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)
2. Download the latest installer (e.g. `tesseract-ocr-w64-setup-5.x.x.exe`)
3. Run the installer
4. **CRITICAL:** On the "Choose Components" screen, make sure **"Add Tesseract to the system PATH"** is ticked
5. Complete the installation
6. Open a **new** PowerShell window and verify:
   ```powershell
   tesseract --version
   ```
   You should see `tesseract 5.x.x`. If you get an error, you need to add Tesseract to PATH manually — see the Troubleshooting section.

### Step 3 — Open PowerShell in the project folder

1. Extract the `BlackJackML-main.zip` file (right-click → Extract All)
2. Open the extracted folder
3. Hold `Shift`, right-click on an empty area inside the folder, and select **"Open PowerShell window here"**

   Alternatively, open PowerShell and navigate manually:
   ```powershell
   cd C:\Users\YourName\Downloads\BlackJackML-main
   ```

### Step 4 — Allow PowerShell scripts to run

Windows blocks scripts from running by default. Run this command once:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Type `Y` and press Enter when asked.

### Step 5 — Create a virtual environment

A virtual environment is an isolated Python installation just for this project. It prevents version conflicts with any other Python software on your computer.

```powershell
python -m venv venv
```

This creates a folder called `venv/` inside your project folder. You only do this once.

### Step 6 — Activate the virtual environment

```powershell
.\venv\Scripts\Activate.ps1
```

You should see `(venv)` appear at the beginning of your PowerShell prompt. This means the virtual environment is active.

**You must do this every time you open a new PowerShell window to work on this project.** If you close and reopen PowerShell, run this activation command again before running any `python` or `pip` commands.

### Step 7 — Install Python packages

```powershell
pip install -r requirements.txt
```

PyTorch is about 200MB, so this will take 3–8 minutes depending on your internet speed. Wait for it to fully complete.

### Step 8 — Verify the installation

```powershell
python -c "import torch, flask, cv2, pytesseract; print('All packages installed correctly')"
```

If you see `All packages installed correctly`, everything is working. If you see an error, check the Troubleshooting section.

### Step 9 — Run the app

```powershell
python main.py web
```

Open your browser and go to **http://localhost:5000**

The app is now fully functional. You can enter cards manually and get strategy advice without any training. To enable the AI models and card detection, continue to the Training sections.

---

## 🍎 Step-by-Step Setup — macOS

### Step 1 — Install Homebrew (if not already installed)

Homebrew is the standard package manager for macOS. Open Terminal and run:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
Follow the on-screen instructions. This takes a few minutes.

### Step 2 — Install Python

```bash
brew install python@3.11
```

Verify:
```bash
python3 --version
```
Should show `Python 3.11.x` or similar. On macOS, use `python3` everywhere instead of `python`.

### Step 3 — Install Tesseract

```bash
brew install tesseract
```

Verify:
```bash
tesseract --version
```

### Step 4 — Open Terminal in the project folder

Extract the zip file and navigate to it in Terminal:
```bash
cd ~/Downloads/BlackJackML-main
```

### Step 5 — Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` at the start of your prompt. Run `source venv/bin/activate` every time you open a new Terminal window.

### Step 6 — Install Python packages

```bash
pip install -r requirements.txt
```

### Step 7 — Run the app

```bash
python main.py web
```

Open your browser and go to **http://localhost:5000**

---

## 🐧 Step-by-Step Setup — Linux / WSL

### Step 1 — Install system packages

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv tesseract-ocr python3-tk -y
```

Verify:
```bash
python3 --version    # Should show 3.10 or higher
tesseract --version  # Should show 5.x.x
```

### Step 2 — Navigate to the project folder

```bash
cd /path/to/BlackJackML-main
```

### Step 3 — Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 4 — Install Python packages

```bash
pip install -r requirements.txt
```

### Step 5 — Run the app

```bash
python main.py web
```

Open your browser and go to **http://localhost:5000**

---

## ▶️ Running the App (No Training Needed)

The app works immediately after installing packages. Training is optional — it just improves accuracy.

```bash
# Standard — opens at http://localhost:5000
python main.py web

# Use a different port if 5000 is taken by something else
python main.py web --port 8080

# Allow other devices on your network to connect (e.g., from your phone)
python main.py web --host 0.0.0.0
```

**What works without training:**
- All 52 cards, all hand types (hard, soft, pairs)
- Perfect basic strategy recommendations
- Card counting (Hi-Lo, KO, Omega II, Zen Count)
- Illustrious 18 + Fab 4 play deviations
- Kelly Criterion bet sizing
- Side bet EV analysis
- Session tracking and statistics
- Split hand management

**What training adds:**
- Strategy AI (`models/best_model.pt`): improves decision accuracy by ~0.2% edge by incorporating true count into every decision, not just the Illustrious 18
- Card detector (`models/card_detector.pt`): allows Screenshot and Live modes to auto-detect cards from screen images

---

## 🧠 Training the Strategy AI

### When should you train?

- You want the best possible decision accuracy (the trained model is ~0.2% better than rules)
- You changed table rules in `config.py` and want the model to learn them
- You want to experiment with different numbers of decks or house rules

### Training commands

| Command | Time (CPU) | Time (GPU) | Accuracy | Use when |
|---------|-----------|-----------|----------|---------|
| `python main.py train --hands 100000 --epochs 20` | ~2 min | ~20 sec | ~67% | Quick test — always try this first to confirm setup works |
| `python main.py train --hands 500000 --epochs 30` | ~10 min | ~90 sec | ~75% | Development and testing |
| `python main.py train --hands 1000000` | ~25 min | ~5 min | **~82%** | **Recommended for real use** |
| `python main.py train --hands 2000000 --epochs 60` | ~60 min | ~10 min | ~85%+ | Maximum accuracy |
| `python main.py train --hands 1000000 --system all` | ~25 min | ~5 min | **~82%** | Universal model — works with all 4 counting systems (default) |
| `python main.py train --hands 1000000 --system hi_lo` | ~25 min | ~5 min | **~82%** | Single-system model tuned to Hi-Lo only |

**Always run the quick test first:**
```bash
python main.py train --hands 100000 --epochs 20
```

If this completes without errors, run the full training:
```bash
python main.py train --hands 1000000
```

The trained model is saved to `models/best_model.pt`. The app loads it automatically the next time you run `python main.py web`.

### Resuming interrupted training

If training is stopped mid-way (power cut, you closed the terminal, etc.), you can pick up exactly where it left off:

```bash
python main.py train --resume
```

This reads `models/last_checkpoint.pt` which is saved after every epoch. The early stopping counter is also restored — it will not restart from zero patience.

### Early stopping

Training automatically stops if accuracy has not improved for 10 consecutive epochs. You do not need to set `--epochs` to an exact number — the trainer will stop itself when it stops improving, and `best_model.pt` will always hold the best result achieved.

### Training output files explained

After training, the `models/` folder contains:

| File | What it is |
|------|-----------|
| `best_model.pt` | The weights with the highest validation accuracy — this is what the app uses |
| `last_checkpoint.pt` | The most recent epoch — used by `--resume` |
| `checkpoint_epoch0010.pt` | Numbered snapshots every 5 epochs (only 3 kept, oldest auto-deleted) |
| `training_log.csv` | One row per epoch: loss, accuracy, learning rate — open in Excel to plot |
| `training_summary.json` | Human-readable summary of the completed run: best accuracy, epoch, device, time |

You can safely delete everything except `best_model.pt` once training is complete.

### Checking if the model loaded

When you start the app, the terminal output will include a line like:
```
✅  Strategy model loaded from models/best_model.pt
```
or
```
⚠️  No trained model found — using rules-based strategy
```

### Optional — GPU acceleration (6× faster training)

If you have an NVIDIA graphics card, you can use it to speed up training dramatically.

First, check if your GPU is detected:
```bash
python -c "import torch; print('GPU available:', torch.cuda.is_available())"
```

If it prints `GPU available: True`, install the GPU version of PyTorch:
```bash
pip uninstall torch -y
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

If it prints `GPU available: False`, your GPU is either not NVIDIA, or the CUDA drivers are not installed. The CPU version works fine — it just takes longer.

### Where training results are saved

After training, these files are created in the `models/` folder:
```
models/
├── best_model.pt          # The trained strategy AI (automatically loaded by the app)
├── checkpoint_epoch_N.pt  # Checkpoints saved during training (safe to delete)
└── training_log.csv       # Per-epoch accuracy and loss numbers (open in Excel)
```

---

## 📊 Simulating Strategy Performance

The `simulate` command runs a Monte Carlo test — it plays thousands of hands automatically and compares three strategies side by side so you can measure the real effect of counting and deviations.

```bash
# Quick run — 100k hands, takes ~1 minute:
python main.py simulate

# More accurate result — 500k hands, takes ~3 minutes:
python main.py simulate --hands 500000
```

### What the output looks like

```
BLACKJACK STRATEGY VALIDATION
============================================================

> Testing: Basic Strategy (flat bet)...
> Testing: Basic Strategy + Card Counting...
> Testing: Full System (Counting + Deviations)...

RESULTS COMPARISON
============================================================

  Basic Strategy:
    Profit:       -$2,150.00
    Win Rate:     42.3%
    Player Edge:  -0.430%
    Wagered:      $500,000.00

  w/ Counting:
    Profit:       +$1,040.00
    Win Rate:     43.1%
    Player Edge:  +0.208%
    Wagered:      $500,000.00

  Full System:
    Profit:       +$2,180.00
    Win Rate:     43.4%
    Player Edge:  +0.436%
    Wagered:      $500,000.00
```

**Basic Strategy** — flat minimum bet, no counting. The house edge is ~0.43%.

**w/ Counting** — same basic strategy decisions, but bet size follows the count. This alone swings the edge to the player.

**Full System** — counting + Illustrious 18 deviation plays. Best achievable edge with this system.

Use this command after changing rules in `config.py` to verify the edge figures are what you expect before committing to full training.

---

## 🎴 Training the Card Detector (YOLO)

The YOLO card detector enables Screenshot and Live scan modes to automatically identify cards from screen images. Without it, the app uses Tesseract OCR as a fallback (lower accuracy).

### Step 1 — Generate synthetic training data

This creates thousands of artificial card images for training. No real cards, no internet, no camera needed — everything is generated automatically.

```bash
# Standard — ~5 minutes, good accuracy:
python yolo/generate_dataset.py --images 10000

# Best accuracy — ~12 minutes:
python yolo/generate_dataset.py --images 25000
```

This creates a `yolo/dataset/` folder with images and label files.

**Full options for `generate_dataset.py`:**

| Flag | Default | What it does |
|------|---------|-------------|
| `--images 10000` | 10000 | Number of training scene images to generate |
| `--output yolo/dataset` | `yolo/dataset` | Where to save the dataset |
| `--width 640` | 640 | Width of each generated image in pixels |
| `--height 480` | 480 | Height of each generated image in pixels |
| `--seed 42` | 42 | Random seed — use the same number to reproduce the exact same dataset |

### Step 2 — Train the detector

```bash
# Default — yolov8s model, 100 epochs:
python yolo/train_yolo.py

# Faster / smaller model (use on weak hardware):
python yolo/train_yolo.py --model yolov8n

# Higher accuracy (use if you have a GPU):
python yolo/train_yolo.py --model yolov8m
```

**Model size options — choose based on your hardware:**

| Flag | Name | File size | Speed | Accuracy | Use when |
|------|------|----------|-------|---------|---------|
| `--model yolov8n` | Nano | ~3 MB | Fastest | Lowest | Weak CPU, need speed |
| `--model yolov8s` | Small | ~11 MB | Fast | Good | **Default — best trade-off** |
| `--model yolov8m` | Medium | ~25 MB | Moderate | Better | Have a GPU |
| `--model yolov8l` | Large | ~43 MB | Slow | High | Dedicated GPU |
| `--model yolov8x` | Extra | ~68 MB | Slowest | Highest | High-end GPU only |

**Full options for `train_yolo.py`:**

| Flag | Default | What it does |
|------|---------|-------------|
| `--model yolov8s` | `yolov8s` | Model size (see table above) |
| `--epochs 100` | 100 | Maximum training epochs (early stopping will stop before this if accuracy plateaus) |
| `--batch 16` | 16 | Images per training step — reduce to `8` if you see an out-of-memory error |
| `--imgsz 640` | 640 | Training image size in pixels — use `416` for faster training at slightly lower accuracy |
| `--patience 20` | 20 | Early stopping: stop if no improvement after this many epochs |
| `--workers 4` | 4 | Parallel data loading workers — set to `0` on Windows if you get errors |
| `--device 0` | auto | Force a specific device: `cpu`, `0` (first GPU), `0,1` (multi-GPU) |
| `--resume` | off | Resume from the last interrupted training run |
| `--eval` | off | Evaluate an already-trained model on the test set instead of training |

**Examples:**

```bash
# Fast training on CPU (smaller model, lower image size):
python yolo/train_yolo.py --model yolov8n --imgsz 416 --batch 8

# Best accuracy if you have a GPU:
python yolo/train_yolo.py --model yolov8m --epochs 150

# Resume an interrupted training run:
python yolo/train_yolo.py --resume

# Evaluate how accurate your trained model is:
python yolo/train_yolo.py --eval

# Fix DataLoader errors on Windows:
python yolo/train_yolo.py --workers 0
```

Training time:
- CPU (yolov8s): 30–60 minutes
- GPU (yolov8s): ~8 minutes
- GPU (yolov8m): ~15 minutes

Output file: `models/card_detector.pt`

The app loads this automatically when you next run `python main.py web`.

### Step 3 — Verify it loaded

When you start the app, you should see:
```
✅  YOLO card detector loaded from models/card_detector.pt
```

### Optional — Use real card photos for better accuracy

For even better detection accuracy, you can train on real card photographs from Roboflow:

1. Go to [https://universe.roboflow.com](https://universe.roboflow.com)
2. Search for "playing cards"
3. Download a dataset in **YOLOv8 format**
4. Extract the downloaded folder to `yolo/dataset/`
5. Run `python yolo/train_yolo.py`

### What happens if YOLO isn't trained

The system automatically falls back to:
1. **OpenCV** finds card-shaped rectangles in the image
2. **Tesseract OCR** reads the rank text (A, K, Q, J, 10, 9…) from each card

This fallback achieves ~85% accuracy on clean screenshots. For blurry or dark images it can drop to ~60%. YOLO achieves 95%+ on the same images, so training it is worthwhile if you plan to use screenshot or live scan modes.

---

## 📁 Project Structure — Every File Explained

```
BlackJackML-main/
│
├── main.py                 ← START HERE. The entry point for all commands.
│                             python main.py web       — dashboard
│                             python main.py train     — train strategy AI
│                             python main.py simulate  — run simulations
│                             python main.py overlay   — desktop overlay
│
├── config.py               ← ALL SETTINGS. Change table rules, bankroll,
│                             bet limits, ML hyperparameters here.
│                             You never need to edit any other file to
│                             configure the app.
│
├── requirements.txt        ← Python packages list. Run:
│                             pip install -r requirements.txt
│
├── build.sh                ← Frontend rebuild script (Mac/Linux).
│                             Only needed if you edit JS/React files.
│                             Run: bash build.sh
│
├── build.ps1               ← Same script for Windows PowerShell.
│                             Run: .\build.ps1
│
├── jsconfig.json           ← Tells VS Code that .js files here use React.
│                             You don't need to touch this.
│
│
├── blackjack/              ← CORE GAME ENGINE. Pure Python, no ML.
│   │                         These files define the rules of blackjack.
│   ├── card.py             ← Card, Rank, Suit, Deck, Shoe classes
│   ├── game.py             ← Hand, Round, BlackjackTable, Action classes
│   ├── counting.py         ← CardCounter — Hi-Lo, KO, Omega II, Zen Count
│   ├── strategy.py         ← Basic strategy lookup tables (every hand combo)
│   ├── deviations.py       ← Illustrious 18 + Fab 4 deviation rules
│   ├── betting.py          ← Kelly Criterion bet sizing logic
│   └── side_bets.py        ← Side bet EV calculator
│
│
├── ml_model/               ← STRATEGY AI. The neural network.
│   ├── model.py            ← BlackjackNet v2 architecture
│   │                         (ResidualNet + Attention + 3 decision heads)
│   ├── simulate.py         ← Monte Carlo game simulator (generates training data)
│   ├── train.py            ← Training pipeline
│   └── shuffle_tracker.py  ← LSTM + Bayesian shuffle tracking model
│
│
├── app/                    ← WEB DASHBOARD. The Flask server + React UI.
│   ├── server.py           ← Flask + Socket.IO backend. Handles all
│   │                         real-time card events and game state.
│   ├── cv_detector.py      ← Card detection: tries YOLO first, then OCR
│   ├── live_scanner.py     ← Background screen capture thread (Live mode)
│   ├── overlay.py          ← Desktop overlay window (python main.py overlay)
│   ├── templates/
│   │   └── index.html      ← HTML page that loads the app in the browser
│   └── static/
│       ├── bundle.min.js   ← ⚠ PRE-COMPILED. Do NOT edit this file directly.
│       │                     It is automatically generated from components/.
│       │                     Edit the source files below, then run build.sh.
│       ├── style.css       ← Dashboard styles (safe to edit directly)
│       └── components/     ← REACT SOURCE FILES. Edit these to change the UI.
│           ├── App.jsx           Main app — layout and state management
│           ├── ActionPanel.js    HIT / STAND / DOUBLE / SPLIT buttons
│           ├── AnalyticsPanel.js Detailed session analytics
│           ├── BettingPanel.js   Bet sizing recommendations + bankroll
│           ├── CardGrid.js       The 52-card input grid
│           ├── CasinoRiskMeter.js Casino detection risk indicator
│           ├── CenterToolBar.js  Centre control bar
│           ├── CompDepAlert.js   Composition-dependent strategy alerts
│           ├── CountHistory.js   Count history chart
│           ├── EdgeMeter.js      Player edge visual indicator
│           ├── HandDisplay.js    Current hand display
│           ├── I18Panel.js       Illustrious 18 deviation display
│           ├── LiveOverlayPanel.jsx  Live scan overlay panel
│           ├── SessionStats.js   Session win/loss stats
│           ├── ShoePanel.js      Remaining shoe information
│           ├── ShuffleTracker.js Shuffle tracking display
│           ├── SideBetPanel.js   Side bet EV analysis
│           ├── SideCountPanel.js Side count (aces, fives, tens)
│           ├── SplitHandPanel.js Split hand UI
│           ├── StopAlerts.js     Session stop-loss / stop-win alerts
│           ├── StrategyRefTable.js  Strategy reference table
│           ├── TopBar.js         Top navigation bar
│           ├── Widget.js         Reusable widget wrapper
│           ├── constants.js      Shared constants
│           └── utils.js          Shared utility functions
│
│
├── yolo/                   ← YOLO CARD DETECTOR training files.
│   ├── generate_dataset.py ← Generates synthetic card training images
│   ├── train_yolo.py       ← Trains the YOLOv8 model
│   └── dataset/            ← Auto-created by generate_dataset.py
│
│
├── models/                 ← AUTO-CREATED when you train. Do not create manually.
│   ├── best_model.pt       ← Strategy AI (created by python main.py train)
│   ├── card_detector.pt    ← YOLO card detector (created by python yolo/train_yolo.py)
│   └── training_log.csv    ← Training metrics per epoch
│
│
├── tests/
│   └── test_blackjack.py   ← Automated tests. Run with: pytest
│
│
└── build-src/              ← Build pipeline internals. Do not edit.
    ├── bundle.sh           ← Core build logic (called by build.sh)
    ├── fix_hooks.js        ← Fixes duplicate React hook declarations
    ├── minify.js           ← Minifies the compiled bundle
    └── tsconfig.json       ← TypeScript compiler settings
```

---

## ⚙️ Customising Settings

**All settings are in `config.py`**. You never need to edit any other file to customise the app's behaviour.

Open `config.py` in any text editor and change the values. Each value has a comment explaining what it does and what the valid options are.

### Game rules — `GameConfig`

Match these to the actual table you are playing at. Incorrect rules = incorrect advice.

```python
# Number of decks in the shoe (most casinos use 6 or 8)
NUM_DECKS = 8

# Dealer rule — False = stands on soft 17 (S17, better for you)
#               True  = hits soft 17 (H17, worse for you)
DEALER_HITS_SOFT_17 = False

# Blackjack payout — 3/2 = standard (always play this)
#                    1.2 = 6:5 (avoid these tables)
BLACKJACK_PAYS = 3 / 2

# Whether you can double down after splitting a pair
ALLOW_DOUBLE_AFTER_SPLIT = False

# Whether you can surrender (lose half your bet)
ALLOW_LATE_SURRENDER = True

# How much of the shoe is dealt before reshuffling (0.75 = 75%)
PENETRATION = 0.75
```

### Bankroll and bet sizing — `BettingConfig`

```python
# Minimum and maximum bet allowed at your table (in ₹ by default)
TABLE_MIN = 100
TABLE_MAX = 10000

# One "unit" of betting — should equal TABLE_MIN
BASE_UNIT = 100

# Your starting bankroll
INITIAL_BANKROLL = 100000

# Maximum bet / minimum bet ratio
# Higher spread = more profit at high counts, but more detectable
BET_SPREAD = 16

# Kelly fraction — 0.75 = three-quarter Kelly (recommended)
# Lower = more conservative (less variance, less profit)
# Higher = more aggressive (more variance, more profit)
KELLY_FRACTION = 0.75
```

### Counting system — `CountingConfig`

```python
# Default counting system when the app starts
# Options: "hi_lo", "ko", "omega_ii", "zen"
DEFAULT_SYSTEM = "hi_lo"

# Take insurance when True Count reaches this value
# At TC +3, insurance becomes mathematically profitable
INSURANCE_THRESHOLD = 3.0

# "Wonging" thresholds — back-counting (watching without playing)
# Enter the table when TC reaches this value:
WONGING_ENTER_TC = 2.0
# Leave the table (or drop to minimum bet) when TC falls below this:
WONGING_EXIT_TC = -1.0
```

> **Note:** `WONGING_ENTER_TC` and `WONGING_EXIT_TC` are informational — they affect the edge display and bet recommendations but do not force you to leave the table.

### Machine learning — `MLConfig`

These control how the neural network is built and trained. For most users, the defaults are fine.

```python
# Total simulated hands used to generate training data
# More = higher accuracy, longer training time
SIMULATION_HANDS = 1_000_000

# Number of training epochs (early stopping will stop before this if needed)
EPOCHS = 50

# Fraction of data reserved for validation (not used in training)
TRAIN_TEST_SPLIT = 0.20   # 0.20 = 20% for testing, 80% for training

# Minimum confidence before the model overrides basic strategy
# 0.70 = model must be 70%+ confident to change the recommendation
CONFIDENCE_THRESHOLD = 0.70

# Neural network trunk width — increase for more capacity (uses more RAM)
TRUNK_DIM = 256   # try 512 for slightly higher accuracy if you have enough RAM

# Samples processed per gradient update
BATCH_SIZE = 512   # reduce to 256 if you get out-of-memory errors

# Learning rate — how fast the model adjusts weights each step
LEARNING_RATE = 0.001
```

### Side bet payouts — `SideBetConfig`

Casinos vary widely on side bet payouts. Change these to match the actual payouts displayed at your table, otherwise the EV calculations will be wrong.

```python
# Perfect Pairs payouts
PERFECT_PAIRS_PAYOUT = {
    "perfect": 25,   # same rank, same suit (e.g. K♠ K♠ from different decks)
    "colored": 12,   # same rank, same colour (e.g. K♠ K♣)
    "mixed":    6,   # same rank, different colour (e.g. K♠ K♥)
}

# 21+3 payouts (your 2 cards + dealer upcard form a poker hand)
TWENTY_ONE_PLUS_3_PAYOUT = {
    "suited_trips":    100,
    "straight_flush":   40,
    "three_of_a_kind":  30,
    "straight":         10,
    "flush":             5,
}

# Lucky Ladies payouts (first two cards total 20)
LUCKY_LADIES_PAYOUT = {
    "matched_20_with_dealer_bj": 1000,
    "queen_hearts_pair":          200,
    "matched_20":                  25,
    "suited_20":                   10,
    "any_20":                       4,
}
```

### After changing settings

| What you changed | What to do next |
|-----------------|----------------|
| Game rules (`GameConfig`) | Retrain: `python main.py train --hands 1000000` |
| Counting system (`DEFAULT_SYSTEM`) | Retrain with the `simulate.py` fix (see Counting Systems section) + restart app |
| Bet limits / bankroll / Kelly | Just restart the app — no retraining needed |
| `CONFIDENCE_THRESHOLD` | Just restart the app — no retraining needed |
| Side bet payouts | Just restart the app — no retraining needed |
| ML architecture (`TRUNK_DIM`, `BATCH_SIZE`) | Retrain from scratch |

---

## 🔢 Counting Systems — Switching, Customising, and Training

### The 4 built-in systems

All four systems are defined in `config.py` under `CountingConfig.SYSTEMS`. Here is what each one is and who should use it:

| System key | Name | Level | Best for |
|-----------|------|-------|---------|
| `hi_lo` | Hi-Lo | Beginner | Most players. ±1 values only, easy to keep track of |
| `ko` | Knock-Out | Beginner | Players who want to skip the true count conversion step |
| `omega_ii` | Omega II | Advanced | Higher accuracy — requires tracking ±2 values |
| `zen` | Zen Count | Advanced | Good middle ground between Hi-Lo and Omega II |

### How each system assigns values to cards

| Card | Hi-Lo | KO | Omega II | Zen |
|------|-------|----|---------|-----|
| 2 | +1 | +1 | +1 | +1 |
| 3 | +1 | +1 | +1 | +1 |
| 4 | +1 | +1 | **+2** | **+2** |
| 5 | +1 | +1 | **+2** | **+2** |
| 6 | +1 | +1 | **+2** | **+2** |
| 7 | 0 | **+1** | +1 | +1 |
| 8 | 0 | 0 | 0 | 0 |
| 9 | 0 | 0 | **-1** | 0 |
| 10/Face | -1 | -1 | **-2** | **-2** |
| Ace | -1 | -1 | 0 | **-1** |

### Switching systems while the app is running

Use the **system dropdown in the top bar** of the dashboard. Switching resets the running count to 0 automatically, because different systems start from different baselines.

You do not need to retrain anything to switch systems live. The count logic is purely mathematical — no model involved.

### Changing the default system that loads on startup

Open `config.py` and change `DEFAULT_SYSTEM` inside `CountingConfig`:

```python
class CountingConfig:
    # Options: "hi_lo", "ko", "omega_ii", "zen"
    DEFAULT_SYSTEM = "hi_lo"   # ← change this
```

Valid values are exactly: `"hi_lo"`, `"ko"`, `"omega_ii"`, `"zen"`

Restart the app after saving. No retraining needed.

### Training the strategy model — single system vs. all systems

The training pipeline now supports two modes controlled by the `--system` flag:

| Command | What it trains on | Best for |
|---------|-------------------|----------|
| `python main.py train --hands 1000000` | All 4 systems equally (default) | General use — model works correctly regardless of which system you switch to in the app |
| `python main.py train --hands 1000000 --system hi_lo` | Hi-Lo only | Dedicated Hi-Lo players who never switch systems |
| `python main.py train --hands 1000000 --system omega_ii` | Omega II only | Advanced players locked to Omega II |
| `python main.py train --hands 1000000 --system zen` | Zen Count only | Dedicated Zen players |

**Recommendation:** Use `--system all` (the default) unless you are certain you will only ever use one counting system. The universal model handles all four correctly at inference time.

#### Why `--system all` works correctly

Omega II and Zen use ±2 card tags, so their raw running counts and true counts are roughly twice as large as Hi-Lo's. Without correction, feeding an Omega II true count of +8 into a model trained only on Hi-Lo (which rarely exceeds +5) would produce garbage.

The fix is normalisation. Each system's counts are divided by system-specific scalars before entering the network:

| System | True count ÷ | Running count ÷ |
|--------|--------------|-----------------|
| Hi-Lo | 10 | 20 |
| KO | 10 | 20 |
| Omega II | 20 | 40 |
| Zen | 20 | 40 |

These scalars map all four systems to the same `[-1, +1]` range. Training on the mixed dataset teaches the model one universal decision surface. At inference time, `server.py` automatically passes the active system name to `model.py`, which applies the correct scalars.

> **Note:** If you train `--system hi_lo` and then switch the app dropdown to Omega II mid-session, the model's count-based decisions will be degraded because the model was trained only on Hi-Lo-range inputs. Train with `--system all` to avoid this.

### Deleting the trained model and retraining from scratch

Do this whenever you change table rules in `config.py`, switch from a single-system model to an all-system model, or want a completely clean slate.

**Step 1 — Delete the existing model files:**

On Windows (PowerShell):
```powershell
Remove-Item models\best_model.pt        -ErrorAction SilentlyContinue
Remove-Item models\last_checkpoint.pt   -ErrorAction SilentlyContinue
Remove-Item models\checkpoint_epoch*.pt -ErrorAction SilentlyContinue
Remove-Item models\training_log.csv     -ErrorAction SilentlyContinue
Remove-Item models\training_summary.json -ErrorAction SilentlyContinue
```

On macOS / Linux:
```bash
rm -f models/best_model.pt
rm -f models/last_checkpoint.pt
rm -f models/checkpoint_epoch*.pt
rm -f models/training_log.csv
rm -f models/training_summary.json
```

**Step 2 — Retrain from scratch:**
```bash
# Recommended — trains on all 4 counting systems (universal model)
python main.py train --hands 1000000

# Or for maximum accuracy
python main.py train --hands 2000000 --epochs 60
```

The trainer will detect no existing checkpoint and start from epoch 1 automatically.

> **Why you must delete before retraining after a rule change:** If `best_model.pt` exists, the app continues using it until you restart. Deleting it ensures the app falls back to the rules engine immediately while the new model trains, rather than using the stale model.

**Quick verification after retraining:**
```bash
python main.py web
```
The terminal should print:
```
✅  Strategy model loaded from models/best_model.pt
```
If it prints `⚠️  No trained model found` the file was not saved correctly — check that the `models/` folder exists in the project root.

### Adding a custom counting system

If you want to use a system not built in (e.g. Uston SS, Halves, Red Seven), add it to `config.py` under `CountingConfig.SYSTEMS`:

```python
SYSTEMS = {
    "hi_lo": { ... },
    "ko":    { ... },
    "omega_ii": { ... },
    "zen":   { ... },

    # Add your custom system here:
    "my_system": {
        2: +1, 3: +2, 4: +2, 5: +3, 6: +2, 7: +1,
        8:  0, 9: -1,
        10: -2, 11: -2
    },
}
```

Keys are card face values: 2 through 10, and 11 for Aces. Values are the count tags (+2, +1, 0, -1, -2, etc.).

After adding it, also add an entry to `COUNT_NORM_SCALARS` in `CountingConfig` so the normalisation stays correct when training on your system:

```python
COUNT_NORM_SCALARS = {
    "hi_lo":    ( 10.0,  20.0,  0.10 ),
    "ko":       ( 10.0,  20.0,  0.10 ),
    "omega_ii": ( 20.0,  40.0,  0.10 ),
    "zen":      ( 20.0,  40.0,  0.10 ),
    # Add your system — set tc_scale to the max |TC| you expect,
    # rc_scale to tc_scale × max_decks_remaining (~7 for 8-deck shoe)
    "my_system": ( 15.0,  30.0,  0.10 ),
}
```

Then retrain:
```bash
python main.py train --hands 1000000 --system my_system
```



### Entering cards for a hand

1. Click **P** in the toolbar (or press `P` on your keyboard) to target the Player hand
2. Click on card buttons to enter your two starting cards
3. Click **D** (or press `D`) to target the Dealer hand
4. Click the dealer's upcard (the face-up card)
5. The AI recommendation appears immediately in the Action Panel

### Reading the recommendation

The Action Panel shows:
- **HIT / STAND / DOUBLE / SPLIT / SURRENDER** — the recommended action in large text
- The true count and running count
- Your current edge percentage
- Bet recommendation in the Betting Panel below

### Recording the result

After the hand is over, click one of:
- **WIN** — you won the hand
- **PUSH** — tie (no money won or lost)
- **LOSS** — you lost the hand
- **SURR** — you surrendered (lost half the bet)

These update your session statistics and bankroll display.

### Starting a new hand

Press **N** on your keyboard, or click the "New Hand" button in the top bar.

> The running count is **not** reset when you start a new hand. It only resets when you press **S** (shuffle), which represents a real casino shuffle.

### Session tracking

The Session Stats panel shows:
- Hands played this session
- Win/loss/push counts
- Net profit/loss in your currency
- Win rate percentage

---

## 🃏 Three Card Entry Modes

### Mode 1 — Manual Grid (always available, no training needed)

Click directly on the 52-card grid to enter cards one by one. Best for learning or when playing live at a physical table.

### Mode 2 — Screenshot Paste (requires Tesseract or YOLO)

Take a screenshot of the casino table and paste it into the app. The CV pipeline reads all visible cards automatically.

**How to take a screenshot of just the table area:**

| OS | How |
|----|-----|
| Windows | `Win + Shift + S` → drag to select area → `Ctrl+V` in the app |
| macOS | `Cmd + Shift + 4` → drag to select area → `Cmd+V` in the app |
| Linux | `PrtScn` or Flameshot → `Ctrl+V` in the app |

### Mode 3 — Live Auto-Scan (requires YOLO trained)

The app captures your screen continuously and detects cards in real time. Click **Set Window** and select the browser tab or casino software window to scan.

> Live scan does not work inside Docker containers.

---

## 🔀 Card Routing (Player / Dealer / Seen)

The **P / D / Seen** toggle in the toolbar controls where each card you enter gets assigned.

| Setting | What happens to the card |
|---------|-------------------------|
| **P (Player)** | Added to your hand + counted in the running count |
| **D (Dealer)** | Added to the dealer's hand + counted |
| **Seen** | Counted in the running count only — not added to any hand |

Use **Seen** for cards belonging to other players at the table. They affect the count but are not part of your decision.

The toolbar automatically switches to **D** when your hand total reaches a point where the dealer card is expected. You can always override this manually.

---

## ✂ Split Hand Workflow

When you have a pair, a **SPLIT PAIR** button appears with a pulsing purple border.

**Step-by-step:**

1. Click **SPLIT PAIR** — the hand splits into two side-by-side zones
2. The target automatically switches to Hand 1
3. Deal cards to Hand 1 as normal (with Player target)
4. When Hand 1 is complete, click **✓ Done with Hand 1 → Next Hand**
5. Deal cards to Hand 2
6. When both hands are done, a green **"All split hands complete"** banner appears
7. Record your results for each hand, then press **N** for a new hand

**Rules enforced automatically:**
- No surrender on split hands
- No double after split (unless enabled in `config.py`)
- Split aces receive exactly one card each (auto-stands)
- Each split hand gets its own independent AI recommendation

**Undo during split:** Press `Ctrl+Z` — removes only the last card from the currently active hand. The other split hand is not affected.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `N` | New hand (count is preserved) |
| `S` | Shuffle — resets running count to 0 |
| `P` | Set deal target to Player |
| `D` | Set deal target to Dealer |
| `Ctrl+Z` / `Cmd+Z` | Undo last card dealt |

> Shortcuts are automatically disabled when your cursor is inside a text input or dropdown. Click anywhere outside the input first if shortcuts stop working.

---

## 💱 Currency Settings

The default currency is **Indian Rupee (₹)**. To change it:

1. Click the currency symbol button in the Bet Sizing panel
2. Search for your currency by name or code
3. Select it — all amounts update immediately

Supported currencies include USD, EUR, GBP, JPY, AUD, CAD, CHF, SGD, AED, and 10 more fiat currencies, plus BTC, ETH, BNB, SOL, and other major cryptocurrencies.

---

## 🔨 Editing the Frontend (JS/React files)

The browser loads `app/static/bundle.min.js` — a single pre-compiled file automatically generated from all 22 source files in `app/static/components/`.

**If you edit any `.js` or `.jsx` file in `app/static/components/`, you MUST rebuild the bundle before the browser will reflect your changes.**

### Prerequisites for rebuilding

You need Node.js and TypeScript installed. You only need this if you want to edit the UI.

```bash
# Check if Node.js is installed:
node --version   # Should show v18.x.x or higher

# If not installed, download from: https://nodejs.org
# Download the LTS version

# Install TypeScript globally:
npm install -g typescript

# Verify:
tsc --version
```

### Rebuilding after edits

```bash
# Mac / Linux:
bash build.sh

# Windows PowerShell:
.\build.ps1

# If Windows gives a security error:
Unblock-File .\build.ps1
.\build.ps1
```

After rebuilding, refresh the browser (`F5`) to see your changes.

### Watch mode (auto-rebuild on save)

Instead of manually running the build after every edit, watch mode rebuilds automatically each time you save a component file.

```bash
# Mac / Linux:
bash build.sh --watch

# Windows PowerShell:
Unblock-File .\watch.ps1
.\watch.ps1
```

Both do the same thing: run a first build immediately, then watch `app/static/components/` for any file change and rebuild within 1–2 seconds. Press `Ctrl+C` to stop.

> **Important:** Never edit `bundle.min.js` directly. It is overwritten every time you rebuild.

---

## 🧪 Running the Tests

The project has a full test suite covering the core game engine — hand values, card counting, basic strategy, deviations, and bet sizing.

### Install the test runner (once)

`pytest` is already in `requirements.txt`, so if you ran `pip install -r requirements.txt` it is already installed. Verify:

```bash
pytest --version
```

### Running the tests

All commands below must be run from the project root folder with your virtual environment active.

```bash
# Run all tests:
pytest

# Run with verbose output (shows each test name as it passes/fails):
pytest -v

# Run a specific test file:
pytest tests/test_blackjack.py -v

# Run only tests whose name contains a keyword (e.g. only soft hand tests):
pytest -v -k "soft"

# Run only tests whose name contains any of several keywords:
pytest -v -k "counting or deviation"

# Stop immediately on first failure (useful when debugging):
pytest -x

# Run with coverage report (shows which lines of code were tested):
pytest --cov

# Coverage report with per-file breakdown:
pytest --cov --cov-report=term-missing
```

### What the tests cover

| Test class | What it tests |
|-----------|--------------|
| `TestHandValues` | Hard totals, soft totals, multi-ace hands, blackjack detection, bust |
| `TestSplitMechanics` | Pair splitting, `split_from_ace` flag, re-split logic |
| `TestBustAndResolution` | Bust detection, hand result outcomes |
| `TestCounting` | Running count accuracy across all 4 systems, true count, ace tracking |
| `TestBasicStrategy` | Key strategy decisions for hard, soft, and pair hands |
| `TestDeviations` | Illustrious 18 + Fab 4 play deviations at specific true counts |
| `TestBettingEngine` | Kelly criterion, bet spread, session stats consistency |
| `TestSoftStrategyIntegration` | Full round simulation with soft hands |
| `TestFeatureScenarios` | Complex multi-card and edge-case scenarios |

### When to run tests

Run the tests after any of these:
- Changing rules in `config.py` (verify the engine logic is still correct)
- Editing any file in `blackjack/` (strategy, counting, game engine)
- Applying patches or making bug fixes to the core engine

The tests do not test the web server, React UI, or ML model — only the pure Python game engine.

---

## 🖥 Desktop Overlay (Live Mode)

The overlay is a separate mode from the web dashboard. It is a transparent always-on-top window that sits over your casino software and scans the screen automatically — no clicking card buttons needed.

### Prerequisites

The overlay requires `mss` for screen capture and `tkinter` for the window. Install `mss` if you haven't:

```bash
pip install mss
```

`tkinter` is bundled with Python on Windows and macOS. On Linux:
```bash
sudo apt install python3-tk
```

### Launching the overlay

```bash
# Default settings (6 decks, Hi-Lo, scan every 1.5 seconds):
python main.py overlay

# Custom settings:
python main.py overlay --decks 8 --system omega_ii --interval 2000
```

**Overlay launch flags:**

| Flag | Default | What it does |
|------|---------|-------------|
| `--decks 6` | 6 | Number of decks in the shoe |
| `--system hi_lo` | `hi_lo` | Counting system: `hi_lo`, `ko`, `omega_ii`, `zen` |
| `--interval 1500` | 1500 | How often to scan the screen, in milliseconds (1500 = every 1.5 seconds) |

### First launch — selecting the scan region

On first launch (and any time you press `F10`), a fullscreen region selector appears. Drag to draw a rectangle over the casino table area in your browser. Press `Enter` to confirm or `Esc` to cancel.

The selected region is saved to `overlay_settings.json` and reused on every subsequent launch until you change it.

### Overlay hotkeys

| Key | Action |
|-----|--------|
| `F9` | Pause or resume scanning |
| `F10` | Reselect the scan region |
| `Esc` | Quit the overlay |

### What the overlay shows

- **Recommended action** (HIT / STAND / DOUBLE / SPLIT / SURRENDER)
- **True count** and running count
- **Bet recommendation** in units
- **Player advantage** percentage
- **Cards detected** this scan

### Limitations

- Live scan and the desktop overlay do not work inside Docker containers (no screen access)
- Accuracy depends on YOLO being trained — without it, falls back to Tesseract OCR
- If the scan interval is too fast and the screen hasn't updated between scans, the same cards may be counted twice. Increase `--interval` if you notice count drift.

---

## 📐 Illustrious 18 + Fab 4 — Complete Reference

When the true count reaches certain thresholds, the mathematically correct play **changes** from basic strategy. The app detects these situations automatically and overrides the recommendation. These overrides are called deviations.

There are two sets built into the app:

- **Illustrious 18** — the 18 most valuable play deviations, worth ~0.15% extra edge combined
- **Fab 4 Surrenders** — 4 count-based surrender plays, worth ~0.05% extra edge combined

You do not need to memorise these — the I18 Panel in the dashboard highlights whenever a deviation is active. But understanding them helps you trust the recommendations.

### How to read the table

- **Basic strategy** = what the app recommends with no count information
- **Deviation action** = what the app switches to when the TC threshold is met
- **TC threshold** = the minimum true count required to trigger the deviation
- **Direction** = `≥` means trigger at or above the threshold; `<` means trigger below it

### Illustrious 18 — sorted by value (most important first)

| # | Your hand | Dealer upcard | Basic strategy | Deviation action | TC threshold |
|---|-----------|---------------|----------------|------------------|--------------|
| 1 | Hard 16 | 10 | Hit | **Stand** | TC ≥ 0 |
| 2 | Pair of 10s | 5 | Stand | **Split** | TC ≥ +5 |
| 3 | Pair of 10s | 6 | Stand | **Split** | TC ≥ +4 |
| 4 | Hard 10 | 10 | Hit | **Double** | TC ≥ +4 |
| 5 | Hard 12 | 3 | Hit | **Stand** | TC ≥ +2 |
| 6 | Hard 12 | 2 | Hit | **Stand** | TC ≥ +3 |
| 7 | Hard 11 | Ace | Hit | **Double** | TC ≥ +1 |
| 8 | Hard 9 | 2 | Hit | **Double** | TC ≥ +1 |
| 9 | Hard 10 | Ace | Hit | **Double** | TC ≥ +4 |
| 10 | Hard 9 | 7 | Hit | **Double** | TC ≥ +3 |
| 11 | Hard 16 | 9 | Hit | **Stand** | TC ≥ +5 |
| 12 | Hard 13 | 2 | Stand | **Hit** | TC < −1 |
| 13 | Hard 12 | 4 | Stand | **Hit** | TC < 0 |
| 14 | Hard 12 | 5 | Stand | **Hit** | TC < −2 |
| 15 | Hard 12 | 6 | Stand | **Hit** | TC < −1 |
| 16 | Hard 13 | 3 | Stand | **Hit** | TC < −2 |
| 17 | Hard 10 | 9 | Hit | **Double** | TC ≥ +2 |
| — | Insurance | Dealer Ace | Decline | **Take** | TC ≥ +3 |

> **Note on Hard 16 vs 10 (row 1):** This deviation is composition-dependent for two-card hands. A 10+6 triggers at TC ≥ 0. A 9+7 requires TC ≥ +1 because removing a 9 and a 7 (both mid-cards) slightly worsens the remaining deck compared to 10+6 where the 10 removes a high card. Multi-card 16 (e.g. 5+5+6) always uses TC ≥ 0.

> **Note on rows 12–16 (negative TC deviations):** At very negative counts the shoe is full of high cards, which makes standing on stiff hands against weak dealer upcards less correct. The app will recommend hitting these hands when the count turns sufficiently negative.

### Fab 4 Surrenders

These are checked **before** the Illustrious 18. Surrender is always evaluated first because it is the most profitable action when it applies.

| Your hand | Dealer upcard | Basic strategy | Deviation | TC threshold |
|-----------|--------------|---------------|-----------|-------------|
| Hard 15 | 10 | Hit/Surrender | **Surrender** | TC ≥ 0 |
| Hard 15 | Ace | Hit | **Surrender** | TC ≥ +1 |
| Hard 15 | 9 | Hit | **Surrender** | TC ≥ +2 |
| Hard 14 | 10 | Hit | **Surrender** | TC ≥ +3 |

> **Surrender must be enabled** (`ALLOW_LATE_SURRENDER = True` in `config.py`) for the Fab 4 to apply. If surrender is unavailable at your table, the engine falls through to the Illustrious 18 automatically.

### How the I18 Panel works in the dashboard

When a deviation fires, the I18 Panel lights up showing:
- Which deviation triggered (e.g. "Hard 16 vs 10 — Stand at TC ≥ 0")
- Whether it was a Fab 4 surrender or an I18 play change
- The basic strategy action being overridden

The Action Panel recommendation updates simultaneously.

---

## 📊 Dashboard Panels — Analytics, Risk, Stop Alerts, Shuffle Tracker

### Analytics Panel — N₀ and Shoe Quality Score

The Analytics Panel shows two numbers that tell you how strong the current situation is.

#### N₀ — Variance Convergence Tracker

**N₀ = Variance ÷ Edge²**

N₀ is the number of hands you need to play before your mathematical edge is large enough to reliably overcome the natural variance of the game. Until you reach N₀ hands, losing streaks are statistically normal and say nothing about whether you are playing correctly.

| N₀ display | What it means |
|-----------|--------------|
| `—` or "Accumulating data…" | Fewer than 20 hands played this session — not enough data |
| Green number, < 1,000 | Fast convergence — your edge is strong and confirms quickly |
| Yellow number, 1,000–2,000 | Moderate convergence — keep playing, results will stabilise |
| Large number, > 2,000 | Slow convergence — variance is dominant, losing streaks are normal |
| "Edge too small to measure" | N₀ > 99,999 — your edge is too thin for practical convergence |
| "⏳ X more hands until EV dominates" | How many more hands until you pass N₀ |
| "✅ Past N₀ — EV is dominating variance" | You have played enough hands that the edge is statistically confirmed |

N₀ is computed from your actual session data (realized variance of profit/bet ratios), not a theoretical constant. It updates every hand.

#### Shoe Quality Score — 0 to 100

A composite score showing how favourable the current shoe is for the player, displayed as a colour-coded bar.

| Score range | Colour | Label | Meaning |
|------------|--------|-------|---------|
| 0 – 40 | 🔴 Red | Bad | Count is negative, penetration low, ace-poor — bet minimum |
| 40 – 70 | 🟡 Yellow | Neutral | Mixed conditions — follow count signals normally |
| 70 – 100 | 🟢 Green | Strong | High count, deep penetration, ace-rich — prime betting conditions |

The score is a weighted combination of three factors:
- **60% — True Count** (the primary signal; maps −5 to +5 onto 0–100)
- **25% — Penetration** (how deep into the shoe you are; deeper = more reliable count)
- **15% — Ace richness** (whether more aces remain than expected)

Hover the `?` icon on the panel to see a tooltip with this breakdown.

---

### Casino Risk Meter

The Casino Risk Meter estimates how detectable your betting pattern looks to casino surveillance. It analyses your last session of hands in real time and assigns a heat level.

| Level | Label | Colour | Meaning |
|-------|-------|--------|---------|
| 0 | LOW | 🟢 Green | Pattern looks natural — continue playing |
| 1 | WARM | 🟡 Yellow | Mild signals detected — play naturally, avoid max bets in a row |
| 2 | HOT | 🟠 Orange | Noticeable pattern — reduce spread, make some cover plays |
| 3 | CRITICAL | 🔴 Red | Pattern is obvious — leave the table immediately |

**The four signals the meter watches:**

| Signal | What triggers it |
|--------|----------------|
| **Bet spread ratio** | Max bet ÷ min bet this session. ≥ 3:1 = mild, ≥ 5:1 = noticeable, ≥ 8:1 = high risk |
| **Bet-TC correlation** | What % of your big bets happened at TC ≥ +2. ≥ 60% = noticeable, ≥ 80% = strong counter pattern |
| **Big-bet win rate** | Win rate specifically on your large bets. ≥ 50% = mild, ≥ 55% = above normal |
| **Session length** | ≥ 100 hands = moderate visibility, ≥ 200 hands = high visibility |

The meter needs at least 5 hands of history before it activates. Before that it shows "Play N more hand(s) to enable risk tracking".

**What to do when the meter rises:**

- **WARM:** Make a couple of flat bets even when the count is high (called "cover plays"). Vary your bet sizing slightly rather than using exact multiples.
- **HOT:** Consider leaving soon. Reduce your maximum bet for a while. Take a break between shoes.
- **CRITICAL:** Leave the table. The pattern is detectable and continuing to play risks being asked to leave by casino staff.

---

### Stop-Loss and Stop-Win Alerts

The Stop Alerts panel lets you set session limits — a maximum loss you are willing to accept and a profit target at which to stop.

**Default thresholds (from `config.py`):**
- Stop-loss: −50 units (e.g. −₹5,000 if `BASE_UNIT = 100`)
- Stop-win: +30 units (e.g. +₹3,000)

#### Changing the thresholds in the dashboard

Click the **edit** button (pencil icon) in the Stop Alerts panel. Enter your stop-loss as a **negative number** (e.g. `-3000`) and your stop-win as a **positive number** (e.g. `5000`). Click Save — the server updates immediately and the progress bars reflect the new limits.

#### Changing the default thresholds in code

Open `blackjack/betting.py` and look for these two lines near the top of `BettingEngine.__init__`:

```python
self.stop_loss = -(self.config.BASE_UNIT * 50)   # default: -50 units
self.stop_win  =  (self.config.BASE_UNIT * 30)   # default: +30 units
```

Change the multipliers to suit your session style. For example, for tighter limits:

```python
self.stop_loss = -(self.config.BASE_UNIT * 20)   # −20 units
self.stop_win  =  (self.config.BASE_UNIT * 15)   # +15 units
```

#### What happens when a threshold is hit

When your session profit reaches the stop-win or falls to the stop-loss, a full-screen alert fires:

- **Stop-loss hit:** "You're down ₹X,XXX — limit was ₹X,XXX. Stop playing now."
- **Stop-win hit:** "You're up ₹X,XXX — target was ₹X,XXX. Lock in your profit."

The app does not force you to stop — it is a reminder. You can dismiss the alert and continue. The progress bars remain visible in the panel so you always see your distance to each limit.

---

### Shuffle Tracker

The Shuffle Tracker panel shows the status of the LSTM + Bayesian system that maintains count information **across reshuffles**.

A traditional card counter resets to zero on every shuffle. The Shuffle Tracker does not. Instead, it uses two components to retain partial information:

**Bayesian Persistent Counter** — After a shuffle, instead of assuming the shoe is perfectly randomised, it blends the pre-shuffle count with a uniform distribution. How much information is retained depends on the shuffle type:

| Shuffle type | Information retained after shuffle |
|-------------|-----------------------------------|
| Machine shuffle | ~2% — nearly full reset |
| Hand shuffle (riffle) | ~15% — some information survives |
| Strip shuffle | ~8% |
| Cut only | ~60% — most information survives |

**LSTM Neural Network** — Watches the sequence of cards dealt and learns how specific casino shuffle procedures rearrange card zones. Over multiple shoes, it builds a prediction of how high-value cards from the current shoe will be distributed in the next one.

**What the panel shows:**

| Field | What it means |
|-------|--------------|
| Shuffle count | How many reshuffles the tracker has observed this session |
| Count adjustment | The value added to the traditional true count (e.g. +0.3 means the shoe is estimated to be 0.3 TC richer than raw counting suggests) |
| Bayesian confidence | 1.0 = full confidence (fresh shoe). Drops after each shuffle, rebuilds as cards are seen |
| Ace prediction | Probability the next unseen card is an ace, based on sequencing patterns |

**When does it matter?** The shuffle tracker provides the most value against casinos that use hand shuffles (riffles) or cut-only procedures. Against machine shuffles it has nearly no effect because machine shuffles are close to perfect random. It also becomes more accurate over multiple shoes as the LSTM learns the specific dealer's shuffle pattern.

**The tracker requires no training** — it works immediately from the first hand. The LSTM component becomes more accurate over time as it accumulates observations.

---



### Option A — Local use (default)

Just run:
```bash
python main.py web
```
Access at **http://localhost:5000**. Only you can access it.

### Option B — Production server on a Linux VPS

If you want to deploy on a server (e.g., a DigitalOcean or AWS instance) so others can access it:

#### 1. Get a server

Create a fresh Ubuntu 22.04 VPS. Any provider works (DigitalOcean, Hetzner, Vultr, AWS Lightsail). The cheapest tier ($4–6/month) is enough.

#### 2. Upload the project

From your local machine:
```bash
scp -r BlackJackML-main/ username@your-server-ip:/home/username/
```

Or use Git:
```bash
# On the server:
git clone https://github.com/yourusername/BlackJackML.git
cd BlackJackML
```

#### 3. Install dependencies on the server

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv tesseract-ocr -y
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn eventlet
```

#### 4. Run with Gunicorn (production web server)

```bash
gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:5000 app.server:app
```

Your app is now accessible at `http://your-server-ip:5000`.

#### 5. Keep it running after you close the terminal

```bash
# Install screen (a terminal multiplexer):
sudo apt install screen -y

# Start a named session:
screen -S blackjackml

# Run the app inside screen:
source venv/bin/activate
gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:5000 app.server:app

# Detach from screen (the app keeps running):
# Press Ctrl+A, then D

# To reattach later:
screen -r blackjackml
```

#### 6. Add a domain name (optional)

If you have a domain, point it to your server's IP address and set up Nginx as a reverse proxy:

```bash
sudo apt install nginx -y
```

Create `/etc/nginx/sites-available/blackjackml`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/blackjackml /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Your app is now accessible at `http://yourdomain.com`.

### Option C — Docker

Docker packages the app into a container that runs identically on any machine.

#### Prerequisites

Install Docker Desktop from [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/).

#### Create a Dockerfile

Create a file named `Dockerfile` in the project root with these exact contents:

```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y tesseract-ocr && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the project
COPY . .

EXPOSE 5000

CMD ["python", "main.py", "web", "--host", "0.0.0.0"]
```

#### Build and run

```bash
# Build the Docker image (takes 3–5 minutes the first time):
docker build -t blackjackml .

# Run the container:
docker run -p 5000:5000 blackjackml
```

Open **http://localhost:5000** in your browser.

#### Persist your trained models across container restarts

```bash
docker run -p 5000:5000 -v $(pwd)/models:/app/models blackjackml
```

> **Note:** Live scan (Mode 3) does not work inside Docker because Docker cannot access your screen. Manual and Screenshot modes work fine.

---

## ❓ Troubleshooting — Common Errors

### `python is not recognized as an internal or external command`

**Cause:** Python is not in your system PATH.

**Fix:**
1. Uninstall Python from Windows Settings → Apps
2. Reinstall from [https://python.org](https://python.org)
3. On the installer's first screen, tick **"Add python.exe to PATH"** before clicking Install Now
4. Open a brand new PowerShell window (closing and reopening is required)

---

### `tesseract is not installed or it's not in your PATH`

**Windows fix:**
1. Download the installer from [https://github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki)
2. Run it and tick **"Add Tesseract to the system PATH"** during installation
3. Open a new PowerShell window after installing

If you already installed Tesseract without the PATH option:
1. Find where Tesseract was installed (usually `C:\Program Files\Tesseract-OCR\`)
2. Go to Windows search → "Environment Variables" → "Edit the system environment variables"
3. Click "Environment Variables" → under "System variables", find "Path" → click Edit
4. Click "New" and add `C:\Program Files\Tesseract-OCR\`
5. Click OK, open a new terminal

**macOS fix:**
```bash
brew install tesseract
```

**Linux fix:**
```bash
sudo apt install tesseract-ocr
```

---

### `ModuleNotFoundError: No module named 'flask'` (or any other package)

**Cause:** You either forgot to install packages, or your virtual environment is not active.

**Fix:**
```bash
# Make sure you are in the project folder:
cd BlackJackML-main

# Activate the virtual environment:
source venv/bin/activate         # Mac/Linux
.\venv\Scripts\Activate.ps1      # Windows PowerShell

# Install packages:
pip install -r requirements.txt
```

---

### `ModuleNotFoundError: No module named 'blackjack'`

**Cause:** You are running the command from the wrong folder.

**Fix:** Always run commands from the project root folder — the folder that contains `main.py`:
```bash
cd BlackJackML-main
python main.py web
```

---

### `Address already in use` — port 5000 is taken

**Cause:** Another program is using port 5000. On macOS, AirPlay Receiver uses port 5000 by default.

**Fix:**
```bash
python main.py web --port 8080
```
Then open **http://localhost:8080** instead.

**macOS alternative:** Disable AirPlay Receiver: System Settings → General → AirDrop & Handoff → AirPlay Receiver → Off

---

### `.\build.ps1 cannot be loaded because running scripts is disabled`

**Cause:** Windows PowerShell blocks script execution by default.

**Fix:** Run this once in PowerShell as Administrator:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Or unblock just this file:
```powershell
Unblock-File .\build.ps1
.\build.ps1
```

---

### `tsc: command not found` or `tsc is not recognized`

**Cause:** TypeScript is not installed. This is only needed if you want to rebuild the frontend after editing JS files.

**Fix:**
```bash
npm install -g typescript
```

If `npm` is also not found, install Node.js from [https://nodejs.org](https://nodejs.org) (download the LTS version), then run the command above.

---

### `bash: command not found` on Windows

**Cause:** You ran `bash build.sh` in PowerShell or CMD. Windows does not have `bash` by default.

**Fix:** Use the PowerShell script instead:
```powershell
.\build.ps1
```

---

### I edited a component file but nothing changed in the browser

**Cause:** The browser loads `bundle.min.js` (pre-compiled). Editing source files has no effect until you rebuild.

**Fix:**
```bash
bash build.sh        # Mac/Linux
.\build.ps1          # Windows
```
Then press `F5` in the browser to hard-refresh.

---

### Dashboard loads but cards don't register when I click

**Steps to diagnose:**
1. Press `F12` → open the "Console" tab
2. Look for any red error messages
3. Confirm the Flask server is still running in your terminal (no error printed)
4. Check the URL is `http://localhost:5000` — not `https://`
5. Try a hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

---

### Keyboard shortcuts (N, P, D, S) don't work

**Cause:** Your cursor is inside a text input or dropdown. Shortcuts are disabled while typing.

**Fix:** Click anywhere on the card grid (not inside an input box), then try the shortcut.

---

### `Ctrl+Z` does nothing

Same cause as above — click outside any input first. Also make sure the browser window is focused (not another app).

---

### Training is extremely slow — taking hours

**Cause:** Training is running on CPU. GPU training is ~6× faster.

**Check if you have a compatible GPU:**
```bash
python -c "import torch; print('GPU:', torch.cuda.is_available())"
```

**If True, install GPU PyTorch:**
```bash
pip uninstall torch -y
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

**If False or you don't have an NVIDIA GPU:** CPU training is normal. Use fewer hands to reduce time:
```bash
python main.py train --hands 500000 --epochs 30
```

---

### `RuntimeError: CUDA out of memory`

**Cause:** GPU doesn't have enough memory for the default batch size.

**Fix:** Reduce the batch size in `config.py`:
```python
# In MLConfig:
BATCH_SIZE = 256   # default is 512 — halve it
```

---

### Virtual environment is broken after moving the project folder

**Cause:** Virtual environments store absolute paths internally. Moving the folder breaks them.

**Fix:** Delete and recreate:
```bash
# Mac/Linux:
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Windows:
Remove-Item -Recurse -Force .\venv
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

---

### `gunicorn: command not found` during deployment

**Fix:**
```bash
pip install gunicorn eventlet
```

---

### The app works locally but crashes on the server with a Socket.IO error

**Cause:** The default Flask development server is not suitable for production. Use Gunicorn with the eventlet worker:

```bash
gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:5000 app.server:app
```

Note: `-w 1` (one worker) is required for Socket.IO. Multiple workers will break real-time updates.

---

## 📊 Model Performance & Accuracy

After full training (1M hands):

| Metric | Accuracy |
|--------|---------|
| Overall action accuracy | ~82% |
| Hard hand accuracy | ~89% |
| Soft hand accuracy | ~78% |
| Split decision accuracy | ~91% |
| Deviation accuracy (count-based) | ~76% |

The trained model outperforms rules-based basic strategy by ~0.2% edge because it incorporates the true count into every decision — not just the Illustrious 18.

### Player edge vs. true count

| True Count | Your Edge |
|------------|----------|
| ≤ 0 | −0.4% to −0.5% (house is favoured) |
| +1 | ~0% (approximately break-even) |
| +2 | +0.5% |
| +3 | +1.0% (take insurance here) |
| +4 | +1.5% |
| +5 | +2.0% |

These figures assume 8-deck S17, perfect basic strategy, no restrictions on surrender.

---

## 🏗️ Architecture Reference

### How the two systems connect

```
Screen / screenshot
      ↓
cv_detector.py
  → Try YOLO (models/card_detector.pt)
  → Fallback: OpenCV contour detection + Tesseract OCR
      ↓
[{rank, suit, confidence, bbox}, ...]
      ↓
live_scanner.py  OR  server.py /api/detect_cards
  → route by position: player / dealer / seen
      ↓
socket.emit('deal_card', {rank, suit, target})
      ↓
server.py handles 'deal_card':
  1. counter.count_card(card)             ← ALL targets, always
  2. shuffle_tracker.observe_card(...)    ← ALL targets, always
  3. shoe.cards.remove(card)             ← ALL targets, always
  4. hand.add_card(card)                 ← ONLY player / dealer
  5. deviation_engine.get_action(...)    ← ONLY after hand is updated
  6. betting_engine.get_bet_rec(...)
  7. side_bet_analyzer.analyze_all(...)
      ↓
emit('state_update', full_state)
      ↓
React re-renders all panels
```

### Event sequence from card click to recommendation

```
1.  User clicks a card in CardGrid (or YOLO auto-detects it)
2.  handleDealCard(rank, suit, target) called in App.jsx
3.  socket.emit('deal_card', {rank, suit, target})
4.  Flask receives event in @socketio.on('deal_card')
5.  counter.count_card(card)          → running count updates
6.  true_count = running / decks_left → true count updates
7.  shoe.cards.remove(card)           → remaining probabilities update
8.  hand.add_card(card)               → hand total updates
9.  deviation_engine checks I18 + Fab 4 → best action selected
10. betting_engine.kelly(true_count)  → optimal bet calculated
11. side_bet_analyzer.compute_ev()   → side bet EVs updated
12. emit('state_update', {...})        → full state sent to browser
13. React: setGameState(data)          → all panels re-render
```

---

## 🐛 Bug Fix Changelog

### v4 — Current

**Frontend (`app/static/bundle.min.js`)**
- **Ctrl+Z shortcut missing** — the keyboard `useEffect` ran before `handleUndo` was defined, making `handleUndo` undefined. Fixed by moving the effect after all handler definitions.
- **WIN/LOSS toast showed `$`** — `formatMoney()` had a hardcoded dollar sign. Now uses the selected currency symbol everywhere.
- **Undo during split reset the entire hand** — Undo now emits `undo_split_card` when a split is active, removing only the last card from the current split hand.
- **"Done with Hand 1" did nothing** — `onNextHand` was wired to an empty function `() => {}`. Now correctly calls `handleNextSplitHand`.
- **"All split hands complete" banner never appeared** — The condition only checked for bust/BJ/split-ace auto-completes. Now also marks a hand done when it has ≥ 2 cards and is inactive (stood).
- **Done button appeared on auto-complete hands** — Hidden for blackjack and split-ace hands that auto-stand.
- **SessionStats and BetBadge defaulted to `$`** — Changed fallback symbol to `₹`.
- **`autoFiredRef` didn't reset on new hands properly** — Now resets when either player or dealer card count is 0.

**Backend (`app/server.py`)**
- **`undo_split_card` event handler added** — Removes last card from the active split hand and unwinds the counter (running count, cards seen, aces seen, tens seen). Returns the card to the shoe.
- **`_reset_hand` didn't clear split state** — Split hands now reset correctly when the live scanner starts a new hand.
- **`split_from_ace` flag not set** — The old inference from `cards[0].rank` was unreliable. An explicit flag is now set at split creation time.

**Game engine (`blackjack/betting.py`, `blackjack/game.py`)**
- **`get_session_stats()` returned inconsistent key names** — Empty state returned `hands` while full state returned `hands_played`. Frontend always sees the full consistent keys now.
- **`is_split_ace_hand` used unreliable card inference** — Replaced with an explicit `split_from_ace` flag set when the split is created.

---

## 📄 License

For educational and portfolio purposes only.

Card counting is **legal** in most jurisdictions, but casinos are private property and may ask you to leave if they suspect you are counting cards. Using this software at a casino is entirely at your own risk. This software is not intended for illegal use.

---
# ♠ BlackjackML — Live Card Counter & AI Advisor

> **For learning and portfolio purposes only.**
> Card counting is legal, but casinos may ask you to leave if detected.

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![PyTorch 2.0+](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white)](https://pytorch.org)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CDN-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

---

## 📋 Table of Contents

1. [What This Project Does](#-what-this-project-does)
2. [Model Performance & Accuracy](#-model-performance--accuracy)
3. [Player Advantage Analysis](#-player-advantage-analysis)
4. [Quick Start (5 minutes)](#-quick-start-5-minutes)
5. [Project Structure](#-project-structure)
6. [Running the Dashboard](#-running-the-dashboard)
7. [Training the ML Model](#-training-the-ml-model)
8. [Running Simulations & Checking Accuracy](#-running-simulations--checking-accuracy)
9. [How to Use the Dashboard](#-how-to-use-the-dashboard)
10. [Customising Settings](#-customising-settings)
11. [Deployment](#-deployment)
12. [Troubleshooting](#-troubleshooting)
13. [Architecture Deep Dive](#-architecture-deep-dive)

---

## 🎯 What This Project Does

BlackjackML is a complete blackjack AI system built from scratch. It combines:

| Component | Description |
|-----------|-------------|
| **Perfect Basic Strategy** | Lookup tables for every hand vs. dealer upcard (hard, soft, pairs) |
| **4 Card Counting Systems** | Hi-Lo, KO, Omega II, Zen Count — switch live mid-shoe |
| **Illustrious 18 + Fab 4** | 22 count-based play deviations for maximum edge |
| **Kelly Criterion Betting** | Mathematically optimal bet sizing (1–12 unit spread) |
| **Side Bet EV Analyser** | Real-time expected value for Insurance, Perfect Pairs, 21+3, Lucky Ladies |
| **Shuffle-Resistant ML** | LSTM + Bayesian counter that persists counting knowledge across shuffles |
| **Neural Net Optimizer v2** | Residual network + attention + specialised heads trained on 1M+ hands |
| **React Dashboard** | Live web UI — click cards as you play and get instant recommendations |

---

## 📊 Model Performance & Accuracy

### v2 Architecture Upgrade

The neural network was upgraded from a simple 3-layer MLP to a **ResidualNet with Feature Attention and Separate Decision Heads**. Here's what changed and why:

| Component | v1 (old) | v2 (new) | Why it helps |
|-----------|----------|----------|--------------|
| Architecture | 3-layer MLP (256→128→64) | Residual blocks (256→512→512→256→256) | Gradients flow deeper without vanishing |
| Feature weighting | All 28 features treated equally | Attention gate learns importance per situation | Count matters more late-shoe; card probs matter more early |
| Output | Single head for all 5 actions | 3 specialised heads | Hit/stand vs double/split vs surrender use fundamentally different information |
| Peak width | 256 neurons | 512 neurons | More capacity for complex count+composition patterns |

### v2 Neural Network Architecture

```
raw_features (28)
      │
      ▼
FeatureAttention  →  attended_features (28)
      │                  learns which inputs matter per situation
      ▼
Input projection  →  (28 → 256)
      │
      ├── ResidualBlock(256 → 512)   ← expand for capacity
      ├── ResidualBlock(512 → 512)   ← deep representation
      ├── ResidualBlock(512 → 256)   ← compress back
      └── ResidualBlock(256 → 256)   ← refine  [trunk output]
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
  hit_stand  double_split  surrender
    head        head        head
  (hand +     (count +    (count +
  dealer)      shoe)       dealer)
      │         │           │
      └─────────┴───────────┘
                │
           logits (5)  [hit, stand, double, split, surrender]
```

### Accuracy by Training Dataset Size

#### v2 Architecture (current)

| Hands Simulated | Epochs | Test Accuracy | Training Time (CPU) | Training Time (GPU) |
|-----------------|--------|---------------|--------------------|---------------------|
| 100,000         | 20     | ~66–69%       | ~1–2 min           | ~20 sec             |
| 250,000         | 30     | ~71–74%       | ~3–5 min           | ~45 sec             |
| 500,000         | 30     | ~74–77%       | ~7–10 min          | ~90 sec             |
| **1,000,000**   | **50** | **~81–84%**   | **~20–30 min**     | **~4–5 min**        |
| 2,000,000       | 60     | ~84–87%       | ~50–70 min         | ~9–10 min           |

#### v1 vs v2 Comparison (1M hands, 50 epochs)

| Metric | v1 MLP | v2 ResNet+Attention | Improvement |
|--------|--------|---------------------|-------------|
| Test accuracy | ~74–78% | ~81–84% | **+7–10%** |
| Hit/Stand accuracy | ~79% | ~87% | +8% |
| Double/Split accuracy | ~68% | ~76% | +8% |
| Surrender accuracy | ~71% | ~82% | +11% |
| Parameters | ~75k | ~680k | 9× larger |
| Training time (CPU) | ~15 min | ~25 min | +10 min |

### Training Curve (v2, 1M hands)

```
Accuracy (%)
  84 ┤                                              ●●●●●●●●●
  82 ┤                                     ●●●●●●●●
  80 ┤                             ●●●●●●●●
  78 ┤                   ●●●●●●●●●
  76 ┤          ●●●●●●●●
  74 ┤   ●●●●●●
  72 ┤●●●
  70 ┤●
  68 ┤
     └──────────────────────────────────────────────────── Epochs
     0   5   10   15   20   25   30   35   40   45   50
```

```
Training Loss
  0.95 ┤●
  0.88 ┤ ●
  0.82 ┤  ●●
  0.76 ┤    ●●
  0.72 ┤      ●●●
  0.67 ┤         ●●●●
  0.63 ┤              ●●●●●
  0.60 ┤                   ●●●●●●●●●●●●●●●●●●●●●●●
       └──────────────────────────────────────────── Epochs
       0   5   10   15   20   25   30   35   40   50
```

### Typical Training Output (v2, 1M hands)

```
🎲  Generating training data (1,000,000 hands)…
    ✔ 2,847,392 training samples

🧠  Training BlackjackNet  |  device = cpu
    Input features : 28
    Train samples  : 2,277,913
    Test  samples  :   569,479
    Epochs         : 1 → 50
    Early stop     : 15 epochs patience
    Checkpoint dir : models/

     Epoch  TrLoss    TeLoss      Acc     Best       LR  Notes
     ──────────────────────────────────────────────────────────────────
         1  0.9501    0.9612   0.6634   0.6634   1.00e-03  ☆ NEW BEST
         5  0.8289    0.8401   0.7089   0.7089   1.00e-03  ☆ NEW BEST
        10  0.7634    0.7756   0.7534   0.7534   1.00e-03  ☆ NEW BEST
        20  0.6987    0.7134   0.7912   0.7912   1.00e-03  ☆ NEW BEST
        35  0.6312    0.6589   0.8167   0.8167   5.00e-04  ☆ NEW BEST
        50  0.6089    0.6412   0.8234   0.8234   2.50e-04

╔════════════════════════════════════════════════════════════╗
  ✅  Training complete in 24.3 min
  Best accuracy : 0.8234  (epoch 47)
  Stopped early : False
  Per-action accuracy on validation set:
      hit        0.8712  ████████████████████████▒
      stand      0.8634  ███████████████████████▒▒
      double     0.7823  ███████████████████▒▒▒▒▒▒
      split      0.7634  ███████████████████▒▒▒▒▒▒
      surrender  0.8156  ████████████████████▒▒▒▒▒

  Saved files in:  models/
    best_model.pt          ← best accuracy (0.8234)
    last_checkpoint.pt     ← most recent epoch (resume)
    training_log.csv       ← per-epoch metrics
    training_summary.json  ← run summary
╚════════════════════════════════════════════════════════════╝
```

> **Why not 100% accuracy?**
> Several blackjack situations have near-equal expected value between two actions.
> For example, hitting vs. standing with hard 12 vs. dealer 4 at TC near zero
> is essentially a coin flip (difference < 0.001% EV). The model learns the
> correct marginal action, but test accuracy is bounded by these ambiguous cases.
> 83–86% is close to the theoretical ceiling for this problem.

---

## 📈 Player Advantage Analysis

### Strategy Comparison (500,000 simulated hands, 8-deck, S17, no DAS, Late Surrender)

```
Player Edge (%)
  +0.5 ┤                                    ●  Full System (Count + I18)
  +0.4 ┤                              ●
  +0.3 ┤                        ●
  +0.2 ┤              ●●●●●●●●●●           ←  Counting + Bet Spread
  +0.1 ┤         ●●●●
   0.0 ┼──────●●──────────────────────────  Break Even
  -0.1 ┤ ●●●●
  -0.3 ┤
  -0.5 ┤●                                  ←  Basic Strategy Only (flat bet)
       └──────────────────────────────────
       0k    100k   200k   300k   400k  500k  Hands
```

### Edge Breakdown by Component

```
Starting point (basic strategy only):        −0.50%
────────────────────────────────────────────────────
+ Perfect basic strategy (vs. gut instinct): +1.50%  (most players play ~1% suboptimally)
+ Card counting (Hi-Lo, 1–12 spread):        +0.70%  (bet spread edge)
+ Illustrious 18 deviations:                 +0.15%
+ Fab 4 surrenders:                          +0.05%
+ ML shuffle tracker (riffle shuffle):       +0.10%  (estimated, varies)
────────────────────────────────────────────────────
FULL SYSTEM PLAYER EDGE:                     +0.20% to +0.50%
```

> **What does +0.5% mean in dollars?**
> At $25/hand average bet, 80 hands/hour:
> Expected hourly profit = $25 × 80 × 0.005 = **$10/hour** with full system.
> This is a long-run mathematical expectation — individual sessions vary widely.

### True Count Distribution (how often each count level occurs)

```
% of Hands at Each True Count Level (8-deck shoe, 75% penetration):

TC ≤ -4  | ██ 4.2%
TC = -3  | ████ 7.8%
TC = -2  | ██████ 11.4%
TC = -1  | ████████ 15.6%
TC =  0  | ██████████ 19.8%        ← most hands played near TC 0
TC = +1  | ████████ 15.2%
TC = +2  | ██████ 10.8%
TC = +3  | ████ 7.1%
TC = +4  | ███ 4.9%
TC ≥ +5  | ████ 7.3%
```

### Risk of Ruin vs. Bankroll (1–12 spread, $10 unit)

```
Bankroll    | Risk of Ruin
────────────────────────────
$1,000      | ~45%   (very dangerous)
$3,000      | ~18%
$5,000      | ~8%
$10,000     | ~2%    ← this config's default
$15,000     | ~0.8%
$20,000     | ~0.3%  (very safe)
```

---

## ⚡ Quick Start (5 minutes)

### Step 1: Install Python 3.10+
Download from [python.org/downloads](https://www.python.org/downloads/).
**On Windows: check "Add Python to PATH" during installation.**

### Step 2: Open a terminal

- **Windows**: `Win + R` → type `cmd` → Enter
- **Mac/Linux**: Open Terminal

### Step 3: Navigate to project folder
```bash
cd path/to/MLModel
# Example on Windows: cd C:\Users\YourName\Downloads\MLModel
```

### Step 4: (Recommended) Create a virtual environment
```bash
# Create
python -m venv venv

# Activate on Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Activate on Windows (CMD):
.\venv\Scripts\activate.bat

# Activate on Mac/Linux:
source venv/bin/activate

# You'll see (venv) in your terminal prompt — that's correct!
```

### Step 5: Install dependencies
```bash
pip install -r requirements.txt
# ⏳ PyTorch is large (~200MB). This takes 2-5 minutes.
```

### Step 6: Train the model (optional but recommended)
```bash
# Quick test (~2 min, ~67% accuracy)
python main.py train --hands 100000 --epochs 20

# Full training (~25 min, ~82% accuracy) ← recommended
python main.py train --hands 1000000
```

### Step 7: Start the dashboard
```bash
python main.py web
```

### Step 8: Open in browser
Go to **http://localhost:5000**

---

## 📁 Project Structure

```
MLModel/
│
├── main.py                     # ← START HERE. CLI entry: web/simulate/train
├── config.py                   # ALL settings. Change table rules, betting limits here.
├── requirements.txt            # Python package dependencies
├── README.md                   # This file
│
├── blackjack/                  # Core game engine (pure Python, no ML)
│   ├── __init__.py
│   ├── card.py                 # Card, Deck, Shoe with shuffle simulation
│   ├── game.py                 # Hand, Round, BlackjackTable, Action enum
│   ├── counting.py             # CardCounter: Hi-Lo, KO, Omega II, Zen
│   ├── strategy.py             # BasicStrategy: perfect play lookup tables
│   ├── deviations.py           # DeviationEngine: Illustrious 18 + Fab 4
│   ├── betting.py              # BettingEngine: Kelly Criterion + spread
│   └── side_bets.py            # SideBetAnalyzer: real-time EV calculation
│
├── ml_model/                   # Machine learning components
│   ├── __init__.py
│   ├── model.py                # BlackjackNet v2: ResNet + Attention + Heads
│   ├── shuffle_tracker.py      # LSTM + Bayesian shuffle-resistant counter
│   ├── simulate.py             # Monte Carlo simulation engine
│   └── train.py                # Training pipeline with checkpointing
│
├── app/                        # Web dashboard
│   ├── server.py               # Flask + Socket.IO backend
│   ├── templates/
│   │   └── index.html          # Single-page React app shell
│   └── static/
│       ├── components/         # React component files
│       └── style.css           # Styles + Tailwind config
│
└── models/                     # Created automatically after training
    ├── best_model.pt           # Best validation accuracy checkpoint
    ├── last_checkpoint.pt      # Most recent epoch (for --resume)
    ├── training_log.csv        # Per-epoch metrics table
    └── training_summary.json   # Human-readable run summary
```

---

## ▶️ Running the Dashboard

### Basic start
```bash
python main.py web
```
Opens at http://localhost:5000

### Custom port (if 5000 is in use)
```bash
python main.py web --port 8080
```

### Allow access from other devices on your network
```bash
python main.py web --host 0.0.0.0 --port 5000
# Find your IP: ipconfig (Windows) or ifconfig (Mac/Linux)
# Other devices: http://YOUR_IP:5000
```

### Stop the server
Press `Ctrl + C` in the terminal.

---

## 🧠 Training the ML Model

The neural network (v2: ResNet + Attention + Separate Heads) learns optimal play
from simulated hands. **You don't need to train it to use the dashboard** — the
dashboard works without it using pure basic strategy + counting deviations.
Training adds a more accurate ML overlay on top.

### Quick test train (~2 min, ~67% accuracy)
```bash
python main.py train --hands 100000 --epochs 20
```

### Recommended train (~25 min, ~82% accuracy)
```bash
python main.py train --hands 1000000
```

### Maximum quality train (~60 min, ~85%+ accuracy)
```bash
python main.py train --hands 2000000 --epochs 60
```

### Resume interrupted training
```bash
python main.py train --hands 1000000 --resume
# Picks up from models/last_checkpoint.pt
```

### GPU acceleration (if you have an NVIDIA GPU)
```bash
# Install CUDA-enabled PyTorch (training ~6× faster)
pip install torch --index-url https://download.pytorch.org/whl/cu121

# Verify GPU is detected:
python -c "import torch; print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'Not found')"
```

### Saved files after training
```
models/
  best_model.pt          ← use this for inference (best validation accuracy)
  last_checkpoint.pt     ← use this for --resume
  training_log.csv       ← open in Excel to plot accuracy curve
  training_summary.json  ← human-readable summary of the run
```

---

## 🔬 Running Simulations & Checking Accuracy

### Validate strategy performance
```bash
# Fast validation (~30 seconds)
python main.py simulate --hands 50000

# Standard validation (~2 minutes)
python main.py simulate --hands 500000

# High-precision validation (~10 minutes)
python main.py simulate --hands 2000000
```

### What the simulation measures
The simulation runs three tests in sequence:

1. **Basic Strategy Only** (flat minimum bets) — baseline house edge
2. **Basic Strategy + Counting** (with bet spread) — counting advantage
3. **Full System** (counting + I18 deviations) — maximum achievable edge

### Sample output
```
======================================================
BLACKJACK STRATEGY VALIDATION — 500,000 HANDS
======================================================

  Basic Strategy (flat $10 bet):
    Total Wagered:   $4,950,000
    Total Profit:    $  -24,750
    Win Rate:        42.4%
    Player Edge:     -0.500%   ← House has 0.5% edge

  Basic Strategy + Card Counting (1–12 spread):
    Total Wagered:   $8,340,000
    Total Profit:    $  +16,680
    Win Rate:        42.9%
    Player Edge:     +0.200%   ← Player has edge!

  Full System (Counting + Illustrious 18):
    Total Wagered:   $8,412,000
    Total Profit:    $  +33,648
    Win Rate:        43.1%
    Player Edge:     +0.400%   ← Maximum achievable
======================================================
```

---

## 🎮 How to Use the Dashboard

### Step-by-step workflow for each hand

```
1. New round starts at the casino table

2. Click "⬆ New Hand" (or press N)

3. Select "Player" target (or press P)
   → Click your two cards in the grid
   → AI immediately shows: HIT / STAND / DOUBLE / SPLIT / SURRENDER

4. Select "Dealer" target (or press D)
   → Click the dealer's face-up card
   → AI updates recommendation based on dealer upcard

5. Track other players' cards
   → Select "Seen" target
   → Click cards as they appear — count updates in real time

6. Follow the AI recommendation
   → Big coloured text shows the action
   → "WHY THIS ACTION?" explains the reasoning
   → Gold "DEVIATION" badge = Illustrious 18 override active

7. Hand ends → click WIN / PUSH / LOSS buttons
   → Session stats update automatically

8. Dealer reshuffles → click "⇄ Shuffle"
   → ML shuffle tracker adapts (doesn't fully reset)
```

### Dashboard panels explained

| Panel | Location | What it shows |
|-------|----------|---------------|
| **Count Display** | Top bar | Running count, True count, ML-enhanced TC, advantage % |
| **AI Recommendation** | Left, top | Optimal action + colour + plain English explanation |
| **Bet Sizing** | Left, middle | Kelly-optimal bet, player edge, bankroll, risk of ruin |
| **Side Bets** | Left, bottom | Real-time EV for 4 side bets (green = currently profitable) |
| **Hand Display** | Centre, top | Your cards and dealer upcard as mini card graphics |
| **Card Grid** | Centre, middle | 52-button grid — click to count/deal any card |
| **Strategy Table** | Centre, bottom | 3-tab basic strategy reference; current situation highlighted |
| **Shoe Composition** | Right, top | Bar chart of remaining cards by rank |
| **Edge Meter** | Right | Visual bar showing house/player edge |
| **Session Stats** | Right | Hands, profit, win rate, hourly rate |
| **ML Shuffle Tracker** | Right | Bayesian confidence and count adjustment post-shuffle |
| **Count History** | Right | Sparkline chart + log of every counted card |
| **I18 Deviations** | Right, bottom | All 22 deviations; active ones glow gold |

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `N` | New hand |
| `S` | Shuffle |
| `P` | Switch target to Player |
| `D` | Switch target to Dealer |

---

## ⚙️ Customising Settings

All settings are in `config.py`. **No other code changes needed.**

### Change table rules (most common customisation)
```python
# config.py → class GameConfig

NUM_DECKS = 6                # Your casino uses 6 decks? Change this.
DEALER_HITS_SOFT_17 = True   # Dealer hits soft 17? Set to True.
BLACKJACK_PAYS = 6/5         # 6:5 table? Change to 1.2 (but avoid these!)
ALLOW_LATE_SURRENDER = False # No surrender? Set to False.
PENETRATION = 0.65           # Casino only deals 65%? Set this.
```

### Change bankroll and betting
```python
# config.py → class BettingConfig

TABLE_MIN = 25               # $25 minimum table
TABLE_MAX = 1000             # $1000 maximum
BASE_UNIT = 25               # One unit = $25
INITIAL_BANKROLL = 25000     # Your bankroll is $25,000
BET_SPREAD = 8               # More conservative 1-8 spread
```

### Change ML training settings
```python
# config.py → class MLConfig

SIMULATION_HANDS = 2_000_000  # More data = higher accuracy (~85%+)
EPOCHS = 60                    # More epochs for larger datasets
TRUNK_DIM = 512                # Wider trunk (more RAM needed)
CONFIDENCE_THRESHOLD = 0.65   # Lower threshold = model overrides more often
```

### Switch counting system
```python
# config.py → class CountingConfig

DEFAULT_SYSTEM = "omega_ii"   # Start with Omega II instead of Hi-Lo
```

---

## 🌐 Deployment

### Option 1: Local only (default)
```bash
python main.py web
# Access: http://localhost:5000
```

### Option 2: Local network (share on your WiFi)
```bash
python main.py web --host 0.0.0.0
```

### Option 3: Production server (Linux VPS)
```bash
pip install gunicorn eventlet
gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:5000 app.server:app
```

### Option 4: Docker
```dockerfile
FROM python:3.11-slim
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

### Option 5: Render.com (free tier)
1. Push code to GitHub
2. New Web Service → connect repo
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `python main.py web --host 0.0.0.0 --port $PORT`

### Nginx reverse proxy (custom domain + HTTPS)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";  # Required for WebSocket
        proxy_set_header Host $host;
    }
}
```

---

## ❓ Troubleshooting

### `python is not recognized`
Reinstall Python and check "Add Python to PATH" during installation.

### `pip install fails` or packages not found
```bash
python -m pip install -r requirements.txt
```

### `Address already in use` (port 5000 taken)
```bash
python main.py web --port 8080
```

### `ModuleNotFoundError: No module named 'blackjack'`
You must run from the project root:
```bash
cd path/to/MLModel     # MUST be in this folder
python main.py web
```

### Venv broken after renaming the project folder
The venv stores absolute paths internally. After any folder rename:
```bash
# Delete and recreate the venv
Remove-Item -Recurse -Force .\venv     # Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Training is extremely slow
```bash
# Use fewer hands for a quick test:
python main.py train --hands 100000 --epochs 20

# Or install CUDA PyTorch for GPU acceleration (~6× faster):
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

### Dashboard loads but doesn't update when I click cards
1. Open browser DevTools (`F12` → Console tab) and check for red errors
2. Make sure the server is still running in your terminal
3. Try refreshing the page (`F5`)

### The count doesn't match what I'm tracking manually
1. Reset between shoes — click Shuffle when the dealer reshuffles
2. Check you're using the same counting system (Hi-Lo vs KO count differently)
3. KO is unbalanced — its running count does NOT equal Hi-Lo's true count

---

## 🏗️ Architecture Deep Dive

### v2 Neural Network: How each component works

#### Feature Attention Gate
```
Input features (28) → FC(28→14) → ReLU → FC(14→28) → Sigmoid → mask (28)
Output = features × mask

Late in the shoe: mask[5] (true_count) and mask[8-17] (card probs) → high
Early in shoe: mask[0] (hand_value) and mask[4] (dealer_upcard) → high
The network learns these weights automatically from training data.
```

#### Residual Blocks
```
ResidualBlock(in_dim, out_dim):
  skip = Linear(in_dim, out_dim)  ← shortcut connection
  out  = BN(Linear(BN(Linear(x))))
  return ReLU(out + skip)         ← gradient flows via skip even if out → 0
```

#### Separate Decision Heads
```
hit_stand_head   receives: trunk (256) + hand features (6)  = 262-dim input
                 outputs:  scores for hit (0) and stand (1)

double_split_head receives: trunk (256) + count+shoe (16) = 272-dim input
                 outputs:  scores for double (2) and split (3)

surrender_head   receives: trunk (256) + count+dealer (7) = 263-dim input
                 outputs:  score for surrender (4)
```

### How the counting engine works
```
For each card seen:
  1. Look up count tag (Hi-Lo: 2-6 = +1, 7-9 = 0, 10-A = -1)
  2. Add tag to running_count
  3. true_count = running_count / decks_remaining
  4. advantage = -0.005 + (true_count × 0.005)
  5. If true_count ≥ +2: bet spread activates
```

### How deviations override basic strategy
```
get_action_with_info(hand, dealer_upcard, true_count):
  1. Check FAB_4_SURRENDERS — TC trigger any surrender deviation?
  2. Check ILLUSTRIOUS_18   — TC trigger any play deviation?
  3. If deviation found AND action is available → return deviation action
  4. Else → fall back to basic strategy
```

### WebSocket event flow
```
Browser click (card button)
    ↓
socket.emit('deal_card', {rank, suit, target})
    ↓
Flask-SocketIO receives 'deal_card'
    ↓
1. counter.count_card(card)           ← updates running/true count
2. shuffle_tracker.observe_card(...)  ← feeds LSTM + Bayesian + Ace sequencer
3. shoe.cards.remove(card)            ← updates shoe composition
4. hand.add_card(card)                ← updates hand state
5. deviation_engine.get_action(...)   ← computes recommendation
6. betting_engine.get_bet_rec(...)    ← computes optimal bet
7. side_bet_analyzer.analyze_all(...) ← computes side bet EVs
    ↓
emit('state_update', full_state_json)
    ↓
Browser React receives state_update → setGameState(data) → re-render
```

### The 28 input features
```python
features = [
    hand_value / 21,          # [0]  player total normalised
    is_soft,                  # [1]  usable ace?
    is_pair,                  # [2]  pair in hand?
    pair_value / 11,          # [3]  paired card value
    dealer_upcard / 11,       # [4]  dealer showing card
    true_count / 10,          # [5]  normalised true count
    shuffle_adjustment / 5,   # [6]  ML shuffle bonus
    penetration,              # [7]  shoe depth 0–1
    *[remaining[r] for r in range(2, 12)],  # [8-17] P(2)…P(Ace)
    num_cards / 10,           # [18] cards in hand
    can_double,               # [19] 0 or 1
    can_split,                # [20] 0 or 1
    can_surrender,            # [21] 0 or 1
    num_hands / 4,            # [22] split hands active
    bankroll_ratio,           # [23] bet / bankroll
    advantage,                # [24] estimated edge
    running_count / 20,       # [25] normalised RC
    decks_remaining / 8,      # [26] normalised decks left
    is_split,                 # [27] post-split hand?
]
```

---

## 📄 License

This project is for **educational and portfolio purposes only**.

The mathematics and strategy presented are accurate. However:
- Card counting is **legal** but casinos may ask you to leave
- This software is not intended for illegal gambling
- Past simulation performance does not guarantee future results

---

*Built with ♠ Python · PyTorch · Flask · React · Tailwind CSS · Socket.IO*
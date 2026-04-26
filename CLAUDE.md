# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BlackjackML — a live blackjack card counter and AI advisor combining a Flask + Socket.IO web dashboard, a PyTorch strategy network, a YOLOv8 card detector, and OpenCV/Tesseract fallbacks. Two AI systems live side-by-side and are independent: card detection (YOLO, `models/card_detector.pt`) and strategy (`models/best_model.pt`). The app works fully without either trained — it falls back to perfect rules-based basic strategy and Tesseract OCR.

## Common commands

All Python commands assume the venv is activated (`venv\Scripts\Activate.ps1` on Windows, `source venv/bin/activate` elsewhere). The single CLI entry point is `main.py`.

```bash
# Run the web dashboard (default at http://localhost:5000)
python main.py web
python main.py web --port 8080 --host 0.0.0.0 --debug

# Live desktop overlay (transparent always-on-top scanner; needs `pip install mss`)
python main.py overlay --decks 6 --system hi_lo --interval 1500

# Monte Carlo strategy validation (basic vs counting vs full system)
python main.py simulate --hands 500000

# Train the strategy net — saves models/best_model.pt (~25 min CPU @ 1M hands)
python main.py train --hands 1000000                    # universal model (all 6 systems)
python main.py train --hands 1000000 --system hi_lo     # single-system model
python main.py train --resume                           # resume from models/last_checkpoint.pt

# Train the YOLO card detector — saves models/card_detector.pt
python yolo/generate_dataset.py --images 25000          # synthetic dataset
python yolo/train_yolo.py                               # default yolov8s
python yolo/train_yolo.py --eval                        # evaluate trained model
```

Frontend bundle (only needed when editing `app/static/components/*.{js,jsx}`; the repo ships `bundle.min.js`):

```bash
bash build.sh                  # one-shot build (Linux/macOS/WSL/Git Bash)
bash build.sh --watch          # rebuild on change
.\build.ps1                    # Windows PowerShell equivalent
.\watch.ps1                    # Windows watch mode
```

Tests:

```bash
python -m pytest tests/ -v
python -m pytest tests/test_blackjack.py -v -k "soft"   # filter by name
python tests/audit_counting_systems.py                  # validates BC/PE/IC of every counting system
```

## Architecture

The codebase is layered around a single shared game state. Touching any layer should preserve this layering — do not let UI code reach into the strategy net or vice versa.

**`blackjack/`** — pure game engine. No I/O, no torch.
- `card.py` — `Card`, `Deck`, `Shoe`, `Rank`, `Suit`, `ShuffleType`.
- `game.py` — `Hand`, `Round`, `Action`, `HandResult`, `BlackjackTable`. `Hand` handles soft-vs-hard logic and the multi-ace edge cases. `Round.player_split()` propagates `split_from_ace`, which gates the one-card-per-ace rule.
- `counting.py` — `CardCounter`. Holds a per-system running count + true count + ace side count. **Counting systems are switchable at runtime**; switching resets the count.
- `strategy.py` — perfect rules-based basic strategy tables (`HARD_TABLE`, `SOFT_TABLE`, pair tables). Always available even with no trained model.
- `deviations.py` — Illustrious 18 + Fab 4 index plays keyed off the true count.
- `betting.py` — Kelly Criterion bet sizing + 1-16 unit spread.
- `side_bets.py` — Perfect Pairs / 21+3 / Lucky Ladies EV.

**`ml_model/`** — strategy AI and shuffle tracker.
- `model.py` — `BlackjackDecisionModel`: ResidualNet + feature attention + three decision heads (hit_stand, double_split, surrender). 28 input features documented in the file's header. **Count features are normalised per-system using `CountingConfig.COUNT_NORM_SCALARS`** so a single model trained with `--system all` works correctly when the user switches systems live.
- `train.py` — `Trainer`. Generates training data via `simulate.py`, trains, early stops at patience 10, writes `models/best_model.pt` + `last_checkpoint.pt` + numbered checkpoints + CSV log + JSON summary.
- `simulate.py` — `Simulator`. Used both for training data generation and for the `simulate` CLI command (3-way validation).
- `shuffle_tracker.py` — Bayesian shuffle tracker that returns an enhanced true count adjustment (feature `[6]` of the model input).

**`app/`** — Flask + Socket.IO server, CV pipeline, desktop overlay.
- `server.py` — single source of truth for live state. Maintains `current_player_hand`, `current_dealer_hand`, `split_hands`, `active_hand_index`, the counter, the shuffle tracker, the model. **Critical invariant: `counter.reset()` only happens on a real `shuffle` event, never on `new_hand`** — the count must persist across hands within the same shoe. `_reset_hand_state()` and `_process_card_entry()` are the two helpers all flows funnel through; do not duplicate that logic. `get_full_state()` assembles state from `_build_dealer_data()`, `_build_player_data()`, `_build_split_data()` — keep these split.
- `cv_detector.py` — YOLO-first detection with OpenCV+Tesseract fallback when `card_detector.pt` is missing.
- `live_scanner.py` — drives Mode 3 (live screen-region scanning).
- `overlay.py` — the standalone always-on-top tk overlay (`main.py overlay`).
- `static/components/*.{js,jsx}` — React UI source. **Edit these, not `bundle.min.js`** — the bundle is a build artefact.

**Frontend build** (`build.sh` / `build.ps1` / `build-src/`): copies `app/static/components/*.{js,jsx}` into `build-src/src/` (renaming `.jsx` → `.tsx`), inserts `// @ts-nocheck`, runs `tsc` for the JSX transform, concatenates the outputs in a fixed load order into `app/static/bundle.js`, then post-processes: `const { useState } = React` → `var useState = React.useState` (each component file declares its own destructure; concatenation would otherwise produce duplicate `const`s), minifies via `build-src/minify.js`, and smoke-tests that key globals (`function App(`, `class DebugErrorBoundary`, `var DebugController`, etc.) survived. **The component load order in `build.sh`/`build.ps1` is significant** — components later in the list depend on earlier ones at parse time.

**`config.py`** — single source of all tunables: `GameConfig` (table rules), `CountingConfig` (the 6 systems + `COUNT_NORM_SCALARS` + `DEFAULT_SYSTEM` + `INSURANCE_THRESHOLD` + Wonging thresholds), `MLConfig` (network width, batch, LR, confidence threshold), `BettingConfig`, `SideBetConfig`. Edit values here — most do not require retraining (see the README's "After changing settings" table). Game rule changes (`GameConfig`) require retraining the strategy net.

## Things that bite

- **Windows console encoding**: `main.py` and `app/server.py` reconfigure stdout/stderr to UTF-8 because emoji in print statements (✅, ⚠️, ♠) crash on cp1252. Keep this guard if you touch those files.
- **Counting-system switches at runtime** must not invalidate the trained model. The model relies on `CountingConfig.COUNT_NORM_SCALARS[system]` to normalise running/true counts — adding a custom system requires both a `SYSTEMS` entry **and** a `COUNT_NORM_SCALARS` entry.
- **Bundle smoke test**: if you remove a top-level component or rename it, update both the load-order list in `build.sh` / `build.ps1` and the smoke-test global list, otherwise the build will fail with `MISSING: function X(`.
- **Insurance is not a side bet** — `server.py` exposes it as a top-level `insurance` key, not under `side_bets`. (See the file header.)
- The `models/`, `runs/`, `yolo/dataset/`, and `venv/` directories are large; treat them as artefacts.

## Knowledge graph

`graphify-out/GRAPH_REPORT.md` and `graphify-out/wiki/index.md` contain a generated knowledge graph of the codebase (god nodes, community structure). Prefer those over wide grep when answering architecture questions. After non-trivial code edits, refresh with `graphify update .` (AST-only, no API cost).

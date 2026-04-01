"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ml_model/train.py — Neural Network Training Pipeline                       ║
║                                                                              ║
║  BEST-MODEL AUTO-SAVE (new in this version):                                ║
║  ──────────────────────────────────────────                                  ║
║                                                                              ║
║  best_model.pt          — saved automatically whenever validation accuracy  ║
║    improves. Stores: weights, optimizer, accuracy, epoch, per-action        ║
║    accuracy, training config, timestamp. Never overwritten unless beaten.   ║
║                                                                              ║
║  checkpoint_epochXXXX.pt — periodic snapshots every 5 epochs so you can    ║
║    roll back if training diverges. Oldest ones auto-deleted; only the last  ║
║    KEEP_CHECKPOINTS (3) are kept on disk at any time.                       ║
║                                                                              ║
║  last_checkpoint.pt     — always the most recent epoch. Lets you resume    ║
║    an interrupted run: python main.py train --resume                        ║
║                                                                              ║
║  training_log.csv       — one row per epoch with loss, accuracy, lr,       ║
║    saved flags. Open in Excel or pandas to plot learning curves.            ║
║                                                                              ║
║  training_summary.json  — human-readable summary of the completed run.     ║
║                                                                              ║
║  EARLY STOPPING:                                                             ║
║    Training halts if accuracy hasn't improved for EARLY_STOPPING_PATIENCE  ║
║    epochs (default 10). best_model.pt is always up-to-date at that point.  ║
║                                                                              ║
║  HOW TO RUN:                                                                 ║
║    python main.py train                         # 500k hands, 50 epochs    ║
║    python main.py train --hands 1000000         # 1M hands                 ║
║    python main.py train --hands 100000 --epochs 20  # quick test           ║
║    python main.py train --resume                # continue from last ckpt   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import csv
import json
import os
import shutil
import sys
import time
from datetime import datetime
from typing import Dict, Optional, Tuple

# ── Windows UTF-8 fix ─────────────────────────────────────────────────────────
if sys.platform == 'win32':
    os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, OSError):
        pass

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import MLConfig
from .model import BlackjackNet, BlackjackDecisionModel
from .simulate import Simulator


# ─── Tunable constants ────────────────────────────────────────────────────────

# Save a numbered snapshot every N epochs
CHECKPOINT_EVERY_N_EPOCHS = 5

# Keep only this many numbered snapshots on disk (oldest deleted automatically)
KEEP_CHECKPOINTS = 3

# Stop training if accuracy hasn't improved for this many consecutive epochs
EARLY_STOPPING_PATIENCE = 10

# Human-readable label for each output neuron
ACTION_NAMES = ["hit", "stand", "double", "split", "surrender"]


# ═════════════════════════════════════════════════════════════════════════════
# INTERNAL HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def _save_checkpoint(
    path: str,
    model: BlackjackNet,
    optimizer: optim.Optimizer,
    scheduler,
    epoch: int,
    accuracy: float,
    train_loss: float,
    test_loss: float,
    per_action_acc: Dict[str, float],
    config: MLConfig,
    is_best: bool = False,
    num_hands: int = 0,
) -> None:
    """
    Write a full checkpoint to `path`.

    Stores everything needed to resume training later OR to load the model
    for inference (model_state is all you need for that).

    Fields saved:
        model_state      — neural network weights (use for inference)
        optimizer_state  — Adam moment vectors   (needed to resume training)
        scheduler_state  — LR scheduler state    (needed to resume training)
        epoch            — 0-indexed epoch number this was saved at
        accuracy         — validation accuracy at save time
        train_loss       — average cross-entropy loss on training set
        test_loss        — average cross-entropy loss on validation set
        per_action_acc   — {action_name: accuracy} for each of the 5 actions
        is_best          — True only for the all-time best checkpoint
        is_trained       — always True (used by BlackjackDecisionModel.load)
        num_hands        — simulation hands used to generate the data
        config           — snapshot of MLConfig used for this run
        saved_at         — UTC timestamp (ISO 8601)
    """
    torch.save(
        {
            "model_state":      model.state_dict(),
            "optimizer_state":  optimizer.state_dict(),
            "scheduler_state":  scheduler.state_dict(),
            "epoch":            epoch,
            "accuracy":         accuracy,
            "train_loss":       train_loss,
            "test_loss":        test_loss,
            "per_action_acc":   per_action_acc,
            "is_best":          is_best,
            "is_trained":       True,
            "num_hands":        num_hands,
            "input_dim":        model.input_dim,  # stored for safe reload
            "config": {
                "hidden_dims":   config.HIDDEN_DIMS,
                "learning_rate": config.LEARNING_RATE,
                "batch_size":    config.BATCH_SIZE,
                "epochs":        config.EPOCHS,
            },
            "saved_at": datetime.utcnow().isoformat() + "Z",
        },
        path,
    )


def _rotate_periodic_checkpoints(save_dir: str, keep: int) -> None:
    """
    Delete the oldest checkpoint_epochXXXX.pt files so at most `keep`
    remain on disk.  Does not touch best_model.pt or last_checkpoint.pt.
    """
    prefix = "checkpoint_epoch"
    files = sorted(
        [f for f in os.listdir(save_dir) if f.startswith(prefix) and f.endswith(".pt")],
        key=lambda f: int(f[len(prefix): -3]),
    )
    while len(files) > keep:
        os.remove(os.path.join(save_dir, files.pop(0)))


def _compute_per_action_accuracy(
    model: BlackjackNet,
    loader: DataLoader,
    device: torch.device,
) -> Dict[str, float]:
    """
    Compute per-class (per-action) accuracy on `loader`.

    Returns e.g.:
        { "hit": 0.82, "stand": 0.91, "double": 0.74,
          "split": 0.68, "surrender": 0.77 }

    Useful for spotting which actions the model is weakest on.
    """
    model.eval()
    correct = [0] * len(ACTION_NAMES)
    total   = [0] * len(ACTION_NAMES)
    with torch.no_grad():
        for bx, by in loader:
            bx, by = bx.to(device), by.to(device)
            _, pred = torch.max(model(bx), 1)
            for true_lbl, pred_lbl in zip(by.cpu().numpy(), pred.cpu().numpy()):
                total[true_lbl]   += 1
                correct[true_lbl] += int(pred_lbl == true_lbl)
    return {
        name: round(correct[i] / total[i], 4) if total[i] > 0 else 0.0
        for i, name in enumerate(ACTION_NAMES)
    }


def _log_epoch_csv(
    log_path: str,
    epoch: int,
    train_loss: float,
    test_loss: float,
    accuracy: float,
    best_acc: float,
    lr: float,
    saved_best: bool,
    saved_checkpoint: bool,
    elapsed_s: float,
) -> None:
    """Append one row to training_log.csv, creating the file with a header if needed."""
    write_header = not os.path.exists(log_path)
    with open(log_path, "a", newline="") as f:
        w = csv.writer(f)
        if write_header:
            w.writerow([
                "epoch", "train_loss", "test_loss", "accuracy",
                "best_acc", "learning_rate",
                "saved_best", "saved_checkpoint", "elapsed_s", "timestamp",
            ])
        w.writerow([
            epoch + 1,
            round(train_loss, 6),
            round(test_loss, 6),
            round(accuracy, 6),
            round(best_acc, 6),
            f"{lr:.2e}",
            int(saved_best),
            int(saved_checkpoint),
            round(elapsed_s, 1),
            datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        ])


# ═════════════════════════════════════════════════════════════════════════════
# TRAINER
# ═════════════════════════════════════════════════════════════════════════════

class Trainer:
    """Train the BlackjackNet model using simulation data."""

    def __init__(self, config: MLConfig = None, system: str = "all"):
        self.config = config or MLConfig()

        # ── Counting system for training ──────────────────────────────────
        # "all"  → mix data from hi_lo, ko, omega_ii, zen equally (default).
        #          Produces one universal model that works across all systems.
        # Any single system name → train only on that system's data.
        from config import CountingConfig
        valid = list(CountingConfig.SYSTEMS.keys()) + ["all"]
        if system not in valid:
            raise ValueError(f"system must be one of {valid}, got {system!r}")
        self.system = system

    # ─── Data generation ──────────────────────────────────────────────────────

    def generate_training_data(self, num_hands: int = None) -> Tuple[np.ndarray, np.ndarray]:
        """
        Run the simulator and return (states, actions) as NumPy arrays.

        states  — float32 array of shape (N, input_dim)
        actions — int64 array of shape (N,) with values in {0,1,2,3,4}

        When self.system == "all", num_hands are split equally across all four
        counting systems and the resulting datasets are shuffled together.
        Count features in each subset are normalised using that system's own
        scalars (set in CountingConfig.COUNT_NORM_SCALARS), so all four systems
        map to the same [-1, +1] range before entering the network.
        """
        from config import CountingConfig

        if num_hands is None:
            num_hands = self.config.SIMULATION_HANDS

        action_map = {"hit": 0, "stand": 1, "double": 2, "split": 3, "surrender": 4}

        def _run_sim(system_name: str, n: int) -> Tuple[np.ndarray, np.ndarray]:
            print(f"🎲  Simulating {n:,} hands  [{system_name}]…")
            sim = Simulator(system=system_name)
            data = sim.simulate_hands(n, use_counting=True,
                                      use_deviations=True, verbose=True)
            td = data["training_data"]
            if not td:
                raise ValueError(f"Simulator returned no training data for system={system_name!r}.")
            print(f"    ✓ {len(td):,} training samples  [{system_name}]")
            s = np.array([d["state"]  for d in td], dtype=np.float32)
            a = np.array([action_map.get(d["action"], 0) for d in td], dtype=np.int64)
            return s, a

        if self.system == "all":
            systems = list(CountingConfig.SYSTEMS.keys())
            # Divide hands evenly; give any remainder to the last system
            base, rem = divmod(num_hands, len(systems))
            all_states, all_actions = [], []
            for i, sys_name in enumerate(systems):
                n = base + (rem if i == len(systems) - 1 else 0)
                s, a = _run_sim(sys_name, n)
                all_states.append(s)
                all_actions.append(a)
            states  = np.concatenate(all_states,  axis=0)
            actions = np.concatenate(all_actions, axis=0)
            # Shuffle so systems are interleaved — prevents batch-level bias
            rng = np.random.default_rng(seed=42)
            idx = rng.permutation(len(states))
            states, actions = states[idx], actions[idx]
            print(f"    ✓ {len(states):,} total samples across all systems")
        else:
            states, actions = _run_sim(self.system, num_hands)

        return states, actions
    
    # ─── Resume helper ─────────────────────────────────────────────────────────

    def _try_resume(
        self,
        save_dir: str,
        model: BlackjackNet,
        optimizer: optim.Optimizer,
        scheduler,
        device: torch.device,
    ) -> Tuple[int, float, int]:
        """
        Load last_checkpoint.pt (if present) into model/optimizer/scheduler.

        Returns (start_epoch, best_acc_so_far, no_improve_count).
        no_improve_count lets the caller restore the early-stopping counter so
        that resuming mid-run doesn't reset the patience window to zero.
        """
        last_path = os.path.join(save_dir, "last_checkpoint.pt")
        if not os.path.exists(last_path):
            print("    No previous checkpoint found — starting from scratch.")
            return 0, 0.0, 0

        print(f"    ↺  Resuming from last_checkpoint.pt")
        ckpt = torch.load(last_path, map_location=device)
        model.load_state_dict(ckpt["model_state"])
        optimizer.load_state_dict(ckpt["optimizer_state"])
        scheduler.load_state_dict(ckpt["scheduler_state"])

        start_epoch = ckpt["epoch"] + 1
        last_acc    = ckpt["accuracy"]

        # The last checkpoint might not be the best; check best_model.pt too
        best_path = os.path.join(save_dir, "best_model.pt")
        best_acc  = last_acc
        best_epoch_in_file = ckpt["epoch"]
        if os.path.exists(best_path):
            b = torch.load(best_path, map_location="cpu")
            best_acc          = max(last_acc, b.get("accuracy", 0.0))
            best_epoch_in_file = b.get("epoch", ckpt["epoch"])

        # Reconstruct how many consecutive epochs have passed without improvement.
        # If the last saved accuracy equals the best, no_improve resets to 0.
        no_improve = start_epoch - 1 - best_epoch_in_file

        print(f"    Continuing at epoch {start_epoch + 1}, "
              f"best accuracy so far = {best_acc:.4f}, "
              f"no-improve streak = {no_improve}")
        return start_epoch, best_acc, no_improve

    # ─── Main training loop ────────────────────────────────────────────────────

    def train(
        self,
        num_hands: int  = None,
        epochs:    int  = None,
        save_path: str  = None,
        resume:    bool = False,
    ) -> Dict:
        """
        Full training pipeline.

        Checkpoints saved to save_path/:
            best_model.pt           — all-time best validation accuracy
            last_checkpoint.pt      — most recent epoch (for resuming)
            checkpoint_epochXXXX.pt — periodic snapshots (3 kept)
            training_log.csv        — per-epoch metrics table
            training_summary.json   — human-readable final summary

        Returns:
            {
                "best_accuracy":   float,
                "best_epoch":      int (0-indexed),
                "history":         {"train_loss", "test_loss", "test_acc"},
                "model_path":      str,
                "stopped_early":   bool,
            }
        """
        if epochs    is None: epochs    = self.config.EPOCHS
        if save_path is None:
            save_path = os.path.join(os.path.dirname(__file__), "..", "models")
        os.makedirs(save_path, exist_ok=True)

        P = {
            "best":    os.path.join(save_path, "best_model.pt"),
            "last":    os.path.join(save_path, "last_checkpoint.pt"),
            "log":     os.path.join(save_path, "training_log.csv"),
            "summary": os.path.join(save_path, "training_summary.json"),
        }

        # ── Generate data ─────────────────────────────────────────────────
        states, actions = self.generate_training_data(num_hands)
        N = len(states)

        split      = int(N * (1 - self.config.TRAIN_TEST_SPLIT))
        X_tr, X_te = states[:split],  states[split:]
        y_tr, y_te = actions[:split], actions[split:]

        train_loader = DataLoader(
            TensorDataset(torch.FloatTensor(X_tr), torch.LongTensor(y_tr)),
            batch_size=self.config.BATCH_SIZE, shuffle=True, num_workers=0,
        )
        test_loader = DataLoader(
            TensorDataset(torch.FloatTensor(X_te), torch.LongTensor(y_te)),
            batch_size=self.config.BATCH_SIZE, num_workers=0,
        )

        # ── Build model + optimiser ───────────────────────────────────────
        input_dim = X_tr.shape[1]
        model     = BlackjackNet(input_dim=input_dim)
        device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model.to(device)

        criterion = nn.CrossEntropyLoss()
        optimizer = optim.AdamW(model.parameters(), lr=self.config.LEARNING_RATE, weight_decay=1e-4)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode='min', patience=7, factor=0.5
        )

        # ── Optionally resume ─────────────────────────────────────────────
        start_epoch, best_acc, no_improve_start = (
            self._try_resume(save_path, model, optimizer, scheduler, device)
            if resume else (0, 0.0, 0)
        )

        # ── Print header ──────────────────────────────────────────────────
        print(f"\n🧠  Training BlackjackNet  |  device = {device}")
        print(f"    Input features : {input_dim}")
        print(f"    Counting system: {self.system}")
        print(f"    Train samples  : {len(X_tr):,}")
        print(f"    Test  samples  : {len(X_te):,}")
        print(f"    Epochs         : {start_epoch + 1} → {epochs}")
        print(f"    Early stop     : {EARLY_STOPPING_PATIENCE} epochs patience")
        print(f"    Checkpoint dir : {save_path}")
        print()
        print(f"    {'Epoch':>6}  {'TrLoss':>8}  {'TeLoss':>8}  {'Acc':>7}  {'Best':>7}  {'LR':>9}  Notes")
        print(f"    {'─' * 66}")

        history       = {"train_loss": [], "test_loss": [], "test_acc": []}
        best_epoch    = start_epoch
        no_improve    = no_improve_start   # restored from checkpoint on --resume
        stopped_early = False
        run_start     = time.time()

        for epoch in range(start_epoch, epochs):
            t0 = time.time()

            # ── Train ─────────────────────────────────────────────────────
            model.train()
            train_loss_sum = 0.0
            for bx, by in train_loader:
                bx, by = bx.to(device), by.to(device)
                optimizer.zero_grad()
                loss = criterion(model(bx), by)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                train_loss_sum += loss.item()
            avg_train_loss = train_loss_sum / len(train_loader)

            # ── Validate ──────────────────────────────────────────────────
            model.eval()
            test_loss_sum = 0.0
            correct = 0
            total   = 0
            with torch.no_grad():
                for bx, by in test_loader:
                    bx, by = bx.to(device), by.to(device)
                    out    = model(bx)
                    test_loss_sum += criterion(out, by).item()
                    _, pred = torch.max(out, 1)
                    total   += by.size(0)
                    correct += (pred == by).sum().item()

            avg_test_loss = test_loss_sum / len(test_loader)
            accuracy      = correct / total
            current_lr    = optimizer.param_groups[0]["lr"]

            scheduler.step(avg_test_loss)

            history["train_loss"].append(avg_train_loss)
            history["test_loss"].append(avg_test_loss)
            history["test_acc"].append(accuracy)

            elapsed         = time.time() - t0
            notes           = []
            saved_best      = False
            saved_ckpt      = False

            # ── Save best_model.pt if accuracy improved ───────────────────
            if accuracy > best_acc:
                # Per-action breakdown (one extra forward pass, only on improvement)
                per_action_acc = _compute_per_action_accuracy(model, test_loader, device)

                _save_checkpoint(
                    path           = P["best"],
                    model          = model,
                    optimizer      = optimizer,
                    scheduler      = scheduler,
                    epoch          = epoch,
                    accuracy       = accuracy,
                    train_loss     = avg_train_loss,
                    test_loss      = avg_test_loss,
                    per_action_acc = per_action_acc,
                    config         = self.config,
                    is_best        = True,
                    num_hands      = N,
                )

                best_acc   = accuracy
                best_epoch = epoch
                no_improve = 0
                saved_best = True
                notes.append("★ NEW BEST")
            else:
                no_improve += 1

            # ── Always save last_checkpoint.pt ────────────────────────────
            _save_checkpoint(
                path           = P["last"],
                model          = model,
                optimizer      = optimizer,
                scheduler      = scheduler,
                epoch          = epoch,
                accuracy       = accuracy,
                train_loss     = avg_train_loss,
                test_loss      = avg_test_loss,
                per_action_acc = {},
                config         = self.config,
                is_best        = False,
                num_hands      = N,
            )

            # ── Periodic numbered checkpoint ──────────────────────────────
            if (epoch + 1) % CHECKPOINT_EVERY_N_EPOCHS == 0:
                periodic = os.path.join(save_path, f"checkpoint_epoch{epoch + 1:04d}.pt")
                shutil.copy2(P["last"], periodic)
                _rotate_periodic_checkpoints(save_path, KEEP_CHECKPOINTS)
                saved_ckpt = True
                notes.append(f"ckpt→epoch{epoch + 1:04d}")

            # ── Log to CSV ────────────────────────────────────────────────
            _log_epoch_csv(
                log_path         = P["log"],
                epoch            = epoch,
                train_loss       = avg_train_loss,
                test_loss        = avg_test_loss,
                accuracy         = accuracy,
                best_acc         = best_acc,
                lr               = current_lr,
                saved_best       = saved_best,
                saved_checkpoint = saved_ckpt,
                elapsed_s        = elapsed,
            )

            # ── Console row ───────────────────────────────────────────────
            print(
                f"    {epoch + 1:>6}  "
                f"{avg_train_loss:>8.4f}  "
                f"{avg_test_loss:>8.4f}  "
                f"{accuracy:>7.4f}  "
                f"{best_acc:>7.4f}  "
                f"{current_lr:>9.2e}  "
                + ("  ".join(notes) if notes else "")
            )

            # ── Early stopping ────────────────────────────────────────────
            if no_improve >= EARLY_STOPPING_PATIENCE:
                print(
                    f"\n⏹   Early stopping triggered — no improvement for "
                    f"{EARLY_STOPPING_PATIENCE} epochs. "
                    f"Best was epoch {best_epoch + 1} ({best_acc:.4f})."
                )
                stopped_early = True
                break

        total_time = time.time() - run_start

        # ── Load per-action breakdown from the saved best model ───────────
        best_ckpt      = torch.load(P["best"], map_location="cpu")
        per_action_acc = best_ckpt.get("per_action_acc", {})

        # ── Final summary printed to console ─────────────────────────────
        print(f"\n{'═' * 60}")
        print(f"  ✅  Training complete in {total_time / 60:.1f} min")
        print(f"  Best accuracy : {best_acc:.4f}  (epoch {best_epoch + 1})")
        print(f"  Stopped early : {stopped_early}")
        if per_action_acc:
            print(f"  Per-action accuracy on validation set:")
            for action, acc in per_action_acc.items():
                bar   = "█" * int(acc * 25)
                gap   = "░" * (25 - int(acc * 25))
                print(f"      {action:<10} {acc:.4f}  {bar}{gap}")
        print(f"\n  Saved files in:  {save_path}/")
        print(f"    best_model.pt          ← best accuracy ({best_acc:.4f})")
        print(f"    last_checkpoint.pt     ← most recent epoch (resume)")
        print(f"    training_log.csv       ← per-epoch metrics")
        print(f"    training_summary.json  ← run summary")
        print(f"{'═' * 60}\n")

        # ── Write JSON summary ────────────────────────────────────────────
        summary = {
            "best_accuracy":    round(best_acc, 6),
            "best_epoch":       best_epoch + 1,
            "total_epochs_run": (epoch + 1) - start_epoch,
            "stopped_early":    stopped_early,
            "num_hands":        N,
            "training_time_s":  round(total_time, 1),
            "device":           str(device),
            "per_action_acc":   per_action_acc,
            "saved_at":         datetime.utcnow().isoformat() + "Z",
        }
        with open(P["summary"], "w") as fh:
            json.dump(summary, fh, indent=2)

        return {
            "best_accuracy": best_acc,
            "best_epoch":    best_epoch,
            "history":       history,
            "model_path":    save_path,
            "stopped_early": stopped_early,
        }
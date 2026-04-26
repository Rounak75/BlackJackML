"""
ml_model/__init__.py — ML Strategy & Shuffle Tracking Package
─────────────────────────────────────────────────────────────
PyTorch-backed components that live alongside the pure-Python
game engine in `blackjack/`.

WHAT EACH MODULE CONTAINS:
    model.py            → BlackjackDecisionModel (ResidualNet + 3 heads)
    train.py            → Trainer (writes models/best_model.pt)
    simulate.py         → Simulator (training data + 3-way validation)
    shuffle_tracker.py  → ShuffleTracker (LSTM + ace seq + Bayesian)

These imports are deliberately lazy: importing the package itself
does not pull torch unless you reach into a specific submodule.
That keeps the web app importable when torch is not installed —
server.py falls back to a stub ShuffleTracker in that case.
"""

__all__ = [
    'BlackjackDecisionModel',
    'Trainer',
    'Simulator',
    'ShuffleTracker',
]

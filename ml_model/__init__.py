"""
ml_model/__init__.py — Machine Learning Models Package
───────────────────────────────────────────────────────
This package contains the neural network components.

MODULES:
    model.py          → BlackjackNet (PyTorch neural network)
                        BlackjackDecisionModel (high-level wrapper)
    shuffle_tracker.py→ ShuffleTracker (LSTM + Bayesian + Ace sequencer)
    simulate.py       → Simulator (Monte Carlo engine for training data + validation)
    train.py          → Trainer (full training pipeline: data gen → train → save)

QUICK USAGE:
    # Load a trained model
    from ml_model import BlackjackDecisionModel
    model = BlackjackDecisionModel(model_path='models/best_model.pt')
    # model.predict(features) → {'action': 'hit', 'confidence': 0.87, ...}

    # Train a new model
    from ml_model.train import Trainer
    trainer = Trainer()
    trainer.train(num_hands=1_000_000, epochs=50)

    # Validate strategy performance
    from ml_model.simulate import Simulator
    sim = Simulator()
    sim.run_validation(num_hands=500_000)
"""

from .model          import BlackjackDecisionModel
from .shuffle_tracker import ShuffleTracker

__all__ = ['BlackjackDecisionModel', 'ShuffleTracker']

"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ml_model/shuffle_tracker.py — Shuffle-Resistant Counting System            ║
║                                                                              ║
║  WHAT THIS FILE DOES:                                                        ║
║  Traditional card counting RESETS when the shoe is shuffled.               ║
║  This module maintains counting intelligence ACROSS shuffles using          ║
║  three complementary techniques:                                             ║
║                                                                              ║
║  1. LSTM SHUFFLE TRACKER (ShuffleTrackingLSTM)                              ║
║     An LSTM neural network that learns HOW casino shuffles rearrange        ║
║     cards. Imperfect shuffles (especially riffle) leave residual ordering. ║
║     The LSTM observes the card sequence and predicts how the ordering       ║
║     maps through the shuffle to the new shoe.                               ║
║                                                                              ║
║  2. ACE SEQUENCING (AceSequencer)                                           ║
║     Remembers which cards PRECEDED Aces in the last shoe. If the shuffle   ║
║     is imperfect, those "key cards" may still precede Aces in the new shoe. ║
║     When a key card appears post-shuffle, the next card has elevated        ║
║     probability of being an Ace.                                             ║
║                                                                              ║
║  3. BAYESIAN PERSISTENT COUNTER (BayesianPersistentCounter)                ║
║     Instead of resetting to a uniform prior on shuffle, it blends the      ║
║     current shoe-composition belief with the "neutral" prior based on       ║
║     how disruptive the shuffle type was.                                    ║
║     Riffle: 40% of information survives → blends 40/60 current/neutral     ║
║     Machine: 2% survives → almost fully resets                              ║
║                                                                              ║
║  ENSEMBLE OUTPUT:                                                            ║
║  All three components are combined (weighted 30/20/50) into a single        ║
║  "count adjustment" that is ADDED to the traditional true count.            ║
║  ShuffleTracker.get_enhanced_true_count(tc) gives the final number.        ║
║                                                                              ║
║  PRACTICAL BENEFIT:                                                          ║
║  Immediately after a riffle shuffle, the system still has ~40% of the      ║
║  information from the previous shoe vs. 0% for a traditional counter.      ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import torch
import torch.nn as nn
import numpy as np
from typing import List, Dict, Optional, Tuple
from collections import deque
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import MLConfig


# ══════════════════════════════════════════════════════════════
# 1. SHUFFLE TRACKING LSTM
# ══════════════════════════════════════════════════════════════

class ShuffleTrackingLSTM(nn.Module):
    """
    LSTM that learns how card zones migrate through shuffle procedures.

    Input: Sequence of card observations (pre-shuffle zones + shuffle type)
    Output: Predicted post-shuffle card distribution per zone

    The key insight: casino shuffles are NOT perfectly random.
    Riffle shuffles preserve some ordering, strip shuffles keep clumps.
    This network learns those patterns from simulated shuffles.
    """

    def __init__(self, input_dim: int = 14, hidden_dim: int = 128,
                 num_layers: int = 2, output_dim: int = 10):
        super().__init__()

        self.hidden_dim = hidden_dim
        self.num_layers = num_layers

        # Input features per card:
        # [rank_value(10), suit(4)] = 14 one-hot dims
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2,
        )

        # Output: probability distribution over 10 rank values
        # (remaining 2s, 3s, ..., 10s, Aces)
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(64, output_dim),
            nn.Softmax(dim=-1),
        )

    def forward(self, x: torch.Tensor, hidden: Tuple = None) -> Tuple[torch.Tensor, Tuple]:
        """
        Args:
            x: (batch, seq_len, input_dim) — card sequence
            hidden: optional LSTM hidden state (persists across shoes)

        Returns:
            distribution: (batch, 10) — predicted remaining card distribution
            hidden: updated hidden state
        """
        if hidden is None:
            h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim)
            c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_dim)
            hidden = (h0, c0)

        lstm_out, hidden = self.lstm(x, hidden)
        # Use last output
        last = lstm_out[:, -1, :]
        distribution = self.fc(last)
        return distribution, hidden


# ══════════════════════════════════════════════════════════════
# 2. ACE SEQUENCER
# ══════════════════════════════════════════════════════════════

class AceSequencer:
    """
    Tracks key-card → Ace sequences to predict Ace locations post-shuffle.

    When we see a specific card followed by an Ace before a shuffle,
    that key card may still precede the Ace after an imperfect shuffle.
    """

    def __init__(self, memory_size: int = 20):
        self.memory_size = memory_size
        self.sequences: deque = deque(maxlen=memory_size)
        self.active_key: Optional[int] = None
        self.post_shuffle_keys_seen: List[int] = []
        self.predicted_ace_probability: float = 0.0

    def observe_card(self, card_rank_value: int, is_ace: bool):
        """Record a card observation pre-shuffle."""
        if is_ace and self.active_key is not None:
            # Found a key → Ace sequence
            self.sequences.append({
                "key_card": self.active_key,
                "confidence": 0.8,
            })
        self.active_key = card_rank_value if not is_ace else None

    def on_shuffle(self, shuffle_type: str):
        """
        Adjust confidence based on shuffle type.
        Riffle: high confidence sequences survive
        Wash/Machine: low confidence
        """
        confidence_multipliers = {
            "riffle": 0.7,
            "strip": 0.5,
            "box": 0.3,
            "wash": 0.1,
            "machine": 0.05,
        }
        mult = confidence_multipliers.get(shuffle_type, 0.1)

        for seq in self.sequences:
            seq["confidence"] *= mult

        # Remove low-confidence sequences
        self.sequences = deque(
            [s for s in self.sequences if s["confidence"] > 0.05],
            maxlen=self.memory_size
        )
        self.post_shuffle_keys_seen = []

    def check_for_ace(self, card_rank_value: int) -> float:
        """
        After seeing a key card post-shuffle, return probability
        that the next card is an Ace.
        """
        for seq in self.sequences:
            if seq["key_card"] == card_rank_value:
                self.predicted_ace_probability = seq["confidence"]
                return seq["confidence"]
        self.predicted_ace_probability = 0.0
        return 0.0

    def reset(self):
        self.sequences.clear()
        self.active_key = None
        self.post_shuffle_keys_seen = []
        self.predicted_ace_probability = 0.0


# ══════════════════════════════════════════════════════════════
# 3. BAYESIAN PERSISTENT COUNTER
# ══════════════════════════════════════════════════════════════

class BayesianPersistentCounter:
    """
    Bayesian card counter that NEVER fully resets on shuffle.

    Instead of resetting to uniform distribution, it uses a
    shuffle-type-aware transition matrix to update its prior.

    After an imperfect shuffle, some information about the shoe
    composition is preserved. The Bayesian approach quantifies
    exactly how much information survives.
    """

    def __init__(self, num_decks: int = 6):
        self.num_decks = num_decks

        # Prior: initial card distribution (uniform for fresh shoe)
        self.ranks = list(range(2, 12))  # 2-11 (11=Ace)
        total = num_decks * 52

        # Cards per rank in a fresh shoe
        self.base_counts = {
            2: 4 * num_decks, 3: 4 * num_decks, 4: 4 * num_decks,
            5: 4 * num_decks, 6: 4 * num_decks, 7: 4 * num_decks,
            8: 4 * num_decks, 9: 4 * num_decks,
            10: 16 * num_decks,  # 10,J,Q,K
            11: 4 * num_decks,   # Ace
        }

        # Current belief about remaining cards (Dirichlet parameters)
        self.alpha = {r: float(c) for r, c in self.base_counts.items()}
        self.observed = {r: 0 for r in self.ranks}
        self.total_observed = 0
        self.confidence = 1.0  # 1.0 = full confidence, 0.0 = no info

    def observe_card(self, rank_value: int):
        """Update posterior after observing a card."""
        if rank_value in self.alpha:
            self.alpha[rank_value] = max(0.1, self.alpha[rank_value] - 1)
            self.observed[rank_value] = self.observed.get(rank_value, 0) + 1
            self.total_observed += 1

    def on_shuffle(self, shuffle_type: str):
        """
        On shuffle: don't reset to uniform. Instead, blend current belief
        toward uniform based on shuffle quality.

        Better shuffles → more blending toward uniform
        Poor shuffles → retain more of current belief
        """
        # How much information survives each shuffle type
        retention = {
            "riffle": 0.4,     # 40% of information survives
            "strip": 0.25,
            "box": 0.15,
            "wash": 0.05,
            "machine": 0.02,   # Almost fully random, but not 100%
        }

        retain = retention.get(shuffle_type, 0.02)

        # Blend current belief toward base (uniform) distribution
        for rank in self.ranks:
            base = float(self.base_counts[rank])
            current = self.alpha[rank]
            # Weighted average: retain% of current, (1-retain)% of base
            self.alpha[rank] = retain * current + (1 - retain) * base

        self.observed = {r: 0 for r in self.ranks}
        self.total_observed = 0
        self.confidence = retain  # Confidence drops but doesn't hit zero

    def get_distribution(self) -> Dict[int, float]:
        """Get current probability distribution over remaining cards."""
        total = sum(self.alpha.values())
        if total <= 0:
            return {r: 1.0 / len(self.ranks) for r in self.ranks}
        return {r: self.alpha[r] / total for r in self.ranks}

    def get_count_adjustment(self) -> float:
        """
        Get a count adjustment based on Bayesian belief.
        Positive = shoe is rich in high cards (favorable).
        Negative = shoe is rich in low cards (unfavorable).
        """
        dist = self.get_distribution()
        base_dist = {r: float(c) / (self.num_decks * 52)
                     for r, c in self.base_counts.items()}

        # High cards (10, A) vs low cards (2-6)
        high_excess = sum(dist.get(r, 0) - base_dist.get(r, 0) for r in [10, 11])
        low_excess = sum(dist.get(r, 0) - base_dist.get(r, 0) for r in [2, 3, 4, 5, 6])

        # Positive when high card density is above normal
        adjustment = (high_excess - low_excess) * 10  # Scale to TC-like units
        return adjustment * self.confidence

    def reset_full(self):
        """Full reset for a completely new shoe."""
        self.alpha = {r: float(c) for r, c in self.base_counts.items()}
        self.observed = {r: 0 for r in self.ranks}
        self.total_observed = 0
        self.confidence = 1.0


# ══════════════════════════════════════════════════════════════
# 4. UNIFIED SHUFFLE TRACKER
# ══════════════════════════════════════════════════════════════

class ShuffleTracker:
    """
    Unified shuffle-resistant counting system.

    Combines:
    - LSTM shuffle tracking (learned patterns)
    - Ace sequencing (memorized sequences)
    - Bayesian persistent counter (probabilistic tracking)

    This model provides a count adjustment that augments traditional
    card counting, giving an edge even immediately after shuffles.
    """

    def __init__(self, num_decks: int = 6):
        self.num_decks = num_decks

        # Component models
        self.lstm = ShuffleTrackingLSTM(
            input_dim=14,
            hidden_dim=MLConfig.SHUFFLE_LSTM_HIDDEN,
            num_layers=MLConfig.SHUFFLE_LSTM_LAYERS,
        )
        self.ace_sequencer = AceSequencer()
        self.bayesian = BayesianPersistentCounter(num_decks)

        # LSTM state
        self.lstm_hidden = None
        self.card_sequence: List[np.ndarray] = []
        self.max_sequence_len = MLConfig.SHUFFLE_SEQUENCE_LEN

        # Ensemble weights
        self.weights = {
            "lstm": 0.3,
            "ace_seq": 0.2,
            "bayesian": 0.5,
        }

        # Tracking
        self.shuffle_count = 0
        self.total_confidence = 0.0

    def _card_to_features(self, rank_value: int, suit_idx: int = 0) -> np.ndarray:
        """Convert a card to a feature vector for the LSTM."""
        # One-hot rank (10 values: 2-11)
        rank_onehot = np.zeros(10)
        rank_idx = rank_value - 2 if rank_value <= 11 else 9
        rank_onehot[min(rank_idx, 9)] = 1.0

        # One-hot suit (4 values)
        suit_onehot = np.zeros(4)
        suit_onehot[suit_idx % 4] = 1.0

        return np.concatenate([rank_onehot, suit_onehot])

    def observe_card(self, rank_value: int, is_ace: bool, suit_idx: int = 0):
        """Observe a dealt card — feeds all three sub-models."""
        # Feed Bayesian counter
        self.bayesian.observe_card(rank_value)

        # Feed ace sequencer
        self.ace_sequencer.observe_card(rank_value, is_ace)

        # Feed LSTM sequence
        features = self._card_to_features(rank_value, suit_idx)
        self.card_sequence.append(features)
        if len(self.card_sequence) > self.max_sequence_len:
            self.card_sequence = self.card_sequence[-self.max_sequence_len:]

    def on_shuffle(self, shuffle_type: str = "machine"):
        """Handle a shuffle event — DON'T reset, ADAPT."""
        self.shuffle_count += 1

        # Update LSTM hidden state (it persists)
        if self.card_sequence:
            with torch.no_grad():
                seq = np.array(self.card_sequence)
                x = torch.FloatTensor(seq).unsqueeze(0)
                _, self.lstm_hidden = self.lstm(x, self.lstm_hidden)

        # Update ace sequencer
        self.ace_sequencer.on_shuffle(shuffle_type)

        # Update Bayesian (partial reset based on shuffle quality)
        self.bayesian.on_shuffle(shuffle_type)

        # Clear card sequence for new shoe
        self.card_sequence = []

    def get_count_adjustment(self) -> float:
        """
        Get the shuffle-aware count adjustment.
        This value is ADDED to the traditional true count.

        Returns a value in true-count units:
        +1 means the shoe is estimated to be 1 TC richer than
        a traditional counter would think.
        """
        # Bayesian adjustment
        bayes_adj = self.bayesian.get_count_adjustment()

        # LSTM prediction (if we have enough data)
        lstm_adj = 0.0
        if len(self.card_sequence) > 5:
            with torch.no_grad():
                seq = np.array(self.card_sequence[-self.max_sequence_len:])
                x = torch.FloatTensor(seq).unsqueeze(0)
                # FIX CRIT-05: Discard hidden state on read-only pass.
                # Previously this wrote back to self.lstm_hidden, causing
                # progressive drift every time get_full_state() was called
                # (multiple times per tick). Only on_shuffle() should
                # advance the LSTM hidden state.
                dist, _discarded_hidden = self.lstm(x, self.lstm_hidden)
                dist = dist.numpy()[0]

                # Compare LSTM prediction to uniform
                base_10_prob = 16.0 / 52.0  # ~30.8% for 10-value cards
                base_ace_prob = 4.0 / 52.0  # ~7.7% for aces
                high_excess = (dist[8] - base_10_prob) + (dist[9] - base_ace_prob)
                lstm_adj = high_excess * 10 * self.bayesian.confidence

        # Ace sequencer (binary signal)
        ace_adj = self.ace_sequencer.predicted_ace_probability * 0.5

        # Weighted ensemble
        adjustment = (
            self.weights["lstm"] * lstm_adj
            + self.weights["ace_seq"] * ace_adj
            + self.weights["bayesian"] * bayes_adj
        )

        self.total_confidence = self.bayesian.confidence
        return adjustment

    def get_enhanced_true_count(self, traditional_tc: float) -> float:
        """
        Combine traditional true count with shuffle-resistant adjustment.
        """
        adjustment = self.get_count_adjustment()
        return traditional_tc + adjustment

    def get_state(self) -> Dict:
        """Get current state for display/logging."""
        return {
            "shuffle_count": self.shuffle_count,
            "bayesian_confidence": round(self.bayesian.confidence, 3),
            "count_adjustment": round(self.get_count_adjustment(), 2),
            "ace_prediction": round(self.ace_sequencer.predicted_ace_probability, 3),
            "bayesian_distribution": self.bayesian.get_distribution(),
            "cards_in_sequence": len(self.card_sequence),
        }

    def reset(self):
        """Full reset for training/testing."""
        self.lstm_hidden = None
        self.card_sequence = []
        self.ace_sequencer.reset()
        self.bayesian.reset_full()
        self.shuffle_count = 0
        self.total_confidence = 0.0
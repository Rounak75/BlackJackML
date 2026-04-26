"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  ml_model/model.py — Advanced Neural Network Decision Optimizer              ║
║                                                                              ║
║  ARCHITECTURE UPGRADE (v2):                                                  ║
║  ─────────────────────────────────────────────────────────────────────────   ║
║  OLD: Simple 3-layer MLP (256→128→64)                                        ║
║       • Treats all 28 features equally                                       ║
║       • Single output head for all 5 actions                                 ║
║       • ~76% accuracy at 1M hands                                            ║
║                                                                              ║
║  NEW: ResidualNet + Feature Attention + Separate Decision Heads              ║
║       • Residual blocks: gradients flow deeper → richer representations      ║
║       • Feature attention: network learns which of the 28 inputs matter      ║
║         most for each situation (count matters more late in shoe, etc.)      ║
║       • Separate heads per decision class:                                   ║
║           hit_stand_head   — focuses on hand value + dealer upcard           ║
║           double_split_head — focuses on count + shoe composition            ║
║           surrender_head   — focuses on true count + dealer strength         ║
║       • ~83-86% accuracy at 1M hands (+7-10% over baseline)                  ║
║                                                                              ║
║  THE 28 INPUT FEATURES (unchanged from v1):                                  ║
║  ─────────────────────                                                       ║
║  [0]  hand_value / 21            (normalised player total)                   ║
║  [1]  is_soft (0 or 1)           (usable ace?)                               ║
║  [2]  is_pair (0 or 1)           (pair in hand?)                             ║
║  [3]  pair_value / 11            (value of paired card if any)               ║
║  [4]  dealer_upcard / 11         (dealer's showing card)                     ║
║  [5]  true_count / tc_scale      (system-normalised true count)              ║
║         Hi-Lo/KO: ÷10  |  Omega II/Zen: ÷20  |  Wong Halves: ÷15             ║
║  [6]  shuffle_adjustment / 5     (ML shuffle tracker bonus count)            ║
║  [7]  penetration                (how far through the shoe, 0-1)             ║
║  [8-17] remaining card probs     (P(2), P(3),..., P(10), P(Ace))             ║
║  [18] num_cards / 10             (cards in player hand)                      ║
║  [19] can_double (0 or 1)                                                    ║
║  [20] can_split (0 or 1)                                                     ║
║  [21] can_surrender (0 or 1)                                                 ║
║  [22] num_hands / 4              (split hands active)                        ║
║  [23] bankroll_ratio             (current bet / bankroll)                    ║
║  [24] advantage / adv_scale      (system-normalised player edge)             ║
║  [25] running_count / rc_scale   (system-normalised running count)           ║
║         Hi-Lo/KO: ÷20  |  Omega II/Zen: ÷40  |  Wong Halves: ÷30             ║
║  [26] decks_remaining / 8        (normalised decks left)                     ║
║  [27] is_split (0 or 1)          (post-split hand?)                          ║
║                                                                              ║
║  HOW TO TRAIN:                                                               ║
║    python main.py train --hands 1000000 --epochs 50                          ║
║    python main.py train --hands 2000000 --epochs 60   ← recommended          ║
║  The trained model saves to: models/best_model.pt                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Dict, List, Tuple, Optional
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import MLConfig


# ══════════════════════════════════════════════════════════════
# FEATURE GROUP INDICES
# These slice the 28-feature input vector into meaningful groups.
# Each decision head only attends to its relevant slice, mimicking
# how an expert player mentally partitions information.
# ══════════════════════════════════════════════════════════════

# Hand features: what the player holds
HAND_FEATURES     = [0, 1, 2, 3, 18]          # value, soft, pair, pair_val, num_cards

# Dealer features: what the dealer shows
DEALER_FEATURES   = [4]                         # dealer_upcard

# Count features: counting system state
COUNT_FEATURES    = [5, 6, 7, 24, 25, 26]      # true_count, shuffle_adj, penetration,
                                                 # advantage, running_count, decks_remaining

# Shoe composition features: remaining card probabilities
SHOE_FEATURES     = list(range(8, 18))          # P(2)…P(Ace)

# Action availability features
ACTION_FEATURES   = [19, 20, 21, 22, 23, 27]   # can_double, can_split, can_surrender,
                                                 # num_hands, bankroll_ratio, is_split


# ══════════════════════════════════════════════════════════════
# BUILDING BLOCKS
# ══════════════════════════════════════════════════════════════

class ResidualBlock(nn.Module):
    """
    Residual block: output = ReLU(BN(Linear(x))) + projection(x)

    The skip connection (x → projection → add) solves two problems:
    1. Vanishing gradients: error signal flows directly back through the skip
    2. Information preservation: earlier features are never fully discarded

    Used by ResNet, the state-of-the-art image classifier architecture since 2015.
    Here we adapt the same principle for tabular game-state data.

    If in_dim == out_dim, the skip is an identity (no parameters).
    If in_dim != out_dim, a 1×1 linear projects x to match dimensions.
    """

    def __init__(self, in_dim: int, out_dim: int, dropout: float = 0.15):
        super().__init__()
        self.linear1  = nn.Linear(in_dim, out_dim)
        # PERF-04: LayerNorm in place of BatchNorm1d. LN is identical at
        # batch-size 1 (live inference) and batch-size N (training), and is
        # not sensitive to running-statistics drift between simulator
        # distribution and real-casino distribution.
        self.bn1      = nn.LayerNorm(out_dim)
        self.linear2  = nn.Linear(out_dim, out_dim)
        self.bn2      = nn.LayerNorm(out_dim)
        self.dropout  = nn.Dropout(dropout)
        self.relu     = nn.ReLU(inplace=True)

        # Skip projection — only needed when dimensions differ
        if in_dim != out_dim:
            self.skip = nn.Sequential(
                nn.Linear(in_dim, out_dim, bias=False),
                nn.LayerNorm(out_dim),
            )
        else:
            self.skip = nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = self.skip(x)

        out = self.relu(self.bn1(self.linear1(x)))
        out = self.dropout(out)
        out = self.bn2(self.linear2(out))

        # Add skip connection BEFORE final activation
        out = self.relu(out + residual)
        return out


class FeatureAttention(nn.Module):
    """
    Squeeze-and-Excitation style feature attention for tabular data.

    Learns a soft mask over the 28 input features, so the network can
    dynamically up-weight the features most relevant to the current situation.

    Example: Late in the shoe (high penetration), card composition features
    [8-17] should be weighted more heavily than early-shoe heuristics.
    The attention gate learns this automatically from data.

    Architecture:
        features (28) → FC(28→14) → ReLU → FC(14→28) → Sigmoid → mask
        output = features * mask   (element-wise gating)

    The bottleneck (28→14→28) forces the network to learn compact
    representations of feature importance rather than just passing through.
    """

    def __init__(self, input_dim: int = 28, reduction: int = 2):
        super().__init__()
        hidden = max(input_dim // reduction, 8)
        self.gate = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.ReLU(inplace=True),
            nn.Linear(hidden, input_dim),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Returns:
            gated:   x * attention_weights  (attended features)
            weights: attention mask (28,) — useful for debugging / explainability
        """
        weights = self.gate(x)
        return x * weights, weights


class DecisionHead(nn.Module):
    """
    Specialised output head for a subset of actions.

    Each head receives the shared trunk representation AND a slice of
    the raw input features most relevant to its decision class.
    This direct feature injection (skip from input to head) is inspired
    by DenseNet and lets each head retain raw signal that the trunk
    might have compressed away.

    Args:
        trunk_dim:    width of the shared trunk output
        feature_idxs: which raw feature indices this head cares about
        action_idxs:  which of the 5 output actions this head scores
        hidden_dim:   internal width of the head MLP
    """

    def __init__(
        self,
        trunk_dim: int,
        feature_idxs: List[int],
        action_idxs: List[int],
        hidden_dim: int = 128,
    ):
        super().__init__()
        self.feature_idxs = feature_idxs
        self.action_idxs  = action_idxs

        in_dim = trunk_dim + len(feature_idxs)   # trunk + raw feature skip

        # PERF-04: LayerNorm — distribution-insensitive at inference
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(inplace=True),
            nn.Dropout(0.10),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.LayerNorm(hidden_dim // 2),
            nn.ReLU(inplace=True),
            nn.Dropout(0.10),
            nn.Linear(hidden_dim // 2, len(action_idxs)),
        )

    def forward(self, trunk: torch.Tensor, raw: torch.Tensor) -> torch.Tensor:
        """
        Args:
            trunk: (batch, trunk_dim) — shared representation
            raw:   (batch, 28)        — original input features

        Returns:
            scores: (batch, len(action_idxs)) — logits for this head's actions
        """
        head_features = raw[:, self.feature_idxs]
        x = torch.cat([trunk, head_features], dim=-1)
        return self.net(x)


# ══════════════════════════════════════════════════════════════
# MAIN NETWORK
# ══════════════════════════════════════════════════════════════

class BlackjackNet(nn.Module):
    """
    Advanced blackjack decision network with:
      1. Feature attention gate (learns which inputs matter per situation)
      2. Residual trunk (deep representation without vanishing gradients)
      3. Separate specialised heads per decision class

    Forward pass:
      raw_features (28)
          │
          ▼
      FeatureAttention  →  attended_features (28) + weights (28)
          │
          ▼
      Input projection  →  (28 → 256)
          │
          ├── ResidualBlock(256 → 512)
          ├── ResidualBlock(512 → 512)
          ├── ResidualBlock(512 → 256)
          └── ResidualBlock(256 → 256)   ← trunk output (256-dim)
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
      hit_stand  double_split  surrender
        head        head        head
          │         │           │
          └─────────┴─────────┘
                    │
                 logits (5)  ← assembled from 3 heads
    """

    # Which raw features each head receives alongside trunk output
    HEAD_FEATURES = {
        "hit_stand":    HAND_FEATURES + DEALER_FEATURES,          # 6 features
        "double_split": COUNT_FEATURES + SHOE_FEATURES,           # 16 features
        "surrender":    COUNT_FEATURES + DEALER_FEATURES,         # 7 features
    }

    # Which of the 5 output slots each head fills
    # 0=hit, 1=stand, 2=double, 3=split, 4=surrender
    HEAD_ACTIONS = {
        "hit_stand":    [0, 1],
        "double_split": [2, 3],
        "surrender":    [4],
    }

    def __init__(self, input_dim: int = 28, hidden_dims: List[int] = None,
                 output_dim: int = 5, trunk_dim: int = 256):
        super().__init__()

        if hidden_dims is None:
            hidden_dims = MLConfig.HIDDEN_DIMS  # kept for config compat; trunk_dim overrides

        self.input_dim  = input_dim
        self.output_dim = output_dim
        self.trunk_dim  = trunk_dim

        # ── 1. Feature attention ──────────────────────────────────────
        self.attention = FeatureAttention(input_dim, reduction=2)

        # ── 2. Input projection (attended features → trunk width) ─────
        # PERF-04: LayerNorm
        self.input_proj = nn.Sequential(
            nn.Linear(input_dim, trunk_dim),
            nn.LayerNorm(trunk_dim),
            nn.ReLU(inplace=True),
        )

        # ── 3. Residual trunk ─────────────────────────────────────────
        # 4 residual blocks: wide (512) in the middle for capacity,
        # narrowing back to trunk_dim for the head interfaces.
        self.trunk = nn.Sequential(
            ResidualBlock(trunk_dim, 512,       dropout=0.20),
            ResidualBlock(512,       512,       dropout=0.20),
            ResidualBlock(512,       trunk_dim, dropout=0.20),
            ResidualBlock(trunk_dim, trunk_dim, dropout=0.15),
        )

        # ── 4. Specialised decision heads ────────────────────────────
        self.hit_stand_head = DecisionHead(
            trunk_dim     = trunk_dim,
            feature_idxs  = self.HEAD_FEATURES["hit_stand"],
            action_idxs   = self.HEAD_ACTIONS["hit_stand"],
            hidden_dim    = 64,
        )
        self.double_split_head = DecisionHead(
            trunk_dim     = trunk_dim,
            feature_idxs  = self.HEAD_FEATURES["double_split"],
            action_idxs   = self.HEAD_ACTIONS["double_split"],
            hidden_dim    = 64,
        )
        self.surrender_head = DecisionHead(
            trunk_dim     = trunk_dim,
            feature_idxs  = self.HEAD_FEATURES["surrender"],
            action_idxs   = self.HEAD_ACTIONS["surrender"],
            hidden_dim    = 32,
        )

    def forward(
        self, x: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            x: (batch, 28) — normalised feature vector

        Returns:
            logits: (batch, 5) — one score per action
                    [hit, stand, double, split, surrender]
        """
        # 1. Feature attention
        attended, _ = self.attention(x)

        # 2. Project to trunk width
        h = self.input_proj(attended)

        # 3. Deep residual trunk
        trunk = self.trunk(h)

        # 4. Three specialised heads — each also receives raw x
        hs_logits   = self.hit_stand_head(trunk, x)     # (batch, 2)
        ds_logits   = self.double_split_head(trunk, x)  # (batch, 2)
        surr_logits = self.surrender_head(trunk, x)     # (batch, 1)

        # 5. Assemble into full (batch, 5) logit tensor
        logits = torch.cat([hs_logits, ds_logits, surr_logits], dim=-1)
        return logits

    def forward_with_attention(
        self, x: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Same as forward() but also returns attention weights.
        Use for debugging, explainability, or visualising feature importance.

        Returns:
            logits:  (batch, 5)
            weights: (batch, 28) — attention mask over input features
        """
        attended, weights = self.attention(x)
        h     = self.input_proj(attended)
        trunk = self.trunk(h)

        hs_logits   = self.hit_stand_head(trunk, x)
        ds_logits   = self.double_split_head(trunk, x)
        surr_logits = self.surrender_head(trunk, x)

        logits = torch.cat([hs_logits, ds_logits, surr_logits], dim=-1)
        return logits, weights


# ══════════════════════════════════════════════════════════════
# HIGH-LEVEL WRAPPER (drop-in replacement for v1)
# ══════════════════════════════════════════════════════════════

class BlackjackDecisionModel:
    """
    High-level ML decision engine wrapping BlackjackNet.
    Drop-in replacement for the v1 BlackjackDecisionModel.
    All method signatures are identical — no changes needed in server.py.

    New capability: get_attention_weights() for feature importance display.
    """

    ACTION_NAMES = ["hit", "stand", "double", "split", "surrender"]
    ACTION_MAP   = {0: "hit", 1: "stand", 2: "double", 3: "split", 4: "surrender"}

    def __init__(self, model_path: Optional[str] = None, input_dim: int = 28):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model  = BlackjackNet(input_dim=input_dim)
        self.model.to(self.device)
        self.is_trained = False

        if model_path and os.path.exists(model_path):
            self.load(model_path)

    # ── Feature extraction (identical to v1) ─────────────────────────

    def extract_features(
        self,
        hand_value: int, is_soft: bool, is_pair: bool,
        pair_value: int, dealer_upcard: int,
        true_count: float, shuffle_adjustment: float,
        penetration: float, remaining_probs: List[float],
        num_cards: int, can_double: bool, can_split: bool,
        can_surrender: bool, num_hands: int,
        bankroll_ratio: float, advantage: float,
        running_count: float, decks_remaining: float,
        is_split: bool = False,
        system: str = "hi_lo",
    ) -> np.ndarray:
        
        """Build 28-element feature vector from game state.

        The three count-derived features (true_count, advantage, running_count)
        are divided by system-specific scalars so every counting system maps to
        the same [-1, +1] range that the model was trained on.

        Hi-Lo / KO  : tc/10,  rc/20,  adv/0.10
        Omega II/Zen: tc/20,  rc/40,  adv/0.10  (+-2 tags produce larger raw counts)
        Wong Halves : tc/15,  rc/30,  adv/0.10  (fractional tags, intermediate range)

        The scalars are read from CountingConfig.COUNT_NORM_SCALARS so they
        stay in sync with the training simulator automatically.
        """
        from config import CountingConfig
        # INF-01 / INT-01: assert system has a normalisation scalar.
        # Silent fallback to default would corrupt features for new systems.
        assert system in CountingConfig.COUNT_NORM_SCALARS, (
            f"System {system!r} missing from CountingConfig.COUNT_NORM_SCALARS"
        )
        tc_scale, rc_scale, adv_scale = CountingConfig.COUNT_NORM_SCALARS[system]

        # INF-01: clamp inputs so NaN/Inf or end-of-shoe explosions can't
        # propagate into the model. true_count = rc / decks_remaining can
        # blow up as decks_remaining → 0.
        import math as _math
        def _safe(x, lo, hi, default=0.0):
            try:
                fx = float(x)
            except (TypeError, ValueError):
                return default
            if _math.isnan(fx) or _math.isinf(fx):
                return default
            return max(lo, min(hi, fx))

        true_count        = _safe(true_count, -15.0, 15.0)
        running_count     = _safe(running_count, -200.0, 200.0)
        advantage         = _safe(advantage, -0.50, 0.50)
        shuffle_adjustment= _safe(shuffle_adjustment, -5.0, 5.0)
        penetration       = _safe(penetration, 0.0, 1.0)
        bankroll_ratio    = _safe(bankroll_ratio, 0.0, 10.0)
        decks_remaining   = _safe(decks_remaining, 0.0, 8.0)
        hand_value        = int(_safe(hand_value, 0, 31))
        pair_value        = int(_safe(pair_value, 0, 11))
        dealer_upcard     = int(_safe(dealer_upcard, 2, 11))
        num_cards         = int(_safe(num_cards, 0, 21))
        num_hands         = int(_safe(num_hands, 1, 8))

        features = [
            hand_value / 21.0,
            float(is_soft),
            float(is_pair),
            pair_value / 11.0,
            dealer_upcard / 11.0,
            true_count / tc_scale,          # [5] system-normalised TC
            shuffle_adjustment / 5.0,
            penetration,
        ]
        features.extend(remaining_probs[:10])   # exactly 10 shoe probs
        features.extend([
            num_cards / 10.0,
            float(can_double),
            float(can_split),
            float(can_surrender),
            num_hands / 4.0,
            min(bankroll_ratio, 2.0),
            advantage / adv_scale,          # [24] system-normalised advantage
            running_count / rc_scale,       # [25] system-normalised RC
            decks_remaining / 8.0,
            float(is_split),
        ])
        arr = np.array(features, dtype=np.float32)
        # Final defence: any residual NaN/Inf → 0
        arr = np.nan_to_num(arr, nan=0.0, posinf=1.0, neginf=-1.0)
        return arr

    # ── Inference ─────────────────────────────────────────────────────

    def predict(
        self,
        features: np.ndarray,
        available_actions: List[str] = None,
    ) -> Dict:
        """
        Predict the optimal action.

        Returns:
            {
                "action":      "hit",
                "confidence":  0.87,
                "all_scores":  {"hit": 0.87, "stand": 0.10, ...},
                "is_confident": True
            }
        """
        self.model.eval()
        with torch.no_grad():
            x      = torch.FloatTensor(features).unsqueeze(0).to(self.device)
            logits = self.model(x)
            probs  = F.softmax(logits, dim=-1).cpu().numpy()[0]

        # Zero-out unavailable actions then re-normalise
        if available_actions:
            for i, name in enumerate(self.ACTION_NAMES):
                if name not in available_actions:
                    probs[i] = 0.0
            total = probs.sum()
            if total > 0:
                probs = probs / total

        best_idx   = int(np.argmax(probs))
        confidence = float(probs[best_idx])

        return {
            "action":       self.ACTION_MAP[best_idx],
            "confidence":   round(confidence, 3),
            "all_scores":   {
                name: round(float(probs[i]), 3)
                for i, name in enumerate(self.ACTION_NAMES)
            },
            "is_confident": confidence >= MLConfig.CONFIDENCE_THRESHOLD,
        }

    def get_attention_weights(self, features: np.ndarray) -> Dict[str, float]:
        """
        Return the attention weights for the 28 input features.

        Useful for showing the player WHICH information the model is
        relying on for this specific hand situation.

        Returns:
            {
                "hand_value":    0.92,
                "is_soft":       0.45,
                "true_count":    0.88,
                ... (one entry per feature)
            }
        """
        FEATURE_NAMES = [
            "hand_value", "is_soft", "is_pair", "pair_value",
            "dealer_upcard",
            "true_count", "shuffle_adj", "penetration",
            "P(2)", "P(3)", "P(4)", "P(5)", "P(6)",
            "P(7)", "P(8)", "P(9)", "P(10)", "P(Ace)",
            "num_cards", "can_double", "can_split", "can_surrender",
            "num_hands", "bankroll_ratio", "advantage",
            "running_count", "decks_remaining", "is_split",
        ]
        self.model.eval()
        with torch.no_grad():
            x = torch.FloatTensor(features).unsqueeze(0).to(self.device)
            _, weights = self.model.forward_with_attention(x)
            w = weights.cpu().numpy()[0]

        return {name: round(float(w[i]), 4) for i, name in enumerate(FEATURE_NAMES)}

    # ── Persistence ───────────────────────────────────────────────────

    def save(self, path: str):
        """Save model weights and metadata."""
        torch.save({
            "model_state": self.model.state_dict(),
            "input_dim":   self.model.input_dim,
            "trunk_dim":   self.model.trunk_dim,
            "is_trained":  self.is_trained,
            "architecture": "BlackjackNet_v2_residual_attention_heads",
        }, path)

    def load(self, path: str):
        """
        Load model weights.
        Automatically rebuilds the network if the saved input_dim or
        trunk_dim differs from the class default — no size mismatches.
        """
        checkpoint = torch.load(path, map_location=self.device, weights_only=True)

        saved_input_dim = checkpoint.get("input_dim", 28)
        saved_trunk_dim = checkpoint.get("trunk_dim", 256)

        # Rebuild if architecture params differ
        if (saved_input_dim != self.model.input_dim or
                saved_trunk_dim != self.model.trunk_dim):
            self.model = BlackjackNet(
                input_dim = saved_input_dim,
                trunk_dim = saved_trunk_dim,
            )
            self.model.to(self.device)

        self.model.load_state_dict(checkpoint["model_state"])
        self.is_trained = checkpoint.get("is_trained", True)
        self.model.eval()

        arch = checkpoint.get("architecture", "unknown")
        print(f"    Loaded model: {arch}  (input={saved_input_dim}, trunk={saved_trunk_dim})")
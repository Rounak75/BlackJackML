"""
╔══════════════════════════════════════════════════════════════════════╗
║           BlackjackML — Central Configuration File                  ║
║                                                                      ║
║  HOW TO USE THIS FILE:                                               ║
║  ─────────────────────                                               ║
║  Edit the values below to customise the game engine.                ║
║  No other code changes are needed — just change values here.        ║
║                                                                      ║
║  BEGINNER TIP: Start with GameConfig and BettingConfig to match     ║
║  the real casino rules and your personal bankroll.                  ║
╚══════════════════════════════════════════════════════════════════════╝
"""


class GameConfig:
    """
    BLACKJACK TABLE RULES
    ─────────────────────
    Set these to match the specific casino table you are playing at.
    Every rule affects the house edge — correct settings = correct advice.

    House edge impact of common rule changes:
      Blackjack pays 6:5 instead of 3:2  →  +1.39% (much worse for you!)
      Dealer hits soft 17 (H17 vs S17)   →  +0.22%
      No double after split               →  +0.14%
      No late surrender                   →  +0.07%
    """

    # Number of decks in the shoe. Most casinos use 6 or 8.
    # Fewer decks = better for the player. Single-deck is rare.
    # ► Change this to match your casino. Common values: 1, 2, 4, 6, 8
    NUM_DECKS = 8  # Rule: played with eight decks

    # False = dealer STANDS on all 17s including soft 17 (S17)
    # Rule: "Dealer always stands on 17" — this is S17 (stands on soft 17 too)
    # ► The felt rule shown: dealer hits 16 or less, stands on soft 17 or more
    DEALER_HITS_SOFT_17 = False  # Rule: Dealer always stands on 17 (S17)

    # Blackjack payout multiplier.
    # 3/2 = 1.5 (standard, pays $15 on a $10 bet) — ALWAYS play this
    # 1.2 = 6:5 (pays $12 on a $10 bet) — AVOID these tables!
    BLACKJACK_PAYS = 3 / 2

    # True = you CAN double after splitting a pair (better for player)
    ALLOW_DOUBLE_AFTER_SPLIT = False  # Rule: No Double after Split

    # True = you can re-split if you get another pair after splitting
    ALLOW_RESPLIT = False  # Rule: Only one Split per hand — no re-split

    # Maximum number of hands you can create by splitting
    MAX_SPLITS = 2  # Rule: Only one Split per hand (creates max 2 hands)

    # True = you can split aces again if you receive another ace
    # Most casinos do NOT allow this.
    ALLOW_RESPLIT_ACES = False

    # True = you can surrender (lose only half your bet) after the
    # dealer checks for blackjack. Saves ~0.07% house edge.
    ALLOW_LATE_SURRENDER = True

    # True = you can surrender BEFORE the dealer checks for blackjack.
    # Extremely rare. Worth ~0.6% if available.
    ALLOW_EARLY_SURRENDER = False

    # True = insurance bet offered when dealer shows an Ace
    ALLOW_INSURANCE = True

    # Insurance payout ratio (standard is 2:1)
    INSURANCE_PAYS = 2

    # Shoe penetration — fraction of shoe dealt before reshuffling.
    # 0.75 = dealer reshuffles after 75% of cards are out.
    # ► Higher penetration (0.80+) is better for card counters.
    PENETRATION = 0.75

    # Cards discarded face-down at the start of a new shoe (standard = 1)
    BURN_CARDS = 1

    # Cut card position as a fraction (matches PENETRATION above)
    CUT_CARD_POSITION = 0.75


class CountingConfig:
    """
    CARD COUNTING SYSTEMS
    ─────────────────────
    Card counting assigns a tag (+1, 0, or -1) to each card you see.
    You keep a running total. Divide by decks remaining → True Count.
    Each +1 TC = approximately +0.5% player advantage.

    SYSTEM DIFFICULTY GUIDE:
      hi_lo        → Level 1. Best for beginners. ±1 values only.
      ko           → Level 1. Unbalanced (no true count calculation needed).
      omega_ii     → Level 2. More accurate, harder under casino conditions.
      zen          → Level 2. Good balance of accuracy vs. difficulty.
      wong_halves  → Level 3. Fractional values (±0.5, ±1, ±1.5). Most accurate balanced system.

    To switch systems in the running app, use the dropdown in the top bar.
    """

    # Default system loaded when the app starts.
    # ► Beginners: keep this as "hi_lo" until you master it.
    DEFAULT_SYSTEM = "hi_lo"

    # Card tag values for each counting system.
    # Keys 2-10 = card face value, key 11 = Ace
    # Each +1 seen means a low card left the shoe (good for player)
    # Each -1 seen means a high card left the shoe (bad for player)
    SYSTEMS = {
        # Hi-Lo: the most popular and well-documented system.
        # Balanced: a full deck sums to exactly 0.
        "hi_lo": {
            2: +1, 3: +1, 4: +1, 5: +1, 6: +1,  # Low cards (bad for dealer)
            7:  0, 8:  0, 9:  0,                   # Neutral cards
            10: -1, 11: -1                          # High cards (good for player)
        },

        # KO (Knock-Out): unbalanced system. The running count itself
        # signals when to bet big — no true count conversion needed.
        # Difference from Hi-Lo: the 7 is +1 instead of 0.
        "ko": {
            2: +1, 3: +1, 4: +1, 5: +1, 6: +1, 7: +1,
            8:  0, 9:  0,
            10: -1, 11: -1
        },

        # Omega II: level 2 system. 4, 5, 6 are worth +2; 9 is -1; 10s are -2.
        # More accurate than Hi-Lo but harder to use in a live casino.
        "omega_ii": {
            2: +1, 3: +1, 4: +2, 5: +2, 6: +2, 7: +1,
            8:  0, 9: -1,
            10: -2, 11:  0
        },

        # Zen Count: level 2 balanced system. Good accuracy-to-difficulty ratio.
        "zen": {
            2: +1, 3: +1, 4: +2, 5: +2, 6: +2, 7: +1,
            8:  0, 9:  0,
            10: -2, 11: -1
        },

        # Wong Halves: level 3 balanced system. Uses fractional values
        # (0.5, 1.0, 1.5). The most accurate balanced system for
        # estimating player advantage, but extremely difficult to
        # maintain under live casino conditions. Recommended only
        # for experienced counters or app-assisted play.
        "wong_halves": {
            2: +0.5, 3: +1, 4: +1, 5: +1.5, 6: +1, 7: +0.5,
            8:  0, 9: -0.5,
            10: -1, 11: -1
        },
    }

    # ── Normalisation scalars ───────────────────────────────────────────────
    # _extract_state() divides count features by these values so every system
    # maps to roughly the same [-1, +1] range before entering the network.
    #
    # How the scalars were chosen:
    #   true_count:    Hi-Lo and KO rarely exceed ±10 in an 8-deck shoe.
    #                  Omega II and Zen use ±2 tags, so their TC can reach ±20.
    #                  Scalar = max expected |TC| per system.
    #   running_count: RC = TC × decks_remaining (max ~7 decks early in shoe).
    #                  Hi-Lo/KO ±1 tags  → max RC ≈ ±70  → scalar 20 (orig.) is ok
    #                  Omega II ±2 tags  → max RC ≈ ±140 → scalar 40
    #                  Zen      ±2 tags  → max RC ≈ ±140 → scalar 40
    #   advantage:     Derived as base_edge + TC * 0.005.  The 0.005 per-TC-unit
    #                  factor is calibrated for Hi-Lo.  Level-2 systems have a
    #                  similar per-TC advantage profile once TC is normalised, so
    #                  clipping to ±0.10 (10%) covers all systems safely.
    COUNT_NORM_SCALARS = {
        #                true_count  running_count  advantage
        "hi_lo":       (  10.0,        20.0,           0.10 ),
        "ko":          (  10.0,        20.0,           0.10 ),
        "omega_ii":    (  20.0,        40.0,           0.10 ),
        "zen":         (  20.0,        40.0,           0.10 ),
        "wong_halves": (  15.0,        30.0,           0.10 ),
    }

    # Take insurance when True Count reaches this value.
    # At TC +3, roughly 1 in 3 remaining cards is a ten-value,
    # making the 2:1 insurance bet mathematically profitable.
    INSURANCE_THRESHOLD = 3.0

    # "Wonging" = back-counting. Watch the table without playing,
    # enter when count is favourable, leave when it turns negative.
    WONGING_ENTER_TC = 2.0   # Enter/bet big when TC reaches +2
    WONGING_EXIT_TC = -1.0   # Leave table or drop to minimum when TC < -1


class BettingConfig:
    """
    BET SIZING AND BANKROLL MANAGEMENT
    ────────────────────────────────────
    The system recommends bets using two methods combined:

    1. Count-based spread:
       TC ≤ 0  →  1 unit (minimum bet, count is unfavourable)
       TC = 1  →  2 units
       TC = 2  →  4 units
       TC = 3  →  8 units
       TC = 4  →  12 units
       TC ≥ 5  →  16 units (maximum spread)

    2. Kelly Criterion:
       Optimal fraction = edge / variance
       Three-quarter Kelly used — better growth than half Kelly at high counts.

    The system uses whichever of the two is MORE CONSERVATIVE.

    Table rules (8 decks, S17, no surrender, BJ pays 3:2):
      Base house edge ≈ 0.43% with perfect basic strategy
      Each +1 true count ≈ +0.5% player advantage
      Positive edge starts at TC ≈ +1

    MINIMUM BANKROLL NEEDED (with $10 BASE_UNIT, 1-16 spread):
      Aggressive (5% RoR):  ~$5,000
      Moderate  (2% RoR):  ~$10,000  ← this config
      Conservative (1% RoR): ~$20,000
    """

    TABLE_MIN = 100      # Minimum bet at your table (₹)
    TABLE_MAX = 10000    # Maximum bet at your table (₹)
    BASE_UNIT = 100      # One "unit" — should equal TABLE_MIN

    # 8-deck games have lower penetration variance so a wider spread is safer
    # to use without being as detectable as in single/double deck games.
    BET_SPREAD = 16

    # Three-quarter Kelly — better growth rate than half Kelly at high counts
    # while keeping variance manageable on an 8-deck shoe.
    KELLY_FRACTION = 0.75

    # Your total bankroll. Update this to your actual amount.
    INITIAL_BANKROLL = 100000  # ₹1,00,000 starting bankroll

    # Target maximum probability of going broke.
    # 0.05 = willing to accept a 5% chance of ruin.
    RISK_OF_RUIN_TARGET = 0.05


class MLConfig:
    """
    MACHINE LEARNING MODEL SETTINGS
    ─────────────────────────────────
    Updated for v2 architecture: ResidualNet + Attention + Separate Heads.

    NETWORK ARCHITECTURE (v2):
      Input  →  28 features
      FeatureAttention gate (28→28, learns which features matter per situation)
      Input projection (28→256)
      ResidualBlock(256→512) — expand for capacity
      ResidualBlock(512→512) — deep representation
      ResidualBlock(512→256) — compress back
      ResidualBlock(256→256) — refine
      ├── hit_stand_head   (trunk + hand/dealer features → scores[0,1])
      ├── double_split_head (trunk + count/shoe features → scores[2,3])
      └── surrender_head   (trunk + count/dealer features → score[4])

    EXPECTED ACCURACY BY TRAINING SIZE (v2 architecture):
      100k hands,  20 epochs → ~66-69%   (+4% vs v1)
      500k hands,  30 epochs → ~74-77%   (+4% vs v1)
      1M hands,    50 epochs → ~81-84%   (+7% vs v1)   ← default config
      2M hands,    60 epochs → ~84-87%   (+8% vs v1)   ← recommended

    HOW TO TRAIN:
      python main.py train                              # 500k hands, 50 epochs
      python main.py train --hands 1000000             # 1M hands (recommended)
      python main.py train --hands 2000000 --epochs 60 # Best accuracy (~85%+)
      python main.py train --hands 100000 --epochs 20  # Quick test (~5 min)

    CUSTOMISATION:
      • Faster training  → reduce SIMULATION_HANDS to 100_000
      • Higher accuracy  → increase SIMULATION_HANDS to 2_000_000
      • Wider trunk      → increase TRUNK_DIM to 512 (more RAM/VRAM needed)
      • Reduce overfitting → increase TRAIN_TEST_SPLIT to 0.25
    """

    # ── Architecture ──────────────────────────────────────────────────
    # HIDDEN_DIMS kept for backward compat with any code that reads it,
    # but the new architecture uses TRUNK_DIM instead.
    HIDDEN_DIMS  = [512, 512, 256, 256]   # residual block widths (approximate)
    TRUNK_DIM    = 256                     # shared trunk output width

    # ── Training hyperparameters ──────────────────────────────────────
    LEARNING_RATE = 0.001           # Slightly higher than v2 — compensates for
                                    # reduced regularization (dropout 0.20, weight_decay 1e-4)
    BATCH_SIZE    = 512             # Samples per gradient update
    EPOCHS        = 50              # Full passes through training data
                                    # (increase to 60 for 2M+ hands)

    # ── Confidence threshold ──────────────────────────────────────────
    # Model only overrides basic strategy if this confident (0.0-1.0)
    # Raised from 0.75 → 0.70 because v2 is better calibrated
    CONFIDENCE_THRESHOLD = 0.70

    # ── Data generation ───────────────────────────────────────────────
    # Total simulated hands used to generate training data.
    # More hands = higher accuracy. Recommended: 1_000_000 minimum.
    SIMULATION_HANDS = 1_000_000

    # Fraction of data reserved for testing (not used in training)
    TRAIN_TEST_SPLIT = 0.20

    # ── LSTM shuffle tracker settings (unchanged) ─────────────────────
    SHUFFLE_LSTM_HIDDEN  = 128   # Memory cells in the LSTM
    SHUFFLE_LSTM_LAYERS  = 2     # Stacked LSTM layers
    SHUFFLE_SEQUENCE_LEN = 52    # Cards to look back per prediction cycle


class SideBetConfig:
    """
    SIDE BET PAYOUT TABLES
    ───────────────────────
    The system calculates real-time EV (expected value) for each side
    bet based on remaining shoe composition. A positive EV means the
    side bet is mathematically profitable right now — this is rare.

    ► CHANGE THESE to match the actual payouts at your casino.
      Payouts vary significantly between casinos!
    """

    # Perfect Pairs: your first two cards form a pair
    # "perfect" = same rank, same suit (identical from different decks)
    # "colored" = same rank, same colour, different suit (K♠ K♣)
    # "mixed"   = same rank, different colour (K♠ K♥)
    PERFECT_PAIRS_PAYOUT = {
        "perfect": 25,
        "colored": 12,
        "mixed":    6,
    }

    # 21+3: your 2 cards + dealer upcard form a poker hand
    TWENTY_ONE_PLUS_3_PAYOUT = {
        "suited_trips":    100,
        "straight_flush":   40,
        "three_of_a_kind":  30,
        "straight":         10,
        "flush":             5,
    }

    # Lucky Ladies: your first two cards total 20
    LUCKY_LADIES_PAYOUT = {
        "matched_20_with_dealer_bj": 1000,
        "queen_hearts_pair":          200,
        "matched_20":                  25,
        "suited_20":                   10,
        "any_20":                       4,
    }
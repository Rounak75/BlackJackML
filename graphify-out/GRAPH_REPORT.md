# Graph Report - .  (2026-04-21)

## Corpus Check
- 117 files · ~321,219 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1338 nodes · 5414 edges · 60 communities detected
- Extraction: 31% EXTRACTED · 69% INFERRED · 0% AMBIGUOUS · INFERRED: 3735 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Card Counting & Betting Engine|Card Counting & Betting Engine]]
- [[_COMMUNITY_Wonging & Zone Config UI|Wonging & Zone Config UI]]
- [[_COMMUNITY_Application Config & Entry Point|Application Config & Entry Point]]
- [[_COMMUNITY_Flask Server & Debug Layer|Flask Server & Debug Layer]]
- [[_COMMUNITY_Compiled JS Bundle|Compiled JS Bundle]]
- [[_COMMUNITY_Strategy & Deviation Engine|Strategy & Deviation Engine]]
- [[_COMMUNITY_Blackjack Core Modules|Blackjack Core Modules]]
- [[_COMMUNITY_Live Overlay System|Live Overlay System]]
- [[_COMMUNITY_Bet Recommendation Logic|Bet Recommendation Logic]]
- [[_COMMUNITY_Card & Counter Core|Card & Counter Core]]
- [[_COMMUNITY_Configuration Schema|Configuration Schema]]
- [[_COMMUNITY_CV Detection Pipeline|CV Detection Pipeline]]
- [[_COMMUNITY_Documentation & README|Documentation & README]]
- [[_COMMUNITY_React App Shell & Debug UI|React App Shell & Debug UI]]
- [[_COMMUNITY_Action Panel & Utilities|Action Panel & Utilities]]
- [[_COMMUNITY_Deal Order Engine|Deal Order Engine]]
- [[_COMMUNITY_Bet Spread & Session Stats|Bet Spread & Session Stats]]
- [[_COMMUNITY_Counting System Audit|Counting System Audit]]
- [[_COMMUNITY_Hand Display Component|Hand Display Component]]
- [[_COMMUNITY_Split Hand Panel|Split Hand Panel]]
- [[_COMMUNITY_Stop Alerts Component|Stop Alerts Component]]
- [[_COMMUNITY_Seen Cards Panel|Seen Cards Panel]]
- [[_COMMUNITY_Widget Component|Widget Component]]
- [[_COMMUNITY_Accordion Panel|Accordion Panel]]
- [[_COMMUNITY_Analytics Panel|Analytics Panel]]
- [[_COMMUNITY_Betting Panel|Betting Panel]]
- [[_COMMUNITY_Card Grid|Card Grid]]
- [[_COMMUNITY_Casino Risk Meter|Casino Risk Meter]]
- [[_COMMUNITY_Center Toolbar|Center Toolbar]]
- [[_COMMUNITY_Composition Alerts|Composition Alerts]]
- [[_COMMUNITY_Confirmation Panel|Confirmation Panel]]
- [[_COMMUNITY_Count History|Count History]]
- [[_COMMUNITY_Drag Layout Editor|Drag Layout Editor]]
- [[_COMMUNITY_Edge Meter|Edge Meter]]
- [[_COMMUNITY_Illustrious 18 Panel|Illustrious 18 Panel]]
- [[_COMMUNITY_Multi-System Panel|Multi-System Panel]]
- [[_COMMUNITY_Outcome Strip|Outcome Strip]]
- [[_COMMUNITY_Shoe Panel|Shoe Panel]]
- [[_COMMUNITY_Shuffle Tracker UI|Shuffle Tracker UI]]
- [[_COMMUNITY_Side Bet Panel|Side Bet Panel]]
- [[_COMMUNITY_Side Count Panel|Side Count Panel]]
- [[_COMMUNITY_Strategy Reference Table|Strategy Reference Table]]
- [[_COMMUNITY_App State & Routing|App State & Routing]]
- [[_COMMUNITY_Card Shoe Internals|Card Shoe Internals]]
- [[_COMMUNITY_Lint & Test Results|Lint & Test Results]]
- [[_COMMUNITY_Build Script (Windows)|Build Script (Windows)]]
- [[_COMMUNITY_File Watch Script|File Watch Script]]
- [[_COMMUNITY_App Package Init|App Package Init]]
- [[_COMMUNITY_TypeScript Declarations|TypeScript Declarations]]
- [[_COMMUNITY_Frontend Constants|Frontend Constants]]
- [[_COMMUNITY_Card Rationale (Shoe)|Card Rationale (Shoe)]]
- [[_COMMUNITY_Card Rationale (Deck)|Card Rationale (Deck)]]
- [[_COMMUNITY_Card Rationale (Values)|Card Rationale (Values)]]
- [[_COMMUNITY_Card Rationale (Suits)|Card Rationale (Suits)]]
- [[_COMMUNITY_Build Hook Fixer|Build Hook Fixer]]
- [[_COMMUNITY_JS Minifier|JS Minifier]]
- [[_COMMUNITY_Build Source Constants|Build Source Constants]]
- [[_COMMUNITY_Split Hand Feature|Split Hand Feature]]
- [[_COMMUNITY_Multi-Currency Support|Multi-Currency Support]]
- [[_COMMUNITY_Tailwind Theme Config|Tailwind Theme Config]]

## God Nodes (most connected - your core abstractions)
1. `Card` - 260 edges
2. `CardCounter` - 238 edges
3. `GameConfig` - 224 edges
4. `BettingConfig` - 211 edges
5. `Shoe` - 211 edges
6. `Hand` - 204 edges
7. `BettingEngine` - 203 edges
8. `BasicStrategy` - 199 edges
9. `Action` - 197 edges
10. `DeviationEngine` - 185 edges

## Surprising Connections (you probably didn't know these)
- `Capture enough state to restore this tracker later via restore().         Called` --uses--> `MLConfig`  [INFERRED]
  ml_model\shuffle_tracker.py → config.py
- `Restore state from a snapshot produced by snapshot().` --uses--> `MLConfig`  [INFERRED]
  ml_model\shuffle_tracker.py → config.py
- `humanDelay()` --calls--> `Round`  [INFERRED]
  app\static\bundle.min.js → blackjack\game.py
- `getInfoVisibility()` --calls--> `Round`  [INFERRED]
  app\static\bundle.min.js → blackjack\game.py
- `ZoneConfigPanel()` --calls--> `Round`  [INFERRED]
  app\static\bundle.min.js → blackjack\game.py

## Hyperedges (group relationships)
- **YOLO Card Detection Training Pipeline** — readme_yolov8_detector, readme_synthetic_dataset, labels_jpg_distribution, train_batch0_samples, requirements_yolo [INFERRED 0.85]
- **Blackjack Strategy Decision System** — readme_basic_strategy, readme_card_counting_systems, readme_illustrious18_fab4, readme_kelly_criterion, readme_neural_net_strategy [INFERRED 0.90]
- **Web Dashboard Technology Stack** — readme_react_dashboard, index_html_dashboard, index_html_tailwind_config, requirements_web_server [INFERRED 0.85]

## Communities

### Community 0 - "Card Counting & Betting Engine"
Cohesion: 0.08
Nodes (228): ╔══════════════════════════════════════════════════════════════════════════════╗, # NOTE: This implementation does NOT use IRC (starts at 0)., Create a Card from a count_key integer., Create a Card from a Rank enum., BettingEngine, True when either stop threshold has been crossed., STOP_LOSS', 'STOP_WIN', or None., Advanced betting strategy engine combining count-based spreading     with Kelly (+220 more)

### Community 1 - "Wonging & Zone Config UI"
Cohesion: 0.02
Nodes (41): actionClass(), ActionPanel(), _activateSafeMode(), App(), barColor(), BetSpreadHelper(), buildExplanation(), CountBar() (+33 more)

### Community 2 - "Application Config & Entry Point"
Cohesion: 0.03
Nodes (72): MLConfig, MACHINE LEARNING MODEL SETTINGS     ─────────────────────────────────     Update, is_available(), main(), ╔══════════════════════════════════════════════════════════════════════╗ ║, Parse command-line arguments and dispatch to the correct module.      argparse, BlackjackNet, DecisionHead (+64 more)

### Community 3 - "Flask Server & Debug Layer"
Cohesion: 0.03
Nodes (76): Count remaining cards by rank value (for ML features)., debug_timed(), DebugLogger, ╔══════════════════════════════════════════════════════════════════════════════╗, Log incoming socket event. Returns start timestamp for timing., Log outgoing response with elapsed time., D1: Trace split hand lifecycle events.          event_type values:, D2: Cross-validate running_count against a manual re-sum of _card_log. (+68 more)

### Community 4 - "Compiled JS Bundle"
Cohesion: 0.02
Nodes (29): actionClass(), ActionPanel(), _activateSafeMode(), App(), barColor(), BetSpreadHelper(), buildExplanation(), CountBar() (+21 more)

### Community 5 - "Strategy & Deviation Engine"
Cohesion: 0.06
Nodes (12): Check if late surrender is optimal., Get pair splitting action., Resolve chart action codes (D, Ds, SUR) to actual actions,         respecting w, Get human-readable action name., hand(), TestBasicStrategy, TestDeviations, TestFeatureScenarios (+4 more)

### Community 6 - "Blackjack Core Modules"
Cohesion: 0.03
Nodes (15): ╔══════════════════════════════════════════════════════════════════════════════╗, ╔══════════════════════════════════════════════════════════════════════════════╗, ace_adjusted_tc(), ace_adjustment(), ╔══════════════════════════════════════════════════════════════════════════════╗, Deviation, A single strategy deviation triggered by true count., Args:             hand_type: "hard", "soft", or "pair"             hand_value: (+7 more)

### Community 7 - "Live Overlay System"
Cohesion: 0.04
Nodes (20): CountBar(), countColor(), draw(), drawDetections(), fetchWindows(), handleOpen(), humanDelay(), onReconnect() (+12 more)

### Community 8 - "Bet Recommendation Logic"
Cohesion: 0.05
Nodes (15): Return 'loss', 'win', or None based on current session_profit., Calculate the optimal bet based on true count and advantage.          Uses a c, Bet spread based on true count.          TC <= 0: 1 unit (minimum)         TC, Kelly Criterion optimal bet sizing.          Full Kelly: f* = advantage / odds, Should we enter the table (back-counting)?, Should we leave the table?, Record a hand result for tracking., Estimate risk of ruin using the formula:         RoR = ((1 - edge) / (1 + edge) (+7 more)

### Community 9 - "Card & Counter Core"
Cohesion: 0.1
Nodes (12): create(), CardCounter, Process a single dealt card., Process multiple cards at once., Insurance is +EV at effective true count >= +3.         Uses effective_tc so KO, Reset for a new shoe.         FIX C3: KO resets to IRC (Initial Running Count),, Estimate remaining card composition based on dealt cards.         Returns proba, Get current count state as a feature vector for ML models.         Returns: [ru (+4 more)

### Community 10 - "Configuration Schema"
Cohesion: 0.08
Nodes (25): ╔══════════════════════════════════════════════════════════════════════╗ ║, SIDE BET PAYOUT TABLES     ───────────────────────     The system calculates rea, SideBetConfig, values(), apply_perspective(), apply_rotation(), apply_shadow(), compose_scene() (+17 more)

### Community 11 - "CV Detection Pipeline"
Cohesion: 0.09
Nodes (20): detect_cards(), detect_from_base64(), _detect_ocr(), _detect_yolo(), _find_card_regions(), _is_red(), _load_yolo(), _ocr_rank() (+12 more)

### Community 12 - "Documentation & README"
Cohesion: 0.08
Nodes (28): Loading Diagnostics Page, Dashboard HTML Entry Point, YOLO Training Label Distribution Charts, Perfect Basic Strategy, BlackjackML Project, Card Counting Systems (Hi-Lo, KO, Omega II, Zen, Wong Halves, Uston APC), 3-Mode Card Scanner (Manual/Screenshot/Live), Early Stopping Training Strategy (+20 more)

### Community 13 - "React App Shell & Debug UI"
Cohesion: 0.16
Nodes (17): App(), mountApp(), _activateSafeMode(), DebugErrorBoundary, DebugPanel(), _fmtVal(), isSafeMode(), _levelName() (+9 more)

### Community 14 - "Action Panel & Utilities"
Cohesion: 0.2
Nodes (11): ActionPanel(), CountBlock(), InfoTooltip(), TopBar(), actionClass(), buildExplanation(), cellClass(), countClass() (+3 more)

### Community 15 - "Deal Order Engine"
Cohesion: 0.3
Nodes (10): countVal(), getBetAction(), getDealDescription(), getInfoVisibility(), getNextLabel(), getNextShort(), getPositionEdge(), initSeatCards() (+2 more)

### Community 16 - "Bet Spread & Session Stats"
Cohesion: 0.24
Nodes (4): barColor(), BetSpreadHelper(), fmtMoney(), SessionStats()

### Community 17 - "Counting System Audit"
Cohesion: 0.29
Nodes (3): c(), _CountKey, crank()

### Community 18 - "Hand Display Component"
Cohesion: 0.6
Nodes (3): HandDisplay(), MiniCard(), MiniCardBack()

### Community 19 - "Split Hand Panel"
Cohesion: 0.6
Nodes (3): SplitHandCard(), SplitHandPanel(), SplitHandZone()

### Community 20 - "Stop Alerts Component"
Cohesion: 0.6
Nodes (3): StopAlerts(), StopAlertsConfig(), _StopEditForm()

### Community 21 - "Seen Cards Panel"
Cohesion: 0.67
Nodes (2): SeenCardsPanel(), SeenMiniCard()

### Community 22 - "Widget Component"
Cohesion: 0.67
Nodes (2): KV(), Widget()

### Community 23 - "Accordion Panel"
Cohesion: 0.67
Nodes (1): AccordionPanel()

### Community 24 - "Analytics Panel"
Cohesion: 0.67
Nodes (1): AnalyticsPanel()

### Community 25 - "Betting Panel"
Cohesion: 0.67
Nodes (1): BettingPanel()

### Community 26 - "Card Grid"
Cohesion: 0.67
Nodes (1): CardGrid()

### Community 27 - "Casino Risk Meter"
Cohesion: 0.67
Nodes (1): CasinoRiskMeter()

### Community 28 - "Center Toolbar"
Cohesion: 0.67
Nodes (1): CenterToolbar()

### Community 29 - "Composition Alerts"
Cohesion: 0.67
Nodes (1): CompDepAlert()

### Community 30 - "Confirmation Panel"
Cohesion: 0.67
Nodes (1): ConfirmationPanel()

### Community 31 - "Count History"
Cohesion: 0.67
Nodes (1): CountHistoryPanel()

### Community 32 - "Drag Layout Editor"
Cohesion: 0.67
Nodes (1): DragLayoutEditor()

### Community 33 - "Edge Meter"
Cohesion: 0.67
Nodes (1): EdgeMeter()

### Community 34 - "Illustrious 18 Panel"
Cohesion: 0.67
Nodes (1): I18Panel()

### Community 35 - "Multi-System Panel"
Cohesion: 0.67
Nodes (1): MultiSystemPanel()

### Community 36 - "Outcome Strip"
Cohesion: 0.67
Nodes (1): OutcomeStrip()

### Community 37 - "Shoe Panel"
Cohesion: 0.67
Nodes (1): ShoePanel()

### Community 38 - "Shuffle Tracker UI"
Cohesion: 0.67
Nodes (1): ShuffleTrackerPanel()

### Community 39 - "Side Bet Panel"
Cohesion: 0.67
Nodes (1): SideBetPanel()

### Community 40 - "Side Count Panel"
Cohesion: 0.67
Nodes (1): SideCountPanel()

### Community 41 - "Strategy Reference Table"
Cohesion: 0.67
Nodes (1): StrategyRefTable()

### Community 42 - "App State & Routing"
Cohesion: 1.0
Nodes (2): handler(), setTarget()

### Community 43 - "Card Shoe Internals"
Cohesion: 1.0
Nodes (1): Count dealt cards by rank value.

### Community 44 - "Lint & Test Results"
Cohesion: 1.0
Nodes (2): Flake8 Lint Results (10 warnings), Pytest Results (128 passed)

### Community 45 - "Build Script (Windows)"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "File Watch Script"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "App Package Init"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "TypeScript Declarations"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Frontend Constants"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Card Rationale (Shoe)"
Cohesion: 1.0
Nodes (1): Blackjack numeric value (face cards = 10, ace = 11).

### Community 51 - "Card Rationale (Deck)"
Cohesion: 1.0
Nodes (1): Value used for counting system lookups (10 for faces, 11 for ace).

### Community 52 - "Card Rationale (Values)"
Cohesion: 1.0
Nodes (1): Current shoe penetration as a percentage.

### Community 53 - "Card Rationale (Suits)"
Cohesion: 1.0
Nodes (1): Whether the cut card has been reached.

### Community 54 - "Build Hook Fixer"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "JS Minifier"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Build Source Constants"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Split Hand Feature"
Cohesion: 1.0
Nodes (1): Split Hand Management

### Community 58 - "Multi-Currency Support"
Cohesion: 1.0
Nodes (1): Multi-Currency Support (20 fiat + 10 crypto)

### Community 59 - "Tailwind Theme Config"
Cohesion: 1.0
Nodes (1): Tailwind CSS Theme Configuration

## Knowledge Gaps
- **72 isolated node(s):** `╔══════════════════════════════════════════════════════════════════════╗ ║`, `BLACKJACK TABLE RULES     ─────────────────────     Set these to match the speci`, `CARD COUNTING SYSTEMS     ─────────────────────     Card counting assigns a tag`, `BET SIZING AND BANKROLL MANAGEMENT     ────────────────────────────────────`, `MACHINE LEARNING MODEL SETTINGS     ─────────────────────────────────     Update` (+67 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Card Shoe Internals`** (2 nodes): `Count dealt cards by rank value.`, `.dealt_by_rank()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Lint & Test Results`** (2 nodes): `Flake8 Lint Results (10 warnings)`, `Pytest Results (128 passed)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Build Script (Windows)`** (1 nodes): `build.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Watch Script`** (1 nodes): `watch.ps1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Package Init`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript Declarations`** (1 nodes): `globals.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Frontend Constants`** (1 nodes): `constants.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card Rationale (Shoe)`** (1 nodes): `Blackjack numeric value (face cards = 10, ace = 11).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card Rationale (Deck)`** (1 nodes): `Value used for counting system lookups (10 for faces, 11 for ace).`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card Rationale (Values)`** (1 nodes): `Current shoe penetration as a percentage.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card Rationale (Suits)`** (1 nodes): `Whether the cut card has been reached.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Build Hook Fixer`** (1 nodes): `fix_hooks.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `JS Minifier`** (1 nodes): `minify.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Build Source Constants`** (1 nodes): `constants.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Split Hand Feature`** (1 nodes): `Split Hand Management`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Multi-Currency Support`** (1 nodes): `Multi-Currency Support (20 fiat + 10 crypto)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tailwind Theme Config`** (1 nodes): `Tailwind CSS Theme Configuration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Round` connect `Wonging & Zone Config UI` to `Card Counting & Betting Engine`, `Application Config & Entry Point`, `Flask Server & Debug Layer`, `Compiled JS Bundle`, `Strategy & Deviation Engine`, `Blackjack Core Modules`, `Live Overlay System`, `Bet Recommendation Logic`, `Card & Counter Core`, `Configuration Schema`, `CV Detection Pipeline`, `React App Shell & Debug UI`, `Deal Order Engine`, `Bet Spread & Session Stats`?**
  _High betweenness centrality (0.358) - this node is a cross-community bridge._
- **Why does `Card` connect `Card Counting & Betting Engine` to `Wonging & Zone Config UI`, `Application Config & Entry Point`, `Flask Server & Debug Layer`, `Strategy & Deviation Engine`, `Blackjack Core Modules`, `Live Overlay System`, `Bet Recommendation Logic`, `Card & Counter Core`, `Configuration Schema`, `Counting System Audit`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `MLConfig` connect `Application Config & Entry Point` to `Card Counting & Betting Engine`, `Wonging & Zone Config UI`, `Configuration Schema`, `Flask Server & Debug Layer`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 253 inferred relationships involving `Card` (e.g. with `LiveGameEngine` and `RegionSelector`) actually correct?**
  _`Card` has 253 INFERRED edges - model-reasoned connections that need verification._
- **Are the 225 inferred relationships involving `CardCounter` (e.g. with `LiveGameEngine` and `RegionSelector`) actually correct?**
  _`CardCounter` has 225 INFERRED edges - model-reasoned connections that need verification._
- **Are the 222 inferred relationships involving `GameConfig` (e.g. with `LiveGameEngine` and `RegionSelector`) actually correct?**
  _`GameConfig` has 222 INFERRED edges - model-reasoned connections that need verification._
- **Are the 209 inferred relationships involving `BettingConfig` (e.g. with `LiveGameEngine` and `RegionSelector`) actually correct?**
  _`BettingConfig` has 209 INFERRED edges - model-reasoned connections that need verification._
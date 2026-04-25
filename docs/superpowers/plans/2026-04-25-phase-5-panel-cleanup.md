# Phase 5 — Panel Cleanup & Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the three pending Phase 5 changes — gate `BettingPanel`'s result row, merge live-scan widgets into a single Scanner tab, delete the unused `AccordionPanel`.

**Architecture:** Frontend-only React/JSX edits to existing components, plus one new composition component (`ScannerHub`). No backend, socket, or hotkey changes. The existing four scanner-related panels (`LiveOverlayPanel`, `ZoneConfigPanel`, `ConfirmationPanel`, `WongPanel`) are mounted unchanged inside `ScannerHub`.

**Tech Stack:** React 18 (JSX in `App.jsx`, plain JS w/ `React.createElement` in component files), Tailwind via CDN, custom build script (`build.sh`/`build.ps1`) that compiles JSX with `tsc` and concatenates components in a fixed load order into `app/static/bundle.min.js`. No unit-test framework on the frontend — verification is the build smoke test plus manual UI check.

**Spec:** `docs/superpowers/specs/2026-04-25-phase-5-panel-cleanup-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/static/components/BettingPanel.js` | Modify (lines ~587–650) | Gate result row on `pCards === 0`. |
| `app/static/components/ScannerHub.js` | Create (~120 LOC) | Compose `LiveOverlayPanel` + 3 collapsible sub-sections. |
| `app/static/components/App.jsx` | Modify (right-column section) | Drop top-of-right-column scan widgets; swap Scanner tab body. |
| `app/static/components/AccordionPanel.js` | Delete | Unused. |
| `build.sh` | Modify | Add `ScannerHub`, drop `AccordionPanel`, update smoke list. |
| `build.ps1` | Modify | Same. |
| `app/static/bundle.min.js` | Rebuilt | Output. |

---

## Task 1: Gate `BettingPanel` result row on `pCards === 0`

**Files:**
- Modify: `app/static/components/BettingPanel.js:587-650`

**Why:** post-deal, `OutcomeStrip` (below the CardGrid) is the canonical result surface. The mid-hand `'Record Result:'` branch in BettingPanel is duplicate and confusing. Pre-hand the buttons stay as a "log hand without dealing" fallback.

- [ ] **Step 1: Read current state of the result-row block**

The block to gate currently lives at lines 587–650 of `app/static/components/BettingPanel.js`. It opens with the comment `MANUAL RESULT BUTTONS — always available as override` and ends with the `</div>` that closes the outer wrapper just before `</Widget>`. Note that `pCards` is already in scope (line 92: `const pCards = playerHand?.cards?.length ?? 0;`) and `phase === 'pre'` (line 93).

- [ ] **Step 2: Wrap the block in a `pCards === 0` conditional**

Replace the existing block (everything from the opening comment `{/* ═══════════════════════════════════════════════════` and the `MANUAL RESULT BUTTONS` comment, through the closing `</div>` immediately before `</Widget>`) with the gated version below. The mid-hand label branch is removed since the block no longer renders mid-hand.

```jsx
      {/* ═══════════════════════════════════════════════════
          PRE-HAND MANUAL OVERRIDE — only visible before any cards
          are dealt. Once a hand starts, OutcomeStrip below the
          CardGrid is the canonical result surface.
          ═══════════════════════════════════════════════════ */}
      {pCards === 0 && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: 8,
          marginTop: 10,
        }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-widest font-display font-bold" style={{ color: '#ccdaec' }}>
              Manual override:
            </div>
            <div className="text-[9px]" style={{ color: '#ccdaec' }}>
              Log a result without dealing cards
            </div>
          </div>
          <div className="flex gap-2">
            {[
              { label: '🏆 WIN',  result: 'win',       color: '#44e882', bg: 'rgba(68,232,130,0.1)',  border: 'rgba(68,232,130,0.4)' },
              { label: '🤝 PUSH', result: 'push',      color: '#6aafff', bg: 'rgba(106,175,255,0.1)', border: 'rgba(106,175,255,0.4)' },
              { label: '💀 LOSS', result: 'loss',      color: '#ff5c5c', bg: 'rgba(255,92,92,0.1)',   border: 'rgba(255,92,92,0.4)' },
              { label: '🏳 SURR', result: 'surrender', color: '#ff9a20', bg: 'rgba(255,154,32,0.1)',  border: 'rgba(255,154,32,0.4)' },
            ].map(({ label, result, color, bg, border }) => (
              <button
                key={result}
                aria-label={`Record hand result as ${result}`}
                onClick={() => {
                  let profit;
                  if (result === 'win') profit = effectiveBet;
                  else if (result === 'push') profit = 0;
                  else if (result === 'loss') profit = -effectiveBet;
                  else if (result === 'surrender') profit = -(activeBet * 0.5);
                  if (tookInsurance && insurance?.available) {
                    const halfBet = activeBet * 0.5;
                    const dealerBj = dealerHand?.is_blackjack;
                    profit += dealerBj ? halfBet * 2 : -halfBet;
                  }
                  onRecordResult(result === 'surrender' ? 'loss' : result, effectiveBet, profit);
                }}
                className="flex-1 rounded-lg py-2 text-[11px] font-mono font-bold transition-all"
                style={{
                  color, background: bg,
                  border: `1.5px solid ${border}`,
                  fontSize: 11,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = bg.replace('0.1', '0.2'); }}
                onMouseLeave={e => { e.currentTarget.style.background = bg; }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Bet preview — compact */}
          <div className="mt-2 text-center text-[10px] font-mono" style={{ color: '#c8d4e8', lineHeight: 1.8 }}>
            <div>
              {cur.symbol}{fmtBet(activeBet)}
              {isDoubled && <span style={{ color: '#ffd447' }}> → ×2 {cur.symbol}{fmtBet(effectiveBet)}</span>}
              {' '}· win = <span style={{ color: '#44e882' }}>+{cur.symbol}{fmtBet(effectiveBet)}</span>
              {' '}· loss = <span style={{ color: '#ff5c5c' }}>-{cur.symbol}{fmtBet(effectiveBet)}</span>
            </div>
          </div>
        </div>
      )}
```

Removed elements:
- The mid-hand label switch (`phase === 'mid' ? 'Record Result:' : 'Manual override:'`) — only "Manual override:" remains.
- The `phase === 'mid'`-dependent padding/margin (always 8/10).
- The `phase === 'mid'`-dependent button font-size (always 11).
- The "Auto-resolves when outcome is known" hint — replaced with "Log a result without dealing cards" since this row is now exclusively a pre-hand fallback.

- [ ] **Step 3: Visually verify the JSX file still parses**

Run: `node -e "require('child_process').execSync('npx tsc --noEmit --jsx react app/static/components/BettingPanel.js', { stdio: 'inherit' })" 2>&1 | head -5`

(If tsc is not available globally, skip — the full build in Task 6 will catch any syntax error.)

- [ ] **Step 4: Commit**

```bash
git add app/static/components/BettingPanel.js
git commit -m "refactor: gate BettingPanel result row on pre-hand only

Removes the mid-hand 'Record Result:' duplicate path. OutcomeStrip is the
canonical result surface post-deal. The pre-hand 'Manual override' fallback
remains for logging hands without dealing cards.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Create `ScannerHub` component

**Files:**
- Create: `app/static/components/ScannerHub.js`

**Why:** Compose the four scanner-related panels into a single tab body so the right column's top region stays identical across scan modes.

- [ ] **Step 1: Create `ScannerHub.js` with the full implementation**

Create `app/static/components/ScannerHub.js` with this exact content:

```js
/*
 * components/ScannerHub.js — Phase 5
 * ─────────────────────────────────────────────────────────
 * Single composition component for the TabStrip's "Scanner" tab.
 *
 * Mounts LiveOverlayPanel (which owns the mode toggle + per-mode
 * body) and three collapsible live-only sub-sections beneath it:
 *
 *   ▾ Zone Config       — visible in 'live' or 'screenshot'
 *   ▾ Confirmation      — visible in 'live' only
 *   ▾ Wonging           — visible in 'live' only
 *
 * Sub-section open/closed state persists per-section in
 * localStorage under bjml_scanner_{zone|conf|wong}_open.
 *
 * Status dots beside each header signal panel state at a glance,
 * so the user does not need to expand the section to know:
 *   Zone: jade  when zoneConfig.applied_session === true
 *   Conf: gold  when pendingCards.length > 0
 *   Wong: sapph when wonging.signal === 'SIT DOWN NOW'
 *
 * Props:
 *   socket             SocketIO connection
 *   count              count object from server
 *   scanMode           'manual' | 'screenshot' | 'live'
 *   onSetMode          fn(mode) — mode setter, owned by App.jsx
 *   onDealCard         fn(rank, suit, target?) — used by ScreenshotMode
 *   dealTarget         current deal target ('player'|'dealer'|'seen')
 *   zoneConfig         zone-config object from server state
 *   confirmationMode   bool — confirmation queue mode enabled
 *   pendingCards       array of pending card objects
 *   wonging            wonging state object
 */

function ScannerHub({
  socket, count,
  scanMode, onSetMode,
  onDealCard, dealTarget,
  zoneConfig,
  confirmationMode, pendingCards,
  wonging,
}) {
  var useState  = React.useState;
  var useEffect = React.useEffect;

  // ── Persistent collapsibles ──────────────────────────────────
  function loadOpen(key, def) {
    try {
      var raw = localStorage.getItem('bjml_scanner_' + key + '_open');
      if (raw === '1') return true;
      if (raw === '0') return false;
    } catch (e) {}
    return def;
  }
  function saveOpen(key, val) {
    try { localStorage.setItem('bjml_scanner_' + key + '_open', val ? '1' : '0'); } catch (e) {}
  }

  var _zone = useState(function () { return loadOpen('zone', false); });
  var zoneOpen    = _zone[0];
  var setZoneOpen = _zone[1];
  var _conf = useState(function () { return loadOpen('conf', false); });
  var confOpen    = _conf[0];
  var setConfOpen = _conf[1];
  var _wong = useState(function () { return loadOpen('wong', false); });
  var wongOpen    = _wong[0];
  var setWongOpen = _wong[1];

  useEffect(function () { saveOpen('zone', zoneOpen); }, [zoneOpen]);
  useEffect(function () { saveOpen('conf', confOpen); }, [confOpen]);
  useEffect(function () { saveOpen('wong', wongOpen); }, [wongOpen]);

  // ── Visibility rules ─────────────────────────────────────────
  var showZone = scanMode === 'live' || scanMode === 'screenshot';
  var showConf = scanMode === 'live';
  var showWong = scanMode === 'live';

  // ── Status dot signals ───────────────────────────────────────
  var IDLE = '#6b7f96';
  var zoneActive = !!(zoneConfig && (zoneConfig.applied_session === true));
  var confActive = !!(pendingCards && pendingCards.length > 0);
  var wongActive = !!(wonging && wonging.signal === 'SIT DOWN NOW');
  var zoneDot = zoneActive ? '#44e882' : IDLE;
  var confDot = confActive ? '#ffd447' : IDLE;
  var wongDot = wongActive ? '#6aafff' : IDLE;

  // ── Sub-section header ───────────────────────────────────────
  function header(label, open, onToggle, dotColor) {
    return React.createElement('button', {
      onClick: onToggle,
      'aria-expanded': open,
      style: {
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        cursor: 'pointer',
        color: '#ccdaec',
        fontSize: 11, fontWeight: 700,
        fontFamily: 'Syne, sans-serif',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transition: 'background 0.15s, border-color 0.15s',
      },
    },
      React.createElement('span', {
        style: {
          display: 'inline-block', width: 10, textAlign: 'center',
          fontSize: 12, color: '#94a7c4', flexShrink: 0,
        },
        'aria-hidden': 'true',
      }, open ? '▾' : '▸'),
      React.createElement('span', { style: { flex: 1, textAlign: 'left' } }, label),
      React.createElement('span', {
        'aria-hidden': 'true',
        style: {
          width: 6, height: 6, borderRadius: '50%',
          background: dotColor,
          boxShadow: dotColor === IDLE ? 'none' : '0 0 6px ' + dotColor,
          flexShrink: 0,
        }
      })
    );
  }

  function section(label, open, setOpen, dotColor, body) {
    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
      header(label, open, function () { setOpen(!open); }, dotColor),
      open ? React.createElement('div', { style: { paddingLeft: 2 } }, body) : null
    );
  }

  // ── Render ───────────────────────────────────────────────────
  var hasSubs = showZone || showConf || showWong;

  return React.createElement('div', {
    role: 'region', 'aria-label': 'Scanner',
    style: { display: 'flex', flexDirection: 'column', gap: 10 },
  },
    // LiveOverlayPanel — owns the mode toggle and per-mode body
    React.createElement(LiveOverlayPanel, {
      socket: socket,
      count: count,
      scanMode: scanMode,
      onSetMode: onSetMode,
      onDealCard: onDealCard,
      dealTarget: dealTarget,
    }),

    // Live/screenshot-only sub-sections
    hasSubs && React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
    },
      showZone && section('Zone Config', zoneOpen, setZoneOpen, zoneDot,
        React.createElement(ZoneConfigPanel, {
          socket: socket, zoneConfig: zoneConfig,
          onApply: function () {},
        })
      ),
      showConf && section('Confirmation', confOpen, setConfOpen, confDot,
        React.createElement(ConfirmationPanel, {
          socket: socket,
          confirmationMode: confirmationMode,
          pendingCards: pendingCards,
        })
      ),
      showWong && section('Wonging', wongOpen, setWongOpen, wongDot,
        React.createElement(WongPanel, {
          socket: socket, wonging: wonging, count: count,
        })
      )
    )
  );
}
```

Notes:
- `applied_session` is a heuristic field name that may not exist in every server payload. If the server doesn't surface it, the dot stays muted — the sub-section still works.
- The `onApply` prop on `ZoneConfigPanel` was used in App.jsx to surface a toast; inside ScannerHub it's a no-op. ZoneConfigPanel handles its own success feedback inline.
- All four child components keep their own `socket.on(...)` subscriptions intact, so live updates flow exactly as before.

- [ ] **Step 2: Commit**

```bash
git add app/static/components/ScannerHub.js
git commit -m "feat: add ScannerHub component for unified Scanner tab body

Composes LiveOverlayPanel + ZoneConfig + Confirmation + Wong into a
single body. Live-only sub-sections collapsible with per-section
localStorage persistence. No changes to underlying panels.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Wire `ScannerHub` in `App.jsx`; remove top-of-right-column scan widgets

**Files:**
- Modify: `app/static/components/App.jsx` (right-column section, ~lines 950–1020)

- [ ] **Step 1: Remove the three top-of-right-column conditional widgets**

In `App.jsx`, find this block at the start of the right column:

```jsx
        {/* ── PHASE 2: RIGHT COLUMN — fixed structure (2 slots + TabStrip) ─── */}
        <div className="panel-right flex flex-col gap-2.5">

          {/* Live-scan only fixed panels */}
          {(scanMode === 'live' || scanMode === 'screenshot') && (
            <ZoneConfigPanel
              socket={socketRef.current}
              zoneConfig={zoneConfig}
              onApply={(msg) => showToast(msg, 'info')}
            />
          )}
          {scanMode === 'live' && (
            <ConfirmationPanel
              socket={socketRef.current}
              confirmationMode={confirmationMode}
              pendingCards={pendingCards}
            />
          )}
          {scanMode === 'live' && (
            <WongPanel
              socket={socketRef.current}
              wonging={wongingData}
              count={gameState?.count}
            />
          )}

          {/* Slot 1 — Shoe & Edge */}
```

Replace the three live-scan conditional blocks (the `ZoneConfigPanel`, `ConfirmationPanel`, and `WongPanel` blocks) with a single comment so the right column starts directly at Slot 1:

```jsx
        {/* ── PHASE 2: RIGHT COLUMN — fixed structure (2 slots + TabStrip) ─── */}
        <div className="panel-right flex flex-col gap-2.5">

          {/* PHASE 5: live-scan widgets (Zone / Confirmation / Wong) moved
              into ScannerHub inside the TabStrip's Scanner tab. */}

          {/* Slot 1 — Shoe & Edge */}
```

- [ ] **Step 2: Replace the existing Scanner tab body with `<ScannerHub />`**

Find the Scanner tab inside the TabStrip's `_allTabs` array:

```jsx
              { key: 'scanner',   label: 'Scanner',
                render: () => <LiveOverlayPanel
                                socket={socketRef.current} count={gameState?.count}
                                scanMode={scanMode} onSetMode={setScanMode}
                                onDealCard={handleDealCardWrapped} dealTarget={dealTarget}
                              />
              },
```

Replace it with:

```jsx
              { key: 'scanner',   label: 'Scanner',
                render: () => <ScannerHub
                                socket={socketRef.current}
                                count={gameState?.count}
                                scanMode={scanMode}
                                onSetMode={setScanMode}
                                onDealCard={handleDealCardWrapped}
                                dealTarget={dealTarget}
                                zoneConfig={zoneConfig}
                                confirmationMode={confirmationMode}
                                pendingCards={pendingCards}
                                wonging={wongingData}
                              />
              },
```

- [ ] **Step 3: Commit**

```bash
git add app/static/components/App.jsx
git commit -m "refactor: route live-scan widgets through ScannerHub

The right column above the TabStrip is now identical regardless of
scanMode. ZoneConfig/Confirmation/Wong live inside the Scanner tab as
collapsible sub-sections.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Update `build.sh` and `build.ps1` for `ScannerHub` + drop `AccordionPanel`

**Files:**
- Modify: `build.sh` (load order list + smoke list)
- Modify: `build.ps1` (load order list + smoke list)

- [ ] **Step 1: Update `build.sh` load-order list**

In `build.sh`, find the `for f in DebugLayer constants utils Widget …` loop (around line 39). The current line includes `AccordionPanel BettingRampPanel BetSpreadHelper MultiSystemPanel` and ends with `OutcomeStrip DragLayoutEditor TabStrip DeviationBanner StatusBar HotkeyOverlay App`.

- Remove `AccordionPanel` from the list.
- Add `ScannerHub` immediately after `WongPanel`.

The new list block should read:

```bash
    for f in DebugLayer constants utils Widget TopBar ActionPanel CompDepAlert BettingPanel \
              SideBetPanel HandDisplay CardGrid StrategyRefTable \
              ShoePanel EdgeMeter SessionStats ShuffleTracker \
              CountHistory I18Panel AnalyticsPanel LiveOverlayPanel CenterToolBar \
              DealOrderEngine \
              SplitHandPanel SideCountPanel CasinoRiskMeter StopAlerts \
              SeenCardsPanel ZoneConfigPanel ConfirmationPanel WongPanel ScannerHub \
              BettingRampPanel BetSpreadHelper MultiSystemPanel \
              OutcomeStrip DragLayoutEditor TabStrip DeviationBanner StatusBar HotkeyOverlay App; do
```

- [ ] **Step 2: Update `build.sh` smoke-test list**

Find the smoke-test section (`for global in \`). Append a check for `ScannerHub`:

```bash
    'function App(' \
    'function mountApp(' \
    'function Widget(' \
    'function TopBar(' \
    'function ActionPanel(' \
    'function BettingPanel(' \
    'function HandDisplay(' \
    'function CardGrid(' \
    'function LiveOverlayPanel(' \
    'function ScannerHub(' \
    'function CompDepAlert(' \
    'function AnalyticsPanel(' \
    'var BettingRampPanel'; do
```

Insert `'function ScannerHub(' \` between `'function LiveOverlayPanel(' \` and `'function CompDepAlert(' \`.

- [ ] **Step 3: Update `build.ps1` to match**

Open `build.ps1`. There is an array variable holding the same load order (look for `LiveOverlayPanel`, `WongPanel`, `AccordionPanel`). Apply the same two changes:
- Remove `'AccordionPanel'`.
- Insert `'ScannerHub'` after `'WongPanel'`.

If `build.ps1` also has a smoke-test list, insert `'function ScannerHub('` after `'function LiveOverlayPanel('`. (If it has no smoke list, leave alone — only `build.sh` enforces it.)

- [ ] **Step 4: Commit**

```bash
git add build.sh build.ps1
git commit -m "build: register ScannerHub, drop AccordionPanel

Adds ScannerHub to the bundle load order and smoke-test global list;
removes AccordionPanel which is no longer imported by any component.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Delete `AccordionPanel.js`

**Files:**
- Delete: `app/static/components/AccordionPanel.js`

- [ ] **Step 1: Verify no imports remain**

```bash
cd "C:/Users/Rouna/Downloads/MLModel/Model1"
grep -rn "AccordionPanel" app/static/components/ --include='*.js' --include='*.jsx' | grep -v "AccordionPanel.js:"
```

Expected: empty output (no usages outside the file itself).

If output is non-empty, stop and audit those callers — do NOT proceed with the deletion. Re-add the import in Task 4's build script if a real caller still exists.

- [ ] **Step 2: Delete the file**

```bash
git rm app/static/components/AccordionPanel.js
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor: delete unused AccordionPanel component

No imports remain after Phase 2 migrated the right column to TabStrip.
Git history retains the file if ever needed.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Build the bundle and run smoke + manual checks

**Files:**
- Modify: `app/static/bundle.min.js` (rebuilt artifact — committed)

- [ ] **Step 1: Run the build**

```bash
cd "C:/Users/Rouna/Downloads/MLModel/Model1"
bash build.sh 2>&1 | tail -30
```

Expected output ends with:
```
🔍  Syntax checking...
  ✅  Syntax OK
🧪  Smoke testing bundle...
  All required globals found
✅  Build complete → app/static/bundle.min.js
```

If syntax check fails: re-read the error, fix the offending source file, re-run. The most likely cause is a JSX typo in the App.jsx edits from Task 3.

If smoke test fails on `MISSING: function ScannerHub(`: confirm the load-order edit in Task 4 is correct (`ScannerHub` must appear after `WongPanel`).

- [ ] **Step 2: Manual verification — pre-hand BettingPanel**

```bash
python main.py web
```

Open `http://localhost:5000` in a browser.

| Check | Expected |
|---|---|
| Right after page load (no hand started) | BettingPanel shows the "Manual override:" row at the bottom with WIN/PUSH/LOSS/SURR buttons. |
| Click the rank `2` to open the suit picker, then `1` to deal 2♠ to player | BettingPanel "Manual override:" row disappears the moment the first card lands. |
| Press `N` (new hand) | "Manual override:" row reappears. |

- [ ] **Step 3: Manual verification — Scanner tab in each scan mode**

While the dashboard is open, click the **Scanner** tab in the right-column TabStrip.

| scanMode | Expected Scanner tab body |
|---|---|
| `manual` (default) | LiveOverlayPanel mode toggle + ManualHint. **No** sub-sections below. |
| `screenshot` (click via mode toggle) | Mode toggle + ScreenshotMode body. One sub-section header: "▸ Zone Config" with a status dot. Confirmation + Wong sub-sections do **not** appear. |
| `live` (click via mode toggle, requires backend support) | Mode toggle + LiveMode body. Three sub-section headers: Zone / Confirmation / Wonging. Each can be expanded; state persists across reload. |

| Right column above TabStrip | Identical in all three modes — only Edge & Shoe followed by Bet Reference. The old top-of-column ZoneConfig/Confirmation/Wong panels are gone. |

- [ ] **Step 4: Manual verification — collapsible persistence**

In live mode, expand the "Zone Config" section. Reload the page (F5). Switch to live mode again — Zone Config should still be expanded. Collapse it, reload — should still be collapsed. Repeat for Confirmation and Wonging.

- [ ] **Step 5: Manual verification — status dots**

| Trigger | Expected dot |
|---|---|
| Live mode active, no pending cards, no wong, no zone applied | All three dots muted (`#6b7f96`). |
| Confirmation queue has at least one pending card | Confirmation dot turns gold (`#ffd447`). |
| Wonging signal becomes `SIT DOWN NOW` | Wonging dot turns sapph blue (`#6aafff`). |
| Apply a zone preset | Zone dot turns jade (`#44e882`) — only if the server includes `applied_session` in the zone payload; otherwise stays muted (acceptable). |

- [ ] **Step 6: Regression — Layout Editor still works**

Press `Shift+L` to open the Layout Editor.

| Check | Expected |
|---|---|
| Left column reorder | Drag panels — order persists after Save. |
| Right tab reorder | Drag tab entries — TabStrip reflects the new order after Save. |
| Saved order survives reload | After save + reload, both orderings persist. |

- [ ] **Step 7: Commit the rebuilt bundle**

```bash
git add app/static/bundle.min.js
git commit -m "build: rebuild bundle for Phase 5

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 8: Final spec sweep**

Open `docs/superpowers/specs/2026-04-25-phase-5-panel-cleanup-design.md` and walk the "Verification" table. Confirm each row maps to a check you ran in Steps 2–6. If any item is unchecked, run it now.

---

## Self-review summary

| Spec section | Implemented in |
|---|---|
| 1. BettingPanel result-row gating | Task 1 |
| 2.1 ScannerHub component | Task 2 |
| 2.2 App.jsx changes | Task 3 |
| 2.3 Build script changes | Task 4 |
| 3. AccordionPanel deletion | Task 5 |
| Verification matrix | Task 6 |
| Risk register: bundle smoke test | Task 4 + Task 6 Step 1 |
| Risk register: muscle memory | Task 1 (only pre-hand renders the row) |
| Risk register: socket subscription order | Task 2 (children mount synchronously) |
| Risk register: localStorage namespace | Task 2 (uses `bjml_scanner_*`) |

No placeholders. Type names consistent (`ScannerHub`, `bjml_scanner_*_open`, `applied_session`, `signal === 'SIT DOWN NOW'`). All file paths absolute or repo-relative. Each task ends in a commit.

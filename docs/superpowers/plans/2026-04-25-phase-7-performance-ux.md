# Phase 7 — Performance UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut p95 render time on `state_update` to <50ms by eliminating wasted re-renders, manual DOM thrash, and dead-code load. Skip Phase 6 (visual hierarchy).

**Architecture:** Add a render-time perf probe to baseline & verify; introduce a `SocketContext` so the singleton socket can be consumed without re-render-triggering prop drilling; wrap each pure panel in `React.memo`; replace TopBar's manual `void offsetWidth` reflow with a React-key remount; add a global `prefers-reduced-motion` CSS guard; verify the floating TC HUD render path is fully gated when off; split `DebugLayer.js` so a tiny `ErrorBoundary.js` always ships and the rest is gated behind a `BJML_DEBUG=1` build flag.

**Tech Stack:** React 18 (UMD, non-module script bundle), Socket.IO client, plain CSS, bash + Node.js (`tsc`) build pipeline (`build.sh` / `build.ps1`), Python Flask backend.

---

## Background you must read before starting

Read these in this order — they encode invariants you can break otherwise:

1. **`CLAUDE.md`** (repo root) — note especially:
   - The bundle is concatenated in a *fixed* load order (see `build.sh` lines 40–48). Adding a new file requires updating that list.
   - The build runs a **smoke test** that checks for required globals (`function App(`, `class DebugErrorBoundary`, `var BettingRampPanel`, etc.). If you remove or rename one, the build fails. Update both lists together.
   - `bundle.min.js` is a build artefact — never edit by hand.
   - The bundle's hook-destructure rewrite (`const { useState } = React` → `var useState = React.useState`) is performed by `build.sh` on the concatenated output. Each component file may freely declare its own destructure.

2. **`app/static/components/App.jsx`** — root component, 1170 LOC. Pay attention to:
   - The single `socketRef` (line 115) and the `socket = io()` connection effect (line 130).
   - The `_panelRegistry` / `_leftKeys` / TabStrip composition for the right column (lines 660–1020).
   - The TC HUD render path at line 1086 (`{showFloatingHud && count && (...)}`).

3. **`app/static/components/DebugLayer.js`** — 1072 LOC. The first 200 lines are the `DebugController` + log buffer; later sections are `DebugUI`, `DebugNet`, `DebugState`, `DebugML`, `DebugPanel`, `DebugErrorBoundary`, safe mode. The `DebugErrorBoundary` (line 900) is wired into `mountApp()` in App.jsx — every Phase 7 build must keep some error boundary in scope.

4. **`app/static/components/TopBar.js:140-156`** — the `tc-flash` block that uses `void tcBlockRef.current.offsetWidth` to force a CSS reflow (Phase 7 Task 5 replaces this).

5. **`app/static/components/TabStrip.js`** — confirms inactive tab bodies are *unmounted* (only `active.render()` is called). Memoizing tab panels still helps when a tab IS active and App re-renders, but tab switches will continue to remount.

6. **`app/static/style.css`** — has 14+ `@keyframes` animations; the file currently has **no** `prefers-reduced-motion` query. Append it at the end (Phase 7 Task 6).

## Items consciously dropped from the original Phase 7 scope

- **`AccordionPanel: pass isVisible`** — `AccordionPanel.js` was deleted in Phase 5 (commit `334a7a0`). The replacement is `TabStrip`, which already only renders the active tab's body. No work needed.
- **"Drop floating TC HUD render path when toggle is off"** — already implemented at `App.jsx:1086`. Task 8 verifies and closes this item without code change.

## Memoization pattern (used by Tasks 4 and confirmed safe for the bundle)

The bundle is a **non-module script**. Top-level `function Foo(props) { ... }` declarations are var-scoped and reassignable in script mode. We use this pattern in every panel:

```js
function Foo(props) {
  // ...existing body unchanged...
}
// PHASE 7: memo wrap. Script-mode reassignment of the function decl
// keeps `function Foo(` intact for the build.sh smoke check, and the
// global identifier `Foo` now points at the memoized component.
if (typeof React !== 'undefined' && React.memo) {
  Foo = React.memo(Foo);
}
```

This **must not** be changed to `var Foo = React.memo(function Foo(...) { ... })` because the build's smoke test searches for `function Foo(` — a `var` decl will not match. Verify after each memoization task by running `bash build.sh` and confirming the smoke check passes.

> **Memo equality:** `React.memo` uses shallow `Object.is` on each prop. For panels that receive object props (`count`, `shoe`, `playerHand`, etc.), equality holds whenever the parent passes the same reference — which is the case here because App reads them straight off `gameState`. No `areEqual` callback is needed.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `app/static/components/perfProbe.js` | **Create** | Lightweight `React.Profiler` wrapper + global `__BJ_PERF` console API. ~100 LOC. |
| `app/static/components/ErrorBoundary.js` | **Create** | Extracted minimal error boundary. ~80 LOC. Always shipped. |
| `app/static/components/DebugLayer.js` | Modify | Remove `DebugErrorBoundary` (now lives in `ErrorBoundary.js`). The rest stays here, gated by build flag. |
| `app/static/components/App.jsx` | Modify | Add `SocketContext`; add `socket` state; wrap return in Provider; remove `socket={socketRef.current}` props at the call sites; wrap selected panels in perfProbe (debug builds only). |
| `app/static/components/ScannerHub.js` | Modify | `useContext(SocketContext)` instead of `props.socket`; drop the `socket` prop. |
| `app/static/components/LiveOverlayPanel.jsx` | Modify | `useContext(SocketContext)` in `LiveMode` and `WindowPicker`; drop `socket` prop pass-through. |
| `app/static/components/ZoneConfigPanel.js` | Modify | Same SocketContext switch. |
| `app/static/components/ConfirmationPanel.js` | Modify | Same. |
| `app/static/components/WongPanel.js` | Modify | Same. |
| `app/static/components/MultiSystemPanel.js` | Modify | Same. |
| `app/static/components/StopAlerts.js` | Modify | Same — `StopAlerts` and `StopAlertsConfig` both use `socket` prop today. |
| `app/static/components/TopBar.js` | Modify | Replace tc-flash `void offsetWidth` with state-driven `key` remount. Wrap in `React.memo`. |
| `app/static/components/EdgeMeter.js`, `ShoePanel.js`, `BettingRampPanel.js`, `BetSpreadHelper.js`, `I18Panel.js`, `SessionStats.js`, `SideBetPanel.js`, `AnalyticsPanel.js`, `ShuffleTracker.js`, `CasinoRiskMeter.js`, `CountHistory.js`, `MultiSystemPanel.js`, `StopAlerts.js`, `ScannerHub.js`, `BettingPanel.js`, `SideCountPanel.js`, `StrategyRefTable.js`, `ActionPanel.js`, `HandDisplay.js`, `CardGrid.js`, `OutcomeStrip.js`, `CenterToolBar.js`, `SeenCardsPanel.js`, `SplitHandPanel.js`, `DeviationBanner.js`, `StatusBar.js`, `DealOrderEngine.js` | Modify | Append the `if (React.memo) Foo = React.memo(Foo);` line at end of each. |
| `app/static/style.css` | Modify | Append `@media (prefers-reduced-motion: reduce)` block. |
| `build.sh` | Modify | Add `BJML_DEBUG` env-var gating for `DebugLayer`; insert `ErrorBoundary` and `perfProbe` into load order; update smoke list. |
| `build.ps1` | Modify | Mirror the `build.sh` changes. |

No file is renamed. The component load order changes only by adding `perfProbe` and `ErrorBoundary` and conditionally including `DebugLayer`.

---

## Task 1: Capture a baseline render-time measurement

We must measure before we optimize so the "<50ms p95" claim is verifiable. This task ships a tiny perf probe AND records the baseline number in the commit message.

**Files:**
- Create: `app/static/components/perfProbe.js`
- Modify: `build.sh`, `build.ps1` (add to load order)
- Modify: `app/static/components/App.jsx` (wrap top-level columns in `<PerfProbe id="...">`)

- [ ] **Step 1.1: Create `perfProbe.js`**

```js
// @ts-nocheck
/*
 * components/perfProbe.js — Phase 7 render-time probe
 * ─────────────────────────────────────────────────────────
 * Wraps children in React.Profiler. When __BJ_PERF.enable() is called
 * from the console, every render is timed and the result is fed into
 * a per-id rolling buffer. __BJ_PERF.report() prints a table of
 * count / mean / p95 / max for each probe id. Off by default (zero cost).
 *
 * Usage from App.jsx:
 *   <PerfProbe id="right-column">{...}</PerfProbe>
 */

(function () {
  var BUF_SIZE = 200;
  var buffers = Object.create(null);
  var enabled = false;

  function record(id, actualDuration) {
    if (!enabled) return;
    var b = buffers[id] || (buffers[id] = []);
    if (b.length >= BUF_SIZE) b.shift();
    b.push(actualDuration);
  }

  function p(arr, q) {
    if (arr.length === 0) return 0;
    var sorted = arr.slice().sort(function (a, b) { return a - b; });
    var idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
    return sorted[idx];
  }

  window.__BJ_PERF = {
    enable: function () { enabled = true; return 'PERF probe ON'; },
    disable: function () { enabled = false; return 'PERF probe OFF'; },
    clear: function () { buffers = Object.create(null); return 'PERF cleared'; },
    isOn: function () { return enabled; },
    report: function () {
      var rows = Object.keys(buffers).sort().map(function (id) {
        var arr = buffers[id];
        var sum = arr.reduce(function (a, b) { return a + b; }, 0);
        return {
          id: id,
          n: arr.length,
          mean_ms: arr.length ? +(sum / arr.length).toFixed(2) : 0,
          p50_ms: +p(arr, 0.5).toFixed(2),
          p95_ms: +p(arr, 0.95).toFixed(2),
          max_ms: +Math.max.apply(null, arr.length ? arr : [0]).toFixed(2),
        };
      });
      if (console.table) console.table(rows); else console.log(rows);
      return rows;
    },
  };

  window.PerfProbe = function PerfProbe(props) {
    if (!React || !React.Profiler) return props.children;
    return React.createElement(
      React.Profiler,
      {
        id: props.id,
        onRender: function (id, phase, actualDuration) {
          record(id, actualDuration);
        },
      },
      props.children
    );
  };
})();
```

- [ ] **Step 1.2: Add `perfProbe` to the bundle load order**

Edit `build.sh` line 40–48 — insert `perfProbe` after `utils`:

```bash
    for f in DebugLayer constants utils perfProbe Widget TopBar ActionPanel CompDepAlert BettingPanel \
              SideBetPanel HandDisplay CardGrid StrategyRefTable \
              ...
```

Mirror the same edit in `build.ps1` (find the parallel array of component names and add `perfProbe` in the same position).

- [ ] **Step 1.3: Add `var PerfProbe` to the smoke test**

In `build.sh`, append `'var PerfProbe'` to the `for global in \` list (line 89–107). Mirror in `build.ps1`.

- [ ] **Step 1.4: Wrap App.jsx columns**

In `app/static/components/App.jsx`, wrap the three column containers in PerfProbe. The existing line 841:

```jsx
        <div className="flex flex-col gap-2.5">
          {_leftKeys.map(key => (
            <div key={key}>{_panelRegistry[key]}</div>
          ))}
        </div>
```

becomes:

```jsx
        <PerfProbe id="left-column">
          <div className="flex flex-col gap-2.5">
            {_leftKeys.map(key => (
              <div key={key}>{_panelRegistry[key]}</div>
            ))}
          </div>
        </PerfProbe>
```

Do the same to:
- The center-column `<div className="flex flex-col gap-2.5">` (line 849) → wrap in `<PerfProbe id="center-column">`
- The right-column `<div className="panel-right flex flex-col gap-2.5">` (line 952) → wrap in `<PerfProbe id="right-column">`
- The top `<TopBar ... />` (line 687) → wrap in `<PerfProbe id="topbar">`
- The `<StatusBar ... />` (line 1060) → wrap in `<PerfProbe id="statusbar">`

- [ ] **Step 1.5: Build and verify smoke check passes**

Run: `bash build.sh`
Expected: `✅  Build complete → app/static/bundle.min.js` and `All required globals found`.

- [ ] **Step 1.6: Capture baseline**

Start the dashboard:

```bash
python main.py web
```

In Chrome at `http://localhost:5000`, open DevTools console:

```js
__BJ_PERF.enable()
```

Click through 50 hands (any modes — `n` for new hand, `2-9` to deal cards, `w/l/u` for outcomes). Then run:

```js
__BJ_PERF.report()
```

Capture the console.table output. Save it to a scratch note (paste into the Step 1.7 commit message).

- [ ] **Step 1.7: Commit**

```bash
git add app/static/components/perfProbe.js app/static/components/App.jsx build.sh build.ps1
git commit -m "perf(phase-7): add PerfProbe instrumentation + baseline

Baseline (after 50 hands, normal mode, with debug off):
  topbar         n=200 mean=X.X p95=Y.Y max=Z.Z
  left-column    n=200 mean=...
  center-column  n=200 mean=...
  right-column   n=200 mean=...
  statusbar      n=200 mean=...
"
```

---

## Task 2: Extract `ErrorBoundary` so it can ship without DebugLayer

`mountApp()` in `App.jsx:1158` falls back to `React.Fragment` when `DebugErrorBoundary` is absent. That means a production build without DebugLayer would render with no error catching. We split the boundary out into its own file, leaving DebugLayer focused on instrumentation only.

**Files:**
- Create: `app/static/components/ErrorBoundary.js`
- Modify: `app/static/components/DebugLayer.js` (remove the boundary; keep everything else)
- Modify: `app/static/components/App.jsx` (mountApp uses ErrorBoundary as primary)
- Modify: `build.sh`, `build.ps1` (add ErrorBoundary to load order before App)

- [ ] **Step 2.1: Create `ErrorBoundary.js`**

Copy the contents of `DebugLayer.js` lines 900–1029 (the `class DebugErrorBoundary extends React.Component {...}` block) into a new file with the class renamed to `ErrorBoundary`:

```js
// @ts-nocheck
/*
 * components/ErrorBoundary.js — Phase 7 split-out
 * ─────────────────────────────────────────────────────────
 * Always-shipped React error boundary. Was previously inside
 * DebugLayer.js; extracted so production builds without
 * BJML_DEBUG can still recover from render errors.
 *
 * Public surface:
 *   class ErrorBoundary       — wraps the entire app in mountApp()
 *   function isSafeMode()     — DebugLayer-aware safe mode check; returns false
 *                               when DebugLayer is absent
 */

class ErrorBoundary extends React.Component {
  // Body identical to the former DebugErrorBoundary at DebugLayer.js:900
  // Replace any reference to `DebugController.log(...)` with a guarded call:
  //   if (typeof DebugController !== 'undefined') DebugController.log(...)
  // (The original code already has many such guards; preserve them.)
  // ... (paste body here, 1:1 from DebugLayer.js:900-1029)
}

function isSafeMode() {
  if (typeof DebugController !== 'undefined' && DebugController._safeMode) return true;
  return false;
}
```

> Implementation note: do NOT rewrite the boundary logic — the requirement is a 1:1 lift. If `DebugController` is referenced inside the class methods, every reference must be guarded (`typeof ... !== 'undefined'`) so the boundary still works without DebugLayer. Most references in the original are already guarded; review and patch any that are not.

- [ ] **Step 2.2: Remove the boundary from `DebugLayer.js`**

Delete `DebugLayer.js` lines 900–1029 inclusive (the `class DebugErrorBoundary extends React.Component {...}` block). Also delete the now-orphan `function isSafeMode()` and `function _activateSafeMode(reason)` if and only if they are not referenced elsewhere in `DebugLayer.js`. Run `grep -n "DebugErrorBoundary\|_activateSafeMode\|isSafeMode" app/static/components/DebugLayer.js` after the edit to confirm no dangling references remain inside that file.

- [ ] **Step 2.3: Update `mountApp` in App.jsx**

Replace the boundary lookup at `App.jsx:1158`:

```js
  // BEFORE
  var Boundary = (typeof DebugErrorBoundary !== 'undefined') ? DebugErrorBoundary : React.Fragment;

  // AFTER
  var Boundary = (typeof ErrorBoundary !== 'undefined') ? ErrorBoundary : React.Fragment;
```

- [ ] **Step 2.4: Update build.sh load order and smoke list**

In `build.sh` line 40–48, replace `DebugLayer` with `ErrorBoundary DebugLayer` so ErrorBoundary loads first (and survives even when DebugLayer is removed in Task 7):

```bash
    for f in ErrorBoundary DebugLayer constants utils perfProbe Widget TopBar ActionPanel ...
```

In the smoke-test list (line 89–107), replace `'class DebugErrorBoundary'` with `'class ErrorBoundary'`. Mirror both edits in `build.ps1`.

- [ ] **Step 2.5: Build and smoke-test**

Run: `bash build.sh`
Expected: smoke checks pass.

- [ ] **Step 2.6: Manual error-boundary smoke test**

Start the dashboard. In DevTools console, force a render error to confirm the boundary catches it:

```js
// Throw inside the next render of any visible component.
// Simplest: temporarily inject a broken element via React DevTools, or
// edit App.jsx to add `if (window.__throw_test) throw new Error('test')`
// inside App() — build, set window.__throw_test = true, observe the
// boundary fallback UI, revert the throw line.
```

Confirm the fallback UI renders (the same UI that previously appeared with `DebugErrorBoundary`). Revert any test-only edits.

- [ ] **Step 2.7: Commit**

```bash
git add app/static/components/ErrorBoundary.js app/static/components/DebugLayer.js app/static/components/App.jsx build.sh build.ps1
git commit -m "refactor(phase-7): extract ErrorBoundary from DebugLayer

Allows production builds (BJML_DEBUG unset, Task 7) to ship without
DebugLayer while still catching render errors. mountApp() now wires
ErrorBoundary directly; DebugLayer instrumentation falls through
typeof guards as before."
```

---

## Task 3: Introduce `SocketContext` and remove socket prop drilling

Drilling `socket={socketRef.current}` through 6+ components forces those subtrees to re-render every time App re-renders (which is on every `state_update`). With `SocketContext`, the value is stable after first connect and consumers re-subscribe via `useContext`, so `React.memo` (Task 4) actually short-circuits.

**Files modified:**
- `app/static/components/App.jsx`
- `app/static/components/ScannerHub.js`
- `app/static/components/LiveOverlayPanel.jsx`
- `app/static/components/ZoneConfigPanel.js`
- `app/static/components/ConfirmationPanel.js`
- `app/static/components/WongPanel.js`
- `app/static/components/MultiSystemPanel.js`
- `app/static/components/StopAlerts.js`

- [ ] **Step 3.1: Create the context in App.jsx**

At the top of `App.jsx`, just after the comment block and before `function App()`:

```jsx
// PHASE 7: SocketContext — single connection exposed without prop drill.
// Value is null until the first connect, then stable for the session.
window.SocketContext = window.SocketContext || React.createContext(null);
const SocketContext = window.SocketContext;
```

Place this immediately after `const { useState, useEffect, useRef, useCallback } = React;` (around line 20).

- [ ] **Step 3.2: Add socket state alongside the existing ref**

Inside `function App()`, near the other state declarations (after `setUiMode`, around line 113):

```jsx
  // PHASE 7: socket state mirrors socketRef.current; the state triggers
  // a re-render so SocketContext consumers receive the connected socket.
  const [socket, setSocket] = useState(null);
```

Update the connection effect (line 130–183):

```jsx
  useEffect(() => {
    const sock = io()
    if (typeof DebugNet !== 'undefined') DebugNet.wrapEmit(sock)
    socketRef.current = sock
    setSocket(sock)              // PHASE 7: trigger context provider re-render

    sock.on('state_update', (data) => {
      // ...existing handler body unchanged — keep using sock instead of socket...
    })
    // ...existing other handlers...
    sock.on('debug_log', (data) => { /* unchanged */ })

    return () => sock.disconnect()
  }, [])
```

> Critical: rename the local `socket` variable inside the effect to `sock` to avoid shadowing the new state variable.

- [ ] **Step 3.3: Wrap the App return in the Provider**

Find the top-level `return (` at `App.jsx:683` and wrap the existing top-level `<div className="min-h-screen ...">` in `<SocketContext.Provider value={socket}>`:

```jsx
  return (
    <SocketContext.Provider value={socket}>
      <div className="min-h-screen font-body" style={{ ... }}>
        ...existing tree...
      </div>
    </SocketContext.Provider>
  )
```

- [ ] **Step 3.4: Remove socket props at App.jsx call sites**

Edit the six call sites identified earlier:

- Line 798 (SplitHandPanel): remove `socket={socketRef.current}` — verify SplitHandPanel still works (Step 3.10 grep)
- Line 897 (SplitHandPanel duplicate in normal layout): remove
- Line 986 (MultiSystemPanel): remove `socket={socketRef.current}`
- Line 990 (StopAlertsConfig): remove `socket={socketRef.current}`
- Line 994 (ScannerHub): remove `socket: socketRef.current,` (this is the JSX-attr form for ScannerHub)
- Line 1081 (StopAlerts floating overlay): remove `socket={socketRef.current}`

Note: SplitHandPanel uses `socket` for emitting actions. Check if it actually consumes it — if not, the prop was vestigial and removal is sufficient. If it does, switch SplitHandPanel to context (Step 3.5 pattern below).

- [ ] **Step 3.5: Convert ScannerHub to consume the context**

In `app/static/components/ScannerHub.js`:

```js
// BEFORE (line 35-42)
function ScannerHub({
  socket, count,
  scanMode, onSetMode,
  onDealCard, dealTarget,
  zoneConfig,
  confirmationMode, pendingCards,
  wonging,
}) {

// AFTER — drop socket from the destructure, pull from context
function ScannerHub({
  count,
  scanMode, onSetMode,
  onDealCard, dealTarget,
  zoneConfig,
  confirmationMode, pendingCards,
  wonging,
}) {
  var socket = React.useContext(window.SocketContext);
```

The rest of the file (which already uses `socket: socket` when constructing children) keeps working because the local `socket` variable now comes from context.

- [ ] **Step 3.6: Convert LiveOverlayPanel.jsx**

In `LiveOverlayPanel.jsx`:

- `LiveMode({ socket, count })` (line 972) → `LiveMode({ count })` and add `const socket = React.useContext(window.SocketContext);` as the first line of the body. The existing effect at line 1004 already short-circuits on `if (!socket) return;` so it stays correct while context is null.
- `WindowPicker({ socket, onWindowSelect = null })` (line 739) → `WindowPicker({ onWindowSelect = null })` and add the same `useContext` call.
- `LiveOverlayPanel({ socket, count, scanMode, onSetMode, onDealCard, dealTarget })` (line 1226) → drop `socket` from the destructure, drop `socket={socket}` from the `<LiveMode>` call at line 1242. Add `useContext` if anything in the parent body still needed it (likely nothing — verify with grep).

- [ ] **Step 3.7: Convert the remaining four components**

Apply the same pattern in:
- `ZoneConfigPanel.js` — find the function signature, drop the `socket` param, add `var socket = React.useContext(window.SocketContext);` at top of body.
- `ConfirmationPanel.js` — same.
- `WongPanel.js` — same.
- `MultiSystemPanel.js` — same.

For `StopAlerts.js` there are TWO components — `StopAlertsConfig` (line 86) and `StopAlerts` (somewhere later). Apply the pattern to both.

- [ ] **Step 3.8: Remove the now-dropped `socket` from inner usage in ScannerHub**

ScannerHub's `React.createElement(LiveOverlayPanel, { socket: socket, ... })` (line 143) keeps passing socket into LiveOverlayPanel, but LiveOverlayPanel no longer takes it as a prop — remove the `socket: socket,` line from the createElement call. Same for any `socket: socket,` on `ZoneConfigPanel`, `ConfirmationPanel`, `WongPanel` further down (lines 158, 164, 171).

After this edit, ScannerHub never reads `socket` itself — it only relies on context propagating to children. Therefore **also remove** the `var socket = React.useContext(...)` line you added in Step 3.5 (it's unused). Run a final `grep -n "socket" app/static/components/ScannerHub.js` to confirm only the param was removed cleanly.

- [ ] **Step 3.9: Build**

Run: `bash build.sh`
Expected: smoke pass.

- [ ] **Step 3.10: Manual smoke**

Start the dashboard. Test each socket-touching feature:
- Live scan (Scanner tab → start a screenshot or live scan): confirms LiveMode receives a socket.
- Multi-system tab: open it, change system, observe a server response.
- Stops tab: open it, set a stop loss, observe persistence.
- A split hand: deal a pair, press `P`, advance through both hands. Confirms SplitHandPanel still emits.
- Wonging panel inside Scanner tab: visible and updates when wonging fires.
- Zone config inside Scanner tab.
- Confirmation queue inside Scanner tab.

If anything is broken, the most likely cause is a stale `socket` reference — re-grep `grep -rn "props.socket\|\.socket\b" app/static/components/`.

- [ ] **Step 3.11: Commit**

```bash
git add app/static/components/App.jsx app/static/components/ScannerHub.js app/static/components/LiveOverlayPanel.jsx app/static/components/ZoneConfigPanel.js app/static/components/ConfirmationPanel.js app/static/components/WongPanel.js app/static/components/MultiSystemPanel.js app/static/components/StopAlerts.js
git commit -m "refactor(phase-7): introduce SocketContext, drop socket prop drill

Singleton socket is now exposed via React.createContext on
window.SocketContext. App provides; ScannerHub, LiveOverlayPanel,
ZoneConfigPanel, ConfirmationPanel, WongPanel, MultiSystemPanel,
and StopAlerts/StopAlertsConfig consume via useContext. This is
prerequisite for React.memo (Task 4) — without a stable socket
reference, memo wouldn't short-circuit subtree re-renders."
```

---

## Task 4: Wrap pure panels in `React.memo`

This is the bulk of the perf win. Each file gets one new line at the bottom. The smoke test does NOT need updating because we use the `Foo = React.memo(Foo)` reassignment pattern (script-mode reassignment of a function declaration).

**Pattern (paste at the end of each file):**

```js
// PHASE 7: memo wrap — see docs/superpowers/plans/2026-04-25-phase-7-performance-ux.md
if (typeof React !== 'undefined' && React.memo) {
  Foo = React.memo(Foo);
}
```

Replace `Foo` with the actual component identifier in each file.

- [ ] **Step 4.1: Memoize the always-on right column**

Append the memo block to:
- `app/static/components/EdgeMeter.js` — `EdgeMeter`
- `app/static/components/ShoePanel.js` — `ShoePanel`
- `app/static/components/BetSpreadHelper.js` — `BetSpreadHelper`

For `BettingRampPanel.js` — note this file already declares `var BettingRampPanel = function ...`. Use this slightly different form:

```js
// PHASE 7: memo wrap.
BettingRampPanel = (typeof React !== 'undefined' && React.memo)
  ? React.memo(BettingRampPanel)
  : BettingRampPanel;
```

- [ ] **Step 4.2: Build, smoke**

Run: `bash build.sh`
Expected: smoke pass; no runtime errors when dashboard loads.

- [ ] **Step 4.3: Memoize tab-strip panels**

Append the memo block to:
- `I18Panel.js` — `I18Panel`
- `SessionStats.js` — `SessionStats`
- `SideBetPanel.js` — `SideBetPanel`
- `AnalyticsPanel.js` — `AnalyticsPanel`
- `ShuffleTracker.js` — `ShuffleTrackerPanel` (the function name)
- `CasinoRiskMeter.js` — `CasinoRiskMeter`
- `CountHistory.js` — `CountHistoryPanel`
- `MultiSystemPanel.js` — `MultiSystemPanel`
- `StopAlerts.js` — both `StopAlertsConfig` AND `StopAlerts` (two memo blocks)
- `ScannerHub.js` — `ScannerHub`

- [ ] **Step 4.4: Memoize left + center column panels**

Append the memo block to:
- `BettingPanel.js` — `BettingPanel`
- `SideCountPanel.js` — `SideCountPanel`
- `StrategyRefTable.js` — `StrategyRefTable`
- `ActionPanel.js` — `ActionPanel`
- `HandDisplay.js` — `HandDisplay`
- `CardGrid.js` — `CardGrid`
- `OutcomeStrip.js` — `OutcomeStrip`
- `CenterToolBar.js` — `CenterToolbar` (note: file is `CenterToolBar.js`, function is `CenterToolbar` lowercase b — check the existing `function` declaration line and use that exact identifier)
- `SeenCardsPanel.js` — `SeenCardsPanel`
- `SplitHandPanel.js` — `SplitHandPanel`
- `DeviationBanner.js` — `DeviationBanner`
- `DealOrderEngine.js` — **skip if it uses forwardRef.** App.jsx passes `ref={dealOrderRef}` (line 769). React.memo on a forwardRef component is fine but loses the ref unless you keep the inner component as forwardRef. If DealOrderEngine is `React.forwardRef(...)`, leave it alone — its parent only passes `count` and `shoe` plus stable callbacks, and the memo benefit is small for a single instance.

Verify with `grep -n "React.forwardRef\|forwardRef" app/static/components/DealOrderEngine.js` — if forwardRef is present, do NOT memo. Otherwise, append the standard memo block.

- [ ] **Step 4.5: Memoize chrome (TopBar + StatusBar)**

Append the memo block to:
- `TopBar.js` — `TopBar` (will be modified again in Task 5)
- `StatusBar.js` — `StatusBar`

- [ ] **Step 4.6: Build**

Run: `bash build.sh`
Expected: smoke pass.

- [ ] **Step 4.7: Manual smoke + checking memo actually works**

Start the dashboard. In DevTools, install React DevTools if not already. Switch to the **Profiler** tab and start a recording, then deal 5 hands. Stop recording. In the flame graph, panels that did NOT change should appear grey/faded (memo skipped them). Panels that did change should be coloured.

Specifically:
- `EdgeMeter` should re-render only when `count.advantage` changes (not on every state_update).
- `ShoePanel` should re-render only when `shoe` reference changes.
- `I18Panel` should re-render only when its tab is active AND `count` changes.

If a memo'd panel re-renders on every update, the cause is almost always an unstable parent prop (a new object/array literal at every render, or an inline arrow function). Audit App.jsx for any `<Panel onSomething={() => ...}>` patterns; replace with `useCallback`.

- [ ] **Step 4.8: Commit**

```bash
git add app/static/components/*.js app/static/components/*.jsx
git commit -m "perf(phase-7): React.memo every leaf panel

Wraps each pure panel in React.memo using the script-mode
reassignment pattern (Foo = React.memo(Foo)) so the
build.sh smoke check (which greps for 'function Foo(') still
passes without smoke-list edits. Memo equality holds because
App reads props straight off gameState — references are stable
when values are unchanged."
```

---

## Task 5: Replace TopBar tc-flash `void offsetWidth` with key remount

The DOM thrash:

```js
tcBlockRef.current.classList.remove('tc-flash');
void tcBlockRef.current.offsetWidth;            // forced sync layout
tcBlockRef.current.classList.add('tc-flash');
```

This is bypassing React. Replace with state + key remount: increment a counter on each crossing, apply the counter as a `key` on the TC element. React re-mounts the node, the `.tc-flash` class re-applies cleanly, animation re-fires.

**Files:**
- Modify: `app/static/components/TopBar.js`

- [ ] **Step 5.1: Replace the flash effect**

In `TopBar.js`, find the `useEffect` at line 140–156. Add a new state alongside it (top of the component):

```js
const [tcFlashKey, setTcFlashKey] = useState(0);
```

Replace the body of the effect:

```js
useEffect(() => {
  const prev = prevTcRef.current;
  prevTcRef.current = tc;
  const thresholds = [-5, -3, 3, 5];
  for (const t of thresholds) {
    const crossed = (prev < t && tc >= t) || (prev > t && tc <= t) ||
                    (prev >= t && tc < t) || (prev <= t && tc > t);
    if (crossed && prev !== tc) {
      setTcFlashKey(k => k + 1);    // PHASE 7: remount → animation re-fires
      break;
    }
  }
}, [tc]);
```

- [ ] **Step 5.2: Apply the key to the flash element**

Find the JSX in `TopBar.js` that uses `ref={tcBlockRef}` (it should be the wrapper around the main TC value display). Replace the ref attribute with `key={tcFlashKey}` and add `className="tc-flash"`. If there is intervening JSX that should NOT remount (e.g. an inner number with its own state), wrap only the smallest div whose only purpose is to host the animation:

```jsx
// BEFORE
<div ref={tcBlockRef} style={{ ... }}>
  {tc.toFixed(1)}
</div>

// AFTER
<div
  key={tcFlashKey}
  className="tc-flash"
  style={{ ... }}
>
  {tc.toFixed(1)}
</div>
```

> The `.tc-flash` class always being present is fine — the CSS animation runs once (`animation: tc-flash 0.8s ease-out;` does not loop). On remount the animation re-fires from frame 0; while between flashes there is no animation update because the same DOM node persists.

Now remove the `tcBlockRef` declaration (`const tcBlockRef = useRef(null);` near line 139) — it's no longer used.

- [ ] **Step 5.3: Build**

Run: `bash build.sh`

- [ ] **Step 5.4: Manual verify the flash still fires**

Start dashboard. Deal cards until TC crosses +3 (or use the simulator: deal a flurry of low cards to push count up). Confirm the TC display flashes amber once. Cross +5 → flashes again. Cross back below +3 → flashes. No flash on every count update — only on threshold crossings.

- [ ] **Step 5.5: Commit**

```bash
git add app/static/components/TopBar.js
git commit -m "perf(phase-7): TC flash via React key remount

Replaces void offsetWidth forced reflow with a state-driven key.
React unmounts and remounts the flash node when the key changes,
which restarts the CSS animation cleanly without bypassing React
or triggering a synchronous layout."
```

---

## Task 6: Add `prefers-reduced-motion` CSS guard

Append a media query at the end of `app/static/style.css` so users with the OS-level reduced-motion preference don't see any of the looping pulses, fade-ins, or the tc-flash. Defensive default: kill all animations and transitions globally — pros aren't visiting the dashboard for animation aesthetics anyway.

**Files:**
- Modify: `app/static/style.css`

- [ ] **Step 6.1: Append the media query**

Append to the end of `app/static/style.css`:

```css
/* ══════════════════════════════════════════════════════════
   PHASE 7 — Respect prefers-reduced-motion
   Kills every animation and transition for users who request
   reduced motion at the OS level. Pulses, tc-flash,
   split-advance-pulse, fadeIn, live-pulse, de-pulse-seat,
   de-hotpulse, de-expand-in, de-chip-in, splitActivePulse,
   cardDeal, toastSlide are all neutralized.
   ══════════════════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-delay: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    transition-delay: 0ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 6.2: Verify**

In Chrome DevTools, open `Cmd/Ctrl+Shift+P` → run "Emulate CSS prefers-reduced-motion: reduce". Reload dashboard. Confirm:
- No `tc-flash` amber sweep on threshold crossing.
- No pulsing dots in DealOrderEngine.
- No fadeIn delay on freshly-rendered nodes.

Toggle the emulation off — animations return.

- [ ] **Step 6.3: Commit**

```bash
git add app/static/style.css
git commit -m "perf(phase-7): respect prefers-reduced-motion

Global media query that neutralizes all CSS animations and
transitions when the OS-level setting is engaged. Covers all
14+ keyframes in the file (pulse, tc-flash, fadeIn,
split-advance-pulse, live-pulse, de-pulse-seat, de-hotpulse,
de-expand-in, de-chip-in, splitActivePulse, cardDeal,
toastSlide, etc.) without per-keyframe edits."
```

---

## Task 7: Gate `DebugLayer` behind a build flag

`DebugLayer.js` is 1072 LOC of instrumentation that ships in every bundle but is fully no-op when the controller is OFF. Production builds should drop it entirely. We add an env-var-driven include in `build.sh` / `build.ps1`. ErrorBoundary (split out in Task 2) keeps shipping unconditionally.

**Files:**
- Modify: `build.sh`, `build.ps1`

- [ ] **Step 7.1: Make `DebugLayer` opt-in in build.sh**

Edit `build.sh` near the top of `build()`:

```bash
build() {
  echo "🔨  Syncing sources..."
  cp "$SRC_DIR"/*.js "$SRC_DIR"/*.jsx "$BUILD_DIR/src/" 2>/dev/null || true
  for f in "$BUILD_DIR/src/"*.jsx; do
    [ -f "$f" ] && mv "$f" "${f%.jsx}.tsx"
  done
  for f in "$BUILD_DIR/src/"*.js "$BUILD_DIR/src/"*.tsx; do
    [ -f "$f" ] && grep -q "@ts-nocheck" "$f" || sed -i '1s/^/\/\/ @ts-nocheck\n/' "$f"
  done

  # PHASE 7: drop DebugLayer source from the build dir when BJML_DEBUG is unset.
  if [ -z "$BJML_DEBUG" ]; then
    rm -f "$BUILD_DIR/src/DebugLayer.js"
    echo "  (production build — DebugLayer excluded; set BJML_DEBUG=1 to include)"
  else
    echo "  (debug build — DebugLayer included)"
  fi
```

Then conditionally add `DebugLayer` to the load order. Replace the `for f in` line with a build-up of the list:

```bash
  echo "📦  Bundling in load order..."
  COMPONENTS="ErrorBoundary"
  if [ -n "$BJML_DEBUG" ]; then COMPONENTS="$COMPONENTS DebugLayer"; fi
  COMPONENTS="$COMPONENTS constants utils perfProbe Widget TopBar ActionPanel CompDepAlert BettingPanel \
              SideBetPanel HandDisplay CardGrid StrategyRefTable \
              ShoePanel EdgeMeter SessionStats ShuffleTracker \
              CountHistory I18Panel AnalyticsPanel LiveOverlayPanel CenterToolBar \
              DealOrderEngine \
              SplitHandPanel SideCountPanel CasinoRiskMeter StopAlerts \
              SeenCardsPanel ZoneConfigPanel ConfirmationPanel WongPanel ScannerHub \
              BettingRampPanel BetSpreadHelper MultiSystemPanel \
              OutcomeStrip DragLayoutEditor TabStrip DeviationBanner StatusBar HotkeyOverlay App"
  {
    echo "/* BlackjackML bundle — compiled $(date -u '+%Y-%m-%dT%H:%M:%SZ') */"
    for f in $COMPONENTS; do
      echo "/* ── $f ── */"
      cat "$OUT_DIR/$f.js"
      echo ""
    done
  } > "$BUNDLE"
```

- [ ] **Step 7.2: Make smoke list conditional**

The smoke list currently asserts `var DebugController`, `var DebugUI`, `var DebugNet`, `var DebugState`. These must be skipped in prod builds. Restructure:

```bash
  echo "🧪  Smoke testing bundle..."
  SMOKE_FAIL=0
  ALWAYS_GLOBALS=(
    'class ErrorBoundary'
    'function App('
    'function mountApp('
    'function Widget('
    'function TopBar('
    'function ActionPanel('
    'function BettingPanel('
    'function HandDisplay('
    'function CardGrid('
    'function LiveOverlayPanel('
    'function ScannerHub('
    'function CompDepAlert('
    'function AnalyticsPanel('
    'var BettingRampPanel'
    'var PerfProbe'
  )
  DEBUG_GLOBALS=(
    'var DebugController'
    'var DebugUI'
    'var DebugNet'
    'var DebugState'
  )
  for global in "${ALWAYS_GLOBALS[@]}"; do
    if ! grep -q "$global" "$BUNDLE_MIN"; then
      echo "  MISSING: $global"
      SMOKE_FAIL=1
    fi
  done
  if [ -n "$BJML_DEBUG" ]; then
    for global in "${DEBUG_GLOBALS[@]}"; do
      if ! grep -q "$global" "$BUNDLE_MIN"; then
        echo "  MISSING (debug build): $global"
        SMOKE_FAIL=1
      fi
    done
  fi
  if [ "$SMOKE_FAIL" -eq 1 ]; then
    echo "❌  Bundle is missing required definitions — check load order"
    exit 1
  fi
  echo "  All required globals found"
```

- [ ] **Step 7.3: Mirror in build.ps1**

Open `build.ps1`. Find the equivalent component list and smoke list. Apply the same `BJML_DEBUG` conditional — in PowerShell:

```ps1
# At top of the build function
if (-not $env:BJML_DEBUG) {
  Remove-Item -ErrorAction SilentlyContinue "$buildDir/src/DebugLayer.js"
  Write-Host "  (production build — DebugLayer excluded; set `$env:BJML_DEBUG=1 to include)"
} else {
  Write-Host "  (debug build — DebugLayer included)"
}

# Component-list block
$components = @('ErrorBoundary')
if ($env:BJML_DEBUG) { $components += 'DebugLayer' }
$components += @('constants', 'utils', 'perfProbe', 'Widget', 'TopBar', ...)  # rest of list

# Smoke-list block
$alwaysGlobals = @('class ErrorBoundary', 'function App(', ..., 'var PerfProbe')
$debugGlobals = @('var DebugController', 'var DebugUI', 'var DebugNet', 'var DebugState')
# ... loop checks ...
```

> Implementation hint: locate the existing arrays in `build.ps1` and just add the conditional flow. The shape mirrors `build.sh`.

- [ ] **Step 7.4: Build production**

```bash
bash build.sh
```

Expected: smoke passes; no DebugController in bundle. Check size:

```bash
ls -la app/static/bundle.min.js
```

Compare to baseline (was ~XXX KB before Phase 7). DebugLayer is ~30–50 KB minified — expect a noticeable drop.

- [ ] **Step 7.5: Build debug**

```bash
BJML_DEBUG=1 bash build.sh
```

Expected: smoke passes including the four `var Debug*` globals. Bundle size ~30–50 KB larger than the prod build.

- [ ] **Step 7.6: Manual smoke (production build)**

Start dashboard with the prod bundle. Open DevTools console — confirm:
- No `__BJDebug` (DebugController is absent).
- `Ctrl+Shift+D` does nothing (no DebugPanel hotkey).
- `?debug=4` URL param does nothing.
- The app still functions normally; no console errors.
- Throw a render error (insert temporarily and revert) — `ErrorBoundary` still catches it.

- [ ] **Step 7.7: Manual smoke (debug build)**

Re-run with `BJML_DEBUG=1`. Confirm:
- `__BJDebug.enable(4)` works.
- `Ctrl+Shift+D` opens the DebugPanel.

- [ ] **Step 7.8: Commit**

```bash
git add build.sh build.ps1
git commit -m "build(phase-7): gate DebugLayer behind BJML_DEBUG flag

Production builds (default) exclude DebugLayer.js entirely.
ErrorBoundary (extracted in Task 2) ships unconditionally so
render errors are still caught. Debug builds set BJML_DEBUG=1
to re-include DebugController, DebugUI, DebugNet, DebugState,
DebugPanel, and the perf monitor."
```

---

## Task 8: Verify the floating TC HUD render gating + final perf measurement

- [ ] **Step 8.1: Verify the floating HUD is fully gated**

Run:

```bash
grep -n "showFloatingHud" app/static/components/*.js app/static/components/*.jsx
```

Expected output: 4 references in `App.jsx` only, all of which are:
- The `useState` initializer (line 43–45)
- The persistence `useEffect` (lines 46–48)
- The render conditional `{showFloatingHud && count && (` at line 1086

No event listener or animation runs when `showFloatingHud === false`. The conditional render is a pure JSX gate. **No code change needed for this Phase 7 item — already implemented in Phase 2.**

- [ ] **Step 8.2: Re-run the perf probe**

Build the production bundle (`bash build.sh`), start dashboard, enable probe, deal 50 hands, capture `__BJ_PERF.report()`. Compare to the Task 1 baseline.

Goal: every probe id's `p95_ms` < 50.

If a probe is still over 50ms:
- Open React DevTools Profiler.
- Find the heaviest panel that re-rendered.
- Check whether its props are referentially stable (a parent might be rebuilding an object or function on every render).
- Wrap the offending parent prop in `useMemo` / `useCallback` and re-measure.

Document the after-state in the final commit.

- [ ] **Step 8.3: Update the auto-memory plan record**

Edit `C:\Users\Rouna\.claude\projects\C--Users-Rouna-Downloads-MLModel-Model1\memory\project_ui_redesign_plan.md` — under the Phase 7 heading, append a final line:

```
**Status:** Implemented YYYY-MM-DD. Baseline p95 → After p95 (per-column).
See docs/superpowers/plans/2026-04-25-phase-7-performance-ux.md.
```

- [ ] **Step 8.4: Commit**

```bash
git add docs/superpowers/plans/2026-04-25-phase-7-performance-ux.md
git commit -m "docs(phase-7): mark plan complete, record after-state perf

Before (Task 1):
  topbar         p95=...
  left-column    p95=...
  center-column  p95=...
  right-column   p95=...
  statusbar      p95=...

After (Task 8):
  topbar         p95=...
  left-column    p95=...
  center-column  p95=...
  right-column   p95=...
  statusbar      p95=...

Goal of <50ms p95 met. Floating TC HUD render path was already
gated correctly in Phase 2; no change required this phase."
```

---

## Self-review

**Spec coverage** (against the original Phase 7 spec):

| Spec item | Implementing task |
|-----------|-------------------|
| `React.memo` each panel keyed on actual prop subset | Task 4 |
| AccordionPanel `isVisible` short-circuit | **Dropped** — AccordionPanel removed in Phase 5; TabStrip already only renders the active tab. Documented above. |
| Single SocketProvider context | Task 3 |
| Gate DebugLayer behind production build flag | Task 7 (with Task 2 prerequisite splitting ErrorBoundary out) |
| Replace tc-flash `void offsetWidth` reflow with key-remount | Task 5 |
| Respect `prefers-reduced-motion` | Task 6 |
| Drop floating TC HUD render path when toggle is off | Task 8 — verified already done in Phase 2, no code change |

**Manual-test caveat:** No JS test framework is installed in this repo (`tests/` is Python pytest only). Verification at every step is by build smoke, React DevTools Profiler, and manual interaction. The plan calls this out in each Manual-smoke step rather than fabricating non-existent test files.

**Risks called out inline:**
- Memo pattern relies on script-mode reassignment of function declarations. If the build pipeline ever moves to ES modules, switch to `var Foo = React.memo(function Foo(...) { ... })` and update the smoke list (which currently checks `function Foo(`).
- `BettingRampPanel.js` is already a `var`-form declaration; uses a slightly different memo pattern — called out in Step 4.1.
- `DealOrderEngine.js` may use `forwardRef`; if so it must NOT be wrapped in `React.memo` directly — Step 4.4 has the verification grep.
- `SocketContext` value is `null` until the first connect — every consumer's useEffect already short-circuits on `if (!socket) return;` (verified in Step 3.6 for LiveMode). Audit the other consumers in Step 3.7 for the same pattern; add the guard if missing.

# Phase 5 — Panel Cleanup & Consolidation

**Status:** approved
**Date:** 2026-04-25
**Owner:** Rounak Mahato
**Predecessor:** Phases 1–4 (decision speed, layout, visibility, hotkeys)
**Successor:** Phase 6 — Visual hierarchy

## Context

Phases 1–4 reshaped the dashboard around a 3-column grid with a TabStrip in the right column and an OutcomeStrip below the CardGrid. During those phases, several Phase 5 items in the original 8-phase plan were already absorbed:

| Original Phase 5 item | Status entering Phase 5 |
|---|---|
| Remove duplicate side-bet pills from CenterToolbar | Already stripped in Phase 2 |
| Merge CompDepAlert into Deviation Banner | Already inline in `ActionPanel` |
| Promote `I18Panel` to Tab Strip default | Already `defaultKey="i18"` |
| Lazy-render currency dropdown | Already gated on `showCurrencyPicker` |
| Group reference panels into Tab Strip | Done in Phase 2 |
| Deprecate `AccordionPanel` for right column | No longer imported anywhere |

The actually-pending work is three changes:
1. Conditional render of `BettingPanel`'s bottom result row.
2. Merge live-scan widgets into a single Scanner tab body.
3. Delete `AccordionPanel.js`.

## Goals

- One canonical surface for recording hand results post-deal (`OutcomeStrip`).
- Right-column structure that does not change between manual / screenshot / live scan modes — same fixed slots, same TabStrip, same tab order.
- Remove dead code from the bundle.

## Non-Goals

- No changes to socket event contracts or backend.
- No restyling, accessibility audit, or visual hierarchy work — that is Phase 6.
- No accessibility additions beyond what already exists in the four merged components.
- No changes to hotkey bindings — Phase 4 owns those.

## Design

### 1. `BettingPanel` result row gating

**File:** `app/static/components/BettingPanel.js`

The result row currently renders unconditionally as a footer of the panel with header text switching between `'Record Result:'` (mid-hand) and `'Manual override:'` (pre-hand). This duplicates the OutcomeStrip below the CardGrid post-deal.

**Change:**
- Wrap the entire result-row block in a `pCards === 0` conditional. When the user has any cards in their current hand, the block does not render.
- Drop the `'Record Result:'` mid-hand label branch entirely — it was only used in the duplicate-path mode that no longer exists.
- Keep the `borderTop` + spacing only when the row renders.
- Keep the bet preview line (`{symbol}{amount} · win = … · loss = …`) under the row in pre-hand only. (This line is part of the gated block and disappears with it; see "Open question — preview line" below if reconsidering.)

**Existing local state used:**
- `pCards` is already computed at line 92 of `BettingPanel.js`.
- `phase === 'pre'` is already computed at line 93.

**Open question — preview line:**
The bet preview is currently inside the gated block, so it follows the same `pCards === 0` rule. If a future need arises to show the preview mid-hand (e.g. as a "this is what's at stake" reminder), lift it out of the gated block. Out of scope for this phase.

### 2. Merged Scanner tab

**Goal:** the right column above the TabStrip is identical regardless of `scanMode`. The three live-only widgets (`ZoneConfigPanel`, `ConfirmationPanel`, `WongPanel`) move into the Scanner tab body, beneath whatever mode is active.

#### 2.1 New component — `ScannerHub`

**File:** `app/static/components/ScannerHub.js` (new, ~120 LOC)

```
ScannerHub
├── <LiveOverlayPanel />   — owns the mode toggle and per-mode body
└── live-only sub-sections (only when scanMode === 'live')
    ├── ▾ Zone Config       → <ZoneConfigPanel />
    ├── ▾ Confirmation      → <ConfirmationPanel />
    └── ▾ Wonging           → <WongPanel />
```

In `screenshot` mode: only the Zone Config sub-section is shown (the other two are live-only). In `manual` mode: no sub-sections.

**Props:**
```
{
  socket, count,
  scanMode, onSetMode,
  onDealCard, dealTarget,
  zoneConfig,
  confirmationMode, pendingCards,
  wonging,
}
```
These are exactly the props that App.jsx already passes to the four individual components — `ScannerHub` is pure composition.

**Internal state:**
- `zoneOpen`, `confOpen`, `wongOpen` booleans, each persisted to localStorage under keys `bjml_scanner_zone_open`, `bjml_scanner_conf_open`, `bjml_scanner_wong_open`.
- Default open state on first load: all three collapsed (`false`). Users opt into expansion.

**Sub-section header design (≈28px collapsed):**
- `▸ Zone Config  [status dot]` — chevron rotates to `▾` when open.
- Status dot: 6px circle. Active colors match existing panel accents; idle color is the project muted-text token.
  - Zone: `#44e882` (jade) when zones applied for this session, otherwise `#6b7f96` (muted).
  - Confirmation: `#ffd447` (gold) when `pendingCards.length > 0`, otherwise `#6b7f96`.
  - Wong: `#6aafff` (sapph) when `wonging.is_wong_in === true`, otherwise `#6b7f96`.
- The dot is the glance signal so the user does not need to expand to know state.

**Composition rules:**
- ScannerHub does not modify `LiveOverlayPanel`, `ZoneConfigPanel`, `ConfirmationPanel`, or `WongPanel`. It mounts them as-is.
- ScannerHub does not duplicate the mode toggle UI — `LiveOverlayPanel` owns it.
- Sub-section bodies render the existing component with no wrapper Widget — the four panels already render their own Widget chrome. Nesting two Widget shells looks heavy; the chevron header is a plain row.

#### 2.2 `App.jsx` changes

- Remove the three top-of-right-column conditionals (the `{(scanMode === 'live' || scanMode === 'screenshot') && <ZoneConfigPanel.../>}` block and the two `{scanMode === 'live' && <…/>}` blocks).
- Replace the existing `'scanner'` tab body in the TabStrip tabs array with `<ScannerHub … />`, passing the union of props now consolidated in one place.
- The `scanner` key remains in the tab list, so the Layout Editor's existing "Scanner" tab key still resolves correctly. No saved tab order migration is needed.

#### 2.3 Build script changes

- `build.sh` and `build.ps1`: add `ScannerHub` to the load-order list, **after** `WongPanel` (since `ScannerHub` references all four upstream components at parse time as JSX children).
- Add `function ScannerHub(` to the smoke-test global list in `build.sh`.

### 3. Delete `AccordionPanel.js`

**File:** `app/static/components/AccordionPanel.js` (146 LOC)

- Delete the file.
- Remove `AccordionPanel` from the load-order list in `build.sh` and `build.ps1`.
- Verified no imports anywhere via `grep -rn "AccordionPanel"` — only references are inside the file itself.

## Architecture diagram

```
                      App.jsx (right column)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  Slot 1: Edge & Shoe   Slot 2: Bet Ref         TabStrip
                                            ┌──────┴──────┐
                                       I18, …, Scanner    │
                                                          ▼
                                                    ScannerHub
                                                          │
                                  ┌───────────────────────┼───────────────────────┐
                                  ▼                       ▼                       ▼
                          LiveOverlayPanel     (live-only) sub-sections    (collapsed)
                          (mode toggle +       Zone | Confirmation | Wong   per-section
                           per-mode body)
```

## Migration / rollout

- Single PR. No feature flag — the change is bundled with bundle.min.js, frontend-only, and reverts cleanly with `git revert`.
- LocalStorage keys (`bjml_scanner_*_open`) are net new — no migration needed.
- Saved layout (`bjml_layout`) is unaffected: the `scanner` tab key is preserved.

## Verification

No unit tests in this codebase. Verification is the build smoke test plus manual checks.

1. **Build:** `bash build.sh` must pass — syntax check, hook-fix step, smoke test (now includes `function ScannerHub(` and no longer expects AccordionPanel).
2. **Manual checks** with `python main.py web`:

   | Scenario | Expected |
   |---|---|
   | Page load, no hand started | BettingPanel shows result row; OutcomeStrip is hidden (Phase 1 already enforces this). |
   | Deal one card to player | BettingPanel result row disappears. OutcomeStrip remains hidden until ≥2 player cards. |
   | Two cards each, dealer stands | OutcomeStrip becomes the only enabled result surface; W/L/U hotkeys still work. |
   | New Hand | BettingPanel result row reappears; OutcomeStrip hides again. |
   | scanMode = manual | Right column above TabStrip is just two slots. Scanner tab shows mode toggle + ManualHint. |
   | scanMode = screenshot | Same right column. Scanner tab shows mode toggle + ScreenshotMode + ZoneConfig sub-section. |
   | scanMode = live | Same right column. Scanner tab shows mode toggle + LiveMode + 3 sub-sections; each collapse persists across reload. |
   | Layout Editor open | Left reorder still works; right tab reorder still works; saved layout still loads. |
   | Sub-section status dots | Pending cards in confirmation → amber dot. Wong-in → blue dot. Zones applied → green dot. |

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Removing BettingPanel buttons confuses post-hand muscle memory | Low | OutcomeStrip auto-resolves bust/BJ/dealer-stand; W/L/U hotkeys unchanged; manual buttons exist below CardGrid. |
| ScannerHub mount order causes Zone/Confirmation/Wong to miss early socket events | Very low | React mounts children synchronously; Socket.IO buffers events for handlers registered during the same tick. No `useEffect` ordering changes vs. today. |
| Bundle smoke test fails for missing `ScannerHub` global | Caught at build | Smoke-list updated as part of this phase. |
| LiveOverlayPanel's internal layout fights the new wrapper | Medium | ScannerHub gives `LiveOverlayPanel` a dedicated full-width container — same conditions as inside the current Scanner tab. No prop changes. |
| LocalStorage keys collide with future code | Negligible | All under `bjml_scanner_*`; no current code uses that prefix. |

## Files touched

| File | Change |
|---|---|
| `app/static/components/BettingPanel.js` | Gate result row on `pCards === 0`. |
| `app/static/components/App.jsx` | Drop three top-of-right-column conditionals; swap Scanner tab body to `ScannerHub`. |
| `app/static/components/ScannerHub.js` | New file, ~120 LOC. |
| `app/static/components/AccordionPanel.js` | Deleted. |
| `build.sh` | Load-order + smoke list updated. |
| `build.ps1` | Load-order + smoke list updated. |
| `app/static/bundle.min.js` | Rebuilt artifact. |

## Out of scope

- Any visual hierarchy changes (Phase 6).
- React.memo / perf wrap of merged components (Phase 7).
- Inline editing of Wong threshold (Phase 8).
- Changes to the existing four panels' internal layout or socket subscriptions.
- Removal or refactor of the `scanner` tab key in the TabStrip.

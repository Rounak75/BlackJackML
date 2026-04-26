#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# BlackjackML — Frontend Build Script
# ─────────────────────────────────────────────────────────────────
# Run this whenever you edit any file in app/static/components/.
#
# Usage:
#   bash build.sh          — one-time build
#   bash build.sh --watch  — rebuild on any component file change
#
# Requirements:
#   - Node.js 18+ with tsc: npm install -g typescript
# ─────────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/app/static/components"
BUILD_DIR="$SCRIPT_DIR/build-src"
OUT_DIR="$BUILD_DIR/out"
BUNDLE="$SCRIPT_DIR/app/static/bundle.js"
BUNDLE_MIN="$SCRIPT_DIR/app/static/bundle.min.js"

build() {
  echo "🔨  Syncing sources..."
  cp "$SRC_DIR"/*.js "$SRC_DIR"/*.jsx "$BUILD_DIR/src/" 2>/dev/null || true
  for f in "$BUILD_DIR/src/"*.jsx; do
    [ -f "$f" ] && mv "$f" "${f%.jsx}.tsx"
  done
  # Ensure @ts-nocheck on every file (suppresses type errors, keeps JSX transform)
  for f in "$BUILD_DIR/src/"*.js "$BUILD_DIR/src/"*.tsx; do
    [ -f "$f" ] && grep -q "@ts-nocheck" "$f" || sed -i '1s/^/\/\/ @ts-nocheck\n/' "$f"
  done

  # PHASE 7 T7 — production builds drop DebugLayer source. Set BJML_DEBUG=1 to keep it.
  if [ -z "$BJML_DEBUG" ]; then
    rm -f "$BUILD_DIR/src/DebugLayer.js"
    echo "  (production build — DebugLayer excluded; export BJML_DEBUG=1 to include)"
  else
    echo "  (debug build — DebugLayer included)"
  fi

  echo "⚙️   Compiling JSX → JS (tsc)..."
  tsc --project "$BUILD_DIR/tsconfig.json" 2>&1 | grep -v "error TS" || true

  echo "📦  Bundling in load order..."
  COMPONENTS="ErrorBoundary"
  if [ -n "$BJML_DEBUG" ]; then COMPONENTS="$COMPONENTS DebugLayer"; fi
  COMPONENTS="$COMPONENTS constants utils perfProbe icons HelpChip Widget TopBar ActionPanel CompDepAlert BettingPanel \
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

  echo "🔧  Fixing duplicate hook declarations..."
  # Each component file declares `const { useState } = React` for its own scope.
  # When concatenated into one file, duplicate `const` declarations cause a
  # SyntaxError. Convert all hook destructures to `var` which allows redeclaration.
  python3 - "$BUNDLE" << 'PYEOF'
import re, sys
bundle = sys.argv[1]
# UTF-8 explicit — bundle includes emoji and box-drawing chars that crash the
# default cp1252 decoder on Windows.
with open(bundle, encoding='utf-8') as f:
    src = f.read()
src = re.sub(
    r'const \{ ([\w,\s]+) \} = React;',
    lambda m: 'var ' + ', '.join(
        f'{h.strip()} = React.{h.strip()}' for h in m.group(1).split(',')
    ) + ';',
    src
)
with open(bundle, 'w', encoding='utf-8', newline='\n') as f:
    f.write(src)
print("  Hook declarations fixed")
PYEOF

  echo "🗜️   Minifying..."
  node "$BUILD_DIR/minify.js"

  echo "🔍  Syntax checking..."
  node --check "$BUNDLE_MIN" && echo "  ✅  Syntax OK" || {
    echo "❌  Syntax error in bundle — check build output above"
    exit 1
  }

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
    'function HelpChip('
    'function Icon('
    'var BettingRampPanel'
    'PerfProbe = function'
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
  echo "✅  Build complete → app/static/bundle.min.js"
}

if [[ "$1" == "--watch" ]]; then
  echo "👀  Watching $SRC_DIR for changes (Ctrl+C to stop)..."
  build
  while true; do
    inotifywait -qre modify,create,delete "$SRC_DIR" 2>/dev/null && build || sleep 2
  done
else
  build
fi
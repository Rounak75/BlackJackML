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

  echo "⚙️   Compiling JSX → JS (tsc)..."
  tsc --project "$BUILD_DIR/tsconfig.json" 2>&1 | grep -v "error TS" || true

  echo "📦  Bundling in load order..."
  {
    echo "/* BlackjackML bundle — compiled $(date -u '+%Y-%m-%dT%H:%M:%SZ') */"
    for f in constants utils Widget TopBar ActionPanel BettingPanel \
              SideBetPanel HandDisplay CardGrid StrategyRefTable \
              ShoePanel EdgeMeter SessionStats ShuffleTracker \
              CountHistory I18Panel LiveOverlayPanel CenterToolBar \
              SplitHandPanel SideCountPanel CasinoRiskMeter StopAlerts App; do
      echo "/* ── $f ── */"
      cat "$OUT_DIR/$f.js"
      echo ""
    done
  } > "$BUNDLE"

  echo "🔧  Fixing duplicate hook declarations..."
  # Each component file declares `const { useState } = React` for its own scope.
  # When concatenated into one file, duplicate `const` declarations cause a
  # SyntaxError. Convert all hook destructures to `var` which allows redeclaration.
  python3 - << 'PYEOF'
import re, sys
bundle = sys.argv[1]
with open(bundle) as f:
    src = f.read()
src = re.sub(
    r'const \{ ([\w,\s]+) \} = React;',
    lambda m: 'var ' + ', '.join(
        f'{h.strip()} = React.{h.strip()}' for h in m.group(1).split(',')
    ) + ';',
    src
)
# Also fix any regex literals that might look like comments to naive minifiers
# by converting /^https?:\/\// style patterns to string replacements in source
with open(bundle, 'w') as f:
    f.write(src)
print("  Hook declarations fixed")
PYEOF
  "$BUNDLE"

  echo "🗜️   Minifying..."
  node "$BUILD_DIR/minify.js"

  echo "🔍  Syntax checking..."
  node --check "$BUNDLE_MIN" && echo "✅  Build complete → app/static/bundle.min.js" || {
    echo "❌  Syntax error in bundle — check build output above"
    exit 1
  }
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

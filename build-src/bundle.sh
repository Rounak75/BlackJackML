#!/usr/bin/env bash
# Concatenate compiled JS in correct dependency order -> one bundle.js
OUT=/home/claude/blackjack-fixed/build-src/out
DEST=/home/claude/blackjack-fixed/app/static/bundle.js

echo "/* BlackjackML — pre-compiled bundle. Do not edit manually. */" > "$DEST"
echo "/* Generated: $(date -u) */" >> "$DEST"
echo "" >> "$DEST"

# Order: constants → utils → base components → panels → App
for f in \
  constants \
  utils \
  Widget \
  TopBar \
  ActionPanel \
  BettingPanel \
  SideBetPanel \
  HandDisplay \
  CardGrid \
  StrategyRefTable \
  ShoePanel \
  EdgeMeter \
  SessionStats \
  ShuffleTracker \
  CountHistory \
  I18Panel \
  LiveOverlayPanel \
  CenterToolBar \
  SplitHandPanel \
  SideCountPanel \
  CasinoRiskMeter \
  StopAlerts \
  App
do
  echo "/* ── $f ── */" >> "$DEST"
  cat "$OUT/$f.js" >> "$DEST"
  echo "" >> "$DEST"
done

echo "Bundle written: $(wc -c < "$DEST") bytes ($(wc -l < "$DEST") lines)"

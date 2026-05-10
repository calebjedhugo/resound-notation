#!/usr/bin/env bash
# Render a preset from the running vite dev server to a PNG via headless Chrome.
#
# Usage:
#   ./snap.sh <preset-name> [width]
#   ./snap.sh --all
#
# Requires: vite dev server running at http://127.0.0.1:5173 (npm run dev).
# Output:   /tmp/notation-snaps/<preset>.png

set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
HOST="http://127.0.0.1:5173"
OUT_DIR="/tmp/notation-snaps"
mkdir -p "$OUT_DIR"

# Confirm dev server is up.
if ! curl -fsS "$HOST/snap.html" -o /dev/null; then
  echo "dev server not reachable at $HOST — run 'npm run dev' in dev/ first" >&2
  exit 1
fi

snap_one() {
  local preset="$1"
  local width="${2:-800}"
  local url="$HOST/snap.html?preset=${preset}&width=${width}"
  local out="$OUT_DIR/${preset}.png"

  # Pass 1: render with a generously tall viewport and dump the DOM so we can
  # read the measured content size that snap.html stamps into <meta name="snap-size">.
  # The big initial height ensures the page lays out without artificial clipping
  # before measurement.
  local dom
  dom=$("$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --window-size=$((width + 40)),4000 \
    --virtual-time-budget=10000 \
    --dump-dom \
    "$url" 2>/dev/null || true)

  # Extract "WxH" from the meta tag; fall back to a sane default if missing.
  local size
  size=$(printf '%s' "$dom" | grep -o 'name="snap-size" content="[0-9]*x[0-9]*"' | head -1 | grep -o '[0-9]*x[0-9]*' || true)
  local win_w win_h
  if [[ -n "$size" ]]; then
    win_w="${size%x*}"
    win_h="${size#*x}"
    # Guarantee at least the requested width so narrow renders don't shrink the viewport.
    if (( win_w < width + 40 )); then win_w=$((width + 40)); fi
  else
    win_w=$((width + 40))
    win_h=900
  fi

  # Pass 2: screenshot at the measured size so the full content fits without clipping.
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --window-size=${win_w},${win_h} \
    --virtual-time-budget=10000 \
    --screenshot="$out" \
    "$url" >/dev/null 2>&1
  echo "$out"
}

if [[ "${1:-}" == "--all" ]]; then
  for f in presets/*.js; do
    name=$(basename "$f" .js)
    snap_one "$name" "${2:-800}"
  done
else
  snap_one "${1:-single-voice-treble}" "${2:-800}"
fi

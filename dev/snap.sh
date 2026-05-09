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
  # --virtual-time-budget gives JS time to fetch modules and render.
  # --window-size sets the headless viewport (height generous; we crop visually by content).
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --no-sandbox \
    --window-size=$((width + 40)),900 \
    --virtual-time-budget=4000 \
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

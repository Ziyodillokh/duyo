#!/bin/sh
# Start the local mock API and the app clone for a capture run.
#
# The app reads its API and voice addresses from EXPO_PUBLIC_* variables that
# Metro inlines at bundle time; left unset they default to api.duyo.uz. They
# are pinned here, the Metro cache is cleared so an older bundle cannot be
# served, and the first bundle is checked for the mock's address before this
# script returns. browser.mjs then walls off every other host as well.
#
# usage: sh start.sh      (stop.sh stops both)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
MOCK=http://127.0.0.1:9911
APP_PORT=8093

export EXPO_PUBLIC_API_BASE_URL="$MOCK/v1"
export EXPO_PUBLIC_WS_BASE_URL="ws://127.0.0.1:9911/v1/chat/voice"
unset EXPO_PUBLIC_UPDATE_MANIFEST_URL EXPO_PUBLIC_DISTRIBUTION 2>/dev/null || true

if ! curl -s -o /dev/null "$MOCK/v1/plans" 2>/dev/null; then
  nohup node "$HERE/mock-api.mjs" >> "$HERE/mock-stdout.log" 2>&1 &
  echo $! > "$HERE/.mock.pid"
fi

cd "$HERE/app"
CI=1 nohup npx expo start --web --port "$APP_PORT" --clear >> "$HERE/expo.log" 2>&1 &
echo $! > "$HERE/.expo.pid"

# Wait for Metro, then build the web bundle once and look inside it.
i=0
until curl -s -o /dev/null "http://localhost:$APP_PORT"; do
  i=$((i + 1)); [ "$i" -gt 120 ] && { echo "metro did not start" >&2; exit 1; }
  sleep 1
done
BUNDLE=$(curl -s "http://localhost:$APP_PORT" | grep -o 'src="[^"]*entry[^"]*"' | head -1 | sed 's/src="//; s/"$//')
curl -s "http://localhost:$APP_PORT$BUNDLE" -o "$HERE/.bundle.js"
if ! grep -q '"http://127.0.0.1:9911/v1"' "$HERE/.bundle.js"; then
  echo "bundle does not carry the mock API address — refusing to capture" >&2
  exit 1
fi
if ! grep -q '"ws://127.0.0.1:9911/v1/chat/voice"' "$HERE/.bundle.js"; then
  echo "bundle does not carry the mock voice address — refusing to capture" >&2
  exit 1
fi
rm -f "$HERE/.bundle.js"
echo "app on http://localhost:$APP_PORT, API and voice pinned to $MOCK"

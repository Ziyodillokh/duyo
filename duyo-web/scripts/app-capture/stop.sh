#!/bin/sh
# Stop what start.sh started.
HERE=$(cd "$(dirname "$0")" && pwd)
for f in .expo.pid .mock.pid; do
  if [ -f "$HERE/$f" ]; then
    pid=$(cat "$HERE/$f")
    pkill -P "$pid" 2>/dev/null
    kill "$pid" 2>/dev/null
    rm -f "$HERE/$f"
  fi
done
# Metro's workers outlive the npx wrapper.
pkill -f "expo start --web --port 8093" 2>/dev/null
pkill -f "capture/mock-api.mjs" 2>/dev/null
exit 0

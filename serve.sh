#!/usr/bin/env bash
# Atlas of Time — local dev server.
# ES modules need a real HTTP origin; opening index.html as a file:// URL
# will not work.
cd "$(dirname "$0")"
PORT="${1:-8899}"
echo "Atlas of Time  →  http://localhost:$PORT"
python3 -m http.server "$PORT" --bind 127.0.0.1

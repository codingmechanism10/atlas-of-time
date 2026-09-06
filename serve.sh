#!/usr/bin/env bash
# Atlas of Time — local dev server.
# ES modules need a real HTTP origin; opening index.html as a file:// URL
# will not work. Delegates to serve.py, which sends the cache headers the
# stock http.server does not.
cd "$(dirname "$0")"
exec python3 serve.py "$@"

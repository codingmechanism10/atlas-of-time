#!/usr/bin/env python3
"""Atlas of Time — local dev server.

Python's stock http.server sends Last-Modified and nothing else. With no
Cache-Control, browsers fall back to *heuristic* freshness and will happily
serve a stale module without revalidating — which produces the worst possible
failure for an app with no build step: a fresh app.js importing a cached
labels.js, and a "labels.setAncient is not a function" that looks like a code
bug and isn't.

So: code and markup always revalidate, data is allowed to sit in the cache,
and everything is served with the encoding and MIME type the browser needs.
"""
import argparse
import functools
import http.server
import os
import socketserver

# Long-lived: the geometry only changes when we regenerate it.
CACHEABLE = ("/data/", "/vendor/")
ONE_DAY = 86400


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".geojson": "application/geo+json",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        path = self.path.split("?", 1)[0]
        if any(path.startswith(p) for p in CACHEABLE):
            self.send_header("Cache-Control", f"public, max-age={ONE_DAY}")
        else:
            # no-cache means "you may keep it, but revalidate every time".
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        # One line per request is enough; skip the 200s for static noise.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("port", nargs="?", type=int, default=8899)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()

    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(Handler, directory=os.getcwd())
    with socketserver.ThreadingTCPServer((args.host, args.port), handler) as httpd:
        print(f"Atlas of Time  →  http://{args.host}:{args.port}")
        print("code revalidates every request; data/ and vendor/ cache for a day")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()

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

It also answers HTTP Range requests, which the stock handler does not. PMTiles
archives are read by fetching byte ranges out of a single large file; without
206 support a client silently pulls the whole archive on every tile lookup,
which defeats the entire point of the format.
"""
import argparse
import functools
import http.server
import os
import socketserver

# vendor/ is a pinned library — genuinely immutable. data/ is regenerated
# from upstream dumps now and then, so it must revalidate or a rebuild takes a
# day to reach anyone; a 304 skips the body, which is where the cost is.
CACHEABLE = ("/vendor/",)
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
        ".pmtiles": "application/octet-stream",
    }

    def send_head(self):
        """Serve a byte range when asked, so PMTiles archives work."""
        rng = self.headers.get("Range")
        if not rng or not rng.startswith("bytes="):
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        try:
            size = os.path.getsize(path)
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        try:
            first, _, last = rng[6:].partition("-")
            if first:
                start = int(first)
                end = int(last) if last else size - 1
            else:
                # A suffix range: the last N bytes. PMTiles uses these.
                start, end = max(0, size - int(last)), size - 1
        except ValueError:
            f.close()
            self.send_error(400, "Malformed Range header")
            return None

        if start >= size or start > end:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None

        end = min(end, size - 1)
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        return _Ranged(f, end - start + 1)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
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


class _Ranged:
    """Reads at most `remaining` bytes, so copyfile stops at the range end."""

    def __init__(self, fh, remaining):
        self.fh, self.remaining = fh, remaining

    def read(self, n=-1):
        if self.remaining <= 0:
            return b""
        if n is None or n < 0:
            n = self.remaining
        data = self.fh.read(min(n, self.remaining))
        self.remaining -= len(data)
        return data

    def close(self):
        self.fh.close()


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

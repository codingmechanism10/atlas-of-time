# ADR 0001 — Static GeoJSON vs vector tiles

*Status: **accepted**. Decided by Claude as engineering lead, 2026-09-15,
under Nippun's standing delegation of engineering direction.*

## The question

Two goals push on the same constraint:

1. **"People will expect it to work like Google Maps"** — states, counties,
   tens of thousands of settlements at the 2026 stop.
2. **Mobile has to be good**, and a good share of portfolio traffic is phones
   on cellular.

Today every layer is a whole-world GeoJSON file fetched in full. Can that
reach the target, or do we need tiles?

## Where we actually are

Measured 2026-09-15, gzipped, on the current build:

| Stage | Payload (gz) | Verdict |
|---|---|---|
| **Boot** — MapLibre, CSS, modules, base geography, present-day borders | **702 KB** | Healthy. Comparable to an ordinary content site. |
| All 54 era snapshots combined | 1 MB total (median 10 KB each) | Cheap. Cached after first visit. |
| **Deep-zoom tier** — land10, rivers10, lakes10, admin1, pleiades-all | **4.4 MB** | **This is the problem.** |

The headline finding is that **boot is fine**. The app is not uniformly heavy.
The weight is concentrated entirely past z6, and it has a specific shape:

> **You download the whole planet to look at one place.** Zooming into Greece
> pulls the 10 m coastline of every continent, every river worldwide, and all
> 32,878 Pleiades records. On 4G that is roughly 4–7 seconds of blank waiting
> for data that is 99% off-screen.

## What the requested fidelity would cost

The asked-for 2026 coverage, as GeoJSON:

- **geoBoundaries ADM2** — ~50,000 districts worldwide. Rough order: 15–30 MB
  gzipped even after aggressive simplification.
- **GeoNames settlements >5,000 people** — ~70,000 points, several MB.
- Roads or POIs at any useful density — tens of MB, not viable at all.

Adding these to a whole-file architecture takes the deep-zoom tier from
"marginal on cellular" to "broken". GeoJSON does not get us to the stated goal.

## Options

**A. Stay on static GeoJSON.**
Keeps the no-build purity. Costs: the fidelity goal is unreachable, and mobile
stays mediocre past z6. Rejected — it fails the stated outcome.

**B. Move everything to vector tiles (PMTiles).**
PMTiles is a single-file tile archive read over HTTP Range requests: no tile
server, still static hosting, MapLibre reads it through a protocol handler.
Only tiles in view are fetched. Solves both goals at once.

Costs, honestly: it introduces a **build pipeline** (tippecanoe → pmtiles),
which breaks the project's no-build identity. And it fits the *time-varying*
data badly — 54 era snapshots would mean 54 tilesets or a custom time
dimension, for data that is already cheap (10 KB median). Tiling Pleiades
loses the era-filtering we do in JS.

**C. Hybrid — tiles for static reference geography, GeoJSON for time.**
Split on whether the data varies with the timeline.

- **Tiles**: coastlines, rivers, lakes, admin-1, admin-2, settlements — the
  reference basemap. Large, static, spatially indexed, only ever needed in
  view. Exactly what tiles are for.
- **GeoJSON**: era boundary snapshots, Pleiades, routes, seeded places. Small,
  time-varying, needs whole-dataset era filtering in JS, and carries the
  provenance metadata that makes this project what it is.

## Spike results

Before deciding, I built a real PMTiles archive from our own `admin1` layer and
measured it. Three findings, all of which changed my confidence.

**1. The standard toolchain is unavailable here — and it does not matter.**
No brew, no node, no tippecanoe, no GDAL on this machine. But `shapely`,
`mapbox-vector-tile` and `pmtiles` all install from pip into a venv, and a
~140-line pure-Python tiler produced a valid archive. The pipeline has no
system dependencies we cannot satisfy.

    admin1.geojson  4,149 features  →  3,173 tiles, z0–6, 2,143 KB archive
    (reads back cleanly; 2,342 deduplicated entries)

**2. The archive is bigger in total, and that is irrelevant.** 2,143 KB against
683 KB gzipped for the whole file, because tiles repeat geometry across zooms.
Nobody ever fetches it all. The number that matters is bytes per viewport:

| Region (3×4 tiles) | z4 | z6 |
|---|---|---|
| Greece / Aegean | 111.9 KB | **19.9 KB** |
| Rhineland | 120.5 KB | **28.9 KB** |
| Bay of Bengal | 45.8 KB | **9.8 KB** |
| US Midwest | 38.7 KB | **5.9 KB** |
| Sahara (sparse) | 117.5 KB | **7.2 KB** |
| **mean** | **86.9 KB** | **14.3 KB** |

Against 683 KB fetched in full, every time: **roughly 48× less data to look at
one place at z6**, 8× at z4. And it degrades gracefully — sparse regions cost
almost nothing, which whole-file GeoJSON cannot do.

Caveat: my tiler is naive next to tippecanoe — no feature dropping, no proper
generalisation. Real tooling would likely do better, so treat these as a floor.

**3. Range requests were broken on our own server.** `SimpleHTTPRequestHandler`
ignores `Range` and returns 200 with the entire body, which would have made
PMTiles *worse* than GeoJSON — a full 2.1 MB download per tile lookup. Fixed in
`serve.py` (206, `Content-Range`, suffix ranges, `Accept-Ranges`), verified.
This is exactly the kind of thing that would have been discovered late and
blamed on the format.

## Decision

**Accepted: C, the hybrid.**

It is the only option that reaches the fidelity goal and fixes mobile, while
keeping the parts of the architecture that are genuinely load-bearing. The
no-build constraint survives where it matters — the app still ships as static
files with no bundler; the build is an *offline data pipeline* we run when
regenerating sources, which we already have in spirit (the Natural Earth and
Pleiades converters are exactly this).

Boot stays as it is. The 4.4 MB deep-zoom tier disappears, replaced by tiles
fetched per view. Headroom to add ADM2 and 70k settlements without the
architecture fighting back.

## Consequences

- A data pipeline becomes a real, checked-in thing (`tools/`), with the
  converters we already wrote folded into it.
- `detail.js` loses its lazy-tier machinery for the tiled layers; the tier
  logic moves into tile zoom ranges.
- Hosting must support HTTP Range requests. Cloudflare R2, S3, Netlify and
  Vercel all do; worth verifying on whichever we pick.
- Attribution must survive the transition — a tiled layer still has to carry
  its source into the UI. This is the main provenance risk and needs care.
- One-way-ish: reverting means regenerating GeoJSON. Not fatal, but not free.

## Amendment, 2026-09-16 — Cloudflare Pages does not serve Range

Measured against the live deployment at `atlas-of-time.pages.dev`. **Pages
ignores `Range` entirely.** Every form returns `200` with the whole body and no
`Accept-Ranges` header:

| Asset | Request | Result |
|---|---|---|
| `src/app.js` | `bytes=0-511` | 200, full 18 KB |
| `vendor/maplibre-gl.js` | `bytes=0-511` | 200, full 1.0 MB |
| `data/base/land10.geojson` | `bytes=0-511` | 200, full 3.9 MB |
| `range-probe.pmtiles` | `bytes=0-16383` | 200, full 182 KB |
| `range-probe.pmtiles` | suffix `bytes=-1024` | 200, full 182 KB |

Tested with a genuine PMTiles archive served as `application/octet-stream`, and
with `Accept-Encoding: identity` to rule out compression interfering. It is not
a content-type or a compression problem — Pages simply does not implement it.

Without Range, PMTiles is strictly **worse** than whole-file GeoJSON: every tile
lookup would pull the entire archive.

**This does not change the decision, it changes where the tiles live.** The
hybrid split still holds; the archives cannot sit in the Pages deployment.

**Revised plan: PMTiles on Cloudflare R2.** R2 is S3-compatible object storage
with native Range support, and is the documented way to serve PMTiles on
Cloudflare. Its free tier is 10 GB with **zero egress cost**, which also
reinforces the bandwidth argument that picked Cloudflare originally. The app
stays on Pages; tiles are fetched cross-origin from R2.

What this implies:
- An R2 bucket with **CORS configured to allow the `Range` header** — the
  cross-origin preflight is the next thing likely to bite.
- Tile uploads become a deploy step separate from `git push`.
- Stated plainly: **R2 Range support is documented but not yet measured by us.**
  Pages advertised nothing and delivered nothing, so verify before building on it.

Two traps recorded for whoever tests this next:
- Pages returns **200 with `index.html`** for unknown paths, so "did it deploy"
  cannot be judged by status code. Compare body size against a deliberately
  nonsensical path. This cost a cycle here.
- Deploys take **1–2 minutes**. A check at 15 seconds reads the fallback and
  looks like failure.

## Still unverified

- **R2 Range support, and `Range` CORS preflight.** Now the critical path.
- **MapLibre + `pmtiles` under the globe projection.** The protocol handler is
  well-trodden for Mercator; the globe projection is newer.

Both block shipping the tile pipeline.

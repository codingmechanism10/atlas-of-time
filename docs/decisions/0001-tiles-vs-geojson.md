# ADR 0001 — Static GeoJSON vs vector tiles

*Status: **proposed**, awaiting Nippun. Date: 2026-09-15.*

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

## Decision

**Recommend C, the hybrid.**

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

## Not yet verified

Before committing, confirm with real numbers rather than estimates:

- Size of a self-built PMTiles archive for *our* layers only (not the full
  Protomaps planet basemap, which is far larger than we need).
- That MapLibre + `pmtiles` handles Range requests correctly under the globe
  projection.
- Whether the chosen host serves Range requests without a CORS problem.

These are a day of spiking, and should happen before the pipeline work starts.

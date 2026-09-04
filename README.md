# Atlas of Time

An interactive globe you can fall into. Spin it, zoom until it flattens into an
atlas, scrub a timeline from 123,000 BCE to the present and watch borders and
coastlines redraw, then click a place to read who lived there.

Built as a vertical slice, now filled out: the map, the timeline, the panel and
the routes are all real and wired to real data. Eight places have hand-seeded
history; everywhere else, a click runs a live Wikipedia + Wikidata lookup, and
— if you add an API key — a model writes the era dossier from what it finds.

---

## Running it

```bash
./serve.sh          # → http://localhost:8899
```

Any static server works. It has to be served over HTTP — the app uses ES
modules, so opening `index.html` from the filesystem will not work.

No build step, no npm install. Still no API key required: the grounded lookup
in every field note is keyless. The optional model-written dossier needs an
Anthropic key, pasted into the panel behind **Set API key** — it lives in your
browser's `localStorage` and is sent only to `api.anthropic.com`.

---

## What's actually in here

**The globe → atlas transition** is MapLibre GL JS 5's globe projection. It uses
an adaptive composite projection: sphere when you're out, Mercator when you're
in, with the transition handled for you. This is the same behaviour as Google
Maps and it costs one line in the style.

**The timeline** is wired to
[aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps),
a georeferenced collection of world political and cultural boundaries. 53 of its
snapshots ship here, simplified, in `data/eras/`, from 123,000 BCE to 2010 —
that repository's most recent map. The present-day stop, `world_2025.geojson`,
is built separately from Natural Earth's 110 m admin-0 countries (same schema,
same Douglas-Peucker treatment) so "today" reflects South Sudan, the post-2014
map and current names rather than the 2010 borders. Four extra stops
(40,000 / 20,000 / 14,000 / 12,000 BCE) carry a sea-level estimate with no
boundary data, because none exists that far back and pretending otherwise would
be a lie.

**The paleo-coastline** is DEM-based now. A MapLibre `color-relief` layer
(`paleo-sea` in `src/style.js`) reads the same Mapzen elevation tiles the 3D
relief uses and floods everything below the selected era's sea level; the ramp
is rewritten every time the timeline moves (`applySeaLevel` in `src/app.js`).
Scrub to the Last Glacial Maximum and Doggerland, Sundaland, Beringia and the
Sahul shelf emerge from their *actual* topography — anything between about
−130 m and 0 — not from a single hand-drawn contour. The modern coastline and
the shallow-water tint fade out as the sea drops so the DEM-drawn coast is the
one you read. If the elevation tiles are unreachable it falls back to the old
proxy: the 0–200 m continental-shelf polygon, shown as water or dry ground.

The sea-level curve in `src/eras.js` is resampled from published
reconstructions — Spratt & Lisiecki 2016 and Lambeck et al. 2014 — so the
timing is right: the Eemian highstand near +7 m at ~125 ka, the ~−130 m floor
at the LGM, Meltwater Pulse 1A around 14.5 ka, the Younger Dryas pause. It is
still one global curve and hides big regional differences from glacial isostasy;
treat it as indicative, as the UI says.

**Routes and movement** (`src/routes.js`, `data/routes.json`) are seven coarse
schematic corridors — Out of Africa, the Austronesian expansion, the Silk Road,
the maritime spice route, trans-Saharan routes, the Columbian exchange, the
transatlantic slave trade — each with a `from`/`to` window, so the visible set
tracks the timeline. Toggle them from the gazetteer; click a line to read what
it was. They are drawn as a handful of waypoints each: "this corridor mattered",
not surveyed roads.

**Live dossiers.** Clicking anywhere with no seeded entry still gives a field
note — mapped polity, the source data's boundary-confidence value, physiographic
region, sea level, period — but it now also runs a keyless lookup against
Wikipedia geosearch, the Wikipedia REST summary API and Wikidata
(`src/lookup.js`), all CORS, cached in `localStorage`. You get the nearest
article with its extract, its Wikidata facts, and the other named places within
10 km with bearings. If an Anthropic key is set, a **Write the era dossier**
button hands that grounding to a model (`src/narrate.js`) which writes in the
house voice; the result is cached by place + era. No key, no change.

**Close-up fidelity** is handled by `src/detail.js`, which loads nothing until
you descend. Past z3.2 a Natural Earth 50 m coastline swaps in under the coarse
globe polygon — same fill colour, coarse layers retired by zoom range, so the
handover is invisible but fjords, deltas and island chains resolve. Past z3.6
you also get 4,149 states and provinces worldwide (NE 10 m, 2.4 MB, ~683 KB
gzipped). Cities arrive as a third HTML label class with a dot, rank-gated as
you zoom.

Both of those last two are **present-day** data, so they are era-gated:
provinces from 1900, cities from 1800, and the app says out loud that the
internal boundaries are reference rather than reconstruction the first time
they appear. This is the honest ceiling on the "make it look like Google Maps"
ask — for deep history, sub-national boundaries and settlement gazetteers have
simply never been digitised globally. The territory polygons are the best that
exists, and they get vaguer the further back you scrub.

**Ambience** (`src/ambience.js`) is a drone plus a slow scatter of notes,
synthesised in the browser from oscillators and noise. No samples, no
streaming, nothing bundled. Eleven regions each carry their own tuning system,
tonic, timbre and density — Yaman over a tanpura-ish fifth in South Asia, Hijaz
around the eastern Mediterranean, a deliberately non-12TET near-equidistant
pentatonic and inharmonic struck metal for maritime Southeast Asia, mbira-like
tines with buzz for sub-Saharan Africa. Region is picked by nearest of several
anchors, so Mongolia lands on the steppe and Cairo on West Asia. It is
**evocative synthesis, not authentic music** — not recordings, not traditional
repertoire — and the app says so the first time you turn it on. Off by default.

**The timeline handle** is a brass grip with a knurled waist and a real hit
area, and every stop you cross fires a detent: `navigator.vibrate` where the
platform allows it (Android Chrome; iOS Safari exposes nothing), a synthesised
wooden click through WebAudio so desktop gets feedback too, and a
squash-and-stretch nudge on the grip. Ends of time and stops with no boundary
data get the heavier notch, so the ruler isn't uniform under the thumb.
Respects `prefers-reduced-motion`.

**Labels are HTML, not GL.** No SDF glyph tiles, no glyph server, no baked-in
font — which means real serif type with real letter-spacing and small-caps, and
a collision resolver we control (`src/labels.js`). It reserves the UI chrome's
own footprint so nothing slides under the title or the panel, and round-trips
every candidate through `unproject` to catch points on the far side of the globe
that would otherwise project to a plausible on-screen position.

**Relief** comes from Mapzen/AWS terrain tiles, which are free and need no key.
If they're unreachable the app drops the hillshade and 3D terrain and carries on
as a flat atlas — you'll see a "relief tiles unreachable" note. To use a
different provider, edit the `dem` source in `src/style.js`; MapTiler's free tier
is a drop-in replacement.

---

## Adding a place

`data/places.json` is the whole content model. One entry per place:

```json
"ladakh": {
  "name": "Ladakh",
  "subtitle": "shown under the title",
  "center": [77.58, 34.16],          // lng, lat — used to match clicks
  "radiusKm": 300,                    // click within this and you get the dossier
  "flyTo": { "center": [...], "zoom": 6.3, "pitch": 50, "bearing": -20 },
  "geology": "<h4>…</h4><p>…</p>",   // always appended, era-independent
  "entries": [
    { "from": -200000, "to": -8000, "title": "…", "body": "<p>…</p>" }
  ]
}
```

`entries` are matched by `from <= year < to`; the last entry is the fallback.
Bodies are HTML. Useful classes: `.lede` for an opening line, `.fact` for a
pulled-out fact with a rule, `.caution` for "this is contested".

Add the place to `data/places.json`, then add a button in `index.html`:

```html
<button class="gbtn" data-place="yourkey">Your Place</button>
```

The eight seeded now: Ladakh, Doggerland, Cappadocia, Sundaland, southern
Mesopotamia, Great Zimbabwe, Cahokia, the Aral Sea.

---

## Where this goes next

The live-dossier pipeline, the routes layer and the DEM paleo-coastline are in.
What's left from the original list:

- **Pleiades.** The grounded lookup uses Wikipedia + Wikidata; adding the
  [Pleiades](https://pleiades.stoa.org) gazetteer would sharpen the classical
  world specifically. No CORS-friendly spatial endpoint, so it needs a small
  proxy or a bundled extract.
- **A dossier proxy.** The model call goes straight from the browser with the
  user's key. A tiny serverless function would let the site ship its own key,
  add a shared cache, and drop the `dangerous-direct-browser-access` header.
- **Deeper time.** [GPlates](https://www.gplates.org) reconstructions push the
  map back tens of millions of years, into continents in different places
  entirely. Different data model, worth its own pass.
- **Sharper paleo-coastlines.** `color-relief` on the Mapzen tiles is real DEM
  thresholding but the tiles top out at ~z12 and terrarium precision is 1 m
  steps; a purpose-built low-res bathymetric grid (GEBCO) would do better in the
  0 to −130 m band that matters here.
- **Two-player.** Shared cursor and shared timeline position — not a big feature.

---

## Controls

| | |
|---|---|
| scroll / pinch | zoom — the globe flattens on the way in |
| drag | pan |
| right-drag / ctrl-drag | tilt and rotate |
| ← / → | step through the timeline |
| Home / End | jump to either end of time |
| click the map | dossier, or a field note with a live lookup |
| Routes & movement | toggle the trade / migration corridors; click a line to read it |
| Ambience | synthesised regional drone, off by default |
| Wander | fly somewhere worth looking at |
| Set API key | paste an Anthropic key for model-written era dossiers (optional) |

---

## Data and credits

- Historical boundaries — [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps); present-day borders from [Natural Earth](https://www.naturalearthdata.com) 110 m admin-0
- Coastlines, lakes, rivers, physiography, bathymetry — [Natural Earth](https://www.naturalearthdata.com) (public domain)
- Relief — Mapzen / AWS Terrain Tiles
- Rendering — [MapLibre GL JS](https://maplibre.org) 5.24 (vendored in `vendor/`)

Boundary reconstructions for deep history are interpretations, and cartographers
disagree with one another. The further back you scrub, the more a polygon means
"roughly this cultural sphere" than "this border". Several regions on the modern
map — Ladakh among them — are actively disputed. The app says so where it
matters, and so should anything built on top of it.

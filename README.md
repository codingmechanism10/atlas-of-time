# Atlas of Time

An interactive globe you can fall into. Spin it, zoom until it flattens into an
atlas, scrub a timeline from 123,000 BCE to the present and watch borders and
coastlines redraw, then click a place to read who lived there.

Built as a vertical slice: the map, the timeline and the panel are all real and
wired to real data. The history writing is hand-seeded for three places so you
can see the finished shape before committing to a live content pipeline.

---

## Running it

```bash
./serve.sh          # → http://localhost:8899
```

Any static server works. It has to be served over HTTP — the app uses ES
modules, so opening `index.html` from the filesystem will not work.

No build step, no npm install, no API keys.

---

## What's actually in here

**The globe → atlas transition** is MapLibre GL JS 5's globe projection. It uses
an adaptive composite projection: sphere when you're out, Mercator when you're
in, with the transition handled for you. This is the same behaviour as Google
Maps and it costs one line in the style.

**The timeline** is wired to
[aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps),
a georeferenced collection of world political and cultural boundaries. 53 of its
snapshots ship here, simplified, in `data/eras/`. Four extra stops
(40,000 / 20,000 / 14,000 / 12,000 BCE) carry a sea-level estimate with no
boundary data, because none exists that far back and pretending otherwise would
be a lie.

**The sea-level effect** is the cheapest impressive thing in the project. The
continental shelf — the 0–200 m band, built by erasing Natural Earth's 200 m
bathymetry contour from its 0 m one — is rendered as water or as dry ground
depending on where the timeline sits. Scrub to the Last Glacial Maximum and
Doggerland, Sundaland, Beringia and the Sahul shelf all surface at once, because
they are all the same shallow-shelf effect.

The sea-level curve in `src/eras.js` is a coarse approximation: +6 m at the last
interglacial highstand, −125 m at the LGM, back to zero through the Holocene.
The shelf polygon is the 200 m contour rather than the ~125 m one the physics
wants, so treat the effect as indicative. It is labelled that way in the UI.

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

Clicking anywhere with no seeded dossier gives a field note instead: what the
map genuinely knows about that point (mapped polity, the source data's own
boundary-confidence value, physiographic region, sea level, period) plus a
copyable research prompt. That's the seam where the live pipeline goes.

---

## Where this goes next

The obvious next move is replacing hand-seeded dossiers with generated ones.
The shape that works: on click, hit Wikipedia geosearch + Wikidata + the
[Pleiades](https://pleiades.stoa.org) gazetteer for the coordinate, hand the
results and the selected era to a model, cache the answer keyed by
`place + era`. The field-note panel already prints the prompt for this. Grounding
it in a real lookup is what keeps it from confabulating, and caching is what
keeps it affordable — most clicks land on places someone has already opened.

Other threads worth pulling:

- **Deeper time.** [GPlates](https://www.gplates.org) reconstructions push the
  map back tens of millions of years, into continents in different places
  entirely. Different data model, worth its own pass.
- **Better paleo-coastlines.** A real DEM thresholded at the actual sea level
  for the selected year, instead of the single 200 m contour used here.
- **Trade routes and movement.** Static borders undersell it; the Silk Road,
  Austronesian expansion and the Columbian exchange are all line data.
- **Two-player.** He said it himself — half the fun is doing this on a call with
  someone. Shared cursor and shared timeline position is not a big feature.

---

## Controls

| | |
|---|---|
| scroll / pinch | zoom — the globe flattens on the way in |
| drag | pan |
| right-drag / ctrl-drag | tilt and rotate |
| ← / → | step through the timeline |
| Home / End | jump to either end of time |
| click the map | dossier or field note |
| Wander | fly somewhere worth looking at |

---

## Data and credits

- Historical boundaries — [aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps)
- Coastlines, lakes, rivers, physiography, bathymetry — [Natural Earth](https://www.naturalearthdata.com) (public domain)
- Relief — Mapzen / AWS Terrain Tiles
- Rendering — [MapLibre GL JS](https://maplibre.org) 5.24 (vendored in `vendor/`)

Boundary reconstructions for deep history are interpretations, and cartographers
disagree with one another. The further back you scrub, the more a polygon means
"roughly this cultural sphere" than "this border". Several regions on the modern
map — Ladakh among them — are actively disputed. The app says so where it
matters, and so should anything built on top of it.

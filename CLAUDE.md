# Atlas of Time — working agreement

An interactive historical globe. Scrub a timeline across deep time and watch
borders, coastlines and settlement redraw; click anything to read what is
known about it. Static site, no build step, ES modules, MapLibre vendored.

This file is loaded every session. Keep it dense and current; delete anything
that stops being true.

---

## 1. The one rule: nothing asserts without provenance

This is the project's whole reason to exist and its defence against being
"another map site". Every claim on screen must declare what kind of claim it
is and where it came from.

- **Fetched records** (Pleiades, Wikipedia, Wikidata) carry a link to the
  source and, where the source has one, its own citation.
- **Hand-written prose** carries the works it was written from, and says
  plainly that it is not peer-reviewed.
- **Model-written text** is handed a source-tagged grounding block, may not
  assert anything outside it, must wrap general background in
  `<span class="gen">` so it renders visibly shaded, and is always shown with
  the list of records the model actually saw.
- **Present-day data on a historical map is a lie unless gated.** Modern
  provinces are era-gated to 1900+, modern cities to 1800+, and both are
  labelled reference rather than reconstruction.
- **Uncertainty is content, not an embarrassment.** "No boundary
  reconstruction exists this far back" is a better answer than a plausible
  polygon. Say it in the UI.

When adding any layer, the provenance work is part of the feature, not a
follow-up.

## 2. Experience principles

1. **The map is the interface.** Chrome retreats; the globe is what you
   touch. No modal that could have been an overlay.
2. **Every pixel should be clickable or clearly inert.** Ambiguity about what
   responds is the main thing that makes a map feel dead.
3. **Time is a material, not a filter.** Scrubbing should feel physical —
   detents, weight, momentum — not like changing a dropdown.
4. **Emptiness is information.** Deep time has less to click. Do not pad it
   with invention; make the sparseness legible and intentional.
5. **It should reward a stranger in ten seconds and a nerd for an hour.**
   Someone arriving from a portfolio link gets no onboarding and no context.
6. **Quiet by default.** Nothing autoplays, nothing nags, nothing pops.

## 3. Engineering standards

- **No build step.** ES modules served directly. This is a real constraint
  and a real virtue; breaking it needs an ADR.
- **Degrade, never hang.** Every fetch goes through `fetchJSON` in `app.js`.
  Optional data returning null must leave a working map. The boot sequence is
  wrapped and has a 12s timeout that reveals the map regardless.
- **Lazy by zoom and era.** Nothing heavy loads until the view needs it. See
  `detail.js` for the tier pattern.
- **Version every cache key.** `localStorage` records outlive schema changes.
  `lookup.js` uses `atlas.ground.v2.` and evicts older prefixes. A stale cache
  silently hid the entire image feature once — do not repeat it.
- **Comment the why, not the what.** Match the surrounding density.

## 4. Known traps

- **`python3 -m http.server` sends no `Cache-Control`**, so browsers
  heuristically cache modules and will serve a fresh `app.js` against a stale
  `labels.js`. Always use `./serve.sh` (→ `serve.py`). `_headers`,
  `vercel.json` carry the same policy to hosting.
- **The in-app Browser pane cannot be trusted for visual QA.** It flips to
  `visibilityState: 'hidden'`, which pauses MapLibre's render loop so
  `map.on('load')` never fires and `window.atlas` stays undefined. Verify at
  module level — import modules, instantiate classes, measure audio through an
  `OfflineAudioContext` — and ask Nippun to look in a real browser.
- **MapLibre only watches `window.resize`.** A container that changes size
  leaves the GL canvas stale (globe in a corner, HTML labels spread across the
  full width). `ResizeObserver` + `visibilitychange` in `app.js` handles it;
  do not coalesce it through `requestAnimationFrame`, which is suspended while
  hidden.
- **iOS Safari exposes no vibration API.** Haptics are visual + audio only
  there. Not a bug; do not "fix" it.

## 5. Working agreement

Nippun is a product designer and owns the experience. Bring the delivery,
engineering and product lenses; state a recommendation rather than a menu, and
say when you disagree. Decisions that will otherwise be relitigated go in
`docs/decisions/` as an ADR.

"**go**" means: start the dev server in a background Bash process and open
`http://localhost:8899` in the Browser pane.

## 6. Layout

```
index.html          all CSS, all markup
src/                ES modules — app, style, eras, timeline, labels,
                    dossier, lookup, narrate, routes, ancient, detail,
                    ambience, haptics, settings
data/base/          Natural Earth reference geography, tiered by zoom
data/eras/          54 boundary snapshots, 123,000 BCE → 2025 CE
data/ancient/       Pleiades gazetteer, two lazy tiers
docs/               product brief, roadmap, decisions
```

# Product brief

*Owner: Nippun (design + product). Status: draft for review. Last updated 2026-09-15.*

## The outcome

A live, public interactive historical atlas, linked from Nippun's portfolio,
that a stranger can land on and immediately fall into — and that a specialist
can interrogate without catching it lying.

Success is **not** revenue in this phase. It is that the thing is good enough
to put your name next to, and that people who find it come back.

## What it is

Scrub a timeline across deep time. Borders, coastlines, trade routes and
settlement redraw as you move. Click anything — a territory, an ancient city,
an empty stretch of coast — and read what is actually known about that point at
that moment, with its sources attached.

Three things make it different from the existing field (Running Reality,
Chronas, ORBIS, GeaCron, Ancient Earth):

1. **Provenance is the product.** Every claim declares its source and its
   confidence. Most historical maps assert; this one cites.
2. **Time-aware settlement.** Places appear and vanish on their real
   attestation ranges, not as a modern point layer pretending to be ancient.
3. **The coastline is computed, not drawn.** Real elevation data flooded to
   each era's reconstructed sea level, so Doggerland and Sundaland emerge from
   actual topography.

## Who it is for

**Primary — the curious drifter.** Arrives from a link, no context, no
onboarding. Wants to be captivated in ten seconds. Most traffic. Judges the
product entirely on first-run feel.

**Secondary — the returning nerd.** Worldbuilders, history readers, teachers,
students. The people who might come back weekly. Retention lives here, and
they are the ones who notice when something is fudged.

**Tertiary — the professional eye.** Hiring managers, peers, potential
collaborators reaching it from the portfolio. Judges craft, not content depth.

## Success metrics

Phase 1 is about learning whether this is a curio or a habit.

| Metric | Why it matters | Target |
|---|---|---|
| Day-7 return rate | Is this a habit or a once-and-done? Determines whether a business exists at all. | Establish a baseline first |
| Median session length | Proxy for "fell into it" | > 3 min |
| Interactions per session | Are people clicking, or just looking? | > 5 |
| Mobile share + mobile bounce | Portfolio traffic skews phone; a bad mobile experience wastes the link | Mobile bounce within 10pts of desktop |
| Deep-time engagement | Does the headline feature actually get used? | % of sessions scrubbing before 10,000 BCE |

We ship instrumented from day one, privacy-respecting (no personal data, no
third-party ad trackers). Numbers we cannot act on are not worth collecting.

## Non-goals

Naming these now so we stop reconsidering them.

- **Not a native app.** Responsive web + PWA. Distribution is a shareable
  link; app-store friction defeats the point. (Cost: no haptics on iOS.)
- **Not a paid product in this phase.** A paywall directly destroys the
  portfolio value, and we have no retention data to price against. See
  `decisions/0002-monetisation.md`.
- **Not an academic instrument.** Sources are cited, but this is not
  peer-reviewed and says so. Do not let it drift into claiming authority it
  has not earned.
- **Not a general-purpose map.** No routing, no search-for-a-restaurant, no
  live data. Google Maps' *density* is a target; its *purpose* is not.
- **No user accounts, no user-generated content** in this phase.

## Open decisions

| Decision | Status | Where |
|---|---|---|
| Static GeoJSON vs vector tiles | **Needs decision — blocks fidelity + mobile** | `decisions/0001-tiles-vs-geojson.md` |
| Monetisation | Recommended: free, instrumented | `decisions/0002-monetisation.md` |
| Music approach | Deferred by Nippun | — |
| How far back the timeline goes | Proposed: ~300,000 BCE | `roadmap.md` M4 |

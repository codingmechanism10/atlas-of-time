# Roadmap

*To a public v1 linked from the portfolio. Status 2026-09-15.*

Sequenced, not dated — Nippun's availability sets the pace. Sizes are relative
(S ≈ a sitting, M ≈ a few, L ≈ a sustained push).

The ordering principle: **nothing ships to a public link until the first ten
seconds are right on a phone.** Fidelity and deep time are what make it
remarkable, but a stranger bouncing on mobile never reaches them.

---

## M0 — Decide *(blocks everything below)* · S — **DONE 2026-09-15**

- [x] **ADR 0001** — accepted: hybrid. Tiles for static reference geography,
      GeoJSON for time-varying data. Spiked with a real archive: 48× less data
      to view one region at z6. Pure-Python pipeline confirmed viable with no
      brew/node/tippecanoe. Range support added to `serve.py`, which did not
      have it.
- [x] **ADR 0002** — accepted by Nippun: free and instrumented.
- [ ] Music direction — **deferred by Nippun** until the world functions the
      way we want it to. Not blocking; moved to M5.

Two risks remain open from the spike and are carried into M3: MapLibre +
`pmtiles` under the *globe* projection is unproven, and production-host Range
support needs confirming on whichever host M1 picks.

---

## M1 — Live and measured · M

Get it public and start learning. Deliberately *before* the big features, so
the baseline exists.

- [ ] Choose a host and deploy. Verify the cache headers survive the move —
      module filenames never change, so code must revalidate. **Also verify
      HTTP Range support and `Range` CORS preflight**, which ADR 0001 now
      depends on.
- [ ] Privacy-respecting analytics: day-7 return, session length, interactions
      per session, mobile share and bounce, deep-time engagement.
- [ ] Error reporting, so failures in the wild are visible.
- [ ] Open Graph / share card. The link *is* the distribution.
- [ ] A real favicon and title. Currently neither is portfolio-grade.

**Done when:** a stranger can reach it at a stable URL and we can see what they
did.

---

## M2 — Worth landing on, especially on a phone · L

The highest-leverage milestone and the one most likely to be underestimated.

- [ ] **First-run experience.** Today it opens on a spinning globe with no
      indication that time is the point. A stranger with no onboarding needs
      to understand the premise within seconds — probably a brief, skippable
      motion into the timeline rather than a tutorial.
- [ ] **Mobile interaction design.** Touch targets, the timeline under a
      thumb, tapping labels, the bottom sheet. The CSS exists; the interaction
      design does not.
- [ ] **Mobile performance.** Depends on ADR 0001. Currently the deep-zoom
      tier is 4.4 MB gzipped and fetches the whole planet to look at one place.
- [ ] PWA: installable, offline shell, home-screen icon.
- [ ] Empty and error states that read as intentional.

**Done when:** mobile bounce is within 10 points of desktop, and someone who
has never seen it can explain what it does after thirty seconds.

---

## M3 — Maximum present-day fidelity · L

The "works like Google Maps" ask. Shape depends entirely on ADR 0001.

- [ ] **Build the tile pipeline** (`tools/`), folding in the existing Natural
      Earth and Pleiades converters. Close the two open risks from ADR 0001
      first: globe-projection rendering, and host Range support.
- [ ] **geoBoundaries ADM1 + ADM2** (CC BY) — ~50,000 districts worldwide.
      The single biggest clickability jump available.
- [ ] **GeoNames settlements** (CC BY) — filtered to >5,000 population,
      roughly 70,000 points.
- [ ] Make every one of them clickable into a dossier, with attribution
      carried through — the main provenance risk in a tiled architecture.

**Done when:** at the 2026 stop you can zoom to your own town and click it.

---

## M4 — Deep time to Homo sapiens · M

Extend the floor from 123,000 BCE to roughly **300,000 BCE** — anatomically
modern humans, Jebel Irhoud ≈ 315 ka.

What genuinely exists back there:

- **Sea level** — Spratt & Lisiecki 2016 runs to 800 ka, so coastlines
  breathing through four glacial cycles is *real data*, not invention. The
  DEM-flooding machinery already handles it.
- **Marine Isotope Stages** — well-defined, citable, a natural band rail.
- **The fossil and archaeological record** — Jebel Irhoud, Omo Kibish, Herto,
  Misliya, Skhul/Qafzeh, Denisova, Sima de los Huesos. Hand-seeded with
  citations, in the style of the existing seeded places.

No boundaries, correctly. The pitch is that the deeper you go the less there
is to click, and that emptiness is the point.

**Done when:** you can scrub to 300,000 BCE, watch the coast breathe across
glacial cycles, and click a real fossil site with its citation.

---

## M5 — Make it fun · M

- [ ] Music. Currently a synthesised regional *drone* — atmosphere, not music,
      and it undersells the idea. Direction deferred; see the options in
      conversation.
- [ ] Rename "Ambience" to something anyone would click.
- [ ] Motion and sound polish on the timeline; the detent is good, the rest of
      the app is silent.
- [ ] A reason to return. Currently there is none — this is the single biggest
      risk to day-7 retention and has no designed answer yet.

---

## M6 — Public launch · S

- [ ] Portfolio link live.
- [ ] A short, honest write-up on the site itself — what it is, what the
      sources are, what it does not claim.
- [ ] Share to the places that actually care: r/MapPorn, r/history,
      HN Show HN, cartography and history communities. Lead with the
      provenance angle, not the tech.

---

## Known risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **No reason to return** | Day-7 retention is the metric that decides whether this is a product or a demo. Nothing currently brings anyone back. | M5 needs a designed answer, not a polish pass. Treat as a design problem now. |
| **Mobile performance** | Portfolio traffic skews phone; 4.4 MB past z6 is a bad first impression | ADR 0001 → tiles |
| **First-run opacity** | It opens on a globe with no hint that time is the point | M2 |
| **Scope** | Fidelity, deep time, music and mobile are each large | M0/M1 first; resist starting M3 before M2 lands |
| **Provenance erosion under tiles** | Attribution is easy to lose when data moves into a tile pipeline | Explicit acceptance criterion in M3 |

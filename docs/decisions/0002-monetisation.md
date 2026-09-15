# ADR 0002 — Monetisation

*Status: **proposed**, awaiting Nippun. Date: 2026-09-15.*

## The question

Nippun asked: give users a few free goes, then charge annually — good idea, or
stay free to begin with?

## Context

- The product will be **linked from Nippun's portfolio**. That is the primary
  outcome; revenue is secondary at best.
- There is **no audience yet** and therefore no retention data.
- Nearly the whole product has **zero marginal cost** — static files on a CDN.
- The **one exception is the AI-written dossier**, which costs real money per
  generation. A bring-your-own-key path already exists.
- The underlying data is open: Pleiades (CC BY), Natural Earth (public
  domain), Wikipedia/Wikidata (CC BY-SA / CC0), historical-basemaps.

## Why metered exploration is the weakest option

**It caps the behaviour that creates the desire to pay.** The value here is
wandering. A meter interrupts the discovery loop before it has had time to
work.

**There is no urgency to convert against.** Nobody *needs* to know what was in
Ladakh in 1600. Curiosity does not push through a paywall; it leaves.

**The category default is free.** Running Reality, Chronas, ORBIS, David
Rumsey, Ancient Earth — essentially every comparable product is free or
academic. Not proof that nobody will pay, but it means charging for a wrapper
around openly-licensed data invites a question we would have to answer well.

**It directly damages the stated outcome.** Hiring managers and peers will not
pay to see your work. A paywall on the portfolio link defeats the link.

## Decision

**Free, public and instrumented, for at least two quarters.**

Revisit only when there is retention data to price against. If day-7 return is
weak, no price works and the answer is to improve the product, not to charge
for it.

**If anything is ever metered, it is AI dossiers, not exploration.** That is
the only feature with genuine marginal cost, which makes the limit honest
rather than artificial:

> Exploration is free and unlimited, forever.
> AI-written dossiers: N free, then bring your own key — or pay.

The BYO-key path already exists, so this is mostly a counter and a wall, not
new architecture.

## If a business does emerge later

Worth more investigation than consumer subscriptions, in rough order:

1. **Education / museum licensing** — institutions have budgets and a real job
   to be done. Longer sales cycle, much higher willingness to pay.
2. **Embeddable version** — an iframe or component for other people's sites,
   with attribution. Natural fit for a provenance-first product.
3. **Consumer subscription** — only if retention proves genuinely habitual.

## Consequences

- No billing, no accounts, no entitlement system to build in this phase. All
  of that engineering stays unspent.
- We must ship analytics early, or we end this phase knowing nothing.
  Privacy-respecting: no personal data, no third-party ad trackers.
- Licence compliance is not optional: CC BY sources require visible
  attribution, which the product already does as a design principle. Keep it
  that way — it is both the ethics and the differentiator.
- Hosting cost at expected traffic is near zero on a static CDN. There is no
  cost pressure forcing a decision.

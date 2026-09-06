// ancient.js — Pleiades, the ancient-world gazetteer.
//
// ~32,000 places from pleiades.stoa.org (CC-BY), each carrying the one thing
// a historical atlas actually needs and almost no gazetteer provides: an
// attestation range. Roma is -750..2100, Babylon -2000..1599, Ai Khanoum
// -330..2100. So places genuinely appear and vanish as you scrub, instead of
// a modern point layer pretending to be ancient.
//
// Two tiers, both lazy:
//   major (1,916 · 554 KB) once the timeline enters the covered range
//   all (31,949 · 4.4 MB)  only on a deep zoom, where the long tail is legible
//
// Coverage is the Barrington Atlas footprint — the Mediterranean, Europe, the
// Near East, North Africa, with thinner reach into Central and South Asia.
// It is not a world gazetteer, and the UI should not imply that it is.

const MAJOR = 'data/ancient/pleiades-major.json';
const ALL   = 'data/ancient/pleiades-all.json';

// Outside this the dataset has essentially nothing to say.
export const COVERED_FROM = -4000;
export const COVERED_TO   = 1600;

const F = { id:0, title:1, lng:2, lat:3, from:4, to:5, type:6, rank:7, desc:8, cite:9, prec:10 };

export class Ancient {
  constructor(){
    this.major = [];
    this.all = null;
    this.year = 2025;
    this.loading = {};
    this.attribution = null;
  }

  inRange(year = this.year){ return year >= COVERED_FROM && year <= COVERED_TO; }

  async ensure(tier){
    if (this.loading[tier]) return this.loading[tier];
    this.loading[tier] = (async () => {
      try {
        const j = await (await fetch(tier === 'all' ? ALL : MAJOR)).json();
        this.attribution = j.source;
        const rows = j.places.map(p => ({
          id: p[F.id], text: p[F.title],
          lngLat: [p[F.lng], p[F.lat]],
          from: p[F.from], to: p[F.to],
          type: p[F.type], rank: p[F.rank],
          desc: p[F.desc] || '', cite: p[F.cite] || '',
          prec: p[F.prec] || 'precise',
          kind: 'ancient',
        }));
        if (tier === 'all') this.all = rows; else this.major = rows;
      } catch (_) {
        if (tier === 'all') this.all = []; else this.major = [];
      }
    })();
    return this.loading[tier];
  }

  // Everything attested at `year`, ranked in, capped. The caller (labels.js)
  // still collision-resolves; this just decides who is eligible.
  visible(year, zoom){
    if (!this.inRange(year)) return [];
    const deep = zoom >= 6;
    const pool = (deep && this.all) ? this.all : this.major;
    if (!pool.length) return [];
    // Rank gate widens as you descend: at z3 only rank 0, by z8 everything.
    const maxRank = Math.max(0, Math.min(7, (zoom - 3.0) * 1.35));
    const out = [];
    for (const p of pool){
      if (p.rank > maxRank) continue;
      if (year < p.from || year > p.to) continue;
      out.push(p);
    }
    return out;
  }

  // Nearest place to a click, within `withinPx` on screen.
  pick(map, point, year, zoom, withinPx = 22){
    let best = null, bd = withinPx * withinPx;
    for (const p of this.visible(year, zoom)){
      const q = map.project(p.lngLat);
      const d = (q.x - point.x) ** 2 + (q.y - point.y) ** 2;
      if (d < bd){ bd = d; best = p; }
    }
    return best;
  }
}

// Pleiades ids are also its URIs — every record is citable.
export function pleiadesUrl(id){ return `https://pleiades.stoa.org/places/${id}`; }

export function formatSpan(from, to){
  const y = (v) => v < 0 ? `${Math.abs(v).toLocaleString('en-US')} BCE`
                         : `${v.toLocaleString('en-US')} CE`;
  // 2100/2099 is the dataset's way of saying "and still".
  if (to >= 2099) return `attested from ${y(from)}, still extant`;
  return `attested ${y(from)} – ${y(to)}`;
}

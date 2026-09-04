// dossier.js — the panel.
//
// Three modes now:
//   1. A seeded place — hand-written, sourced history for the selected era.
//   2. A field note anywhere else — everything the map itself knows about the
//      spot, plus a grounded lookup (Wikipedia + Wikidata, no key) filled in
//      asynchronously.
//   3. On top of the field note, if an API key is set, a model-written era
//      dossier built from that same grounding (see narrate.js).
//
// The seam between hand-seeded and generated is deliberately still visible.

import { formatYear, bandFor, seaLevelAt } from './eras.js';
import { groundCoordinate, bearing, formatKm } from './lookup.js';
import { hasKey, narrateDossier, cachedDossier } from './narrate.js';

const el = {
  root  : document.getElementById('dossier'),
  kicker: document.getElementById('d-kicker'),
  title : document.getElementById('d-title'),
  sub   : document.getElementById('d-sub'),
  era   : document.getElementById('d-era'),
  body  : document.getElementById('d-body'),
};

document.getElementById('d-close').onclick = () => close();

export function close(){ el.root.classList.remove('open'); }
export function isOpen(){ return el.root.classList.contains('open'); }

function open(){ el.root.classList.add('open'); el.body.scrollTop = 0; }

function eraChip(stop){
  const f = formatYear(stop.y);
  return `${f.n} ${f.era} — ${stop.label}`;
}

// A click that lands while a lookup is still running should abandon it.
let fieldToken = 0;

// ---------------------------------------------------------------- seeded place

export function showPlace(place, stop){
  fieldToken++;
  const entry = place.entries.find(e => stop.y >= e.from && stop.y < e.to)
             || place.entries[place.entries.length - 1];

  el.kicker.textContent = 'Dossier · ' + place.name;
  el.title.textContent  = entry.title;
  el.sub.textContent    = place.subtitle;
  el.era.textContent    = eraChip(stop);
  el.body.innerHTML     = entry.body + place.geology;
  open();
}

// ---------------------------------------------------------------- field note

export function showFieldNote({ lngLat, polity, subjectTo, precision, physio, stop }){
  const token = ++fieldToken;
  const f = formatYear(stop.y);
  const sl = seaLevelAt(stop.y);
  const lat = +lngLat.lat.toFixed(2), lng = +lngLat.lng.toFixed(2);
  const period = bandFor(stop.y);

  el.kicker.textContent = 'Field note';
  el.title.textContent  = polity || (physio ? physio : 'Open ground');
  el.sub.textContent    = `${Math.abs(lat)}°${lat < 0 ? 'S' : 'N'}, ${Math.abs(lng)}°${lng < 0 ? 'W' : 'E'}`;
  el.era.textContent    = eraChip(stop);

  const known = [];
  if (polity){
    known.push(`<li>Falls inside <strong>${esc(polity)}</strong> in this reconstruction.</li>`);
    if (subjectTo && subjectTo !== polity)
      known.push(`<li>Recorded as subject to <em>${esc(subjectTo)}</em>.</li>`);
    if (precision != null)
      known.push(`<li>Boundary confidence in the source data: <code>${precision}</code>.</li>`);
  } else if (stop.file){
    known.push(`<li>No polity is mapped here at this date — either genuinely unclaimed, or beyond what the reconstruction covers.</li>`);
  } else {
    known.push(`<li>This is a geological stop. No boundary reconstruction exists this far back — only the sea-level estimate.</li>`);
  }
  if (physio) known.push(`<li>Physiographic region: <strong>${esc(physio)}</strong>.</li>`);
  known.push(`<li>Relative sea level: <strong>${sl >= 0 ? '+' : ''}${sl.toFixed(0)} m</strong> against today.</li>`);
  known.push(`<li>Period: ${esc(period)}.</li>`);

  const prompt =
`Write a short history dossier for the place at ${lat}, ${lng}
for the period around ${f.n} ${f.era}${polity ? ` (mapped here as ${polity})` : ''}.
Cover: who lived here, what they spoke and believed, how they made a
living, what the landscape was like, and what was changing. Ground every
claim in Wikipedia, Wikidata and Pleiades results for this coordinate.
Say plainly where the evidence is thin.`;

  el.body.innerHTML = `
    <h4>What the map knows</h4>
    <ul>${known.join('')}</ul>
    <h4>In the record</h4>
    <div id="fn-record"><p class="stub">Reading Wikipedia and Wikidata for this coordinate…</p></div>
    <div id="fn-ai"></div>
    <div class="fn-tools">
      <button class="gbtn" id="copy-prompt">Copy the research prompt</button>
    </div>
    <div class="caution">Boundary reconstructions for deep history are interpretations, and cartographers
    disagree with each other. The further back the timeline goes, the more these polygons mean
    &ldquo;roughly this cultural sphere&rdquo; than &ldquo;this border&rdquo;.</div>`;

  el.body.querySelector('#copy-prompt').onclick = (e) => {
    navigator.clipboard?.writeText(prompt);
    e.target.textContent = 'Copied';
    setTimeout(() => { e.target.textContent = 'Copy the research prompt'; }, 1600);
  };

  open();
  fillRecord(token, { lat, lng, year: stop.y, eraLabel: stop.label,
                      polity, subjectTo, precision, physio, seaLevel: sl, period });
}

async function fillRecord(token, ctx){
  const box = () => (token === fieldToken ? el.body.querySelector('#fn-record') : null);
  let ground = null;
  try {
    ground = await groundCoordinate(ctx.lat, ctx.lng);
  } catch {
    if (box()) box().innerHTML = `<p class="stub">Couldn't reach Wikipedia just now. The research prompt below still works.</p>`;
    return;
  }
  const target = box();
  if (!target) return;

  if (!ground.primary && !ground.articles.length){
    target.innerHTML = `<p class="stub">Nothing in Wikipedia is tagged within 10&nbsp;km of this point — genuinely empty ground, ocean, or just unmapped.</p>`;
  } else {
    target.innerHTML = renderGround(ground, [ctx.lng, ctx.lat]);
  }

  // Model dossier: offered only if a key is set. A cached one renders at once.
  const aiBox = el.body.querySelector('#fn-ai');
  if (!aiBox) return;
  const cached = cachedDossier(ctx.lat, ctx.lng, ctx.year);
  if (cached){
    renderAI(aiBox, cached.html, cached.model, true);
  } else if (hasKey()){
    aiBox.innerHTML =
      `<button class="gbtn ai" id="fn-write">Write the era dossier &rarr;</button>`;
    aiBox.querySelector('#fn-write').onclick = () => runNarrate(token, aiBox, ctx, ground);
  }
}

async function runNarrate(token, aiBox, ctx, ground){
  aiBox.innerHTML = `<p class="stub">Writing — grounded in the lookup above…</p>`;
  try {
    const { html, model, cached } = await narrateDossier({
      title: (ground.primary?.title) || ctx.polity || null,
      lat: ctx.lat, lng: ctx.lng, year: ctx.year, eraLabel: ctx.eraLabel,
      polity: ctx.polity, subjectTo: ctx.subjectTo, precision: ctx.precision,
      physio: ctx.physio, seaLevel: ctx.seaLevel, period: ctx.period, ground,
    });
    if (token !== fieldToken) return;
    renderAI(aiBox, html, model, cached);
  } catch (e){
    if (token !== fieldToken) return;
    aiBox.innerHTML = `<p class="caution">${esc(e.message || 'The dossier could not be written.')}</p>
      <button class="gbtn ai" id="fn-retry">Try again</button>`;
    aiBox.querySelector('#fn-retry').onclick = () => runNarrate(token, aiBox, ctx, ground);
  }
}

function renderAI(box, html, model, cached){
  box.innerHTML =
    `<div class="ai-mark">Written by ${esc(model)}${cached ? ' · cached' : ''} · grounded, not verified</div>
     <div class="ai-body">${html}</div>`;
}

function renderGround(ground, here){
  const p = ground.primary;
  let out = '';
  if (p){
    if (p.thumb) out += `<img class="fn-thumb" src="${esc(p.thumb)}" alt="">`;
    out += `<p class="fn-lead"><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>`;
    if (p.distM > 120) out += ` <span class="fn-dist">${formatKm(p.distM)} ${bearing(here, p.lngLat)}</span>`;
    out += `</p>`;
    if (p.extract) out += `<p class="fn-extract">${esc(trim(p.extract, 460))}</p>`;
  }
  if (ground.wikidata?.facts?.length){
    out += `<div class="fn-facts">` +
      ground.wikidata.facts.map(f =>
        `<span><b>${esc(f.label)}</b> ${esc(f.value)}</span>`).join('') +
      `</div>`;
  }
  const rest = ground.articles.filter(a => !p || a.title !== p.title).slice(0, 6);
  if (rest.length){
    out += `<p class="fn-also"><b>Also within 10&nbsp;km</b> ` +
      rest.map(a =>
        `${esc(a.title)} <span class="fn-dist">${formatKm(a.distM)} ${bearing(here, [a.lng, a.lat])}</span>`
      ).join(' · ') + `</p>`;
  }
  out += `<p class="fn-src">Wikipedia geosearch &amp; Wikidata, live. Nearest labelled point, not necessarily this exact spot.</p>`;
  return out;
}

function trim(s, n){ return s.length > n ? s.slice(0, s.lastIndexOf(' ', n)) + '…' : s; }

function esc(s){
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

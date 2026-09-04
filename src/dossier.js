// dossier.js — the panel.
//
// Two modes. A seeded place gets hand-written, sourced history for the
// selected era. Anywhere else gets a field note: everything the map itself
// actually knows about that spot, plus the prompt a live model would be
// handed. Better to show the seam than to fake a smooth surface.

import { formatYear, bandFor, seaLevelAt } from './eras.js';

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

export function showPlace(place, stop){
  const entry = place.entries.find(e => stop.y >= e.from && stop.y < e.to)
             || place.entries[place.entries.length - 1];

  el.kicker.textContent = 'Dossier · ' + place.name;
  el.title.textContent  = entry.title;
  el.sub.textContent    = place.subtitle;
  el.era.textContent    = eraChip(stop);
  el.body.innerHTML     = entry.body + place.geology;
  open();
}

export function showFieldNote({ lngLat, polity, subjectTo, precision, physio, stop }){
  const f = formatYear(stop.y);
  const sl = seaLevelAt(stop.y);
  const lat = lngLat.lat.toFixed(2), lng = lngLat.lng.toFixed(2);

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
    known.push(`<li>No polity is mapped here at this date — either genuinely unclaimed, or simply beyond what the reconstruction covers.</li>`);
  } else {
    known.push(`<li>This is a geological stop. No boundary reconstruction exists this far back — only the sea-level estimate.</li>`);
  }
  if (physio) known.push(`<li>Physiographic region: <strong>${esc(physio)}</strong>.</li>`);
  known.push(`<li>Relative sea level: <strong>${sl >= 0 ? '+' : ''}${sl.toFixed(0)} m</strong> against today.</li>`);
  known.push(`<li>Period: ${bandFor(stop.y)}.</li>`);

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
    <h4>What it doesn't</h4>
    <p class="stub">No dossier has been written for this spot yet. In the live version this is where a
    grounded lookup runs — Wikipedia geosearch, Wikidata and the Pleiades gazetteer for these
    coordinates — and a model writes the era dossier from what comes back, cached by place and era.</p>
    <p class="stub">Three places are seeded by hand so you can see the finished shape:
    <a href="#" data-jump="ladakh">Ladakh</a>,
    <a href="#" data-jump="doggerland">Doggerland</a>,
    <a href="#" data-jump="cappadocia">Cappadocia</a>.</p>
    <button class="gbtn" id="copy-prompt" style="margin-top:6px">Copy the research prompt</button>
    <div class="caution">Boundary reconstructions for deep history are interpretations, and cartographers
    disagree with each other. The further back the timeline goes, the more these polygons mean
    &ldquo;roughly this cultural sphere&rdquo; than &ldquo;this border&rdquo;.</div>`;

  const btn = el.body.querySelector('#copy-prompt');
  btn.onclick = () => {
    navigator.clipboard?.writeText(prompt);
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = 'Copy the research prompt'; }, 1600);
  };
  open();
}

function esc(s){
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

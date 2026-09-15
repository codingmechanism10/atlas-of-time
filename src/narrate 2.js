// narrate.js — the optional live dossier writer.
//
// This is the one part of the app that needs a key. Everything else works
// offline; this doesn't. If you paste an Anthropic API key into the settings
// panel it's held in this browser's localStorage and never sent anywhere but
// api.anthropic.com. With no key, the field note just shows the grounded
// lookup and the copyable prompt, exactly as before.
//
// The model is handed the grounded facts from lookup.js and asked to write in
// the house voice. It is told, firmly, not to invent anything the grounding
// doesn't support. Output is cached by place + era so a given dossier is
// written once.

const KEY_STORE   = 'atlas.anthropic.key';
const MODEL_STORE = 'atlas.anthropic.model';
const CACHE_PREFIX = 'atlas.dossier.';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 90;   // 90 days

const API = 'https://api.anthropic.com/v1/messages';
export const DEFAULT_MODEL = 'claude-opus-5';

export function getKey(){
  try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; }
}
export function getModel(){
  try { return localStorage.getItem(MODEL_STORE) || DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}
export function hasKey(){ return getKey().trim().length > 0; }

export function setConfig({ key, model }){
  try {
    if (key != null) key.trim() ? localStorage.setItem(KEY_STORE, key.trim())
                                : localStorage.removeItem(KEY_STORE);
    if (model != null) localStorage.setItem(MODEL_STORE, model.trim() || DEFAULT_MODEL);
  } catch {}
}

// ---------------------------------------------------------------- cache

function cacheKey(lat, lng, year){
  return `${CACHE_PREFIX}${lat.toFixed(2)},${lng.toFixed(2)}@${year}`;
}
function readCache(k){
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL){ localStorage.removeItem(k); return null; }
    return v;
  } catch { return null; }
}
function writeCache(k, v){
  try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), v })); } catch {}
}
export function cachedDossier(lat, lng, year){ return readCache(cacheKey(lat, lng, year)); }

// ---------------------------------------------------------------- prompt

// Returns { text, sources }. `sources` is the audit trail: exactly what the
// model was shown, so the panel can print "written from ..." underneath the
// output and the reader can check it. Anything not on this list, the model is
// instructed to mark as general background rather than assert.
function buildGrounding({ ground, ancient, polity, subjectTo, precision, physio, seaLevel, period }){
  const lines = [];
  const sources = [];

  lines.push('[MAP] Layers the atlas itself is drawing at this date:');
  if (polity) lines.push(`  - Mapped polity: ${polity}${subjectTo && subjectTo !== polity ? ` (subject to ${subjectTo})` : ''}.`);
  if (precision != null) lines.push(`  - Boundary-confidence value in the source data: ${precision} (higher is firmer).`);
  if (physio) lines.push(`  - Physiographic region: ${physio}.`);
  lines.push(`  - Relative sea level vs. today: ${seaLevel >= 0 ? '+' : ''}${seaLevel.toFixed(0)} m.`);
  lines.push(`  - Period band: ${period}.`);
  if (polity) sources.push({ kind: 'Boundaries', label: `${polity} — historical-basemaps`, url: 'https://github.com/aourednik/historical-basemaps' });

  if (ancient){
    lines.push('');
    lines.push('[PLEIADES] Ancient-gazetteer record for this exact point:');
    lines.push(`  - Name: ${ancient.text}; type: ${ancient.type}.`);
    lines.push(`  - Attested ${ancient.from} to ${ancient.to} (negative = BCE).`);
    if (ancient.desc) lines.push(`  - Description: ${ancient.desc}`);
    if (ancient.cite) lines.push(`  - Barrington Atlas citation: ${ancient.cite}`);
    sources.push({ kind: 'Gazetteer', label: `Pleiades ${ancient.id} — ${ancient.text}`, url: `https://pleiades.stoa.org/places/${ancient.id}` });
  }

  if (ground?.primary){
    const p = ground.primary;
    lines.push('');
    lines.push(`[WIKIPEDIA] Nearest article: "${p.title}"${p.description ? ` — ${p.description}` : ''} (${Math.round(p.distM)} m away).`);
    if (p.extract) lines.push(`  Extract: ${p.extract}`);
    sources.push({ kind: 'Encyclopaedia', label: p.title, url: p.url });
  }
  if (ground?.wikidata?.facts?.length){
    lines.push('');
    lines.push('[WIKIDATA] Structured facts for that article:');
    for (const f of ground.wikidata.facts) lines.push(`  - ${f.label}: ${f.value}`);
    if (ground.wikidata.qid)
      sources.push({ kind: 'Structured data', label: `Wikidata ${ground.wikidata.qid}`, url: `https://www.wikidata.org/wiki/${ground.wikidata.qid}` });
  }
  if (ground?.articles?.length > 1){
    lines.push('');
    lines.push('[NEARBY] Other articles within 10 km: ' +
      ground.articles.slice(0, 8).map(a => `${a.title} (${Math.round(a.distM)} m)`).join('; ') + '.');
  }

  if (sources.length === 0) lines.push('\n[NONE] No external grounding was found for this coordinate.');
  return { text: lines.join('\n'), sources };
}

const SYSTEM = `You write short place-and-time history dossiers for an interactive historical atlas.

Voice: spare, concrete, a little literary. Present tense for the selected era. No hedging throat-clearing, no "nestled", no travel-brochure adjectives. The reader is curious and not a specialist.

You will be given a coordinate, a target year, and a grounding block whose entries are tagged by source: [MAP], [PLEIADES], [WIKIPEDIA], [WIKIDATA], [NEARBY].

EVIDENCE RULES — these matter more than style:
1. Any specific name, date, number, site, ruler, event or quotation you state MUST appear in the grounding block. If it is not there, you may not assert it.
2. You may add well-established general background — what a period was broadly like, what a climate or landform implies — but such sentences MUST be wrapped in <span class="gen">…</span>. That marks them as context rather than evidence about this place.
3. The grounding describes a place across its whole history. The target year is one moment in it. If the grounding does not actually establish what was here at that year, say so in a <p class="caution"> instead of guessing. Distance matters: a Wikipedia article 8 km away is about somewhere else.
4. If [PLEIADES] gives an attestation range that does not contain the target year, say plainly that the place is not attested at this date.
5. Never invent a citation, and never name a scholar, excavation or publication that is not in the grounding.
6. If the grounding is [NONE] or amounts only to a modern settlement name, write two or three sentences about what the map layers themselves show — polity, terrain, sea level — and stop. A short honest dossier beats a padded one.

Output a raw HTML fragment only — no <html>, no markdown, no code fences. Use exactly these elements:
- <h4> short section headers (2-4 words), sentence case
- <p> paragraphs
- <p class="lede"> for the opening sentence only
- <p class="fact"> for one pulled-out fact, at most once
- <p class="caution"> for thin evidence, contested points, or a year the grounding cannot cover
- <span class="gen"> around general background, per rule 2

Aim for 150-260 words across 2-4 short sections, fewer if the grounding is thin. Do not repeat the place name as a title; the panel already shows it.`;

// ---------------------------------------------------------------- call

// Returns { html, model, cached }. Throws on network / auth failure with a
// message safe to show the user.
export async function narrateDossier(opts){
  const { title, lat, lng, year, eraLabel } = opts;
  const ck = cacheKey(lat, lng, year);
  const hit = readCache(ck);
  if (hit) return { ...hit, cached: true };

  const key = getKey().trim();
  if (!key) throw new Error('No API key set.');
  const model = getModel();

  const { text: grounding, sources } = buildGrounding(opts);
  const user =
`Place: ${title || 'unnamed location'}
Coordinate: ${lat.toFixed(3)}, ${lng.toFixed(3)}
Target year: ${formatYear(year)} — "${eraLabel}"

Grounding
---------
${grounding}

Write the dossier for this place as it was around ${formatYear(year)}.`;

  let res;
  try {
    res = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1600,
        temperature: 0.2,     // evidence task, not a creative one
        system: SYSTEM,
        messages: [{ role: 'user', content: user }],
      }),
    });
  } catch (e){
    throw new Error('Could not reach api.anthropic.com — check your connection.');
  }

  if (!res.ok){
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch {}
    if (res.status === 401) throw new Error('The API key was rejected (401). Check it in settings.');
    if (res.status === 429) throw new Error('Rate limited by the API (429). Try again in a moment.');
    throw new Error(`API error ${res.status}${detail ? ': ' + detail : ''}`);
  }

  const j = await res.json();
  const html = (j.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .replace(/^```html\s*/i, '').replace(/```$/,'').trim();

  // The audit trail travels with the text, and is cached with it, so the
  // panel can always show what the model was actually working from.
  const out = { html, model, sources };
  writeCache(ck, out);
  return { ...out, cached: false };
}

function formatYear(y){
  if (y < 0) return Math.abs(y).toLocaleString('en-US') + ' BCE';
  return (y || 1).toLocaleString('en-US') + ' CE';
}

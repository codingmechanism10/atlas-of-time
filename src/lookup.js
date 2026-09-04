// lookup.js — grounded, keyless lookups for a clicked coordinate.
//
// Everything here runs in the browser against public, CORS-enabled APIs:
// Wikipedia geosearch + REST summaries, and Wikidata entity data. No key,
// no proxy, no build step. Results are cached in localStorage keyed by a
// coarse coordinate, so a second click on the same area is instant and the
// optional model step (narrate.js) has something solid to stand on.

const CACHE_PREFIX = 'atlas.ground.';
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;   // 30 days

const WP_API   = 'https://en.wikipedia.org/w/api.php';
const WP_REST  = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WD_ENTITY = 'https://www.wikidata.org/wiki/Special:EntityData/';
const WD_API   = 'https://www.wikidata.org/w/api.php';

// Wikidata properties worth surfacing, in display order.
const WD_PROPS = [
  ['P31',   'is a'],
  ['P131',  'in'],
  ['P17',   'country'],
  ['P571',  'founded'],
  ['P576',  'dissolved'],
  ['P1435', 'protected as'],
  ['P2044', 'elevation'],
];

// ---------------------------------------------------------------- cache

function cacheKey(lat, lng){
  return CACHE_PREFIX + lat.toFixed(2) + ',' + lng.toFixed(2);
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

// ---------------------------------------------------------------- fetch helpers

async function getJSON(url, params){
  const u = new URL(url);
  if (params) u.search = new URLSearchParams(params).toString();
  const r = await fetch(u, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

async function geosearch(lat, lng){
  const j = await getJSON(WP_API, {
    action: 'query', list: 'geosearch',
    gscoord: `${lat}|${lng}`, gsradius: 10000, gslimit: 16,
    format: 'json', origin: '*',
  });
  return (j.query?.geosearch || []).map(g => ({
    title: g.title, pageid: g.pageid,
    lat: g.lat, lng: g.lon, distM: Math.round(g.dist),
  }));
}

async function summary(title){
  try {
    const j = await getJSON(WP_REST + encodeURIComponent(title.replace(/ /g, '_')));
    return {
      title:   j.title,
      description: j.description || null,
      extract: j.extract || null,
      thumb:   j.thumbnail?.source || null,
      qid:     j.wikibase_item || null,
      url:     j.content_urls?.desktop?.page || null,
      type:    j.type || null,
    };
  } catch { return null; }
}

// One EntityData call for the subject, then one batched label lookup for
// every entity referenced by the claims we care about.
async function wikidata(qid){
  if (!qid) return null;
  let ent;
  try {
    const j = await getJSON(WD_ENTITY + qid + '.json');
    ent = j.entities?.[qid];
  } catch { return null; }
  if (!ent) return null;
  const claims = ent.claims || {};

  const facts = [];
  const needLabels = new Set();

  for (const [pid, label] of WD_PROPS){
    const snak = claims[pid]?.[0]?.mainsnak;
    if (!snak || snak.snaktype !== 'value') continue;
    const dv = snak.datavalue;
    if (dv.type === 'wikibase-entityid'){
      const id = dv.value.id;
      needLabels.add(id);
      facts.push({ label, ref: id });
    } else if (dv.type === 'time'){
      facts.push({ label, value: formatWdTime(dv.value.time) });
    } else if (dv.type === 'quantity'){
      const n = Number(dv.value.amount);
      facts.push({ label, value: (Math.round(n)).toLocaleString('en-US') + ' m' });
    } else if (dv.type === 'string'){
      facts.push({ label, value: dv.value });
    }
  }

  if (needLabels.size){
    try {
      const j = await getJSON(WD_API, {
        action: 'wbgetentities', ids: [...needLabels].join('|'),
        props: 'labels', languages: 'en', format: 'json', origin: '*',
      });
      for (const f of facts){
        if (!f.ref) continue;
        f.value = j.entities?.[f.ref]?.labels?.en?.value || f.ref;
        delete f.ref;
      }
    } catch {
      for (const f of facts){ if (f.ref){ f.value = f.ref; delete f.ref; } }
    }
  }

  return {
    qid,
    label: ent.labels?.en?.value || null,
    facts: facts.filter(f => f.value),
  };
}

function formatWdTime(iso){
  // Wikidata times look like "+1460-00-00T00:00:00Z" or "-0000500-00-..."
  const m = /^([+-])0*(\d+)-(\d\d)-(\d\d)/.exec(iso);
  if (!m) return iso;
  const [, sign, y, mo] = m;
  const year = Number(y);
  if (sign === '-') return year.toLocaleString('en-US') + ' BCE';
  const month = mo !== '00' ? ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(mo)] + ' ' : '';
  return month + year;
}

// ---------------------------------------------------------------- public

// Returns { articles, primary, wikidata, coord } or throws. `primary` is the
// nearest article that carries a usable prose extract; `articles` is the full
// nearby list (deduped, nearest first) for the "also here" line.
export async function groundCoordinate(lat, lng){
  const key = cacheKey(lat, lng);
  const hit = readCache(key);
  if (hit) return hit;

  const articles = await geosearch(lat, lng);
  if (!articles.length){
    const empty = { articles: [], primary: null, wikidata: null, coord: [lng, lat] };
    writeCache(key, empty);
    return empty;
  }

  // Walk the nearest few until one has a real extract (skip disambiguation
  // pages and bare list articles).
  let primary = null;
  for (const a of articles.slice(0, 5)){
    const s = await summary(a.title);
    if (s && s.extract && s.type !== 'disambiguation'){
      primary = { ...s, distM: a.distM, lngLat: [a.lng, a.lat] };
      break;
    }
  }

  const wd = primary ? await wikidata(primary.qid) : null;

  const out = { articles, primary, wikidata: wd, coord: [lng, lat] };
  writeCache(key, out);
  return out;
}

// Compass bearing from a → b, as a 16-point string ("NNE").
export function bearing(a, b){
  const toRad = Math.PI / 180, toDeg = 180 / Math.PI;
  const φ1 = a[1] * toRad, φ2 = b[1] * toRad;
  const Δλ = (b[0] - a[0]) * toRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const brng = (Math.atan2(y, x) * toDeg + 360) % 360;
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return pts[Math.round(brng / 22.5) % 16];
}

export function formatKm(m){
  if (m < 950) return Math.round(m / 50) * 50 + ' m';
  return (m / 1000).toFixed(m < 9500 ? 1 : 0) + ' km';
}

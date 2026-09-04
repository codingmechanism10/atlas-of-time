// app.js — wiring.

import { buildStyle, polityColor } from './style.js';
import { Labels } from './labels.js';
import { Timeline } from './timeline.js';
import { seaLevelAt, STOPS } from './eras.js';
import * as Dossier from './dossier.js';

const USE_TERRAIN = true;   // set false if the elevation tiles are unreachable

// Places worth stumbling into. The Wander button pulls from here.
const WANDER = [
  { n:'Socotra',              c:[53.9, 12.5],   z:7.6 },
  { n:'The Danakil Depression',c:[40.3, 14.2],  z:7.6 },
  { n:'Kamchatka',            c:[159.4, 55.8],  z:5.8 },
  { n:'The Salar de Uyuni',   c:[-67.5, -20.3], z:7.2 },
  { n:'Wadi Rum',             c:[35.4, 29.6],   z:8.2 },
  { n:'The Lena Pillars',     c:[125.6, 61.0],  z:7.4 },
  { n:'Tierra del Fuego',     c:[-68.5, -54.6], z:6.4 },
  { n:'The Namib sand sea',   c:[15.4, -24.8],  z:7.2 },
  { n:'Zanskar',              c:[76.9, 33.5],   z:7.4 },
  { n:'The Aral basin',       c:[59.5, 45.0],   z:6.4 },
  { n:'Kerguelen',            c:[69.5, -49.3],  z:7.0 },
  { n:'The Tian Shan',        c:[78.5, 42.2],   z:6.4 },
  { n:'Svalbard',             c:[16.5, 78.6],   z:5.8 },
  { n:'The Bolaven plateau',  c:[106.4, 15.1],  z:8.0 },
  { n:'Cape York',            c:[142.6, -12.4], z:6.6 },
  { n:'The Skeleton Coast',   c:[13.2, -20.4],  z:7.0 },
  { n:'Lake Turkana',         c:[36.1, 3.6],    z:7.2 },
  { n:'The Faroe Islands',    c:[-6.9, 62.0],   z:7.8 },
  { n:'Torres del Paine',     c:[-73.0, -51.0], z:8.0 },
  { n:'The Guiana shield',    c:[-61.0, 5.2],   z:7.0 },
  { n:'Hokkaido',             c:[142.8, 43.6],  z:6.6 },
  { n:'The Hoggar',           c:[5.5, 23.3],    z:6.8 },
  { n:'Milford Sound',        c:[167.6, -44.8], z:8.4 },
  { n:'The Pamir knot',       c:[73.0, 38.4],   z:6.6 },
];

const boot   = document.getElementById('boot');
const status = document.getElementById('boot-status');
const toastEl= document.getElementById('toast');

const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle({ terrain: USE_TERRAIN }),
  center: [78, 30],
  zoom: 2.1,
  minZoom: 0.6,
  maxZoom: 11.5,
  attributionControl: {
    compact: true,
    customAttribution:
      'Boundaries: aourednik/historical-basemaps · Base: Natural Earth · Rendering: MapLibre',
  },
});
map.dragRotate.enable();
map.touchZoomRotate.enableRotation();

const labels    = new Labels(map);
const eraCache  = new Map();
let places      = {};
let selectedKey = null;
let timeline    = null;

// ---------------------------------------------------------------- era load

async function loadEra(stop){
  if (!stop.file) return { type:'FeatureCollection', features:[] };
  if (eraCache.has(stop.file)) return eraCache.get(stop.file);
  const gj = await (await fetch('data/eras/' + stop.file)).json();
  for (const f of gj.features) f.properties._color = polityColor(f.properties.NAME);
  eraCache.set(stop.file, gj);
  return gj;
}

let eraToken = 0;
async function applyEra(stop){
  const token = ++eraToken;
  const gj = await loadEra(stop);
  if (token !== eraToken) return;             // a later scrub won the race
  map.getSource('era')?.setData(gj);
  labels.setPolities(gj);
  applySeaLevel(stop.y);
  if (selectedKey && places[selectedKey]) Dossier.showPlace(places[selectedKey], stop);
  prefetchNeighbours();
}

// Warm the two stops either side so scrubbing feels instant.
function prefetchNeighbours(){
  if (!timeline) return;                       // first paint runs before wiring
  [timeline.index - 1, timeline.index + 1].forEach(i => {
    const s = STOPS[i];
    if (s && s.file && !eraCache.has(s.file)) loadEra(s);
  });
}

// The shelf polygon is the -200 m contour, so treat it as a proxy: the more
// the sea falls, the more of it reads as dry ground. Approximate on purpose.
function applySeaLevel(year){
  const sl = seaLevelAt(year);
  const exposure = Math.max(0, Math.min(1, -sl / 125));
  const eased = Math.pow(exposure, 0.8);
  map.setPaintProperty('shelf-exposed', 'fill-opacity', eased * 0.95);
  map.setPaintProperty('shelf-exposed-edge', 'line-opacity', eased * 0.55);
  // Keep a little shallow-water tint even at the glacial floor: the shelf
  // edge should still read as a coast, not as a colour boundary.
  map.setPaintProperty('shelf-water', 'fill-opacity', 0.55 * (1 - eased * 0.88));
  labels.setSunken(eased > 0.35);
}

// ---------------------------------------------------------------- picking

function kmBetween(a, b){
  const R = 6371, r = Math.PI/180;
  const dLat = (b[1]-a[1])*r, dLon = (b[0]-a[0])*r;
  const h = Math.sin(dLat/2)**2 + Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

function placeAt(lngLat){
  let best = null, bd = Infinity;
  for (const [key, p] of Object.entries(places)){
    const d = kmBetween([lngLat.lng, lngLat.lat], p.center);
    if (d < p.radiusKm && d < bd){ bd = d; best = key; }
  }
  return best;
}

function physioAt(lngLat){
  let best = null, bd = 9;
  for (const p of labels.physio){
    const d = Math.hypot(p.lngLat[0]-lngLat.lng, p.lngLat[1]-lngLat.lat);
    if (d < bd){ bd = d; best = p.text; }
  }
  return best;
}

map.on('click', (e) => {
  const key = placeAt(e.lngLat);
  if (key){
    selectedKey = key;
    Dossier.showPlace(places[key], timeline.stop);
    return;
  }
  selectedKey = null;
  const hits = map.queryRenderedFeatures(e.point, { layers:['era-fill'] });
  const top  = hits[0]?.properties || {};
  Dossier.showFieldNote({
    lngLat: e.lngLat,
    polity: top.NAME || null,
    subjectTo: top.SUBJECTO || null,
    precision: top.BORDERPRECISION ?? null,
    physio: physioAt(e.lngLat),
    stop: timeline.stop,
  });
});

let hoverId = null;
map.on('mousemove', 'era-fill', (e) => {
  map.getCanvas().style.cursor = 'pointer';
  if (hoverId !== null) map.setFeatureState({ source:'era', id:hoverId }, { hover:false });
  hoverId = e.features[0].id;
  map.setFeatureState({ source:'era', id:hoverId }, { hover:true });
});
map.on('mouseleave', 'era-fill', () => {
  map.getCanvas().style.cursor = '';
  if (hoverId !== null) map.setFeatureState({ source:'era', id:hoverId }, { hover:false });
  hoverId = null;
});

// Jump links inside the field note.
document.getElementById('dossier').addEventListener('click', (e) => {
  const k = e.target.dataset?.jump;
  if (!k) return;
  e.preventDefault();
  goToPlace(k);
});

// ---------------------------------------------------------------- chrome

const hudMode   = document.getElementById('hud-mode');
const hudHint   = document.getElementById('hud-hint');
const hudCoords = document.getElementById('hud-coords');

function updateHud(){
  const z = map.getZoom();
  const globe = z < 5.2;
  hudMode.textContent = globe ? 'Globe' : 'Atlas';
  hudHint.textContent = globe ? 'scroll to descend' : 'right-drag to tilt';
  const c = map.getCenter();
  hudCoords.textContent =
    `${Math.abs(c.lat).toFixed(1)}°${c.lat<0?'S':'N'}  ${Math.abs(c.lng).toFixed(1)}°${c.lng<0?'W':'E'}  z${z.toFixed(1)}`;
}
map.on('move', updateHud);
map.on('zoom', updateHud);

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function goToPlace(key){
  const p = places[key];
  if (!p) return;
  selectedKey = key;
  map.flyTo({ ...p.flyTo, speed: 0.75, curve: 1.5 });
  Dossier.showPlace(p, timeline.stop);
}

document.querySelectorAll('[data-place]').forEach(b => {
  b.onclick = () => goToPlace(b.dataset.place);
});

document.getElementById('wander').onclick = () => {
  const w = WANDER[Math.floor(Math.random() * WANDER.length)];
  selectedKey = null;
  Dossier.close();
  map.flyTo({ center: w.c, zoom: w.z, pitch: 45, bearing: (Math.random()*60 - 30), speed: 0.62, curve: 1.6 });
  toast(w.n);
};

// ---------------------------------------------------------------- boot

map.on('error', (e) => {
  const msg = String(e?.error?.message || '');
  console.warn('[atlas] map error:', msg || e, e?.sourceId || '');
  if (msg.includes('elevation-tiles') || e?.sourceId === 'dem'){
    if (map.getLayer('hillshade')){
      try { map.setTerrain(null); } catch (_) {}
      map.removeLayer('hillshade');
      toast('relief tiles unreachable — flat atlas');
    }
  }
});

map.on('load', async () => {
  status.textContent = 'reading the boundaries';

  // Real 3D relief, if the elevation tiles came through. This is the payoff
  // for tilting the camera; without it the map is still a fine flat atlas.
  if (USE_TERRAIN && map.getSource('dem')){
    try { map.setTerrain({ source:'dem', exaggeration: 1.25 }); } catch (_) {}
  }

  // Longer, softer transitions than the default so scrubbing the timeline
  // feels like a dissolve rather than a cut.
  ['shelf-exposed','shelf-water'].forEach(id =>
    map.setPaintProperty(id, 'fill-opacity-transition', { duration: 900, delay: 0 }));
  map.setPaintProperty('shelf-exposed-edge', 'line-opacity-transition', { duration: 900, delay: 0 });

  places = await (await fetch('data/places.json')).json();
  await labels.loadPhysio('data/base/physio.geojson');

  timeline = new Timeline((stop) => { applyEra(stop); });
  window.atlas = { map, timeline, labels, goToPlace };

  updateHud();
  setTimeout(() => {
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 800);
  }, 400);
});

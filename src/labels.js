// labels.js — an HTML label engine sitting on top of the GL canvas.
//
// MapLibre's own symbol layers need SDF glyph tiles and give you whatever
// font someone baked into them. Drawing labels as DOM instead means real
// Iowan Old Style, real small-caps, real letter-spacing — and greedy
// collision resolution we control. Roughly a hundred nodes, recycled.

const CSS = `
#labels{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}
.lab{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;
  transition:opacity .25s;will-change:transform}
.lab.physio{font-style:italic;letter-spacing:.14em;font-size:11px;
  color:rgba(74,58,36,.78);text-shadow:0 1px 0 rgba(247,238,215,.6)}
.lab.physio.big{font-size:13px;letter-spacing:.22em;color:rgba(62,48,29,.8)}
.lab.polity{font-size:11.5px;letter-spacing:.17em;font-variant:small-caps;
  color:#3a2c18;text-shadow:0 1px 0 rgba(247,238,215,.55),0 0 8px rgba(247,238,215,.4)}
.lab.polity.big{font-size:14px;letter-spacing:.24em}
.lab.sunk{color:rgba(220,236,242,.72);text-shadow:0 1px 4px rgba(4,18,24,.9)}
.lab.city{font-size:10.5px;letter-spacing:.07em;color:#2f2413;padding-left:8px;
  text-shadow:0 1px 0 rgba(247,238,215,.7),0 0 6px rgba(247,238,215,.5)}
.lab.city::before{content:"";position:absolute;left:0;top:50%;width:3.5px;height:3.5px;
  margin-top:-1.75px;border-radius:50%;background:#5b4a31;
  box-shadow:0 0 0 1px rgba(247,238,215,.75)}
.lab.city.big{font-size:11.5px;letter-spacing:.1em}
.lab.city.big::before{width:5px;height:5px;margin-top:-2.5px;background:#8a3d1c;
  box-shadow:0 0 0 1.5px rgba(247,238,215,.8)}
`;

const PHYSIO_KEEP = new Set([
  'Range/mtn','Desert','Plateau','Plain','Basin','Valley','Lowland',
  'Peninsula','Island group','Isthmus','Tundra','Foothills','Gorge','Delta','Coast',
]);

export class Labels {
  constructor(map){
    this.map = map;
    const s = document.createElement('style'); s.textContent = CSS;
    document.head.appendChild(s);
    this.el = document.createElement('div'); this.el.id = 'labels';
    map.getContainer().appendChild(this.el);
    this.pool = [];
    this.physio = [];
    this.polities = [];
    this.cities = [];
    this.year = 2025;
    this.queued = false;
    const tick = () => this.schedule();
    map.on('move', tick); map.on('zoom', tick); map.on('resize', tick);

    // The panel sliding in and out changes the space labels may occupy.
    const panel = document.getElementById('dossier');
    if (panel){
      new MutationObserver(tick).observe(panel, { attributes:true, attributeFilter:['class'] });
      panel.addEventListener('transitionend', tick);
    }
  }

  async loadPhysio(url){
    const gj = await (await fetch(url)).json();
    this.physio = gj.features
      .filter(f => PHYSIO_KEEP.has(f.properties.FEATURECLA) && f.properties.NAME)
      .map(f => ({
        text: titleCase(f.properties.NAME),
        lngLat: f.geometry.coordinates,
        minZ: f.properties.MIN_LABEL ?? 2,
        maxZ: f.properties.MAX_LABEL ?? 10,
        rank: f.properties.SCALERANK ?? 5,
        kind: 'physio',
      }));
    this.schedule();
  }

  // Called whenever the era changes. Derives one label anchor per polity
  // from its largest ring, and sizes it by that ring's extent.
  setPolities(featureCollection){
    const byName = new Map();
    for (const f of featureCollection.features){
      const name = f.properties?.NAME;
      if (!name) continue;
      const best = biggestRing(f.geometry);
      if (!best) continue;
      const prev = byName.get(name);
      if (!prev || best.area > prev.area) byName.set(name, { ...best, text: shortName(name) });
    }
    const all = [...byName.values()].sort((a,b) => b.area - a.area);
    const maxArea = all.length ? all[0].area : 1;
    this.polities = all.map(p => ({
      text: p.text,
      lngLat: p.centroid,
      area: p.area,
      big: p.area > maxArea * 0.18,
      rank: 0,
      kind: 'polity',
    }));
    this.schedule();
  }

  // Cities are modern points. They only appear once you've descended, and only
  // from 1800 on — a present-day gazetteer over a Bronze Age map would be
  // fiction. Loaded lazily on first need, like the other detail layers.
  async loadCities(url){
    if (this._citiesReq) return this._citiesReq;
    this._citiesReq = (async () => {
      try {
        const gj = await (await fetch(url)).json();
        this.cities = gj.features.map(f => ({
          text: f.properties.NAME,
          lngLat: f.geometry.coordinates,
          rank: f.properties.RANK ?? 5,
          capital: !!f.properties.CAPITAL,
          kind: 'city',
        }));
      } catch { this.cities = []; }
      this.schedule();
    })();
    return this._citiesReq;
  }

  setYear(y){ this.year = y; this.schedule(); }

  setSunken(v){ this.sunken = v; this.schedule(); }

  schedule(){
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => { this.queued = false; this.render(); });
  }

  render(){
    const map = this.map;
    const z = map.getZoom();
    const { width, height } = map.getContainer().getBoundingClientRect();
    const center = map.getCenter();
    // Cull past the limb before projecting. This matters at every zoom the
    // globe is still active at, not just when zoomed out: with pitch on, a
    // point on the far side of the Earth still projects to a plausible-
    // looking on-screen coordinate, and you get Greenland next to Ladakh.
    const limit = 80;

    const candidates = [];

    for (const p of this.polities){
      if (angularDist(center, p.lngLat) > limit) continue;
      candidates.push({ ...p, prio: 1000 - candidates.length, weight: 3 + (p.big ? 2 : 0) });
    }
    for (const p of this.physio){
      if (z < p.minZ || z > p.maxZ + 3) continue;
      if (angularDist(center, p.lngLat) > limit) continue;
      candidates.push({ ...p, prio: 500 - p.rank * 10, weight: 1 });
    }

    // Cities sit between polities and physiography in priority: they anchor a
    // close-up view, but they should never crowd out the polity a reader came
    // for. Rank gates them in as you descend.
    if (z >= 4 && this.year >= 1800){
      for (const p of this.cities){
        if (p.rank > (z - 3.4) * 2.2) continue;
        if (angularDist(center, p.lngLat) > limit) continue;
        candidates.push({ ...p, prio: 800 - p.rank * 12, weight: 2 });
      }
    }

    candidates.sort((a,b) => (b.weight - a.weight) || (b.prio - a.prio));

    // Seed the collision set with the UI's own footprint, read live from the
    // DOM, so labels never slide under the title, the HUD or the panel.
    const placed = reservedBoxes();
    const out = [];
    for (const c of candidates){
      if (out.length >= 90) break;
      const pt = map.project(c.lngLat);
      if (!isFinite(pt.x) || !isFinite(pt.y)) continue;
      if (pt.x < -40 || pt.y < -20 || pt.x > width + 40 || pt.y > height + 20) continue;
      // Round-trip check. project() will happily return an on-screen point
      // for somewhere on the far side of the planet; unproject()ing it back
      // is the only reliable way to catch that. Cheap here because only a
      // handful of candidates survive the bounds test above.
      const back = map.unproject(pt);
      if (angularDist(back, c.lngLat) > 1.5) continue;
      const big = c.kind === 'polity' ? c.big
                : c.kind === 'city'   ? (c.capital || c.rank <= 1)
                : c.rank <= 1;
      const w = c.text.length * (big ? 8.4 : 6.6) + 14 + (c.kind === 'city' ? 10 : 0);
      const h = big ? 22 : 18;
      const box = { x1: pt.x - w/2, y1: pt.y - h/2, x2: pt.x + w/2, y2: pt.y + h/2 };
      if (placed.some(b => overlaps(b, box))) continue;
      placed.push(box);
      out.push({ ...c, x: pt.x, y: pt.y, big });
    }

    this.paint(out);
  }

  paint(items){
    while (this.pool.length < items.length){
      const d = document.createElement('div');
      d.className = 'lab';
      this.el.appendChild(d);
      this.pool.push(d);
    }
    items.forEach((it, i) => {
      const d = this.pool[i];
      const cls = `lab ${it.kind}${it.big ? ' big' : ''}`;
      if (d.className !== cls) d.className = cls;
      if (d.textContent !== it.text) d.textContent = it.text;
      d.style.transform = `translate(-50%,-50%) translate(${it.x.toFixed(1)}px,${it.y.toFixed(1)}px)`;
      d.style.opacity = '1';
    });
    for (let i = items.length; i < this.pool.length; i++) this.pool[i].style.opacity = '0';
  }
}

const UI_SELECTORS = ['#brand', '#hud', '#gaz', '#timeline', '#dossier'];

function reservedBoxes(){
  const out = [];
  for (const sel of UI_SELECTORS){
    const el = document.querySelector(sel);
    if (!el) continue;
    if (sel === '#dossier' && !el.classList.contains('open')) continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.height) out.push({ x1:r.left-6, y1:r.top-6, x2:r.right+6, y2:r.bottom+6 });
  }
  return out;
}

// --- geometry helpers --------------------------------------------------

function overlaps(a, b){
  return !(a.x2 < b.x1 || b.x2 < a.x1 || a.y2 < b.y1 || b.y2 < a.y1);
}

function angularDist(center, lngLat){
  const toRad = Math.PI/180;
  const φ1 = center.lat*toRad, φ2 = lngLat[1]*toRad;
  const Δλ = (lngLat[0]-center.lng)*toRad;
  const c = Math.sin(φ1)*Math.sin(φ2) + Math.cos(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return Math.acos(Math.max(-1, Math.min(1, c))) / toRad;
}

function biggestRing(geom){
  if (!geom) return null;
  const polys = geom.type === 'Polygon' ? [geom.coordinates]
              : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  let best = null;
  for (const poly of polys){
    const ring = poly[0];
    if (!ring || ring.length < 4) continue;
    const a = Math.abs(ringArea(ring));
    if (!best || a > best.area) best = { area: a, centroid: ringCentroid(ring) };
  }
  return best;
}

function ringArea(ring){
  let s = 0;
  for (let i=0, j=ring.length-1; i<ring.length; j=i++){
    s += (ring[j][0]*ring[i][1]) - (ring[i][0]*ring[j][1]);
  }
  return s/2;
}

function ringCentroid(ring){
  let x=0, y=0, a=0;
  for (let i=0, j=ring.length-1; i<ring.length; j=i++){
    const f = ring[j][0]*ring[i][1] - ring[i][0]*ring[j][1];
    a += f; x += (ring[j][0]+ring[i][0])*f; y += (ring[j][1]+ring[i][1])*f;
  }
  if (Math.abs(a) < 1e-12){
    const m = ring[Math.floor(ring.length/2)];
    return [m[0], m[1]];
  }
  a *= 3;
  return [x/a, y/a];
}

// "Tanzania, United Republic of" is a database entry, not a map label.
function shortName(s){
  return s.length > 16 && s.includes(',') ? s.split(',')[0].trim() : s;
}

function titleCase(s){
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (_,p,c) => p + c.toUpperCase());
}

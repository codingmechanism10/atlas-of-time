// detail.js — the close-up layers.
//
// Nothing here loads until you actually descend, because none of it is worth
// paying for on the globe. Three resolution tiers of coastline hand off to
// each other, and only one is ever drawn:
//
//   base     — the globe polygon, ~13k vertices. Fine as a marble.
//   land50   — Natural Earth 50 m, from z3.2. Past about z3 the base polygon
//              starts showing its corners; this resolves fjords, deltas and
//              island chains. Same fill colour, so the handover is invisible.
//   land10   — Natural Earth 10 m, from z6, plus 10 m rivers and lakes.
//              5,042 separate landmasses against land50's 1,252. This is the
//              tier that makes a close zoom look surveyed rather than sketched.
//              ~6.6 MB across the three files, which is why it waits for z6.
//
//   admin1   — present-day states and provinces, ~4,100 of them worldwide.
//              These are MODERN divisions. Drawing them over a 1600 map would
//              be a straightforward lie, so they only appear from 1900 on, and
//              they are drawn as a fine dotted underlay — reference, not
//              reconstruction. Nobody has digitised the world's provincial
//              boundaries for deep history; that data does not exist.

const SRC = {
  land50:   'data/base/land50.geojson',
  admin1:   'data/base/admin1.geojson',
  land10:   'data/base/land10.geojson',
  rivers10: 'data/base/rivers10.geojson',
  lakes10:  'data/base/lakes10.geojson',
};

const DETAIL_ZOOM = 3.2;     // where the coarse globe polygon starts to show
const ADMIN1_ZOOM = 3.6;
const CLOSE_ZOOM  = 6.0;     // where 50m starts showing its own corners
const ADMIN1_FROM_YEAR = 1900;

export class Detail {
  constructor(map, colors){
    this.map = map;
    this.C = colors;
    this.state = {};          // name -> 'loading' | 'ready' | 'failed'
    this.year = 2025;
    this.announced = false;
    this.onNote = null;       // set by app.js to surface the reference caveat
  }

  setYear(y){ this.year = y; this.update(); }

  update(){
    const z = this.map.getZoom();
    const close = z >= CLOSE_ZOOM;
    // 50m carries z3.2–z6; past that it is the thing you can see the corners
    // of, so 10m takes over and 50m stands down.
    this.want('land50', z >= DETAIL_ZOOM && !close);
    this.want('land10', close);
    this.want('rivers10', close);
    this.want('lakes10', close);
    this.want('admin1', z >= ADMIN1_ZOOM && this.year >= ADMIN1_FROM_YEAR);
  }

  want(name, on){
    if (on && !this.state[name]) return this.load(name);
    if (this.state[name] !== 'ready') return;
    for (const id of this.layerIds(name)){
      if (this.map.getLayer(id))
        this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
    // Whichever coastline tier is up retires the ones beneath it, so the
    // same shoreline is never drawn twice at different resolutions.
    if (name === 'land50' || name === 'land10') this.swapCoarse();
    if (name === 'rivers10' || name === 'lakes10') this.swapBase(name, on);
    if (name === 'admin1' && on && !this.announced){
      this.announced = true;
      this.onNote?.('States and provinces shown are present-day divisions — reference, not reconstruction');
    }
  }

  layerIds(name){
    switch (name){
      case 'land50':   return ['land50-fill', 'land50-coast'];
      case 'land10':   return ['land10-fill', 'land10-coast'];
      case 'rivers10': return ['rivers10-line'];
      case 'lakes10':  return ['lakes10-fill', 'lakes10-edge'];
      default:         return ['admin1-line'];
    }
  }

  // Retire each coastline where the finer one takes over. A little overlap
  // avoids a one-frame gap on the way in.
  swapCoarse(){
    const has50 = this.state.land50 === 'ready';
    const has10 = this.state.land10 === 'ready';
    try {
      const coarseHi = has50 || has10 ? DETAIL_ZOOM + 0.35 : 24;
      this.map.setLayerZoomRange('land', 0, coarseHi);
      this.map.setLayerZoomRange('coast', 0, coarseHi);
      if (has50){
        const hi50 = has10 ? CLOSE_ZOOM + 0.35 : 24;
        this.map.setLayerZoomRange('land50-fill', DETAIL_ZOOM, hi50);
        this.map.setLayerZoomRange('land50-coast', DETAIL_ZOOM, hi50);
      }
    } catch (_) {}
  }

  // The base rivers and lakes are 50m; stand them down where 10m is drawing.
  swapBase(name, on){
    const base = name === 'rivers10' ? ['rivers'] : ['lakes'];
    for (const id of base){
      if (!this.map.getLayer(id)) continue;
      try { this.map.setLayerZoomRange(id, 0, on ? CLOSE_ZOOM + 0.35 : 24); } catch (_) {}
    }
  }

  async load(name){
    this.state[name] = 'loading';
    let gj;
    try {
      gj = await (await fetch(SRC[name])).json();
    } catch (_) {
      this.state[name] = 'failed';
      return;
    }
    if (this.map.getSource(name)) { this.state[name] = 'ready'; return this.update(); }
    this.map.addSource(name, { type: 'geojson', data: gj });

    if (name === 'land50'){
      // Underneath everything the era layers draw, in place of `land`.
      this.map.addLayer({
        id: 'land50-fill', type: 'fill', source: 'land50',
        layout: { visibility: 'none' },
        paint: { 'fill-color': this.C.land },
      }, 'graticule');
      this.map.addLayer({
        id: 'land50-coast', type: 'line', source: 'land50',
        layout: { visibility: 'none' },
        paint: {
          'line-color': this.C.landEdge,
          'line-opacity': 0.8,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 6, 1.2, 10, 2],
        },
      }, 'era-fill');
    } else if (name === 'land10'){
      this.map.addLayer({
        id: 'land10-fill', type: 'fill', source: 'land10',
        layout: { visibility: 'none' },
        paint: { 'fill-color': this.C.land },
      }, 'graticule');
      this.map.addLayer({
        id: 'land10-coast', type: 'line', source: 'land10',
        layout: { visibility: 'none' },
        paint: {
          'line-color': this.C.landEdge,
          'line-opacity': 0.82,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 9, 1.7, 11, 2.6],
        },
      }, 'era-fill');

    } else if (name === 'rivers10'){
      this.map.addLayer({
        id: 'rivers10-line', type: 'line', source: 'rivers10',
        layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': this.C.river,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.35, 9, 0.7],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 9, 1.3, 11, 2.2],
        },
      }, 'era-fill');

    } else if (name === 'lakes10'){
      this.map.addLayer({
        id: 'lakes10-fill', type: 'fill', source: 'lakes10',
        layout: { visibility: 'none' },
        paint: { 'fill-color': this.C.lake, 'fill-opacity': 0.92 },
      }, 'era-fill');
      this.map.addLayer({
        id: 'lakes10-edge', type: 'line', source: 'lakes10',
        layout: { visibility: 'none' },
        paint: {
          'line-color': this.C.landEdge, 'line-opacity': 0.4,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 10, 1.1],
        },
      }, 'era-fill');

    } else {
      this.map.addLayer({
        id: 'admin1-line', type: 'line', source: 'admin1',
        layout: { visibility: 'none', 'line-join': 'round' },
        paint: {
          'line-color': this.C.landEdge,
          'line-dasharray': [1.5, 2],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 3.6, 0, 5, 0.34, 8, 0.5],
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 8, 0.9],
        },
      }, 'era-fill');
    }

    this.state[name] = 'ready';
    this.update();
  }
}

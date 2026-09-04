// detail.js — the close-up layers.
//
// Two things load only once you actually descend, because neither is worth
// paying for on the globe:
//
//   land50   — Natural Earth 50 m coastline. The globe-scale land polygon is
//              deliberately coarse; past about z3 you start seeing its corners.
//              This swaps in underneath so fjords, deltas and island chains
//              resolve. Same fill colour, so the handover is invisible.
//
//   admin1   — present-day states and provinces, ~4,100 of them worldwide.
//              These are MODERN divisions. Drawing them over a 1600 map would
//              be a straightforward lie, so they only appear from 1900 on, and
//              they are drawn as a fine dotted underlay — reference, not
//              reconstruction. Nobody has digitised the world's provincial
//              boundaries for deep history; that data does not exist.

const SRC = {
  land50: 'data/base/land50.geojson',
  admin1: 'data/base/admin1.geojson',
};

const DETAIL_ZOOM = 3.2;     // where the coarse globe polygon starts to show
const ADMIN1_ZOOM = 3.6;
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
    this.want('land50', z >= DETAIL_ZOOM);
    this.want('admin1', z >= ADMIN1_ZOOM && this.year >= ADMIN1_FROM_YEAR);
  }

  want(name, on){
    if (on && !this.state[name]) return this.load(name);
    if (this.state[name] !== 'ready') return;
    for (const id of this.layerIds(name)){
      if (this.map.getLayer(id))
        this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
    if (name === 'land50') this.swapCoarse(on);
    if (name === 'admin1' && on && !this.announced){
      this.announced = true;
      this.onNote?.('States and provinces shown are present-day divisions — reference, not reconstruction');
    }
  }

  layerIds(name){
    return name === 'land50' ? ['land50-fill', 'land50-coast']
                             : ['admin1-line'];
  }

  // Retire the globe-scale land polygon where the detailed one takes over.
  // A little overlap in the middle avoids a one-frame gap on the way in.
  swapCoarse(detailOn){
    const hi = detailOn ? DETAIL_ZOOM + 0.35 : 24;
    try {
      this.map.setLayerZoomRange('land', 0, hi);
      this.map.setLayerZoomRange('coast', 0, hi);
    } catch (_) {}
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

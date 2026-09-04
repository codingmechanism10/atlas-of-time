// routes.js — trade routes and movement, keyed to the timeline.
//
// A single GeoJSON of coarse schematic paths (data/routes.json). Each has a
// from/to window; as the timeline moves, the visible set changes. Static
// borders undersell history — the Silk Road, the Austronesian expansion and
// the Columbian exchange are the connective tissue between them.
//
// No persistent legend: toggle the layer on, then click a line to read what
// it was. Keeps the map chrome as quiet as the rest of the app.

const KINDS = {
  migration: { color: '#d08a4a', dash: [1.4, 1.4] },
  overland:  { color: '#b06a86', dash: [2.4, 1.6] },
  maritime:  { color: '#4f9aa8', dash: [3, 1.4, 0.4, 1.4] },
  forced:    { color: '#9c5a44', dash: [0.1, 2] },
};

export class Routes {
  constructor(map){
    this.map = map;
    this.visible = false;
    this.year = 2010;
    this.features = [];
    this._buildNote();
  }

  async load(url = 'data/routes.json'){
    const gj = await (await fetch(url)).json();
    this.features = gj.features;
    this.map.addSource('routes', { type: 'geojson', data: gj });

    this.map.addLayer({
      id: 'routes-halo', type: 'line', source: 'routes',
      layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': '#120f0c', 'line-opacity': 0.3, 'line-blur': 2.5,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 3.6, 6, 6.5, 10, 10],
      },
    });
    this.map.addLayer({
      id: 'routes-line', type: 'line', source: 'routes',
      layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' },
      paint: {
        'line-color': ['match', ['get', 'kind'],
          'migration', KINDS.migration.color,
          'overland',  KINDS.overland.color,
          'maritime',  KINDS.maritime.color,
          'forced',    KINDS.forced.color,
          '#c9a765'],
        'line-opacity': 0.92,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1.1, 6, 1.9, 10, 2.8],
        'line-dasharray': ['match', ['get', 'kind'],
          'migration', ['literal', KINDS.migration.dash],
          'maritime',  ['literal', KINDS.maritime.dash],
          'forced',    ['literal', KINDS.forced.dash],
          ['literal', KINDS.overland.dash]],
      },
    });

    this.map.on('click', 'routes-line', (e) => {
      const p = e.features?.[0]?.properties;
      if (p) this._show(`${p.name} — ${p.note}`);
    });
    this.map.on('mouseenter', 'routes-line', () => {
      if (this.visible) this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'routes-line', () => {
      this.map.getCanvas().style.cursor = '';
    });

    this._applyFilter();
    return this;
  }

  setYear(year){ this.year = year; this._applyFilter(); }

  toggle(){ this.setVisible(!this.visible); return this.visible; }

  setVisible(on){
    this.visible = on;
    const v = on ? 'visible' : 'none';
    for (const id of ['routes-halo', 'routes-line']){
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', v);
    }
    if (!on) this.note.classList.remove('show');
    else {
      const n = this._active().length;
      this._show(n
        ? `${n} route${n > 1 ? 's' : ''} on the map for this date — click a line to read it. Scrub the timeline to see the set change.`
        : `No routes recorded this far back — scrub forward to the Neolithic or later.`, 4200);
    }
  }

  _active(){
    return this.features.map(f => f.properties)
      .filter(p => p.from <= this.year && p.to >= this.year);
  }

  _applyFilter(){
    const f = ['all',
      ['<=', ['get', 'from'], this.year],
      ['>=', ['get', 'to'], this.year],
    ];
    for (const id of ['routes-halo', 'routes-line']){
      if (this.map.getLayer(id)) this.map.setFilter(id, f);
    }
  }

  _buildNote(){
    const t = document.createElement('div');
    t.id = 'routes-note';
    t.addEventListener('click', () => t.classList.remove('show'));
    document.body.appendChild(t);
    this.note = t;
  }

  _show(text, ms = 9000){
    this.note.textContent = text;
    this.note.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => this.note.classList.remove('show'), ms);
  }
}

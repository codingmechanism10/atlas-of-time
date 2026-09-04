// style.js — the look of the world.
//
// Deliberately no symbol layers: every label on this map is real HTML in a
// real serif face (see labels.js). SDF glyph rendering can't give you the
// letter-spacing and small-caps an antique atlas lives on, and skipping it
// also means the map needs no glyph server and works fully offline.

export const C = {
  // Deep ocean has to stay recognisably ocean. Push it much darker and the
  // glacial eras read as a black ring appearing around the continents
  // rather than as the shallows drying out.
  seaAbyss : '#14343f',
  sea      : '#1a3d49',
  seaShelf : '#2d6a7a',
  land     : '#e3d2ac',
  landEdge : '#8a7449',
  landDeep : '#d5c298',
  exposed  : '#cdbb92',
  lake     : '#2b6070',
  river    : '#527f8b',
  grat     : 'rgba(201,167,101,0.13)',
  ink      : '#2a2013',
};

// Muted, parchment-friendly territory colours. Chosen to sit under a
// warm land tone without any of them shouting.
export const POLITY_COLORS = [
  '#a8552d', '#6d7f52', '#8a6a9c', '#3f7176', '#b08a3c',
  '#9c5560', '#4f6a92', '#7c8b3f', '#a4703f', '#57806b',
  '#8e5b48', '#67628f', '#94794a', '#5b8383', '#a2617c',
];

export function polityColor(name){
  if (!name) return POLITY_COLORS[0];
  let h = 0;
  for (let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i)) >>> 0;
  return POLITY_COLORS[h % POLITY_COLORS.length];
}

const empty = { type:'FeatureCollection', features:[] };

export function buildStyle({ terrain = true } = {}){
  const sources = {
    land  : { type:'geojson', data:'data/base/land.geojson' },
    shelf : { type:'geojson', data:'data/base/shelf.geojson' },
    lakes : { type:'geojson', data:'data/base/lakes.geojson' },
    rivers: { type:'geojson', data:'data/base/rivers.geojson' },
    grat  : { type:'geojson', data: graticule(15) },
    era   : { type:'geojson', data: empty, generateId:true },
  };

  if (terrain){
    sources.dem = {
      type:'raster-dem',
      tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding:'terrarium', tileSize:256, maxzoom:12,
      attribution:'Elevation: Mapzen / AWS Terrain Tiles',
    };
  }

  const layers = [
    { id:'bg', type:'background',
      paint:{ 'background-color': C.seaAbyss } },

    // Continental shelf, read two ways. In a normal-sea era it is simply
    // shallower water. In a glacial era the same polygon is dry ground —
    // which is how Doggerland, Sundaland and Beringia surface.
    { id:'shelf-water', type:'fill', source:'shelf',
      paint:{ 'fill-color': C.seaShelf, 'fill-opacity': 0.55 } },

    { id:'shelf-exposed', type:'fill', source:'shelf',
      paint:{ 'fill-color': C.exposed, 'fill-opacity': 0 } },
    { id:'shelf-exposed-edge', type:'line', source:'shelf',
      paint:{ 'line-color': C.landEdge, 'line-width': 0.6, 'line-opacity': 0 } },

    { id:'land', type:'fill', source:'land',
      paint:{ 'fill-color': C.land } },
  ];

  if (terrain){
    layers.push({
      id:'hillshade', type:'hillshade', source:'dem',
      paint:{
        'hillshade-exaggeration': 0.5,
        'hillshade-shadow-color': '#6b5228',
        'hillshade-highlight-color': '#fff4d8',
        'hillshade-accent-color': '#8a6a35',
        'hillshade-illumination-direction': 315,
      },
    });
  }

  layers.push(
    { id:'graticule', type:'line', source:'grat',
      paint:{ 'line-color': C.grat, 'line-width': 0.6 } },

    { id:'lakes', type:'fill', source:'lakes',
      paint:{ 'fill-color': C.lake, 'fill-opacity': 0.85 } },

    { id:'rivers', type:'line', source:'rivers',
      paint:{
        'line-color': C.river,
        'line-opacity': 0.65,
        'line-width': ['interpolate',['linear'],['zoom'], 1,0.3, 5,0.9, 9,1.8],
      } },

    // Territories of the selected era.
    { id:'era-fill', type:'fill', source:'era',
      paint:{
        'fill-color': ['coalesce',['get','_color'], '#8a6a35'],
        // Territory wash fades back as you descend, so the terrain and the
        // parchment underneath carry the close-up view instead of a flat
        // sheet of colour.
        'fill-opacity': ['interpolate',['linear'],['zoom'],
          2, ['case',['boolean',['feature-state','hover'], false], 0.62, 0.42],
          6, ['case',['boolean',['feature-state','hover'], false], 0.50, 0.32],
          9, ['case',['boolean',['feature-state','hover'], false], 0.38, 0.20],
        ],
      } },

    { id:'era-line', type:'line', source:'era',
      paint:{
        'line-color': ['coalesce',['get','_color'], '#6b5228'],
        // NB: a zoom expression has to sit at the top level, so the
        // selected/normal branch goes inside each interpolation stop.
        'line-width': ['interpolate',['linear'],['zoom'],
          1, ['case',['boolean',['feature-state','selected'], false], 1.6, 0.5],
          5, ['case',['boolean',['feature-state','selected'], false], 2.6, 1.0],
          9, ['case',['boolean',['feature-state','selected'], false], 3.6, 1.6],
        ],
        'line-opacity': 0.85,
      } },

    // Coastline drawn last so the world always has a crisp edge.
    { id:'coast', type:'line', source:'land',
      paint:{
        'line-color': C.landEdge,
        'line-opacity': 0.8,
        'line-width': ['interpolate',['linear'],['zoom'], 1,0.5, 5,1.1, 9,1.8],
      } },
  );

  return {
    version: 8,
    name: 'Atlas of Time',
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#0b1d26',
      'sky-horizon-blend': 0.55,
      'horizon-color': '#3a5a63',
      'horizon-fog-blend': 0.6,
      'fog-color': '#0a1a22',
      'fog-ground-blend': 0.05,
      'atmosphere-blend': ['interpolate',['linear'],['zoom'], 0,0.9, 5,0.35, 7,0],
    },
    light: { anchor:'viewport', color:'#fff2d6', intensity:0.35, position:[1.2, 200, 32] },
    sources,
    layers,
  };
}

// A plain lat/lon grid. Costs nothing and does a lot of the atlas work.
function graticule(step){
  const features = [];
  for (let lon=-180; lon<=180; lon+=step){
    const c=[]; for (let lat=-85; lat<=85; lat+=2) c.push([lon,lat]);
    features.push({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates:c } });
  }
  for (let lat=-75; lat<=75; lat+=step){
    const c=[]; for (let lon=-180; lon<=180; lon+=2) c.push([lon,lat]);
    features.push({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates:c } });
  }
  return { type:'FeatureCollection', features };
}

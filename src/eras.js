// eras.js — the shape of time.
//
// STOPS is the spine of the whole app. Each entry is one position on the
// timeline scrubber. `file` points at a boundary reconstruction in
// data/eras/; stops with file:null are geological stops where we have a
// sea-level estimate but no polity reconstruction — the honest answer for
// deep prehistory.

export const STOPS = [
  { y:-123000, file:'world_bc123000.geojson', label:'Neanderthals and early Homo sapiens' },
  { y: -40000, file:null,                     label:'Upper Palaeolithic expansion' },
  { y: -20000, file:null,                     label:'Last Glacial Maximum' },
  { y: -14000, file:null,                     label:'Ice sheets in retreat' },
  { y: -12000, file:null,                     label:'The Younger Dryas' },
  { y: -10000, file:'world_bc10000.geojson',  label:'Mesolithic hunter-gatherers' },
  { y:  -8000, file:'world_bc8000.geojson',   label:'First farmers of the Fertile Crescent' },
  { y:  -5000, file:'world_bc5000.geojson',   label:'Neolithic villages spread' },
  { y:  -4000, file:'world_bc4000.geojson',   label:'Copper, cattle and the plough' },
  { y:  -3000, file:'world_bc3000.geojson',   label:'First cities: Uruk and Egypt' },
  { y:  -2000, file:'world_bc2000.geojson',   label:'Bronze Age palace states' },
  { y:  -1500, file:'world_bc1500.geojson',   label:'Empires of the Late Bronze Age' },
  { y:  -1000, file:'world_bc1000.geojson',   label:'After the Bronze Age collapse' },
  { y:   -700, file:'world_bc700.geojson',    label:'Assyria, Zhou, and the Greek colonies' },
  { y:   -500, file:'world_bc500.geojson',    label:'Achaemenid Persia at its height' },
  { y:   -400, file:'world_bc400.geojson',    label:'Classical Greece' },
  { y:   -323, file:'world_bc323.geojson',    label:'The death of Alexander' },
  { y:   -300, file:'world_bc300.geojson',    label:'The Hellenistic kingdoms' },
  { y:   -200, file:'world_bc200.geojson',    label:'Rome and Han, both rising' },
  { y:   -100, file:'world_bc100.geojson',    label:'The late Roman Republic' },
  { y:     -1, file:'world_bc1.geojson',      label:'Augustan Rome, Han China' },
  { y:    100, file:'world_100.geojson',      label:'Rome, Parthia, Kushan, Han' },
  { y:    200, file:'world_200.geojson',      label:'Severan Rome; Han unravelling' },
  { y:    300, file:'world_300.geojson',      label:'Sasanians and the Tetrarchy' },
  { y:    400, file:'world_400.geojson',      label:'Migrations across Eurasia' },
  { y:    500, file:'world_500.geojson',      label:'The post-Roman west; Gupta India' },
  { y:    600, file:'world_600.geojson',      label:'Sui China and Byzantium' },
  { y:    700, file:'world_700.geojson',      label:'Umayyad caliphate; Tibetan empire' },
  { y:    800, file:'world_800.geojson',      label:'Carolingians and Abbasids' },
  { y:    900, file:'world_900.geojson',      label:'Fragmentation; the Song rise' },
  { y:   1000, file:'world_1000.geojson',     label:'Cholas, Fatimids, Byzantium restored' },
  { y:   1100, file:'world_1100.geojson',     label:'Crusader states; Angkor' },
  { y:   1200, file:'world_1200.geojson',     label:'The eve of the Mongol expansion' },
  { y:   1279, file:'world_1279.geojson',     label:'The Mongol zenith' },
  { y:   1300, file:'world_1300.geojson',     label:'The successor khanates' },
  { y:   1400, file:'world_1400.geojson',     label:'Ming, Timur, and Delhi' },
  { y:   1492, file:'world_1492.geojson',     label:'Contact — the world before it changed' },
  { y:   1500, file:'world_1500.geojson',     label:'Ottoman and Safavid ascent' },
  { y:   1530, file:'world_1530.geojson',     label:'The Mughals arrive in India' },
  { y:   1600, file:'world_1600.geojson',     label:'Trading companies and empires' },
  { y:   1650, file:'world_1650.geojson',     label:"After the Thirty Years' War" },
  { y:   1700, file:'world_1700.geojson',     label:'Qing, Mughal, Bourbon' },
  { y:   1715, file:'world_1715.geojson',     label:'The age of Louis XIV ends' },
  { y:   1783, file:'world_1783.geojson',     label:'Revolutions in the Atlantic world' },
  { y:   1800, file:'world_1800.geojson',     label:'Napoleonic Europe' },
  { y:   1815, file:'world_1815.geojson',     label:'The Congress of Vienna' },
  { y:   1880, file:'world_1880.geojson',     label:'The scramble for Africa' },
  { y:   1900, file:'world_1900.geojson',     label:'High imperialism' },
  { y:   1914, file:'world_1914.geojson',     label:'The eve of the Great War' },
  { y:   1920, file:'world_1920.geojson',     label:'After Versailles' },
  { y:   1930, file:'world_1930.geojson',     label:'The interwar order' },
  { y:   1938, file:'world_1938.geojson',     label:'On the brink' },
  { y:   1945, file:'world_1945.geojson',     label:'The world remade' },
  { y:   1960, file:'world_1960.geojson',     label:'The year of Africa' },
  { y:   1994, file:'world_1994.geojson',     label:'After the Cold War' },
  { y:   2000, file:'world_2000.geojson',     label:'Turn of the millennium' },
  { y:   2010, file:'world_2010.geojson',     label:'The present map' },
];

export const BANDS = [
  { from:-123000, to:-12000, name:'Deep Prehistory' },
  { from: -12000, to: -3000, name:'Neolithic' },
  { from:  -3000, to: -1200, name:'Bronze Age' },
  { from:  -1200, to:   500, name:'Classical Antiquity' },
  { from:    500, to:  1400, name:'Medieval' },
  { from:   1400, to:  1800, name:'Early Modern' },
  { from:   1800, to:  2010, name:'Modern' },
];

// Relative sea-level curve, metres against today's datum. Sampled from
// published reconstructions — Spratt & Lisiecki 2016 and Lambeck et al. 2014
// for the last glacial cycle, Lambeck 2014 for the Holocene rise — and
// smoothed. Still an approximation (a single global curve hides big regional
// differences from glacial isostasy), but the shape and timing are real:
// the Eemian highstand at ~125 ka, the ~-130 m floor at the Last Glacial
// Maximum, Meltwater Pulse 1A around 14.5 ka, and the Younger Dryas pause.
const SEA = [
  [-130000, -6], [-125000,  7], [-120000,  2], [-115000,-12], [-110000,-25],
  [-100000,-32], [ -90000,-40], [ -85000,-24], [ -80000,-33], [ -75000,-58],
  [ -70000,-70], [ -60000,-72], [ -55000,-76], [ -50000,-70], [ -45000,-74],
  [ -40000,-68], [ -35000,-76], [ -30000,-92], [ -26500,-122],[ -21000,-129],
  [ -18000,-120],[ -16000,-107],[ -14500,-96], [ -14000,-82], [ -13000,-76],
  [ -12000,-67], [ -11700,-60], [ -10000,-48], [  -9000,-36], [  -8000,-25],
  [  -7000,-13], [  -6000, -5], [  -5000, -2], [  -4000, -1], [  -3000,-0.5],
  [  -2000,  0], [   2010,  0],
];

export function seaLevelAt(year){
  if (year <= SEA[0][0]) return SEA[0][1];
  for (let i=0;i<SEA.length-1;i++){
    const [y0,v0]=SEA[i], [y1,v1]=SEA[i+1];
    if (year>=y0 && year<=y1){
      const t=(year-y0)/(y1-y0);
      return v0+(v1-v0)*t;
    }
  }
  return 0;
}

export function bandFor(year){
  for (const b of BANDS) if (year>=b.from && year<b.to) return b.name;
  return BANDS[BANDS.length-1].name;
}

export function formatYear(y){
  if (y < 0) return { n: Math.abs(y).toLocaleString('en-US'), era: 'BCE' };
  if (y === 0) return { n: '1', era: 'CE' };
  return { n: y.toLocaleString('en-US'), era: 'CE' };
}

// --- timeline geometry -------------------------------------------------
// Pure years-before-present would squash the last four centuries into a
// sliver; pure index spacing would hide the fact that deep time is deep.
// Blend the two so the ruler is both usable and honest about its shape.
const OLDEST = -123000, NEWEST = 2010, SPAN = NEWEST - OLDEST;
const INDEX_WEIGHT = 0.66;

export function positionOf(index){
  const y = STOPS[index].y;
  const idxPos = index / (STOPS.length - 1);
  const timePos = 1 - Math.pow((NEWEST - y) / SPAN, 0.25);
  return INDEX_WEIGHT * idxPos + (1 - INDEX_WEIGHT) * timePos;
}

export function nearestIndex(frac){
  let best = 0, bestD = Infinity;
  for (let i=0;i<STOPS.length;i++){
    const d = Math.abs(positionOf(i) - frac);
    if (d < bestD){ bestD = d; best = i; }
  }
  return best;
}

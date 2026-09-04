// timeline.js — the scrubber.

import { STOPS, BANDS, positionOf, nearestIndex, formatYear, bandFor, seaLevelAt } from './eras.js';

const MAJOR = new Set([-123000,-20000,-10000,-5000,-3000,-1000,-1,500,1000,1492,1650,1800,1900,2025]);

export class Timeline {
  constructor(onChange){
    this.onChange = onChange;
    this.index = STOPS.length - 1;
    this.track  = document.getElementById('tl-track');
    this.ticks  = document.getElementById('tl-ticks');
    this.handle = document.getElementById('tl-handle');
    this.hit    = document.getElementById('tl-hit');
    this.bandsEl= document.getElementById('tl-bands');
    this.build();
    this.bind();
    this.set(this.index, true);
  }

  build(){
    const frag = document.createDocumentFragment();
    STOPS.forEach((s, i) => {
      const major = MAJOR.has(s.y);
      const pos = positionOf(i);
      const d = document.createElement('div');
      d.className = 'tick' + (major ? ' major' : '') + (s.file ? '' : ' nodata')
                  + (pos < 0.03 ? ' edge-l' : pos > 0.97 ? ' edge-r' : '');
      d.style.left = (pos * 100) + '%';
      const stem = document.createElement('div');
      stem.className = 'stem';
      stem.style.height = (major ? 30 : (s.file ? 14 : 20)) + 'px';
      d.appendChild(stem);
      if (major){
        const y = document.createElement('div');
        y.className = 'yr';
        const f = formatYear(s.y);
        y.textContent = f.n + ' ' + f.era;
        d.appendChild(y);
      }
      frag.appendChild(d);
    });
    this.ticks.appendChild(frag);

    // era bands along the bottom rail
    const bf = document.createDocumentFragment();
    BANDS.forEach(b => {
      const startIdx = STOPS.findIndex(s => s.y >= b.from);
      const endIdx   = STOPS.findIndex(s => s.y >= b.to);
      const x0 = positionOf(Math.max(0, startIdx));
      const x1 = endIdx === -1 ? 1 : positionOf(endIdx);
      const el = document.createElement('div');
      el.className = 'eband';
      el.style.left  = (x0 * 100) + '%';
      const w = Math.max(0, (x1 - x0) * 100);
      el.style.width = w + '%';
      // Don't print a name into a slot too narrow to hold it — a clipped
      // "BRONZE AG" is worse than an unlabelled rule.
      el.textContent = w > 7 ? b.name : '';
      el.title = b.name;
      bf.appendChild(el);
    });
    this.bandsEl.appendChild(bf);
  }

  bind(){
    let dragging = false;
    const pick = (e) => {
      const r = this.track.getBoundingClientRect();
      const x = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width;
      this.set(nearestIndex(Math.max(0, Math.min(1, x))));
    };
    const down = (e) => { dragging = true; pick(e); e.preventDefault(); };
    const move = (e) => { if (dragging) pick(e); };
    const up   = () => { dragging = false; };

    this.hit.addEventListener('mousedown', down);
    this.hit.addEventListener('touchstart', down, { passive:false });
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive:false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft')  { this.set(this.index - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { this.set(this.index + 1); e.preventDefault(); }
      if (e.key === 'Home')       { this.set(0); }
      if (e.key === 'End')        { this.set(STOPS.length - 1); }
    });
  }

  set(i, force){
    i = Math.max(0, Math.min(STOPS.length - 1, i));
    if (i === this.index && !force) return;
    this.index = i;
    const stop = STOPS[i];
    this.handle.style.left = (positionOf(i) * 100) + '%';

    const f = formatYear(stop.y);
    document.getElementById('tl-year').innerHTML =
      `${f.n}<span>${f.era}</span>`;
    document.getElementById('tl-band').textContent = stop.label;

    const sl = seaLevelAt(stop.y);
    const valEl  = document.getElementById('tl-sea-val');
    const noteEl = document.getElementById('tl-sea-note');
    if (Math.abs(sl) < 1.5){
      valEl.textContent = 'sea level as today';
      noteEl.textContent = bandFor(stop.y);
    } else if (sl < 0){
      valEl.textContent = `${sl.toFixed(0)} m`;
      noteEl.textContent = 'shelf exposed · ' + bandFor(stop.y);
    } else {
      valEl.textContent = `+${sl.toFixed(0)} m`;
      noteEl.textContent = 'interglacial highstand';
    }

    this.onChange(stop, i);
  }

  jumpToYear(year){
    let best = 0, bd = Infinity;
    STOPS.forEach((s, i) => { const d = Math.abs(s.y - year); if (d < bd){ bd = d; best = i; } });
    this.set(best);
  }

  get stop(){ return STOPS[this.index]; }
}

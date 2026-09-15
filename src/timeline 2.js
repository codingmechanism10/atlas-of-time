// timeline.js — the scrubber.

import { STOPS, BANDS, positionOf, nearestIndex, formatYear, bandFor, seaLevelAt } from './eras.js';
import { tick as detent } from './haptics.js';

const MAJOR = new Set([-123000,-20000,-10000,-5000,-3000,-1000,-1,500,1000,1492,1650,1800,1900,2025]);

export class Timeline {
  constructor(onChange){
    this.onChange = onChange;
    this.index = STOPS.length - 1;
    this.labelled = [];
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
        this.labelled.push(d);
      }
      frag.appendChild(d);
    });
    this.ticks.appendChild(frag);
    this.thinLabels();

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
    const down = (e) => {
      dragging = true;
      document.body.classList.add('tl-dragging');
      this.handle.classList.add('held');
      pick(e);
      e.preventDefault();
    };
    const move = (e) => { if (dragging) pick(e); };
    const up   = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('tl-dragging');
      this.handle.classList.remove('held');
    };

    // The track's width changes with the window, the phone breakpoint and the
    // panel; re-measure rather than assume the first pass still holds.
    let thinT = 0;
    const rethin = () => { clearTimeout(thinT); thinT = setTimeout(() => this.thinLabels(), 80); };
    window.addEventListener('resize', rethin);
    window.addEventListener('orientationchange', rethin);
    if (window.ResizeObserver) new ResizeObserver(rethin).observe(this.track);

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

  // 14 year labels do not fit in a 289px track — on a phone every one of them
  // collided. Rather than add another breakpoint guessing at widths, measure:
  // walk the labels left to right and drop any that would touch the last one
  // kept. Ends of the ruler are kept unconditionally, because "123,000 BCE"
  // and "2,025 CE" are what tell you what you are looking at.
  thinLabels(){
    const labels = this.labelled;
    if (!labels.length) return;
    for (const d of labels) d.classList.remove('crowded');

    const track = this.track.getBoundingClientRect();
    if (!track.width) return;                 // laid out but not yet visible

    const GAP = 6;
    const first = labels[0], last = labels[labels.length - 1];
    let lastRight = -Infinity;

    // Reserve the right-hand end first so it always survives the walk.
    const lastBox = last.querySelector('.yr').getBoundingClientRect();
    const lastLeft = lastBox.left - track.left;

    labels.forEach((d, i) => {
      if (d === first){ lastRight = d.querySelector('.yr').getBoundingClientRect().right - track.left; return; }
      if (d === last) return;
      const b = d.querySelector('.yr').getBoundingClientRect();
      const l = b.left - track.left, r = b.right - track.left;
      if (l < lastRight + GAP || r > lastLeft - GAP) d.classList.add('crowded');
      else lastRight = r;
    });
  }

  set(i, force){
    i = Math.max(0, Math.min(STOPS.length - 1, i));
    if (i === this.index && !force) return;
    const crossed = !force && this.index != null;
    this.index = i;
    const stop = STOPS[i];
    this.handle.style.left = (positionOf(i) * 100) + '%';

    // One notch of the ruler: vibrate, click, and nudge the grip. A stop at
    // either end of time, or one with no boundary data behind it, gets the
    // heavier detent so the ruler isn't uniform under the thumb.
    if (crossed){
      detent({ strong: i === 0 || i === STOPS.length - 1 || !stop.file });
      this.handle.classList.remove('tick');
      void this.handle.offsetWidth;          // restart the animation
      this.handle.classList.add('tick');
    }

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

// ambience.js — procedural regional drone.
//
// WHAT THIS IS NOT: recordings, samples, or traditional repertoire. Nothing is
// bundled and nothing is streamed. Every sound here is synthesised in the
// browser from oscillators and noise.
//
// WHAT IT IS: a drone and a slow scatter of notes, drawn from a tuning system
// and a timbre chosen for the region under the cursor — Hijaz and a plucked
// short-decay string around the eastern Mediterranean, a near-equidistant
// pentatonic and inharmonic struck metal around the Java Sea, Yaman over a
// tanpura-ish fifth in South Asia. It is evocative, not authentic, and the UI
// says so. The point is that the room changes when you move.

import { sharedContext, out as audioOut } from './haptics.js';

// Scales are semitone offsets from the tonic. Non-integers are deliberate:
// slendro is not a 12-tone-equal subset and rounding it to one loses the
// whole character.
const REGIONS = {
  'south-asia': {
    label: 'South Asia · Yaman over a tanpura fifth',
    anchors: [[78, 22], [88, 26], [74, 16]], root: 146.83,   // D3
    scale: [0, 2, 4, 6, 7, 9, 11],
    drone: [0, 7], voice: 'string', rate: 2.4, spread: 12,
  },
  'west-asia': {
    label: 'West Asia & North Africa · Hijaz',
    anchors: [[40, 32], [10, 33], [55, 27], [35, 25]], root: 164.81,  // E3
    scale: [0, 1, 4, 5, 7, 8, 10],
    drone: [0, 7], voice: 'pluck', rate: 1.5, spread: 12,
  },
  'east-asia': {
    label: 'East Asia · yo pentatonic',
    anchors: [[112, 34], [130, 36], [120, 24]], root: 174.61,  // F3
    scale: [0, 2, 5, 7, 9],
    drone: [0], voice: 'pluck', rate: 3.0, spread: 19,
  },
  'maritime-sea': {
    label: 'Maritime Southeast Asia · near-equidistant pentatonic',
    anchors: [[110, 0], [122, -6], [100, 10]], root: 155.56,
    scale: [0, 2.4, 4.8, 7.2, 9.6],
    drone: [0, 4.8], voice: 'metal', rate: 2.0, spread: 14,
  },
  'africa': {
    label: 'Sub-Saharan Africa · minor pentatonic, mbira-ish',
    anchors: [[20, 0], [-5, 12], [32, -20], [38, 5]], root: 130.81,  // C3
    scale: [0, 3, 5, 7, 10],
    drone: [0, 7], voice: 'mbira', rate: 1.1, spread: 17,
  },
  'europe': {
    label: 'Europe · Dorian over open fifths',
    anchors: [[12, 48], [-3, 52], [25, 45], [30, 60]], root: 146.83,
    scale: [0, 2, 3, 5, 7, 9, 10],
    drone: [0, 7], voice: 'bow', rate: 2.8, spread: 12,
  },
  'steppe': {
    label: 'The steppe · minor pentatonic, overtone drone',
    anchors: [[68, 46], [100, 47], [85, 52]], root: 110.00,   // A2
    scale: [0, 3, 5, 7, 10],
    drone: [0, 12], voice: 'bow', rate: 3.4, spread: 19,
  },
  'andes': {
    label: 'Andes & Mesoamerica · minor pentatonic, breath',
    anchors: [[-70, -15], [-60, -30], [-55, -5], [-98, 19]], root: 196.00,  // G3
    scale: [0, 3, 5, 7, 10],
    drone: [0], voice: 'breath', rate: 3.0, spread: 12,
  },
  'north-america': {
    label: 'North America · anhemitonic pentatonic',
    anchors: [[-100, 42], [-75, 45], [-120, 55]], root: 123.47,  // B2
    scale: [0, 2, 5, 7, 9],
    drone: [0], voice: 'breath', rate: 3.6, spread: 14,
  },
  'pacific': {
    label: 'Oceania · major pentatonic',
    anchors: [[-160, -15], [175, -20], [145, -25], [-150, 20]], root: 164.81,
    scale: [0, 2, 4, 7, 9],
    drone: [0, 7], voice: 'string', rate: 3.2, spread: 12,
  },
  'polar': {
    label: 'The ice · open fifth, no scale',
    anchors: [[0, 84], [-45, -80]], root: 98.00,   // G2
    scale: [0, 7, 12],
    drone: [0, 7], voice: 'breath', rate: 6.0, spread: 12,
  },
};

const KEYS = Object.keys(REGIONS);

export function regionFor(lng, lat){
  let best = KEYS[0], bd = Infinity;
  for (const k of KEYS){
    for (const [alng, alat] of REGIONS[k].anchors){
      // Flat-earth approximation with a cos(lat) correction — plenty good
      // enough to pick a neighbourhood, and it wraps at the antimeridian.
      const dLat = alat - lat;
      const dLng = ((alng - lng + 540) % 360) - 180;
      const d = Math.hypot(dLat, dLng * Math.cos((lat + alat) / 2 * Math.PI / 180));
      if (d < bd){ bd = d; best = k; }
    }
  }
  if (Math.abs(lat) > 66) best = 'polar';
  return best;
}

export function labelFor(key){ return REGIONS[key]?.label || ''; }

// ---------------------------------------------------------------- engine

export class Ambience {
  constructor(){
    this.on = false;
    this.key = null;
    this.nodes = null;
    this.timer = null;
    this.nextAt = 0;
  }

  get context(){ return sharedContext(); }

  setEnabled(on){
    this.on = on;
    if (!on){ this.stop(); return; }
    const c = this.context;
    if (c?.state === 'suspended') c.resume().catch(() => {});
    if (this.key) this.play(this.key, true);
  }

  // Called when the selection moves. Re-voices only if the region changed.
  setPlace(lng, lat){
    const k = regionFor(lng, lat);
    if (k === this.key) return k;
    this.key = k;
    if (this.on) this.play(k);
    return k;
  }

  play(key, force){
    const c = this.context;
    if (!c) return;
    if (this.nodes && !force) this.fadeOut(this.nodes, 1.6);
    else if (this.nodes) this.fadeOut(this.nodes, 0.4);
    this.nodes = this.buildDrone(c, REGIONS[key]);
    this.schedule(key);
  }

  stop(){
    if (this.nodes) { this.fadeOut(this.nodes, 1.2); this.nodes = null; }
    clearInterval(this.timer);
    this.timer = null;
  }

  fadeOut(nodes, secs){
    const c = this.context; if (!c) return;
    const t = c.currentTime;
    try {
      nodes.gain.gain.cancelScheduledValues(t);
      nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, t);
      nodes.gain.gain.linearRampToValueAtTime(0.0001, t + secs);
      for (const o of nodes.oscs) o.stop(t + secs + 0.1);
    } catch (_) {}
  }

  buildDrone(c, R){
    const t = c.currentTime;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.26, t + 0.9);

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 760;
    lp.Q.value = 0.6;

    // Slow filter breathing so the drone is never quite static.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.05 + Math.random() * 0.04;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 190;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start(t);

    const oscs = [lfo];
    for (const step of R.drone){
      const f = R.root * Math.pow(2, step / 12);
      for (const detune of [-4, 4]){
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = detune;
        const g = c.createGain();
        g.gain.value = 0.22;
        o.connect(g).connect(lp);
        o.start(t);
        oscs.push(o);
      }
    }
    lp.connect(gain).connect(audioOut() || c.destination);
    return { gain, oscs, lp };
  }

  // Look-ahead scheduler: pick notes a little before they're due so timing
  // doesn't depend on setInterval's accuracy.
  schedule(key){
    clearInterval(this.timer);
    const R = REGIONS[key];
    const c = this.context; if (!c) return;
    this.nextAt = c.currentTime + 0.4;
    this.timer = setInterval(() => {
      if (!this.on) return;
      const now = c.currentTime;
      while (this.nextAt < now + 0.6){
        this.voice(c, R, this.nextAt);
        // Uneven spacing — a scatter, not a pulse.
        this.nextAt += R.rate * (0.55 + Math.random() * 1.1);
      }
    }, 220);
  }

  voice(c, R, at){
    const step = R.scale[Math.floor(Math.random() * R.scale.length)];
    const oct = [0, 12, 12, 24][Math.floor(Math.random() * 4)];
    const f = R.root * Math.pow(2, (step + oct + R.spread) / 12);
    const g = c.createGain();
    g.connect(audioOut() || c.destination);
    const peak = 0.20 + Math.random() * 0.09;

    if (R.voice === 'metal'){
      // Inharmonic FM — struck bronze.
      const car = c.createOscillator(); car.type = 'sine'; car.frequency.value = f;
      const mod = c.createOscillator(); mod.type = 'sine'; mod.frequency.value = f * 2.76;
      const mg = c.createGain(); mg.gain.setValueAtTime(f * 3.4, at);
      mg.gain.exponentialRampToValueAtTime(f * 0.05, at + 1.6);
      mod.connect(mg).connect(car.frequency);
      car.connect(g);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 3.2);
      car.start(at); mod.start(at); car.stop(at + 3.3); mod.stop(at + 3.3);

    } else if (R.voice === 'breath'){
      // Noise through a tight bandpass at the note — a blown edge tone.
      const n = c.createBufferSource();
      const len = Math.floor(c.sampleRate * 2.6);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 26;
      const tone = c.createOscillator(); tone.type = 'sine'; tone.frequency.value = f;
      const tg = c.createGain(); tg.gain.value = 0.5;
      n.connect(bp).connect(g); tone.connect(tg).connect(g);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak * 0.8, at + 0.35);
      g.gain.linearRampToValueAtTime(0.0001, at + 2.4);
      n.start(at); tone.start(at); n.stop(at + 2.5); tone.stop(at + 2.5);

    } else if (R.voice === 'bow'){
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(f * 1.4, at);
      lp.frequency.linearRampToValueAtTime(f * 3.2, at + 0.9);
      o.connect(lp).connect(g);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak * 0.75, at + 0.5);
      g.gain.linearRampToValueAtTime(0.0001, at + 2.6);
      o.start(at); o.stop(at + 2.7);

    } else if (R.voice === 'mbira'){
      // Tine plus a little buzz, the way bottle caps rattle on the board.
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const b = c.createOscillator(); b.type = 'square'; b.frequency.value = f * 4.02;
      const bg = c.createGain(); bg.gain.value = 0.05;
      o.connect(g); b.connect(bg).connect(g);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.5);
      o.start(at); b.start(at); o.stop(at + 1.6); b.stop(at + 1.6);

    } else {
      // 'pluck' and 'string': triangle with a fast attack; 'string' rings on
      // and picks up a sympathetic octave, the way a tanpura course does.
      const long = R.voice === 'string';
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      o.connect(g);
      let symp = null;
      if (long){
        symp = c.createOscillator(); symp.type = 'sine'; symp.frequency.value = f * 2;
        const sg = c.createGain(); sg.gain.value = 0.22;
        symp.connect(sg).connect(g);
      }
      const dur = long ? 4.2 : 1.9;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.start(at); o.stop(at + dur + 0.1);
      if (symp){ symp.start(at); symp.stop(at + dur + 0.1); }
    }
  }
}

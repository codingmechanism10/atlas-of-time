// haptics.js — the detent.
//
// The feel of dragging the timeline past a stop: a short vibration where the
// platform allows it (Android Chrome; iOS Safari exposes nothing), plus a dry
// synthesised click so there is *something* on desktop, plus the CSS nudge on
// the handle itself. Together they read as a notch rather than a slide.
//
// The AudioContext is created lazily on the first tick — which is always
// inside a real gesture, so autoplay policy is satisfied.

let ctx = null;
let master = null;
let noiseBuf = null;
let enabled = true;
let lastAt = 0;

function audio(){
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { return null; }

  // Everything in the app goes through one master gain so levels are tunable
  // in one place and nothing can independently get loud.
  master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  // A tiny burst of white noise, reused for every click.
  const n = Math.floor(ctx.sampleRate * 0.05);
  noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  return ctx;
}

// Where every voice in the app should connect, instead of ctx.destination.
export function out(){ audio(); return master; }

export function setEnabled(v){ enabled = !!v; }
export function isEnabled(){ return enabled; }
export function setVolume(v){ if (out()) master.gain.value = Math.max(0, Math.min(1, v)); }

// Create and resume the context on the first real gesture, so the first thing
// the user actually triggers isn't swallowed by autoplay policy. Returns the
// context state for diagnostics.
export function unlock(){
  const c = audio();
  if (!c) return 'unsupported';
  if (c.state === 'suspended') c.resume().catch(() => {});
  return c.state;
}
if (typeof window !== 'undefined'){
  const once = () => { unlock(); window.removeEventListener('pointerdown', once); window.removeEventListener('keydown', once); };
  window.addEventListener('pointerdown', once, { passive: true });
  window.addEventListener('keydown', once, { passive: true });
}

export function audioState(){
  return { supported: !!(window.AudioContext || window.webkitAudioContext),
           created: !!ctx, state: ctx?.state ?? null,
           masterGain: master?.gain.value ?? null, enabled,
           vibrate: !!navigator.vibrate };
}

// A detent: something moved one notch.
export function tick({ strong = false } = {}){
  if (!enabled) return;

  // Rate-limit so a fast drag across many stops doesn't machine-gun.
  const now = performance.now();
  if (now - lastAt < 28) return;
  lastAt = now;

  if (navigator.vibrate) { try { navigator.vibrate(strong ? 12 : 6); } catch {} }

  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const t = c.currentTime;
  const bus = master;

  // Body: filtered noise, very short — the "wood" of the click.
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = strong ? 1750 : 2400;
  bp.Q.value = 1.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(strong ? 0.5 : 0.28, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(bp).connect(g).connect(bus);
  src.start(t);
  src.stop(t + 0.07);

  // Transient: a pitched blip so it reads as mechanical, not as static.
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(strong ? 420 : 620, t);
  o.frequency.exponentialRampToValueAtTime(strong ? 180 : 300, t + 0.03);
  const og = c.createGain();
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(strong ? 0.26 : 0.16, t + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
  o.connect(og).connect(bus);
  o.start(t);
  o.stop(t + 0.08);
}

// Shared context so ambience.js doesn't open a second one.
export function sharedContext(){ return audio(); }

// Shared kit for every episode: timing, colour, outlined shapes, synthesised sounds, player.

export const W = 640, H = 480;
export const INK = '#1b1b1b';
const LINE = 4;

// --- timing ---

export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const mix2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
export const rotate = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
// Progress of t through [t0, t1]; a zero-length span is an instant step.
export const span = (t, t0, t1) => (t1 === t0 ? +(t >= t1) : clamp((t - t0) / (t1 - t0)));
// 0 → 1 → 0 over `len` seconds starting at `at`.
export const bump = (t, at, len = 0.5) => (t < at || t > at + len ? 0 : Math.sin((Math.PI * (t - at)) / len));

export const ease = {
  linear: k => k,
  in: k => k * k,
  out: k => 1 - (1 - k) ** 2,
  inOut: k => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  // Overshoots a little past 1 before settling: a pose that lands with weight.
  outBack: k => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2,
};

function track(t, frames, mix, easing) {
  const i = frames.findIndex(([ft]) => ft >= t);
  if (i === -1) return frames.at(-1)[1];
  if (i === 0) return frames[0][1];
  const [t0, v0] = frames[i - 1], [t1, v1, own] = frames[i];
  return mix(v0, v1, (own ?? easing)(span(t, t0, t1)));
}
// Interpolate [[time, value, easing?], ...] sorted by time; values hold before the first and after the last key.
// A key's own easing shapes the segment that arrives at it (ease.in for a slam, ease.out for a bounce).
export const keys = (t, frames, easing = ease.inOut) => track(t, frames, lerp, easing);
export const keysColor = (t, frames, easing = ease.linear) => track(t, frames, mixColor, easing);

// --- colour ---

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export function mixColor(a, b, k) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((x, i) => Math.round(lerp(x, B[i], k)).toString(16).padStart(2, '0')).join('');
}

// Deterministic noise in [0, 1): same n, same value, so frames stay reproducible.
export function rand(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// --- shapes: flat fill, thick ink outline ---

export function shape(ctx, fill, trace, lw = LINE, ink = INK) {
  ctx.beginPath();
  trace(ctx);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) {
    ctx.lineWidth = lw; ctx.strokeStyle = ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }
}
export const ellipse = (ctx, x, y, rx, ry, fill, rot = 0) =>
  shape(ctx, fill, c => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2));
export const circle = (ctx, x, y, r, fill) => ellipse(ctx, x, y, r, r, fill);
export const box = (ctx, x, y, w, h, fill, r = 4) => shape(ctx, fill, c => c.roundRect(x, y, w, h, r));
const polyline = pts => c => pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
export const line = (ctx, pts, lw = LINE) => shape(ctx, null, polyline(pts), lw);
// A limb: coloured stroke with an ink rim.
export function tube(ctx, pts, fill, w = 14) {
  line(ctx, pts, w + LINE * 2);
  ctx.strokeStyle = fill; ctx.lineWidth = w;
  ctx.stroke();
}
export function label(ctx, str, x, y, size, fill = '#fff', ink = INK) {
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = size / 5; ctx.strokeStyle = ink; ctx.lineJoin = 'round';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

// --- sounds, synthesised with Web Audio ---

const noiseBuffers = new WeakMap();
function noise(ac) {
  if (!noiseBuffers.has(ac)) {
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ac, buf);
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuffers.get(ac);
  src.loop = true;
  return src;
}
function envelope(ac, when, peak, attack, release) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + release);
  g.connect(ac.destination);
  return g;
}
function tone(ac, when, type, f0, f1, dur, peak) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(f1, when + dur);
  o.connect(envelope(ac, when, peak, 0.005, dur));
  o.start(when);
  o.stop(when + dur + 0.05);
}
function hiss(ac, when, type, freq, dur, peak, attack = 0.005) {
  const src = noise(ac), f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  src.connect(f).connect(envelope(ac, when, peak, attack, dur));
  src.start(when);
  src.stop(when + attack + dur + 0.05);
}

export const sounds = {
  // Episode 2. A whistled note: slides up into pitch, a little vibrato, a breath of air.
  whistle: (ac, w, { f, dur }) => {
    const o = ac.createOscillator(), lfo = ac.createOscillator(), depth = ac.createGain(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 0.93, w);
    o.frequency.exponentialRampToValueAtTime(f, w + 0.05);
    lfo.frequency.value = 6; depth.gain.value = f * 0.012;
    lfo.connect(depth).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, w);
    g.gain.linearRampToValueAtTime(0.16, w + 0.03);
    g.gain.setValueAtTime(0.16, w + dur - 0.05);
    g.gain.linearRampToValueAtTime(0.0001, w + dur);
    o.connect(g).connect(ac.destination);
    o.start(w); lfo.start(w); o.stop(w + dur + 0.02); lfo.stop(w + dur + 0.02);
    hiss(ac, w, 'bandpass', f * 2, dur * 0.8, 0.012, 0.03);
  },
  // A footstep scored on a wood block, the 1930s way.
  woodblock: (ac, w, { f = 900 }) => { tone(ac, w, 'sine', f, f * 0.96, 0.07, 0.2); hiss(ac, w, 'bandpass', f * 2.2, 0.02, 0.08); },
  // A thumb flicking a coin up: the snap, then the coin ringing as it spins.
  coinFlick: (ac, w) => {
    hiss(ac, w, 'highpass', 4000, 0.012, 0.15);
    tone(ac, w + 0.01, 'sine', 3300, 3260, 0.28, 0.07);
    tone(ac, w + 0.01, 'sine', 4850, 4800, 0.18, 0.03);
  },
  // A coin caught in a glove: a soft slap.
  coinCatch: (ac, w) => { hiss(ac, w, 'lowpass', 900, 0.05, 0.3); tone(ac, w, 'sine', 220, 140, 0.05, 0.18); },
  // A coin glancing off a glove or hopping on stone: one short bright tick.
  coinTick: (ac, w) => { tone(ac, w, 'sine', 4200, 4100, 0.05, 0.08); hiss(ac, w, 'highpass', 6000, 0.01, 0.05); },
  // A coin rolling on its edge over stone: a fine rattle that slows down with it.
  coinRoll: (ac, w, { dur }) => {
    const src = noise(ac), f = ac.createBiquadFilter(), g = ac.createGain(), am = ac.createOscillator(), depth = ac.createGain();
    f.type = 'bandpass'; f.frequency.value = 5000; f.Q.value = 2;
    am.frequency.setValueAtTime(40, w); am.frequency.exponentialRampToValueAtTime(8, w + dur);
    depth.gain.value = 0.05; am.connect(depth).connect(g.gain);
    g.gain.setValueAtTime(0.06, w); g.gain.linearRampToValueAtTime(0.0001, w + dur);
    src.connect(f).connect(g).connect(ac.destination);
    src.start(w); am.start(w); src.stop(w + dur); am.stop(w + dur);
  },
  // A coin spinning down flat (Euler's disk): a ring whose warble speeds up, then a last slap.
  coinWobble: (ac, w, { dur }) => {
    const o = ac.createOscillator(), g = ac.createGain(), am = ac.createOscillator(), depth = ac.createGain();
    o.type = 'triangle'; o.frequency.value = 2900;
    am.frequency.setValueAtTime(6, w); am.frequency.exponentialRampToValueAtTime(45, w + dur);
    depth.gain.value = 0.05; am.connect(depth).connect(g.gain);
    g.gain.setValueAtTime(0.05, w); g.gain.linearRampToValueAtTime(0.0001, w + dur);
    o.connect(g).connect(ac.destination);
    o.start(w); am.start(w); o.stop(w + dur); am.stop(w + dur);
    tone(ac, w + dur, 'sine', 3000, 2500, 0.08, 0.08);
  },
  // Metal dragged over stone.
  coinScrape: (ac, w, { dur }) => hiss(ac, w, 'bandpass', 3200, dur, 0.1, 0.05),
  // Blowing on something to shine it: a breathy "haaa".
  breath: (ac, w, { dur }) => hiss(ac, w, 'bandpass', 1200, dur, 0.14, 0.08),
  // Rubbing a coin on fur, one stroke.
  rub: (ac, w) => { hiss(ac, w, 'bandpass', 2600, 0.09, 0.12, 0.02); tone(ac, w, 'triangle', 1800, 2400, 0.08, 0.03); },
  // A glint of light: three quick high notes going up.
  sparkle: (ac, w) => [3136, 3951, 4699].forEach((f, i) => tone(ac, w + i * 0.05, 'sine', f, f, 0.25, 0.06)),
  // A cat startled out of its skin: a yowl sliding up and down.
  yowl: (ac, w) => {
    const o = ac.createOscillator(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 3;
    o.frequency.setValueAtTime(500, w); o.frequency.exponentialRampToValueAtTime(1100, w + 0.12); o.frequency.exponentialRampToValueAtTime(600, w + 0.35);
    o.connect(f).connect(envelope(ac, w, 0.14, 0.02, 0.35));
    o.start(w); o.stop(w + 0.4);
  },
  // Tongue click with a wink.
  click: (ac, w) => { tone(ac, w, 'sine', 1800, 700, 0.03, 0.25); hiss(ac, w, 'bandpass', 2500, 0.015, 0.12); },
  // A kiss.
  smack: (ac, w) => { hiss(ac, w, 'bandpass', 1800, 0.04, 0.3); tone(ac, w + 0.02, 'sine', 900, 1500, 0.05, 0.12); },
  // A tap shoe on the road.
  tapShoe: (ac, w) => { tone(ac, w, 'square', 2200, 1800, 0.025, 0.06); hiss(ac, w, 'highpass', 3000, 0.02, 0.18); },
  // The jalopy's engine, putt-putting nearer for `dur` seconds, then cut dead by the crash. Coming on at a steady
  // speed, it is as loud as it is near: `near` is its starting loudness as a share of the last.
  engine: (ac, w, { dur, near = 0.06 }) => {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), am = ac.createOscillator(), depth = ac.createGain(), out = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(55, w); o.frequency.exponentialRampToValueAtTime(95, w + dur);
    f.type = 'lowpass'; f.frequency.setValueAtTime(300, w); f.frequency.exponentialRampToValueAtTime(1400, w + dur);
    am.frequency.setValueAtTime(9, w); am.frequency.exponentialRampToValueAtTime(18, w + dur);
    depth.gain.value = 0.5; g.gain.value = 0.5; am.connect(depth).connect(g.gain);
    out.gain.setValueCurveAtTime(Float32Array.from({ length: 64 }, (_, i) => (0.35 * near) / (1 - (1 - near) * (i / 63))), w, dur);
    out.gain.setValueAtTime(0, w + dur + 0.001);
    o.connect(f).connect(g).connect(out).connect(ac.destination);
    o.start(w); am.start(w); o.stop(w + dur); am.stop(w + dur);
  },
  // A bulb horn, « pouet ». `fall` strangles it: the pitch sags and dies.
  honk: (ac, w, { dur = 0.18, fall = false }) => {
    const o = ac.createOscillator(), f = ac.createBiquadFilter();
    o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5;
    o.frequency.setValueAtTime(380, w); o.frequency.linearRampToValueAtTime(430, w + 0.04);
    o.frequency.exponentialRampToValueAtTime(fall ? 120 : 400, w + dur);
    o.connect(f).connect(envelope(ac, w, 0.4, 0.015, dur));
    o.start(w); o.stop(w + dur + 0.05);
  },
  // The take: a slide whistle shooting up.
  slideUp: (ac, w) => tone(ac, w, 'sine', 500, 2400, 0.28, 0.2),
  // Tyres locking up on stone.
  screech: (ac, w, { dur }) => {
    hiss(ac, w, 'bandpass', 2800, dur, 0.2, 0.03);
    tone(ac, w, 'sawtooth', 1300, 1150, dur, 0.03);
  },
  // BADABOUM: a heavy blow, sheet metal, a hubcap rolling off.
  crash: (ac, w) => {
    tone(ac, w, 'sine', 110, 30, 0.45, 0.7);
    hiss(ac, w, 'lowpass', 1200, 0.4, 0.6);
    [[0.05, 610], [0.12, 987], [0.2, 733], [0.3, 1245]].forEach(([d, f]) => tone(ac, w + d, 'square', f, f * 0.9, 0.12, 0.08));
    for (let i = 0; i < 6; i++) tone(ac, w + 0.4 + i * 0.07, 'triangle', 1500 - i * 80, 1400 - i * 80, 0.05, 0.05 * (1 - i / 7));
  },
  creak: (ac, w) => tone(ac, w, 'sawtooth', 170, 260, 0.35, 0.08),
  chirp: (ac, w) => {
    tone(ac, w, 'sine', 2600, 3900, 0.07, 0.1);
    tone(ac, w + 0.1, 'sine', 2800, 4200, 0.07, 0.1);
  },
  knock: (ac, w) => {
    tone(ac, w, 'sine', 160, 55, 0.15, 0.6);
    hiss(ac, w, 'lowpass', 1500, 0.04, 0.3);
  },
  pop: (ac, w) => {
    tone(ac, w, 'sine', 300, 1100, 0.08, 0.5);
    hiss(ac, w, 'highpass', 2000, 0.06, 0.3);
  },
  // The impact: a deep blow that is over in 0.3 s, so the silence after it is total.
  boom: (ac, w) => { tone(ac, w, 'sine', 90, 28, 0.3, 0.9); hiss(ac, w, 'lowpass', 700, 0.28, 0.8); },
  // Something wet hitting something hard: the camera lens, the ground.
  splat: (ac, w) => { hiss(ac, w, 'lowpass', 900, 0.12, 0.6); tone(ac, w, 'sine', 140, 60, 0.1, 0.4); },
  squelch: (ac, w) => { hiss(ac, w, 'bandpass', 1200, 0.18, 0.3); tone(ac, w, 'sine', 300, 180, 0.15, 0.15); },
  // Teeth closing on a lid.
  clack: (ac, w) => { tone(ac, w, 'square', 900, 250, 0.05, 0.12); hiss(ac, w, 'bandpass', 3000, 0.03, 0.2); },
  // Biting into a pickle: two quick wet crackles.
  crunch: (ac, w) => { hiss(ac, w, 'bandpass', 2500, 0.07, 0.5); hiss(ac, w + 0.09, 'bandpass', 1800, 0.06, 0.35); },
  // A paw squeaking off a lid.
  squeak: (ac, w) => tone(ac, w, 'triangle', 1400, 500, 0.1, 0.12),
  clink: (ac, w) => {
    tone(ac, w, 'sine', 2300, 2250, 0.18, 0.12);
    tone(ac, w + 0.01, 'sine', 3450, 3400, 0.12, 0.05);
  },
  // Snow between two channels.
  static: (ac, w, { dur }) => hiss(ac, w, 'highpass', 900, dur, 0.18, 0.01),
  whoosh: (ac, w) => hiss(ac, w, 'highpass', 800, 0.25, 0.5, 0.05),
  tink: (ac, w) => {
    tone(ac, w, 'sine', 2600, 2580, 0.6, 0.15);
    tone(ac, w, 'sine', 3900, 3880, 0.4, 0.06);
  },
  // Episode 3. A loaded rope dragged over an iron rail: a low groan with fibres crackling.
  ropeCreak: (ac, w) => { tone(ac, w, 'sawtooth', 95, 130, 0.38, 0.06); hiss(ac, w + 0.04, 'bandpass', 1200, 0.28, 0.05); },
  // A rabbit's soft landing on a pavement.
  pat: (ac, w) => { tone(ac, w, 'sine', 150, 70, 0.07, 0.22); hiss(ac, w, 'lowpass', 900, 0.03, 0.08); },
  // Music leaking from headphones for `dur` seconds: tinny hi-hats on the eighths, a thin tune on the beats.
  leak: (ac, w, { dur, gain = 1 }) => {
    for (let k = 0; k * 0.25 < dur; k++) {
      hiss(ac, w + k * 0.25, 'highpass', 5000, 0.035, gain * (k % 2 ? 0.1 : 0.2));
      const note = [440, 440, 523, 392, 440, 587, 523, 392][Math.floor(k / 2) % 8];
      if (k % 2 === 0) tone(ac, w + k * 0.25, 'square', note, note, 0.14, gain * 0.08);
    }
  },
  // A rope strand parting: a bright pluck.
  strandPing: (ac, w) => { tone(ac, w, 'triangle', 1900, 1500, 0.18, 0.2); tone(ac, w, 'sine', 3800, 3000, 0.08, 0.06); },
  // The last strand: a low twang, then the rope whipping away.
  ropeTwang: (ac, w) => { tone(ac, w, 'sawtooth', 240, 70, 0.5, 0.18); hiss(ac, w + 0.05, 'highpass', 1500, 0.2, 0.2, 0.02); },
  // The cartoon fall: a whistle sliding down for `dur` seconds.
  fallWhistle: (ac, w, { dur }) => tone(ac, w, 'sine', 2300, 500, dur, 0.12),
  // A rope running fast over an iron rail for `dur` seconds.
  ropeRun: (ac, w, { dur }) => hiss(ac, w, 'bandpass', 1800, dur, 0.25, 0.05),
  // An upright piano hitting the pavement: a thud, splintering wood, a jangle of strings.
  pianoCrash: (ac, w) => {
    tone(ac, w, 'sine', 110, 35, 0.35, 0.7);
    hiss(ac, w, 'lowpass', 2500, 0.45, 0.55);
    for (const [i, f] of [196, 233, 277, 311, 370, 415, 494].entries()) tone(ac, w + 0.01 * i, 'triangle', f, f * 0.98, 0.9, 0.05);
  },
  // Every string at once, left to ring: « BLONNG ».
  chordClang: (ac, w, { dur }) => {
    for (const f of [65, 98, 139, 185, 247, 311, 415, 554]) {
      tone(ac, w, 'triangle', f, f * 0.995, dur, 0.07);
      tone(ac, w, 'sine', f * 2.01, f * 2, dur * 0.6, 0.03);
    }
  },
  // Headphones clattering on the pavement.
  clatter: (ac, w) => { tone(ac, w, 'square', 1300, 600, 0.04, 0.08); tone(ac, w + 0.09, 'square', 1100, 700, 0.03, 0.05); },
  // A long relieved breath out.
  phew: (ac, w) => hiss(ac, w, 'bandpass', 900, 0.45, 0.25, 0.08),
  // Paws slapped on cheeks.
  slap: (ac, w) => { hiss(ac, w, 'bandpass', 2200, 0.05, 0.5); tone(ac, w, 'sine', 300, 180, 0.05, 0.2); },
  // Low noise and sub-bass rising for `dur` seconds, then cut dead.
  rumble: (ac, w, { dur }) => {
    const src = noise(ac), f = ac.createBiquadFilter(), g = ac.createGain(), o = ac.createOscillator();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(80, w);
    f.frequency.exponentialRampToValueAtTime(400, w + dur);
    o.frequency.setValueAtTime(35, w);
    o.frequency.linearRampToValueAtTime(55, w + dur);
    g.gain.setValueAtTime(0.0001, w);
    g.gain.exponentialRampToValueAtTime(0.6, w + dur);
    g.gain.setValueAtTime(0, w + dur);
    src.connect(f).connect(g);
    o.connect(g);
    g.connect(ac.destination);
    src.start(w); o.start(w);
    src.stop(w + dur); o.stop(w + dur);
  },
};

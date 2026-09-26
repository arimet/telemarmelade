// Rubber hose kit, ported from anidoodle (https://github.com/alexgreensh/anidoodle, commit 03ddf53).
// Copyright 2026 Alex Greenshpun. Licensed under the Apache License, Version 2.0: see LICENSE-anidoodle and NOTICE.
//
// Changes from the original (engine/src/canvas-core/core.ts, gallery.ts, rubberHoseKit.ts, rubberHose.ts):
// - TypeScript to plain JS, only the pieces the rubber hose style needs;
// - inkCel/paintFills (separate ink and paint layers, knock-outs, timed reveal) replaced by drawParts,
//   which gets the same picture on one canvas by painting back to front: outline stroked double, fill over it;
// - filmPrint draws in logical units and builds its grain tile only where a canvas exists (not under node).

// --- deterministic noise ---

export const rng = seed => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const tables = new Map();
function table(seed) {
  let t = tables.get(seed);
  if (t) return t;
  const r = rng(seed * 7919 + 13), perm = new Uint16Array(512), gx = new Float32Array(256), gy = new Float32Array(256);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) { const a = r() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  t = { perm, gx, gy };
  tables.set(seed, t);
  return t;
}
function noise2(seed, x, y) {
  const { perm, gx, gy } = table(seed);
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const g = (ix, iy, dx, dy) => { const h = perm[perm[ix & 255] + (iy & 255)]; return gx[h] * dx + gy[h] * dy; };
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = g(x0, y0, fx, fy), b = g(x0 + 1, y0, fx - 1, fy), c = g(x0, y0 + 1, fx, fy - 1), d = g(x0 + 1, y0 + 1, fx - 1, fy - 1);
  return a + sx * (b - a) + sy * (c + sx * (d - c) - (a + sx * (b - a)));
}
// Octaves of gradient noise at halving amplitude, mapped to about 0..1.
export function fractal(seed, x, y, fx, fy, oct) {
  let sum = 0, amp = 1, kx = fx, ky = fy;
  for (let o = 0; o < oct; o++) { sum += noise2(seed + o * 101, x * kx, y * ky) * amp; amp *= 0.5; kx *= 2; ky *= 2; }
  return (sum + 1) / 2;
}

// --- geometry: every shape is a list of points ---

// Catmull-Rom through the points, `per` samples per segment.
export function smooth(pts, closed = false, per = 8) {
  if (pts.length < 2) return pts;
  const n = pts.length, at = i => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out = [], segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([f(0), f(1)]);
    }
  }
  out.push(closed ? out[0] : pts[n - 1]);
  return out;
}
export const qb = (a, c, b, n = 16) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
});
export const cb = (a, c1, c2, b, n = 16) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t, f = j => u * u * u * a[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * b[j];
  return [f(0), f(1)];
});
export const ell = (cx, cy, rx, ry, rot = 0, n = 28) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
  return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
});
export function capsule(a, b, r, n = 10) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), out = [];
  for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + (i / n) * Math.PI; out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]); }
  for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + (i / n) * Math.PI; out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]); }
  return out;
}
// A limb: one quadratic arc from a to b, bowed `bend` off the chord. Rubber hose has no elbow.
export function noodle(a, b, bend, n = 18) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return qb(a, [(a[0] + b[0]) / 2 - (dy / l) * bend, (a[1] + b[1]) / 2 + (dx / l) * bend], b, n);
}
// Place local points: mirror, scale (sx, sy), rotate, translate.
export function place(pts, o, ang = 0, sx = 1, sy = sx, mirror = false) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map(([x0, y0]) => { const x = (mirror ? -x0 : x0) * sx, y = y0 * sy; return [o[0] + x * c - y * s, o[1] + x * s + y * c]; });
}
// A tapered tube along a smoothed centreline, radius r0 at the start to r1 at the end.
export function tubeOf(centre, r0, r1 = r0) {
  const s = smooth(centre, false, 6), L = [], R = [];
  s.forEach((p, i) => {
    const q = s[Math.min(s.length - 1, i + 1)], o = s[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1;
    const r = r0 + ((r1 - r0) * i) / (s.length - 1);
    L.push([p[0] - (dy / l) * r, p[1] + (dx / l) * r]); R.push([p[0] + (dy / l) * r, p[1] - (dx / l) * r]);
  });
  return [...L, ...R.reverse()];
}
// The inker's slight wobble: a slow displacement field. A new `seed` is a new drawing (line boil).
export function wob(pts, amp, seed) {
  if (!amp) return pts;
  const ox = (seed * 97.31) % 5000, oy = (seed * 57.17) % 5000;
  return pts.map(([x, y]) => [
    x + (fractal(1930, x + ox, y + oy, 0.035, 0.035, 2) - 0.5) * amp,
    y + (fractal(1931, x + oy, y + ox, 0.035, 0.035, 2) - 0.5) * amp,
  ]);
}

// --- the rubber hose conventions ---

// A white four-digit glove, wrist at the origin, digits pointing up (-y): cuff, palm, three fingers, thumb.
export const GLOVE = [
  smooth([[-17, -10], [-21, -28], [-15, -45], [0, -49], [15, -45], [20, -28], [17, -10]], true, 5),
  capsule([-12, -38], [-17, -72], 7.6), capsule([1, -40], [2, -81], 7.9), capsule([13, -38], [19, -69], 7.3),
  capsule([-15, -22], [-37, -40], 7.6),
  smooth([[-20, 4], [0, 7], [20, 4], [17, -13], [0, -10], [-17, -13]], true, 5),
];
// A fist: the same palm and cuff, fingers curled into one lump.
export const FIST = [
  smooth([[-19, -8], [-24, -30], [-18, -52], [2, -58], [20, -50], [24, -28], [18, -8]], true, 5),
  capsule([-14, -30], [-34, -40], 7.6),
  smooth([[-20, 4], [0, 7], [20, 4], [17, -13], [0, -10], [-17, -13]], true, 5),
];
export const STITCH = [[[-7, -17], [-6, -33]], [[1, -17], [1, -35]], [[9, -17], [9, -32]]];
export const CUFF_LINE = [[-17, -13], [0, -10], [17, -13]];
// A big oval shoe, ankle at the origin, toe pointing +x.
export const SHOE = smooth([[-18, -10], [-4, -15], [20, -14], [42, -20], [62, -10], [66, 7], [52, 21], [0, 22], [-22, 18], [-27, 4]], true, 6);
// A pie-cut pupil: an oval with a wedge missing where the shine would be (upper left).
export function pie(cx, cy, rx, ry, cut = 0.8) {
  const out = [[cx, cy]];
  for (let i = 0; i <= 22; i++) { const a = -1.85 + (i / 22) * (Math.PI * 2 - cut); out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}

// --- painting a cel ---

export const INK = '#16130f';
const trace = (c, pts, close = true) => {
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  if (close) c.closePath();
};

// Parts back to front. Part = { outline: [pts...], ow, fills: [{ pts, col, alpha? }], details: [{ pts, w, closed?, col? }] }.
// The outline is stroked at twice its weight and the fills are laid over it, so only the outer half shows:
// overlapping pieces (glove fingers) read as one silhouette, and a nearer part hides the lines behind it.
// `ink` scales every line: a zoomed-in shot passes 1 / zoom so the line keeps its weight on screen.
export function drawParts(c, parts, ink = 1) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const pt of parts) {
    if (pt.outline?.length) {
      c.strokeStyle = INK; c.lineWidth = pt.ow * 2 * ink;
      c.beginPath(); pt.outline.forEach(o => trace(c, o)); c.stroke();
    }
    for (const f of pt.fills ?? []) {
      c.globalAlpha = f.alpha ?? 1; c.fillStyle = f.col;
      c.beginPath(); trace(c, f.pts); c.fill();
    }
    c.globalAlpha = 1;
    for (const d of pt.details ?? []) {
      c.strokeStyle = d.col ?? INK; c.lineWidth = d.w * ink;
      c.beginPath(); trace(c, d.pts, !!d.closed); c.stroke();
    }
  }
}

// --- the film print ---

let grain;
function grainTile() {
  if (grain !== undefined) return grain;
  const n = 256;
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(n, n)
    : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: n, height: n }) : null;
  grain = null;
  if (!cv) return grain;
  const g = cv.getContext('2d'), img = g.createImageData(n, n), d = img.data, r = rng(1931);
  for (let i = 0; i < n * n; i++) {
    const v = (r() + r() + r()) / 3, k = Math.round(Math.min(1, Math.max(0, 0.5 + (v - 0.5) * 2.2)) * 255);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = k; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return (grain = cv);
}

// A warm silver print over a W×H frame: toning, grain, lamp flicker, dust, a hair, the sprocket scratch,
// the lamp's vignette, the projector's rounded gate. `seed` picks this drawing's grain and dust; 0 for a still.
export function filmPrint(c, W, H, seed, { gate = true } = {}) {
  const r = rng(7000 + seed * 13);
  c.save();
  c.globalCompositeOperation = 'multiply'; c.fillStyle = '#ecdfc6'; c.fillRect(0, 0, W, H);
  const tile = grainTile();
  if (tile) {
    c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.34;
    c.fillStyle = c.createPattern(tile, 'repeat');
    c.save(); c.translate(-Math.floor(r() * 256), -Math.floor(r() * 256));
    c.fillRect(0, 0, W + 256, H + 256);
    c.restore();
  } else { r(); r(); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = `rgba(20,14,8,${(0.02 + r() * 0.05).toFixed(3)})`; c.fillRect(0, 0, W, H);
  const nd = 5 + Math.floor(r() * 5);
  for (let i = 0; i < nd; i++) {
    const x = r() * W, y = r() * H, s = 1 + r() * 2.6, dark = r() < 0.6;
    c.fillStyle = dark ? 'rgba(18,12,8,0.7)' : 'rgba(255,250,236,0.75)';
    c.beginPath(); trace(c, ell(x, y, s, s * (0.5 + r()), r() * 3, 8)); c.fill();
  }
  if (r() < 0.55) {
    const x = r() * W, y = r() * H, a = r() * 6;
    c.strokeStyle = 'rgba(20,14,8,0.55)'; c.lineWidth = 1;
    c.beginPath(); trace(c, qb([x, y], [x + Math.cos(a) * 30, y + Math.sin(a) * 30 + 12], [x + Math.cos(a + 1) * 44, y + Math.sin(a + 1) * 40]), false); c.stroke();
  }
  const sx = W * (0.62 + r() * 0.3);
  c.strokeStyle = 'rgba(255,250,236,0.35)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(sx, 0); c.lineTo(sx + (r() - 0.5) * 6, H); c.stroke();
  const vg = c.createRadialGradient(W * 0.48, H * 0.44, W * 0.2, W / 2, H / 2, W * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(22,14,6,0.55)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  if (gate) {
    const m = W / 68, R = W / 23;
    c.fillStyle = '#0b0907'; c.beginPath(); c.rect(0, 0, W, H);
    c.moveTo(m + R, m); c.arcTo(m, m, m, m + R, R); c.arcTo(m, H - m, m + R, H - m, R);
    c.arcTo(W - m, H - m, W - m, H - m - R, R); c.arcTo(W - m, m, W - m - R, m, R); c.closePath();
    c.fill('evenodd');
  }
  c.restore();
}

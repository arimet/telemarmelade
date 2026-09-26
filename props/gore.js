// Cartoon gore shared by the episodes' endings: splashes, puddles, blood on the lens.
import { shape, rand, span, ease } from '../engine.js';

export const BLOOD = '#b3121e', BLOOD_DARK = '#6e0a12', BLOOD_LIGHT = '#d8323b';

// An irregular splash: a ring of jittered points joined by a smooth curve, so it reads as liquid.
export function blob(c, x, y, r, seed, sy = 1) {
  const n = 11;
  const pts = Array.from({ length: n }, (_, j) => {
    const a = (j / n) * Math.PI * 2, rr = r * (0.72 + 0.5 * rand(seed * 31 + j));
    return [x + Math.cos(a) * rr, y + Math.sin(a) * rr * sy];
  });
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  c.moveTo(...mid(pts[n - 1], pts[0]));
  pts.forEach((p, j) => c.quadraticCurveTo(...p, ...mid(p, pts[(j + 1) % n])));
  c.closePath();
}

// A puddle spreading from `at` for `grow` seconds, with a few satellite drops.
export function puddle(ctx, t, at, x, y, r, seed, { sy = 1, grow = 0.8 } = {}) {
  const k = ease.out(span(t, at, at + grow));
  if (!k) return;
  shape(ctx, BLOOD, c => blob(c, x, y, r * k, seed, sy), 2.5, BLOOD_DARK);
  for (let s = 0; s < 6; s++) {
    const a = rand(seed * 5 + s) * Math.PI * 2, d = r * k * (1.1 + 0.4 * rand(seed * 7 + s));
    shape(ctx, BLOOD, c => c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * sy, (3 + 4 * rand(seed + s)) * k, 0, Math.PI * 2), 0);
  }
  ctx.globalAlpha = 0.5;
  shape(ctx, BLOOD_LIGHT, c => blob(c, x - r * 0.15 * k, y - r * 0.15 * k * sy, r * 0.5 * k, seed + 3, sy), 0);
  ctx.globalAlpha = 1;
}

// What lands on the lens stays on the lens and runs down it.
// splats: [{ at, x, y, r }] in screen units; `tuft` draws something stuck in the last one.
export function lens(ctx, t, splats, { tuft } = {}) {
  splats.forEach(({ at, x, y, r }, i) => {
    if (t < at) return;
    const pop = ease.outBack(span(t, at, at + 0.06));
    for (let d = 0; d < 3; d++) {
      const dx = (rand(i * 7 + d) - 0.5) * r * 1.1, len = r * (1.4 + 2 * rand(i * 9 + d)) * ease.inOut(span(t, at + 0.08, at + 1.3));
      const w = 8 + 6 * rand(i + d);
      shape(ctx, null, c => { c.moveTo(x + dx, y); c.lineTo(x + dx, y + r * 0.5 + len); }, w, BLOOD);
      shape(ctx, BLOOD, c => c.ellipse(x + dx, y + r * 0.5 + len, w * 0.75, w, 0, 0, Math.PI * 2), 0);
    }
    ctx.globalAlpha = 0.93;
    shape(ctx, BLOOD, c => blob(c, x, y, r * pop, i + 60), 3, BLOOD_DARK);
    for (let s = 0; s < 5; s++) {
      const a = rand(i * 13 + s) * Math.PI * 2, d = r * pop * (1.25 + 0.5 * rand(i * 17 + s));
      shape(ctx, BLOOD, c => c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + 5 * rand(i * 19 + s), 0, Math.PI * 2), 0);
    }
    ctx.globalAlpha = 0.55;
    shape(ctx, BLOOD_LIGHT, c => blob(c, x - r * 0.1, y - r * 0.1, r * 0.55 * pop, i + 80), 0);
    ctx.globalAlpha = 0.7;
    shape(ctx, '#ffffff', c => c.ellipse(x - r * 0.3, y - r * 0.35, r * 0.16, r * 0.08, -0.5, 0, Math.PI * 2), 0);
    ctx.globalAlpha = 1;
    if (tuft && i === splats.length - 1) tuft(ctx, x + r * 0.2, y + r * 0.1, r * 0.22);
  });
}

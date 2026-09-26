// The pickle jar, drawn around the centre of its glass: pickles, glass, neck, red screw lid on top.
import { shape } from '../engine.js';

export const JAR_W = 56, JAR_H = 64;
const GLASS = '#3f6f78', RED = '#d8433a', RED_LINE = '#7a1a14';

// open: the lid is gone. pickles: how many are left inside (4 when full). ink scales the outlines for close-ups.
// turn: how far the lid has turned on its thread.
export function drawJar(ctx, x, y, rot = 0, { open = false, pickles = 4, ink = 1, turn = 0 } = {}) {
  const w = JAR_W, h = JAR_H;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  for (const [dx, dy, r] of PICKLES.slice(0, pickles)) {
    shape(ctx, '#6fae3f', c => c.ellipse(dx, dy, 7, 16, r, 0, Math.PI * 2), 2 * ink, '#3d6b1f');
  }
  shape(ctx, 'rgba(205,238,246,0.5)', c => c.roundRect(-w / 2, -h / 2, w, h, 11), 2.4 * ink, GLASS);
  shape(ctx, null, c => { c.moveTo(-w / 2 + 9, -h / 2 + 12); c.lineTo(-w / 2 + 9, h / 2 - 14); }, 3.5 * ink, 'rgba(255,255,255,0.85)');
  shape(ctx, '#e8f6fa', c => c.roundRect(-w / 2 + 4, -h / 2 - 5, w - 8, 7, 2), 2 * ink, GLASS); // the neck
  if (!open) drawLid(ctx, 0, -h / 2 - 10, 0, ink, turn);
  ctx.restore();
}

// The lid on its own, around its centre; `turn` slides the grip stripes, which shows it turning.
export function drawLid(ctx, x, y, rot = 0, ink = 1, turn = 0) {
  const w = JAR_W + 4;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  shape(ctx, RED, c => c.roundRect(-w / 2, -7, w, 14, 4), 2.4 * ink, RED_LINE);
  for (let i = 0; i < 6; i++) {
    const sx = -w / 2 + 5 + ((i * 10 + turn + 600) % 60) * (w - 10) / 60;
    shape(ctx, null, c => { c.moveTo(sx, -4); c.lineTo(sx, 4); }, 1.6 * ink, RED_LINE);
  }
  ctx.restore();
}

const PICKLES = [[14, -12, 0.5], [-12, 12, 0.3], [10, 6, -0.4], [-2, -10, 0.15]];

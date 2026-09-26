// Pastel garden, low contrast so the puppets stand out.
import { shape } from '../engine.js';

// `far` draws what lies between the sky and the hills: sun, clouds, a meteor coming down behind them.
export function drawGarden(ctx, w, h, sky = ['#f9e7a6', '#fdf4da'], far) {
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  g.addColorStop(0, sky[0]);
  g.addColorStop(1, sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  far?.(ctx);
  shape(ctx, '#c5dd98', c => {
    c.moveTo(-10, h * 0.66);
    c.bezierCurveTo(w * 0.2, h * 0.5, w * 0.4, h * 0.52, w * 0.57, h * 0.6);
    c.bezierCurveTo(w * 0.75, h * 0.5, w * 0.9, h * 0.5, w + 10, h * 0.58);
    c.lineTo(w + 10, h + 10); c.lineTo(-10, h + 10); c.closePath();
  }, 2, '#9fbc72');
  shape(ctx, '#a6d27a', c => {
    c.moveTo(-10, h * 0.76);
    c.quadraticCurveTo(w / 2, h * 0.7, w + 10, h * 0.76);
    c.lineTo(w + 10, h + 10); c.lineTo(-10, h + 10); c.closePath();
  }, 2, '#86b35c');
}

const WOOD = '#c98a4b', WOOD_DARK = '#9a6232', WOOD_LINE = '#5e3515';

// A small garden table, front view; (x, y) is the left end of its top surface.
export function drawTable(ctx, x, y, w) {
  for (const lx of [x + 14, x + w - 26]) shape(ctx, WOOD_DARK, c => c.roundRect(lx, y + 8, 12, 42, 3), 2.2, WOOD_LINE);
  shape(ctx, WOOD, c => c.roundRect(x, y, w, 12, 4), 2.4, WOOD_LINE);
  shape(ctx, null, c => { c.moveTo(x + w * 0.35, y + 3); c.lineTo(x + w * 0.35, y + 10); c.moveTo(x + w * 0.7, y + 3); c.lineTo(x + w * 0.7, y + 10); }, 1.6, WOOD_LINE);
}

// A plate with a fat sandwich; (x, y) is where the plate touches the table.
export function drawSandwich(ctx, x, y) {
  shape(ctx, '#ffffff', c => c.ellipse(x, y - 3, 42, 7, 0, 0, Math.PI * 2), 2, '#8a8a9a');
  shape(ctx, '#f3c577', c => c.roundRect(x - 32, y - 14, 64, 10, 5), 2, '#8a5a1c');
  shape(ctx, '#7cc25a', c => {
    c.moveTo(x - 34, y - 14);
    for (let i = 0; i <= 8; i++) c.lineTo(x - 34 + i * 8.5, y - 14 - (i % 2 ? 5 : 1));
    c.lineTo(x + 34, y - 12); c.closePath();
  }, 1.6, '#3d7a25');
  shape(ctx, '#f7b0a0', c => c.roundRect(x - 30, y - 22, 60, 7, 3), 1.6, '#a0524a');
  shape(ctx, '#f3c577', c => { c.moveTo(x - 32, y - 20); c.bezierCurveTo(x - 30, y - 40, x + 30, y - 40, x + 32, y - 20); c.closePath(); }, 2, '#8a5a1c');
}

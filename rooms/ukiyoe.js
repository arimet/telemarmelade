// The living room at dusk as an ukiyo-e colour woodblock print: flat colour blocks printed slightly
// off-register, a sumi keyblock outline of uneven weight, bokashi gradients, woodgrain and washi paper.
import { rand, mixColor } from '../engine.js';

// Where the TV picture sits, in logical coordinates (4:3, like the episodes).
export const TV_SCREEN = { x: 670, y: 344, w: 176, h: 132 };
// Channel knob, then power knob, as circles covering each knob's whole outline.
export const TV_KNOBS = [{ x: 903, y: 364, r: 17 }, { x: 903, y: 404, r: 17 }];
// The tube's glass: rounded corners and slightly bulging sides (5 units past TV_SCREEN at mid-edges).
// Exported so the page can cut the live picture to its exact shape.
export function traceScreen(p) {
  const { x, y, w, h } = TV_SCREEN, b = 5, r = 22;
  p.moveTo(x + r, y);
  p.quadraticCurveTo(x + w / 2, y - b, x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.quadraticCurveTo(x + w + b, y + h / 2, x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.quadraticCurveTo(x + w / 2, y + h + b, x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.quadraticCurveTo(x - b, y + h / 2, x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
}

const SUMI = '#221c18', PAPER = '#efe3c6', M = 12; // M: the sheet's unprinted margin
const C = {
  prussian: '#2a4a7a', indigo: '#1d3055', blueMid: '#5d80aa',
  vermilion: '#cf4a2b', rust: '#9c3a22', pink: '#e8a99c', pinkPale: '#f2cdbd',
  ochre: '#d6a95c', ochrePale: '#ead6a4', yellow: '#f1d68c',
  green: '#6f8f55', greenPale: '#a9bf88', greenDeep: '#3e5c3b',
  wood: '#8a4f2e', woodDark: '#553222', woodDeep: '#3b2419',
  grey: '#3b4543',
};

// One-point perspective for the room shell; the vanishing point sits inside the TV screen,
// so every floorboard, beam and rug edge runs into it.
const VP = [800, 430], F = 1000, FLOOR = 95;
const P = (X, Y, Z) => [VP[0] + (F * X) / Z, VP[1] + (F * Y) / Z];

// A closed polygon whose long edges waver a little, as a knife cuts them.
const poly = pts => p => {
  pts.forEach(([x, y], i) => {
    if (!i) return p.moveTo(x, y);
    const [x0, y0] = pts[i - 1], len = Math.hypot(x - x0, y - y0), n = Math.floor(len / 36);
    for (let k = 1; k < n; k++) {
      const t = k / n, j = (rand(x0 * 0.37 + y0 * 1.91 + k * 7.3) - 0.5) * 1.4;
      p.lineTo(x0 + (x - x0) * t - ((y - y0) / len) * j, y0 + (y - y0) * t + ((x - x0) / len) * j);
    }
    p.lineTo(x, y);
  });
  p.closePath();
};
const rr = (x, y, w, h, r) => p => p.roundRect(x, y, w, h, r);

// --- the print's textures ---
// Both are seamless tiles defined in logical units and laid as patterns, so they stay attached to the
// paper at any zoom (a close-up matches the wide view), and their memory depends on the zoom, not the sheet.

const GW = 800, GH = 400; // woodgrain tile, logical units; lines run along x, so it can be shallow
const WASH = 128, WASH_RES = 2; // washi tile, logical units, and noise cells per logical unit
const TAU = Math.PI * 2;
const wrap = (d, p) => d - p * Math.round(d / p);
const cache = new Map();
function textures(scale) {
  if (cache.has(scale)) return cache.get(scale);
  // Woodgrain of the blocks: long wavy lines bending round a few knots, periodic in x and y.
  // Past 4 px per unit the grain lines gain nothing but memory (20 MB at 4), so the tile stops there.
  const res = Math.min(scale, 4);
  const grain = new OffscreenCanvas(Math.ceil(GW * res), Math.ceil(GH * res));
  const g = grain.getContext('2d');
  g.scale(grain.width / GW, grain.height / GH);
  const knots = Array.from({ length: 3 }, (_, i) => [rand(i * 3.1) * GW, rand(i * 5.7) * GH, 20 + rand(i * 9.3) * 40]);
  const ys = [];
  for (let y0 = 0, i = 0; y0 < GH - 2; y0 += 2.6 + rand(i * 1.7) * 3, i++) ys.push([y0, i]);
  for (const [y0, i] of ys) {
    const path = new Path2D();
    for (let x = 0; x <= GW; x += 8) {
      let y = y0 + 2.2 * Math.sin((TAU * x) / GW + (TAU * y0) / GH) + 1.1 * Math.sin((TAU * 3 * x) / GW + (TAU * 2 * y0) / GH);
      for (const [kx, ky, kr] of knots) {
        const dy = wrap(y0 - ky, GH), d = (wrap(x - kx, GW) ** 2 + dy ** 2) / (kr * kr * 4);
        y += Math.sign(dy || 1) * kr * 0.4 * Math.exp(-d);
      }
      x ? path.lineTo(x, y) : path.moveTo(x, y);
    }
    g.strokeStyle = `rgba(60,36,18,${0.05 + rand(i * 2.3) ** 2 * 0.4})`;
    g.lineWidth = 0.5 + rand(i * 4.1) * 1.3;
    // Drawn three times a period apart, so a line leaving the tile comes back in on the other side.
    for (const dy of [-GH, 0, GH]) { g.save(); g.translate(0, dy); g.stroke(path); g.restore(); }
  }
  // Washi: noise cells fixed in logical units (the browser smooths them when zoomed in).
  const n = WASH * WASH_RES, wash = new OffscreenCanvas(n, n), w = wash.getContext('2d');
  const img = w.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const v = 200 + rand(i + 0.5) * 55;
    img.data.set([v, v * 0.97, v * 0.9, 255], i * 4);
  }
  w.putImageData(img, 0, 0);
  const t = { grain, wash };
  cache.clear(); // one resolution at a time: a close-up's tile is big enough not to keep around
  cache.set(scale, t);
  return t;
}
function tile(ctx, image, w, h, dx = 0, dy = 0) {
  const pat = ctx.createPattern(image, 'repeat');
  pat.setTransform(new DOMMatrix().translate(dx, dy).scale(w / image.width, h / image.height));
  return pat;
}

// --- printing ---

let T; // textures for the current draw
let seedCounter = 0;

// Each colour block lands a little off the keyblock: the offset depends on the colour, as each colour is its own block.
function registration(fill) {
  const h = typeof fill === 'string' ? [...fill].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) : 3;
  return [(rand(h) - 0.4) * 6, (rand(h + 1) - 0.4) * 5];
}

// The keyblock line: a thin even line under a thicker broken one, so the weight swells and thins like a carved line.
function keyline(ctx, path, lw, seed) {
  ctx.save();
  ctx.strokeStyle = SUMI; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = lw * 0.62;
  ctx.stroke(path);
  const dash = [];
  for (let i = 0; i < 10; i++) dash.push(30 + rand(seed * 13.7 + i) * 120, 6 + rand(seed * 7.3 + i) * 40);
  ctx.setLineDash(dash);
  ctx.lineDashOffset = rand(seed * 3.3) * 300;
  ctx.lineCap = 'butt';
  ctx.lineWidth = lw * 0.85;
  ctx.stroke(path);
  ctx.restore();
}

// Grain printed into whatever the current clip is.
function grainInto(ctx, alpha, seed) {
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = tile(ctx, T.grain, GW, GH, -rand(seed) * GW, -rand(seed + 0.5) * GH);
  ctx.fillRect(0, 0, 1600, 1000);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// A colour block: misregistered fill with woodgrain, then its keyline in true position.
function block(ctx, fill, trace, { lw = 3, grain = 0.35, off, ink = true } = {}) {
  const seed = ++seedCounter;
  const path = new Path2D();
  trace(path);
  if (fill) {
    const [dx, dy] = off ?? registration(fill);
    ctx.save();
    ctx.translate(dx, dy);
    ctx.fillStyle = fill;
    ctx.fill(path);
    if (grain) { ctx.clip(path); grainInto(ctx, grain, seed); }
    ctx.restore();
  }
  if (ink && lw) keyline(ctx, path, lw, seed);
  return path;
}

function stroke(ctx, pts, lw = 2.4) {
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  keyline(ctx, path, lw, ++seedCounter);
}
function gradient(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([k, c]) => g.addColorStop(k, c));
  return g;
}
function glow(ctx, x, y, r, color, alpha, sy = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, color); g.addColorStop(1, color + '00');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
}

// --- the room shell ---

const LEFT_WALL = [[0, -10], [260, -10], [260, 620], [0, 711.5]];
const RIGHT_WALL = [[1340, -10], [1600, -10], [1600, 711.5], [1340, 620]];

function shell(ctx) {
  // Walls: pale ochre under an indigo ichimonji bokashi at the top, as the evening comes in.
  const dusk = (a, b) => gradient(ctx, 0, 0, 0, 640, [[0, C.indigo], [0.06, C.prussian], [0.2, mixColor(C.blueMid, a, 0.4)], [0.42, a], [1, b]]);
  block(ctx, dusk('#ecdcb4', '#e2cc9c'), rr(250, -10, 1100, 640, 0), { lw: 0, off: [0, 0] });
  block(ctx, dusk('#d9c49a', '#cdb68a'), poly(LEFT_WALL), { lw: 0, off: [0, 0] });
  block(ctx, dusk('#f0d9a4', '#e6cb92'), poly(RIGHT_WALL), { lw: 0, off: [0, 0] });

  // The floor: boards running into the vanishing point, darker towards us.
  const floor = [[0, 711.5], [260, 620], [1340, 620], [1600, 711.5], [1600, 1000], [0, 1000]];
  block(ctx, gradient(ctx, 0, 620, 0, 1000, [[0, '#d0a466'], [0.5, '#b88650'], [1, '#8a5c34']]), poly(floor), { lw: 0, off: [0, 0], grain: 0.6 });
  for (let X = -270, i = 0; X <= 270; X += 27, i++) {
    stroke(ctx, [P(X, FLOOR, 500), P(X, FLOOR, 150)], 1.8);
    // Butt joints, staggered from board to board.
    for (let k = 0; k < 3; k++) {
      const Z = 190 + rand(i * 5.1 + k) * 300;
      stroke(ctx, [P(X, FLOOR, Z), P(X + 27, FLOOR, Z)], 1.3);
    }
  }

  // Skirting, lintel (nageshi) and corner posts: dark wood drawn in the same perspective.
  const band = (Y0, Y1, fill) => {
    block(ctx, fill, poly([[260, P(0, Y0, 500)[1]], [1340, P(0, Y0, 500)[1]], [1340, P(0, Y1, 500)[1]], [260, P(0, Y1, 500)[1]]]), { lw: 2.2 });
    for (const X of [-270, 270]) block(ctx, fill, poly([P(X, Y0, 500), P(X, Y0, 250), P(X, Y1, 250), P(X, Y1, 500)]), { lw: 2.2 });
  };
  band(85, FLOOR, C.woodDark);
  band(-206, -196, C.woodDark);
  block(ctx, C.woodDark, rr(248, -10, 22, 632, 0), { lw: 2.6 });
  block(ctx, C.woodDark, rr(1330, -10, 22, 632, 0), { lw: 2.6 });
  // The walls meet the floor.
  stroke(ctx, [[0, 711.5], [260, 620], [1340, 620], [1600, 711.5]], 2.6);
}

// --- the window on the left wall, with the sunset in it ---

function windowView(ctx) {
  const X = -268, Z0 = 372, Z1 = 478, Y0 = -142, Y1 = -8;
  const quad = (za, zb, ya, yb) => [P(X, ya, za), P(X, ya, zb), P(X, yb, zb), P(X, yb, za)];
  block(ctx, C.woodDark, poly(quad(Z0 - 10, Z1 + 8, Y0 - 12, Y1 + 12)), { lw: 3 });
  const glass = new Path2D();
  poly(quad(Z0, Z1, Y0, Y1))(glass);

  ctx.save();
  ctx.clip(glass);
  // Bokashi sky: Prussian blue at the top melting through pink into the last yellow at the horizon.
  block(ctx, gradient(ctx, 0, 50, 0, 410, [[0, '#1c3563'], [0.25, '#3f5f92'], [0.5, C.pink], [0.75, '#f0b774'], [1, '#f6dfa0']]), rr(60, 30, 200, 400, 0), { lw: 0, off: [0, 0], grain: 0.7 });
  // Kasumi, the bands of mist.
  for (const [x, y, w, c] of [[50, 150, 150, '#f4c9b6'], [110, 196, 140, '#f2d6b8'], [40, 262, 120, '#f8e2b8']]) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    block(ctx, gradient(ctx, x, 0, x + w, 0, [[0, c + '00'], [0.25, c], [0.8, c], [1, c + '00']]), rr(x, y, w, 13, 6.5), { lw: 0, grain: 0.3 });
    ctx.restore();
  }
  // The sun going down behind two ridges.
  block(ctx, C.vermilion, p => p.arc(118, 352, 20, 0, Math.PI * 2), { lw: 2 });
  block(ctx, '#8ea3b5', p => { p.moveTo(40, 420); p.lineTo(40, 356); p.quadraticCurveTo(95, 330, 150, 358); p.quadraticCurveTo(190, 344, 250, 362); p.lineTo(250, 420); }, { lw: 2 });
  block(ctx, '#4a6482', p => { p.moveTo(40, 420); p.lineTo(40, 380); p.quadraticCurveTo(120, 368, 170, 384); p.quadraticCurveTo(210, 376, 250, 390); p.lineTo(250, 420); }, { lw: 2 });
  // Three birds.
  for (const [x, y, s] of [[150, 118, 1], [178, 104, 0.8], [132, 94, 0.7]]) {
    stroke(ctx, [[x - 8 * s, y - 3 * s], [x - 3 * s, y - 1 * s], [x, y + 2 * s], [x + 3 * s, y - 1 * s], [x + 8 * s, y - 4 * s]], 1.6);
  }
  ctx.restore();
  keyline(ctx, glass, 2.4, 91);

  // Glazing bars.
  const Zm = (Z0 + Z1) / 2, Ym = (Y0 + Y1) / 2;
  block(ctx, C.woodDark, poly([P(X, Y0, Zm - 3), P(X, Y0, Zm + 3), P(X, Y1, Zm + 3), P(X, Y1, Zm - 3)]), { lw: 2 });
  block(ctx, C.woodDark, poly([P(X, Ym - 3, Z0), P(X, Ym - 3, Z1), P(X, Ym + 3, Z1), P(X, Ym + 3, Z0)]), { lw: 2 });
  // Evening light spilling from the window onto the wall and the floor.
  glow(ctx, 170, 400, 260, '#f3b27a', 0.25, 1.3);
}

// --- the picture above the TV: a small landscape within the print ---

function picture(ctx) {
  const x = 698, y = 58, w = 204, h = 100;
  block(ctx, C.woodDeep, rr(x - 10, y - 10, w + 20, h + 20, 2), { lw: 3 });
  block(ctx, gradient(ctx, 0, y, 0, y + h, [[0, '#c4d3d6'], [0.6, '#f0e2bf'], [1, '#e9d3a2']]), rr(x, y, w, h, 0), { lw: 2 });
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  block(ctx, C.vermilion, p => p.arc(x + 150, y + 30, 12, 0, Math.PI * 2), { lw: 1.6 });
  block(ctx, C.prussian, poly([[x + 30, y + 80], [x + 88, y + 26], [x + 150, y + 80]]), { lw: 2 });
  block(ctx, '#f4efe2', poly([[x + 74, y + 39], [x + 88, y + 26], [x + 102, y + 39], [x + 95, y + 44], [x + 88, y + 38], [x + 81, y + 45]]), { lw: 1.4 });
  block(ctx, C.blueMid, rr(x - 4, y + 78, w + 8, 30, 0), { lw: 2 });
  for (let i = 0; i < 7; i++) {
    const sx = x + 8 + i * 30;
    stroke(ctx, [[sx, y + 90], [sx + 8, y + 86], [sx + 16, y + 90]], 1.3);
  }
  ctx.restore();
}

// --- furniture ---

function sideboard(ctx) {
  // Stubby tapered legs, then the body, doors and the top slab.
  for (const x of [596, 1004]) block(ctx, C.woodDeep, poly([[x - 7, 610], [x + 7, 610], [x + 4, 634], [x - 4, 634]]), { lw: 2 });
  block(ctx, C.woodDark, rr(582, 512, 436, 102, 3), { lw: 3 });
  for (const x0 of [594, 806]) {
    block(ctx, '#6c4128', rr(x0, 522, 200, 82, 2), { lw: 2.2 });
    // Carved grain on the door.
    for (let k = 0; k < 3; k++) {
      const yy = 540 + k * 20 + rand(x0 + k) * 6;
      stroke(ctx, [[x0 + 14, yy], [x0 + 70, yy - 4 + rand(k + x0) * 8], [x0 + 130, yy + 3], [x0 + 186, yy - 2]], 1);
    }
    block(ctx, C.woodDeep, p => p.ellipse(x0 + (x0 < 800 ? 184 : 16), 563, 5, 11, 0, 0, Math.PI * 2), { lw: 1.6 });
  }
  block(ctx, C.wood, rr(572, 500, 456, 14, 3), { lw: 3 });
}

function tv(ctx) {
  // Antenna first, so its base dome covers the roots of the rods.
  for (const [tx, ty, bx] of [[742, 236, 794], [864, 228, 806]]) {
    stroke(ctx, [[bx, 318], [tx, ty]], 3.2);
    block(ctx, '#c9c2b0', p => p.arc(tx, ty, 4.5, 0, Math.PI * 2), { lw: 2 });
  }
  block(ctx, C.woodDeep, p => p.ellipse(800, 324, 24, 12, 0, Math.PI, 0), { lw: 2.4 });

  // Feet and cabinet.
  for (const x of [676, 924]) block(ctx, C.woodDeep, poly([[x - 12, 492], [x + 12, 492], [x + 6, 501], [x - 6, 501]]), { lw: 2 });
  block(ctx, gradient(ctx, 0, 324, 0, 494, [[0, '#9b5c34'], [1, '#7e4526']]), rr(648, 324, 304, 170, 16), { lw: 4 });
  // Carved figure of the veneer along the cabinet top and base.
  stroke(ctx, [[664, 330], [720, 328], [790, 331]], 1.1);
  stroke(ctx, [[820, 489], [880, 487], [938, 490]], 1.1);

  // Cream bezel round the tube.
  block(ctx, C.ochrePale, rr(660, 334, 196, 152, 14), { lw: 3 });
  // The tube itself: rounded corners and slightly bulging sides, off and dark.
  const { x, y, w, h } = TV_SCREEN;
  const tube = traceScreen;
  const screen = block(ctx, gradient(ctx, x, y, x + w, y + h, [[0, '#4f5b58'], [0.55, C.grey], [1, '#262d2c']]), tube, { lw: 4, off: [1.5, 1] });
  // Glass sheen: a flat pale crescent, as a print would cut it.
  ctx.save();
  ctx.clip(screen);
  block(ctx, '#7d8a86', p => { p.moveTo(x + 14, y + 40); p.quadraticCurveTo(x + 18, y + 12, x + 62, y + 10); p.quadraticCurveTo(x + 30, y + 20, x + 24, y + 58); p.closePath(); }, { lw: 0, grain: 0.3 });
  ctx.restore();

  // Control panel: two knobs over a speaker grille.
  for (const ky of [364, 404]) {
    block(ctx, C.ochrePale, p => p.arc(903, ky, 15, 0, Math.PI * 2), { lw: 3 });
    block(ctx, C.woodDeep, p => p.arc(903, ky, 8, 0, Math.PI * 2), { lw: 2 });
    stroke(ctx, [[903, ky - 8], [903, ky - 15]], 2);
  }
  block(ctx, C.woodDeep, rr(874, 428, 58, 52, 5), { lw: 2.6 });
  for (let gy = 436; gy < 476; gy += 7) block(ctx, '#b39060', rr(880, gy, 46, 3, 1.5), { lw: 0, grain: 0 });
}

function plant(ctx) {
  // Leaves behind the pot's rim, long and arching, like a print's aspidistra.
  const leaves = [
    [-0.2, 265, 10], [0.35, 250, -12], [-0.55, 220, 18], [0.7, 205, -20], [-0.9, 170, 22],
    [0.05, 300, 6], [1.0, 160, -18], [-0.35, 275, -14], [0.5, 240, 16],
  ];
  const bx = 205, by = 604;
  leaves.forEach(([a, len, bend], i) => {
    const tx = bx + Math.sin(a) * len, ty = by - Math.cos(a) * len;
    const nx = Math.cos(a), ny = Math.sin(a), mx = (bx + tx) / 2 + nx * bend, my = (by + ty) / 2 + ny * bend;
    const wid = 15 + rand(i) * 8;
    block(ctx, i % 2 ? C.green : C.greenPale, p => {
      p.moveTo(bx, by);
      p.quadraticCurveTo(mx + nx * wid, my + ny * wid, tx, ty);
      p.quadraticCurveTo(mx - nx * wid, my - ny * wid, bx, by);
    }, { lw: 2.4 });
    stroke(ctx, [[bx, by], [(bx + tx) / 2 + nx * bend * 0.9, (by + ty) / 2 + ny * bend * 0.9], [tx, ty]], 1.1);
  });
  // Blue-and-white pot.
  const pot = poly([[160, 596], [252, 596], [240, 676], [172, 676]]);
  block(ctx, '#ece6d4', pot, { lw: 3 });
  block(ctx, C.prussian, poly([[162, 604], [250, 604], [248, 616], [164, 616]]), { lw: 1.6 });
  block(ctx, C.prussian, poly([[170, 660], [242, 660], [240, 670], [172, 670]]), { lw: 1.6 });
  for (let i = 0; i < 4; i++) block(ctx, null, p => p.arc(180 + i * 17, 638, 6, Math.PI, 0), { lw: 1.6 });
  block(ctx, C.woodDark, rr(154, 590, 104, 9, 3), { lw: 2.4 });
}

function lampGlow(ctx) {
  glow(ctx, 1306, 230, 440, '#f7d27a', 0.6);
  glow(ctx, 1306, 230, 190, '#fcebb4', 0.8);
  glow(ctx, 1300, 660, 260, '#f2c877', 0.4, 0.22);
}

function lamp(ctx) {
  block(ctx, C.woodDeep, p => p.ellipse(1306, 652, 38, 10, 0, 0, Math.PI * 2), { lw: 2.6 });
  block(ctx, '#6b5a3c', rr(1302, 262, 8, 390, 3), { lw: 2 });
  // Light falling from under the shade: pale rays in the manner of printed light.
  ctx.save();
  ctx.globalAlpha = 0.6;
  block(ctx, gradient(ctx, 0, 268, 0, 520, [[0, '#fbe6a6'], [1, '#fbe6a600']]), poly([[1236, 268], [1376, 268], [1450, 520], [1162, 520]]), { lw: 0, grain: 0.2 });
  ctx.restore();
  const shade = p => { p.moveTo(1262, 180); p.lineTo(1350, 180); p.lineTo(1380, 266); p.quadraticCurveTo(1306, 278, 1232, 266); p.closePath(); };
  block(ctx, gradient(ctx, 0, 180, 0, 272, [[0, '#e8c577'], [1, '#fbeaa8']]), shade, { lw: 3.2 });
  for (const k of [0.33, 0.66]) stroke(ctx, [[1262 + 88 * k, 182], [1232 + 148 * k, 268]], 1);
  block(ctx, C.vermilion, rr(1258, 174, 96, 8, 3), { lw: 2 });
}

function rug(ctx) {
  const Zb = 488, Zf = 282, X = 170, inset = 16;
  const outer = poly([P(-X, FLOOR, Zb), P(X, FLOOR, Zb), P(X, FLOOR, Zf), P(-X, FLOOR, Zf)]);
  const innerPts = [P(-X + inset, FLOOR, Zb - inset), P(X - inset, FLOOR, Zb - inset), P(X - inset, FLOOR, Zf + inset), P(-X + inset, FLOOR, Zf + inset)];
  // Fringe at the front edge.
  for (let x = -X + 4; x < X; x += 7) stroke(ctx, [P(x, FLOOR, Zf), P(x, FLOOR, Zf - 7)], 1.2);
  block(ctx, C.vermilion, outer, { lw: 3 });
  // Pale lozenges round the border.
  for (let t = 0; t <= 1.0001; t += 1 / 16) {
    for (const [Z, xs] of [[Zb - inset / 2, 1], [Zf + inset / 2, 1]]) {
      const [cx, cy] = P(-X + inset / 2 + t * (2 * X - inset), FLOOR, Z), s = 1000 / Z;
      block(ctx, C.yellow, poly([[cx - 3.5 * s * xs, cy], [cx, cy - 1.3 * s], [cx + 3.5 * s, cy], [cx, cy + 1.3 * s]]), { lw: 1.2 });
    }
  }
  const field = block(ctx, C.prussian, poly(innerPts), { lw: 2.4 });
  // Seigaiha waves, row after row, the nearer rows over the farther ones.
  ctx.save();
  ctx.clip(field);
  const R = 11, yBack = innerPts[0][1] - 10, yFront = innerPts[2][1] + 20;
  for (let y = yBack, row = 0; y < yFront; row++) {
    const Z = (F * FLOOR) / (y - VP[1]), rx = (R * F) / Z, ry = rx * 0.46;
    for (let Xw = -X - R * 2 + (row % 2) * R; Xw < X + R * 2; Xw += 2 * R) {
      const cx = VP[0] + (F * Xw) / Z;
      ctx.beginPath(); ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = C.prussian; ctx.fill();
      for (const [k, c] of [[0.92, '#cfdbe0'], [0.68, '#8fa9c4'], [0.44, '#cfdbe0']]) {
        ctx.beginPath(); ctx.ellipse(cx, y, rx * k, ry * k, 0, Math.PI, 0);
        ctx.strokeStyle = c; ctx.lineWidth = rx * 0.1; ctx.stroke();
      }
    }
    y += ry * 0.55;
  }
  grainInto(ctx, 0.5, 77);
  ctx.restore();
  keyline(ctx, field, 2.4, 78);
}

function table(ctx) {
  const X = 102, Y = 65, Zb = 392, Zf = 330, legW = 7;
  // Back legs first, then front legs, then the top over them.
  for (const [Z, s] of [[Zb - 8, 1], [Zf + 4, 1]]) {
    for (const xs of [-1, 1]) {
      const xa = xs * (X - 8);
      block(ctx, C.woodDark, poly([P(xa - legW / 2, Y, Z), P(xa + legW / 2, Y, Z), P(xa + legW / 2, FLOOR, Z), P(xa - legW / 2, FLOOR, Z)]), { lw: 2 * s });
    }
  }
  block(ctx, '#7a4c2b', poly([P(-X, Y, Zf), P(X, Y, Zf), P(X, Y + 5, Zf), P(-X, Y + 5, Zf)]), { lw: 2.6 });
  block(ctx, gradient(ctx, 0, 596, 0, 628, [[0, '#b98648'], [1, '#a26f3b']]), poly([P(-X, Y, Zb), P(X, Y, Zb), P(X, Y, Zf), P(-X, Y, Zf)]), { lw: 3 });
}

// The pickle jar from episode 1, red lid and all.
function jar(ctx) {
  const cx = 958, base = 612, w = 44, h = 54;
  const top = base - h;
  for (const [dx, dy, a] of [[-9, 18, 0.25], [8, 14, -0.3], [-2, 30, 0.1], [10, 34, -0.15]]) {
    block(ctx, dx > 0 ? C.green : C.greenDeep, p => p.ellipse(cx + dx, top + dy + 6, 6.5, 15, a, 0, Math.PI * 2), { lw: 1.4 });
  }
  ctx.save();
  ctx.globalAlpha = 0.55;
  block(ctx, '#cfe2d6', rr(cx - w / 2, top, w, h, 9), { lw: 0, grain: 0.2 });
  ctx.restore();
  block(ctx, null, rr(cx - w / 2, top, w, h, 9), { lw: 2.6 });
  block(ctx, '#f5f1e2', rr(cx - w / 2 + 6, top + 8, 5, h - 18, 2.5), { lw: 0, grain: 0 });
  block(ctx, '#e3ece2', rr(cx - w / 2 + 4, top - 5, w - 8, 7, 2), { lw: 1.8 });
  block(ctx, C.vermilion, rr(cx - w / 2 - 3, top - 16, w + 6, 13, 4), { lw: 2.6 });
  for (let i = 1; i < 6; i++) stroke(ctx, [[cx - w / 2 - 3 + i * (w + 6) / 6, top - 13], [cx - w / 2 - 3 + i * (w + 6) / 6, top - 6]], 1);
}

// --- the sofa we stand behind, and its cushions ---

function cushion(ctx, cx, cy, w, h, rot, fill, motif) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  const trace = p => {
    // Plump in the middle, pinched to points at the corners.
    const a = w / 2, b = h / 2, k = 14;
    p.moveTo(-a, -b);
    p.bezierCurveTo(-a / 2, -b - k, a / 2, -b - k, a, -b);
    p.bezierCurveTo(a + k, -b / 2, a + k, b / 2, a, b);
    p.bezierCurveTo(a / 2, b + k, -a / 2, b + k, -a, b);
    p.bezierCurveTo(-a - k, b / 2, -a - k, -b / 2, -a, -b);
  };
  const path = block(ctx, fill, trace, { lw: 3.2 });
  ctx.save(); ctx.clip(path); motif(ctx, w, h); ctx.restore();
  keyline(ctx, path, 3.2, 55 + cx);
  ctx.restore();
}
// Kanoko shibori: little tie-dyed squares with a dot in each.
function kanoko(ctx, w, h) {
  for (let y = -h / 2, r = 0; y < h / 2; y += 17, r++) {
    for (let x = -w / 2 + (r % 2) * 9; x < w / 2; x += 18) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#f4e8d6'; ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.fillStyle = C.rust; ctx.fillRect(-1.5, -1.5, 3, 3);
      ctx.restore();
    }
  }
}
// Rings of Prussian blue on ochre, like a family crest scattered on cloth.
function rings(ctx, w, h) {
  for (let y = -h / 2 + 10, r = 0; y < h / 2 + 10; y += 30, r++) {
    for (let x = -w / 2 + (r % 2) * 17; x < w / 2 + 20; x += 34) {
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = C.prussian; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = C.prussian; ctx.fill();
    }
  }
}

function sofa(ctx) {
  cushion(ctx, 420, 880, 230, 180, -0.1, C.vermilion, kanoko);
  cushion(ctx, 1180, 878, 220, 176, 0.08, C.ochre, rings);
  // The back: three padded humps, running out of the frame on both sides.
  const back = p => {
    p.moveTo(-30, 1030);
    p.lineTo(-30, 846);
    p.bezierCurveTo(120, 820, 420, 834, 540, 850);
    p.bezierCurveTo(660, 832, 940, 832, 1060, 850);
    p.bezierCurveTo(1180, 834, 1480, 820, 1630, 846);
    p.lineTo(1630, 1030);
    p.closePath();
  };
  const path = block(ctx, gradient(ctx, 0, 830, 0, 1000, [[0, '#35548a'], [0.35, C.prussian], [1, '#15223d']]), back, { lw: 0 });
  ctx.save();
  ctx.clip(path);
  // Woven stripes (shima) and the piping along the top.
  for (let x = -20, i = 0; x < 1640; x += 24, i++) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(20,32,60,0.55)' : 'rgba(120,150,195,0.18)';
    ctx.fillRect(x, 820, i % 3 === 0 ? 5 : 3, 220);
  }
  // A paler block along the top gives the padded back its roundness.
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = gradient(ctx, 0, 820, 0, 900, [[0, '#8fa9cc'], [0.45, '#8fa9cc00']]);
  ctx.fillRect(-30, 800, 1660, 100);
  ctx.globalAlpha = 1;
  grainInto(ctx, 0.4, 404);
  ctx.restore();
  keyline(ctx, path, 4.5, 405);
  const seam = new Path2D();
  seam.moveTo(-30, 868); seam.bezierCurveTo(120, 842, 420, 856, 540, 872);
  seam.bezierCurveTo(660, 854, 940, 854, 1060, 872); seam.bezierCurveTo(1180, 856, 1480, 842, 1630, 868);
  ctx.save(); ctx.setLineDash([7, 7]); ctx.strokeStyle = '#8ea6c8'; ctx.lineWidth = 1.6; ctx.stroke(seam); ctx.restore();
  for (const x of [540, 1060]) stroke(ctx, [[x, 850], [x + 2, 930], [x - 3, 1010]], 2.4);
}

// --- the cartouche and the seal ---

function cartouche(ctx) {
  const x = 1486, y = 34, w = 56, h = 196;
  block(ctx, gradient(ctx, 0, y, 0, y + h, [[0, C.yellow], [1, C.pinkPale]]), rr(x, y, w, h, 2), { lw: 3 });
  block(ctx, null, rr(x + 5, y + 5, w - 10, h - 10, 1), { lw: 1.4 });
  ctx.save();
  ctx.fillStyle = SUMI;
  ctx.font = '600 40px "Hiragino Mincho ProN", "Yu Mincho", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [...'二十秒'].forEach((ch, i) => ctx.fillText(ch, x + w / 2 + 1, y + 42 + i * 56));
  ctx.restore();
  // The seal, cut in white on red.
  block(ctx, C.vermilion, rr(x + 10, y + h + 14, 36, 36, 3), { lw: 0, grain: 0.3 });
  ctx.save();
  ctx.fillStyle = '#f6e9d2';
  ctx.font = '600 25px "Hiragino Mincho ProN", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('廿', x + 28, y + h + 33);
  ctx.restore();
}

// --- the paper the whole thing is printed on ---

function paper(ctx, w, h) {
  // Uneven baren pressure: broad soft blotches.
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 80; i++) {
    glow(ctx, rand(i * 1.3) * w, rand(i * 7.7) * h, 50 + rand(i * 2.2) * 150, '#c9ad7e', 0.12 + rand(i * 3.9) * 0.12, 0.3 + rand(i) * 0.5);
  }
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = tile(ctx, T.wash, WASH, WASH);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Washi fibres, light on the dark blocks and faintly dark on the pale ones.
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 1100; i++) {
    const x = rand(i * 1.11) * w, y = rand(i * 2.37) * h, a = rand(i * 3.3) * Math.PI * 2, l = 2 + rand(i * 4.9) * 7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.2) * l * 0.5, y + Math.sin(a + 0.2) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.strokeStyle = i % 5 ? 'rgba(250,242,222,0.13)' : 'rgba(70,50,30,0.08)';
    ctx.lineWidth = 0.4 + rand(i * 6.1) * 0.6;
    ctx.stroke();
  }
  // Specks where the pigment did not take.
  ctx.fillStyle = 'rgba(245,236,214,0.3)';
  for (let i = 0; i < 700; i++) {
    ctx.beginPath();
    ctx.arc(rand(i * 8.3) * w, rand(i * 9.1) * h, 0.3 + rand(i * 5.5) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Age: the sheet yellows and darkens towards its edges.
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8d4a8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  // The border line of the keyblock.
  block(ctx, null, rr(M, M, w - 2 * M, h - 2 * M, 0), { lw: 3 });
}

export function drawRoom(ctx, w = 1600, h = 1000) {
  // Device pixels per logical unit, whatever transform the caller set (a close-up sets a large one).
  const scale = Math.round(Math.hypot(ctx.getTransform().a, ctx.getTransform().b) * (w / 1600) * 100) / 100 || 1;
  T = textures(scale);
  seedCounter = 0;
  ctx.save();
  ctx.scale(w / 1600, h / 1000);
  ctx.beginPath(); ctx.rect(0, 0, 1600, 1000); ctx.clip();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, 1600, 1000);
  shell(ctx);
  windowView(ctx);
  lampGlow(ctx);
  picture(ctx);
  sideboard(ctx);
  tv(ctx);
  plant(ctx);
  rug(ctx);
  table(ctx);
  jar(ctx);
  lamp(ctx);
  sofa(ctx);
  cartouche(ctx);
  // The unprinted margin of the sheet.
  ctx.fillStyle = PAPER;
  ctx.fill(new Path2D(`M0 0H1600V1000H0Z M${M} ${M}V${1000 - M}H${1600 - M}V${M}Z`));
  paper(ctx, 1600, 1000);
  ctx.restore();
}

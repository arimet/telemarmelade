// The living room as a paper toy theatre: every element is a cut-out card with a cream cut edge,
// casting a soft shadow on the layer behind, all set inside a printed proscenium with curtains.
import { lerp, rand } from '../engine.js';

export const TV_SCREEN = { x: 680, y: 380, w: 186, h: 140 };
// Channel knob, then power knob, as circles covering each knob's whole cut-out.
export const TV_KNOBS = [{ x: 913, y: 402, r: 21 }, { x: 913, y: 450, r: 21 }];
// The glass of the TV screen, as a path, so the page can cut the live picture to its exact shape.
export function traceScreen(c) {
  const { x, y, w, h } = TV_SCREEN;
  superellipse(x + w / 2, y + h / 2, w / 2, h / 2, 4).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath();
}

const CREAM = '#fbf3df';
const TAU = Math.PI * 2;
let seed = 0;   // advances with every cut, reset per drawing so the image never changes
let S = 1;      // device pixels per logical unit: canvas shadows ignore the transform

// --- outlines ---

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// Rounded rectangle with faceted corners, the way scissors take a curve.
function rrect(x, y, w, h, r, n = 4) {
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return pts;
}
const oval = (cx, cy, rx, ry, n = 36, a0 = 0, a1 = TAU) =>
  Array.from({ length: n }, (_, i) => {
    const a = lerp(a0, a1, i / (a1 - a0 === TAU ? n : n - 1));
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
// A CRT-ish rounded screen: superellipse, bounding box exactly 2a × 2b.
const superellipse = (cx, cy, a, b, p = 4, n = 48) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU, c = Math.cos(t), s = Math.sin(t);
    return [cx + a * Math.sign(c) * Math.abs(c) ** (2 / p), cy + b * Math.sign(s) * Math.abs(s) ** (2 / p)];
  });
// A leaf or a blade: pointed at both ends, bent through `ctrl`.
function leaf(bx, by, cxp, cyp, tx, ty, w, n = 14) {
  const L = [], R = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * bx + 2 * u * t * cxp + t * t * tx, y = u * u * by + 2 * u * t * cyp + t * t * ty;
    const dx = 2 * u * (cxp - bx) + 2 * t * (tx - cxp), dy = 2 * u * (cyp - by) + 2 * t * (ty - cyp);
    const d = Math.hypot(dx, dy) || 1, hw = w * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.7;
    L.push([x - (dy / d) * hw, y + (dx / d) * hw]);
    R.unshift([x + (dy / d) * hw, y - (dx / d) * hw]);
  }
  return [...L, ...R];
}

// Smooth 1-D noise, for scissor cuts that wander instead of fizzing.
const smooth = t => {
  const i = Math.floor(t), f = t - i, k = f * f * (3 - 2 * f);
  return lerp(rand(i), rand(i + 1), k) * 2 - 1;
};
// Hand-cut version of an outline: subdivided, then nudged sideways by a slow wobble.
function scissor(pts, amp = 1.4) {
  const out = [], base = ++seed * 53.7;
  let dist = 0;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.round(len / 14));
    for (let k = 0; k < n; k++) {
      const o = smooth(base + (dist + (len * k) / n) / 45) * amp;
      out.push([a[0] + (dx * k) / n - (dy / len) * o, a[1] + (dy * k) / n + (dx / len) * o]);
    }
    dist += len;
  });
  return out;
}
function trace(ctx, rings) {
  ctx.beginPath();
  for (const r of rings) {
    r.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
}

// --- paper ---

let grainTile = null; // the tile is shared; the pattern is made per context
function grain(ctx, alpha = 1) {
  if (!grainTile) {
    const N = 256, c = (grainTile = new OffscreenCanvas(N, N)), g = c.getContext('2d');
    // Blotches first (the paper's cloudiness), then fine fibre speckle.
    for (let i = 0; i < 90; i++) {
      g.fillStyle = rand(i + 0.3) > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(60,40,20,0.03)';
      g.beginPath(); // drawn at every wrap offset so the tile has no seam
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        const x = rand(i + 0.1) * N + ox, y = rand(i + 0.2) * N + oy, r = 10 + rand(i + 0.4) * 30;
        g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
      }
      g.fill();
    }
    const img = g.getImageData(0, 0, N, N), d = img.data;
    for (let p = 0; p < N * N; p++) {
      const v = rand(p * 0.731 + 5), q = p * 4;
      if (v > 0.93) { d[q] = d[q + 1] = d[q + 2] = 255; d[q + 3] = Math.max(d[q + 3], 40); }
      else if (v < 0.08) { d[q] = 50; d[q + 1] = 35; d[q + 2] = 20; d[q + 3] = Math.max(d[q + 3], 34); }
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 160; i++) { // fibres
      const x = rand(i + 7.1) * N, y = rand(i + 7.2) * N, a = rand(i + 7.3) * TAU, l = 3 + rand(i + 7.4) * 7;
      g.strokeStyle = rand(i + 7.5) > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(50,30,10,0.14)';
      g.lineWidth = 0.6;
      g.beginPath();
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); }
      g.stroke();
    }
  }
  const pattern = ctx.createPattern(grainTile, 'repeat');
  pattern.setTransform(new DOMMatrix().scale(0.75));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, 1600, 1000);
  ctx.restore();
}

// One cut-out: shadow on what lies behind, a cream rim where the scissors ran, the printed face,
// then `tex` printed on it (clipped to the card) and the paper grain.
function cut(ctx, outline, fill, { tex, edge = CREAM, rim = 5, drop = 6, amp = 1.4, alpha = 1 } = {}) {
  const rings = (Array.isArray(outline[0][0]) ? outline : [outline]).map(r => scissor(r, amp));
  ctx.save();
  ctx.globalAlpha = alpha;
  trace(ctx, rings);
  if (drop) {
    ctx.shadowColor = 'rgba(28,14,6,0.58)';
    ctx.shadowBlur = drop * 1.6 * S;
    ctx.shadowOffsetX = drop * 0.55 * S;
    ctx.shadowOffsetY = drop * S;
  }
  if (drop || rim) { ctx.fillStyle = edge; ctx.fill('evenodd'); } // translucent pieces (glass, glints) have no backing
  ctx.shadowColor = 'transparent';
  if (rim) {
    ctx.lineWidth = rim; ctx.strokeStyle = edge; ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  ctx.clip('evenodd');
  tex?.(ctx);
  grain(ctx, 0.9);
  ctx.restore();
}

// Printed shading: parallel strokes like a lithograph, across a box (inside the current clip).
function hatch(ctx, x0, y0, x1, y1, gap, ang, col, lw = 1.2) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, d = Math.hypot(x1 - x0, y1 - y0) / 2;
  const ux = Math.cos(ang), uy = Math.sin(ang);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath();
  for (let s = -d; s <= d; s += gap) {
    ctx.moveTo(cx - uy * s - ux * d, cy + ux * s - uy * d);
    ctx.lineTo(cx - uy * s + ux * d, cy + ux * s + uy * d);
  }
  ctx.stroke();
  ctx.restore();
}
function woodGrain(ctx, x, y, w, h, col, gap = 7) {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 1;
  for (let yy = y + 3, i = 0; yy < y + h; yy += gap * (0.7 + rand(i + 40) * 0.6), i++) {
    ctx.beginPath();
    for (let xx = x; xx <= x + w; xx += 8) {
      const o = Math.sin(xx / (30 + rand(i) * 40) + rand(i + 9) * 6) * 1.8;
      xx === x ? ctx.moveTo(xx, yy + o) : ctx.lineTo(xx, yy + o);
    }
    ctx.stroke();
  }
  ctx.restore();
}
// Newspaper: columns of grey "words", no readable text.
function newsprint(ctx, x, y, w, h, colW = 46) {
  ctx.fillStyle = 'rgba(60,55,50,0.45)';
  let i = 0;
  for (let cx = x + 4; cx < x + w; cx += colW) {
    for (let yy = y + 4; yy < y + h; yy += 3.6) {
      if (rand(i++ + 900) < 0.06) { yy += 3; continue; } // paragraph break
      for (let xx = cx; xx < cx + colW - 6;) {
        const wl = 2 + rand(i++ + 300) * 7;
        ctx.fillRect(xx, yy, Math.min(wl, cx + colW - 6 - xx), 1.6);
        xx += wl + 1.4;
      }
    }
  }
}
// A strip of sticky tape with torn ends.
function tape(ctx, x, y, w, h, ang) {
  const pts = [];
  for (let i = 0; i <= 5; i++) pts.push([w / 2 + (i % 2 ? 2.5 : -1), -h / 2 + (i * h) / 5]);
  for (let i = 5; i >= 0; i--) pts.push([-w / 2 + (i % 2 ? -2.5 : 1), -h / 2 + (i * h) / 5]);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  trace(ctx, [pts]);
  ctx.shadowColor = 'rgba(30,20,0,0.25)'; ctx.shadowBlur = 2 * S; ctx.shadowOffsetY = 1 * S;
  ctx.fillStyle = 'rgba(246,236,190,0.62)';
  ctx.fill();
  ctx.restore();
}
// The folded card tab a toy-theatre figure stands on.
function tab(ctx, cx, y, w) {
  cut(ctx, [[cx - w / 2, y], [cx + w / 2, y], [cx + w / 2 + 8, y + 12], [cx - w / 2 - 8, y + 12]], '#b08a5c',
    { drop: 3, rim: 3, tex: c => hatch(c, cx - w, y, cx + w, y + 12, 3, 0, 'rgba(70,40,20,0.25)') });
}

// --- the room, back to front ---

function backstage(ctx) {
  ctx.fillStyle = '#2b1c15';
  ctx.fillRect(0, 0, 1600, 1000);
  woodGrain(ctx, 0, 0, 1600, 1000, 'rgba(0,0,0,0.25)', 11);
}

function wall(ctx) {
  cut(ctx, rect(96, 90, 1408, 570), '#557f73', {
    drop: 0, rim: 0, tex: c => {
      for (let x = 96, i = 0; x < 1504; x += 64, i++) {
        c.fillStyle = i % 2 ? 'rgba(255,245,220,0.07)' : 'rgba(20,40,35,0.06)';
        c.fillRect(x, 90, 64, 570);
        c.fillStyle = 'rgba(250,236,200,0.22)';
        for (let y = 110 + (i % 2) * 36; y < 660; y += 72) { // printed damask sprig
          const mx = x + 32;
          c.beginPath();
          c.moveTo(mx, y - 14); c.quadraticCurveTo(mx + 11, y, mx, y + 14); c.quadraticCurveTo(mx - 11, y, mx, y - 14);
          c.fill();
          for (const [dx, dy] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) { c.beginPath(); c.arc(mx + dx, y + dy, 2.2, 0, TAU); c.fill(); }
        }
        c.fillStyle = 'rgba(250,236,200,0.14)';
        c.fillRect(x + 62, 90, 2, 570);
      }
    },
  });
  // Skirting board, a separate strip.
  cut(ctx, rect(96, 628, 1408, 22), '#e8dcc0', { drop: 4, rim: 3, tex: c => hatch(c, 96, 640, 1504, 650, 3, 0, 'rgba(80,60,30,0.25)') });
}

function floor(ctx) {
  // Boards as strips of kraft, each a slightly different brown, stacked towards the viewer.
  const bands = [[650, 34], [684, 42], [726, 52], [778, 64], [842, 100]];
  bands.forEach(([y, h], i) => {
    cut(ctx, rect(96, y, 1408, h + 4), ['#b88752', '#ae7c49', '#b98b57', '#a9773f', '#b38350'][i], {
      drop: 3, rim: 2, amp: 0.8, tex: c => {
        woodGrain(c, 96, y, 1408, h, 'rgba(90,50,20,0.22)', 6);
        c.fillStyle = 'rgba(70,40,15,0.45)';
        for (let x = 96 + ((i * 170) % 260); x < 1504; x += 260 + i * 30) c.fillRect(x, y, 2, h + 4);
      },
    });
  });
}

function windowPane(ctx) {
  const x = 262, y = 212, w = 220, h = 290;
  cut(ctx, rrect(x - 14, y - 14, w + 28, h + 28, 6), '#ece2c9', { drop: 7 }); // frame card
  // Sunset sky: torn bands of coloured paper, laid overlapping.
  const bands = [['#3e3f78', 0], ['#6d4c8a', 70], ['#c65a78', 128], ['#ec8a5a', 178], ['#f6c46a', 222]];
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = bands[0][0]; ctx.fillRect(x, y, w, h);
  for (const [col, by] of bands.slice(1)) {
    const pts = [[x - 10, y + h + 10], [x - 10, y + by]];
    for (let i = 1; i < 12; i++) pts.push([x - 10 + (i * (w + 20)) / 11, y + by + Math.sin(i * 1.7 + by) * 5]);
    pts.push([x + w + 10, y + h + 10]);
    cut(ctx, pts, col, { drop: 4, rim: 2, amp: 2 });
  }
  cut(ctx, oval(x + 150, y + 238, 30, 30, 30), '#fff0b8', { drop: 3, rim: 2 }); // sun
  // Rooftops cut from newspaper, tinted with dusk.
  const roofs = [[x - 10, y + h + 10]];
  [[0, 250], [30, 250], [30, 232], [58, 232], [58, 244], [92, 244], [92, 212], [104, 200], [116, 212], [116, 248], [160, 248], [160, 226], [196, 226], [196, 238], [230, 238]]
    .forEach(([dx, dy]) => roofs.push([x + dx, y + dy]));
  roofs.push([x + w + 10, y + h + 10]);
  cut(ctx, roofs, '#d9d2c0', { drop: 4, rim: 2, tex: c => { newsprint(c, x, y + 190, w, 110, 34); c.fillStyle = 'rgba(52,40,96,0.55)'; c.fillRect(x, y + 190, w, 110); } });
  ctx.restore();
  // Mullions and sill.
  cut(ctx, rect(x + w / 2 - 6, y - 2, 12, h + 4), '#ece2c9', { drop: 5, rim: 3 });
  cut(ctx, rect(x - 2, y + 118, w + 4, 12), '#ece2c9', { drop: 5, rim: 3 });
  cut(ctx, rect(x - 30, y + h + 10, w + 60, 18), '#e2d5b6', { drop: 6, rim: 3, tex: c => hatch(c, x - 30, y + h + 20, x + w + 30, y + h + 28, 3, 0, 'rgba(90,60,30,0.3)') });
  tape(ctx, x - 6, y - 8, 46, 16, -0.6);
}

function picture(ctx) {
  const x = 745, y = 194, w = 110, h = 86;
  cut(ctx, rect(x, y, w, h), '#c49a43', { drop: 7, tex: c => { c.strokeStyle = 'rgba(90,60,10,0.5)'; c.lineWidth = 1.2; c.strokeRect(x + 5, y + 5, w - 10, h - 10); } });
  cut(ctx, rect(x + 10, y + 10, w - 20, h - 20), '#f3e7c8', { drop: 3, rim: 2 });
  ctx.save();
  ctx.beginPath(); ctx.rect(x + 16, y + 16, w - 32, h - 32); ctx.clip();
  cut(ctx, rect(x + 16, y + 16, w - 32, h - 32), '#f2c38a', { drop: 0, rim: 0 });
  cut(ctx, oval(x + 66, y + 40, 9, 9, 18), '#e86b3f', { drop: 2, rim: 1.5 });
  cut(ctx, [[x + 10, y + 80], [x + 10, y + 50], [x + 30, y + 38], [x + 52, y + 50], [x + 70, y + 44], [x + 100, y + 56], [x + 100, y + 80]], '#6f8f5a', { drop: 3, rim: 1.5 });
  cut(ctx, [[x + 10, y + 80], [x + 10, y + 60], [x + 44, y + 52], [x + 100, y + 64], [x + 100, y + 80]], '#4b6b44', { drop: 3, rim: 1.5 });
  ctx.restore();
  tape(ctx, x + 6, y + 2, 30, 12, -0.7);
  tape(ctx, x + w - 4, y + 4, 30, 12, 0.6);
}

function plant(ctx) {
  const bx = 368, by = 700;
  const blades = [
    [-4, -60, -40, -150, 16, '#3f6b3a'], [4, -80, 30, -176, 15, '#4d7d42'], [-14, -50, -70, -110, 14, '#5b8a4a'],
    [10, -40, 64, -120, 14, '#3a5f35'], [0, -90, -6, -196, 15, '#557f45'], [-20, -70, -52, -178, 13, '#6a9651'], [18, -70, 48, -164, 13, '#44733e'],
  ];
  for (const [cx, cy, tx, ty, wd, col] of blades) {
    cut(ctx, leaf(bx, by - 70, bx + cx, by - 70 + cy, bx + tx, by - 70 + ty, wd), col, {
      drop: 5, rim: 3, tex: c => {
        c.strokeStyle = 'rgba(230,240,190,0.35)'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(bx, by - 70); c.quadraticCurveTo(bx + cx, by - 70 + cy, bx + tx, by - 70 + ty); c.stroke();
      },
    });
  }
  tab(ctx, bx, by - 4, 70);
  cut(ctx, [[bx - 38, by - 80], [bx + 38, by - 80], [bx + 30, by], [bx - 30, by]], '#bf5f36', {
    drop: 7, tex: c => { hatch(c, bx + 8, by - 80, bx + 40, by, 3.5, 1.2, 'rgba(80,25,10,0.35)'); },
  });
  cut(ctx, rect(bx - 44, by - 90, 88, 16), '#cf6d40', { drop: 4, rim: 3 });
}

function sideboard(ctx) {
  const x = 590, y = 578, w = 420, h = 118;
  for (const lx of [x + 30, x + w - 44]) cut(ctx, [[lx, y + h - 4], [lx + 14, y + h - 4], [lx + 10, y + h + 22], [lx + 5, y + h + 22]], '#6d4020', { drop: 4, rim: 2 });
  cut(ctx, rect(x, y, w, h), '#a8672f', {
    tex: c => {
      woodGrain(c, x, y, w, h, 'rgba(70,35,10,0.25)');
      c.strokeStyle = 'rgba(60,30,10,0.6)'; c.lineWidth = 1.5;
      for (const dx of [140, 280]) { c.beginPath(); c.moveTo(x + dx, y + 12); c.lineTo(x + dx, y + h - 10); c.stroke(); }
      hatch(c, x, y + h - 22, x + w, y + h, 3, 0, 'rgba(60,30,10,0.3)');
    },
  });
  for (const dx of [125, 155, 265, 295]) cut(ctx, oval(x + dx, y + 58, 5, 5, 12), '#e0c07a', { drop: 2, rim: 1.5 });
  cut(ctx, rect(x - 12, y - 16, w + 24, 18), '#b8753a', { drop: 5, rim: 3, tex: c => woodGrain(c, x - 12, y - 16, w + 24, 18, 'rgba(70,35,10,0.3)', 5) });
  // A little vase to balance the set.
  cut(ctx, [[618, 560], [612, 530], [620, 505], [636, 505], [644, 530], [638, 560]], '#e7d7b0', { drop: 5, tex: c => { c.fillStyle = 'rgba(40,80,110,0.55)'; c.fillRect(600, 520, 60, 6); c.fillRect(600, 532, 60, 3); } });
  for (const [tx, ty, col] of [[606, 470, '#d24b3f'], [632, 460, '#f0c24a'], [652, 478, '#d24b3f']]) {
    cut(ctx, leaf(628, 508, (628 + tx) / 2, 490, tx, ty, 1.6, 6), '#4d7d42', { drop: 2, rim: 1 });
    cut(ctx, oval(tx, ty, 8, 8, 10), col, { drop: 3, rim: 2 });
  }
}

function tv(ctx) {
  const { x, y, w, h } = TV_SCREEN, cx = x + w / 2, cy = y + h / 2;
  // Antenna first: it stands behind the cabinet top.
  const rod = (x0, y0, x1, y1) => {
    const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * 2.2, ny = Math.cos(a) * 2.2;
    cut(ctx, [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], '#c9c7bd', { drop: 6, rim: 2.5, amp: 0.4 });
    cut(ctx, oval(x1, y1, 5.5, 5.5, 12), '#dedbd0', { drop: 5, rim: 2 });
  };
  rod(794, 350, 690, 248);
  rod(806, 350, 910, 244);
  cut(ctx, oval(800, 356, 28, 16, 24, Math.PI, TAU), '#2d2420', { drop: 5, rim: 3 });
  // Cabinet.
  cut(ctx, rrect(655, 356, 300, 208, 20, 5), '#6b3d20', {
    drop: 9, rim: 6,
    tex: c => {
      woodGrain(c, 655, 356, 300, 208, 'rgba(30,12,4,0.3)', 6);
      hatch(c, 655, 540, 955, 564, 3, 0, 'rgba(25,10,4,0.35)');
      c.fillStyle = 'rgba(255,220,170,0.12)'; c.fillRect(655, 356, 300, 6);
    },
  });
  // Light bezel, then the grey glass.
  cut(ctx, superellipse(cx, cy, w / 2 + 12, h / 2 + 11, 4.5), '#dccba1', { drop: 4, rim: 3, tex: c => hatch(c, x - 14, cy + 40, x + w + 14, y + h + 14, 3, 0, 'rgba(110,80,30,0.3)') });
  cut(ctx, superellipse(cx, cy, w / 2, h / 2, 4), '#454c4b', {
    drop: 3, rim: 2, edge: '#2a2e2d',
    tex: c => {
      hatch(c, x, y, x + w, y + h, 4, -0.5, 'rgba(0,0,0,0.18)');
      c.fillStyle = 'rgba(0,0,0,0.25)'; trace(c, [superellipse(cx + 6, cy + 8, w / 2 - 14, h / 2 - 12, 4)]); c.fill();
    },
  });
  // The glint: a curved slip of white paper on the glass.
  const glint = [];
  for (let i = 0; i <= 10; i++) glint.push([x + 22 + i * 7, y + 26 - Math.sin((i / 10) * Math.PI) * 10 + i * 0.4]);
  for (let i = 10; i >= 0; i--) glint.push([x + 26 + i * 6.4, y + 33 - Math.sin((i / 10) * Math.PI) * 8 + i * 0.4]);
  cut(ctx, glint, 'rgba(250,250,245,0.8)', { drop: 0, rim: 0, amp: 0.3 });
  // Control panel: knobs and speaker grille.
  cut(ctx, rrect(884, 372, 58, 176, 8), '#5a3219', { drop: 3, rim: 2 });
  for (const ky of [402, 450]) {
    cut(ctx, oval(913, ky, 18, 18, 22), '#e3d6b4', { drop: 5, rim: 3, tex: c => hatch(c, 895, ky, 931, ky + 18, 3, 0, 'rgba(90,70,40,0.3)') });
    cut(ctx, oval(913, ky, 9, 9, 14), '#8d7d5e', { drop: 2, rim: 1.5 });
    ctx.fillStyle = '#2d2420'; ctx.fillRect(911.5, ky - 17, 3, 9);
  }
  cut(ctx, rrect(892, 480, 42, 60, 5), '#c2a468', {
    drop: 3, rim: 2, tex: c => {
      c.fillStyle = 'rgba(50,30,10,0.65)';
      for (let gy = 485; gy < 540; gy += 5) for (let gx = 896 + ((gy / 5) % 2) * 2.5; gx < 934; gx += 5) { c.beginPath(); c.arc(gx, gy, 1.3, 0, TAU); c.fill(); }
    },
  });
}

function lamp(ctx) {
  const px = 1262, base = 728;
  tab(ctx, px, base - 4, 76);
  cut(ctx, rect(px - 4, 378, 8, base - 386), '#3a2c22', { drop: 7, rim: 3, amp: 0.4 });
  cut(ctx, oval(px, base - 6, 42, 12, 24), '#3a2c22', { drop: 6, rim: 3 });
  // The shade glows: warm card, pleats printed on.
  const shade = [[1216, 286], [1308, 286], [1344, 390], [1180, 390]];
  cut(ctx, shade, '#ffd77e', {
    drop: 8,
    tex: c => {
      c.strokeStyle = 'rgba(190,110,30,0.45)'; c.lineWidth = 1.4;
      for (let i = 0; i <= 14; i++) { c.beginPath(); c.moveTo(lerp(1216, 1308, i / 14), 286); c.lineTo(lerp(1180, 1344, i / 14), 390); c.stroke(); }
      c.fillStyle = 'rgba(255,250,220,0.55)'; c.fillRect(1180, 286, 180, 8);
      c.fillStyle = 'rgba(200,110,30,0.4)'; c.fillRect(1180, 380, 180, 10);
    },
  });
}

function rug(ctx) {
  cut(ctx, oval(800, 800, 460, 92, 48), '#b3382f', { drop: 5, tex: c => {
    c.fillStyle = 'rgba(250,230,190,0.5)';
    for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU; c.beginPath(); c.arc(800 + Math.cos(a) * 446, 800 + Math.sin(a) * 84, 3, 0, TAU); c.fill(); }
  } });
  cut(ctx, oval(800, 800, 420, 78, 48), '#efe1c0', { drop: 3, rim: 2 });
  cut(ctx, oval(800, 800, 402, 70, 48), '#2f3f6b', { drop: 3, rim: 2, tex: c => {
    c.fillStyle = 'rgba(240,210,150,0.35)';
    for (let i = -5; i <= 5; i++) {
      const mx = 800 + i * 64, my = 800;
      c.beginPath(); c.moveTo(mx, my - 22); c.lineTo(mx + 16, my); c.lineTo(mx, my + 22); c.lineTo(mx - 16, my); c.fill();
    }
  } });
}

function coffeeTable(ctx) {
  const x = 556, y = 742, w = 424;
  for (const lx of [x + 26, x + w - 44, x + 120, x + w - 136]) {
    cut(ctx, [[lx, y + 14], [lx + 16, y + 14], [lx + 12, y + 96], [lx + 6, y + 96]], '#6a3e1f', { drop: 5, rim: 2 });
  }
  cut(ctx, rect(x + 10, y + 12, w - 20, 16), '#7d4a24', { drop: 4, rim: 2, tex: c => hatch(c, x, y + 12, x + w, y + 28, 3, 0, 'rgba(30,12,4,0.35)') });
  cut(ctx, rrect(x, y - 4, w, 18, 6), '#a8672f', { drop: 6, tex: c => woodGrain(c, x, y - 4, w, 18, 'rgba(70,35,10,0.3)', 5) });
  // A folded newspaper beside the jar.
  cut(ctx, [[x + 60, y - 4], [x + 76, y - 22], [x + 196, y - 20], [x + 184, y - 4]], '#ded7c5', { drop: 4, rim: 2, tex: c => newsprint(c, x + 60, y - 24, 140, 24, 40) });
  cut(ctx, [[x + 64, y - 22], [x + 80, y - 30], [x + 196, y - 28], [x + 190, y - 20]], '#e8e2d2', { drop: 3, rim: 2, tex: c => newsprint(c, x + 60, y - 32, 140, 14, 40) });
  jar(ctx, 872, y - 4);
}

function jar(ctx, cx, by) {
  const w = 62, h = 76, top = by - h;
  // Pickles first, seen through the glass.
  cut(ctx, rrect(cx - w / 2, top, w, h, 12), '#cfe6d8', { drop: 7 });
  for (const [dx, dy, r] of [[-14, 34, 0.25], [4, 44, -0.2], [16, 30, 0.35], [-4, 22, -0.1], [-16, 56, 0.4], [12, 58, -0.35]]) {
    ctx.save();
    ctx.translate(cx + dx, top + dy); ctx.rotate(r);
    cut(ctx, oval(0, 0, 8, 17, 16), '#5f9a38', { drop: 3, rim: 1.5, edge: '#dbeccf', tex: c => { c.fillStyle = 'rgba(30,60,15,0.4)'; for (let k = -2; k <= 2; k++) { c.beginPath(); c.arc(2, k * 6, 1.4, 0, TAU); c.fill(); } } });
    ctx.restore();
  }
  cut(ctx, rrect(cx - w / 2 + 4, top + 4, w - 8, h - 8, 10), 'rgba(200,236,225,0.35)', { drop: 0, rim: 0 });
  cut(ctx, rect(cx - w / 2 + 8, top + 12, 6, h - 26), 'rgba(255,255,255,0.8)', { drop: 0, rim: 0, amp: 0.5 });
  // Blank paper label.
  cut(ctx, rect(cx - w / 2 + 2, top + 50, w - 4, 14), '#f4e6c4', { drop: 3, rim: 2, tex: c => { c.strokeStyle = 'rgba(200,60,50,0.8)'; c.lineWidth = 1.5; c.strokeRect(cx - w / 2 + 6, top + 53, w - 12, 8); } });
  // The red screw lid.
  cut(ctx, rrect(cx - w / 2 - 3, top - 16, w + 6, 20, 4), '#d8433a', {
    drop: 5, tex: c => {
      c.fillStyle = 'rgba(110,20,15,0.45)';
      for (let gx = cx - w / 2; gx < cx + w / 2; gx += 6) c.fillRect(gx, top - 14, 2, 16);
      c.fillStyle = 'rgba(255,220,200,0.4)'; c.fillRect(cx - w / 2, top - 15, w + 6, 3);
    },
  });
}

function sofa(ctx) {
  const col = '#b8862e';
  const velvet = (x0, y0, x1, y1) => c => {
    c.fillStyle = 'rgba(90,50,10,0.3)';
    for (let i = 0; i < 900; i++) {
      const x = lerp(x0, x1, rand(i + 0.11)), y = lerp(y0, y1, rand(i + 0.23));
      c.fillRect(x, y, 2, 1.2);
    }
    hatch(c, x0, y0 + 70, x1, y1, 3.5, 0.15, 'rgba(70,35,5,0.3)');
  };
  // Arms, lower and further than the back.
  for (const [ax, dir] of [[96, 1], [1504, -1]]) {
    cut(ctx, [[ax, 950], [ax, 836], [ax + dir * 40, 818], [ax + dir * 140, 818], [ax + dir * 170, 836], [ax + dir * 170, 950]], '#9d7024', { drop: 8, tex: velvet(ax - 180, 810, ax + 180, 950) });
  }
  // The backrest: one long card with two cushion humps and piping along the top.
  const back = [[176, 960]];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = lerp(176, 1424, t);
    const hump = Math.abs(Math.sin(t * Math.PI * 2));
    const endRound = Math.min(1, t * 12, (1 - t) * 12);
    back.push([x, 860 - (hump * 26 + 20) * Math.sqrt(endRound)]);
  }
  back.push([1424, 960]);
  cut(ctx, back, col, {
    drop: 11, rim: 6,
    tex: c => {
      c.fillStyle = 'rgba(255,230,160,0.08)';
      for (let x = 176; x < 1424; x += 14) c.fillRect(x, 800, 6, 160);
      velvet(176, 800, 1424, 960)(c);
      c.fillStyle = 'rgba(90,50,10,0.55)';
      for (const bx of [330, 490, 650, 950, 1110, 1270]) { c.beginPath(); c.arc(bx, 880, 4, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(90,50,10,0.5)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(800, 860); c.lineTo(800, 960); c.stroke();
    },
  });
  // Piping along the top edge, a thin strip of darker card.
  const pipe = back.slice(1, -1);
  const strip = [...pipe.map(([x, y]) => [x, y + 2]), ...pipe.slice().reverse().map(([x, y]) => [x, y + 9])];
  cut(ctx, strip, '#8c6220', { drop: 2, rim: 0, amp: 0.4 });
  cut(ctx, rect(150, 918, 1300, 40), '#7a531a', { drop: 6, rim: 4, tex: c => hatch(c, 150, 918, 1450, 958, 3, 0, 'rgba(40,20,5,0.35)') });
}

// Light as layers of tinted tissue: stepped rings, no gradient.
function light(ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#e4d5d0'; // dusk
  ctx.fillRect(96, 90, 1408, 870);
  ctx.globalCompositeOperation = 'screen';
  // Many faint rings, the outermost barely there, so no hard arc crosses the wall by the TV.
  for (const [r, a] of [[300, 0.025], [262, 0.035], [222, 0.045], [180, 0.06], [130, 0.08], [85, 0.08]]) {
    trace(ctx, [scissor(oval(1262, 340, r, r * 1.05, 40), 3)]);
    ctx.fillStyle = `rgba(255,190,90,${a})`;
    ctx.fill();
  }
  // Pool on the floor under the lamp.
  trace(ctx, [scissor(oval(1262, 730, 190, 34, 32), 2)]);
  ctx.fillStyle = 'rgba(255,200,110,0.16)'; ctx.fill();
  // Glow from the footlights onto the front of the stage.
  for (let i = 0; i < 8; i++) {
    trace(ctx, [scissor(oval(200 + i * 171, 940, 90, 60, 20), 2)]);
    ctx.fillStyle = 'rgba(255,210,130,0.10)'; ctx.fill();
  }
  ctx.restore();
}

function curtains(ctx) {
  // Side drapes, tied back.
  for (const side of [0, 1]) {
    const m = side ? (x => 1600 - x) : (x => x);
    const pts = [[m(96), 90], [m(250), 90]];
    for (let i = 1; i <= 8; i++) { const t = i / 8; pts.push([m(lerp(250, 168, Math.sin(t * Math.PI / 2))), lerp(90, 560, t)]); }
    for (let i = 1; i <= 8; i++) { const t = i / 8; pts.push([m(lerp(168, 236, t * t)), lerp(560, 950, t)]); }
    pts.push([m(96), 950]);
    cut(ctx, pts, '#9c1f26', {
      drop: 10, rim: 5,
      tex: c => {
        for (let f = 0; f < 6; f++) { // fold lines, printed dark and light
          const k = (f + 0.5) / 6;
          const xt = lerp(96, 250, k), xm = lerp(96, 168, k), xb = lerp(96, 236, k);
          c.strokeStyle = 'rgba(40,0,5,0.45)'; c.lineWidth = 7;
          c.beginPath(); c.moveTo(m(xt), 90); c.quadraticCurveTo(m(xm + 8 * k), 400, m(xm), 560); c.quadraticCurveTo(m(xm), 760, m(xb), 950); c.stroke();
          c.strokeStyle = 'rgba(255,170,160,0.3)'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(m(xt + 10), 90); c.quadraticCurveTo(m(xm + 14 * k + 6), 400, m(xm + 5), 560); c.quadraticCurveTo(m(xm + 5), 760, m(xb + 10), 950); c.stroke();
        }
      },
    });
    // Gold tie-back and tassel.
    cut(ctx, rrect(side ? 1600 - 196 : 96, 546, 100, 22, 10), '#d4a843', { drop: 5, rim: 3, tex: c => hatch(c, 0, 546, 1600, 568, 4, 0.9, 'rgba(120,80,10,0.4)') });
    const tx = m(186);
    cut(ctx, [[tx - 8, 566], [tx + 8, 566], [tx + 14, 612], [tx - 14, 612]], '#d4a843', { drop: 5, rim: 3, tex: c => hatch(c, tx - 20, 580, tx + 20, 612, 3, Math.PI / 2, 'rgba(120,80,10,0.5)') });
  }
  // Pelmet with five swags, fringed.
  const swags = 5, x0 = 96, x1 = 1504, sw = (x1 - x0) / swags;
  const edge = [];
  for (let s = 0; s < swags; s++) for (let i = 0; i < 12; i++) {
    const t = i / 12;
    edge.push([x0 + (s + t) * sw, 136 + Math.sin(t * Math.PI) * 32]);
  }
  edge.push([x1, 136]);
  cut(ctx, [[x0, 90], [x1, 90], ...edge.slice().reverse()], '#a8222a', {
    drop: 10, rim: 5,
    tex: c => {
      for (let s = 0; s < swags; s++) for (const d of [12, 24]) {
        c.strokeStyle = 'rgba(40,0,5,0.45)'; c.lineWidth = 5;
        c.beginPath();
        for (let i = 0; i <= 12; i++) { const t = i / 12; c.lineTo(x0 + (s + t) * sw, 136 - d + Math.sin(t * Math.PI) * (32 - d * 0.6)); }
        c.stroke();
      }
    },
  });
  const fringe = [...edge.map(([x, y]) => [x, y - 3]), ...edge.slice().reverse().map(([x, y]) => [x, y + 9])];
  cut(ctx, fringe, '#d4a843', { drop: 4, rim: 2, amp: 0.5, tex: c => {
    c.strokeStyle = 'rgba(120,80,10,0.55)'; c.lineWidth = 1;
    c.beginPath(); for (let x = x0; x < x1; x += 4) { c.moveTo(x, 110); c.lineTo(x, 190); } c.stroke();
  } });
  for (let s = 1; s < swags; s++) {
    const tx = x0 + s * sw;
    cut(ctx, [[tx - 5, 132], [tx + 5, 132], [tx + 12, 176], [tx - 12, 176]], '#d4a843', { drop: 5, rim: 3, tex: c => hatch(c, tx - 14, 150, tx + 14, 176, 3, Math.PI / 2, 'rgba(120,80,10,0.5)') });
    cut(ctx, oval(tx, 136, 9, 9, 12), '#e7c35c', { drop: 3, rim: 2 });
  }
}

function proscenium(ctx) {
  const RED = '#7e1b22', GOLD = '#c99a3a';
  cut(ctx, [rect(14, 12, 1572, 976), rect(96, 90, 1408, 860)], '#efe2c2', {
    drop: 12, rim: 6, amp: 1.2,
    tex: c => {
      // Header panel.
      c.fillStyle = RED; c.fillRect(118, 26, 1364, 50);
      c.strokeStyle = GOLD; c.lineWidth = 3; c.strokeRect(112, 20, 1376, 62);
      c.lineWidth = 1.2; c.strokeRect(124, 32, 1352, 38);
      c.fillStyle = GOLD;
      for (let x = 140; x < 1470; x += 18) { c.beginPath(); c.arc(x, 51, 2.4, 0, TAU); c.fill(); }
      // Pillars: red inset with gold flutes.
      for (const px of [28, 1508]) {
        c.fillStyle = RED; c.fillRect(px, 110, 64, 820);
        c.strokeStyle = GOLD; c.lineWidth = 2.5; c.strokeRect(px - 4, 106, 72, 828);
        c.lineWidth = 1.4;
        for (let f = 1; f < 5; f++) { c.beginPath(); c.moveTo(px + f * 12.8, 150); c.lineTo(px + f * 12.8, 890); c.stroke(); }
      }
      // Apron with bead moulding.
      c.fillStyle = '#5a1418'; c.fillRect(110, 954, 1380, 26);
      c.fillStyle = GOLD;
      for (let x = 120; x < 1480; x += 14) { c.beginPath(); c.arc(x, 967, 2, 0, TAU); c.fill(); }
      hatch(c, 14, 12, 96, 988, 4, 0.7, 'rgba(120,80,30,0.12)');
      hatch(c, 1504, 12, 1586, 988, 4, 0.7, 'rgba(120,80,30,0.12)');
    },
  });
  // Capitals and bases, stuck on as separate cards.
  for (const px of [22, 1502]) {
    cut(ctx, rect(px, 96, 76, 26), GOLD, { drop: 5, rim: 3, tex: c => hatch(c, px, 96, px + 76, 122, 4, 0, 'rgba(110,70,10,0.4)') });
    cut(ctx, rect(px - 4, 900, 84, 30), GOLD, { drop: 5, rim: 3, tex: c => hatch(c, px - 4, 900, px + 80, 930, 4, 0, 'rgba(110,70,10,0.4)') });
  }
  // Central medallion: a sunburst cartouche overlapping the pelmet.
  cut(ctx, oval(800, 64, 96, 50, 40), GOLD, {
    drop: 8, tex: c => {
      c.strokeStyle = 'rgba(110,70,10,0.55)'; c.lineWidth = 1.5;
      c.beginPath(); for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; c.moveTo(800, 64); c.lineTo(800 + Math.cos(a) * 100, 64 + Math.sin(a) * 52); } c.stroke();
    },
  });
  cut(ctx, oval(800, 64, 58, 30, 32), '#efe2c2', { drop: 4, rim: 3 });
  cut(ctx, oval(800, 64, 26, 14, 20), RED, { drop: 3, rim: 2 });
  for (const sx of [-1, 1]) cut(ctx, leaf(800 + sx * 100, 66, 800 + sx * 150, 40, 800 + sx * 210, 62, 10), GOLD, { drop: 4, rim: 3 });
  // Footlight hoods on the stage lip.
  for (let i = 0; i < 8; i++) {
    const fx = 200 + i * 171;
    cut(ctx, oval(fx, 954, 34, 20, 16, Math.PI, TAU), GOLD, { drop: 5, rim: 3, tex: c => hatch(c, fx - 34, 934, fx + 34, 954, 3, Math.PI / 2, 'rgba(110,70,10,0.4)') });
  }
  // Brass split pins holding the card together.
  for (const [bx, by] of [[55, 50], [1545, 50], [55, 960], [1545, 960]]) {
    cut(ctx, oval(bx, by, 8, 8, 14), '#b88d3a', { drop: 3, rim: 0, tex: c => { c.fillStyle = 'rgba(60,40,10,0.7)'; c.fillRect(bx - 6, by - 1, 12, 2); } });
  }
  tape(ctx, 40, 30, 70, 20, -0.7);
  tape(ctx, 1560, 972, 70, 20, -0.7);
}

export function drawRoom(ctx, w = 1600, h = 1000) {
  seed = 0;
  ctx.save();
  ctx.scale(w / 1600, h / 1000);
  S = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
  backstage(ctx);
  ctx.save();
  ctx.beginPath(); ctx.rect(96, 90, 1408, 860); ctx.clip();
  wall(ctx);
  floor(ctx);
  windowPane(ctx);
  picture(ctx);
  sideboard(ctx);
  tv(ctx);
  plant(ctx);
  lamp(ctx);
  rug(ctx);
  coffeeTable(ctx);
  sofa(ctx);
  light(ctx);
  curtains(ctx);
  ctx.restore();
  proscenium(ctx);
  ctx.restore();
}

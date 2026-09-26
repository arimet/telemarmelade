// The living room in wax crayon on drawing paper.
// Each mark (a fill, a line, an object) is drawn on a scratch layer whose alpha is crayon pressure, then
// pressed onto one paper grain shared by the whole sheet: wax sticks to the tooth's peaks first and only
// heavy pressure reaches the pits, so the same white specks show through every colour, layer after layer.
import { rand, lerp, clamp } from '../engine.js';

export const TV_SCREEN = { x: 672, y: 300, w: 180, h: 135 };
// The channel knob, then the power knob; r covers each knob's whole outline.
export const TV_KNOBS = [{ x: 904, y: 318, r: 18 }, { x: 904, y: 368, r: 18 }];
// Don't lay this room's drawn glass over the live picture: its paper grain would speckle the episode.
export const SCREEN_GLASS = false;
// The glass of the TV screen (a rounded rectangle, corner radius 20), as a path, so the page can
// cut the live picture to its exact shape.
export function traceScreen(c) {
  const { x, y, w, h } = TV_SCREEN, r = 20;
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

const TAU = Math.PI * 2;
const PAPER = [243, 236, 222];
const INK = '#3a2a24';
const VP = [820, 430]; // vanishing point of the room

let seed = 0;
const R = () => rand(++seed * 0.731 + 0.5);
// The drawing, the pressure scratch (one pixel per logical px), and a band of it at device resolution.
let c, scratch, up, band; // band: the ImageData that fills `up`
// The view: device px per logical px, the logical point at device (0, 0), the device size, the whole
// logical px the canvas shows, and those the scratch covers.
let Z, OX, OY, DW, DH, VX0, VY0, VX1, VY1, SX, SY, SW, SH;
// The scratch reaches this far past the view, so strokes crossing the view's edge lie wholly on it and
// rasterise as they do in the wide view (a stroke cut by the canvas edge comes out slightly different).
const MARGIN = 200;

// --- regions: a closed outline, wobbled a little so no edge is ruler-straight ---

function region(pts, smooth = false) {
  const path = new Path2D();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(([x, y], i) => {
    const j = 0.9 * (R() - 0.5);
    i ? path.lineTo(x + j, y - j) : path.moveTo(x, y);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  });
  path.closePath();
  return { pts, smooth, path, box: [x0, y0, x1, y1] };
}
const poly = pts => region(pts);
function oval(cx, cy, rx, ry, a0 = 0, a1 = TAU) {
  const n = Math.max(16, Math.round((rx + ry) / 3)), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + (a1 - a0) * i / n;
    pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return region(pts, true);
}
function rrect(x, y, w, h, r) {
  const pts = [], arc = (cx, cy, t0) => {
    for (let i = 0; i <= 6; i++) { const t = t0 + (Math.PI / 2) * i / 6; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  };
  arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
  return region(pts, true);
}

// A point on the left wall at column x, on the line that meets the room corner (x = 300) at height yc.
const lw = (x, yc) => [x, VP[1] + (yc - VP[1]) * (x - VP[0]) / (300 - VP[0])];

// --- marks ---

// --- wax: every mark is laid on a scratch layer as pressure, then pressed onto the one paper grain ---

let depth = 0, mx0, my0, mx1, my1; // nesting, and the logical box the marks of the current press cover
const grow = (x, y, r) => { mx0 = Math.min(mx0, x - r); my0 = Math.min(my0, y - r); mx1 = Math.max(mx1, x + r); my1 = Math.max(my1, y + r); };

// Run `draw` on the scratch layer, then keep each pixel's wax only where the pressure reaches that deep
// into the tooth, and lay the result on the drawing. Nested calls press together with their parent.
// `clip`, a region, trims the marks to its outline.
function wax(draw, opacity = 0.92, clip = null) {
  if (depth) return draw();
  depth++; mx0 = my0 = Infinity; mx1 = my1 = -Infinity;
  const main = c;
  c = scratch;
  draw();
  if (clip) {
    c.save();
    c.beginPath(); c.rect(mx0, my0, mx1 - mx0, my1 - my0); c.clip();
    c.globalAlpha = 1; c.globalCompositeOperation = 'destination-in';
    c.fill(clip.path);
    c.restore();
  }
  c = main; depth--;
  // Pressure is drawn at logical resolution, then interpolated (bilinear) up to device resolution here, in
  // logical coordinates: a close-up presses exactly the pressure the wide view does, only sampled finer.
  const cx0 = Math.max(SX, Math.floor(mx0)), cy0 = Math.max(SY, Math.floor(my0));
  const cx1 = Math.min(SX + SW, Math.ceil(mx1)), cy1 = Math.min(SY + SH, Math.ceil(my1));
  if (cx1 <= cx0 || cy1 <= cy0) return;
  // Only the part the canvas shows (plus a pixel for the interpolation) is pressed.
  const x0 = Math.max(cx0, VX0 - 1), y0 = Math.max(cy0, VY0 - 1), x1 = Math.min(cx1, VX1 + 1), y1 = Math.min(cy1, VY1 + 1);
  const X0 = Math.max(0, Math.floor((x0 - OX) * Z)), Y0 = Math.max(0, Math.floor((y0 - OY) * Z));
  const w = Math.min(DW, Math.ceil((x1 - OX) * Z)) - X0, h = Math.min(DH, Math.ceil((y1 - OY) * Z)) - Y0;
  const src = x1 > x0 && y1 > y0 && w > 0 && h > 0 && scratch.getImageData(x0 - SX, y0 - SY, x1 - x0, y1 - y0).data;
  scratch.clearRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
  if (!src) return;
  const sw = x1 - x0, sh = y1 - y0;
  // Premultiplied pressure with a transparent border, so every tap is in range.
  const pw = sw + 2, P = new Float32Array(pw * (sh + 2) * 4);
  for (let y = 0, i = 0; y < sh; y++) {
    for (let x = 0, k = ((y + 1) * pw + 1) * 4; x < sw; x++, i += 4, k += 4) {
      const a = src[i + 3] / 255;
      P[k] = src[i] * a; P[k + 1] = src[i + 1] * a; P[k + 2] = src[i + 2] * a; P[k + 3] = a;
    }
  }
  const col = new Int32Array(w), fx = new Float32Array(w), row = new Float32Array(pw * 4), d = band.data;
  for (let X = 0; X < w; X++) {
    const u = (X0 + X + 0.5) / Z + OX - x0 + 0.5, k = Math.floor(u);
    col[X] = Math.min(sw, Math.max(0, k)) * 4; fx[X] = Math.min(1, Math.max(0, u - k));
  }
  for (let Yb = Y0; Yb < Y0 + h; Yb += BANDS) {
    const hb = Math.min(BANDS, Y0 + h - Yb);
    for (let y = 0; y < hb; y++) {
      const v = (Yb + y + 0.5) / Z + OY - y0 + 0.5, k = Math.min(sh, Math.max(0, Math.floor(v)));
      const f = Math.min(1, Math.max(0, v - k)), r0 = k * pw * 4, r1 = r0 + pw * 4;
      for (let i = 0; i < row.length; i++) row[i] = P[r0 + i] + (P[r1 + i] - P[r0 + i]) * f;
      for (let X = 0, g = (Yb + y) * DW + X0, o = (y * DW + X0) * 4; X < w; X++, g++, o += 4) {
        const k0 = col[X], t = fx[X], a = row[k0 + 3] + (row[k0 + 7] - row[k0 + 3]) * t;
        if (a <= 0.004) { d[o + 3] = 0; continue; }
        const inv = 1 / a;
        d[o] = (row[k0] + (row[k0 + 4] - row[k0]) * t) * inv;
        d[o + 1] = (row[k0 + 1] + (row[k0 + 5] - row[k0 + 1]) * t) * inv;
        d[o + 2] = (row[k0 + 2] + (row[k0 + 6] - row[k0 + 2]) * t) * inv;
        // Coverage = (tooth height - (1 - depth)) / BAND + 1/2, in bytes; the clamped array does the clamping.
        d[o + 3] = G[g] + (Math.min(DEEPEST, a * SINK) - 1) * (255 / BAND) + 127.5;
      }
    }
    up.putImageData(band, 0, 0, X0, 0, w, hb);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = opacity;
    c.drawImage(up.canvas, X0, 0, w, hb, X0, Yb, w, hb);
    c.restore();
  }
}
const BANDS = 256; // device rows per band
const SINK = 1.3, DEEPEST = 0.95, BAND = 0.1;

// A hand-drawn line: wobbles, overshoots both ends, and gets a lighter second pass over part of it.
function line([ax, ay], [bx, by], col = INK, { w = 3, a = 0.85, wob = 1.1, over = 5 } = {}) {
  const len = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / len, dy = (by - ay) / len;
  const p1 = R() * TAU, p2 = R() * TAU, e0 = over * (0.2 + R()), e1 = over * (0.2 + R());
  const pts = [];
  for (let u = -e0; u <= len + e1 + 0.1; u += Math.min(10, (len + e0 + e1) / 3)) {
    const o = wob * (0.7 * Math.sin(u * 0.021 + p1) + 0.4 * Math.sin(u * 0.083 + p2));
    pts.push([ax + dx * u - dy * o, ay + dy * u + dx * o]);
  }
  const k0 = Math.floor(R() * pts.length * 0.5), k1 = k0 + Math.ceil(pts.length * (0.3 + 0.4 * R()));
  wax(() => {
    trail(pts, col, w, a);
    trail(pts.slice(k0, k1).map(([x, y]) => [x + 0.7, y + 0.6]), col, w * 0.8, a * 0.45);
  });
}
// A crayon line as pressure: a soft full-width pass and a firmer core, so its edges break up first.
function trail(pts, col, w, a) {
  if (pts.length < 2) return;
  wax(() => {
    c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath();
    pts.forEach(([x, y], i) => { i ? c.lineTo(x, y) : c.moveTo(x, y); grow(x, y, w); });
    c.globalAlpha = Math.min(1, a * 0.75); c.lineWidth = w; c.stroke();
    c.globalAlpha = Math.min(1, a * 0.8); c.lineWidth = w * 0.45; c.stroke();
  });
}

// Outline a region: polygon edges one by one (so corners cross), curves as one loop that overlaps its start.
function outline(reg, col = INK, o = {}) {
  const { pts } = reg;
  wax(() => {
    if (!reg.smooth) {
      for (let i = 0; i < pts.length; i++) line(pts[i], pts[(i + 1) % pts.length], col, o);
      return;
    }
    const { w = 3, a = 0.85, wob = 1 } = o, n = pts.length, start = Math.floor(R() * n);
    const p1 = R() * TAU, loop = [];
    for (let i = 0; i <= n * 1.08; i++) {
      const [x, y] = pts[(start + i) % n], o2 = wob * Math.sin(i * 0.37 + p1);
      loop.push([x + o2, y + o2 * 0.6]);
    }
    trail(loop, col, w, a);
    trail(loop.slice(0, Math.ceil(n * 0.4)).map(([x, y]) => [x + 0.8, y - 0.5]), col, w * 0.7, a * 0.4);
  });
}

// Fill a region with directional crayon strokes: short overlapping marks along rows at angle `ang`.
// af(x, y) scales the pressure, for gradients and pools of light.
function fill(reg, col, { ang = -1.05, w = 6, gap = 4, len = 80, a = 0.45, af = null, bend = 0.12 } = {}) {
  const [x0, y0, x1, y1] = reg.box, dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    const u = x * dx + y * dy, v = x * nx + y * ny;
    umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v);
  }
  wax(() => {
    // Strokes are only boxed here (a path clip per stroke is slow); the press cuts them to the region once.
    c.save();
    c.beginPath(); c.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); c.clip();
    c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = w;
    for (let v = vmin - gap * R(); v < vmax + gap; v += gap * (0.7 + 0.6 * R())) {
      for (let u = umin - len * R(); u < umax;) {
        const L = len * (0.5 + 0.8 * R()), va = v + (R() - 0.5) * gap, vb = v + (R() - 0.5) * gap;
        const ax = dx * u + nx * va, ay = dy * u + ny * va, bx = dx * (u + L) + nx * vb, by = dy * (u + L) + ny * vb;
        const k = (R() - 0.5) * L * bend, mx = (ax + bx) / 2 + nx * k, my = (ay + by) / 2 + ny * k;
        let alpha = a * (0.55 + 0.6 * R());
        if (af) alpha *= af(mx, my);
        if (alpha > 0.01) {
          c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(mx, my, bx, by);
          // The curve stays inside the triangle of its end and control points.
          grow(clamp(Math.min(ax, bx, mx), x0, x1), clamp(Math.min(ay, by, my), y0, y1), w);
          grow(clamp(Math.max(ax, bx, mx), x0, x1), clamp(Math.max(ay, by, my), y0, y1), w);
          c.globalAlpha = Math.min(1, alpha * 1.05); c.stroke();
        }
        u += L * (0.6 + 0.5 * R());
      }
    }
    c.restore();
  }, 0.92, reg);
}
// Shadow hatching: thin, spaced, straight-ish lines.
const hatch = (reg, col, o = {}) => fill(reg, col, { ang: 0.8, w: 2.2, gap: 6, len: 60, a: 0.6, bend: 0.03, ...o });

// Lift what lies under a region, as an illustrator leaves the paper for an object drawn later.
function knock(reg, k = 0.85) {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.globalAlpha = k; c.fill(reg.path);
  c.restore();
}

// The usual object: lift, lay colours, press the edge in its own colour, outline.
function paint(reg, layers, { ink = INK, inkW = 3, inkA = 0.85, lift = 0.85, edge = true } = {}) {
  if (lift) knock(reg, lift);
  // One press for the whole object: its colours share the tooth, and it costs one pass.
  wax(() => {
    for (const [col, o] of layers) fill(reg, col, o);
    if (edge) outline(reg, layers[0][0], { w: 6, a: 0.55, wob: 1.5 });
  }, 0.92, reg);
  if (inkW) outline(reg, ink, { w: inkW, a: inkA });
}

// Pressure falloff around a point.
const glow = (cx, cy, r, p = 1) => (x, y) => Math.max(0, 1 - Math.hypot(x - cx, (y - cy) * 1.2) / r) ** p;

// --- the paper ---

// Tooth height per device pixel, 0 (pit) .. 1 (peak) times 255 / BAND, equalised so a height is also a share of the sheet.
let G;

// The grain is attached to the paper: three octaves of value noise on lattices fixed in logical units, each
// lattice value a hash of its own cell, interpolated (bilinear) at each device pixel's logical position.
// Any view of any part of the sheet, at any zoom, sees the same tooth in the same place.
// Fills `out` (dw x dh) with the raw field, 0 .. WEIGHTS.
function grainField(ox, oy, z, dw, dh, out) {
  out.fill(0);
  OCTAVES.forEach(([cell, weight], o) => {
    const i0 = Math.floor(ox / cell) - 1, j0 = Math.floor(oy / cell) - 1;
    const nw = Math.ceil(dw / z / cell) + 4, nh = Math.ceil(dh / z / cell) + 4, L = new Float32Array(nw * nh);
    for (let j = 0, k = 0; j < nh; j++) for (let i = 0; i < nw; i++, k++) L[k] = hash(i0 + i, j0 + j, o) * (weight / 255);
    const col = new Int32Array(dw), fx = new Float32Array(dw), row = new Float32Array(nw);
    for (let X = 0; X < dw; X++) {
      const u = (ox + (X + 0.5) / z) / cell - i0, k = Math.floor(u);
      col[X] = k; fx[X] = u - k;
    }
    for (let Y = 0; Y < dh; Y++) {
      const v = (oy + (Y + 0.5) / z) / cell - j0, k = Math.floor(v), f = v - k, r0 = k * nw;
      for (let i = 0; i < nw; i++) row[i] = L[r0 + i] + (L[r0 + nw + i] - L[r0 + i]) * f;
      for (let X = 0, g = Y * dw; X < dw; X++, g++) { const k0 = col[X]; out[g] += row[k0] + (row[k0 + 1] - row[k0]) * fx[X]; }
    }
  });
}
// An integer hash rather than rand(): millions of lattice cells, each reachable on its own.
function hash(i, j, o) {
  let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(o + 1, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 24;
}
const OCTAVES = [[0.55, 1], [1.2, 0.5], [4, 0.14]]; // [cell size in logical px, weight]
const WEIGHTS = OCTAVES.reduce((sum, [, weight]) => sum + weight, 0), BINS = 1024;

// Equalisation table (field bin -> tooth height), measured once on a fixed patch so every view shares it.
let LUT = null;
function equaliser() {
  if (LUT) return LUT;
  const n = 800, f = new Float32Array(n * n), hist = new Float64Array(BINS + 1);
  grainField(0, 0, 2, n, n, f);
  for (const v of f) hist[Math.min(BINS - 1, Math.floor((v / WEIGHTS) * BINS)) + 1]++;
  for (let i = 1; i <= BINS; i++) hist[i] += hist[i - 1];
  return (LUT = new Float32Array(BINS).map((_, v) => ((hist[v] + hist[v + 1]) / 2 / hist[BINS]) * 255 / BAND));
}

function makeGrain() {
  const lut = equaliser(), f = new Float32Array(DW * BANDS);
  G = new Uint16Array(DW * DH);
  for (let Yb = 0; Yb < DH; Yb += BANDS) {
    const hb = Math.min(BANDS, DH - Yb);
    grainField(OX, OY + Yb / Z, Z, DW, hb, f);
    for (let i = 0, g = Yb * DW; i < DW * hb; i++, g++) G[g] = lut[Math.min(BINS - 1, Math.floor((f[i] / WEIGHTS) * BINS))];
  }
}

// Lay the drawing on the paper, band by band: wax a little darker on the peaks, paper a little shaded in the pits.
function onPaper(layer) {
  const lc = layer.getContext('2d');
  for (let Yb = 0; Yb < DH; Yb += BANDS) onPaperBand(lc, Yb, Math.min(BANDS, DH - Yb));
}
function onPaperBand(lc, Yb, hb) {
  const img = lc.getImageData(0, Yb, DW, hb), d = img.data;
  for (let i = 0, g = Yb * DW; i < d.length; i += 4, g++) {
    const h = G[g] * BAND / 255, a = d[i + 3] / 255, wx = (0.9 + 0.16 * h) * a, pp = (0.96 + 0.05 * h) * (1 - a);
    d[i] = PAPER[0] * pp + d[i] * wx;
    d[i + 1] = PAPER[1] * pp + d[i + 1] * wx;
    d[i + 2] = PAPER[2] * pp + d[i + 2] * wx;
    d[i + 3] = 255;
  }
  lc.putImageData(img, 0, Yb);
}

// --- the room ---

function walls() {
  const back = poly([[300, 0], [1600, 0], [1600, 620], [300, 620]]);
  wax(() => { // pressed as one layer: the two base colours blend like a single warm crayon
    fill(back, '#e8b774', { ang: -1.1, a: 0.5 });
    fill(back, '#e39a6b', { ang: -0.9, a: 0.35, af: (x, y) => 0.3 + y / 900 });
  }, 0.92, back);
  fill(back, '#f7d57e', { ang: -1.25, a: 0.7, af: glow(1380, 330, 520, 1.3) });
  const lit = glow(1380, 330, 760);
  fill(back, '#8a78b8', { ang: -0.75, w: 5, gap: 5, a: 0.45, len: 110, af: (x, y) => (1 - lit(x, y)) * (0.35 + 0.75 * (1 - y / 620)) });
  fill(back, '#ffbf5e', { ang: -1.2, a: 0.8, af: glow(1380, 310, 200, 0.8) });
  // Faint wallpaper stripes.
  wax(() => { for (let x = 330; x < 1600; x += 58) line([x, -10], [x + 2, 604], '#c9825a', { w: 2, a: 0.28, wob: 1.6, over: 0 }); });

  const left = poly([[0, 0], [300, 0], [300, 620], [0, 730]]);
  wax(() => {
    fill(left, '#d9a06e', { ang: -1.2, a: 0.5 });
    fill(left, '#7d6aa8', { ang: -0.9, a: 0.45 });
  }, 0.92, left);
  hatch(left, '#4f4585', { a: 0.4 });
  line([300, -10], [300, 622], '#5a4054', { w: 3, a: 0.6 });

  // Baseboards.
  const base = poly([[300, 598], [1600, 598], [1600, 620], [300, 620]]);
  paint(base, [['#f1e3c4', { ang: 0, a: 0.6, w: 5 }], ['#9a82b0', { ang: 0, a: 0.25, af: (x) => 1 - x / 1600 }]], { inkW: 2.2, inkA: 0.6, edge: false });
  const baseL = poly([lw(0, 598), lw(300, 598), lw(300, 620), lw(0, 620)]);
  paint(baseL, [['#b8a0b8', { ang: -0.35, a: 0.6, w: 5 }]], { inkW: 2.2, inkA: 0.6, edge: false });
}

function windowSky() {
  const frame = poly([lw(62, 180), lw(238, 180), lw(238, 462), lw(62, 462)]);
  const glass = poly([lw(78, 196), lw(222, 196), lw(222, 446), lw(78, 446)]);
  paint(frame, [['#efe3cc', { ang: -1.2, a: 0.6 }], ['#8f7fb0', { ang: -1.2, a: 0.3 }]], { lift: 0.9 });
  knock(glass, 0.95);
  const [, top] = lw(150, 196), [, bot] = lw(150, 446), band = y => (y - top) / (bot - top);
  fill(glass, '#3b4a92', { ang: 0.1, a: 0.8, af: (x, y) => Math.max(0, 1 - band(y) * 1.6) });
  fill(glass, '#b95a9c', { ang: 0.05, a: 0.65, af: (x, y) => Math.max(0, 1 - Math.abs(band(y) - 0.45) * 3) });
  fill(glass, '#f38a4e', { ang: -0.05, a: 0.75, af: (x, y) => Math.max(0, 1 - Math.abs(band(y) - 0.72) * 3.2) });
  fill(glass, '#ffd66e', { ang: 0, a: 0.8, af: (x, y) => Math.max(0, band(y) - 0.7) * 3.5 });
  // The sun going down behind the rooftops.
  const sun = oval(170, 392, 24, 22);
  paint(sun, [['#ffe27a', { ang: -0.8, a: 0.9 }], ['#f6a247', { ang: -0.8, a: 0.3 }]], { ink: '#e0602e', inkW: 2, inkA: 0.6, edge: false });
  const roofs = poly([lw(78, 446), lw(78, 400), lw(100, 400), lw(112, 380), lw(126, 400), lw(150, 400), lw(150, 372), lw(162, 372), lw(162, 410), lw(196, 410), lw(208, 392), lw(222, 404), lw(222, 446)]);
  paint(roofs, [['#46386a', { ang: -1.1, a: 0.8 }], ['#2c2750', { ang: 0.6, a: 0.4 }]], { inkW: 0, edge: false, lift: 0.7 });
  // Mullions.
  line(lw(150, 196), lw(150, 446), '#efe3cc', { w: 7, a: 0.9, over: 0 });
  line(lw(78, 318), lw(222, 318), '#efe3cc', { w: 7, a: 0.9, over: 0 });
  line(lw(150, 196), lw(150, 446), INK, { w: 2, a: 0.6 });
  line(lw(78, 318), lw(222, 318), INK, { w: 2, a: 0.6 });
  outline(glass, INK, { w: 2.4, a: 0.7 });
  // Sill.
  const sill = poly([lw(48, 462), lw(252, 462), lw(252, 474), lw(48, 474)]);
  paint(sill, [['#efe3cc', { ang: -0.3, a: 0.7 }], ['#7d6aa8', { ang: 0.8, a: 0.3 }]], { inkW: 2.6 });
  // Curtain on the corner side.
  const curtain = poly([lw(238, 150), lw(290, 150), [296, 560], [262, 590], lw(240, 540), lw(252, 400)]);
  paint(curtain, [['#c8473f', { ang: -1.4, a: 0.6, len: 120 }], ['#8e2f49', { ang: -1.5, a: 0.35, len: 120 }]]);
  wax(() => { for (const x of [254, 268, 280]) line(lw(x, 160), [x + 6, 560], '#6e2238', { w: 2, a: 0.5, wob: 3 }); });
}

function picture() {
  const frame = rrect(690, 32, 220, 112, 4), art = rrect(704, 45, 192, 86, 2);
  paint(frame, [['#c98b3c', { ang: -0.2, a: 0.6 }], ['#7a4a22', { ang: 1, a: 0.35 }]], { lift: 0.9 });
  knock(art, 0.95);
  fill(art, '#f1ead6', { ang: 0, a: 0.4 });
  fill(art, '#9bc4dd', { ang: 0, a: 0.6, af: (x, y) => (y < 98 ? 1 : 0) });
  const sea = poly([[704, 98], [896, 98], [896, 131], [704, 131]]);
  fill(sea, '#3d6fa8', { ang: 0.05, a: 0.7, w: 4 });
  const sun = oval(860, 70, 11, 11);
  fill(sun, '#f7c14b', { a: 0.9 });
  const sail = poly([[780, 58], [780, 96], [752, 96]]), sail2 = poly([[784, 64], [784, 96], [806, 96]]);
  paint(sail, [['#fffaf0', { a: 0.3 }], ['#e7d9c0', { a: 0.4 }]], { inkW: 1.6, lift: 0, edge: false });
  paint(sail2, [['#d9523f', { a: 0.8 }]], { inkW: 1.6, lift: 0, edge: false });
  const hull = poly([[744, 98], [816, 98], [806, 108], [752, 108]]);
  paint(hull, [['#7a4a22', { a: 0.9 }]], { inkW: 1.6, lift: 0.5, edge: false });
  outline(art, '#5b3a1c', { w: 2, a: 0.7 });
}

function floor() {
  const f = poly([[300, 620], [1600, 620], [1600, 1000], [0, 1000], [0, 730]]);
  wax(() => {
    fill(f, '#c07a42', { ang: -0.25, a: 0.55, len: 110 });
    fill(f, '#8d4f2c', { ang: -0.2, a: 0.4, af: (x, y) => 0.3 + (y - 620) / 500 });
  }, 0.92, f);
  fill(f, '#f5c86b', { ang: -0.3, a: 0.6, af: glow(1380, 760, 330, 1.2) });
  fill(f, '#6d5a96', { ang: 0.7, w: 3, gap: 6, a: 0.45, af: (x, y) => Math.max(0, 0.9 - x / 1100) });
  // Boards run toward the vanishing point.
  const t = (1000 - VP[1]) / (620 - VP[1]);
  wax(() => {
    for (let x = 0; x < 1600; x += 78) line([x, 621], [VP[0] + (x - VP[0]) * t, 1000], '#6b3a1f', { w: 2, a: 0.55, wob: 1.2, over: 0 });
  }, 0.92, f);
  line([300, 620], [1600, 620], '#5a3a2a', { w: 2.6, a: 0.6 });
  line([300, 620], [0, 730], '#5a3a2a', { w: 2.6, a: 0.6 });
}

function rug() {
  const outer = poly([[430, 690], [1170, 690], [1330, 930], [270, 930]]);
  const inner = poly([[470, 705], [1130, 705], [1270, 915], [330, 915]]);
  paint(outer, [['#e7b94a', { ang: -0.2, a: 0.7 }], ['#c9722d', { ang: 0.9, a: 0.25 }]], { lift: 0.8 });
  knock(inner, 0.9);
  fill(inner, '#c4413a', { ang: -0.15, a: 0.6 });
  fill(inner, '#8e2a3a', { ang: 0.9, a: 0.3, gap: 5 });
  // A blue border inside, with yellow diamonds along it.
  const band = poly([[512, 722], [1088, 722], [1206, 900], [394, 900]]);
  outline(band, '#3f6fa8', { w: 7, a: 0.95, wob: 1.5 });
  wax(() => {
    for (let k = 0; k < 7; k++) {
      const t = (k + 0.5) / 7;
      for (const [x, y] of [[lerp(492, 374, t), lerp(712, 910, t)], [lerp(1108, 1226, t), lerp(712, 910, t)]]) {
        const d = poly([[x, y - 9], [x + 8, y], [x, y + 9], [x - 8, y]]);
        fill(d, '#f0c64e', { a: 1.2, w: 4, gap: 3 });
      }
    }
  });
  outline(inner, '#6d1f24', { w: 2.4, a: 0.6 });
  // Fringe along the back edge.
  wax(() => { for (let x = 436; x < 1166; x += 9) line([x, 690], [x - 1, 680], '#e7d9b0', { w: 2, a: 0.7, over: 1, wob: 0.3 }); });
}

function sideboard() {
  // Shadow on the wall and floor behind it.
  hatch(poly([[596, 478], [1022, 478], [1030, 640], [590, 640]]), '#4a3160', { a: 0.55 });
  const top = poly([[578, 470], [1022, 470], [1022, 488], [578, 488]]);
  const body = poly([[594, 488], [1006, 488], [1006, 592], [594, 592]]);
  for (const [x0, x1] of [[620, 606], [980, 994], [640, 648], [960, 952]]) {
    const leg = poly([[x0 - 6, 592], [x0 + 6, 592], [x1 + 3, 640], [x1 - 3, 640]]);
    paint(leg, [['#7a3b1c', { ang: -1.3, a: 0.8, w: 4 }]], { inkW: 2.2, edge: false });
  }
  paint(body, [['#b0612f', { ang: -0.1, a: 0.6, len: 120 }], ['#7a3b1c', { ang: -0.05, a: 0.3, len: 140, w: 3 }], ['#f0b45c', { ang: -1.1, a: 0.35, af: (x) => Math.max(0, (x - 800) / 206) }]]);
  paint(top, [['#c87a3e', { ang: 0, a: 0.7, len: 140 }], ['#fad08a', { ang: 0, a: 0.3, len: 140, af: (x) => x / 1100 }]]);
  wax(() => { for (const x of [731, 868]) line([x, 492], [x, 588], INK, { w: 2.4, a: 0.75 }); });
  wax(() => { for (const x of [718, 744, 855, 881]) outline(oval(x, 540, 4, 4), INK, { w: 3, a: 0.9 }); });
  hatch(poly([[594, 488], [1006, 488], [1006, 498], [594, 498]]), '#4a2410', { a: 0.6, ang: 0.3 });
}

function tv() {
  // The lamp throws its shadow on the wall to the left; contact shadow on the sideboard; the walnut cabinet.
  hatch(poly([[622, 290], [652, 278], [652, 470], [614, 470]]), '#4a3160', { a: 0.7, gap: 4 });
  hatch(poly([[646, 464], [962, 464], [966, 474], [642, 474]]), '#3a1d0e', { a: 0.8, gap: 3 });
  const cab = rrect(650, 268, 300, 202, 16);
  paint(cab, [
    ['#8c4a25', { ang: -1.2, a: 0.65 }],
    ['#5e2c14', { ang: -0.05, a: 0.35, w: 3, gap: 5, len: 150 }], // wood grain, laid across
    ['#d98b45', { ang: -1.1, a: 0.5, af: (x, y) => Math.max(0, (x - 760) / 190) * (1 - (y - 268) / 260) }],
  ], { inkW: 3.4, inkA: 0.95 });
  hatch(cab, '#3a1a0c', { a: 0.5, af: (x, y) => Math.max(0, 1 - (x - 650) / 150) });

  // Bezel and bulging screen.
  const bezel = rrect(662, 284, 200, 168, 24);
  paint(bezel, [['#e9d8b4', { ang: -1, a: 0.6 }], ['#8a7a66', { ang: 0.8, a: 0.35 }]], { inkW: 2.6 });
  const s = TV_SCREEN, scr = rrect(s.x, s.y, s.w, s.h, 20);
  paint(scr, [
    ['#5e6769', { ang: -0.95, a: 0.8 }],
    ['#3b4448', { ang: 0.7, a: 0.5, af: (x, y) => 0.4 + Math.hypot((x - 762) / 90, (y - 367) / 68) * 0.8 }],
    ['#26303a', { ang: -0.2, a: 0.45, w: 3, af: (x, y) => Math.max(0, Math.hypot((x - 762) / 90, (y - 367) / 68) - 0.55) * 2 }],
  ], { inkW: 3.2, inkA: 0.95, edge: false, lift: 1 });
  // Glare on the glass and a spark of the lamp.
  const glare = [];
  for (let i = 0; i <= 8; i++) { const t = 3.5 + i * 0.1; glare.push([762 + 72 * Math.cos(t), 367 + 54 * Math.sin(t)]); }
  trail(glare, '#e6eef0', 6, 0.75);
  trail(glare.slice(2, 6).map(([x, y]) => [x + 9, y + 7]), '#e6eef0', 3, 0.5);
  paint(oval(830, 318, 7, 5), [['#f7cf74', { a: 0.9, w: 3, gap: 2 }]], { inkW: 0, edge: false });

  // Control panel: two knobs and a speaker grille.
  for (const { x: kx, y } of TV_KNOBS) {
    const k = oval(kx, y, 17, 17);
    paint(k, [['#efe2c4', { ang: -0.8, a: 0.7 }], ['#a08a68', { ang: 0.8, a: 0.4, af: (x, yy) => Math.max(0, (yy - y + 8) / 20) }]], { inkW: 2.8 });
    line([kx, y], [kx + 10, y - 8], INK, { w: 3, a: 0.9, over: 0 });
  }
  const grille = rrect(876, 396, 56, 58, 5);
  paint(grille, [['#4a2a18', { ang: -1.2, a: 0.8 }]], { inkW: 2.4 });
  wax(() => { for (let y = 404; y < 450; y += 7) line([881, y], [927, y], '#e0c392', { w: 2.8, a: 1.1, over: 1, wob: 0.4 }); });

  // Rabbit ears.
  for (const tip of [[736, 168], [874, 156]]) {
    line([800, 262], tip, '#4c555e', { w: 5, a: 1.1, over: 0, wob: 0.5 });
    line([800, 262], tip, '#c9d2d8', { w: 1.6, a: 0.7, over: 0, wob: 0.5 });
    paint(oval(tip[0], tip[1], 5, 5), [['#8f9aa3', { a: 0.9, w: 3, gap: 2 }]], { inkW: 2 });
  }
  paint(oval(800, 270, 24, 13, Math.PI, TAU), [['#3a3d44', { ang: -0.6, a: 0.8, w: 4 }], ['#9aa4ad', { a: 0.3, w: 3 }]], { inkW: 2.6 });
  // Little feet.
  for (const x of [676, 924]) paint(rrect(x - 10, 466, 20, 8, 3), [['#3a1d0e', { a: 0.8, w: 3 }]], { inkW: 2 });
}

function plant() {
  // Leaves first, pot on top of their stems.
  const leaves = [[-2.4, 150, 0.2], [-2.0, 180, 0.25], [-1.7, 205, 0.22], [-1.35, 190, 0.26], [-1.05, 170, 0.24], [-0.7, 130, 0.22], [-2.75, 120, 0.2], [-1.55, 150, 0.2]];
  const [bx, by] = [262, 632];
  leaves.forEach(([a, L, wd], i) => {
    const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L, nx = -Math.sin(a) * L * wd, ny = Math.cos(a) * L * wd;
    const pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12, s = Math.sin(Math.PI * t) * (1 - 0.3 * t); pts.push([bx + (tx - bx) * t + nx * s, by + (ty - by) * t + ny * s]); }
    for (let k = 11; k > 0; k--) { const t = k / 12, s = Math.sin(Math.PI * t) * (1 - 0.3 * t) * 0.9; pts.push([bx + (tx - bx) * t - nx * s, by + (ty - by) * t - ny * s]); }
    const leaf = region(pts, true), dark = i % 3 === 0;
    paint(leaf, [
      [dark ? '#2f7045' : '#4f9a3e', { ang: a + 1.1, a: 0.7, w: 5, len: 50 }],
      ['#b8d65a', { ang: a + 1.1, a: 0.35, len: 40, af: (x, y) => (dark ? 0.2 : 0.8) }],
      ['#2c4f6a', { ang: a - 0.5, a: 0.35, w: 2.5, gap: 5, len: 40 }],
    ], { ink: '#1f3d24', inkW: 2.4 });
    line([bx, by], [bx + (tx - bx) * 0.85, by + (ty - by) * 0.85], '#1f3d24', { w: 1.8, a: 0.6, over: 0 });
  });
  const pot = poly([[210, 628], [314, 628], [300, 712], [224, 712]]);
  paint(pot, [['#c9623a', { ang: -1.2, a: 0.7 }], ['#7a2e1c', { ang: 0.8, a: 0.4, af: (x) => Math.max(0, 1 - (x - 210) / 70) }], ['#f0a060', { ang: -1.2, a: 0.3, af: (x) => Math.max(0, (x - 262) / 52) }]]);
  const rim = poly([[204, 618], [320, 618], [318, 638], [206, 638]]);
  paint(rim, [['#d9764a', { ang: -0.1, a: 0.75 }]]);
}

function lamp() {
  // Light spilling up and down the wall from the open shade.
  const up = poly([[1322, 254], [1438, 254], [1540, 0], [1220, 0]]);
  fill(up, '#fff0a0', { ang: -1.4, a: 0.6, af: (x, y) => 0.4 + y / 400 });
  const down = poly([[1290, 360], [1470, 360], [1600, 620], [1160, 620]]);
  fill(down, '#ffe68a', { ang: -1.3, a: 0.5, af: (x, y) => 1 - (y - 360) / 330 });
  // Base, pole, shade.
  paint(oval(1380, 760, 56, 14), [['#6b5424', { ang: -0.2, a: 0.8, w: 4 }], ['#e8c46a', { a: 0.4, af: (x) => (x > 1380 ? 1 : 0.2) }]], { inkW: 2.6 });
  line([1380, 756], [1380, 356], '#6b5424', { w: 7, a: 0.9, over: 0, wob: 0.6 });
  line([1383, 740], [1383, 370], '#e8c46a', { w: 2, a: 0.7, over: 0, wob: 0.6 });
  line([1376, 756], [1376, 356], INK, { w: 1.8, a: 0.5, over: 0, wob: 0.6 });
  const shade = poly([[1322, 254], [1438, 254], [1472, 362], [1288, 362]]);
  paint(shade, [
    ['#ffe07e', { ang: -1.35, a: 0.8, len: 60 }],
    ['#f6a64a', { ang: -1.3, a: 0.45, af: (x, y) => 0.2 + Math.abs(x - 1380) / 90 }],
    ['#fff7c8', { ang: -1.35, a: 0.6, af: glow(1380, 320, 70) }],
  ], { ink: '#8a5a1c', inkW: 3 });
  const rimLine = [];
  for (let i = 0; i <= 16; i++) rimLine.push([1288 + i * 11.5, 362 + Math.sin(Math.PI * i / 16) * 7]);
  trail(rimLine, '#8a5a1c', 3, 0.8);
}

function coffeeTable() {
  const top = poly([[590, 720], [1010, 720], [1054, 772], [546, 772]]);
  const edge = poly([[546, 772], [1054, 772], [1054, 788], [546, 788]]);
  for (const [x0, x1] of [[574, 558], [1026, 1042], [640, 632], [960, 968]]) {
    paint(poly([[x0 - 7, 788], [x0 + 7, 788], [x1 + 3, 870], [x1 - 3, 870]]), [['#6d341a', { ang: -1.3, a: 0.8, w: 4 }]], { inkW: 2.2, edge: false });
  }
  paint(edge, [['#6d341a', { ang: 0, a: 0.8, len: 140 }]], { inkW: 2.6 });
  paint(top, [['#b36a36', { ang: -0.1, a: 0.6, len: 140 }], ['#7a3b1c', { ang: -0.05, a: 0.3, w: 3, len: 160 }], ['#f7c878', { ang: -0.2, a: 0.5, af: (x) => Math.max(0, (x - 760) / 300) }]]);
  // The jar's shadow, away from the lamp.
  hatch(poly([[748, 744], [812, 744], [792, 764], [728, 764]]), '#3a1d0e', { a: 0.9, gap: 3 });
}

function jar() {
  const cx = 800, bot = 752, w = 74, h = 94;
  const glass = rrect(cx - w / 2, bot - h, w, h, 14);
  knock(glass, 0.9);
  fill(glass, '#cfe3dc', { ang: -1.2, a: 0.5 });
  fill(glass, '#dbe08a', { ang: -1.2, a: 0.45, af: (x, y) => (y > bot - h + 18 ? 1 : 0) }); // brine
  for (const [dx, dy, r] of [[-16, -28, 0.2], [15, -30, -0.25], [0, -40, 0.05], [-17, -64, -0.15], [16, -66, 0.3], [0, -70, -0.05]]) {
    const p = oval(0, 0, 11, 24);
    const pts = p.pts.map(([x, y]) => [cx + dx + x * Math.cos(r) - y * Math.sin(r), bot + dy + x * Math.sin(r) + y * Math.cos(r)]);
    paint(region(pts, true), [['#4f7f22', { ang: -1.1, a: 0.95, w: 4 }], ['#b6d45a', { ang: -1.1, a: 0.4, w: 3 }]], { ink: '#24400e', inkW: 2.2, lift: 0.5, edge: false });
  }
  fill(glass, '#a9c9bf', { ang: 0.8, a: 0.25, w: 3, gap: 6 });
  trail([[cx - w / 2 + 11, bot - h + 16], [cx - w / 2 + 10, bot - 22]], '#ffffff', 6, 0.9);
  outline(glass, '#3f6f78', { w: 2.6, a: 0.9 });
  const neck = rrect(cx - w / 2 + 6, bot - h - 7, w - 12, 9, 3);
  paint(neck, [['#e1efe9', { a: 0.6, w: 4 }]], { ink: '#3f6f78', inkW: 2.2, edge: false });
  const lid = rrect(cx - w / 2 - 3, bot - h - 24, w + 6, 19, 5);
  paint(lid, [['#e0352c', { ang: -1.2, a: 0.9, w: 5, gap: 3 }], ['#ff8a6a', { ang: -1.2, a: 0.4, af: (x) => Math.max(0, (x - cx) / 30) }]], { ink: '#7a1a14', inkW: 2.6 });
  wax(() => { for (let x = cx - w / 2 + 4; x < cx + w / 2; x += 8) line([x, bot - h - 21], [x, bot - h - 9], '#7a1a14', { w: 1.6, a: 0.6, over: 0, wob: 0.2 }); });
}

function sofa() {
  const body = '#335a8a', layers = hi => [
    [body, { ang: -1.15, a: 0.7, len: 90 }],
    ['#2c7a70', { ang: -0.9, a: 0.35, len: 90 }],
    ['#f2b35a', { ang: -1.2, a: 0.45, af: (x, y) => Math.max(0, (x - 900) / 600) * Math.max(0, 1 - (y - 850) / 60) * hi }],
    ['#28244a', { ang: 0.85, w: 2.4, gap: 6, a: 0.55, bend: 0.03, af: (x, y) => Math.max(0, (y - 890) / 110) + Math.max(0, 0.6 - x / 1600) * 0.6 }],
  ];
  for (const x of [148, 1310]) paint(rrect(x, 880, 142, 160, 46), layers(1.4), { inkW: 3.2 });
  paint(rrect(236, 846, 1128, 220, 44), layers(1), { inkW: 3.4 });
  // Piping along the top and a seam.
  const pipe = [];
  for (let i = 0; i <= 40; i++) pipe.push([262 + i * 27, 862 + Math.sin(i * 0.9) * 0.8]);
  trail(pipe, '#1f2a4a', 2.4, 0.6);
  // A striped throw over the left of the back.
  const thr = poly([[380, 842], [640, 846], [654, 988], [396, 996]]);
  paint(thr, [['#e9c45a', { ang: -1.2, a: 0.7 }], ['#c7862e', { ang: 0.9, a: 0.3 }]]);
  for (let k = 0; k < 5; k++) {
    const x0 = 404 + k * 50, stripe = poly([[x0, 846], [x0 + 20, 846], [x0 + 22 + 4, 994], [x0 + 4, 994]]);
    fill(stripe, '#c4413a', { ang: -1.4, a: 0.75, w: 4 });
  }
  wax(() => { for (let x = 400; x < 656; x += 8) line([x, 994], [x + 1, 1004], '#c7862e', { w: 2, a: 0.8, over: 1, wob: 0.3 }); });
  outline(thr, INK, { w: 3, a: 0.85 });
}

// Draws the room through ctx's current transform, into ctx's whole canvas: the wide view is a 1600 x 1000
// logical sheet scaled up; a close-up is the same sheet translated and zoomed. Only the logical region the
// canvas shows is pressed and stored, so memory follows the canvas size, not the zoom.
export function drawRoom(ctx, w = 1600, h = 1000) {
  seed = 0;
  const m = ctx.getTransform(), k = w / 1600;
  Z = m.a * k; OX = -m.e / Z; OY = -m.f / Z;
  DW = ctx.canvas.width; DH = ctx.canvas.height;
  VX0 = Math.floor(OX); VY0 = Math.floor(OY); VX1 = Math.ceil(OX + DW / Z); VY1 = Math.ceil(OY + DH / Z);
  SX = Math.max(0, VX0 - MARGIN); SY = Math.max(0, VY0 - MARGIN);
  SW = Math.min(1600, VX1 + MARGIN) - SX; SH = Math.min(1000, VY1 + MARGIN) - SY;
  makeGrain();
  const layer = new OffscreenCanvas(DW, DH);
  c = layer.getContext('2d', { willReadFrequently: true });
  c.setTransform(Z, 0, 0, Z, -OX * Z, -OY * Z);
  scratch = new OffscreenCanvas(Math.max(1, SW), Math.max(1, SH)).getContext('2d', { willReadFrequently: true });
  scratch.translate(-SX, -SY);
  up = new OffscreenCanvas(DW, BANDS).getContext('2d', { willReadFrequently: true });
  band = up.createImageData(DW, BANDS);
  for (const part of [walls, windowSky, picture, floor, rug, sideboard, tv, plant, lamp, coffeeTable, jar, sofa]) part();
  onPaper(layer);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
  c = scratch = up = band = G = null;
}

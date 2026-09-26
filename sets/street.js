// A 1930s town street in one-point perspective, rubber hose style: flat greys, one ink weight,
// walls that lean and bulge a little. The road runs from the vanishing point down to the viewer,
// so whatever comes down it is seen growing long before it arrives.
import { drawParts, ell, smooth, qb, wob } from '../lib/anidoodle.js';

export const VP = [180, 200];
const K = 480 - VP[1]; // eye height: the ground at depth z = 1 is the bottom of the frame
// A point on the ground at lateral offset u, depth z; U lifts it by h.
export const G = (u, z) => [VP[0] + u / z, VP[1] + K / z];
export const U = (u, z, h) => [VP[0] + u / z, VP[1] + (K - h) / z];

const C = {
  sky: '#e9e4d8', cloud: '#f6f3ea', far: '#b9b3a7', road: '#8a857b', rail: '#5d5952', walk: '#cbc5b8', curb: '#a39d91',
  wallA: '#bdb7aa', wallB: '#a9a397', wallC: '#d3cdc0', win: '#3a3631', door: '#5d5952', awning: '#6f6a61', lamp: '#34312d',
};
export const ROAD = [-420, 330]; // curbs, in u
const WALL_L = -640, WALL_R = 640;

const quad = (a, b, c, d) => [a, b, c, d];
// A rectangle on a wall at lateral u, from depth z0 to z1, heights h0 to h1.
const wallQuad = (u, z0, z1, h0, h1) => quad(U(u, z0, h0), U(u, z0, h1), U(u, z1, h1), U(u, z1, h0));

// Everything but the sky's clouds is static; `boil` redraws the lines (a new drawing on each twos).
// lampSway: radians the lamp post rocks about its foot (the ground shaking).
export function drawStreet(ctx, { boil = 0, t = 0, ink = 1, lampSway = 0 } = {}) {
  const w = (pts, k) => wob(pts, 1.4, boil * 17 + k);
  const parts = [];

  parts.push({ fills: [{ pts: [[-10, -10], [650, -10], [650, 490], [-10, 490]], col: C.sky }] });
  // Clouds drifting slowly; the only thing in the set that moves on its own.
  for (const [i, [cx, cy, s]] of [[70, 70, 1], [420, 46, 0.8], [270, 120, 0.55]].entries()) {
    const x = cx + t * (4 + i * 2);
    const puffs = [[-30, 4, 20], [-8, -8, 26], [18, -4, 22], [36, 6, 15], [0, 10, 22]].map(([dx, dy, r]) => ell(x + dx * s, cy + dy * s, r * s, r * s * 0.85, 0, 18));
    parts.push({ outline: puffs.map((p, k) => w(p, 300 + i * 10 + k)), ow: 1.6, fills: puffs.map(p => ({ pts: p, col: C.cloud })) });
  }
  // The far end of town, flat against the horizon.
  const skyline = smooth([[60, 200], [60, 176], [92, 170], [100, 150], [112, 170], [150, 166], [160, 140], [176, 136], [190, 142], [200, 164], [236, 160], [244, 176], [290, 180], [296, 200]], false, 4);
  parts.push({ outline: [w(skyline.concat([[296, 204], [60, 204]]), 1)], ow: 1.2, fills: [{ pts: skyline.concat([[296, 204], [60, 204]]), col: C.far }] });

  // Ground: sidewalks, road, curbs.
  const Z0 = 0.5, Z1 = 80;
  const strip = (u0, u1) => [G(u0, Z0), G(u1, Z0), G(u1, Z1), G(u0, Z1)];
  parts.push({ fills: [{ pts: strip(WALL_L, ROAD[0]), col: C.walk }, { pts: strip(ROAD[1], WALL_R), col: C.walk }, { pts: strip(...ROAD), col: C.road }] });
  // Sidewalk slabs and the curb stones: lines across at growing depths.
  const across = [];
  for (let z = 0.7; z < 30; z *= 1.28) {
    across.push({ pts: w([G(WALL_L, z), G(ROAD[0], z)], 400 + z * 10), w: 1.4 });
    across.push({ pts: w([G(ROAD[1], z), G(WALL_R, z)], 500 + z * 10), w: 1.4 });
  }
  parts.push({ details: across });
  // Curbs: a darker band along each side of the road.
  for (const [i, u] of ROAD.entries()) {
    const d = i ? -26 : 26;
    parts.push({ fills: [{ pts: strip(u, u + d), col: C.curb }], details: [{ pts: w([G(u, Z0), G(u, Z1)], 10 + i), w: 2.4 }, { pts: w([G(u + d, Z0), G(u + d, Z1)], 12 + i), w: 1.6 }] });
  }
  // Tram rails down the middle.
  parts.push({ details: [-170, -120, 80, 130].map((u, i) => ({ pts: w([G(u, 0.9), G(u, Z1)], 20 + i), w: 2.2, col: C.rail })) });

  // Walls: a row of house fronts each side, receding.
  for (const [side, u] of [[-1, WALL_L], [1, WALL_R]]) {
    const zs = side < 0 ? [2.2, 3.4, 5, 7.5, 11, 18, 40] : [0.9, 1.6, 2.6, 4, 6.5, 10, 18, 40];
    const tops = side < 0 ? [560, 470, 610, 430, 520, 480] : [620, 560, 450, 600, 470, 540, 480];
    for (let i = 0; i < zs.length - 1; i++) {
      const [z0, z1] = [zs[i], zs[i + 1]], h = tops[i % tops.length], col = [C.wallA, C.wallB, C.wallC][(i + (side > 0)) % 3];
      const face = wallQuad(u, z0, z1, 0, h);
      const d = [];
      // Windows: two storeys, two bays; a door at street level.
      for (const [f0, f1] of [[0.28, 0.42], [0.62, 0.76]]) {
        for (const [b0, b1] of [[0.18, 0.4], [0.6, 0.82]]) {
          const za = z0 + (z1 - z0) * b0, zb = z0 + (z1 - z0) * b1;
          const win = wallQuad(u, za, zb, h * f0, h * f1);
          d.push({ pts: win, col: C.win });
        }
      }
      const zd0 = z0 + (z1 - z0) * 0.42, zd1 = z0 + (z1 - z0) * 0.58;
      d.push({ pts: wallQuad(u, zd0, zd1, 0, Math.min(170, h * 0.22)), col: C.door });
      parts.push({
        outline: [w(face, 600 + side * 50 + i)], ow: 2,
        fills: [{ pts: face, col }, ...d],
        details: d.map((q, k) => ({ pts: w(q.pts, 700 + side * 50 + i * 8 + k), w: 1.6, closed: true })),
      });
      // A scalloped awning over the ground floor of every other house, across the street.
      if (side < 0 && i % 2 === 0) {
        const zA = z0 + (z1 - z0) * 0.12, zB = z0 + (z1 - z0) * 0.88, hA = Math.min(190, h * 0.25);
        const out = side * -70; // sticks out over the sidewalk
        const top = [U(u, zA, hA + 40), U(u, zB, hA + 40)], low = [];
        for (let k = 0; k <= 6; k++) {
          const z = zA + ((zB - zA) * k) / 6;
          low.push(U(u + out, z, hA));
          if (k < 6) { const zm = zA + ((zB - zA) * (k + 0.5)) / 6; low.push(U(u + out, zm, hA - 14)); }
        }
        const aw = [top[0], top[1], ...smooth(low, false, 3).reverse()];
        parts.push({ outline: [w(aw, 800 + side * 50 + i)], ow: 1.8, fills: [{ pts: aw, col: C.awning }] });
      }
    }
  }

  drawParts(ctx, parts, ink);
  drawLamp(ctx, boil, ink, lampSway);
}

// A street lamp across the street, near the curb, bowed like a noodle: out of the way of anyone
// walking down the right sidewalk.
const LAMP = [-470, 3];
function drawLamp(ctx, boil, ink, sway) {
  const w = (pts, k) => wob(pts, 1.4, boil * 17 + k);
  const base = G(...LAMP), k = 1.9 / LAMP[1];
  ctx.save(); ctx.translate(...base); ctx.rotate(sway); ctx.scale(-k, k); ctx.translate(-base[0], -base[1]); // leaning over the road
  const top = [base[0] - 6, base[1] - 250];
  const pole = qb(base, [base[0] + 14, base[1] - 130], top, 16);
  const head = [top[0] - 18, top[1] + 10];
  const shade = smooth([[head[0] - 16, head[1] - 4], [head[0], head[1] - 20], [head[0] + 16, head[1] - 4], [head[0] + 10, head[1] + 4], [head[0] - 10, head[1] + 4]], true, 4);
  drawParts(ctx, [
    { details: [{ pts: w(pole, 900), w: 7 }, { pts: w(qb(top, [top[0] - 4, top[1] - 12], [head[0], head[1] - 14], 8), 901), w: 5 }] },
    { outline: [w(shade, 902)], ow: 1.8, fills: [{ pts: shade, col: C.lamp }, { pts: ell(head[0], head[1] + 6, 7, 5, 0, 12), col: '#f6f3ea' }] },
    { outline: [ell(base[0], base[1], 12, 4, 0, 14)], ow: 1.6, fills: [{ pts: ell(base[0], base[1], 12, 4, 0, 14), col: C.lamp }] },
  ], ink / k);
  ctx.restore();
}


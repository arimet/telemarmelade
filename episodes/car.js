// « 20 s avant que la voiture ne me renverse » — Filou the raccoon, 1930s rubber hose.
// He struts down the street flipping his lucky coin while a jalopy comes down the road behind him.
// draw(ctx, t) is a pure function of t; lines are redrawn 12 times a second (line boil on twos).
//
// The street is one world seen through different cameras. Ground points are (X, Y, h): X across the
// street in the set's u units, Y down it (depth z × FOCAL), h up. The wide camera is the set's own
// projection; closer shots zoom into it, and the close-up and the top view have cameras of their own.
import { W, H, span, bump, ease, keys, lerp, mix2, rand, box } from '../engine.js';
import { FACES, POSES, drawFilou, GREY } from '../characters/filou.js';
import { drawStreet, G, U } from '../sets/street.js';
import { drawCar } from '../props/car.js';
import { INK, GLOVE, STITCH, CUFF_LINE, drawParts, capsule, ell, filmPrint, noodle, place, qb, smooth } from '../lib/anidoodle.js';
import { BLOOD, BLOOD_DARK, blob, puddle, lens } from '../props/gore.js';
import { shape } from '../engine.js';

const drawing = t => Math.floor(t * 12);
const TAU = Math.PI * 2;
const FOCAL = 554; // the wide camera's focal length, in u: one unit of depth z is FOCAL u of street
const CRASH = 18.6;

// --- small 3D helpers ---

const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map(v => v * k);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const MAIN = { proj: ([X, Y, h]) => U(X, Y / FOCAL, h), eye: [0, 0, 280] };

// Wide shots see the world as the set draws it; closer shots zoom on a point of it.
function camera(ctx, [wx, wy], [sx, sy], zoom) {
  ctx.translate(sx, sy); ctx.scale(zoom, zoom); ctx.translate(-wx, -wy);
}

// --- the coin: a real disc, drawn through whichever camera looks at it ---

const COIN_R = 9.2, COIN_FACE = '#e3d9c0', COIN_EDGE = '#9f998d';
// The disc's plane: `tilt` 0 lies flat, π/2 stands on edge; `azim` is the heading of its horizontal diameter.
function coinBasis(tilt, azim) {
  return [[Math.cos(azim), Math.sin(azim), 0], [-Math.sin(azim) * Math.cos(tilt), Math.cos(azim) * Math.cos(tilt), Math.sin(tilt)]];
}
// Both faces, the far one first, so the rim shows between them; `mark` is the embossed profile's angle (it rolls).
function drawDisc(ctx, cam, c, [a, b], { mark, ink = 1, r = COIN_R } = {}) {
  const n = cross(a, b), faces = [1, -1].map(s => add(c, mul(n, s * 0.8)));
  faces.sort((p, q) => dist(q, cam.eye) - dist(p, cam.eye));
  faces.forEach((fc, i) => {
    const at = (ang, k = 1) => cam.proj(add(fc, add(mul(a, r * k * Math.cos(ang)), mul(b, r * k * Math.sin(ang)))));
    const ring = Array.from({ length: 28 }, (_, j) => at((j / 28) * TAU));
    const part = { outline: [ring], ow: 1.3, fills: [{ pts: ring, col: i ? COIN_FACE : COIN_EDGE }], details: [] };
    if (i && mark !== undefined) part.details.push({ pts: [at(mark, 0.15), at(mark, 0.7)], w: 1.1 }, { pts: Array.from({ length: 13 }, (_, j) => at(mark + 1 + j * 0.2, 0.55)), w: 0.9 });
    drawParts(ctx, [part], ink);
  });
}
const coinShadow = (ctx, cam, [X, Y], k = 1) => {
  const ring = Array.from({ length: 20 }, (_, j) => cam.proj([X + COIN_R * k * Math.cos((j / 20) * TAU), Y + COIN_R * k * Math.sin((j / 20) * TAU), 0]));
  drawParts(ctx, [{ fills: [{ pts: ring, col: '#000000', alpha: 0.25 }] }]);
};

// --- Filou's faces: numbers blend, the eye and mouth shapes switch halfway; a swap takes 0.1 s ---

const FACE0 = { gaze: [0, 0], pupil: 1, lid: 0, eye: 1, tilt: 0 };
function mixFace(a, b, k) {
  const out = { ...(k < 0.5 ? a : b) };
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[key] ?? FACE0[key], vb = b[key] ?? FACE0[key];
    if (typeof vb === 'number' && typeof va === 'number') out[key] = lerp(va, vb, k);
    else if (Array.isArray(vb) && Array.isArray(va)) out[key] = mix2(va, vb, k);
  }
  return out;
}
function faceAt(track, t) {
  const i = Math.max(0, track.findLastIndex(([at]) => at <= t));
  const k = ease.out(span(t, track[i][0], track[i][0] + 0.1));
  return mixFace(track[Math.max(0, i - 1)][1], track[i][1], k);
}
const FF = {
  happy: FACES.happy,
  neutral: FACES.neutral,
  startle: { eyes: 'open', gaze: [-0.5, -0.7], pupil: 0.7, lid: 0, eye: 1.2, mouth: 'oh' },
  follow: { eyes: 'open', gaze: [-0.8, 0.9], pupil: 0.9, lid: 0.1, eye: 1.05, mouth: 'oh' },
  chase: { eyes: 'open', gaze: [-1, 0.8], pupil: 1, lid: 0.15, eye: 1, mouth: 'oh', tilt: -0.06 },
  found: { eyes: 'open', gaze: [-0.7, 1], pupil: 1.15, lid: 0.1, eye: 1, mouth: 'smile', tilt: -0.1 },
  proud: { eyes: 'open', gaze: [-0.5, 0.2], pupil: 1.1, lid: 0.2, eye: 1, mouth: 'smile' },
  blow: { eyes: 'open', gaze: [-0.6, 0.4], pupil: 1, lid: 0.3, eye: 1, mouth: 'pucker' },
  rub: { eyes: 'happy', mouth: 'smile' },
  admire: { eyes: 'open', gaze: [-0.7, -0.8], pupil: 1.25, lid: 0, eye: 1.05, mouth: 'grin' },
  vain: { eyes: 'open', gaze: [0, 0.1], pupil: 1.15, lid: 0.25, eye: 1, mouth: 'grin' },
  wink: { eyes: 'wink', gaze: [0, 0.1], pupil: 1.1, mouth: 'grin', tilt: 0.06 },
  kiss: { eyes: 'happy', mouth: 'pucker' },
  glee: { eyes: 'happy', mouth: 'grin', tilt: 0.05 },
  blank: { eyes: 'open', gaze: [0, 0], pupil: 1, lid: 0.15, eye: 1, mouth: 'smile' },
  glance: { eyes: 'open', gaze: [-1, -0.2], pupil: 1, lid: 0.15, eye: 1, mouth: 'smile' },
  blink: { eyes: 'open', gaze: [0, 0], pupil: 1, lid: 1, eye: 1, mouth: 'smile' },
  look: { eyes: 'open', gaze: [-1, -0.3], pupil: 0.8, lid: 0, eye: 1.15, mouth: 'oh' },
  alarm: FACES.alarm,
  dizzy: FACES.dizzy,
};

// Filou standing in the street at ground point (X, z): where he lands on screen, and how to move between
// his local units (feet at the origin, bobbed by `bob`) and the world.
function placed(X, z, bob = 0) {
  const scale = SIZE / z, [gx, gy] = G(X, z);
  return {
    scale, gx, gy, y: gy + bob * scale,
    toScreen: ([px, py]) => [gx + px * scale, gy + (py + bob) * scale],
    // a foot on the ground at (fX, fz), lifted `lift`: its ankle in his local units
    foot: ({ X: fX, z: fz, lift = 0 }) => { const [fx, fy] = G(fX, fz); return [(fx - gx) / scale, (fy - gy) / scale - 14 - lift - bob]; },
  };
}
const inkFor = (scale, zoom) => Math.min(1.2, 0.9 / (scale * zoom));

// A gait over [t0, t1] along `path(t) → [X, z]`, one step every `step` s, the feet taking turns.
// A foot on the ground stays put; a swinging one goes from where it was to where the body will be.
// `from` is where each foot starts. Returns the foot's ground point, lift and toe angle.
function gait(t, side, path, t0, t1, step, from, lift = 14) {
  const off = side * 20 * SIZE, parity = side < 0 ? 0 : 1, start = from[side < 0 ? 'l' : 'r'];
  const plant = n => {
    if (n < 0) return start;
    const [X, z] = path(Math.min(t1, t0 + (n + 0.5) * step));
    return { X: X + off, z };
  };
  if (t <= t0) return { ...start, lift: 0, toe: 0 };
  const N = Math.round((t1 - t0) / step), tt = Math.min(t, t0 + N * step - 1e-6);
  const n = Math.floor((tt - t0) / step);
  if ((((n - parity) % 2) + 2) % 2 === 0) return { ...plant(n), lift: 0, toe: 0 };
  const s = ease.inOut(span(tt, t0 + n * step, t0 + (n + 1) * step)), a = plant(n - 1), b = plant(n + 1);
  return { X: lerp(a.X, b.X, s), z: lerp(a.z, b.z, s), lift: lift * Math.sin(Math.PI * s), toe: 0.4 * Math.sin(Math.PI * s) };
}

// --- shot 1, 0–3 s, wide: Filou struts down the sidewalk towards us, flipping his coin ---

// He walks at a steady pace along the sidewalk; depth z shrinks as he comes nearer.
const WALK_U = 470, Z_START = 2.2, SPEED = 0.3, STEP = 0.5, SIZE = 1.15;
const WALK_END = 3.5; // he stops on a step, to catch the third flip
const bodyZ = t => Z_START - SPEED * Math.min(t, WALK_END);
// Within a step: the body is lowest at the contact, rises through the passing position,
// then drops fast onto the next foot (a strut, not a glide).
const phase = t => ((t % STEP) + STEP) % STEP / STEP;
const bob = t => keys(phase(t), [[0, 0], [0.5, -9, ease.out], [1, 0, ease.in]]);
const bobW = t => (t < WALK_END ? bob(t) : 0);
const squashWalk = t => keys(phase(t), [[0, 0.07], [0.2, 0, ease.out], [0.5, -0.04], [0.85, 0], [1, 0.07, ease.in]]);
// He rolls onto whichever foot is on the ground: the left for even steps, the right for odd ones.
const sway = t => -0.05 * Math.sin((Math.PI * t) / STEP);

// A foot on the ground stays put while the body moves on; a swinging foot travels two half-steps.
function footWorld(t, side) {
  t = Math.min(t, WALK_END);
  const parity = side < 0 ? 0 : 1, k = Math.floor(t / STEP);
  const plant = n => bodyZ(n * STEP) - (SPEED * STEP) / 2;
  let zf = plant(k), lift = 0, toe = 0;
  if ((((k - parity) % 2) + 2) % 2) {
    const s = ease.inOut(span(t, k * STEP, (k + 1) * STEP));
    zf = plant(k - 1) + (plant(k + 1) - plant(k - 1)) * s;
    lift = 16 * Math.sin(Math.PI * s);
    toe = 0.4 * Math.sin(Math.PI * s);
  }
  return { X: WALK_U + side * 20 * SIZE, z: zf, lift, toe };
}
// Returns the ankle in his local units (relative to the body's ground point), and the toe angle.
function foot(t, side) {
  const f = footWorld(t, side), z = bodyZ(t), scale = SIZE / z, [bx, by] = G(WALK_U, z), [fx, fy] = G(f.X, f.z);
  return { at: [(fx - bx) / scale, (fy - by) / scale - 14 - f.lift], toe: f.toe };
}

// The coin flips. Launched from his thumb, it rises about 100 units, above his hat, and falls back into his hand
// exactly one step later, so the walk's bob is at the same point of its cycle for the throw and the catch.
// The third one (shot 2) drifts out and clips his fingertips: he misses it.
const F3 = 3.05;
const FLIPS = [0.9, 2.0, F3];
const GRAV = 2972, LAUNCH = 771, AIR = 0.5; // units/s², units/s, s: rises 100, back to 14 above the thumb at AIR
const MISS = F3 + AIR - 0.02;
const COCKED = [-66, -118], COCKED_ANG = -0.9;
const OPEN_ANG = -0.25; // palm open towards us, fingers up and a little out: ready for the coin
// The fist: dips (anticipation), jerks up on the flick, drifts, opens and snatches up at the coin, sinks with its weight.
const fistY = tau => keys(tau, [[-0.3, 0], [-0.08, 8], [0, -10, ease.out], [0.14, -3], [AIR - 0.14, -2], [AIR, -14, ease.out], [AIR + 0.1, 4], [AIR + 0.32, 0]]);
const fistA = tau => keys(tau, [[-0.3, 0], [-0.08, 0.2], [0.02, -0.45, ease.out], [0.2, -0.1], [AIR - 0.2, 0], [AIR - 0.12, 1.0], [AIR, 0.8], [AIR + 0.12, 0], [AIR + 0.36, 0]]);
const flipAt = t => FLIPS.findLast(f => t >= f - 0.3) ?? FLIPS[0];

// Where the coin sits on his fist (local to the wrist, glove scale 0.52, mirrored).
const ON_FIST = [5, -31];
const onFist = (at, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [at[0] + ON_FIST[0] * c - ON_FIST[1] * s, at[1] + ON_FIST[0] * s + ON_FIST[1] * c];
};

function leftHand(t) {
  const tau = t - flipAt(t);
  const at = [COCKED[0] + keys(tau, [[-0.3, 0], [AIR, 3], [AIR + 0.3, 0]]), COCKED[1] + fistY(tau)];
  const a = COCKED_ANG + fistA(tau);
  const open = tau > AIR - 0.16 && tau < AIR; // the hand opens just before the coin comes down, closes on it
  return { at, a, open };
}

const drift = f => (f === F3 ? -36 : 4); // sideways speed of a throw, units/s
function coinFlight(f, tau) {
  const thrown = leftHand(f), launch = onFist(thrown.at, thrown.a), h = LAUNCH * tau - (GRAV * tau * tau) / 2;
  // In the air it keeps pace with him (it left his hand moving forward with him) but no longer bobs with his body.
  return [launch[0] + drift(f) * tau, launch[1] - h - (bobW(f + tau) - bobW(f))];
}
function coin(t) {
  const f = flipAt(t), tau = t - f;
  if (f === F3 && t >= MISS) return null; // out of his hands for good: shot 2 follows it in the world
  if (tau < 0 || tau >= AIR + 0.4) {
    const { at, a } = leftHand(t);
    return { at: onFist(at, a), spin: null }; // resting on his curled finger
  }
  if (tau >= AIR) return null; // in his closed hand; his thumb sets it back on top
  return { at: coinFlight(f, tau), spin: 40 * tau };
}

function drawCoin(ctx, c, ink) {
  if (!c) return;
  const [x, y] = c.at;
  // Spinning end over end: its face shows, thins to the edge, shows the other face.
  const k = c.spin === null ? c.k ?? 0.3 : Math.cos(c.spin), ry = Math.max(1.6, 8 * Math.abs(k));
  const face = ell(x, y, 8, ry, 0, 20);
  drawParts(ctx, [{ outline: [face], ow: 1.6 * ink, fills: [{ pts: face, col: k >= 0 ? COIN_FACE : '#b9b3a7' }] }]);
}

// Music notes float up off his whistle and fade.
function notes(ctx, mouth, t, scale) {
  for (let i = 0; i < 6; i++) {
    const age = t - (0.25 + 0.55 * i);
    if (age < 0 || age > 1.1) continue;
    const x = mouth[0] + (14 + 30 * age) * scale + 5 * Math.sin(age * 9), y = mouth[1] - (6 + 60 * age) * scale;
    const s = scale * (0.8 + 0.3 * (i % 2));
    ctx.globalAlpha = 1 - span(age, 0.7, 1.1);
    drawParts(ctx, [{ fills: [{ pts: ell(x, y, 6 * s, 4.5 * s, -0.4, 14), col: INK }], details: [
      { pts: [[x + 5 * s, y - 1], [x + 5 * s, y - 24 * s]], w: 2.2 * s },
      { pts: qb([x + 5 * s, y - 24 * s], [x + 14 * s, y - 18 * s], [x + 12 * s, y - 9 * s], 6), w: 2.2 * s },
    ] }]);
    ctx.globalAlpha = 1;
  }
}

// The jalopy. Far off it is a speck; from 3 s it comes on at a steady speed, drifting onto Filou's line.
// z is the depth of its front bumper: at the crash it reaches him.
const FILOU_X = 180, FILOU_Z = 1.45; // where he stands in the road, from shot 2 on
const carZ = t => keys(t, [[0, 60], [3, 24], [CRASH, FILOU_Z]], ease.linear);
const carX = t => keys(t, [[3, 60], [CRASH, FILOU_X - 15]], ease.linear);
const carBounce = t => 3 * Math.abs(Math.sin(t * 11));
function car(ctx, t, { ink = 1, pupil = 1, gaze = [0, 0.3] } = {}) {
  const z = carZ(t), [x, y] = G(carX(t), z), s = 1.1 / z;
  const px = Math.max(s, 0.045); // never smaller than a few pixels: far off it is a dark speck, but a visible one
  for (let i = 0; i < 4; i++) {
    const age = ((t * 2 + i / 4) % 1), r = (30 + 60 * age) * px;
    ctx.globalAlpha = 0.5 * (1 - age);
    drawParts(ctx, [{ fills: [{ pts: ell(x + (i % 2 ? 1 : -1) * 70 * px * (0.5 + age), y - r * 0.6 - age * 20 * px, r, r * 0.8, 0, 14), col: '#9f998d' }] }]);
    ctx.globalAlpha = 1;
  }
  const bounce = carBounce(t);
  if (s < 0.045) {
    const sw = 200 * px, sh = 160 * px, lift = bounce * px * 2;
    drawParts(ctx, [{ fills: [{ pts: ell(x, y - sh / 2 - lift, sw / 2, sh / 2, 0, 16), col: INK }] }]);
    return;
  }
  drawCar(ctx, x, y, s, { bounce, boil: drawing(t), ink: ink / s, pupil, gaze });
}

function shot1(ctx, t) {
  const boil = drawing(t);
  drawStreet(ctx, { boil, t });
  car(ctx, t);

  const z = bodyZ(t), scale = SIZE / z, [gx, gy] = G(WALK_U, z);
  const y = gy + bob(t) * scale;
  const lag = d => sway(t - d) - sway(t);
  const l = foot(t, -1), r = foot(t, 1);
  const hand = leftHand(t);
  // The free arm swings against the legs, a hair behind the body.
  const swing = Math.sin((Math.PI * (t - 0.06)) / STEP);
  const pose = {
    ...POSES.happy,
    lean: sway(t),
    squash: squashWalk(t),
    tilt: lag(0.08) * 1.6,
    headY: (bob(t) - bob(t - 0.05)) * 0.4,
    hatLift: Math.max(0, (bob(t) - bob(t - 0.07)) * 0.5),
    hatTilt: lag(0.14) * 2.2,
    ears: (bob(t) - bob(t - 0.06)) * 0.04,
    tail: 0.25 + sway(t - 0.15) * 4,
    // The body bobs; the feet stay on the ground, so the bob is taken back out of them.
    feet: { l: [l.at[0], l.at[1] - bob(t)], r: [r.at[0], r.at[1] - bob(t)] },
    footAng: { l: l.toe, r: r.toe },
    legBend: { l: 0, r: 0 },
    hands: { l: hand.at, r: [62 + 4 * swing, -86 - 6 * swing] },
    handAng: { l: hand.open ? OPEN_ANG : hand.a, r: -2.6 + 0.25 * swing },
    grip: { l: hand.open ? 'open' : 'fist' },
  };

  // Contact shadow on the sidewalk, flat and without ink.
  drawParts(ctx, [{ fills: [{ pts: ell(gx, gy, 46 * scale, 7 * scale, 0, 20), col: '#000000', alpha: 0.2 }] }]);
  const c = coin(t);
  const toScreen = ([px, py]) => [gx + px * scale, y + py * scale];
  // The coin is behind his fist while it rests there, in front of everything once it flies.
  if (c && c.spin === null) drawCoin(ctx, { ...c, at: toScreen(c.at) }, scale);
  drawFilou(ctx, pose, gx, y, scale, { boil, t });
  if (c && c.spin !== null) drawCoin(ctx, { ...c, at: toScreen(c.at) }, scale);
  notes(ctx, toScreen([8, -166]), t, scale);
}

// --- shot 2, 3–5.5 s, medium: the third flip clips his fingers; the coin rolls off into the road ---

// Where the coin is when it leaves his fingertips, in the world, and how fast it is going.
const LEFT_AT = (() => {
  const [lx, ly] = coinFlight(F3, MISS - F3), tau = MISS - F3;
  return {
    p: [WALK_U + lx * SIZE, bodyZ(WALK_END) * FOCAL, -ly * SIZE],
    // falling fast; knocked outwards (to the road) and a little away by the fingertips
    v: [drift(F3) * SIZE - 110, 25, (LAUNCH - GRAV * tau) * SIZE],
  };
})();
const G_W = GRAV * SIZE; // gravity in world units
const LAND = MISS + (() => { const [, , h] = LEFT_AT.p, vh = LEFT_AT.v[2]; return (vh + Math.sqrt(vh * vh + 2 * G_W * h)) / G_W; })();
const HOP = 0.1; // it lands on its edge and hops once
const ROLL0 = LAND + HOP, ROLL1 = 4.95, FLAT = 5.4;
const REST = [104, FILOU_Z * FOCAL]; // lying flat between the rails of the tram track
// Rolling on its edge it curves the way it leans, and it leans more as it slows: a curve on the ground.
const LANDED = [LEFT_AT.p[0] + LEFT_AT.v[0] * (LAND - MISS), LEFT_AT.p[1] + LEFT_AT.v[1] * (LAND - MISS)];
const HOPPED = [LANDED[0] + LEFT_AT.v[0] * HOP, LANDED[1] + LEFT_AT.v[1] * HOP];
const ROLL_MID = [200, HOPPED[1] + 20];
const rollAt = s => [
  (1 - s) ** 2 * HOPPED[0] + 2 * (1 - s) * s * ROLL_MID[0] + s * s * REST[0],
  (1 - s) ** 2 * HOPPED[1] + 2 * (1 - s) * s * ROLL_MID[1] + s * s * REST[1],
];
const rollDir = s => Math.atan2(2 * (1 - s) * (ROLL_MID[1] - HOPPED[1]) + 2 * s * (REST[1] - ROLL_MID[1]), 2 * (1 - s) * (ROLL_MID[0] - HOPPED[0]) + 2 * s * (REST[0] - ROLL_MID[0]));
const ROLL_LEN = (() => { let d = 0; for (let i = 1; i <= 40; i++) { const a = rollAt((i - 1) / 40), b = rollAt(i / 40); d += Math.hypot(b[0] - a[0], b[1] - a[1]); } return d; })();
const rollS = t => ease.out(span(t, ROLL0, ROLL1)); // rolling friction: a steady deceleration

// The coin in the world from the moment it leaves his hand: centre, plane, embossed mark.
function looseCoin(t) {
  if (t < LAND) {
    const d = t - MISS, [X, Y, h] = LEFT_AT.p, [vx, vy, vh] = LEFT_AT.v;
    return { c: [X + vx * d, Y + vy * d, Math.max(COIN_R, h + vh * d - (G_W * d * d) / 2)], basis: coinBasis(Math.PI / 2 + d * 30, 0.3) };
  }
  if (t < ROLL0) {
    const k = span(t, LAND, ROLL0), [X, Y] = mix2(LANDED, HOPPED, k);
    return { c: [X, Y, COIN_R + 8 * Math.sin(Math.PI * k)], basis: coinBasis(Math.PI / 2 + 0.2 * Math.sin(Math.PI * k), rollDir(0)) };
  }
  const lean = 0.26; // radians past upright, at the end of the roll
  if (t < ROLL1) {
    const s = rollS(t), [X, Y] = rollAt(s), tilt = Math.PI / 2 + lean * s * s;
    // Hopping down off the curb, a step it has to drop.
    const curb = X < 330 && X > 318 ? 3 * Math.sin((Math.PI * (330 - X)) / 12) : 0;
    return { c: [X, Y, COIN_R * Math.sin(tilt) + curb], basis: coinBasis(tilt, rollDir(s)), mark: -(s * ROLL_LEN) / COIN_R };
  }
  // Spinning down: it leans further and further while its lean swings round faster and faster, then lies flat.
  const d = Math.min(t, FLAT) - ROLL1, D = FLAT - ROLL1;
  const tilt = lerp(Math.PI / 2 + lean, Math.PI, ease.in(d / D));
  const azim = rollDir(1) + 6 * d + (40 / (2 * D)) * d * d;
  return { c: [REST[0] + 2 * Math.cos(azim), REST[1] + 2 * Math.sin(azim), COIN_R * Math.abs(Math.sin(tilt)) + 0.8], basis: coinBasis(tilt, azim), mark: -ROLL_LEN / COIN_R };
}

// Filou in shot 2: stops, misses, watches it go, then side-steps after it into the road.
const TROT0 = 3.95, TROT1 = 5.2, TROT_STEP = 0.25;
const START2 = [WALK_U, bodyZ(WALK_END)];
const trotPath = t => mix2(START2, [FILOU_X, FILOU_Z], ease.inOut(span(t, TROT0, TROT1)));
const STAND_FEET = { l: footWorld(WALK_END, -1), r: footWorld(WALK_END, 1) };
const TRACK2 = [[0, FF.happy], [MISS + 0.02, FF.startle], [MISS + 0.2, FF.follow], [TROT0, FF.chase], [FLAT - 0.05, FF.found]];
const trotBob = t => (t > TROT0 && t < TROT1 ? -7 * Math.abs(Math.sin((Math.PI * (t - TROT0)) / TROT_STEP)) : 0);
const lean2 = t => keys(t, [[3, 0], [MISS, 0], [MISS + 0.08, 0.05], [MISS + 0.25, 0], [TROT0, -0.02], [TROT0 + 0.2, -0.2, ease.out], [TROT1 - 0.15, -0.18], [TROT1 + 0.1, -0.02, ease.outBack], [5.5, -0.06]]);
const squash2 = t => keys(t, [[WALK_END, 0.07], [WALK_END + 0.2, 0], [MISS, 0], [MISS + 0.08, -0.07], [MISS + 0.25, 0], [TROT0, 0.06], [TROT0 + 0.2, 0.03], [TROT1, 0.03], [TROT1 + 0.1, 0.08], [TROT1 + 0.3, 0.02]]);

function filou2(t) {
  const walking = t < WALK_END;
  const [X, z] = walking ? [WALK_U, bodyZ(t)] : trotPath(t);
  const b = walking ? bob(t) : trotBob(t);
  const at = placed(X, z, b);
  const l = walking ? footWorld(t, -1) : gait(t, -1, trotPath, TROT0, TROT1, TROT_STEP, STAND_FEET);
  const r = walking ? footWorld(t, 1) : gait(t, 1, trotPath, TROT0, TROT1, TROT_STEP, STAND_FEET);
  const lean = walking ? sway(t) : lean2(t);
  const leanAt = d => (t - d < WALK_END ? sway(t - d) : lean2(t - d));
  const hand = leftHand(Math.min(t, MISS + 0.02));
  const swing = Math.sin((Math.PI * (Math.min(t, WALK_END) - 0.06)) / STEP);
  // After the miss: the empty fist jerks, then both arms go out after the coin, the left one reaching.
  const lk = ease.inOut(span(t, MISS + 0.1, TROT0 + 0.1));
  const reach = mix2([-84, -104], [-80, -70], ease.inOut(span(t, TROT1 - 0.2, FLAT)));
  const left = t < MISS + 0.02 ? hand.at : mix2([hand.at[0], hand.at[1] - 14 * bump(t, MISS, 0.2)], reach, lk);
  const right = mix2([62 + 4 * swing, -86 - 6 * swing], [70, -120], ease.inOut(span(t, MISS + 0.05, TROT0 + 0.2)));
  const f = faceAt(TRACK2, t);
  const pose = {
    ...POSES.happy,
    face: f,
    lean,
    squash: walking ? squashWalk(t) : squash2(t),
    tilt: (leanAt(0.08) - lean) * 1.6 + (t > MISS ? -0.1 : 0),
    headY: (b - (walking ? bob(t - 0.05) : trotBob(t - 0.05))) * 0.4,
    hatLift: Math.max(0, (b - (walking ? bob(t - 0.07) : trotBob(t - 0.07))) * 0.5) + 10 * bump(t, MISS, 0.3),
    hatTilt: (leanAt(0.14) - lean) * 2.2,
    ears: 0.2 * bump(t, MISS, 0.3),
    tail: 0.25 + (leanAt(0.15) - lean) * 4 + leanAt(0.15) * 1.5,
    feet: { l: at.foot(l), r: at.foot(r) },
    footAng: { l: l.toe ?? 0, r: r.toe ?? 0 },
    legBend: { l: 0, r: 0 },
    hands: { l: left, r: right },
    handAng: { l: t < MISS + 0.02 ? (hand.open ? OPEN_ANG : hand.a) : lerp(OPEN_ANG, -2.2, lk), r: lerp(-2.6, -1.6, ease.inOut(span(t, MISS, TROT0))) },
    grip: { l: t < MISS + 0.02 ? (hand.open ? 'open' : 'fist') : (t < MISS + 0.15 ? 'fist' : 'open') },
  };
  return { at, pose, walking, X, z };
}

// The camera pans with him as he side-steps after the coin.
const CAM2 = t => [[keys(t, [[3, 450], [TROT0, 445], [TROT1 + 0.1, 330]]), 320], [320, 250], 1.3];
function shot2(ctx, t) {
  const boil = drawing(t), zoom = CAM2(t)[2];
  camera(ctx, ...CAM2(t));
  drawStreet(ctx, { boil, t, ink: 1 / zoom });
  car(ctx, t, { ink: 1 / zoom });

  const { at, pose, walking } = filou2(t);
  const ink = inkFor(at.scale, zoom);
  drawParts(ctx, [{ fills: [{ pts: ell(at.gx, at.gy, 46 * at.scale, 7 * at.scale, 0, 20), col: '#000000', alpha: 0.2 }] }]);
  // Before it leaves his hand the coin is drawn in his own units, as in shot 1; after, in the world.
  const loose = t >= MISS ? looseCoin(t) : null;
  const behind = loose && loose.c[1] / FOCAL > filou2(t).z; // farther down the street than he is
  if (loose) {
    if (loose.c[2] > COIN_R + 1) coinShadow(ctx, MAIN, loose.c, 1 - Math.min(0.5, loose.c[2] / 500));
    if (behind) drawDisc(ctx, MAIN, loose.c, loose.basis, { mark: loose.mark, ink: 1 / zoom });
  }
  const c = coin(t);
  if (c && c.spin === null) drawCoin(ctx, { ...c, at: at.toScreen(c.at) }, at.scale * ink);
  drawFilou(ctx, pose, at.gx, at.y, at.scale, { boil, t, ink });
  if (c && c.spin !== null) drawCoin(ctx, { ...c, at: at.toScreen(c.at) }, at.scale * ink);
  if (loose && !behind) drawDisc(ctx, MAIN, loose.c, loose.basis, { mark: loose.mark, ink: 1 / zoom });
  if (walking || t < MISS) notes(ctx, at.toScreen([8, -166]), t, at.scale);
}

// --- shot 3, 5.5–9 s, close-up at pavement level: picking up a flat coin with gloved fingers ---

// A low camera behind the coin and to its left, looking down the road the way the wide shot does. Seen from the
// side of the groove, not straight along it, a coin tipping into the groove shows its face. The lens is shifted
// (vanishing point near the left edge) so the coin still sits in the middle of the frame.
const LOW = { X: REST[0] - 60, Y: REST[1] - 150, h: 45, hor: 150, cx: 90 };
LOW.eye = [LOW.X, LOW.Y, LOW.h];
LOW.proj = ([X, Y, h]) => { const d = Math.max(1, Y - LOW.Y); return [LOW.cx + (FOCAL * (X - LOW.X)) / d, LOW.hor + (FOCAL * (LOW.h - h)) / d]; };
LOW.scale = Y => FOCAL / Math.max(1, Y - LOW.Y);

// The right-hand track: two grooved rails; the groove runs along the inside of each rail head.
const RAILS = [{ head: [72, 80], groove: [80, 92] }, { head: [130, 138], groove: [118, 130] }];
const GROOVE_EDGE = 118, GROOVE_DEPTH = 10;
const SLIDE_TO = GROOVE_EDGE + 1.6; // just past the edge: more than half of it hangs over the groove

function lowStreet(ctx, t, boil) {
  const P = LOW.proj, far = 30000;
  const quad = (x0, x1, y0, y1, h0 = 0, h1 = 0) => [P([x0, y0, h0]), P([x1, y0, h1]), P([x1, y1, h1]), P([x0, y1, h0])];
  const parts = [{ fills: [{ pts: [[-10, -10], [650, -10], [650, LOW.hor + 2], [-10, LOW.hor + 2]], col: '#e9e4d8' }] }];
  // Far houses on both sides, walls receding to the vanishing point.
  for (const [side, X] of [[-1, -640], [1, 640]]) {
    for (let i = 0; i < 7; i++) {
      const y0 = 1400 * 1.55 ** i, y1 = 1400 * 1.55 ** (i + 1), h = [520, 430, 600, 470, 540, 450, 500][i];
      const face = [P([X, y0, 0]), P([X, y0, h]), P([X, y1, h]), P([X, y1, 0])];
      parts.push({ outline: [face], ow: 1.2, fills: [{ pts: face, col: ['#bdb7aa', '#a9a397', '#d3cdc0'][(i + (side > 0)) % 3] }] });
    }
  }
  parts.push({ fills: [{ pts: [[-10, LOW.hor], [650, LOW.hor], [650, 490], [-10, 490]], col: '#8a857b' }] });
  // Sidewalks beyond the curbs.
  parts.push({ fills: [{ pts: quad(330, 640, LOW.Y + 20, far), col: '#cbc5b8' }, { pts: quad(-640, -420, LOW.Y + 20, far), col: '#cbc5b8' }], details: [330, -420].map(X => ({ pts: [P([X, LOW.Y + 20, 0]), P([X, far, 0])], w: 1.6 })) });
  // Seams in the road surface, closer together as they recede.
  const seams = [];
  for (let k = 0; k < 14; k++) { const Y = LOW.Y + 30 + 18 * 1.45 ** k; seams.push({ pts: [P([-420, Y, 0]), P([330, Y, 0])], w: 0.9, col: '#6f6a61' }); }
  parts.push({ details: seams });
  // Rails: every track, the near one in detail.
  for (const [off, fine] of [[-250, false], [0, true]]) {
    for (const { head, groove } of RAILS) {
      parts.push({
        fills: [{ pts: quad(groove[0] + off, groove[1] + off, LOW.Y + 5, far), col: '#34312d' }, { pts: quad(head[0] + off, head[1] + off, LOW.Y + 5, far), col: '#c9c3b6' }],
        details: [groove[0], groove[1], head[1]].map(X => ({ pts: [P([X + off, LOW.Y + 5, 0]), P([X + off, far, 0])], w: fine ? 1.8 : 1 })),
      });
    }
  }
  // A few pebbles on the road, for scale.
  for (let i = 0; i < 9; i++) {
    const X = 20 + rand(i + 3) * 190, Y = LOW.Y + 40 + rand(i + 30) * 160, r = 1 + rand(i + 60) * 1.4;
    if (X > 70 && X < 140) continue;
    const pts = Array.from({ length: 10 }, (_, j) => P([X + r * Math.cos((j / 10) * TAU), Y + r * Math.sin((j / 10) * TAU), 0.5]));
    parts.push({ outline: [pts], ow: 0.8, fills: [{ pts, col: '#a39d91' }] });
  }
  drawParts(ctx, parts);
  // The jalopy, far down the road, bouncing: it is getting bigger.
  const Y = carZ(t) * FOCAL, [x, y] = P([carX(t), Y, 0]), s = 1.1 * LOW.scale(Y);
  drawCar(ctx, x, y, s, { bounce: carBounce(t), boil, ink: 0.8 / s });
}

// A glove in close-up, in screen pixels: `k` px per glove unit, wrist at `at`, turned `ang` (0: fingers up).
// 'pinch' brings thumb and forefinger together as `gap` goes 1 → 0; 'point' sticks the forefinger out.
const PALM = smooth([[-19, -8], [-22, -30], [-17, -50], [0, -54], [16, -50], [21, -30], [18, -8]], true, 5);
const CURLED = [capsule([9, -48], [12, -58], 7), capsule([15, -44], [19, -53], 6.5)];
const tipsLocal = (kind, gap) => ({
  thumbTip: kind === 'point' ? [-12, -52] : mix2([-3, -84], [-30, -70], gap),
  indexTip: kind === 'point' ? [3, -96] : mix2([1, -88], [14, -88], gap),
});
// Where the working fingertip(s) end up relative to the wrist: the forefinger's tip, or the middle of a pinch.
function gloveReach(kind, gap, k, ang) {
  const { thumbTip, indexTip } = tipsLocal(kind, gap), P = p => place([p], [0, 0], ang, k, k)[0];
  return kind === 'point' ? P(indexTip) : mix2(P(thumbTip), P(indexTip), 0.5);
}
function closeGlove(ctx, at, ang, k, { kind = 'pinch', gap = 1 } = {}) {
  const { thumbTip, indexTip } = tipsLocal(kind, gap);
  const pieces = [PALM, ...CURLED, capsule([3, -48], indexTip, 7.9), capsule([-15, -24], thumbTip, 7.6), GLOVE[5]];
  const P = pts => place(place(pts, [0, 0], 0, k, k), at, ang);
  drawParts(ctx, [{
    outline: pieces.map(P), ow: 2.4, fills: pieces.map(p => ({ pts: P(p), col: GREY.white })),
    details: [...STITCH.map(s => ({ pts: P(s.map(([x, y]) => [x + 2, y + 4])), w: 1.8 })), { pts: P(CUFF_LINE), w: 1.8 }],
  }]);
  // Where the fingertips are, on screen.
  return { thumb: P([thumbTip])[0], index: P([indexTip])[0] };
}
// The arm, a thick noodle from out of frame (he stands to the right of the coin) down to the wrist.
function closeArm(ctx, wrist, k) {
  drawParts(ctx, [{ details: [{ pts: noodle([wrist[0] + 220, -90], wrist, -40), w: 8 * k * 0.9 * 1.15 }] }]);
}

// The coin in shot 3, in the world: flat, then slid to the groove, tipped into it, pinched and lifted.
const S3 = 5.5;
const SLIDE = [S3 + 1.85, S3 + 2.62];
const TIP = [SLIDE[1], SLIDE[1] + 0.14];
const PICK = S3 + 3.05, GONE = S3 + 3.5;
const TIP_ANGLE = 0.95; // it wedges in the groove: the far side down in it, the near side up
function coin3(t) {
  const X = lerp(REST[0], SLIDE_TO, ease.inOut(span(t, ...SLIDE)));
  if (t < TIP[0]) return { c: [X, REST[1], 0.8], basis: coinBasis(0, 0) };
  // Tipping about the groove's edge: the centre goes round the edge, the right side down into the groove.
  const a = TIP_ANGLE * ease.in(span(t, ...TIP)) * (1 - ease.out(span(t, PICK, PICK + 0.2)) * 0.25);
  const off = SLIDE_TO - GROOVE_EDGE;
  let c = [GROOVE_EDGE + off * Math.cos(a), REST[1], 0.8 - off * Math.sin(a)];
  let basis = [[Math.cos(-a), 0, Math.sin(-a)], [0, 1, 0]];
  if (t > PICK) {
    // Pinched by its raised edge and lifted: it swings to hang from his fingers.
    const lift = 420 * ease.in(span(t, PICK + 0.05, GONE));
    const hang = lerp(a, Math.PI / 2, ease.out(span(t, PICK, PICK + 0.25)));
    const edge = [GROOVE_EDGE - (COIN_R - off) * Math.cos(a), REST[1], 0.8 + (COIN_R - off) * Math.sin(a) + lift];
    c = [edge[0] + COIN_R * Math.cos(hang), REST[1], edge[2] - COIN_R * Math.sin(hang)];
    basis = [[Math.cos(-hang), 0, Math.sin(-hang)], [0, 1, 0]];
  }
  return { c, basis };
}
// The coin's raised edge while it is tipped (where the fingers take it).
const raisedEdge = t => { const { c, basis: [a] } = coin3(t); return add(c, mul(a, -COIN_R)); };

function shot3(ctx, t) {
  const boil = drawing(t), tau = t - S3, P = LOW.proj;
  lowStreet(ctx, t, boil);
  const coinNow = coin3(t);
  const centre = P(coinNow.c), k = 0.598 * LOW.scale(REST[1]);
  const ground = P([REST[0], REST[1], 0]);
  const rimL = P([coinNow.c[0] - COIN_R, REST[1], 0]), rimR = P([coinNow.c[0] + COIN_R, REST[1], 0]);
  drawDisc(ctx, LOW, coinNow.c, coinNow.basis);

  // The hand: two pinches that slide off, a think, a push with one finger, the pinch that works.
  // Pinch targets: fingertips on the rims (open), meeting over the middle (closed).
  const tryPinch = (t0) => {
    const d = t - t0;
    return { down: keys(d, [[0, -40], [0.12, 0, ease.out], [0.36, 0], [0.5, -34, ease.out]]), gap: keys(d, [[0.1, 1], [0.34, 0.05, ease.inOut]]) };
  };
  let kind = 'pinch', gap = 1, target = [ground[0], ground[1]], wristDown = -260;
  let mid = [(rimL[0] + rimR[0]) / 2, ground[1]];
  if (tau < 0.35) {
    wristDown = keys(tau, [[0, -330], [0.3, -40, ease.out]]);
  } else if (tau < 0.8) {
    const p = tryPinch(S3 + 0.35); wristDown = p.down; gap = p.gap;
  } else if (tau < 1.3) {
    const p = tryPinch(S3 + 0.8); wristDown = p.down; gap = p.gap;
  } else if (tau < 1.85) {
    // Thinking: the forefinger taps the road twice, then comes to rest on the coin, near its left rim.
    kind = 'point';
    const taps = -18 * (1 - bump(tau, 1.42, 0.14) - bump(tau, 1.58, 0.14));
    mid = mix2([rimL[0] - 30, ground[1] + 6], [lerp(rimL[0], centre[0], 0.35), ground[1]], ease.inOut(span(tau, 1.7, 1.85)));
    wristDown = tau < 1.7 ? taps : keys(tau, [[1.7, -18], [1.85, 0]]);
  } else if (tau < 2.75) {
    // Pushing: the fingertip presses on the coin and drags it; the coin goes with it.
    kind = 'point';
    mid = [lerp(rimL[0], centre[0], 0.35), ground[1]];
    wristDown = tau > 2.62 ? keys(tau, [[2.62, 0], [2.75, -26, ease.out]]) : 0;
  } else {
    // The coin is tipped: the raised edge sticks up; thumb and forefinger close on it and lift.
    const edge = P(raisedEdge(Math.min(t, PICK)));
    mid = [edge[0] + 4, edge[1]];
    gap = keys(tau, [[2.75, 1], [2.95, 0.5], [3.05, 0.12, ease.in]]);
    wristDown = keys(tau, [[2.75, -40], [2.95, 0, ease.out]]);
    if (t > PICK) { const e = P(raisedEdge(t)); mid = [e[0] + 4, e[1]]; wristDown = 0; } // the hand carries the coin up
  }
  // Place the wrist so the fingertips land on the target. The hand comes from the upper right, fingers down and in.
  const ang = Math.PI + (kind === 'point' ? 0.3 : 0.42) + 0.04 * Math.sin(tau * 3);
  const reach = gloveReach(kind, gap, k, ang);
  const wrist = [mid[0] - reach[0], mid[1] - reach[1] + wristDown];
  closeArm(ctx, wrist, k);
  closeGlove(ctx, wrist, ang, k, { kind, gap });
  // Squeaks of glove on metal as the pinches slide off: little motion ticks at the fingertips.
  for (const at of [S3 + 0.6, S3 + 1.05]) {
    const e = span(t, at, at + 0.15);
    if (e <= 0 || e >= 1) continue;
    ctx.globalAlpha = 1 - e;
    drawParts(ctx, [{ details: [-1, 1].map(s => ({ pts: [[mid[0] + s * (14 + 10 * e), mid[1] - 20], [mid[0] + s * (26 + 12 * e), mid[1] - 34]], w: 2.2 })) }]);
    ctx.globalAlpha = 1;
  }
}

// --- shot 4, 9–11.5 s, medium: he straightens up, blows on the coin, rubs it, it shines. A cat sees the car ---

const S4 = 9;
const CAM4 = [[300, 300], [320, 250], 1.5];
const TRACK4 = [[S4, FF.found], [S4 + 0.3, FF.proud], [S4 + 0.55, FF.blow], [S4 + 1.0, FF.rub], [S4 + 1.9, FF.admire]];
const RUB = [S4 + 1.0, S4 + 1.85];
function filou4(t) {
  const tau = t - S4;
  const stand = ease.outBack(span(tau, 0, 0.4));
  const inhale = bump(tau, 0.5, 0.3), blowing = span(tau, 0.65, 0.95) > 0 && tau < 0.95;
  const rubbing = t > RUB[0] && t < RUB[1];
  const ang = (t - RUB[0]) * TAU * 4.5;
  let left = mix2([-72, -64], [-30, -150], ease.inOut(span(tau, 0.1, 0.5)));
  left = mix2(left, [-8, -86], ease.inOut(span(tau, 0.95, 1.1)));
  if (rubbing) left = [left[0] + 9 * Math.cos(ang), left[1] + 6 * Math.sin(ang)];
  left = mix2(left, [-48, -186], ease.outBack(span(tau, 1.85, 2.1)));
  const lean = lerp(-0.1, 0, stand) + (rubbing ? 0.03 * Math.sin(ang) : 0) - 0.04 * span(tau, 1.85, 2.1);
  const f = faceAt(TRACK4, t);
  return {
    ...POSES.happy, face: f,
    lean,
    squash: lerp(0.14, 0, stand) - 0.05 * inhale + (blowing ? 0.02 : 0),
    tilt: -0.08 * (1 - stand) + (rubbing ? -0.06 : 0) + 0.06 * span(tau, 1.85, 2.1),
    headY: 3 * inhale,
    hatTilt: 0.1 * (1 - stand), ears: 0.1 * inhale,
    tail: 0.25 + 0.2 * Math.sin(t * 5),
    feet: { l: [-24, -14], r: [24, -14] }, footAng: {}, legBend: {},
    hands: { l: left, r: rubbing ? [36, -96] : mix2([64, -90], [56, -100], stand) },
    handAng: { l: -0.6, r: rubbing ? -1.9 : -2.4 },
    grip: { l: 'fist' },
    blow: blowing,
  };
}
// The breath cloud, from his mouth to the coin.
function breathCloud(ctx, from, to, k, s) {
  if (k <= 0 || k >= 1) return;
  ctx.globalAlpha = 0.8 * (1 - k);
  for (let i = 0; i < 3; i++) {
    const p = mix2(from, to, Math.min(1, k * 1.4 - i * 0.15)), r = (4 + 6 * k + i * 2) * s;
    drawParts(ctx, [{ outline: [ell(p[0], p[1], r, r * 0.8, 0, 14)], ow: 0.8, fills: [{ pts: ell(p[0], p[1], r, r * 0.8, 0, 14), col: '#f6f3ea' }] }], s);
  }
  ctx.globalAlpha = 1;
}
function sparkle(ctx, x, y, k, s) {
  if (k <= 0 || k >= 1) return;
  const r = 14 * s * Math.sin(Math.PI * k);
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, d = i % 2 ? r * 0.3 : r; pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]); }
  drawParts(ctx, [{ outline: [pts], ow: 1.2, fills: [{ pts, col: '#ffffff' }] }]);
}

// A white alley cat on a window sill across the way, the first to notice the car.
const CAT = { X: 640, z: 2.31, h: 157 }; // on the sill of a first-floor window, right-hand houses
const CAT_SEE = S4 + 1.1, CAT_JUMP = S4 + 1.35;
function cat(ctx, t, ink) {
  const [bx, by] = U(CAT.X - 16, CAT.z, CAT.h), s = 1.15 / CAT.z;
  // The sill it sits on, sticking out of the wall.
  const sill = [U(CAT.X, CAT.z - 0.1, CAT.h), U(CAT.X - 24, CAT.z - 0.1, CAT.h), U(CAT.X - 24, CAT.z + 0.1, CAT.h), U(CAT.X, CAT.z + 0.1, CAT.h)];
  const sillFace = [sill[1], sill[2], [sill[2][0], sill[2][1] + 6 * s], [sill[1][0], sill[1][1] + 6 * s]];
  drawParts(ctx, [{ outline: [sill, sillFace], ow: 1.4, fills: [{ pts: sill, col: '#e9e4d8' }, { pts: sillFace, col: '#a9a397' }] }], ink);
  if (t > CAT_JUMP + 0.3) return;
  const scared = span(t, CAT_SEE, CAT_SEE + 0.08);
  const j = span(t, CAT_JUMP, CAT_JUMP + 0.3);
  // The leap: a quick arc away along the wall, out of the frame; it stretches out as it goes.
  const x = bx + 520 * s * j, y = by - s * (140 * j - 60 * j * j);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 + 0.5 * j), s * (1 - 0.3 * j)); ctx.rotate(0.3 * j);
  const fur = scared ? 7 : 0;
  const body = smooth([[-22, 0], [-26, -30], [-12, -52], [12, -52], [24, -30], [22, 0]], true, 5);
  const bodyUp = scared ? place(body, [0, 0], 0, 1.05, 1.25) : body;
  const spiky = bodyUp.map(([px, py], i) => [px + (i % 2 ? fur : 0) * Math.sign(px), py - (i % 2 ? fur : 0)]);
  const head = [-6, -66 - 16 * scared];
  const parts = [
    { outline: [qb([18, -6], [48, -20], [40, -60 - 30 * scared], 10).map(p => p)], ow: 0 },
    { details: [{ pts: qb([18, -6], [48, -20], [40, -60 - 30 * scared], 10), w: 8 + 4 * scared }, { pts: qb([18, -6], [48, -20], [40, -60 - 30 * scared], 10), w: 5, col: '#d8d3c7' }] },
    { outline: [spiky], ow: 2.4, fills: [{ pts: spiky, col: '#e9e4d8' }] },
    { outline: [ell(...head, 20, 17, 0, 20), [[head[0] - 18, head[1] - 6], [head[0] - 12, head[1] - 30], [head[0] - 2, head[1] - 12]], [[head[0] + 4, head[1] - 12], [head[0] + 14, head[1] - 30], [head[0] + 18, head[1] - 6]]], ow: 2.4,
      fills: [{ pts: ell(...head, 20, 17, 0, 20), col: '#e9e4d8' }, { pts: [[head[0] - 18, head[1] - 6], [head[0] - 12, head[1] - 30], [head[0] - 2, head[1] - 12]], col: '#4d4a45' }, { pts: [[head[0] + 4, head[1] - 12], [head[0] + 14, head[1] - 30], [head[0] + 18, head[1] - 6]], col: '#4d4a45' }] },
  ];
  // Eyes on the street: looking up the road towards the car, and popping when it sees it.
  for (const ex of [-9, 3]) {
    const e = ell(head[0] + ex, head[1] - 2, 5 + 2 * scared, 7 + 3 * scared, 0, 14);
    parts.push({ outline: [e], ow: 1.4, fills: [{ pts: e, col: '#ffffff' }, { pts: ell(head[0] + ex - 2, head[1] - 3, 2.4 - scared, 3.4 - scared, 0, 10), col: INK }] });
  }
  drawParts(ctx, parts, ink / s);
  ctx.restore();
}

function shot4(ctx, t) {
  const boil = drawing(t), zoom = CAM4[2], tau = t - S4;
  camera(ctx, ...CAM4);
  drawStreet(ctx, { boil, t, ink: 1 / zoom });
  car(ctx, t, { ink: 1 / zoom });
  cat(ctx, t, 1 / zoom);
  const at = placed(FILOU_X, FILOU_Z), pose = filou4(t), ink = inkFor(at.scale, zoom);
  drawParts(ctx, [{ fills: [{ pts: ell(at.gx, at.gy, 46 * at.scale, 7 * at.scale, 0, 20), col: '#000000', alpha: 0.2 }] }]);
  const rubbing = t > RUB[0] && t < RUB[1];
  const coinAt = at.toScreen(onFist(pose.hands.l, pose.handAng.l));
  // Rubbing, the coin is in his fist against his belly; otherwise it shows above his curled finger.
  if (!rubbing && tau > 0.05) drawCoin(ctx, { at: coinAt, spin: null }, at.scale * ink);
  drawFilou(ctx, pose, at.gx, at.y, at.scale, { boil, t, ink });
  if (tau > 0.6 && tau < 0.95) {
    // Fogged by his breath.
    ctx.globalAlpha = 0.6 * bump(tau, 0.65, 0.5);
    drawParts(ctx, [{ fills: [{ pts: ell(coinAt[0], coinAt[1], 8 * at.scale, 3 * at.scale, 0, 14), col: '#f6f3ea' }] }]);
    ctx.globalAlpha = 1;
  }
  breathCloud(ctx, at.toScreen([4, -164]), coinAt, span(tau, 0.65, 0.95), at.scale);
  sparkle(ctx, coinAt[0] + 5 * at.scale, coinAt[1] - 6 * at.scale, span(tau, 1.95, 2.35), at.scale);
}

// --- shot 5, 11.5–14.5 s, his point of view: the coin as a mirror. He admires himself; the car grows behind him ---

const S5 = 11.5;
const MIRROR = [322, 232], MIRROR_R = 172;
const TRACK5 = [[S5, FF.vain], [S5 + 1.7, FF.wink], [S5 + 2.05, FF.vain]];
function shot5(ctx, t) {
  const boil = drawing(t), tau = t - S5;
  const rise = ease.out(span(tau, 0, 0.35));
  const [mx, my] = [MIRROR[0] + 2 * Math.sin(t * 5), MIRROR[1] + (1 - rise) * 420 + 1.5 * Math.sin(t * 7)];
  // Behind the coin: the street the other way, out of focus.
  drawStreet(ctx, { boil, t });
  ctx.fillStyle = 'rgba(203,197,184,0.75)'; ctx.fillRect(0, 0, W, H);

  // The hand holding it (his right, the coin hand all along: bottom right from where he looks), behind the coin,
  // fingers reaching round its rim.
  const k = 3.2;
  const gloveAt = [mx + 150, my + 185];
  const G1 = GLOVE.map(p => place(place(p, [0, 0], 0, k, k), gloveAt, -0.55));
  drawParts(ctx, [{ details: [{ pts: noodle([gloveAt[0] + 120, 520], gloveAt, -30), w: 40 }] }]);
  drawParts(ctx, [{ outline: G1, ow: 2.4, fills: G1.map(p => ({ pts: p, col: GREY.white })) }]);

  // The coin: milled rim, polished face.
  const rimPts = Array.from({ length: 90 }, (_, i) => { const a = (i / 90) * TAU, r = MIRROR_R + 10 + (i % 2 ? 2.5 : 0); return [mx + Math.cos(a) * r, my + Math.sin(a) * r]; });
  drawParts(ctx, [{ outline: [rimPts], ow: 2.4, fills: [{ pts: rimPts, col: '#c9bf9f' }] }]);

  ctx.save();
  ctx.beginPath(); ctx.arc(mx, my, MIRROR_R, 0, TAU); ctx.clip();
  // The reflection: what is behind him, left and right swapped, and him in front of it.
  ctx.save();
  ctx.translate(mx, my); ctx.scale(-1, 1); ctx.translate(-mx, -my);
  ctx.save();
  camera(ctx, [230, 225], [mx, my - 30], 1.9);
  drawStreet(ctx, { boil, t, ink: 1 / 1.9 });
  // Seen from the coin, a little way in front of him: the car is that much nearer than from the wide camera.
  const zc = carZ(t) - 1.15, [cx, cy] = G(carX(t), zc), cs = 1.1 / zc;
  drawCar(ctx, cx, cy, cs, { bounce: carBounce(t), boil, ink: 1 / (1.9 * cs), gaze: [0.3, 0.4] });
  ctx.restore();
  // Filou's head and shoulders, close to the coin: big, low and to one side of it, so the road shows past his ear.
  const f = faceAt(TRACK5, t);
  const pat = bump(tau, 0.35, 0.25) + bump(tau, 0.62, 0.25);
  const hatHold = span(tau, 0.95, 1.1) > 0 && tau < 1.65;
  const hatTilt = keys(tau, [[1.05, 0], [1.35, -0.3, ease.out], [1.5, -0.2], [1.65, -0.24]]);
  // His free hand pats the fur of his cheek, then takes the hat brim and sets it at a jauntier angle.
  const hand = tau < 0.95 ? mix2([66, -80], [52, -146 + 6 * pat], ease.inOut(span(tau, 0.25, 0.4)) * (1 - ease.inOut(span(tau, 0.85, 0.95))))
    : tau < 1.7 ? mix2([66, -80], [22 + 20 * hatTilt, -258], ease.inOut(span(tau, 0.95, 1.1)) * (1 - ease.inOut(span(tau, 1.6, 1.75)))) : [66, -80];
  const pose = {
    ...POSES.happy, face: f, lean: 0, squash: 0, tilt: 0.05 * Math.sin(tau * 2) - 0.08 * pat,
    hatTilt: hatHold || tau >= 1.65 ? hatTilt : 0, ears: 0,
    hands: { l: [-40, -40], r: hand }, handAng: { l: 0, r: hatHold ? -0.2 : -0.5 }, bend: { l: 0, r: -10 },
    feet: { l: [-20, -14], r: [20, -14] }, footAng: {}, legBend: {}, grip: {}, tail: 0,
  };
  drawFilou(ctx, pose, mx + 78, my + 352, 1.75, { boil, t, ink: 0.55 });
  ctx.restore();
  // Polished metal: a warm tint, and the sheen across it.
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#e8dcc0'; ctx.fillRect(mx - MIRROR_R, my - MIRROR_R, MIRROR_R * 2, MIRROR_R * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#ffffff';
  for (const [o, wd] of [[-60, 34], [10, 14]]) { ctx.beginPath(); ctx.moveTo(mx + o - 200, my + 200); ctx.lineTo(mx + o - 200 + wd, my + 200); ctx.lineTo(mx + o + 200 + wd, my - 200); ctx.lineTo(mx + o + 200, my - 200); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawParts(ctx, [{ details: [{ pts: ell(mx, my, MIRROR_R, MIRROR_R, 0, 60), w: 3, closed: true }, { pts: ell(mx, my, MIRROR_R + 6, MIRROR_R + 6, 0, 60), w: 1.4, closed: true }] }]);
  // His thumb, in front of the rim.
  const thumb = place(place(capsule([-15, -22], [-37, -40], 7.6), [0, 0], 0, k, k), gloveAt, -0.55);
  drawParts(ctx, [{ outline: [thumb], ow: 2.4, fills: [{ pts: thumb, col: GREY.white }] }]);
}

// --- shot 6, 14.5–17 s, wide: a kiss for the coin, the coin under his hat, a little tap dance. The ground shakes ---

const S6 = 14.5;
const TRACK6 = [[S6, FF.vain], [S6 + 0.2, FF.kiss], [S6 + 0.55, FF.proud], [S6 + 1.3, FF.glee]];
const TAPS = [S6 + 1.45, S6 + 1.6, S6 + 1.8, S6 + 1.95, S6 + 2.15];
const HOP6 = S6 + 2.15;
function filou6(t) {
  const tau = t - S6;
  let left = mix2([-48, -186], [-18, -150], ease.inOut(span(tau, 0, 0.3)));
  left = mix2(left, [-6, -262], ease.inOut(span(tau, 0.6, 0.9)));
  left = mix2(left, [-80, -130], ease.inOut(span(tau, 1.0, 1.25)));
  const hatLift = keys(tau, [[0.7, 0], [0.9, 36, ease.out], [1.0, 36], [1.18, 0, ease.in]]);
  let right = mix2([62, -90], [34, -262], ease.inOut(span(tau, 0.5, 0.72)));
  right = [right[0], right[1] - hatLift];
  right = mix2(right, [86, -150], ease.inOut(span(tau, 1.28, 1.45)));
  left = mix2(left, [-86, -150], ease.inOut(span(tau, 1.28, 1.45)));
  // The dance: toe taps, right, right, left, left, then a hop that lands with arms wide.
  const tapR = tau > 1.4 && tau < 1.72, tapL = tau > 1.72 && tau < 2.05;
  const toe = side => TAPS.reduce((a, at, i) => a + ((i < 2) === (side > 0) && i < 4 ? 0.55 * bump(t, at - 0.08, 0.16) : 0), 0);
  const hop = -26 * bump(t, HOP6 - 0.02, 0.28);
  const f = faceAt(TRACK6, t);
  return {
    pose: {
      ...POSES.happy, face: f,
      lean: 0.06 * (tapR ? 1 : tapL ? -1 : 0) * Math.sin(tau * 20) * 0.5,
      squash: 0.05 * bump(t, HOP6 + 0.24, 0.16) - 0.05 * bump(t, HOP6, 0.2) + 0.03 * Math.abs(Math.sin(tau * 20)) * (tapR || tapL),
      tilt: 0.05 * Math.sin(tau * 10) * (tau > 1.4),
      hatLift, hatTilt: -0.05 * span(tau, 1.0, 1.2),
      tail: 0.25 + 0.3 * Math.sin(tau * 12) * (tau > 1.4),
      feet: { l: [tapL ? -34 : -24, -14 - 4 * toe(-1)], r: [tapR ? 34 : 24, -14 - 4 * toe(1)] },
      footAng: { l: toe(-1), r: toe(1) }, legBend: {},
      hands: { l: left, r: right }, handAng: { l: tau < 1.25 ? -0.6 : 0.6, r: tau < 1.28 ? -0.3 : -0.6 },
      grip: { l: tau < 1.0 ? 'fist' : 'open' },
    },
    hop,
    coinOnHead: tau > 0.95,
  };
}
// Hearts off a kiss.
function hearts(ctx, x, y, k, s) {
  if (k <= 0 || k >= 1) return;
  ctx.globalAlpha = 1 - span(k, 0.6, 1);
  for (const [dx, off] of [[-6, 0], [10, 0.25]]) {
    const kk = Math.max(0, k - off), hx = x + dx * s + 40 * s * kk + 6 * s * Math.sin(kk * 9), hy = y - 50 * s * kk, r = 5 * s;
    const pts = Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * TAU; return [hx + r * 16 * Math.sin(a) ** 3 / 16, hy - r * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16]; });
    drawParts(ctx, [{ outline: [pts], ow: 1, fills: [{ pts, col: '#f6f3ea' }] }], s);
  }
  ctx.globalAlpha = 1;
}
// Pebbles on the road, hopping as the ground trembles.
const tremble = t => keys(t, [[S6, 0], [CRASH, 1]], ease.in);
function pebbles(ctx, t) {
  for (let i = 0; i < 7; i++) {
    const X = 40 + rand(i + 11) * 300, z = 1.25 + rand(i + 21) * 0.5;
    const h = tremble(t) * 7 * Math.abs(Math.sin(t * (22 + i * 3) + i));
    const [x, y] = U(X, z, h), r = 2.2 / z;
    drawParts(ctx, [{ outline: [ell(x, y, r * 1.3, r, 0, 10)], ow: 0.8, fills: [{ pts: ell(x, y, r * 1.3, r, 0, 10), col: '#a39d91' }] }]);
  }
}

function shot6(ctx, t) {
  const boil = drawing(t), tau = t - S6;
  drawStreet(ctx, { boil, t, lampSway: 0.05 * tremble(t) * Math.sin(t * 9) });
  car(ctx, t);
  pebbles(ctx, t);
  const { pose, hop, coinOnHead } = filou6(t);
  const at = placed(FILOU_X, FILOU_Z, hop);
  const ink = 1;
  drawParts(ctx, [{ fills: [{ pts: ell(at.gx, at.gy, 46 * at.scale * (1 + hop / 80), 7 * at.scale, 0, 20), col: '#000000', alpha: 0.2 }] }]);
  const coinAt = at.toScreen(onFist(pose.hands.l, pose.handAng.l));
  if (!coinOnHead) drawCoin(ctx, { at: coinAt, spin: null }, at.scale);
  drawFilou(ctx, pose, at.gx, at.y, at.scale, { boil, t, ink });
  // Set on his head just before the hat comes down over it.
  if (coinOnHead && tau < 1.16) {
    const [x, y] = at.toScreen([2, -254]);
    drawCoin(ctx, { at: [x, y], spin: null, k: 0.55 }, at.scale);
    sparkle(ctx, x + 8, y - 8, span(tau, 0.95, 1.12), at.scale);
  }
  hearts(ctx, ...at.toScreen([28, -150]), span(tau, 0.42, 1.3), at.scale);
}

// --- shot 7, 17–18.6 s, medium close: « POUET POUET ! », the double take, the jump; the car is on him ---

const S7 = 17;
const HONKS = [S7 + 0.05, S7 + 0.27];
const TAKE = S7 + 0.95;
const CAM7 = [[300, 282], [320, 250], 1.7];
const TRACK7 = [[S7, FF.glee], [S7 + 0.1, FF.blank], [S7 + 0.32, FF.glance], [S7 + 0.62, FF.blank], [S7 + 0.74, FF.blink], [S7 + 0.8, FF.look], [TAKE, FF.alarm]];
// The head: a slow look over his shoulder, back to us, then the double take.
const turn7 = t => keys(t - S7, [[0.3, 0], [0.58, -1], [0.62, -1], [0.72, 0, ease.out], [0.8, 0], [0.88, -1, ease.out], [TAKE - S7, -1], [TAKE - S7 + 0.08, 0, ease.out]]);
function filou7(t) {
  const tau = t - S7, take = t >= TAKE;
  const jump = take ? -34 * ease.out(span(t, TAKE, TAKE + 0.15)) : 0;
  const f = faceAt(TRACK7, t);
  const guard = ease.inOut(span(t, TAKE + 0.18, TAKE + 0.35));
  const shiver = take ? 1.5 * Math.sin(t * 90) : 0;
  return {
    pose: {
      ...POSES.happy, face: f, turn: turn7(t),
      lean: take ? 0 : -0.04 * span(tau, 0.3, 0.58), squash: take ? -0.14 : 0,
      tilt: -0.1 * Math.abs(turn7(t)),
      hatLift: take ? 400 * ease.in(span(t, TAKE, TAKE + 0.35)) + 20 : 0,
      hatTilt: take ? -0.6 : 0, ears: take ? 0.4 : 0,
      tail: take ? -0.5 : 0.25, tailStraight: take,
      feet: take ? { l: [-30, -34], r: [28, -26] } : { l: [-24, -14], r: [24, -14] }, footAng: take ? { l: 0.5, r: 0.3 } : {}, legBend: take ? { l: 10, r: -8 } : {},
      hands: take ? { l: mix2([-86, -172], [-34, -200], guard), r: mix2([86, -172], [34, -196], guard) } : { l: [-86, -150], r: [86, -150] },
      handAng: take ? { l: lerp(0.5, 0.3, guard), r: lerp(-0.5, -0.3, guard) } : { l: 0.6, r: -0.6 },
      bend: take ? { l: -26, r: 26 } : undefined,
      grip: {},
    },
    jump: jump + shiver,
  };
}
// The horn's lettering, over the car (away from his face).
function honkText(ctx, t) {
  const k = span(t, HONKS[0], HONKS[0] + 0.1);
  if (k <= 0 || t > S7 + 0.8) return;
  const [x, y] = G(carX(t), carZ(t)), sc = 1.1 / carZ(t), [cx, cy] = CAM7[0], [ox, oy] = CAM7[1], z = CAM7[2];
  ctx.save();
  ctx.translate(Math.max(120, (x - cx) * z + ox), Math.max(40, (y - 230 * sc - cy) * z + oy));
  ctx.rotate(-0.14 + 0.05 * Math.sin(t * 40)); const s = ease.outBack(k) * (1 + 0.08 * bump(t, HONKS[1], 0.12)); ctx.scale(s, s);
  ctx.font = '900 30px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.strokeText('POUET POUET !', 0, 0); ctx.fillStyle = '#f6f3ea'; ctx.fillText('POUET POUET !', 0, 0);
  ctx.restore();
}
function shot7(ctx, t) {
  const boil = drawing(t), zoom = CAM7[2];
  ctx.save();
  camera(ctx, ...CAM7);
  drawStreet(ctx, { boil, t, ink: 1 / zoom, lampSway: 0.05 * Math.sin(t * 9) });
  // The car sees him too, at the last moment: its pupils shrink, its tyres lock.
  car(ctx, t, { ink: 1 / zoom, pupil: t > S7 + 1.2 ? 0.45 : 1, gaze: t > S7 + 1.2 ? [0.2, 0.9] : [0.3, 0.3] });
  pebbles(ctx, t);
  const { pose, jump } = filou7(t);
  const at = placed(FILOU_X, FILOU_Z, jump);
  const ink = inkFor(at.scale, zoom);
  drawParts(ctx, [{ fills: [{ pts: ell(at.gx, at.gy, 46 * at.scale, 7 * at.scale, 0, 20), col: '#000000', alpha: 0.2 }] }]);
  drawFilou(ctx, pose, at.gx, at.y, at.scale, { boil, t, ink });
  // The hat shot off his head, and the coin that was under it, spinning up out of the frame.
  if (t >= TAKE) {
    const d = t - TAKE, [x, y] = at.toScreen([-10 + 40 * d, -252 - 500 * d]);
    drawCoin(ctx, { at: [x, y], spin: 30 * d }, at.scale * ink);
  }
  if (t >= TAKE && t < TAKE + 0.12) {
    // Take lines round his head.
    const [hx, hy] = at.toScreen([0, -200]);
    ctx.globalAlpha = 1 - span(t, TAKE, TAKE + 0.12);
    drawParts(ctx, [{ details: Array.from({ length: 9 }, (_, i) => { const a = -Math.PI + (i / 8) * Math.PI; return { pts: [[hx + Math.cos(a) * 80 * at.scale, hy + Math.sin(a) * 76 * at.scale], [hx + Math.cos(a) * 104 * at.scale, hy + Math.sin(a) * 98 * at.scale]], w: 2.4 }; }) }], 1 / zoom);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  honkText(ctx, t);
  // Headlights on him, whiter and whiter.
  const glare = ease.in(span(t, CRASH - 0.45, CRASH));
  if (glare > 0) {
    const [x, y] = G(carX(t), carZ(t)), s = 1.1 / carZ(t);
    for (const side of [-1, 1]) {
      const px = (x + side * 66 * s - CAM7[0][0]) * zoom + CAM7[1][0], py = (y - 122 * s - CAM7[0][1]) * zoom + CAM7[1][1];
      const g = ctx.createRadialGradient(px, py, 0, px, py, 60 + 500 * glare);
      g.addColorStop(0, `rgba(255,255,250,${glare})`); g.addColorStop(1, 'rgba(255,255,250,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = glare ** 3; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
}

// --- shot 8, 18.6–20 s: black, BADABOUM. An iris opens on Filou flat as a pancake; the coin comes down on his nose. FIN ---

const IRIS_OPEN = [CRASH + 0.3, CRASH + 0.45], IRIS_SHUT = [19.55, 19.66];
const NOSE_HIT = 19.3;
const PLOP = [235, 305];
const SOCKET = [345, 137]; // his right eye, in the top view: the one that popped out // the coin comes down in the puddle, left of his head
const LENS = [ // the impact throws blood onto the lens; it stays there over the black, the iris and « FIN »
  { at: CRASH + 0.02, x: 110, y: 110, r: 62 },
  { at: CRASH + 0.05, x: 560, y: 400, r: 68 },
  { at: CRASH + 0.08, x: 588, y: 128, r: 36 },
  { at: CRASH + 0.1, x: 70, y: 420, r: 30 },
];
const TOP_H = 250; // the top camera's height above the road
function shot8(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(-20, -20, W + 40, H + 40);
  if (t >= IRIS_SHUT[1]) return fin(ctx, t);
  const open = ease.out(span(t, ...IRIS_OPEN)) * (1 - ease.in(span(t, ...IRIS_SHUT)));
  if (open <= 0) return;
  const boil = drawing(t), s = 0.95, cx = 320, cy = 250;
  // The blood is red in the grey print, as if tinted by hand: the film print only multiplies it.
  const nose = PLOP; // where the coin comes down: in the puddle beside his head
  // The iris closes on the coin in the puddle.
  const ic = t > IRIS_SHUT[0] ? nose : [cx, cy - 20];
  ctx.save();
  ctx.beginPath(); ctx.arc(ic[0], ic[1], 20 + 250 * open, 0, TAU); ctx.clip();
  // The road seen from straight above: the tram rails, the tyre track across it all.
  drawParts(ctx, [
    { fills: [{ pts: [[0, 0], [W, 0], [W, H], [0, H]], col: '#8a857b' }] },
    { fills: [[150, 162], [222, 234], [406, 418], [478, 490]].map(([a, b], i) => ({ pts: [[a, 0], [b, 0], [b, H], [a, H]], col: i % 2 ? '#c9c3b6' : '#34312d' })),
      details: [150, 162, 234, 406, 478, 490].map(x => ({ pts: [[x, 0], [x, H]], w: 1.6 })) },
  ]);
  // The puddle spreads out from under him.
  puddle(ctx, t, CRASH + 0.35, cx + 10, cy + 20, 190, 4, { sy: 0.8, grow: 1 });
  // Flat as a pancake, arms and legs splayed; spread a little wider than he stands.
  ctx.save(); ctx.translate(cx, cy + 110); ctx.scale(1.15, 1.1); ctx.translate(-cx, -(cy + 110));
  drawFilou(ctx, {
    ...POSES.dizzy, squash: 0, folds: false, face: FF.dizzy, hatShift: [0, 0], hatCrush: 0,
    hatOff: true, // knocked off in the take, gone somewhere out of the picture
    hands: { l: [-104, -150], r: [104, -150] }, handAng: { l: -1.3, r: 1.3 }, bend: { l: 20, r: -20 },
    feet: { l: [-56, -8], r: [56, -8] }, footAng: { l: -0.3, r: -0.3 }, legBend: { l: 10, r: -10 }, tail: 1.2,
  }, cx, cy + 110, s, { boil, t });
  ctx.restore();
  // The tyre track: a band of tread straight across him and the road.
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-0.35);
  ctx.globalAlpha = 0.4; ctx.fillStyle = INK; ctx.fillRect(-400, 10, 800, 64);
  ctx.globalAlpha = 0.55; ctx.strokeStyle = INK; ctx.lineWidth = 5;
  for (let x = -400; x < 400; x += 22) { ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x + 10, 42); ctx.lineTo(x, 70); ctx.stroke(); }
  // Past him the tyre prints in red: the tyre went through him and kept rolling.
  ctx.globalAlpha = 0.75; ctx.strokeStyle = BLOOD; ctx.lineWidth = 6;
  for (let x = 60; x < 400; x += 22) { ctx.globalAlpha = 0.75 * (1 - (x - 60) / 340); ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x + 10, 42); ctx.lineTo(x, 70); ctx.stroke(); }
  ctx.restore(); ctx.globalAlpha = 1;
  // One eye popped out on its nerve, and a few teeth knocked out round his head.
  const [sx, sy] = SOCKET, eye = [sx + 62, sy - 28];
  shape(ctx, '#1a0808', c => c.ellipse(sx, sy, 17, 19, 0, 0, TAU), 3, BLOOD_DARK);
  shape(ctx, null, c => { c.moveTo(sx + 4, sy - 4); c.bezierCurveTo(sx + 30, sy + 10, sx + 40, sy - 36, eye[0] - 11, eye[1] + 5); }, 4, BLOOD);
  shape(ctx, '#f3ecdc', c => c.arc(...eye, 13, 0, TAU), 2.4, INK);
  shape(ctx, INK, c => { c.moveTo(eye[0] + 1, eye[1] - 1); c.arc(eye[0] + 1, eye[1] - 1, 7, -0.4, Math.PI * 1.55); c.closePath(); }, 0);
  for (const [dx, dy, a] of [[-100, 4, 0.5], [44, 44, -0.9], [-72, 62, 1.4], [96, 36, 0.2]]) {
    ctx.save(); ctx.translate(sx + dx, sy + dy); ctx.rotate(a);
    shape(ctx, '#f3ecdc', c => c.roundRect(-4, -6, 8, 12, 3), 1.8, INK);
    ctx.restore();
  }
  // The coin's splash in the puddle.
  const sp = span(t, NOSE_HIT, NOSE_HIT + 0.3);
  if (sp > 0 && sp < 1) {
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * (0.1 + 0.8 * (i / 7)), d = 10 + 40 * ease.out(sp);
      shape(ctx, BLOOD, c => c.arc(nose[0] + Math.cos(a) * d, nose[1] + Math.sin(a) * d * 0.7 - 20 * Math.sin(Math.PI * sp), 3.5 * (1 - sp), 0, TAU), 0);
    }
    shape(ctx, null, c => c.ellipse(...nose, 12 + 30 * sp, (12 + 30 * sp) * 0.5, 0, 0, TAU), 2 * (1 - sp), BLOOD_DARK);
  }
  // The coin, falling from high above onto his nose. Seen from above, the higher it is the bigger it looks and the
  // farther out from the middle of the view: it comes in from the edge, shrinking, and lands on his nose.
  const d = Math.max(0, NOSE_HIT - t), h = Math.min(TOP_H - 30, 0.5 * G_W * d * d) + 12 * bump(t, NOSE_HIT, 0.1);
  const grow = TOP_H / (TOP_H - h), [px, py] = [cx + (nose[0] + 6 - cx) * grow, cy + (nose[1] - cy) * grow];
  ctx.globalAlpha = 0.35 * span(h, 200, 0);
  drawParts(ctx, [{ fills: [{ pts: ell(nose[0] + 3, nose[1] + 3, 8.5 * s, 8.5 * s, 0, 16), col: INK }] }]);
  ctx.globalAlpha = 1;
  const spinning = t < NOSE_HIT ? Math.abs(Math.cos(t * 25)) : 1; // still turning over as it falls
  const coinPts = ell(px, py - 2, 9 * s * grow, Math.max(2, 9 * s * grow * spinning), 0, 28);
  drawParts(ctx, [{ outline: [coinPts], ow: 2, fills: [{ pts: coinPts, col: COIN_FACE }], details: [{ pts: ell(px, py - 2, 6 * s * grow, Math.max(1, 6 * s * grow * spinning), 0, 20), w: 1.2, closed: true }] }]);
  ctx.restore();
}
function fin(ctx, t) {
  const k = ease.outBack(span(t, IRIS_SHUT[1], IRIS_SHUT[1] + 0.12));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(k, k);
  const plate = smooth([[-150, -70], [0, -84], [150, -70], [168, 0], [150, 70], [0, 84], [-150, 70], [-168, 0]], true, 6);
  drawParts(ctx, [{ outline: [plate], ow: 3, fills: [{ pts: plate, col: '#34312d' }], details: [{ pts: plate.map(([x, y]) => [x * 0.93, y * 0.86]), w: 1.6, closed: true, col: '#d8d3c7' }] }]);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f3e7cf';
  ctx.font = 'italic 700 76px Georgia, serif'; ctx.fillText('FIN', 0, 4);
  ctx.restore();
}

// --- the period title card, over the sky of the first shot ---

function titleCard(ctx, t) {
  if (t < 0.15 || t > 2.6) return;
  const k = ease.outBack(span(t, 0.15, 0.5));
  ctx.save();
  ctx.globalAlpha = 1 - span(t, 2.2, 2.6);
  ctx.translate(W / 2, 80); ctx.scale(k * 0.8, k * 0.8);
  const plate = smooth([[-236, -52], [0, -64], [236, -52], [250, 0], [236, 52], [0, 64], [-236, 52], [-250, 0]], true, 6);
  const inner = plate.map(([x, y]) => [x * 0.95, y * 0.84]);
  drawParts(ctx, [{ outline: [plate], ow: 3, fills: [{ pts: plate, col: '#34312d' }], details: [{ pts: inner, w: 1.6, closed: true, col: '#d8d3c7' }] }]);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f3e7cf';
  ctx.font = 'italic 700 22px Georgia, serif'; ctx.fillText('— 20 s avant —', 0, -24);
  ctx.font = '700 30px Georgia, serif'; ctx.fillText('que la voiture ne me renverse', 0, 14);
  ctx.restore();
}

// --- over every shot ---

const SHOTS = [[0, shot1], [3, shot2], [S3, shot3], [S4, shot4], [S5, shot5], [S6, shot6], [S7, shot7], [CRASH, shot8]];

// The car shakes the ground more and more as it comes.
function shake(ctx, t) {
  const a = t < CRASH ? 5 * tremble(t) : 0, n = Math.floor(t * 30);
  ctx.translate((rand(n) - 0.5) * 2 * a, (rand(n + 500) - 0.5) * 2 * a);
}

function draw(ctx, t) {
  const [, shot] = SHOTS.findLast(([start]) => start <= t) ?? SHOTS[0];
  ctx.save();
  shake(ctx, t);
  shot(ctx, t);
  ctx.restore();
  titleCard(ctx, t);
  filmPrint(ctx, W, H, drawing(t), { gate: false });
  lens(ctx, t, LENS);
  countdown(ctx, t);
}

// The series' signature, as in episode 1.
function countdown(ctx, t) {
  const s = Math.max(0, Math.ceil(20 - t));
  // Kept clear of the corners: every room's screen is rounded there.
  box(ctx, 488, 44, 96, 38, '#2a2320', 8);
  ctx.font = '700 26px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff5a3c';
  ctx.fillText(`00:${String(s).padStart(2, '0')}`, 536, 64);
}

// A jaunty little tune, whistled while he walks (Hz, start, length); it stops dead when he misses the coin.
const TUNE = [[784, 0.2, 0.22], [880, 0.45, 0.2], [988, 0.68, 0.34], [784, 1.05, 0.22], [659, 1.3, 0.4],
  [784, 1.75, 0.2], [880, 1.97, 0.2], [988, 2.2, 0.2], [1047, 2.42, 0.45], [988, 2.95, 0.2], [880, 3.18, MISS - 3.18]];
const cues = [
  ...TUNE.map(([f, at, dur]) => ({ at, sound: 'whistle', f, dur })),
  ...[0.02, 0.5, 1, 1.5, 2, 2.5, 3, WALK_END].map((at, i) => ({ at, sound: 'woodblock', f: i % 2 ? 700 : 900 })),
  ...FLIPS.map(f => ({ at: f, sound: 'coinFlick' })),
  ...FLIPS.slice(0, 2).map(f => ({ at: f + AIR, sound: 'coinCatch' })),
  // shot 2
  { at: 3, sound: 'engine', dur: CRASH - 3, near: FILOU_Z / carZ(3) },
  { at: MISS, sound: 'coinTick' },
  { at: MISS + 0.04, sound: 'coinCatch' },
  { at: LAND, sound: 'tink' },
  { at: ROLL0, sound: 'coinTick' },
  { at: ROLL0 + 0.02, sound: 'coinRoll', dur: ROLL1 - ROLL0 },
  { at: ROLL0 + 0.1, sound: 'coinTick' },
  { at: ROLL1, sound: 'coinWobble', dur: FLAT - ROLL1 },
  ...Array.from({ length: 5 }, (_, i) => ({ at: TROT0 + (i + 0.5) * TROT_STEP, sound: 'woodblock', f: i % 2 ? 1100 : 1300 })),
  // shot 3
  { at: S3 + 0.58, sound: 'squeak' },
  { at: S3 + 1.03, sound: 'squeak' },
  { at: S3 + 1.49, sound: 'woodblock', f: 1600 },
  { at: S3 + 1.65, sound: 'woodblock', f: 1600 },
  { at: SLIDE[0], sound: 'coinScrape', dur: SLIDE[1] - SLIDE[0] },
  { at: TIP[1], sound: 'clink' },
  { at: PICK, sound: 'coinTick' },
  // shot 4
  { at: S4 + 0.62, sound: 'breath', dur: 0.32 },
  ...[0, 1, 2, 3].map(i => ({ at: RUB[0] + 0.05 + i * 0.2, sound: 'rub' })),
  { at: CAT_SEE, sound: 'yowl' },
  { at: CAT_JUMP, sound: 'whoosh' },
  { at: S4 + 1.97, sound: 'sparkle' },
  // shot 5
  { at: S5 + 1.72, sound: 'click' },
  // shot 6
  { at: S6 + 0.4, sound: 'smack' },
  { at: S6, sound: 'rumble', dur: CRASH - S6 },
  { at: S6 + 1.2, sound: 'coinCatch' },
  ...TAPS.map(at => ({ at, sound: 'tapShoe' })),
  { at: HOP6 + 0.26, sound: 'tapShoe' },
  // shot 7
  ...HONKS.map(at => ({ at, sound: 'honk' })),
  { at: TAKE, sound: 'slideUp' },
  { at: S7 + 1.2, sound: 'screech', dur: CRASH - S7 - 1.2 },
  // shot 8
  { at: CRASH, sound: 'crash' },
  { at: CRASH + 0.18, sound: 'honk', dur: 0.5, fall: true },
  { at: CRASH + 0.45, sound: 'chirp' },
  { at: CRASH + 0.7, sound: 'chirp' },
  { at: CRASH + 0.03, sound: 'splat' },
  { at: CRASH + 0.08, sound: 'splat' },
  { at: NOSE_HIT, sound: 'squelch' },
].sort((a, b) => a.at - b.at);

export default { title: '20 s avant que la voiture ne me renverse', duration: 20, cues, draw };

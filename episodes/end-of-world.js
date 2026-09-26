// « 20 s avant la fin du monde » — Pépin the fox fights a pickle jar while a meteor comes down.
// The episode is a list of shots, each framing the same world at the global time t.
import { W, H, lerp, mix2, rotate, span, bump, ease, keys, keysColor, mixColor, rand, label, box, shape } from '../engine.js';
import { POSES, drawPepin, faceTrack } from '../characters/pepin.js';
import { drawGarden, drawTable, drawSandwich } from '../sets/garden.js';
import { JAR_W, JAR_H, drawJar, drawLid } from '../props/jar.js';
import { BLOOD, BLOOD_DARK, blob, lens as lensSplats } from '../props/gore.js';

const IMPACT = 19; // the meteor hits the ground behind the hills
const XRAY = 19.06; // the blast reaches Pépin: for a tenth of a second we see his bones
const BURST = 19.16; // then he comes apart
const BLACKOUT = 19.5;

const cues = [
  { at: 0.4, sound: 'chirp' },
  { at: 1.0, sound: 'chirp' },
  { at: 2.05, sound: 'clink' },
  { at: 3.9, sound: 'creak' },
  { at: 4.25, sound: 'creak' },
  { at: 4.5, sound: 'squeak' },
  { at: 4.6, sound: 'rumble', dur: BLACKOUT - 4.6 },
  { at: 6.15, sound: 'chirp' },
  { at: 6.35, sound: 'chirp' },
  { at: 6.6, sound: 'knock' },
  { at: 7.3, sound: 'knock' },
  { at: 8.35, sound: 'clack' },
  { at: 8.7, sound: 'creak' },
  { at: 9.1, sound: 'creak' },
  { at: 12.7, sound: 'creak' },
  { at: 13.2, sound: 'creak' },
  { at: 13.7, sound: 'creak' },
  { at: 14.2, sound: 'creak' },
  { at: 14.6, sound: 'creak' },
  { at: 14.9, sound: 'creak' },
  { at: 15.3, sound: 'pop' },
  { at: 17.1, sound: 'clink' },
  { at: 17.95, sound: 'crunch' },
  { at: 18.2, sound: 'crunch' },
  { at: 18.45, sound: 'crunch' },
  { at: IMPACT, sound: 'boom' },
  { at: BURST, sound: 'splat' },
  { at: 19.22, sound: 'splat' },
  { at: 19.29, sound: 'splat' },
  { at: 19.35, sound: 'splat' },
  { at: 19.6, sound: 'tink' },
  { at: 19.62, sound: 'squelch' },
];

// --- shared by every shot ---

const breath = t => 0.012 * Math.sin((t * Math.PI * 2) / 1.3);

// A world point in the puppet's own coordinates, given where he stands and how he leans and squashes.
function toPuppet([wx, wy], [ox, oy], scale, lean, sq) {
  const [x, y] = rotate([wx - ox, wy - oy], -lean);
  return [x / (scale * (1 + sq)), y / (scale * (1 - sq))];
}
function toWorld([px, py], [ox, oy], scale, lean, sq) {
  const [x, y] = rotate([px * scale * (1 + sq), py * scale * (1 - sq)], lean);
  return [ox + x, oy + y];
}

// The impact seen from the garden: a dome of fire rising from behind the hills, rocks thrown up.
function fireball(ctx, t) {
  const k = ease.out(span(t, IMPACT, BLACKOUT));
  const [x, y] = GROUND_ZERO;
  for (const [scale, fill] of [[1, '#ff7a2a'], [0.72, '#ffc84a'], [0.45, '#fff6c8']]) {
    shape(ctx, fill, c => c.ellipse(x, y, 700 * k * scale, 520 * k * scale, 0, Math.PI, 0), 0);
  }
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.15 + 0.7 * rand(i + 40)), d = 90 + 260 * k * (0.6 + 0.4 * rand(i + 60));
    shape(ctx, '#6e4630', c => c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 5 + 6 * rand(i + 80), 0, Math.PI * 2), 2, '#4a2a18');
  }
}

// Wide shots see the world as it is; closer shots zoom on a point of it.
// Sky, hills and meteor are far away, so they stay put on screen whatever the framing.
function camera(ctx, [wx, wy], [sx, sy], zoom) {
  ctx.translate(sx, sy); ctx.scale(zoom, zoom); ctx.translate(-wx, -wy);
}

const SKY = [[0, '#f9e7a6'], [4, '#f9e7a6'], [8, '#ffc98a'], [13, '#ff9a5c'], [17, '#e8553a']];
const sky = t => { const top = keysColor(t, SKY); return [top, mixColor(top, '#fff6e0', 0.55)]; };

// The meteor: a red dot no one notices, then a burning rock that grows until it fills the sky.
const GROUND_ZERO = [440, 330];

function meteor(ctx, t) {
  const alpha = span(t, 0.8, 1.2);
  if (!alpha) return;
  if (t >= IMPACT) return fireball(ctx, t);
  const x = keys(t, [[3, 92], [6, 120], [10, 170], [16, 260], [IMPACT, 430, ease.in]], ease.linear);
  const y = keys(t, [[3, 58], [6, 72], [10, 100], [16, 160], [IMPACT, 285, ease.in]], ease.linear);
  const r = keys(t, [[0, 2.6], [3, 2.8], [6, 14], [10, 34], [16, 110], [IMPACT, 125]], ease.in);
  ctx.globalAlpha = alpha;
  if (r < 6) {
    const pulse = r + 0.6 * Math.sin(t * 9);
    shape(ctx, 'rgba(255,70,40,0.3)', c => c.arc(x, y, pulse * 2.6, 0, Math.PI * 2), 0);
    shape(ctx, '#ff2a1a', c => c.arc(x, y, pulse, 0, Math.PI * 2), 0);
    ctx.globalAlpha = 1;
    return;
  }
  const lw = Math.min(3, r / 5);
  // The flame points back up the way it came, towards the top left.
  const [dx, dy] = [0.8, 0.6], [px, py] = [-dy, dx];
  for (const [len, fill] of [[2.4, '#ffb13b'], [1.6, '#ffe36b']]) {
    shape(ctx, fill, c => {
      c.moveTo(x - dx * r * len, y - dy * r * len);
      c.quadraticCurveTo(x + px * r * 1.2, y + py * r * 1.2, x + dx * r * 0.2, y + dy * r * 0.2);
      c.quadraticCurveTo(x - px * r * 1.2, y - py * r * 1.2, x - dx * r * len, y - dy * r * len);
    }, lw, '#c0501a');
  }
  shape(ctx, 'rgba(255,190,90,0.35)', c => c.arc(x, y, r * 1.3, 0, Math.PI * 2), 0);
  shape(ctx, '#8a5a3c', c => c.arc(x, y, r, 0, Math.PI * 2), lw, '#4a2a18');
  for (const [ox, oy, rr] of [[-0.3, -0.2, 0.24], [0.35, 0.25, 0.16], [0.1, 0.45, 0.1]]) {
    shape(ctx, '#6e4630', c => c.arc(x + ox * r, y + oy * r, rr * r, 0, Math.PI * 2), lw * 0.8, '#4a2a18');
  }
  ctx.globalAlpha = 1;
}

// --- shot 1, 0–3 s, wide: he eyes his sandwich, spots the pickles, grabs the jar ---

const FOX = [312, 440], FOX_SCALE = 0.85;
const TABLE = { x: 350, y: 392, w: 240 };
const JAR_ON_TABLE = [392, TABLE.y - (JAR_H / 2) * FOX_SCALE];
const GRAB = 2.05;
const HOLD = [0, -50]; // where shot 2 picks the jar up: against his belly

const FACES1 = {
  content: { ...POSES.neutral, gaze: [0.9, 0.45], tilt: 0.08 },
  idea: { ...POSES.joy, gaze: [0.75, 0.6], pupil: 1.25, tilt: 0.1 },
  eager: { ...POSES.joy, gaze: [0.7, 0.65], tilt: 0.05 },
  hold: { ...POSES.neutral, lid: 0.18, gaze: [0, 0.65] },
};
const TRACK1 = [[0, 'content'], [0.95, 'idea'], [1.4, 'eager'], [2.45, 'hold']];

const lean1 = t => keys(t, [[0, 0.02], [1.3, 0.02], [1.55, -0.04], [1.95, 0.13], [2.1, 0.12], [2.5, -0.02], [2.75, 0.01], [3, 0]]);
const squash1 = t => keys(t, [[0, 0], [1.3, 0], [1.55, 0.06], [1.95, -0.05], [2.1, 0], [2.5, 0.035], [2.75, 0]]);
const wag = t => keys(t, [[0.8, 0.25], [1.1, 1], [2.0, 1], [2.5, 0.15]]);

function shot1(ctx, t) {
  drawGarden(ctx, W, H, sky(t), c => meteor(c, t));
  drawTable(ctx, TABLE.x, TABLE.y, TABLE.w);
  drawSandwich(ctx, 505, TABLE.y);
  shape(ctx, 'rgba(90,120,50,0.25)', c => c.ellipse(FOX[0], FOX[1], 56, 8, 0, 0, Math.PI * 2), 0);

  const lean = lean1(t), squash = squash1(t) + breath(t);
  const lag = d => lean1(t - d) - lean;

  // The jar sits on the table until he takes it, then rides in his paws down to his belly.
  const onTable = toPuppet(JAR_ON_TABLE, FOX, FOX_SCALE, lean, squash);
  const carry = ease.inOut(span(t, GRAB, GRAB + 0.5));
  const jar = mix2(onTable, HOLD, carry);
  jar[1] -= Math.sin(Math.PI * carry) * 18;
  if (t < GRAB) {
    ctx.save();
    ctx.translate(...JAR_ON_TABLE); ctx.scale(FOX_SCALE, FOX_SCALE);
    drawJar(ctx, 0, 0);
    ctx.restore();
  }

  // Paws: at his sides, rubbed together at the idea, out to the jar, then set for shot 2
  // (left paw on the glass, right paw gripping the lid).
  const rub = Math.sin(t * 22) * 4 * bump(t, 0.95, 0.6);
  const sides = { l: [-58, -60 + Math.sin(t * 3) * 2], r: [58, -60 - Math.sin(t * 3) * 2] };
  const chest = { l: [-14 + rub, -84], r: [14 - rub, -84] };
  const onJar = { l: [jar[0] - JAR_W / 2 - 4, jar[1] + 8], r: [jar[0] + JAR_W / 2 + 4, jar[1] + 4] };
  const set = { l: [-JAR_W / 2 - 4, HOLD[1] + 16], r: [0, HOLD[1] - JAR_H / 2 - 16] };
  const k1 = ease.inOut(span(t, 0.95, 1.2)), k2 = ease.inOut(span(t, 1.6, 1.95)), k3 = ease.inOut(span(t, 2.55, 2.85));
  const paw = side => {
    const p = mix2(mix2(mix2(sides[side], chest[side], k1), onJar[side], k2), set[side], k3);
    if (side === 'r') p[1] -= Math.sin(Math.PI * k3) * 12; // over the lid, not through it
    return p;
  };

  const f = faceTrack(FACES1, TRACK1, t);
  drawPepin(ctx, {
    ...f,
    lid: Math.max(f.lid, bump(t, 0.55, 0.14)),
    lean,
    squash,
    tilt: f.tilt + lag(0.09) * 1.4,
    ears: 0.05 - 0.15 * bump(t, 0.95, 0.5) + squash1(t - 0.07) * 3 + lag(0.12) * 2,
    tailSide: -1, // away from the table, so the jar stays in sight
    tail: -0.08 + lean1(t - 0.16) * 2.5 + 0.28 * wag(t) * Math.sin(t * 13),
    hands: { l: paw('l'), r: paw('r') },
    thumbs: { r: k3 * -0.7 },
    held: t >= GRAB ? c => drawJar(c, jar[0], jar[1]) : undefined,
  }, ...FOX, FOX_SCALE);
}

// --- shot 2, 3–6 s, medium: first try. He grips, strains, the paw slips off; he glares, then eyes the table ---

const FACES2 = {
  hold: FACES1.hold,
  inhale: { ...POSES.neutral, lid: 0.5, lidTilt: 0.45, gaze: [0, 0.7], mouth: 'frown', heat: 0.05 },
  push: { ...POSES.strain, gaze: [0, 0.6], heat: 0.55 },
  slip: { ...POSES.alarm, gaze: [0.4, -0.2], open: 0.4, heat: 0.5 },
  gasp: { ...POSES.neutral, lid: 0.35, lidTilt: -0.25, gaze: [0, 0.3], mouth: 'open', open: 0.5, heat: 0.3 },
  glare: { ...POSES.neutral, lid: 0.42, lidTilt: 0.55, gaze: [0, 0.85], mouth: 'frown', heat: 0.2 },
  scheme: { ...POSES.neutral, lid: 0.35, lidTilt: 0.5, gaze: [1, 0.5], mouth: 'smile', heat: 0.1, tilt: 0.08 },
};
const TRACK2 = [[0, 'hold'], [0.45, 'inhale'], [0.75, 'push'], [1.5, 'slip'], [1.62, 'gasp'], [1.95, 'glare'], [2.55, 'scheme']];

// All in shot time (0–3 s).
const lean2 = t => keys(t, [[0, 0], [0.45, 0], [0.7, -0.07], [0.85, 0.045], [1.5, 0.04], [1.8, 0.1], [2.0, 0.06], [2.4, 0.01], [2.7, 0.04]]);
const squash2 = t => keys(t, [[0, 0], [0.45, 0], [0.7, -0.05], [0.85, 0.07], [1.5, 0.06], [1.75, -0.02], [1.95, 0.02], [2.4, 0]]);
const head2 = t => keys(t, [[1.5, 0], [1.8, 9], [2.0, 3], [2.4, 0]]);
const jar2 = t => keys(t, [[0, HOLD[1]], [0.45, HOLD[1]], [0.7, HOLD[1] - 6], [0.85, HOLD[1] + 2], [1.5, HOLD[1] + 2], [1.8, HOLD[1] + 10], [2.4, HOLD[1]]]);
const tremble2 = t => keys(t, [[0.8, 0], [0.9, 1], [1.49, 1], [1.5, 0]], ease.linear);
const SLIP = 1.5;

// A stuck lid does not turn, so the paw does not slide: it grips and the whole arm strains,
// jar and paw turning together by a hair. At SLIP the paw rips off the lid and the jar snaps back.
function jarTurn(t, shake) {
  const fight = shake > 0 ? -0.05 + 0.02 * Math.sin(t * 9) : 0;
  return fight + (t >= SLIP ? keys(t, [[SLIP, 0], [SLIP + 0.06, 0.09], [SLIP + 0.25, 0]], ease.out) : 0);
}

function rightPaw2(t, jy, rot) {
  const grip = rotate([0, -JAR_H / 2 - 16], rot);
  grip[1] += jy;
  if (t < SLIP) return grip;
  const slipped = [grip[0] + 44, grip[1] - 14];
  if (t < SLIP + 0.09) return mix2(grip, slipped, ease.out(span(t, SLIP, SLIP + 0.09)));
  return mix2(slipped, [JAR_W / 2 + 6, jy - 8], ease.inOut(span(t, SLIP + 0.09, 1.8)));
}

function shot2(ctx, T, t) {
  drawGarden(ctx, W, H, sky(T), c => meteor(c, T));
  ctx.save();
  camera(ctx, FOX, [300, 470], 1.6 / FOX_SCALE);
  drawTable(ctx, TABLE.x, TABLE.y, TABLE.w);
  shape(ctx, 'rgba(90,120,50,0.25)', c => c.ellipse(FOX[0], FOX[1], 56, 8, 0, 0, Math.PI * 2), 0);

  const shake = tremble2(t);
  const lag = d => lean2(t - d) - lean2(t);
  const shakeHead = t > 1.95 ? 0.15 * Math.sin((t - 1.95) * 32) * (1 - span(t, 1.95, 2.3)) : 0;
  const jy = jar2(t), rot = jarTurn(t, shake);
  const [lx, ly] = rotate([-JAR_W / 2 - 4, 16], rot);
  const recoil = -0.07 * bump(t, SLIP, 0.3); // the body jerks back when the paw lets go
  const f = faceTrack(FACES2, TRACK2, t);

  drawPepin(ctx, {
    ...f,
    lid: Math.max(f.lid, bump(t, 0.2, 0.14), bump(t, 2.3, 0.12)),
    lean: lean2(t) + recoil + shake * 0.006 * Math.sin(t * 83),
    squash: squash2(t) + breath(T) * (1 - shake),
    headY: head2(t),
    tilt: (f.tilt ?? 0) + lag(0.09) * 1.4 + shake * 0.02 * Math.sin(t * 71) + shakeHead - recoil * 1.5,
    ears: 0.1 + squash2(t - 0.07) * 3 + lag(0.12) * 2,
    tailSide: -1,
    tail: -0.08 + lean2(t - 0.16) * 2.5 + 0.07 * Math.sin(((t - 0.3) * Math.PI * 2) / 1.6),
    hands: { l: [lx, jy + ly], r: rightPaw2(t, jy, rot) },
    thumbs: { r: t < SLIP ? -0.7 : 0 },
    held: c => drawJar(c, 0, jy, rot),
  }, FOX[0] + shake * 0.7 * Math.sin(t * 97), FOX[1], FOX_SCALE);
  ctx.restore();
}

// --- shot 3, 6–8 s, wide: he turns the jar over and knocks the lid on the table edge, twice ---

const KNOCKS = [0.6, 1.3]; // shot time of each impact
const LID_TIP = -JAR_H / 2 - 17; // top of the lid, from the centre of the jar
const CONTACT = [425, TABLE.y]; // where the lid hits the table

const FACES3 = {
  scheme: FACES2.scheme,
  effort: { ...POSES.strain, lid: 0.45, gaze: [0.8, 0.5], heat: 0.35 },
  wince: { ...POSES.strain, lid: 1, lidTilt: 0.3, heat: 0.4 },
  check: { ...POSES.neutral, lid: 0.35, lidTilt: 0.45, gaze: [0, -0.2], mouth: 'frown', heat: 0.2 },
};
const TRACK3 = [[0, 'scheme'], [0.3, 'effort'], [1.3, 'wince'], [1.5, 'check']];

const jarAngle3 = t => keys(t, [[0, 0], [0.35, 2.5], [1.45, 2.5], [1.8, 0]]);
// Height above the contact point: wind up, slam down (ease.in), bounce (ease.out).
const lift3 = t => keys(t, [[0.35, -40], [0.5, -50], [0.6, 0, ease.in], [0.72, -24, ease.out], [1.0, -62], [1.3, 0, ease.in], [1.42, -22, ease.out], [1.5, -26]]);
const drift3 = t => keys(t, [[0.35, 14], [0.6, 0, ease.in], [0.72, 8], [1.0, 18], [1.3, 0, ease.in], [1.5, 6]]);
const lean3 = t => keys(t, [[0, 0.04], [0.3, 0.12], [0.5, 0.08], [0.6, 0.15, ease.in], [0.75, 0.1], [1.0, 0.06], [1.3, 0.17, ease.in], [1.45, 0.12], [1.8, 0.02]]);
const squash3 = t => keys(t, [[0, 0], [0.5, -0.04], [0.6, 0.07, ease.in], [0.75, 0], [1.0, -0.05], [1.3, 0.09, ease.in], [1.45, 0.01], [1.8, 0]]);
const jolt = t => bump(t, KNOCKS[0], 0.2) + 1.6 * bump(t, KNOCKS[1], 0.26); // how hard the table was just hit

function shot3(ctx, T, t) {
  drawGarden(ctx, W, H, sky(T), c => meteor(c, T));
  birds(ctx, T);
  const j = jolt(t);
  drawTable(ctx, TABLE.x, TABLE.y + j * 2, TABLE.w);
  drawSandwich(ctx, 505, TABLE.y - j * 9);
  shape(ctx, 'rgba(90,120,50,0.25)', c => c.ellipse(FOX[0], FOX[1], 56, 8, 0, 0, Math.PI * 2), 0);

  const lean = lean3(t), squash = squash3(t) + breath(T);
  const lag = d => lean3(t - d) - lean;
  const a = jarAngle3(t);
  // The jar is placed so that, at an impact, the tip of its lid sits exactly on the table.
  const contact = toPuppet(CONTACT, FOX, FOX_SCALE, lean, squash);
  const tip = rotate([0, LID_TIP], a);
  const overTable = [contact[0] - tip[0] + drift3(t), contact[1] - tip[1] + lift3(t)];
  const turnOver = ease.inOut(span(t, 0, 0.35)), settle = ease.inOut(span(t, 1.45, 1.8));
  const jar = mix2(mix2([0, HOLD[1]], overTable, turnOver), [0, -72], settle);
  const grip = side => { const p = rotate([side * (JAR_W / 2 + 4), 6], a); return [jar[0] + p[0], jar[1] + p[1]]; };
  const from2 = { l: [-JAR_W / 2 - 4, HOLD[1] + 16], r: [JAR_W / 2 + 6, HOLD[1] - 8] };
  const k = ease.inOut(span(t, 0, 0.2));

  const f = faceTrack(FACES3, TRACK3, t);
  drawPepin(ctx, {
    ...f,
    lean,
    squash,
    tilt: (f.tilt ?? 0) + lag(0.09) * 1.4,
    ears: 0.1 + squash3(t - 0.07) * 3 + lag(0.12) * 2 + j * 0.1,
    tailSide: -1,
    tail: -0.08 + lean3(t - 0.16) * 2.5,
    hands: { l: mix2(from2.l, grip(-1), k), r: mix2(from2.r, grip(1), k) },
    held: c => drawJar(c, jar[0], jar[1], a),
  }, ...FOX, FOX_SCALE);

  // Impact lines where the lid hits.
  for (const [n, at] of KNOCKS.entries()) {
    const e = span(t, at, at + 0.14);
    if (e <= 0 || e >= 1) continue;
    ctx.globalAlpha = 1 - e;
    for (const ang of [-2.6, -2.1, -1.05, -0.55]) {
      const r0 = 10 + 14 * e, r1 = r0 + 10 + n * 5;
      shape(ctx, null, c => {
        c.moveTo(CONTACT[0] + Math.cos(ang) * r0, CONTACT[1] + Math.sin(ang) * r0);
        c.lineTo(CONTACT[0] + Math.cos(ang) * r1, CONTACT[1] + Math.sin(ang) * r1);
      }, 2.4, '#5e3515');
    }
    ctx.globalAlpha = 1;
  }
}

// Three bluebirds fleeing the meteor, left to right across the sky.
function birds(ctx, T) {
  for (let i = 0; i < 3; i++) {
    const k = span(T, 6.05 + i * 0.15, 7.6 + i * 0.15);
    if (k <= 0 || k >= 1) continue;
    const x = lerp(-30, W + 30, k), y = 120 + i * 30 + Math.sin(T * 5 + i) * 8;
    const flap = Math.sin(T * 28 + i * 2) * 9;
    shape(ctx, '#7ec8f0', c => { c.moveTo(x - 3, y); c.lineTo(x - 10, y - flap - 4); c.lineTo(x + 4, y - 1); c.closePath(); }, 1.8, '#2f6f96');
    shape(ctx, '#7ec8f0', c => c.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2), 1.8, '#2f6f96');
    shape(ctx, '#ffb13b', c => { c.moveTo(x + 7, y - 2); c.lineTo(x + 12, y); c.lineTo(x + 7, y + 1.5); c.closePath(); }, 1.2, '#a0601a');
    shape(ctx, '#161010', c => c.arc(x + 3.5, y - 1.5, 1.2, 0, Math.PI * 2), 0);
  }
}

// --- shot 4, 8–10 s, close-up: he bites the lid and shakes it like a dog; a shadow falls on him ---

const CLOSE = [[312, 287], [320, 250], 3.2];
const BITE_Y = -104; // jar centre that puts the rim of the lid between his jaws
const NECK = [0, -128];

const FACES4 = {
  check: FACES3.check,
  chomp: { ...POSES.neutral, mouth: 'open', open: 1, lid: 0.2, lidTilt: 0.3, gaze: [0, 0.4], heat: 0.3 },
  worry: { ...POSES.strain, mouth: 'open', open: 1, lid: 0.25, lidTilt: 0.5, cross: 1, heat: 0.6 },
  daze: { ...POSES.neutral, mouth: 'open', open: 0.8, lid: 0.3, lidTilt: -0.2, cross: 0.4, pupil: 0.8, heat: 0.3 },
  up: { ...POSES.neutral, mouth: 'open', open: 0.6, lid: 0.1, lidTilt: -0.3, gaze: [0.1, -1], pupil: 0.8, heat: 0.2 },
};
const TRACK4 = [[0, 'check'], [0.2, 'chomp'], [0.4, 'worry'], [1.3, 'daze'], [1.6, 'up']];
// Head shaken side to side, about 8 times a second, easing in and out.
const worry4 = t => 0.13 * Math.sin((t - 0.4) * 50) * Math.min(span(t, 0.4, 0.5), 1 - span(t, 1.15, 1.3));

function shot4(ctx, T, t) {
  drawGarden(ctx, W, H, sky(T), c => { meteor(c, T); cloud(c, T); });
  ctx.save();
  camera(ctx, ...CLOSE);
  const tilt = worry4(t) + keys(t, [[1.6, 0], [1.9, -0.18]]);
  // The jar comes up to his mouth, then hangs from his teeth and swings with his head.
  const up = ease.inOut(span(t, 0, 0.35)), release = ease.inOut(span(t, 1.6, 1.9));
  const swing = rotate([0, BITE_Y + 14 * release - NECK[1]], tilt);
  const jar = mix2([0, -72], [NECK[0] + swing[0], NECK[1] + swing[1]], up);
  const rot = tilt * up;
  const grip = side => { const p = rotate([side * (JAR_W / 2 + 4), 10], rot); return [jar[0] + p[0], jar[1] + p[1]]; };
  const f = faceTrack(FACES4, TRACK4, t);
  drawPepin(ctx, {
    ...f,
    lid: Math.max(f.lid, bump(t, 1.35, 0.12)),
    tilt: tilt + (f.tilt ?? 0),
    squash: breath(T),
    ears: 0.1 + Math.abs(worry4(t)) * 1.5,
    tailSide: -1,
    hands: { l: grip(-1), r: grip(1) },
    bite: t > 0.35 && t < 1.7,
    held: c => drawJar(c, jar[0], jar[1], rot, { ink: 0.55 }),
    inkScale: 0.55,
  }, ...FOX, FOX_SCALE);
  ctx.restore();
}

// A cloud drifts in front of the meteor just as Pépin looks up (9.9–11.2 s), then moves on.
const PUFFS = [[-80, -40, 40], [-40, -55, 48], [10, -50, 50], [55, -30, 42], [-70, 10, 42], [-20, 5, 58], [40, 15, 52], [80, 20, 36]];
const cloudX = T => keys(T, [[9.2, -160], [9.9, 178], [11.2, 184], [12.6, 820]]);
function cloud(ctx, T) {
  if (T < 9.2 || T > 12.6) return;
  const x = cloudX(T), y = 100;
  ctx.beginPath();
  for (const [dx, dy, r] of PUFFS) { ctx.moveTo(x + dx + r, y + dy); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); }
  // Outline at double width first, fill over it: only the rim of the whole cloud stays drawn.
  ctx.lineWidth = 5; ctx.strokeStyle = '#9fb3c8'; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fill();
}
// The cloud's shadow, passing over the garden.
const cloudShade = T => keys(T, [[9.5, 0], [9.85, 0.2], [11.2, 0.2], [11.7, 0]]);

// --- shot 5, 10–12 s, wide: he looks up, sees only a cloud, shrugs, goes back to the jar ---

const FACES5 = {
  up: FACES4.up,
  squint: { ...POSES.neutral, lid: 0.35, gaze: [0.1, -1], mouth: 'frown' },
  meh: { ...POSES.neutral, lid: 0.3, lidTilt: -0.35, gaze: [0.6, 0], mouth: 'smile' },
  glare: FACES2.glare,
};
const TRACK5 = [[0, 'up'], [0.35, 'squint'], [0.9, 'meh'], [1.45, 'glare']];
const lean5 = t => keys(t, [[0, -0.02], [0.3, -0.08], [0.9, -0.06], [1.1, 0.02], [1.45, 0], [1.7, 0.03]]);
const tilt5 = t => keys(t, [[0, -0.18], [0.3, -0.3], [0.9, -0.28], [1.1, 0.12], [1.45, 0.02]]);
const shrug5 = t => bump(t, 0.95, 0.5);

function shot5(ctx, T, t) {
  drawGarden(ctx, W, H, sky(T), c => { meteor(c, T); cloud(c, T); });
  drawTable(ctx, TABLE.x, TABLE.y, TABLE.w);
  drawSandwich(ctx, 505, TABLE.y);
  shape(ctx, 'rgba(90,120,50,0.25)', c => c.ellipse(FOX[0], FOX[1], 56, 8, 0, 0, Math.PI * 2), 0);

  const lean = lean5(t), squash = breath(T) - 0.04 * shrug5(t);
  const jarY = keys(t, [[0, -90], [0.3, HOLD[1]]]);
  const left = [-JAR_W / 2 - 4, jarY + 16];
  // Right paw: off the jar, turned up for the shrug, then back on the lid for the last try.
  const side = [JAR_W / 2 + 4, jarY + 10], palm = [74, -104], lid = [0, HOLD[1] - JAR_H / 2 - 16];
  const k1 = ease.inOut(span(t, 0.85, 1.05)), k2 = ease.inOut(span(t, 1.45, 1.8));
  const right = mix2(mix2(side, palm, k1), lid, k2);
  right[1] -= Math.sin(Math.PI * k2) * 12;
  const f = faceTrack(FACES5, TRACK5, t);
  drawPepin(ctx, {
    ...f,
    lean,
    squash,
    headY: 7 * shrug5(t),
    tilt: tilt5(t) + (lean5(t - 0.09) - lean) * 1.4,
    ears: 0.1 - 0.12 * shrug5(t),
    tailSide: -1,
    tail: -0.08 + lean5(t - 0.16) * 2.5,
    hands: { l: left, r: right },
    thumbs: { r: -0.7 * k2 },
    held: c => drawJar(c, 0, jarY),
  }, ...FOX, FOX_SCALE);
}

// --- shot 6, 12–16 s, medium: last try with everything he has. The lid gives, POP, he staggers back ---

const POP6 = 3.3; // shot time
const FACES6 = {
  glare: FACES2.glare,
  inhale: FACES2.inhale,
  shove: { ...POSES.strain, lid: 0.7, lidTilt: 0.5, gaze: [0, 0.6], heat: 0.9 },
  give: { ...POSES.alarm, lid: 0.1, gaze: [0, 0.6], mouth: 'grit', heat: 0.7 },
  pop: { ...POSES.alarm, open: 1, heat: 0.4, pupil: 0.6 },
  wow: { ...POSES.joy, gaze: [0, 0.7], pupil: 1.3 },
};
const TRACK6 = [[0, 'glare'], [0.25, 'inhale'], [0.55, 'shove'], [2.85, 'give'], [POP6, 'pop'], [3.75, 'wow']];
const tremble6 = t => keys(t, [[0.55, 0], [0.7, 1.2], [2.8, 1.8], [POP6, 1.8], [POP6 + 0.01, 0]], ease.linear);
const lean6 = t => keys(t, [[0, 0], [0.25, -0.06], [0.55, 0.05], [2.8, 0.06], [POP6, 0.05], [POP6 + 0.15, -0.2, ease.out], [3.7, -0.08], [3.95, 0]]);
const squash6 = t => keys(t, [[0, 0], [0.25, -0.05], [0.55, 0.09], [POP6, 0.1], [POP6 + 0.08, -0.08], [3.6, 0.05], [3.85, 0]]);
const slide6 = t => keys(t, [[POP6, 0], [3.5, -16, ease.out], [3.75, -26]]); // staggering back, in world pixels
const hop6 = t => -12 * bump(t, POP6, 0.2) - 6 * bump(t, 3.52, 0.18);
const turn6 = t => ease.in(span(t, 2.85, POP6)); // the lid finally turns

function shot6(ctx, T, t) {
  drawGarden(ctx, W, H, sky(T), c => meteor(c, T));
  ctx.save();
  camera(ctx, FOX, [300, 470], 1.6 / FOX_SCALE);
  drawTable(ctx, TABLE.x, TABLE.y, TABLE.w);
  const at = [FOX[0] + slide6(t), FOX[1] + hop6(t)];
  shape(ctx, 'rgba(90,120,50,0.25)', c => c.ellipse(at[0], FOX[1], 56, 8, 0, 0, Math.PI * 2), 0);

  const shake = tremble6(t);
  const popped = t >= POP6;
  const lean = lean6(t), squash = squash6(t);
  const fight = shake > 0 && t < 2.85 ? -0.05 + 0.02 * Math.sin(t * 9) : 0;
  const jy = HOLD[1] + 10 * bump(t, POP6, 0.3);
  const [lx, ly] = rotate([-JAR_W / 2 - 4, 16], fight);
  // Right paw: gripping the lid (and turning with it at the end), flung up and out by the pop, then back down.
  const grip = rotate([0, -JAR_H / 2 - 16], fight);
  grip[1] += jy;
  const fling = ease.out(span(t, POP6, POP6 + 0.12)), down = ease.inOut(span(t, 3.5, 3.9));
  const right = mix2(mix2(grip, [84, -176], fling), [58, -66], down);
  const f = faceTrack(FACES6, TRACK6, t);
  drawPepin(ctx, {
    ...f,
    lean: lean + shake * 0.006 * Math.sin(t * 83),
    squash,
    tilt: (f.tilt ?? 0) + (lean6(t - 0.09) - lean) * 1.4 + shake * 0.02 * Math.sin(t * 71),
    ears: 0.1 + squash6(t - 0.07) * 3 + (lean6(t - 0.12) - lean) * 2,
    tailSide: -1,
    tail: -0.08 + lean6(t - 0.16) * 2.5,
    hands: { l: [lx, jy + ly], r: right },
    thumbs: { r: popped ? 0 : -0.7 - 0.9 * turn6(t) },
    held: c => drawJar(c, 0, jy, fight, { open: popped, turn: turn6(t) * 25 }),
  }, at[0] + shake * 0.7 * Math.sin(t * 97), at[1], FOX_SCALE);

  // The lid, gone: up and away out of the frame, spinning.
  const k = span(t, POP6, POP6 + 0.8);
  if (k > 0 && k < 1) {
    const [sx, sy] = toWorld([0, HOLD[1] - JAR_H / 2 - 10], FOX, FOX_SCALE, lean6(POP6), squash6(POP6));
    ctx.save();
    ctx.translate(sx + 140 * k, sy - 330 * k + 160 * k * k); ctx.scale(FOX_SCALE, FOX_SCALE);
    drawLid(ctx, 0, 0, k * 14);
    ctx.restore();
    burst(ctx, sx, sy, span(t, POP6, POP6 + 0.6));
  }
  ctx.restore();
}

function burst(ctx, x, y, k) {
  if (k <= 0 || k >= 1) return;
  ctx.globalAlpha = 1 - k;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3, d = 10 + 44 * ease.out(k);
    const at = dd => [x + Math.cos(a) * dd, y + Math.sin(a) * dd * 0.8];
    if (i % 2) star(ctx, ...at(d), 6 * (1 - k * 0.5));
    else shape(ctx, null, c => { c.moveTo(...at(d - 14)); c.lineTo(...at(d)); }, 2, '#7f2f0a');
  }
  ctx.globalAlpha = 1;
}

function star(ctx, x, y, r) {
  shape(ctx, '#ffe14d', c => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, d = i % 2 ? r * 0.4 : r;
      c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    c.closePath();
  }, 1.6, '#b07a10');
}

// --- shot 7, 16–19.3 s, wide: he fishes out a pickle, admires it, crunches it. The sky is all meteor ---

const FOX7 = [FOX[0] - 26, FOX[1]]; // where the stagger left him
const FACES7 = {
  wow: FACES6.wow,
  look: { ...POSES.joy, gaze: [0, 1], lid: 0.2 },
  admire: { ...POSES.joy, gaze: [0.7, -0.8], pupil: 1.3, tilt: 0.06 },
  open: { ...POSES.joy, gaze: [0.4, -0.2], open: 1 },
  chew: { ...POSES.joy, lid: 0.8, lidTilt: -0.3, mouth: 'smile', tilt: 0.05 },
};
const TRACK7 = [[0, 'wow'], [0.2, 'look'], [0.8, 'admire'], [1.6, 'open'], [1.95, 'chew']];
const CRUNCH7 = 1.95;
const bounce7 = t => 0.03 * Math.abs(Math.sin(t * 7)) * span(t, 0.8, 1.0);

function shot7(ctx, T, t) {
  drawGarden(ctx, W, H, sky(T), c => meteor(c, T));
  drawTable(ctx, TABLE.x, TABLE.y, TABLE.w);
  drawSandwich(ctx, 505, TABLE.y);
  if (T >= XRAY) return; // from here on he is bones, then pieces (drawn over the light, see draw)
  shape(ctx, 'rgba(90,120,50,0.25)', c => c.ellipse(FOX7[0], FOX7[1], 56, 8, 0, 0, Math.PI * 2), 0);

  const jarTop = [0, HOLD[1] - JAR_H / 2 - 4];
  const k = [span(t, 0.2, 0.5), span(t, 0.5, 0.8), span(t, 0.8, 1.1), span(t, 1.6, 1.95)];
  const rest = [58, -66], dip = [4, jarTop[1] + 8], high = [64, -206], mouth = [18, -140];
  let right = mix2(rest, dip, ease.inOut(k[0]));
  right = mix2(right, jarTop, ease.out(k[1]));
  right = mix2(right, high, ease.outBack(k[2]));
  right = mix2(right, mouth, ease.inOut(k[3]));
  right = mix2(right, [34, -128], ease.inOut(span(t, 2.1, 2.4)));
  const chewing = t > CRUNCH7 ? Math.sin((t - CRUNCH7) * 22) : 0;
  const f = faceTrack(FACES7, TRACK7, t);
  const holding = t >= 0.5;
  const blast = ease.out(span(T, IMPACT + 0.05, IMPACT + 0.2)); // the blast wave reaches the garden
  drawPepin(ctx, {
    ...f,
    mouth: t > CRUNCH7 + 0.1 ? (chewing > 0 ? 'smile' : 'frown') : f.mouth,
    lean: 0.02 * Math.sin(t * 3),
    squash: breath(T) - bounce7(t),
    headY: t > CRUNCH7 ? 2 * chewing : 0,
    tilt: (f.tilt ?? 0),
    ears: 0.05 - 0.12 * span(t, 0.8, 1.0) + 0.7 * blast,
    tailSide: -1,
    tail: -0.08 + 0.3 * Math.sin(t * 13) * span(t, 0.8, 1.1) * (1 - blast) + 0.6 * blast,
    hands: { l: [-JAR_W / 2 - 4, HOLD[1] + 16], r: right },
    held: c => drawJar(c, 0, HOLD[1], 0, { open: true, pickles: holding ? 3 : 4 }),
    inPaws: holding ? { r: (c, x, y) => pickle(c, x, y, t) } : undefined,
  }, ...FOX7, FOX_SCALE);
}

// A pickle held upright in a paw; after the crunch its top is gone.
function pickle(ctx, x, y, t) {
  const bitten = t > CRUNCH7;
  const h = bitten ? 11 : 18;
  shape(ctx, '#6fae3f', c => c.ellipse(x + 2, y - 4 - h, 8, h, 0.15, 0, Math.PI * 2), 2, '#3d6b1f');
  if (bitten) shape(ctx, '#d8efb0', c => c.ellipse(x + 0.5, y - 4 - h * 2 + 2, 6, 2.5, 0.15, 0, Math.PI * 2), 1.4, '#3d6b1f');
  for (const [dx, dy] of [[-3, -12], [4, -20], [-1, -26]].slice(0, bitten ? 1 : 3)) {
    shape(ctx, '#3d6b1f', c => c.arc(x + 2 + dx, y - 4 + dy, 1.3, 0, Math.PI * 2), 0);
  }
  if (t > 1.1 && t < 1.6) star(ctx, x + 16, y - 44, 6 * (0.6 + 0.4 * Math.sin(t * 14)));
}

// --- the end, 19–20 s: bones, pieces, the lens, the eye ---

const BONE = '#f4efe2', BONE_LINE = '#3a2a2a';

// In the flash, Pépin as an X-ray: a dark shape and white bones, still holding his pickle.
function xray(ctx) {
  ctx.save();
  ctx.translate(...FOX7); ctx.scale(FOX_SCALE, FOX_SCALE);
  const flesh = 'rgba(58,42,42,0.85)';
  shape(ctx, flesh, c => c.ellipse(0, -72, 50, 66, 0, 0, Math.PI * 2), 0);
  shape(ctx, flesh, c => c.ellipse(0, -180, 72, 56, 0, 0, Math.PI * 2), 0);
  for (const side of [-1, 1]) shape(ctx, flesh, c => { c.moveTo(side * 26, -222); c.lineTo(side * 62, -276); c.lineTo(side * 68, -196); c.closePath(); }, 0);
  shape(ctx, flesh, c => { c.moveTo(-20, -40); c.bezierCurveTo(-110, -40, -130, -120, -100, -180); c.lineTo(-70, -175); c.bezierCurveTo(-90, -110, -70, -70, -18, -66); c.closePath(); }, 0);
  const bone = (trace, lw = 2) => shape(ctx, BONE, trace, lw, BONE_LINE);
  const limb = (a, b) => { shape(ctx, null, c => { c.moveTo(...a); c.lineTo(...b); }, 7, BONE); for (const [x, y] of [a, b]) bone(c => c.arc(x, y, 5, 0, Math.PI * 2)); };
  for (let i = 0; i < 9; i++) bone(c => c.arc(-30 - i * 9, -60 - i * 13, 4.5, 0, Math.PI * 2), 1.5); // tail
  for (let y = -136; y < -40; y += 16) bone(c => c.roundRect(-6, y, 12, 12, 3), 1.5); // spine
  for (let i = 0; i < 4; i++) {
    const y = -122 + i * 14;
    for (const side of [-1, 1]) shape(ctx, null, c => { c.moveTo(side * 6, y); c.quadraticCurveTo(side * 40, y - 6, side * 34, y + 14); }, 4, BONE);
  }
  bone(c => c.ellipse(0, -38, 26, 10, 0, 0, Math.PI * 2));
  for (const side of [-1, 1]) limb([side * 14, -36], [side * 20, -8]);
  limb([-36, -108], [-32, -34]);
  limb([36, -108], [34, -128]);
  bone(c => c.ellipse(0, -186, 46, 40, 0, 0, Math.PI * 2));
  bone(c => c.ellipse(0, -150, 30, 13, 0, 0, Math.PI * 2));
  for (const side of [-1, 1]) shape(ctx, '#161010', c => c.ellipse(side * 16, -192, 11, 13, 0, 0, Math.PI * 2), 0);
  shape(ctx, '#161010', c => { c.moveTo(-4, -168); c.lineTo(4, -168); c.lineTo(0, -160); c.closePath(); }, 0);
  for (let x = -14; x <= 14; x += 7) shape(ctx, null, c => { c.moveTo(x, -156); c.lineTo(x, -146); }, 1.5, BONE_LINE);
  shape(ctx, 'rgba(58,42,42,0.9)', c => c.roundRect(-JAR_W / 2, HOLD[1] - JAR_H / 2, JAR_W, JAR_H, 10), 0);
  pickle(ctx, 34, -128, 18); // the pickle is not X-rayed
  ctx.restore();
}

// He comes apart: pieces of fur, cream and red fly out and fall, blood sprays, a puddle spreads.
const GIB_KINDS = ['fur', 'cream', 'meat', 'ear', 'fur', 'meat', 'cream', 'tail', 'fur', 'meat', 'paw', 'pickle'];
function gibs(ctx, t) {
  const k = t - BURST;
  const [cx, cy] = [FOX7[0], FOX7[1] - 100 * FOX_SCALE];
  const at = (i, speed, spread) => {
    const a = -Math.PI * (0.5 + (rand(i + 200) - 0.5) * spread), v = speed * (0.45 + 0.55 * rand(i + 300));
    return [cx + Math.cos(a) * v * k, cy + Math.sin(a) * v * k + 450 * k * k];
  };
  shape(ctx, BLOOD, c => c.ellipse(FOX7[0], FOX7[1], 80 * ease.out(span(k, 0, 0.3)), 11 * ease.out(span(k, 0, 0.3)), 0, 0, Math.PI * 2), 2, BLOOD_DARK);
  for (let i = 0; i < 44; i++) {
    const [x, y] = at(i + 50, 700, 1.9), [px, py] = at(i + 50, 700, 1.9).map((v, j) => v - (j ? (y - cy) : (x - cx)) * 0.12);
    shape(ctx, null, c => { c.moveTo(px, py); c.lineTo(x, y); }, 2 + 3 * rand(i + 90), BLOOD);
  }
  GIB_KINDS.forEach((kind, i) => {
    const [x, y] = at(i, 520, 1.6), size = (12 + 12 * rand(i + 400)) * FOX_SCALE;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(k * (rand(i + 500) - 0.5) * 30);
    if (kind === 'ear') shape(ctx, '#f2802e', c => { c.moveTo(-size, size); c.lineTo(0, -size * 1.6); c.lineTo(size, size); c.closePath(); }, 2, '#7f2f0a');
    else if (kind === 'tail') { shape(ctx, '#f2802e', c => c.ellipse(0, 0, size * 1.6, size * 0.7, 0, 0, Math.PI * 2), 2, '#7f2f0a'); shape(ctx, '#fff3e2', c => c.ellipse(size * 1.1, 0, size * 0.6, size * 0.55, 0, 0, Math.PI * 2), 2, '#7f2f0a'); }
    else if (kind === 'paw') shape(ctx, '#5b2a16', c => c.arc(0, 0, size * 0.8, 0, Math.PI * 2), 2, '#2a120a');
    else if (kind === 'pickle') pickle(ctx, 0, 30, 18);
    else {
      const fill = kind === 'fur' ? '#f2802e' : kind === 'cream' ? '#fff3e2' : BLOOD;
      shape(ctx, fill, c => blob(c, 0, 0, size, i), 2, kind === 'meat' ? BLOOD_DARK : '#7f2f0a');
      if (kind !== 'meat') shape(ctx, BLOOD, c => blob(c, size * 0.35, size * 0.3, size * 0.55, i + 7), 0);
    }
    ctx.restore();
  });
}

// What lands on the lens stays on the lens, even over the black, and runs down it.
const SPLATS = [
  { at: BURST + 0.02, x: 92, y: 392, r: 40 },
  { at: 19.22, x: 150, y: 138, r: 62 },
  { at: 19.29, x: 505, y: 108, r: 48 },
  { at: 19.35, x: 522, y: 372, r: 72 },
];
const lens = (ctx, t) => lensSplats(ctx, t, SPLATS, { tuft: (c, x, y, r) => shape(c, '#f2802e', p => blob(p, x, y, r, 5), 2, '#7f2f0a') }); // a tuft of fur, stuck

// Black. His eye rolls in and stops next to the pickle, which came through without a scratch. The end.
function shot8(ctx, T) {
  ctx.fillStyle = '#000';
  ctx.fillRect(-20, -20, W + 40, H + 40);
  const ground = 400;
  ctx.save();
  ctx.translate(372, ground - 12); ctx.scale(2, 2); ctx.rotate(Math.PI / 2 - 0.1);
  pickle(ctx, 0, 0, 18);
  ctx.restore();
  if (T >= 19.58) {
    const ex = keys(T, [[19.58, -40], [19.9, 300, ease.out]]), roll = (ex + 40) / 24, R = 24;
    shape(ctx, null, c => { c.moveTo(-40, ground + R - 2); c.lineTo(ex, ground + R - 2); }, 6, 'rgba(179,18,30,0.8)');
    shape(ctx, null, c => { c.moveTo(ex - R + 4, ground + 6); c.quadraticCurveTo(ex - R - 22, ground - 10, ex - R - 44, ground + 14); }, 6, BLOOD);
    shape(ctx, BONE, c => c.arc(ex, ground, R, 0, Math.PI * 2), 3, '#9a8f7a');
    for (let v = 0; v < 4; v++) {
      const a = roll + v * 1.6;
      shape(ctx, null, c => { c.moveTo(ex + Math.cos(a) * R * 0.55, ground + Math.sin(a) * R * 0.55); c.quadraticCurveTo(ex + Math.cos(a + 0.3) * R * 0.8, ground + Math.sin(a + 0.3) * R * 0.8, ex + Math.cos(a) * R * 0.95, ground + Math.sin(a) * R * 0.95); }, 1.6, BLOOD);
    }
    const settle = 1 - span(T, 19.86, 19.95); // it stops looking at us
    const [ix, iy] = [ex + Math.cos(roll) * R * 0.45 * settle, ground + Math.sin(roll) * R * 0.45 * settle];
    shape(ctx, '#5b8f3a', c => c.arc(ix, iy, R * 0.42, 0, Math.PI * 2), 0);
    shape(ctx, '#161010', c => c.arc(ix, iy, R * 0.22, 0, Math.PI * 2), 0);
  }
  if (T < 19.7) return;
  ctx.globalAlpha = span(T, 19.7, 19.9);
  label(ctx, 'FIN', W / 2, 215, 76, '#fdf4da', '#7f2f0a');
  label(ctx, '(du monde)', W / 2, 280, 30, '#fdf4da', '#7f2f0a');
  ctx.globalAlpha = 1;
}

// --- over every shot ---

// The meteor shakes the ground more and more.
const quake = T => keys(T, [[9, 0], [12, 1.5], [16, 4], [IMPACT, 7], [IMPACT + 0.05, 18], [BLACKOUT, 14]], ease.in);
function shakeCamera(ctx, T) {
  const a = quake(T), n = Math.floor(T * 30);
  ctx.translate((rand(n) - 0.5) * 2 * a, (rand(n + 500) - 0.5) * 2 * a);
}

// Light: the cloud's shadow, the meteor's red glare, its growing shadow, then the white flash.
function light(ctx, T) {
  // The cloud's shadow falls on the garden, not on the sky: only the lower part of the frame.
  if (cloudShade(T) > 0) {
    ctx.save();
    const g = ctx.createLinearGradient(0, 190, 0, 300);
    g.addColorStop(0, 'rgba(30,42,80,0)'); g.addColorStop(1, 'rgba(30,42,80,1)');
    ctx.globalAlpha = cloudShade(T) * 0.8; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g;
    ctx.fillRect(0, 190, W, H - 190);
    ctx.restore();
  }
  const layers = [
    [sky(T)[0], keys(T, [[10, 0], [17, 0.3]], ease.linear), 'multiply'],
    ['#2a0a00', keys(T, [[14, 0], [18.5, 0.25], [IMPACT, 0.25], [IMPACT + 0.05, 0]], ease.linear), 'multiply'],
    ['#ffffff', keys(T, [[18.6, 0], [IMPACT, 0.1], [XRAY, 0.9], [BURST, 0.9], [BURST + 0.06, 0.25], [BLACKOUT, 0.35]], ease.in), 'source-over'],
  ];
  for (const [color, alpha, op] of layers) {
    if (alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op; ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

const SHOTS = [[0, shot1], [3, shot2], [6, shot3], [8, shot4], [10, shot5], [12, shot6], [16, shot7], [BLACKOUT, shot8]];

function draw(ctx, t) {
  const [at, shot] = SHOTS.findLast(([start]) => start <= t) ?? SHOTS[0];
  ctx.save();
  if (t < BLACKOUT) shakeCamera(ctx, t);
  shot(ctx, t, t - at);
  ctx.restore();
  if (t < BLACKOUT) light(ctx, t);
  if (t >= XRAY && t < BURST) xray(ctx);
  if (t >= BURST && t < BLACKOUT) gibs(ctx, t);
  if (t >= BURST) lens(ctx, t);
  title(ctx, t);
  countdown(ctx, t);
}

function title(ctx, t) {
  if (t < 0.2 || t > 2.3) return;
  const k = ease.outBack(span(t, 0.2, 0.55));
  ctx.globalAlpha = 1 - span(t, 1.9, 2.3);
  label(ctx, '20 s avant', W / 2, 118, 34 * k, '#ffe14d', '#7f2f0a');
  label(ctx, 'la fin du monde', W / 2, 162, 50 * k, '#ff6a3d', '#7f2f0a');
  ctx.globalAlpha = 1;
}

function countdown(ctx, t) {
  const s = Math.max(0, Math.ceil(20 - t));
  // Kept clear of the corners: every room's screen is rounded there.
  box(ctx, 488, 44, 96, 38, '#2a2320', 8);
  ctx.font = '700 26px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff5a3c';
  ctx.fillText(`00:${String(s).padStart(2, '0')}`, 536, 64);
}

export default { title: '20 s avant la fin du monde', duration: 20, cues, draw };

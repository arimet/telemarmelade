// « 20 s avant que le piano ne tombe » — pixel art. Bémol dances at a bus stop under a piano
// that two bears hoist by hand, the rope dragged over a balcony's iron rail until it gives.
// draw(ctx, t) builds a 160×120 frame of the world at time t and shows it ×4.
// Sprites, bears, ropes and pianos move on the 12 fps grid (T = step(t)); the camera scrolls on
// raw t, a whole pixel at a time, like a 16-bit game.
// The street shots all draw the same world at global time, only framed differently, so what
// happens off screen (a hop, a heave, a fibre drifting down) is still true when we cut back.
import { W, span, ease, keys, lerp, rand } from '../engine.js';
import { frame, present, rect, stamp, step, text, textWidth, dither, zoom2, PW } from '../pixel.js';
import { drawBemol, BANG, PHONES_DOWN } from '../characters/bemol.js';
import { drawStreet, drawRails, drawBusStop, MOVER, MOVER_STARE, MOVER_SHOCK, PAW, BALCONY_A, BALCONY_B, GROUND } from '../sets/pixel-street.js';
import { drawPiano, drawRopeCloseup, WRECK } from '../props/piano.js';

const F = 1 / 12, FPS = 12;
const frameOf = T => Math.round(T * FPS);
const G = 147; // gravity in pixels: 1 m is about 15 px

// --- the hoisting ---

// Each bear heaves the rope hand over hand: a heave pulls it HEAVE pixels over the rail, and the
// piano on the other end rises by exactly as much. A piano is heavy: few heaves, far apart.
const HEAVE = 4, HEAVE_LEN = 0.9;
const A = { ...BALCONY_A, knot: 150, heaves: [2.1, 3.9, 6.3, 7.3, 10.85] };
const B = { ...BALCONY_B, knot: 96, heaves: [0.05] }; // B stays above the street framing until it falls
// How far one heave has got, 0 → 1: a slow start, a little past, then the rope springs back.
const heave = (T, h) => keys(T, [[h + 0.12, 0], [h + 0.42, 1.12], [h + 0.52, 1, ease.out]]);
const pulled = (T, heaves) => heaves.reduce((sum, h) => sum + HEAVE * heave(T, h), 0);

// The rope saws on the rail's corner at every heave: a strand goes at the 3rd and 4th, and the
// 5th heave's pull breaks the last one.
const CUTS = [A.heaves[2] + 0.35, A.heaves[3] + 0.35];
const SNAP = 11.25;
const KNOT_SNAP = A.knot - pulled(SNAP, A.heaves);
const A_DOWN = GROUND - 28; // knot height when the piano's feet touch the pavement
const CRASH = SNAP + Math.sqrt((2 * (A_DOWN - KNOT_SNAP)) / G);
const CRASH_F = Math.ceil(CRASH * FPS); // the first frame with the wreck

// Bear B lets go when he slaps his cheeks. The rope running over his rail brakes the fall a
// little: it comes down at 0.4 g, which leaves Bémol the time to notice and look up.
const RELEASE = 16.45, B_ACC = 60;
const KNOT_B = B.knot - pulled(RELEASE, B.heaves);
const EARS_TOP = GROUND - 32; // Bémol's ear tips
const CONTACT_F = Math.ceil((RELEASE + Math.sqrt((2 * (EARS_TOP - 28 - KNOT_B)) / B_ACC)) * FPS);
const SQUASH = CONTACT_F * F; // piano B lands on him
const KEY_LAND = SQUASH + 1.05; // a key flung up by the crash comes down in the puddle
const BLACK = SQUASH + 1.45, FIN = BLACK; // then « FIN » over the scene, dimmed
// Shot 7 is a close shot of balcony B, world rows 50–109: it lasts until the falling piano has left it.
const CLOSE_B = { x: B.x - 32, y: 50 }; // bear A, one bay left, stays out of it
const EXIT_B = Math.ceil((RELEASE + Math.sqrt((2 * (CLOSE_B.y + 60 - KNOT_B)) / B_ACC)) * FPS) * F;

const knotA = T => (T < SNAP ? A.knot - pulled(T, A.heaves) : Math.min(A_DOWN, KNOT_SNAP + 0.5 * G * (T - SNAP) ** 2));
const knotB = T => (T < RELEASE ? B.knot - pulled(T, B.heaves) : Math.min(EARS_TOP - 28, KNOT_B + 0.5 * B_ACC * (T - RELEASE) ** 2));
// A piano on its rope keeps swinging a little after each heave, a pixel either way.
function sway(T, heaves) {
  const h = heaves.findLast(h => h + 0.5 <= T);
  return h === undefined ? 0 : Math.round(1.3 * Math.sin((2 * Math.PI * (T - h - 0.5)) / 1.4) * Math.exp(-(T - h - 0.5) / 1.6));
}

// Where a bear is: which sprite, body lean, his paws on the rope (none once he let go).
function bearAt(T, { x, y: R, heaves }, who) {
  const low = R - 2, high = R - 5; // paws on his chest, below his muzzle even at the top of a heave
  if (who === 'B' && T >= RELEASE) {
    // Paws fly off the rope to his cheeks: one frame on the way, then the slap.
    return frameOf(T) <= frameOf(RELEASE) + 1 && T < RELEASE + 2 * F
      ? { x, R, sprite: MOVER_STARE, lean: -1, paws: [R - 9, R - 10], spread: 4 }
      : { x, R, sprite: MOVER_SHOCK, lean: T < RELEASE + 0.3 ? -1 : 0, paws: [] };
  }
  if (who === 'A' && T >= SNAP) {
    // The rope goes slack in his paws: he staggers back, then stares down after the piano.
    return { x, R, sprite: T < SNAP + 0.3 ? MOVER : MOVER_STARE, lean: T < SNAP + 0.3 ? -2 : 0, paws: [low, high] };
  }
  // B stares down at the wreck, looks up at us (did you see that?), stares down again.
  const staring = who === 'B' && T >= CRASH + 0.4 && !(T >= 15.6 && T < 15.9);
  const h = heaves.findLast(h => h <= T) ?? -9, p = (T - h) / HEAVE_LEN;
  const tremble = T >= 15.9 && frameOf(T) % 2 ? 1 : 0; // it dawns on him
  if (p >= 1) return { x, R, sprite: staring ? MOVER_STARE : MOVER, lean: tremble, paws: [low, high] };
  // Crouch to get a grip, lean back into the heave, straighten. Hand over hand: both paws haul the
  // rope up together, then the high paw lets go and reaches down past the other to grip low again.
  const pull = HEAVE * heave(T, h), regrip = ease.inOut(span(p, 0.6, 0.9));
  return {
    x, R, sprite: MOVER,
    lean: p < 0.13 ? 1 : p < 0.5 ? -1 : 0,
    paws: [low - pull, regrip ? lerp(high - HEAVE, low, regrip) : high - pull],
  };
}

// A rope from y0 down to y1, 1 px wide; its dark marks travel with it as it runs.
function rope(f, x, y0, y1, run, oy, swing = 0) {
  for (let yy = Math.round(y0); yy < y1; yy++) {
    rect(f, x + (yy > (y0 + y1) / 2 ? swing : 0), yy - oy, 1, 1, (((yy + Math.round(run)) % 5) + 5) % 5 ? 'b' : 'B');
  }
}

// A piano's shadow on the pavement: the lower it gets, the bigger and darker.
function shadow(f, x, knot, oy) {
  const h = GROUND - (knot + 28);
  const level = Math.round(Math.min(12, Math.max(0, 14 * (1 - h / 120))));
  if (level <= 0) return;
  const w = Math.round(26 - (16 * h) / 120);
  for (const [dy, k] of [[-2, 0.55], [-1, 0.9], [0, 1], [1, 0.8]]) {
    const ww = Math.round(w * k);
    dither(f, Math.round(x - ww / 2), GROUND + dy - oy, ww, 1, null, 'g', level, oy);
  }
}

// --- Bémol ---

const L = A.x, R = B.x; // his two dance spots: under piano A, and one hop right, under piano B
const HOPS = [[18, 11], [24, 36], [30, L]]; // shot 1: landing frame and x, 4 frames in the air each
const START_X = -14, AIR = 4;

function hopIn(n) {
  const i = HOPS.findIndex(([land]) => n < land);
  const [land, x1] = HOPS[i] ?? [];
  if (i >= 0 && n >= land - AIR) return air((n - land + AIR) / AIR, i ? HOPS[i - 1][1] : START_X, x1, 'right');
  const [last, x] = HOPS[i - 1] ?? HOPS.at(-1), d = n - last; // frames since he landed
  const final = i === -1;
  return { x: i === 0 ? START_X : x, y: GROUND, pose: {
    // Landing squash; then either the crouch for the next hop, or a stretch past rest and a settle.
    sink: d === 0 ? 2 : final ? [0, -1, 0][d] ?? 0 : 1,
    ears: d === 0 ? 'lean' : d < 3 ? 'short' : 'up', // they carry on down after the feet stop
    strings: d === 1 ? 1 : 0,
    head: final && d >= 3 ? 'left' : 'right', // a glance at the bus stop sign: this is the stop
  } };
}

// One frame of a hop from x0 to x1, k = 0 (take-off) … 0.75.
function air(k, x0, x1, head) {
  const left = x1 < x0;
  return { x: Math.round(lerp(x0, x1, k)), y: GROUND - Math.round(28 * k * (1 - k)), pose: {
    head,
    body: k > 0 && k < 0.75 ? 'hop' : 'idle',
    sink: k === 0 || k === 0.75 ? -1 : 0, // stretched pushing off, and reaching for the ground
    ears: k === 0 ? 'short' : k === 0.5 ? 'lean2' : 'lean', // trailing behind, folded by the push
    earsFlip: left,
    strings: left ? 1 : -1,
  } };
}

// The dance, from 3 s: a two-second loop of four beats. Bob at L, bob, hop right, bob at R, hop
// back. Eyes shut: he knows the steps. From 8 s his paws beat time too.
const DANCE_F = 36, LOOP = 24;
function dance(n) {
  const j = (n - DANCE_F) % LOOP;
  if (j >= 8 && j < 12) return air((j - 8) / 4, L, R, 'happy');
  if (j >= 20) return air((j - 20) / 4, R, L, 'happy');
  const beat = j < 6 ? 0 : j < 12 ? 6 : j < 18 ? 12 : 18, d = j - beat;
  const landed = (beat === 0 && n > DANCE_F) || beat === 12; // at 3 s he has been standing a while
  const sway = Math.floor(j / 6) % 2 ? -1 : 1;
  return { x: j < 12 ? L : R, y: GROUND, pose: {
    head: 'happy',
    sink: d === 0 ? (landed ? 2 : 1) : j === 7 || j === 19 ? 1 : 0, // on the beat; crouched before a hop
    ears: d === 0 && landed ? 'lean' : d === 1 && landed ? 'short' : 'up',
    earsFlip: beat === 0, // he came from the right
    headX: d < 3 ? sway : 0,
    body: n * F >= 8 ? (d >= 1 && d <= 3 ? 'dance' : 'idle') : d >= 2 && d <= 4 ? 'tap' : 'idle',
    strings: d === 1 ? (beat === 0 ? -1 : 1) : 0,
  } };
}

// After the crash, standing at R: he jumps out of his skin, stares at the wreck, wipes his brow.
const WIPE = [[9, -16], [4, -21], [2, -21], [-1, -21], [-4, -21], [-9, -17]]; // paw path, from his feet: up by his cheek, across the brow, flicked off
function aftermath(n) {
  const d = n - CRASH_F;
  const pose = { phones: 'off' };
  let y = GROUND;
  if (d <= 4) {
    y -= [0, 4, 6, 3, 0][d];
    Object.assign(pose, { head: 'alarm', body: d === 2 ? 'hop' : 'idle', sink: d === 4 ? 2 : d === 1 ? -1 : 0 });
  } else if (d <= 8) Object.assign(pose, { head: 'alarm' });
  else if (d <= 16) Object.assign(pose, { head: 'left', ears: d === 9 ? 'short' : 'up' }); // the wreck is to his left
  else if (d <= 19) Object.assign(pose, { head: 'idle' });
  else if (d <= 25) Object.assign(pose, { head: 'happy', body: 'reach', paw: WIPE[d - 20] });
  else if (d <= 32) Object.assign(pose, { head: 'happy', sink: d <= 27 ? 1 : 0 }); // « Ouf ! », breathing out
  else Object.assign(pose, { head: 'idle' });
  return { x: R, y, pose, ouf: d >= 26 && d <= 33, sweat: d >= 25 && d <= 28 ? d - 25 : -1 };
}

// Shot 8: an ear twitches at the whistle, the shadow darkens round his feet, he looks down at it,
// then up. Counted back from the contact.
const HEAR_F = CONTACT_F - 8;
function lookUp(n) {
  const b = aftermath(n), d = n - HEAR_F;
  if (d < 0) return b;
  const pose = { phones: 'off', head: 'idle' };
  if (d === 0) pose.ears = 'short'; // a twitch: a sound
  else if (d <= 3) pose.head = 'down'; // the shadow
  else Object.assign(pose, { head: 'alarm', body: 'alarm' }); // paws to his cheeks, like the bear
  if (n >= CONTACT_F) Object.assign(pose, { ears: 'short', sink: 1 });
  return { x: R, y: GROUND, pose, bang: d >= 5 };
}

function bemolAt(T) {
  const n = frameOf(T);
  if (n < DANCE_F) return hopIn(n);
  if (n < CRASH_F + 1) return dance(n);
  return n < HEAR_F ? aftermath(n) : lookUp(n);
}

// --- the headphones, knocked off by his jump, clattering to the pavement ---

const PH_V = [45, -70], PH_G = 300, PH_Y0 = GROUND - 28;
const PH_T = (-PH_V[1] + Math.sqrt(PH_V[1] ** 2 + 2 * PH_G * 23)) / PH_G; // time to fall 23 px to the pavement
const PH_LAND = (CRASH_F + 1) * F + PH_T;
function phonesAt(T) {
  const dt = T - (CRASH_F + 1) * F;
  if (dt < 0) return null;
  if (dt < PH_T) return [R - 5 + PH_V[0] * dt, PH_Y0 + PH_V[1] * dt + 0.5 * PH_G * dt * dt];
  const b = T - PH_LAND; // one small bounce, then still
  return [R - 5 + PH_V[0] * PH_T + Math.min(b, 0.2) * 20, GROUND - 5 - (b < 0.2 ? Math.round(12 * b * (0.2 - b) * 25) : 0)];
}

// --- debris: keys and planks flung out by the crash, dust rolling out and settling ---

const DEBRIS = Array.from({ length: 16 }, (_, i) => ({
  x: L + (rand(i) - 0.5) * 18, vx: (rand(i + 30) - 0.5) * 150, vy: -(50 + rand(i + 60) * 90),
  floor: GROUND - 1 + Math.round(rand(i + 90) * 7), key: i % 3 !== 0,
}));
function debris(f, T, oy) {
  const dt = T - CRASH_F * F;
  if (dt < 0) return;
  for (const p of DEBRIS) {
    const tl = (-p.vy + Math.sqrt(p.vy ** 2 + 2 * 300 * (p.floor - (GROUND - 8)))) / 300; // time to its landing
    const t = Math.min(dt, tl);
    const x = Math.round(p.x + p.vx * t), y = Math.round(GROUND - 8 + p.vy * t + 150 * t * t);
    if (p.key) { rect(f, x, y - oy, 2, 1, 'w'); rect(f, x, y + 1 - oy, 2, 1, 'k'); } else { rect(f, x, y - oy, 3, 1, 'b'); rect(f, x, y + 1 - oy, 3, 1, 'B'); }
  }
}
// Solid puffs rolling out low, lit from above, then thinning out into a stipple and gone.
function dust(f, T, oy) {
  const k = span(T, CRASH_F * F, CRASH_F * F + 1);
  if (k <= 0 || k >= 1) return;
  const level = k < 0.5 ? 16 : Math.round((16 * (1 - k)) / 0.5);
  for (let i = 0; i < 5; i++) {
    const cx = Math.round(L + (i - 2) * (8 + 6 * ease.out(k))), r = Math.round(3 + 6 * ease.out(k) + (i % 2) * 2);
    const cy = GROUND - 3 - r + Math.round(4 * k);
    for (let yy = -r; yy <= r; yy++) {
      const w = Math.round(Math.sqrt(r * r - yy * yy) * 1.3);
      dither(f, cx - w, cy + yy - oy, 2 * w, 1, null, yy < -r / 2 ? 'w' : 'c', level, oy);
    }
  }
}

// Hemp fibres from the cut strands drifting down past him, too light to fall straight.
function fibres(f, T, oy) {
  CUTS.forEach((c, s) => {
    for (let i = 0; i < 5; i++) {
      const dt = T - c;
      if (dt < 0) continue;
      const y = A.y + 1 + dt * (15 + 4 * rand(s * 10 + i)), x = A.x - 2 + i + 5 * Math.sin(dt * 2.2 + i * 1.7) + dt * (i - 2);
      if (y < GROUND) rect(f, Math.round(x), Math.round(y) - oy, 1, 1, (i + frameOf(T)) % 3 ? 'l' : 'b');
    }
  });
}

// --- the world, framed from row oy ---

function world(f, oy, T) {
  drawStreet(f, oy);
  const bears = [bearAt(T, A, 'A'), bearAt(T, B, 'B')];
  for (const b of bears) stamp(f, b.sprite, b.x - 7, b.R - 17 + b.lean - oy);
  drawRails(f, oy);

  // Piano A: hoisted, swinging, then falling with its half of the rope, then a wreck.
  const kA = Math.round(knotA(T)), swA = T < SNAP ? sway(T, A.heaves) : 0, [ba, bb] = bears;
  const top = b => Math.round(Math.min(...b.paws));
  if (T < SNAP) rope(f, A.x, top(ba), kA, pulled(T, A.heaves), oy, swA);
  else {
    rope(f, A.x, top(ba), A.y + 5, 0, oy); // the stub left in the bear's paws, dangling over the rail
    if (frameOf(T) < CRASH_F) rope(f, A.x, kA - (KNOT_SNAP - A.y), kA, 0, oy);
  }
  if (frameOf(T) < CRASH_F) { shadow(f, A.x, kA, oy); drawPiano(f, A.x + swA, kA - oy); } else stamp(f, WRECK, A.x - 15, GROUND - 16 - oy);

  // Piano B: waiting under its balcony, then running down on its rope.
  const kB = Math.round(knotB(T)), crushed = frameOf(T) >= CONTACT_F;
  rope(f, B.x, T < RELEASE ? top(bb) : B.y - 3, crushed ? GROUND - 16 : kB, pulled(T, B.heaves) + (knotB(T) - KNOT_B), oy);
  if (crushed) stamp(f, WRECK, B.x - 15, GROUND - 16 - oy);
  else { shadow(f, B.x, kB, oy); drawPiano(f, B.x, kB - oy); }
  for (const b of bears) for (const py of b.paws) {
    stamp(f, PAW, b.x - 2 + (b.spread ? (py === b.paws[0] ? -b.spread : b.spread) : 0), Math.round(py) - 2 - oy);
  }

  fibres(f, T, oy);
  debris(f, T, oy);
  const bm = bemolAt(T);
  if (crushed) { blood(f, T, oy); squashed(f, T, oy); fallingKey(f, T, oy); } else drawBemol(f, bm.pose, bm.x, bm.y - oy);
  const ph = phonesAt(T);
  if (ph) stamp(f, PHONES_DOWN, Math.round(ph[0]), Math.round(ph[1]) - oy);
  drawBusStop(f, oy); // at the kerb, in front of him
  dust(f, T, oy);
  if (bm.ouf) text(f, 'Ouf !', bm.x - 11, EARS_TOP - 12 - (bm.ouf && frameOf(T) - CRASH_F === 26 ? 1 : 0) - oy, 'w', { ink: 'k' });
  if (bm.sweat >= 0) rect(f, bm.x - 12 - bm.sweat * 2, EARS_TOP + 12 + bm.sweat * bm.sweat - oy, 1, 2, 'U');
  if (bm.bang && !crushed) stamp(f, BANG, bm.x + 9, EARS_TOP - 9 - oy);
}

// --- under piano B ---

// His feet stick out in front of the wreck and kick twice; his ears poke out flat to the right.
function squashed(f, T, oy) {
  const d = frameOf(T) - CONTACT_F;
  const kick = (d >= 4 && d <= 5) || (d >= 9 && d <= 10) ? 1 : 0;
  for (const [fx, lift] of [[R - 9, kick], [R + 3, d >= 9 ? 0 : kick]]) {
    rect(f, fx - 1, GROUND - 5 - lift - oy, 8, 5, 'k');
    rect(f, fx, GROUND - 4 - lift - oy, 6, 3, 'w');
    rect(f, fx + 1, GROUND - 3 - lift - oy, 1, 1, 'p'); rect(f, fx + 4, GROUND - 3 - lift - oy, 1, 1, 'p'); // pads
  }
  for (const [ey, len] of [[GROUND - 5, 9], [GROUND - 8, 7]]) {
    rect(f, R + 14, ey - oy, len, 3, 'k');
    rect(f, R + 14, ey + 1 - oy, len - 1, 1, 'w');
    rect(f, R + 15, ey + 1 - oy, Math.floor(len / 2), 1, 'p');
  }
}

// Blood squirts out both sides of the wreck: drops fly, some hit the shop front and run down it,
// the rest land on the pavement; a puddle spreads, out past his ears to the headphones.
const SPRAY = Array.from({ length: 70 }, (_, i) => ({
  side: i % 2 ? 1 : -1, vx: 30 + rand(i + 700) * 150, vy: -(20 + rand(i + 800) * 130), wall: rand(i + 900) < 0.3,
}));
function blood(f, T, oy) {
  const dt = T - SQUASH;
  const left = Math.round(8 + 14 * ease.out(span(dt, 0, 0.8))), right = Math.round(10 + 26 * ease.out(span(dt, 0.1, 1.1)));
  rect(f, R - left, GROUND - 2 - oy, left + right, 4, 'R');
  rect(f, R - left + 2, GROUND - 1 - oy, left + right - 4, 2, 'r');
  rect(f, R - left + 5, GROUND - 1 - oy, 3, 1, 'p'); // a glint on the wet
  SPRAY.forEach((p, i) => {
    const y0 = GROUND - 6, x0 = R + p.side * 14, g = 220;
    const land = (-p.vy + Math.sqrt(p.vy * p.vy + 2 * g * (GROUND - 1 - y0))) / g; // time to reach the pavement
    const stop = p.wall ? 0.1 + 0.12 * rand(i + 950) : land; // or it hits the shop front, and stays there
    const t = Math.min(dt, stop);
    let x = x0 + p.side * p.vx * t, y = y0 + p.vy * t + 0.5 * g * t * t;
    if (p.wall && dt > stop) y = Math.min(GROUND - 1, y + (dt - stop) * 7); // running down the glass
    const big = i % 2 === 0;
    rect(f, Math.round(x), Math.round(y) - oy, big ? 2 : 1, p.wall && dt > stop ? 3 : big ? 2 : 1, i % 3 ? 'r' : 'R');
  });
}

// One key, thrown up by the crash, comes down in the puddle: plink.
function fallingKey(f, T, oy) {
  const d = KEY_LAND - T, y = Math.round(GROUND - 2 - Math.min(80, 0.5 * 220 * Math.max(0, d) ** 2));
  if (T < KEY_LAND - 0.6) return;
  rect(f, R - 16, y - oy, 3, 1, 'w'); rect(f, R - 16, y + 1 - oy, 3, 1, 'k');
}

// The crash shakes the street for half a second.
const shakeAt = T => {
  const a = 3 * (1 - span(T, CRASH_F * F, CRASH_F * F + 0.5)) * (T >= CRASH_F * F ? 1 : 0), n = frameOf(T);
  return [Math.round((rand(n) - 0.5) * 2 * a), Math.round((rand(n + 500) - 0.5) * 2 * a)];
};

// --- shots ---

const STREET = 120;
const pan = t => Math.round(keys(t, [[0.5, 0], [1.75, 122], [1.95, 120]]));

function shot1(f, t, T) {
  world(f, pan(t), T);
  title(f, T);
}
const street = (f, t, T) => world(f, STREET + shakeAt(T)[1], T);
// After the crash, closer (a 2× integer zoom of the street): the wreck, his feet, the blood.
const CLOSE_W = { x: R - 40, y: GROUND - 45 };
function wreckClose(f, t, T) {
  const w = frame();
  world(w, CLOSE_W.y, T);
  zoom2(f, w, CLOSE_W.x, 0, 80, 60);
}
function balconyB(f, t, T) {
  const w = frame();
  world(w, CLOSE_B.y, T);
  zoom2(f, w, CLOSE_B.x, 0, 80, 60);
}
function closeUp(f, t, T) {
  drawRopeCloseup(f, {
    cut: CUTS.filter(c => T >= c).length,
    run: pulled(Math.min(T, SNAP), A.heaves) * 7, // 1 px of rope from afar is 7 px here
    thin: span(T, A.heaves[4] + 0.12, SNAP),
    snapped: T >= SNAP ? T - SNAP : undefined,
    pings: CUTS.map(c => T - c),
    rubbing: T < SNAP && pulled(T, A.heaves) - pulled(T - F, A.heaves) > 0.2,
  });
}

// Drops in with a bounce, leaves upwards before the pianos cross the middle of the screen.
function title(f, T) {
  const dy = Math.round(keys(T, [[0.2, -50], [0.42, 3, ease.in], [0.5, 0, ease.out], [1.45, 0], [1.7, -50, ease.in]]));
  const line = (str, y, c, scale) => text(f, str, Math.round((PW - textWidth(str, scale)) / 2), y + dy, c, { scale, ink: 'k' });
  line('20 S AVANT', 6, 'y', 1);
  line('QUE LE PIANO', 17, 'o', 2);
  line('NE TOMBE', 34, 'o', 2);
}

// « FIN » drops in over the last frame of the street, dimmed: the wreck, the feet, the puddle,
// the headphones still playing in it.
function theEnd(f, t, T) {
  wreckClose(f, t, step(BLACK - F));
  dither(f, 0, 0, PW, 120, null, 'k', 10, 0);
  const drop = Math.round(keys(T, [[FIN, -30], [FIN + 0.2, 2, ease.in], [FIN + 0.3, 0, ease.out]]));
  text(f, 'FIN', Math.round((PW - textWidth('FIN', 3)) / 2), 18 + drop, 'w', { scale: 3, ink: 'R' });
}

const SHOTS = [
  [0, shot1], [3, street], [6, closeUp], [8, street], [10.5, closeUp],
  [11.5, street], [15, balconyB], [EXIT_B, street], [SQUASH + 2 * F, wreckClose], [BLACK, theEnd],
];

// The series signature: 00:20 counting down, top right.
function countdown(f, t) {
  const s = `00:${String(Math.max(0, Math.ceil(20 - t))).padStart(2, '0')}`;
  // Kept clear of the corners: every room's screen is rounded there.
  rect(f, 113, 11, 33, 11, 'k'); rect(f, 114, 12, 31, 9, 'n');
  text(f, s, 113 + Math.round((33 - textWidth(s)) / 2), 13, 'r');
}

function draw(ctx, t) {
  const T = step(t);
  const [, shot] = SHOTS.findLast(([start]) => start <= t) ?? SHOTS[0];
  const f = frame();
  shot(f, t, T);
  countdown(f, t);
  const dx = shot === street ? shakeAt(T)[0] : 0;
  present(ctx, f, dx * (W / PW), 0, W / PW);
}

const cues = [
  { at: 0.17, sound: 'ropeCreak' },
  { at: 1.0, sound: 'leak', dur: CRASH_F * F + F - 1 },
  { at: 1.5, sound: 'pat' },
  { at: 2.0, sound: 'pat' },
  { at: 2.22, sound: 'ropeCreak' },
  { at: 2.5, sound: 'pat' },
  { at: A.heaves[1] + 0.12, sound: 'ropeCreak' },
  { at: 4.0, sound: 'pat' },
  { at: 5.0, sound: 'pat' },
  { at: A.heaves[2] + 0.12, sound: 'ropeCreak' },
  { at: CUTS[0], sound: 'strandPing' },
  { at: A.heaves[3] + 0.12, sound: 'ropeCreak' },
  { at: CUTS[1], sound: 'strandPing' },
  { at: 8.0, sound: 'pat' },
  { at: 9.0, sound: 'pat' },
  { at: 10.0, sound: 'pat' },
  { at: A.heaves[4] + 0.12, sound: 'ropeCreak' },
  { at: SNAP, sound: 'ropeTwang' },
  { at: 11.5, sound: 'fallWhistle', dur: CRASH_F * F - 11.5 },
  { at: 12.0, sound: 'pat' },
  { at: CRASH_F * F, sound: 'pianoCrash' },
  { at: PH_LAND, sound: 'clatter' },
  { at: PH_LAND + 0.3, sound: 'leak', dur: BLACK - PH_LAND - 0.3, gain: 0.45 },
  { at: (CRASH_F + 27) * F, sound: 'phew' },
  { at: RELEASE, sound: 'ropeRun', dur: EXIT_B - RELEASE },
  { at: (Math.ceil(RELEASE * FPS) + 1) * F, sound: 'slap' }, // the frame his paws land on his cheeks
  { at: RELEASE + 0.3, sound: 'fallWhistle', dur: CONTACT_F * F - RELEASE - 0.3 },
  { at: CONTACT_F * F, sound: 'pianoCrash' },
  { at: CONTACT_F * F, sound: 'chordClang', dur: 1.6 },
  { at: SQUASH + 0.02, sound: 'splat' },
  { at: (CONTACT_F + 4) * F, sound: 'squelch' },
  { at: (CONTACT_F + 9) * F, sound: 'squelch' },
  { at: KEY_LAND, sound: 'tink' },
  { at: FIN + 0.2, sound: 'leak', dur: 20 - FIN - 0.2, gain: 0.35 },
].sort((a, b) => a.at - b.at);

export default { title: '20 s avant que le piano ne tombe', duration: 20, cues, draw };

// Pépin the fox, a cut-out puppet in the Happy Tree Friends manner:
// flat fills, thin outlines in a dark shade of the fill, huge touching eyes, white muzzle, bushy tail.
// Origin at his feet, up is negative y; he stands about 270 units tall with his ears.
import { shape, mixColor, lerp } from '../engine.js';

const FUR = '#f2802e', HOT = '#e8452c', LINE = '#7f2f0a', CREAM = '#fff3e2', DARK = '#5b2a16', INNER = '#ffd9c2';
const MOUTH = '#6e0f1f', TONGUE = '#e0506a', EYE_LINE = '#5a240a';
const LW = 2.6;
const TAU = Math.PI * 2;

// Close-ups zoom the puppet a lot; inkScale keeps the outlines from getting heavy.
let inkScale = 1;
const part = (ctx, fill, trace, lw = LW, ink = LINE) => shape(ctx, fill, trace, lw * inkScale, ink);

// lid: 0 open → 1 shut. lidTilt > 0 drops the inner corners (effort, anger), < 0 raises them (worry).
// gaze: pupils offset in [-1, 1]. open: how far the mouth opens. heat: 0..1 red face.
export const POSES = {
  neutral: { lid: 0, lidTilt: 0, gaze: [0, 0.1], mouth: 'smile', open: 0, heat: 0, tilt: 0 },
  strain: { lid: 0.6, lidTilt: 0.4, gaze: [0, 0.5], mouth: 'grit', open: 1, heat: 0.7, tilt: 0.05 },
  alarm: { lid: 0, lidTilt: -0.3, gaze: [0.15, -0.75], mouth: 'open', open: 1, heat: 0, tilt: -0.08, pupil: 0.7 },
  joy: { lid: 0, lidTilt: 0, gaze: [0, 0.1], pupil: 1.15, mouth: 'grin', open: 1, heat: 0, tilt: 0.07 },
};

const HANDS = { l: [-58, -60], r: [58, -60] };
const TAIL_BASE = [22, -44];

export function drawPepin(ctx, pose, x, y, scale = 1) {
  const fur = mixColor(FUR, HOT, pose.heat ?? 0);
  const sq = pose.squash ?? 0;
  const hands = { ...HANDS, ...pose.hands };
  inkScale = pose.inkScale ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(pose.lean ?? 0);
  ctx.scale(scale * (1 + sq), scale * (1 - sq));

  tail(ctx, pose.tail ?? 0, fur, pose.tailSide ?? 1);
  for (const side of [-1, 1]) part(ctx, DARK, c => c.ellipse(side * 20, -7, 17, 8, 0, 0, TAU));
  part(ctx, fur, body);
  part(ctx, CREAM, c => c.ellipse(0, -58, 27, 40, 0, 0, TAU), 2);
  // Arms go behind the head, paws in front of whatever he holds: a jar raised to his chin
  // must not have an arm drawn across his mouth.
  const paws = [[-1, hands.l, pose.thumbs?.l ?? 0], [1, hands.r, pose.thumbs?.r ?? 0]];
  for (const [side, hand] of paws) arm(ctx, side, hand, fur);

  // The head pivots at the neck, like a puppet.
  ctx.save();
  headSpace(ctx, pose);
  for (const side of [-1, 1]) ear(ctx, side, fur, pose.ears ?? 0);
  for (const side of [-1, 1]) tuft(ctx, side);
  part(ctx, fur, head);
  muzzle(ctx);
  for (const side of [-1, 1]) eye(ctx, side, pose, fur);
  heart(ctx, 0, -156, 7);
  mouth(ctx, pose);
  ctx.restore();

  pose.held?.(ctx); // a prop in his hands, drawn between the body and the paws
  if (pose.bite) {
    ctx.save();
    headSpace(ctx, pose);
    jaws(ctx);
    ctx.restore();
  }

  for (const [side, hand, thumb] of paws) {
    pose.inPaws?.[side < 0 ? 'l' : 'r']?.(ctx, ...hand); // something gripped, under the mitten
    paw(ctx, side, hand, thumb);
  }
  ctx.restore();
}

// The head pivots at the neck, like a puppet.
function headSpace(ctx, pose) {
  ctx.translate(0, -128 + (pose.headY ?? 0)); ctx.rotate(pose.tilt ?? 0); ctx.translate(0, 128);
}

function body(c) {
  c.moveTo(0, -132);
  c.bezierCurveTo(34, -132, 50, -86, 48, -46);
  c.bezierCurveTo(46, -14, 28, -8, 0, -8);
  c.bezierCurveTo(-28, -8, -46, -14, -48, -46);
  c.bezierCurveTo(-50, -86, -34, -132, 0, -132);
}

function head(c) {
  c.moveTo(0, -234);
  c.bezierCurveTo(46, -234, 72, -212, 72, -180);
  c.bezierCurveTo(72, -144, 46, -124, 0, -124);
  c.bezierCurveTo(-46, -124, -72, -144, -72, -180);
  c.bezierCurveTo(-72, -212, -46, -234, 0, -234);
}

// Tall pointed ears with dark tips; `angle` folds them outwards from their base.
function ear(ctx, side, fur, angle) {
  const trace = c => {
    c.moveTo(side * 26, -222);
    c.quadraticCurveTo(side * 44, -262, side * 62, -276);
    c.quadraticCurveTo(side * 74, -236, side * 68, -196);
    c.closePath();
  };
  ctx.save();
  ctx.translate(side * 47, -209); ctx.rotate(side * angle); ctx.translate(-side * 47, 209);
  part(ctx, fur, trace);
  ctx.save();
  ctx.beginPath(); trace(ctx); ctx.clip();
  part(ctx, DARK, c => c.rect(side * 20 - 40, -290, 80, 36), 0);
  part(ctx, INNER, c => { c.moveTo(side * 38, -216); c.quadraticCurveTo(side * 50, -244, side * 60, -252); c.quadraticCurveTo(side * 64, -226, side * 60, -204); c.closePath(); }, 0);
  ctx.restore();
  part(ctx, null, trace);
  ctx.restore();
}

// White cheek fluff sticking out below the eyes.
function tuft(ctx, side) {
  part(ctx, CREAM, c => {
    c.moveTo(side * 60, -180);
    c.lineTo(side * 88, -164);
    c.lineTo(side * 68, -156);
    c.lineTo(side * 84, -140);
    c.lineTo(side * 50, -134);
    c.closePath();
  });
}

// The white lower face, dipping up to the nose.
function muzzle(ctx) {
  const edge = c => {
    c.moveTo(-80, -168);
    c.bezierCurveTo(-44, -150, -22, -170, 0, -163);
    c.bezierCurveTo(22, -170, 44, -150, 80, -168);
  };
  ctx.save();
  ctx.beginPath(); head(ctx); ctx.clip();
  part(ctx, CREAM, c => { edge(c); c.lineTo(80, -100); c.lineTo(-80, -100); c.closePath(); }, 0);
  part(ctx, null, edge, 2);
  ctx.restore();
  part(ctx, null, head);
}

// A bushy tail with a white tip, swinging around its base by `angle` radians; side -1 puts it on his right.
function tail(ctx, angle, fur, side) {
  const trace = c => {
    c.moveTo(14, -40);
    c.bezierCurveTo(92, -36, 128, -104, 102, -176);
    c.bezierCurveTo(94, -198, 68, -204, 62, -184);
    c.bezierCurveTo(80, -124, 62, -84, 12, -70);
    c.closePath();
  };
  ctx.save();
  ctx.scale(side, 1);
  ctx.translate(...TAIL_BASE); ctx.rotate(angle); ctx.translate(-TAIL_BASE[0], -TAIL_BASE[1]);
  part(ctx, fur, trace);
  ctx.save();
  ctx.beginPath(); trace(ctx); ctx.clip();
  part(ctx, CREAM, c => { c.moveTo(40, -150); c.quadraticCurveTo(90, -130, 130, -160); c.lineTo(130, -220); c.lineTo(40, -220); c.closePath(); }, 2);
  ctx.restore();
  part(ctx, null, trace);
  ctx.restore();
}

function eye(ctx, side, pose, fur) {
  const x = side * 25, y = -190, rx = 24, ry = 30;
  const white = c => c.ellipse(x, y, rx, ry, 0, 0, TAU);
  part(ctx, '#ffffff', white, LW, EYE_LINE);

  ctx.save();
  ctx.beginPath(); white(ctx); ctx.clip();
  const [gx, gy] = pose.gaze, ps = pose.pupil ?? 1;
  // Pupils sit a little towards the nose, which gives the series' slightly cross-eyed look.
  const cross = pose.cross ?? 0; // both pupils pulled towards the nose, at whatever is right under it
  part(ctx, '#161010', c => c.ellipse(x + gx * 11 - side * (3 + cross * 11), y + gy * 14 + 4 + cross * 8, 6.5 * ps, 8.5 * ps, 0, 0, TAU), 0);

  const lidY = y - ry + pose.lid * 2 * ry, tilt = (pose.lidTilt ?? 0) * ry;
  const inner = [x - side * (rx + 2), lidY + tilt], outer = [x + side * (rx + 2), lidY - tilt];
  if (Math.max(inner[1], outer[1]) > y - ry) {
    part(ctx, fur, c => {
      c.moveTo(inner[0], y - ry - 4); c.lineTo(outer[0], y - ry - 4);
      c.lineTo(...outer); c.lineTo(...inner); c.closePath();
    }, 0);
    part(ctx, null, c => { c.moveTo(...inner); c.lineTo(...outer); }, LW, EYE_LINE);
  }
  ctx.restore();
  part(ctx, null, white, LW, EYE_LINE);
}

function heart(ctx, x, y, s) {
  part(ctx, DARK, c => {
    c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.3, x, y - s * 0.45);
    c.bezierCurveTo(x + s * 0.7, y - s * 1.3, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  }, 2);
}

// Clamped on something held across the mouth (the rim of a lid at y ≈ -146): the upper jaw
// comes down over its top edge, the lower jaw up over its bottom edge, fangs biting in from both sides.
function jaws(ctx) {
  const top = -151, bottom = -141;
  // Soft lips, no hard edge: the upper one tucks under the nose, the lower one is a little chin.
  part(ctx, CREAM, c => c.ellipse(0, top - 3, 22, 6, 0, 0, TAU), 0);
  part(ctx, null, c => { c.moveTo(-21, top); c.quadraticCurveTo(0, top + 3, 21, top); });
  part(ctx, CREAM, c => c.ellipse(0, bottom, 19, 10, 0, 0, Math.PI));
  part(ctx, CREAM, c => c.rect(-19.5, bottom - 3, 39, 4), 0);
  part(ctx, null, c => { c.moveTo(-19, bottom); c.quadraticCurveTo(0, bottom - 3, 19, bottom); });
  for (const side of [-1, 1]) {
    const x = side * 11;
    part(ctx, '#ffffff', c => { c.moveTo(x - 4, top + 1); c.lineTo(x + 4, top + 1); c.lineTo(x, top + 8); c.closePath(); }, 1.6);
    part(ctx, '#ffffff', c => { c.moveTo(x - 3.5, bottom - 1); c.lineTo(x + 3.5, bottom - 1); c.lineTo(x, bottom - 7); c.closePath(); }, 1.6);
  }
  heart(ctx, 0, -156, 7); // the nose stays on top of the upper jaw
}

// Two little fangs hanging from the corners of the lip.
function fangs(ctx, top, halfW) {
  for (const side of [-1, 1]) {
    const x = side * (halfW - 7);
    part(ctx, '#ffffff', c => { c.moveTo(x - 4, top); c.lineTo(x + 4, top); c.lineTo(x, top + 8); c.closePath(); }, 1.6);
  }
}

// Open shapes: the lip line on top, a dark inside, the tongue at the bottom.
function openMouth(ctx, halfW, depth, tongue) {
  const top = -150;
  const trace = c => {
    c.moveTo(-halfW, top);
    c.quadraticCurveTo(0, top + 5, halfW, top);
    c.bezierCurveTo(halfW, top + depth * 0.8, halfW * 0.4, top + depth, 0, top + depth);
    c.bezierCurveTo(-halfW * 0.4, top + depth, -halfW, top + depth * 0.8, -halfW, top);
  };
  part(ctx, MOUTH, trace);
  ctx.save();
  ctx.beginPath(); trace(ctx); ctx.clip();
  part(ctx, TONGUE, c => c.ellipse(0, top + depth, tongue, tongue * 0.55, 0, 0, TAU), 0);
  ctx.restore();
  fangs(ctx, top + 1, halfW);
}

function mouth(ctx, pose) {
  const o = pose.open ?? 0;
  if (pose.mouth === 'smile') {
    part(ctx, null, c => { c.moveTo(-16, -146); c.quadraticCurveTo(-8, -138, 0, -145); c.quadraticCurveTo(8, -138, 16, -146); });
  } else if (pose.mouth === 'open') openMouth(ctx, 18, 12 + 24 * o, 12);
  else if (pose.mouth === 'grin') openMouth(ctx, 30, 14 + 22 * o, 15);
  else if (pose.mouth === 'frown') part(ctx, null, c => { c.moveTo(-14, -143); c.quadraticCurveTo(0, -151, 14, -143); });
  else if (pose.mouth === 'grit') {
    part(ctx, '#ffffff', c => c.roundRect(-28, -157, 56, 20, 8), 3, MOUTH);
    part(ctx, null, c => { c.moveTo(-27, -147); c.lineTo(27, -147); }, 2, MOUTH);
    for (const tx of [-14, 0, 14]) part(ctx, null, c => { c.moveTo(tx, -156); c.lineTo(tx, -138); }, 1.5, MOUTH);
  }
}

// A soft, slightly bent arm, from the shoulder to the paw.
function arm(ctx, side, [hx, hy], fur) {
  const sx = side * 36, sy = -108;
  const trace = c => { c.moveTo(sx, sy); c.quadraticCurveTo(side * 52, (sy + hy) / 2, hx, hy); };
  part(ctx, null, trace, 7 + LW * 2);
  ctx.strokeStyle = fur; ctx.lineWidth = 7; ctx.stroke();
}

// A mitten; `thumb` turns the thumb around it, which shows a grip turning.
function paw(ctx, side, [hx, hy], thumb) {
  const a = Math.atan2(-1, -side) + side * thumb;
  part(ctx, DARK, c => c.arc(hx, hy, 10, 0, TAU));
  part(ctx, DARK, c => c.arc(hx + Math.cos(a) * 9, hy + Math.sin(a) * 9, 4.4, 0, TAU), 2);
}

const FACE_DEFAULTS = { lid: 0, lidTilt: 0, open: 0, heat: 0, tilt: 0, pupil: 1, cross: 0 };

// Blend two expressions: numbers and arrays are interpolated, the mouth shape switches halfway.
export function mixPose(a, b, k) {
  const out = { ...(k < 0.5 ? a : b) };
  for (const [key, vb] of Object.entries(b)) {
    const va = a[key] ?? FACE_DEFAULTS[key] ?? vb;
    if (typeof vb === 'number') out[key] = lerp(va, vb, k);
    else if (Array.isArray(vb)) out[key] = vb.map((v, i) => lerp(va[i], v, k));
  }
  return out;
}

// The expression at time t along a track of [[start, faceName], ...]; faces swap in 0.1 s, as in the series.
export function faceTrack(faces, track, t) {
  const i = Math.max(0, track.findLastIndex(([at]) => at <= t));
  const [at, name] = track[i];
  const prev = track[Math.max(0, i - 1)][1];
  const k = Math.min(1, Math.max(0, (t - at) / 0.1));
  return mixPose(faces[prev], faces[name], 1 - (1 - k) ** 2);
}

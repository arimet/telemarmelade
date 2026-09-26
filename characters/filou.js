// Filou the raccoon, a 1930s rubber hose character: black noodle limbs with no elbow, white four-digit
// gloves, big oval shoes, pie-cut eyes set in the raccoon's dark mask, a ringed tail, a straw boater.
// Greys only, one ink weight. Origin at his feet, up is negative y; about 250 units tall with the hat.
// `boil` is the drawing number: a new one redraws every line with a slightly different wobble.
import { INK, GLOVE, FIST, STITCH, CUFF_LINE, SHOE, drawParts, ell, noodle, pie, place, qb, smooth, tubeOf, wob } from '../lib/anidoodle.js';

export const GREY = {
  fur: '#8f8a80', dark: '#4d4a45', mask: '#34312d', light: '#d8d3c7', white: '#f6f3ea',
  straw: '#e3d9c0', tongue: '#a39d91',
};
const OW = 2.6; // outline weight: the stroke is twice this, the fill covers the inner half
const LIMB = 8; // noodle arms and legs

// Local shapes, before squash and lean.
const BODY = smooth([[0, -128], [20, -122], [31, -98], [34, -72], [26, -56], [0, -51], [-26, -56], [-34, -72], [-31, -98], [-20, -122]], true, 6);
const BELLY = ell(0, -80, 17, 21, 0, 24);
const HEAD = smooth([
  [0, -224], [6, -236], [11, -226], [20, -232], [22, -222], [42, -212], [54, -190], [58, -168], [64, -154], [54, -148], [56, -140],
  [36, -130], [0, -126], [-36, -130], [-56, -140], [-54, -148], [-64, -154], [-58, -168], [-54, -190], [-42, -212], [-18, -224], [-10, -231], [-6, -224],
], true, 5);
// Tall spikes for the take: the fur on his head stands up.
const HEAD_TAKE = smooth([
  [0, -224], [6, -256], [13, -226], [24, -248], [26, -220], [42, -212], [54, -190], [58, -168], [64, -154], [54, -148], [56, -140],
  [36, -130], [0, -126], [-36, -130], [-56, -140], [-54, -148], [-64, -154], [-58, -168], [-54, -190], [-42, -212], [-24, -222], [-20, -250], [-8, -224],
], true, 5);
const MASK = smooth([
  [-56, -184], [-42, -204], [-18, -208], [0, -202], [18, -208], [42, -204], [56, -184], [50, -166], [32, -160],
  [14, -165], [0, -172], [-14, -165], [-32, -160], [-50, -166],
], true, 6);
const MUZZLE = ell(0, -150, 25, 17, 0, 28);
const EYE_X = 15, EYE_Y = -188, EYE_RX = 15, EYE_RY = 21;
const NECK = [0, -128];
const LIFT = 24; // how far the whole upper body sits above the rubber hose legs

// A face: eyes 'open' | 'happy' (shut, smiling) | 'spiral'; mouth 'smile' | 'whistle' | 'yell' | 'wavy'.
// gaze in [-1, 1]², pupil scales the pupils, lid 0 open → 1 shut, eye scales the whites.
export const FACES = {
  neutral: { eyes: 'open', gaze: [0, 0.1], pupil: 1, lid: 0.12, eye: 1, mouth: 'smile' },
  happy: { eyes: 'happy', mouth: 'whistle', tilt: 0.12 },
  alarm: { eyes: 'open', gaze: [0, 0], pupil: 0.42, lid: 0, eye: 1.3, mouth: 'yell', take: true },
  dizzy: { eyes: 'spiral', mouth: 'wavy', tilt: -0.1 },
};

// Poses: where the wrists and ankles are (local, unsquashed), glove angles (0 = fingers up).
// Arm bows: > 0 bows the left arm out, < 0 bows the right arm out.
export const POSES = {
  neutral: {
    face: FACES.neutral,
    hands: { l: [-60, -84], r: [60, -84] }, handAng: { l: 2.8, r: -2.8 }, bend: { l: 16, r: -16 },
    feet: { l: [-20, -14], r: [20, -14] }, tail: 0,
  },
  // Strutting along, thumb cocked to flip his lucky coin.
  happy: {
    face: FACES.happy, lean: 0.05, squash: -0.03,
    hands: { l: [-50, -124], r: [62, -88] }, handAng: { l: -0.9, r: -2.6 }, bend: { l: 26, r: -16 },
    grip: { l: 'fist' },
    feet: { l: [-22, -14], r: [30, -30] }, footAng: { r: 0.35 }, legBend: { r: -8 }, tail: 0.25,
  },
  alarm: {
    face: FACES.alarm, squash: -0.12, hatLift: 34, hatTilt: -0.5, ears: 0.35,
    hands: { l: [-86, -172], r: [86, -172] }, handAng: { l: 0.5, r: -0.5 }, bend: { l: -26, r: 26 },
    feet: { l: [-34, -34], r: [30, -14] }, footAng: { l: 0.5 }, legBend: { l: 12, r: -4 }, tail: -0.5, tailStraight: true,
  },
  // Flattened like an accordion, hat rammed down, stars wheeling.
  dizzy: {
    face: FACES.dizzy, squash: 0.36, hatTilt: 0.35, hatShift: [-8, 8], hatCrush: 0.5,
    hands: { l: [-62, -34], r: [62, -32] }, handAng: { l: 2.4, r: -2.4 }, bend: { l: 12, r: -12 },
    feet: { l: [-30, -14], r: [30, -14] }, footAng: { l: 0.2, r: 0.2 }, tail: 0.9, stars: true, folds: true,
  },
};

// Draws Filou at (x, y). `boil` picks the drawing (line wobble); `ink` thins the line in close-ups.
export function drawFilou(ctx, pose, x, y, scale = 1, { boil = 0, ink = 1, t = 0 } = {}) {
  const f = pose.face;
  const sq = pose.squash ?? 0, sy = 1 - sq, sx = 1 / Math.sqrt(sy), lean = pose.lean ?? 0;
  const B = pts => place(pts.map(([px, py]) => [px, py - LIFT]), [0, 0], lean, sx, sy);
  const tilt = (f.tilt ?? 0) + (pose.tilt ?? 0);
  // The head pivots at the neck, then rides on the squashed, leaning body.
  const Hd = pts => B(place(pts.map(([px, py]) => [px - NECK[0], py - NECK[1] + (pose.headY ?? 0)]), NECK, tilt));
  const w = (pts, k) => wob(pts, 1.5, boil * 31 + k);
  const ow = OW * ink, dw = 2.4 * ink, limb = LIMB * Math.min(1, ink * 1.4);
  const side = pose.tailSide ?? 1;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Tail, behind everything: a fat tube with dark rings, swinging around its root.
  drawTail(ctx, B, pose, side, w, ow);

  const parts = [];
  // Legs and shoes: toes point outwards.
  const hip = s => B([[s * 12, -58]])[0];
  const feet = pose.feet, fa = pose.footAng ?? {};
  for (const [s, k] of [[-1, 'l'], [1, 'r']]) {
    parts.push({ details: [{ pts: w(noodle(hip(s), feet[k], (pose.legBend?.[k] ?? 0) - s * 3), 2 + s), w: limb }] });
  }
  for (const [s, k] of [[-1, 'l'], [1, 'r']]) {
    // footAng > 0 lifts the toe.
    const ang = -s * (fa[k] ?? 0), mir = s < 0;
    const shoe = place(SHOE, feet[k], ang, 0.62, 0.62, mir);
    const shine = place(ell(44, -6, 9, 4.5, -0.3, 14), feet[k], ang, 0.62, 0.62, mir);
    parts.push({ outline: [w(shoe, 5 + s)], ow, fills: [{ pts: shoe, col: INK }, { pts: shine, col: GREY.white }] });
  }
  // Body and belly.
  const body = B(BODY);
  const folds = pose.folds ? [-68, -84, -100].map((fy, i) => ({ pts: w(B(qb([-30, fy], [0, fy + 8], [30, fy], 10)), 14 + i), w: dw })) : [];
  parts.push({ outline: [w(body, 10)], ow, fills: [{ pts: body, col: GREY.fur }, { pts: B(BELLY), col: GREY.light }], details: folds });
  // Arms: one arc from the shoulder to the wrist, behind the head.
  const shoulder = s => B([[s * 27, -114]])[0];
  for (const [s, k] of [[-1, 'l'], [1, 'r']]) {
    parts.push({ details: [{ pts: w(noodle(shoulder(s), pose.hands[k], pose.bend?.[k] ?? 0), 12 + s), w: limb }] });
  }
  drawParts(ctx, parts);

  drawHead(ctx, f, pose, Hd, w, ow, dw, t);

  // Gloves, in front of everything.
  const gloves = [];
  for (const [s, k] of [[-1, 'l'], [1, 'r']]) {
    const kind = pose.grip?.[k] === 'fist' ? FIST : GLOVE;
    const at = pose.hands[k], a = pose.handAng[k], mir = s < 0, gs = 0.52;
    const pieces = kind.map(p => place(p, [0, 0], 0, gs, gs, mir)).map(p => place(p, at, a));
    const lines = (kind === GLOVE ? STITCH : STITCH.slice(0, 2)).concat([CUFF_LINE]).map(p => place(place(p, [0, 0], 0, gs, gs, mir), at, a));
    gloves.push({
      outline: pieces.map((p, i) => w(p, 20 + i + s * 7)), ow,
      fills: pieces.map(p => ({ pts: p, col: GREY.white })),
      details: lines.map(p => ({ pts: p, w: dw * 0.8 })),
    });
  }
  drawParts(ctx, gloves);
  ctx.restore();
}

function drawTail(ctx, B, pose, side, w, ow) {
  const a = pose.tail ?? 0;
  const root = [side * 18, -64];
  const curl = pose.tailStraight
    ? [[0, 0], [30, -4], [58, -10], [84, -18], [104, -26]]
    : [[0, 0], [30, -6], [52, -26], [60, -58], [52, -88]];
  const centre = B(place(curl.map(([cx, cy]) => [side * cx, cy]), root, side * a));
  const tube = w(tubeOf(centre, 9, 15), 40);
  const end = centre.at(-1), prev = centre.at(-2), ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  // Same winding as the tube, or the non-zero fill leaves their overlap empty.
  const area = q => q.reduce((acc, p, i) => { const n = q[(i + 1) % q.length]; return acc + p[0] * n[1] - n[0] * p[1]; }, 0);
  let tip = w(ell(end[0], end[1], 15, 15, ang, 20), 41);
  if (Math.sign(area(tip)) !== Math.sign(area(tube))) tip = tip.reverse();
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const s of [tube, tip]) { s.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); }
  ctx.strokeStyle = INK; ctx.lineWidth = ow * 2; ctx.stroke();
  ctx.fillStyle = GREY.fur; ctx.fill();
  ctx.clip();
  // Rings across the tail, and a dark tip.
  const smoothC = smooth(centre, false, 6);
  ctx.strokeStyle = GREY.dark; ctx.lineWidth = 9;
  for (const k of [0.3, 0.55, 0.8]) {
    const i = Math.round(k * (smoothC.length - 1)), p = smoothC[i], q = smoothC[Math.min(smoothC.length - 1, i + 1)];
    const d = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(p[0] - Math.cos(d) * 30, p[1] - Math.sin(d) * 30); ctx.lineTo(p[0] + Math.cos(d) * 30, p[1] + Math.sin(d) * 30); ctx.stroke();
  }
  ctx.fillStyle = GREY.dark; ctx.beginPath(); ctx.arc(end[0], end[1], 17, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHead(ctx, f, pose, Hd, w, ow, dw, t) {
  const parts = [];
  // Round ears, behind the head; `ears` lifts them (a take).
  for (const s of [-1, 1]) {
    const e = pose.ears ?? 0, c = [s * (38 + e * 6), -212 - e * 14];
    parts.push({ outline: [w(Hd(ell(...c, 16, 16, 0, 20)), 50 + s)], ow, fills: [{ pts: Hd(ell(...c, 16, 16, 0, 20)), col: GREY.dark }, { pts: Hd(ell(c[0] - s * 1, c[1] + 2, 9, 9, 0, 16)), col: GREY.light }] });
  }
  const head = Hd(f.take ? HEAD_TAKE : HEAD);
  parts.push({ outline: [w(head, 60)], ow, fills: [{ pts: head, col: GREY.fur }] });
  drawParts(ctx, parts);
  // Turning the head (turn -1 → 1): the face slides across it, the cut-out way. Mask and muzzle stay inside the head.
  const turn = pose.turn ?? 0, F = pts => Hd(pts.map(([px, py]) => [px + turn * 18, py]));
  ctx.save();
  ctx.beginPath(); head.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.clip();
  drawParts(ctx, [
    { fills: [{ pts: F(MASK), col: GREY.mask }] },
    { outline: [w(F(MUZZLE), 61)], ow: ow * 0.8, fills: [{ pts: F(MUZZLE), col: GREY.light }] },
  ]);
  ctx.restore();

  eyes(ctx, f, F, w, ow, dw, t);
  mouth(ctx, f, F, w, dw);

  const nose = F(ell(0, -161, 8.5, 6, 0, 18));
  drawParts(ctx, [{ outline: [w(nose, 70)], ow: ow * 0.7, fills: [{ pts: nose, col: INK }, { pts: F(ell(-2.5, -163, 2.6, 1.6, -0.3, 10)), col: GREY.white }] }]);

  hat(ctx, pose, Hd, w, ow, dw);
  if (pose.stars) stars(ctx, Hd, t, ow);
}

function eyes(ctx, f, Hd, w, ow, dw, t) {
  const parts = [];
  for (const s of [-1, 1]) {
    const e = f.eye ?? 1, ex = s * EYE_X * (1 + (e - 1) * 0.4), rx = EYE_RX * (1 + (e - 1) * 0.5), ry = EYE_RY * e, ey = EYE_Y - (ry - EYE_RY) * 0.6;
    if (f.eyes === 'happy' || (f.eyes === 'wink' && s < 0)) {
      // Shut and smiling: a light arc with an ink rim, so it reads on the dark mask.
      const arc = Hd(qb([ex - 10, ey + 5], [ex, ey - 13], [ex + 10, ey + 5], 12));
      parts.push({ details: [{ pts: w(arc, 80 + s), w: dw * 2.6 }, { pts: w(arc, 80 + s), w: dw * 1.1, col: GREY.light }] });
      continue;
    }
    const white = Hd(ell(ex, ey, rx, ry, 0, 32));
    const part = { outline: [w(white, 82 + s)], ow, fills: [{ pts: white, col: GREY.white }], details: [] };
    if (f.eyes === 'spiral') {
      const sp = [];
      for (let i = 0; i <= 40; i++) { const a = i * 0.42 * s + t * 9 * s, r = 1 + i * 0.28; sp.push([ex + Math.cos(a) * r * (rx / ry), ey + Math.sin(a) * r]); }
      part.details.push({ pts: Hd(sp), w: dw * 0.9 });
    } else {
      const [gx, gy] = f.gaze ?? [0, 0], ps = f.pupil ?? 1;
      part.fills.push({ pts: Hd(pie(ex + gx * 5.5 - s * 1.5, ey + gy * 7 + 3, 7.6 * ps, 12.5 * ps)), col: INK });
      const lid = f.lid ?? 0;
      if (lid > 0) {
        // Upper lid: the part of the white above the lid line, in mask colour.
        const lidY = ey - ry + lid * 2 * ry;
        const cap = ell(ex, ey, rx, ry, 0, 48).filter(([, py]) => py <= lidY);
        if (cap.length > 2) {
          const sorted = cap.sort((a, b) => a[0] - b[0]);
          part.fills.push({ pts: Hd(sorted.map(p => p).concat([[sorted.at(-1)[0], lidY], [sorted[0][0], lidY]])), col: GREY.mask });
          part.details.push({ pts: Hd([[sorted[0][0], lidY], [sorted.at(-1)[0], lidY]]), w: dw });
        }
      }
    }
    parts.push(part);
  }
  drawParts(ctx, parts);
}

function mouth(ctx, f, Hd, w, dw) {
  const parts = [];
  if (f.mouth === 'smile') {
    parts.push({ details: [{ pts: w(Hd(qb([-13, -146], [0, -135], [13, -146], 12)), 90), w: dw }, { pts: Hd([[-15, -149], [-12, -144]]), w: dw * 0.8 }, { pts: Hd([[15, -149], [12, -144]]), w: dw * 0.8 }] });
  } else if (f.mouth === 'whistle') {
    const o = Hd(ell(7, -142, 3.6, 4.6, 0, 14));
    parts.push({ outline: [o], ow: dw * 0.6, fills: [{ pts: o, col: INK }], details: [{ pts: Hd(qb([-8, -144], [-2, -141], [2, -143], 6)), w: dw * 0.8 }] });
  } else if (f.mouth === 'yell') {
    // Jaw dropped: a tall dark oval with the tongue at the bottom.
    const m = Hd(smooth([[-15, -152], [0, -148], [15, -152], [17, -130], [9, -112], [0, -109], [-9, -112], [-17, -130]], true, 6));
    parts.push({ outline: [w(m, 91)], ow: dw * 0.9, fills: [{ pts: m, col: INK }, { pts: Hd(ell(0, -115, 9, 5, 0, 14)), col: GREY.tongue }] });
  } else if (f.mouth === 'oh' || f.mouth === 'pucker') {
    // 'oh': a small round open mouth; 'pucker': lips pushed out for a kiss or to blow.
    const o = Hd(ell(0, -141, f.mouth === 'oh' ? 5 : 4, f.mouth === 'oh' ? 6.5 : 4, 0, 16));
    const lips = Hd(ell(0, -141, 8, 7, 0, 18));
    parts.push(f.mouth === 'pucker' ? { outline: [w(lips, 94)], ow: dw * 0.7, fills: [{ pts: lips, col: GREY.light }, { pts: o, col: INK }] } : { outline: [o], ow: dw * 0.6, fills: [{ pts: o, col: INK }] });
  } else if (f.mouth === 'grin') {
    const m = Hd(smooth([[-17, -149], [0, -146], [17, -149], [12, -136], [0, -132], [-12, -136]], true, 6));
    parts.push({ outline: [w(m, 95)], ow: dw * 0.8, fills: [{ pts: m, col: INK }, { pts: Hd(ell(0, -135, 7, 3.5, 0, 12)), col: GREY.tongue }] });
  } else if (f.mouth === 'wavy') {
    const tongue = Hd(smooth([[5, -144], [13, -144], [14, -134], [9, -130], [5, -136]], true, 5));
    parts.push({ outline: [w(tongue, 92)], ow: dw * 0.6, fills: [{ pts: tongue, col: GREY.tongue }] });
    parts.push({ details: [{ pts: w(Hd(smooth([[-14, -144], [-8, -148], [-2, -142], [4, -146], [12, -143]], false, 5)), 93), w: dw }] });
  }
  drawParts(ctx, parts);
}

// A straw boater, perched a little askew; hatLift pops it off his head in a take.
function hat(ctx, pose, Hd, w, ow, dw) {
  if (pose.hatOff) return; // knocked off, drawn elsewhere
  const lift = pose.hatLift ?? 0, crush = pose.hatCrush ?? 0, [hx, hy] = pose.hatShift ?? [0, 0];
  const at = [4 + hx, -226 - lift + hy], a = -0.14 + (pose.hatTilt ?? 0), h = 18 * (1 - crush);
  const P = pts => Hd(place(pts, at, a));
  const brim = P(ell(0, 0, 38, 7, 0, 30));
  const crown = P(smooth([[-24, 0], [-24, -h], [0, -h - 2], [24, -h], [24, 0], [0, 3]], true, 3));
  const band = P([[-24, -1], [-24, -h * 0.42], [24, -h * 0.42], [24, -1]]);
  drawParts(ctx, [
    { outline: [w(brim, 100), w(crown, 101)], ow, fills: [{ pts: brim, col: GREY.straw }, { pts: crown, col: GREY.straw }, { pts: band, col: GREY.mask }] },
    { details: [{ pts: P([[-24, 0], [0, 3], [24, 0]]), w: dw * 0.8 }] },
  ]);
}

// Little stars wheeling round his head.
function stars(ctx, Hd, t, ow) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = t * 3 + (i * Math.PI) / 2, c = [Math.cos(a) * 62, -238 + Math.sin(a) * 12];
    const pts = [];
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 4 : 10, b = (k * Math.PI) / 5 - Math.PI / 2; pts.push([c[0] + Math.cos(b) * r, c[1] + Math.sin(b) * r]); }
    parts.push({ outline: [Hd(pts)], ow: ow * 0.8, fills: [{ pts: Hd(pts), col: GREY.white }] });
  }
  drawParts(ctx, parts);
}

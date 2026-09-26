// An upright piano in a rope sling, and the hoisting rope: 1 px wide from afar,
// a thick twisted rope in close-up, sawing on the balcony rail until its strands give.
import { sprite, stamp, rect, sky, PW, PH } from '../pixel.js';

export const PIANO = sprite([
  '..........bb..........',
  '........bb..bb........',
  '......bb......bb......',
  '....bb..........bb....',
  '..bb..............bb..',
  '.b..................b.',
  'kkkkkkkkkkkkkkkkkkkkkk',
  'kllllllllllllllllllllk',
  'klbbbbbbbbbbbbbbbbbbBk',
  'klbkkkkkkkkkkkkkkkkbBk',
  'klbkbbbbbbbbbbbbbbkbBk',
  'klbkbbbbbbbbbbbbbbkbBk',
  'klbkkkkkkkkkkkkkkkkbBk',
  'kBBBBBBBBBBBBBBBBBBBBk',
  'kwkkwkwwkkwkkwkwwkkwkk',
  'kwkkwkwwkkwkkwkwwkkwkk',
  'kwwwwwwwwwwwwwwwwwwwwk',
  'kkkkkkkkkkkkkkkkkkkkkk',
  'klbbbbbbbbbbbbbbbbbbBk',
  'klbkkkkkkkkkkkkkkkkbBk',
  'klbkbbbbbbbbbbbbbbkbBk',
  'klbkbbbbbbbbbbbbbbkbBk',
  'klbkbbbbbbbbbbbbbbkbBk',
  'klbkkkkkkkkkkkkkkkkbBk',
  'kBBBBBBBBBBBBBBBBBBBBk',
  'kkkkkkkkkkkkkkkkkkkkkk',
  '.kBk..............kBk.',
  '.kkk..............kkk.',
]);

// What is left after the fall: the case split in two, the lid standing up, keys spilled. 30×17.
export const WRECK = sprite([
  '.............kk...............',
  '............kblk..............',
  '...........kbllbk.............',
  '..........kbbbbbk.......kk....',
  '.........kbbkkbbk......kblk...',
  '....kk...kbkwkkbk.....kbllk...',
  '...kblk..kbkwwkbk....kbbbk....',
  '...kbbk.kbbkkkkbbk..kbbbk..kk.',
  '..kbbbkkbbbbbbbbbk.kbbbk..kblk',
  '..kbbkwkwkkwkwkwkbkbbbkk.kbbbk',
  '.kbbkwwwwwwwwwwwwkbbbkwk.kbbk.',
  '.kbBkkkkkkkkkkkkkkbBkwwwkkbbk.',
  'kbbbbbbbbBBBBbbbbbbbkkkkkbbbk.',
  'kbBBBbbbbbbbbbbbBBBbbbbbbbbBk.',
  'kbbbbbbbbbbbbbbbbbbbbbbbbbbbbk',
  'kBBBBBBBBBBBBBBBBBBBBBBBBBBBBk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
]);

// (x, y): the knot at the top of the sling.
export const drawPiano = (f, x, y) => stamp(f, PIANO, x - 11, y);

// The rope seen from afar, from the knot straight up to where it goes over the rail.
export const drawRope = (f, x, yTop, yKnot) => rect(f, x, yTop, 1, yKnot - yTop, 'b');

// --- close-up: the rope bent over the iron rail, seen from the side ---

const BAR = [68, 68], BAR_R = 9; // the rail in cross-section: a square iron bar
const ROPE_R = 7;
export const RUB = [BAR[0] - BAR_R, BAR[1] - BAR_R]; // the bar's outer top corner, that saws the rope
// The rope's centre line: up from the piano along the outer face of the bar, bent tight over its
// corner, then off to the right towards the mover's paws, inside the balcony.
const LEAVE = 1.4 * Math.PI;
const S_CORNER = PH + 10 - RUB[1] + ROPE_R * (LEAVE - Math.PI) / 2; // arc length at the middle of the bend
const PATH = [
  [RUB[0] - ROPE_R, PH + 10],
  ...Array.from({ length: 7 }, (_, i) => {
    const a = Math.PI + ((LEAVE - Math.PI) * i) / 6;
    return [RUB[0] + ROPE_R * Math.cos(a), RUB[1] + ROPE_R * Math.sin(a)];
  }),
];
PATH.push([PATH.at(-1)[0] - 200 * Math.sin(LEAVE), PATH.at(-1)[1] + 200 * Math.cos(LEAVE)]);

// The point at arc length s along the centre line, and the unit normal there pointing inwards.
function pointAt(s) {
  for (let i = 1; i < PATH.length; i++) {
    const [ax, ay] = PATH[i - 1], [bx, by] = PATH[i], len = Math.hypot(bx - ax, by - ay);
    if (s <= len || i === PATH.length - 1) {
      const k = s / len, tx = (bx - ax) / len, ty = (by - ay) / len;
      return [[ax + k * (bx - ax), ay + k * (by - ay)], [-ty, tx]];
    }
    s -= len;
  }
}

// Distance from (x, y) to the rope's centre line, and how far along the rope that point is.
function ropeAt(x, y) {
  let best = { d: Infinity, s: 0 }, s0 = 0;
  for (let i = 1; i < PATH.length; i++) {
    const [ax, ay] = PATH[i - 1], [bx, by] = PATH[i];
    const len = Math.hypot(bx - ax, by - ay);
    const k = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len)));
    const d = Math.hypot(x - ax - k * (bx - ax), y - ay - k * (by - ay));
    // across: signed distance, negative on the outer side of the bend
    if (d < best.d) best = { d, s: s0 + k * len, across: ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / len };
    s0 += len;
  }
  return best;
}

// The close-up, at a moment of the hoisting:
// cut: strands already gone (0–2); run: how far the rope has slid over the bar, in close-up pixels;
// thin: 0–1, the last strand stretching before it goes; snapped: seconds since it broke, if it has;
// pings: seconds since each strand broke, for the cut end that whips out and the fibres it sheds;
// rubbing: the rope is sliding over the corner right now, scraping off bits of hemp.
export function drawRopeCloseup(f, { cut = 0, run = 0, thin = 0, snapped, pings = [], rubbing = false } = {}) {
  // Far below and behind: the sky over the street.
  sky(f, 0, PH);
  // The facade, the balcony slab, and the rail post under the bar.
  rect(f, 124, 0, 36, PH, 'f');
  for (let y = 6; y < PH; y += 10) rect(f, 124, y, 36, 1, 'F');
  rect(f, 132, 0, 28, 100, 'n'); rect(f, 133, 0, 27, 99, 'e');
  for (let i = 0; i < 10; i++) rect(f, 136 + i, 70 - i * 3, 1, 3, 'u');
  rect(f, BAR[0] - 3, 104, PW, 6, 'F'); rect(f, BAR[0] - 3, 104, PW, 1, 'w'); rect(f, BAR[0] - 3, 110, PW, 1, 'n');
  rect(f, BAR[0] - 3, BAR[1], 7, 40, 'k'); rect(f, BAR[0] - 2, BAR[1], 5, 40, 'g'); rect(f, BAR[0] - 2, BAR[1], 1, 40, 's');
  rect(f, BAR[0] - BAR_R, BAR[1] - BAR_R, BAR_R * 2 + 1, BAR_R * 2 + 1, 'k');
  rect(f, BAR[0] - BAR_R + 1, BAR[1] - BAR_R + 1, BAR_R * 2 - 1, BAR_R * 2 - 1, 'g');
  rect(f, BAR[0] - BAR_R + 1, BAR[1] - BAR_R + 1, BAR_R * 2 - 1, 2, 's'); rect(f, BAR[0] - BAR_R + 1, BAR[1] + BAR_R - 2, BAR_R * 2 - 1, 2, 'n');

  // The rope, strand by strand: a twist of three strands, drawn as chevrons that slide along it.
  // Each cut strand wears it thinner where it rides the corner, from its outer side, so what is
  // left still hugs the bar; the last strand stretches thinner still before it goes.
  const worn = s => (cut * 4.4 + thin * 5) * Math.max(0, 1 - (Math.abs(s - S_CORNER) / 16) ** 2);
  // Once broken, the piano's end drops away down the frame and the bear's end whips up and right.
  const drop = snapped === undefined ? 0 : 8 * 73.5 * snapped ** 2 + 30 * snapped;
  const whip = snapped === undefined ? 0 : 260 * snapped;
  const GAP = 3;
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    let r = ropeAt(x, y);
    if (snapped !== undefined) {
      const lo = ropeAt(x, y - drop), hi = ropeAt(x - whip * 0.95, y + whip * 0.31);
      r = lo.s < S_CORNER - GAP && lo.d <= ROPE_R + 0.5 ? lo : hi.s > S_CORNER + GAP ? hi : { d: 99 };
    }
    const out = ROPE_R - worn(r.s);
    if (r.across > ROPE_R + 0.5 || r.across < -out - 0.5 || r.d > ROPE_R + 0.5) continue;
    const edge = r.across > ROPE_R - 0.6 || r.across < -out + 0.6;
    const twist = (((Math.floor((r.s - run + r.d * 1.5) / 2)) % 3) + 3) % 3;
    rect(f, x, y, 1, 1, edge ? 'B' : twist === 0 ? 'b' : 'l');
  }
  if (snapped !== undefined) {
    // The last strand parts: a flash, and a burst of fibres flung out and drifting down.
    const [[cx, cy]] = pointAt(S_CORNER);
    if (snapped < 0.09) { rect(f, cx - 6, cy, 13, 1, 'w'); rect(f, cx, cy - 6, 1, 13, 'w'); rect(f, cx - 2, cy - 2, 5, 5, 'w'); }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 2 * Math.PI, v = 40 + (i % 3) * 25;
      const x = cx + Math.cos(a) * v * snapped, y = cy + Math.sin(a) * v * snapped + 40 * snapped * snapped;
      rect(f, Math.round(x), Math.round(y), i % 2 ? 2 : 1, 1, i % 3 ? 'l' : 'b');
    }
    return;
  }
  // Cut strands bristle out of the worn spot as loose fibres, three per strand.
  for (let i = 0; i < cut * 3; i++) {
    const s = S_CORNER + (i - (cut * 3 - 1) / 2) * 4.5;
    const [[px, py], [nx, ny]] = pointAt(s), r0 = ROPE_R - worn(s);
    const lean = ((i % 3) - 1) * 0.5; // fan out a little
    const [dx, dy] = [-(nx + lean * ny), -(ny - lean * nx)], len = Math.hypot(dx, dy);
    for (let j = 0; j <= 5 + 2 * (i % 2); j += 0.5) {
      const d = r0 + 0.5 + j;
      rect(f, Math.round(px + (dx / len) * d), Math.round(py + (dy / len) * d), 1, 1, j < 1.5 ? 'b' : 'l');
    }
  }
  const [[cx, cy], [nx, ny]] = pointAt(S_CORNER), out0 = Math.atan2(-ny, -nx);
  // Sliding over the corner scrapes hemp off: specks fly off the rub.
  if (rubbing) for (let i = 0; i < 4; i++) {
    const a = out0 + (Math.round(run * 7 + i * 13) % 9 - 4) * 0.18, d = ROPE_R + 2 + ((run * 3 + i * 5) % 7);
    rect(f, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 1, 1, i % 2 ? 'l' : 'w');
  }
  pings.forEach((dt, n) => {
    if (dt < 0) return;
    // The strand that has just gone springs out as a long curl, a pale flash where it parted.
    if (dt < 0.3) {
      const k = dt / 0.3;
      if (dt < 0.09) { rect(f, cx - 4, cy, 9, 1, 'w'); rect(f, cx, cy - 4, 1, 9, 'w'); rect(f, cx - 1, cy - 1, 3, 3, 'w'); }
      for (let j = 0; j < 24; j++) {
        const a = out0 - 0.6 + (n ? 0.9 : 0) + (j / 24) * (1.6 + k * 2.2), d = ROPE_R + j * (1.1 - k * 0.45);
        rect(f, Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 1, 1, j < 6 ? 'b' : 'l');
      }
    }
    // The bits it shed drift down past the bar, rocking as they go.
    for (let i = 0; i < 6; i++) {
      const x = cx - 4 - i * 3 + 6 * Math.sin(dt * 2.5 + i), y = cy - 6 + i + dt * (22 + i * 4);
      if (y < PH) rect(f, Math.round(x), Math.round(y), 2, 1, i % 2 ? 'l' : 'b');
    }
  });
}

// Bémol, a white rabbit in an orange hoodie, red headphones on, lost in his music.
// Pixel sprites typed as strings (palette chars from pixel.js). A pose stacks ears (rows 0–8),
// a face (9–20) and a body drawn over them from the feet up: 20×32 in all.
import { sprite, stamp, rect } from '../pixel.js';

export const BW = 20, BH = 32;

const EARS_UP = [
  '.....kk......kk.....',
  '....kwwk....kwwk....',
  '....kwpk....kpwk....',
  '....kwpk....kpwk....',
  '....kwpk....kpwk....',
  '....kwpk....kpwk....',
  '....kwpk....kpwk....',
  '....kwpk....kpwk....',
  '....kwwk....kwcw....',
];
const BLANK = '.'.repeat(20);
// Each row slid left by n pixels: the ears trailing behind a body moving right (flip for left).
const lean = offsets => EARS_UP.map((r, i) => r.slice(offsets[i]) + '.'.repeat(offsets[i]));

// Ears are their own layer (rows 0–8) so they can lag behind the head.
export const EARS = {
  up: sprite(EARS_UP),
  lean: sprite(lean([2, 2, 1, 1, 1, 0, 0, 0, 0])),
  lean2: sprite(lean([4, 3, 3, 2, 2, 1, 1, 0, 0])),
  // Folded down by their own weight, two rows shorter: just after a take-off or a landing.
  short: sprite([BLANK, BLANK, EARS_UP[0], EARS_UP[1], ...EARS_UP.slice(4)]),
  // Stiff with fright, splayed in a V.
  V: sprite([
    '..kk............kk..',
    '.kwwk..........kwwk.',
    '.kwpk..........kpwk.',
    '..kwpk........kpwk..',
    '..kwpk........kpwk..',
    '...kwpk......kpwk...',
    '...kwpk......kpwk...',
    '....kwpk....kpwk....',
    '....kwwk....kwck....',
  ]),
};

// Faces (rows 9–20) only differ in the eyes (13–15) and mouth (16–19).
const face = (eyes, mouth) => [
  '....kwwkkkkkkwck....',
  '...kwwwwwwwwwwwck...',
  '..kwwwwwwwwwwwwwck..',
  '..kwwwwwwwwwwwwwck..',
  ...eyes,
  ...mouth,
  '......kkkkkkkk......',
];
const mirror = rows => rows.map(r => [...r].reverse().join(''));
// Features slid one pixel right: the head turned three-quarters towards where he goes.
const TURN = face([
  '..kwwwwkkwwwwkkwck..',
  '..kwwwwkkwwwwkkwck..',
  '..kwwwwwwwwwwwwwck..',
], [
  '..kwwppwwwppwwwppk..',
  '..kwwwwwwkwwkwwwck..',
  '...kwwwwwwkkwwwck...',
  '....kkwwwwwwwcckk...',
]);

export const HEADS = {
  idle: sprite(face([
    '..kwwwkkwwwwkkwwck..',
    '..kwwwkkwwwwkkwwck..',
    '..kwwwwwwwwwwwwwck..',
  ], [
    '..kwppwwwppwwwppck..',
    '..kwwwwwkwwkwwwwck..',
    '...kwwwwwkkwwwwck...',
    '....kkwwwwwwwcckk...',
  ])),
  // Eyes dropped a row: looking at his feet.
  down: sprite(face([
    '..kwwwwwwwwwwwwwck..',
    '..kwwwkkwwwwkkwwck..',
    '..kwwwkkwwwwkkwwck..',
  ], [
    '..kwppwwwppwwwppck..',
    '..kwwwwwkwwkwwwwck..',
    '...kwwwwwkkwwwwck...',
    '....kkwwwwwwwcckk...',
  ])),
  right: sprite(TURN),
  left: sprite(mirror(TURN)),
  // Eyes shut in bliss, mouth open on the beat.
  happy: sprite(face([
    '..kwwwwwwwwwwwwwck..',
    '..kwwkwkwwwwkwkwck..',
    '..kwkwwwkwwkwwwkck..',
  ], [
    '..kwppwwwppwwwppck..',
    '..kwwwwkkkkkkwwwck..',
    '...kwwwwkRRkwwwck...',
    '....kkwwwkkwwcckk...',
  ])),
  // Wide eyes, pupils up, mouth a round O.
  alarm: sprite(face([
    '..kwwkkkwwwwkkkwck..',
    '..kwwkwkwwwwkwkwck..',
    '..kwwkkkwwwwkkkwck..',
  ], [
    '..kwwwwwwppwwwwwck..',
    '..kwwwwwkkkkwwwwck..',
    '...kwwwwkRRkwwwck...',
    '....kkwwwkkwwcckk...',
  ])),
};

// Headphones over the head: band on the crown, cups on the sides.
const PHONES = sprite([
  '....................',
  '....RRRRRRRRRRRR....',
  '...R............R...',
  '..R..............R..',
  'krR..............Rrk',
  'krR..............Rrk',
  'krR..............Rrk',
  'krR..............Rrk',
  '.kk..............kk.',
]);
const feet = [
  '...kkkwwkkkkwwkkk...',
  '....kwwwk..kwwwk....',
  '...kwwwck..kwwwck...',
  '...kkkkkk..kkkkkk...',
];

// Bodies are drawn after the head and sit on the bottom row, so a tall one can reach up to the face.
const TORSO = [
  '.....kooooooook.....',
  '...kooooooooooook...',
  '..kooOooooooooOOOk..',
  '..kooOooooooooOOOk..',
  '..kooOooooooooOOOk..',
  '..kooOooooooooOOOk..',
  '..kwwkOOOOOOOOkwck..',
];
const TAP_FEET = [
  '...kkkwwkkkkwwkkk...',
  '...kwwwck..kwwk.....',
  '...kkkkkk...kwwk....',
  '.............kkk....',
];
export const BODIES = {
  idle: sprite([...TORSO, ...feet]),
  // Arms down, one foot up between beats.
  tap: sprite([...TORSO, ...TAP_FEET]),
  // His right arm (screen right) is up: drawBemol draws it to wherever `paw` is.
  reach: sprite([
    '.....kooooooook.....',
    '...kooooooooooook...',
    '..kooOoooooooOOk....',
    '..kooOoooooooOOk....',
    '..kooOoooooooOOk....',
    '..kooOoooooooOOk....',
    '..kwwkOOOOOOOOOk....',
    ...feet,
  ]),
  // In the air: feet tucked together.
  hop: sprite([
    '.....kooooooook.....',
    '...kooooooooooook...',
    '..kooOooooooooOOOk..',
    '..kooOooooooooOOOk..',
    '..kooOooooooooOOOk..',
    '..kooOooooooooOOOk..',
    '..kwwkOOOOOOOOkwck..',
    '...kkkwwkkkkwwkkk...',
    '.....kwwwkkwwwk.....',
    '.....kwwckkwwck.....',
    '......kkk..kkk......',
  ]),
  // Paws up by his chin, one foot tapping the beat.
  dance: sprite([
    '.kk..............kk.',
    'kwwk............kwwk',
    'kwck............kwck',
    '.kok.kooooooook.kOk.',
    '..kokooooooooookOk..',
    '...kooOooooooOOOk...',
    '...kooOooooooOOOk...',
    '...kooOooooooOOOk...',
    '...kooOooooooOOOk...',
    '...kOOOOOOOOOOOOk...',
    '...kkkwwkkkkwwkkk...',
    '....kwwwk..kwwk.....',
    '...kwwwck...kwwk....',
    '...kkkkkk....kkk....',
  ]),
  // Paws flown to his cheeks.
  alarm: sprite([
    '.kkkk..........kkkk.',
    'kwwwwk........kwwwck',
    'kwwwck........kcwcck',
    '.kook..........kOOk.',
    '.kook..........kOOk.',
    '.kook..........kOOk.',
    '..kookooooooookOOk..',
    '...kkooooooooOOkk...',
    '...kOooooooooOOOk...',
    '...kOooooooooOOOk...',
    '...kOooooooooOOOk...',
    '...kOooooooooOOOk...',
    '...kOOOOOOOOOOOOk...',
    ...feet,
  ]),
};

// Flat as a crêpe, ears splayed on the pavement, eyes gone round.
export const FLAT = sprite([
  '......kkkkkkkkkkkkkkkkkkkk......',
  '.kkkkkkwwwwwwwwwwwwwwwwwwkkkkkk.',
  'kwpppppwwkkwwwwwwwwwwkkwwpppppwk',
  '.kkkkkkwkwwkwwwppwwwkwwkwkkkkkk.',
  '......kwwkkwwwwkkwwwwkkwwk......',
  '....kkkooooooooooooooooookkk....',
  '..kwwkOOOOOOOOOOOOOOOOOOOOkwwk..',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
]);
// Headphones knocked off by the first crash, on the pavement, still playing.
export const PHONES_DOWN = sprite([
  '..RRRRRR..',
  '.R......R.',
  'krRk..kRrk',
  'krRk..kRrk',
  '.kk....kk.',
]);
// Over his head when he sees it coming.
export const BANG = sprite([
  '.kk.',
  'kyyk',
  'kyyk',
  'kyyk',
  '.kk.',
  'kyyk',
  '.kk.',
]);
export const STAR = sprite([
  '..k..',
  '.kyk.',
  'kyyyk',
  '.kyk.',
  '..k..',
]);

// (x, y): his feet, centred. Pose fields:
// head, ears (defaults to V when alarmed), body; phones: 'on' his head, or anything else for none;
// sink: head dropped into the shoulders (+, a crouch) or up on a stretched neck (−);
// headX: the head swayed a pixel sideways; earsFlip: ears trailing the other way;
// strings: the hood strings swinging −1, 0 or 1 pixel, lagging behind the body;
// paw: with the 'reach' body, where his raised paw is, relative to his feet; the upper arm goes
// up beside his head to an elbow level with his brow, so only the forearm crosses his face. flip: facing left.
export function drawBemol(f, { head = 'idle', ears, body = 'idle', phones = 'on', sink = 0, headX = 0, earsFlip = false, strings = 0, paw }, x, y, flip = false) {
  x = Math.round(x); y = Math.round(y);
  const left = x - BW / 2, top = y - BH + sink, b = BODIES[body], hx = left + headX;
  const X = i => left + (flip ? BW - 1 - i : i);
  stamp(f, EARS[ears ?? (head === 'alarm' ? 'V' : 'up')], hx, top, flip !== earsFlip);
  stamp(f, HEADS[head], hx, top + 9, flip);
  if (phones === 'on') stamp(f, PHONES, hx, top + 8, flip);
  for (let j = top + 21; j < y - BH + 21; j++) { rect(f, X(6), j, 1, 1, 'k'); rect(f, X(7), j, 6, 1, 'w'); rect(f, X(13), j, 1, 1, 'k'); } // neck
  stamp(f, b, left, y - b.h, flip);
  for (const i of [8, 11]) {
    rect(f, X(i), y - BH + 22, 1, 2, 'w');
    rect(f, X(i) + strings, y - BH + 24, 1, 1, 'w');
  }
  if (paw) {
    // The raised arm, from his shoulder to the paw: an outlined 2 px sleeve, then a round white paw.
    const [x1, y1] = [x + paw[0], y + paw[1]];
    const joints = [[X(15), y - BH + 23], [X(18), y - BH + 12], [x1, y1]]; // shoulder, elbow, paw
    for (const [c, r] of [['k', 2], ['o', 1]]) for (let s = 1; s < joints.length; s++) {
      const [[x0, y0], [xa, ya]] = [joints[s - 1], joints[s]], n = Math.max(Math.abs(xa - x0), Math.abs(ya - y0), 1);
      for (let i = 0; i <= n; i++) rect(f, Math.round(x0 + ((xa - x0) * i) / n) - r + 1, Math.round(y0 + ((ya - y0) * i) / n) - r + 1, 2 * r, 2 * r, c);
    }
    rect(f, x1 - 1, y1 - 1, 4, 4, 'k'); rect(f, x1, y1, 2, 2, 'w'); rect(f, x1 - 1, y1, 1, 2, 'w'); rect(f, x1, y1 - 1, 2, 1, 'w');
  }
}

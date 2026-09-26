// A Paris street: one tall stone facade, 160×240 world pixels, two screens high.
// Shots pick a window of it with `oy`, the world row at the top of the screen.
import { sprite, rect, dither, sky, PW } from '../pixel.js';

export const GROUND = 222; // world row the feet stand on
export const COLS = [20, 60, 100, 140]; // window centres
export const FLOORS = [50, 96, 142]; // window tops, top floor first
const WIN_W = 16, WIN_H = 30;
// Two balconies with a mover on each: A on the 3rd floor, B on the 4th, one bay to the right.
export const BALCONY_A = { x: COLS[1], y: FLOORS[1] + WIN_H - 8 };
export const BALCONY_B = { x: COLS[2], y: FLOORS[0] + WIN_H - 8 };

export function drawStreet(f, oy) {
  const Y = y => y - oy;
  // Sky, paler towards the rooftops.
  sky(f, Y(0), 30, oy);
  // Zinc mansard roof with its seams, two chimney stacks.
  for (const x of [26, 124]) { rect(f, x, Y(8), 12, 16, 'k'); rect(f, x + 1, Y(9), 10, 15, 'F'); rect(f, x + 1, Y(9), 10, 2, 'f'); rect(f, x + 3, Y(5), 2, 4, 'r'); rect(f, x + 7, Y(5), 2, 4, 'r'); rect(f, x + 2, Y(4), 8, 1, 'k'); }
  rect(f, 0, Y(22), PW, 18, 'g');
  for (let x = 2; x < PW; x += 6) rect(f, x, Y(22), 1, 18, 's');
  rect(f, 0, Y(22), PW, 1, 'k');
  // Cornice, then stone courses.
  rect(f, 0, Y(40), PW, 1, 'w'); rect(f, 0, Y(41), PW, 3, 'f'); rect(f, 0, Y(44), PW, 1, 'F'); rect(f, 0, Y(45), PW, 1, 'n');
  rect(f, 0, Y(46), PW, 132, 'f');
  for (let y = 53; y < 178; y += 8) rect(f, 0, Y(y), PW, 1, 'F');
  for (const top of FLOORS) for (const x of COLS) window(f, x, Y(top));
  // Ground floor: a green shopfront. Its striped awnings stop short of the two balconies' bays,
  // so the pianos go up (and come down) clear of them.
  rect(f, 0, Y(178), PW, 44, 'V');
  rect(f, 0, Y(178), PW, 1, 'k');
  for (const [x0, x1] of [[0, 40], [120, PW]]) {
    for (let x = x0; x < x1; x += 8) { rect(f, x, Y(179), 4, 7, 'r'); rect(f, x + 4, Y(179), 4, 7, 'w'); rect(f, x + 1, Y(186), 2, 1, 'r'); rect(f, x + 5, Y(186), 2, 1, 'w'); }
    rect(f, x0, Y(187), x1 - x0, 1, 'n');
    rect(f, x0 === 0 ? x1 - 1 : x0, Y(179), 1, 8, 'k');
  }
  for (const x of [6, 86]) { rect(f, x, Y(192), 68, 30, 'k'); rect(f, x + 1, Y(193), 66, 29, 'e'); for (let i = 0; i < 12; i++) rect(f, x + 8 + i, Y(194 + i), 1, 1, 'u'); }
  rect(f, 76, Y(190), 8, 32, 'v');
  // Pavement, kerb, road.
  rect(f, 0, Y(GROUND), PW, 10, 's');
  rect(f, 0, Y(GROUND), PW, 1, 'n');
  for (let x = 12; x < PW; x += 24) rect(f, x, Y(GROUND + 1), 1, 9, 'g');
  rect(f, 0, Y(232), PW, 2, 'c'); rect(f, 0, Y(234), PW, 1, 'g');
  dither(f, 0, Y(235), PW, 10, 'n', 'g', 4, oy); // runs past the bottom for the camera's overshoot
}

// The bus stop, left of where Bémol waits. It stands at the kerb, so draw it after him.
export function drawBusStop(f, oy) {
  rect(f, 32, 186 - oy, 2, 45, 'g'); rect(f, 32, 186 - oy, 1, 45, 's'); rect(f, 31, 230 - oy, 4, 1, 'k');
  rect(f, 27, 180 - oy, 12, 9, 'k'); rect(f, 28, 181 - oy, 10, 7, 'e'); rect(f, 29, 183 - oy, 8, 3, 'y');
}

// Every window of the two top floors has its little rail. Drawn after the movers, who stand behind.
export function drawRails(f, oy) {
  for (const top of FLOORS.slice(0, 2)) for (const x of COLS) balcony(f, x, top + WIN_H - 8 - oy);
}

function window(f, cx, y) {
  const x = cx - WIN_W / 2;
  rect(f, x - 2, y - 3, WIN_W + 4, 2, 'F'); rect(f, x - 2, y - 3, WIN_W + 4, 1, 'w'); // lintel
  rect(f, x, y, WIN_W, WIN_H, 'n');
  rect(f, x + 1, y + 1, WIN_W - 2, WIN_H - 1, 'e');
  for (let i = 0; i < 6; i++) rect(f, x + 2 + i, y + 3 + i * 2, 1, 2, 'u'); // a streak of sky in the glass
  rect(f, cx, y + 1, 1, WIN_H - 1, 'w'); rect(f, x + 1, y + 10, WIN_W - 2, 1, 'w');
}

// A wrought-iron rail over a small stone slab, 8 px high, its top bar at y.
function balcony(f, cx, y) {
  const x = cx - WIN_W / 2 - 2, w = WIN_W + 4;
  rect(f, x, y, w, 1, 'k');
  for (let i = 1; i < w; i += 3) rect(f, x + i, y + 1, 1, 7, 'k');
  rect(f, x + 1, y + 4, w - 2, 1, 'k');
  rect(f, x - 1, y + 8, w + 2, 2, 'w'); rect(f, x - 1, y + 10, w + 2, 1, 'F');
}

// A mover, a brown bear in a navy vest, from the waist up: the rail hides the rest.
// His paws (PAW) go on the rope, in front of his chest.
const MOVER_ROWS = [
  '..kk......kk..',
  '.kbbkkkkkkbbk.',
  '.kblbbbbbbbbk.',
  '.kbbkbbbbkbbk.',
  '.kbbbllllbbbk.',
  '.kbbllkkllbbk.',
  '..kbbllllbbk..',
  '..kkbbbbbbkk..',
  '.kbbeeeeeebbk.',
  'kbbkeeeeeekbbk',
  'kbbkeeeeeekbbk',
  'kbbkeeeeeekbbk',
  '.kbbkeeeekbbk.',
  '..kbbkeekbbk..',
  '..keeeeeeeek..',
  '..keeeeeeeek..',
  '..keeeeeeeek..',
  '..keeeeeeeek..',
];
export const MOVER = sprite(MOVER_ROWS);
// Staring down at the street: whites up, pupils down.
export const MOVER_STARE = sprite(MOVER_ROWS.map((r, i) => ['.kbwwbbbbwwbk.', '.kbkkbbbbkkbk.'][i - 2] ?? r));
// Paws slapped to his cheeks, mouth a big O: he has let go of everything.
export const MOVER_SHOCK = sprite([
  '..kk......kk..',
  '.kbbkkkkkkbbk.',
  '.kbwwbbbbwwbk.',
  '.kbwkbbbbkwbk.',
  'kkkbbllllbbkkk',
  'kFlkllkkllklFk',
  'kllkRRRRRRkllk',
  '.kkbRRRRRRbkk.',
  '.kbbkkbbkkbbk.',
  '.kbbeeeeeebbk.',
  '.kbbeeeeeebbk.',
  '.kbeeeeeeeebk.',
  '..keeeeeeeek..',
  '..keeeeeeeek..',
  '..keeeeeeeek..',
  '..keeeeeeeek..',
  '..keeeeeeeek..',
  '..keeeeeeeek..',
]);
export const PAW = sprite([
  '.kkk.',
  'kFFlk',
  'klllk',
  '.kkk.',
]);

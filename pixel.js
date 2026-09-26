// Pixel-art kit: a 160×120 frame of palette indices, drawn with rects and string sprites,
// then shown ×4 on the 640×480 canvas as flat runs of fillRect. No DOM needed, so it runs
// in Node too, and nothing is ever smoothed.

export const PW = 160, PH = 120, PX = 4;
export const FPS = 12;
// Sprite time: t held on a 12 fps grid, so motion steps like a sprite sheet.
export const step = t => Math.floor(t * FPS + 1e-6) / FPS;

// « Faubourg 22 »: Paris street under a spring sky. One char per colour, so sprites are typed as strings.
export const PALETTE = {
  k: '#1a1423', // ink
  n: '#3e3350', // night violet: deep shadow
  g: '#6b6784', // slate: zinc roof, iron
  s: '#a3a1b8', // pavement
  c: '#d6d2e0', // fur shade
  w: '#f7f3ec', // fur, highlights
  p: '#f29bb0', // pink: inner ears, nose, cheeks
  r: '#d8433a', // red
  R: '#7c2331', // wine: mouths
  O: '#b8561f', // burnt orange: hoodie shade
  o: '#f28a30', // orange: hoodie
  y: '#ffd650', // yellow: stars, lamp
  B: '#3f2519', // dark wood
  b: '#74432a', // wood
  l: '#b07a45', // light wood, hemp rope
  F: '#c29a70', // facade shade
  f: '#e8d2a6', // facade stone
  e: '#27406b', // navy: headphones, glass
  u: '#5a8fcf', // sky
  U: '#a9d4f2', // pale sky
  V: '#2f5a3c', // dark green
  v: '#5c9a4a', // green
};

const CODES = Object.keys(PALETTE);
const HEX = [null, ...Object.values(PALETTE)];
const code = ch => (ch === '.' ? 0 : CODES.indexOf(ch) + 1 || fail(`unknown colour '${ch}'`));
const fail = msg => { throw new Error(msg); };

export const frame = (c = 'k') => new Uint8Array(PW * PH).fill(code(c));

// A sprite typed as rows of palette chars, '.' for transparent. Parsed once, at module load.
export function sprite(rows) {
  const w = rows[0].length;
  rows.forEach((r, i) => r.length === w || fail(`sprite row ${i} is ${r.length} wide, not ${w}`));
  return { w, h: rows.length, px: rows.map(r => [...r].map(code)) };
}

const put = (f, x, y, i) => { if (i && x >= 0 && x < PW && y >= 0 && y < PH) f[y * PW + x] = i; };

export function rect(f, x, y, w, h, c) {
  const i = code(c);
  x = Math.round(x); y = Math.round(y);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(f, xx, yy, i);
}

// (x, y) is the sprite's top-left corner; flip mirrors it left to right.
export function stamp(f, s, x, y, flip = false) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) put(f, x + i, y + j, s.px[j][flip ? s.w - 1 - i : i]);
}

// Ordered 4×4 dither from colour a (level 0) to colour b (level 16). With a = null, only b is
// drawn, as a stipple over what is already there (shadows, dust).
// oy: the camera's world row, so the pattern sticks to the world when the camera pans.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function dither(f, x, y, w, h, a, b, level, oy = 0) {
  const A = a ? code(a) : 0, B = code(b);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    put(f, xx, yy, BAYER[((yy + oy) & 3) * 4 + (xx & 3)] < level ? B : A);
  }
}

// Sky over h rows from y: solid blue, three dithered bands, solid pale blue at the bottom.
export function sky(f, y, h, oy = 0) {
  for (let j = 0; j < h; j++) {
    const band = Math.min(4, Math.max(0, Math.floor((j / h - 0.45) * 8) + 1));
    dither(f, 0, y + j, PW, 1, 'u', 'U', band * 4, oy);
  }
}

// --- text: a 5×7 font, one glyph per line, rows split by '/' ---
// Capitals and x-height sit in rows 0–6; descenders and cedillas go below. A leading '^' starts
// the glyph two rows higher, for the accent over a capital.

const GLYPHS = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###', J: '..###/...#./...#./...#./#..#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '####./....#/....#/.###./....#/....#/####.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '.###./#..../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/....#/.###.',
  ':': './#/./././#/.', '!': '#/#/#/#/#/./#', '-': '.../.../.../###/.../.../...', ',': '../../../../../.#/#.',
  '.': './././././././#', ' ': '.../.../.../.../.../.../...',
  À: '^.#.../..#../.###./#...#/#...#/#####/#...#/#...#/#...#', É: '^...#./..#../#####/#..../#..../####./#..../#..../#####',
  È: '^.#.../..#../#####/#..../#..../####./#..../#..../#####', Ê: '^..#../.#.#./#####/#..../#..../####./#..../#..../#####',
  Ç: '.###./#...#/#..../#..../#..../#...#/.###./..#../.#...',
  a: '...../...../.###./....#/.####/#...#/.####', b: '#..../#..../####./#...#/#...#/#...#/####.',
  c: '...../...../.###./#..../#..../#...#/.###.', d: '....#/....#/.####/#...#/#...#/#...#/.####',
  e: '...../...../.###./#...#/#####/#..../.###.', f: '..##./.#..#/.#.../###../.#.../.#.../.#...',
  g: '...../...../.####/#...#/#...#/.####/....#/....#/.###.', h: '#..../#..../####./#...#/#...#/#...#/#...#',
  i: '.#./.../##./.#./.#./.#./###', j: '..#/.../.##/..#/..#/..#/..#/#.#/.#.',
  k: '#.../#.../#..#/#.#./##../#.#./#..#', l: '##./.#./.#./.#./.#./.#./###',
  m: '...../...../##.#./#.#.#/#.#.#/#.#.#/#.#.#', n: '...../...../####./#...#/#...#/#...#/#...#',
  o: '...../...../.###./#...#/#...#/#...#/.###.', p: '...../...../####./#...#/#...#/####./#..../#..../#....',
  q: '...../...../.####/#...#/#...#/.####/....#/....#/....#', r: '...../...../#.##./##..#/#..../#..../#....',
  s: '...../...../.####/#..../.###./....#/####.', t: '.#.../.#.../####./.#.../.#.../.#..#/..##.',
  u: '...../...../#...#/#...#/#...#/#..##/.##.#', v: '...../...../#...#/#...#/#...#/.#.#./..#..',
  w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.', x: '...../...../#...#/.#.#./..#../.#.#./#...#',
  y: '...../...../#...#/#...#/#...#/.####/....#/....#/.###.', z: '...../...../#####/...#./..#../.#.../#####',
  à: '.#.../..#../.###./....#/.####/#...#/.####', é: '...#./..#../.###./#...#/#####/#..../.###.',
  è: '.#.../..#../.###./#...#/#####/#..../.###.', ê: '..#../.#.#./.###./#...#/#####/#..../.###.',
  ç: '...../...../.###./#..../#..../#...#/.###./..#../.#...',
};
const FONT = Object.fromEntries(Object.entries(GLYPHS).map(([ch, g]) => {
  const rows = g.replace('^', '').split('/');
  rows.forEach(r => r.length === rows[0].length || fail(`glyph '${ch}' is ragged`));
  return [ch, { top: g[0] === '^' ? -2 : 0, rows }];
}));
const glyph = ch => FONT[ch] ?? fail(`no glyph for '${ch}'`);

export const textWidth = (str, scale = 1) => [...str].reduce((w, ch) => w + (glyph(ch).rows[0].length + 1) * scale, -scale);

// Capitals at (x, y) top-left, each font pixel scale×scale; ink draws a 1 px outline around them.
export function text(f, str, x, y, c, { scale = 1, ink } = {}) {
  for (const [pass, colour, grow] of ink ? [[0, ink, 1], [1, c, 0]] : [[1, c, 0]]) {
    let cx = x;
    for (const ch of str) {
      const { top, rows } = glyph(ch);
      rows.forEach((row, j) => [...row].forEach((on, i) => {
        if (on === '#') rect(f, cx + i * scale - grow, y + (top + j) * scale - grow, scale + 2 * grow, scale + 2 * grow, colour);
      }));
      cx += (rows[0].length + 1) * scale;
    }
  }
}

// A close shot: the w×h region of src at (sx, sy), every pixel doubled, into dst at (dx, dy).
export function zoom2(dst, src, sx, sy, w, h, dx = 0, dy = 0) {
  for (let j = 0; j < h * 2; j++) for (let i = 0; i < w * 2; i++) {
    const x = sx + (i >> 1), y = sy + (j >> 1);
    if (x >= 0 && x < PW && y >= 0 && y < PH) put(dst, dx + i, dy + j, src[y * PW + x]);
  }
}

// Draw the frame at (x, y) on the 640×480 canvas, one fillRect per run of same-coloured pixels.
export function present(ctx, f, x = 0, y = 0, scale = PX) {
  const runs = HEX.map(() => []);
  for (let j = 0; j < PH; j++) {
    for (let i = 0; i < PW;) {
      const c = f[j * PW + i];
      let n = 1;
      while (i + n < PW && f[j * PW + i + n] === c) n++;
      if (c) runs[c].push(i, j, n);
      i += n;
    }
  }
  runs.forEach((r, c) => {
    if (!r.length) return;
    ctx.fillStyle = HEX[c];
    for (let k = 0; k < r.length; k += 3) ctx.fillRect(x + r[k] * scale, y + r[k + 1] * scale, r[k + 2] * scale, scale);
  });
}

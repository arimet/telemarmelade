import assert from 'node:assert/strict';
import { span, bump, ease, keys, keysColor, mixColor, rand, sounds } from './engine.js';
import endOfWorld from './episodes/end-of-world.js';
import car from './episodes/car.js';
import piano from './episodes/piano.js';
import { frame, sprite, stamp, rect, present, step, PW, PH } from './pixel.js';
import { drawBemol, BW } from './characters/bemol.js';
import { drawStreet, drawRails } from './sets/pixel-street.js';
import { drawPiano, drawRopeCloseup } from './props/piano.js';

assert.equal(span(5, 0, 10), 0.5);
assert.equal(span(-1, 0, 10), 0);
assert.equal(span(11, 0, 10), 1);
assert.equal(span(3, 3, 3), 1, 'zero-length span is a step');
assert.equal(span(2.9, 3, 3), 0);

assert.equal(bump(1, 2), 0);
assert.ok(Math.abs(bump(2.25, 2) - 1) < 1e-9);

for (const [name, f] of Object.entries(ease)) {
  assert.ok(Math.abs(f(0)) < 1e-9, `${name}(0)`);
  assert.ok(Math.abs(f(1) - 1) < 1e-9, `${name}(1)`);
}

const k = [[0, 10], [2, 20]];
assert.equal(keys(-1, k), 10);
assert.equal(keys(1, k, ease.linear), 15);
assert.equal(keys(5, k), 20);
assert.equal(keys(1, [[0, 0], [2, 8, ease.in]]), 2, 'a key can bring its own easing');

assert.equal(mixColor('#000000', '#ffffff', 0.5), '#808080');
const jump = [[0, '#ffffff'], [1, '#ffffff'], [1, '#000000']];
assert.equal(keysColor(1, jump), '#ffffff');
assert.equal(keysColor(1.01, jump), '#000000');

assert.equal(rand(3), rand(3));
for (let n = 0; n < 100; n++) assert.ok(rand(n) >= 0 && rand(n) < 1);

// Smoke test: every frame draws without throwing, on a do-nothing context.
const ctx = new Proxy({}, {
  get: (o, k) => (k in o ? o[k] : () => ({ addColorStop() {} })),
  set: (o, k, v) => ((o[k] = v), true),
});
for (const episode of [endOfWorld, car, piano]) {
  assert.equal(episode.duration, 20);
  assert.equal(typeof episode.title, 'string');
  episode.cues.forEach((c, i) => {
    assert.ok(c.sound in sounds, `unknown sound ${c.sound}`);
    assert.ok(c.at >= 0 && c.at <= episode.duration, `cue ${i} out of range`);
    if (i) assert.ok(c.at >= episode.cues[i - 1].at, `cue ${i} out of order`);
  });
  for (let t = 0; t <= episode.duration; t += 0.05) episode.draw(ctx, t);
}

// Pixel kit: sprites are rectangular, drawing clips at the edges, runs merge same colours.
assert.throws(() => sprite(['kk', 'k']), /row 1/);
const px = frame('w');
stamp(px, sprite(['kk', 'kk']), -1, PH - 1);
assert.equal(px.filter(c => c !== px[0]).length, 1, 'a 2×2 sprite at the corner shows one pixel');
rect(px, 10, 10, 20, 1, 'k');
const rects = [];
present({ set fillStyle(v) {}, fillRect: (...a) => rects.push(a) }, px);
assert.deepEqual(rects.find(r => r[1] === 40), [40, 40, 80, 4], 'a 20 px run is one ×4 rect');
assert.equal(step(0.99), 11 / 12);

// The pixel set and cast draw in Node too.
const pf = frame();
drawStreet(pf, 120); drawRails(pf, 120); drawPiano(pf, 60, 14); drawBemol(pf, {}, 60, 102);
drawRopeCloseup(pf, { cut: 2, snapped: 0.1 });
assert.equal(BW, 20);

console.log('ok');

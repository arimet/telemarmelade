// A 1930s jalopy seen from the front, rubber hose style: headlights for eyes, the bumper for a grin,
// the whole body bouncing on its springs. Origin on the ground between the front wheels; about 200 wide.
import { INK, drawParts, ell, pie, place, smooth, wob } from '../lib/anidoodle.js';

const C = { body: '#5d5952', cab: '#4d4a45', glass: '#cbc5b8', grille: '#d8d3c7', rim: '#8f8a80', white: '#f6f3ea', tyre: INK };

// bounce: the body's lift on its springs (units); gaze, pupil: the headlights' pupils; boil: the drawing number;
// ink: line weight, 1 = the weight of the car drawn at scale 1.
export function drawCar(ctx, x, y, scale = 1, { bounce = 0, gaze = [0, 0], pupil = 1, boil = 0, squash = 0, ink = 1 } = {}) {
  const w = (pts, k) => wob(pts, 1.4, boil * 23 + k);
  const sy = 1 - squash, sx = 1 / Math.sqrt(sy);
  const Bd = pts => place(pts, [0, -bounce], 0, sx, sy); // the sprung body
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const parts = [];
  // Shadow under the car.
  parts.push({ fills: [{ pts: ell(0, 2, 118, 10, 0, 24), col: '#000000', alpha: 0.25 }] });
  // Wheels stay on the ground; the body rides above them.
  for (const s of [-1, 1]) {
    const tyre = ell(s * 78, -30, 21, 31, 0, 24);
    parts.push({ outline: [w(tyre, 1 + s)], ow: 2.4, fills: [{ pts: tyre, col: C.tyre }, { pts: ell(s * 78, -30, 9, 13, 0, 16), col: C.rim }] });
  }
  // Cab and windshield.
  const cab = Bd(smooth([[-66, -128], [-60, -196], [0, -204], [60, -196], [66, -128]], true, 5));
  const glass = Bd(smooth([[-52, -136], [-48, -186], [0, -192], [48, -186], [52, -136]], true, 5));
  parts.push({ outline: [w(cab, 10)], ow: 2.6, fills: [{ pts: cab, col: C.cab }, { pts: glass, col: C.glass }], details: [{ pts: Bd([[0, -191], [0, -137]]), w: 3 }, { pts: w(Bd(smooth([[-40, -176], [-30, -184], [-14, -186]], false, 4)), 11), w: 2.4, col: C.white }] });
  // Fenders: big round arches over the wheels.
  for (const s of [-1, 1]) {
    const f = Bd(smooth([[s * 50, -46], [s * 52, -86], [s * 80, -100], [s * 108, -84], [s * 112, -46], [s * 80, -60]], true, 5));
    parts.push({ outline: [w(f, 20 + s)], ow: 2.6, fills: [{ pts: f, col: C.body }] });
  }
  // Hood and radiator: the grille's bars read as teeth.
  const hood = Bd(smooth([[-56, -54], [-58, -128], [0, -136], [58, -128], [56, -54]], true, 5));
  const grille = Bd(smooth([[-32, -60], [-34, -140], [0, -152], [34, -140], [32, -60]], true, 5));
  const bars = [-20, -10, 0, 10, 20].map(bx => ({ pts: Bd([[bx, -142 + Math.abs(bx) * 0.3], [bx, -64]]), w: 2.2 }));
  parts.push({ outline: [w(hood, 30)], ow: 2.6, fills: [{ pts: hood, col: C.body }] });
  parts.push({ outline: [w(grille, 31)], ow: 2.6, fills: [{ pts: grille, col: C.grille }], details: bars });
  // Hood ornament.
  const orn = Bd(ell(0, -160, 6, 8, 0, 12));
  parts.push({ outline: [orn], ow: 2, fills: [{ pts: orn, col: C.white }] });
  // Headlights on stalks: the eyes.
  for (const s of [-1, 1]) {
    const c = [s * 66, -122];
    const lamp = Bd(ell(...c, 20, 22, 0, 26));
    parts.push({
      outline: [w(lamp, 40 + s)], ow: 2.8,
      fills: [{ pts: lamp, col: C.white }, { pts: Bd(pie(c[0] + gaze[0] * 5 - s * 2, c[1] + gaze[1] * 5 + 3, 7.5 * pupil, 11 * pupil)), col: INK }],
      details: [{ pts: Bd([[s * 50, -110], [s * 40, -100]]), w: 5 }],
    });
  }
  // Bumper: a long bar curving up at the ends, a grin.
  const bumper = Bd(smooth([[-118, -58], [-112, -44], [0, -36], [112, -44], [118, -58], [110, -52], [0, -46], [-110, -52]], true, 4));
  parts.push({ outline: [w(bumper, 50)], ow: 2.6, fills: [{ pts: bumper, col: C.grille }] });
  // Number plate.
  const plate = Bd([[-20, -34], [20, -34], [20, -20], [-20, -20]]);
  parts.push({ outline: [plate], ow: 2, fills: [{ pts: plate, col: C.white }], details: [{ pts: Bd([[-12, -27], [12, -27]]), w: 2 }] });
  drawParts(ctx, parts, ink);
  ctx.restore();
}

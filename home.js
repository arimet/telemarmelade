// Home page: a living room, drawn in the style the visitor picks, that zooms into its TV.
// ?room=crayon picks a style; ?ch=1&t=12.5 lands zoomed on a frozen frame (for review and screenshots).
import { createTV, loadChannels } from './tv.js';

const ROOMS = ['ukiyoe', 'toytheater', 'crayon'];
const DEFAULT_ROOM = 'toytheater';
const FULL = { x: 0, y: 0, w: 1600, h: 1000 };
const CLOSE = { x: 560, y: 200, w: 480, h: 360 }; // the part of the room repainted sharp for the close-up
const MAX_Z = 6; // device pixels per room unit for the close-up, at most
const STORE = 'telemarmelade.room';
const BULGE = 6; // room units the glass may bulge past TV_SCREEN

const $ = id => document.getElementById(id);
const world = $('world'), screen = $('screen'), glass = $('glass'), hint = $('hint');
const channelKnob = $('channel'), powerKnob = $('power');
const layers = [...document.querySelectorAll('.layer')];
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const dpr = () => devicePixelRatio || 1;

let room = null;   // the shown room module: { drawRoom, TV_SCREEN, TV_KNOBS }
let front = null;  // the layer showing it
let zoomed = false;
let loadId = 0;    // a newer choice makes older ones stale
let turns = 0;     // how many clicks the channel knob has turned

const tv = createTV($('tv'), await loadChannels(), {
  onChange({ on, channel, title }) {
    world.classList.toggle('on', on);
    world.style.setProperty('--power', on ? '100deg' : '0deg');
    screen.setAttribute('aria-label', on ? `Chaîne ${channel + 1} : ${title}` : 'Allumer le téléviseur');
    powerKnob.setAttribute('aria-label', on ? 'Éteindre le téléviseur' : 'Allumer le téléviseur');
  },
});
function zap(step) {
  turns += step;
  world.style.setProperty('--channel', `${turns * 45}deg`);
  tv.zap(step);
}

// --- painting, in a worker ---

const worker = new Worker(new URL('./room-worker.js', import.meta.url), { type: 'module' });
const waiting = new Map();
let jobs = 0;
worker.onmessage = ({ data: { id, bitmap } }) => { waiting.get(id)(bitmap); waiting.delete(id); };
const paint = (name, rect, z) => new Promise(done => { const id = ++jobs; waiting.set(id, done); worker.postMessage({ id, name, rect, z }); });

const painted = {}; // name → { mod, wide, close }: a style drawn once comes back instantly

// --- framing ---

// Where the room sits on screen: covering the window, or zoomed so the whole TV cabinet fills most of it.
function view(zoom, mod = room) {
  const vw = innerWidth, vh = innerHeight;
  if (!zoom) {
    const s = Math.max(vw / 1600, vh / 1000);
    return { s, x: (vw - 1600 * s) / 2, y: (vh - 1000 * s) / 2 };
  }
  const sc = mod.TV_SCREEN;
  // The cabinet is about 1.7 screens wide with its knobs, and 1.6 screens high.
  const s = Math.min((vh * 0.8) / (sc.h * 1.6), (vw * 0.8) / (sc.w * 1.7));
  const cx = sc.x + sc.w * 0.68, cy = sc.y + sc.h * 0.55;
  return { s, x: vw / 2 - cx * s, y: vh / 2 - cy * s };
}
function place(zoom) {
  const { s, x, y } = view(zoom);
  world.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

const px = (el, { x, y, w, h }) => Object.assign(el.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
const circle = ({ x, y, r }) => ({ x: x - r, y: y - r, w: r * 2, h: r * 2 });

function blit(canvas, bitmap, rect) {
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  px(canvas, rect);
}

// Put a painted room in a layer: the wide view, then (once painted) the sharp close-up
// and round copies of the two knobs, which can turn.
function fill(layer, { mod, wide, close }) {
  blit(layer.querySelector('.wide'), wide, FULL);
  layer.classList.toggle('sharp', Boolean(close));
  if (!close) return;
  blit(layer.querySelector('.close'), close, CLOSE);
  const z = close.width / CLOSE.w;
  layer.querySelectorAll('.turn').forEach((el, i) => {
    const r = circle(mod.TV_KNOBS[i]);
    el.width = el.height = Math.round(r.w * z);
    const ctx = el.getContext('2d');
    ctx.beginPath();
    ctx.arc(el.width / 2, el.height / 2, el.width / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(close, (r.x - CLOSE.x) * z, (r.y - CLOSE.y) * z, el.width, el.height, 0, 0, el.width, el.height);
    px(el, r);
  });
}

// A path traced on a canvas-like recorder, as an SVG path string relative to (ox, oy).
function svgPath(trace, ox, oy) {
  let d = '';
  const n = v => Math.round(v * 100) / 100;
  const pt = (x, y) => `${n(x - ox)} ${n(y - oy)}`;
  trace({
    moveTo: (x, y) => (d += `M${pt(x, y)}`),
    lineTo: (x, y) => (d += `L${pt(x, y)}`),
    quadraticCurveTo: (a, b, x, y) => (d += `Q${pt(a, b)} ${pt(x, y)}`),
    bezierCurveTo: (a, b, c, e, x, y) => (d += `C${pt(a, b)} ${pt(c, e)} ${pt(x, y)}`),
    closePath: () => (d += 'Z'),
  });
  return d;
}

const screenBox = () => {
  const { x, y, w, h } = room.TV_SCREEN;
  return { x: x - BULGE, y: y - BULGE, w: w + BULGE * 2, h: h + BULGE * 2 };
};

// The live picture and the click targets sit on the room's own drawing of its TV:
// the picture is cut to the exact shape of its glass, and the glass itself is laid over it.
function fitTV() {
  const box = screenBox();
  px(screen, box);
  screen.style.clipPath = `path('${svgPath(room.traceScreen, box.x, box.y)}')`;
  px(channelKnob, circle(room.TV_KNOBS[0]));
  px(powerKnob, circle(room.TV_KNOBS[1]));
}

async function choose(name) {
  const id = ++loadId;
  for (const b of document.querySelectorAll('.styles button')) b.setAttribute('aria-pressed', String(b.dataset.room === name));
  try { localStorage.setItem(STORE, name); } catch {}

  const entry = (painted[name] ??= { mod: await import(`./rooms/${name}.js`) });
  entry.wide ??= await paint(name, FULL, Math.min(view(false).s * dpr(), 2));
  if (id !== loadId) return;

  // Crossfade into the new room while the camera slides to its TV.
  const back = layers.find(l => l !== front);
  fill(back, entry);
  const switching = front !== null;
  room = entry.mod;
  world.classList.toggle('reframe', switching);
  fitTV();
  place(zoomed);
  back.classList.add('front');
  front?.classList.remove('front');
  front = back;
  if (switching) setTimeout(() => { if (id === loadId) world.classList.remove('reframe'); }, 950);

  entry.close ??= await paint(name, CLOSE, Math.min(view(true).s * dpr(), MAX_Z));
  if (id !== loadId) return;
  fill(front, entry);
  const box = screenBox(), z = entry.close.width / CLOSE.w;
  glass.width = Math.round(box.w * z);
  glass.height = Math.round(box.h * z);
  glass.hidden = room.SCREEN_GLASS === false; // a room can keep its texture off the picture
  glass.getContext('2d').drawImage(entry.close, (box.x - CLOSE.x) * z, (box.y - CLOSE.y) * z, glass.width, glass.height, 0, 0, glass.width, glass.height);
}

// --- the zoom in ---

function zoomIn() {
  if (reduced) return settle();
  world.classList.add('zooming');
  place(true);
  world.addEventListener('transitionend', function done(e) {
    if (e.target !== world || e.propertyName !== 'transform') return;
    world.removeEventListener('transitionend', done);
    settle();
  });
}
function settle() {
  world.classList.remove('zooming');
  zoomed = true;
  place(true);
  hint.classList.add('show');
}

// --- controls ---

screen.addEventListener('click', () => { if (!tv.isOn()) tv.power(true); });
screen.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !tv.isOn()) { e.preventDefault(); tv.power(true); } });
powerKnob.addEventListener('click', () => tv.power(!tv.isOn()));
channelKnob.addEventListener('click', () => zap(1));
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') zap(1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') zap(-1);
});
for (const b of document.querySelectorAll('.styles button')) b.addEventListener('click', () => choose(b.dataset.room));
let resizing;
addEventListener('resize', () => {
  clearTimeout(resizing);
  resizing = setTimeout(() => room && place(zoomed), 150);
});

// --- start ---

let saved = null;
try { saved = localStorage.getItem(STORE); } catch {}
const first = choose([params.get('room'), saved, DEFAULT_ROOM].find(r => ROOMS.includes(r)));
// Show the room as soon as its wide view is painted; the close-up keeps painting behind.
await new Promise(r => { const wait = () => (front ? r() : setTimeout(wait, 30)); wait(); });
world.classList.add('ready');
if (params.has('t')) {
  settle();
  await first;
  tv.still((+params.get('ch') || 1) - 1, +params.get('t'));
} else {
  tv.run();
  setTimeout(zoomIn, 700);
}

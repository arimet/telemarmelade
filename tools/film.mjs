// Renders a coded episode to MP4, picture and synthesised sound, for sharing or review.
// Needs the site served (BASE, default http://localhost:5190), playwright-core and ffmpeg.
// Frames leave the page in batches of 20, so long or grainy episodes do not exhaust its memory.
// usage: node tools/film.mjs <module from site root> <out.mp4> [from] [to] [fps]
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const [mod, out, from = '0', to, fps = '30'] = process.argv.slice(2);
const dir = new URL('../out/frames/', import.meta.url).pathname;
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage();
await p.goto((process.env.BASE ?? 'http://localhost:5190') + '/index.html?t=0');
const end = await p.evaluate(async ([mod, to]) => {
  const { W, H } = await import('/engine.js?' + Date.now());
  window.ep = (await import(mod + '?' + Date.now())).default;
  const c = document.createElement('canvas'); c.width = W * 1.5; c.height = H * 1.5;
  window.x = c.getContext('2d'); window.c = c;
  return to ?? window.ep.duration;
}, [mod, to === undefined ? undefined : +to]);
const n = Math.round((end - +from) * +fps);
for (let i0 = 0; i0 < n; i0 += 20) {
  const batch = await p.evaluate(([i0, n, from, fps]) => {
    const out = [];
    for (let i = i0; i < Math.min(n, i0 + 20); i++) {
      x.setTransform(1.5, 0, 0, 1.5, 0, 0); ep.draw(x, from + i / fps);
      out.push(c.toDataURL('image/png').split(',')[1]);
    }
    return out;
  }, [i0, n, +from, +fps]);
  batch.forEach((f, k) => writeFileSync(`${dir}f${String(i0 + k).padStart(4, '0')}.png`, Buffer.from(f, 'base64')));
}
const wav = await p.evaluate(async ([from, end]) => {
  const { sounds } = await import('/engine.js');
  const rate = 44100, oac = new OfflineAudioContext(1, Math.ceil(rate * (end - from)), rate);
  for (const cue of ep.cues) if (cue.at >= from && cue.at < end) sounds[cue.sound](oac, cue.at - from, cue);
  const data = (await oac.startRendering()).getChannelData(0);
  const buf = new DataView(new ArrayBuffer(44 + data.length * 2));
  const str = (o, s) => [...s].forEach((ch, i) => buf.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); buf.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVEfmt ');
  buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
  buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true);
  str(36, 'data'); buf.setUint32(40, data.length * 2, true);
  data.forEach((v, i) => buf.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true));
  let bin = ''; new Uint8Array(buf.buffer).forEach(v => (bin += String.fromCharCode(v)));
  return btoa(bin);
}, [+from, end]);
writeFileSync(`${dir}sound.wav`, Buffer.from(wav, 'base64'));
await b.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', fps, '-i', `${dir}f%04d.png`, '-i', `${dir}sound.wav`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', out]);
console.log(n, 'frames →', out);

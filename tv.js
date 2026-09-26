// The TV's picture tube: power, channels, snow between them. Each channel plays one episode, then moves on.
// A channel is either an episode drawn in code ({ title, duration, cues, draw }) or a video file
// from video/ ({ title, src }). The page decides what the set looks like; this drives the canvas and the sound.
import { W, H, sounds, clamp, ease, span } from './engine.js';
import endOfWorld from './episodes/end-of-world.js';
import car from './episodes/car.js';
import piano from './episodes/piano.js';

const CODED = [endOfWorld, car, piano];
const POWER_ON = 0.45, SNOW = 0.5, HOLD_END = 2.5; // seconds

// Coded episodes first, then the videos listed in video/episodes.json (see video/README.md).
export async function loadChannels() {
  let videos = [];
  try { videos = await (await fetch('video/episodes.json')).json(); } catch {}
  return [...CODED, ...videos.map(v => ({ title: v.title, src: `video/${v.file}` }))];
}

export function createTV(canvas, channels, { onChange = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  const video = Object.assign(document.createElement('video'), { playsInline: true, preload: 'auto' });
  let ac = null;      // one AudioContext per tuning: closing it silences the channel we leave
  let tunedAt = 0;    // ac time when the channel was tuned
  let start = 0;      // ac time when the episode's t = 0
  let warming = false;
  let channel = 0;
  let playTimer = 0;

  const isVideo = () => 'src' in channels[channel];
  const duration = () => (isVideo() ? video.duration || Infinity : channels[channel].duration);

  function tune(to, { powerOn = false } = {}) {
    channel = (to + channels.length) % channels.length;
    ac?.close();
    clearTimeout(playTimer);
    video.pause();
    ac = new AudioContext();
    warming = powerOn;
    tunedAt = ac.currentTime;
    const snowAt = tunedAt + (powerOn ? POWER_ON : 0);
    sounds.static(ac, snowAt, { dur: SNOW });
    start = snowAt + SNOW;
    const episode = channels[channel];
    if (isVideo()) {
      if (!video.src.endsWith(episode.src)) video.src = episode.src;
      video.currentTime = 0;
      playTimer = setTimeout(() => video.play().catch(() => {}), (start - tunedAt) * 1000);
    } else {
      for (const cue of episode.cues) sounds[cue.sound](ac, start + cue.at, cue);
    }
    onChange({ on: true, channel, title: episode.title });
  }

  const isOn = () => ac !== null;
  function power(on) {
    if (on) return tune(channel, { powerOn: true });
    ac?.close();
    ac = null;
    clearTimeout(playTimer);
    video.pause();
    onChange({ on: false, channel });
  }
  const zap = step => (isOn() ? tune(channel + step) : power(true));

  // --- drawing ---

  const snowBuffer = new OffscreenCanvas(160, 120);
  const snowCtx = snowBuffer.getContext('2d');
  const snowPixels = snowCtx.createImageData(160, 120);
  function snow() {
    const d = snowPixels.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = Math.random() * 255;
      d[i + 3] = 255;
    }
    snowCtx.putImageData(snowPixels, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(snowBuffer, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  }

  // The picture tube warming up: a dot that stretches into a line, then opens into the picture.
  function warmUp(k) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const w = W * ease.out(span(k, 0, 0.45)), h = Math.max(2, H * ease.in(span(k, 0.45, 1)));
    ctx.fillStyle = '#f4f8ff';
    ctx.fillRect((W - w) / 2, (H - h) / 2, w, h);
  }

  // A video of any shape is shown whole, centred; the bands beside it are filled with the same picture
  // enlarged, blurred and darker, so there is never any black border and nothing is cropped.
  function videoFrame() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return;
    const fit = s => [vw * s, vh * s];
    const [cw, ch] = fit(Math.max(W / vw, H / vh)), [w, h] = fit(Math.min(W / vw, H / vh));
    ctx.save();
    ctx.filter = 'blur(14px) brightness(0.55)'; // browsers without canvas filters just get it darker
    ctx.globalAlpha = 'filter' in ctx ? 1 : 0.45;
    ctx.drawImage(video, (W - cw) / 2, (H - ch) / 2, cw, ch);
    ctx.restore();
    ctx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
  }

  function channelNumber() {
    ctx.font = '700 30px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.shadowColor = '#000'; ctx.shadowOffsetX = ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#7dff7a';
    ctx.fillText(`CH ${String(channel + 1).padStart(2, '0')}`, 64, 50); // clear of the rounded corners
    ctx.shadowColor = 'transparent';
  }

  const full = () => ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);

  function frame() {
    full();
    if (!isOn()) ctx.clearRect(0, 0, W, H); // off: the room's own drawing of the dark screen shows through
    else {
      const now = ac.currentTime - tunedAt;
      const t = ac.currentTime - start;
      if (warming && now < POWER_ON) warmUp(now / POWER_ON);
      else if (t < 0) snow();
      else {
        ctx.save();
        if (isVideo()) videoFrame();
        else channels[channel].draw(ctx, Math.min(t, duration()));
        if (t < 2) channelNumber();
        ctx.restore();
        if (t > duration() + HOLD_END) tune(channel + 1);
      }
    }
    requestAnimationFrame(frame);
  }

  // A frozen frame of a coded episode, for review and screenshots: no sound, no loop.
  function still(ch, t) {
    channel = clamp(ch, 0, channels.length - 1);
    full();
    ctx.save();
    if (!isVideo()) channels[channel].draw(ctx, clamp(t, 0, duration()));
    ctx.restore();
    onChange({ on: true, channel, title: channels[channel].title });
  }

  return { power, zap, isOn, still, run: () => requestAnimationFrame(frame) };
}

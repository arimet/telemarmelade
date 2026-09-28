# Télémarmelade

A living room, drawn in the style you pick (woodblock print, paper toy theatre or crayon), zooms into
its old TV. Switch it on: it plays « 20 s avant… », 20-second cartoons where the audience sees the
disaster coming and the hero does not.

| Channel | Episode | Style |
|---|---|---|
| 1 | 20 s avant la fin du monde | Happy Tree Friends-like puppet, `episodes/end-of-world.js` |
| 2 | 20 s avant que la voiture ne me renverse | 1930s rubber hose, `episodes/car.js` |
| 3 | 20 s avant que le piano ne tombe | pixel art, `episodes/piano.js` |
| 4–6 | Petits Tracas de la Forêt, by Guillaume Billey | video, `video/` |
| 7 | Carrefour sanglant, by Julien M | video, `video/` |
| 8–9 | La poussette folle, in 3D and as an illustration, by Julien M | video, `video/` |

More videos can be added as channels: see `video/README.md`. How the coded episodes were made, and
with which Claude Code skills: [MAKING-OF.md](MAKING-OF.md).

## Run it

```bash
npm run serve
```

Then open http://localhost:5190, wait for the zoom, click the screen. The top knob (or ← →) changes
channel, the bottom knob switches the set off.

## How it is built

- Plain ES modules and Canvas 2D, no build step. The site has no dependencies.
- An episode drawn in code is a module `{ title, duration, cues, draw(ctx, t) }`: `draw` is a pure
  function of time on a 640×480 canvas, and `cues` are synthesised sounds (`engine.js`).
- Rooms (`rooms/*.js`) export `drawRoom(ctx)`, `TV_SCREEN` and `TV_KNOBS`. They are painted in a
  worker (`room-worker.js`) and repainted sharp around the TV for the close-up (`home.js`).
- `tv.js` drives the picture tube: power, snow, channels, coded episodes and video files.
- Design notes and storyboards: `docs/design.md`. Character sheets: `sheets/`.

## Check and render

```bash
npm test
```

Draws every frame of every coded episode in Node and checks the sound cues.

```bash
npm run film -- /episodes/car.js out/car.mp4
```

Renders an episode to MP4 with its sound, while the site is served. It needs ffmpeg and
`playwright-core` (`npm install`).

Episode 2 draws on parts of [anidoodle](https://github.com/alexgreensh/anidoodle), Apache 2.0: see
`lib/anidoodle.js`, `NOTICE` and `LICENSE-anidoodle`.

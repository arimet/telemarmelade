# Télémarmelade — design

A website showing an old TV that plays short cartoon episodes. Every episode is titled
« 20 s avant… » and lasts exactly 20 seconds: the audience sees the catastrophe coming, the hero
does not. Visual reference: Happy Tree Friends (cute animals, bright flat colours, disaster).

This spec covers **episode 1 only**, played alone on a page. The TV frame, episode chaining and MP4
export come later.

## Episode 1 — « 20 s avant la fin du monde »

**Hero:** Pépin, a round honey-coloured hamster with pink cheeks and big white eyes. He sits at a
wooden garden table, sandwich ready, missing only the pickles.

A `00:20` countdown ticks in a corner for the whole episode (series signature).

| Time | On screen | What Pépin misses |
|---|---|---|
| 0–5 s | Title overlay (first ~2 s). Pépin grabs the jar and twists the lid. | A small red dot appears in the sky. |
| 5–10 s | He strains: red face, puffed cheeks, feet braced on the table, sweat drops. | The meteor grows, the sky turns orange, birds flee across the frame. |
| 10–15 s | He bangs the jar on the table edge, then tries his teeth. At ~13 s he looks up, sees only a cloud, shrugs. | The ground shakes, the meteor's shadow covers the garden. |
| 15–19 s | Last effort, « POP ! » (~16.2 s): the lid flies off, he raises a pickle, beaming. | Light turns white. |
| 19–20 s | White flash, then black and silence. The lid lands, « tink ». Card: « FIN (du monde) ». | |

## Look

- Flat fills, thick black outline (~4 px at 640×480). No gradients except the sky.
- 4:3 frame, 640×480 logical units (old TV).
- Pépin is animated by squash and stretch plus interpolated key poses; no skeleton.
- Fixed set: lawn, table, fence, sky. Only the sky, the meteor, the shadow and the birds change.
- Sky: light blue (0–5 s) → orange (5–15 s) → burnt red (15–19 s) → white (19 s) → black.
- Effects: screen shake growing from 10 s to 19 s, speed lines and stars on the pop, sweat drops.

## Sound

All synthesised with Web Audio, no files. Starts only after a click on « play » (autoplay policy).

| Cue | When |
|---|---|
| lid creak | each twist attempt |
| rumble (low, rising) | 5 s → 19 s |
| bird chirps | ~7 s |
| jar knock | each bang on the table (10–12 s) |
| pop | ~16.2 s |
| white noise whoosh | 19 s |
| silence, then tink | ~19.6 s |

## Code

Folder `Hackday/telemarmelade`. Native ES modules, no build step; the site has no dependencies (playwright-core is only for `tools/`). Code in English.

| File | Role |
|---|---|
| `index.html` | 640×480 canvas, play button, `?t=` handling |
| `engine.js` | animation loop, tween and easing helpers, outlined shapes, sound synthesis |
| `episodes/end-of-world.js` | `draw(ctx, t)` and a list of timed cues `{ at, sound }` |
| `test.mjs` | `assert` checks: tween bounds, easing endpoints, cues sorted and inside [0, 20] |

**Rule:** the picture is a pure function of `t`. `draw` never keeps state between frames, so:

- `?t=12.5` shows the exact frame at 12.5 s, paused (review and screenshots);
- a new episode is a new file with the same `{ duration, draw, cues }` shape;
- MP4 export later = step `t` frame by frame.

Randomness (birds, stars, shake) uses a seeded function of `t`, never `Math.random`.

## Verification

Local static server, screenshots at 2, 7, 12, 17 and 19.5 s via `?t=`; `node test.mjs` passes;
no console errors while playing through.

## Out of scope (for now)

TV frame, several episodes / zapping, MP4 export, hosting.

## Episode 3 — « 20 s avant que le piano ne tombe » (pixel art)

**Hero:** Bémol, a white rabbit in an orange hoodie, red headphones on, eyes shut, dancing at a bus
stop. Two bear movers hoist two upright pianos by hand, each rope drawn straight over a balcony's
square iron rail (no pulley): A on the 3rd floor, B on the 4th, one bay (40 px) to the right.

| # | Temps | Cadre | Action |
|---|---|---|---|
| 1 | 0–3 s | Plan d'ensemble, panoramique vertical du toit à la rue (4 px par image) | Titre. Les deux ours hissent chacun un piano, la corde passée par-dessus la rambarde. Bémol arrive en sautillant, casque sur les oreilles, s'arrête à l'arrêt de bus, pile sous le piano A. |
| 2 | 3–6 s | Rue, plan fixe | Il danse en attendant le bus : tête qui dodeline, pied qui tape, un saut de côté à droite (40 px), puis retour à gauche, en rythme. Au-dessus, le piano A monte par à-coups ; chaque traction grince. |
| 3 | 6–8 s | Gros plan de profil : la corde sur la rambarde A | À chaque traction la corde frotte sur l'arête du fer carré. « ping » : un toron casse et s'ébouriffe ; traction suivante, « ping », un deuxième. |
| 4 | 8–10,5 s | Rue, plan fixe | Yeux fermés, pattes levées, il bat la mesure. Des brins de chanvre tombent en voletant devant lui ; il ne les voit pas. Le piano A oscille. |
| 5 | 10,5–11,5 s | Gros plan corde | Le dernier toron s'étire, s'amincit… « twang ». Le bout libre fouette vers le haut. |
| 6 | 11,5–15 s | Rue, plan fixe | Le piano A tombe ; au même instant, sur le temps, Bémol fait son saut à droite. BRAOUM à sa gauche : touches, planches, poussière, l'écran tremble. Il sursaute, le casque lui saute des oreilles et tombe sur le trottoir. Il fixe l'épave, puis nous : soulagement, il s'essuie le front du dos de la patte. « Ouf ! » |
| 7 | 15–17,2 s | Plan rapproché (×2), balcon B | L'ours B fixe l'épave, nous regarde, refixe l'épave, tremble… et plaque ses deux pattes sur ses joues (16,45 s) : il a lâché la corde. Elle file sur la rambarde, le piano B descend (freiné par la corde, 0,4 g) et sort du cadre par le bas. |
| 8 | 17,2–20 s | Rue, puis noir | Bémol sourit encore ; le piano B descend au-dessus de lui, sifflement, l'ombre fonce autour de ses pieds. Une oreille frémit, il baisse les yeux vers l'ombre, puis les lève : oreilles en V, pattes aux joues, « ! ». 18 s : contact, coupe au noir, accord dissonant. 18,7 s : « FIN » ; dessous (×2), Bémol aplati, trois étoiles qui tournent, le casque à côté qui grésille. |

**Look:** 160×120 pixels, shown ×4 (640×480) as flat runs of `fillRect`, so nothing is ever smoothed
and it draws in Node. Palette « Faubourg 22 » (`pixel.js`), 1 px ink outlines, 4×4 ordered dither for
the sky. Time is held on a 12 fps grid (`step(t)`), so motion steps like a sprite sheet. Sprites are
strings of palette chars; the character sheet is `sheets/piano.html`.

**Sounds** (new names in `engine.js`): `ropeCreak`, `pat`, `leak`, `strandPing`, `ropeTwang`,
`fallWhistle`, `ropeRun`, `pianoCrash`, `chordClang`, `clatter`, `phew`, `slap`.

The street shots all draw the same world at global time (`world(f, oy, T)`), only framed
differently; two shots (balcony B, the coda) are a 2× integer zoom of it (`zoom2`).

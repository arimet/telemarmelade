# Making of Télémarmelade

Everything drawn in code here was made during a single hack day by Anthony Rimet and
[Claude Code](https://claude.com/claude-code), Anthropic's coding agent, working as a pair.
Anthony directed and reviewed; Claude designed, drew, animated, voiced and tested, in code. This
covers the three coded episodes, the three living rooms and the TV. The videos in `video/` came from
elsewhere (see [Contributed videos](#contributed-videos)).

Nothing in this repo is a generated image or a generated video. Every frame is drawn by the
JavaScript in `episodes/`, `characters/`, `sets/`, `props/` and `rooms/`, and every sound is
synthesised by `engine.js`.

## The skills behind it

Claude Code skills are packaged ways of working that the agent loads for a task. These did the work:

| Skill | What it was used for |
|---|---|
| `superpowers:brainstorming` | Every new piece started as a design conversation before any code: the episode ideas, the storyboards, the look, the technique, the TV, the rooms. Each got a short proposal, then an explicit "ok" from Anthony. |
| `superpowers:writing-plans` | Turned the approved design of episode 1 into a step-by-step implementation plan. |
| `superpowers:executing-plans` | Carried that plan out step by step, with checks between steps. |
| Subagents, in parallel git worktrees | Episodes 2 and 3 were each made by their own agent in its own worktree and branch, at the same time, then merged. The three rooms were drawn by three agents in parallel from one shared brief, so they can be compared. |
| [anidoodle](https://github.com/alexgreensh/anidoodle) | Alex Greenshpun's code-drawn animation kit. Episode 2 uses the pieces of its rubber hose style it needs: noodle limbs, gloves, pie-cut eyes, line boil, film print. They are ported to plain JavaScript in `lib/anidoodle.js`, under Apache 2.0 (`NOTICE`, `LICENSE-anidoodle`). |

The loop was checked with ffmpeg and Playwright:
- `tools/film.mjs` renders any episode to MP4, picture plus synthesised sound, for review;
- filmstrips extracted with ffmpeg were read frame by frame before anything was shown to Anthony;
- `npm test` draws every frame of every episode in Node.

## The method

The first attempt at episode 1 was drawn and animated in one go. Anthony found it ugly, not in the
style asked for, and stiff. Everything after that followed the same steps:

1. **Study the reference, frame by frame.** A fan-made Happy Tree Friends episode was cut into
   contact sheets and consecutive frames with ffmpeg. The rules were read off them: thin outlines in
   a dark shade of the fill, flat colour, huge touching eyes, pastel sets, constant expression swaps.
2. **A character sheet first**, four expressions, still. Nothing moves until it is approved. That is
   how Pépin went from a hamster to a fox.
3. **One 3-second test shot**, rendered to MP4 with sound, to judge the motion.
4. **Then shot by shot, each reviewed as a video.** The animation rules:
   - pose to pose, each key with its own easing (`keys(t, [[t, v, easing]])`);
   - anticipation before an action, overshoot after it;
   - follow-through, computed as the same track slightly delayed (`lean(t - 0.12)`), which is how ears,
     tails and hats trail the body;
   - expressions that swap in a tenth of a second.
5. **Every gesture has to make physical sense.** Anthony caught the ones that did not: paws that were
   not on the lid, a paw sliding on a lid that is supposed to be stuck. They were redone so that
   something grips, something strains, something resists (the paw now grips, strains, then slips off).

An episode is a module `{ title, duration, cues, draw(ctx, t) }`, and `draw` is a pure function of
time. That one rule is what makes the rest easy:
- `?t=12.5` shows any frame;
- the tests draw every frame;
- the same code plays live on the TV and renders to MP4;
- a shot can cut back to a world where time kept going off screen.

## The episodes

| Episode | Hero | Style | Notes |
|---|---|---|---|
| 1. 20 s avant la fin du monde | Pépin, a fox | Happy Tree Friends-like puppet, Canvas 2D | Eight shots and a shared world with one camera per shot. The meteor grows in the same sky in every shot, and crashes behind the hills. |
| 2. 20 s avant que la voiture ne me renverse | Filou, a raccoon | 1930s rubber hose, sepia film print | The coin is a real 3D disc drawn through each shot's camera, so it rolls, curves and tips into the tram rail's groove as a coin would. Lines boil at 12 fps; blood stays red in the grey print, as if tinted by hand. |
| 3. 20 s avant que le piano ne tombe | Bémol, a rabbit | Pixel art, 160×120 ×4, 22-colour palette | Sprites step at 12 fps; the camera scrolls a whole pixel at a time. The dance's side step both saves him from the first piano and puts him under the second. |

All three end the way the series they borrow from would: badly. The gore is cartoon, and shared in
`props/gore.js`.

## The living room and the TV

Three agents drew the same room from the same brief, as a woodblock print, a paper toy theatre and
a crayon drawing: `rooms/*.js`.
- **Contract:** each room exports `drawRoom(ctx)`, the rectangle and exact outline of its TV screen
  (`TV_SCREEN`, `traceScreen`) and its knobs (`TV_KNOBS`).
- **Painting:** the page paints a room in a Web Worker, so switching styles never freezes it.
- **Close-up:** after the zoom, the page repaints the TV region sharp at up to 6×.
- **The picture:** it is cut to the room's own glass, and the room's glint is laid over it.
- **Knobs:** round copies of the drawn knobs turn when used.

## Contributed videos

`video/` holds episodes made outside this repo and added as extra channels:

- **Petits Tracas de la Forêt**, episodes 1 to 3, by Guillaume Billey
  ([@guilbill](https://github.com/guilbill)).
- **Carrefour sanglant** and **La poussette folle** (in 3D and as an illustration), by Julien M
  ([@JulienMattiussi](https://github.com/JulienMattiussi)).

How they were made is theirs to tell.

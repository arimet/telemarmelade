# video/

Episodes from other sources: filmed, made in another tool, found elsewhere. The TV plays them as
extra channels, after the episodes drawn in code (`episodes/`).

To add one:

1. Drop the file in this folder. MP4 (H.264 + AAC) plays in every browser; WebM works too.
2. Add a line to `episodes.json`:

   ```json
   [
     { "title": "20 s avant que le café ne déborde", "file": "cafe.mp4" }
   ]
   ```

Any length and any shape: the whole picture is shown on the 4:3 screen, and the bands beside a wider
(or taller) video are filled with a blurred copy of it, so there is no black border. Its own sound
track plays. Keep text away from the corners: the screen's are rounded. The channel number follows the order of the list.

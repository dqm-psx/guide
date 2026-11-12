# Individual monster images

Monster portraits and overworld sprites are published as individual, lossless
WebP files in `media/`. The `SPRITE_IMAGES` manifest records each file's native
width and height. Runtime portraits and standalone monster pages use ordinary
`img` elements, so browser image actions operate on that monster alone.

Rebuild with Pillow installed:

```sh
python scripts/build-sprite-images.py
node scripts/sync-stage-site.js
```

The existing extracted PNG data remains the build source. The exporter decodes
each WebP after writing it and compares every RGBA byte against the PNG. It
preserves the entire native frame, including transparency; it does not resample,
recolor, trim or redraw monster images. CSS preserves aspect ratio and uses
pixel rendering for display enlargement.

There are 325 portraits and 325 overworld images, totaling 472,966 bytes. The
explicit full offline download includes all 650. Ordinary browsing loads the
images it uses, with lazy loading for images farther down the page. Publication
fingerprints the manifest URLs and standalone image URLs so cached images update
when their content changes.

For a fresh Chromium profile at 1440×1000, opening monster 0 used two portrait
sheets totaling 136,730 bytes before this change. The same view requested twenty
individual portraits totaling about 11 KB after the change. This measures image
body bytes, not overall page size or network latency. Individual images trade
more requests for smaller per-page payloads and normal browser image behavior.

NPC and item artwork already used individual image elements rather than monster
sheet viewports. This export replaces the monster sheet path specifically.

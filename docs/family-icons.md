# Monster-family icons

The guide displays the family emblems at 20×20 beside the family name. Slime
uses a custom 20×20 blue Slime with a red smile, generated with ImageGen and
saved as lossless WebP. The other ten emblems use the original 10×10
PlayStation menu glyphs at double size. Each image has empty alt text because
the adjacent label names the family.

<details>
<summary>Slime icon generation prompt</summary>

Create one tiny Dragon Quest blue Slime family emblem for a PlayStation fan guide. Transparent background. Front-facing, broad low blue teardrop with a single pointed tip, two small separated white eyes with dark pupils, and a clear upturned red smile. Flat pixel art on a coarse 20×20 grid, enlarged with square pixels. Bold navy silhouette, cobalt body, a small sky-blue highlight. Center the complete Slime and fill the square. No text, border, badge, scenery, or cast shadow.

</details>

## Native identification

`WriteFamilyIconGlyph` writes `FB (0x32 + family) FF`. The small text renderer
decodes this as glyph `0x113 + family`. The library detail renderer independently
uses the same index, 10×10 size, and CLUT `0x7F90` (VRAM x256, y510).

The native glyph UV table has 25 ten-pixel cells per row. Glyphs 0x113–0x11D
therefore occupy x0–109 at y110 on the menu texture page. Archive resource 5542
(`FONT`) texture block 1 supplies this row at VRAM x960, y366 (112×10 pixels);
block 46 supplies the palette. Family order is Slime, Dragon, Beast, Bird,
Plant, Bug, Demon, Zombie, Material, Water, and ???? (Boss).

The original Japanese FONT resource SHA-256 is
`1086ad724326325e944d6dfc0e543c563a5593a8622fdff53a969408b5baf0c3`.
The extractor checks this identity and texture/palette placement, then verifies
every exported image's RGBA pixels after decoding the WebP.

The English v1.0.74 font stores block 1 with native run-length compression.
After decoding, all 100 RGBA pixels of each in-game family emblem match the
Japanese release. The guide adds a faint outline
around the transparent silhouettes in dark mode.

```sh
python scripts/build-family-icons.py /path/to/extracted/asset_5542.bin
```

The script uses the existing checked native LZ decoder. It does not require or
produce a patched disc. All eleven individual images are included in the guide's
offline download and receive content fingerprints during publication.

# Native monster-family icons

The eleven icons are the original PlayStation menu/library glyphs, extracted
as individual lossless 10×10 WebP images. Their pixels and palette are unchanged.
CSS displays them at 20×20 with nearest-neighbor pixel rendering; the adjacent
family name remains real text. The images have empty alt text because that name
already communicates their meaning.

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
After decoding, all 100 RGBA pixels of each family emblem match the Japanese
release, including the Slime's large white eyes. The guide adds a faint outline
around the transparent silhouettes in dark mode.

```sh
python scripts/build-family-icons.py /path/to/extracted/asset_5542.bin
```

The script uses the existing checked native LZ decoder. It does not require or
produce a patched disc. All eleven individual images are included in the guide's
offline download and receive content fingerprints during publication.

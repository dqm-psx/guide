# Terry and Milly’s home

The atlas previously omitted the opening home. Its name and dialogue use an
executable text pool, while the original atlas importer expected scene-local
dialogue. It is an ordinary rendered map with a special title source, not an
unidentified GreatTree room.

## Native identity

The verified map is scene **103**, area **0**, resource **5587**, with its map
descriptor at resource offset **0x74F8**. It is one **40 × 15 tile** map
(**640 × 240 pixels**) containing the bedroom and adjoining living room. The
guide does not invent separate floors or an exterior.

Its native title is **Your Room**, from public translation source
`static_extra_pools.json:e0affe4_0000`. This title uses the executable catalog at
`0x800BF7E4`; the group/offset/text pointers start at `0x800BF7EC`. The original
118-entry offset table is at EXE offset `0xAF72C`, and its text starts at
`0xAF818`. The current release relocates the text through its resident loader.
The atlas resolves that loader before reading the title, and the normal name
refresh can update this specific verified map binding.

Three native 16-byte arrival records select tile group **15**, entry **38**,
scene **103**, area **0**:

| Sequence | Resource | Record offset |
| --- | ---: | ---: |
| Opening | 5578 | `0x106C` |
| Ending | 5377 | `0x3080` |
| Return | 5630 | `0x1D034` |

The room has **no ordinary doorway transition table or grid-backed exit pins**.
Travel in its story sequences is scripted. The guide therefore shows the map
and opening walkthrough relationship without adding a fictitious door to
GreatTree.

## Characters and dialogue

The confirmed characters are **Terry, Milly, Warubou and Watabou**. The opening
uses child Milly’s home appearance, separately from the later queen appearance.
The native sprite selector preceding each arrival uses group 6 entry 197,
resource 5585. Its slot 0 is the home Milly actor; the opening event initializes
that actor before her first line. The sprite builder verifies both discs and
the scene-specific appearance bindings.

All **37 visible room text entries** were matched against the current released
resident text and the synchronized public translation snapshot. Original text
offsets identify the corresponding message slots. Milly’s first opening entry
is `e0affe4_019b`, Warubou’s is `e0affe4_0291`, and Watabou’s is
`e0affe4_037f`. The character pages group opening and return conversations
separately. The room has no spoken Terry lines. References to the siblings’
parents do not establish parent actors or dialogue, so no parents are added.

## Reproducible checks

`scripts/audit-terry-home.py` accepts `--original-bin`, `--current-bin` and
`--comparison`. It authenticates the Japanese retail disc and current v1.0.73
disc, checks the atlas binding, compares all three arrival records, verifies the
map and tile banks byte-for-byte, confirms the lack of ordinary exits, and
checks all 37 visible room strings against native message slots.

The room resource is identical on both discs:
`69a5fc274f7204545e014a23f9fde392cd535971f5ab5b70222dbe1ff8c0a351`.
Tile resource 5586 is also identical:
`4bae0f60fd8c776ac3aced91abb7ba4aefb65860cf58780d71ddcf816bd1e01f`.

The standard atlas builder independently re-renders the new map from the
authenticated v1.0.66 baseline and checks its input data against v1.0.73. Its
verified output now contains 408 maps in 185 places. The source-reconstruction
script preserves and rechecks explicit native supplements so rebuilding from
the older export cannot silently remove this room.

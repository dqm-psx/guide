# Terry boss dialogue bindings

`scripts/boss-dialogue-dqm1.json` assigns 136 public dialogue records to 32 boss
encounters: the 16 existing Terry boss articles and 16 additional encounters
in `data/world-guide.js`. The additional records provide native
species, gate and final-map identities without adding unsourced battle advice.
Healie already has a character transcript and retains that page.

The selected records were checked against public translation snapshot
`e5097e6e9403abda92130144b44488c84bfcb0e3` (translation source
`a5b29b8686d49453f5a47c0dbef7b326a2bf810a`).
All records belong to `dialogue/main/0000_1999.json`. Text is resolved during
the existing wording sync; the bindings contain IDs rather than copied prose.

## Attribution

| Encounter | Source pool | Included speaker records |
| --- | --- | --- |
| Dragon | `s001b5000` | `033c`, `035c`, `03a1`, `03c9` |
| Golem | `s001bc000` | `0016`, `001f`, `00a3`, `00cd` |
| Great Sabrecat | `s001c2800` | `0016`, `007f`, `009d` |
| Treeface | `s001c8800` | `003c`, `0086`, `00b1` |
| Demon Knight | `s001cf800` | `0017`, `005d`, `0087` |
| Fang Slime | `s001d6000` | `041d`, `046f`, `04bb`, `04e8` |
| Big Eye | `s001dd000` | `0014`, `0064`, `0083` |
| Gigantes | `s001e3800` | `0015`, `002b`, `0049` |
| Living Statue | `s001ea800` | `00ae`, `00c2`, `00d8` |
| Sky Dragon | `s001f1800` | `0015`, `0039`, `005f` |
| Funky Bird | `s001f8000` | `0018`, `003c`, `0064`, `0091` |
| Battle Rex | `s00200800` | `0068`, `00d8`, `01af`, `0200`, `0227` |
| Jamiras | `s00211000` | `0054`, `00ca`, `013f`, `0183`, `01b6`, `0215` |
| Demon Servant | `s00217800` | `0018`, `005f`, `00aa`, `00f3`, `0111` |
| King Slime | `s0021e800` | `0166`, `0193` |
| Lips | `s0021e800` | `0102`, `0124` |
| Matango | `s0021e800` | `01de`, `0205` |
| Dark Horn | `s00225800` | `006b`, `00dc`, `0126` |
| Akbar | `s0022d800` | `0095` through `0296`, excluding object descriptions |
| Orochi | `s00234000` | `0018`, `0068`, `008c`, `00b9` |
| Durran | `s0023b800` | `0018` through `036e` |
| Dragonlord | `s00244000` | `0017` through `023f` |
| Hargon | `s0024b800` | `0016` through `0151` |
| Shido | `s0024b800` | `0226`, `026f`, `0296` |
| Baramos | `s00254000` | `0016`, `00d2`, `013c` |
| Zoma | `s0025b800` | `0015`, `010e`, `0185` |
| Psaro | `s00263000` | `0014`, `00de`, `0124`, `01c0`, `025c` |
| Estark | `s0026b000` | `0016`, `00e0`, `0109`, `0164`, `01cc`, `0230` |
| Mildrath | `s00272800` | `0017`, `006d`, `0113`, `01bc`, `0223` |
| Mudo | `s0027a000` | `0015` through `014e` |
| Deathmore | `s00281000` | `0015`, `0157`, `02b6` |
| Darkdrium | `s00288800` | `0055`, `009d`, `0115`, `01d7` |

The JSON lists each full source ID explicitly. Phase headings distinguish the
initial encounter, repeat challenge and aftermath; alternate responses within
a phase remain separate passages.

Darkdrium is an exception: these are retained unused lines, not an executable
boss encounter. Nameless Place's script directory is empty in both the original
Japanese game and v1.0.73. See [the native audit](hidden-gate-evidence.md).

## Native checks and exclusions

The original Japanese disc was authenticated with SHA-256
`a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29`.
Native `0x29` message commands were resolved through each scene's group and
offset tables, using the catalog's original message offsets.

The Tower of Trials is especially easy to misattribute because the monsters
use human disguises. Resource 88 maps the three fixed battles as follows:

| Native formation | Species | Before-battle command | After-battle command |
| --- | --- | --- | --- |
| 3 | King Slime, index 9 | `0x8c`: group 4/message 0 | `0x210`: group 4/message 1 |
| 2 | Lips, index 149 | `0xc8`: group 3/message 0 | `0x334`: group 3/message 1 |
| 1 | Matango, index 122 | `0x104`: group 5/message 0 | `0x452`: group 5/message 1 |

The street tout's group 2 messages and Watabou's message 2 in each of groups
3–5 are excluded. The corresponding formation/species checks already appear
in `build-gate-generation.py`.

Resource 76 calls Treeface's encounter messages at `0x481`/`0x48a` and its
aftermath at `0x11a`. The forest sign and the other trees' short responses at
`s001c8800_011f`/`012e` are excluded from the boss transcript.

Durran's resource 92 message sequence ends at the conclusion of
`s0023b800_036e`. The older swordsman's following `04ba`–`072b` records and
Watabou's `076a` are excluded. The older swordsman's `s001dd000_011d`,
`s00200800_0148`/`015e`, and `s00234000_00df` onward are likewise excluded from
Big Eye, Battle Rex and Orochi. Princess Laura's lines, scenery descriptions,
player narration, and Watabou's closing remarks are not boss dialogue.

Dungeon Shrimp has no selected spoken record: the spirit of the spring handles
the conversation and summons it. Its dialogue must not be attributed to the
monster. Hargon and Shido have separate transcripts for their separate visits.

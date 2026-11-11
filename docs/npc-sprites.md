# NPC portrait evidence

The portrait audit compares the original Japanese PSX disc with the Current
v1.0.73 English patch. [The generated receipt](npc-sprite-evidence.json) records
the disc hashes, native resource and sprite slot, exported PNG hash and dimensions
for all 41 native portraits. Healie and Slib use their existing monster-species
sprites instead.

## Milly

Milly's previous portrait came from resource 2852, slot 5: a pink-armored arena
fighter. Its DQM2 conversation host can speak for Kameha, Terry or Milly at
different points in the story. Finding Milly's name in that conversation did
not identify the host's initial artwork as Milly.

The corrected portrait is the blonde character in the Queen's Room in Terry's
adventure: map `11,6`, actor 4, graphics resource **5659, slot 4**. In scene
resource 5661, the actor definition at `0x17CD8` selects sprite slot 4. The actor's
talk pointer at `0x124` selects script `0x3430`; its instruction at `0x347F`
selects message slot **1371**. This conversation identifies Milly, mentions her
visit to the queen, and offers to breed her Skeleton Swordsman.

The builder verifies the actor-set record, definition, talk pointer, message
instruction, scene arrival and sprite-pack selector on both discs. The complete
conversation bytecode at `0x3430..0x34E6` (end exclusive) is identical. The portrait
is decoded directly from the native 32×32 frame without recoloring or resizing.

Milly's edited character entry also links the Queen's Room (`map-11-6`) alongside
her GreatLog arena maps. The canonical dialogue bindings put her 12 breeding
passages under the Queen's Room, separately from her three Starry Night reunion
and match passages and nine GreatLog arena passages. All spoken text is retained;
the standalone name-menu label is excluded from the dialogue. Reviewed name
bindings keep the new GreatTree and Queen's Room mentions in the translation
refresh.

## Laura

Laura's existing crowned portrait is correct for this game. Swamp Cave's scene
resource **73**, actor **2**, selects graphics resource **4116, slot 2**. Message
slot **102** identifies the speaker as Laura, princess of Radatome. The native
game reuses this royal artwork for other characters, including the Queen of
GreatTree; a shared appearance does not make them the same character.

The actor definition, dialogue instruction, talk pointer and graphics assignment
were checked on both discs. The portrait is retained.

## Tife

Tife's existing dancer-like portrait is also present in Terry's adventure. The
published portrait comes from graphics resource **5644, slot 19**, joined to
scene resource **5661** and Tife's conversation in message slot **1208**.

Two further Terry scenes use exactly the same first-facing pixels:

| Place | Native map | Graphics resource / slot | Actor |
| --- | --- | --- | --- |
| Monster Arena | `11,2` | `5650 / 8` | 8 |
| GreatTree Tavern | `11,4` | `5653 / 4` | 4 |

The definitions, talk pointers, arrivals, graphics selectors and frame pixels
for these appearances were checked against both discs. The artwork is not
exclusive to Cobi and Tara's adventure, so Tife's portrait is retained.

## Reproducing the audit

Run from the guide checkout with the character research directory and the two
authenticated disc images:

```sh
python scripts/build-npc-sprites.py --wiki <character-research> --bin <v1.0.73-current.bin> --original-bin <japanese-original.bin> --check
```

Omit `--check` to rebuild `data/npc-sprites.js` and the receipt. The builder
verifies disc hashes, resource-group assignments, native graphics resource
hashes, and every published portrait's decoded pixels. Reviewed named-speaker
bindings additionally verify their actor and conversation records on both
discs. Teto's documented position change in the English patch is checked
explicitly; his actor, sprite and conversation identities are unchanged.

The named-speaker lookup rejects a host with multiple named speakers. Such a
host needs a separate scene/state proof, as Milly now has. These checks cover
the selected portraits, not every costume, animation or story appearance.

# v1.0.74 guide update

The player-facing additions follow the [published v1.0.74 release](https://github.com/dqm-psx/patch/releases/tag/v1.0.74), its `release.json`, and the README and BUILD.json inside the authenticated Enhanced ZIP. The local prototype ZIP is not the published package.

| Identity | Value |
| --- | --- |
| Published | 2026-11-13 08:03:17 UTC |
| Source revision | `11d6abacc1ce217b8f1e5521a180c3135628b296` |
| Enhanced ZIP SHA-256 | `8ff3ec16f0eb78281c6718aaf96fd0dc59035a40f0cfe0a3a501a46df9ba1017` |
| Enhanced BIN SHA-256 | `04b30048a0dc1c207801041a410925aba0283da6793ba3989b98f46a38543b15` |
| Translation-only ZIP SHA-256 | `92e03a29c4e0e29353615219269a78b9891d06e4ce66aea113cdbb9ba7447415` |

Both downloads use Current wording and the default fonts. Both include the Truth Gate bug fix and corrected library rarity stars. Enhanced includes the optional gameplay, interface and restored-content features; Translation only does not. The original two-player Colosseum remains in both.

## Additions and connections

- The GreatTree Arena article covers the revenge-match unlock, Replay, Pro Classes, Survival and rewards. It is linked from the postgame walkthrough and Monster Elder.
- The personality article describes party conversations in both GreatTree and GreatLog, distinguishing the newly added GreatLog interaction.
- The Aibou quest explains the four milestone prizes, 312 registered species, 99 deposited medals, farm space and repeatable exchange. Both Medal Man pages, both postgame walkthroughs and Aibou's profile link to it.
- `data/patch-rewards.js` adds separately labeled Enhanced acquisition sources to item and monster pages. It does not overwrite the older native extraction or alter breeding rules.

The reward lists were checked against the exact released source revision: `greattree_arena_prizes.py` (27 Survival egg species), `greattree_arena_items.py` (74 selectable items plus the separate medal bundle), and `greattree_arena_pro_rewards.py` (nine Pro classes and equipment draws). Species identities use the native family/member mapping, and item identities remain the existing native IDs. Pro lists exclude Magic Keys; random equipment spans IDs 64–92. Each item's source lists eligible classes, without presenting unnormalized prize weights as percentages.

Aibou is now discoverable in the standard library view, but retains its original extra-slot identity in the verified breeding dataset. Its acquisition is explicitly Enhanced-only. Hidden Gate remains unused in v1.0.74.

## Verification boundaries

The reviewed release metadata advances to v1.0.74. The existing disc-based gameplay verification remains v1.0.73: release notes and source inspection are not a new execution of those native checks. No alternate-profile disc builds were performed for this guide update. Generated names and dialogue continue to follow the separately pinned public translation export.

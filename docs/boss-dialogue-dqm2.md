# Cobi and Tara boss dialogue bindings

`scripts/boss-dialogue-dqm2.json` assigns 119 public dialogue records to all 13
existing Cobi and Tara boss articles. Wording is read from the same pinned
public translation export as the other character dialogue. No English dialogue
is copied into the binding file.

The initial review used the native dialogue catalog identities, the Current
edition text and surrounding records in `dialogue/main/0000_1999.json` and
`dialogue/main/2000_3999.json`. Every selected identity was then checked against
public snapshot `e5097e6e9403abda92130144b44488c84bfcb0e3`, translation revision
`a5b29b8686d49453f5a47c0dbef7b326a2bf810a`.

An article's existing `source_ids` are evidence for its guide instructions, not
a list of that boss's speech. They can include kings, guards, other characters,
treasure acquisition messages and hints. The new bindings select the speaker's
records individually instead of copying that list or taking an entire scene.

| Article | Reviewed conversation | Exclusions and distinctions |
| --- | --- | --- |
| `boss-dam-builder` | `s004c3000`: dam confrontation and resolution. `s00488000_082d`–`096a`: his return to the recovered home and recruitment offer. | Excludes the king's interleaved responses and the recruitment notification. The return conversation explicitly identifies the speaker as the monster the player previously defeated. |
| `boss-bandit-leader` | `s00488000_01de`–`0461`: introduction, battle, retry and departure. | Excludes the king, bandit followers, displaced residents and the dam builder's later recruitment. |
| `boss-western-cape-dancer` | `s00530000_0009`–`020a`: challenge, retry and recruitment responses. | Excludes the joining notification. The singing and dance hints in Polonia are another speaker, not the cave monster. |
| `boss-ghost-ship-pirates` | `s00494000_0228`–`0294`: restless crew, and `02ae`–`0349`: confrontation. | The article describes the pirates collectively. Crew speech and boss confrontation have separate groups; rope, logbook, treasure and inventory text are excluded. |
| `boss-northden-impostor` | `s0044a800`: false king's orders before the rescue; explicit exposure and battle speech. | `King:` alone does not identify the speaker. The two claimants' ambiguous `1d3c`–`1e7c` exchange is not assigned to this boss. The real king's alarm, thanks and later conversation are excluded. |
| `boss-yuna-puppet` | `s004ee000_1def`–`1ef3`: puppet confrontation. | Excludes examining the puppet, the returning-soul message and all restored Yuna speech beginning at `1f24`. |
| `boss-spring-attacker` | `s004d6000_0553`–`06aa`: challenge, refusal, retry and defeat. | Excludes the spirit, reward messages, Warubou and tunnel guards. |
| `boss-lake-tower-wizard` | `s00368000`: wizard and guardian records. | The wizard and his speaking guardian are distinct scene groups. Excludes visiting masters' advice, silent-doll narration and the arresting guards. |
| `boss-dead-king` | `s002d3000_04bd`–`058b`: greeting, conditional recognition, challenge, retry and defeat. | Excludes inscriptions, ghosts' puzzle clues, other treasure seekers and item messages. |
| `boss-small-cave-guardian` | `s00373000_025e`, `02a4`, `02ca`: challenge, retry and defeat. | Excludes the four-member treasure-hunting party and passage/treasure narration. |
| `boss-sky-impostor` | `s002e4800`: claimed Demon Lord identity and Kameha's revelation. | Uses separate groups before and after the identity reveal. Excludes castle guards, treasure handovers, the Dark Master and Darck. |
| `boss-dark-master` | `s002e4800`: interruption and retreat. `s002f4000_001a`–`03d3`: final confrontation. | Excludes Kameha, Darck and the player's item handovers. Earlier disguised encounters retain their own boss-article bindings. |
| `boss-darck` | `s002e4800`: introduction and bargain. `s002f4000_0443`–`07c7`: final battle. | Excludes the Dark Master's interleaved dialogue, Kameha, Warubou and treasure messages. |

All selected records contain one speaker, so this file needs no line omissions.
Scene groups distinguish the wizard from the guardian and the pirates' crew
from the confrontation. The standard dialogue builder preserves current wording,
removes known speaker prefixes, substitutes the player's name placeholder and
deduplicates repeated passages within each article. These are reviewed records,
not a claim that every possible line in the shared native scene belongs to the
boss.

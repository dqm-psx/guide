# Imported monsters in the skill and damage tools

The local save reader supplies the same roster to My game, skill/growth planning and damage calculations. Calculators copy values into a plan; neither calculator changes the roster or source file. The importer does not retain the memory-card bytes, player/master IDs or player/master names. Nickname import remains optional. Copy-plan links contain calculation inputs, with local team/monster identifiers removed.

## Native fields and reconstruction

The packed monster records begin at save offset `0x250`, with 50 records of `0x88` bytes. The existing reader continues to check the native checksum, campaign, party indices and active card-directory entries before offering an import. Eggs, unavailable monsters and unsupported species are excluded.

| Value | Packed record offset | Treatment |
| --- | --- | --- |
| Species, sex, breeding +, level, actual level cap | `0x04` | Native bitfields; unsupported calculator values remain unknown |
| Current HP and MP | `0x08`, bits 0–9 and 10–19 | Restore to monster offsets `0xA0` and `0xA4`. Current MP determines whether a party member could afford a combo component at save time. A saved zero is valid. |
| Cumulative EXP and EXP remaining to next level | `0x58`, `0x5b` | Two unsigned 24-bit values unpack to `0x70` and `0x74`. Resource 104's experience award routine updates both and clears the remaining EXP at the level cap. |
| Pedigree | `0x68`, `0x72` | Two parent nicknames and two 18-bit parent identities (member, family, +, sex) followed by four 11-bit grandparent identities (member, family, sex). Native child construction copies each parent's parents in order. Member zero is an empty ancestor. The nicknames checkbox covers parent nicknames as well. |
| Personality and wildness | `0x25`–`0x27`, `0x18` | Native unpack reconstructs personality index 1–27 at `0x99` and copies wildness to `0xb0`. English personality names are system entries `e1237`–`e12dc` in released v1.0.74. |
| Base maximum HP/MP, Attack/Defense, Agility/Intelligence | `0x0c`, `0x10`, `0x14` | Two 10-bit stats per word, before equipment |
| Individual resistance | `0x08`–`0x1c` | All 27 native 3-bit channels, preserving channel order |
| Accessory | `0x18`, bits 8–12 | `31` means none; otherwise item ID is selector + `0x40` |
| Learned skills | `0x20`, `0x45`, `0x86` | Eight six-bit selectors; `63` is empty; special selectors use the native 34-entry table |
| Learning candidates | `0x40`, `0x48`, `0x72` | Reconstruct own/parent natural candidates for the saved campaign, apply native deltas, append 16 saved candidates |
| Ranch/storage state | `0x1c` | Party order takes priority; stored monsters are marked hibernating for learning checks |

The compact `data/save-reference.js` contains campaign natural-skill tables, special learned-skill selectors and the 31 accessory records addressable by the save. It is extracted from both authenticated discs. The builder rejects differing native monster packing/unpacking spans, equipment restoration, selector tables or natural-skill tables. It does not assert that every other part of the save routines is identical: the English release changes unrelated player-state packing outside the checked monster spans.

Battle stats reproduce `RestoreEquipment`: copy base stats, apply the accessory's fixed modifier and clamp to 999. Status-only and growth-only accessories do not add to the six current battle stats. Growth projections continue to exclude equipment growth bonuses and future seed use.

Unknown skills remain `null`, distinct from a verified empty list. Unsupported numeric metadata or an incomplete resistance list is never silently replaced with zero. A species, level or breeding-+ edit invalidates the old imported snapshot. Legacy/manual roster entries still work, with missing values left blank. A DQM2 team without an exact campaign does not imply Cobi or Tara.

The saved candidate pool is authoritative, including a verified empty pool. Removed or upgraded own-natural candidates are not reintroduced from the species table. The learning model's explicit `candidateSkills` input replaces its usual natural-plus-inherited pool; ordinary manual plans retain the usual species-based behavior. The share URL records `pool=current` even when its candidate list is empty, so dropping private roster identifiers does not change the calculation. Numeric forecasts keep this context; choosing another species, adventure or parents clears it. An unavailable imported candidate pool or learned-skill list blocks a readiness claim until the player supplies the missing information, re-imports or explicitly chooses species-based planning.

The monster's campaign seeds a fresh damage comparison. An explicit encounter adventure in an existing plan takes priority, and changing the owned comparand preserves the selected encounter.

Editing Level, Attack or Defense detaches the plan from the roster without changing its copied resistance profile or an explicit resistance override. The plan URL retains all 27 individual resistance channels, so changing the enemy's move or reopening a shared plan still uses that monster's resistance. Choosing another species or roster entry replaces the profile. An already-learned skill, including one replaced by a later upgrade, is identified as such instead of displaying a missing learning route.

## Adventure Log, treasury and collection

The card summary at `0x124` stores hours and minutes. Bit 2 of `0x12c` is
the game's cleared-adventure indicator. Each card slot is decoded independently.

| Save offset | Player-visible data and native evidence |
| --- | --- |
| `0x14c` bits 15–31, `0x150` bits 12–31 | Gold on hand and in the bank. Unpacking restores the respective words at `0x800c797c` and `0x800c7980`. Field gold changes update the first (`0x80016618`), and the bank's stored-gold window reads the second (`0x8004ec44`). |
| `0x157` | The bag holds up to 30 individual seven-bit item IDs. Bits 2–6 at `0x150` give its active length. Copies are counted by item. Equipped accessories live in each monster record. |
| `0x172`, `0x1ca` | The bank pairs a stream of seven-bit item IDs with a stream of seven-bit quantities. Only the 97 slots used by `0x80013f60` belong to the bank. An empty ID terminates the list. These streams have no per-copy remaining-use counters. |
| `0x1f38` | Medal collector's current deposit balance at `0x800c71ec`. Loose Tiny Medals (item 44) can appear in the bag or bank. |
| `0x222` | Species ever registered, even after an individual leaves the roster. The 11 family widths at `0x80010424` include member zero. Normal roster registration skips members 23 and above in the final family. The 312 library entries are species indices 0–311. Encountering a species alone does not register it. |
| `0x1ef0`, `0x1ce0` | Cobi/Tara fixed-key slots 0–11, then up to 20 appraised or mysterious key records. The first two headers already exist before Warubou's gift. The GreatLog event in resource 131 displays the two receipt messages and sets bit zero at `0x11c0`. Subsequent fixed keys use bit `slot − 1`. World record bits 14–15 at +4 are 1 for mysterious and 3 for appraised. The Dimension Key name in the catalog has no regular fixed-key slot. |
| Monster record `+0x04`, `+0x1c` | Eggs retain species and breeding bonus. The original egg list shows sex only after appraisal (status exactly `0x4000`). Eggs and named extra species such as Aibou stay separate from standard breeding entries. |

For each appraised key, the game reseeds its generator from the saved 16-bit
world seed. The routine at `0x800391e4` selects a modifier with the weighted
table at `0x800a6cac`, then uses the theme index in the second world-header
word. The reference builder reads catalog groups 22–24 from the authenticated
English release to reproduce the short menu labels.

The parity check exercises 96 synthetic Adventure Logs on each disc. It compares
gold, bank balances, carried items, bank stocks, medal deposits and registered
species against native RAM. It also executes the key-name routine up to both
catalog lookups for 64 distinct appraised keys per disc. Unit cases cover the
full 312-entry denominator, a save from before the first key gift, an
unappraised key, named extra species and the 97-slot storage boundary.

## Independent verification

Arena victories use the campaign-specific, numbered Japanese event descriptions from the retail executable. The save copies the native event bitset to `0x1ef0`. Terry records classes G–D in flags 1–4 and C–S in flags 6–9. Cobi and Tara record Kids’, C, B, A and S in flags 27–31. Each marked class is reported independently. Arena reward draws, replay selections and individual bout numbers are separate state.

The saved 40-byte scene descriptor at `0x1f10` restores to `0x800d73b0`. Its little-endian scene (+4) and area (+6) correspond to the atlas' native arrival descriptors. Story-dependent and generated scene modes resolved during load by `0x8006c2e0` are omitted. Only a matching named atlas entry supplies a player-facing location.

The roster's upcoming-skills view projects natural gains for the next party level-up and tests the saved candidates, retained upgrades and accessible combination routes. For direct candidates it finds the first projected level meeting the level and base-stat thresholds up to the individual cap. Later upgrades and combinations depend on what the player retains. The view excludes known or superseded moves, shows unmet requirements and preserves the earlier-combination ordering caveat. Storage, individual level caps and the need to choose a replacement at eight learned moves stay visible.

`scripts/verify-save-planner-native.py` executes the original MIPS `UnpackSaveFile` (`0x8002667c`), `GetSpeciesIndex` and `RestoreEquipment` in Unicorn. It compares their reconstructed monster records with the shipped JavaScript reader. Only heap allocation, the environmental reset and movement of ranch records into active-party slots are stubbed. Checksum verification and the unpacking/calculation routines execute from each disc.

The synthetic suite covers every saved accessory encoding in all three campaigns, capped battle stats, all 27 resistance channels, both parents' natural candidates, an upgraded candidate, the final direct-candidate slot, all eight learned slots, and a special selector requiring its high bit. It uses invented saves and no player files.

Verified result: **96 synthetic saves / 288 monster comparisons per disc, 576 comparisons total**, matching both the Japanese retail release and English v1.0.73.

The extended suite compared current HP and MP as well as the existing fields
in 96 synthetic saves per disc on retail Japanese and v1.0.74 Enhanced. All 576
monster comparisons passed, including zero HP/MP, all three campaign variants
and each accessory encoding. Backups imported before these two fields were
recorded have unknown current HP/MP until the player re-imports the save.

Reproduce with local copies of the authenticated discs:

```text
python scripts/build-save-reference.py --bin PATCHED.bin --original-bin ORIGINAL.bin --check
python scripts/verify-save-planner-native.py --bin PATCHED.bin --original-bin ORIGINAL.bin --python-packages UNICORN_PACKAGES
node --test tests/unit/save-import.test.js tests/unit/owned-monsters.test.js
npx playwright test tests/browser/owned-monsters.spec.js tests/browser/save-import.spec.js tests/browser/skill-planner.spec.js tests/browser/combat-planner.spec.js
```

Unit tests additionally cover exclusions, malformed fields, read-only copies, stale identities and guide-backup round trips. Browser tests cover one import feeding both tools, direct tool reloads, explicit species-link precedence, deleted/changed roster state and share links that reproduce the selected individual resistance without exposing local roster identifiers.

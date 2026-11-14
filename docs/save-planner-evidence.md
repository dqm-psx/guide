# Imported monsters in the skill and damage tools

The local save reader supplies the same roster to My game, skill/growth planning and damage calculations. Calculators copy values into a plan; neither calculator changes the roster or source file. The importer does not retain the memory-card bytes, player/master IDs or player/master names. Nickname import remains optional. Copy-plan links contain calculation inputs, with local team/monster identifiers removed.

## Native fields and reconstruction

The packed monster records begin at save offset `0x250`, with 50 records of `0x88` bytes. The existing reader continues to check the native checksum, campaign, party indices and active card-directory entries before offering an import. Eggs, unavailable monsters and unsupported species are excluded.

| Value | Packed record offset | Treatment |
| --- | --- | --- |
| Species, sex, breeding +, level, actual level cap | `0x04` | Native bitfields; unsupported calculator values remain unknown |
| Current HP and MP | `0x08`, bits 0–9 and 10–19 | Restore to monster offsets `0xA0` and `0xA4`. Current MP determines whether a party member could afford a combo component at save time. A saved zero is valid. |
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

## Independent verification

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

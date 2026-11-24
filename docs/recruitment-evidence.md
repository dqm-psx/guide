# PSX recruitment evidence

The Recruiting article also covers recovery items, Terry’s gate bosses and ordinary foreign masters. The calculator remains limited to listed wild encounters, meat and Starry Orb; the additional article guidance does not expand its supported inputs.

The calculator estimates the joining check for the **eligible defeated candidate already selected by the game**. It does not estimate encounter frequency, the chance that a particular enemy becomes that candidate, or all scripted eligibility and party/farm capacity restrictions. Each enemy in an encounter does not receive an independent joining roll.

The data contains 283 guide-listed wild encounter contexts and 1,131 enemy records across Terry, Cobi and Tara. Species IDs, context IDs, levels, recruitment classes and native species ranks are stored; displayed names and floor labels come from the existing guide references so translation updates do not change identity. Arena, master and special battle records are excluded. Terry contexts 122–125, belonging to the retained unused gate, are also excluded.

## Sources and verification

The primary sources are native instructions and tables from the Japanese retail disc and English v1.0.73. The matching routines were previously documented and exercised in the [DQM PSX Master's Reference](https://dqm-psx.github.io/manual/), repository revision `0548201759747b6e00b1897c96aa2555ac8303a0`:

- `tools/verify_recruitment.py` and `research/recruitment-verification.json`
- `tools/verify_recruitment_eligibility.py` and `research/recruitment-eligibility.json`
- `tools/verify_sirloin_stacking.py` and `research/sirloin-stacking-verification.json`
- `tools/extract_game_data.py`, `tools/extract_maps.py` and `site/dist/data/encounters.json`

All three native harnesses were rerun against **both** retail and v1.0.73 resources for this guide addition. Each disc passed:

| Check | Cases per disc |
| --- | ---: |
| Recruitment classes, ranks, collection state and RNG boundaries | 8,192 |
| Class/rank/Orb/battle-mode precedence | 768 |
| Candidate presence/slot/battle-mode prechecks | 112 |
| Candidate updater | 6 |
| Audited arena entry script calls | 6 |
| Sirloin recruitment threshold and final RNG boundaries | 1,456 |
| Consecutive native Sirloin effect-handler calls, including cap (before consumption) | 83 |

These are isolated executions of native MIPS instructions using Unicorn, with controlled RNG outputs. They are not full emulator playthroughs. The upstream reports describe their original v1.0.66 input; this guide's wrapper supplies the actual retail and v1.0.73 resources without modifying those harnesses. The initial eight audited native code spans and every included wild enemy record match between both discs. The November follow-up expands the extraction guards to ten spans by including the consumption callback and its successful-item script branch. `data/recruitment-reference.js` records their hashes and the source disc hashes:

| Disc | SHA-256 |
| --- | --- |
| Japanese retail | `a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29` |
| English v1.0.73 | `c7fd48e4decd7747a3e8b72ff052960b4ae0943ad61b6a95c57c946791cba812` |

## Joining calculation

Meat used on enemies increases one shared battle appeal value, starting at 10. The effect handlers for item IDs 25–28 add 10, 30, 100 and 400 respectively; successful item consumption then adds 5. The full successful uses therefore add **15, 35, 105 and 405**. Multiple meats stack, capped at 32,767. Meat used on allies reduces wildness and does not receive the enemy-feeding bonus; the calculator counts only enemy-targeted meat. Starry Orb adds 4,095 in its effect handler and sets a separate guarantee flag; consumption adds 5, for a total of 4,100 (appeal 4,110 from the initial 10), but neither part bypasses the restrictions below.

The earlier Sirloin stacking harness called the effect handler without the subsequent consumption callback. Its 83 checks correctly described that isolated handler, but omitted 5 appeal per consumed item from the calculator. The November 2026 full-path audit corrected the calculator and its fixtures. This is a guide correction, not a change to the game or patch.

Recruitment class 0 succeeds automatically after eligibility checks. Class 7 prevents joining; for other classes, native species rank 7 also prevents joining. Starry Orb guarantees the remaining allowed cases. Battle mode 2 (the audited arenas) and modes 4 or greater override both the automatic result and Orb. Modes 0, 1 and 3 passing this guard does not by itself prove that a story battle is recruitable.

For classes 1–6, the game multiplies appeal and rounds down:

| Recruitment class | Never collected | Previously collected |
| --- | ---: | ---: |
| 1 | ×5 | ×1 |
| 2 | ×2 | ÷4 |
| 3 | ×1 | ÷8 |
| 4 | ÷2 | ÷8 |
| 5 | ÷8 | ÷8 |
| 6 | ÷16 | ÷20 |

Let the rounded value be `Q`. Under the calculator’s uniform-draw approximation, the feeding check succeeds with probability `clamp(Q − 9, 0, 91) / 91 × 2870 / 4096`.

If the species has never been collected, it first receives a separate chance of `1 / D`, with `D = [2, 4, 9, 20, 33, 100, 200]` for native ranks 0–6. Collection uses the persistent species flag, not whether an individual is currently owned. Total joining probability is `firstChance + (1 − firstChance) × feedingChance`.

One and two consumed Sirloins give appeal 415 and 820. For a previously collected Slime in Terry context 1, the resulting thresholds are 103 and 205: both saturate the first comparison and give `1435/2048`, or about 70.07%. For a previously collected Metal Slime in Terry context 22, the thresholds are 20 and 41, giving `2255/26624` (about 8.47%) and `205/832` (about 24.64%). These fractions count nominal native threshold outcomes and are regression fixtures for `js/recruitment.js`. The native range generator has modulo bias, and consecutive RNG outputs are correlated; the displayed percentages are estimates, not exact frequencies for every RNG state.

The candidate updater retains one enemy slot and overwrites it when called for a present, defeated enemy. It ignores allies, absent actors and actors without the defeated flag. The audited routine does not establish all callers or simultaneous-defeat processing order, so the guide does not promise that a chosen target will always be the candidate.

## Recovery items, bosses and save states

The November 23, 2026 follow-up used the authenticated Japanese retail disc above and compared the existing English v1.0.74 Enhanced disc (`04b30048a0dc1c207801041a410925aba0283da6793ba3989b98f46a38543b15`). No patch feature was added and no new disc build was needed.

The shared appeal value at `0x80110AA8` starts at 10 for each battle. Successful enemy-targeted HP recovery items add `floor(rolled recovery / 2)`, then their consumption adds 5. Medicinal Herb rolls 30–40 and therefore adds 20–25; Amor Water rolls 60–70 and adds 35–40. The recovery roll is credited before the HP cap: a 35-point Herb roll with only 1 HP missing adds 22 appeal. If the target is already at full HP, recovery fails, the original script skips consumption, and appeal does not change. The failed attempt still consumes a recovery RNG draw.

Ally-targeted recovery subtracts half the recovery before the consumption bonus. Each score operation clamps to 0–32,767, so the net change near zero is not a single unclamped subtraction. MP recovery items also affect appeal; full-restoration amounts can depend on the missing points. Healing spells do not change appeal. The article gives the specifically verified Herb and Amor ranges rather than assigning one formula to every restoration effect.

The native item audit executed eight recovery cases with the original RNG and verified the script branch that skips consumption after a failed recovery. An initial exploratory probe incorrectly forced consumption on failure; that probe was corrected before the retained findings and article were written. Twenty-one isolated recruitment-decision checks covered class/rank restrictions, collection history, baseline and appeal thresholds, and different results at identical appeal. These checks execute original MIPS routines, not a complete emulator playthrough.

`ResultsPrepareRecruit` is at `0x80120814` in resource 104 (load base `0x80114CB8`), with the decision at `0x801212C0–0x801217E0`. It generates randomized candidate stats before the joining decision. The persistent obtained-species bits start at `0x800C7A66`; gifts, breeding and earlier captures affect the same collection history. The initial-chance divisor table is at `0x8011B0C4`. The appeal route requires both the scaled appeal to meet `RandRange(10,100)` and `ResultsRecruitRoll() < 70`; the latter routine at `0x80121864` uses two fresh RNG draws.

For Dark Horn, category 17 slot `0x92` resolves to resource 4590. Its record at offset `0xC0` has family 2, species 10, class 5, base HP 2,000 and level 40. Its species rank is 5, giving an approximately 1% never-collected baseline. Both collection states use `floor(appeal / 8)`: appeal 79 cannot pass the first comparison, 80 can, and 800 saturates it. The separate roughly 70% check still remains. Ten successful Herbs, with no other appeal changes, produce appeal 210–260 and approximately a 14–19% total first-collection chance. The player article keeps the simpler conclusions: a low baseline, useful healing and no guarantee.

The RNG at `0x80023C08` stores its state at `0x800C70A8` and advances it as `state = state * 0x41C64E6D + 12345` modulo `2^32`. Save states restore this state. Repeating actions can repeat a refusal; leaving and returning can change the intervening RNG calls. The traced joining decision contains no gate-entry success roll or leave-and-return requirement. This explains the reported save-state pattern plausibly, but the player's actual state was unavailable and no unique cause or exact playthrough reproduction is claimed.

### Terry's fixed boss encounters

Category 17 slots `0x80–0x9F` were re-extracted directly from the Japanese BIN. Names were resolved from the original name groups and mapped to current guide names. Class 0 is automatic after normal eligibility; classes 4–6 are conditional; class 7 blocks ordinary recruitment. The table retains secondary enemies rather than treating every record as the named boss.

| Slot / resource | Enemy records and recruitment classes |
| --- | --- |
| `80 / 1210` | Healer 0 |
| `81 / 4574` | Dragon 0 |
| `82 / 4575` | Golem 0 |
| `83 / 4576` | Great Sabrecat 0 |
| `84 / 4577` | Stump Chump 4; Treeface 0 |
| `85 / 4578` | Demon Knight 0 |
| `86 / 4579` | Fang Slime 0 |
| `87 / 4580` | Big Eye 7 |
| `88 / 4581` | Gigantes 6 |
| `89 / 4582` | Living Statue 7 |
| `8A / 4583` | Sky Dragon 7 |
| `8B / 5624` | Copycat 0 |
| `8C / 4584` | Funky Bird 0 |
| `8D / 4585` | Dragon Kid 4; Battle Rex 0 |
| `8E / 4586` | Dungeon Shrimp (Digster) 0 |
| `8F / 4587` | Jamiras 7 |
| `90 / 4588` | Centasaur 7; Demon Servant 5; Devil Armor 7 |
| `91 / 4589` | Matango 5; Lips 5; King Slime 5 |
| `92 / 4590` | Dark Horn 5 |
| `93 / 4591` | Akbar 7 |
| `94 / 4592` | Orochi 7 |
| `95 / 4593` | Demon Servant 6; Mysterious Swordsman 7; Durran 7 |
| `96 / 4594` | Dragonlord 7 |
| `97 / 4595` | Hargon 7; Sidoh 7 |
| `98 / 4596` | Baramos 7 |
| `99 / 4597` | Zoma 7 |
| `9A / 4598` | Psaro 7 |
| `9B / 4599` | Estark 7 |
| `9C / 4600` | Mildrath 7 |
| `9D / 4601` | Mudo 7 |
| `9E / 4602`, `9F / 4603` | Deathmore 7 |

Matango is family 4/species 7/rank 3; Lips is family 5/species 7/rank 4. An early ancillary table had these labels swapped; the re-extracted table and player copy use the corrected identities. Gigantes is rank 4, Temptation Gate's Demon Servant rank 5, King Slime rank 6 and Dark Horn rank 5. This concerns the defeated encounter record, not whether a species can ever be obtained through breeding or a separate event. Mirror Gate's first battle uses formation 1 of resource 4593, containing two copies of the level-55 class-6 Demon Servant record. Resource 92's callback at offset `0x147` starts this battle; its postbattle continuation at `0x800EB15D` sets world flag 3 and proceeds with the scene. A complete scan of resource 92 found no gift/recruit callback. These Servants are conditional recruits, not a guaranteed story gift. The later formations use the class-7 Mysterious Swordsman and Durran records.

All normal Terry gate boss callbacks in resources 72–101 call `BeginFixedBattle` (`0x80042220`) with nonzero fixed-encounter groups. The resident setup at `0x80041EF8–0x80041F00` selects battle mode 1. Enemy meat preparation (`0x8014CE60`, guard `0x8014D1BC–0x8014D1D4`) rejects meat in mode 1 regardless of recruitment class. Thus no normal gate boss accepts meat, including the class-0 joiners. Ordinary foreign masters use a different mode; their meat acceptance is not an exception among these bosses.

### English patch comparison

The Japanese retail and checked v1.0.74 Enhanced files have identical bytes in:

- RNG: `0x80023C08–0x80023C3C`.
- Results/recruitment: `0x8011F678–0x8012285C` (12,772 bytes).
- Resource 5502 recovery handlers: `0x80127784–0x80127B6C`; HP restoration: `0x80128748–0x80128824`.
- Score operations: `0x80128964–0x801289EC`; item dispatch: `0x801289EC–0x80128A6C`.
- Item consumption: `0x8014D6A0–0x8014D77C`.
- Entire Dark Horn encounter resource 4590: 5,440 bytes, SHA-256 `74a865f0131fd9a2c72d0c12701f4fbff4c2edec5d05ac34bded504d0a2da41e`.

Resource 89's script prefix through `0x330` differs only in nickname bytes `0x3D–0x40`. The item-menu region has the documented rejected-item cursor-store NOP at `0x8014C248`; it does not change effects or recruitment. Source review found that `recruitment_pool.py` changes text-descriptor pointers, PvP wrappers preserve the ordinary results path, and the Truth Gate fix changes a separate stale encounter flag. Optional events may change RNG history without changing the RNG algorithm or recruitment rules. The preservation claim is scoped to the audited rules and checked release.

## Ordinary foreign masters

The original strength-tier tables contain 20 pools per campaign: 236 Terry enemy appearances and 270 each for Cobi and Tara. Terry's records use classes 3, 5 and 6; both siblings' use 5 and 6. None has class 7 or species rank 7. Thus all species in these **ordinary master pools** are eligible under the audited recruitment guards, including species with blocked records in a separate boss encounter. This does not extend to ranked arenas or arbitrary scripted trainer battles.

The ordinary master path sets event bit B8 (`0x800CAC57 & 1`) at resident script `0x800B92BF`, after strength-tier selection at `0x800442C4`, and calls `0x80044348`. Battle setup at `0x8018C0C8` selects mode 3. The script clears the event bit at `0x800B92F9`, `0x800B9374` and `0x800B9395`, and battle finishing also clears it. Mode 3 accepts meat and passes the ordinary joining-mode guard.

The shared appeal and collection-history calculation is the same as above. Most master records use class 5 (appeal divided by 8 for either collection state) or class 6 (divided by 16 if never obtained, otherwise 20). Terry's Ice Golem records in tiers 1 and 2 are class 3. There is no separate “at least one meat used” condition: a never-collected species can pass its baseline check without meat. The ordinary item-based route still requires the additional roughly 70% check.

`BattleRememberDefeatedEnemy` (`0x80147FE0`) retains the last present defeated enemy slot at `0x80110BE6`; `ResultsPrepareRecruit` consumes that candidate. The practical advice is to finish the intended target separately after the other enemies. The guide avoids promising a particular target after simultaneous knockouts.

The consumed-meat audit follows native menu preparation, classification, effect preparation/application and the actual successful-script consumption branch, rather than manually adding 5. Eleven native callback chains cover all four enemy-targeted meats, the Orb, two sequential Sirloins and all four ally-targeted meats. Ally meat adds only the consumption bonus of 5, which is why the player article says it lacks the enemy-feeding bonus instead of saying it adds no appeal. This is the source of the corrected full-use increments above.

The full-use and encounter audit is available in `scripts/verify-recruiting-native.py`. It checks the Japanese input hash, runs 19 item callback chains (the 11 above and eight recovery cases) and two Heal command evaluations and HP commits, extracts all 32 Terry boss encounter resources, and checks the Servant formations. Its pool extraction covers 776 appearances: Terry has 110 class-5, 124 class-6 and two class-3 records; Cobi and Tara each have 123 class-5 and 147 class-6 records. This pool and callback probe uses the original Japanese BIN; patch preservation is established by the separate code comparisons above.

The guide’s extraction guards additionally cover consumption at `0x8014D6A0–0x8014D77C` and resource 5498’s successful-item script at `0x800EBE51–0x800EBE76` (SHA-256 `274cd4607844a6653f2f83ded4fb465deb514faf688aa659e2d3f6a2819d074c`).

## Reproducing the audit

Use legally obtained local discs matching the hashes above. No game binaries are included in the guide.

```text
python scripts/build-recruitment-reference.py --bin "CURRENT.bin" --original-bin "JAPANESE.bin" --check
python scripts/verify-recruiting-native.py --bin "JAPANESE.bin" --output "recruiting-audit.json"
node --test tests/unit/recruitment.test.js
```

For the native execution checks, install Unicorn and check out `dqm-psx/manual` at the revision above. The wrapper reads its existing harnesses and captures reports in memory without changing the manual checkout:

```text
python scripts/verify-recruitment-native.py --manual "MANUAL_CHECKOUT" --bin "CURRENT.bin" --original-bin "JAPANESE.bin"
```

`--python-packages` optionally supplies the directory containing Unicorn. The native extraction script fails closed if either disc hash, a verified instruction span, denominator table, source binding or enemy record differs; a future patch affecting those data requires a fresh audit.

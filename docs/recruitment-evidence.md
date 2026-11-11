# PSX recruitment calculator evidence

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
| Consecutive native Sirloin uses, including cap | 83 |

These are isolated executions of native MIPS instructions using Unicorn, with controlled RNG outputs. They are not full emulator playthroughs. The upstream reports describe their original v1.0.66 input; this guide's wrapper supplies the actual retail and v1.0.73 resources without modifying those harnesses. The eight audited native code spans and every included wild enemy record match between both discs. `data/recruitment-reference.js` records their hashes and the source disc hashes:

| Disc | SHA-256 |
| --- | --- |
| Japanese retail | `a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29` |
| English v1.0.73 | `c7fd48e4decd7747a3e8b72ff052960b4ae0943ad61b6a95c57c946791cba812` |

## Joining calculation

Meat used on enemies increases one shared battle appeal value, starting at 10. Item IDs 25–28 add 10, 30, 100 and 400 respectively. Multiple meats stack, capped at 32,767. Meat used on allies reduces wildness instead and must not be counted here. Starry Orb adds 4,095 and sets a separate guarantee flag; it does not bypass the restrictions below.

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

Let the rounded value be `Q`. The feeding check succeeds with probability `clamp(Q − 9, 0, 91) / 91 × 2870 / 4096`.

If the species has never been collected, it first receives a separate chance of `1 / D`, with `D = [2, 4, 9, 20, 33, 100, 200]` for native ranks 0–6. Collection uses the persistent species flag, not whether an individual is currently owned. Total joining probability is `firstChance + (1 − firstChance) × feedingChance`.

For a previously collected Slime in Terry context 1, one and two Sirloins both give `1435/2048`, or about 70.07%. For a previously collected Metal Slime in Terry context 22, they give `2255/26624` (about 8.47%) and `6355/26624` (about 23.87%). These fractions were independently counted from native threshold outcomes and are regression fixtures for `js/recruitment.js`.

The candidate updater retains one enemy slot and overwrites it when called for a present, defeated enemy. It ignores allies, absent actors and actors without the defeated flag. The audited routine does not establish all callers or simultaneous-defeat processing order, so the guide does not promise that a chosen target will always be the candidate.

## Reproducing the audit

Use legally obtained local discs matching the hashes above. No game binaries are included in the guide.

```text
python scripts/build-recruitment-reference.py --bin "CURRENT.bin" --original-bin "JAPANESE.bin" --check
node --test tests/unit/recruitment.test.js
```

For the native execution checks, install Unicorn and check out `dqm-psx/manual` at the revision above. The wrapper reads its existing harnesses and captures reports in memory without changing the manual checkout:

```text
python scripts/verify-recruitment-native.py --manual "MANUAL_CHECKOUT" --bin "CURRENT.bin" --original-bin "JAPANESE.bin"
```

`--python-packages` optionally supplies the directory containing Unicorn. The native extraction script fails closed if either disc hash, a verified instruction span, denominator table, source binding or enemy record differs; a future patch affecting those data requires a fresh audit.

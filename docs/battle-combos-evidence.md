# Battle combinations: PSX evidence

The guide's battle-combination article describes two monsters combining their selected battle actions. This is separate from the 34 recipes which let one monster **learn** another skill. Battle combinations occupy native command IDs 208–227 and do not become learned-skill slots.

## Sources and scope

The primary source is the Japanese retail PlayStation disc. The turn scheduler, pairing selector, command descriptors and effect handlers are in battle resource 5502, loaded at `0x80114CB8`.

| Material | SHA-256 |
| --- | --- |
| Original Japanese BIN | `a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29` |
| Released v1.0.74 Enhanced BIN | `04b30048a0dc1c207801041a410925aba0283da6793ba3989b98f46a38543b15` |
| Complete resource 5502 | `f735caad8d1422a4b49495aab5affb10f4eee5fae923affda6e5cd1e30d6e224` |
| v1.0.74 Enhanced resource 5502 | `5e2c04ef16790a12505a3ab6cc5f8bdc561124735a92ab5bb69ddb4ffa2fa370` |
| Scheduler and pair selectors, `8013F260–8014029C` | `1faeb03d95f5991c47e6f5e56757c00ab0b45e987a6c5c514bc82accdf6a9a02` |
| Combination effect-handler span, `801256EC–80126830` | `bd6d9715e0fc57d62f8260504b733c7722313aaa8d4ee8932ab56b9ff6cd0fc9` |
| Command descriptors 208–227, `80175524–80175664` | `579245e1daadff726118fc46ffa3ae69e65e84503468c406fce7e8b443b0816b` |
| Personality compatibility, `80179950–80179C29` | `3b91cec496f7fbf5be3cde5b5243b306777e085c3246d31dacf26a28aed9961a` |

Reconstructions of the native functions were used to read the control flow; the public verification script executes the original MIPS bytes, not the reconstructions. Descriptive function names below are research labels. Addresses, authenticated source hashes and the executable verification provide the reproducible evidence.

Current English result names and component names were checked against the released v1.0.74 source and the [public translation snapshot](https://github.com/dqm-psx/translations/tree/b2dce00849343191255d725d32611d9d2889035e). The guide's `scripts/current-patch.json` records the reviewed release/package identity. `scripts/battle-combo-name-bindings.json` keeps the result command IDs and stable source text IDs separate from the 169 learnable skills. Result names can therefore follow translation changes without adding nonexistent learnable skills.

For the Game Boy comparison, the user-supplied [McBick co-op skill list](https://gamefaqs.gamespot.com/gbc/525414-dragon-warrior-monsters-2-cobis-journey/faqs/77570/list-of-co-op-skills) and its [introduction](https://gamefaqs.gamespot.com/gbc/525414-dragon-warrior-monsters-2-cobis-journey/faqs/77570/introduction-to-co-op-skills) supplied the initial ten Cobi/ten Tara split and the handheld descriptions being compared. A subsequent static audit of both USA ROMs independently confirmed the ordinary version split and all component pairs, as documented below. The PSX effects come from PSX code rather than importing the FAQ's effects or percentages. GBC effect handlers have not been executed or independently audited here.

## Native execution check

Run with a locally owned original disc and a Python installation containing Unicorn:

```text
python scripts/verify-battle-combos-native.py --original-bin <original.bin>
```

An optional `--python-deps <directory>` can locate an existing Unicorn installation. The script authenticates the complete BIN and battle resource, loads the original EXE and resident/battle resources, and invokes `BattleSelectPairs` at `0x8013F7E0`. It substitutes neither the random routine nor any selector callee.

The recorded retail result is **156 successful cases and 212 blocked cases**. It covers all 20 recipes in both component orders on both sides; ordinary and local-battle modes; the local-battle transformation exception; zero motivation; and a spell pair blocked by insufficient MP or spell sealing. The 27×27 compatibility table contains exactly the integer bands 1–9.

Passing `--english-bin <released-v74-enhanced.bin>` additionally authenticates the released image against its package's `BUILD.json` hash, compares eight spans of native evidence, and executes the released code including its local-battle gate. The v1.0.74 result is **236 successful cases and 292 blocked cases**. Combos Off blocks pairs in local battles and does not change ordinary adventure pairing. The compared spans cover the personality-update table and routine, scheduler, selector body after its eight-byte hook, random checker, combination effects, MP/status/action consumers, command descriptors and compatibility table. They are byte-identical between retail and this released English image.

These are isolated instruction tests of pair selection. They are not complete battle playthroughs, effect animations, or a blanket claim that every possible status interaction has been tested. Effect descriptions were separately traced through the original handlers and their consumers. Existing released images were read; no patch or additional disc configuration was built for this audit.

## Game Boy version filter, independently checked

| USA ROM | SHA-256 |
| --- | --- |
| Cobi's Journey | `8e38a7420ef5239c7196aa4fd4b1499e65db2823e875bbf8241bb2199e766d4e` |
| Tara's Adventure | `fc6809c31ff69c889dee80c5f39f4d8069042a2b4d933edd83d1627c32e013cc` |

Both contain the same 570-byte recipe table at ROM `0x28C289–0x28C4C3` (end exclusive), bank `0xA3`, CPU `0x4289`. Its SHA-256 is `3a1c424237093934cffc3e55763ab485bdf80fd3115c0affad0298c7bac394e6`. Each of the 114 five-byte rows is `[party command 0, party command 1, party command 2, version flag, result command]`; `FF` ignores a party slot. Equal-component recipes have three positional permutations; different-component recipes have six. All twenty component pairs match the PSX pairs listed below.

The selector begins at ROM `0x28C1CF` / CPU `0x41CF`. At ROM `0x28C23A` it checks battle-mode byte `$C58A`, then compares the row's version flag against `01` in Cobi and `00` in Tara. The comparison operand at ROM `0x28C244` is the sole difference across `0x28C186–0x28C289`. Results `D0–D9` have flag 1; `DA–E3` have flag 0. This directly supports the ten/ten normal version split.

The selector bypasses that version check when battle-mode byte `$C58A == 2`. This audit has not established that special mode's identity, so the guide should not claim the split applies to every possible battle mode. This is a static code/table audit, not Game Boy execution or a verification of all handheld effect descriptions. The scheduler/selector span hashes are `57e00e9fa2dcb838cafa9fad752198d3ca7de2d65d58ab199bed03b25d93a1b7` (Cobi) and `015d00d95304e20ed0eb60daac590928589b4eed92c8aa1da5fbc0688468cfd7` (Tara).

The verification script accepts `--cobi-rom <USA-Cobi.gbc> --tara-rom <USA-Tara.gbc>` together. This optional check authenticates both complete ROMs, the shared recipe table, all 114 positional rows and the sole version-selector difference. It passed alongside the v1.0.74 checks. It does not run a Game Boy emulator.

## Availability, execution and cost

`BattlePrepareTurn` at `0x8013F260` calls the player's pair selector without a campaign check. `BattleSelectPairs` at `0x8013F7E0` contains **all twenty** recipes and no Terry/Cobi/Tara filter. Terry therefore has these combinations too; the GBC version split does not apply to PSX.

Two different available party monsters must select matching component commands during the same turn. Pairing scans the three ordinary party slots. A monster knowing both components is insufficient. At most one pair forms on each side in a turn. Pair selection happens before ordinary action execution; the guide does not require the monsters to have adjacent Agility values or independently take consecutive turns.

The native selector checks current commands, availability, prohibiting/sealing states, existing combination state, motivation/personality, and the MP required by both original commands. At execution, `BattleAdmitCommand` at `0x801420A8` rechecks availability and component MP before deducting the MP from **each respective participant**. Insufficient MP or an unavailable partner can cause the pair to fall back to its original actions. Components whose cost is the all-MP sentinel require positive MP and spend all current MP.

**Gigante is an explicit exception:** command `0xD6` replaces both computed costs with each participant's full remaining MP. Saying every combination simply spends the listed component cost would miss this exception.

Native local battles (mode 4) prohibit Demon Lord Form (`0xDC`) in both component orders. The released English patch adds a Combos rule for local battles. The verification script executes its selector hook with the rule both on and off: it does not introduce these combinations into the adventure or make them exclusive to either DQM2 protagonist.

## Chance: what the native code actually checks

`BattlePairCommand` at `0x8013FE38` uses each participant's hidden `personalityD` byte and their personality IDs. For a prospective pair:

```text
D = first.personalityD + second.personalityD
C = compatibility[first.personality - 1][second.personality - 1]
threshold = floor(floor(recipe_weight * D * (C + 1) / 256) / 10)
```

The pair can proceed only when the threshold is nonzero and the native percentage-like random result is at most the threshold. The implementation doubles both comparison operands, which does not change that comparison. `BattleRollPercent` at `0x80126ED4` constructs its result from two masked random draws:

```text
packed = ((RandRange(0, 511) & 0x1F0) * 8)
       | ((RandRange(0, 255) & 0xFE) >> 1)
roll = floor(packed / 41)
```

The recipe weight is **not** a standalone percentage. Neither a universal 50% success rate nor the Game Boy FAQ's percentage bands should be printed as PSX probabilities. With both motivation bytes zero, no pair can form. Compatibility is graded 1–9; the PSX table does not contain a forbidden personality-pair value. Low motivation can still make the final threshold zero.

The native personality-update routine (`0x8013EE60`, table `0x801150D0`) changes this hidden byte during ordinary adventures. AI tactics can raise it; repeated direct-command turns lower it, with level-dependent increments. Local-battle modes do not apply that update. These statements describe the hidden motivation byte, not a displayed affection stat. The article deliberately avoids requiring players to manipulate undocumented numeric values.

## Recipes and effect checks

The component IDs below are the native learned-skill IDs, not the result IDs. The weights document the chance formula; they are not a player-facing success percentage.

| Result ID | Current result name | Components | Weight | Main effect evidence |
| --- | --- | --- | --- | --- |
| 208 | Kazap | 15 + 15 | 10 | `801256EC` and descriptor: all enemies, 500–700 base damage |
| 209 | IceBlaze | 3 + 18 | 20 | `801256EC` and descriptor: one enemy, 700–900 base damage |
| 210 | Wave Slash | 77 + 103 | 50 | `801256EC`: 500–600, 1.5× against Slime/Zombie/Aquatic |
| 211 | Air Slash | 73 + 103 | 50 | `801256EC`: 500–600, 1.5× against Dragon/Bird/Devil |
| 212 | Earth Slash | 75 + 103 | 50 | `801256EC`: 500–600, 1.5× against Beast/Plant/Bug |
| 213 | Giga Cross Break | 103 + 103 | 30 | `801256EC` and descriptor: all enemies, 500–700 base damage |
| 214 | Gigante | 21 + 112 | 20 | `8011EF6C`, `80126CCC`, `801420A8`, `801481EC`, `80148E1C` |
| 215 | Twin Attack | 106 + 145 | 100 | `8011EBF8`: High Jump participant's Attack; target Defense zero |
| 216 | Quick Draw | 42 + 98 | 100 | `8013F7E0`: priority +3000; `80146BA0`: doubled noncritical damage |
| 217 | GigaMagic | 29 + 61 | 10 | `80125820`: levels and spent MP, detailed below |
| 218 | Spirit Festival | 124 + 160 | 80 | `80125970`, `80146BA0`, `80147488`: living allies only |
| 219 | Reaper's Feast | 117 + 121 | 80 | `80125A64`: random curse, poison, sleep, paralysis or confusion |
| 220 | Demon Lord Form | 58 + 60 | 50 | `80125D6C`, `80125DC8`: both users transform; native local restriction |
| 221 | Twilight Wave | 129 + 130 | 60 | `801261E0`: Attack, Defense, Agility and evasion buffs |
| 222 | Mist of Forgetting | 146 + 156 | 60 | `80126368`: spell, dance and breath sealing |
| 223 | Mega Magic Drain | 50 + 119 | 40 | `8012644C`: one enemy's MP, split between the two users |
| 224 | Counter | 149 + 150 | 100 | `801265C8`, `80144B80`, `80146BA0`, `8014A480`: both users' stance |
| 225 | Enchanting Dance | 52 + 120 | 80 | `80126658`: confusion on enemy side |
| 226 | Iron Wall Shield | 148 + 152 | 100 | `801266EC`: leading participant guards and protects allies |
| 227 | Enlightenment | 138 + 159 | 10 | `80126798`, `80146BA0`, `8014AE18`, `8014A480`: extra actions and criticals |

Damage ranges are base values, not guaranteed damage against every target. Family bonuses and resistance/guard processing still apply. The three elemental slashes apply their family multiplier after the handler's guard/resistance calculation.

### Differences that must not be copied from a GBC effects list

**GigaMagic:** the handler starts with `2 × (first level + second level + MP spent by both)`, rolls 90–110% of that value, then processes resistance/guarding. This is not a blanket four-times-combined-MP formula.

**Mega Magic Drain:** targets **one** opponent, sets that opponent's MP to zero, and restores half the drained amount (rounded down) to each participant, capped by each participant's maximum MP. It does not drain the entire enemy side.

**Demon Lord Form:** raises both participants' maximum HP, maximum MP, Attack, Defense and Agility by 25%, capped at 999, and installs the transformation's skills/resistances. Raising maxima does not refill current HP or MP. This is not an all-party doubling effect.

**Spirit Festival:** fills living allies' HP and MP and removes multiple ailments. Its handler preserves the death bit, returns ordinary healing result 2 rather than revival result 6, and the normal evaluator skips fallen targets. It does **not** revive fallen allies. The cleared status masks are `status[0] &= 0x8079FFF9` and `status[1] &= 0xFFFD3FFF`; current Agility and Defense return to their base values.

**Gigante:** uses the special near-death chance path (resistance still matters), consumes both participants' full MP, and then sacrifices both individually. Each participant has a 50% knockout roll; otherwise it loses `floor(current HP × 99 / 100)`. A participant already at 1 HP is knocked out in either branch. The guide must not describe this as guaranteed enemy damage or a safe low-HP attack.

**Counter:** the status is installed on the two participants, not the third ally. The physical redirection path sets its damage multiplier flag, doubling eligible redirected damage, and the stance clears at the end of the turn.

**Enlightenment:** installs the critical flag (`status[0] |= 0x200000`), extra-action state (`status[1] |= 0x30`) and the continuation flag (`status[2] |= 0x40000`) on available allies. The action and turn consumers preserve/reuse the extra-action state. It is not ordinary damage charging and the code does not describe it as only a single “next turn” boost. Criticals apply to commands flagged as critical-capable, not every kind of damage. The article uses this bounded description rather than promising an untested number of actions under every command/status interaction.

## Deliberate limits

- Exact success percentages require the hidden motivation bytes, personality pair, recipe and random routine; there is no single universal percentage.
- Full animation and all multi-turn status interactions were not emulator-played in this audit.
- GBC effects quoted by secondary guides are not treated as verified PSX behavior or as independently executed GBC evidence; the ordinary GBC version split and recipe pairs were separately checked in native ROM bytes.

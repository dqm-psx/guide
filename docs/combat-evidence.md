# Combat calculation evidence

The calculator predicts a successful, unguarded normal hit or one of **36
verified damage skills** in an ordinary wild battle. It does not predict whether
an attack hits, AI choices, critical hits, guarding, charge, reflections,
temporary modifiers, multi-hit rules or special battle settings. Ranges are per
target; they are not averages or a guarantee of enough MP or a learned skill.

The reference contains 325 authenticated species and 283 named wild encounter
contexts. It follows the guide's existing wild-location whitelist and excludes
the four unused Hidden Gate contexts. Enemy record indices remain stable within
each campaign/context. Translated names and area labels come from the guide's
existing indexes, so a translation refresh does not fork the numeric reference.

## Native inputs

The builder authenticates the retail Japanese and Current English v1.0.73 discs
by SHA-256. It compares the relevant combat code, action descriptors, handler
table, enemy initialization, species resistances and all included enemy records.
Their identities and hashes are retained in `COMBAT_REFERENCE.provenance`.
The complete combat overlay differs between releases; only the matching spans
used by these calculations are claimed to match.

| Input | Native location |
| --- | --- |
| Normal-attack routine | resource 5502, `0x8011EBF8` |
| Skill descriptors, 16 bytes each | resource 5502, `0x80174824` |
| Skill handler table | resource 5502, `0x801756F8` |
| Wild spell / breath scales | resource 5502, `0x801756B8` / `0x801756C0` |
| Companion spell / breath scales | resource 5502, `0x801756D8` / `0x801756E0` |
| Ordinary wild stat randomizer | resource 5499, `0x8018C330` |
| Wild resistance family pointers | resource 5499, `0x8018FF00` |
| Companion species resistances | resource 3657, 32-byte records, bytes 4–30 |
| Encounter base stats / actions | native 52-byte enemy records, bytes 16–27 / 10–15 |

Normal damage uses `B = floor((Attack - floor(Defense / 2)) / 2)`. If `B <= 0`,
its range is 0–1. If positive `B <= floor(Attack / 16)`, the range is
0–`floor(Attack / 16)`. Otherwise it is `B ± floor(B / 16)`, plus an independent
inclusive −1–1 draw. The low-damage branches make some intervals nonmonotone:
the planner checks every integer Attack/Defense pair in a requested interval.

The 36 skills are native IDs 1–18, 62–77, 102 and 103. They use their own player
and ordinary-enemy base ranges. Wind Sickle, Vacuum Wave and Lightning use the
verified level formulas. Grand Cross's Zombie-target bonus is rounded before
resistance; Gigaslash's Dragon-user bonus is rounded after resistance. Each
multiplication rounds down separately. Unsupported actions are not guessed.

Companion resistance has eight codes and ordinary wild resistance four tiers.
The spell and breath scales differ. Companion defaults are unbred species
baselines; a known individual resistance may override the relevant channel.
The override never modifies the underlying species data. Physical Defense is
not used for the supported spell/breath calculations.

Ordinary wild stats roll inclusively between `floor(0.8 × base)` and
`floor(1.1 × base)`, with minimum 1, maximum 32,767 HP and 999 for other stats.
The native signed-halfword guard is preserved: if either bound has bit 15 set,
the result is 1, not a high-HP clamp. These rules are not generalized to scripted
boss or arena initialization.

## Verification

The pinned source is [`dqm-psx/manual` at 0548201](https://github.com/dqm-psx/manual/tree/0548201759747b6e00b1897c96aa2555ac8303a0).
`verify-combat-native.py` checks the exact hashes of its two combat harnesses and
their input catalogs. It supplies each authenticated disc through an adapter,
without modifying upstream files or saved reports. The real MIPS routines run
in isolated Unicorn RAM; the original harness substitutes deterministic RNG
endpoints. This is native CPU execution, not a full emulator gameplay test.

Both discs passed, independently, these checks:

| Check | Cases per disc |
| --- | ---: |
| Full supported damage handlers, resistances, level and family combinations | 1,056 |
| Wild stat limits and endpoint rolls | 96 |
| Normal attack branches | 42 |
| Level-dependent damage formulas | 891 |
| Descriptor base ranges and battle modes | 657 |
| Standard resistance-scale checks | 8 |

The upstream base harness also passes its 9 food/Orb and 100 Amor Rain checks;
those are not additional calculator features. The guide's unit tests retain
native output samples, rounding-sensitive family bonuses, low-damage interval
boundaries, encounter identity fixtures, invalid-input checks and immunity
overrides.

```sh
python scripts/build-combat-reference.py --bin <current.bin> --original-bin <retail.bin> --check
python scripts/verify-combat-native.py --manual <manual-checkout> --bin <current.bin> --original-bin <retail.bin> --python-packages <unicorn-packages>
node --test tests/unit/combat-planner.test.js
```

Omit `--check` to regenerate the numeric reference. The verification scripts
write no disc data, personal information, local paths or private research into
the public website.

# Resistance inheritance: PSX and Game Boy Color

## Player-facing conclusions

Resistance inheritance is present in the PlayStation game, including Terry's
adventure. The shared offspring constructor processes all 27 resistance
channels from the child's species and the two individual parents. Cobi and Tara
use the same calculation. This is original PSX behavior, not an English-patch
addition: the complete constructor, its resistance coefficients and the shared
species-attribute resource are byte-identical in retail Japanese and the
published v1.0.74 Enhanced image.

The useful distinction from a species resistance chart is **individual versus
species**. Parents pass their current saved resistance grades, including earlier
breeding improvements. The child starts from its own species' base grades and
adds the calculated bonuses. A parent's improved grade is not simply copied.
Later breeding can therefore lose an improvement, especially with a weak mate
or a different child species. The calculation never lowers the child below its
species' base grade.

The inputs for each channel are the two parents' saved grades and the resulting
child's + value. Parent levels matter indirectly through that + value; they are
not an additional resistance multiplier. The resistance calculation itself is
deterministic: there is no resistance-inheritance random roll. Parent order does
not change its arithmetic once the child species and + value are fixed, but
reversing pedigree and mate can change the child species and hence its base
resistances.

**Immunity is the critical PSX limit.** A species' innate grade 7 stays 7. A base
grade below 7 can rise only to grade 6, even if both parents have grade 7. GBC
recipes for breeding immunity into a nonimmune species do not transfer to PSX.

## Exact PSX calculation

For each resistance channel, let `B` be the child's species base grade, `P1` and
`P2` the parents' saved grades, and `plus` the child's resulting + value:

```text
If B = 7: child grade = 7
Otherwise: child grade = min(6, B + floor((10 × (P1 + P2) + 3 × plus) / D[B]))
```

| Child species base grade B | Divisor D[B] |
| --- | --- |
| 0 | 60 |
| 1 | 75 |
| 2 | 90 |
| 3 | 105 |
| 4 | 120 |
| 5 | 150 |
| 6 | 180 |
| 7 | Not used; stays 7 |

This is a simplified form of the native coefficient table. Its eight
`(denominator, numerator)` pairs are `(2,1), (5,2), (3,1), (7,2), (4,1), (5,1),
(6,1), (7,1)`, and the native division is by `denominator × 30`.

For a child species with base grade 0 and two grade-7 parents, a child at +20
gets grade 3; +50 gets grade 4; +73 gets grade 5; +74 gets grade 6. Further +
cannot turn that channel into grade 7.

The following scales make the example meaningful without treating status
resistance as a damage percentage:

| Grade | Standard spell damage taken | Standard breath damage taken |
| --- | --- | --- |
| 0 | 100% | 100% |
| 1 | 85% | 80% |
| 2 | 75% | 70% |
| 3 | 65% | 60% |
| 4 | 50% | 40% |
| 5 | 30% | 30% |
| 6 | 15% | 10% |
| 7 | 0% | 0% |

These are the companion/individual resistance scales for actions using those
damage helpers, before other battle modifiers. Ordinary wild enemies have
separate four-tier tables. Sleep, poison and other status checks use their own
effect logic. Grade 7 is not a claim that every physical or elemental attack is
harmless. The inheritance loop reads the saved resistance bytes at `0xC0–0xDA`,
not a damage calculation or temporary battle modifier.

## What the linked GBC guide establishes

[DwM2_DD's DWM2 Breeding Resistance Guide, v2](https://gamefaqs.gamespot.com/gbc/525414-dragon-warrior-monsters-2-cobis-journey/faqs/62849)
reports four grades, random inheritance outcomes dependent on the child's base
resistance, the parents' current resistances and the child's +. Its tables allow
some nonimmune bases to reach immunity; base 0 cannot. For example, two immune
parents with a base-2 child guarantee grade 3 at +50. That differs from PSX's
deterministic eight-grade calculation and its innate-only immunity.

The author describes direct memory experiments and an assembly-code check.
This GBC comparison is attributed to that primary investigation, not presented
as a new execution of the GBC ROMs. Its detailed GBC2 thresholds should not be
silently generalized to the first Game Boy game. The Tara URL supplied by the
player and this accessible Cobi URL identify the same FAQ number 62849.

## Native evidence and reproducible check

`scripts/verify-resistance-inheritance-native.py` reads caller-supplied discs,
checks their identities, compares the relevant bytes, then executes the original
MIPS resistance loop in Unicorn. No disc builds, game-state saves or extracted
game assets are produced.

| Input or span | SHA-256 |
| --- | --- |
| Retail Japanese BIN | `a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29` |
| Published v1.0.74 Enhanced BIN | `04b30048a0dc1c207801041a410925aba0283da6793ba3989b98f46a38543b15` |
| Constructor `0x80049094–0x8004A328` | `9d11547d74175080ae0b9a656a54a94a8b2a1c07b451c9664a7fff7022f0e015` |
| Resistance loop `0x80049C90–0x80049D7C` | `1d2c108b744a54c1b731cf5abe8e69efa3ec30e084a65a4b6a931db4ff4403f2` |
| Coefficients `0x80010A14–0x80010A24` | `0284558e86159005da1d868f7e865e14ca6954d7de6383d11dcbf72bba37cabe` |
| Shared species attributes, resource 3657 | `3fab73e4a7cbf5ed128b4d10ba9da4d64552c1e11745cadfa2629b7000e54911` |

The 2026-11-13 run passed **51,207 cases per disc**, each checking all 27
channels: every species grade, each parent grade, and every + value from 0 to 99,
plus seven cases with different grades in adjacent channels. The same run
checked the spell and breath scale bytes at resource 5502 addresses
`0x801756D8` and `0x801756E0`.

```text
python scripts/verify-resistance-inheritance-native.py --original-bin ORIGINAL.bin --bin V74-ENHANCED.bin --python-packages UNICORN_PACKAGES
```

This focused verification does not advance the guide's unrelated full gameplay
verification marker. Original research in the local DQM wiki supplied the
function boundaries; this check independently repeated and expanded that
instruction-level verification against retail and the published v74 image.

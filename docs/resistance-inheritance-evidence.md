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

**Only the child's species can supply grade 7.** A species' innate grade 7 stays
7. A base grade below 7 can rise only to grade 6, even if both parents have
grade 7. A GBC recipe that reaches the highest grade through breeding cannot
do so on PSX.

## Exact PSX calculation

### Finding the child's + from a saved pair

Start with the higher parent's +. Add 1 for every full 20 levels between the two
parents, up to 5. Count how many of the following conditions hold and add 1 for
each pair of conditions. Cap the result at +99.

- Both parents' levels are multiples of ten.
- Both belong to the same family.
- The child's starting maximum MP exceeds its starting maximum HP.
- The parents' + values add up to an even number.

For each of HP and MP, add the parents' **base maximum** stats, divide by four,
round down and use at least 1. The constructor later multiplies both stats by
the same factor (100%, 105%, 110%, 115% or 120%) and rounds to the nearest
integer. This preserves both ties and strict ordering, so these quartered values
are sufficient for the comparison. For example, two same-family, level-10
parents both at +0 produce a +2 child when HP equals or exceeds MP and a +3
child when MP is higher.

### Level 1 hatchling stats

The ordinary shrine sets all six base stats when creating the egg. For each
stat it takes one quarter of the parents’ combined unequipped value, rounds
down, and uses at least 1. It applies one shared multiplier and rounds each
result to the nearest integer, with halves rounded up. Injuries and spent MP
have no effect on the forecast.

The multiplier starts at 100%. Each of these conditions adds five percentage points.

- The ordered pair of personality IDs receives a 3 in the shrine’s compatibility table (resource 3658).
- The parents’ species ranks sum to at least 10 (byte 0 of each row in resource 3657).
- The parents have at least 50 wildness in total.
- The child starts with at least 16 distinct nonzero skill candidates. The game counts the campaign-specific natural skills of both parents and the child, plus the base forms of moves currently learned by either parent. Duplicate IDs count once.

Each pair has a definite result. Reversing the parents can change the child
species and the personality lookup. My game recalculates after a swap and
shows a range when an older import is missing a bonus input. A missing base
stat is displayed as unknown. Re-importing the card restores these inputs.

### Calculating each resistance grade

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
effect logic. For example, Gigante's near-death handler (`0x8011EF6C`) reads
the target's resistance for its action channel and uses the special row
selected at `0x80126CCC`. In the companion chance table at `0x80175680`, row
5 still has a nonzero threshold (30) at grade 7. The inheritance loop reads
the saved resistance bytes at `0xC0–0xDA`,
not a damage calculation or temporary battle modifier.

## What the linked GBC guide establishes

[DwM2_DD's DWM2 Breeding Resistance Guide, v2](https://gamefaqs.gamespot.com/gbc/525414-dragon-warrior-monsters-2-cobis-journey/faqs/62849)
reports four grades, random inheritance outcomes dependent on the child's base
resistance, the parents' current resistances and the child's +. Its tables allow
some nonimmune bases to reach immunity; base 0 cannot. For example, two immune
parents with a base-2 child guarantee grade 3 at +50. That differs from PSX's
deterministic eight-grade calculation and its species-only top grade.

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

An additional 2,000 native cases per disc exercise the starting HP/MP and +
instructions at `0x80049594–0x800495F4` and `0x80049810–0x80049BC8`. They cross
the level-sum thresholds, both family cases, both + parities, the +99 cap and
HP/MP rounding boundaries under all five starting-stat multipliers. The same
verifier reads byte 1 of the 16-byte action descriptors at `0x80174824` in
resource 5502 to match one representative skill with each of the 27 saved
channels in order.

For 512 synthetic pairings per disc, the verifier compares the shipped
JavaScript forecast with execution from `0x80049214` through `0x80049A60`.
The emulator reads the parents, child species, unmodified skill, attribute and
personality tables and runs the original stat instructions. All 6,144 stat
comparisons matched across the two discs, covering both natural-skill tables,
all three campaigns and all five multipliers.

```text
python scripts/verify-resistance-inheritance-native.py --original-bin ORIGINAL.bin --bin V74-ENHANCED.bin --python-packages UNICORN_PACKAGES
```

This focused verification does not advance the guide's unrelated full gameplay
verification marker. Original research in the local DQM wiki supplied the
function boundaries; this check independently repeated and expanded that
instruction-level verification against retail and the published v74 image.

# Skill learning and training planner evidence

The planner turns the native growth and learning tables into checks for an individual monster. It uses the monster's entered base statistics, retained learned skills and inherited candidate skills. Unknown statistics stay unknown. A species and level alone do not establish an individual's starting or inherited stats.

The data covers 315 playable species, 169 skills, 34 combination recipes, 32 growth curves and 32 cumulative experience curves. Retained nonplayable records and zeroed special progression records are excluded. Names remain in the guide's existing translated references; this dataset uses stable species and skill IDs.

## Primary evidence

The training interface and extraction work in the [DQM PSX Master's Reference](https://dqm-psx.github.io/manual/) supplied the starting point. The guide independently extracts the relevant data from original Japanese and English v1.0.73 discs. It does not copy a private research archive into the public site.

Both full disc hashes are checked before extraction:

| Disc | SHA-256 |
| --- | --- |
| Japanese retail | `a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29` |
| English v1.0.73 | `c7fd48e4decd7747a3e8b72ff052960b4ae0943ad61b6a95c57c946791cba812` |

`data/skill-learning-reference.js` records hashes for the compared native routines and tables. All included natural-skill, attribute, growth, experience, requirement, upgrade, combination and inherited-base-skill data agree between these discs. The existing guide's growth profiles also agree with the extracted per-level gains.

`scripts/verify-skill-learning-native.py` executes the actual MIPS threshold and candidate-scan routines using Unicorn. Each disc passes 938 threshold boundary cases across 203 requirement records and 279 candidate-route cases. The latter include every direct skill, every ordinary upgrade, combination prerequisites before and after upgrades, and the combination-order interaction described below. These are isolated native instruction tests, not full emulator playthroughs or a simulation of accepting/replacing skills.

Key native addresses are:

| Native data or routine | Address |
| --- | --- |
| Candidate scan and threshold checker | Resource 104, `801222DC–80122838` |
| Species progression pointer table | Resource 104, `80124518` |
| Cumulative EXP table | Resource 104, `80124544` |
| Per-level stat gains | Resource 104, `801277C4` |
| Skill requirement pointers | Resource 104, `80128AA4` |
| Combination requirement pointers | Resource 104, `80128F6C` |
| Upgrade predecessors | Resource 104, `80128FF4` |
| Ordered combination recipes | Resource 104, `801290A0` |
| Inherited base-skill IDs | EXE, `8009A040` |
| Offspring constructor | EXE, `80049094–8004A328` |
| Natural skill tables | Resources 3655 and 3656 |
| Species breeding limits | Resource 3657, byte 1 of each 32-byte row |

Resource 104 loads at `80114CB8`. The executable's file-address bias is `8000F800`. Additional evidence for farm growth, party learning, and offspring construction is in [learning-mechanics-evidence.md](learning-mechanics-evidence.md).

## Forecasts and level limits

From current level `L` to target `T`, the planner sums the native gains for levels `L + 1` through `T`. It adds those gains to each supplied base stat and caps projected stats at 999. It reports the difference between the cumulative EXP thresholds for those two levels, not the remaining EXP after progress already earned toward the next level.

Future seeds, growth accessories and player decisions are excluded. Projecting levels does not predict the time or number of battles required. An unavailable target level can still show the curve but is marked above the applicable cap.

Ordinary recruitment rolls within two levels of the species' recruitment center, clamps to 1–99, and raises the result to at least the joining level. The planner uses the entered current level as that lower bound because an existing monster cannot have a limit below its current level. Gifts and special encounters may use different rules; a known individual limit overrides the estimate.

Breeding instead uses `min(99, breeding base limit + 3 × offspring plus)`. These are separate native tables. **Balzack has recruitment center 50 but breeding base limit 45** in both checked discs. At +0, its ordinary recruitment estimate is 48–52 while its bred limit is 45; at +2, its bred limit is 51. The previous monster-reference field named `base_level_limit` contains the recruitment center and must not be reused as a breeding base.

Learning can occur on the level-up that reaches a monster's cap. Already being at its cap prevents another party level-up check. `atLevelCap` therefore describes the current stopped-growth state; merely projecting to the final level does not set it.

## Skill access and inheritance

A numerical threshold is not a skill source. Direct access comes from a natural or inherited candidate skill. Upgrade access requires the retained predecessor. Combination access requires all exact prerequisite IDs. A direct natural or inherited route does not also require a combination recipe.

The native scan upgrades each retained skill slot at most once before testing combinations. The planner accounts for that ordering: an automatically upgraded predecessor is no longer available under its earlier ID for a combination in that check. It does not assume a whole upgrade chain is learned at once. Retaining an upgraded form also does not make every intermediate ID a combination prerequisite the monster still possesses.

The offspring's 25 candidate slots contain:

1. The child's three natural skills.
2. Three natural skills from each parent species.
3. The base IDs of each parent's eight retained learned skills.

The constructor uses one campaign-selected natural-skill table for all three species. It does not select a separate table from each parent's Adventure Log. Retained skills map through the explicit native `gSkillBaseIds` table, which is not equivalent to simply following ordinary upgrade predecessors: some combination skills also reduce to a base skill. For example, retained skill 135 maps to 133.

An inherited-but-unlearned parental candidate is not copied by the retained-skill route. Parent species' natural skills are still included regardless of whether those natural skills were learned. Duplicate and empty slots mean 25 slots do not imply 25 distinct usable skills. The planner keeps the exact slot layout and separately exposes the unique candidate list.

Natural tables are preserved by campaign, including extra species: Dimension Dragon's Terry set contains skill 65, while its Cobi/Tara set contains skill 64 instead. This is native table evidence, not an inference from translated names.

The learned list holds eight skills. A new direct or combination skill can require a replacement when all eight slots are occupied. An ordinary upgrade replaces its predecessor and does not need a ninth slot. The planner does not choose a replacement or assume the player accepts a prompt.

## Native combination-order limitation

Testing the complete native candidate scan revealed an interaction absent from a simple threshold calculator. When an earlier combination has all its prerequisite skills but fails its numerical requirement check, the native parser advances its requirement-table index twice. A later recipe can consequently read the requirements belonging to a different recipe.

A reproducible case in both discs uses retained skills 42, 104 and 133 at level 30, MP 130 and Wisdom 150, with the other base stats zero. These meet the ordinary requirements of combination 135, but the earlier combination 98 shares prerequisites 42 and 104 and fails its physical requirements. The native scan does not offer 135. Giving the monster HP 72, Attack 68 and Agility 82 meets the earlier recipe and restores the later offer in the same native harness.

The planner detects that ordering risk and shows a warning instead of confirming a later recipe from its ordinary requirements alone. If the earlier recipe's needed stats are unknown, it requests those stats. A valid direct natural or inherited route remains separate from this combination issue. This is a bounded native-code finding, not a claim about how often ordinary play encounters the example or every possible interaction among learning prompts.

## Reproducing and testing

```text
python scripts/build-skill-learning-reference.py --bin "CURRENT.bin" --original-bin "JAPANESE.bin" --check
node --test tests/unit/skill-learning.test.js
python scripts/verify-skill-learning-native.py --bin "CURRENT.bin" --original-bin "JAPANESE.bin"
```

The last command requires Unicorn; `--python-packages` can supply its installation directory. No game binaries are published. The builder rejects unexpected discs or changed native data.

`DQMSkillLearning.create(reference)` exposes `project`, `check`, and `inherit`. A `ready` result means the entered state meets the supported party-level-up checks. It does not immediately modify a save or guarantee a prompt irrespective of the surrounding game flow. Future-level searches keep the selected known/inherited skill inputs fixed; they do not automatically learn missing prerequisites, choose replacements, or apply future stat items.

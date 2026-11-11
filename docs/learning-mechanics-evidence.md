# Learning, breeding and battle-text reference evidence

The guide articles added in this review use native PlayStation behavior and
public game text. The research leads are not published as player quotations.
This document contains no save data or local source paths.

## Original Japanese and current English comparison

Run the read-only comparison with the authenticated Japanese disc and English
v1.0.73 disc:

```sh
python scripts/audit-learning-mechanics.py --original-bin ORIGINAL.bin --current-bin CURRENT_V1_0_73.bin
```

The audit authenticates both complete images before comparing native routines.
It prints only addresses, sizes and SHA-256 hashes. On 2026-11-11, all nine spans
matched byte for byte. This establishes that the learning, offspring, rank and pacing
rules below are retained from the Japanese game in the checked English release.
It is not a claim that every byte of the battle overlay is unchanged.

| Native span, end excluded | Purpose | SHA-256 in both editions |
| --- | --- | --- |
| EXE `80049094–8004A328` | Offspring construction | `9d11547d74175080ae0b9a656a54a94a8b2a1c07b451c9664a7fff7022f0e015` |
| EXE `80044434–80044640` | Foreign-master strength rank | `83e75b566f930242fefd1292e3fcdb4980ff41e61877e5b1efbfd118c5dfcd37` |
| Resource 104 `801222DC–80122838` | Candidate scan and learning requirements | `32f2a9e0e0afa766e8570d6b9d8a3c2c6c33e8b7c9dbbc07e1009a615c7c6ac5` |
| Resource 104 `8011E950–8011EF1C` | Farm experience and level gains | `1f24af957db968000014afba1a476c5d56cdd355b81d517baa6d30f21b97b34b` |
| Resource 104 `8011FB38–801200D4` | Party level-up preparation | `ab65a403881bea65e0d171bc014296b8d2fa253518732f21b82971d583fa0962` |
| Resource 104 `801200D4–80120688` | Party learning dispatch | `06b2cc50f4c2fce16a814e38f07da17a9b95d22184c3185e5d7492f3d0ee9cec` |

Resource 104 loads at `80114CB8`; executable addresses use file bias
`8000F800`. The three additional pacing spans are described below. The native
addresses and authenticated images are sufficient to reproduce the comparison
without access to a development repository.

## Skill inheritance and farm learning

`BreedCreateChild` fills the offspring's 25 candidate slots as follows:

- Slots 0–2: the offspring species' three natural skills.
- Slots 3–8: the two parent species' natural skills, without a learned-skill check.
- Slots 9–24: the base IDs of each parent's eight retained learned skills.

It does not copy a parent's inherited-but-unlearned candidate list. Natural
skills can therefore pass without first being learned, while another inherited
skill must be retained as a learned skill to pass by the latter route. Duplicate
and empty slots mean 25 candidates do not imply 25 distinct usable skills.
The learned list holds eight entries at monster-record offset `0x78`; the
candidate list starts at `0x80`.

`ResultsLearnSkills` checks all 25 candidates against current requirements,
then checks upgrades and combination recipes. `ResultsCheckSkillRequirement`
compares level and the six base statistics, including base maximum HP and MP,
rather than accessory-modified battle statistics.

Farm experience applies level/stat growth without calling the skill-learning
routine. The party's level-up path calls it. This explains a batch of learning
prompts after returning a farm-raised monster to the active party and gaining a
level. It does not guarantee a particular number of prompts or learning after
every battle regardless of level-up.

The official PS1 introduction independently describes parental skill
inheritance, natural species skills, upgrades and combinations:
[breeding](https://www.jp.square-enix.com/dragonquest/psdqm12/slash/haigou.html)
and [leveling](https://www.jp.square-enix.com/dragonquest/psdqm12/slash/levelup.html).
The detailed slot and threshold claims above come from native code, not from
assuming Game Boy rules also apply.

## Growth limit

The same constructor calculates:

```text
offspring maximum level = min(99, species base maximum level + 3 × offspring plus)
```

The guide's examples use a base limit of 40: +5 gives 55 and +10 gives 70.
The formula uses the resulting plus value, not the count of breeding sessions.
This article does not attempt to replace the separate stat-growth tables or
describe all factors used to calculate the offspring's plus value.

## Breeding between saves

These original Japanese lines and their current translations establish the
title-screen breeding room's user-facing rules:

| Translation ID | Supported rule |
| --- | --- |
| `s0a736000_1170` | Monsters belonging to the same master cannot take part. |
| `s0a736000_118d` | Breeding between games 1 and 2 requires game completion. |
| `s0a736000_11b4` | Offered parents disappear; the session overwrites Adventure Logs. |
| `s0a736000_140e`, `s0a736000_1429` | Each participant receives an egg. |

The article does not specify a story flag or imply that one particular ending
is sufficient for every pairing. It describes the game's own completion check.
These are existing PlayStation features, separate from English v1.0.73's
Colosseum prize transfer.

## Battle text speed 8

`PACE_WAIT` (`F1`) is dispatched by `80035074`. The native function tests
the zero-based text-speed value 7:
other values install a countdown; this value shows an arrow and installs the
input-wait handler. The visible menu calls that setting **8** (`m_exe_08d9ec`).

The comparison also checks `80035074–800350D4`, `800350D8–800351A0`, and the
seven-byte timer table at `800C70E0`. These are identical in both discs. The
single excluded instruction at `800350D4` expands a text-buffer copy bound
from `0xA0` to `0x1C0`; it does not select a delay or change the manual branch.
The countdown table contains 15, 22, 30, 35, 43, 55 and 68 updates. These are
not measured seconds or battle-frame durations.

The meat-result messages retain `PACE_WAIT`, including
`e0af718_206c` and `e0af718_207b`. The article explicitly limits the advice to
this pacing path under normal input conditions. It does not claim a
full meat-feeding replay, a newly implemented pacing fix, or a guarantee that
all messages and animations pause. Word wrapping is a separate system.

## Foreign-master rank numbering

The existing guide formula is correct. Native `80044434` averages each of the
six stats separately with integer truncation. If those averages are H, M, A,
D, S and I, it calculates `q = H + M + A + D + floor((S + I) / 2)` and returns
`floor(min(floor(q / 20), 99) / 5)`, equivalent to `min(floor(q / 100), 19)`.

Some external charts use a doubled score and one-based rank numbering.
Their rank 15 at strength 2,800 is the guide's rank 14 at q = 1,400. Comparing
these without converting both conventions creates a false contradiction.

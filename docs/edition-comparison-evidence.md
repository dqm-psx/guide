# Edition comparison evidence

The public comparison keeps the existing `field-restored-content` link, but now
covers both campaigns and distinguishes two comparisons: handheld versus original
Japanese PSX, and original PSX versus the released English patch.
It is a reference with linked topics, rather than a list of restoration notes.

## Evidence boundaries

The article uses original prose and compact comparison tables. The supplied
Japanese community overview was a discovery aid, not a table imported into the
guide. Its broad bundle/roster context is separated from mechanics supported by
native code, original event messages and the publisher's contemporary pages.
The supplied Re:Gamers roster is useful for finding claims to investigate, but
its combined GB/PS/Retro tables are not used to overwrite native PSX recipes.
The shared ChatGPT link could not be fetched; no claim or quotation is attributed
to that conversation. Private conversation histories are not public sources.

This is not an exhaustive byte-level inventory of everything changed between
platforms. It covers concrete changes to presentation, story routes, learning,
foreign masters and battle systems, while keeping original PSX behavior separate
from English-patch additions. A complete comparison of AI/personality, every
stat-growth curve and every arena reward remains outside this audit.

## Core comparison

| Topic | Primary evidence used | Scope |
| --- | --- | --- |
| Expanded PSX roster | Publisher's PSX breeding introduction; `monster-baseline.json`, synchronized monster reference and validation in `sync-monster-reference.js` | Publisher says over 300 species / 11 families. There are 312 verified library entries and 325 native species records; these counts do not establish ordinary acquisition for all 325. |
| Ordered breeding, + condition, two-save context | Native shrine rule `8004AB80`, title-room override `8004B05C`, existing breeding reference | The Killing Machine example compares two PSX contexts. It does not label either result a generic Game Boy rule. |
| Learning / offspring cap / farm growth | [Learning mechanics audit](learning-mechanics-evidence.md) | Nine native spans compared between original Japanese PSX and English v1.0.73. The comparison article identifies retained PSX behavior; it does not invent a handheld difference for every row. |
| Recruitment / collection history | [Recruitment audit](recruitment-evidence.md) | Both discs independently execute the verified native harness cases. Ordinary eligible wild-candidate probabilities are not generalized to bosses or all master battles. |
| Damage | [Combat audit](combat-evidence.md) | Ordinary wild attacks and 36 supported skills, separate enemy/player ranges and resistance. No claim that the planner models every battle situation. |
| Terry's farm egg and GreatLog shrine access | `scripts/world-disc-index.json` progression guards; `data/world-verification.json` | Class F / pre-Battle Rex egg window; Kids' Class permission plus Water World queue clearance. |
| Memory-card breeding | Original Japanese and current translated messages `s0a736000_1170`, `_118d`, `_11b4`, `_140e`, `_1429` | Different masters, completion check for crossing games 1 and 2, both parents leave, eggs and overwrite warning. No guessed completion flag. |
| Movement and pacing | `field-movement-settings` native references; [learning evidence](learning-mechanics-evidence.md) | Native map-dependent cadence is separate from v73 run/encounter settings. Manual Text Speed 8 predates the patch. |
| Retained unused maps | Existing Hidden Gate audit and guide availability flags | A retained resource is not treated as an entrance or normal-play acquisition route. |

## Handheld story routes versus PSX events

The supplied Prima DWM2 book was visually reviewed at the printed pages below.
PDF page numbers are one-based and include the front matter. These are paraphrased
route comparisons, not reproduced guidebook text or illustrations.

| Step | Prima DWM2 printed / PDF page | PSX evidence |
| --- | --- | --- |
| Opening volunteer search | 2 / 4 | `story-cobi-tara-opening`: the sibling accompanies the player to collect Father's pot; `s003d6000_3008`, `s003d6000_3057` and Warubou's GreatLog scene establish its use as a temporary plug. |
| Ice Key monster gifts | 14 / 16 | `quest-find-the-ice-key` and `story-pirate-mirror`: the PSX farm search follows the Mirror of Destruction; `s003d6000_206b`, `s003b7800_1258`, `_12da`, `_1329`. |
| Northern mountain and queen's story | 14 / 16, steps 13–15 | `story-ice-eastoria`, `story-ice-shield` and their native progression guards separate optional Birdsong Herb/Eastoria events from the peace, Spirit's Spring and Sky Key route. |
| Temporary repair and buried egg | The printed route continues from the Ice World treasure toward Sky-world access | `quest-greatlog-buried-egg` binds the PSX temporary-repair interval and the Sky Key deadline. The comparison does not invent a handheld egg source. |
| Six Hidden Key adventures | 27 / 29 | The handheld three-per-cartridge structure is distinct from PSX generated Magic Key worlds. `story-greatlog-postgame` documents the verified PSX activities and rewards. |

The book's **Pirate World** is the guide's **Water World**. Its shrine timing on
printed page 40 / PDF page 42 is not itself a platform difference merely because
those labels differ. PSX Kids' Class permission and the queue-clearing event are
checked independently against native guards.

## Learning requirements and Summon recipes

Prima DWM2 printed pages 137–140 / PDF pages 139–142 contain the handheld skill
table. The six numeric examples use printed pages 137–138 / PDF pages 139–140.
The PSX values come from `FIELD_GUIDE.skill_requirements` and the native records
documented in [skill-learning evidence](skill-learning-evidence.md).

| Skill | Minimum level | Minimum max MP | GBC Intelligence | PSX Intelligence |
| --- | ---: | ---: | ---: | ---: |
| Blaze | 1 | 7 | 36 | 20 |
| Firebal | 3 | 11 | 42 | 23 |
| Bang | 4 | 13 | 47 | 26 |
| Heal | 1 | 7 | 11 | 6 |
| Healmore | 10 | 52 | 87 | 48 |
| Healall | 16 | 82 | 114 | 80 |

These maximum-MP values are learning requirements, **not casting costs**. The
article identifies the handheld values as printed evidence; it does not claim
that a separate GBC binary learning harness was run for them.

The book describes the handheld TatsuCall → DiagoCall → SamsiCall → BazooCall
upgrade chain at levels 20/25/30/35, max MP 70/100/130/160 and Intelligence
100/250/400/550 (printed pages 140/138/139/137 respectively). On PSX the native
combination recipes instead require:

- Deago (134): Tattsu (133), Defense (40), Focus Spirit (105); level 25,
  max MP 100, Intelligence 120.
- Samshin (135): Tattsu (133), Speedup (42), Charge Power (104); level 30,
  max MP 130, Intelligence 150.
- Bazoo (136): Tattsu (133), Thordain (15), Wave of Darkness (130); level 35,
  max MP 160, Intelligence 180.

## Native temporary effects and repeated commands

[`audit-edition-mechanics.py`](../scripts/audit-edition-mechanics.py) independently
authenticates the original Japanese and v1.0.73 image hashes, decodes their battle
resource and compares six spans. The generated
[`edition-native-verification.json`](edition-native-verification.json) records
the hashes and exact comparison ranges. All six spans are identical.

| Native address, resource 5502 | Purpose |
| --- | --- |
| `8014C760–8014DDB0` | Duration expiration and adjacent cleanup, including restoration of base Defense/Agility and temporary effect flags. |
| `80143EF4–80144060` | Consecutive-command counter and reset conditions. |
| `80126FA4–80127148` | Resistance adjustment using the repeated-command state. |
| `80127148–8012726C` | Damage adjustment; the qualifying fourth command can apply a 5/4 multiplier with integer rounding. |
| `80115964–8011597A` | Twenty-two duration limits. |
| `80114DA4–80114DC4` | Eight-by-four resistance adjustment table. |

The article's interpretation follows the corresponding native routine analysis:
eligible matching commands advance through a four-use cycle; a changed command
starts a new sequence, while unavailable actors and ineligible contexts clear
the state. This is not a permanent resistance debuff. The public article omits an
exact turn-count promise because effect-specific application timing was not
exhaustively checked here. The check is a **byte comparison**, not a new execution
test of every effect or a direct comparison with the GBC battle engine. Baseline
damage-calculator outputs do not model this sequence or temporary battle buffs.

## Presentation

The contemporary [Enix announcement report](https://game.watch.impress.co.jp/docs/20020326/dqm.htm)
describes renewed PSX graphics and sound. Native map assets, battle sprites and
the publisher's battle presentation support the visual description. The article
does not assert that the environments are polygonal 3D models: it describes
layered depth, redrawn floor plans and animated/scaled 2D monster art. Community
music documentation supplies the narrower new castle/boss-music detail; the
article does not reproduce a track list or claim a full soundtrack audit.

## Controls and local-battle comparison

The controls table puts the handheld and PSX behavior in separate columns.
Water crossing, rock breaking and flight already exist in handheld DWM2; they
are retained abilities, with A on Game Boy Color and Triangle on PSX. Jimeous’s
[handheld Cobi walkthrough](https://gamefaqs.gamespot.com/gbc/525414-dragon-warrior-monsters-2-cobis-journey/faqs/14383)
records those A-button actions in sections 2.4 (water), 3.6.05 (rocks) and
5.3 (cloud). PSX controls are bound to the native dialogue records in
`field-triangle`.
The comparison no longer treats the difference between Terry’s and Cobi/Tara’s
PSX walking cadence as a change from Game Boy. That campaign distinction remains
in the movement article. English v1.0.73 running settings are explicitly labeled
as additions to the Japanese PSX release.

The [DWM1 instruction manual, p. 34](https://www.videogamemanual.com/gbc/Dragon%20Warrior%20Monsters%20%28USA%29.pdf)
and [DWM2 Cobi instruction manual, Game Link Cable mode](https://www.woodus.com/den/gallery/graphics/dwm2gbc/manual/dwm2gbc_cobi_manual.pdf)
establish the handheld link-cable setup. The PSX publisher’s Colosseum setup and
command pages document the replacement: Adventure Logs on one console, shared
team selection, and timed alternating command input. The table does not claim
that input order determines action order or that all handheld multiplayer modes
survive on PSX.

## Foreign masters

The edition article summarizes the guide's existing audited foreign-master
comparison. The full role priority, destination restrictions and hunting advice
remain in `field-wandering-masters`; the two articles link rather than creating
conflicting copies of the underlying data.

| Native reference | Rule |
| --- | --- |
| PSX original/v73 `80050440` | Role selection, including first matching qualifying role on an eligible ordinary destination. |
| PSX `8003F298–8003F360`, `8003EB8C` | Revealed rooms / floor state and ordinary destination checks. A selected master does not bypass special/boss destination handling. |
| PSX `80044434–80044640` | Party-stat rank, separately truncated averages; `min(floor(q / 100), 19)`. Both discs match, as reproduced by the learning audit. |
| US/EU DWM1 `0B:46DA–470D` | Two-screen / sixteen-screen conditions used by the handheld comparison. |
| US/EU DWM1 `16:6266–6289` | Separate qualifying-master 50% roll. |
| US DWM2 Cobi/Tara `12:764C–765D` | Handheld visitor priority; compare PSX Bard before Merchant. |
| US DWM2 `12:77AC–781D`, `12:7934–797B` | Bard EXP digits and Merchant selection. |

The PSX Cobi/Tara check's 100 counted steps is not presented as an exact visible
walking distance that guarantees placement. The row for party-level scaling
explicitly names Terry's Game Boy game; it does not silently generalize that
verified handheld comparator to every campaign.

## Public publisher sources

- [Breeding and the PSX roster](https://www.jp.square-enix.com/dragonquest/psdqm12/slash/haigou.html).
- [Natural skills, upgrades and combinations](https://www.jp.square-enix.com/dragonquest/psdqm12/slash/levelup.html).
- [Original Colosseum setup and rules](https://www.jp.square-enix.com/dragonquest/psdqm12/taisen_top.html): saved Adventure Logs, same-log practice, visible team selection, 20-turn limit, transformation restrictions.
- [Original Colosseum commands](https://www.jp.square-enix.com/dragonquest/psdqm12/taisen_gokui.html): alternating timed input versus action order, timeout behavior.
- [Historical mobile-transfer FAQ](https://www.jp.square-enix.com/dragonquest/psdqm12/psdqmisub/dqmi_tensou_others.html): paired receiver key / transfer password, level-10 arrival and level-20 growth limit for phone-born monsters, conversion of skills.

The mobile section describes the historical PSX service. It does not assert that
the old service is operating or that an externally decoded password establishes
a normal receive-and-save route today.

## English patch changes

The [v1.0.73 release](https://github.com/phakic/DQM-1-2-PSX-translation/releases/tag/v1.0.73)
and its bundled README separate:

- Retained table dialogue restored with reconstructed seating/personality matching.
- Restored Terry special floors, including reconstruction choices in behavior and rates.
- Movement controls, saved per adventure, and Time versus Distance encounter settings.
- Configurable Colosseum rules and optional prizes that write both Adventure Logs.
- Explicitly identified original-game defects versus fixes for historical English builds.
- Fresh boot plus in-game memory-card saves after changing patch versions.

The comparison does not describe every fix in the changelog as a Japanese-game
bug. Unreleased wording editions are excluded from the public comparison.

## Additional handheld-book context

The provided Prima DWM1 guide, printed page 44 (PDF page 50), lists the Game Boy
special floors. This supports treating its room advice as handheld context;
the English patch's restoration notes define what the patched PSX game adds.
No guidebook scans, private files or long guidebook passages are published.

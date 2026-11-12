# Guide research audit

This review used targeted DQM conversation histories and earlier research as
leads, then checked the relevant claims against game data, existing guide
coverage and official documentation. It was not a complete rereading of every
conversation, repository or local file. Older answers can describe an earlier
patch, the Game Boy games, or an investigation that never established a usable
in-game route.

## Sources reviewed

- Relevant local and web conversation histories, including questions about
  skill inheritance, farm training, text pacing, breeding between saves,
  accessories, rare monsters, arena difficulty, loot, movement and save files.
- Connected development issue reports and earlier player-question research,
  used to identify recurring confusion rather than as published quotations.
- Existing guide articles, walkthroughs, quests, skill and item references,
  breeding rules and monster acquisition data, to avoid duplicating answers.
- The original and English exploration projects, earlier guide experiments,
  the DQM PSX Master's Reference and local wiki/extraction research. The
  English exploration snapshot targets v1.0.61 and the manual's earlier
  recruitment reports target v1.0.66; these were research leads, not assumed
  proof for the current patch. Recruitment checks were rerun on both discs.
- Native PlayStation routines and tables, checked against authenticated
  original Japanese and English v1.0.73 disc images where specified below.
- The publisher's PS1 descriptions of
  [breeding](https://www.jp.square-enix.com/dragonquest/psdqm12/slash/haigou.html)
  and [learning skills](https://www.jp.square-enix.com/dragonquest/psdqm12/slash/levelup.html).

Conversation histories supplied research leads rather than publishable
evidence. The public changes include no conversation excerpts, player
identities, local source paths, save contents or links that require access to
private development repositories.

## Verified improvements from this pass

| Player need | Guide change | Evidence |
| --- | --- | --- |
| Are the character portraits correct? | Correct Milly; retain Laura and Tife after verifying their native DQM1 assignments. | All 41 primary portraits and Milly’s home appearance match original and v1.0.73; [actor and sprite evidence](npc-sprites.md). |
| How much meat will help this monster join? | Add an encounter-specific calculator, extra-meat comparisons, collection-history and Orb controls, and shareable calculations. Link it from monsters and meat items. | 283 wild contexts / 1,131 enemy records and native instruction execution on both discs; [recruitment evidence](recruitment-evidence.md). |
| Which skills survive breeding? | Explain natural skills, retained parental skills, base forms, the eight learned-skill slots and the inherited-but-unlearned distinction. | Native offspring construction and skill candidate scan; identical in original and v1.0.73. |
| Why did farm training produce no skills, then many prompts? | Explain farm growth, party level-up checks, current-stat thresholds and batches of eligible candidates. | Separate native farm and party level-up routines; identical in both editions. |
| Why did this monster stop gaining levels? | Give the offspring cap formula, `min(99, species base limit + 3 × plus)`, with examples. | Native offspring constructor, checked in both editions. |
| Can monsters breed between Adventure Logs? | Explain the title-screen room, completion restriction for crossing games 1 and 2, and the parent/egg/save consequences. | Original Japanese event messages and their current translations. The precise completion flags are not inferred. |
| Battle messages disappear too quickly. | Explain Text Speed 8's manual pacing mode and its limits. | Native pacing dispatcher, manual branch and timer table compared in both editions. |

Reproduction steps, native addresses and scope limits are in
[learning-mechanics-evidence.md](learning-mechanics-evidence.md). The byte
comparison verifies the unchanged implementation; it does not substitute for a
complete emulator playthrough of every flow.

The foreign-master rank formula was also rechecked. Some external charts use
one-based ranks and twice the guide's score. The existing guide's zero-based
rank formula is correct; mixing those conventions can produce an apparent
disagreement.

## Earlier findings already represented in the guide

The current walkthrough and reference already cover the Ice World to Sky Key
route, the optional farm egg, the mutually exclusive Petitbou/Warubou offers,
Miracle Mark, conditional breeding recipes and the title-screen breeding-room
context, movement settings, and the different foreign-master selection rules.
Those questions should lead to their existing answers rather than generate
another set of disconnected FAQ pages.

## Prioritized follow-up opportunities

1. **Equipment instructions at the point of use.** Add a verified Items → Use
   walkthrough to accessories. Distinguish swapping an accessory from leaving
   its slot empty. Retained Equip/Remove menu text alone does not establish a
   reachable menu.
2. **Arena reward planning.** Bring entry costs, repeatable prize chances and
   Magic Key rewards together. Verify current PS1 tables before comparing
   difficulty or rates with Game Boy data; a chance to win a key is not a
   chance to obtain a particular generated world.
3. **Library completion and rare species.** Explain registration versus current
   ownership, campaign-specific master pools, the counted library entries and
   hidden species. Successful decoding of a mobile transfer password alone
   does not prove a complete receive-and-save route in normal play.
4. **Key-world and loot planning.** Connect appraisal, generated inhabitants,
   boss recruitment restrictions and item sources. Earlier loot comparisons
   predate changes to restored treasure rooms and need a current-version audit.
5. **Patch and save troubleshooting.** Keep memory-card saves distinct from
   emulator states, and name the build when discussing historical crashes or
   restorations. Emulator-specific file handling should use current emulator
   documentation, not a generic rename instruction.
6. **Edition context.** Make clear where relevant that the Game Boy-named
   English text edition still runs PlayStation mechanics. Name aliases help
   find a monster; they do not make handheld recipes or encounter tables apply.


The existing loot investigation did not establish an ordinary battle drop
table or drop rate. An audited inventory append returned an owned accessory;
it is not evidence for a new item source. The recruitment calculator explains
collection history, while full library-completion planning remains future work.

These are research priorities, not claims that their full answers have been
implemented or verified by this pass.


## Tool inventory and integration

The second pass checked the actual applications, not just their article lists.
The Japanese and English exploration repositories are primarily native asset
browsers: maps, sprites, animation, palettes, audio and script inspection. The
English browser's extracted build is older than the current patch, so its
labels and behavior are not treated as the current gameplay authority. The
wiki/manual application contains the player calculators below. The older
experimental guide supplies breeding and roster workflows, many already
incorporated into this guide.

| Existing resource | Guide status after this PR | Remaining distinction |
| --- | --- | --- |
| Training / skill-learning calculator | New **Skill & growth planner**: six growth curves, EXP, recruited versus bred caps, stat thresholds, known skills, inherited candidates, exact combination prerequisites, parent candidate builder and shareable plans. Linked from the sidebar, home, Skills and species pages. | Does not simulate player choices about replacing skills or automatically learn every intermediate skill on a projected journey. Native combination-order interactions are identified explicitly. |
| Combat matchup calculator | New **Damage calculator**: actual campaign/area/enemy selection, normal attacks, supported spell/breath/level damage, separate enemy ranges, family bonuses and companion resistance overrides. | Unsupported actions and situational modifiers are explicitly excluded. An individual bred monster's resistance cannot be inferred from its species. |
| Recruitment calculator | Added in this PR, linked from species, meat items and the recruitment article. | Uses ordinary recorded wild encounters; not a universal boss or scripted-gift predictor. |
| Parent lookup, breeding matrix and tree | Existing guide tools already supply forward/reverse recipes, conditional results, trees, roster and save workflows. | The manual's **child-stat, plus and resistance inheritance calculator** is a distinct useful feature, still missing as a complete calculator. The new parent skill builder calculates only skill candidates. |
| Shop and inventory browser | The sortable Items table includes prices and sources, with linked locations. | A dedicated shop-centric inventory comparison remains useful; item-centric coverage is not a full replacement. |
| Medal reward selector | Rewards and unlocks are represented in quests and gate requirements. | An interactive reward-progress tracker is not implemented. |
| Arena, generated-world and movement tools | Existing walkthroughs, encounters, gate-generation samples and movement articles cover much of their player-facing information. | There is no complete arena reward-probability or generated-key/loot calculator; current patch verification is required. |
| Sprite, map, dialogue, flag and binary viewers | Maps, character art and verified dialogue are integrated into player pages. This pass adds Terry and Milly's home, which the map importer had omitted. | Raw binary/flag viewers are research interfaces rather than player guide features. They remain evidence sources. |

The opening home is native scene 103, one map containing the bedroom and
adjoining living room. Its verified speech belongs to Milly, Warubou and
Watabou; Terry is present but has no spoken line in this room's text pool.
Milly's white-nightdress portrait is shown for her home appearance, separately
from her later Queen's Room portrait. The home title and dialogue participate
in translation refresh through explicit resident-text bindings.

See [skill-learning evidence](skill-learning-evidence.md),
[combat evidence](combat-evidence.md), and [NPC sprite evidence](npc-sprites.md)
for reproducible verification and limits. None of the underlying private chat
text, save contents or local filesystem paths is copied into the public site.

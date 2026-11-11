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
| Are the character portraits correct? | Correct Milly; retain Laura and Tife after verifying their native DQM1 assignments. | All 41 native portraits match original and v1.0.73; [actor and sprite evidence](npc-sprites.md). |
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
7. **Contextual damage planning.** A combat calculator could distinguish
   player/bred resistance values from the ordinary wild-enemy tiers and enemy
   spell ranges. Earlier native harnesses are a useful starting point, with
   current-disc corroboration required before adding this tool.

The existing loot investigation did not establish an ordinary battle drop
table or drop rate. An audited inventory append returned an owned accessory;
it is not evidence for a new item source. The recruitment calculator explains
collection history, while full library-completion planning remains future work.

These are research priorities, not claims that their full answers have been
implemented or verified by this pass.

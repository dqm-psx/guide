# Guidebook review and guide design

This review uses three supplied guide scans and three photographed monster profiles to identify useful information and presentation patterns. It is a design and coverage review, not a transcription or an independent verification of their gameplay claims. No scanned pages, book artwork or copied guide prose should be published with the site.

## Sources and identification

| Reference | Edition and scope | Inspection |
| --- | --- | --- |
| **勇者鬥惡龍之怪物仙境1.2**, cover marked “FOR PS” | Traditional Chinese PlayStation guide; 210 scanned PDF pages. This is not a Japanese-language guide. The scan does not establish an official Japanese publisher. | Both contents pages, opening system chapters, campaign maps and routes, arena tables, items, skill effects and learning requirements, breeding, species, resistance tables and final pages. |
| **Dragon Warrior Monsters: Prima's Official Strategy Guide** | Elizabeth Hollinger and James Ratkos, Prima, 2000; Game Boy game; 170 PDF pages including covers and advertisements. | Contents, town services, arena progression, gate profiles, advanced information, species profiles and recipe tables. |
| **Dragon Warrior Monsters 2: Cobi's Journey & Tara's Adventure**, Prima | Elizabeth M. Hollinger, Prima, 2001; Game Boy Color games; 148 PDF pages. | Contents, campaign distinctions, campaign chapters, mapped dungeons, post-boss guidance, breeding, species profiles, recipes and item guide. |
| Three Japanese monster-profile photographs | Zoma's Devil, Dimension Dragon and Ramia; the pages explicitly discuss the PlayStation campaigns. They are a different publication from the Traditional Chinese scan. | Each complete supplied photograph, including acquisition, breeding, growth and resistance panels. |

The strongest bibliographic candidate for the photographs is **プレイステーション用 ドラゴンクエストモンスターズ1・2 星降りの勇者と牧場の仲間たち 最強モンスターデータブック**, Enix, ISBN **9784757507753** / **4-7575-0775-5**. The [publisher's listing](https://magazine.jp.square-enix.com/top/comics/detail/9784757507753/) identifies a PlayStation volume covering 316 monsters, released August 30, 2002. The [National Diet Library record](https://ndlsearch.ndl.go.jp/books/R100000002-I000003675951) identifies the Japanese Enix volume as 367 pages, 21 cm, with a September 2002 publication month. Its subject and scope fit the photographs, but these records do **not** prove an exact interior-page match. Describe this identification as likely until a contents page, colophon or matching interior is available.

There is also a separate [Enix PSX official guide](https://magazine.jp.square-enix.com/top/comics/detail/9784757506886/) and a [Game Boy Color DQM2 data book](https://magazine.jp.square-enix.com/top/comics/detail/9784757504868/). Similar titles and cover art make edition identification important.

The Traditional Chinese scan has no usable text layer. The first Prima scan also has no text layer; the second has noisy OCR. Findings below come from rendered pages rather than text extraction alone. Page references below use the page number printed in the book.

## What the books do well

### A place is a complete decision, not just a map

The Chinese guide's Desert and Water world sections (pp. 31 and 37) combine a numbered overview map, a location key and the route through that area. Prima 2's Asiya/Canal section (p. 8) places shops, treasure, encounters, a boss and progression instructions together. Its Ice Tower section (p. 19) explains what becomes available when the player returns home and why an optional revisit is useful.

Apply that relationship to the website:

1. **Before you go:** exact unlock requirement, destination and any required item or field ability.
2. **Route:** a short ordered sequence of actions, with linked places and people.
3. **At this location:** map, useful NPC services, treasure and shops, using the same place identifiers as the atlas.
4. **Encounters and boss:** floor or area, campaign, recruitability and relevant battle information.
5. **When you return:** reward, newly available facilities, optional revisits and the next story destination.

The detailed reference pages remain useful, but the walkthrough should assemble them at the point where they answer a player's next decision. Do not make the reader open five directories to reconstruct one visit.

### Dense summaries have a stable order

Prima 1's gate profiles (for example p. 44) use a repeated order: depth and opening condition, items, special floors, floor-banded encounters, boss and entrance image. A player can compare gates without relearning the layout. The Chinese guide uses consistent table structures for arena opponents (p. 99), item effects and prices (p. 102), skill requirements (p. 118) and resistance categories (p. 180).

For the web, preserve table semantics, sortable columns, clear units and concise row labels. Keep requirement, reward and consequence distinct. “Arena class” is less useful than “Requires Class G victory.” Frequency claims need a defined scale and PSX evidence; an unexplained star count is not a probability.

### A monster profile answers several connected questions

Prima 1's profiles combine acquisition, skills, parent recipes and resistances. Prima 2 gives repeated visual summaries that make species comparable. The Japanese photographs distinguish acquisition, breeding and training advice, then place growth and resistance visualizations beneath them.

A species page should therefore answer, in order:

- **What is it?** Clear portrait, current patch name, Japanese name and recognized older names.
- **How can I get it?** Encounters, gifts, foreign masters, bosses and breeding, with campaign and story requirements.
- **How do I raise it?** Natural skills, learning requirements, level limit, growth and inheritance.
- **What can it do in battle?** Resistances, special traits and links to the relevant calculator.
- **What can I breed with it?** Recipes and planning tools, including the player's actual saved monster.

Use actual PSX values and explain chart scales. A simple labeled bar chart can be easier to compare than a radar polygon. Do not reproduce old book letter grades as if they were native game values. Make tabular values available alongside any chart, and distinguish species defaults from a bred monster's actual save data.

## Information architecture

The books separate a route through the game from a reference to its rules. The site should do the same while connecting both to tools.

| Area | Reader's task | Useful connections |
| --- | --- | --- |
| My game | Decide what to do with the current party and collection | Saved monsters to breeding, skill learning, damage and recruitment tools; progress to walkthrough chapters. |
| Tools | Answer a concrete calculation or planning question | Return to the relevant monster, skill, item or mechanics explanation with the chosen context intact. |
| Reference | Look up a named monster, skill, item, person or place | Campaign, location, acquisition, dialogue, related quests and applicable tools. |
| Walkthroughs | Follow the campaign or find the next step | Requirements, route, local map and services, rewards, return visits and next chapter. |
| Mechanics | Understand the rules and version differences | Thematic chapters, searchable article index and contextual links from reference pages and tools. |

Keep the familiar compact navigation and one guide search. Within a long campaign use chapter anchors and a clear current chapter; within a mechanics article use a short contents list. A directory table can remain sortable by article and campaign while a topic column makes its subject visible. Topic filters should not create a second parallel search system.

Recommended mechanics topics:

- **PSX and English patch:** edition comparison, campaign differences, restored features, patch-only changes and known original-game bugs.
- **Raising and breeding:** eligibility, parent order, offspring species, inherited stats and skills, level limits, eggs, personality, farm and equipment.
- **Battle:** turn order, damage and resistance, status effects, AI and tactics, arena rules and team preparation.
- **Exploration and recruitment:** walking and encounters, meat and recruitment, foreign masters, random floors, Magic Keys, treasure and travel tools.
- **Two-player and saves:** Adventure Logs, cross-save breeding, Colosseum rules, wagers, save format and importing a card into the guide.

“Player questions” are useful search phrases and article aliases. They should not be the only organizing principle of the mechanics section.

## Coverage inventory

At the time of review, `FIELD_GUIDE` has 21 mechanics entries. Most contain one to five detail paragraphs; foreign masters and skill inheritance already use deeper sections. Existing topics include farm storage, packing, breeding, eggs, personality, growth, equipment, keys and medals. The gap is therefore a mixture of missing depth, missing integration and missing topics, rather than every topic below being absent.

| Subject to check | What the player needs | Evidence / integration work |
| --- | --- | --- |
| Campaign progression | A route from opening through credits and postgame; mandatory versus optional actions; what each victory unlocks. | Join existing story and quest records to local maps, NPCs, boss records and rewards. Avoid displaying save-flag names as instructions. |
| Hub services and revisits | Where to breed, hatch, appraise, store, buy and exchange; when services or stock change. | NPC dialogue, scene conditions, stock records and progression checks. Show the service on the relevant map and walkthrough stage. |
| Recruitment | Meat choices, previous collection, party space, duplicate species and special recruitment restrictions. | Native recruitment code plus encounters; calculator should accept saved collection state. |
| Foreign masters | Spawning requirements, location restrictions, table selection, party-strength input, rare species and campaign differences. | Native spawn/table evidence; connect each obtainable species to the applicable master table. |
| Growth and training | EXP, level limits, growth curves, inherited starting stats, equipment effects and what to do when progress slows. | Native growth/EXP data, save values and clearly labeled assumptions for projections. |
| Skills | Eligibility as well as stat thresholds, inherited versus known skills, upgrades, combined prerequisites, forgetting and skill capacity. | Skill records and learning code; route from a saved monster directly to learning checks. |
| Personality and obedience | How commands and books affect behavior, what displayed personality means, and practical ways to change it. | Native behavior rules; distinguish observed behavior from precise probabilities. |
| Breeding | Parent order, sex and level eligibility, special recipes, + value, inherited stats/resistances/skills, cost and consequences. | Breeding rules and shrine dialogue; surface explanations beside the tools rather than only on a separate article. |
| Battle and arenas | Damage types, resistance categories, status removal, AI choices, entry restrictions, teams, costs and rewards. | Native battle and arena data; explicit campaign differences. |
| Exploration | Generated layouts, possible special floors, portals, encounter rate, hazards and useful travel items. | Map/generator records and patch status; show examples without implying a random floor has one fixed map. |
| Magic Keys | Acquisition, appraisal, world characteristics, difficulty, rewards and Cobi/Tara differences. | Native key generation and rewards; make the key article a complete explanation rather than an appraisal instruction alone. |
| Collections and rare rewards | Medal milestones, monster-library progress, unique monsters and repeatability. | Quest scripts and species records; connect progress from the imported save where reliably decoded. |
| Multiplayer | Which title-screen modes exist, prerequisites, what is saved or transferred, and how campaign combinations differ. | Original PSX and patched behavior need separate verification. Do not carry GBC cable rules into PSX instructions. |
| Edition differences | Presentation, controls, movement, campaigns, monsters, breeding, battles, keys, multiplayer, removed/restored content and bugs. | Compare original GB/GBC, Japanese PSX and the English patch independently. Patch release notes establish patch changes, not every remake difference. |

## Visual direction

The monochrome guide is attractive because its type, spacing, repeated headings and tables form a recognizable system. It does not require many colors to communicate hierarchy. Borrow that consistency, not its heavy ornamental margins.

- Use a restrained palette, fine section rules and small campaign/topic labels.
- Give real maps and sprites the visual emphasis. Decorative art should not push useful content down the page.
- Use short factual summaries above dense tables, with the same naming and units across pages.
- Keep map labels visually distinct from exits and portals; pair important markers with readable names and a legend.
- Prefer flowing sections and compact summaries to a separate bordered card for every paragraph.
- At narrow widths, let the reader reach the route and data quickly. Keep tables scrollable and columns selectable rather than shrinking text.
- Use individual image assets where an image represents one species or character. Normal image behavior, sharp integer scaling and a useful intrinsic size are preferable to forcing a full sprite sheet into every portrait element.

## Verification and publication boundaries

The books are not interchangeable with each other or with the patched game. The Traditional Chinese scan's p. 178 uses unknown acquisition markers for several rare species and describes them differently from the Japanese photographs. Its contents page also has offsets that do not always match the actual printed section starts. Those discrepancies are reasons to verify, not to reconcile by guessing.

For each new factual statement, record the campaign and edition, identify native data or a documented source, and keep uncertainty visible in maintainer evidence. Do not use a GBC walkthrough to assert PSX chest placement, a printed probability to override game code, or a patch restoration to claim a feature existed unchanged in the Japanese retail release.

The implementation priority is a coherent loop: **my monster -> useful tool -> explained result -> acquisition or training route -> relevant place**, and **current chapter -> local objective -> map/people/rewards -> next chapter**. Adding isolated articles without those connections repeats the existing problem.

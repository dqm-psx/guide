# Maintaining the PSX Player Guide

## Gameplay sources

The v1.0.73 walkthrough audit resolved all 1,293 cited records for the 171
campaign, quest, boss, character and location articles. It also checked the
native conditions behind the fixed story keys, spirit rewards and arena rounds.
The v1.0.73 disc uses **Hale** in nine cited lines. The current published text
uses **Healie** in dialogue and **Hale** as the default recruit nickname. Both names find the character.

For Terry’s Sky Dragon egg, the farm sign event checks Class F (0x02),
Pulio’s hint (0x79), whether the egg is already claimed (0xF6), and whether
Battle Rex was defeated (0x05). Its bytecode matches on the retail Japanese
and v1.0.73 Current discs. See the [maintainer’s reply to a PSX playtester](https://www.reddit.com/r/DragonQuestMonsters/comments/1weqzrc/comment/p9kzxn2/).

After Ice World, the GreatLog guard checks story flag 0x12 and asks if the
player is Kameha’s friend. Answering yes sets 0xE9 and starts the audience.
The castle guard’s bytecode also matches on both discs. The king awards the Sky Key. The bottle, bookcase, pillar, slide and straw
stand use separate event flags for the optional monster egg. A [PSX player
described where they got stuck](https://www.woodus.com/forums/topic/21933-dragon-quest-monsters-12-psx-help/). The [PS1 route](https://renge-record-book.com/%E3%80%90ps%E3%80%91%E3%83%89%E3%83%A9%E3%82%B4%E3%83%B3%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%83%A2%E3%83%B3%E3%82%B9%E3%82%BF%E3%83%BC%E3%82%BA1%E3%83%BB2-%E6%94%BB%E7%95%A5%E3%83%81%E3%83%A3-2/)
also places the talking pot’s key award after the ending.

All 43 character pages show PSX artwork. The portraits include 38 field actors,
the three playable heroes, and species sprites for Healie and Terry’s starter, Slib.

Default monster nicknames follow the builder’s starter, boss and gift name tables
in the same four-hour refresh as species names. Each row keeps its native ID,
Japanese name and English variants. The starter’s walkthrough name comes from
its recruitment record. Healie’s speaker name and recruit nickname come from
separate records and appear together when they differ.

The atlas groups 406 fixed layouts into 183 named places. Each layout keeps
its own link and doors. The v1.0.73 disc check verified the static background
art, native map titles and 829 linked doorway destinations, including a
different Small Cave background when returning from the cave interior.
The atlas follows recorded doorways. Story triggers, moving actors and
generated dungeon floors fall outside its scope. Map images load on demand
and can be revisited offline once cached.

Items distinguish verified effects from evidence of availability in a
particular adventure. Shop stock, prices and skill-learning thresholds were
checked against v1.0.73. Item pages list Japanese names, menu abbreviations and
the English names used in each published patch edition. Any of these names can
be used in the field-guide search.

All 169 learnable skills include PSX tooltip text, MP cost and target. The
directory links skill upgrades and combinations to their component skills.
Each monster profile links its natural skills to those entries. The
source-disc check can be repeated with `scripts/build-skill-descriptions.py`.

Monster links open profiles containing the current and alternate names,
Japanese name, sprite, library text, stats and growth, natural skills,
recorded encounters, and breeding uses. Profiles link directly to the pairing,
parent-search, and tree tools.

### Breeding order and conditions

**Pedigree and mate are ordered.** Reversing them can change the result.
The table, tree, and team tools distinguish three contexts:

- **Ordinary shrine:** applies the verified parent `+` rules.
- **Two-save Breeding room:** applies the title-screen room overrides, which
  take precedence over ordinary results.
- **Base table only:** shows the species matrix without either override.

Enter actual parent `+` values in the table. A rule requiring either parent
to reach a threshold checks each parent separately; it does not add their
values together. The tree displays these requirements beside the affected
recipe. A family requirement means any member of that family.

The matrix offers 8, 12, or 24 rows and columns per page. Arrow keys move between
result cells; Home and End move to the first and last result in a row. Its
offspring search highlights matches on the current page. **Recipe list** searches
all pairings allowed by the parent filters, with its own paginated results.

The independent tree excludes routes that loop back to an ancestor and supports
up to eight generations and 63 monster requirements. Changing breeding context
starts a new tree; Undo restores the previous one. Recipes are explicit choices,
not a claim of the shortest route. Availability, parent sex and level, inherited
stats, and other eligibility requirements still need to be checked in the game.

### Monster data and coverage

The reference contains **315 standard species**, **10 named extra/internal
entries**, and **one unnamed internal slot**: 326 table slots in total. Standard
species have native six-stat growth and base level-limit data. The native library
contains **312 descriptions**; missing descriptions remain identified as missing.

The profile's level control shows accumulated **species growth from level 1**,
with an expandable table of individual level-up gains. These are not final stats:
starting stats, inheritance, accessories, and the monster's individual level limit
also matter. The campaign selector separates Terry, Cobi, and Tara skill and
encounter records.

Encounter coverage is incomplete. An empty list does not establish that a monster
can only be obtained through breeding. Unverified resistance meanings and other
missing information are labeled rather than filled from another version of the
game.

Extra/internal entries are hidden by default and can be revealed with the
**Include extra / internal table slots** setting. They remain labeled, and their
presence in the data does not establish normal obtainability. The independent
tree, teams, and standard-roster breeding table use the 315 standard species.

## Translation updates and source evidence

The [publication workflow](../.github/workflows/publish-guide.yml) runs on pushes to
`main`, manually, and every four hours. It reads the public
[translation export](https://github.com/dqm-psx/translations), pins both source
files to one commit, validates their hashes and identities, and refreshes monster
names, library text, item and skill names, map and encounter labels, and the latest published
patch's release metadata. The upstream publisher updates that release metadata
when a stable patch release is published or edited. The guide needs no
private-repository access or additional repository secret.

NPC names, named locations and reviewed mentions in walkthrough prose follow
the same snapshot through stable translation record IDs. The guide contents
link to both campaign walkthroughs, gates and worlds, reference pages, and breeding
tools. On smaller screens, **Browse guide** opens the same contents; Escape closes it.

**Translation wording, latest patch release, gameplay verification, and site
deployment are separate versions.** A newer release label or translation snapshot
does not itself verify that patch's breeding rules or native stats. The original
extraction label records where the tables came from; a separate release-matched
disc check identifies the later patch against which they were verified.

The [world verification record](data/world-verification.json) documents the
campaign script checks. Run `python scripts/verify-world-guide.py --help`
for the disc, release manifest and public text inputs. To reproduce
NPC artwork, run `python scripts/build-npc-sprites.py --help` with the character
research directory and the release-matched disc.

The translation sync also rebuilds each character’s conversations from the
Current column of the public dialogue catalog. The scene groups and source row
IDs are in `scripts/character-dialogue-bindings.json`. For unlabelled speakers,
check the named actor’s talk script in the character research catalog and match
its archive index, text offset and message hash to a transcript occurrence.
Read the full exchange before adding a row. A single actor script may contain
both sides of a conversation, a reward notification or a disguised speaker.
The room and map links on character pages use physical actor placements.

The [gameplay verification record](data/gameplay-verification.json) binds the
checked release to its package and patched-disc hashes and the guide's exact
data hashes. Its coverage includes every ordered breeding outcome, relevant
rule/context code, native stat profiles and skill IDs, and library identity
mappings. It does not reverify encounter coverage, acquisition, or resistance
meanings. Future automatic wording and release updates leave the last gameplay
verification unchanged until another reviewed disc check succeeds. See the
[data provenance documentation](translation-sync.md) for evidence and limits.

Scheduled builds compare their inputs and packaged contents with the last
successful deployment and skip publication when nothing changed. Updated
artifacts are published without committing the refreshed bundle to Git. The live
guide can therefore have newer wording and release metadata than a downloaded
source checkout. Failed validation stops publication and preserves the previous
deployment. Upstream publication and GitHub scheduling delays can extend the
nominal four-hour interval.

## Development and publication

The application uses plain HTML, CSS, and classic JavaScript. Runtime dependencies
and a bundler are not required. Use Node.js 22 for the repository's test and
publication tooling, matching CI.

```sh
npm ci
npx playwright install chromium
npm test
```

`npm run test:unit` tests the shipped logic and data. `npm run test:browser`
tests routing, reference tools, saved progress, responsive layouts, file access,
and service-worker behavior. The publication-upgrade regression exercises a
returning browser with fresh cached assets and an older active worker, followed
by an offline reload.

Use the relevant local tests while iterating, then let PR CI perform the complete
suite. Documentation-only PRs keep a successful required `test` check without
starting a browser job. Other PRs run the complete suite once; main-branch
validation belongs to the publication workflow. CI uses the official Playwright
container with its browsers and system dependencies already installed. Keep its
version aligned with `@playwright/test` in `package.json` and the lockfile.

To refresh the checked-in wording and release-metadata snapshot and prepare a
deployment:

```sh
node scripts/sync-monster-reference.js
npm run test:unit
node scripts/sync-stage-site.js
npm run test:publication
```

For a reproducible public import, supply `--public-revision` with a full public
commit SHA. The sync also supports local source files and a non-writing check;
see [translation sync instructions](translation-sync.md).

Gameplay verification is a separate maintainer task using a local disc matched
to its release manifest. `scripts/verify-patch-gameplay.py` writes only version
identifiers, hashes, and coverage counts; game assets and local paths are not
published. The scheduled workflow does not rebuild or re-extract ROM data.

`sync-stage-site.js` creates **`site-dist/`**, containing only the browser
application. It fingerprints asset URLs and derives the worker cache version
from the packaged contents. **Do not manually bump `CACHE_NAME` for releases.**
When adding a runtime asset, register its route group and matching `sw.js`
`PRECACHE` entry so it is available offline. The source HTML remains usable from
disk; packaging produces the versioned hosted copy.

GitHub Pages must use **GitHub Actions** as its deployment source, with the
`github-pages` environment permitting `main`. Publication checks for changes
before starting a browser job. A public translation update runs the unit checks
and focused browser checks against the packaged site; application, tooling, or
test changes also run the complete suite. Missing or invalid previous-deployment
metadata selects the complete suite. The exact guide commit and public source
revision are pinned throughout validation, and the tested artifact is deployed.
Scripts, test output, local inputs, Git history, and the native extraction
baseline are excluded from the hosted files.

### Foreign masters

The original Japanese executable and the v1.0.73 Current executable have
identical bytes at `0x80050440..0x800509D0` (end exclusive, SHA-256
`d87b94702cdefd6968068906be08c5bb059cf12298c0d29b11f364f400008fd1`).
This is the master selector and its party tests. The prior-floor statistics
at `0x8003F298..0x8003F364` and the destination selector at
`0x8003EB8C..0x8003ED48` also match. Extract the executable as in
`scripts/verify-patch-gameplay.py` and subtract `0x8000F800` from a virtual
address for its file offset.

- Terry’s story bit 2 is “Cleared Class F” in the game’s event list
  (`m_exe_08ed2c`). Compare remaining pickups, total rooms and revealed rooms
  in that order. The two-room branch does not compare how many items were
  taken. Merchant eligibility compares the starting and remaining pickup
  counts and tests 200 steps. The Wizard warp is at `0x800F14C8` in Terry’s
  ordinary-gate overlay. A recorded PS1 run also describes using the map
  reveal and choosing the floor before descending. [Marty’s PS1 route](https://note.com/marty_pad/n/ne34a569b4825)
- For either sibling the selector reads held gold, active party records and
  bag slots. Test status bits 0/1 or current HP at most half maximum, then
  `(total_exp % 1000) % 111 == 0`, then at most ten items without item IDs
  25–28. Each role requires a counter of at least 100. Field movement
  increments it on encounter-enabled steps. PS1 players describe returning
  from a building to the surface of a random key world and give different
  distances. The public guide gives the selector threshold and leaves the
  outer placement distance open. [Firsthand PS1 key-world notes](https://tekeremu.zatunen.com/DragonQuestM1-2/dqm_t-m_1.htm)
- The US/Europe Game Boy **Dragon Warrior Monsters** ROM (SHA-256
  `137a9bd2b0ab83f0547f12560b1bc5392e5412514645d18ac7d79c607902cc01`)
  tests all visited rooms and branches specifically on 16 or 2 at
  `0B:46DA–470D`. Check the pickup and movement writes at `01:5A29–5A65`
  and the additional RNG bit test for roles 4–7 at `16:6266–6289`.
  For the original Wizard’s twenty-floor reward and the level-sum opponent
  table, see the Game Boy player guides. [KurasuSoratobu’s walkthrough, A7](https://gamefaqs.gamespot.com/gbc/197155-dragon-warrior-monsters/faqs/43331) · [Foreign tamer level bands](https://gamefaqs.gamespot.com/gbc/197155-dragon-warrior-monsters/faqs/80057/foreign-tamers)
- Both US **Dragon Warrior Monsters 2** cartridges use the same visitor
  dispatch at `12:764C–765D`. Inspect the Bard (`12:77AC–781D`), Wizard
  (`12:789E–7933`) and meat merchant (`12:7934–797B`). The merchant is
  checked before the Wizard and Bard. His meat IDs are 0x19–1C, his bag
  limit is ten items, and both his and the Bard’s tests require 1,000 G.
  The Wizard’s `73:45D0` handler offers a map for 200 G. Compare SHA-256s
  `8e38a7420ef5239c7196aa4fd4b1499e65db2823e875bbf8241bb2199e766d4e`
  (Cobi) and `fc6809c31ff69c889dee80c5f39f4d8069042a2b4d933edd83d1627c32e013cc` (Tara).
- The independent Game Boy Color **Tara’s Adventure** field notes describe
  repeat Bard encounters in random key worlds using 9,999,999 EXP. The PS1
  player’s farming example sets the EXP digits before reaching the monster’s
  level cap. These are play reports for each version. [Tara’s GBC field triggers and farming notes](https://gamefaqs.gamespot.com/gbc/562719-dragon-warrior-monsters-2-taras-adventure/faqs/78549) · [PS1 EXP setup](https://tekeremu.zatunen.com/DragonQuestM1-2/dqm_t-m_1.htm)

### Verify the map atlas

With Python and Pillow installed, run the decoder against the archived English
v1.0.66 disc and a current-edition target disc with its release manifest.

```sh
python scripts/build-player-atlas.py --baseline-bin v66.bin --bin target.bin --release-manifest manifest.json
```

The default run verifies the checked-in receipt and shipped images. Add
`--write` to regenerate them after reviewing a release. The decoder checks the
native doorway selector, destination entrance, title ordinal, tile bank and
graphic layers for each applicable map. Its baseline pixel digest comes from
the original reference export. To reconstruct the native address index from
that export and the translation catalogs, see `scripts/prepare-atlas-index.py --help`.

### Repository map

| Path | Purpose |
| --- | --- |
| `index.html`, `css/`, `js/` | Application shell, styles, and tool logic |
| `data/breeding-data.js` | Species identities, ordered breeding matrix, and conditional rules |
| `data/monster-reference.js` | Generated current names and monster profile data |
| `data/world-guide.js`, `data/field-guide.js` | Campaign articles, translation references, item records and learning thresholds |
| `data/player-atlas.js`, `maps/` | Named places, individual layouts, doorways and content-addressed map images |
| `scripts/build-player-atlas.py`, `scripts/atlas-native-index.json`, `scripts/atlas-verification.json` | Native atlas decoder, stable map and title addresses, and verified release receipt |
| `js/save-import.js` | Read-only PSX card and Adventure Log decoder |
| `data/monster-baseline.json` | Native extraction records used by the sync and verifier; not a browser asset |
| `data/gameplay-verification.json` | Release-matched gameplay proof, bound to the guide's data and source hashes |
| `data/*sprites.js`, `icons/` | Shipped sprites and application icons |
| `manifest.webmanifest`, `sw.js` | Installation metadata and offline behavior |
| `scripts/sync-monster-reference.js` | Validated import of public wording and latest-release metadata |
| `scripts/sync-verify-native.py` | Optional read-only native-disc verification |
| `scripts/verify-patch-gameplay.py` | Read-only comparison against a release-matched patched disc; emits the gameplay proof |
| `scripts/sync-stage-site.js` | Browser-only publication packaging and cache identities |
| `scripts/update-guide.js` | Change classification, deployment comparison, and pinned publication verification |
| `tests/`, `../.github/workflows/` | Automated checks and publication |

## Interface references

The design draws on target-first lookup, branching exploration, connected monster
pages, and dense recipe tables from [Game8](https://game8.co/games/DQM-Dark-Prince/archives/435994),
[Wizebin](https://dwm2.wizebin.com/), [DWM2 Breed](https://darksair.org/dwm2-breed/),
[Monster Database](https://www.monster-db.com/about.php), and
[Dragon's Den](https://www.woodus.com/den/games/dwm1gbc/breeding-details.php?fam=dragon).
The guide's gameplay data comes from its PSX evidence, with coverage and
verification limits kept explicit.

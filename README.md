# DQM1 & 2 PSX · Breeding & Monster Reference

**[Open the guide](https://dqm-psx.github.io/guide/)** ·
[English translation project](https://dqm-psx.github.io/) ·
[Compare translation editions](https://dqm-psx.github.io/translations/)

Breeding tools and a monster library for the English patch of **Dragon Quest
Monsters 1 & 2 for PlayStation**. The guide uses PSX species identities, breeding
data, and native monster records. Displayed names follow the public translation
export's **Current** edition; older English and Japanese names remain searchable.

## Choose a tool

| Tool | What it does |
| --- | --- |
| [Find a pairing](https://dqm-psx.github.io/guide/#pair-finder) | Look up ordered parents, compare the reversed pairing, inspect special conditions, and copy or share a pairing. |
| [Find parents](https://dqm-psx.github.io/guide/#offspring-finder) | Choose an offspring and filter its parent combinations. Special `+` and two-save recipes appear with their conditions. |
| [Breeding tree](https://dqm-psx.github.io/guide/#breeding-tree) | Explore branching recipes without setting up a team. Change either branch, hide or clear parents, undo edits, and share the selected tree. |
| [Breeding table](https://dqm-psx.github.io/guide/#breeding-table) | Compare a matrix or a recipe list, filter each parent axis and the offspring, enter parent `+` values, swap axes, and inspect results. |
| [Monster library](https://dqm-psx.github.io/guide/#species-index) | Search names and aliases, filter families and favorites, sort the index, and open each monster's profile. |
| [My game](https://dqm-psx.github.io/guide/#team-planner) | Keep DQM1/DQM2 teams, party and farm monsters, saved targets, and breeding plans in your browser. |

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

## Links, names, and saved progress

Routes use stable numeric species IDs, so translation changes do not change a
monster's identity or break saved teams and links. Examples:

- [A pairing](https://dqm-psx.github.io/guide/#pair-finder?a=11&b=99)
- [A monster profile](https://dqm-psx.github.io/guide/#monster?id=11)
- [A breeding-tree target](https://dqm-psx.github.io/guide/#breeding-tree?target=290&context=shrine)

**Copy tree link** includes the chosen recipes and hidden branches. The tree also
saves automatically in this browser. Shared pairing and tree parameters take
precedence over previously saved selections.

Search recognizes current names, abbreviated menu names, Japanese names, and
aliases from the guide and the published translation editions. Numbered forms
retain separate species identities. An alternate name is a search aid; it does
not select that edition's gameplay rules.

All progress is stored locally in the browser; the guide has no account or
server-side roster storage. Use the appropriate export before moving devices or
clearing browser data:

| Data | How to keep or transfer it |
| --- | --- |
| Teams, party/farm entries, favorites, targets, and team plans | **My game → My monsters → Import, export & backup → Export full backup** |
| One team | **Export team**; importing adds a team rather than replacing the roster |
| Independent breeding tree | **Copy tree link**; it is separate from the full team backup |
| Pairing | Copy or bookmark its URL |

Full-backup import previews the replacement and requires confirmation. A failed
import leaves saved data unchanged. Team storage uses document version 2 and
can migrate supported version-1 data; unsupported newer documents are not
overwritten. Export filenames and internal compatibility identifiers are not
the version of the displayed gameplay evidence.

In **Targets & plans**, recipes can use roster entries or requirements marked
available, and each step supports notes and needed/ready/completed status.
Warnings identify an individual roster monster reused by unfinished steps.
Completing a step does not automatically consume its parents or add an offspring.
Each team's targets and plans are included in its full backup.

The guide also remembers reference filters, recent pairings, sprite style, and
the System/Light/Dark theme choice. Full backups include sprite style; reference
filters, recent pairings, and theme stay in the browser. If browser storage is
unavailable, the tools remain usable for the session; export progress or copy
the tree link to retain it.

## Offline use

Open the hosted guide while online and let it finish loading. Its service worker
caches the application for later offline visits. Supported browsers also offer
**Install app** or **Add to Home Screen**. Installation is optional.

Online requests revalidate cached content. Published scripts, stylesheets, and
icons use content-hash URLs, and the offline cache uses the same URLs. A returning
browser can therefore load a new deployment even while an older worker is still
active. Revisit or reload an open tab to receive updates; an offline copy keeps
its last downloaded snapshot.

For a downloaded checkout, open `index.html` directly. Its data and scripts load
from local files without a server, network connection, or service worker.
Relative paths also support static hosting under a project subpath such as
`/guide/`.

## Translation updates and source evidence

The [publication workflow](.github/workflows/publish-guide.yml) runs on pushes to
`main`, manually, and every four hours. It reads the public
[translation export](https://github.com/dqm-psx/translations), pins both source
files to one commit, validates their hashes and identities, and refreshes monster
names, library text, skill names, encounter labels, and the latest published
patch's release metadata. The upstream publisher updates that release metadata
when a stable patch release is published or edited. The guide needs no
private-repository access or additional repository secret.

**Translation wording, latest patch release, gameplay verification, and site
deployment are separate versions.** A newer release label or translation snapshot
does not itself verify that patch's breeding rules or native stats. The original
extraction label records where the tables came from; a separate release-matched
disc check identifies the later patch against which they were verified.

The [gameplay verification record](data/gameplay-verification.json) binds the
checked release to its package and patched-disc hashes and the guide's exact
data hashes. Its coverage includes every ordered breeding outcome, relevant
rule/context code, native stat profiles and skill IDs, and library identity
mappings. It does not reverify encounter coverage, acquisition, or resistance
meanings. Future automatic wording and release updates leave the last gameplay
verification unchanged until another reviewed disc check succeeds. See the
[data provenance documentation](docs/translation-sync.md) for evidence and limits.

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
see [translation sync instructions](docs/translation-sync.md).

Gameplay verification is a separate maintainer task using a local disc matched
to its release manifest. `scripts/verify-patch-gameplay.py` writes only version
identifiers, hashes, and coverage counts; game assets and local paths are not
published. The scheduled workflow does not rebuild or re-extract ROM data.

`sync-stage-site.js` creates **`site-dist/`**, containing only the browser
application. It fingerprints asset URLs and derives the worker cache version
from the packaged contents. **Do not manually bump `CACHE_NAME` for releases.**
When adding a runtime asset, add its page reference and matching `sw.js`
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

### Repository map

| Path | Purpose |
| --- | --- |
| `index.html`, `css/`, `js/` | Application shell, styles, and tool logic |
| `data/breeding-data.js` | Species identities, ordered breeding matrix, and conditional rules |
| `data/monster-reference.js` | Generated current names and monster profile data |
| `data/monster-baseline.json` | Native extraction records used by the sync and verifier; not a browser asset |
| `data/gameplay-verification.json` | Release-matched gameplay proof, bound to the guide's data and source hashes |
| `data/*sprites.js`, `icons/` | Shipped sprites and application icons |
| `manifest.webmanifest`, `sw.js` | Installation metadata and offline behavior |
| `scripts/sync-monster-reference.js` | Validated import of public wording and latest-release metadata |
| `scripts/sync-verify-native.py` | Optional read-only native-disc verification |
| `scripts/verify-patch-gameplay.py` | Read-only comparison against a release-matched patched disc; emits the gameplay proof |
| `scripts/sync-stage-site.js` | Browser-only publication packaging and cache identities |
| `scripts/update-guide.js` | Change classification, deployment comparison, and pinned publication verification |
| `tests/`, `.github/workflows/` | Automated checks and publication |

## Interface references

The design draws on target-first lookup, branching exploration, connected monster
pages, and dense recipe tables from [Game8](https://game8.co/games/DQM-Dark-Prince/archives/435994),
[Wizebin](https://dwm2.wizebin.com/), [DWM2 Breed](https://darksair.org/dwm2-breed/),
[Monster Database](https://www.monster-db.com/about.php), and
[Dragon's Den](https://www.woodus.com/den/games/dwm1gbc/breeding-details.php?fam=dragon).
The guide's gameplay data comes from its PSX evidence, with coverage and
verification limits kept explicit.

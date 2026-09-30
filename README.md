# DQM Breeding Guide

Interactive breeding reference for Dragon Quest Monsters 1 & 2 (PS1), built as a
single page that also works as plain files.

## Open it

- **From disk:** open `index.html` in a browser. No server or network needed.
- **From a static server:** serve the repository root with any static file
  server. Every asset path is relative, so the page works from a subpath such
  as `https://example.com/guide/` as well as from the site root.

## Layout

```
index.html              page markup, <link> and <script src> only
css/guide.css           base styles
css/features.css        reference tools, sticky nav, and layout styles
css/dark-mode.css       dark theme overrides
data/                   breeding data and sprite maps as classic scripts
  breeding-data.js        assigns globalThis.DATA
  monster-sprites.js      assigns globalThis.MONSTER_SPRITES
  overworld-sprites.js    assigns globalThis.OVERWORLD_SPRITES
js/                     page scripts, loaded in order by index.html
  sprites.js  storage.js  session.js  reference.js  planner-core.js
  recipe-planner.js  app-state.js  planner-ui.js  router.js  theme.js
tests/                  test tooling (not part of the shipped page)
```

The data and scripts are plain classic scripts, so the page runs from `file://`
with no build step, no service worker, and no `fetch()` for its own data.

## Views

The page is five task views behind a hash route, and the URL says which one is
open: `#pair-finder` (the default), `#offspring-finder`, `#species-index`,
`#team-planner` (My game), and `#rules-guide`. An empty or unknown hash opens
Find a pairing. All five views stay in the page, so a view keeps its filters,
selections, and planner tab when you come back to it, and printing the page
prints only the view you are looking at. The older `#conditional-rules` and
`#about` links still open their headings inside Rules & guide.

## Share a pairing and keep your place

Find a pairing writes the selected parents into the URL with stable species
IDs, so a link such as `#pair-finder?a=11&b=99` opens the same result. A shared
URL takes precedence over anything saved locally. The guide also remembers the
pair finder's parents, name filters, desired offspring, and a short list of
recently inspected pairs across reloads, so closing the tab does not lose your
place. The name index can send a species straight to either parent slot or to
Find parents, and a pairing result links to the offspring's other parent
combinations.

## Night mode

The page follows your system light/dark preference by default. A **Theme**
picker in the masthead chooses **System**, **Light**, or **Dark**; the choice
is remembered and applied before the first paint, so a dark choice never
flashes light.

## Saved data

Teams, rosters, favorites, targets, plans, the game switch, the sprite style,
the theme choice, and the reference session (pair finder parents, filters,
desired offspring, and recent pairings) are stored **only in this browser**
(localStorage). They never leave the device unless you export them. Teams,
plans, favorites, and targets live in the version-2 document below; the theme
and reference session use their own small keys. If browser storage is
unavailable or full, the page keeps working for the session and shows a
banner; use the backup export to keep your data.

The saved document is **version 2**. It records which game you are viewing, and
each team carries its own game plus a location (`party` or `farm`) on every
monster:

```js
{
  version: 2,
  activeGame: 'dqm1',            // which game the view is showing
  teams: [{
    game: 'dqm2',                // 'dqm1' | 'dqm2' | null when unassigned
    entries: [{ speciesIndex: 11, sex: 'male', plus: 0, location: 'farm' }],
  }],
}
```

A version-1 document still loads: its teams become unassigned, its monsters
become party monsters, and the migrated document is written back on your next
save. A team imported from a file also starts unassigned, so you choose which
game it belongs to. A document written by a newer build is never read or
overwritten.

- **Export team** downloads the active team in the legacy team format.
- **Export full backup** downloads the complete document — every team, roster,
  favorite, target, and plan — as `DQM-guide-backup-v61.json`.
- **Import full backup** previews the team and target counts and replaces your
  saved data only when you confirm. A failed import leaves your data unchanged.
- **Import team** adds the file as a new named team instead of replacing your
  roster. Dropping a full backup there also works (preview + replace).

On first load, a previously saved team and sprite style are migrated into the
new document; the old storage keys are left untouched. If the saved document
was written by a newer version or cannot be read, it is never overwritten — the
banner explains the situation and offers a download or a fresh start.

## Breeding plans

Pin an offspring in **Find parents** to save it as a target, then build its
breeding plan in the **Targets & plans** tab of **My game**. Each team keeps
its own targets and plans.

- **Suggested recipes** are ranked by the species already in your roster, then
  by fewer missing parents. They are a suggestion, not a guarantee of
  playability or of the shortest route.
- Choose a recipe to expand an ordered **Pedigree + Mate** pair into child
  requirements. Each requirement can link to a matching roster entry, be marked
  available without a link, or expand through another recipe. Roster matches are
  hints and never change a requirement's status.
- Track each requirement as **needed**, **ready**, or **completed**, and add a
  note. Completing a step does not consume parents or add an offspring; those
  stay explicit. If one roster entry is needed by two unfinished steps, the plan
  warns you that breeding consumes parents.
- Pick the **Ordinary shrine** or **Two-save Breeding room** context. Verified
  `+` rules apply in the shrine; title-screen Breeding room overrides appear only
  in the room context. Switching context flags a recipe that no longer applies
  instead of deleting your notes or progress.
- The plan never claims to establish acquisition, offspring sex, inherited `+`
  value, or breeding eligibility, and an unknown `+` value is not treated as
  zero. Replacements are warned and can be undone.

Plans are saved per target and are included in the full backup.

## Games and farm

The **My game** view holds a DQM1/DQM2 switch. A team is filed under one game,
and because farms, saved targets, and plans all live under a team, each game
keeps its own of all four. Every monster is marked **Party** or **Farm**;
moving one is a single-field change, so its nickname, sex, `+` value, and
favorite are preserved by construction. The team breeding grid shows party
monsters, and **Include farm monsters** adds the rest, tagged in the row and
column headers. Suggested recipes count party and farm monsters alike as owned
and say where each roster parent is. The breeding table, the rules, and the
data bundle are shared between the two games; only your saved data is split.

## Test

```
npm install
npm test
```

`npm test` runs the unit tests (`npm run test:unit`) and the browser flows
(`npm run test:browser`). The browser suite opens `index.html` both as a local
`file://` file and from a static server mounted at `/guide/`, and checks that
the page makes no external requests. Test dependencies and test output stay out
of the shipped page.

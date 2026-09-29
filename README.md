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
css/guide.css           all styles
data/                   breeding data and sprite maps as classic scripts
  breeding-data.js        assigns globalThis.DATA
  monster-sprites.js      assigns globalThis.MONSTER_SPRITES
  overworld-sprites.js    assigns globalThis.OVERWORLD_SPRITES
js/                     page scripts, loaded in order by index.html
  sprites.js  reference.js  planner-core.js  app-state.js  storage.js  planner-ui.js
tests/                  test tooling (not part of the shipped page)
```

The data and scripts are plain classic scripts, so the page runs from `file://`
with no build step, no service worker, and no `fetch()` for its own data.

## Saved data

Teams, rosters, favorites, targets, plans, and the sprite style are stored
**only in this browser** (localStorage). They never leave the device unless you
export them. If browser storage is unavailable or full, the page keeps working
for the session and shows a banner; use the backup export to keep your data.

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

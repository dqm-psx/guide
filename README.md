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
  sprites.js  reference.js  planner-core.js  planner-ui.js
tests/                  test tooling (not part of the shipped page)
```

The data and scripts are plain classic scripts, so the page runs from `file://`
with no build step, no service worker, and no `fetch()` for its own data.

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

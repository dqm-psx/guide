# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
No released versions yet (`package.json` remains `1.0.0`); everything below is
unreleased work-in-progress validated with `npm test` (98 unit + 265 browser).

## [Unreleased]

### Added — task views (Phase 1)

- Five hash-routed task views: Find a pairing (`#pair-finder`), Find parents
  (`#offspring-finder`), Name index (`#species-index`), My game
  (`#team-planner`), Rules & guide (`#rules-guide`).
- New classic script `js/router.js` (no build step, `file://` compatible) owning
  hash parsing, single-view visibility, active nav (`aria-current="page"`),
  page title, scroll, and focus. Exposes `DQMViews.go(view, { focusId })` for
  cross-view handoffs, including same-view clicks.
- Legacy hashes `#conditional-rules` and `#about` open Rules & guide;
  empty/unknown hashes open Find a pairing.
- Targets & plans tab in My game holding the saved target list
  (`#target-list`) and breeding plan (`#plan-panel`) with DOM IDs unchanged.
- “View plan” path after pinning a target and “Open active target in
  Find parents” path back.
- New suite `tests/browser/views.spec.js` (single-view, titles, focus,
  `go()`, legacy/unknown hashes, skip link, keyboard, narrow-width nav,
  print-active-view-only).

### Added — DQM1/DQM2 games and party/farm (Phase 2)

- DQM1/DQM2 switch in My game (`#planner-game-dqm1` / `#planner-game-dqm2`).
  Teams carry `game: 'dqm1' | 'dqm2' | null`; entries carry
  `location: 'party' | 'farm'`. Document gains `activeGame`.
- Team dropdown grouped into active-game teams then Unassigned teams; team
  game assignment via `#planner-team-game` plus `#planner-team-game-hint`.
- Roster split into Party/Farm subsections per sex with move buttons
  (`Move to party/farm`); moving preserves nickname, sex, + value, favorite.
  Location radios (`#planner-location-party` / `#planner-location-farm`) on
  add/edit; team summary shows party/farm counts.
- Team breeding grid shows party only by default with
  `#planner-breeding-include-farm` opt-in (farm rows/columns tagged
  `.planner-farm-tag`). Recipe suggestions count both locations as owned and
  badge each roster parent (`Pedigree/Mate in party/farm`). Plan roster-link
  options suffix farm monsters with ` (Farm)`.
- New suite `tests/browser/game.spec.js` (switch filtering, migration,
  assignment, moves, grid toggle, suggestion badges, backup round-trip).

### Added — reference session, sharing, and dark mode

- **Dark mode.** New `js/theme.js` and `css/dark-mode.css`. The page follows
  `prefers-color-scheme` by default and adds a masthead System / Light / Dark
  picker (`button[data-theme-choice]`). The choice is persisted under
  `dqm-guide-theme-v1`, applied by an inline head bootstrap before first paint
  so a dark choice never flashes light, and re-resolved when the system
  preference changes while System is selected. `<meta name="theme-color">`
  follows the resolved theme, so the browser chrome and an installed copy match
  Light or Dark. It is separate from the saved document, so backups are
  unchanged.
- **Shareable pairings.** Find a pairing mirrors its selected parents into the
  URL with stable species IDs (`#pair-finder?a=11&b=99`). A shared URL takes
  precedence over the saved session, so a link opens the same result even in a
  browser that has another pair saved. The pair is written with
  `history.replaceState` only while Find a pairing is open, so handoffs still
  land on a bare `#pair-finder`.
- **Reference session.** New `js/session.js` remembers the pair finder's
  parents, name/family filters, desired offspring, `show-internal`, and recent
  pairings across reloads under `dqm-guide-reference-session-v1`, alongside
  the saved teams and plans. The shared-URL rule above wins when both exist.
- **Recent pairings.** A short, persisted history under the pair panel lists
  the last few inspected pairs; each one reopens that pair with a click.
- **Copy pairing.** A readable line for chat or a forum, e.g.
  `Pedigree Slime + Mate Dracky → Winged Slime (base result; + rule gives
  Spotted King at +4)`. It names any conditional rule that may change the
  outcome; available on the pair result and the My game pair detail.
- **Cross-tool actions.** Name-index rows add **Use as pedigree**, **Use as
  mate**, and **Find parents**; each pairing result links to the offspring's
  other parent combinations in Find parents.
- **Conditional recipes in Find parents.** Confirmed + value and title-screen
  Breeding room recipes now appear in clearly labeled groups
  (`.reverse-group`) beside the base table pairs, so a search for an offspring
  finds every documented way to produce it.
- **Empty-result recovery.** A filter that yields no monsters or pairs shows
  the active filters as chips and a **Clear filters** action.
- **Sticky main navigation.** The nav pins to the viewport top, active style
  follows the visible view, and anchor jumps reserve `scroll-margin-top` so
  headings stay visible beneath it.
- **Matrix labels.** The wide breeding grids keep their pedigree row and mate
  column labels pinned and opaque above the cells while the body scrolls, so
  each intersection stays readable; covered by a regression test.
- **My game switch filing.** While the active team is unassigned (the default
  for new and migrated saves, kept visible under both games), a compact
  **File under DQM1/DQM2** action appears beside the switch. One click files
  the team and its party and stabled (farm) monsters under the viewed game.

### Added — installable, offline copy

- New `sw.js` service worker and `manifest.webmanifest`. On GitHub Pages the
  page is now installable (**Add to Home Screen** / **Install app**) and an
  installed or previously visited copy opens with no network. The worker caches
  every shipped asset on first load and serves network-first, cache-fallback, so
  online loads stay current and offline loads come from the cache. `CACHE_NAME`
  is bumped only when `sw.js` changes; content-only edits refresh on the next
  online load. Every path is scope-relative, so an install under a repo subpath
  scopes to that subpath.
- New `js/offline.js` registers the worker. It is guarded and skipped on
  `file://` and insecure contexts, so the page still opens straight from disk
  with no worker.
- App icons in `icons/` built from the shipped Slime portrait sprite (looked up
  by name, not a hardcoded index) on the guide's teal, nearest-neighbor scaled
  to keep the pixel art crisp, plus the `apple-mobile-web-app-*` metadata for
  iOS.
- New `scripts/make-icons.js` regenerates the icons from `data/monster-sprites.js`
  (test tooling, not a build step; the PNGs are committed).
- New suite `tests/browser/service-worker.spec.js` (served manifest/worker, and
  a reload with the network cut that asserts `response.fromServiceWorker()`)
  and `tests/unit/offline-assets.test.js` (precache list matches the files on
  disk and every asset `index.html` loads).

### Changed

- Saved document and team files are now version 2 (`APP_VERSION`,
  `STATE_VERSION`). Storage key (`dqm-guide-state-v61-v1`) and backup/team
  filenames unchanged.
- Migration is lazy (applied on next save, never on load): missing team
  `game` → `null` (unassigned, visible under both games), missing entry
  `location` → `'party'`, missing `activeGame` → `'dqm1'`. Version 1 backups
  and team files still import; version 3+ files are rejected as `newer`.
- Nav labels generalized (`Team planner` → `My game`); nav separators moved
  from `&nbsp;` to CSS `gap`; active style renamed
  `.planner-nav-active` → `.nav-link-active`.
- Skip link now reads “Skip to main content” and targets the visible view.
- “Try pair”, “Open in pair finder”, and “Open active target” route through
  `DQMViews.go` after setting selections.
- README documents the five views, the version-2 saved shape, and a
  “Games and farm” section.
- `index.html` loads `css/features.css` and then `css/dark-mode.css` after
  `css/guide.css`, and `js/storage.js` + `js/session.js` before
  `js/reference.js`; `js/theme.js` loads after the page scripts and
  `js/offline.js` loads last. An inline head script applies the saved theme
  before first paint. The head also links `manifest.webmanifest`, the PNG
  icons, and a `theme-color` meta.
- `DQMViews.go` normalizes a handoff to the bare view id, so a parameterised
  hash for the same view does not read as “already here”.
- The keyboard tab-order assertion in `views.spec.js` now tabs through the
  masthead theme picker before reaching the nav instead of counting three
  presses.

### Fixed

- Handoffs and focus no longer land inside hidden views; same-destination
  handoffs re-render and focus correctly.
- Narrow (320 px) nav wraps without horizontal scroll; print shows only the
  active view; Rules & guide opens with its explanation even when the
  conditional-rules list is empty.
- Stale `state.spec.js` team-order assertions updated for optgroup ordering;
  `reference`/`targets`/`plan` specs updated for view-aware navigation.
- A shared pairing URL is no longer dropped by a “Try pair” handoff; the
  saved reference session and the URL stay out of each other's way.
- The DQM1/DQM2 switch is no longer a dead end for an unassigned team: the
  hint stays, and one click files the team and its stabled monsters.

### Fixed — review follow-ups (review of `e0d7038`)

- Deleting a game's last team now follows the surviving team's game, so the
  game switch and team dropdown never disagree about the active roster.
- Service-worker activation deletes only caches this installation owns (a
  prefix scoped to the worker's path), leaving another project on the same
  origin untouched.
- Parameterised routes (`#pair-finder?a=&b=`, `#offspring-finder?target=`) are
  re-applied on same-document navigation, Back, and Forward, not only at load.
- Pairings chosen on the bare homepage now mirror into a shareable URL.
- A shared link can select an internal-slot monster even when the recipient's
  saved visibility filter would hide it.
- Reload preserves compatible saved parent-search filters instead of resetting
  them, while a shared link still selects its requested monsters.
- `toJSON` refuses a document larger than the import limit, so an accepted save
  can always be read back; persistence and export surface the failure.
- Storage acquisition tolerates a `localStorage` property that throws, keeping
  the documented usable, unsaved session.

### Verification

- `npm run test:unit` — 98 passed, including `offline-assets.test.js`.
- `npx playwright test` — 265 passed (`file://` + server dual-mode),
  including `views.spec.js`, `game.spec.js`, `theme.spec.js`,
  `layout.spec.js`, `reference-tools.spec.js` (adds shareable bare-homepage
  pairings, hash/Back/Forward parameters, a shared internal-slot pairing, and a
  reload that keeps saved filters), and `service-worker.spec.js` (offline
  reload served by the worker, plus activation leaving other caches alone).
- Breeding reference (`data/`, matrix, rules, bundle `GAME_ID`) unchanged.

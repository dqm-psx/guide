# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
No released versions yet (`package.json` remains `1.0.0`); everything below is
unreleased work-in-progress validated with `npm test` (90 unit + 214 browser).

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

### Fixed

- Handoffs and focus no longer land inside hidden views; same-destination
  handoffs re-render and focus correctly.
- Narrow (320 px) nav wraps without horizontal scroll; print shows only the
  active view; Rules & guide opens with its explanation even when the
  conditional-rules list is empty.
- Stale `state.spec.js` team-order assertions updated for optgroup ordering;
  `reference`/`targets`/`plan` specs updated for view-aware navigation.

### Verification

- `npm run test:unit` — 90 passed.
- `npx playwright test` — 214 passed (`file://` + server dual-mode),
  including `views.spec.js` and `game.spec.js`.
- Breeding reference (`data/`, matrix, rules, bundle `GAME_ID`) unchanged.

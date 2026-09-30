# Plan: task views, then DQM1/DQM2 games with party and farm

## Goal

Two phases, landed in order:

1. **Phase 1 — task views.** Replace the long scrolling guide with five task views while keeping `index.html` usable from `file://`, without a build step or a routing library. Keep the current breeding data and saved data format. This phase covers navigation and the placement of existing tools.
2. **Phase 2 — games and locations.** Split the planner's saved data by game (DQM1 / DQM2) and give every saved monster a Party or Farm location. This phase changes the saved document schema and the planner UI; it does not change the breeding reference data.

Phase 2 assumes Phase 1 has landed. Where a Phase 2 step touches markup that Phase 1 moved (the saved target list and `plan-panel` live in a Targets & plans tab by then), apply the change wherever the element with that ID now lives — IDs do not change in either phase.

---

# Phase 1 — task views

## View map

| Navigation label | View ID and URL | Contents |
| --- | --- | --- |
| Find a pairing | `pair-finder`, `#pair-finder` | Parent pickers and both ordered results |
| Find parents | `offspring-finder`, `#offspring-finder` | Offspring lookup, parent pairs, and a save-target action |
| Name index | `species-index`, `#species-index` | Searchable species table |
| Team planner | `team-planner`, `#team-planner` | Roster, saved targets, breeding plan, and grids |
| Rules & guide | `rules-guide`, `#rules-guide` | Conditional rules and table explanation |

Keep `#conditional-rules` and `#about` as links to their headings inside Rules & guide. Keep the other existing hashes unchanged. An empty or unknown hash opens Find a pairing. Phase 2 renames Team planner to My game (see the Phase 2 rename step), so the label matches what the view contains.

## Design

Add one classic `js/router.js` script after `planner-ui.js`. It owns hash parsing, visibility, active navigation, page title, scroll position, and navigation focus. It does not own species selections, team data, or planner tabs. All views stay mounted in the DOM, so their controls and in-memory state survive a view switch.

The router exposes one action for cross-view handoffs:

```js
DQMViews.go("pair-finder", { focusId: "result-name" });
```

`go` handles a changed hash and a repeated click on the current hash. A single renderer handles initial load, `hashchange`, Back, and Forward. It reveals the destination before scrolling or focusing it. For a normal nav anchor click, reveal the destination synchronously before the browser follows the anchor. Set `aria-current="page"` on the active nav link and remove it from the others. Focus a view heading after a user-initiated view switch; do not take focus on initial load. The skip link must reach the visible main view.

The URL hash is the source of truth for the active view. Pair selections, filters, and the planner tab remain in their current owners. Encoding those choices in shareable URLs is a separate improvement, but route parsing should leave room for parameters after the view ID.

## Implementation sequence

1. **Create the view boundaries.** Mark the pair finder, parent finder, name index, and planner as views. Wrap Conditional results and Read the table in a Rules & guide view while retaining their existing IDs. Start with only Find a pairing visible. Update the nav labels and replace its `&nbsp;` separators with CSS `gap`.
2. **Add the router.** Parse only known view IDs and the two legacy aliases. Show exactly one view, update nav state and title, and handle direct links, unknown hashes, Back, Forward, and same-view clicks. Remove the planner-only `route()` and nav visibility handler from `planner-ui.js` so there is one owner of visibility.
3. **Update handoffs.** Route “Try pair,” “Open in pair finder,” and “Open active target” through `DQMViews.go` after setting their existing selections. Replace the one-shot `hashchange` listener used by “Open active target.” Each handoff must work when its destination is already open. Focus the result or destination heading after navigation.
4. **Move planner controls.** Keep “Pin current offspring” beside the offspring selector. Move the saved target list and `plan-panel` from Find parents into a Targets & plans tab in Team planner. Preserve their DOM IDs and saved data. Add a “View plan” path after pinning a target and a path back to Find parents to choose another target. Update text that describes another view as “above” or “below.”
5. **Finish view behavior.** Generalize the active nav style, keep the nav usable at narrow widths, and ensure hidden views do not appear on screen. Print the active view only. If there are no conditional rules, Rules & guide still opens with the explanation section.

## Acceptance

- Opening `index.html` directly from disk shows one view and requires no network request.
- Each nav choice, direct hash, reload, Back, and Forward shows the intended view with the correct active link and title.
- Existing `#team-planner`, `#conditional-rules`, and `#about` links still work. Unknown hashes show Find a pairing without a blank screen.
- “Try pair,” “Open in pair finder,” and “Open active target” retain the chosen monsters or target, including when the destination view is already open.
- The saved target list and plan work after moving into Team planner. Existing saved teams, targets, plans, favorites, and backup files retain their data.
- Keyboard focus reaches the revealed heading or result after an action; it never lands inside a hidden view. The skip link and nav work with a keyboard.
- Narrow screens and print show the intended content without exposing hidden views.

## Design decision

A dedicated classic router script gives navigation one owner as the site grows. Extending the current planner-only route would touch fewer files, but it would leave general site navigation inside planner code. Native anchors remain in the nav, with the destination revealed before their default scroll. Keeping all views mounted avoids rewriting the existing reference and planner controllers.

---

# Phase 2 — DQM1/DQM2 games and party/farm locations

## Current model and its limit

The planner uses one bundled game ID (`GAME_ID = 'dqm1-2-ps1-v61'` in `js/app-state.js` and `js/planner-core.js`), and each saved team has one flat monster list (`team.entries`). It cannot distinguish which game a team belongs to, or whether a monster is in the party or on the farm.

## Target model

- A **DQM1/DQM2 switch** in the planner view (renamed **My game**) selects the active game. Teams, and through them farms, saved targets, and breeding plans, are separate per game because they all live under teams.
- Each **team** has a `game`: `'dqm1'`, `'dqm2'`, or `null` (unassigned). Existing saved teams migrate to `null` and stay unassigned until the player chooses a game. Unassigned teams are visible under both games so migrated data is never hidden.
- Each **monster entry** has a `location`: `'party'` or `'farm'`. Moving a monster between party and farm is a one-field update, so its nickname, sex, + value, and favorite are preserved by construction.
- **Recipe suggestions** count monsters in both locations as owned and show where each roster parent is (party or farm).
- The **team breeding grid** shows party monsters by default, with an “Include farm monsters” option; included farm monsters are tagged.
- **Backup import and export** preserve the new `game` and `location` fields. Version-1 backups and team files still import.
- The **breeding reference stays shared**: `data/`, the matrix, the rules, and the document's bundle `game` field (`dqm1-2-ps1-v61`) are untouched. Game-specific availability or recipes are only added later, if verified data supports them.

## Saved document schema (version 2)

```js
{
  version: 2,                          // was 1
  game: 'dqm1-2-ps1-v61',              // unchanged data-bundle ID
  activeGame: 'dqm1',                  // NEW: 'dqm1' | 'dqm2', switch position
  spriteStyle: 'portrait',             // unchanged, shared across games
  favoriteSpeciesIndices: [],          // unchanged, shared across games
  activeTeamId: 't-…',                 // unchanged
  teams: [{
    id: 't-…',
    name: 'My team',
    game: null,                        // NEW: 'dqm1' | 'dqm2' | null (unassigned)
    entries: [{
      id: 'm-…', speciesIndex: 11, sex: 'male', plus: 0, nickname: '',
      favorite: false,
      location: 'party'                // NEW: 'party' | 'farm'
    }],
    activeTargetId: null,
    targets: [{ id: 't-…', speciesIndex: 11, plan: null }]   // unchanged
  }]
}
```

Migration rules (all in `js/app-state.js`):

- `APP_VERSION` becomes `2`. `normalizeDocument` accepts version `1` and `2`; anything above `2` fails with code `'newer'` as today. Output is always stamped version `2`.
- A missing team `game` (every version-1 document) becomes `null`. A missing entry `location` becomes `'party'`. A missing `activeGame` becomes `'dqm1'`. Invalid present values fail with code `'invalid'`.
- **Do not change `STORAGE_KEY`** (`'dqm-guide-state-v61-v1'`). The key must stay so existing saves are found; the document's internal `version` field drives migration. Migration is lazy: the migrated document is written back on the next save, never on load.
- Keep the backup filename `DQM-guide-backup-v61.json` and the team filename `DQM-guide-team-v61.json` unchanged.

## `js/app-state.js` changes

Add constants next to the existing ones, and export them from both the instance and the module (mirroring how `SPRITE_STYLES` is exposed):

```js
const TEAM_GAMES = Object.freeze(['dqm1', 'dqm2']);
const ENTRY_LOCATIONS = Object.freeze(['party', 'farm']);
const DEFAULT_GAME = 'dqm1';
```

Add `'activeGame'` to `DOCUMENT_KEYS`, `'game'` to `TEAM_KEYS`, and `'location'` to `ENTRY_KEYS`.

Add three validators inside `create()`:

```js
function teamGameOrNull(value, label) {
  if (value === undefined || value === null) return null;
  if (!TEAM_GAMES.includes(value)) {
    fail('invalid', label + ' game must be dqm1, dqm2, or null for an unassigned team.');
  }
  return value;
}

function entryLocation(value, label) {
  if (value === undefined) return 'party';
  if (!ENTRY_LOCATIONS.includes(value)) {
    fail('invalid', label + ' location must be party or farm.');
  }
  return value;
}

function documentGame(value) {
  if (value === undefined) return DEFAULT_GAME;
  if (!TEAM_GAMES.includes(value)) fail('invalid', 'The active game must be dqm1 or dqm2.');
  return value;
}
```

Wire them in:

- `validateEntries`: in the final `map`, add `const location = entryLocation(raw.location, label);` and return `{ ...extraKeys(raw, ENTRY_KEYS), ...entry, favorite, location }`.
- `normalizeTeam`: add `const game = teamGameOrNull(team.game, label);` and include `game` in the returned team (between `name` and `entries`).
- `normalizeDocument`: change the version check to `if (input.version !== 1 && input.version !== APP_VERSION) fail('invalid', 'Unsupported document version. Expected 1 or ' + APP_VERSION + '.');`, compute `const activeGame = documentGame(input.activeGame);`, and include `activeGame` in the returned document (after `game`).
- `defaultState`: the starter team gets `game: null`; the document gets `activeGame: DEFAULT_GAME`.
- `teamFromLegacy`: accept version `1` or `2` team files (same check shape as `normalizeDocument`), and add `game: null` to the returned team literal for readability — imported teams start unassigned. `validateEntries` already defaults each entry's `location` to `'party'`.
- `addTeam`: the new team literal gets `game: state.activeGame` (a team created while viewing a game belongs to it).
- `deleteTeam`: when the deleted team was active, fall back to the first remaining team visible under the active game, then the first team overall:

```js
if (activeTeamId === teamId) {
  const fallback = teams.find(t => t.game === state.activeGame || t.game === null) || teams[0];
  activeTeamId = fallback ? fallback.id : null;
}
```

  In the no-teams-left branch, the fresh team gets `game: state.activeGame`.

Add two actions and export them from the instance:

```js
function setActiveGame(state, game) {
  if (!TEAM_GAMES.includes(game)) fail('invalid', 'The active game must be dqm1 or dqm2.');
  if (game === state.activeGame) return { ...state };
  const visible = team => team.game === game || team.game === null;
  let next = { ...state, activeGame: game };
  const active = findTeam(next, next.activeTeamId);
  if (active && visible(active)) return next;
  const candidate = next.teams.find(visible);
  if (candidate) return { ...next, activeTeamId: candidate.id };
  if (next.teams.length >= MAX_TEAMS) fail('limit', 'A document can hold at most ' + MAX_TEAMS + ' teams.');
  const team = { id: makeId('t-'), name: DEFAULT_TEAM_NAME, game, entries: [], activeTargetId: null, targets: [] };
  return { ...next, teams: [...next.teams, team], activeTeamId: team.id };
}

function setTeamGame(state, teamId, game) {
  const index = teamIndex(state, teamId);
  if (index === -1) fail('invalid', 'The team was not found.');
  if (game !== null && !TEAM_GAMES.includes(game)) fail('invalid', 'Team game must be dqm1, dqm2, or null.');
  let next = withTeam(state, teamId, { game });
  if (state.activeTeamId === teamId && game !== null && game !== next.activeGame) {
    next = { ...next, activeGame: game };
  }
  return next;
}
```

`setActiveGame` keeps the active team if it is visible under the new game (matching or unassigned), otherwise activates the first visible team, otherwise creates a fresh team for that game — the “a document always has an active team” invariant holds without an empty-state screen. `setTeamGame` makes the switch follow the active team's assignment, so the active team never disappears from the filtered dropdown.

No new entry action is needed: moving a monster is `app.updateEntry(state, teamId, entryId, { location: 'farm' })`, which revalidates and preserves every other field.

## `js/planner-core.js` changes

One change only: `STATE_VERSION` becomes `2`, and `normalizeState` accepts version `1` or `2`:

```js
if (!record(input) || !own(input, 'version') || (input.version !== 1 && input.version !== STATE_VERSION)) {
  throw new Error('Unsupported team file. Expected version 1 or ' + STATE_VERSION + '.');
}
```

The core entry shape (`id`, `speciesIndex`, `sex`, `plus`, `nickname`) is unchanged. `location` is an app-level field: the core tolerates it as an extra key and drops it from its own output; `app-state`'s `validateEntries` re-attaches and validates it. Do not add location handling to `planner-core.js` or `recipe-planner.js`.

## `index.html` changes

All inside the planner view (`#team-planner`). Element IDs are exact; add them verbatim.

1. **Game switch**, in the planner `.section-head` before the sprite-style picker, mirroring the sprite picker's markup:

```html
<div class="planner-game-switch" role="group" aria-label="Game"><span>Game</span><div class="planner-game-options"><button id="planner-game-dqm1" type="button" data-game="dqm1" aria-pressed="true">DQM1</button><button id="planner-game-dqm2" type="button" data-game="dqm2" aria-pressed="false">DQM2</button></div></div>
```

2. **Team game select**, in `.planner-team-bar` after the Active team field, plus a hint after the bar:

```html
<div class="field planner-team-game-field"><label for="planner-team-game">Team game</label><select id="planner-team-game"><option value="">Unassigned</option><option value="dqm1">DQM1</option><option value="dqm2">DQM2</option></select></div>
```

```html
<p id="planner-team-game-hint" class="hint" hidden>This team is not assigned to a game. Choose DQM1 or DQM2 to file it under a game.</p>
```

3. **Location radios**, in the add-a-monster form after the sex fieldset, mirroring its structure:

```html
<fieldset class="planner-location-field"><legend>Location</legend><div class="planner-location-options"><label for="planner-location-party"><input id="planner-location-party" type="radio" name="planner-location" value="party" checked> Party</label><label for="planner-location-farm"><input id="planner-location-farm" type="radio" name="planner-location" value="farm"> Farm</label></div></fieldset>
```

4. **Farm toggle**, in the Team breeding tab's `.planner-controls` after the offspring search field:

```html
<label class="settings-inline"><input id="planner-breeding-include-farm" type="checkbox"> Include farm monsters</label>
```

5. **Roster columns**: remove `class="planner-card-list"` from `#planner-males` and `#planner-females` (the class moves to the per-location lists rendered by `renderRoster`).

6. **Rename**: the nav link text and `#planner-heading` become “My game”. Keep the `#team-planner` hash and every element ID unchanged. If the Phase 1 router owns a title map, update its Team planner title to “My game”.

## `js/planner-ui.js` changes

Add a label helper next to `contextLabel`:

```js
const gameLabel = value => value === "dqm1" ? "DQM1" : value === "dqm2" ? "DQM2" : "Unassigned";
```

- **`renderTeams`**: build the dropdown with two optgroups — teams matching `state.activeGame`, then unassigned teams — and sync the game select and hint:

```js
const select = P("planner-team-select");
select.replaceChildren();
const addGroup = (label, teams) => {
  if (!teams.length) return;
  const group = document.createElement("optgroup");
  group.label = label;
  for (const team of teams) {
    const option = document.createElement("option");
    option.value = team.id; option.textContent = team.name;
    group.append(option);
  }
  select.append(group);
};
addGroup(gameLabel(state.activeGame) + " teams", state.teams.filter(t => t.game === state.activeGame));
addGroup("Unassigned teams", state.teams.filter(t => t.game === null));
select.value = state.activeTeamId;
P("planner-team-delete").disabled = state.teams.length <= 1;
const team = activeTeam();
P("planner-team-game").value = team && team.game ? team.game : "";
P("planner-team-game-hint").hidden = Boolean(team && team.game);
```

- **New `renderGameSwitch`**, called from `renderAll`:

```js
function renderGameSwitch() {
  for (const g of ["dqm1", "dqm2"]) {
    P("planner-game-" + g).setAttribute("aria-pressed", String(state.activeGame === g));
  }
}
```

- **`cardMarkup`**: add a move button after the Switch sex button (only tagging farm keeps party the quiet default):

```js
'<button type="button" data-member-move="'+safe(entry.id)+'" aria-label="Move '+safe(fullName(entry))+' to the '+(entry.location === "farm" ? "party" : "farm")+'">Move to '+(entry.location === "farm" ? "party" : "farm")+'</button>'
```

- **`renderRoster`**: keep the existing page-reset line and favorites filter, then split each sex column into Party and Farm subsections. Keep the current single empty message when the column has nothing to show (the browser suite asserts the “No favorites yet” text):

```js
for (const sex of ["male","female"]) {
  let entries = team.entries.filter(e => e.sex === sex);
  if (favoritesOnly) entries = entries.filter(e => e.favorite === true);
  P("planner-"+sex+"-count").textContent = entries.length;
  if (!entries.length) {
    P("planner-"+sex+"s").innerHTML = '<p class="planner-empty">'+(favoritesOnly ? "No favorites yet. Star a monster to see it here." : "No "+sex+" monsters yet. Add one using the form above.")+'</p>';
    continue;
  }
  P("planner-"+sex+"s").innerHTML = ["party","farm"].map(loc => {
    const group = entries.filter(e => e.location === loc);
    return '<h4 class="planner-location-heading">'+loc[0].toUpperCase()+loc.slice(1)+' <span class="planner-count">'+group.length+'</span></h4>' +
      '<div class="planner-card-list">'+(group.map(e => cardMarkup(e, sex)).join("") ||
      '<p class="planner-empty">No '+sex+' monsters in the '+loc+'.</p>')+'</div>';
  }).join("");
}
P("planner-team-summary").textContent = team.entries.length+" / "+DQMPlannerCore.MAX_ENTRIES+" monsters in "+team.name+
  " ("+team.entries.filter(e => e.location !== "farm").length+" party · "+team.entries.filter(e => e.location === "farm").length+" farm)";
```

- **`cardAction`**: add a move branch (place it before the `edit` branch). Moving keeps focus on the card, mirroring the Switch sex flow:

```js
const move = event.target.closest("button[data-member-move]");
// …
} else if (move) {
  const member = team.entries.find(e => e.id === move.dataset.memberMove);
  if (!member) return;
  const location = member.location === "farm" ? "party" : "farm";
  commit(app.updateEntry(state, team.id, member.id, {location}), "Moved "+memberName(member)+" to the "+location+". Nickname, sex, and + value kept.");
  const target = P("planner-"+member.sex+"s").querySelector('button[data-member-move="'+member.id+'"]');
  if (target) target.focus({preventScroll: true});
}
```

- **Entry form**: on submit add `location: P("planner-location-farm").checked ? "farm" : "party"` to the entry object, and after a successful commit reset with `P("planner-location-party").checked = true;`. In the edit branch of `cardAction` add `P("planner-location-"+(member.location === "farm" ? "farm" : "party")).checked = true;`. In `cancelEdit` add `P("planner-location-party").checked = true;`.

- **`renderBreeding`**: filter by location before splitting by sex, and say so in the summary:

```js
const includeFarm = P("planner-breeding-include-farm").checked;
const pool = team.entries.filter(e => includeFarm || e.location !== "farm");
const males = pool.filter(e => e.sex === "male"), females = pool.filter(e => e.sex === "female");
// append (includeFarm ? " · party + farm" : " · party only") to the summary text
```

  Add the listener: `P("planner-breeding-include-farm").addEventListener("change", renderBreeding);`

- **`renderMatrix`**: tag farm monsters in row and column headers. Synthetic entries from the Everything tab have no `location`, so the tag never appears there:

```js
const farmTag = e => e.location === "farm" ? ' <small class="planner-farm-tag">Farm</small>' : '';
// header cell becomes: '<span>'+safe(memberName(e))+'</span>'+farmTag(e)+'<small>+'+e.plus+'</small>'
```

- **`renderSuggestions`**: suggestions already count every entry as owned (`rosterSpecies = team.entries.map(e => e.speciesIndex)` — do not change this). Add per-parent location badges. Build a lookup once per render, then replace the single “Roster” badge:

```js
const locationsBySpecies = new Map();
for (const e of team.entries) {
  const set = locationsBySpecies.get(e.speciesIndex) || new Set();
  set.add(e.location);
  locationsBySpecies.set(e.speciesIndex, set);
}
// inside the item loop, instead of the one "Roster" badge:
for (const pos of item.rosterParents) {
  const locs = ["party","farm"].filter(loc => locationsBySpecies.get(item.parents[pos])?.has(loc));
  if (locs.length) html += '<span class="plan-suggestion-badge">'+safe((pos === 0 ? "Pedigree" : "Mate")+" in "+locs.join(" + "))+'</span>';
}
```

  Keep the “Missing” badge as it is.

- **Plan roster-link select** (in `renderNodeCard`): show location in option text — `option.textContent = memberName(entry) + (entry.location === "farm" ? " (Farm)" : "");`

- **Events**, with the other planner listeners:

```js
for (const g of ["dqm1","dqm2"]) P("planner-game-"+g).addEventListener("click", () => {
  if (state.activeGame === g) return;
  try { commit(app.setActiveGame(state, g), "Viewing "+gameLabel(g)+"."); }
  catch (error) { notice(error.message); }
});
P("planner-team-game").addEventListener("change", () => {
  const team = activeTeam();
  if (!team) return;
  const value = P("planner-team-game").value;
  try {
    commit(app.setTeamGame(state, team.id, value === "" ? null : value),
      value === "" ? 'Team "'+team.name+'" is unassigned.' : 'Team "'+team.name+'" filed under '+gameLabel(value)+'.');
  } catch (error) { notice(error.message); renderTeams(); }
});
```

- **Export team**: no code change. `team.entries.map(({favorite, ...rest}) => rest)` carries `location` automatically, and the file's `version` becomes `2`.

## `css/guide.css` changes

Mirror existing patterns; no new design language:

- `.planner-game-switch` and `.planner-game-options`: copy the `.sprite-style-picker` / `.sprite-style-options` rules, including the `aria-pressed=true` selected style, the `max-width:800px` margin rule, and `display:none` in print.
- `.planner-location-field`: copy the `.planner-sex-field` rules.
- `.planner-location-heading`: small heading style inside roster columns (match `.planner-panel-heading h3` sizing), with the existing `.planner-count` badge.
- `.planner-farm-tag`: small muted inline tag, matching the existing `.tag` style used in the name index.

## Implementation sequence

1. **Schema and migration.** Make the `app-state.js` and `planner-core.js` changes above. Update the unit tests (see below) and run `npm run test:unit`. No UI changes yet; the page still works because every new field has a default.
2. **Roster locations.** Add the location radios, the subsection rendering, the move button and branch, and the CSS. Verify in a browser: add a monster to the farm, move it back and forth, and confirm nickname, sex, + value, and favorite survive.
3. **Game switch and assignment.** Add the switch, the team-game select and hint, the optgroup dropdown, `renderGameSwitch`, and the events. Verify: migrate a version-1 save (team shows Unassigned under both games), assign it to DQM2, and confirm it leaves the DQM1 list.
4. **Breeding grid and suggestions.** Add the farm toggle and grid tag, the summary text, the suggestion badges, and the roster-link option text. Verify with a team holding the same species in party and farm.
5. **Rename and docs.** Rename the view to My game (nav, heading, router title). Update `README.md`: the Saved data section (version-2 document, `game` and `location` fields, imported teams start unassigned) and a short “Games and farm” paragraph.
6. **Browser tests.** Add `tests/browser/game.spec.js` (below) and update the existing suites. Run `npm test`.

## Existing tests to update

Run `grep -rn "version" tests/` and fix every assertion that pins the old versions:

- `tests/unit/app-state.test.js`: cases using `version: 2` as the “newer” fixture move to `version: 3`; `defaultState` expectations gain `activeGame`, team `game: null`, and entry `location`; add a version-1 document migration case (teams become `game: null`, entries become `location: 'party'`, `activeGame` becomes `'dqm1'`, output version `2`).
- `tests/unit/planner-core.test.js`: `normalizeState` now accepts `1` and `2` and rejects `3`; `normalized.version` is `2`.
- `tests/browser/state.spec.js` and `tests/browser/planner.spec.js`: exported/saved version assertions become `2`; “newer version” banner fixtures move to `version: 3`; version-1 seeds still load via migration.
- `tests/browser/plan.spec.js`: seeded version-1 documents migrate; update any stored-shape assertions.

## New tests to add

Unit (`tests/unit/app-state.test.js`):

- `setActiveGame` keeps a visible active team, activates the first visible team otherwise, creates a fresh team when the game has none, and rejects a bad game.
- `setTeamGame` assigns and unassigns, makes `activeGame` follow the active team, and rejects a bad value.
- `addTeam` inherits `activeGame`; `deleteTeam` falls back to a visible team.
- Moving an entry via `updateEntry` with `{location}` preserves nickname, sex, + value, and favorite.
- Invalid `game` / `location` values fail with code `'invalid'`; a version-1 full backup imports migrated; a version-2 backup round-trips `game` and `location` through `toJSON` → `parseDocument`; a version-1 team file imports with `location: 'party'` and `game: null`.

Browser (`tests/browser/game.spec.js`, new file, following the existing file/server dual-mode pattern):

- The switch filters the team dropdown; unassigned teams appear under both games.
- Assigning the active team to DQM2 files it there; switching to a game with no teams creates a fresh empty team.
- Move to farm / Move to party keeps the card's nickname, sex, and + value.
- The breeding grid excludes farm monsters by default and includes them (tagged) when the toggle is on.
- Suggested recipes show “Pedigree in party” / “Mate in farm” style badges when parents are owned.
- A full backup exported from a game-and-farm save imports into a fresh page with game assignments and locations intact.

## Acceptance

- The My game view has a working DQM1/DQM2 switch; each game keeps separate teams, and through them separate farms, saved targets, and breeding plans.
- Every saved monster shows Party or Farm; moving it preserves nickname, sex, + value, and favorite.
- Recipe suggestions count party and farm monsters as owned and show where each roster parent is.
- The team breeding grid shows party monsters by default; “Include farm monsters” adds them, tagged.
- Teams migrated from version-1 saves are Unassigned, appear under both games, and keep all their monsters, targets, and plans until the player assigns a game.
- Full backup export/import preserves `game` and `location`; version-1 backups and version-1 team files still import; “newer version” protection still blocks version-3 files.
- The breeding reference (species, matrix, rules, bundle game ID) is byte-identical to before this phase.
- `npm test` passes, including the new game/farm tests.

## Design decisions

- **Game lives on the team, not the document.** The requirement separates teams, farms, targets, and plans per game; all of these already hang under teams, so one `game` field on the team separates everything without duplicating document-level state.
- **Unassigned teams are visible under both games.** Migration must never hide a player's existing monsters, and “unassigned until chosen” is a state, not a filter trap.
- **`setActiveGame` auto-creates a team when a game has none.** The document requires an active team at all times; creating one avoids a special empty-state screen and matches what “New team” would produce.
- **Location is a field on the entry.** Moving is a one-field patch, so nickname, sex, + value, and favorite survive by construction rather than by careful copying.
- **The storage key and filenames stay; only the internal version bumps.** Existing saves are found and migrated in place, and old builds reading a version-2 document still get the designed “newer version” protection.
- **`planner-core.js` and `recipe-planner.js` stay game- and location-agnostic.** Location is validated at the `app-state` boundary; suggestion location badges are computed in the UI from `team.entries`. The ranking logic needs no change because both locations count as owned.
- **The breeding reference stays shared.** No game-specific availability or recipe data is added without verification; when verified data arrives, it belongs in `data/` with a game tag, not in a forked dataset.

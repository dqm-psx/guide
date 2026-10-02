/* DQM-guide app controller: owns the saved document, persists it through
   DQMStorage, and renders the planner UI. Exposes window.DQMApp for
   reference.js and later modules. Load after js/app-state.js and
   js/storage.js. */
(() => {
  "use strict";
  const core = DQMPlannerCore.create(DATA);
  const planner = DQMRecipePlanner.create(DATA, core);
  const app = DQMAppState.create(DATA, core);
  const storage = DQMStorage.create();
  const P = id => document.getElementById(id);
  const safe = escapeHTML;
  const rosterSpecies = DATA.species.filter(s => s.index < 315 && isPlayable(s));
  const PAGE = 12;
  // The planner's tabs, in the order the arrow keys walk them.
  const PLANNER_TABS = ["roster", "targets", "breeding", "everything"];
  const named = index => displayName(byId.get(index));
  const copy = value => JSON.parse(JSON.stringify(value));
  const memberName = entry => entry.nickname || named(entry.speciesIndex);
  const fullName = entry => (entry.nickname ? entry.nickname + " · " : "") + named(entry.speciesIndex) + " +" + entry.plus;
  const contextLabel = value => ({base:"Base table only",shrine:"Ordinary shrine",room:"Two-save Breeding room"})[value];
  const gameLabel = value => value === "dqm1" ? "DQM1" : value === "dqm2" ? "DQM2" : "Unassigned";
  // 'party' is the default location, so an entry that never carried one reads
  // as a party monster rather than vanishing from both roster subsections.
  const entryLocation = entry => entry.location === "farm" ? "farm" : "party";
  const otherLocation = location => location === "farm" ? "party" : "farm";
  const activeTeam = () => app.findTeam(state, state.activeTeamId);

  let state = null;
  let undoState = null, editing = null, detail = null;
  let malePage = 0, femalePage = 0, rowPage = 0, columnPage = 0;
  let activeTab = "roster";
  let storageBlocked = false;
  let storageHealthy = storage.available();
  let documentTooLarge = false;
  let storedRawText = null;
  let pendingImport = null;
  let teamFormMode = null;
  let freshConfirm = false;
  let currentSpriteStyle = storage.read(app.LEGACY_SPRITE_KEY) === "overworld" ? "overworld" : "portrait";
  let plan = null;
  let planInvalid = null;
  let planMismatch = [];
  let planFlagged = new Set();
  let pendingReplaceId = null;
  let pendingReplaceSuggestion = null;
  let replaceConfirmedForNode = null;
  let suggestionTarget = null;
  let suggestionPage = 0;
  let undoPlan = null;
  let focusSelector = null;
  let currentTargetId = null;

  const listeners = new Set();
  function subscribe(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
  function emit() {
    for (const listener of listeners) listener();
  }
  const notice = message => { P("planner-message").textContent = message; };

  // ---- first load: read the document, migrate legacy keys, or block ----
  const stored = storage.read(app.STORAGE_KEY);
  if (stored !== null) {
    storedRawText = stored;
    try {
      state = app.parseDocument(stored);
    } catch (error) {
      storageBlocked = true;
      state = app.defaultState();
      showStorageBanner("blocked", app.isNewerError(error) ? "newer" : "invalid");
    }
  } else {
    state = app.migrateFromLegacy({
      teamText: storage.read(app.LEGACY_TEAM_KEY),
      spriteText: storage.read(app.LEGACY_SPRITE_KEY),
    });
    persist();
  }
  if (state.spriteStyle !== currentSpriteStyle) setSpriteStyle(state.spriteStyle);
  currentSpriteStyle = state.spriteStyle;

  function persist() {
    if (storageBlocked) { updateSaveStatus(); return false; }
    let text;
    try {
      text = app.toJSON(state);
    } catch (error) {
      if (app.errorCode(error) === "limit") {
        documentTooLarge = true;
        showStorageBanner("too-large");
        updateSaveStatus();
        return false;
      }
      throw error;
    }
    const ok = storage.write(app.STORAGE_KEY, text);
    if (!ok) {
      storageHealthy = false;
      showStorageBanner("unavailable");
    } else if (!storageHealthy || documentTooLarge) {
      storageHealthy = true;
      documentTooLarge = false;
      hideStorageBanner();
    }
    updateSaveStatus();
    return ok;
  }
  function hideStorageBanner() {
    P("app-storage-error").hidden = true;
    P("app-storage-error-download").hidden = true;
    P("app-storage-error-fresh").hidden = true;
    freshConfirm = false;
    P("app-storage-error-fresh").textContent = "Start fresh (replaces saved data)";
  }
  function showStorageBanner(kind, detail) {
    const banner = P("app-storage-error");
    const text = P("app-storage-error-text");
    const download = P("app-storage-error-download");
    const fresh = P("app-storage-error-fresh");
    if (kind === "blocked") {
      text.textContent = detail === "newer"
        ? "Your saved data was written by a newer version of this guide, so it has not been changed. You can download it or start fresh."
        : "Your saved data could not be read, so it has not been changed. You can download it or start fresh.";
      download.hidden = false;
      fresh.hidden = false;
      freshConfirm = false;
      fresh.textContent = "Start fresh (replaces saved data)";
    } else if (kind === "too-large") {
      text.textContent = "This document is too large for the browser to save or export. Remove some teams, monsters, plans, or notes.";
      download.hidden = true;
      fresh.hidden = true;
    } else {
      text.textContent = "Browser saving is unavailable. Your changes still work for this session — export a full backup to keep them.";
      download.hidden = true;
      fresh.hidden = true;
    }
    banner.hidden = false;
  }
  function updateSaveStatus() {
    P("planner-save-status").textContent = (storageBlocked || !storageHealthy || documentTooLarge)
      ? (documentTooLarge
        ? "This document is too large to save or export in the browser. Remove some teams, monsters, plans, or notes."
        : "Browser saving is unavailable. Your changes work for this session; export a full backup to keep them.")
      : "Saved in this browser only. Export a full backup to keep or move everything.";
  }
  function commit(nextState, message) {
    undoState = copy(state);
    state = nextState;
    P("planner-undo").disabled = false;
    freshConfirm = false;
    cancelEdit();
    persist();
    renderAll();
    if (message) notice(message);
    emit();
  }
  function cancelEdit() {
    editing = null;
    P("planner-add-button").textContent = "Add monster";
    P("planner-cancel-edit").hidden = true;
    P("planner-location-party").checked = true;
  }
  function downloadText(text, filename) {
    const blob = new Blob([text], {type:"application/json"});
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- rendering ----
  function renderTeams() {
    const select = P("planner-team-select");
    select.replaceChildren();
    // Teams filed under the game being viewed come first; unassigned teams stay
    // listed under both games so migration never hides a team.
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
    addGroup(gameLabel(state.activeGame)+" teams", state.teams.filter(team => team.game === state.activeGame));
    addGroup("Unassigned teams", state.teams.filter(team => team.game === null));
    select.value = state.activeTeamId;
    P("planner-team-delete").disabled = state.teams.length <= 1;
    const active = activeTeam();
    P("planner-team-game").value = active && active.game ? active.game : "";
    const unassigned = Boolean(active && !active.game);
    P("planner-team-game-hint").hidden = !unassigned;
    // The switch separates teams (and with them party and stabled monsters).
    // An unassigned team stays visible under both games, so offer one click to
    // file it under the game currently being viewed instead of appearing to do
    // nothing.
    const fileGame = P("planner-file-game");
    fileGame.hidden = !unassigned;
    fileGame.textContent = "File under " + gameLabel(state.activeGame);
  }
  function cardMarkup(entry, sex) {
    const species = byId.get(entry.speciesIndex);
    const star = '<button type="button" data-member-favorite="'+safe(entry.id)+'" aria-pressed="'+entry.favorite+'" aria-label="Favorite '+safe(memberName(entry))+'">★</button>';
    return '<article class="planner-card"><div class="planner-card-identity">'+spriteMarkup(entry.speciesIndex)+'<div><h4 class="planner-card-name">'+safe(memberName(entry))+'</h4><p class="planner-card-meta">'+safe((entry.nickname ? named(entry.speciesIndex)+" · " : "")+(species.family_display||species.family)+" +"+entry.plus)+'</p></div></div><div class="planner-card-actions">'+star+'<button type="button" data-member-edit="'+safe(entry.id)+'" aria-label="Edit '+safe(fullName(entry))+'">Edit</button><button type="button" data-member-remove="'+safe(entry.id)+'" aria-label="Remove '+safe(fullName(entry))+'">Remove</button><button type="button" data-member-switch="'+safe(entry.id)+'" aria-label="Switch '+safe(fullName(entry))+' to '+(sex === "male" ? "female" : "male")+'">Switch sex</button><button type="button" data-member-move="'+safe(entry.id)+'" aria-label="Move '+safe(fullName(entry))+' to the '+otherLocation(entryLocation(entry))+'">Move to '+otherLocation(entryLocation(entry))+'</button></div></article>';
  }
  function renderRoster() {
    malePage = femalePage = rowPage = columnPage = 0;
    const team = activeTeam();
    const favoritesOnly = P("planner-roster-favorites").checked;
    for (const sex of ["male","female"]) {
      let entries = team.entries.filter(e => e.sex === sex);
      if (favoritesOnly) entries = entries.filter(e => e.favorite === true);
      P("planner-"+sex+"-count").textContent = entries.length;
      const empty = '<p class="planner-empty">'+(favoritesOnly ? "No favorites yet. Star a monster to see it here." : "No "+sex+" monsters yet. Add one using the form above.")+'</p>';
      P("planner-"+sex+"s").innerHTML = entries.length ? ["party","farm"].map(loc => {
        const group = entries.filter(e => entryLocation(e) === loc);
        return '<h4 class="planner-location-heading">'+loc[0].toUpperCase()+loc.slice(1)+' <span class="planner-count">'+group.length+'</span></h4>' +
          '<div class="planner-card-list">'+(group.map(e => cardMarkup(e, sex)).join("") || '<p class="planner-empty">No '+sex+' monsters in the '+loc+'.</p>')+'</div>';
      }).join("") : '<div class="planner-card-list">'+empty+'</div>';
    }
    const party = team.entries.filter(e => entryLocation(e) === "party").length;
    P("planner-team-summary").textContent = team.entries.length+" / "+DQMPlannerCore.MAX_ENTRIES+" monsters in "+team.name+" ("+party+" party · "+(team.entries.length-party)+" farm)";
    P("planner-export").disabled = !team.entries.length;
  }
  function renderBreeding() {
    const team = activeTeam();
    // The grid shows party monsters by default; the farm toggle adds the rest,
    // tagged in the row and column headers.
    const includeFarm = P("planner-breeding-include-farm").checked;
    const pool = team.entries.filter(e => includeFarm || entryLocation(e) !== "farm");
    const males = pool.filter(e => e.sex === "male"), females = pool.filter(e => e.sex === "female");
    const context = P("planner-context").value, query = P("planner-result-search").value;
    malePage = Math.max(0,Math.min(malePage, Math.max(0, Math.ceil(males.length/PAGE)-1)));
    femalePage = Math.max(0, Math.min(femalePage, Math.max(0, Math.ceil(females.length/PAGE)-1)));
    let matches = 0;
    for (const male of males) for (const female of females) {
      for (const [a,b] of [[male,female],[female,male]]) {
        const result = core.result(a.speciesIndex, b.speciesIndex, a.plus, b.plus, context);
        if (matchesName(byId.get(result.resultIndex), query)) matches++;
      }
    }
    const total = 2*males.length*females.length;
    P("planner-breeding-summary").textContent = total.toLocaleString()+" ordered pairings · "+contextLabel(context)+" · "+(includeFarm ? "party + farm" : "party only")+(query ? " · "+matches.toLocaleString()+" matching offspring; other cells are faded." : " · Select any result for details.");
    renderMatrix("planner-male-grid", males.slice(malePage*PAGE, (malePage+1)*PAGE), females, context, query, "Male pedigree and female mate: offspring by ordered pairing");
    renderMatrix("planner-female-grid", females.slice(femalePage*PAGE, (femalePage+1)*PAGE), males, context, query, "Female pedigree and male mate: offspring by ordered pairing");
    pageRange("planner-male", malePage, males.length, "Pedigrees");
    pageRange("planner-female", femalePage, females.length, "Pedigrees");
  }
  function renderTargets() {
    const team = activeTeam();
    const activeTargetId = team ? team.activeTargetId : null;
    const activeTarget = team ? team.targets.find(target => target.id === activeTargetId) : null;
    const activeSpecies = activeTarget ? byId.get(activeTarget.speciesIndex) : null;
    const browsingIndex = (typeof DQMReference !== "undefined" && typeof DQMReference.currentTargetIndex === "function") ? DQMReference.currentTargetIndex() : null;
    const browsingSpecies = browsingIndex != null ? byId.get(browsingIndex) : null;

    // The pin control stays beside the offspring selector in Find parents;
    // the saved list and the plan it opens live in the planner.
    const summary = P("target-active-summary");
    const activeText = activeSpecies
      ? "Active target: " + displayName(activeSpecies)
      : "No active target yet. Pin the offspring you want to breed toward.";
    const viewing = browsingSpecies && (!activeSpecies || browsingSpecies.index !== activeSpecies.index);
    summary.textContent = (viewing ? "Viewing " + displayName(browsingSpecies) + " · " : "") + activeText;

    const pin = P("target-pin");
    const canPin = Boolean(browsingSpecies) && isPlayable(browsingSpecies);
    pin.disabled = !canPin;
    pin.textContent = canPin ? "Pin " + displayName(browsingSpecies) : "Pin current offspring";

    // The path to the plan, offered once something is pinned.
    const viewPlan = P("target-view-plan");
    viewPlan.hidden = !activeSpecies;
    viewPlan.textContent = activeSpecies
      ? "View plan for " + displayName(activeSpecies) + " in My game ↗"
      : "View plan in My game ↗";

    // The path back to Find parents to choose another target.
    const link = P("planner-open-target");
    if (activeSpecies) {
      link.hidden = false;
      link.textContent = "Open active target in Find parents: " + displayName(activeSpecies) + " ↗";
    } else {
      link.hidden = true;
      link.textContent = "Open active target in Find parents ↗";
    }

    const list = P("target-list");
    if (!team || !team.targets.length) {
      list.innerHTML = "";
      return;
    }
    list.innerHTML = team.targets.map(target => {
      const species = byId.get(target.speciesIndex);
      const isActive = target.id === activeTargetId;
      return '<li class="target-item' + (isActive ? " is-active" : "") + '" data-target-id="' + safe(target.id) + '">' +
        '<span class="target-name">' + spriteMarkup(target.speciesIndex) + safe(displayName(species)) + "</span>" +
        '<div class="target-actions">' +
        '<button type="button" data-target-switch="' + safe(target.id) + '" aria-label="Open target ' + safe(displayName(species)) + '"' + (isActive ? ' aria-current="true"' : "") + ">Open</button>" +
        '<button type="button" data-target-remove="' + safe(target.id) + '" aria-label="Remove target ' + safe(displayName(species)) + '">Remove</button>' +
        "</div></li>";
    }).join("");
  }
  // ---- breeding plan per target ----
  const activeTarget = () => {
    const team = activeTeam();
    if (!team || !team.activeTargetId) return null;
    return team.targets.find(t => t.id === team.activeTargetId) || null;
  };
  const planNotice = message => { P("plan-message").textContent = message; };
  function restoreFocus() {
    if (!focusSelector) return;
    const element = document.querySelector(focusSelector);
    if (element) {
      if (element.tagName === "DIV") {
        const focusTarget = element.querySelector("button, select, textarea");
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      } else {
        element.focus({ preventScroll: true });
      }
    }
    focusSelector = null;
  }
  function savePlan(nextPlan) {
    const team = activeTeam();
    const target = activeTarget();
    if (!team || !target) return;
    const nextState = app.setTargetPlan(state, team.id, target.id, nextPlan);
    plan = nextPlan;
    state = nextState;
    persist();
    renderPlan();
    planNotice(nextPlan === null ? "Cleared the breeding plan." : "Plan saved.");
    restoreFocus();
  }
  // Notes are free text. Persist them without re-rendering the tree so typing
  // keeps focus and caret, and a note is never lost to an unblurred reload.
  function commitNote(nodeId, value) {
    const team = activeTeam();
    const target = activeTarget();
    if (!team || !target || !plan) return;
    let nextPlan;
    try {
      nextPlan = planner.setNote(plan, nodeId, value);
    } catch (error) {
      planNotice(error.message);
      return;
    }
    const before = plan.nodes.find(node => node.id === nodeId);
    const after = nextPlan.nodes.find(node => node.id === nodeId);
    if (before && after && before.note === after.note) return;
    try {
      const nextState = app.setTargetPlan(state, team.id, target.id, nextPlan);
      plan = nextPlan;
      state = nextState;
      persist();
    } catch (error) {
      planNotice(error.message);
    }
  }
  function renderPlan() {
    const team = activeTeam();
    const target = activeTarget();
    const empty = P("plan-empty");
    const body = P("plan-body");
    if (!team || !target) {
      empty.hidden = false;
      body.hidden = true;
      plan = null;
      currentTargetId = null;
      return;
    }
    if (target.id !== currentTargetId) {
      currentTargetId = target.id;
      suggestionTarget = null;
      suggestionPage = 0;
      undoPlan = null;
      pendingReplaceId = null;
      pendingReplaceSuggestion = null;
      replaceConfirmedForNode = null;
      P("plan-replace-warning").hidden = true;
    }
    empty.hidden = true;
    body.hidden = false;
    if (target.plan === null) {
      plan = planner.createPlan(target.speciesIndex, "shrine");
      state = app.setTargetPlan(state, team.id, target.id, plan);
      persist();
    } else {
      plan = target.plan;
    }
    planInvalid = null;
    try {
      planner.validate(plan);
    } catch (error) {
      planInvalid = error.message;
    }
    if (!planInvalid) planInvalid = planTargetProblem(plan, target);
    planMismatch = [];
    try {
      planMismatch = planner.validateContext(plan, { data: DATA });
    } catch (error) {
      if (!planInvalid) planInvalid = error.message;
    }
    planFlagged = new Set(planMismatch.map(flag => flag.nodeId));
    renderPlanToolbar();
    renderPlanTree();
    renderSuggestions();
  }
  function renderPlanToolbar() {
    P("plan-context").value = plan.context;
    const summary = planner.planSummary(plan);
    P("plan-summary").textContent = summary.completed + " completed · " + summary.ready + " ready · " + summary.needed + " needed · depth " + summary.depth;
    const warnings = planner.duplicateRosterWarnings(plan);
    const team = activeTeam();
    P("plan-warnings").textContent = warnings.map(w => {
      const entry = team.entries.find(e => e.id === w.entryId);
      const name = entry ? memberName(entry) : w.entryId;
      return "Roster monster " + name + " is needed by more than one unfinished step; breeding consumes parents.";
    }).join(" ");
    const mismatch = P("plan-mismatch");
    const clear = P("plan-clear");
    if (planInvalid) {
      mismatch.hidden = false;
      mismatch.textContent = "This plan could not be read: " + planInvalid + " You can clear it to start over.";
      clear.hidden = false;
    } else if (planMismatch.length > 0) {
      mismatch.hidden = false;
      mismatch.textContent = planMismatch.map(f => f.reason).join(" ");
      clear.hidden = true;
    } else {
      mismatch.hidden = true;
      mismatch.textContent = "";
      clear.hidden = true;
    }
    P("plan-undo-recipe").hidden = undoPlan === null;
  }
  function renderPlanTree() {
    const tree = P("plan-tree");
    tree.innerHTML = "";
    if (!plan) return;
    const root = planner.nodeById(plan, plan.rootId);
    if (!root) return;
    tree.appendChild(renderNodeCard(root, "Target"));
  }
  function renderNodeCard(node, role) {
    const species = node.speciesIndex !== null ? byId.get(node.speciesIndex) : null;
    const name = species ? displayName(species) : "Any monster";
    const card = document.createElement("div");
    card.className = "plan-node" + (planFlagged.has(node.id) ? " is-incompatible" : "");
    card.dataset.nodeId = node.id;
    const header = document.createElement("div");
    header.className = "plan-node-header";
    header.innerHTML = spriteMarkup(node.speciesIndex) +
      '<span class="plan-node-name">' + safe(name) + "</span>" +
      '<span class="plan-node-role">' + safe(role) + "</span>";
    card.appendChild(header);
    const status = document.createElement("select");
    status.dataset.nodeStatus = node.id;
    status.setAttribute("aria-label", "Status for " + name);
    for (const s of ["needed", "ready", "completed"]) {
      const option = document.createElement("option");
      option.value = s;
      option.textContent = s;
      status.appendChild(option);
    }
    status.value = node.status;
    card.appendChild(status);
    const note = document.createElement("textarea");
    note.dataset.nodeNote = node.id;
    note.maxLength = 200;
    note.setAttribute("aria-label", "Note for " + name);
    note.value = node.note;
    card.appendChild(note);
    if (node.recipe) {
      const recipe = node.recipe;
      const pedigreeName = named(recipe.parents[0]);
      const mateName = recipe.parents[1] === null ? "Any monster" : named(recipe.parents[1]);
      const kindLabel = ruleLabel({ ruleKind: recipe.kind });
      const recipeInfo = document.createElement("div");
      recipeInfo.className = "plan-node-recipe";
      recipeInfo.innerHTML =
        (planFlagged.has(node.id)
          ? '<p class="plan-node-incompatible">This stored recipe does not apply in the ' + safe(contextLabel(plan.context)) + " context. Choose another recipe or switch the breeding context.</p>"
          : "") +
        '<p class="plan-node-parents">Pedigree ' + safe(pedigreeName) + " + Mate " + safe(mateName) + "</p>" +
        '<span class="plan-node-kind">' + safe(kindLabel) + "</span>" +
        '<p class="plan-node-context">' + safe(contextLabel(plan.context)) + "</p>";
      if (recipe.kind === "plus_threshold" && recipe.minPlus !== null) {
        recipeInfo.innerHTML += '<p class="plan-node-condition">Either parent +' + recipe.minPlus + " or higher.</p>";
      }
      recipeInfo.innerHTML += '<p class="plan-node-unknowns">Acquisition, offspring sex, inherited + value, and breeding eligibility are not established by this table.</p>';
      if (recipe.kind === "plus_threshold") {
        recipeInfo.innerHTML += '<p class="plan-node-unknowns">An unknown + value is not treated as zero.</p>';
      }
      if (recipe.kind === "flag_gated") {
        recipeInfo.innerHTML += '<p class="plan-node-unknowns">Applies in the title-screen Breeding room only.</p>';
      }
      card.appendChild(recipeInfo);
      const actions = document.createElement("div");
      actions.className = "plan-node-actions";
      actions.innerHTML =
        '<button type="button" data-node-replace="' + safe(node.id) + '" aria-label="Replace recipe for ' + safe(name) + '">Replace recipe</button>' +
        '<button type="button" data-node-collapse="' + safe(node.id) + '" aria-label="Collapse recipe for ' + safe(name) + '">Collapse</button>';
      card.appendChild(actions);
    } else if (node.speciesIndex === null) {
      const hint = document.createElement("p");
      hint.className = "plan-node-hint";
      hint.textContent = "This requirement is any monster from the recipe's family; it cannot be expanded further.";
      card.appendChild(hint);
    } else {
      const actions = document.createElement("div");
      actions.className = "plan-node-actions";
      actions.innerHTML =
        '<button type="button" data-node-choose="' + safe(node.id) + '" aria-label="Choose recipe for ' + safe(name) + '">Choose recipe</button>' +
        '<button type="button" data-node-available="' + safe(node.id) + '" aria-label="Mark ' + safe(name) + ' available without a roster link">Mark available</button>';
      card.appendChild(actions);
      const rosterSelect = document.createElement("select");
      rosterSelect.dataset.nodeRoster = node.id;
      rosterSelect.setAttribute("aria-label", "Link roster entry for " + name);
      const notLinked = document.createElement("option");
      notLinked.value = "";
      notLinked.textContent = "Not linked";
      rosterSelect.appendChild(notLinked);
      const team = activeTeam();
      for (const entry of team.entries) {
        if (entry.speciesIndex === node.speciesIndex) {
          const option = document.createElement("option");
          option.value = entry.id;
          option.textContent = memberName(entry) + (entryLocation(entry) === "farm" ? " (Farm)" : "");
          rosterSelect.appendChild(option);
        }
      }
      rosterSelect.value = node.fulfillment.rosterEntryId || "";
      card.appendChild(rosterSelect);
    }
    if (node.children !== null) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "plan-node-children";
      const pedigree = planner.nodeById(plan, node.children[0]);
      const mate = planner.nodeById(plan, node.children[1]);
      if (pedigree) childrenContainer.appendChild(renderNodeCard(pedigree, "Pedigree"));
      if (mate) childrenContainer.appendChild(renderNodeCard(mate, "Mate"));
      card.appendChild(childrenContainer);
    }
    return card;
  }
  function renderSuggestions() {
    const team = activeTeam();
    const target = activeTarget();
    const container = P("plan-suggestions");
    container.innerHTML = "";
    if (!team || !target || !plan) {
      P("plan-suggestions-for").textContent = "";
      P("plan-suggestions-clear").hidden = true;
      P("plan-suggestions-range").textContent = "";
      P("plan-suggestions-page").textContent = "";
      P("plan-suggestions-prev").disabled = true;
      P("plan-suggestions-next").disabled = true;
      return;
    }
    const isTarget = suggestionTarget === null;
    const nodeId = isTarget ? plan.rootId : suggestionTarget;
    const node = planner.nodeById(plan, nodeId);
    if (!node) {
      suggestionTarget = null;
      P("plan-suggestions-for").textContent = "";
      P("plan-suggestions-clear").hidden = true;
      return;
    }
    const speciesName = node.speciesIndex !== null ? named(node.speciesIndex) : "Any monster";
    if (node.speciesIndex === null) {
      suggestionTarget = null;
      P("plan-suggestions-for").textContent = "";
      P("plan-suggestions-clear").hidden = true;
      P("plan-suggestions-range").textContent = "";
      P("plan-suggestions-page").textContent = "";
      P("plan-suggestions-prev").disabled = true;
      P("plan-suggestions-next").disabled = true;
      return;
    }
    P("plan-suggestions-for").textContent = isTarget ? "" : "Recipe options for " + speciesName;
    P("plan-suggestions-clear").hidden = isTarget;
    const rosterSpecies = team.entries.map(e => e.speciesIndex);
    // Both locations count as owned, so a parent can be in the party, on the
    // farm, or both. The badge says where each roster parent lives.
    const locationsBySpecies = new Map();
    for (const e of team.entries) {
      const set = locationsBySpecies.get(e.speciesIndex) || new Set();
      set.add(entryLocation(e));
      locationsBySpecies.set(e.speciesIndex, set);
    }
    const availableSpecies = plan.nodes
      .filter(n => n.fulfillment.choice === "available" && n.speciesIndex !== null)
      .map(n => n.speciesIndex);
    const result = planner.suggestions(node.speciesIndex, {
      context: plan.context,
      rosterSpecies,
      availableSpecies,
      page: suggestionPage,
      pageSize: 12
    });
    for (const item of result.items) {
      const card = document.createElement("div");
      card.className = "plan-suggestion";
      card.setAttribute("role", "listitem");
      let html = '<p class="plan-suggestion-parents">Pedigree ' + safe(item.parentNames[0]) + " + Mate " + safe(item.parentNames[1]) + "</p>" +
        '<span class="plan-suggestion-kind">' + safe(ruleLabel({ ruleKind: item.kind })) + "</span>";
      if (item.condition) {
        html += '<p class="plan-suggestion-condition">' + safe(item.condition) + "</p>";
      }
      html += '<p class="plan-suggestion-badges">';
      for (const pos of item.rosterParents) {
        const locs = ["party","farm"].filter(loc => locationsBySpecies.get(item.parents[pos])?.has(loc));
        if (locs.length) html += '<span class="plan-suggestion-badge">'+safe((pos === 0 ? "Pedigree" : "Mate")+" in "+locs.join(" + "))+'</span>';
      }
      if (item.missingParents.length > 0) html += '<span class="plan-suggestion-badge">Missing</span>';
      html += "</p>";
      html += '<p class="plan-suggestion-unknowns">Acquisition, offspring sex, inherited + value, and breeding eligibility are not established by this table.</p>';
      html += '<button type="button" data-suggestion-use="' + safe(item.id) + '" aria-label="Use recipe: Pedigree ' + safe(named(item.parents[0])) + " + Mate " + safe(item.parents[1] === null ? "Any monster" : named(item.parents[1])) + '">Use this recipe</button>';
      card.innerHTML = html;
      container.appendChild(card);
    }
    const range = P("plan-suggestions-range");
    const pageLabel = P("plan-suggestions-page");
    const prev = P("plan-suggestions-prev");
    const next = P("plan-suggestions-next");
    if (result.total === 0) {
      range.textContent = "No suggested recipes.";
      pageLabel.textContent = "";
    } else {
      const start = result.page * 12 + 1;
      const end = Math.min((result.page + 1) * 12, result.total);
      range.textContent = start + "–" + end + " of " + result.total;
      pageLabel.textContent = "Page " + (result.page + 1) + " of " + result.pages;
    }
    prev.disabled = result.page === 0;
    next.disabled = result.page + 1 >= result.pages;
  }
  function renderGameSwitch() {
    for (const game of DQMAppState.TEAM_GAMES) {
      P("planner-game-"+game).setAttribute("aria-pressed", String(state.activeGame === game));
    }
  }
  function renderAll() {
    renderTeams();
    renderGameSwitch();
    renderRoster();
    renderBreeding();
    renderTargets();
    renderPlan();
    if (typeof DQMReference !== "undefined" && typeof DQMReference.refresh === "function") DQMReference.refresh();
    updateSaveStatus();
  }
  function filterSpecies(searchId, familyId) {
    return rosterSpecies.filter(s => matchesName(s, P(searchId).value) && familyMatches(s, P(familyId).value));
  }
  function refreshAddSpecies(selected) {
    setOptions("planner-add-species", filterSpecies("planner-add-search", "planner-add-family"), selected);
    P("planner-add-button").disabled = P("planner-add-species").disabled;
    refreshAddSprite();
  }
  function refreshAddSprite() { P("planner-add-sprite").innerHTML = spriteMarkup(current("planner-add-species")?.index); }
  function readPlus(id) {
    const input = P(id), value = Number(input.value);
    if (!input.value.trim() || !Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error("Enter a whole + value from 0 to 255.");
    }
    return value;
  }
  function ruleLabel(result) {
    return result.ruleKind === "flag_gated" ? "Room rule" : result.ruleKind === "plus_threshold" ? "+ rule" : "Base result";
  }
  function pageRange(id, page, total, label) {
    const pages = Math.max(1, Math.ceil(total/PAGE));
    const text = total ? label+" "+(page*PAGE+1)+"–"+Math.min((page+1)*PAGE, total)+" of "+total : "No matching "+label.toLowerCase();
    P(id+"-range").textContent = text;
    P(id+"-prev").disabled = page === 0;
    P(id+"-next").disabled = page+1 >= pages;
  }
  function renderMatrix(targetId, rows, columns, context, query, caption) {
    if (!rows.length || !columns.length) {
      P(targetId).innerHTML = '<p class="planner-empty">'+safe(targetId === "planner-all-grid" ? "No species match these filters." : "Add at least one male and one female monster to compare their offspring.")+'</p>';
      return;
    }
    // Synthetic entries from the Everything tab carry no location, so the tag never shows there.
    const farmTag = e => entryLocation(e) === "farm" ? ' <small class="planner-farm-tag">Farm</small>' : "";
    let html = '<table class="planner-matrix"><caption class="sr-only">'+safe(caption)+'</caption><thead><tr><th scope="col" class="planner-corner">Pedigree ↓<br>Mate →</th>';
    html += columns.map(e => '<th scope="col">'+spriteMarkup(e.speciesIndex)+'<span>'+safe(memberName(e))+'</span>'+farmTag(e)+'<small>+'+e.plus+'</small></th>').join("");
    html += '</tr></thead><tbody>';
    for (const row of rows) {
      html += '<tr><th scope="row">'+spriteMarkup(row.speciesIndex)+'<span>'+safe(memberName(row))+'</span>'+farmTag(row)+'<small>+'+row.plus+'</small></th>';
      for (const column of columns) {
        const outcome = core.result(row.speciesIndex, column.speciesIndex, row.plus, column.plus, context);
        const visible = matchesName(byId.get(outcome.resultIndex), query);
        const description = fullName(row)+" as pedigree + "+fullName(column)+" as mate → "+named(outcome.resultIndex)+". "+contextLabel(context)+". "+ruleLabel(outcome)+".";
        html += '<td'+(!visible?' class="planner-nonmatch"':'')+'><button type="button" class="planner-cell" data-planner-pair data-a="'+row.speciesIndex+'" data-b="'+column.speciesIndex+'" data-ap="'+row.plus+'" data-bp="'+column.plus+'" data-context="'+context+'" aria-label="'+safe(description)+'">'+spriteMarkup(outcome.resultIndex)+'<span>'+safe(named(outcome.resultIndex))+'</span>'+(outcome.ruleKind!=='base'?'<small class="planner-rule">'+safe(ruleLabel(outcome))+'</small>':'')+'</button></td>';
      }
      html += '</tr>';
    }
    P(targetId).innerHTML = html+'</tbody></table>';
  }
  function renderEverything() {
    let rowPlus, columnPlus;
    try { rowPlus = readPlus("planner-row-plus"); columnPlus = readPlus("planner-column-plus"); }
    catch (error) {
      P("planner-all-summary").textContent = error.message; P("planner-all-grid").replaceChildren();
      for (const axis of ["row","column"]) {
        P("planner-"+axis+"-prev").disabled = true; P("planner-"+axis+"-next").disabled = true;
        P("planner-"+axis+"-range").textContent = "Enter valid + values to browse.";
      }
      return;
    }
    const rows = filterSpecies("planner-row-search", "planner-row-family");
    const columns = filterSpecies("planner-column-search", "planner-column-family");
    rowPage = Math.max(0, Math.min(rowPage, Math.max(0, Math.ceil(rows.length/PAGE)-1)));
    columnPage = Math.max(0, Math.min(columnPage, Math.max(0, Math.ceil(columns.length/PAGE)-1)));
    const entries = (species, plus) => species.map(s => ({speciesIndex: s.index, plus, nickname: ""}));
    const context = P("planner-all-context").value;
    P("planner-all-summary").textContent = rows.length+" pedigrees × "+columns.length+" mates · "+(rows.length*columns.length).toLocaleString()+" ordered pairings · "+contextLabel(context)+". Use the row and column pages to explore the full grid.";
    renderMatrix("planner-all-grid", entries(rows.slice(rowPage*PAGE, (rowPage+1)*PAGE), rowPlus), entries(columns.slice(columnPage*PAGE, (columnPage+1)*PAGE), columnPlus), context, "", "All species breeding grid: pedigree rows and mate columns");
    pageRange("planner-row", rowPage, rows.length, "Rows");
    pageRange("planner-column", columnPage, columns.length, "Columns");
  }
  function showDetail(event) {
    const cell = event.target.closest("button[data-planner-pair]");
    if (!cell) return;
    detail = {a: Number(cell.dataset.a), b: Number(cell.dataset.b), ap: Number(cell.dataset.ap), bp: Number(cell.dataset.bp), context: cell.dataset.context};
    const forward = core.result(detail.a, detail.b, detail.ap, detail.bp, detail.context);
    const reverse = core.result(detail.b, detail.a, detail.bp, detail.ap, detail.context);
    const pairingText = "Pedigree " + named(detail.a) + " +" + detail.ap + " + Mate " + named(detail.b) + " +" + detail.bp + " → " + named(forward.resultIndex) + " (" + contextLabel(detail.context) + (forward.ruleKind === "base" ? "; base result" : "; " + ruleLabel(forward)) + ")";
    P("planner-copy-pairing").dataset.copyText = pairingText;
    P("planner-pair-detail-body").innerHTML = '<p class="kicker">'+safe(contextLabel(detail.context))+'</p><h3>'+safe(named(detail.a))+" +"+detail.ap+" + "+safe(named(detail.b))+" +"+detail.bp+' → '+spriteLabel(forward.resultIndex, named(forward.resultIndex))+'</h3><p>'+safe(forward.detail||forward.condition)+" Base table: "+safe(named(forward.baseIndex))+'.</p><p><strong>Reversed parents:</strong> '+spriteLabel(reverse.resultIndex, named(reverse.resultIndex))+" · "+safe(ruleLabel(reverse))+'.</p>';
    P("planner-pair-detail").hidden = false;
    P("planner-pair-detail").scrollIntoView({behavior:"smooth", block:"nearest"});
  }
  function setPlannerTab(name, focus = false) {
    activeTab = name;
    for (const mode of PLANNER_TABS) {
      P("planner-"+mode).hidden = mode !== name;
      const tab = P("planner-tab-"+mode);
      tab.setAttribute("aria-selected", String(mode === name)); tab.tabIndex = mode === name ? 0 : -1;
    }
    P("planner-pair-detail").hidden = true;
    if (name === "targets") { renderTargets(); renderPlan(); }
    if (name === "breeding") renderBreeding();
    if (name === "everything") renderEverything();
    if (focus) P("planner-tab-"+name).focus();
  }
  // Visibility, the active nav link, the page title, scroll position, and
  // navigation focus belong to js/router.js, which is their only owner. The
  // planner reacts to its own view being revealed through DQMApp.viewShown.

  // ---- roster card actions ----
  function focusEntryStar(entryId) {
    const star = document.querySelector('button[data-member-favorite="'+entryId+'"]');
    if (star) star.focus({preventScroll: true});
  }
  function cardAction(event) {
    const team = activeTeam();
    if (!team) return;
    const favorite = event.target.closest("button[data-member-favorite]");
    const remove = event.target.closest("button[data-member-remove]");
    const edit = event.target.closest("button[data-member-edit]");
    const switchSex = event.target.closest("button[data-member-switch]");
    const move = event.target.closest("button[data-member-move]");
    if (favorite) {
      const member = team.entries.find(e => e.id === favorite.dataset.memberFavorite);
      if (!member) return;
      const next = !member.favorite;
      commit(app.setEntryFavorite(state, team.id, member.id, next), (next ? "Favorited " : "Unfavorited ")+memberName(member)+".");
      focusEntryStar(member.id);
    } else if (remove) {
      const member = team.entries.find(e => e.id === remove.dataset.memberRemove);
      if (member) commit(app.removeEntry(state, team.id, member.id), "Removed "+memberName(member)+". Undo is available.");
    } else if (switchSex) {
      const member = team.entries.find(e => e.id === switchSex.dataset.memberSwitch);
      if (!member) return;
      const sex = member.sex === "male" ? "female" : "male";
      commit(app.updateEntry(state, team.id, member.id, {sex}), "Switched "+memberName(member)+" to "+sex+". Undo is available.");
      const target = P("planner-"+sex+"s").querySelector('button[data-member-switch="'+member.id+'"]');
      if (target) target.focus({preventScroll: true});
    } else if (move) {
      const member = team.entries.find(e => e.id === move.dataset.memberMove);
      if (!member) return;
      const location = otherLocation(entryLocation(member));
      commit(app.updateEntry(state, team.id, member.id, {location}), "Moved "+memberName(member)+" to the "+location+". Nickname, sex, and + value kept.");
      const target = P("planner-"+member.sex+"s").querySelector('button[data-member-move="'+member.id+'"]');
      if (target) target.focus({preventScroll: true});
    } else if (edit) {
      const member = team.entries.find(e => e.id === edit.dataset.memberEdit);
      if (!member) return;
      editing = member.id;
      P("planner-add-search").value = ""; P("planner-add-family").value = "";
      refreshAddSpecies(member.speciesIndex);
      P("planner-sex-"+member.sex).checked = true;
      P("planner-location-"+entryLocation(member)).checked = true;
      P("planner-add-plus").value = member.plus;
      P("planner-add-nickname").value = member.nickname;
      P("planner-add-button").textContent = "Save changes";
      P("planner-cancel-edit").hidden = false;
      P("planner-entry-form").scrollIntoView({behavior:"smooth", block:"start"});
      P("planner-add-species").focus({preventScroll: true});
      notice("Editing "+fullName(member)+".");
    }
  }

  // ---- teams panel ----
  function openTeamForm(mode) {
    teamFormMode = mode;
    const team = activeTeam();
    P("planner-team-name").value = mode === "rename" && team ? team.name : "";
    P("planner-team-name-form").hidden = false;
    P("planner-team-name").focus({preventScroll: true});
  }
  function closeTeamForm() {
    teamFormMode = null;
    P("planner-team-name-form").hidden = true;
    P("planner-team-name").value = "";
  }

  // ---- import (shared by the team input and the full backup input) ----
  // A plan may only describe the target it is saved under.
  function planTargetProblem(candidate, target) {
    if (candidate.speciesIndex !== target.speciesIndex) {
      return "The plan describes a different species than its target.";
    }
    const root = planner.nodeById(candidate, candidate.rootId);
    if (root && root.speciesIndex !== candidate.speciesIndex) {
      return "The plan root does not match the target species.";
    }
    return null;
  }
  // A full-backup import replaces the whole document, so reject it up front when
  // any target holds a structurally broken plan. A recipe that merely mismatches
  // the selected context is flaggable and importable.
  function planImportProblem(nextState) {
    for (const team of nextState.teams) {
      for (const target of team.targets) {
        if (target.plan === null) continue;
        try {
          planner.validate(target.plan);
        } catch (error) {
          return error.message;
        }
        const mismatch = planTargetProblem(target.plan, target);
        if (mismatch) return mismatch;
      }
    }
    return null;
  }
  function handleImport(text, fileName, target) {
    let result;
    try {
      result = app.importAny(text);
    } catch (error) {
      target.textContent = "Import failed: "+error.message+" Your saved data has not changed.";
      return;
    }
    if (result.kind === "full") {
      const problem = planImportProblem(result.state);
      if (problem) {
        target.textContent = "Import failed: " + problem + " Your saved data has not changed.";
        return;
      }
      pendingImport = result;
      const s = result.summary;
      P("planner-import-preview-text").textContent = "Replace your saved data with "+s.teams+" teams and "+s.targets+" targets ("+s.favorites+" favorites, "+s.entries+" monsters)?";
      P("planner-import-preview").hidden = false;
      P("planner-import-confirm").focus({preventScroll: true});
      return;
    }
    let team = result.state.teams[0];
    const baseName = fileName ? fileName.replace(/\.json$/i, "").trim() : "";
    if (baseName) team = {...team, name: baseName.slice(0, app.MAX_NAME_LENGTH)};
    let next;
    try {
      next = app.insertTeam(state, team);
    } catch (error) {
      target.textContent = "Import failed: "+error.message+" Your saved data has not changed.";
      return;
    }
    const inserted = next.teams[next.teams.length-1];
    commit(app.setActiveTeam(next, inserted.id), 'Imported "'+inserted.name+'" as a new team.');
  }

  // ---- cross-tab refresh ----
  function adoptStoredDocument(text, announce) {
    storedRawText = text;
    try {
      const adopted = app.parseDocument(text);
      undoState = null;
      P("planner-undo").disabled = true;
      cancelEdit();
      state = adopted;
      if (state.spriteStyle !== currentSpriteStyle) setSpriteStyle(state.spriteStyle);
      currentSpriteStyle = state.spriteStyle;
      storageBlocked = false;
      storageHealthy = true;
      documentTooLarge = false;
      hideStorageBanner();
      updateSaveStatus();
      renderAll();
      if (announce) notice(announce);
      emit();
      return true;
    } catch (error) {
      storageBlocked = true;
      showStorageBanner("blocked", app.isNewerError(error) ? "newer" : "invalid");
      return false;
    }
  }
  storage.subscribe(app.STORAGE_KEY, newValue => {
    if (newValue !== null) adoptStoredDocument(newValue, "Updated from another tab.");
  });

  // ---- events ----
  for (const id of ["planner-add-family","planner-row-family","planner-column-family"]) setFamilies(id);
  refreshAddSpecies(11);
  for (const id of ["planner-add-search","planner-add-family"]) P(id).addEventListener(id.endsWith("search") ? "input" : "change", () => refreshAddSpecies());
  P("planner-add-species").addEventListener("change", refreshAddSprite);
  P("planner-entry-form").addEventListener("submit", event => {
    event.preventDefault();
    try {
      const speciesIndex = Number(P("planner-add-species").value);
      if (P("planner-add-species").disabled || !rosterSpecies.some(s => s.index === speciesIndex)) throw new Error("Choose a monster from the list.");
      const team = activeTeam();
      const entry = {speciesIndex, sex: P("planner-sex-female").checked ? "female" : "male", location: P("planner-location-farm").checked ? "farm" : "party", plus: readPlus("planner-add-plus"), nickname: P("planner-add-nickname").value};
      let next, message;
      if (editing) {
        next = app.updateEntry(state, team.id, editing, entry);
        message = "Updated "+memberName(entry)+".";
      } else {
        next = app.addEntry(state, team.id, entry);
        message = "Added "+memberName(entry)+".";
      }
      commit(next, message);
      P("planner-add-nickname").value = "";
      P("planner-location-party").checked = true;
    } catch (error) { notice(error.message); }
  });
  P("planner-cancel-edit").addEventListener("click", () => { cancelEdit(); notice("Edit cancelled."); });
  P("planner-males").addEventListener("click", cardAction);
  P("planner-females").addEventListener("click", cardAction);
  P("planner-undo").addEventListener("click", () => {
    if (!undoState) return;
    state = undoState; undoState = null;
    P("planner-undo").disabled = true;
    cancelEdit();
    persist();
    renderAll();
    notice("Restored your previous roster.");
    emit();
  });
  P("planner-demo").addEventListener("click", () => {
    const team = activeTeam();
    let next = state;
    for (const entry of team.entries) next = app.removeEntry(next, team.id, entry.id);
    for (const entry of [
      {speciesIndex: 11, sex: "male", plus: 4, nickname: ""},
      {speciesIndex: 13, sex: "male", plus: 0, nickname: ""},
      {speciesIndex: 99, sex: "female", plus: 0, nickname: ""},
      {speciesIndex: 11, sex: "female", plus: 0, nickname: ""},
      {speciesIndex: 199, sex: "female", plus: 0, nickname: ""},
    ]) next = app.addEntry(next, team.id, entry);
    commit(next, "Loaded an example team. Undo restores your previous roster.");
  });
  P("planner-export").addEventListener("click", () => {
    const team = activeTeam();
    const legacy = {
      version: app.APP_VERSION,
      game: app.GAME_ID,
      entries: team.entries.map(({favorite, ...rest}) => rest),
    };
    downloadText(JSON.stringify(legacy, null, 2)+"\n", "DQM-guide-team-v61.json");
    notice("Exported your team as a JSON file.");
  });
  P("planner-import").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      handleImport(await file.text(), file.name, P("planner-message"));
    } catch (error) {
      notice("Import failed: "+error.message+" Your saved data has not changed.");
    }
    event.target.value = "";
  });
  P("planner-roster-favorites").addEventListener("change", renderRoster);
  P("planner-team-select").addEventListener("change", () => {
    const teamId = P("planner-team-select").value;
    if (teamId === state.activeTeamId) return;
    try {
      const next = app.setActiveTeam(state, teamId);
      commit(next, 'Switched to team "'+app.findTeam(next, teamId).name+'".');
    } catch (error) {
      notice(error.message);
      renderTeams();
    }
  });
  for (const game of DQMAppState.TEAM_GAMES) {
    P("planner-game-"+game).addEventListener("click", () => {
      if (state.activeGame === game) return;
      try {
        commit(app.setActiveGame(state, game), "Viewing "+gameLabel(game)+".");
      } catch (error) {
        notice(error.message);
        renderGameSwitch();
      }
    });
  }
  P("planner-team-game").addEventListener("change", () => {
    const team = activeTeam();
    if (!team) return;
    const value = P("planner-team-game").value;
    try {
      commit(app.setTeamGame(state, team.id, value === "" ? null : value),
        value === "" ? 'Team "'+team.name+'" is unassigned.' : 'Team "'+team.name+'" filed under '+gameLabel(value)+'.');
    } catch (error) {
      notice(error.message);
      renderTeams();
    }
  });
  P("planner-file-game").addEventListener("click", () => {
    const team = activeTeam();
    if (!team || team.game) return;
    try {
      commit(app.setTeamGame(state, team.id, state.activeGame),
        'Team "'+team.name+'" filed under '+gameLabel(state.activeGame)+'. Party and stabled monsters moved with it.');
    } catch (error) {
      notice(error.message);
      renderTeams();
    }
  });
  P("planner-team-new").addEventListener("click", () => openTeamForm("new"));
  P("planner-team-rename").addEventListener("click", () => openTeamForm("rename"));
  P("planner-team-name-cancel").addEventListener("click", () => { closeTeamForm(); P("planner-team-rename").focus({preventScroll: true}); notice("Team name cancelled."); });
  P("planner-team-name-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!teamFormMode) return;
    const name = P("planner-team-name").value;
    try {
      if (teamFormMode === "new") {
        const next = app.addTeam(state, name);
        const created = next.teams[next.teams.length-1];
        commit(app.setActiveTeam(next, created.id), 'Created team "'+created.name+'".');
      } else {
        const team = activeTeam();
        commit(app.renameTeam(state, team.id, name), 'Renamed team to "'+name.trim()+'".');
      }
      closeTeamForm();
      P("planner-team-rename").focus({preventScroll: true});
    } catch (error) { notice(error.message); }
  });
  P("planner-team-name-form").addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeTeamForm();
      P("planner-team-rename").focus({preventScroll: true});
      notice("Team name cancelled.");
    }
  });
  P("planner-team-delete").addEventListener("click", () => {
    const team = activeTeam();
    if (!team || state.teams.length <= 1) return;
    commit(app.deleteTeam(state, team.id), 'Deleted team "'+team.name+'".');
  });
  P("planner-backup-export").addEventListener("click", () => {
    const s = app.summarize(state);
    let text;
    try {
      text = app.toJSON(state);
    } catch (error) {
      P("planner-backup-message").textContent = "Export failed: " + error.message;
      return;
    }
    downloadText(text, "DQM-guide-backup-v61.json");
    P("planner-backup-message").textContent = "Exported a full backup: "+s.teams+" teams, "+s.entries+" monsters, "+s.targets+" targets.";
  });
  P("planner-backup-import").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      handleImport(await file.text(), file.name, P("planner-backup-message"));
    } catch (error) {
      P("planner-backup-message").textContent = "Import failed: "+error.message+" Your saved data has not changed.";
    }
    event.target.value = "";
  });
  P("planner-import-confirm").addEventListener("click", () => {
    if (!pendingImport) return;
    const summary = pendingImport.summary;
    const next = pendingImport.state;
    pendingImport = null;
    P("planner-import-preview").hidden = true;
    commit(next, "Imported a full backup: "+summary.teams+" teams, "+summary.entries+" monsters, "+summary.targets+" targets.");
    P("planner-backup-export").focus({preventScroll: true});
  });
  P("planner-import-cancel").addEventListener("click", () => {
    pendingImport = null;
    P("planner-import-preview").hidden = true;
    P("planner-backup-message").textContent = "Import cancelled. Your saved data has not changed.";
    P("planner-backup-import").focus({preventScroll: true});
  });
  P("app-storage-error-download").addEventListener("click", () => {
    if (storedRawText !== null) downloadText(storedRawText, "DQM-guide-saved-data.json");
  });
  P("app-storage-error-fresh").addEventListener("click", () => {
    if (!freshConfirm) {
      freshConfirm = true;
      const button = P("app-storage-error-fresh");
      button.textContent = "Click again to confirm";
      button.focus({preventScroll: true});
      return;
    }
    freshConfirm = false;
    P("app-storage-error-fresh").textContent = "Start fresh (replaces saved data)";
    state = app.defaultState();
    storageBlocked = false;
    storedRawText = null;
    undoState = null;
    P("planner-undo").disabled = true;
    cancelEdit();
    P("app-storage-error").hidden = true;
    persist();
    renderAll();
    notice("Started fresh. Your previous saved data was replaced.");
    emit();
  });
  document.addEventListener("click", event => {
    const button = event.target.closest("button[data-sprite-style]");
    if (!button) return;
    const style = button.dataset.spriteStyle;
    if (style === currentSpriteStyle) return;
    currentSpriteStyle = style;
    commit(app.setSpriteStyle(state, style), "Sprite style: "+style+".");
  });
  for (const mode of PLANNER_TABS) {
    const tab = P("planner-tab-"+mode);
    tab.addEventListener("click", () => setPlannerTab(mode));
    tab.addEventListener("keydown", event => {
      const last = PLANNER_TABS.length - 1, index = PLANNER_TABS.indexOf(mode);
      let next;
      if (event.key === "ArrowRight") next = (index+1)%PLANNER_TABS.length;
      if (event.key === "ArrowLeft") next = (index+PLANNER_TABS.length-1)%PLANNER_TABS.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = last;
      if (next !== undefined) { event.preventDefault(); setPlannerTab(PLANNER_TABS[next], true); }
    });
  }
  P("planner-context").addEventListener("change", () => { P("planner-pair-detail").hidden = true; renderBreeding(); });
  P("planner-result-search").addEventListener("input", renderBreeding);
  P("planner-breeding-include-farm").addEventListener("change", () => {
    P("planner-pair-detail").hidden = true;
    renderBreeding();
  });
  P("planner-male-prev").addEventListener("click", () => { malePage--; renderBreeding(); });
  P("planner-male-next").addEventListener("click", () => { malePage++; renderBreeding(); });
  P("planner-female-prev").addEventListener("click", () => { femalePage--; renderBreeding(); });
  P("planner-female-next").addEventListener("click", () => { femalePage++; renderBreeding(); });
  for (const prefix of ["row","column"]) {
    for (const suffix of ["search","family","plus"]) P("planner-"+prefix+"-"+suffix).addEventListener(suffix === "family" ? "change" : "input", () => {
      if (prefix === "row") rowPage = 0; else columnPage = 0;
      P("planner-pair-detail").hidden = true; renderEverything();
    });
    P("planner-"+prefix+"-prev").addEventListener("click", () => { if (prefix === "row") rowPage--; else columnPage--; renderEverything(); });
    P("planner-"+prefix+"-next").addEventListener("click", () => { if (prefix === "row") rowPage++; else columnPage++; renderEverything(); });
  }
  P("planner-all-context").addEventListener("change", () => { P("planner-pair-detail").hidden = true; renderEverything(); });
  for (const id of ["planner-male-grid","planner-female-grid","planner-all-grid"]) P(id).addEventListener("click", showDetail);
  P("planner-copy-pairing").addEventListener("click", () => {
    const text = P("planner-copy-pairing").dataset.copyText || "";
    if (!text) return;
    const done = () => notice("Copied: " + text);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(done, () => notice(text));
    } else {
      try {
        const area = document.createElement("textarea");
        area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
        document.body.append(area); area.select(); document.execCommand("copy"); area.remove(); done();
      } catch (error) { notice(text); }
    }
  });
  P("planner-inspect-reference").addEventListener("click", () => {
    if (!detail) return;
    // Set the pair first, then hand off; go() also works when Find a pairing
    // is already open, where no hashchange would follow.
    choosePair(detail.a, detail.b);
    DQMViews.go("pair-finder", { focusId: "result-name" });
  });
  P("target-pin").addEventListener("click", () => {
    const index = (typeof DQMReference !== "undefined" && typeof DQMReference.currentTargetIndex === "function") ? DQMReference.currentTargetIndex() : null;
    const species = index != null ? byId.get(index) : null;
    const team = activeTeam();
    if (!species || !isPlayable(species) || !team) return;
    try {
      const next = app.addTarget(state, team.id, index);
      commit(next, "Pinned " + displayName(species) + " as a breeding target.");
      if (typeof DQMReference !== "undefined" && typeof DQMReference.selectTarget === "function") DQMReference.selectTarget(index);
      renderTargets();
      // The saved list is in another view, so focus takes the new path to the
      // plan rather than a row that is not on screen.
      P("target-view-plan").focus({preventScroll: true});
    } catch (error) {
      notice(error.message);
    }
  });
  P("target-list").addEventListener("click", event => {
    const team = activeTeam();
    if (!team) return;
    const switchButton = event.target.closest("button[data-target-switch]");
    const removeButton = event.target.closest("button[data-target-remove]");
    if (switchButton) {
      const targetId = switchButton.dataset.targetSwitch;
      const target = team.targets.find(t => t.id === targetId);
      if (!target) return;
      try {
        const next = app.setActiveTarget(state, team.id, targetId);
        commit(next, "Switched the active target.");
        if (typeof DQMReference !== "undefined" && typeof DQMReference.selectTarget === "function") DQMReference.selectTarget(target.speciesIndex);
        renderTargets();
        const refocused = P("target-list").querySelector('button[data-target-switch="' + targetId + '"]');
        if (refocused) refocused.focus({preventScroll: true});
      } catch (error) {
        notice(error.message);
      }
    } else if (removeButton) {
      const targetId = removeButton.dataset.targetRemove;
      try {
        const next = app.removeTarget(state, team.id, targetId);
        commit(next, "Removed the target.");
        renderTargets();
        // The pin control is in Find parents, so focus stays in this tab: the
        // next saved target, or the path back when the list is empty.
        const nextItem = P("target-list").querySelector("button[data-target-switch]");
        const fallback = nextItem || P("planner-open-target");
        if (fallback && !fallback.hidden) fallback.focus({preventScroll: true});
        else P("planner-tab-targets").focus({preventScroll: true});
      } catch (error) {
        notice(error.message);
      }
    }
  });
  P("target-view-plan").addEventListener("click", () => {
    if (!activeTarget()) return;
    // Switch the tab first: the router re-applies the current tab when it
    // reveals the planner, so the plan is on screen before it is focused.
    setPlannerTab("targets");
    DQMViews.go("team-planner", { focusId: "plan-heading" });
  });
  P("target").addEventListener("change", renderTargets);
  P("target-search").addEventListener("input", renderTargets);
  P("planner-open-target").addEventListener("click", event => {
    // The href stays for a plain link, but go() owns the navigation so the
    // focus and the already-open destination behave the same as a nav click.
    event.preventDefault();
    const team = activeTeam();
    const activeTargetId = team ? team.activeTargetId : null;
    const activeTarget = team ? team.targets.find(t => t.id === activeTargetId) : null;
    const activeSpecies = activeTarget ? byId.get(activeTarget.speciesIndex) : null;
    if (!activeSpecies) return;
    // Select the target first, then hand off: go() also works when Find
    // parents is already open, where no hashchange would follow the link.
    if (typeof DQMReference !== "undefined" && typeof DQMReference.selectTarget === "function") DQMReference.selectTarget(activeSpecies.index);
    renderTargets();
    DQMViews.go("offspring-finder", { focusId: "target" });
  });
  // ---- breeding plan events ----
  P("plan-context").addEventListener("change", () => {
    const newContext = P("plan-context").value;
    if (!plan || newContext === plan.context) return;
    plan = { ...plan, context: newContext };
    savePlan(plan);
    planNotice("Breeding context: " + contextLabel(newContext) + ".");
  });
  P("plan-clear").addEventListener("click", () => {
    if (!plan) return;
    savePlan(null);
  });
  P("plan-undo-recipe").addEventListener("click", () => {
    if (!undoPlan) return;
    plan = undoPlan;
    undoPlan = null;
    savePlan(plan);
    planNotice("Restored the previous recipe.");
  });
  P("plan-replace-confirm").addEventListener("click", () => {
    P("plan-replace-warning").hidden = true;
    const pendingSuggestion = pendingReplaceSuggestion;
    const pendingNodeId = pendingReplaceId;
    pendingReplaceSuggestion = null;
    pendingReplaceId = null;
    if (pendingSuggestion) {
      replaceConfirmedForNode = pendingSuggestion.nodeId;
      applySuggestion(pendingSuggestion.nodeId, pendingSuggestion.suggestionId);
      replaceConfirmedForNode = null;
      return;
    }
    if (!pendingNodeId || !plan || !planner.nodeById(plan, pendingNodeId)) return;
    replaceConfirmedForNode = pendingNodeId;
    suggestionTarget = pendingNodeId;
    suggestionPage = 0;
    renderSuggestions();
    P("plan-suggestions").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  P("plan-replace-cancel").addEventListener("click", () => {
    pendingReplaceId = null;
    pendingReplaceSuggestion = null;
    replaceConfirmedForNode = null;
    P("plan-replace-warning").hidden = true;
    planNotice("Replacement cancelled.");
  });
  P("plan-suggestions-prev").addEventListener("click", () => {
    if (suggestionPage > 0) {
      suggestionPage--;
      renderSuggestions();
    }
  });
  P("plan-suggestions-next").addEventListener("click", () => {
    suggestionPage++;
    renderSuggestions();
  });
  P("plan-suggestions-clear").addEventListener("click", () => {
    suggestionTarget = null;
    suggestionPage = 0;
    renderSuggestions();
  });
  P("plan-tree").addEventListener("change", event => {
    const statusSelect = event.target.closest("select[data-node-status]");
    const rosterSelect = event.target.closest("select[data-node-roster]");
    const noteTextarea = event.target.closest("textarea[data-node-note]");
    if (statusSelect) {
      const nodeId = statusSelect.dataset.nodeStatus;
      focusSelector = 'select[data-node-status="' + nodeId + '"]';
      try {
        const nextPlan = planner.setStatus(plan, nodeId, statusSelect.value);
        savePlan(nextPlan);
        planNotice("Status updated.");
      } catch (error) {
        planNotice(error.message);
      }
    } else if (rosterSelect) {
      const nodeId = rosterSelect.dataset.nodeRoster;
      focusSelector = 'select[data-node-roster="' + nodeId + '"]';
      try {
        const fulfillment = rosterSelect.value === ""
          ? { choice: "recipe", rosterEntryId: null }
          : { choice: "roster", rosterEntryId: rosterSelect.value };
        const nextPlan = planner.setFulfillment(plan, nodeId, fulfillment);
        savePlan(nextPlan);
        planNotice(rosterSelect.value === "" ? "Roster link removed." : "Roster entry linked.");
      } catch (error) {
        planNotice(error.message);
      }
    } else if (noteTextarea) {
      const nodeId = noteTextarea.dataset.nodeNote;
      try {
        commitNote(nodeId, noteTextarea.value);
        noteTextarea.value = noteTextarea.value.trim();
        planNotice("Note saved.");
      } catch (error) {
        planNotice(error.message);
      }
    }
  });
  P("plan-tree").addEventListener("input", event => {
    const noteTextarea = event.target.closest("textarea[data-node-note]");
    if (!noteTextarea) return;
    commitNote(noteTextarea.dataset.nodeNote, noteTextarea.value);
  });
  P("plan-tree").addEventListener("click", event => {
    const chooseButton = event.target.closest("button[data-node-choose]");
    const availableButton = event.target.closest("button[data-node-available]");
    const replaceButton = event.target.closest("button[data-node-replace]");
    const collapseButton = event.target.closest("button[data-node-collapse]");
    if (chooseButton) {
      const nodeId = chooseButton.dataset.nodeChoose;
      pendingReplaceSuggestion = null;
      replaceConfirmedForNode = null;
      suggestionTarget = nodeId;
      suggestionPage = 0;
      renderSuggestions();
      P("plan-suggestions").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (availableButton) {
      const nodeId = availableButton.dataset.nodeAvailable;
      pendingReplaceSuggestion = null;
      replaceConfirmedForNode = null;
      focusSelector = '[data-node-id="' + nodeId + '"]';
      try {
        const nextPlan = planner.setFulfillment(plan, nodeId, { choice: "available", rosterEntryId: null });
        savePlan(nextPlan);
        planNotice("Marked available without a roster link.");
      } catch (error) {
        planNotice(error.message);
      }
    } else if (replaceButton) {
      const nodeId = replaceButton.dataset.nodeReplace;
      const node = planner.nodeById(plan, nodeId);
      if (node && node.children !== null) {
        pendingReplaceSuggestion = null;
        replaceConfirmedForNode = null;
        pendingReplaceId = nodeId;
        P("plan-replace-warning-text").textContent = "Replacing this recipe removes its dependent steps and their progress. Replace anyway?";
        P("plan-replace-warning").hidden = false;
        P("plan-replace-confirm").focus({ preventScroll: true });
        return;
      }
      pendingReplaceSuggestion = null;
      replaceConfirmedForNode = null;
      suggestionTarget = nodeId;
      suggestionPage = 0;
      renderSuggestions();
      P("plan-suggestions").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else if (collapseButton) {
      const nodeId = collapseButton.dataset.nodeCollapse;
      pendingReplaceSuggestion = null;
      replaceConfirmedForNode = null;
      focusSelector = '[data-node-id="' + nodeId + '"]';
      try {
        const nextPlan = planner.collapse(plan, nodeId);
        savePlan(nextPlan);
        planNotice("Collapsed the recipe branch.");
      } catch (error) {
        planNotice(error.message);
      }
    }
  });
  function applySuggestion(nodeId, suggestionId) {
    const team = activeTeam();
    const target = activeTarget();
    if (!team || !target || !plan) return;
    const node = planner.nodeById(plan, nodeId);
    if (!node) return;
    if (node.speciesIndex === null) {
      planNotice("This requirement cannot be expanded further.");
      return;
    }
    const rosterSpecies = team.entries.map(e => e.speciesIndex);
    const availableSpecies = plan.nodes
      .filter(n => n.fulfillment.choice === "available" && n.speciesIndex !== null)
      .map(n => n.speciesIndex);
    const result = planner.suggestions(node.speciesIndex, {
      context: plan.context,
      rosterSpecies,
      availableSpecies,
      page: suggestionPage,
      pageSize: 12
    });
    const item = result.items.find(r => r.id === suggestionId);
    if (!item) return;
    const speciesName = node.speciesIndex !== null ? named(node.speciesIndex) : "Any monster";
    try {
      if (node.children === null) {
        const nextPlan = planner.expand(plan, nodeId, item);
        focusSelector = '[data-node-id="' + nodeId + '"]';
        savePlan(nextPlan);
        planNotice("Chose recipe for " + speciesName + ".");
      } else {
        const replaceResult = planner.replaceRecipe(plan, nodeId, item);
        undoPlan = replaceResult.undo();
        focusSelector = '[data-node-id="' + nodeId + '"]';
        savePlan(replaceResult.plan);
        planNotice("Replaced recipe for " + speciesName + ". Undo is available.");
      }
    } catch (error) {
      planNotice(error.message);
    }
  }
  P("plan-suggestions").addEventListener("click", event => {
    const button = event.target.closest("button[data-suggestion-use]");
    if (!button) return;
    const suggestionId = button.dataset.suggestionUse;
    const team = activeTeam();
    const target = activeTarget();
    if (!team || !target || !plan) return;
    const nodeId = suggestionTarget === null ? plan.rootId : suggestionTarget;
    const node = planner.nodeById(plan, nodeId);
    if (!node) return;
    // Applying a suggestion to an expanded node replaces its branch, so warn
    // first unless a replacement for this exact node was just confirmed.
    if (node.children !== null && replaceConfirmedForNode !== node.id) {
      pendingReplaceSuggestion = { nodeId, suggestionId };
      P("plan-replace-warning-text").textContent = "Replacing this recipe removes its dependent steps and their progress. Replace anyway?";
      P("plan-replace-warning").hidden = false;
      P("plan-replace-confirm").focus({ preventScroll: true });
      return;
    }
    replaceConfirmedForNode = null;
    applySuggestion(nodeId, suggestionId);
  });
  // ---- controller contract for reference.js and later modules ----
  window.DQMApp = Object.freeze({
    state: () => state,
    activeTeam,
    activeTarget,
    savePlan,
    // Called by js/router.js once this view is displayed, so the active tab
    // and its panels are current whenever the planner comes back into view.
    viewShown: id => { if (id === "team-planner") setPlannerTab(activeTab); },
    isSpeciesFavorite: index => state.favoriteSpeciesIndices.includes(index),
    toggleSpeciesFavorite: index => {
      try {
        const favorite = !state.favoriteSpeciesIndices.includes(index);
        const message = (favorite ? "Favorited " : "Unfavorited ")+named(index)+".";
        commit(app.toggleSpeciesFavorite(state, index), message);
        const star = document.querySelector('button[data-species-favorite="'+index+'"]');
        if (star) star.focus({preventScroll: true});
        return message;
      } catch (error) {
        notice(error.message);
        return error.message;
      }
    },
    render: () => renderAll(),
    subscribe,
  });

  setPlannerTab("roster");
  renderAll();
})();

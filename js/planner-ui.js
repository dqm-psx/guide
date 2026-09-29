/* DQM-guide app controller: owns the saved document, persists it through
   DQMStorage, and renders the planner UI. Exposes window.DQMApp for
   reference.js and later modules. Load after js/app-state.js and
   js/storage.js. */
(() => {
  "use strict";
  const core = DQMPlannerCore.create(DATA);
  const app = DQMAppState.create(DATA, core);
  const storage = DQMStorage.create();
  const P = id => document.getElementById(id);
  const safe = escapeHTML;
  const rosterSpecies = DATA.species.filter(s => s.index < 315 && isPlayable(s));
  const PAGE = 12;
  const named = index => displayName(byId.get(index));
  const copy = value => JSON.parse(JSON.stringify(value));
  const memberName = entry => entry.nickname || named(entry.speciesIndex);
  const fullName = entry => (entry.nickname ? entry.nickname + " · " : "") + named(entry.speciesIndex) + " +" + entry.plus;
  const contextLabel = value => ({base:"Base table only",shrine:"Ordinary shrine",room:"Two-save Breeding room"})[value];
  const activeTeam = () => app.findTeam(state, state.activeTeamId);

  let state = null;
  let undoState = null, editing = null, detail = null;
  let malePage = 0, femalePage = 0, rowPage = 0, columnPage = 0;
  let activeTab = "roster";
  let storageBlocked = false;
  let storageHealthy = storage.available();
  let storedRawText = null;
  let pendingImport = null;
  let teamFormMode = null;
  let freshConfirm = false;
  let currentSpriteStyle = storage.read(app.LEGACY_SPRITE_KEY) === "overworld" ? "overworld" : "portrait";

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
    const ok = storage.write(app.STORAGE_KEY, app.toJSON(state));
    if (!ok) {
      storageHealthy = false;
      showStorageBanner("unavailable");
    }
    updateSaveStatus();
    return ok;
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
    } else {
      text.textContent = "Browser saving is unavailable. Your changes still work for this session — export a full backup to keep them.";
      download.hidden = true;
      fresh.hidden = true;
    }
    banner.hidden = false;
  }
  function updateSaveStatus() {
    P("planner-save-status").textContent = (storageBlocked || !storageHealthy)
      ? "Browser saving is unavailable. Your changes work for this session; export a full backup to keep them."
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
    for (const team of state.teams) {
      const option = document.createElement("option");
      option.value = team.id; option.textContent = team.name;
      select.append(option);
    }
    select.value = state.activeTeamId;
    P("planner-team-delete").disabled = state.teams.length <= 1;
  }
  function cardMarkup(entry, sex) {
    const species = byId.get(entry.speciesIndex);
    const star = '<button type="button" data-member-favorite="'+safe(entry.id)+'" aria-pressed="'+entry.favorite+'" aria-label="Favorite '+safe(memberName(entry))+'">★</button>';
    return '<article class="planner-card"><div class="planner-card-identity">'+spriteMarkup(entry.speciesIndex)+'<div><h4 class="planner-card-name">'+safe(memberName(entry))+'</h4><p class="planner-card-meta">'+safe((entry.nickname ? named(entry.speciesIndex)+" · " : "")+(species.family_display||species.family)+" +"+entry.plus)+'</p></div></div><div class="planner-card-actions">'+star+'<button type="button" data-member-edit="'+safe(entry.id)+'" aria-label="Edit '+safe(fullName(entry))+'">Edit</button><button type="button" data-member-remove="'+safe(entry.id)+'" aria-label="Remove '+safe(fullName(entry))+'">Remove</button><button type="button" data-member-switch="'+safe(entry.id)+'" aria-label="Switch '+safe(fullName(entry))+' to '+(sex === "male" ? "female" : "male")+'">Switch sex</button></div></article>';
  }
  function renderRoster() {
    malePage = femalePage = rowPage = columnPage = 0;
    const team = activeTeam();
    const favoritesOnly = P("planner-roster-favorites").checked;
    for (const sex of ["male","female"]) {
      let entries = team.entries.filter(e => e.sex === sex);
      if (favoritesOnly) entries = entries.filter(e => e.favorite === true);
      P("planner-"+sex+"-count").textContent = entries.length;
      P("planner-"+sex+"s").innerHTML = entries.map(e => cardMarkup(e, sex)).join("") ||
        '<p class="planner-empty">'+(favoritesOnly ? "No favorites yet. Star a monster to see it here." : "No "+sex+" monsters yet. Add one using the form above.")+'</p>';
    }
    P("planner-team-summary").textContent = team.entries.length+" / "+core.MAX_ENTRIES+" monsters in "+team.name;
    P("planner-export").disabled = !team.entries.length;
  }
  function renderBreeding() {
    const team = activeTeam();
    const males = team.entries.filter(e => e.sex === "male"), females = team.entries.filter(e => e.sex === "female");
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
    P("planner-breeding-summary").textContent = total.toLocaleString()+" ordered pairings · "+contextLabel(context)+(query ? " · "+matches.toLocaleString()+" matching offspring; other cells are faded." : " · Select any result for details.");
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

    const link = P("planner-open-target");
    if (activeSpecies) {
      link.hidden = false;
      link.textContent = "Open active target: " + displayName(activeSpecies) + " ↗";
    } else {
      link.hidden = true;
      link.textContent = "Open active target ↗";
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
  function renderAll() {
    renderTeams();
    renderRoster();
    renderBreeding();
    renderTargets();
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
    let html = '<table class="planner-matrix"><caption class="sr-only">'+safe(caption)+'</caption><thead><tr><th scope="col" class="planner-corner">Pedigree ↓<br>Mate →</th>';
    html += columns.map(e => '<th scope="col">'+spriteMarkup(e.speciesIndex)+'<span>'+safe(memberName(e))+'</span><small>+'+e.plus+'</small></th>').join("");
    html += '</tr></thead><tbody>';
    for (const row of rows) {
      html += '<tr><th scope="row">'+spriteMarkup(row.speciesIndex)+'<span>'+safe(memberName(row))+'</span><small>+'+row.plus+'</small></th>';
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
    P("planner-pair-detail-body").innerHTML = '<p class="kicker">'+safe(contextLabel(detail.context))+'</p><h3>'+safe(named(detail.a))+" +"+detail.ap+" + "+safe(named(detail.b))+" +"+detail.bp+' → '+spriteLabel(forward.resultIndex, named(forward.resultIndex))+'</h3><p>'+safe(forward.detail||forward.condition)+" Base table: "+safe(named(forward.baseIndex))+'.</p><p><strong>Reversed parents:</strong> '+spriteLabel(reverse.resultIndex, named(reverse.resultIndex))+" · "+safe(ruleLabel(reverse))+'.</p>';
    P("planner-pair-detail").hidden = false;
    P("planner-pair-detail").scrollIntoView({behavior:"smooth", block:"nearest"});
  }
  function setPlannerTab(name, focus = false) {
    activeTab = name;
    for (const mode of ["roster","breeding","everything"]) {
      P("planner-"+mode).hidden = mode !== name;
      const tab = P("planner-tab-"+mode);
      tab.setAttribute("aria-selected", String(mode === name)); tab.tabIndex = mode === name ? 0 : -1;
    }
    P("planner-pair-detail").hidden = true;
    if (name === "breeding") renderBreeding();
    if (name === "everything") renderEverything();
    if (focus) P("planner-tab-"+name).focus();
  }
  const referenceIds = ["pair-finder","offspring-finder","conditional-rules","species-index","about"];
  function route() {
    const isPlanner = location.hash === "#team-planner";
    P("team-planner").hidden = !isPlanner;
    for (const id of referenceIds) P(id).hidden = isPlanner || (id === "conditional-rules" && !RULES.length);
    P("planner-nav-link").setAttribute("aria-current", isPlanner ? "page" : "false");
    P("planner-nav-link").classList.toggle("planner-nav-active", isPlanner);
    if (isPlanner) setPlannerTab(activeTab);
  }

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
    } else if (edit) {
      const member = team.entries.find(e => e.id === edit.dataset.memberEdit);
      if (!member) return;
      editing = member.id;
      P("planner-add-search").value = ""; P("planner-add-family").value = "";
      refreshAddSpecies(member.speciesIndex);
      P("planner-sex-"+member.sex).checked = true;
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
  function handleImport(text, fileName, target) {
    let result;
    try {
      result = app.importAny(text);
    } catch (error) {
      if (app.isNewerError(error)) {
        storageBlocked = true;
        storedRawText = text;
        showStorageBanner("blocked", "newer");
      }
      target.textContent = "Import failed: "+error.message+" Your saved data has not changed.";
      return;
    }
    if (result.kind === "full") {
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
      const entry = {speciesIndex, sex: P("planner-sex-female").checked ? "female" : "male", plus: readPlus("planner-add-plus"), nickname: P("planner-add-nickname").value};
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
  P("planner-team-new").addEventListener("click", () => openTeamForm("new"));
  P("planner-team-rename").addEventListener("click", () => openTeamForm("rename"));
  P("planner-team-name-cancel").addEventListener("click", () => { closeTeamForm(); notice("Team name cancelled."); });
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
    } catch (error) { notice(error.message); }
  });
  P("planner-team-name-form").addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeTeamForm();
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
    downloadText(app.toJSON(state), "DQM-guide-backup-v61.json");
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
  });
  P("planner-import-cancel").addEventListener("click", () => {
    pendingImport = null;
    P("planner-import-preview").hidden = true;
    P("planner-backup-message").textContent = "Import cancelled. Your saved data has not changed.";
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
  for (const mode of ["roster","breeding","everything"]) {
    const tab = P("planner-tab-"+mode);
    tab.addEventListener("click", () => setPlannerTab(mode));
    tab.addEventListener("keydown", event => {
      const modes = ["roster","breeding","everything"], index = modes.indexOf(mode);
      let next;
      if (event.key === "ArrowRight") next = (index+1)%3;
      if (event.key === "ArrowLeft") next = (index+2)%3;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = 2;
      if (next !== undefined) { event.preventDefault(); setPlannerTab(modes[next], true); }
    });
  }
  P("planner-context").addEventListener("change", () => { P("planner-pair-detail").hidden = true; renderBreeding(); });
  P("planner-result-search").addEventListener("input", renderBreeding);
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
  P("planner-inspect-reference").addEventListener("click", () => {
    if (!detail) return;
    choosePair(detail.a, detail.b); location.hash = "pair-finder"; route();
    P("pair-finder").scrollIntoView({behavior:"smooth"}); P("pedigree").focus({preventScroll: true});
  });
  P("target-pin").addEventListener("click", () => {
    const index = (typeof DQMReference !== "undefined" && typeof DQMReference.currentTargetIndex === "function") ? DQMReference.currentTargetIndex() : null;
    const species = index != null ? byId.get(index) : null;
    const team = activeTeam();
    if (!species || !isPlayable(species) || !team) return;
    try {
      const next = app.addTarget(state, team.id, index);
      const targetId = next.teams.find(t => t.id === team.id).targets.find(t => t.speciesIndex === index).id;
      commit(next, "Pinned " + displayName(species) + " as a breeding target.");
      if (typeof DQMReference !== "undefined" && typeof DQMReference.selectTarget === "function") DQMReference.selectTarget(index);
      renderTargets();
      const item = P("target-list").querySelector('li[data-target-id="' + targetId + '"] button[data-target-switch]');
      if (item) item.focus({preventScroll: true});
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
      } catch (error) {
        notice(error.message);
      }
    } else if (removeButton) {
      const targetId = removeButton.dataset.targetRemove;
      try {
        const next = app.removeTarget(state, team.id, targetId);
        commit(next, "Removed the target.");
        renderTargets();
      } catch (error) {
        notice(error.message);
      }
    }
  });
  P("target").addEventListener("change", renderTargets);
  P("target-search").addEventListener("input", renderTargets);
  P("planner-open-target").addEventListener("click", () => {
    const team = activeTeam();
    const activeTargetId = team ? team.activeTargetId : null;
    const activeTarget = team ? team.targets.find(t => t.id === activeTargetId) : null;
    const activeSpecies = activeTarget ? byId.get(activeTarget.speciesIndex) : null;
    if (!activeSpecies) return;
    const select = () => {
      if (typeof DQMReference !== "undefined" && typeof DQMReference.selectTarget === "function") DQMReference.selectTarget(activeSpecies.index);
      renderTargets();
    };
    if (location.hash === "#offspring-finder") { select(); return; }
    const onHashChange = () => {
      window.removeEventListener("hashchange", onHashChange);
      select();
    };
    window.addEventListener("hashchange", onHashChange);
  });
  window.addEventListener("hashchange", route);
  document.querySelectorAll('.nav a[href^="#"]').forEach(link => link.addEventListener("click", () => {
    const isPlanner = link.hash === "#team-planner";
    P("team-planner").hidden = !isPlanner;
    for (const id of referenceIds) P(id).hidden = isPlanner || (id === "conditional-rules" && !RULES.length);
    if (link.hash === location.hash) route();
  }));

  // ---- controller contract for reference.js and later modules ----
  window.DQMApp = Object.freeze({
    state: () => state,
    activeTeam,
    isSpeciesFavorite: index => state.favoriteSpeciesIndices.includes(index),
    toggleSpeciesFavorite: index => {
      const favorite = !state.favoriteSpeciesIndices.includes(index);
      commit(app.toggleSpeciesFavorite(state, index), (favorite ? "Favorited " : "Unfavorited ")+named(index)+".");
    },
    render: () => renderAll(),
    subscribe,
  });

  setPlannerTab("roster");
  route();
  renderAll();
})();

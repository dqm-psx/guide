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
  const PLANNER_TABS = ["roster", "targets", "breeding"];
  const named = index => displayName(byId.get(index));
  const profileLink = (index, label) => index === null ? safe(label) : '<a href="#monster?id='+Number(index)+'">'+safe(label ?? named(index))+'</a>';
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
  let comboTeam = null, comboSlots = [];
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
  let rosterTeamId = null, breedingPage = 0, editorReturnId = null;

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
  const pendingStyle = storage.read("dqm-guide-pending-sprite");
  if (!storageBlocked && (pendingStyle === "overworld" || pendingStyle === "portrait")) {
    state = app.setSpriteStyle(state,pendingStyle);
    if (persist()) storage.remove("dqm-guide-pending-sprite");
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
      ? "Changes are unsaved."
      : "Saved in this browser · Save files stay on this device";
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
    const dialog = P("planner-entry-dialog");
    const restore = editorReturnId;
    editing = null;
    editorReturnId = null;
    P("planner-add-button").textContent = "Add monster";
    P("planner-cancel-edit").hidden = true;
    P("planner-location-party").checked = true;
    P("planner-entry-error").textContent = "";
    if (dialog.open) {
      dialog.close();
      requestAnimationFrame(() => {
        const button = restore && document.querySelector('button[data-member-edit="'+restore+'"]');
        (button || P("planner-open-add")).focus({preventScroll:true});
      });
    }
  }
  function openEditor(member = null) {
    editing = member?.id || null;
    editorReturnId = editing;
    refreshAddSpecies(member?.speciesIndex ?? 11);
    P("planner-sex-"+(member?.sex || "male")).checked = true;
    P("planner-location-"+(member ? entryLocation(member) : "party")).checked = true;
    P("planner-add-plus").value = member?.plus ?? 0;
    P("planner-add-nickname").value = member?.nickname || "";
    P("planner-entry-heading").textContent = member ? "Edit "+memberName(member) : "Add a monster";
    P("planner-add-button").textContent = member ? "Save changes" : "Add monster";
    P("planner-cancel-edit").hidden = false;
    P("planner-entry-error").textContent = "";
    P("planner-entry-dialog").showModal();
    (P("planner-entry-dialog").querySelector('.monster-combo input') || P("planner-add-species")).focus({preventScroll:true});
  }
  function resetRosterFilters() {
    P("planner-roster-search").value = "";
    P("planner-roster-location").value = "all";
    P("planner-roster-sex").value = "all";
    P("planner-roster-sort").value = "order";
    P("planner-roster-favorites").checked = false;
  }
  function downloadText(text, filename) {
    const blob = new Blob([text], {type:"application/json"});
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- rendering ----
  function renderTeams() {
    if (rosterTeamId !== state.activeTeamId) {
      rosterTeamId = state.activeTeamId;
      resetRosterFilters();
      P("planner-breeding-member").value = "";
      P("planner-result-search").value = "";
      breedingPage = malePage = femalePage = 0;
    }
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
  function savedMonsterMarkup(monster) {
    if (!monster || monster.sourceStatus === 'manual') return '';
    if (monster.sourceStatus === 'changed') return '<p class="planner-card-save-note">Re-import this monster to refresh its saved stats and skills.</p>';
    const statLabels = {hp:'Max HP',mp:'Max MP',attack:'Attack',defense:'Defense',agility:'Agility',intelligence:'Intelligence'};
    const names = GUIDE_REFERENCE.guide_names;
    const equipment = names.items['item-'+monster.equipmentId];
    const equipped = monster.equipmentId !== null;
    const stats = equipped ? monster.battleStats : monster.baseStats;
    const skills = monster.knownSkills === null ? '<span class="hint">Not available in this import</span>' : monster.knownSkills.length ? monster.knownSkills.map(id => {
      const skill = names.skills[id];
      return skill ? '<a href="#field-guide?kind=skill&amp;entry=skill-'+safe(skill.id)+'">'+safe(skill.title)+'</a>' : '<span>Unlisted skill</span>';
    }).join('') : '<span class="hint">None learned yet</span>';
    return '<div class="planner-card-saved"><dl class="planner-card-attributes" aria-label="'+(equipped?'Stats including equipment':'Base stats')+'">'+Object.entries(statLabels).map(([key,label])=>'<div><dt>'+label+'</dt><dd>'+(stats[key] ?? '—')+'</dd></div>').join('')+'</dl>'+
      (equipped ? '<p class="planner-card-equipment">'+(equipment?'<a href="#field-guide?kind=item&amp;entry=item-'+monster.equipmentId+'">'+safe(equipment.title)+'</a>':'Equipped accessory')+' <span>· included in stats</span></p>' : '')+
      '<div class="planner-card-skills"><span class="planner-card-skills-label">Learned skills</span><div>'+skills+'</div></div></div>';
  }
  function cardMarkup(entry, sex) {
    const species = byId.get(entry.speciesIndex);
    const monster = DQMOwnedMonsters.adapt(entry, activeTeam());
    const level = Number.isInteger(entry.level) && entry.level > 0 && entry.level <= 127 ? "Lv " + entry.level : "Level unknown";
    const id = safe(entry.id), name = safe(fullName(entry));
    const star = '<button type="button" class="planner-card-favorite" data-member-favorite="'+id+'" aria-pressed="'+entry.favorite+'" aria-label="Favorite '+safe(memberName(entry))+'">'+(entry.favorite?'★':'☆')+'</button>';
    return '<article class="planner-card'+(monster.sourceStatus==='save'?' planner-card-imported':'')+'" data-entry-id="'+id+'" data-sex="'+sex+'" data-location="'+entryLocation(entry)+'"><div class="planner-card-identity">'+spriteMarkup(entry.speciesIndex)+'<div><h4 class="planner-card-name">'+profileLink(entry.speciesIndex,memberName(entry))+'</h4><p class="planner-card-meta">'+safe(entry.nickname ? named(entry.speciesIndex)+" · " : "")+familyLabelMarkup(species.family_id,species.family_display||species.family)+'</p><div class="planner-card-stats"><span class="planner-card-sex">'+(sex==='male'?'♂ Male':'♀ Female')+'</span><span>'+level+'</span><span>+'+entry.plus+'</span>'+(monster.levelCap!==null?'<span>Cap '+monster.levelCap+'</span>':'')+(monster.location==='hibernation'?'<span>Hibernating</span>':'')+'</div></div>'+star+'</div>'+savedMonsterMarkup(monster)+'<div class="planner-card-actions">'+
      '<button type="button" class="planner-card-breed" data-member-breed="'+id+'" aria-label="See breeding options for '+name+'">Breed</button><a class="planner-card-tool" href="#skill-planner?team='+safe(activeTeam().id)+'&amp;owned='+id+'">Skills &amp; growth</a><a class="planner-card-tool" href="#combat-planner?team='+safe(activeTeam().id)+'&amp;owned='+id+'">Damage</a><button type="button" data-member-edit="'+id+'" aria-label="Edit '+name+'">Edit</button>'+
      '<details class="planner-card-more"><summary aria-label="More actions for '+name+'">More</summary><div><button type="button" data-member-move="'+id+'">Move to '+otherLocation(entryLocation(entry))+'</button><button type="button" data-member-switch="'+id+'">Switch to '+(sex==='male'?'female':'male')+'</button><button type="button" data-member-remove="'+id+'" aria-label="Remove '+name+'">Remove</button></div></details></div></article>';
  }
  function comboCommand(member, skillId, resultId) {
    const skill = GUIDE_REFERENCE.guide_names.skills[skillId];
    const cost = SKILL_DESCRIPTIONS[skillId].mpCost;
    const requiredMp = cost === 'All remaining MP' ? 1 : cost;
    const spendsAll = resultId === 214 || cost === 'All remaining MP';
    const {currentHp, currentMp} = member;
    let status = 0, reason = '';
    if (currentHp === 0) {
      status = 2; reason = 'Fainted in this save';
    } else if (currentMp !== null && currentMp < requiredMp) {
      status = 2; reason = 'Needs '+(requiredMp-currentMp)+' more MP';
    } else if (currentHp === null || (requiredMp > 0 && currentMp === null)) {
      status = 1; reason = 'Check '+[currentHp === null && 'HP',requiredMp > 0 && currentMp === null && 'MP'].filter(Boolean).join(' and ');
    }
    const markup = '<li><b>'+safe(member.label)+'</b> · <a href="#field-guide?kind=skill&amp;entry=skill-'+safe(skill.id)+'">'+safe(skill.title)+'</a> <small>('+
      (spendsAll?'all MP':cost+' MP')+')</small>'+(reason?' <strong class="party-combo-reason">'+safe(reason)+'</strong>':'')+'</li>';
    return {status,markup};
  }
  function partyComboMatches(members) {
    const matches = [];
    for (const combo of GUIDE_REFERENCE.guide_names.battle_combos) {
      const [firstSkill,secondSkill] = combo.skills;
      const pairs = [];
      for (const [i,first] of members.entries()) {
        if (!first.knownSkills?.includes(firstSkill)) continue;
        for (const [j,second] of members.entries()) {
          if (i === j || (firstSkill === secondSkill && j < i) || !second.knownSkills?.includes(secondSkill)) continue;
          const a = comboCommand(first,firstSkill,combo.id), b = comboCommand(second,secondSkill,combo.id);
          pairs.push({status:Math.max(a.status,b.status), markup:'<ul>'+a.markup+b.markup+'</ul>'});
        }
      }
      if (!pairs.length) continue;
      pairs.sort((a,b)=>a.status-b.status);
      matches.push({combo,pairs,status:pairs[0].status});
    }
    return matches.sort((a,b)=>a.status-b.status);
  }
  function renderPartyCombos() {
    const panel = P('planner-party-combos'), team = activeTeam();
    const direct = new URLSearchParams(location.hash.split('?')[1]).get('combos') === 'party';
    if (comboTeam !== team.id) {
      comboTeam = team.id;
      comboSlots = [];
    }
    panel.hidden = !team.entries.length && !direct;
    if (panel.hidden || !globalThis.SKILL_DESCRIPTIONS) return;
    const party = team.entries.map(entry=>({...DQMOwnedMonsters.adapt(entry,team),label:memberName(entry)})).filter(member=>member.location === 'party');
    // Duplicate nicknames still need unambiguous command and lineup labels.
    const names = party.map(member=>member.label);
    party.forEach((member,i)=>{ if (names.indexOf(member.label) !== names.lastIndexOf(member.label)) member.label += ' (party '+(i+1)+')'; });
    const ids = party.map(member=>member.entryId);
    const retained = comboSlots.filter(id=>ids.includes(id));
    comboSlots = [...retained,...ids.filter(id=>!retained.includes(id))].slice(0,3);
    const members = comboSlots.map(id=>party.find(member=>member.entryId===id));
    let html = '';
    if (party.length > 3) {
      html += '<fieldset class="party-combo-lineup"><legend>Choose three monsters for this battle</legend>'+
        members.map((member,i)=>'<label>Slot '+(i+1)+'<select data-combo-slot="'+i+'">'+party.map(option=>
          '<option value="'+safe(option.entryId)+'"'+(option.entryId===member.entryId?' selected':comboSlots.includes(option.entryId)?' disabled':'')+'>'+safe(option.label)+'</option>'
        ).join('')+'</select></label>').join('')+'</fieldset>';
    }
    const matches = partyComboMatches(members);
    const unknown = members.filter(member=>member.knownSkills === null);
    const count = matches.length;
    const counter = P('planner-combo-count');
    const canCount = count > 0 || (!unknown.length && members.length >= 2);
    counter.textContent = canCount ? count+' match'+(count===1?'':'es') : '';
    if (members.length < 2) {
      html += '<p>Two active party monsters are needed for a battle combo.</p>';
    } else if (count) {
      html += '<p>In adventure battles, choose the two commands on the same turn. One pair can combine per turn. Both monsters must be able to act, and personality and motivation affect the chance.</p>';
      for (const {combo,pairs,status} of matches) {
        const heading = ['Can try','Check HP or MP','Recover first'][status];
        html += '<section class="party-combo-match" data-combo="'+combo.id+'"><header><h4>'+safe(combo.title)+'</h4><span>'+heading+'</span></header>'+
          '<p>'+safe(combo.effect)+(combo.id === 220?' Unavailable in local battles.':'')+'</p>'+pairs[0].markup+
          (pairs.length>1?'<details><summary>Other command pairs ('+(pairs.length-1)+')</summary>'+pairs.slice(1).map(pair=>pair.markup).join('')+'</details>':'')+'</section>';
      }
    } else if (!unknown.length) {
      html += '<p>No two active party members know a matching pair of skills.</p>';
    }
    if (unknown.length) html += '<p>Learned skills are unavailable for '+safe(unknown.map(member=>member.label).join(', '))+'. Import a current save to check these monsters.</p>';
    html += '<p class="party-combo-links">'+(!team.entries.length || unknown.length?'<a href="#team-planner?import=save">Import a save</a>':'')+
      '<a href="#field-guide?kind=mechanic&amp;entry=field-battle-combos&amp;section=combo-recipes">All 20 battle combos</a></p>';
    P('planner-combo-results').innerHTML = html;
  }
  function renderRoster() {
    const team = activeTeam();
    const favoritesOnly = P("planner-roster-favorites").checked;
    const query = P("planner-roster-search").value.trim(), loc = P("planner-roster-location").value, sex = P("planner-roster-sex").value;
    const fold = value => value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
    const visible = team.entries.filter(entry => (!favoritesOnly || entry.favorite) &&
      (loc==='all' || entryLocation(entry)===loc) && (sex==='all' || entry.sex===sex) &&
      (!query || fold(entry.nickname || '').includes(fold(query)) || matchesName(byId.get(entry.speciesIndex),query)));
    const sort = P("planner-roster-sort").value;
    if (sort==='name') visible.sort((a,b)=>memberName(a).localeCompare(memberName(b)));
    if (sort==='level') visible.sort((a,b)=>(b.level || -1)-(a.level || -1));
    if (sort==='plus') visible.sort((a,b)=>b.plus-a.plus);
    for (const place of ["party","farm"]) {
      const entries = visible.filter(e => entryLocation(e) === place);
      P("planner-"+place+"-count").textContent = entries.length;
      P("planner-"+place).closest("section").hidden = !entries.length;
      P("planner-"+place).innerHTML = '<div class="planner-card-list">'+entries.map(e=>cardMarkup(e,e.sex)).join('')+'</div>';
    }
    const party = team.entries.filter(e => entryLocation(e) === "party").length;
    const summary = P("planner-team-summary");
    summary.textContent = team.entries.length ? (visible.length!==team.entries.length ? visible.length+" of " : '')+team.entries.length+" monsters · "+party+" party · "+(team.entries.length-party)+" farm" : "No monsters yet";
    P("planner-roster-empty").hidden = Boolean(team.entries.length);
    P("planner-filter-empty").hidden = !team.entries.length || Boolean(visible.length);
    P("planner-roster-search").closest('.my-game-roster-toolbar')?.classList.toggle('is-empty',!team.entries.length);
    P("planner-export").disabled = !team.entries.length;
  }
  function resistanceForecast(team, a, b, childId, context) {
    if (context === "shrine") {
      return DQMOffspringResistances.predict(DQMOwnedMonsters.adapt(a,team), DQMOwnedMonsters.adapt(b,team), childId, COMBAT_REFERENCE);
    }
    const reason = context === "room" ? "The two-save Breeding room takes one parent from each Adventure Log." : "The base table omits the shrine’s special breeding rules.";
    return {reason:reason + " Select Ordinary shrine to forecast offspring from this team."};
  }
  function resistanceMarkup(forecast) {
    const heading = '<h4>Offspring resistances</h4>';
    if (forecast.reason) return '<section class="offspring-resistances">'+heading+'<p>'+safe(forecast.reason)+'</p></section>';
    const improved = forecast.grades.filter(row => row.grade > row.base);
    const unchanged = forecast.grades.filter(row => row.grade === row.base);
    const gradeLabel = value => value === 7 ? '7 · Innate' : value;
    const table = rows => '<table><thead><tr><th scope="col">Resistance</th><th scope="col">Species base</th><th scope="col">Offspring</th></tr></thead><tbody>'+rows.map(row =>
      '<tr><th scope="row">'+safe(row.channel)+'</th><td>'+gradeLabel(row.base)+'</td><td><strong>'+gradeLabel(row.grade)+'</strong></td></tr>').join('')+'</tbody></table>';
    const scales = COMBAT_REFERENCE.scales;
    const scaleKey = '<details class="offspring-grade-key"><summary>What does a grade mean for damage?</summary>'+
      '<table><thead><tr><th scope="col">Grade</th><th scope="col">Spell damage taken</th><th scope="col">Breath damage taken</th></tr></thead><tbody>'+
      scales.spell.saved.map((spell,grade)=>'<tr><th scope="row">'+grade+'</th><td>'+spell+'%</td><td>'+scales.breath.saved[grade]+'%</td></tr>').join('')+
      '</tbody></table><p class="hint">These percentages apply to standard damaging spells and breaths. Status effects use their own success rules.</p></details>';
    return '<section class="offspring-resistances">'+heading+'<p>'+
      (improved.length ? '<strong>'+improved.length+' of 27</strong> resistances improve over the species base.' : 'All 27 resistances stay at the species base.')+
      '</p><p class="hint">Higher grades give stronger resistance. Only species that start at grade 7 can reach it.</p>'+
      (improved.length ? table(improved) : '')+
      (unchanged.length ? '<details><summary>Unchanged resistances ('+unchanged.length+')</summary>'+table(unchanged)+'</details>' : '')+
      scaleKey+'<a class="offspring-rules" href="#field-guide?kind=mechanic&amp;entry=field-breed&amp;section=resistance-inheritance">How resistance inheritance works</a></section>';
  }
  function renderBreeding(partnerId = P("planner-breeding-partner").value) {
    const team = activeTeam();
    const memberSelect = P("planner-breeding-member"), selected = memberSelect.value;
    const parentLabels = new Map();
    const labelCounts = new Map();
    for (const entry of team.entries) {
      const label = fullName(entry) + (entry.level ? ' · Lv '+entry.level : '') + ' · '+(entryLocation(entry)==='farm'?'Farm':'Party');
      const count = (labelCounts.get(label) || 0) + 1;
      labelCounts.set(label,count);
      parentLabels.set(entry.id,count === 1 ? label : label + ' ('+count+')');
    }
    const option = entry => new Option(parentLabels.get(entry.id),entry.id);
    memberSelect.replaceChildren(new Option("All my monsters", ""), ...team.entries.map(option));
    memberSelect.value = team.entries.some(entry=>entry.id===selected) ? selected : "";
    const member = memberSelect.value;
    const includeFarm = P("planner-breeding-include-farm").checked;
    const pool = team.entries.filter(e => includeFarm || entryLocation(e) !== "farm");
    const males = pool.filter(e => e.sex === "male"), females = pool.filter(e => e.sex === "female");
    const context = P("planner-context").value, query = P("planner-result-search").value;
    const chosen = pool.find(entry=>entry.id===member);
    const partnerSelect = P("planner-breeding-partner");
    const partners = chosen ? pool.filter(entry=>entry.sex !== chosen.sex) : [];
    const partner = partners.find(entry=>entry.id===partnerId);
    partnerSelect.replaceChildren(new Option(partners.length ? "All partners" : "No available partners", ""), ...partners.map(option));
    partnerSelect.value = partner?.id || "";
    partnerSelect.disabled = !partners.length;
    P("planner-breeding-partner-field").hidden = !chosen;
    const panel = P("planner-selected-pair");
    panel.hidden = !partner;
    memberSelect.labels[0].textContent = partner ? "Pedigree" : "Use a monster";
    partnerSelect.labels[0].textContent = partner ? "Mate" : "Partner";
    for (const id of ["planner-breeding-view","planner-result-search"]) P(id).closest(".field").hidden = Boolean(partner);
    if (partner) {
      const result = core.result(chosen.speciesIndex,partner.speciesIndex,chosen.plus,partner.plus,context);
      const forecast = resistanceForecast(team,chosen,partner,result.resultIndex,context);
      const suffix = Number.isInteger(forecast.plus) ? ' +'+forecast.plus : '';
      panel.innerHTML = '<header class="team-result-heading">'+spriteMarkup(result.resultIndex)+'<div><h3>'+profileLink(result.resultIndex)+suffix+'</h3><small>Pedigree · '+
        safe(memberName(chosen))+' &nbsp; Mate · '+safe(memberName(partner))+'</small></div><button type="button" data-swap-saved-pair>Swap parents</button></header>'+
        resistanceMarkup(forecast);
      P("planner-breeding-summary").textContent = "";
      for (const id of ["planner-team-results","planner-team-results-pagination","team-breeding-eligibility"]) P(id).hidden = true;
      for (const sex of ["male","female"]) P("planner-"+sex+"-grid").closest("section").hidden = true;
      return;
    }
    panel.replaceChildren();
    const listView = P("planner-breeding-view").value === "list";
    const outcomes = new Map();
    let total = 0, matches = 0;
    for (const male of males) for (const female of females) {
      if (member && male.id!==member && female.id!==member) continue;
      for (const [a,b] of [[male,female],[female,male]]) {
        total++;
        const result = core.result(a.speciesIndex, b.speciesIndex, a.plus, b.plus, context);
        if (!matchesName(byId.get(result.resultIndex), query)) continue;
        matches++;
        if (!outcomes.has(result.resultIndex)) outcomes.set(result.resultIndex,[]);
        outcomes.get(result.resultIndex).push({a,b,result});
      }
    }
    for (const sex of ["male","female"]) {
      const grid = P("planner-"+sex+"-grid");
      grid.closest("section").hidden = !total || listView;
      if (!total) grid.replaceChildren();
    }
    P("planner-team-results").hidden = !listView || !total;
    P("planner-team-results-pagination").hidden = !listView || !total;
    P("team-breeding-eligibility").hidden = !total;
    if (!total) {
      const needed = !males.length && !females.length ? "a male and a female" : !males.length ? "a male" : "a female";
      P("planner-breeding-summary").textContent = member && !pool.some(entry=>entry.id===member) ? "This monster is on the farm. Include farm monsters to see its pairings." : "Add "+needed+" to your "+(includeFarm ? "team" : "party")+" to see pairings.";
      P("planner-team-results").replaceChildren();
      return;
    }
    P("planner-breeding-summary").textContent = outcomes.size+" offspring · "+matches.toLocaleString()+" ordered pairings · "+(includeFarm ? "party + farm" : "party only")+(query && !listView ? " · matching offspring highlighted" : "");
    P("team-breeding-eligibility").textContent = "Both parent orders are included. Results use your saved + values; check breeding eligibility in game.";
    if (listView) {
      const groups=[...outcomes].sort(([a],[b])=>named(a).localeCompare(named(b)));
      breedingPage=Math.max(0,Math.min(breedingPage,Math.ceil(groups.length/PAGE)-1));
      const parent=(entry,role)=>'<span class="team-pair-parent"><small>'+role+'</small>'+spriteMarkup(entry.speciesIndex)+'<span>'+safe(memberName(entry))+' <strong>+'+entry.plus+'</strong></span></span>';
      const pairing=({a,b,result})=>'<div class="team-pair">'+parent(a,'Pedigree')+parent(b,'Mate')+
        '<button type="button" data-planner-pair data-owned-a="'+safe(a.id)+'" data-owned-b="'+safe(b.id)+'" data-a="'+a.speciesIndex+'" data-b="'+b.speciesIndex+'" data-ap="'+a.plus+'" data-bp="'+b.plus+'" data-context="'+context+'" aria-label="Inspect '+safe(fullName(a)+' as pedigree and '+fullName(b)+' as mate')+'">Inspect</button>'+
        (result.ruleKind!=='base'?'<small class="team-pair-rule">'+safe(ruleLabel(result))+'</small>':'')+'</div>';
      P("planner-team-results").innerHTML = groups.length ? groups.slice(breedingPage*PAGE,(breedingPage+1)*PAGE).map(([id,pairs])=>
        '<article class="team-result-card"><div class="team-result-heading">'+spriteMarkup(id)+'<div><h3>'+profileLink(id)+'</h3><small>'+pairs.length+' pairing'+(pairs.length===1?'':'s')+'</small></div></div>'+pairs.slice(0,3).map(pairing).join('')+
        (pairs.length>3?'<details><summary>'+ (pairs.length-3)+' more pairings</summary>'+pairs.slice(3).map(pairing).join('')+'</details>':'')+'</article>').join('') : '<p class="planner-empty">No offspring match this search.</p>';
      pageRange("planner-team-results",breedingPage,groups.length,"Offspring");
      return;
    }
    const maleRows=chosen?.sex==='male'?[chosen]:males, femaleRows=chosen?.sex==='female'?[chosen]:females;
    malePage = Math.max(0,Math.min(malePage, Math.max(0, Math.ceil(maleRows.length/PAGE)-1)));
    femalePage = Math.max(0, Math.min(femalePage, Math.max(0, Math.ceil(femaleRows.length/PAGE)-1)));
    renderMatrix("planner-male-grid", maleRows.slice(malePage*PAGE, (malePage+1)*PAGE), femaleRows, context, query, "Male pedigree and female mate: offspring by ordered pairing");
    renderMatrix("planner-female-grid", femaleRows.slice(femalePage*PAGE, (femalePage+1)*PAGE), maleRows, context, query, "Female pedigree and male mate: offspring by ordered pairing");
    pageRange("planner-male", malePage, maleRows.length, "Pedigrees");
    pageRange("planner-female", femalePage, femaleRows.length, "Pedigrees");
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
    P("saved-targets-panel").hidden = !team?.targets.length;
    const activeText = activeSpecies
      ? "Active target: " + displayName(activeSpecies)
      : "No active target.";
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
    link.hidden = !activeSpecies;
    link.href = activeSpecies ? "#offspring-finder?target="+activeSpecies.index : "#offspring-finder";

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
  function openTreePlan(tree) {
    const team = activeTeam();
    if (!team) return;
    let next = app.addTarget(state, team.id, tree.speciesIndex);
    const target = next.teams.find(t=>t.id===team.id).targets.find(t=>t.speciesIndex===tree.speciesIndex);
    if (!target.plan) next = app.setTargetPlan(next,team.id,target.id,tree);
    commit(next,target.plan ? "Opened your saved plan." : "Added this tree to your team’s targets.");
    activeTab = "targets";
    location.hash = "team-planner?tab=targets";
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
    if (P("team-open-tree")) {
      const link = P("team-open-tree");
      const route = target && (target.plan && window.DQMBreedingTree?.linkForPlan
        ? DQMBreedingTree.linkForPlan(target.plan) : "#breeding-tree?target="+target.speciesIndex);
      link.hidden = !route;
      if (route) link.href = route;
      else link.removeAttribute("href");
    }

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
      '<span class="plan-node-name">' + profileLink(node.speciesIndex,name) + "</span>" +
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
        '<p class="plan-node-parents">Pedigree ' + profileLink(recipe.parents[0],pedigreeName) + " + Mate " + profileLink(recipe.parents[1],mateName) + "</p>" +
        '<span class="plan-node-kind">' + safe(kindLabel) + "</span>";
      if (recipe.kind === "plus_threshold" && recipe.minPlus !== null) {
        recipeInfo.innerHTML += '<p class="plan-node-condition">Either parent +' + recipe.minPlus + " or higher.</p>";
      }
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
    // An imported roster can be replaced from another tab with a pair open.
    if (P("planner-pair-dialog").open && P("planner-pair-dialog").parentElement.id === "planner-team-detail-host") hidePairDetail();
    if (currentSpriteStyle !== state.spriteStyle) {
      currentSpriteStyle = state.spriteStyle;
      setSpriteStyle(currentSpriteStyle);
    }
    renderTeams();
    renderGameSwitch();
    renderRoster();
    renderPartyCombos();
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
    setOptions("planner-add-species", rosterSpecies, selected);
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
  function pageRange(id, page, total, label, size = PAGE) {
    const pages = Math.max(1, Math.ceil(total/size));
    const text = total ? label+" "+(page*size+1)+"–"+Math.min((page+1)*size, total)+" of "+total : "No matching "+label.toLowerCase();
    P(id+"-range").textContent = text;
    P(id+"-prev").disabled = page === 0;
    P(id+"-next").disabled = page+1 >= pages;
  }
  function renderMatrix(targetId, rows, columns, context, query, caption) {
    if (!rows.length || !columns.length) {
      P(targetId).innerHTML = '<p class="planner-empty">'+safe(targetId === "planner-all-grid" ? "No species match these filters." : "Add at least one male and one female monster to compare their offspring.")+'</p>';
      return;
    }
    // Synthetic entries from the breeding table carry no location, so the tag never shows there.
    const farmTag = e => entryLocation(e) === "farm" ? ' <small class="planner-farm-tag">Farm</small>' : "";
    let html = '<table class="planner-matrix"><caption class="sr-only">'+safe(caption)+'</caption><thead><tr><th scope="col" class="planner-corner">Pedigree ↓<br>Mate →</th>';
    html += columns.map(e => '<th scope="col">'+spriteMarkup(e.speciesIndex)+'<a href="#monster?id='+e.speciesIndex+'">'+safe(memberName(e))+'</a>'+farmTag(e)+'<small>+'+e.plus+'</small></th>').join("");
    html += '</tr></thead><tbody>';
    for (const row of rows) {
      html += '<tr><th scope="row">'+spriteMarkup(row.speciesIndex)+'<a href="#monster?id='+row.speciesIndex+'">'+safe(memberName(row))+'</a>'+farmTag(row)+'<small>+'+row.plus+'</small></th>';
      for (const column of columns) {
        const outcome = core.result(row.speciesIndex, column.speciesIndex, row.plus, column.plus, context);
        const visible = matchesName(byId.get(outcome.resultIndex), query);
        const description = fullName(row)+" as pedigree + "+fullName(column)+" as mate → "+named(outcome.resultIndex)+". "+contextLabel(context)+". "+ruleLabel(outcome)+".";
        const owned = targetId === "planner-all-grid" ? "" : ' data-owned-a="'+safe(row.id)+'" data-owned-b="'+safe(column.id)+'"';
        html += '<td'+(!visible?' class="planner-nonmatch"':'')+'><button type="button" class="planner-cell" data-planner-pair'+owned+' data-a="'+row.speciesIndex+'" data-b="'+column.speciesIndex+'" data-ap="'+row.plus+'" data-bp="'+column.plus+'" data-context="'+context+'" aria-label="'+safe(description)+'">'+spriteMarkup(outcome.resultIndex)+'<span>'+safe(named(outcome.resultIndex))+'</span>'+(outcome.ruleKind!=='base'?'<small class="planner-rule">'+safe(ruleLabel(outcome))+'</small>':'')+'</button></td>';
      }
      html += '</tr>';
    }
    P(targetId).innerHTML = html+'</tbody></table>';
  }
  function renderEverything() {
    let rowPlus, columnPlus;
    try { rowPlus = readPlus("planner-row-plus"); columnPlus = readPlus("planner-column-plus"); }
    catch (error) {
      P("planner-all-summary").textContent = error.message; P("planner-all-grid").replaceChildren(); P("matrix-filter-status").textContent = "";
      for (const axis of ["row","column"]) {
        P("planner-"+axis+"-prev").disabled = true; P("planner-"+axis+"-next").disabled = true;
        P("planner-"+axis+"-range").textContent = "Enter valid + values to browse.";
      }
      return;
    }
    const rows = filterSpecies("planner-row-search", "planner-row-family");
    const columns = filterSpecies("planner-column-search", "planner-column-family");
    const size = Number(P("matrix-page-size").value) || PAGE;
    const query = P("matrix-result-search").value;
    const context = P("planner-all-context").value;
    const listMode = P("matrix-view").value === "list";
    P("matrix-room-note").hidden = context !== "room";
    P("matrix-plus-note").hidden = context === "base";
    P("planner-column-range").parentElement.hidden = listMode;
    P("planner-row-range").parentElement.querySelector(".planner-page-label").textContent = listMode ? "Recipes" : "Pedigrees";
    for (const direction of ["prev","next"]) {
      const word = direction === "prev" ? "Previous" : "Next", button = P("planner-row-"+direction);
      button.textContent = (direction === "prev" ? "← " : "") + word + (listMode ? " recipes" : " rows") + (direction === "next" ? " →" : "");
      button.setAttribute("aria-label",word+(listMode ? " recipes" : " pedigree rows"));
    }
    P("planner-all-grid").classList.toggle("matrix-list", listMode);
    P("planner-all-summary").textContent = rows.length+" pedigrees × "+columns.length+" mates · "+(rows.length*columns.length).toLocaleString()+" ordered pairings · "+contextLabel(context)+".";
    const entries = (species, plus) => species.map(s => ({speciesIndex:s.index,plus,nickname:""}));
    if (listMode) {
      const listSize = size * 4;
      const totalPairs = rows.length * columns.length;
      // A blank query uses direct page offsets, even on a phone with the full roster.
      const matches = query ? [] : null;
      if (matches) {
        const resultIds = new Set(DATA.species.filter(s => matchesName(s,query)).map(s => s.index));
        for (let i = 0; i < totalPairs; i++) {
          const a = rows[Math.floor(i/columns.length)], b = columns[i%columns.length];
          if (resultIds.has(core.result(a.index,b.index,rowPlus,columnPlus,context).resultIndex)) matches.push(i);
        }
      }
      const total = matches ? matches.length : totalPairs;
      rowPage = Math.max(0,Math.min(rowPage,Math.max(0,Math.ceil(total/listSize)-1)));
      const displayed = [];
      for (let at = rowPage*listSize; at < Math.min(total,(rowPage+1)*listSize); at++) {
        const i = matches ? matches[at] : at;
        const a = rows[Math.floor(i/columns.length)], b = columns[i%columns.length];
        displayed.push({a,b,result:core.result(a.index,b.index,rowPlus,columnPlus,context)});
      }
      P("matrix-filter-status").textContent = query ? total.toLocaleString()+" matching recipes across all filtered parents" : "";
      P("planner-all-grid").innerHTML = displayed.length ? '<table><caption class="sr-only">Ordered recipes · '+safe(contextLabel(context))+'</caption><thead><tr><th scope="col">Pedigree</th><th scope="col">Mate</th><th scope="col">Offspring</th><th scope="col">Rule / actions</th></tr></thead><tbody>'+displayed.map(({a,b,result}) => '<tr><td>'+spriteLabel(a.index,named(a.index))+' <small>+'+rowPlus+'</small></td><td>'+spriteLabel(b.index,named(b.index))+' <small>+'+columnPlus+'</small></td><td>'+spriteLabel(result.resultIndex,named(result.resultIndex))+'</td><td class="matrix-list-actions"><span class="detail">'+safe(ruleLabel(result))+'</span><button type="button" data-planner-pair data-a="'+a.index+'" data-b="'+b.index+'" data-ap="'+rowPlus+'" data-bp="'+columnPlus+'" data-context="'+context+'">Inspect</button><a href="#breeding-tree?target='+result.resultIndex+'&context='+context+'">Tree ↗</a></td></tr>').join('')+'</tbody></table>' : '<p class="planner-empty">No recipes match. Clear the offspring search or reset the parent filters.</p>';
      pageRange("planner-row",rowPage,total,"Recipes",listSize);
    } else {
      rowPage = Math.max(0,Math.min(rowPage,Math.max(0,Math.ceil(rows.length/size)-1)));
      columnPage = Math.max(0,Math.min(columnPage,Math.max(0,Math.ceil(columns.length/size)-1)));
      const pageRows = rows.slice(rowPage*size,(rowPage+1)*size), pageColumns = columns.slice(columnPage*size,(columnPage+1)*size);
      renderMatrix("planner-all-grid",entries(pageRows,rowPlus),entries(pageColumns,columnPlus),context,query,"All species breeding grid: pedigree rows and mate columns");
      const matching = P("planner-all-grid").querySelectorAll('td:not(.planner-nonmatch)').length;
      P("matrix-filter-status").textContent = query ? matching+" matching results on this page · use Recipe list to search all filtered parents." : "";
      pageRange("planner-row",rowPage,rows.length,"Rows",size);
      pageRange("planner-column",columnPage,columns.length,"Columns",size);
    }
  }

  function movePairDetail(hostId) {
    const host = P(hostId);
    const panel = P("planner-pair-dialog");
    if (panel.parentElement !== host) host.append(panel);
  }
  function hidePairDetail() {
    P("planner-pair-dialog").close();
    P("planner-pair-detail").hidden = true;
  }
  function showDetail(event) {
    const cell = event.target.closest("button[data-planner-pair]");
    if (!cell) return;
    movePairDetail(cell.closest("#planner-all-grid") ? "planner-all-detail-host" : "planner-team-detail-host");
    detail = {a: Number(cell.dataset.a), b: Number(cell.dataset.b), ap: Number(cell.dataset.ap), bp: Number(cell.dataset.bp), context: cell.dataset.context};
    const forward = core.result(detail.a, detail.b, detail.ap, detail.bp, detail.context);
    const reverse = core.result(detail.b, detail.a, detail.bp, detail.ap, detail.context);
    const pairingText = "Pedigree " + named(detail.a) + " +" + detail.ap + " + Mate " + named(detail.b) + " +" + detail.bp + " → " + named(forward.resultIndex) + " (" + contextLabel(detail.context) + (forward.ruleKind === "base" ? "; base result" : "; " + ruleLabel(forward)) + ")";
    P("planner-copy-pairing").dataset.copyText = pairingText;
    P("planner-pair-copy-status").textContent = "";
    P("planner-pair-detail-body").innerHTML = '<p class="kicker">'+safe(contextLabel(detail.context))+'</p><h3>'+profileLink(detail.a)+" +"+detail.ap+" + "+profileLink(detail.b)+" +"+detail.bp+' → '+spriteLabel(forward.resultIndex, named(forward.resultIndex))+'</h3><p>'+safe(forward.detail||forward.condition)+" Base table: "+safe(named(forward.baseIndex))+'.</p><p><strong>Reversed parents:</strong> '+spriteLabel(reverse.resultIndex, named(reverse.resultIndex))+" · "+safe(ruleLabel(reverse))+'.</p>';
    if (cell.hasAttribute("data-owned-a")) {
      const team = activeTeam();
      const a = team.entries.find(entry=>entry.id===cell.dataset.ownedA), b = team.entries.find(entry=>entry.id===cell.dataset.ownedB);
      if (a && b) {
        const forecast = resistanceForecast(team,a,b,forward.resultIndex,detail.context);
        if (Number.isInteger(forecast.plus)) P("planner-pair-detail-body").querySelector("h3").append(' +'+forecast.plus);
        P("planner-pair-detail-body").insertAdjacentHTML("beforeend",
          '<p class="hint">Pedigree · '+safe(memberName(a))+' &nbsp; Mate · '+safe(memberName(b))+'</p>'+resistanceMarkup(forecast));
      }
    }
    P("planner-pair-detail").hidden = false;
    P("planner-pair-dialog").showModal();
  }
  function setPlannerTab(name, focus = false) {
    activeTab = name;
    for (const mode of PLANNER_TABS) {
      P("planner-"+mode).hidden = mode !== name;
      const tab = P("planner-tab-"+mode);
      tab.setAttribute("aria-selected", String(mode === name)); tab.tabIndex = mode === name ? 0 : -1;
    }
    hidePairDetail();
    if (name === "targets") { renderTargets(); renderPlan(); }
    if (name === "breeding") renderBreeding();
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
    const breed = event.target.closest("button[data-member-breed]");
    if (breed) {
      const member = team.entries.find(e=>e.id===breed.dataset.memberBreed);
      if (!member) return;
      P("planner-breeding-include-farm").checked = true;
      P("planner-breeding-member").value = member.id;
      P("planner-breeding-partner").value = "";
      P("planner-breeding-view").value = "list";
      P("planner-result-search").value = "";
      breedingPage = 0;
      DQMViews.go("team-planner",{params:new URLSearchParams({tab:"breeding"}),focusId:"planner-tab-breeding"});
    } else if (favorite) {
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
      const target = document.querySelector('button[data-member-edit="'+member.id+'"]');
      if (target) target.focus({preventScroll: true});
    } else if (move) {
      const member = team.entries.find(e => e.id === move.dataset.memberMove);
      if (!member) return;
      const location = otherLocation(entryLocation(member));
      commit(app.updateEntry(state, team.id, member.id, {location}), "Moved "+memberName(member)+" to the "+location+". Nickname, sex, and + value kept.");
      const target = document.querySelector('button[data-member-edit="'+member.id+'"]');
      if (target) target.focus({preventScroll: true});
    } else if (edit) {
      const member = team.entries.find(e => e.id === edit.dataset.memberEdit);
      if (!member) return;
      openEditor(member);
    }
  }

  // ---- teams panel ----
  function openTeamForm(mode) {
    P("manage-teams").open = true;
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
  function closeTeamSettings(focus = false) {
    P("manage-teams").open = false;
    if (focus) P("manage-teams").querySelector("summary").focus({preventScroll:true});
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

  // ---- PSX save import ----
  function setupSaveImport() {
    const input = P("save-import-file"), select = P("save-import-slot");
    const status = P("save-import-status"), preview = P("save-import-preview");
    const summary = P("save-import-summary"), useNames = P("save-import-nicknames");
    const apply = P("save-import-apply");
    let saves = [], generation = 0;
    function clear() {
      generation++;
      saves = [];
      input.value = "";
      select.replaceChildren();
      summary.replaceChildren();
      preview.hidden = true;
      status.textContent = "";
    }
    function renderPreview() {
      const save = saves[select.selectedIndex];
      const party = save.entries.filter(e => e.location === "party").length;
      const counts = save.skipped;
      const notes = [counts.eggs && counts.eggs + " unhatched eggs", counts.unavailable && counts.unavailable + " unavailable records",
        counts.unsupported && counts.unsupported + " species outside the standard roster"].filter(Boolean);
      const skipped = notes.length ? "<p>Excluded from the team: " + safe(notes.join(", ")) + ".</p>" : "";
      const names = useNames.checked && save.unreadableNames ? "<p>Using species names for " + save.unreadableNames + " unreadable nicknames.</p>" : "";
      const rows = save.entries.map(e => "<tr><th scope=\"row\">" + profileLink(e.speciesIndex) +
        (useNames.checked && e.nickname ? " · " + safe(e.nickname) : "") + "</th><td>" + (e.location === "party" ? "Party" : "Farm") +
        "</td><td>" + (e.sex === "male" ? "Male" : "Female") + "</td><td>" + e.level + "</td><td>+" + e.plus + "</td></tr>").join("");
      summary.innerHTML = "<p><strong>" + party + " party · " + (save.entries.length - party) + " farm</strong> (ranch and storage)</p>" +
        skipped + names + (rows ? '<details><summary>Review monsters (' + save.entries.length + ')</summary><div class="table-scroll"><table>' +
        '<caption class="sr-only">Monsters in this save</caption><thead><tr><th scope="col">Monster</th><th scope="col">Location</th>' +
        '<th scope="col">Sex</th><th scope="col">Level</th><th scope="col">Plus</th></tr></thead><tbody>' + rows + "</tbody></table></div></details>" : "");
      apply.disabled = !rows;
    }
    input.addEventListener("change", async () => {
      const file = input.files[0];
      clear();
      if (!file) return;
      if (!P("save-import-dialog").open) P("save-import-dialog").showModal();
      const request = generation;
      try {
        if (!DQMSaveImport.acceptedSizes.includes(file.size)) throw new Error("Choose a raw 128 KiB card, an 8 KiB save block, or an .mcs single-save export.");
        const bytes = await file.arrayBuffer();
        if (request !== generation) return;
        const result = DQMSaveImport.read(bytes, DATA.species);
        saves = result.saves;
        for (const s of saves) {
          const prefix = s.slot === null ? "" : "Slot " + s.slot + " · ";
          const playtime = s.hours + "h " + s.minutes + "m";
          select.add(new Option(prefix + s.campaign + " · " + playtime));
        }
        preview.hidden = false;
        status.textContent = [saves.length === 1 ? "One save found." : saves.length + " saves found. Choose a slot.", ...result.errors].join(" ");
        renderPreview();
        select.focus({preventScroll: true});
      } catch (error) {
        if (request === generation) status.textContent = error.message;
      }
    });
    select.addEventListener("change", renderPreview);
    useNames.addEventListener("change", renderPreview);
    P("save-import-cancel").addEventListener("click", () => {
      clear();
      P("save-import-dialog").close();
    });
    P("planner-close-import").addEventListener("click",()=>{clear();P("save-import-dialog").close();});
    P("save-import-dialog").addEventListener("cancel",clear);
    apply.addEventListener("click", () => {
      const save = saves[select.selectedIndex];
      if (!save || !save.entries.length) return;
      const name = save.campaign + (save.slot === null ? " · Save" : " · Slot " + save.slot);
      try {
        const team = {id: app.makeId("t-"), name, game: save.game, campaign:save.campaignKey, targets: [], activeTargetId: null,
          entries: save.entries.map(e => ({...e, id: app.makeId("m-"), favorite: false, nickname: useNames.checked ? e.nickname : ""}))};
        const next = app.insertTeam(state, team);
        commit(app.setActiveGame(app.setActiveTeam(next, team.id), save.game), "Imported " + team.entries.length + " monsters into " + name + ".");
        clear();
        P("save-import-dialog").close();
        // Complete the import at the collection itself, with the first monster
        // in view, instead of returning to the setup controls above it.
        const rosterHeading = team.entries.some(entry => entryLocation(entry) === "party") ? "planner-party-heading" : "planner-farm-heading";
        DQMViews.go("team-planner",{params:new URLSearchParams({tab:"roster"}),focusId:rosterHeading});
      } catch (error) { status.textContent = error.message; }
    });
  }

  setupSaveImport();

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
  for (const id of ["planner-row-family","planner-column-family"]) setFamilies(id);
  refreshAddSpecies(11);
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
    } catch (error) { P("planner-entry-error").textContent = error.message; }
  });
  P("planner-cancel-edit").addEventListener("click", () => { cancelEdit(); notice("Edit cancelled."); });
  P("planner-close-editor").addEventListener("click",cancelEdit);
  P("planner-entry-dialog").addEventListener("cancel",event=>{event.preventDefault();cancelEdit();});
  P("planner-open-add").addEventListener("click",()=>openEditor());
  const openImport=()=>{ if (!P("save-import-dialog").open) P("save-import-dialog").showModal(); };
  P("planner-open-import").addEventListener("click",openImport);
  for (const button of document.querySelectorAll('[data-planner-open]')) button.addEventListener("click",()=>button.dataset.plannerOpen==='import'?openImport():openEditor());
  P("planner-party").addEventListener("click", cardAction);
  P("planner-combo-results").addEventListener("change",event=>{
    const slot = event.target.closest("select[data-combo-slot]");
    if (!slot) return;
    comboSlots[Number(slot.dataset.comboSlot)] = slot.value;
    renderPartyCombos();
    P('planner-combo-results').querySelector('[data-combo-slot="'+slot.dataset.comboSlot+'"]').focus({preventScroll:true});
  });
  P("planner-farm").addEventListener("click", cardAction);
  for (const id of ["planner-roster-location","planner-roster-sex","planner-roster-sort"]) P(id).addEventListener("change",renderRoster);
  P("planner-roster-search").addEventListener("input",renderRoster);
  P("planner-clear-filters").addEventListener("click",()=>{resetRosterFilters();renderRoster();P("planner-roster-search").focus({preventScroll:true});});
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
      closeTeamForm();
      closeTeamSettings();
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
        closeTeamForm();
        closeTeamSettings();
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
      closeTeamSettings(true);
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
      closeTeamSettings(true);
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
    closeTeamForm();
    closeTeamSettings(true);
  });
  document.addEventListener("pointerdown", event => {
    for (const menu of document.querySelectorAll("#manage-teams[open], .planner-card-more[open]")) {
      if (!menu.contains(event.target)) menu.open = false;
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    const menu = document.querySelector("#manage-teams[open], .planner-card-more[open]");
    if (!menu) return;
    event.preventDefault();
    menu.open = false;
    menu.querySelector("summary").focus({preventScroll:true});
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
    tab.addEventListener("click", () => {
      setPlannerTab(mode);
      if (location.hash.startsWith("#team-planner")) history.replaceState(null,"","#team-planner?tab="+mode);
    });
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
  for (const id of ["planner-context","planner-breeding-member","planner-breeding-partner","planner-breeding-view"]) P(id).addEventListener("change", () => {
    if (id==="planner-breeding-member") P("planner-breeding-partner").value = "";
    hidePairDetail(); breedingPage=malePage=femalePage=0; renderBreeding();
  });
  P("planner-selected-pair").addEventListener("click",event=>{
    if (!event.target.closest("[data-swap-saved-pair]")) return;
    const first = P("planner-breeding-member"), second = P("planner-breeding-partner");
    const original = first.value;
    first.value = second.value;
    renderBreeding(original);
    P("planner-selected-pair").querySelector("[data-swap-saved-pair]").focus({preventScroll:true});
  });
  P("planner-result-search").addEventListener("input",()=>{breedingPage=0;renderBreeding();});
  P("planner-breeding-include-farm").addEventListener("change", () => {
    hidePairDetail();
    breedingPage=malePage=femalePage=0;
    renderBreeding();
  });
  P("planner-team-results-prev").addEventListener("click",()=>{breedingPage--;renderBreeding();});
  P("planner-team-results-next").addEventListener("click",()=>{breedingPage++;renderBreeding();});
  P("planner-team-results").addEventListener("click",showDetail);
  P("planner-close-pair").addEventListener("click",hidePairDetail);
  P("planner-male-prev").addEventListener("click", () => { malePage--; renderBreeding(); });
  P("planner-male-next").addEventListener("click", () => { malePage++; renderBreeding(); });
  P("planner-female-prev").addEventListener("click", () => { femalePage--; renderBreeding(); });
  P("planner-female-next").addEventListener("click", () => { femalePage++; renderBreeding(); });
  for (const prefix of ["row","column"]) {
    for (const suffix of ["search","family","plus"]) P("planner-"+prefix+"-"+suffix).addEventListener(suffix === "family" ? "change" : "input", () => {
      if (prefix === "row" || P("matrix-view").value === "list") rowPage = 0; else columnPage = 0;
      hidePairDetail(); renderEverything();
    });
    P("planner-"+prefix+"-prev").addEventListener("click", () => { if (prefix === "row") rowPage--; else columnPage--; renderEverything(); });
    P("planner-"+prefix+"-next").addEventListener("click", () => { if (prefix === "row") rowPage++; else columnPage++; renderEverything(); });
  }
  for (const id of ["matrix-result-search","matrix-view","matrix-page-size"]) P(id).addEventListener(id === "matrix-result-search" ? "input" : "change", () => {
    rowPage = 0; columnPage = 0; hidePairDetail(); renderEverything();
  });
  P("matrix-reset").addEventListener("click", () => {
    for (const axis of ["row","column"]) for (const field of ["search","family","plus"]) P("planner-"+axis+"-"+field).value = field === "plus" ? "0" : "";
    P("matrix-result-search").value = ""; rowPage = columnPage = 0; hidePairDetail(); renderEverything();
  });
  P("matrix-swap-axes").addEventListener("click", () => {
    for (const field of ["search","family","plus"]) {
      const row = P("planner-row-"+field), col = P("planner-column-"+field), value = row.value;
      row.value = col.value; col.value = value;
    }
    rowPage = columnPage = 0; hidePairDetail(); renderEverything();
  });
  P("planner-all-context").addEventListener("change", () => { hidePairDetail(); renderEverything(); });
  for (const id of ["planner-male-grid","planner-female-grid","planner-all-grid"]) P(id).addEventListener("click", showDetail);
  P("planner-copy-pairing").addEventListener("click", () => {
    const text = P("planner-copy-pairing").dataset.copyText || "";
    if (!text) return;
    const feedback = message => {
      P("planner-pair-copy-status").textContent = message;
      notice(message);
    };
    const done = () => feedback("Copied: " + text);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(done, () => feedback(text));
    } else {
      try {
        const area = document.createElement("textarea");
        area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.opacity = "0";
        P("planner-pair-dialog").append(area); area.select(); document.execCommand("copy"); area.remove(); done();
      } catch (error) { feedback(text); }
    }
  });
  P("planner-inspect-reference").addEventListener("click", () => {
    if (!detail) return;
    hidePairDetail();
    DQMReference.openPair(detail);
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
    DQMViews.go("team-planner", { params:{tab:"targets"}, focusId: "plan-heading" });
  });
  P("target").addEventListener("change", renderTargets);
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
    openTreePlan,
    // Called by js/router.js once this view is displayed, so the active tab
    // and its panels are current whenever the planner comes back into view.
    viewShown: id => {
      hidePairDetail();
      if (id !== "team-planner") {
        cancelEdit();
        P("save-import-dialog").close();
      }
      if (id === "team-planner") {
        movePairDetail("planner-team-detail-host");
        const query = new URLSearchParams(location.hash.split("?")[1]);
        const tab = query.get("tab");
        const showCombos = query.get('combos') === 'party';
        setPlannerTab(!showCombos && PLANNER_TABS.includes(tab) ? tab : "roster");
        renderPartyCombos();
        if (showCombos) P('planner-party-combos').open = true;
        if (query.get("import")==="save") openImport();
        if (query.get("manage")==="teams") P("manage-teams").open=true;
      } else if (id === "breeding-table") {
        movePairDetail("planner-all-detail-host");
        renderEverything();
      }
    },
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
  window.DQMMonsterPicker?.attach(P("planner-add-species"), {label:"Monster"});
})();

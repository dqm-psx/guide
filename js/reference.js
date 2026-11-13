"use strict";

const RULES = DATA.runtime_rules?.rules ?? [];
const byId = new Map(DATA.species.map(s => [Number(s.index), s]));
const $ = id => document.getElementById(id);
const PAGE_SIZE = 40;
let reversePage = 0, speciesPage = 0;
let reverseMatches = [], speciesMatches = [];
let reverseConditional = { plus: [], room: [] };
let sessionReady = false;
let lastForwardIndex = null, lastReverseIndex = null;
const normalize = value => String(value ?? "").toLocaleLowerCase().normalize("NFKC").replace(/[\s’'·-]+/g, "");
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const isPlayable = s => s.playable !== false;
// Released acquisition routes can expose a species without treating its raw
// breeding-table slot as part of the independently verified standard roster.
const patchRewards = s => globalThis.DQM_PATCH_REWARDS?.species?.[s.index] || [];
const isLibrarySpecies = s => isPlayable(s) || patchRewards(s).length > 0;
const allSpecies = () => DATA.species.filter(s => $("show-internal").checked || isPlayable(s));
const hasApp = () => typeof DQMApp !== "undefined";
const isFavorite = index => hasApp() && DQMApp.isSpeciesFavorite(index);
const favoritesOnly = () => hasApp() && $("species-favorites-only").checked;
const displayName = s => s.display_name || s.name;
const nameLabel = s => displayName(s) + (s.short_name && s.short_name !== s.name ? " (" + s.short_name + ")" : "") + (!isPlayable(s) ? " [extra / internal]" : "");
const matchesName = (s, query) => !query || normalize([s.name,s.display_name,s.short_name,s.japanese,...(s.aliases || [])].join(" ")).includes(normalize(query));
const familyMatches = (s, family) => family === "" || String(s.family_id) === family;
const current = id => $(id).value === "" ? undefined : byId.get(Number($(id).value));
const familyName = id => { const family = DATA.families.find(f => f.id === id); return family ? (family.display_name || family.name) : "that"; };
const pairCore = DQMPlannerCore.create(DATA);
const pairContextNames = {shrine:'Ordinary shrine',room:'Two-save Breeding room',base:'Base table only'};
function normalizedPairSettings(value = {}) {
  const plus = number => Number.isInteger(number) && number >= 0 && number <= 255 ? number : 0;
  return {ap:plus(value.ap),bp:plus(value.bp),context:Object.hasOwn(pairContextNames,value.context) ? value.context : 'shrine'};
}
function readPairSettings() {
  const values = {};
  for (const [key,id,label] of [['ap','pair-pedigree-plus','Pedigree'],['bp','pair-mate-plus','Mate']]) {
    const field = $(id), number = field.valueAsNumber;
    const valid = Number.isInteger(number) && number >= 0 && number <= 255;
    field.setAttribute('aria-invalid',String(!valid));
    if (!valid) throw new Error(label+' + value must be a whole number from 0 to 255.');
    values[key] = number;
  }
  return {...values,context:$('pair-context').value};
}
function setPairSettings(value) {
  const settings = normalizedPairSettings(value);
  $('pair-pedigree-plus').value = settings.ap;
  $('pair-mate-plus').value = settings.bp;
  $('pair-context').value = settings.context;
}
function pairOutcome(a,b,settings) {
  if (!a || !b) return null;
  // Internal slots have only a raw matrix record, not verified runtime rules.
  if (!isPlayable(a) || !isPlayable(b)) return {resultIndex:DATA.matrix[a.index]?.[b.index],ruleKind:'base',internal:true};
  return pairCore.result(a.index,b.index,settings.ap,settings.bp,settings.context);
}

// ---- saved session (item 10) and shared URL (item 6) ----
// The session remembers pair finder selections and filters across reloads. A
// shared URL wins over the saved selections, so a link opens the same result
// even in a browser that has a different pair saved.
const session = typeof DQMSession !== "undefined" ? DQMSession.load() : {
  version: 1,
  pair: { a: null, b: null },
  pedigree: { family: "", search: "" },
  mate: { family: "", search: "" },
  target: null,
  reverse: { pedigreeFamily: "", mateFamily: "", search: "" },
  species: { search: "", family: "", favoritesOnly: false },
  showInternal: false,
  recent: [],
};
const RECENT_LIMIT = (typeof DQMSession !== "undefined" && DQMSession.MAX_RECENT) || 6;
function persistSession() { if (typeof DQMSession !== "undefined") DQMSession.save(session); }
function parseHash() {
  const raw = location.hash.replace(/^#/, "");
  const cut = raw.indexOf("?");
  const id = (cut === -1 ? raw : raw.slice(0, cut)).split(/[&/]/)[0].toLowerCase();
  return { id, params: new URLSearchParams(cut === -1 ? "" : raw.slice(cut + 1)) };
}
function paramIndex(params, key) {
  if (!params.has(key)) return null;
  const raw = params.get(key);
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function saveSession() {
  const a = current("pedigree"), b = current("mate"), target = current("target");
  try { session.pair = { a: a ? a.index : null, b: b ? b.index : null, ...readPairSettings() }; } catch {}
  session.target = target ? target.index : null;
  session.reverse = { pedigreeFamily: $("reverse-pedigree-family").value, mateFamily: $("reverse-mate-family").value, search: $("reverse-search").value };
  session.species = { search: $("species-search").value, family: $("species-family").value, favoritesOnly: $("species-favorites-only").checked };
  session.showInternal = $("show-internal").checked;
  persistSession();
}
function applySessionFilters() {
  $("show-internal").checked = session.showInternal === true;
  $("reverse-pedigree-family").value = session.reverse.pedigreeFamily;
  $("reverse-mate-family").value = session.reverse.mateFamily;
  $("reverse-search").value = session.reverse.search;
  $("species-search").value = session.species.search;
  $("species-family").value = session.species.family;
  $("species-favorites-only").checked = session.species.favoritesOnly === true;
}
// The URL only mirrors the pair while Find offspring is the open view. The
// router resolves the default (bare) and legacy hashes, so ask it before
// treating an empty hash as "not Find a pairing".
function currentViewId() {
  if (typeof DQMViews !== "undefined") return DQMViews.viewFor(location.hash);
  return parseHash().id;
}
function syncPairUrl() {
  if (!sessionReady || currentViewId() !== "pair-finder") return;
  const a = current("pedigree"), b = current("mate");
  const parts = [];
  if (a) parts.push("a=" + a.index);
  if (b) parts.push("b=" + b.index);
  const settings = readPairSettings();
  if (settings.ap) parts.push('ap='+settings.ap);
  if (settings.bp) parts.push('bp='+settings.bp);
  if (settings.context !== 'shrine') parts.push('context='+settings.context);
  const hash = "pair-finder" + (parts.length ? "?" + parts.join("&") : "");
  if (location.hash === "#" + hash) return;
  try { history.replaceState(null, "", "#" + hash); } catch (error) { /* file:// may refuse; the pair still works. */ }
}

// ---- empty-result recovery (item 11) ----
function chip(text) { return '<span class="filter-chip">' + escapeHTML(text) + '</span>'; }
function filterEmptyMarkup(message, chips, scope) {
  return '<div class="filter-empty"><p class="filter-empty-message">' + escapeHTML(message) + "</p>" +
    (chips.length ? '<p class="filter-empty-active">Active filters:</p><p class="filter-chips">' + chips.join("") + "</p>" : "") +
    '<button class="filter-clear" type="button" data-clear-filters="' + scope + '">Clear filters</button></div>';
}
function selectChip(select, label) {
  return select.value ? chip(label + ": " + select.options[select.selectedIndex].textContent) : "";
}
function reverseChips() {
  const chips = [];
  const pedigree = selectChip($("reverse-pedigree-family"), "Pedigree family");
  const mate = selectChip($("reverse-mate-family"), "Mate family");
  if (pedigree) chips.push(pedigree);
  if (mate) chips.push(mate);
  const search = $("reverse-search").value.trim();
  if (search) chips.push(chip("Parent name: " + search));
  return chips;
}
function speciesChips() {
  const chips = [];
  const family = selectChip($("species-family"), "Family");
  const search = $("species-search").value.trim();
  if (search) chips.push(chip("Name: " + search));
  if (family) chips.push(family);
  if (favoritesOnly()) chips.push(chip("Favorites only"));
  return chips;
}
function clearFilters(scope) {
  if (scope === "species") {
    $("species-search").value = ""; $("species-family").value = ""; $("species-favorites-only").checked = false;
    renderSpecies();
  } else if (scope === "reverse") {
    $("reverse-pedigree-family").value = ""; $("reverse-mate-family").value = ""; $("reverse-search").value = "";
    renderReverse();
  }
  saveSession();
}

// ---- recent pairings (item 9) ----
function renderRecent() {
  const container = $("recent-pairs"), list = $("recent-pairs-list");
  const items = session.recent.filter(item => byId.has(item.a) && byId.has(item.b));
  container.hidden = items.length === 0;
  list.innerHTML = items.map(item => {
    const a = byId.get(item.a), b = byId.get(item.b), settings = normalizedPairSettings(item);
    const result = byId.get(pairOutcome(a,b,settings)?.resultIndex);
    const specific = settings.ap || settings.bp || settings.context !== 'shrine';
    const label = displayName(a)+(specific?' +'+settings.ap:'') + " + " + displayName(b)+(specific?' +'+settings.bp:'') + " → " + (result ? displayName(result) : "Unmapped result")+(specific?' · '+pairContextNames[settings.context]:'');
    return '<li><button class="recent-pair" type="button" data-recent-a="' + item.a + '" data-recent-b="' + item.b + '" data-recent-ap="'+settings.ap+'" data-recent-bp="'+settings.bp+'" data-recent-context="'+settings.context+'">' + escapeHTML(label) + "</button></li>";
  }).join("");
}
function recordRecent() {
  const a = current("pedigree"), b = current("mate");
  if (!a || !b) return;
  const settings = readPairSettings();
  const list = session.recent.filter(item => !(item.a === a.index && item.b === b.index &&
    ['ap','bp','context'].every(key=>normalizedPairSettings(item)[key]===settings[key])));
  list.unshift({ a: a.index, b: b.index, ...settings });
  session.recent = list.slice(0, RECENT_LIMIT);
  persistSession();
  renderRecent();
}

// ---- copy pairing (item 17) ----
function matchedConditional(a, b) {
  const plus = plusRuleFor(a, b);
  const room = RULES.find(r => r.kind === "flag_gated" && r.pedigree_index === a.index && (r.mate_index === b.index || (r.mate_index == null && r.mate_family_index === b.family_id)));
  return { plus, room };
}
// A readable one-liner for chat or a forum. It says "base result" because a
// documented + value or Breeding room rule may change the outcome.
function pairingText() {
  const a = current("pedigree"), b = current("mate");
  if (!a || !b) return "";
  let settings;
  try { settings = readPairSettings(); } catch { return ''; }
  const outcome = pairOutcome(a,b,settings), result = byId.get(outcome?.resultIndex);
  const name = result ? displayName(result) : "Unmapped table result";
  if (settings.ap || settings.bp || settings.context !== 'shrine') {
    return 'Pedigree '+displayName(a)+' +'+settings.ap+' + Mate '+displayName(b)+' +'+settings.bp+' → '+name+
      ' ('+(outcome?.internal ? 'internal slot; base table only' : pairContextNames[settings.context])+')';
  }
  const { plus, room } = matchedConditional(a, b);
  const notes = [];
  if (plus) notes.push("+ rule gives " + displayName(byId.get(plus.offspring_index)) + " at +" + plus.minimum_parent_plus);
  if (room) notes.push("Breeding room rule gives " + displayName(byId.get(room.offspring_index)));
  const suffix = notes.length ? "(base result; " + notes.join("; ") + ")" : "(base result)";
  return "Pedigree " + displayName(a) + " + Mate " + displayName(b) + " → " + name + " " + suffix;
}
function fallbackCopy(text, done) {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    done();
  } catch (error) {
    $("copy-pairing-status").textContent = text;
  }
}
function copyPairing() {
  const text = pairingText();
  if (!text) return;
  $("copy-pairing").dataset.copyText = text;
  const done = () => { $("copy-pairing-status").textContent = "Copied: " + text; };
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

// ---- cross-tool actions (item 7) ----
function useSpeciesAs(role, index) {
  const species = byId.get(index);
  if (!species) return;
  const partner = role === "pedigree" ? current("mate") : current("pedigree");
  const a = role === "pedigree" ? index : (partner ? partner.index : index);
  const b = role === "mate" ? index : (partner ? partner.index : index);
  choosePair(a, b);
  DQMViews.go("pair-finder", { focusId: "result-name" });
}
function openPair(detail) {
  if (!byId.has(detail.a) || !byId.has(detail.b)) return false;
  choosePair(detail.a,detail.b,detail);
  const settings = normalizedPairSettings(detail), params = {a:detail.a,b:detail.b};
  if (settings.ap) params.ap = settings.ap;
  if (settings.bp) params.bp = settings.bp;
  if (settings.context !== 'shrine') params.context = settings.context;
  DQMViews.go('pair-finder',{focusId:'result-name',params});
  return true;
}
function openParents(index) {
  if (!byId.has(index)) return;
  selectTarget(index);
  $("target").dispatchEvent(new Event("change", {bubbles:true}));
  saveSession();
  DQMViews.go("offspring-finder", {focusId:"target-combobox", params:{target:index}});
}

function addGlossary(host) {
  if (host.querySelector(".lookup-glossary")) return;
  const glossary = $("lookup-glossary").cloneNode(true);
  glossary.removeAttribute("id");
  host.append(glossary);
}

function setOptions(id, species, selected) {
  const select = $(id), old = selected ?? select.value;
  select.replaceChildren();
  if (!species.length) {
    const option = document.createElement("option"); option.value = ""; option.textContent = "No matching species";
    select.append(option); select.disabled = true; window.DQMMonsterPicker?.get(select)?.refresh(); return;
  }
  select.disabled = false;
  for (const s of species) { const option = document.createElement("option"); option.value = s.index; option.textContent = nameLabel(s); select.append(option); }
  if (species.some(s => String(s.index) === String(old))) select.value = String(old);
  window.DQMMonsterPicker?.get(select)?.refresh();
}
function setFamilies(id) {
  const select = $(id), any = document.createElement("option"); any.value = ""; any.textContent = "All families"; select.append(any);
  for (const f of DATA.families) { const option = document.createElement("option"); option.value = f.id; option.textContent = f.display_name || f.name; select.append(option); }
}
function updateParent(id, selected) {
  setOptions(id, allSpecies(), selected);
}
function offspring(a, b) {
  if (!a || !b) return undefined;
  const value = DATA.matrix[a.index]?.[b.index];
  return value == null ? undefined : byId.get(Number(value));
}
function resultDetail(s) { return s ? (s.family_display || s.family) + (s.short_name && s.short_name !== s.name ? " · In game: " + s.short_name : "") + (!isPlayable(s) ? " · Extra / internal slot" : "") : "No named species mapping is available for this entry."; }
function renderPair() {
  const a = current("pedigree"), b = current("mate");
  let settings, error = '', outcome, reverseOutcome;
  try {
    settings = readPairSettings();
    outcome = pairOutcome(a,b,settings);
    reverseOutcome = pairOutcome(b,a,{...settings,ap:settings.bp,bp:settings.ap});
  } catch (problem) { error = problem.message; }
  const forward = byId.get(outcome?.resultIndex), reverse = byId.get(reverseOutcome?.resultIndex);
  const ready = !!a && !!b && !error;
  $('pair-result').querySelector('.kicker').textContent = outcome?.internal || settings?.context === 'base' ? 'Base offspring' : 'Offspring';
  $('pair-finder').querySelector('.pair-options .hint').textContent = settings?.context === 'base'
    ? 'Base table view ignores + values and Breeding room rules.' : 'Uses each parent’s current + value, before breeding.';
  $("pedigree-sprite").innerHTML = spriteMarkup(a?.index);
  $("mate-sprite").innerHTML = spriteMarkup(b?.index);
  $("result-sprite").innerHTML = spriteMarkup(forward?.index);
  $("reverse-sprite").innerHTML = spriteMarkup(reverse?.index);
  $("result-name").textContent = error ? 'Check parent + values' : ready ? (forward ? displayName(forward) : null) ?? "Unmapped table result" : "Choose two parents";
  $("reverse-name").textContent = ready ? (reverse ? displayName(reverse) : null) ?? "Unmapped table result" : "—";
  for (const [id, species] of [["result-name", forward], ["reverse-name", reverse]]) {
    if (!a || !b || !species) continue;
    const link = document.createElement("a");
    link.className = "monster-link";
    link.href = "#monster?id=" + species.index;
    link.textContent = displayName(species);
    $(id).replaceChildren(link);
  }
  $("result-detail").textContent = error || (ready ? resultDetail(forward) : "Select two species to see their offspring.");
  $("reverse-detail").textContent = ready ? resultDetail(reverse) : "";
  $("pair-description").textContent = ready ? displayName(a)+' +'+settings.ap+' × '+displayName(b)+' +'+settings.bp+(outcome?.internal?' · Internal slot · base table only':'') : '';
  $("pair-finder").querySelector("[data-parent-mode]").href = forward ? "#offspring-finder?target=" + forward.index : "#offspring-finder";
  $("reverse-comparison").textContent = ready ? (forward && reverse && forward.index === reverse.index ? "Same offspring in both orders." : displayName(b)+' +'+settings.bp+' × '+displayName(a)+' +'+settings.ap) : "";
  const plusRule = ready ? plusRuleFor(a, b) : undefined;
  $("pair-plus-note").hidden = !plusRule;
  $("pair-plus-note").textContent = plusRule ? plusRuleCondition(plusRule, true) : "";
  const roomRule = ready ? RULES.find(r => r.kind === "flag_gated" && r.pedigree_index === a.index && (r.mate_index === b.index || (r.mate_index == null && r.mate_family_index === b.family_id))) : undefined;
  $("pair-room-note").hidden = !roomRule;
  $("pair-room-note").textContent = roomRule ? settings.context === 'room' ? 'Breeding room rule applies to this pairing.' : "Title-screen Breeding room (between two saves): " + displayName(byId.get(roomRule.offspring_index)) + ". This room rule takes precedence over the base result and any + rule." : "";
  const reverseRoomRule = ready ? RULES.find(r => r.kind === "flag_gated" && r.pedigree_index === b.index && (r.mate_index === a.index || (r.mate_index == null && r.mate_family_index === a.family_id))) : undefined;
  $("reverse-room-note").hidden = !reverseRoomRule;
  $("reverse-room-note").textContent = reverseRoomRule ? settings.context === 'room' ? 'Breeding room rule applies to this pairing.' : "Title-screen Breeding room (between two saves): " + displayName(byId.get(reverseRoomRule.offspring_index)) + ". This room rule takes precedence over the reversed base result and any + rule." : "";
  $("swap").disabled = !ready;
  // The result feeds the two other tools: copy it, or jump to its other
  // parent combinations in Find parents (item 7).
  lastForwardIndex = a && b && forward ? forward.index : null;
  lastReverseIndex = a && b && reverse ? reverse.index : null;
  const findForward = $("result-find-parents");
  findForward.hidden = !(lastForwardIndex !== null && isPlayable(byId.get(lastForwardIndex)));
  findForward.textContent = lastForwardIndex !== null ? "Find parents for " + displayName(byId.get(lastForwardIndex)) + " ↗" : "Find parents ↗";
  const findReverse = $("reverse-find-parents");
  findReverse.hidden = !(lastReverseIndex !== null && isPlayable(byId.get(lastReverseIndex)));
  findReverse.textContent = lastReverseIndex !== null ? "Find parents for " + displayName(byId.get(lastReverseIndex)) + " ↗" : "Find parents ↗";
  const copyButton = $("copy-pairing");
  copyButton.disabled = !ready;
  copyButton.dataset.copyText = ready ? pairingText() : "";
  $("copy-pairing-status").textContent = "";
  if (sessionReady && !error) { recordRecent(); saveSession(); syncPairUrl(); }
}
function choosePair(a, b, settings = {}) {
  ensureSpeciesSelectable(a); ensureSpeciesSelectable(b);
  setPairSettings(settings);
  updateParent("pedigree", a); updateParent("mate", b); renderPair();
}
function renderMonster(s, marker = "") { return '<span class="monster-label">'+spriteMarkup(s.index)+'<span><span class="mon"><a class="monster-link" href="#monster?id=' + s.index + '">' + escapeHTML(displayName(s)) + '</a>' + marker + '</span><span class="detail">' + escapeHTML(s.family_display || s.family) + (s.short_name && s.short_name !== s.name ? " · " + escapeHTML(s.short_name) : "") + (!isPlayable(s) ? " · extra / internal" : "") + "</span></span></span>"; }
function plusRuleFor(a, b) {
  return RULES.find(rule => rule.kind === "plus_threshold" && rule.pedigree_index === a.index && rule.mate_index === b.index);
}
function plusRuleCondition(rule, includeBase) {
  const threshold = "+" + rule.minimum_parent_plus;
  const upgraded = displayName(byId.get(rule.offspring_index));
  const base = byId.get(DATA.matrix[rule.pedigree_index]?.[rule.mate_index]);
  const low = includeBase && base ? "both parents below " + threshold + " yield " + displayName(base) + "; " : "";
  return "Ordinary breeding: " + low + "either parent at " + threshold + " or higher yields " + upgraded + ". Check each parent separately; do not add their + values.";
}
function plusRuleSummary(rule, forBase) {
  const threshold = "+" + rule.minimum_parent_plus;
  if (!forBase) return "Ordinary breeding: either parent " + threshold + " or higher; do not add their + values.";
  const base = byId.get(DATA.matrix[rule.pedigree_index]?.[rule.mate_index]);
  return "Ordinary shrine: both below " + threshold + " give " + displayName(base) + "; either " + threshold + " or higher gives " + displayName(byId.get(rule.offspring_index)) + ".";
}
function plusRuleMarker(rule, forBase) {
  const threshold = "+" + rule.minimum_parent_plus;
  const label = forBase ? "below " + threshold + " for the base result" : "either parent at " + threshold + " or higher";
  return ' <sup class="breeding-rule-marker"><span aria-hidden="true">' + escapeHTML((forBase ? "<" : "") + threshold) + '</span><span class="sr-only"> (' + escapeHTML(label) + ")</span></sup>";
}
function pageControls(prefix, page, length) {
  const pages = Math.max(1, Math.ceil(length / PAGE_SIZE));
  $(prefix + "-range").textContent = length ? "Showing " + (page * PAGE_SIZE + 1).toLocaleString() + "–" + Math.min((page + 1) * PAGE_SIZE, length).toLocaleString() + " of " + length.toLocaleString() : "No entries to show";
  $(prefix + "-page").textContent = "Page " + (page + 1) + " / " + pages.toLocaleString();
  $(prefix + "-prev").disabled = page === 0; $(prefix + "-next").disabled = page + 1 >= pages;
}
// Conditional recipes that produce the desired offspring, shown in their own
// labeled groups beside the base table rows (item 8).
function conditionalGroups(target) {
  if (!target) return { plus: [], room: [] };
  return {
    plus: RULES.filter(r => r.kind === "plus_threshold" && r.offspring_index === target.index),
    room: RULES.filter(r => r.kind === "flag_gated" && r.offspring_index === target.index),
  };
}
function conditionalRowHtml(rule, isRoom) {
  const pedigree = byId.get(rule.pedigree_index);
  if (!pedigree) return "";
  const condition = isRoom ? rule.condition : plusRuleSummary(rule, false);
  const marker = isRoom ? "" : plusRuleMarker(rule, false);
  if (isRoom && rule.mate_index == null) {
    const label = "Any " + familyName(rule.mate_family_index) + "-family monster";
    return "<tr><td>" + renderMonster(pedigree) + "</td><td>" + escapeHTML(label) +
      '</td><td><p class="reverse-condition">' + escapeHTML(condition) + '</p><button class="pair-action" type="button" data-recipe-pedigree="' + pedigree.index + '" data-recipe-family="'+rule.mate_family_index+'" aria-label="Use ' + escapeHTML(displayName(pedigree)) + ' as pedigree">Use as pedigree ↗</button></td></tr>';
  }
  const mate = byId.get(rule.mate_index);
  if (!mate) return "";
  return "<tr><td>" + renderMonster(pedigree, marker) + "</td><td>" + renderMonster(mate, marker) +
    '</td><td><p class="reverse-condition breeding-rule-note">' + escapeHTML(condition) + '</p><button class="pair-action" type="button" data-recipe-a="' + pedigree.index + '" data-recipe-b="' + mate.index +
    '" data-recipe-plus="'+(isRoom?0:rule.minimum_parent_plus)+'" data-recipe-context="'+(isRoom?'room':'shrine')+'" aria-label="Try ' + escapeHTML(displayName(pedigree)) + " as pedigree and " + escapeHTML(displayName(mate)) + ' as mate">Try pair ↗</button></td></tr>';
}
function baseRowHtml(a, b) {
  const rule = plusRuleFor(a, b);
  const marker = rule ? plusRuleMarker(rule, true) : "";
  const condition = rule ? '<p class="reverse-condition breeding-rule-note">' + escapeHTML(plusRuleSummary(rule, true)) + "</p>" : "";
  return "<tr><td>" + renderMonster(a, marker) + "</td><td>" + renderMonster(b, marker) + '</td><td>' + condition + '<button class="pair-action" type="button" data-a="' + a.index + '" data-b="' + b.index + '" aria-label="Try ' + escapeHTML(displayName(a) + " as pedigree and " + displayName(b) + " as mate") + '">Try pair ↗</button></td></tr>';
}
function renderReversePage() {
  const baseRows = reverseMatches.slice(reversePage * PAGE_SIZE, (reversePage + 1) * PAGE_SIZE).map(([a,b]) => baseRowHtml(a, b)).join("");
  const isFirst = $("reverse-copy-mode").value === "first";
  const groups = [{ label: isFirst ? "Base table pairs · first copy" : "Base table pairs requiring the target", count: reverseMatches.length, body: baseRows, empty: current("target") ? filterEmptyMarkup("No base table pairs match these filters.", reverseChips(), "reverse") : "Choose a desired offspring to list parent pairs." }];
  if (reverseConditional.plus.length) groups.push({ label: "Confirmed + value recipes", count: reverseConditional.plus.length, body: reverseConditional.plus.map(r => conditionalRowHtml(r, false)).join(""), empty: "No + value recipes." });
  if (reverseConditional.room.length) groups.push({ label: "Breeding room recipes", count: reverseConditional.room.length, body: reverseConditional.room.map(r => conditionalRowHtml(r, true)).join(""), empty: "No Breeding room recipes." });
  $("reverse-rows").innerHTML = groups.map(group => {
    const header = '<tr class="reverse-group"><th colspan="3" scope="colgroup">' + escapeHTML(group.label) + " · " + group.count.toLocaleString() + "</th></tr>";
    const body = group.body || '<tr><td colspan="3" class="empty">' + group.empty + "</td></tr>";
    return header + body;
  }).join("");
  pageControls("reverse", reversePage, reverseMatches.length);
}
function renderReverse() {
  const target = current("target"), species = allSpecies(), pedigreeFamily = $("reverse-pedigree-family").value, mateFamily = $("reverse-mate-family").value, query = $("reverse-search").value;
  const pedigrees = species.filter(s => familyMatches(s, pedigreeFamily));
  const mates = species.filter(s => familyMatches(s, mateFamily));
  const first = [];
  const repeat = [];
  $("target-sprite").innerHTML = spriteMarkup(target?.index);
  if (target) for (const a of pedigrees) for (const b of mates) {
    if (DATA.matrix[a.index]?.[b.index] !== target.index || !(matchesName(a,query) || matchesName(b,query))) continue;
    (a.index === target.index || b.index === target.index ? repeat : first).push([a,b]);
  }
  const mode = $("reverse-copy-mode");
  const isFirst = mode.value === "first";
  reverseMatches = isFirst ? first : repeat;
  const conditional = conditionalGroups(target);
  const totals = [first.length, repeat.length];
  reverseConditional = {plus: [], room: []};
  for (const [group, rules] of Object.entries(conditional)) for (const rule of rules) {
    const a = byId.get(rule.pedigree_index);
    if (!pedigrees.includes(a)) continue;
    const partners = mates.filter(b => (rule.mate_index == null ? b.family_id === rule.mate_family_index : b.index === rule.mate_index) && (matchesName(a,query) || matchesName(b,query)));
    if (!partners.length) continue;
    const needsTarget = a.index === target.index || partners.every(b => b.index === target.index);
    totals[needsTarget ? 1 : 0]++;
    if (needsTarget !== isFirst) reverseConditional[group].push(rule);
  }
  mode.options[0].textContent = "For a first copy (" + totals[0].toLocaleString() + ")";
  mode.options[1].textContent = "Already have the target (" + totals[1].toLocaleString() + ")";
  $("target-tree").hidden = !target || !isPlayable(target);
  if (target) {
    $("target-tree").href = "#breeding-tree?target=" + target.index + "&context=shrine";
    $("offspring-finder").querySelector("[data-parent-mode]").href = "#offspring-finder?target=" + target.index;
  }
  reversePage = 0;
  const conditionalTotal = reverseConditional.plus.length + reverseConditional.room.length;
  $("reverse-count").textContent = reverseMatches.length.toLocaleString() + " base ordered pair" + (reverseMatches.length === 1 ? "" : "s") + (target ? " for " + displayName(target) : "") + (conditionalTotal ? " · " + conditionalTotal + " conditional recipe" + (conditionalTotal === 1 ? "" : "s") : "");
  renderReversePage();
}
function updateTarget(selected) { setOptions("target", allSpecies(), selected); renderReverse(); }
function selectTarget(index) {
  const species = byId.get(Number(index));
  if (!species) return;
  ensureSpeciesSelectable(index);
  if (currentTargetIndex() !== species.index) $("reverse-copy-mode").value = "first";
  updateTarget(species.index);
}
function currentTargetIndex() {
  const value = $("target").value;
  return value === "" ? null : Number(value);
}
function refresh() {
  const speciesPageIndex = speciesPage, reversePageIndex = reversePage;
  renderSpecies();
  renderReverse();
  speciesPage = Math.min(speciesPageIndex, Math.max(0, Math.ceil(speciesMatches.length / PAGE_SIZE) - 1));
  reversePage = Math.min(reversePageIndex, Math.max(0, Math.ceil(reverseMatches.length / PAGE_SIZE) - 1));
  renderSpeciesPage();
  renderReversePage();
}
function renderSpeciesPage() {
  $("species-rows").innerHTML = speciesMatches.slice(speciesPage * PAGE_SIZE, (speciesPage + 1) * PAGE_SIZE).map(s => {
    const favorite = isFavorite(s.index);
    const gift = !isPlayable(s) && patchRewards(s)[0];
    const star = '<td class="species-favorite-cell">' + (gift ? '' : '<button type="button" class="species-star" data-species-favorite="' + s.index + '" aria-pressed="' + favorite + '" aria-label="' + (favorite ? "Unfavorite " : "Favorite ") + escapeHTML(displayName(s)) + '"' + (isPlayable(s) && hasApp() ? "" : " disabled") + '>' + (favorite ? "★" : "☆") + '</button>') + '</td>';
    const actions = '<td class="species-actions-cell"><div class="species-actions">' + (gift
      ? '<a href="#field-guide?entry=' + escapeHTML(gift.entry) + '">' + escapeHTML(gift.title || 'How to get it') + '</a>'
      :
      '<button type="button" data-species-pedigree="' + s.index + '">Use as pedigree</button>' +
      '<button type="button" data-species-mate="' + s.index + '">Use as mate</button>' +
      '<button type="button" data-species-parents="' + s.index + '"' + (isPlayable(s) ? "" : " disabled") + ">Find parents</button>") +
      "</div></td>";
    return "<tr>" + star + "<td>" + spriteLabel(s.index,displayName(s)) + (gift ? '<span class="tag">Enhanced reward</span>' : !isPlayable(s) ? '<span class="tag internal">Extra / internal slot</span>' : "") + "</td><td>" + escapeHTML(s.short_name || s.name) + '</td><td><span class="tag">' + escapeHTML(s.family_display || s.family) + '</span></td><td lang="ja">' + escapeHTML(s.japanese || "—") + "</td>" + actions + "</tr>";
  }).join("") || '<tr><td colspan="6" class="empty">' + filterEmptyMarkup("No species match these filters.", speciesChips(), "species") + "</td></tr>";
  pageControls("species", speciesPage, speciesMatches.length);
}
function renderSpecies() {
  $("library-extra-slots").checked = $("show-internal").checked;
  speciesMatches = DATA.species.filter(s => ($("show-internal").checked || isLibrarySpecies(s)) && familyMatches(s, $("species-family").value) && matchesName(s, $("species-search").value) && (!favoritesOnly() || isFavorite(s.index)));
  const sort = $("species-sort")?.value || "id";
  if (sort !== "id") speciesMatches.sort((a,b) => (sort === "family" ? Number(a.family_id)-Number(b.family_id) : 0) || displayName(a).localeCompare(displayName(b)) || a.index-b.index);
  speciesPage = 0; $("species-count").textContent = speciesMatches.length + " matching species"; renderSpeciesPage();
}
for (const id of ["reverse-pedigree-family","reverse-mate-family","species-family"]) setFamilies(id);
for (const id of ["pedigree","mate"]) {
  $(id).addEventListener("change", () => { $('pair-'+id+'-plus').value = 0; renderPair(); });
}
for (const id of ['pair-pedigree-plus','pair-mate-plus']) $(id).addEventListener('input',renderPair);
$('pair-context').addEventListener('change',renderPair);
$("swap").addEventListener("click", () => {
  const settings = readPairSettings();
  choosePair(current("mate").index,current("pedigree").index,{...settings,ap:settings.bp,bp:settings.ap});
});
$("target").addEventListener("change", () => {
  $("reverse-copy-mode").value = "first";
  renderReverse();
  saveSession();
  if (sessionReady && currentViewId() === "offspring-finder") {
    try { history.replaceState(null, "", "#offspring-finder?target=" + currentTargetIndex()); } catch {}
  }
});
$("reverse-copy-mode").addEventListener("change", renderReverse);
for (const id of ["reverse-pedigree-family","reverse-mate-family"]) $(id).addEventListener("change", () => { renderReverse(); saveSession(); });
$("reverse-search").addEventListener("input", () => { renderReverse(); saveSession(); });
$("reverse-prev").addEventListener("click", () => { reversePage--; renderReversePage(); });
$("reverse-next").addEventListener("click", () => { reversePage++; renderReversePage(); });
$("species-sort").addEventListener("change", renderSpecies);
$("species-prev").addEventListener("click", () => { speciesPage--; renderSpeciesPage(); });
$("species-next").addEventListener("click", () => { speciesPage++; renderSpeciesPage(); });
$("species-search").addEventListener("input", () => { renderSpecies(); saveSession(); });
$("species-family").addEventListener("change", () => { renderSpecies(); saveSession(); });
// "Try pair" fills Find a pairing, which is a separate view. The selections are
// set first, then the router reveals and focuses the result, so the handoff
// also works when Find a pairing is already open.
$("reverse-rows").addEventListener("click", event => {
  const recipe = event.target.closest("button[data-recipe-a]");
  if (recipe) { openPair({a:Number(recipe.dataset.recipeA),b:Number(recipe.dataset.recipeB),ap:Number(recipe.dataset.recipePlus),context:recipe.dataset.recipeContext}); return; }
  const pedigreeOnly = event.target.closest("button[data-recipe-pedigree]");
  if (pedigreeOnly) {
    const pedigree = Number(pedigreeOnly.dataset.recipePedigree);
    const family = Number(pedigreeOnly.dataset.recipeFamily);
    const mate = current('mate')?.family_id === family ? current('mate') : allSpecies().find(species=>species.family_id === family);
    if (mate) openPair({a:pedigree,b:mate.index,context:'room'});
    return;
  }
  const button = event.target.closest("button[data-a]");
  if (!button) return;
  choosePair(Number(button.dataset.a), Number(button.dataset.b));
  DQMViews.go("pair-finder", { focusId: "result-name" });
});
$("show-internal").addEventListener("change", () => { updateParent("pedigree"); updateParent("mate"); renderPair(); updateTarget(); renderSpecies(); saveSession(); });
$("species-favorites-only").addEventListener("change", () => { renderSpecies(); saveSession(); });
$("species-rows").addEventListener("click", event => {
  const star = event.target.closest("button[data-species-favorite]");
  if (!star || !hasApp()) return;
  const message = DQMApp.toggleSpeciesFavorite(Number(star.dataset.speciesFavorite));
  if (typeof message === "string") $("species-message").textContent = message;
});
// Name-index actions (item 7) and the recovery / recent / copy controls
// (items 9, 11, 17) all route through one delegated listener.
document.addEventListener("click", event => {
  const clear = event.target.closest("button[data-clear-filters]");
  if (clear) { clearFilters(clear.dataset.clearFilters); return; }
  const pedigree = event.target.closest("button[data-species-pedigree]");
  if (pedigree) { useSpeciesAs("pedigree", Number(pedigree.dataset.speciesPedigree)); return; }
  const mate = event.target.closest("button[data-species-mate]");
  if (mate) { useSpeciesAs("mate", Number(mate.dataset.speciesMate)); return; }
  const parents = event.target.closest("button[data-species-parents]");
  if (parents) { openParents(Number(parents.dataset.speciesParents)); return; }
  const recent = event.target.closest("button[data-recent-a]");
  if (recent) { choosePair(Number(recent.dataset.recentA),Number(recent.dataset.recentB),{ap:Number(recent.dataset.recentAp),bp:Number(recent.dataset.recentBp),context:recent.dataset.recentContext}); saveSession(); return; }
  if (event.target.closest("#recent-pairs-clear")) { session.recent = []; persistSession(); renderRecent(); return; }
  if (event.target.closest("#copy-pairing")) { copyPairing(); return; }
  if (event.target.closest("#result-find-parents")) { if (lastForwardIndex !== null) openParents(lastForwardIndex); return; }
  if (event.target.closest("#reverse-find-parents")) { if (lastReverseIndex !== null) openParents(lastReverseIndex); return; }
});

// A shared link may name a species the recipient's saved filter hides, including
// an internal slot behind the show-internal toggle. The URL wins, so reveal the
// species when it is needed; compatible saved filters stay untouched.
function ensureSpeciesSelectable(index) {
  const species = byId.get(index);
  if (species && !isPlayable(species) && !$("show-internal").checked) {
    $("show-internal").checked = true;
    session.showInternal = true;
    return true;
  }
  return false;
}
function sharedSpecies(index, fallbackName, fallbackPosition) {
  if (index !== null && byId.has(index)) return byId.get(index);
  const base = allSpecies();
  return base.find(s => normalize(s.name) === fallbackName) || base[fallbackPosition] || base[0];
}
// A shared pairing takes precedence over the saved selections.
function applyPairParams(params) {
  const a = paramIndex(params, "a");
  const b = paramIndex(params, "b");
  if (a === null && b === null) return false;
  const revealedA = a !== null && ensureSpeciesSelectable(a);
  const revealedB = b !== null && ensureSpeciesSelectable(b);
  const pedigree = sharedSpecies(a, "slime", 0);
  const mate = sharedSpecies(b, "dracky", 1);
  updateParent("pedigree", pedigree.index);
  updateParent("mate", mate.index);
  setPairSettings({ap:Number(params.get('ap')),bp:Number(params.get('bp')),context:params.get('context')});
  if (sessionReady && (revealedA || revealedB)) {
    // Other mounted views also use the shared visibility setting. Startup
    // builds them below, but a same-document route needs to refresh them here.
    updateTarget();
    $("target").dispatchEvent(new Event("change", { bubbles: true }));
    renderSpecies();
  }
  return true;
}
function applyTargetParam(params) {
  const target = paramIndex(params, "target");
  if (target === null || !byId.has(target)) return false;
  selectTarget(target);
  // Notify the same listeners as an ordinary selection, including the planner's
  // pin label, availability, and target summary, and the saved reference session.
  $("target").dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

// ---- first render: a shared URL wins over the saved session ----
applySessionFilters();
const initialRoute = parseHash();
const hasSessionPair = session.pair.a !== null || session.pair.b !== null;
if (applyPairParams(initialRoute.params)) {
  // The shared URL supplied the pair.
} else if (hasSessionPair) {
  setPairSettings(session.pair);
  updateParent("pedigree", session.pair.a);
  updateParent("mate", session.pair.b);
} else {
  const base = allSpecies();
  const a = base.find(s => normalize(s.name) === "slime") || base[0];
  const b = base.find(s => normalize(s.name) === "dracky") || base[1] || base[0];
  updateParent("pedigree", a.index);
  updateParent("mate", b.index);
}
renderPair();
const chosenA = current("pedigree"), chosenB = current("mate");
const sharedTarget = paramIndex(initialRoute.params, "target");
const wantedTarget = (initialRoute.id === "offspring-finder" && sharedTarget !== null) ? sharedTarget : session.target;
if (wantedTarget !== null && byId.has(wantedTarget)) selectTarget(wantedTarget);
else updateTarget(offspring(chosenA, chosenB)?.index);
renderSpecies();
addGlossary($("pair-finder"));
addGlossary($("breeding-table"));
for (const [id, label] of [["pedigree","Pedigree"],["mate","Mate"],["target","Desired offspring"]]) {
  DQMMonsterPicker.attach($(id), {label});
}
sessionReady = true;
// Startup is not the only source of parameters: a same-document link, Back, or
// Forward changes the hash without reloading, so re-apply the route's pair or
// offspring target here too. A bare view hash carries no parameters and leaves
// the current in-memory selections alone.
window.addEventListener("hashchange", () => {
  if (!sessionReady) return;
  const route = parseHash();
  if (route.id === "offspring-finder") { applyTargetParam(route.params); return; }
  if (applyPairParams(route.params)) renderPair();
});
renderRecent();
function sourceSummaryMarkup() {
  const metadata = (globalThis.MONSTER_REFERENCE || globalThis.BREEDING_NAMES)?.metadata || {};
  const patch = metadata.current_patch;
  const proof = metadata.gameplay_verification;
  const revision = metadata.public_revision;
  const snapshot = metadata.updated_at ? String(metadata.updated_at).slice(0, 10) : 'Not recorded';
  const sourceLink = /^[a-f0-9]{40}$/.test(revision || '')
    ? ' <a href="https://github.com/dqm-psx/translations/tree/' + revision + '">View published source ↗</a>' : '';
  const patchLabel = patch ? '<a href="https://github.com/dqm-psx/patch/releases/tag/' + encodeURIComponent(patch.version) + '">' + escapeHTML(patch.version) + '</a>' : 'Not supplied by this snapshot';
  return '<dl class="source-versions"><div><dt>Latest English patch</dt><dd>' + patchLabel + '</dd></div>' +
    '<div><dt>Names &amp; text snapshot</dt><dd>' + escapeHTML(snapshot) + sourceLink + '</dd></div>' +
    '<div><dt>Breeding &amp; stats last verified</dt><dd>' + escapeHTML(proof?.version || metadata.gameplay_version || DATA.metadata.version) + '</dd></div></dl>' +
    (proof ? '<p class="hint">' + escapeHTML(proof.scope) + '</p>' : '<p class="hint">Gameplay retains its original extraction. A current wording snapshot is not a new gameplay verification.</p>') +
    (patch && proof && patch.version !== proof.version ? '<p class="hint">The latest release has not yet had a separate gameplay verification.</p>' : '');
}
$("source-version-summary").innerHTML = sourceSummaryMarkup();
$("coverage-summary").textContent = DATA.species.length.toLocaleString() + " table slots; " + DATA.species.filter(isPlayable).length.toLocaleString() + " standard roster entries; " + DATA.families.length + " families; " + DATA.matrix.reduce((n,row) => n + row.length, 0).toLocaleString() + " ordered base entries.";
$("source-metadata").textContent = JSON.stringify({ current_reference: (globalThis.MONSTER_REFERENCE || globalThis.BREEDING_NAMES)?.metadata, original_table_extraction: DATA.metadata, runtime_rules: DATA.runtime_rules }, null, 2);
window.DQMReference = Object.freeze({
  addGlossary,
  sourceSummaryMarkup,
  refresh,
  selectTarget,
  currentTargetIndex,
  useSpeciesAs,
  openPair,
  openParents,
  pairingText,
});

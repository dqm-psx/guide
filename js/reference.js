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
const allSpecies = () => DATA.species.filter(s => $("show-internal").checked || isPlayable(s));
const hasApp = () => typeof DQMApp !== "undefined";
const isFavorite = index => hasApp() && DQMApp.isSpeciesFavorite(index);
const favoritesOnly = () => hasApp() && $("species-favorites-only").checked;
const displayName = s => s.display_name || s.name;
const nameLabel = s => displayName(s) + (s.short_name && s.short_name !== s.name ? " (" + s.short_name + ")" : "") + (!isPlayable(s) ? " [extra / internal]" : "");
const matchesName = (s, query) => !query || normalize([s.name,s.display_name,s.short_name,s.japanese].join(" ")).includes(normalize(query));
const familyMatches = (s, family) => family === "" || String(s.family_id) === family;
const current = id => $(id).value === "" ? undefined : byId.get(Number($(id).value));
const familyName = id => { const family = DATA.families.find(f => f.id === id); return family ? (family.display_name || family.name) : "that"; };

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

function resetParentFilters() { for (const id of ["pedigree","mate"]) { $(id + "-family").value = ""; $(id + "-search").value = ""; } }
function saveSession() {
  const a = current("pedigree"), b = current("mate"), target = current("target");
  session.pair = { a: a ? a.index : null, b: b ? b.index : null };
  session.pedigree = { family: $("pedigree-family").value, search: $("pedigree-search").value };
  session.mate = { family: $("mate-family").value, search: $("mate-search").value };
  session.target = target ? target.index : null;
  session.reverse = { pedigreeFamily: $("reverse-pedigree-family").value, mateFamily: $("reverse-mate-family").value, search: $("reverse-search").value };
  session.species = { search: $("species-search").value, family: $("species-family").value, favoritesOnly: $("species-favorites-only").checked };
  session.showInternal = $("show-internal").checked;
  persistSession();
}
function applySessionFilters() {
  $("show-internal").checked = session.showInternal === true;
  $("pedigree-family").value = session.pedigree.family;
  $("pedigree-search").value = session.pedigree.search;
  $("mate-family").value = session.mate.family;
  $("mate-search").value = session.mate.search;
  $("reverse-pedigree-family").value = session.reverse.pedigreeFamily;
  $("reverse-mate-family").value = session.reverse.mateFamily;
  $("reverse-search").value = session.reverse.search;
  $("species-search").value = session.species.search;
  $("species-family").value = session.species.family;
  $("species-favorites-only").checked = session.species.favoritesOnly === true;
}
// The URL only mirrors the pair while Find a pairing is the open view, so a
// handoff from Find parents / My game still lands on a bare "#pair-finder". The
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
function filterEmptyInlineMarkup(message, chips, scope) {
  return '<span class="filter-empty-inline">' + escapeHTML(message) +
    (chips.length ? ' <span class="filter-chips">' + chips.join("") + "</span>" : "") +
    ' <button class="filter-clear" type="button" data-clear-filters="' + scope + '">Clear filters</button></span>';
}
function selectChip(select, label) {
  return select.value ? chip(label + ": " + select.options[select.selectedIndex].textContent) : "";
}
function parentChips(id) {
  const chips = [];
  const family = selectChip($(id + "-family"), "Family");
  const search = $(id + "-search").value.trim();
  if (family) chips.push(family);
  if (search) chips.push(chip("Name: " + search));
  return chips;
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
  } else if (scope === "target") {
    $("target-search").value = ""; updateTarget();
  } else if (scope === "pedigree" || scope === "mate") {
    $(scope + "-family").value = ""; $(scope + "-search").value = "";
    updateParent(scope); renderPair();
  }
  saveSession();
}

// ---- recent pairings (item 9) ----
function renderRecent() {
  const container = $("recent-pairs"), list = $("recent-pairs-list");
  const items = session.recent.filter(item => byId.has(item.a) && byId.has(item.b));
  container.hidden = items.length === 0;
  list.innerHTML = items.map(item => {
    const a = byId.get(item.a), b = byId.get(item.b), result = offspring(a, b);
    const label = displayName(a) + " + " + displayName(b) + " → " + (result ? displayName(result) : "Unmapped result");
    return '<li><button class="recent-pair" type="button" data-recent-a="' + item.a + '" data-recent-b="' + item.b + '">' + escapeHTML(label) + "</button></li>";
  }).join("");
}
function recordRecent() {
  const a = current("pedigree"), b = current("mate");
  if (!a || !b) return;
  const list = session.recent.filter(item => !(item.a === a.index && item.b === b.index));
  list.unshift({ a: a.index, b: b.index });
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
  const result = offspring(a, b);
  const name = result ? displayName(result) : "Unmapped table result";
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
function openParents(index) {
  if (!byId.has(index)) return;
  selectTarget(index);
  saveSession();
  DQMViews.go("offspring-finder", { focusId: "target" });
}

function setOptions(id, species, selected) {
  const select = $(id), old = selected ?? select.value;
  select.replaceChildren();
  if (!species.length) {
    const option = document.createElement("option"); option.value = ""; option.textContent = "No matching species";
    select.append(option); select.disabled = true; return;
  }
  select.disabled = false;
  for (const s of species) { const option = document.createElement("option"); option.value = s.index; option.textContent = nameLabel(s); select.append(option); }
  if (species.some(s => String(s.index) === String(old))) select.value = String(old);
}
function setFamilies(id) {
  const select = $(id), any = document.createElement("option"); any.value = ""; any.textContent = "All families"; select.append(any);
  for (const f of DATA.families) { const option = document.createElement("option"); option.value = f.id; option.textContent = f.display_name || f.name; select.append(option); }
}
function updateParent(id, selected) {
  const species = allSpecies().filter(s => familyMatches(s, $(id + "-family").value) && matchesName(s, $(id + "-search").value));
  setOptions(id, species, selected);
  const hint = $(id + "-hint");
  if (species.length) hint.textContent = species.length.toLocaleString() + " matching species";
  else hint.innerHTML = filterEmptyInlineMarkup("No monsters match these filters.", parentChips(id), id);
}
function offspring(a, b) {
  if (!a || !b) return undefined;
  const value = DATA.matrix[a.index]?.[b.index];
  return value == null ? undefined : byId.get(Number(value));
}
function resultDetail(s) { return s ? (s.family_display || s.family) + (s.short_name && s.short_name !== s.name ? " · In game: " + s.short_name : "") + (!isPlayable(s) ? " · Extra / internal slot" : "") : "No named species mapping is available for this entry."; }
function renderPair() {
  const a = current("pedigree"), b = current("mate"), forward = offspring(a,b), reverse = offspring(b,a);
  $("pedigree-sprite").innerHTML = spriteMarkup(a?.index);
  $("mate-sprite").innerHTML = spriteMarkup(b?.index);
  $("result-sprite").innerHTML = spriteMarkup(forward?.index);
  $("reverse-sprite").innerHTML = spriteMarkup(reverse?.index);
  $("result-name").textContent = a && b ? (forward ? displayName(forward) : null) ?? "Unmapped table result" : "Choose two parents";
  $("reverse-name").textContent = a && b ? (reverse ? displayName(reverse) : null) ?? "Unmapped table result" : "—";
  $("result-detail").textContent = a && b ? resultDetail(forward) : "Adjust the name or family filters to select two species.";
  $("reverse-detail").textContent = a && b ? resultDetail(reverse) : "";
  $("pair-description").textContent = a && b ? displayName(a) + " + " + displayName(b) : "";
  $("reverse-comparison").textContent = a && b ? (forward && reverse && forward.index === reverse.index ? "Both orders have the same base result." : "Reversed: " + displayName(b) + " + " + displayName(a)) : "";
  const plusRule = a && b ? plusRuleFor(a, b) : undefined;
  $("pair-plus-note").hidden = !plusRule;
  $("pair-plus-note").textContent = plusRule ? plusRuleCondition(plusRule, true) : "";
  const roomRule = a && b ? RULES.find(r => r.kind === "flag_gated" && r.pedigree_index === a.index && (r.mate_index === b.index || (r.mate_index == null && r.mate_family_index === b.family_id))) : undefined;
  $("pair-room-note").hidden = !roomRule;
  $("pair-room-note").textContent = roomRule ? "Title-screen Breeding room (between two saves): " + displayName(byId.get(roomRule.offspring_index)) + ". This room rule takes precedence over the base result and any + rule." : "";
  const reverseRoomRule = a && b ? RULES.find(r => r.kind === "flag_gated" && r.pedigree_index === b.index && (r.mate_index === a.index || (r.mate_index == null && r.mate_family_index === a.family_id))) : undefined;
  $("reverse-room-note").hidden = !reverseRoomRule;
  $("reverse-room-note").textContent = reverseRoomRule ? "Title-screen Breeding room (between two saves): " + displayName(byId.get(reverseRoomRule.offspring_index)) + ". This room rule takes precedence over the reversed base result and any + rule." : "";
  $("swap").disabled = !a || !b;
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
  copyButton.disabled = !a || !b;
  copyButton.dataset.copyText = a && b ? pairingText() : "";
  if (!a || !b) $("copy-pairing-status").textContent = "";
  if (sessionReady) { recordRecent(); saveSession(); syncPairUrl(); }
}
function choosePair(a, b) {
  resetParentFilters(); updateParent("pedigree", a); updateParent("mate", b); renderPair();
}
function selectParentWithFallback(id, index) {
  if (index === null || !byId.has(index)) { updateParent(id); return; }
  updateParent(id, index);
  const selected = current(id);
  if (!selected || selected.index !== index) {
    // The saved filter hid the saved species; show every name for that parent.
    $(id + "-family").value = ""; $(id + "-search").value = "";
    updateParent(id, index);
  }
}
function selectTargetWithFallback(index) {
  updateTarget(index);
  const selected = current("target");
  if (!selected || selected.index !== index) {
    $("target-search").value = "";
    updateTarget(index);
  }
}
function renderMonster(s, marker = "") { return '<span class="monster-label">'+spriteMarkup(s.index)+'<span><span class="mon">' + escapeHTML(displayName(s)) + marker + '</span><span class="detail">' + escapeHTML(s.family_display || s.family) + (s.short_name && s.short_name !== s.name ? " · " + escapeHTML(s.short_name) : "") + (!isPlayable(s) ? " · extra / internal" : "") + "</span></span></span>"; }
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
      '</td><td><p class="reverse-condition">' + escapeHTML(condition) + '</p><button class="pair-action" type="button" data-recipe-pedigree="' + pedigree.index + '" aria-label="Use ' + escapeHTML(displayName(pedigree)) + ' as pedigree">Use as pedigree ↗</button></td></tr>';
  }
  const mate = byId.get(rule.mate_index);
  if (!mate) return "";
  return "<tr><td>" + renderMonster(pedigree, marker) + "</td><td>" + renderMonster(mate, marker) +
    '</td><td><p class="reverse-condition breeding-rule-note">' + escapeHTML(condition) + '</p><button class="pair-action" type="button" data-recipe-a="' + pedigree.index + '" data-recipe-b="' + mate.index +
    '" aria-label="Try ' + escapeHTML(displayName(pedigree)) + " as pedigree and " + escapeHTML(displayName(mate)) + ' as mate">Try pair ↗</button></td></tr>';
}
function baseRowHtml(a, b) {
  const rule = plusRuleFor(a, b);
  const marker = rule ? plusRuleMarker(rule, true) : "";
  const condition = rule ? '<p class="reverse-condition breeding-rule-note">' + escapeHTML(plusRuleSummary(rule, true)) + "</p>" : "";
  return "<tr><td>" + renderMonster(a, marker) + "</td><td>" + renderMonster(b, marker) + '</td><td>' + condition + '<button class="pair-action" type="button" data-a="' + a.index + '" data-b="' + b.index + '" aria-label="Try ' + escapeHTML(displayName(a) + " as pedigree and " + displayName(b) + " as mate") + '">Try pair ↗</button></td></tr>';
}
function renderReversePage() {
  const baseRows = reverseMatches.slice(reversePage * PAGE_SIZE, (reversePage + 1) * PAGE_SIZE).map(([a,b]) => baseRowHtml(a, b)).join("");
  const groups = [{ label: "Base table pairs", count: reverseMatches.length, body: baseRows, empty: current("target") ? filterEmptyMarkup("No base table pairs match these filters.", reverseChips(), "reverse") : "Choose a desired offspring to list parent pairs." }];
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
  $("target-sprite").innerHTML = spriteMarkup(target?.index);
  reverseMatches = [];
  if (target) for (const a of pedigrees) for (const b of mates) if (DATA.matrix[a.index]?.[b.index] === target.index && (matchesName(a,query) || matchesName(b,query))) reverseMatches.push([a,b]);
  reverseConditional = conditionalGroups(target);
  reversePage = 0;
  const conditionalTotal = reverseConditional.plus.length + reverseConditional.room.length;
  $("reverse-count").textContent = reverseMatches.length.toLocaleString() + " base ordered pair" + (reverseMatches.length === 1 ? "" : "s") + (target ? " for " + displayName(target) : "") + (conditionalTotal ? " · " + conditionalTotal + " conditional recipe" + (conditionalTotal === 1 ? "" : "s") : "");
  renderReversePage();
}
function updateTarget(selected) { setOptions("target", allSpecies().filter(s => matchesName(s, $("target-search").value)), selected); renderReverse(); }
function selectTarget(index) {
  const species = byId.get(Number(index));
  if (!species) return;
  if (!matchesName(species, $("target-search").value)) $("target-search").value = "";
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
    const star = '<td class="species-favorite-cell"><button type="button" class="species-star" data-species-favorite="' + s.index + '" aria-pressed="' + favorite + '" aria-label="' + (favorite ? "Unfavorite " : "Favorite ") + escapeHTML(displayName(s)) + '"' + (isPlayable(s) && hasApp() ? "" : " disabled") + '>' + (favorite ? "★" : "☆") + "</button></td>";
    const actions = '<td class="species-actions-cell"><div class="species-actions">' +
      '<button type="button" data-species-pedigree="' + s.index + '">Use as pedigree</button>' +
      '<button type="button" data-species-mate="' + s.index + '">Use as mate</button>' +
      '<button type="button" data-species-parents="' + s.index + '"' + (isPlayable(s) ? "" : " disabled") + ">Find parents</button>" +
      "</div></td>";
    return "<tr>" + star + "<td>" + spriteLabel(s.index,displayName(s)) + (!isPlayable(s) ? '<span class="tag internal">Extra / internal slot</span>' : "") + "</td><td>" + escapeHTML(s.short_name || s.name) + '</td><td><span class="tag">' + escapeHTML(s.family_display || s.family) + '</span></td><td lang="ja">' + escapeHTML(s.japanese || "—") + "</td>" + actions + "</tr>";
  }).join("") || '<tr><td colspan="6" class="empty">' + filterEmptyMarkup("No species match these filters.", speciesChips(), "species") + "</td></tr>";
  pageControls("species", speciesPage, speciesMatches.length);
}
function renderSpecies() {
  speciesMatches = allSpecies().filter(s => familyMatches(s, $("species-family").value) && matchesName(s, $("species-search").value) && (!favoritesOnly() || isFavorite(s.index)));
  speciesPage = 0; $("species-count").textContent = speciesMatches.length + " matching species"; renderSpeciesPage();
}
for (const id of ["pedigree-family","mate-family","reverse-pedigree-family","reverse-mate-family","species-family"]) setFamilies(id);
for (const id of ["pedigree","mate"]) {
  $(id).addEventListener("change", renderPair);
  $(id + "-family").addEventListener("change", () => { updateParent(id); renderPair(); });
  $(id + "-search").addEventListener("input", () => { updateParent(id); renderPair(); });
}
$("swap").addEventListener("click", () => choosePair(current("mate").index, current("pedigree").index));
$("target").addEventListener("change", () => { renderReverse(); saveSession(); });
$("target-search").addEventListener("input", () => { updateTarget(); saveSession(); });
for (const id of ["reverse-pedigree-family","reverse-mate-family"]) $(id).addEventListener("change", () => { renderReverse(); saveSession(); });
$("reverse-search").addEventListener("input", () => { renderReverse(); saveSession(); });
$("reverse-prev").addEventListener("click", () => { reversePage--; renderReversePage(); });
$("reverse-next").addEventListener("click", () => { reversePage++; renderReversePage(); });
$("species-prev").addEventListener("click", () => { speciesPage--; renderSpeciesPage(); });
$("species-next").addEventListener("click", () => { speciesPage++; renderSpeciesPage(); });
$("species-search").addEventListener("input", () => { renderSpecies(); saveSession(); });
$("species-family").addEventListener("change", () => { renderSpecies(); saveSession(); });
// "Try pair" fills Find a pairing, which is a separate view. The selections are
// set first, then the router reveals and focuses the result, so the handoff
// also works when Find a pairing is already open.
$("reverse-rows").addEventListener("click", event => {
  const recipe = event.target.closest("button[data-recipe-a]");
  if (recipe) { choosePair(Number(recipe.dataset.recipeA), Number(recipe.dataset.recipeB)); DQMViews.go("pair-finder", { focusId: "result-name" }); return; }
  const pedigreeOnly = event.target.closest("button[data-recipe-pedigree]");
  if (pedigreeOnly) {
    const pedigree = Number(pedigreeOnly.dataset.recipePedigree);
    const mate = current("mate");
    choosePair(pedigree, mate ? mate.index : pedigree);
    DQMViews.go("pair-finder", { focusId: "result-name" });
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
  if (recent) { choosePair(Number(recent.dataset.recentA), Number(recent.dataset.recentB)); saveSession(); return; }
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
// Apply a shared pairing without discarding saved filters the requested species
// still satisfies; selectParentWithFallback clears only the filter that actually
// hides it. Returns false when the route names no pair to apply.
function applyPairParams(params) {
  const a = paramIndex(params, "a");
  const b = paramIndex(params, "b");
  if (a === null && b === null) return false;
  const revealedA = a !== null && ensureSpeciesSelectable(a);
  const revealedB = b !== null && ensureSpeciesSelectable(b);
  const pedigree = sharedSpecies(a, "slime", 0);
  const mate = sharedSpecies(b, "dracky", 1);
  selectParentWithFallback("pedigree", pedigree.index);
  selectParentWithFallback("mate", mate.index);
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
  selectTargetWithFallback(target);
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
  selectParentWithFallback("pedigree", session.pair.a);
  selectParentWithFallback("mate", session.pair.b);
} else {
  const base = allSpecies();
  const a = base.find(s => normalize(s.name) === "slime") || base[0];
  const b = base.find(s => normalize(s.name) === "dracky") || base[1] || base[0];
  resetParentFilters();
  updateParent("pedigree", a.index);
  updateParent("mate", b.index);
}
renderPair();
const chosenA = current("pedigree"), chosenB = current("mate");
const sharedTarget = paramIndex(initialRoute.params, "target");
const wantedTarget = (initialRoute.id === "offspring-finder" && sharedTarget !== null) ? sharedTarget : session.target;
if (wantedTarget !== null && byId.has(wantedTarget)) selectTargetWithFallback(wantedTarget);
else updateTarget(offspring(chosenA, chosenB)?.index);
renderSpecies();
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
$("coverage-summary").textContent = DATA.species.length.toLocaleString() + " table slots; " + DATA.species.filter(isPlayable).length.toLocaleString() + " standard roster entries; " + DATA.families.length + " families; " + DATA.matrix.reduce((n,row) => n + row.length, 0).toLocaleString() + " ordered base entries.";
$("source-metadata").textContent = JSON.stringify({ table: DATA.metadata, runtime_rules: DATA.runtime_rules }, null, 2);
window.DQMReference = Object.freeze({
  refresh,
  selectTarget,
  currentTargetIndex,
  useSpeciesAs,
  openParents,
  pairingText,
});

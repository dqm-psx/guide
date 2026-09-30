"use strict";

const RULES = DATA.runtime_rules?.rules ?? [];
const byId = new Map(DATA.species.map(s => [Number(s.index), s]));
const $ = id => document.getElementById(id);
const PAGE_SIZE = 40;
let reversePage = 0, speciesPage = 0;
let reverseMatches = [], speciesMatches = [];
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
  $(id + "-hint").textContent = species.length.toLocaleString() + " matching species";
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
  const plusRule = a && b ? RULES.find(r => r.kind === "plus_threshold" && r.pedigree_index === a.index && r.mate_index === b.index) : undefined;
  $("pair-plus-note").hidden = !plusRule;
  $("pair-plus-note").textContent = plusRule ? "Confirmed + rule: " + displayName(byId.get(plusRule.offspring_index)) + " if either parent is +" + plusRule.minimum_parent_plus + " or higher. See conditional results in Rules & guide." : "";
  const roomRule = a && b ? RULES.find(r => r.kind === "flag_gated" && r.pedigree_index === a.index && (r.mate_index === b.index || (r.mate_index == null && r.mate_family_index === b.family_id))) : undefined;
  $("pair-room-note").hidden = !roomRule;
  $("pair-room-note").textContent = roomRule ? "Title-screen Breeding room (between two saves): " + displayName(byId.get(roomRule.offspring_index)) + ". This room rule takes precedence over the base result and any + rule." : "";
  const reverseRoomRule = a && b ? RULES.find(r => r.kind === "flag_gated" && r.pedigree_index === b.index && (r.mate_index === a.index || (r.mate_index == null && r.mate_family_index === a.family_id))) : undefined;
  $("reverse-room-note").hidden = !reverseRoomRule;
  $("reverse-room-note").textContent = reverseRoomRule ? "Title-screen Breeding room (between two saves): " + displayName(byId.get(reverseRoomRule.offspring_index)) + ". This room rule takes precedence over the reversed base result and any + rule." : "";
  $("swap").disabled = !a || !b;
}
function resetParentFilters() { for (const id of ["pedigree","mate"]) { $(id + "-family").value = ""; $(id + "-search").value = ""; } }
function choosePair(a, b) {
  resetParentFilters(); updateParent("pedigree", a); updateParent("mate", b); renderPair();
}
function renderMonster(s) { return '<span class="monster-label">'+spriteMarkup(s.index)+'<span><span class="mon">' + escapeHTML(displayName(s)) + '</span><span class="detail">' + escapeHTML(s.family_display || s.family) + (s.short_name && s.short_name !== s.name ? " · " + escapeHTML(s.short_name) : "") + (!isPlayable(s) ? " · extra / internal" : "") + "</span></span></span>"; }
function pageControls(prefix, page, length) {
  const pages = Math.max(1, Math.ceil(length / PAGE_SIZE));
  $(prefix + "-range").textContent = length ? "Showing " + (page * PAGE_SIZE + 1).toLocaleString() + "–" + Math.min((page + 1) * PAGE_SIZE, length).toLocaleString() + " of " + length.toLocaleString() : "No entries to show";
  $(prefix + "-page").textContent = "Page " + (page + 1) + " / " + pages.toLocaleString();
  $(prefix + "-prev").disabled = page === 0; $(prefix + "-next").disabled = page + 1 >= pages;
}
function renderReversePage() {
  $("reverse-rows").innerHTML = reverseMatches.slice(reversePage * PAGE_SIZE, (reversePage + 1) * PAGE_SIZE).map(([a,b]) => "<tr><td>" + renderMonster(a) + "</td><td>" + renderMonster(b) + '</td><td><button class="pair-action" type="button" data-a="' + a.index + '" data-b="' + b.index + '" aria-label="Try ' + escapeHTML(displayName(a) + " as pedigree and " + displayName(b) + " as mate") + '">Try pair ↗</button></td></tr>').join("") || '<tr><td colspan="3" class="empty">No ordered pairs match these filters. Conditional breeding recipes are outside this table.</td></tr>';
  pageControls("reverse", reversePage, reverseMatches.length);
}
function renderReverse() {
  const target = current("target"), species = allSpecies(), pedigreeFamily = $("reverse-pedigree-family").value, mateFamily = $("reverse-mate-family").value, query = $("reverse-search").value;
  const pedigrees = species.filter(s => familyMatches(s, pedigreeFamily));
  const mates = species.filter(s => familyMatches(s, mateFamily));
  $("target-sprite").innerHTML = spriteMarkup(target?.index);
  reverseMatches = [];
  if (target) for (const a of pedigrees) for (const b of mates) if (DATA.matrix[a.index]?.[b.index] === target.index && (matchesName(a,query) || matchesName(b,query))) reverseMatches.push([a,b]);
  reversePage = 0;
  $("reverse-count").textContent = reverseMatches.length.toLocaleString() + " ordered pair" + (reverseMatches.length === 1 ? "" : "s") + (target ? " for " + displayName(target) : "");
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
    return "<tr>" + star + "<td>" + spriteLabel(s.index,displayName(s)) + (!isPlayable(s) ? '<span class="tag internal">Extra / internal slot</span>' : "") + "</td><td>" + escapeHTML(s.short_name || s.name) + '</td><td><span class="tag">' + escapeHTML(s.family_display || s.family) + '</span></td><td lang="ja">' + escapeHTML(s.japanese || "—") + "</td></tr>";
  }).join("") || '<tr><td colspan="5" class="empty">No species match these filters.</td></tr>';
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
$("target").addEventListener("change", renderReverse);
$("target-search").addEventListener("input", () => updateTarget());
for (const id of ["reverse-pedigree-family","reverse-mate-family"]) $(id).addEventListener("change", renderReverse);
$("reverse-search").addEventListener("input", renderReverse);
$("reverse-prev").addEventListener("click", () => { reversePage--; renderReversePage(); });
$("reverse-next").addEventListener("click", () => { reversePage++; renderReversePage(); });
$("species-prev").addEventListener("click", () => { speciesPage--; renderSpeciesPage(); });
$("species-next").addEventListener("click", () => { speciesPage++; renderSpeciesPage(); });
$("species-search").addEventListener("input", renderSpecies);
$("species-family").addEventListener("change", renderSpecies);
// "Try pair" fills Find a pairing, which is a separate view. The selections are
// set first, then the router reveals and focuses the result, so the handoff
// also works when Find a pairing is already open.
$("reverse-rows").addEventListener("click", event => { const button = event.target.closest("button[data-a]"); if (!button) return; choosePair(Number(button.dataset.a), Number(button.dataset.b)); DQMViews.go("pair-finder", { focusId: "result-name" }); });
$("show-internal").addEventListener("change", () => { updateParent("pedigree"); updateParent("mate"); renderPair(); updateTarget(); renderSpecies(); });
$("species-favorites-only").addEventListener("change", renderSpecies);
$("species-rows").addEventListener("click", event => {
  const star = event.target.closest("button[data-species-favorite]");
  if (!star || !hasApp()) return;
  const message = DQMApp.toggleSpeciesFavorite(Number(star.dataset.speciesFavorite));
  if (typeof message === "string") $("species-message").textContent = message;
});
const initialSpecies = allSpecies();
const initialA = initialSpecies.find(s => normalize(s.name) === "slime") ?? initialSpecies[0];
const initialB = initialSpecies.find(s => normalize(s.name) === "dracky") ?? initialSpecies[1] ?? initialSpecies[0];
choosePair(initialA.index, initialB.index);
updateTarget(offspring(initialA,initialB)?.index); renderSpecies();
$("coverage-summary").textContent = DATA.species.length.toLocaleString() + " table slots; " + DATA.species.filter(isPlayable).length.toLocaleString() + " standard roster entries; " + DATA.families.length + " families; " + DATA.matrix.reduce((n,row) => n + row.length, 0).toLocaleString() + " ordered base entries.";
$("source-metadata").textContent = JSON.stringify(DATA.metadata, null, 2);
function ruleName(rule, role) { const species = byId.get(rule[role + "_index"]); return species ? displayName(species) : rule[role + "_name"]; }
function renderRules() {
  const plus = RULES.filter(r => r.kind === "plus_threshold"), flagged = RULES.filter(r => r.kind === "flag_gated");
  $("conditional-rules").hidden = !RULES.length;
  $("plus-rules").innerHTML = plus.map(r => "<tr><td>" + spriteLabel(r.pedigree_index,ruleName(r,"pedigree")) + "</td><td>" + spriteLabel(r.mate_index,ruleName(r,"mate")) + '</td><td><span class="mon">' + spriteLabel(r.offspring_index,ruleName(r,"offspring")) + '</span></td><td>Either parent <strong>+' + r.minimum_parent_plus + " or higher</strong></td></tr>").join("");
  $("flag-rules").innerHTML = flagged.map(r => "<tr><td>" + spriteLabel(r.pedigree_index,ruleName(r,"pedigree")) + "</td><td>" + spriteLabel(r.mate_index,ruleName(r,"mate")) + "</td><td>" + spriteLabel(r.offspring_index,ruleName(r,"offspring")) + "</td></tr>").join("");
  $("flag-rules-title").textContent = flagged.length + " title-screen Breeding room rules (between two saves)";
  $("source-metadata").textContent = JSON.stringify({table:DATA.metadata,runtime_rules:DATA.runtime_rules}, null, 2);
}
renderRules();
window.DQMReference = Object.freeze({
  refresh,
  selectTarget,
  currentTargetIndex,
});

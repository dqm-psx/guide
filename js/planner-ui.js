(() => {
  "use strict";
  const core = DQMPlannerCore.create(DATA);
  const P = id => document.getElementById(id);
  const safe = escapeHTML;
  const rosterSpecies = DATA.species.filter(s => s.index < 315 && isPlayable(s));
  const STORAGE_KEY = "dqm-guide-team-v61-v1";
  const PAGE = 12;
  let state = {version:1,game:DQMPlannerCore.GAME_ID,entries:[]};
  let undoState = null, editing = null, detail = null;
  let malePage = 0, femalePage = 0, rowPage = 0, columnPage = 0;
  let activeTab = "roster", storageAvailable = true;
  const named = index => displayName(byId.get(index));
  const copy = value => JSON.parse(JSON.stringify(value));
  const memberName = entry => entry.nickname || named(entry.speciesIndex);
  const fullName = entry => (entry.nickname ? entry.nickname + " · " : "") + named(entry.speciesIndex) + " +" + entry.plus;
  const contextLabel = value => ({base:"Base table only",shrine:"Ordinary shrine",room:"Two-save Breeding room"})[value];
  const notice = message => { P("planner-message").textContent = message; };
  function makeId() {
    return "m-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,10);
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); storageAvailable = true; }
    catch { storageAvailable = false; }
    P("planner-save-status").textContent = storageAvailable
      ? "Saved in this browser. Export your team to keep a backup or use it in another browser."
      : "Browser saving is unavailable. Your team works for this session; export it to keep a copy.";
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = core.parseState(saved);
  } catch (error) {
    storageAvailable = false;
    notice("Could not load a saved team. You can build a new team or import a backup.");
  }
  function changeRoster(entries,message) {
    const next = core.normalizeState({...state,entries});
    undoState = copy(state); state = next;
    malePage = femalePage = 0;
    P("planner-undo").disabled = false;
    cancelEdit(); save(); renderRoster(); renderBreeding(); notice(message);
  }
  function cancelEdit() {
    editing = null;
    P("planner-add-button").textContent = "Add monster";
    P("planner-cancel-edit").hidden = true;
  }
  function filterSpecies(searchId,familyId) {
    return rosterSpecies.filter(s => matchesName(s,P(searchId).value) && familyMatches(s,P(familyId).value));
  }
  function refreshAddSpecies(selected) {
    setOptions("planner-add-species",filterSpecies("planner-add-search","planner-add-family"),selected);
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
  function renderRoster() {
    for (const sex of ["male","female"]) {
      const entries = state.entries.filter(e => e.sex === sex);
      P("planner-"+sex+"-count").textContent = entries.length;
      P("planner-"+sex+"s").innerHTML = entries.map(e => {
        const species = byId.get(e.speciesIndex);
        return '<article class="planner-card"><div class="planner-card-identity">'+spriteMarkup(e.speciesIndex)+'<div><h4 class="planner-card-name">'+safe(memberName(e))+'</h4><p class="planner-card-meta">'+safe((e.nickname ? named(e.speciesIndex)+" · " : "")+(species.family_display||species.family)+" · +"+e.plus)+'</p></div></div><div class="planner-card-actions"><button type="button" data-member-edit="'+safe(e.id)+'" aria-label="Edit '+safe(fullName(e))+'">Edit</button><button type="button" data-member-remove="'+safe(e.id)+'" aria-label="Remove '+safe(fullName(e))+'">Remove</button><button type="button" data-member-switch="'+safe(e.id)+'" aria-label="Switch '+safe(fullName(e))+' to '+(sex === "male" ? "female" : "male")+'">Switch sex</button></div></article>';
      }).join("") || '<p class="planner-empty">No '+sex+' monsters yet. Add one using the form above.</p>';
    }
    P("planner-team-summary").textContent = state.entries.length+" / "+DQMPlannerCore.MAX_ENTRIES+" monsters in your roster";
    P("planner-export").disabled = !state.entries.length;
  }
  function cardAction(event) {
    const remove = event.target.closest("button[data-member-remove]");
    const edit = event.target.closest("button[data-member-edit]");
    const switchSex = event.target.closest("button[data-member-switch]");
    if (remove) {
      const member = state.entries.find(e => e.id === remove.dataset.memberRemove);
      if (member) changeRoster(state.entries.filter(e => e.id !== member.id),"Removed "+memberName(member)+". Undo is available.");
    } else if (switchSex) {
      const member = state.entries.find(e => e.id === switchSex.dataset.memberSwitch);
      if (!member) return;
      const sex = member.sex === "male" ? "female" : "male";
      changeRoster(state.entries.map(e => e.id === member.id ? {...e,sex} : e),"Switched "+memberName(member)+" to "+sex+". Undo is available.");
      Array.from(P("planner-"+sex+"s").querySelectorAll("button[data-member-switch]")).find(button => button.dataset.memberSwitch === member.id)?.focus({preventScroll:true});
    } else if (edit) {
      const member = state.entries.find(e => e.id === edit.dataset.memberEdit);
      if (!member) return;
      editing = member.id;
      P("planner-add-search").value = ""; P("planner-add-family").value = "";
      refreshAddSpecies(member.speciesIndex);
      P("planner-sex-"+member.sex).checked = true;
      P("planner-add-plus").value = member.plus;
      P("planner-add-nickname").value = member.nickname;
      P("planner-add-button").textContent = "Save changes";
      P("planner-cancel-edit").hidden = false;
      P("planner-entry-form").scrollIntoView({behavior:"smooth",block:"start"});
      P("planner-add-species").focus({preventScroll:true});
      notice("Editing "+fullName(member)+".");
    }
  }
  function ruleLabel(result) {
    return result.ruleKind === "flag_gated" ? "Room rule" : result.ruleKind === "plus_threshold" ? "+ rule" : "Base result";
  }
  function pageRange(id,page,total,label) {
    const pages = Math.max(1,Math.ceil(total/PAGE));
    const text = total ? label+" "+(page*PAGE+1)+"–"+Math.min((page+1)*PAGE,total)+" of "+total : "No matching "+label.toLowerCase();
    P(id+"-range").textContent = text;
    P(id+"-prev").disabled = page === 0;
    P(id+"-next").disabled = page+1 >= pages;
  }
  function renderMatrix(targetId,rows,columns,context,query,caption) {
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
        const outcome = core.result(row.speciesIndex,column.speciesIndex,row.plus,column.plus,context);
        const visible = matchesName(byId.get(outcome.resultIndex),query);
        const description = fullName(row)+" as pedigree + "+fullName(column)+" as mate → "+named(outcome.resultIndex)+". "+contextLabel(context)+". "+ruleLabel(outcome)+".";
        html += '<td'+(!visible?' class="planner-nonmatch"':'')+'><button type="button" class="planner-cell" data-planner-pair data-a="'+row.speciesIndex+'" data-b="'+column.speciesIndex+'" data-ap="'+row.plus+'" data-bp="'+column.plus+'" data-context="'+context+'" aria-label="'+safe(description)+'">'+spriteMarkup(outcome.resultIndex)+'<span>'+safe(named(outcome.resultIndex))+'</span>'+(outcome.ruleKind!=='base'?'<small class="planner-rule">'+safe(ruleLabel(outcome))+'</small>':'')+'</button></td>';
      }
      html += '</tr>';
    }
    P(targetId).innerHTML = html+'</tbody></table>';
  }
  function renderBreeding() {
    const males = state.entries.filter(e => e.sex === "male"), females = state.entries.filter(e => e.sex === "female");
    const context = P("planner-context").value, query = P("planner-result-search").value;
    malePage = Math.max(0,Math.min(malePage,Math.max(0,Math.ceil(males.length/PAGE)-1)));
    femalePage = Math.max(0,Math.min(femalePage,Math.max(0,Math.ceil(females.length/PAGE)-1)));
    let matches = 0;
    for (const male of males) for (const female of females) {
      for (const [a,b] of [[male,female],[female,male]]) {
        const result = core.result(a.speciesIndex,b.speciesIndex,a.plus,b.plus,context);
        if (matchesName(byId.get(result.resultIndex),query)) matches++;
      }
    }
    const total = 2*males.length*females.length;
    P("planner-breeding-summary").textContent = total.toLocaleString()+" ordered pairings · "+contextLabel(context)+(query ? " · "+matches.toLocaleString()+" matching offspring; other cells are faded." : " · Select any result for details.");
    renderMatrix("planner-male-grid",males.slice(malePage*PAGE,(malePage+1)*PAGE),females,context,query,"Male pedigree and female mate: offspring by ordered pairing");
    renderMatrix("planner-female-grid",females.slice(femalePage*PAGE,(femalePage+1)*PAGE),males,context,query,"Female pedigree and male mate: offspring by ordered pairing");
    pageRange("planner-male",malePage,males.length,"Pedigrees");
    pageRange("planner-female",femalePage,females.length,"Pedigrees");
  }
  function renderEverything() {
    let rowPlus,columnPlus;
    try { rowPlus=readPlus("planner-row-plus"); columnPlus=readPlus("planner-column-plus"); }
    catch(error) {
      P("planner-all-summary").textContent=error.message; P("planner-all-grid").replaceChildren();
      for(const axis of ["row","column"]) {
        P("planner-"+axis+"-prev").disabled=true; P("planner-"+axis+"-next").disabled=true;
        P("planner-"+axis+"-range").textContent="Enter valid + values to browse.";
      }
      return;
    }
    const rows=filterSpecies("planner-row-search","planner-row-family");
    const columns=filterSpecies("planner-column-search","planner-column-family");
    rowPage=Math.max(0,Math.min(rowPage,Math.max(0,Math.ceil(rows.length/PAGE)-1)));
    columnPage=Math.max(0,Math.min(columnPage,Math.max(0,Math.ceil(columns.length/PAGE)-1)));
    const entries=(species,plus)=>species.map(s=>({speciesIndex:s.index,plus,nickname:""}));
    const context=P("planner-all-context").value;
    P("planner-all-summary").textContent=rows.length+" pedigrees × "+columns.length+" mates · "+(rows.length*columns.length).toLocaleString()+" ordered pairings · "+contextLabel(context)+". Use the row and column pages to explore the full grid.";
    renderMatrix("planner-all-grid",entries(rows.slice(rowPage*PAGE,(rowPage+1)*PAGE),rowPlus),entries(columns.slice(columnPage*PAGE,(columnPage+1)*PAGE),columnPlus),context,"","All species breeding grid: pedigree rows and mate columns");
    pageRange("planner-row",rowPage,rows.length,"Rows");
    pageRange("planner-column",columnPage,columns.length,"Columns");
  }
  function showDetail(event) {
    const cell=event.target.closest("button[data-planner-pair]");
    if(!cell)return;
    detail={a:Number(cell.dataset.a),b:Number(cell.dataset.b),ap:Number(cell.dataset.ap),bp:Number(cell.dataset.bp),context:cell.dataset.context};
    const forward=core.result(detail.a,detail.b,detail.ap,detail.bp,detail.context);
    const reverse=core.result(detail.b,detail.a,detail.bp,detail.ap,detail.context);
    P("planner-pair-detail-body").innerHTML='<p class="kicker">'+safe(contextLabel(detail.context))+'</p><h3>'+safe(named(detail.a))+" +"+detail.ap+" + "+safe(named(detail.b))+" +"+detail.bp+' → '+spriteLabel(forward.resultIndex,named(forward.resultIndex))+'</h3><p>'+safe(forward.detail||forward.condition)+" Base table: "+safe(named(forward.baseIndex))+'.</p><p><strong>Reversed parents:</strong> '+spriteLabel(reverse.resultIndex,named(reverse.resultIndex))+" · "+safe(ruleLabel(reverse))+'.</p>';
    P("planner-pair-detail").hidden=false;
    P("planner-pair-detail").scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  function setPlannerTab(name,focus=false) {
    activeTab=name;
    for(const mode of ["roster","breeding","everything"]) {
      P("planner-"+mode).hidden=mode!==name;
      const tab=P("planner-tab-"+mode);
      tab.setAttribute("aria-selected",String(mode===name)); tab.tabIndex=mode===name?0:-1;
    }
    P("planner-pair-detail").hidden=true;
    if(name==="breeding")renderBreeding();
    if(name==="everything")renderEverything();
    if(focus)P("planner-tab-"+name).focus();
  }
  const referenceIds=["pair-finder","offspring-finder","conditional-rules","species-index","about"];
  function route() {
    const isPlanner=location.hash==="#team-planner";
    P("team-planner").hidden=!isPlanner;
    for(const id of referenceIds)P(id).hidden=isPlanner || (id==="conditional-rules" && !RULES.length);
    P("planner-nav-link").setAttribute("aria-current",isPlanner?"page":"false");
    P("planner-nav-link").classList.toggle("planner-nav-active",isPlanner);
    if(isPlanner)setPlannerTab(activeTab);
  }
  for(const id of ["planner-add-family","planner-row-family","planner-column-family"])setFamilies(id);
  refreshAddSpecies(11);
  for(const id of ["planner-add-search","planner-add-family"])P(id).addEventListener(id.endsWith("search")?"input":"change",()=>refreshAddSpecies());
  P("planner-add-species").addEventListener("change",refreshAddSprite);
  P("planner-entry-form").addEventListener("submit",event=>{
    event.preventDefault();
    try {
      const speciesIndex=Number(P("planner-add-species").value);
      if(P("planner-add-species").disabled || !rosterSpecies.some(s=>s.index===speciesIndex))throw new Error("Choose a monster from the list.");
      const entry={id:editing||makeId(),speciesIndex,sex:P("planner-sex-female").checked?"female":"male",plus:readPlus("planner-add-plus"),nickname:P("planner-add-nickname").value};
      const updated=Boolean(editing);
      changeRoster(updated?state.entries.map(e=>e.id===editing?entry:e):[...state.entries,entry],(updated?"Updated ":"Added ")+memberName(entry)+".");
      P("planner-add-nickname").value="";
    } catch(error) {notice(error.message);}
  });
  P("planner-cancel-edit").addEventListener("click",()=>{cancelEdit();notice("Edit cancelled.");});
  P("planner-males").addEventListener("click",cardAction);
  P("planner-females").addEventListener("click",cardAction);
  P("planner-undo").addEventListener("click",()=>{
    if(!undoState)return;
    state=undoState; undoState=null; P("planner-undo").disabled=true;
    cancelEdit();save();renderRoster();renderBreeding();notice("Restored your previous roster.");
  });
  P("planner-demo").addEventListener("click",()=>{
    changeRoster([
      {id:makeId(),speciesIndex:11,sex:"male",plus:4,nickname:""},
      {id:makeId(),speciesIndex:13,sex:"male",plus:0,nickname:""},
      {id:makeId(),speciesIndex:99,sex:"female",plus:0,nickname:""},
      {id:makeId(),speciesIndex:11,sex:"female",plus:0,nickname:""},
      {id:makeId(),speciesIndex:199,sex:"female",plus:0,nickname:""}
    ],"Loaded an example team. Undo restores your previous roster.");
  });
  P("planner-export").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify(state,null,2)+"\n"],{type:"application/json"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="DQM-guide-team-v61.json";document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);notice("Exported your team as a JSON file.");
  });
  P("planner-import").addEventListener("change",async event=>{
    const file=event.target.files?.[0]; if(!file)return;
    try {
      if(file.size>200000)throw new Error("This team file is too large. Choose a DQM-guide team export.");
      const imported=core.parseState(await file.text());
      changeRoster(imported.entries,"Imported "+imported.entries.length+" monsters. Undo restores your previous roster.");
    }catch(error){notice("Import failed: "+error.message+" Your roster has not changed.");}
    event.target.value="";
  });
  for(const mode of ["roster","breeding","everything"]) {
    const tab=P("planner-tab-"+mode);
    tab.addEventListener("click",()=>setPlannerTab(mode));
    tab.addEventListener("keydown",event=>{
      const modes=["roster","breeding","everything"],index=modes.indexOf(mode);
      let next;
      if(event.key==="ArrowRight")next=(index+1)%3;
      if(event.key==="ArrowLeft")next=(index+2)%3;
      if(event.key==="Home")next=0;if(event.key==="End")next=2;
      if(next!==undefined){event.preventDefault();setPlannerTab(modes[next],true);}
    });
  }
  P("planner-context").addEventListener("change",()=>{P("planner-pair-detail").hidden=true;renderBreeding();});
  P("planner-result-search").addEventListener("input",renderBreeding);
  P("planner-male-prev").addEventListener("click",()=>{malePage--;renderBreeding();});
  P("planner-male-next").addEventListener("click",()=>{malePage++;renderBreeding();});
  P("planner-female-prev").addEventListener("click",()=>{femalePage--;renderBreeding();});
  P("planner-female-next").addEventListener("click",()=>{femalePage++;renderBreeding();});
  for(const prefix of ["row","column"]) {
    for(const suffix of ["search","family","plus"])P("planner-"+prefix+"-"+suffix).addEventListener(suffix==="family"?"change":"input",()=>{
      if(prefix==="row")rowPage=0;else columnPage=0;
      P("planner-pair-detail").hidden=true;renderEverything();
    });
    P("planner-"+prefix+"-prev").addEventListener("click",()=>{if(prefix==="row")rowPage--;else columnPage--;renderEverything();});
    P("planner-"+prefix+"-next").addEventListener("click",()=>{if(prefix==="row")rowPage++;else columnPage++;renderEverything();});
  }
  P("planner-all-context").addEventListener("change",()=>{P("planner-pair-detail").hidden=true;renderEverything();});
  for(const id of ["planner-male-grid","planner-female-grid","planner-all-grid"])P(id).addEventListener("click",showDetail);
  P("planner-inspect-reference").addEventListener("click",()=>{
    if(!detail)return;
    choosePair(detail.a,detail.b);location.hash="pair-finder";route();
    P("pair-finder").scrollIntoView({behavior:"smooth"});P("pedigree").focus({preventScroll:true});
  });
  window.addEventListener("hashchange",route);
  document.querySelectorAll('.nav a[href^="#"]').forEach(link=>link.addEventListener("click",()=>{
    const isPlanner=link.hash==="#team-planner";
    P("team-planner").hidden=!isPlanner;
    for(const id of referenceIds)P(id).hidden=isPlanner || (id==="conditional-rules" && !RULES.length);
    if(link.hash===location.hash)route();
  }));
  renderRoster();renderBreeding();setPlannerTab("roster");route();
  P("planner-save-status").textContent=storageAvailable
    ? "Your team saves in this browser. Export it to keep a backup or move it to another browser."
    : "Browser saving is unavailable or the saved team could not be read. Export your team to keep a copy.";
})();

/* Skill readiness and natural-growth planning. Names follow the guide snapshot;
   the native learning and progression model is independent of translated text. */
(() => {
  'use strict';
  const safe = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reference = SKILL_LEARNING_REFERENCE;
  const model = DQMSkillLearning.create(reference);
  const stats = reference.statKeys;
  const labels = {level:'Level',hp:'Max HP',mp:'Max MP',attack:'Attack',defense:'Defense',agility:'Agility',intelligence:'Intelligence'};
  const names = GUIDE_REFERENCE.guide_names.skills;
  const skills = reference.skills.filter(s=>names[s.skillId]).sort((a,b)=>names[a.skillId].title.localeCompare(names[b.skillId].title));
  const skillIds = new Set(skills.map(s=>s.skillId));
  const species = GUIDE_REFERENCE.species.filter(s=>s.playable!==false && reference.species.some(r=>r.speciesIndex===s.index));
  const bySpecies = new Map(species.map(s=>[s.index,s]));
  const name = id => bySpecies.get(id)?.display_name || 'Unknown monster';
  const skillName = id => names[id]?.title || 'Unlisted skill';
  const skillLink = id => names[id] ? '<a href="#field-guide?kind=skill&amp;entry=skill-'+safe(names[id].id)+'">'+safe(skillName(id))+'</a>' : safe(skillName(id));
  const field = (id,label,markup,extra='') => '<label class="training-field" for="training-'+id+'"><span>'+label+'</span>'+markup+extra+'</label>';
  const number = (id,label,value,min,max,extra='') => field(id,label,'<input id="training-'+id+'" type="number" inputmode="numeric" min="'+min+'" max="'+max+'" step="1" value="'+safe(value)+'">',extra);
  const skillOptions = () => skills.map(s=>'<option value="'+s.skillId+'">'+safe(skillName(s.skillId))+'</option>').join('');
  const speciesSelect = id => '<select id="training-'+id+'">'+[...species].sort((a,b)=>a.display_name.localeCompare(b.display_name)).map(s=>'<option value="'+s.index+'">'+safe(s.display_name)+'</option>').join('')+'</select>';
  const skillSetMarkup = (id,label) => '<div class="training-skill-set"><label for="training-'+id+'-pick">'+label+'</label><div class="training-add-skill"><select id="training-'+id+'-pick">'+skillOptions()+'</select><button type="button" id="training-'+id+'-add">Add</button></div><ul id="training-'+id+'-list" class="training-chips"></ul><p id="training-'+id+'-message" class="hint" role="status"></p></div>';
  const routeLabels = {natural:'Natural skill',inherited:'Candidate skill',upgrade:'Skill upgrade',combination:'Skill combination'};
  const statusText = {
    'already-known':'Already knows this skill or a later upgrade.',
    ready:'Requirements met for a party level-up check.',
    'missing-route':'No confirmed learning route from the skills entered.',
    'requirements-short':'Some learning requirements are still short.',
    'unknown-stats':'Enter the missing base stats to check the requirements.',
    farm:'Farm training does not run skill-learning checks.',
    hibernation:'A hibernating monster does not gain levels or learn skills.',
    'level-cap':'At its level cap, this monster cannot gain the level needed for another learning check.',
    'combination-order':'An earlier combination affects this learning check. See the explanation below.'
  };

  function renderRoute() {
    const root = document.getElementById('skill-planner');
    const params = new URLSearchParams((window.DQMEntryHash?.() || location.hash).split('?')[1] || '');
    const get = id => root.querySelector('#training-'+id);
    const invalidLinkFields = new Set();
    const readId=(key,fallback,allowed)=>{
      const raw=params.get(key);if(raw===null)return fallback;
      const value=/^\d+$/.test(raw)?Number(raw):NaN;
      if(!Number.isSafeInteger(value)||!allowed.has(value)){invalidLinkFields.add(key);return fallback;}
      return value;
    };
    const requestedSpecies = readId('species',11,bySpecies);
    const selectedSpecies = bySpecies.has(requestedSpecies) ? requestedSpecies : 11;
    const initialCampaign = ['terry','cobi','tara'].includes(params.get('campaign')) ? params.get('campaign') : 'terry';
    if(params.has('campaign')&&!['terry','cobi','tara'].includes(params.get('campaign')))invalidLinkFields.add('campaign');
    for(const [key,allowed] of [['origin',['bred','recruited']],['location',['party','farm','hibernation']]])
      if(params.has(key)&&!allowed.includes(params.get(key)))invalidLinkFields.add(key);
    const natural = reference.species.find(s=>s.speciesIndex===selectedSpecies).naturalSkills[initialCampaign];
    const requestedSkill = readId('skill',natural.find(id=>skillIds.has(id))??skills[0].skillId,skillIds);
    const selectedSkill = skillIds.has(requestedSkill) ? requestedSkill : skills[0].skillId;
    const readSkills = (key,maximum) => {
      const raw = params.get(key); if (!raw) return [];
      const parts=raw.split(','),rows=parts.map(Number);
      if (rows.length>maximum || parts.some(value=>!/^\d+$/.test(value)) || rows.some(id=>!skillIds.has(id)) || new Set(rows).size!==rows.length) {invalidLinkFields.add(key);return [];}
      return rows;
    };
    const chosen = {known:readSkills('known',8),inherited:readSkills('inherited',25),'parent-a-skills':readSkills('pa_skills',8),'parent-b-skills':readSkills('pb_skills',8)};
    for(const id of ['level','target','plus','cap',...stats]){
      const raw=params.get(id);if(raw===null||raw==='')continue;
      const value=Number(raw),min=['level','target','cap'].includes(id)?1:0,max=stats.includes(id)?999:99;
      if(!Number.isInteger(value)||value<min||value>max)invalidLinkFields.add(id);
    }
    if(params.has('pool')&&!['parents','current'].includes(params.get('pool')))invalidLinkFields.add('pool');
    let parentPoolSource=params.get('pool')==='parents',currentPoolSource=params.get('pool')==='current',candidatePoolUnknown=false,knownSkillsUnknown=false,parentPoolStale=false,owned=null;
    root.innerHTML = '<header class="training-heading"><div><h2 id="skill-planner-heading" tabindex="-1">Skill &amp; growth planner</h2><p>See what a monster needs to learn a skill, and how its stats change as it levels.</p></div><a href="#field-guide?entry=field-skill-inheritance">How learning works →</a></header>'+
      '<div id="training-owned"></div><p id="training-link-note" class="recruit-note" hidden></p><button id="training-reset-link" type="button" hidden>Reset unsupported link values</button><p id="training-state-note" class="hint" role="status"></p><div class="training-layout"><div class="training-inputs">'+
      '<section class="training-block training-levels"><div class="training-pair">'+number('level','Current level',params.get('level')??1,1,99)+number('target','Plan to level',params.get('target')??20,1,99)+'</div></section>'+
      '<details id="training-monster-inputs" class="training-block" open><summary>Monster details<span id="training-monster-summary" class="training-input-summary"></span></summary><div class="training-pair">'+field('species','Species',speciesSelect('species'))+
      field('campaign','Adventure','<select id="training-campaign"><option value="" disabled>Choose an adventure</option><option value="terry">Terry</option><option value="cobi">Cobi</option><option value="tara">Tara</option></select>')+'</div>'+
      '<div class="training-pair">'+field('origin','Level-cap basis','<select id="training-origin"><option value="recruited">Ordinary wild recruit</option><option value="bred">Bred and hatched</option><option value="saved" hidden>Actual cap from save</option></select>')+
      number('plus','Breeding +',params.get('plus')??0,0,99)+'</div>'+number('cap','Known level cap (optional)',params.get('cap')??'',1,99,'<small>Overrides the usual cap. Gifts and special recruits can differ.</small>')+
      field('location','Training location','<select id="training-location"><option value="party">Active party</option><option value="farm">Awake on the farm</option><option value="hibernation">Hibernating</option></select>')+'</details>'+
      '<details id="training-stats-inputs" class="training-block" open><summary>Current base stats<span id="training-stats-summary" class="training-input-summary"></span></summary><p class="hint">Maximum HP/MP and stats before equipment. Leave unknown values blank.</p><div class="training-stats">'+stats.map(stat=>number(stat,labels[stat],params.get(stat)??'',0,999)).join('')+'</div><button type="button" id="training-clear-stats">Clear stats</button></details>'+
      '<details class="training-block training-inheritance"'+(chosen.known.length||chosen.inherited.length?' open':'')+'><summary>Edit skills &amp; inheritance</summary><p class="hint">Learned skills are moves it can use now. Learning candidates are moves it may learn at a future level-up.</p><p id="training-pool-note" class="hint"></p><button type="button" id="training-use-natural" hidden>Start from species’ natural skills</button>'+skillSetMarkup('known','Learned skills · up to 8')+skillSetMarkup('inherited','Learning candidates')+
      '<details class="training-parent-builder"><summary>Build the inherited pool from two parents</summary><p class="hint">Uses the selected adventure’s natural-skill table for both parents and the child. This does not choose the offspring species; <a href="#pair-finder">check the pairing first</a>.</p>'+['a','b'].map(id=>field('parent-'+id,'Parent '+id.toUpperCase(),speciesSelect('parent-'+id))+skillSetMarkup('parent-'+id+'-skills','Parent '+id.toUpperCase()+' retained skills')).join('')+'<button type="button" id="training-use-parents">Use these parents’ skill pool</button><p id="training-parent-status" role="status" class="hint"></p></details></details></div>'+
      '<div class="training-output"><section class="training-block"><div id="training-monster" class="training-monster"></div>'+field('skill','Skill to check','<select id="training-skill">'+skillOptions()+'</select>')+
      '<p id="training-errors" role="alert" hidden></p><div id="training-readiness" aria-live="polite"></div><div id="training-routes"></div></section>'+
      '<section class="training-block"><h3>Growth to your target level</h3><div id="training-growth"></div></section>'+
      '<p class="training-scope">Learning is checked on an active-party level-up. Meeting requirements does not immediately add a skill or simulate which prompts you accept, replace or combine. Growth projections exclude equipment growth bonuses and extra seeds.</p>'+
      '<div class="training-share"><button type="button" id="training-copy">Copy plan link</button><span id="training-copy-status" role="status"></span><input id="training-share-url" aria-label="Plan link" readonly hidden></div></div></div>';
    get('species').value=String(selectedSpecies);get('campaign').value=initialCampaign;get('skill').value=String(selectedSkill);
    get('origin').value=params.get('origin')==='bred'?'bred':'recruited';
    get('location').value=['farm','hibernation'].includes(params.get('location'))?params.get('location'):'party';
    for (const id of ['a','b']) get('parent-'+id).value=String(readId('p'+id,11,bySpecies));
    for (const id of ['species','parent-a','parent-b']) DQMMonsterPicker.attach(get(id),{species,label:id==='species'?'Species':'Parent '+id.slice(-1).toUpperCase(),includeFamily:true});
    function showLinkErrors(){
      get('link-note').hidden=!invalidLinkFields.size;get('reset-link').hidden=!invalidLinkFields.size;
      get('link-note').textContent='Unsupported plan values: '+[...invalidLinkFields].join(', ')+'. Correct these fields or reset them before calculating.';
    }
    showLinkErrors();
    function readNumber(id,min,max,optional=false) {
      const input=get(id),empty=input.value.trim()==='',value=input.valueAsNumber;
      const valid=!input.validity.badInput&&(optional&&empty || Number.isInteger(value)&&value>=min&&value<=max);
      input.setAttribute('aria-invalid',String(!valid));
      if (!valid) throw new Error('Check '+(labels[id] || {'target':'target level','plus':'breeding +','cap':'level cap'}[id] || id)+': enter a whole number from '+min+' to '+max+'.');
      return empty?null:value;
    }
    function settings() {
      if(invalidLinkFields.size)throw new Error('This plan link contains unsupported values. Correct or reset them before calculating.');
      if(parentPoolStale)throw new Error('The parents or adventure changed. Rebuild the inherited skill pool before calculating.');
      if(candidatePoolUnknown)throw new Error('This import has no verified learning-candidate pool. Re-import the save, or start from species’ natural skills under Edit skills & inheritance.');
      if(knownSkillsUnknown)throw new Error('This import has no verified learned-skill list. Re-import the save, enter its known skills, or start from species’ natural skills.');
      if(!['terry','cobi','tara'].includes(get('campaign').value))throw new Error('Choose this monster’s adventure: Terry, Cobi or Tara.');
      const basis=get('origin').value,origin=basis==='bred'?'bred':'recruited';get('plus').disabled=origin!=='bred';
      const level=readNumber('level',1,99),targetLevel=readNumber('target',1,99);
      if(targetLevel<level) throw new Error('The target level must be at least the current level.');
      const levelCap=readNumber('cap',1,99,true);
      if(levelCap!==null&&levelCap<level)throw new Error('The known level cap cannot be below the current level.');
      return {speciesIndex:Number(get('species').value),campaign:get('campaign').value,skillId:Number(get('skill').value),level,targetLevel,
        origin,plus:origin==='bred'||basis==='saved'?readNumber('plus',0,99):0,...(levelCap!==null?{levelCap}:{}),
        stats:Object.fromEntries(stats.map(stat=>[stat,readNumber(stat,0,999,true)])),
        knownSkills:chosen.known,...(currentPoolSource?{candidateSkills:chosen.inherited}:{inheritedSkills:chosen.inherited}),location:get('location').value};
    }
    function saveLink(state) {
      const p=new URLSearchParams({species:state.speciesIndex,campaign:state.campaign,skill:state.skillId,level:state.level,target:state.targetLevel,origin:state.origin});
      if(state.origin==='bred')p.set('plus',state.plus);
      if(state.levelCap!=null)p.set('cap',state.levelCap);
      if(state.location!=='party')p.set('location',state.location);
      for(const stat of stats)if(state.stats[stat]!==null)p.set(stat,state.stats[stat]);
      for(const key of ['known','inherited'])if(chosen[key].length)p.set(key,chosen[key].join(','));
      if(parentPoolSource)p.set('pool','parents');
      if(currentPoolSource)p.set('pool','current');
      const selected=owned?.selected();if(selected){p.set('team',selected.teamId);p.set('owned',selected.entryId);}
      for(const id of ['a','b']) {p.set('p'+id,get('parent-'+id).value);if(chosen['parent-'+id+'-skills'].length)p.set('p'+id+'_skills',chosen['parent-'+id+'-skills'].join(','));}
      history.replaceState(history.state,'','#skill-planner?'+p);
    }
    function renderRequirements(route,later,compare) {
      return '<div class="table-scroll"><table><caption class="sr-only">'+safe(routeLabels[route.kind])+' requirements</caption><thead><tr><th scope="col">Requirement</th><th scope="col">Needed</th><th scope="col">Now</th>'+(compare?'<th scope="col">At target</th>':'')+'</tr></thead><tbody>'+route.requirements.map(row=>{
        const next=later?.requirements.find(r=>r.stat===row.stat);
        const cell=r=>!r||r.status==='unknown'?'Not entered':safe(r.value)+(r.status==='met'?' · Met':' · Need '+r.shortfall+' more');
        return '<tr><th scope="row">'+safe(labels[row.stat])+'</th><td>'+row.minimum+'</td><td>'+cell(row)+'</td>'+(compare?'<td>'+cell(next)+'</td>':'')+'</tr>';
      }).join('')+'</tbody></table></div>';
    }
    function update() {
      get('copy-status').textContent='';get('share-url').hidden=true;
      get('monster-summary').textContent=name(Number(get('species').value))+(get('plus').value?' +'+get('plus').value:'')+' · '+(get('campaign').selectedOptions[0]?.textContent||'Choose adventure')+' · '+(get('location').selectedOptions[0]?.textContent||'')+(get('cap').value?' · Level cap '+get('cap').value:'');
      get('stats-summary').textContent=stats.every(stat=>get(stat).value!=='')?'HP '+get('hp').value+' · MP '+get('mp').value+' · Attack '+get('attack').value+' · Defense '+get('defense').value:'Enter the known values';
      get('pool-note').textContent=candidatePoolUnknown?'The saved candidate pool is unavailable. This is different from a verified empty pool.':knownSkillsUnknown?'The current candidate pool is available, but the learned-skill list is unknown. Enter known skills before checking upgrades or combinations.':currentPoolSource?'Complete current candidate pool. Original natural skills are not added back; removed or upgraded candidates stay as entered.':'Natural skills for the selected species are checked alongside these inherited candidates.';
      get('use-natural').hidden=!currentPoolSource&&!candidatePoolUnknown&&!knownSkillsUnknown;
      try {
        const state=settings(),projection=model.project(state);
        const current=model.check({...state,atLevelCap:state.level>=projection.cap.max});
        const future=model.check({...state,level:state.targetLevel,stats:projection.projectedStats,atLevelCap:state.targetLevel===state.level&&state.level>=projection.cap.max});
        get('errors').hidden=true;get('copy').disabled=false;
        get('monster').innerHTML=spriteMarkup(state.speciesIndex)+'<div><a href="#monster?id='+state.speciesIndex+'">'+safe(name(state.speciesIndex))+'</a><span>'+skillLink(state.skillId)+'</span></div>';
        const capBlocked=projection.cap.status==='above',uncertain=projection.cap.status==='uncertain',compare=state.targetLevel!==state.level;
        get('readiness').innerHTML='<p class="training-status" data-status="'+current.status+'"><strong>Now · Lv '+state.level+'</strong><span>'+safe(statusText[current.status])+'</span></p>'+
          (compare&&!current.alreadyKnown?'<p class="training-status" data-status="'+(capBlocked?'level-cap':future.status)+'"><strong>Target · Lv '+state.targetLevel+'</strong><span>'+safe(capBlocked?'This target exceeds the level cap. Lower the target or plan a bred offspring.':statusText[future.status])+(uncertain?' The actual recruitment level cap may prevent reaching this level.':'')+'</span></p>':'')+
          [...new Set([...(current.warnings||[]),...(future.warnings||[])])].map(warning=>'<p class="training-warning">'+safe(warning)+'</p>').join('')+
          (current.replacementRequired||future.replacementRequired?'<p class="hint">All eight learned-skill slots are occupied. Learning a new skill requires choosing a skill to replace.</p>':'')+earliestLevel(state,projection,current);
        get('routes').innerHTML=current.alreadyKnown ? '<p class="hint">'+(current.supersededBy!==null ? 'Already learned '+skillLink(current.supersededBy)+', which replaces '+skillLink(state.skillId)+'.' : 'Already learned '+skillLink(state.skillId)+'.')+' No further learning requirements apply.</p>' : current.routes.map((route,i)=>'<section class="training-route"><h4>'+safe(routeLabels[route.kind]||route.kind)+'</h4>'+
          (route.requiredSkillIds.length?'<p class="hint">Requires retained skills: '+route.requiredSkillIds.map(skillLink).join(' + ')+'.'+(route.missingSkillIds.length?' Missing: '+route.missingSkillIds.map(skillLink).join(', ')+'.':'')+'</p>':'')+
          (route.prerequisiteUpgrades?.length?'<p class="training-warning">A retained prerequisite upgrades before combination checks: '+route.prerequisiteUpgrades.map(change=>skillLink(change.from)+' → '+skillLink(change.to)).join(', ')+'.</p>':'')+
          renderRequirements(route,future.routes[i],compare)+'</section>').join('')+
          (!current.routes.length?'<p class="hint">'+(currentPoolSource?'This skill is absent from the current candidate pool and has no route from the retained skills.':'This is not a natural skill for this species. Add its inherited candidates or retained skills to check another route.')+'</p>'+renderRequirements({kind:'natural',requirements:current.numericalRequirements},{requirements:future.numericalRequirements},compare):'');
        const cap=projection.cap.min===projection.cap.max?'Level '+projection.cap.max:'Level '+projection.cap.min+'–'+projection.cap.max;
        const growth=stats.map(stat=>'<tr><th scope="row">'+labels[stat]+'</th><td>'+(state.stats[stat]??'Unknown')+'</td><td>+'+(state.stats[stat]===null?projection.gains[stat]:projection.projectedStats[stat]-state.stats[stat])+'</td><td>'+(projection.projectedStats[stat]??'Unknown')+'</td></tr>').join('');
        get('growth').innerHTML=!compare?'<p class="hint">'+(state.level>=projection.cap.max?'This monster has reached its level cap. It cannot gain further levels.':'Choose a higher “Plan to level” to see stat gains and EXP between levels.')+'</p>':'<p class="training-growth-summary"><strong>'+Number(projection.experience).toLocaleString('en-US')+' EXP</strong> between these level thresholds · '+safe(cap)+(state.levelCap==null&&state.origin==='recruited'?' expected recruitment cap':' cap')+'</p>'+
          '<div class="table-scroll"><table><caption class="sr-only">Natural growth projection</caption><thead><tr><th scope="col">Stat</th><th scope="col">Current</th><th scope="col">Gain</th><th scope="col">Target</th></tr></thead><tbody>'+growth+'</tbody></table></div>'+
          '<p class="hint">Known stats stop at 999; their displayed gain is the amount actually added. Unknown stats show the natural curve gain. EXP is the difference between level thresholds, not remaining EXP from your current progress. '+(capBlocked?'Gains shown above the cap are hypothetical. ':'')+(state.location==='hibernation'?'These gains require taking the monster out of hibernation.':'')+'</p>';
        saveLink(state);
      } catch(error) {
        get('errors').hidden=false;get('errors').textContent=error.message;get('copy').disabled=true;
        for(const id of ['readiness','routes','growth'])get(id).replaceChildren();
      }
    }
    function earliestLevel(state,projection,current) {
      if(current.alreadyKnown)return '';
      if(state.location!=='party')return '<p class="hint">Return the monster to your active party for skill learning.</p>';
      let unknown=false,order=false;
      for(let level=state.level+1;level<=projection.cap.max;level++){
        const next=model.project({...state,targetLevel:level});
        const check=model.check({...state,level,stats:next.projectedStats,atLevelCap:false});
        unknown ||= check.status==='unknown-stats';order ||= check.status==='combination-order';
        if(check.learnableNow)return '<p class="training-earliest"><strong>Next level meeting these checks: Lv '+level+'</strong>'+ (level>projection.cap.min?' · Requires an individual cap of at least '+level+'.':'')+'<span class="hint">With the entered skills and natural growth; no extra seeds or newly learned prerequisites are assumed.</span></p>';
      }
      return '<p class="training-earliest hint">'+(unknown?'Enter the missing stats to find the next level meeting these checks.':order?'The combination-order interaction prevents confirming an eligible level.':'No eligible future level found within the expected cap using these skills and natural growth.')+'</p>';
    }
    function refreshSkills(key) {
      get(key+'-list').innerHTML=chosen[key].map(id=>'<li><span>'+safe(skillName(id))+'</span><button type="button" data-remove-skill="'+id+'" aria-label="Remove '+safe(skillName(id))+' from '+safe(key)+'">×</button></li>').join('');
      get(key+'-list').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{chosen[key]=chosen[key].filter(id=>id!==Number(button.dataset.removeSkill));skillsChanged(key);refreshSkills(key);update();}));
    }
    function staleParents(){if(parentPoolSource){parentPoolStale=true;get('parent-status').textContent='Parents or adventure changed. Use these parents’ skill pool again to refresh the candidates.';}}
    function detachOwned(){
      if(owned?.selected())get('state-note').textContent='Custom plan. Your My game monster is unchanged.';
      owned?.detach();if(get('origin').value==='saved')get('origin').value='recruited';
    }
    function clearCurrentPool(message){
      if(!currentPoolSource&&!candidatePoolUnknown&&!knownSkillsUnknown)return;
      currentPoolSource=false;candidatePoolUnknown=false;knownSkillsUnknown=false;chosen.inherited=[];refreshSkills('inherited');
      get('state-note').textContent=message;
    }
    function skillsChanged(key){
      if(key==='known'||key==='inherited')detachOwned();
      if(key==='known')knownSkillsUnknown=false;
      invalidLinkFields.delete(key.startsWith('parent-')?'p'+key[7]+'_skills':key);showLinkErrors();
      if(key==='inherited'){parentPoolSource=false;parentPoolStale=false;get('parent-status').textContent='Candidate skills were edited manually.';}
      else if(key.startsWith('parent-')){detachOwned();clearCurrentPool('Parents changed. The old save’s candidate pool was cleared. Build the new inherited pool below.');staleParents();}
    }
    for(const key of Object.keys(chosen)) {
      refreshSkills(key);
      get(key+'-add').addEventListener('click',()=>{
        const id=Number(get(key+'-pick').value),max=key==='inherited'?25:8;
        if(chosen[key].includes(id)){get(key+'-message').textContent='Already added.';return;}
        if(chosen[key].length>=max){get(key+'-message').textContent='This list can contain at most '+max+' skills.';return;}
        chosen[key].push(id);get(key+'-message').textContent='';skillsChanged(key);refreshSkills(key);update();
      });
    }
    get('use-parents').addEventListener('click',()=>{
      detachOwned();
      const inherited=model.inherit({offspringSpeciesIndex:Number(get('species').value),campaign:get('campaign').value,
        parents:['a','b'].map(id=>({speciesIndex:Number(get('parent-'+id).value),knownSkills:chosen['parent-'+id+'-skills']}))});
      chosen.inherited=inherited.inheritedSkills.filter(id=>skillIds.has(id));refreshSkills('inherited');
      parentPoolSource=true;currentPoolSource=false;candidatePoolUnknown=false;parentPoolStale=false;invalidLinkFields.delete('inherited');showLinkErrors();
      get('parent-status').textContent=chosen.inherited.length+' named candidates copied. This changes the planning inputs only.';update();
    });
    for(const id of ['species','campaign','skill','origin','location','parent-a','parent-b'])get(id).addEventListener('change',()=>{
      if(['species','campaign','origin','location'].includes(id))detachOwned();
      invalidLinkFields.delete(id.startsWith('parent-')?'p'+id.slice(-1):id);showLinkErrors();
      if(id==='species'){
        currentPoolSource=false;candidatePoolUnknown=false;knownSkillsUnknown=false;
        for(const stat of stats){get(stat).value='';invalidLinkFields.delete(stat);}
        get('cap').value='';invalidLinkFields.delete('cap');chosen.known=[];refreshSkills('known');invalidLinkFields.delete('known');
        if(!parentPoolSource){chosen.inherited=[];refreshSkills('inherited');invalidLinkFields.delete('inherited');}
        get('state-note').textContent='Species changed. Enter this monster’s base stats, retained skills and individual level cap.';showLinkErrors();
      }
      if(id.startsWith('parent-')){detachOwned();clearCurrentPool('Parents changed. The old save’s candidate pool was cleared. Build the new inherited pool below.');chosen[id+'-skills']=[];refreshSkills(id+'-skills');invalidLinkFields.delete('p'+id.slice(-1)+'_skills');staleParents();}
      if(id==='campaign'){staleParents();clearCurrentPool('Adventure changed. The previous save’s candidate pool was cleared; enter inherited candidates for this adventure.');}
      update();
    });
    for(const id of ['level','target','plus','cap',...stats])get(id).addEventListener('input',()=>{if(id!=='target')detachOwned();invalidLinkFields.delete(id);showLinkErrors();update();});
    get('clear-stats').addEventListener('click',()=>{detachOwned();for(const stat of stats){get(stat).value='';invalidLinkFields.delete(stat);}showLinkErrors();update();});
    get('use-natural').addEventListener('click',()=>{detachOwned();clearCurrentPool('Planning from the species’ original natural skills. This does not restore the saved candidate pool.');update();});
    get('copy').addEventListener('click',async()=>{const url=new URL(location.href),p=new URLSearchParams(url.hash.split('?')[1]);p.delete('team');p.delete('owned');url.hash='skill-planner?'+p;try{await navigator.clipboard.writeText(url.href);get('copy-status').textContent='Plan link copied.';}catch{const input=get('share-url');input.hidden=false;input.value=url.href;input.focus();input.select();get('copy-status').textContent='Copy the selected link.';}});
    get('reset-link').addEventListener('click',()=>{
      for(const id of invalidLinkFields){
        if(stats.includes(id)||id==='cap')get(id).value='';
        if(id==='level')get(id).value='1';
        if(id==='target')get(id).value=String(Math.max(20,Number(get('level').value)||1));
        if(id==='plus')get(id).value='0';
      }
      invalidLinkFields.clear();showLinkErrors();update();
    });
    if(parentPoolSource){
      const expected=model.inherit({offspringSpeciesIndex:selectedSpecies,campaign:initialCampaign,parents:['a','b'].map(id=>({speciesIndex:Number(get('parent-'+id).value),knownSkills:chosen['parent-'+id+'-skills']}))}).inheritedSkills.filter(id=>skillIds.has(id));
      if([...expected].sort((a,b)=>a-b).join(',')!==[...chosen.inherited].sort((a,b)=>a-b).join(','))staleParents();
    }
    owned=globalThis.DQMOwnedMonsters?.mount(get('owned'),{params,onSelect(monster){
      get('species').value=String(monster.speciesIndex);DQMMonsterPicker.get(get('species')).refresh();
      get('campaign').value=monster.campaign||'';get('level').value=monster.level??'';
      const savedTarget=params.get('owned')===monster.entryId&&params.has('target')?Number(params.get('target')):null;
      get('target').value=monster.level===null?'':Number.isInteger(savedTarget)&&savedTarget>=monster.level&&savedTarget<=99?savedTarget:Math.min(monster.levelCap??99,monster.level+1);
      get('plus').value=monster.plus??'';get('cap').value=monster.levelCap??'';
      get('origin').value=monster.levelCap!==null?'saved':'recruited';get('location').value=monster.location;
      for(const stat of stats)get(stat).value=monster.baseStats[stat]??'';
      chosen.known=monster.knownSkills||[];chosen.inherited=monster.inheritedSkills||[];
      refreshSkills('known');refreshSkills('inherited');parentPoolSource=false;currentPoolSource=monster.inheritedSkills!==null;candidatePoolUnknown=monster.inheritedSkills===null;knownSkillsUnknown=monster.knownSkills===null;parentPoolStale=false;
      invalidLinkFields.clear();showLinkErrors();get('parent-status').textContent='';
      get('state-note').textContent='Uses base stats before accessories. '+(monster.knownSkills===null||monster.inheritedSkills===null?'Skills are unavailable in this import; enter known and inherited skills before judging learning routes.':'Known skills and the saved learning-candidate pool are loaded.');
      get('monster-inputs').open=monster.sourceStatus!=='save';
      get('stats-inputs').open=true;
      if(candidatePoolUnknown||knownSkillsUnknown)root.querySelector('.training-inheritance').open=true;
      update();
    },onInvalidate(){
      for(const stat of stats)get(stat).value='';get('cap').value='';get('origin').value='recruited';
      get('monster-inputs').open=true;get('stats-inputs').open=true;get('state-note').textContent='Enter the missing monster details and base stats below.';
      chosen.known=[];chosen.inherited=[];refreshSkills('known');refreshSkills('inherited');parentPoolSource=false;currentPoolSource=false;candidatePoolUnknown=false;knownSkillsUnknown=false;parentPoolStale=false;update();
    }});
    update();
  }
  globalThis.DQMSkillPlanner={renderRoute};
})();

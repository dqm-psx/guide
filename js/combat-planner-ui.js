/* Encounter-aware damage ranges; native formulas live in combat-planner.js. */
(() => {
  'use strict';
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ref=COMBAT_REFERENCE,model=DQMCombat;
  const monsters=new Map(ref.species.map(row=>[row.speciesId,row]));
  const skills=new Map(ref.skills.map(row=>[row.skillId,row]));
  const names=GUIDE_REFERENCE.guide_names.skills;
  const species=GUIDE_REFERENCE.species.filter(row=>row.playable!==false&&monsters.has(row.index));
  const name=id=>GUIDE_REFERENCE.species.find(row=>row.index===id)?.display_name||'Unknown monster';
  const skillName=id=>names[id]?.title||'Unlisted skill';
  const skillLink=id=>names[id]?'<a href="#field-guide?kind=skill&amp;entry=skill-'+safe(names[id].id)+'">'+safe(skillName(id))+'</a>':safe(skillName(id));
  const range=values=>values[0]===values[1]?String(values[0]):values.join('–');
  const areaNames=new Map();
  for(const row of GUIDE_REFERENCE.species)for(const area of row.locations||[])if(area.kind==='wild'&&Number.isInteger(area.context_id))areaNames.set(area.game+'-'+area.context_id,area.name+(area.floors?' · '+area.floors:''));
  const encounterName=row=>areaNames.get(row.game+'-'+row.contextId)||'Wild encounter '+row.contextId;
  const encounterLabels=new Map();
  for(const row of ref.encounters){
    const sameArea=ref.encounters.filter(other=>other.game===row.game&&encounterName(other)===encounterName(row));
    let label=encounterName(row);
    if(sameArea.length>1){
      const levels=row.enemies.map(enemy=>enemy.level);
      const roster=[...new Set(row.enemies.map(enemy=>name(enemy.speciesId)))];
      label+=' · Group '+(sameArea.indexOf(row)+1)+' · Lv '+range([Math.min(...levels),Math.max(...levels)])+' · '+roster.slice(0,2).join(', ')+(roster.length>2?'…':'');
    }
    encounterLabels.set(row.game+'-'+row.contextId,label);
  }
  const supported=[...skills.values()].filter(row=>names[row.skillId]).sort((a,b)=>skillName(a.skillId).localeCompare(skillName(b.skillId)));
  const field=(id,label,input,help='')=>'<label class="training-field" for="combat-'+id+'"><span>'+label+'</span>'+input+(help?'<small>'+help+'</small>':'')+'</label>';
  const select=(id,options)=>'<select id="combat-'+id+'">'+options+'</select>';
  const numeric=(id,label,value,min,max)=>field(id,label,'<input id="combat-'+id+'" type="number" inputmode="numeric" step="1" min="'+min+'" max="'+max+'" value="'+safe(value)+'">');
  const options=rows=>rows.map(([id,label])=>'<option value="'+safe(id)+'">'+safe(label)+'</option>').join('');

  function renderRoute(){
    const root=document.getElementById('combat-planner');
    const params=new URLSearchParams((window.DQMEntryHash?.()||location.hash).split('?')[1]||'');
    const get=id=>root.querySelector('#combat-'+id);
    const initialSpecies=Number(params.get('species')??11),initialSkill=Number(params.get('skill')??1);
    root.innerHTML='<header class="training-heading"><div><h2 id="combat-planner-heading" tabindex="-1">Damage calculator</h2><p>Compare normal attacks and supported damage skills against a specific wild encounter.</p></div><div><a href="#field-guide?entry=field-damage-and-resistance">Damage &amp; resistance</a> · <a href="#field-guide?kind=skill">Browse skills →</a></div></header>'+
      '<p id="combat-link-note" class="hint" hidden>Some values in this link were unavailable. Review the selected monster, encounter and skill. <button type="button" id="combat-accept-link">Use these selections</button></p>'+
      '<div id="combat-owned"></div><div class="combat-inputs"><section class="training-block"><h3>Your monster</h3>'+field('species','Species',select('species',options([...species].sort((a,b)=>a.display_name.localeCompare(b.display_name)).map(row=>[row.index,row.display_name]))))+
      '<div class="training-stats">'+numeric('level','Level',params.get('level')??20,1,99)+numeric('attack','Attack',params.get('attack')??'',0,999)+numeric('defense','Defense',params.get('defense')??'',0,999)+'</div><p class="hint" id="combat-stat-source">Enter the current battle stats, including equipment. Leave unknown Attack or Defense blank.</p>'+field('skill','Skill to use',select('skill',options(supported.map(row=>[row.skillId,skillName(row.skillId)]))))+'<p id="combat-known-note" class="hint"></p></section>'+
      '<section class="training-block"><h3>Wild encounter</h3>'+field('game','Adventure',select('game',options([['terry','Terry'],['cobi','Cobi'],['tara','Tara']])))+
      field('search','Find an area or monster','<input id="combat-search" type="search" autocomplete="off" placeholder="Area or monster name">')+
      field('area','Area / floors',select('area',''))+field('enemy','Enemy',select('enemy',''))+'<p id="combat-empty" class="hint" hidden>No matching encounters. Change the search or adventure.</p></section></div>'+
      '<p id="combat-errors" role="alert" hidden></p><div id="combat-results" class="combat-results" aria-live="polite"></div>'+
      '<section class="training-block combat-defence"><h3>Enemy skills</h3><div id="combat-incoming-controls" class="training-pair">'+field('incoming','Move to compare',select('incoming',''))+
      field('resistance','Your resistance to this move',select('resistance',''), 'Species defaults are a starting point. Bred monsters can have different resistance; select the actual reduction when known.')+'</div><div id="combat-incoming-result" aria-live="polite"></div><p id="combat-other-moves" class="hint"></p></section>'+
      '<p class="training-scope">Damage is per target, assuming a successful, unguarded hit against a wild monster. Critical hits, buffs and other situational bonuses are excluded. You can compare a skill even if your monster has not learned it.</p>'+
      '<div class="training-share"><button type="button" id="combat-copy">Copy calculation link</button><span id="combat-copy-status" role="status"></span><input id="combat-share-url" aria-label="Calculation link" readonly hidden></div>';
    get('species').value=String(species.some(row=>row.index===initialSpecies)?initialSpecies:11);
    get('skill').value=String(skills.has(initialSkill)?initialSkill:1);
    get('game').value=['terry','cobi','tara'].includes(params.get('game'))?params.get('game'):'terry';
    DQMMonsterPicker.attach(get('species'),{species,label:'Your monster species',includeFamily:true});
    const validResistanceProfile=/^[0-7]{27}$/.test(params.get('resistances')||'');
    let individualResistances=validResistanceProfile?[...params.get('resistances')].map(Number):null;
    let area=null,enemy=null,invalidLink=false,owned=null,ownedSnapshot=null;
    function refillAreas(preferred){
      const q=get('search').value.trim().toLocaleLowerCase();
      const rows=ref.encounters.filter(row=>row.game===get('game').value&&(!q||[encounterName(row),...row.enemies.map(mon=>name(mon.speciesId))].join(' ').toLocaleLowerCase().includes(q)));
      get('area').innerHTML=options(rows.map(row=>[row.contextId,encounterLabels.get(row.game+'-'+row.contextId)]));
      if(rows.some(row=>String(row.contextId)===String(preferred)))get('area').value=String(preferred);
      get('empty').hidden=!!rows.length;get('area').disabled=!rows.length;
      refillEnemies();
    }
    function refillEnemies(preferred){
      area=ref.encounters.find(row=>row.game===get('game').value&&String(row.contextId)===get('area').value)||null;
      get('enemy').innerHTML=options((area?.enemies||[]).map(row=>[row.index,name(row.speciesId)+' · Lv '+row.level]));
      if(area?.enemies.some(row=>String(row.index)===String(preferred)))get('enemy').value=String(preferred);
      else {
        const query=get('search').value.trim().toLocaleLowerCase();
        const match=query&&area?.enemies.find(row=>name(row.speciesId).toLocaleLowerCase().includes(query));
        if(match)get('enemy').value=String(match.index);
      }
      get('enemy').disabled=!area;refillMoves();
    }
    function refillMoves(preferred){
      enemy=area?.enemies.find(row=>String(row.index)===get('enemy').value)||null;
      const moves=[...new Set(enemy?.actionIds||[])].filter(id=>skills.has(id));
      get('incoming').innerHTML=options(moves.map(id=>[id,skillName(id)]));
      if(moves.includes(Number(preferred)))get('incoming').value=String(preferred);
      get('incoming').disabled=!moves.length;
      get('incoming-controls').hidden=!moves.length;
      refillResistance();
    }
    function refillResistance(preferred=''){
      const skill=skills.get(Number(get('incoming').value));
      const scale=skill&&ref.scales[skill.scale]?.saved;
      get('resistance').innerHTML=options([['',individualResistances?(ownedSnapshot?'Individual resistance from save':'Individual resistance in this plan'):'Species default'],...(scale||[]).map((percent,code)=>[code,percent===0?'Immune (0% damage)':percent+'% damage taken'])]);
      if(preferred!==''&&scale?.[Number(preferred)]!=null)get('resistance').value=String(preferred);
      get('resistance').disabled=!skill;
    }
    function number(id,min,max,optional=false){
      const input=get(id),blank=input.value.trim()==='',value=input.valueAsNumber;
      const valid=!input.validity.badInput && (optional&&blank||Number.isInteger(value)&&value>=min&&value<=max);
      input.setAttribute('aria-invalid',String(!valid));
      if(!valid)throw new Error('Enter '+id+' as a whole number from '+min+' to '+max+'.');
      return blank?null:value;
    }
    function outcomeMarkup(result,id){
      if(result.kind!=='damage')return '<p>No verified calculation for this move.</p>';
      return '<p class="combat-damage"><strong>'+range(result.range)+'</strong> damage</p><p class="hint">'+skillLink(id)+' · '+skills.get(id).mpCost+' MP · '+result.percent+'% damage taken after resistance'+(result.bonusApplies?' · family bonus applies':'')+'.</p>';
    }
    function update(){
      get('copy-status').textContent='';get('share-url').hidden=true;
      try{
        if(invalidLink)throw new Error('Review the replacement selections above before calculating this link.');
        if(!enemy)throw new Error('Choose a matching wild encounter to calculate damage.');
        const speciesId=Number(get('species').value),basePlayer=monsters.get(speciesId),player=individualResistances?{...basePlayer,savedResistances:individualResistances}:basePlayer,target=monsters.get(enemy.speciesId);
        const level=number('level',1,99),attack=number('attack',0,999,true),defense=number('defense',0,999,true),skillId=Number(get('skill').value);
        const enemyAttack=model.wildStatRange(enemy.stats.attack,'attack'),enemyDefense=model.wildStatRange(enemy.stats.defense,'defense');
        const outgoing=attack===null?'Enter your Attack':range(model.physicalEnvelope([attack,attack],enemyDefense))+' damage';
        const incoming=defense===null?'Enter your Defense':range(model.physicalEnvelope(enemyAttack,[defense,defense]))+' damage';
        const skill=model.skillOutcome(skills.get(skillId),{user:player,target,wildTarget:true,enemyUser:false,level});
        get('results').innerHTML='<section class="training-block"><div class="training-monster">'+spriteMarkup(speciesId)+'<div><a href="#monster?id='+speciesId+'">'+safe(name(speciesId))+'</a><span>Attacking '+safe(name(enemy.speciesId))+'</span></div></div><h3>Your damage</h3><p class="combat-physical"><strong>Normal attack</strong><span>'+outgoing+'</span></p>'+outcomeMarkup(skill,skillId)+'</section>'+
          '<section class="training-block"><div class="training-monster">'+spriteMarkup(enemy.speciesId)+'<div><a href="#monster?id='+enemy.speciesId+'">'+safe(name(enemy.speciesId))+'</a><span>Lv '+enemy.level+' · '+safe(encounterName(area))+'</span></div></div><h3>Enemy damage</h3><p class="combat-physical"><strong>Normal attack</strong><span>'+incoming+'</span></p><p class="hint">Enemy rolls: HP '+range(model.wildStatRange(enemy.stats.hp,'hp'))+' · Attack '+range(enemyAttack)+' · Defense '+range(enemyDefense)+'.</p><a href="#atlas?tab=encounters&amp;area='+area.game+'-'+area.contextId+'">See this encounter →</a></section>';
        const incomingId=Number(get('incoming').value),incomingSkill=skills.get(incomingId),override=get('resistance').value;
        get('incoming-result').innerHTML=incomingSkill?outcomeMarkup(model.skillOutcome(incomingSkill,{user:target,target:player,wildTarget:false,enemyUser:true,level:enemy.level,...(override!==''?{resistanceCode:Number(override)}:{})}),incomingId)+(override===''?'<p class="hint">'+(individualResistances?'Uses the individual resistance copied into this plan.':'Uses the species’ unbred resistance; an individual monster’s resistance can differ.')+'</p>':''):'<p class="hint">No supported damage move is recorded for this enemy.</p>';
        get('known-note').textContent=ownedSnapshot?.knownSkills ? (ownedSnapshot.knownSkills.includes(skillId)?'This move is learned in your imported save.':'This move is not learned in your imported save. You can still compare its damage.') : '';
        const others=[...new Set(enemy.actionIds)].filter(id=>id!==0&&!skills.has(id)&&names[id]);
        get('other-moves').innerHTML=others.length?'Other recorded moves: '+others.map(skillLink).join(', ')+'. Their effects are not calculated here.':'';
        get('errors').hidden=true;get('copy').disabled=false;
        const p=new URLSearchParams({species:speciesId,level,skill:skillId,game:area.game,area:area.contextId,enemy:enemy.index});
        if(attack!==null)p.set('attack',attack);if(defense!==null)p.set('defense',defense);
        if(incomingSkill)p.set('incoming',incomingId);if(override!=='')p.set('resistance',override);
        if(individualResistances)p.set('resistances',individualResistances.join(''));
        const selected=owned?.selected();if(selected){p.set('team',selected.teamId);p.set('owned',selected.entryId);}
        history.replaceState(history.state,'','#combat-planner?'+p);
      }catch(error){get('errors').textContent=error.message;get('errors').hidden=false;get('copy').disabled=true;get('results').replaceChildren();get('incoming-result').replaceChildren();get('other-moves').replaceChildren();}
    }
    refillAreas(params.get('area'));refillEnemies(params.get('enemy'));refillMoves(params.get('incoming'));refillResistance(params.get('resistance')??'');
    const invalidNumbers=['level','attack','defense'].filter(key=>params.has(key)&&
      (!/^\d+$/.test(params.get(key))||Number(params.get(key))<(key==='level'?1:0)||Number(params.get(key))>(key==='level'?99:999)));
    for(const key of invalidNumbers)get(key).value=key==='level'?'20':'';
    invalidLink=['species','skill','area','enemy','incoming','resistance'].some(key=>params.has(key)&&!/^\d+$/.test(params.get(key)))||
      invalidNumbers.length>0||params.has('resistances')&&!validResistanceProfile||
      params.has('game')&&!['terry','cobi','tara'].includes(params.get('game'))||
      Number(get('species').value)!==initialSpecies||Number(get('skill').value)!==initialSkill||
      params.has('area')&&String(area?.contextId)!==params.get('area')||params.has('enemy')&&String(enemy?.index)!==params.get('enemy')||
      params.has('incoming')&&get('incoming').value!==params.get('incoming')||params.has('resistance')&&get('resistance').value!==params.get('resistance');
    get('link-note').hidden=!invalidLink;
    get('accept-link').addEventListener('click',()=>{invalidLink=false;get('link-note').hidden=true;update();});
    get('game').addEventListener('change',()=>{refillAreas();update();});get('search').addEventListener('input',()=>{refillAreas(get('area').value);update();});
    get('area').addEventListener('change',()=>{refillEnemies();update();});get('enemy').addEventListener('change',()=>{refillMoves();update();});
    get('incoming').addEventListener('change',()=>{refillResistance();update();});
    function detachOwned(){const override=get('resistance').value;owned?.detach();ownedSnapshot=null;get('stat-source').textContent='Custom battle stats, including equipment.';refillResistance(override);}
    get('species').addEventListener('change',()=>{detachOwned();individualResistances=null;get('attack').value='';get('defense').value='';refillResistance();update();});
    for(const id of ['skill','resistance'])get(id).addEventListener('change',update);
    for(const id of ['level','attack','defense'])get(id).addEventListener('input',()=>{detachOwned();update();});
    get('copy').addEventListener('click',async()=>{const url=new URL(location.href),p=new URLSearchParams(url.hash.split('?')[1]);p.delete('team');p.delete('owned');url.hash='combat-planner?'+p;try{await navigator.clipboard.writeText(url.href);get('copy-status').textContent='Calculation link copied.';}catch{get('share-url').hidden=false;get('share-url').value=url.href;get('share-url').focus();get('share-url').select();get('copy-status').textContent='Copy the selected link.';}});
    let hydratingOwned=true;
    owned=globalThis.DQMOwnedMonsters?.mount(get('owned'),{params,onSelect(monster){
      const prior={game:get('game').value,area:get('area').value,enemy:get('enemy').value,incoming:get('incoming').value,resistance:get('resistance').value};
      ownedSnapshot=monster;individualResistances=monster.resistances;get('species').value=String(monster.speciesIndex);DQMMonsterPicker.get(get('species')).refresh();
      get('level').value=monster.level??'';get('attack').value=monster.battleStats.attack??'';get('defense').value=monster.battleStats.defense??'';
      if(hydratingOwned&&!params.has('game')&&monster.campaign)get('game').value=monster.campaign;
      get('search').value='';refillAreas(prior.area);refillEnemies(prior.enemy);refillMoves(prior.incoming);refillResistance(hydratingOwned?prior.resistance:'');
      const learned=monster.knownSkills?.find(id=>skills.has(id));if(hydratingOwned&&!params.has('skill')&&learned)get('skill').value=String(learned);
      get('stat-source').textContent='Saved battle stats include the equipped accessory. Base Attack '+(monster.baseStats.attack??'unknown')+' · base Defense '+(monster.baseStats.defense??'unknown')+'.';
      if(!hydratingOwned){invalidLink=false;get('link-note').hidden=true;}update();
    },onInvalidate(){
      ownedSnapshot=null;individualResistances=null;get('attack').value='';get('defense').value='';get('stat-source').textContent='Enter the current battle stats, including equipment.';refillResistance();update();
    }});
    hydratingOwned=false;
    update();
  }
  globalThis.DQMCombatPlanner={renderRoute};
})();

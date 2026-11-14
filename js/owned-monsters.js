/* Shared, read-only bridge from My game to the calculators. Never writes a team
   or save file. Validate optional metadata separately from the roster schema. */
(function (root) {
  'use strict';
  const stats = ['hp','mp','attack','defense','agility','intelligence'];
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max ? value : null;
  const skillList = (value, max) => Array.isArray(value) && value.length <= max && value.every(id => integer(id,1,169) !== null) && new Set(value).size === value.length ? [...value] : null;
  function adapt(entry, team) {
    const saved = entry.saveDetails;
    const fresh = saved?.schemaVersion === 1 && saved.speciesIndex === entry.speciesIndex && saved.level === entry.level && saved.plus === entry.plus;
    const source = fresh ? saved : {};
    const copyStats = values => Object.fromEntries(stats.map(key => [key, integer(values?.[key],0,999)]));
    const campaign = ['terry','cobi','tara'].includes(source.campaign) ? source.campaign : ['terry','cobi','tara'].includes(team.campaign) ? team.campaign : team.game === 'dqm1' ? 'terry' : null;
    const level = integer(entry.level,1,99);
    const levelCap = integer(source.levelCap,level ?? 1,99);
    return {teamId:team.id,entryId:entry.id,speciesIndex:entry.speciesIndex,nickname:entry.nickname || '',
      campaign,level,plus:integer(entry.plus,0,99),levelCap,
      location:source.location === entry.location && ['party','farm','hibernation'].includes(source.trainingLocation) ? source.trainingLocation : entry.location === 'farm' ? 'farm' : 'party',
      baseStats:copyStats(source.baseStats),battleStats:copyStats(source.battleStats),
      currentHp:integer(source.currentHp,0,999),currentMp:integer(source.currentMp,0,999),
      knownSkills:skillList(source.knownSkills,8),inheritedSkills:skillList(source.inheritedSkills,25),
      resistances:Array.isArray(source.resistances) && source.resistances.length === 27 && source.resistances.every(code=>integer(code,0,7)!==null) ? [...source.resistances] : null,
      equipmentId:integer(source.equipmentId,64,94),
      sourceStatus:fresh?'save':saved?'changed':'manual'};
  }
  function resolve(document, teamId, entryId) {
    const team = document?.teams.find(row=>row.id===teamId);
    const entry = team?.entries.find(row=>row.id===entryId);
    return entry ? adapt(entry,team) : null;
  }
  const fingerprint = value => JSON.stringify(value);
  let lastSelection = null;
  let activeCleanup = null;
  const mounted = new WeakMap();
  function mount(host, {params=new URLSearchParams(),onSelect,onInvalidate}={}) {
    activeCleanup?.();
    mounted.get(host)?.destroy();
    const app = root.DQMAppState.create(root.DATA, root.DQMPlannerCore);
    const storage = root.DQMStorage.create();
    function documentState() {
      try {
        if (root.DQMApp) return app.normalizeDocument(root.DQMApp.state());
        const raw = storage.read(app.STORAGE_KEY);
        return raw ? app.parseDocument(raw) : null;
      } catch {return null;}
    }
    const label = document.createElement('label');
    label.className='owned-monster-label';label.textContent='Use a monster from My game';
    const select = document.createElement('select');
    select.id=host.id+'-select';label.htmlFor=select.id;
    const note = document.createElement('p');note.className='hint owned-monster-note';note.setAttribute('role','status');
    const link=document.createElement('a');link.href='#team-planner';link.textContent='My game →';
    host.classList.add('owned-monster-picker');host.replaceChildren(label,select,link,note);
    let selection=null,selectedValue='',documentValue=null;
    function fill() {
      documentValue=documentState();select.replaceChildren(new Option('Enter a monster manually',''));
      for(const team of documentValue?.teams||[]) {
        if(!team.entries.length)continue;
        const group=document.createElement('optgroup');group.label=team.name;
        for(const entry of team.entries) {
          const species=root.DATA.species.find(row=>row.index===entry.speciesIndex);
          const name=species?.display_name || species?.current_name || species?.name || 'Monster';
          group.append(new Option((entry.nickname?entry.nickname+' · ':'')+name+(integer(entry.level,1,99)!==null?' · Lv '+entry.level:'')+' · '+(entry.location==='farm'?'Farm':'Party'),team.id+'/'+entry.id));
        }
        select.append(group);
      }
      if(!documentValue?.teams.some(team=>team.entries.length))note.textContent='Import a save once in My game, then use its monsters in every tool.';
      select.value=selectedValue;
    }
    function choose(value) {
      const [teamId,entryId]=value.split('/');
      selection=value?resolve(documentValue,teamId,entryId):null;
      selectedValue=selection?value:'';select.value=selectedValue;
      if(selection) {
        lastSelection={teamId,entryId};
        note.textContent=selection.sourceStatus==='save'?'Copied from your imported save. Calculator changes stay in this plan.':selection.sourceStatus==='changed'?'This monster changed since import. Re-import to restore its saved stats and skills, or enter them below.':'This entry has no imported stats or skills. Re-import its save in My game, or enter the missing values below.';
        onSelect?.(selection);
      } else {
        lastSelection=null;note.textContent=value?'That monster is no longer in My game. Choose another monster or enter its details manually.':'Enter your own values below.';
        onInvalidate?.();
      }
    }
    function refresh() {
      const before=selection && fingerprint(selection),value=selectedValue;
      fill();
      if(!value)return;
      const [teamId,entryId]=value.split('/'),current=resolve(documentValue,teamId,entryId);
      if(fingerprint(current)!==before) {
        selection=null;selectedValue='';select.value='';lastSelection=null;
        note.textContent='This monster changed or was removed in My game. Select it again to refresh the calculation.';
        onInvalidate?.();
      }
    }
    select.addEventListener('change',()=>choose(select.value));
    fill();
    const unsubscribeStorage=storage.subscribe(app.STORAGE_KEY,refresh);
    const unsubscribeApp=root.DQMApp?.subscribe(refresh);
    const cleanup=()=>{unsubscribeStorage();unsubscribeApp?.();root.removeEventListener('hashchange',onRoute);};
    function onRoute(){root.setTimeout(()=>{if(!host.isConnected||host.closest('[hidden]'))cleanup();},0);}
    root.addEventListener('hashchange',onRoute);
    const api={selected:()=>selection,detach(){selection=null;selectedValue='';select.value='';lastSelection=null;note.textContent='Custom plan. Your My game monster is unchanged.';},destroy:cleanup};
    mounted.set(host,api);
    activeCleanup=cleanup;
    const requested=params.has('owned')?{teamId:params.get('team'),entryId:params.get('owned')}:null;
    // Explicit shared calculation inputs take precedence over session convenience.
    const initial=requested || (!params.has('species')?lastSelection:null);
    if(initial)choose(initial.teamId+'/'+initial.entryId);
    return api;
  }
  root.DQMOwnedMonsters={adapt,resolve,mount};
  if(typeof module==='object'&&module.exports)module.exports=root.DQMOwnedMonsters;
})(globalThis);

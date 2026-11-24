/* Encounter-specific recruitment planning. Native records and arithmetic are
   separate from the current guide's names and navigation. */
(() => {
  'use strict';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const normal = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f’']/g, '');
  const campaigns = {terry:'Terry', cobi:'Cobi', tara:'Tara'};
  const kinds = {all:'All encounters',wild:'Wild monsters',boss:'Bosses',master:'Foreign masters'};
  const meatItems = DQMRecruitment.meats;
  const healingItems = DQMRecruitment.healingItems;
  const percentage = value => (100 * value).toLocaleString('en-US', {maximumFractionDigits:2}) + '%';
  const range = (values, format = String) => values[0] === values[1] ? format(values[0]) : format(values[0]) + '–' + format(values[1]);
  const species = new Map(GUIDE_REFERENCE.species.map(row => [row.index,row]));
  const entries = new Map([...FIELD_GUIDE.entries,...(globalThis.WORLD_GUIDE?.entries || [])].map(row => [row.id,row]));
  const name = id => species.get(id)?.display_name || 'Unknown monster';
  const itemName = id => entries.get('item-'+id)?.title || 'Item';
  const aliases = id => {
    const row = species.get(id);
    return normal([row?.display_name,row?.short_name,row?.japanese,...(row?.aliases || [])].join(' '));
  };
  const locations = new Map();
  for (const row of species.values()) for (const location of row.locations || []) {
    locations.set(location.game+'-'+location.context_id,location);
  }
  const encounters = RECRUITMENT_REFERENCE.encounters.map(row => {
    const key = row.campaign+'-'+row.contextId, location = locations.get(key);
    const title = row.kind === 'master' ? 'Foreign masters · Rank '+row.masterRank :
      entries.get(row.locationId)?.title || location?.name || row.title || '';
    const floors = row.kind === 'wild' ? location?.floors || '' : '';
    return {...row,key,title,floors,
      text:normal([title,floors,row.title,kinds[row.kind],...(location?.aliases || [])].join(' '))};
  }).filter(row => row.title);
  const field = (id,label,control) => '<label class="recruit-field" for="'+id+'"><span>'+label+'</span>'+control+'</label>';
  const quantity = id => '<input id="'+id+'" type="number" inputmode="numeric" min="0" max="99" step="1" value="0">';
  const effect = text => '<span class="recruit-item-effect">'+text+'</span>';
  const recoveryId = (item, target = 0) => 'recruit-recovery-'+item.itemId+(item.itemId === 3 ? '-'+target : '');
  function healingEffect(item) {
    if (item.variable) return item.resource === 'hp' ? '½ HP restored per enemy +5' : '½ MP restored +5';
    if (item.itemId === 11) return '+30–35 per enemy; +5 if consumed';
    return '+'+range(item.appealRange);
  }
  function recoveryFields(item) {
    if (!item.variable) return '';
    const targets = item.itemId === 3 ? [0,1,2] : [0];
    return '<div id="recruit-recovery-fields-'+item.itemId+'" class="recruit-recovery-fields" hidden>'+
      '<p class="recruit-hint">'+(item.itemId === 3 ? 'HP restored to each enemy per use. Leave unaffected enemies at 0.' : 'MP restored per use.')+' Use the same amounts for each counted use.</p>'+
      targets.map(target => field(recoveryId(item,target),item.itemId === 3 ? 'Enemy '+(target+1)+' HP restored' : 'MP restored',
        '<input id="'+recoveryId(item,target)+'" type="number" inputmode="numeric" min="0" max="65535" step="1" value="0">')).join('')+'</div>';
  }

  function markup(row) {
    if (['item-1','item-2','item-3','item-4','item-5','item-11','item-25','item-26','item-27','item-28','item-30'].includes(row.id)) {
      return '<p class="recruit-link"><a href="#recruiting">Compare items and recruitment chances →</a></p>';
    }
    if (row.id !== 'field-recruitment') return '';
    return '<section id="recruitment-calculator" class="recruitment-calculator" aria-labelledby="recruit-heading">'+
      '<div class="recruit-heading"><h3 id="recruit-heading">Recruitment calculator</h3></div>'+
      '<p class="recruit-intro">Choose an encounter and monster, then enter the items used. A species can have different joining rules in a wild encounter, a boss fight or a foreign master’s team.</p>'+
      '<p id="recruit-link-note" class="recruit-note" hidden></p>'+
      '<div class="recruit-layout"><div class="recruit-selection">'+
        '<div class="recruit-filter-row">'+field('recruit-game','Adventure','<select id="recruit-game">'+Object.entries(campaigns).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select>')+
        field('recruit-kind','Encounter type','<select id="recruit-kind">'+Object.entries(kinds).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select>')+'</div>'+
        field('recruit-search','Find an area or monster','<input id="recruit-search" type="search" placeholder="Name, alias, rank or Japanese name" autocomplete="off">')+
        field('recruit-area','Encounter / area','<select id="recruit-area"></select>')+
        field('recruit-enemy','Monster','<select id="recruit-enemy"></select>')+
        '<p id="recruit-location" class="recruit-location"></p>'+
        '<label class="recruit-check"><input id="recruit-collected" type="checkbox"><span>I have collected this species before<small>Includes earlier recruits, gifts and breeding, even if you no longer own one.</small></span></label>'+
        '<p id="recruit-empty" class="recruit-note" hidden>No recorded encounters match. <button type="button" id="recruit-clear-search">Clear filters</button></p>'+
      '</div><div class="recruit-feeding">'+
        '<h4>Items used on enemies</h4><p class="recruit-hint">Values beside items are recruitment appeal points per successful use. The score is shared across the battle.</p>'+
        '<h5>Meat</h5><p id="recruit-meat-note" class="recruit-hint" hidden>These boss battles refuse meat. Meat counts do not contribute here.</p>'+
        '<div class="recruit-meats">'+meatItems.map(item=>field('recruit-meat-'+item.itemId,safe(itemName(item.itemId))+' '+effect('+'+item.appeal),quantity('recruit-meat-'+item.itemId))).join('')+'</div>'+
        '<h5>Healing and MP recovery</h5><p class="recruit-hint">Count successful uses on injured enemies. Full HP or MP attempts give no bonus. Restored-point formulas round each half down.</p>'+
        '<div class="recruit-healing">'+healingItems.map(item=>'<div class="recruit-healing-item">'+
          field('recruit-heal-'+item.itemId,safe(itemName(item.itemId))+' '+effect(healingEffect(item)),quantity('recruit-heal-'+item.itemId))+
          recoveryFields(item)+(item.itemId === 11 ? field('recruit-targets-11','Enemies healed per use',
            '<select id="recruit-targets-11"><option value="1">1 enemy</option><option value="2">2 enemies</option><option value="3">3 enemies</option></select>') : '')+'</div>').join('')+'</div>'+
        '<label class="recruit-check"><input id="recruit-orb" type="checkbox"><span>'+safe(itemName(30))+' '+effect('+4100; guarantees an eligible check')+'</span></label>'+
        '<button type="button" id="recruit-reset">Clear items</button>'+
      '</div></div>'+
      '<div id="recruit-result" class="recruit-result" role="status" aria-live="polite" aria-atomic="true"></div>'+
      '<div id="recruit-comparison" class="recruit-comparison"></div>'+
      '<p class="recruit-scope">This estimates the joining check for the selected eligible defeated monster, using the successful enemy item uses above. Healing your own party and other unlisted actions can also change the score. Ranges cover possible recovery amounts and whether a reusable item is consumed, not the chance of finding or selecting the monster. Arena battles and generated Magic Key wild encounters are not included.</p>'+
      '<div class="recruit-share"><button type="button" id="recruit-copy">Copy calculation link</button><span id="recruit-copy-status" role="status"></span><input id="recruit-share-url" aria-label="Calculation link" readonly hidden></div>'+
      '<details class="recruit-details"><summary>How the chance is calculated</summary><div id="recruit-breakdown"></div></details>'+
    '</section>';
  }

  function mount(article, row, params) {
    if (row.id !== 'field-recruitment') return;
    const root = article.querySelector('#recruitment-calculator');
    if (!root) return;
    const el = id => root.querySelector('#'+id);
    let selected = null, enemies = [], preferredSpecies = params.has('rc_species') ? Number(params.get('rc_species')) : null;
    const wantedGame = params.get('rc_game') || (params.get('game') === 'dqm2' ? 'cobi' : 'terry');
    const wantedKind = params.get('rc_kind') || 'all';
    el('recruit-game').value = Object.hasOwn(campaigns,wantedGame) ? wantedGame : 'terry';
    el('recruit-kind').value = Object.hasOwn(kinds,wantedKind) ? wantedKind : 'all';
    el('recruit-search').value = params.get('rc_q') || (preferredSpecies !== null && species.has(preferredSpecies) ? name(preferredSpecies) : '');
    el('recruit-collected').checked = params.get('rc_owned') === '1';
    el('recruit-orb').checked = params.get('rc_orb') === '1';
    for (const item of meatItems) el('recruit-meat-'+item.itemId).value = params.get('rc_'+item.itemId) || '0';
    for (const item of healingItems) {
      el('recruit-heal-'+item.itemId).value = params.get('rc_h'+item.itemId) || '0';
      if (item.variable) {
        const targets = item.itemId === 3 ? [0,1,2] : [0];
        for (const target of targets) el(recoveryId(item,target)).value = params.get('rc_r'+item.itemId+(item.itemId === 3 ? '_'+target : '')) || '0';
      }
    }
    if (el('recruit-targets-11')) el('recruit-targets-11').value = params.get('rc_t11') || '1';
    if (!Object.hasOwn(campaigns,wantedGame) || !Object.hasOwn(kinds,wantedKind) ||
        (preferredSpecies !== null && !species.has(preferredSpecies)) ||
        (params.has('rc_area') && !encounters.some(area => area.campaign === el('recruit-game').value && String(area.contextId) === params.get('rc_area')))) {
      el('recruit-link-note').hidden = false;
      el('recruit-link-note').textContent = 'That encounter is not in this reference. Choose a recorded encounter and monster below.';
    }

    function readCount(id, maximum = 99) {
      const input = el(id), value = input.valueAsNumber;
      const valid = Number.isInteger(value) && value >= 0 && value <= maximum;
      input.setAttribute('aria-invalid',String(!valid));
      if (!valid) throw new Error(maximum === 99 ? 'Enter a whole-number item count from 0 to 99.' : 'Enter whole restored points from 0 to '+maximum+'.');
      return value;
    }
    function settings() {
      const meats = {}, healing = {}, recoveryPerUse = {}, healedTargets = {};
      for (const item of meatItems) {
        const input = el('recruit-meat-'+item.itemId);
        if (input.disabled) { meats[item.itemId] = 0; input.setAttribute('aria-invalid','false'); }
        else meats[item.itemId] = readCount(input.id);
      }
      for (const item of healingItems) {
        const count = readCount('recruit-heal-'+item.itemId);
        healing[item.itemId] = count;
        if (item.variable) {
          el('recruit-recovery-fields-'+item.itemId).hidden = count === 0;
          const amounts = (item.itemId === 3 ? [0,1,2] : [0]).map(target=>{
            const input = el(recoveryId(item,target));
            if (!count || input.disabled) { input.setAttribute('aria-invalid','false'); return 0; }
            return readCount(input.id,65535);
          });
          recoveryPerUse[item.itemId] = item.itemId === 3 ? amounts : amounts[0];
        }
      }
      if (el('recruit-targets-11')) healedTargets[11] = Number(el('recruit-targets-11').value);
      return {meats,healing,recoveryPerUse,healedTargets,collected:el('recruit-collected').checked,orb:el('recruit-orb').checked};
    }
    function encounterOptions(enemy) {
      return {...enemy,battleMode:selected.battleMode ?? 0,meatAllowed:selected.meatAllowed ?? true};
    }
    function saveLink(enemy, choices) {
      const next = new URLSearchParams();
      if (params.has('section')) next.set('section',params.get('section'));
      next.set('rc_game',selected.campaign);
      if (el('recruit-kind').value !== 'all') next.set('rc_kind',el('recruit-kind').value);
      next.set('rc_area',String(selected.contextId));
      next.set('rc_species',String(enemy.speciesIndex));
      next.set('rc_enemy',el('recruit-enemy').value);
      if (enemy.recordIndex !== undefined) next.set('rc_record',String(enemy.recordIndex));
      const query = el('recruit-search').value;
      if (query && normal(query) !== normal(name(enemy.speciesIndex))) next.set('rc_q',query);
      if (choices.collected) next.set('rc_owned','1');
      if (choices.orb) next.set('rc_orb','1');
      for (const item of meatItems) if (choices.meats[item.itemId]) next.set('rc_'+item.itemId,choices.meats[item.itemId]);
      for (const item of healingItems) {
        if (choices.healing[item.itemId]) next.set('rc_h'+item.itemId,choices.healing[item.itemId]);
        if (item.variable) {
          const amounts = item.itemId === 3 ? choices.recoveryPerUse[item.itemId] : [choices.recoveryPerUse[item.itemId]];
          amounts.forEach((amount,target)=>{if (amount) next.set('rc_r'+item.itemId+(item.itemId === 3 ? '_'+target : ''),amount);});
        }
      }
      if (choices.healedTargets[11] > 1) next.set('rc_t11',choices.healedTargets[11]);
      history.replaceState(history.state,'','#recruiting?'+next);
    }
    function compare(enemy, choices, check) {
      if (check.reason !== 'normal') return;
      const available = [
        ...(selected.meatAllowed === false || selected.battleMode === 1 ? [] : meatItems.map(item=>({...item,type:'meats'}))),
        ...healingItems.filter(item=>!item.variable || (Array.isArray(choices.recoveryPerUse[item.itemId]) ?
          choices.recoveryPerUse[item.itemId].some(value=>value>0) : choices.recoveryPerUse[item.itemId]>0)).map(item=>({...item,type:'healing'})),
      ];
      el('recruit-comparison').innerHTML = '<h4>Would one more item help?</h4><div class="table-scroll"><table><thead><tr><th scope="col">Add one</th><th scope="col">Joining chance</th><th scope="col">Increase</th></tr></thead><tbody>'+available.map(item=>{
        const more = DQMRecruitment.calculate({...encounterOptions(enemy),...choices,[item.type]:{...choices[item.type],[item.itemId]:choices[item.type][item.itemId]+1}});
        const same = more.probabilityRange.every((value,index)=>value === check.probabilityRange[index]);
        const gains = [Math.max(0,more.probabilityRange[0]-check.probabilityRange[1]),Math.max(0,more.probabilityRange[1]-check.probabilityRange[0])];
        const gainText = same ? 'No change' :
          '+'+range(gains.map(value=>value*100),value=>value.toLocaleString('en-US',{maximumFractionDigits:2}))+' points';
        return '<tr><th scope="row"><a href="#field-guide?entry=item-'+item.itemId+'">'+safe(itemName(item.itemId))+'</a></th><td>'+range(more.probabilityRange,percentage)+'</td><td>'+gainText+'</td></tr>';
      }).join('')+'</tbody></table></div>';
    }
    function result() {
      const enemy = enemies[Number(el('recruit-enemy').value)];
      el('recruit-copy-status').textContent = '';
      el('recruit-share-url').hidden = true;
      el('recruit-comparison').replaceChildren();
      el('recruit-breakdown').replaceChildren();
      el('recruit-copy').disabled = !enemy;
      const refuseMeat = selected?.meatAllowed === false || selected?.battleMode === 1;
      for (const item of meatItems) el('recruit-meat-'+item.itemId).disabled = refuseMeat;
      el('recruit-meat-note').hidden = !refuseMeat;
      if (!enemy) { el('recruit-result').textContent = 'Choose a recorded encounter to calculate its chance.'; return; }
      const candidateFormations = selected.formations?.filter(formation=>formation.enemyRecordIndices.includes(enemy.recordIndex));
      const targetLimit = Math.min(3,candidateFormations?.length ?
        Math.max(...candidateFormations.map(formation=>formation.enemyRecordIndices.length)) : selected.maxEnemies || 3);
      for (const item of healingItems.filter(item=>item.itemId === 3)) {
        for (const target of [0,1,2]) {
          const input = el(recoveryId(item,target));
          input.closest('label').hidden = target >= targetLimit;
          input.disabled = target >= targetLimit;
          if (input.disabled) input.value = '0';
        }
      }
      if (el('recruit-targets-11')) {
        const previous = Number(el('recruit-targets-11').value);
        el('recruit-targets-11').replaceChildren(...Array.from({length:targetLimit},(_,index)=>new Option((index+1)+(index ? ' enemies' : ' enemy'),String(index+1))));
        el('recruit-targets-11').value = String(Math.max(1,Math.min(targetLimit,previous || 1)));
      }
      let choices, check;
      try {
        choices = settings();
        check = DQMRecruitment.calculate({...encounterOptions(enemy),...choices});
      } catch (error) {
        el('recruit-result').textContent = error.message;
        el('recruit-copy').disabled = true;
        return;
      }
      const explanation = check.reason.startsWith('blocked') ? 'Normal recruitment is blocked for this encounter. More items or a Starry Orb will not change it.' :
        check.reason === 'orb' ? 'The Starry Orb guarantees this check once the monster is eligible.' :
        check.reason === 'automatic' ? 'This encounter passes the joining check automatically once eligible.' :
        choices.collected ? 'Joining chance after previous collection.' : 'Joining chance for a first collection.';
      const variable = check.probabilityRange[0] !== check.probabilityRange[1];
      el('recruit-result').innerHTML = '<div class="recruit-monster">'+spriteMarkup(enemy.speciesIndex)+
        '<div><a href="#monster?id='+enemy.speciesIndex+'">'+safe(name(enemy.speciesIndex))+'</a><small>'+safe(selected.title)+(selected.floors ? ' · '+safe(selected.floors) : '')+' · Lv '+enemy.level+'</small></div></div>'+
        '<div class="recruit-chance"><strong>'+range(check.probabilityRange,percentage)+'</strong><span>eligible joining check</span></div><p>'+explanation+'</p>'+
        (variable ? '<p>The range reflects the possible healing rolls and item consumption. It is not a guaranteed result.</p>' : '');
      compare(enemy,choices,check);
      el('recruit-breakdown').innerHTML = (check.reason === 'normal' ?
        '<p>Recruitment appeal: <strong>'+range(check.appealRange)+'</strong>. After this encounter’s multiplier: <strong>'+range(check.adjustedAppealRange)+'</strong>.</p>'+
        '<p>The first-collection roll is '+percentage(check.firstCollectionChance)+'. If that does not succeed, the item-related chance is '+range(check.feedingChanceRange,percentage)+'. These combine into the displayed estimate; their percentages are not simply added.</p>' : '<p>'+explanation+'</p>')+
        '<p>Previously collected means the game’s collection history, including gifts and breeding. Meat and healing share one score. Count only successful enemy uses here; recovery items used on your party can lower that score.</p>';
      saveLink(enemy,choices);
    }
    function chooseEnemy(preferredIndex, preferredRecord) {
      const query = normal(el('recruit-search').value), oldEnemy = enemies[Number(el('recruit-enemy').value)];
      enemies = selected ? selected.enemies.filter(enemy => !query || selected.text.includes(query) || aliases(enemy.speciesIndex).includes(query)) : [];
      el('recruit-enemy').replaceChildren(...enemies.map((enemy,index)=>new Option(name(enemy.speciesIndex)+' · Lv '+enemy.level,String(index))));
      const exact = preferredRecord === undefined ? -1 : enemies.findIndex(enemy=>enemy.recordIndex === preferredRecord &&
        (preferredSpecies === null || enemy.speciesIndex === preferredSpecies));
      const wanted = enemies.findIndex(enemy => enemy.speciesIndex === (preferredSpecies ?? oldEnemy?.speciesIndex));
      if (exact >= 0) el('recruit-enemy').value = String(exact);
      else if (Number.isInteger(preferredIndex) && enemies[preferredIndex] &&
          (preferredSpecies === null || enemies[preferredIndex].speciesIndex === preferredSpecies)) el('recruit-enemy').value = String(preferredIndex);
      else if (wanted >= 0) el('recruit-enemy').value = String(wanted);
      preferredSpecies = null;
      el('recruit-enemy').disabled = !enemies.length;
      el('recruit-location').textContent = selected ? kinds[selected.kind]+' · '+campaigns[selected.campaign]+
        (selected.floors ? ' · '+selected.floors : '')+(selected.kind === 'master' ? ' · Rank '+selected.masterRank : '') : '';
      result();
    }
    function filterAreas(preferredArea, preferredEnemy, preferredRecord) {
      const query = normal(el('recruit-search').value), campaign = el('recruit-game').value, kind = el('recruit-kind').value;
      const requested = preferredSpecies !== null && species.has(preferredSpecies) ? preferredSpecies : null;
      const candidates = encounters.filter(area => area.campaign === campaign && (kind === 'all' || area.kind === kind) &&
        (requested === null || area.enemies.some(enemy=>enemy.speciesIndex===requested)) &&
        (!query || area.text.includes(query) || area.enemies.some(enemy=>aliases(enemy.speciesIndex).includes(query))));
      const old = preferredArea || selected?.key;
      const currentSpecies = requested ?? enemies[Number(el('recruit-enemy').value)]?.speciesIndex;
      selected = candidates.find(area => area.key === old) ||
        candidates.find(area => area.enemies.some(enemy => enemy.speciesIndex === currentSpecies)) || candidates[0] || null;
      el('recruit-area').replaceChildren(...candidates.map(area=>new Option(area.title+(area.floors ? ' · '+area.floors : '')+
        (kind === 'all' && area.kind === 'boss' ? ' · Boss' : ''),area.key)));
      if (selected) el('recruit-area').value = selected.key;
      el('recruit-area').disabled = !selected;
      el('recruit-empty').hidden = Boolean(selected);
      chooseEnemy(preferredEnemy,preferredRecord);
    }
    for (const id of ['recruit-game','recruit-kind']) el(id).addEventListener('change',()=>filterAreas());
    el('recruit-search').addEventListener('input',()=>filterAreas());
    el('recruit-area').addEventListener('change',()=>{ selected = encounters.find(area=>area.key===el('recruit-area').value); chooseEnemy(); });
    el('recruit-enemy').addEventListener('change',result);
    el('recruit-clear-search').addEventListener('click',()=>{el('recruit-search').value='';el('recruit-kind').value='all';filterAreas();el('recruit-search').focus();});
    for (const input of root.querySelectorAll('.recruit-feeding input[type="number"]')) input.addEventListener('input',result);
    for (const id of ['recruit-collected','recruit-orb','recruit-targets-11']) el(id)?.addEventListener('change',result);
    el('recruit-reset').addEventListener('click',()=>{
      for (const input of root.querySelectorAll('.recruit-feeding input[type="number"]')) input.value = '0';
      if (el('recruit-targets-11')) el('recruit-targets-11').value='1';
      el('recruit-orb').checked=false;result();
    });
    el('recruit-copy').addEventListener('click',async()=>{
      try { await navigator.clipboard.writeText(location.href); el('recruit-copy-status').textContent='Calculation link copied.'; }
      catch { const input=el('recruit-share-url');input.hidden=false;input.value=location.href;input.focus();input.select();el('recruit-copy-status').textContent='Copy the selected link.'; }
    });
    filterAreas(params.has('rc_area') ? el('recruit-game').value+'-'+params.get('rc_area') : null,
      params.has('rc_enemy') ? Number(params.get('rc_enemy')) : undefined,
      params.has('rc_record') ? Number(params.get('rc_record')) : undefined);
  }
  globalThis.DQMRecruitmentUI = {markup,mount};
})();

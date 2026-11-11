/* Encounter-specific recruitment planning. Names come from the current guide;
   the arithmetic and native encounter settings live in separate verified data. */
(() => {
  'use strict';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const normal = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f’']/g, '');
  const campaigns = {terry:'Terry', cobi:'Cobi', tara:'Tara'};
  const meatIds = [25,26,27,28];
  const percentage = value => (100 * value).toLocaleString('en-US', {maximumFractionDigits:2}) + '%';
  const species = new Map(GUIDE_REFERENCE.species.map(row => [row.index,row]));
  const items = new Map(FIELD_GUIDE.entries.filter(row => row.kind === 'item').map(row => [row.id,row]));
  const name = id => species.get(id)?.display_name || 'Unknown monster';
  const meatName = id => items.get('item-'+id)?.title || 'Meat';
  const aliases = id => {
    const row = species.get(id);
    return normal([row?.display_name,row?.short_name,row?.japanese,...(row?.aliases || [])].join(' '));
  };
  const locations = new Map();
  for (const row of species.values()) for (const location of row.locations || []) {
    if (location.kind === 'wild') locations.set(location.game+'-'+location.context_id,location);
  }
  const encounters = RECRUITMENT_REFERENCE.encounters.map(row => {
    const key = row.campaign+'-'+row.contextId, location = locations.get(key);
    return {...row,key,title:location?.name || '',floors:location?.floors || '',
      text:normal([location?.name,location?.floors,...(location?.aliases || [])].join(' '))};
  }).filter(row => row.title);
  const field = (id,label,control) => '<label class="recruit-field" for="'+id+'"><span>'+label+'</span>'+control+'</label>';

  function markup(row) {
    if (['item-25','item-26','item-27','item-28','item-30'].includes(row.id)) {
      return '<p class="recruit-link"><a href="#field-guide?entry=field-recruitment">Compare meat and recruitment chances →</a></p>';
    }
    if (row.id !== 'field-recruitment') return '';
    return '<section id="recruitment-calculator" class="recruitment-calculator" aria-labelledby="recruit-heading">'+
      '<div class="recruit-heading"><h3 id="recruit-heading">Recruitment calculator</h3><span>Wild encounters</span></div>'+
      '<p class="recruit-intro">Choose the place as well as the monster: the same species can have different recruitment settings in different encounters.</p>'+
      '<div class="recruit-examples"><span>Try an example:</span><button type="button" data-recruit-example="11">'+safe(name(11))+'</button><button type="button" data-recruit-example="20">'+safe(name(20))+'</button></div>'+
      '<p id="recruit-link-note" class="recruit-note" hidden></p>'+
      '<div class="recruit-layout"><div class="recruit-selection">'+
        '<div class="recruit-filter-row">'+field('recruit-game','Adventure','<select id="recruit-game">'+Object.entries(campaigns).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('')+'</select>')+
        field('recruit-search','Find an area or monster','<input id="recruit-search" type="search" placeholder="Name, alias or Japanese name" autocomplete="off">')+'</div>'+
        field('recruit-area','Area / floor band','<select id="recruit-area"></select>')+
        field('recruit-enemy','Monster','<select id="recruit-enemy"></select>')+
        '<p id="recruit-location" class="recruit-location"></p>'+
        '<label class="recruit-check"><input id="recruit-collected" type="checkbox"><span>I have collected this species before<small>Includes earlier recruits, gifts and breeding, even if you no longer own one.</small></span></label>'+
        '<p id="recruit-empty" class="recruit-note" hidden>No recorded encounters match. <button type="button" id="recruit-clear-search">Clear search</button></p>'+
      '</div><div class="recruit-feeding">'+
        '<h4>Meat used in this battle</h4><p class="recruit-hint">Count meat used on enemies. The food score is shared across the battle.</p>'+
        '<div class="recruit-meats">'+meatIds.map(id=>field('recruit-meat-'+id,safe(meatName(id)),
          '<input id="recruit-meat-'+id+'" type="number" inputmode="numeric" min="0" max="99" step="1" value="0">')).join('')+'</div>'+
        '<label class="recruit-check"><input id="recruit-orb" type="checkbox"><span>Starry Orb used</span></label>'+
        '<button type="button" id="recruit-reset">Clear meat &amp; Orb</button>'+
      '</div></div>'+
      '<div id="recruit-result" class="recruit-result" role="status" aria-live="polite" aria-atomic="true"></div>'+
      '<div id="recruit-comparison" class="recruit-comparison"></div>'+
      '<p class="recruit-scope">This is the joining check for an eligible defeated monster, not the chance of finding it or making it the candidate. It does not cover arena battles, scripted bosses or generated Magic Key encounters. Meat and the Orb cannot bypass battle restrictions.</p>'+
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
    el('recruit-game').value = Object.hasOwn(campaigns,wantedGame) ? wantedGame : 'terry';
    el('recruit-search').value = params.get('rc_q') || (preferredSpecies !== null && species.has(preferredSpecies) ? name(preferredSpecies) : '');
    el('recruit-collected').checked = params.get('rc_owned') === '1';
    el('recruit-orb').checked = params.get('rc_orb') === '1';
    for (const id of meatIds) el('recruit-meat-'+id).value = params.get('rc_'+id) || '0';
    if (!Object.hasOwn(campaigns,wantedGame) || (preferredSpecies !== null && !species.has(preferredSpecies)) ||
        (params.has('rc_area') && !encounters.some(area => area.campaign === el('recruit-game').value && String(area.contextId) === params.get('rc_area')))) {
      el('recruit-link-note').hidden = false;
      el('recruit-link-note').textContent = 'That encounter is not in this reference. Choose a recorded area and monster below.';
    }

    function options() {
      const meats = {};
      for (const id of meatIds) {
        const input = el('recruit-meat-'+id), count = input.valueAsNumber;
        const valid = Number.isInteger(count) && count >= 0 && count <= 99;
        input.setAttribute('aria-invalid',String(!valid));
        if (!valid) throw new Error('Enter a whole-number meat count from 0 to 99.');
        meats[id] = count;
      }
      return {meats,collected:el('recruit-collected').checked,orb:el('recruit-orb').checked};
    }
    function saveLink(enemy, settings) {
      const next = new URLSearchParams(params);
      for (const key of [...next.keys()]) if (key.startsWith('rc_')) next.delete(key);
      next.set('entry','field-recruitment');
      next.set('rc_game',selected.campaign);
      next.set('rc_area',String(selected.contextId));
      next.set('rc_species',String(enemy.speciesIndex));
      next.set('rc_enemy',el('recruit-enemy').value);
      const query = el('recruit-search').value;
      // A profile/example link follows the species ID after a name refresh.
      // Keep only an independently entered filter in the shared URL.
      if (query && normal(query) !== normal(name(enemy.speciesIndex))) next.set('rc_q',query);
      if (settings.collected) next.set('rc_owned','1');
      if (settings.orb) next.set('rc_orb','1');
      for (const id of meatIds) if (settings.meats[id]) next.set('rc_'+id,settings.meats[id]);
      history.replaceState(history.state,'','#field-guide?'+next);
    }
    function result() {
      const enemy = enemies[Number(el('recruit-enemy').value)];
      el('recruit-copy-status').textContent = '';
      el('recruit-share-url').hidden = true;
      el('recruit-comparison').replaceChildren();
      el('recruit-breakdown').replaceChildren();
      el('recruit-copy').disabled = !enemy;
      if (!enemy) { el('recruit-result').textContent = 'Choose a recorded encounter to calculate its chance.'; return; }
      let settings, check;
      try {
        settings = options();
        check = DQMRecruitment.calculate({...enemy,...settings});
      } catch (error) {
        el('recruit-result').textContent = error.message;
        el('recruit-copy').disabled = true;
        return;
      }
      const blocked = check.reason.startsWith('blocked');
      const explanation = blocked ? 'Normal recruitment is blocked for this encounter. More meat or a Starry Orb will not change it.' :
        check.reason === 'orb' ? 'The Starry Orb guarantees this check once the monster is eligible.' :
        check.reason === 'automatic' ? 'This encounter passes the joining check automatically once eligible.' :
        settings.collected ? 'Joining chance after previous collection.' : 'Joining chance for a first collection.';
      el('recruit-result').innerHTML = '<div class="recruit-monster">'+spriteMarkup(enemy.speciesIndex)+
        '<div><a href="#monster?id='+enemy.speciesIndex+'">'+safe(name(enemy.speciesIndex))+'</a><small>'+safe(selected.title)+(selected.floors ? ' · '+safe(selected.floors) : '')+' · Lv '+enemy.level+'</small></div></div>'+
        '<div class="recruit-chance"><strong>'+percentage(check.probability)+'</strong><span>eligible joining check</span></div><p>'+explanation+'</p>';
      if (check.reason === 'normal') {
        el('recruit-comparison').innerHTML = '<h4>Would one more piece help?</h4><div class="table-scroll"><table><thead><tr><th scope="col">Add one</th><th scope="col">Joining chance</th><th scope="col">Increase</th></tr></thead><tbody>'+meatIds.map(id=>{
          const more = DQMRecruitment.calculate({...enemy,...settings,meats:{...settings.meats,[id]:settings.meats[id]+1}});
          return '<tr><th scope="row"><a href="#field-guide?entry=item-'+id+'">'+safe(meatName(id))+'</a></th><td>'+percentage(more.probability)+'</td><td>'+
            (more.probability > check.probability ? '+'+((more.probability-check.probability)*100).toLocaleString('en-US',{maximumFractionDigits:2})+' points' : 'No change')+'</td></tr>';
        }).join('')+'</tbody></table></div>';
      }
      el('recruit-breakdown').innerHTML = (check.reason === 'normal' ? '<p>Food score: <strong>'+check.appeal+'</strong>. After this encounter’s feeding multiplier: <strong>'+check.adjustedAppeal+'</strong>.</p>' : '')+
        (check.reason === 'normal' ? '<p>The first-collection roll is '+percentage(check.firstCollectionChance)+'. If that does not succeed, the feeding roll is '+percentage(check.feedingChance)+'. These rolls combine to give the displayed chance; their percentages are not simply added.</p>' : '<p>'+explanation+'</p>')+
        '<p>Previously collected means the game’s collection history, not just the monsters currently in your party or farm. Feeding your own monsters changes wildness instead of adding to this score.</p>';
      saveLink(enemy,settings);
    }
    function chooseEnemy(preferredIndex) {
      const query = normal(el('recruit-search').value);
      const oldSpecies = enemies[Number(el('recruit-enemy').value)]?.speciesIndex;
      enemies = selected ? selected.enemies.filter(enemy => !query || selected.text.includes(query) || aliases(enemy.speciesIndex).includes(query)) : [];
      el('recruit-enemy').replaceChildren(...enemies.map((enemy,index)=>new Option(name(enemy.speciesIndex)+' · Lv '+enemy.level,String(index))));
      const wanted = enemies.findIndex(enemy => enemy.speciesIndex === (preferredSpecies ?? oldSpecies));
      if (Number.isInteger(preferredIndex) && enemies[preferredIndex] &&
          (preferredSpecies === null || enemies[preferredIndex].speciesIndex === preferredSpecies)) el('recruit-enemy').value = String(preferredIndex);
      else if (wanted >= 0) el('recruit-enemy').value = String(wanted);
      preferredSpecies = null;
      el('recruit-enemy').disabled = !enemies.length;
      el('recruit-location').textContent = selected ? 'Recorded wild encounter · '+campaigns[selected.campaign]+(selected.floors ? ' · '+selected.floors : '') : '';
      result();
    }
    function filterAreas(preferredArea, preferredEnemy) {
      const query = normal(el('recruit-search').value), campaign = el('recruit-game').value;
      const requested = preferredSpecies !== null && species.has(preferredSpecies) ? preferredSpecies : null;
      const candidates = encounters.filter(area => area.campaign === campaign &&
        (requested === null || area.enemies.some(enemy=>enemy.speciesIndex===requested)) &&
        (!query || area.text.includes(query) || area.enemies.some(enemy=>aliases(enemy.speciesIndex).includes(query))));
      const old = preferredArea || selected?.key;
      const currentSpecies = requested ?? enemies[Number(el('recruit-enemy').value)]?.speciesIndex;
      selected = candidates.find(area => area.key === old) ||
        candidates.find(area => area.enemies.some(enemy => enemy.speciesIndex === currentSpecies)) || candidates[0] || null;
      el('recruit-area').replaceChildren(...candidates.map(area=>new Option(area.title+(area.floors ? ' · '+area.floors : ''),area.key)));
      if (selected) el('recruit-area').value = selected.key;
      el('recruit-area').disabled = !selected;
      el('recruit-empty').hidden = Boolean(selected);
      chooseEnemy(preferredEnemy);
    }
    el('recruit-game').addEventListener('change',()=>filterAreas());
    for (const button of root.querySelectorAll('[data-recruit-example]')) button.addEventListener('click',()=>{
      preferredSpecies = Number(button.dataset.recruitExample);
      el('recruit-game').value = 'terry';
      el('recruit-search').value = name(preferredSpecies);
      el('recruit-collected').checked = true;
      for (const id of meatIds) el('recruit-meat-'+id).value = id === 28 ? '1' : '0';
      el('recruit-orb').checked = false;
      filterAreas('terry-'+(preferredSpecies === 11 ? 1 : 22));
    });
    el('recruit-search').addEventListener('input',()=>filterAreas());
    el('recruit-area').addEventListener('change',()=>{ selected = encounters.find(area=>area.key===el('recruit-area').value); chooseEnemy(); });
    el('recruit-enemy').addEventListener('change',result);
    el('recruit-clear-search').addEventListener('click',()=>{el('recruit-search').value='';filterAreas();el('recruit-search').focus();});
    for (const id of meatIds) el('recruit-meat-'+id).addEventListener('input',result);
    for (const id of ['recruit-collected','recruit-orb']) el(id).addEventListener('change',result);
    el('recruit-reset').addEventListener('click',()=>{for (const id of meatIds) el('recruit-meat-'+id).value='0';el('recruit-orb').checked=false;result();});
    el('recruit-copy').addEventListener('click',async()=>{
      try { await navigator.clipboard.writeText(location.href); el('recruit-copy-status').textContent='Calculation link copied.'; }
      catch { const input=el('recruit-share-url');input.hidden=false;input.value=location.href;input.focus();input.select();el('recruit-copy-status').textContent='Copy the selected link.'; }
    });
    filterAreas(params.has('rc_area') ? el('recruit-game').value+'-'+params.get('rc_area') : null, params.has('rc_enemy') ? Number(params.get('rc_enemy')) : undefined);
  }
  globalThis.DQMRecruitmentUI = {markup,mount};
})();

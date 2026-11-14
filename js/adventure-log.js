/* The imported slot is a snapshot. Never infer collection progress from the editable roster. */
(() => {
  'use strict';
  function render(host, team, {safe, named, profileLink, familyLabelMarkup, extraRecord}) {
    const log = team.adventureLog;
    if (!log) { host.replaceChildren(); delete host.dataset.team; return; }
    const sameTeam = host.dataset.team === team.id;
    const previous = sameTeam && host.querySelector('[data-library-filter]')?.value;
    const expanded = new Set(sameTeam ? [...host.querySelectorAll('[data-family][open]')].map(el => el.dataset.family) : []);
    host.dataset.team = team.id;
    const num = value => value.toLocaleString('en-US');
    const registered = new Set(log.librarySpecies);
    // The PSX library ends at Darck. The three special species after it have no pages in-game.
    const library = DATA.species.filter(s => s.index >= 0 && s.index < 312);
    const families = library.reduce((map,s) => {
      if (!map.has(s.family_id)) map.set(s.family_id,[]);
      map.get(s.family_id).push(s);
      return map;
    }, new Map());
    const metric = (label,value) => '<div><dt>'+label+'</dt><dd>'+value+'</dd></div>';
    const itemNames = GUIDE_REFERENCE.guide_names.items;
    function itemList(label, rows, empty) {
      const total = rows.reduce((n,row) => n+row.quantity,0);
      const lines = rows.map(({itemId,quantity}) => {
        const item = itemNames['item-'+itemId];
        const itemLink = item ? '<a href="#field-guide?kind=item&amp;entry=item-'+itemId+'">'+safe(item.title)+'</a>' : 'Item #'+itemId;
        return '<li>'+itemLink+'<span>×'+num(quantity)+'</span></li>';
      });
      const more = lines.length > 6 ? '<details class="log-more"><summary>Show '+(lines.length-6)+' more item types</summary><ul class="log-items">'+lines.slice(6).join('')+'</ul></details>' : '';
      return '<section><h4>'+label+' <small>'+num(total)+'</small></h4>'+(lines.length ? '<ul class="log-items">'+lines.slice(0,6).join('')+'</ul>'+more : '<p class="hint">'+empty+'</p>')+'</section>';
    }
    const eggs = (log.eggs || []).map(e => '<li><span>'+(e.speciesIndex == null ? 'Unknown species' : profileLink(e.speciesIndex))+' <strong>+'+e.plus+'</strong></span><span>'+({male:'Male',female:'Female'}[e.sex] || 'Not appraised')+'</span></li>');
    const extras = (log.extraMonsters || []).map(e => '<li><div class="log-extra-head"><span>'+profileLink(e.speciesIndex)+(e.nickname?' · '+safe(e.nickname):'')+' <strong>+'+e.plus+'</strong></span><span>Lv. '+e.level+' · '+({male:'Male',female:'Female'}[e.sex])+' · '+({party:'Party',farm:'Farm',hibernation:'Hibernating'}[e.location] || 'Unknown location')+'</span></div>'+
      (e.saveDetails ? '<details class="roster-record"><summary>Monster details</summary>'+extraRecord(e)+'</details>' : '')+'</li>');
    const keys = log.keys;
    const keyNames = globalThis.DQMSaveImport?.fixedKeyNames || [];
    const keyQuests = ['quest-save-greatlog-the-first-keys','quest-save-greatlog-the-first-keys','quest-win-the-pirate-key','quest-find-the-ice-key','quest-sky-shield-and-flight'];
    const keyList = keys?.fixed.map(id => {
      const label = safe(keyNames[id] || ('Key #'+id));
      return '<li>'+(keyQuests[id]?'<a href="#field-guide?kind=quest&amp;entry='+keyQuests[id]+'">'+label+'</a>':label)+'</li>';
    }).join('');
    const generatedKeys = (keys?.generated || []).map(key => '<li>'+safe(globalThis.DQMSaveImport.generatedKeyName(key) || (key.appraised?'Appraised key':'Mysterious Key'))+' <small>· Slot '+key.slot+'</small></li>').join('');
    const mapId = log.savedMap && 'map-'+log.savedMap.scene+'-'+log.savedMap.area;
    const place = GUIDE_REFERENCE.guide_names.maps[mapId];
    const arena = log.arenaWins?.map(rank => '<a href="#field-guide?kind=quest&amp;entry=quest-arena-'+(team.campaign==='terry'?'dqm1':'dqm2')+'-'+rank+'">'+(rank==='kids'?'Kids’':safe(rank.toUpperCase()))+'</a>').join(' · ');
    host.innerHTML = '<header class="log-heading"><h3>Adventure log</h3><p>'+safe(({terry:'Terry',cobi:'Cobi',tara:'Tara'})[team.campaign] || team.name)+' · '+(log.completed?'Story complete':'Story in progress')+'</p></header>'+
      ((place || log.arenaWins) ? '<div class="log-progress">'+(place ? '<p>Saved at <a href="#atlas?map='+mapId+'">'+safe(place.title)+'</a></p>' : '')+(log.arenaWins ? '<p>Arena classes won: '+(arena || 'None yet')+'</p>':'')+'</div>' : '')+
      '<dl class="log-totals">'+metric('Playtime',num(log.hours)+'h '+log.minutes+'m')+metric('Gold on hand',num(log.gold)+' G')+metric('Gold in bank',num(log.bankGold)+' G')+metric('<a href="#field-guide?kind=mechanic&amp;entry=field-medals">Medals deposited</a>',num(log.depositedMedals))+'</dl>'+
      '<div class="log-inventory">'+itemList('Bag',log.bag,'Your bag is empty.')+itemList('Item bank',log.vault,'No items deposited.')+'</div>'+
      '<section class="log-library"><div class="log-section-heading"><h4>Monster library <small>'+registered.size+' / '+library.length+'</small></h4><div><label for="log-library-filter">Show</label> <select id="log-library-filter" data-library-filter><option value="missing">Still missing</option><option value="obtained">Obtained</option></select></div></div>'+
      '<p class="hint">Counts every species obtained in this adventure, including monsters you no longer own.</p><div data-library-families></div></section>'+
      ((keys || eggs.length) ? '<div class="log-inventory">'+(keys ? '<section><h4>Magic keys</h4>'+(keyList?'<ul class="log-key-list">'+keyList+'</ul>':'<p class="hint">No fixed keys.</p>')+(generatedKeys ? '<details class="log-more"><summary>'+num(keys.appraised)+' appraised · '+num(keys.mysterious)+' mysterious</summary><ul class="log-key-list">'+generatedKeys+'</ul></details>' : '<p>'+num(keys.appraised)+' appraised · '+num(keys.mysterious)+' mysterious</p>')+'<a href="#field-guide?kind=mechanic&amp;entry=field-generated-keys">Magic key appraisal</a></section>':'')+
      (eggs.length ? '<section><h4>Unhatched eggs <small>'+eggs.length+'</small></h4><ul class="log-items">'+eggs.join('')+'</ul><a href="#field-guide?kind=mechanic&amp;entry=field-eggs">Egg appraisal and hatching</a></section>':'')+'</div>' : '')+
      (extras.length ? '<section class="log-extra"><h4>Other saved monsters</h4><p class="hint">These species appear in the save but are outside the standard breeding roster.</p><ul class="log-extra-list">'+extras.join('')+'</ul></section>':'')+
      (log.unidentified ? '<p class="hint">Unidentified monster records: '+num(log.unidentified)+'.</p>' : '');
    const select = host.querySelector('[data-library-filter]');
    select.value = previous || (registered.size ? 'obtained' : 'missing');
    function showFamilies(open) {
      const obtained = select.value === 'obtained';
      const groups = [...families].map(([family,all]) => {
        const rows = all.filter(s => registered.has(s.index) === obtained);
        if (!rows.length) return '';
        const names = rows.map(s => '<li>'+profileLink(s.index,named(s.index))+'</li>').join('');
        return '<details data-family="'+family+'"'+(open.has(String(family))?' open':'')+'><summary>'+familyLabelMarkup(family,all[0].family_display)+' <span>'+rows.length+(obtained?' obtained':' missing')+'</span></summary><ul>'+names+'</ul></details>';
      }).join('');
      host.querySelector('[data-library-families]').innerHTML = groups || '<p>'+(obtained?'No species registered yet.':'You have registered every library species.')+'</p>';
    }
    showFamilies(expanded);
    select.addEventListener('change',() => showFamilies(new Set()));
  }
  globalThis.DQMAdventureLog = {render};
})();

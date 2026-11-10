/* Campaign location indexes. Gate names and floors come from the same PSX
   encounter records as the atlas. Map IDs select stops along the story route. */
(() => {
  'use strict';
  const sideGates = [
    ['bazaar',10,12,'quest-fire-at-the-bazaar','Give the cook a fire-making monster'],
    ['well',19,22,'quest-the-well-professor-s-experiment','Give the professor a monster with a lightning skill'],
    ['farm',31,34], ['arena-left',45,49],
    ['medal',60,64,'quest-medal-gate','Turn in 13 Tiny Medals'],
    ['library',75,79,'quest-open-the-library-s-inner-room','Register 100 species'],
    ['bazaar-edge',110,113,'quest-summon-entertainment-at-the-bazaar','After the tournament, bring a monster with Summon'],
    ['arena-right',114,117],
    ['stubborn-old-man',118,121,'quest-show-the-golden-slime','After the tournament, show a Golden Slime'],
    ['hidden',122,125]
  ];
  const worldStops = [
    ['greatlog','quest-save-greatlog-the-first-keys',['14-0','16-7','15-0','21-35']],
    ['desert-world','quest-save-greatlog-the-first-keys',['23-0','22-0','22-2','102-0','24-0']],
    ['water-world','quest-win-the-pirate-key',['25-0','27-0','25-2','29-1','30-0','28-0']],
    ['ice-world','quest-find-the-ice-key',['34-0','36-0','33-0','37-0','31-0','40-0','32-0']],
    ['sky-world','quest-sky-shield-and-flight',['44-0','46-0','49-0','50-0','45-0','42-0','43-0']],
    ['world-between-worlds','story-sky-demon-lord',['52-2']]
  ];
  const familyGates = ['extinction','manipulation','ambition','sleep','domination','destruction'];
  const sideId = slug => 'location-'+slug+'-gate';

  // Ten GreatTree gates have encounter tables but no separate story chapter.
  // Give them the same searchable, shareable floor-by-floor articles as the
  // arena gates, reusing the unlock quest when its requirements are known.
  const encounters = new Map();
  for (const monster of GUIDE_REFERENCE.species) {
    for (const area of monster.locations || []) {
      if (area.game!=='terry' || area.kind!=='wild') continue;
      if (!encounters.has(area.context_id)) encounters.set(area.context_id,{name:area.name,levels:[]});
      encounters.get(area.context_id).levels.push(...area.levels);
    }
  }
  for (const [slug,start,end,questId] of sideGates) {
    const name=encounters.get(start).name;
    const contexts=Array.from({length:end-start+1},(_,i)=>start+i);
    const levels=contexts.flatMap(id=>encounters.get(id).levels);
    const levelRange='Lv. '+Math.min(...levels)+'–'+Math.max(...levels);
    const quest=WORLD_GUIDE.entries.find(row=>row.id===questId);
    const id=sideId(slug);
    WORLD_GUIDE.entries.push({id,kind:'location',game:'dqm1',campaigns:['terry'],title:name,region:'GreatTree',
      summary:quest?.summary || 'Wild monsters in this gate are '+levelRange+'.',levelRange,
      related:quest ? [quest.id] : [], details:[], spoiler:quest?.spoiler || 'story',
      source_ids:quest?.source_ids || []});
    FIELD_ROUTES.routes[id]={encounters:{terry:contexts}};
  }

  function render(game,{byId,routes,escape,entryLink,mapLink,hidden,adventures}) {
    const compact = items => '<ul class="place-links">'+items.map(item=>'<li>'+item+'</li>').join('')+'</ul>';
    const heading = label => game ? '<h3>'+label+'</h3>' : '<h4>'+label+'</h4>';
    function terry() {
      const rankRow=(label,ids)=>'<div><dt>'+label+'</dt><dd>'+compact(ids.map(id=>entryLink(id)))+'</dd></div>';
      const stages = ['story-terry-early-arena','story-terry-anger','story-terry-upper-arena'].flatMap(id=>routes[id].stages);
      const ranks=stages.map(stage=>{
        const rank=stage.arena.split('-').at(-1).toUpperCase();
        return rankRow(entryLink(stage.arena,'Win Class '+rank),stage.gates);
      });
      const families=familyGates.map(slug=>{
        const row=byId.get(sideId(slug));
        const note=row.summary.replace(/^Third basement floor, /i,'').replace(';',' ·').replace(/ monsters\.$/, '');
        return '<li>'+entryLink(row.id)+(hidden(row) ? '' : '<small>'+escape(note)+'</small>')+'</li>';
      });
      const aroundTown=sideGates.map(([slug,,,questId,condition])=>{
        const row=byId.get(sideId(slug));
        const info=questId ? entryLink(questId,condition) : escape(row.levelRange);
        return '<li>'+entryLink(row.id)+(hidden(row) ? '' : '<small>'+info+'</small>')+'</li>';
      });
      return heading('Travelers’ Gate Chamber')+'<dl class="gate-ranks">'+rankRow('First assignment',['location-departure-gate'])+ranks.join('')+'</dl>'+
        heading('Gates around GreatTree')+'<ul class="town-gates">'+aroundTown.join('')+'</ul>'+
        heading('Postgame · Gate Chamber B3')+'<ul class="family-gates">'+families.join('')+'</ul>';
    }
    function siblings() {
      return worldStops.map(([slug,keyQuest,stops])=>{
        const row=byId.get('location-'+slug);
        const firstChapter=row.related.find(id=>id.startsWith('story-'));
        const name=heading(entryLink(row.id));
        if (hidden(row)) return '<section class="world-stop">'+name+'</section>';
        const keySource=byId.get(keyQuest);
        const key=hidden(keySource) ? escape(row.key) : entryLink(keyQuest,row.key);
        return '<section class="world-stop">'+name+'<p>'+key+' · '+entryLink(firstChapter,'Walkthrough')+'</p>'+
          compact(stops.map(id=>mapLink('map-'+id)))+'</section>';
      }).join('')+heading('Other magic keys')+compact(['field-generated-keys','quest-talking-pot-key','story-greatlog-postgame'].map(id=>entryLink(id)));
    }
    const sections=[];
    for (const [campaign,body,noun] of [['dqm1',terry,'gates'],['dqm2',siblings,'worlds']]) {
      if (game && game!==campaign) continue;
      const title=game ? '' : '<h3>'+escape(adventures[campaign])+'’s '+noun+'</h3>';
      sections.push('<section class="campaign-places">'+title+body()+'</section>');
    }
    return sections.join('');
  }
  globalThis.DQMLocations={render};
})();

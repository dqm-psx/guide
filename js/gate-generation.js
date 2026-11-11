/* Shared, DOM-free presentation of verified PSX gate generation tables. */
(() => {
  'use strict';
  function render(id,{escape,headingLevel=3,data=globalThis.GATE_GENERATION}={}) {
    const gate=data?.entries[id];
    if (!gate) return '';
    const heading=Math.min(5,Math.max(2,headingLevel));
    const range=([start,end])=>start===end ? start+'F' : start+'–'+end+'F';
    const terrains=gate.terrains.map(({id})=>data.terrains[id]).filter(Boolean);
    const layouts=new Map();
    for (const terrain of terrains) {
      if (!layouts.has(terrain.layout)) layouts.set(terrain.layout,[]);
      layouts.get(terrain.layout).push(terrain);
    }
    const cards=[...layouts.values()].map(group=>'<div class="gate-terrain-group"><p>'+escape(group[0].variation)+'</p>'+
      '<ul class="gate-terrain-list" aria-label="Possible terrain types">'+group.map(terrain=>'<li><img src="'+escape(terrain.image)+'" alt="" loading="lazy" width="240" height="192">'+
        '<strong>'+escape(terrain.name)+'</strong></li>').join('')+'</ul></div>').join('');
    const special=gate.specialFloors;
    const unused=gate.availability==='unused';
    const rooms=special?.rooms || [];
    const specials=rooms.length ? '<div class="gate-special-floors"><h'+(heading+1)+'>Special floors · English patch</h'+(heading+1)+'>'+
      '<p>Special rooms can replace a regular floor on '+escape(special.floors.map(floor=>floor+'F').join(', '))+'. They are not guaranteed.</p>'+
      '<ul>'+rooms.map(room=>'<li>'+escape(room.name)+'</li>').join('')+'</ul></div>' : '';
    const label=unused ? 'Unused floor data' : 'Generated floors';
    const description=unused ? 'The retained definition specifies '+escape(range(gate.ordinaryFloors))+' and a final area on '+escape(gate.finalFloor)+'F. The encounter labels still end at 39F; that inconsistency is also in the Japanese game. These records do not describe an accessible dungeon.' :
      '<strong>'+escape(range(gate.ordinaryFloors))+'</strong> · The final area is on <strong>'+escape(gate.finalFloor)+'F</strong>. These are terrain samples; floor layouts are generated for each visit.';
    return '<section class="gate-generation" aria-label="'+label+'"><h'+heading+'>'+label+'</h'+heading+'>'+
      '<p>'+description+'</p>'+
      cards+specials+'</section>';
  }
  globalThis.DQMGateGeneration={render};
})();

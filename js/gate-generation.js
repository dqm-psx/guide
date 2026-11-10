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
    const rooms=special?.rooms || [];
    const specials=rooms.length ? '<div class="gate-special-floors"><h'+(heading+1)+'>Special floors · English patch</h'+(heading+1)+'>'+
      '<p>Special rooms can replace a regular floor on '+escape(special.floors.map(floor=>floor+'F').join(', '))+'. They are not guaranteed.</p>'+
      '<ul>'+rooms.map(room=>'<li>'+escape(room.name)+'</li>').join('')+'</ul></div>' : '';
    return '<section class="gate-generation" aria-label="Generated floors"><h'+heading+'>Generated floors</h'+heading+'>'+
      '<p><strong>'+escape(range(gate.ordinaryFloors))+'</strong> · The final area is on <strong>'+escape(gate.finalFloor)+'F</strong>. These are terrain samples; floor layouts are generated for each visit.</p>'+
      cards+specials+'</section>';
  }
  globalThis.DQMGateGeneration={render};
})();

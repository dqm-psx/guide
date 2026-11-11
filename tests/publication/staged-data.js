const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Publication checks run after a wording refresh. Resolve expectations from
// that artifact using stable identities, rather than freezing translated names.
module.exports = function loadStagedData(root) {
  const context = vm.createContext({});
  for (const file of ['data/breeding-data.js','data/monster-reference.js','data/handbook-reference.js',
    'data/world-guide.js','data/field-guide.js','data/player-atlas.js','data/field-routes.js',
    'data/gate-entrances.js','data/gate-generation.js','data/character-dialogue.js','data/skill-descriptions.js',
    'js/current-names.js','js/locations.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{timeout:5000});
  }
  const data = JSON.parse(JSON.stringify({data:context.DATA,reference:context.MONSTER_REFERENCE,
    skills:context.SKILL_DESCRIPTIONS,entries:[...context.WORLD_GUIDE.entries,...context.FIELD_GUIDE.entries],
    maps:context.PLAYER_ATLAS.maps,dialogue:context.CHARACTER_DIALOGUE.entries}));
  data.entry = id => data.entries.find(row=>row.id===id);
  data.map = id => data.maps.find(row=>row.id===id);
  data.adventure = game => game==='dqm1' ? data.entry('npc-terry').title :
    data.entry('npc-cobi').title+' & '+data.entry('npc-tara').title;
  return data;
};

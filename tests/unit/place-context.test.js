'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const root = path.join(__dirname,'../..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'js/place-context.js'),'utf8'),context);
const create = context.DQMPlaceContext.create;
const ids = rows => Array.from(rows,row=>row.id);

test('location characters use destination maps and explicit unlock links, not the shared portal room',()=>{
  const entries=[{id:'gate',kind:'location',game:'dqm1',related:['unlock']},
    {id:'unlock',kind:'quest',related:['professor']},
    {id:'princess',kind:'npc',title:'Princess',map_ids:['final-event']},
    {id:'professor',kind:'npc',title:'Professor',map_ids:['town']},
    {id:'attendant',kind:'npc',title:'Attendant',map_ids:['chamber']},
    {id:'namesake',kind:'npc',title:'Princess',places:['Final area']}];
  const maps=[{id:'final',placeId:'final'},{id:'final-event',placeId:'final'},
    {id:'chamber',placeId:'chamber'},{id:'town',placeId:'town'}];
  const places=create({entries,maps,generation:{entries:{gate:{finalMaps:['final']}}},
    entrances:{entries:{gate:[{map:'chamber',x:.5,y:.5}]}}});
  assert.deepEqual(ids(places.charactersForLocation('gate').here),['princess']);
  assert.deepEqual(ids(places.charactersForLocation('gate').related),['professor']);
  assert.deepEqual(ids(places.locationsForCharacter('princess')),['gate']);
  assert.deepEqual(ids(places.locationsForCharacter('attendant')),[]);
});

test('shared gate rooms retain exact entrance floors without claiming one gate owns the chamber', () => {
  const entries=[{id:'location-a',kind:'location'},{id:'location-b',kind:'location'}];
  const maps=[{id:'b1',placeId:'b1',image:'first.webp'},
    {id:'b2',placeId:'b1',image:'second.webp'},
    {id:'b2-event',placeId:'b1',image:'second.webp'},
    {id:'end',placeId:'end',image:'end.webp'}];
  const places=create({entries,maps,routes:{'location-a':{maps:['end']}},entrances:{entries:{
    'location-a':[{map:'b2',x:.25,y:.4}], 'location-b':[{map:'b2',x:.75,y:.4}]
  }}});
  assert.equal(places.defaultMapForLocation('location-a').id,'b2');
  assert.deepEqual(ids(places.mapsForLocation('location-a')),['b1','end']);
  assert.equal(places.entrancesForMap('b1').length,0);
  assert.equal(places.entrancesForMap('b2').length,2);
  assert.equal(places.entrancesForMap('b2-event').length,2);
  assert.equal(places.entrancesForLocation('location-a')[0].location.id,'location-a');
  assert.equal(places.locationForMap('b2'),null);
  assert.equal(places.locationForMap('end').id,'location-a');
});

test('place context joins native aliases by ID and keeps regional information separate', () => {
  const entries = [
    {id:'location-gate',kind:'location'},
    {id:'location-ice-world',kind:'location'},
    {id:'chapter-gate',kind:'story'},
    {id:'quest-gate',kind:'quest',map_ids:['gate-event']},
    {id:'boss-gate',kind:'boss'},
    {id:'npc-gate',kind:'npc',map_ids:['gate-base','gate-event']},
    {id:'chapter-world',kind:'story',map_ids:['town']},
    {id:'quest-same-name',kind:'quest',places:['Gate']}
  ];
  const maps = [
    {id:'gate-base',placeId:'gate-base',scene:72,title:'Gate'},
    {id:'gate-event',placeId:'gate-base',scene:72,title:'Gate'},
    {id:'town',placeId:'town',scene:38,title:'Wiston'},
    {id:'inn',placeId:'inn',scene:38,title:'Wiston Inn'},
    {id:'unrelated',placeId:'unrelated',scene:200,title:'Gate'}
  ];
  const routes = {
    'location-gate':{maps:['gate-event'],encounters:{terry:[2,3]}},
    'location-ice-world':{maps:['town'],encounters:{cobi:[29],tara:[29]}},
    'chapter-gate':{maps:['gate-event']},
    'boss-gate':{maps:['gate-base']}
  };
  const places=create({entries,routes,maps,scenes:{ice:[38]}});
  assert.deepEqual(ids(places.mapsForLocation('location-gate')),['gate-base']);
  assert.deepEqual(ids(places.mapsForLocation('location-ice-world')),['town','inn']);
  assert.equal(places.locationForMap('gate-event').id,'location-gate');
  const gate=places.contextForMap('gate-event');
  assert.equal(gate.locationScope,'place');
  assert.deepEqual(ids(gate.chapters),['chapter-gate']);
  assert.deepEqual(ids(gate.quests),['quest-gate']);
  assert.deepEqual(ids(gate.bosses),['boss-gate']);
  assert.deepEqual(ids(gate.characters),['npc-gate']);
  const inn=places.contextForMap('inn');
  assert.equal(inn.location.id,'location-ice-world');
  assert.equal(inn.locationScope,'region');
  assert.deepEqual(ids(inn.chapters),[]);
  assert.equal(places.locationForMap('unrelated'),null);
  assert.equal(places.locationForEncounter('terry',2).id,'location-gate');
  assert.equal(places.locationForEncounter('cobi',29).id,'location-ice-world');
  assert.equal(places.locationForEncounter('tara',29).id,'location-ice-world');
  assert.equal(places.locationForEncounter('terry',29),null);
  assert.equal(places.locationForEncounter('cobi',71),null);
  assert.equal(places.locationForMap('missing'),null);
  assert.deepEqual(ids(places.mapsForLocation('missing')),[]);
});

test('a specific location wins over its world, while conflicting specific joins stay unresolved', () => {
  const world={id:'location-ice-world',kind:'location'};
  const first={id:'location-first',kind:'location',map_ids:['map']};
  const second={id:'location-second',kind:'location',map_ids:['map']};
  const maps=[{id:'map',placeId:'map',scene:38}];
  const routes={
    'location-ice-world':{maps:['map']},
    'location-first':{encounters:{cobi:[1]}},
    'location-second':{encounters:{cobi:[1]}}
  };
  assert.equal(create({entries:[world,first],maps,routes}).locationForMap('map'),first);
  const ambiguous=create({entries:[world,first,second],maps,routes,scenes:{ice:[38]}});
  assert.equal(ambiguous.locationForMap('map'),null);
  assert.equal(ambiguous.locationForEncounter('cobi',1),null);
});

test('shipped world, gate and map references connect without assigning world encounters to rooms', () => {
  const data=vm.createContext({});
  for (const file of ['data/handbook-reference.js','data/world-guide.js','data/field-routes.js',
    'data/player-atlas.js','js/locations.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),data,{filename:file});
  }
  const places=create({entries:data.WORLD_GUIDE.entries,routes:data.FIELD_ROUTES.routes,
    scenes:data.FIELD_ROUTES.scenes,maps:data.PLAYER_ATLAS.maps});
  assert.equal(places.locationForMap('map-38-1').id,'location-ice-world');
  assert.equal(places.contextForMap('map-38-1').locationScope,'region');
  assert.deepEqual(ids(places.contextForMap('map-38-1').chapters),[]);
  assert.equal(places.locationForMap('map-12-0').id,'location-greatlog');
  assert.equal(places.locationForMap('map-17-1').id,'location-desert-world');
  assert.equal(places.locationForMap('map-72-0').id,'location-townsperson-s-gate');
  assert.equal(places.locationForEncounter('terry',60).id,'location-medal-gate');
  assert.equal(places.locationForEncounter('cobi',16).id,'location-water-world');
  assert.equal(places.locationForEncounter('tara',78),null);
  assert.deepEqual(ids(places.contextForMap('map-8-0').quests),[
    'quest-fire-at-the-bazaar','quest-summon-entertainment-at-the-bazaar'
  ]);
  assert.ok(ids(places.mapsForLocation('location-ice-world')).includes('map-36-2'));
  for (const location of data.WORLD_GUIDE.entries.filter(row=>row.kind==='location')) {
    const idsForLocation=ids(places.mapsForLocation(location.id));
    assert.equal(new Set(idsForLocation).size,idsForLocation.length,location.id);
  }
});

test('the siblings’ home joins its native map, opening chapter and four observed characters without becoming a gate', () => {
  const data=vm.createContext({});
  for (const file of ['data/handbook-reference.js','data/world-guide.js','data/field-routes.js',
    'data/player-atlas.js','data/gate-generation.js','js/locations.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),data,{filename:file});
  }
  const places=create({entries:data.WORLD_GUIDE.entries,routes:data.FIELD_ROUTES.routes,
    scenes:data.FIELD_ROUTES.scenes,maps:data.PLAYER_ATLAS.maps,generation:data.GATE_GENERATION});
  const home=data.WORLD_GUIDE.entries.find(row=>row.id==='location-terry-home');
  assert.equal(places.locationForMap('map-103-0').id,home.id);
  assert.deepEqual(ids(places.mapsForLocation(home.id)),['map-103-0']);
  assert.deepEqual(ids(places.contextForMap('map-103-0').chapters),['story-terry-opening']);
  assert.deepEqual(ids(places.charactersForLocation(home.id).here).sort(),
    ['npc-milly','npc-terry','npc-warubou','npc-watabou']);
  assert.equal(data.DQMLocations.isGate(home),false);
  assert.equal(data.DQMLocations.isGate(data.WORLD_GUIDE.entries.find(row=>row.id==='location-townsperson-s-gate')),true);
  assert.deepEqual(Array.from(data.FIELD_ROUTES.scenes['terry-home']),[103]);
  assert.equal(data.DQMLocations.leadFor(home),home.summary);
});

test('native entrance evidence covers 31 gates on their exact floors and map coordinates', () => {
  const data=vm.createContext({});
  for (const file of ['data/handbook-reference.js','data/world-guide.js','data/field-routes.js',
    'data/player-atlas.js','data/gate-entrances.js','js/locations.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),data,{filename:file});
  }
  const entrances=data.GATE_ENTRANCES;
  const maps=new Map(data.PLAYER_ATLAS.maps.map(row=>[row.id,row]));
  const articles=new Map(data.WORLD_GUIDE.entries.map(row=>[row.id,row]));
  assert.equal(Object.keys(entrances.entries).length,31);
  assert.equal(entrances.evidence.length,32);
  assert.deepEqual([...new Set(Array.from(entrances.evidence,row=>row.gateId))].sort((a,b)=>a-b),
    Array.from({length:31},(_,index)=>index+1));
  assert.deepEqual(['map-9-0','map-9-1','map-9-2'].map(id=>
    entrances.evidence.filter(row=>row.map===id).length),[13,3,6]);
  for (const evidence of entrances.evidence) {
    const pin=entrances.entries[evidence.location].find(row=>row.map===evidence.map);
    assert.equal(articles.get(evidence.location)?.kind,'location',evidence.location);
    assert.ok(maps.has(pin.map),pin.map);
    assert.equal(pin.map,evidence.map);
    assert.ok(pin.x>0 && pin.x<1 && pin.y>0 && pin.y<1);
    const [width,height]=evidence.gridSize;
    const xs=Array.from(evidence.cells,point=>point[0]);
    const ys=Array.from(evidence.cells,point=>point[1]);
    assert.ok(Math.abs(pin.x-(Math.min(...xs)+Math.max(...xs)+1)/(2*width))<1e-8);
    assert.ok(Math.abs(pin.y-(Math.min(...ys)+Math.max(...ys)+1)/(2*height))<1e-8);
    if (pin.map.startsWith('map-9-')) assert.equal(pin.floor,'B'+(Number(pin.map.at(-1))+1));
  }
  assert.equal(entrances.evidence.find(row=>row.gateId===6).source,'native-call');
  assert.equal(entrances.evidence.find(row=>row.gateId===29).source,'event-grid');
  const farm=entrances.entries['location-farm-gate'];
  assert.deepEqual(Array.from(farm,row=>row.map),['map-10-0','map-10-1']);
  assert.equal(farm[1].x,.9);
  assert.ok(Math.abs(farm[1].y-20/47)<1e-8);
  assert.equal(entrances.entries['location-hidden-gate'],undefined);
  const places=create({entries:data.WORLD_GUIDE.entries,routes:data.FIELD_ROUTES.routes,
    scenes:data.FIELD_ROUTES.scenes,maps:data.PLAYER_ATLAS.maps,entrances});
  assert.equal(places.defaultMapForLocation('location-mirror-gate').id,'map-9-1');
  assert.equal(places.defaultMapForLocation('location-sleep-gate').id,'map-9-2');
  assert.equal(places.defaultMapForLocation('location-medal-gate').id,'map-6-3');
  assert.equal(places.locationForMap('map-9-0'),null);
});

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const EDITIONS = ['gameboy', 'delocalized', 'vibecoded'];
// These names were identified in authored field-guide notes, independently of
// their appearances in the world articles. Generic role words stay scoped.
const FIELD_TERMS = new Set([
  'GreatTree','GreatLog','GreatTree Castle','Volcanic Island Cave','Castle of the Dead','Northern Mountain',
  'Westernia Castle','East Lighthouse','Northden Castle','Southern Forest','Port Ritz Town','Key Appraiser',
  'Northden Town','Starry Shrine','Funt Village','Main Street','Mirage Lake','Ghost Ship','Small Cave','Wind Tower',
  'Medal Man','Eastoria','Pei Town','Bazaar','Hitano','Wiston','Assia','Nofo','Warubou','Terry','Cobi','Tara'
]);
const distinct = values => [...new Set(values.filter(Boolean))];
const canon = text => text.replace(/’/g, "'");
const check = (ok, why) => { if (!ok) throw new Error('Guide name sync: ' + why); };

function label(value, location) {
  check(typeof value === 'string', 'missing name at ' + location);
  const text = value.replace(/<END>$/, '').trim();
  check(text.length > 0 && text.length <= 100 && !/[<>{}\x00-\x1f\x7f]/u.test(text), 'invalid name at ' + location);
  return text;
}

function sourceIndex(comparison, revision) {
  const rows = new Map();
  for (const row of comparison.rows) {
    const key = row.catalog + ':' + row.id;
    check(!rows.has(key), 'duplicate public row ' + key);
    rows.set(key, row);
  }
  function get(catalog, id) {
    const row = rows.get(catalog + ':' + id);
    check(row && row.raw?.id === id && row.source_revision === revision && row.raw.translations?.current,
      'missing or stale public row ' + catalog + ':' + id);
    return row;
  }
  const byTable = new Map();
  for (const row of rows.values()) {
    const key = row.table + ':' + row.id;
    check(!byTable.has(key), 'duplicate public table identity ' + key);
    byTable.set(key, row);
  }
  return { get, optional: (catalog, id) => rows.has(catalog + ':' + id) ? get(catalog, id) : null,
    byTable(key) {
      const row = byTable.get(key);
      check(row, 'missing atlas title ' + key);
      return get(row.catalog, row.id);
    } };
}

// Keep only names from the four identified English patch editions and Japanese PSX text.
function systemRecord(index, sourceId, slot, spelling, requiredLabel) {
  const row = index.get('text/system.json', sourceId);
  check(row.labels?.includes(requiredLabel) && row.indices?.includes(slot), 'wrong system slot for ' + sourceId);
  const translations = row.raw.translations;
  const title = label(translations.current.english, sourceId);
  const short = label(translations.current.english_short || translations.current.english, sourceId);
  const japanese = label(row.raw.japanese, sourceId);
  const editions = {};
  for (const edition of EDITIONS) {
    const translation = translations[edition];
    if (!translation) continue;
    const full = label(translation.english, sourceId);
    editions[edition] = {full, short: label(translation.english_short || translation.english, sourceId)};
  }
  const names = {japanese, current:title, short, editions};
  return {id:sourceId, title, names, aliases:distinct([spelling, title, short, japanese,
    ...Object.values(editions).flatMap(edition => [edition.full, edition.short])])};
}

function menuDescription(index, sourceId) {
  check(typeof sourceId === 'string' && /^m_exe_[0-9a-f]{6}$/u.test(sourceId), 'invalid native tooltip identity');
  const row = index.get('menus/general.json', sourceId);
  const lines = row.raw.translations.current.english_lines;
  check(row.table === 'menu_text.json' && row.labels?.includes('Menus') &&
    Array.isArray(lines) && lines.length > 0 && lines.length <= 32 && lines.every(line =>
      typeof line === 'string' && !/[<>{}\x00-\x1f\x7f]/u.test(line)), 'invalid menu tooltip at ' + sourceId);
  const description = lines.join(' ').replace(/\s+/gu,' ').trim();
  check(description.length && description.length <= 1024, 'empty or oversized tooltip at ' + sourceId);
  return description;
}

// These builder tables store the name assigned on recruitment, independently of dialogue.
function nicknameRecords(comparison, index, bindings, world) {
  const records = new Map();
  const catalogs = ['patches/starter_name.json', 'patches/boss_names.json', 'patches/gift_names.json'];
  for (const candidate of comparison.rows) {
    if (!catalogs.includes(candidate.catalog)) continue;
    const row = index.get(candidate.catalog, candidate.id);
    const kind = row.labels?.includes('Starter nickname') ? 'starter' :
      row.labels?.includes('Boss nicknames') ? 'boss' : row.labels?.includes('Gift monster names') ? 'gift' : null;
    const id = row.catalog + ':' + row.id;
    check(kind && row.table === row.catalog, 'unexpected nickname identity ' + id);
    const names = row.raw.translations;
    const title = label(names.current, id);
    const japanese = label(row.raw.japanese, id);
    const aliases = distinct([title, japanese, ...EDITIONS.filter(edition => names[edition] !== undefined)
      .map(edition => label(names[edition], id))]);
    records.set(id, {id, title, japanese, aliases, kind});
  }
  for (const [id, article] of Object.entries(bindings || {})) {
    check(records.has(id) && world.entries.some(entry => entry.id === article), 'missing nickname or article for ' + id);
    records.get(id).article_id = article;
  }
  return records;
}

function extractTerm(index, binding) {
  const row = index.get(binding.catalog, binding.source_id);
  if (binding.extract === 'full') {
    const current = row.raw.translations.current;
    return label(current.english || current.english_short, binding.source_id);
  }
  check(typeof row.current === 'string' && row.current.length <= 12000, 'invalid dialogue at ' + row.id);
  const lines = row.current.replace(/\r/g,'').split('\n');
  if (binding.extract === 'speaker') {
    const subjects = (binding.speaker_line !== undefined ? [lines[binding.speaker_line] || ''] : lines)
      .map(line => line.match(/^([^:{}<>*]{1,80}):(?:\s|$)/u)?.[1]).filter(Boolean);
    check(distinct(subjects).length === 1, 'ambiguous or missing speaker at ' + row.id);
    return label(subjects[0], row.id);
  }
  check(binding.extract === 'phrase' && (binding.prefix || binding.suffix), 'invalid name extraction at ' + row.id);
  const escape = value => String(value || '').replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const pattern = new RegExp((binding.prefix ? escape(binding.prefix) : '^') +
    '([^\\n<>{}]{1,100}?)' + (binding.suffix ? escape(binding.suffix) : '$'), 'gm');
  const matches = [...row.current.replace(/\r/g,'').matchAll(pattern)];
  check(matches.length === 1, 'ambiguous or missing name phrase at ' + row.id);
  return label(matches[0][1], row.id);
}

function atlasRecord(index, map) {
  check(typeof map.titleRow === 'string', 'map has no native title identity: ' + map.id);
  const row = index.byTable(map.titleRow);
  check(row.catalog.startsWith('dialogue/') && row.labels?.includes('Location names'), 'invalid map title identity: ' + map.id);
  const title = label(row.raw.translations.current.english, map.titleRow);
  const saved = index.optional('text/location_titles.json',row.id);
  const aliases = [map.title, title, label(row.raw.japanese, row.id)];
  for (const record of [row, saved].filter(Boolean)) {
    for (const edition of ['current', ...EDITIONS]) {
      const text = record.raw.translations[edition];
      if (text) aliases.push(label(text.english || text.english_short, row.id));
    }
  }
  return {title, aliases:distinct(aliases)};
}

function matcher(terms) {
  const candidates = new Map();
  for (const {spelling, title} of terms) {
    const key = canon(spelling);
    if (!candidates.has(key)) candidates.set(key,new Set());
    candidates.get(key).add(title);
  }
  // Include unchanged names as well, so renaming "Dragon" never rewrites "Dragon Belt".
  const alternatives = [...candidates.keys()].sort((a,b) => b.length - a.length).map(word =>
    word.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/'/g,"['’]"));
  if (!alternatives.length || ![...candidates].some(([k,v])=>v.size===1 && !v.has(k))) return value=>value;
  const pattern = new RegExp("(?<![\\p{L}\\p{N}_])(" + alternatives.join('|') + ")(s?)(?![\\p{L}\\p{N}_])",'gu');
  return value => value.replace(pattern,(original, noun, plural) => {
    const values = candidates.get(canon(noun));
    if (values.size !== 1) return original;
    const title = [...values][0];
    return canon(noun) === canon(title) ? original : title + plural;
  });
}

function buildGuideNames({comparison, revision, field, world, atlas, skillBindings, worldBindings, species, originalSpecies}) {
  const index = sourceIndex(comparison, revision);
  const nicknames = nicknameRecords(comparison, index, worldBindings.nickname_articles, world);
  const items = {}, skills = {}, maps = {}, entries = {};
  const allRows = [...field.entries, ...world.entries];
  const itemIds = new Set(field.entries.filter(row => row.kind === 'item' || row.kind === 'tool').map(row => row.id));
  const fieldIds = field.entries.map(row => row.id);
  const sourceAliases = new Map();
  const globalTerms = [];
  const scoped = new Map();
  const placeTerms = [];
  function add(spelling, title, rowIds) {
    const term = {spelling,title};
    if (!rowIds) {globalTerms.push(term);return;}
    for (const id of rowIds) {
      if (!scoped.has(id)) scoped.set(id,[]);
      scoped.get(id).push(term);
    }
  }
  for (const item of field.entries.filter(row=>row.kind === 'item' || row.kind === 'tool')) {
    const nativeId = Number(item.id.replace(/^item-/, ''));
    const name = systemRecord(index,item.source_ids[0],361+nativeId,item.title,'Items');
    name.description = menuDescription(index,item.source_ids[1]);
    const alternate = {31:'m_exe_08bf94',40:'m_exe_08bf78',41:'m_exe_08bf60'}[nativeId];
    if (alternate) {
      check(item.source_ids.includes(alternate), 'missing alternate item tooltip at ' + item.id);
      name.descriptions = {dqm1:name.description,dqm2:menuDescription(index,alternate)};
    }
    items[item.id]=name;
    add(item.title, name.title);
  }
  for (const bind of skillBindings) {
    const name=systemRecord(index,bind.source_id,473+bind.id,bind.spelling,'Skills and spells');
    const level = field.skill_requirements[bind.id]?.level;
    check(Number.isInteger(level) && level >= 1 && level <= 99, 'invalid learning level for skill ' + bind.id);
    name.minimum_level = level;
    name.description_source_id = bind.description_source_id;
    name.description = menuDescription(index,bind.description_source_id);
    skills[bind.id]=name;
    add(bind.spelling,name.title,bind.affected_entries || []);
  }
  for (const map of atlas.maps) {
    const record=atlasRecord(index,map);
    maps[map.id]=record;
    placeTerms.push({spelling:map.title,title:record.title});
  }
  for (const bind of worldBindings.terms) {
    const nickname = nicknames.get(bind.nickname);
    if (bind.nickname || bind.extract === 'nickname' || bind.paired_in) check(nickname, 'missing nickname for ' + bind.spelling);
    const title=bind.extract === 'nickname' ? nickname.title : extractTerm(index,bind);
    const scope=bind.affected_entries;
    check(Array.isArray(scope) && scope.length > 0, 'empty scope for ' + bind.spelling);
    const affects = FIELD_TERMS.has(bind.spelling) ? [...scope,...fieldIds] : scope;
    const paired = nickname && distinct([title,nickname.title]).join(' / ');
    const pairedEntries = bind.paired_in || [];
    check(pairedEntries.every(id => affects.includes(id)), 'unbound nickname mention for ' + bind.spelling);
    for (const spelling of [bind.spelling,...(bind.aliases || [])]) {
      add(spelling,title,affects.filter(id => !pairedEntries.includes(id)));
      add(spelling,paired,pairedEntries);
    }
    for (const id of scope) {
      const entry = world.entries.find(entry => entry.id === id);
      if (!entry || canon(entry.title) !== canon(bind.spelling)) continue;
      sourceAliases.set(id,distinct([...(sourceAliases.get(id) || []),bind.spelling,title,...(bind.aliases || []),...(nickname?.aliases || [])]));
    }
  }
  for (const row of world.entries) {
    if (row.kind !== 'location') continue;
    const sourceId=row.source_ids.find(id=>/^e[0-9a-f]{4}$/.test(id));
    if (!sourceId) continue;
    const source=index.get('text/system.json',sourceId);
    const title=label(source.raw.translations.current.english,sourceId);
    if (source.labels?.includes('Gate names')) add(row.title,title);
    else if (row.key && source.labels?.includes('Fixed keys')) {
      const suffix = index.get('text/static.json','x0b7904');
      const keyWord=label(suffix.raw.translations.current.english,suffix.id);
      add(row.key,title+' '+keyWord);
    }
  }
  for (const row of allRows) {
    const localTerms = scoped.get(row.id) || [];
    // Monster identities in story text are limited to the species explicitly attached
    // to this entry. A character's nickname and a species label are independent.
    const monsterTerms=(row.species_ids || []).flatMap(id=>{
      const old=originalSpecies[id], now=species[id];
      return old && now ? [{spelling:old.display_name,title:now.display_name}] : [];
    });
    const terms=[...globalTerms,...monsterTerms,...localTerms];
    const revise=matcher(terms);
    const place=matcher([...placeTerms,...terms]);
    const patch={};
    for (const key of ['title','summary','region','key']) {
      if (!row[key]) continue;
      const value=key==='region' || (row.kind==='location' && key==='title') ? place(row[key]) : revise(row[key]);
      if (value!==row[key]) patch[key]=value;
    }
    for (const [key, update] of [['details',revise],['places',place]]) {
      if (!row[key]) continue;
      const updated=row[key].map(update);
      if (updated.some((value,i)=>value!==row[key][i])) patch[key]=updated;
    }
    if (row.sections) {
      const sections = row.sections.map(section => ({
        ...section, title:revise(section.title), intro:revise(section.intro), rows:section.rows.map(pair=>pair.map(revise))
      }));
      if (JSON.stringify(sections) !== JSON.stringify(row.sections)) patch.sections = sections;
    }
    if (row.prices) {
      const locations=row.prices.map(price=>price.locations.map(place));
      if (locations.some((places,i)=>places.some((s,j)=>s!==row.prices[i].locations[j]))) {
        patch.priceLocations=locations;
        // Price sentences include exactly the same original list as the structured list.
        patch.details=(patch.details || [...row.details]).map((value,i)=>{
          for (let j=0;j<row.prices.length;j++) {
            const old=row.prices[j].locations.join(' · ')+'.';
            if (row.details[i].endsWith(old)) {
              const start=row.details[i].slice(0,-old.length);
              return revise(start)+locations[j].join(' · ')+'.';
            }
          }
          return value;
        });
      }
    }
    const aliases = sourceAliases.get(row.id) || [];
    if (patch.title || aliases.some(alias=>alias!==row.title)) patch.aliases=distinct([row.title,...(row.aliases || []),...aliases]);
    if (Object.keys(patch).length) entries[row.id]=patch;
  }
  check(Object.keys(items).length===itemIds.size, 'incomplete item identity coverage');
  for (const id of Object.keys(field.skill_requirements || {})) check(skills[id], 'missing native skill ' + id);
  return {schema_version:1,items,skills,maps,entries,default_nicknames:[...nicknames.values()],coverage:{items:Object.keys(items).length,skills:Object.keys(skills).length,
    maps:Object.keys(maps).length,world_name_bindings:worldBindings.terms.length}};
}

function guideInputs(root) {
  const data = vm.createContext({});
  for (const name of ['world-guide','field-guide','player-atlas']) {
    const file=path.join(root,'data',name+'.js');
    vm.runInContext(fs.readFileSync(file,'utf8'),data,{filename:name+'.js',timeout:3000});
  }
  const read = filename => JSON.parse(fs.readFileSync(path.join(root,'scripts',filename),'utf8'));
  return {field:data.FIELD_GUIDE, world:data.WORLD_GUIDE, atlas:data.PLAYER_ATLAS,
    skillBindings:read('skill-name-bindings.json'),worldBindings:read('world-name-bindings.json')};
}

module.exports={buildGuideNames,guideInputs};

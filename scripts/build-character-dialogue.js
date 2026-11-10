'use strict';

const bindings = require('./character-dialogue-bindings.json');

// Only reviewed public catalog IDs appear here. Actor talk scripts can contain
// replies, narration or an impostor using the same "King:" prefix.
function buildCharacterDialogue(comparison, revision) {
  const source = new Map();
  for (const row of comparison.rows.filter(r => r.catalog.startsWith('dialogue/'))) {
    if (source.has(row.id)) throw new Error('Duplicate dialogue identity ' + row.id);
    source.set(row.id, row);
  }
  const entries = {};
  for (const [id, character] of Object.entries(bindings.speakers)) {
    const seen = new Set();
    const scenes = [];
    for (const [place, ids] of Object.entries(character.scenes)) {
      const passages = [];
      for (const sourceId of ids) {
        const row = source.get(sourceId);
        if (!row || row.source_revision !== revision || typeof row.current !== 'string') {
          throw new Error('Missing current character dialogue ' + sourceId);
        }
        const omit = bindings.omitLines[sourceId] || [];
        const lines = row.current.split(/\r?\n/);
        if (omit.length && (lines.length !== 4 || omit.some(i => !lines[i]))) {
          throw new Error('Recheck the dialogue and narration in ' + sourceId);
        }
        const text = lines.filter((_, index) => !omit.includes(index)).map(line => {
          let spoken = line.trim();
          const colon = spoken.indexOf(':');
          if (colon > 0 && [...character.labels, '*'].includes(spoken.slice(0, colon))) {
            spoken = spoken.slice(colon + 1).trimStart();
          }
          return spoken;
        }).join(' ').replaceAll('{PLAYER}', '[your name]').replace(/\{VARIABLE:[\dA-F]{2}\}/g, '[…]').trim();
        if (!text) throw new Error('Empty character dialogue ' + sourceId);
        if (!seen.has(text)) passages.push(text);
        seen.add(text);
      }
      if (passages.length) scenes.push({place, passages});
    }
    entries[id] = scenes;
  }
  return {revision, entries};
}
module.exports = {buildCharacterDialogue};

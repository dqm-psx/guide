'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
require('../../data/world-guide');
require('../../data/character-dialogue');
require('../../js/character-dialogue');
const bindings = require('../../scripts/character-dialogue-bindings.json');
const characters = WORLD_GUIDE.entries.filter(row => row.kind === 'npc');
const text = id => CHARACTER_DIALOGUE.entries[id].flatMap(scene => scene.passages).join('\n');

test('each character has a distinct transcript with reviewed source rows', () => {
  const ids = characters.map(row => row.id).sort();
  assert.deepEqual(Object.keys(CHARACTER_DIALOGUE.entries).sort(), ids);
  assert.deepEqual(Object.keys(bindings.speakers).sort(), ids);
  for (const id of ids) {
    const scenes = CHARACTER_DIALOGUE.entries[id];
    const passages = scenes.flatMap(scene => scene.passages);
    assert.ok(passages.length, id);
    assert.equal(new Set(passages).size, passages.length, id);
    assert.doesNotMatch(text(id), /\{(?:PLAYER|VARIABLE)|<WAIT>|<END>/);
  }
  assert.match(text('npc-healie'), /I'm Healie!/);
  assert.doesNotMatch(text('npc-healie'), /Your Majesty/);
  assert.match(text('npc-surabou'), /Your new master's come for you/);
  assert.doesNotMatch(text('npc-surabou'), /joined the party!/);
  assert.match(text('npc-queen-of-greattree'), /A Winged Slime!/);
  assert.doesNotMatch(text('npc-queen-of-the-mermaids'), /Queen of the mermaids! Hand over/);
  assert.match(text('npc-mud-hand-s-room-rock-paper-scissors-opponent'), /Go see my brother!/);
  const falseKing = CHARACTER_DIALOGUE.entries['npc-king-of-northden'].find(s => s.place.includes('impostor'));
  assert.ok(falseKing.passages.some(line => line.includes('impersonate the king')));
});

test('the character view keeps short conversations behind a disclosure when hiding spoilers', () => {
  const row = characters.find(character => character.id === 'npc-healie');
  const render = hide => DQMCharacterDialogue.markup(row, String, ['<a href="#quest">Rescue</a>'], hide);
  assert.match(render(false), /<details class="character-dialogue" open>/);
  assert.doesNotMatch(render(true), /<details[^>]+ open/);
  assert.match(render(true), /<h3>Quests<\/h3>/);
});

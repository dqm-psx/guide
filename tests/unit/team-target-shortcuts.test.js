const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadScripts} = require('../helpers/load-scripts');

test('suggests unsaved shrine offspring from level 10+ parents in both orders, preferring new species', () => {
  const root = path.resolve(__dirname, '../..');
  const guide = loadScripts(['data/breeding-data.js','js/planner-core.js','js/team-target-shortcuts.js'].map(file => path.join(root,file)));
  const core = guide.DQMPlannerCore.create(guide.DATA);
  const parents = [
    {speciesIndex:1, sex:'male', level:10, plus:0},
    {speciesIndex:1, sex:'female', level:10, plus:4, location:'farm'},
    {speciesIndex:199, sex:'female', level:21, plus:0},
    {speciesIndex:13, sex:'male', level:9, plus:0},
    {speciesIndex:0, sex:'female', plus:99}
  ];
  const suggest = (entries, targets = []) => [...guide.DQMTeamTargetShortcuts.forTeam({entries, targets},core)];
  // Two Spotted Slimes reach the +4 requirement for Spotted King (17).
  // Spotted Slime + Ghost yields Bubble Slime (6); the reverse yields Ghost (199).
  assert.deepEqual(suggest(parents), [6,17,199]);
  assert.deepEqual(suggest(parents.slice().reverse(), [{speciesIndex:6}]), [17,199]);
  assert.deepEqual(suggest(parents.filter(parent => parent.sex === 'female')), []);
  const largerTeam = parents.concat(
    {speciesIndex:52, sex:'male', level:10, plus:0},
    {speciesIndex:112, sex:'female', level:10, plus:0}
  );
  assert.deepEqual(suggest(largerTeam), [2,6,17,26]);
});

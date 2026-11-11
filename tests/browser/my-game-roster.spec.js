const {test, expect} = require('@playwright/test');

let serverUrl, STATE_KEY;
test.beforeAll(async () => {
  ({STATE_KEY} = (await import('../helpers/keys.js')).default);
  const {startGuideServer} = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});
test.afterAll(async () => {
  const {stopGuideServer} = await import('../helpers/modes');
  await stopGuideServer();
});

function teamDocument(entries) {
  return {
    version:2, game:'dqm1-2-ps1-v61', activeGame:'dqm1', spriteStyle:'portrait',
    favoriteSpeciesIndices:[], activeTeamId:'t-roster',
    teams:[{id:'t-roster', name:'Terry’s team', game:'dqm1', entries, targets:[], activeTargetId:null}],
  };
}
async function seedRoster(page, entries) {
  await page.addInitScript(({key, document}) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(document));
  }, {key:STATE_KEY, document:teamDocument(entries)});
  await page.goto(serverUrl + '#team-planner');
}
const largeRoster = () => Array.from({length:50}, (_, i) => ({
  id:'m-' + i, speciesIndex:[0,11,13,99][i % 4], sex:i % 2 ? 'female' : 'male',
  plus:i % 13, nickname:(i < 3 ? 'Party ' : 'Barn ') + String(i).padStart(2,'0'),
  favorite:i === 49, location:i < 3 ? 'party' : 'farm', level:10 + i,
}));
const visibleIds = (page, place) => page.locator('#planner-' + place + ' .planner-card')
  .evaluateAll(cards => cards.map(card => card.dataset.entryId));

for (const viewport of [{width:1280,height:800}, {width:390,height:844}]) {
  test(`a saved 50-monster roster is immediately usable at ${viewport.width}px`, async ({page}) => {
    await page.setViewportSize(viewport);
    await seedRoster(page, largeRoster());
    await expect(page.locator('#planner-tab-roster')).toHaveAttribute('aria-selected','true');
    await expect(page.locator('#planner-party .planner-card')).toHaveCount(3);
    await expect(page.locator('#planner-farm .planner-card')).toHaveCount(47);
    await expect(page.locator('#planner-party .planner-card').first()).toBeInViewport({ratio:0.9});
    await expect(page.locator('#save-import-dialog')).toBeHidden();
    await expect(page.locator('#planner-entry-dialog')).toBeHidden();
    await expect(page.locator('#manage-teams')).not.toHaveAttribute('open','');
    await expect(page.locator('#planner-backup-export')).toBeHidden();
    await expect(page.locator('#planner-team-summary')).toContainText('3 party · 47 farm');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.locator('#planner-open-add').click();
    await expect(page.locator('#planner-entry-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#planner-open-add')).toBeFocused();
  });
}

test('roster search, filters, and numeric sorts work together without changing the saved order', async ({page}) => {
  const entries = [
    {id:'party-a',speciesIndex:0,sex:'male',plus:2,nickname:'Alba',favorite:false,location:'party',level:9},
    {id:'party-b',speciesIndex:99,sex:'female',plus:10,nickname:'Zenith',favorite:true,location:'party',level:100},
    {id:'party-c',speciesIndex:13,sex:'female',plus:1,nickname:'Melody',favorite:false,location:'party'},
    {id:'farm-a',speciesIndex:0,sex:'female',plus:12,nickname:'Fable',favorite:true,location:'farm',level:12},
    {id:'farm-b',speciesIndex:11,sex:'male',plus:3,nickname:'Marble',favorite:false,location:'farm',level:70},
    {id:'farm-c',speciesIndex:99,sex:'male',plus:9,nickname:'Bravo',favorite:true,location:'farm',level:2},
  ];
  await seedRoster(page, entries);
  const search = page.locator('#planner-roster-search');
  await search.fill('fAbLe');
  await expect(page.locator('.planner-card')).toHaveCount(1);
  await expect(page.locator('.planner-card')).toHaveAttribute('data-entry-id','farm-a');
  const species = await page.evaluate(() => ({name:displayName(byId.get(0)),japanese:byId.get(0).japanese}));
  for (const query of [species.name,species.japanese]) {
    await search.fill(query);
    await expect(page.locator('.planner-card')).toHaveCount(2);
  }
  await page.selectOption('#planner-roster-location','farm');
  await page.selectOption('#planner-roster-sex','female');
  await expect(page.locator('.planner-card')).toHaveAttribute('data-entry-id','farm-a');
  await search.fill('');
  await page.selectOption('#planner-roster-sex','male');
  await page.check('#planner-roster-favorites');
  await expect(page.locator('.planner-card')).toHaveAttribute('data-entry-id','farm-c');
  await search.fill('no such monster');
  await expect(page.locator('#planner-filter-empty')).toBeVisible();
  await expect(page.locator('#planner-roster-empty')).toBeHidden();
  await page.locator('#planner-clear-filters').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('#planner-roster-location')).toHaveValue('all');
  await expect(page.locator('#planner-roster-sex')).toHaveValue('all');
  await expect(page.locator('#planner-roster-favorites')).not.toBeChecked();
  await expect(page.locator('.planner-card')).toHaveCount(6);

  await page.selectOption('#planner-roster-sort','level');
  expect(await visibleIds(page,'party')).toEqual(['party-b','party-a','party-c']);
  expect(await visibleIds(page,'farm')).toEqual(['farm-b','farm-a','farm-c']);
  await page.selectOption('#planner-roster-sort','plus');
  expect(await visibleIds(page,'party')).toEqual(['party-b','party-a','party-c']);
  expect(await visibleIds(page,'farm')).toEqual(['farm-a','farm-c','farm-b']);
  await page.selectOption('#planner-roster-sort','name');
  expect(await visibleIds(page,'party')).toEqual(['party-a','party-c','party-b']);
  expect(await visibleIds(page,'farm')).toEqual(['farm-c','farm-a','farm-b']);
  await page.selectOption('#planner-roster-sort','order');
  expect(await visibleIds(page,'party')).toEqual(['party-a','party-b','party-c']);
  expect(await visibleIds(page,'farm')).toEqual(['farm-a','farm-b','farm-c']);
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),STATE_KEY);
  expect(stored.teams[0].entries.map(entry => entry.id)).toEqual(entries.map(entry => entry.id));
});

test('editing deep in the farm preserves position, filters, imported level, and saved data', async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await seedRoster(page,largeRoster());
  await page.locator('#planner-roster-search').fill('Barn');
  await page.selectOption('#planner-roster-location','farm');
  const card = page.locator('.planner-card[data-entry-id="m-49"]');
  const edit = card.locator('[data-member-edit]');
  await edit.scrollIntoViewIfNeeded();
  const cardBefore = await card.boundingBox();
  await edit.click();
  await expect(page.locator('#planner-entry-dialog')).toBeVisible();
  await expect(page.locator('#planner-add-nickname')).toHaveValue('Barn 49');
  await page.locator('#planner-add-plus').fill('37');
  await page.keyboard.press('Escape');
  await expect(edit).toBeFocused();
  await expect(card.locator('.planner-card-stats')).toContainText('+10');
  await edit.click();
  await page.locator('#planner-add-nickname').fill('Barn 49 keeper');
  await page.locator('#planner-add-plus').fill('37');
  await page.locator('#planner-add-button').click();
  await expect(page.locator('#planner-entry-dialog')).toBeHidden();
  await expect(edit).toBeFocused();
  await expect(card).toBeInViewport();
  // A status message can grow the page above the roster; the card itself
  // should remain in the same place on screen after the dialog closes.
  expect(Math.abs((await card.boundingBox()).y - cardBefore.y)).toBeLessThan(5);
  await expect(page.locator('#planner-roster-search')).toHaveValue('Barn');
  await expect(page.locator('#planner-roster-location')).toHaveValue('farm');
  await expect(card.locator('.planner-card-name')).toHaveText('Barn 49 keeper');
  await expect(card.locator('.planner-card-stats')).toContainText('Lv 59');
  await expect(card.locator('.planner-card-stats')).toContainText('+37');
  await expect(card.locator('[data-member-favorite]')).toHaveAttribute('aria-pressed','true');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)),STATE_KEY);
  expect(stored.teams[0].entries.find(entry => entry.id === 'm-49')).toMatchObject({
    nickname:'Barn 49 keeper',plus:37,level:59,sex:'female',location:'farm',favorite:true,
  });
  await page.reload();
  await expect(card.locator('.planner-card-name')).toHaveText('Barn 49 keeper');
  await expect(card.locator('.planner-card-stats')).toContainText('Lv 59');
  await expect(card.locator('.planner-card-stats')).toContainText('+37');
});

test('Breed shows the chosen monster’s offspring in both parent orders using saved plus values', async ({page}) => {
  await seedRoster(page,[
    {id:'male-spotted',speciesIndex:1,sex:'male',plus:4,nickname:'Spot',favorite:false,location:'party',level:30},
    {id:'female-spotted',speciesIndex:1,sex:'female',plus:5,nickname:'Dot',favorite:false,location:'farm',level:30},
    {id:'other-male',speciesIndex:11,sex:'male',plus:0,nickname:'Slimo',favorite:false,location:'party',level:20},
  ]);
  await page.locator('[data-member-breed="female-spotted"]').click();
  await expect(page.locator('#planner-tab-breeding')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#planner-breeding-member')).toHaveValue('female-spotted');
  await expect(page.locator('#planner-breeding-view')).toHaveValue('list');
  await expect(page.locator('#planner-breeding-include-farm')).toBeChecked();
  await expect(page.locator('#planner-team-results [data-planner-pair]')).toHaveCount(4);
  await expect(page.locator('#planner-male-grid')).toBeHidden();
  await expect(page.locator('#planner-team-results a[href="#monster?id=17"]')).toHaveCount(1);
  const ordered = page.locator('#planner-team-results [data-a="1"][data-b="1"]');
  expect(await ordered.evaluateAll(buttons => buttons.map(button => [button.dataset.ap,button.dataset.bp]).sort()))
    .toEqual([['4','5'],['5','4']]);
  await page.uncheck('#planner-breeding-include-farm');
  await expect(page.locator('#planner-breeding-summary')).toContainText('This monster is on the farm');
  await expect(page.locator('#planner-team-results')).toBeHidden();
  await page.check('#planner-breeding-include-farm');
  await page.selectOption('#planner-breeding-member','male-spotted');
  await expect(page.locator('#planner-team-results [data-planner-pair]')).toHaveCount(2);
  await page.locator('#planner-result-search').fill('not an offspring');
  await expect(page.locator('#planner-team-results')).toContainText('No offspring match');
  await page.locator('#planner-result-search').fill('');
  await expect(page.locator('#planner-team-results [data-planner-pair]')).toHaveCount(2);
  await page.goBack();
  await expect(page.locator('#planner-tab-roster')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.planner-card')).toHaveCount(3);
});

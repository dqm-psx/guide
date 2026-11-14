const path = require('node:path');
const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('route context joins acquisition sources without turning keys into prerequisites', () => {
  require(path.resolve(__dirname,'../../js/walkthrough-context.js'));
  const rows = [
    {id:'stage',kind:'story',game:'dqm2',related:['quest-local','npc-local']},
    {id:'quest-local',kind:'quest'}, {id:'npc-local',kind:'npc'},
    {id:'item-key',kind:'item'}, {id:'item-chest',kind:'item'},
    {id:'item-reward',kind:'item'}, {id:'item-other',kind:'item'},
    {id:'item-secret',kind:'item',spoiler:'ending'}
  ];
  const context = DQMWalkthroughContext.create({
    byId:new Map(rows.map(row=>[row.id,row])),
    routes:{stage:{maps:['ship-1'],supplies:['item-key']}},
    maps:[{id:'ship-1',placeId:'ship'},{id:'ship-2',placeId:'ship'},{id:'other',placeId:'other'}],
    itemReferences:{
      'item-chest':{sources:[{game:'dqm2',map:'ship-2',text:'Collect before the story event.'}]},
      'item-reward':{sources:[{game:'dqm2',entry:'quest-local',text:'Return after the quest.'}]},
      'item-other':{sources:[{game:'dqm1',map:'ship-1',text:'Wrong campaign.'},{game:'dqm2',map:'other',text:'Another place.'}]},
      'item-secret':{sources:[{game:'dqm2',map:'ship-1',text:'Hidden reward.'}]}
    },hidden:row=>row.spoiler==='ending'
  }).forStage(rows[0]);
  expect(context.items.map(row=>row.id)).toEqual(['item-key']);
  expect(context.finds.map(find=>find.item.id)).toEqual(['item-chest','item-reward']);
  expect(context.finds[0].sources[0].text).toBe('Collect before the story event.');
  expect(context.people.map(row=>row.id)).toEqual(['npc-local']);
});

test('a route keeps maps, people, conditional treasure and return context together', async ({page}) => {
  await page.goto(url+'#field-guide?kind=story&game=dqm2&entry=story-pirate-mermaids');
  const part = page.locator('.walk-part').filter({has:page.locator('#story-pirate-mermaids')});
  await expect(part.locator('.walk-objective')).toContainText('Polonia');
  await expect(part.locator('.article-steps')).toContainText('Moonstone');
  const maps = part.locator('.walk-context section').filter({has:page.getByRole('heading',{name:'Maps on this route',exact:true})});
  await expect(maps.getByRole('link',{name:'Ghost Ship',exact:true})).toBeVisible();
  await expect(part.locator('.walk-map-preview img')).toHaveAttribute('loading','lazy');
  await expect(part.locator('.walk-finds').first()).toContainText('collect before taking the Moonstone');
  const queen = part.locator('.walk-people').getByRole('link',{name:'Queen of the mermaids',exact:true});
  await expect(queen).toHaveAttribute('href',/chapter=story-pirate-mermaids/);
  await queen.click();
  await page.locator('.guide-back').click();
  await expect(page.locator('#story-pirate-mermaids')).toBeFocused();
});

test('map previews are deduplicated and chapters remain usable on a narrow screen', async ({page}) => {
  await page.setViewportSize({width:320,height:780});
  await page.goto(url+'#field-guide?kind=story&game=dqm1');
  const opening=page.locator('.walk-part').filter({has:page.locator('#story-terry-opening')});
  const milly=opening.locator('.walk-people li').filter({has:page.getByRole('link',{name:'Milly',exact:true})});
  await expect(milly.locator('img')).toHaveAttribute('src',await page.evaluate(()=>NPC_SPRITES['npc-milly'].variants.find(v=>v.id==='home').image));
  const maps = await page.locator('.walk-map-preview').evaluateAll(figures=>figures.map(figure=>figure.dataset.map));
  const places = await page.evaluate(ids=>ids.map(id=>PLAYER_ATLAS.maps.find(map=>map.id===id).placeId || id),maps);
  expect(new Set(places).size).toBe(places.length);
  expect(places.length).toBeGreaterThan(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole('navigation',{name:'Next walkthrough chapter'}).first().getByRole('link').click();
  await expect(page.locator('#story-terry-early-arena')).toBeFocused();
  await page.reload();
  await expect(page.locator('#story-terry-early-arena')).toBeInViewport();
});

test('hidden stages do not disclose map names, treasure or character references', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.goto(url+'#field-guide?kind=story&game=dqm2&entry=story-pirate-mermaids');
  const part = page.locator('.walk-part').filter({has:page.locator('#story-pirate-mermaids')});
  await expect(part.locator('.walk-context')).toHaveCount(0);
  await expect(part.locator('.article-steps')).toHaveCount(0);
  await part.getByRole('button',{name:'Reveal this stage'}).click();
  await expect(part.locator('.walk-context')).toBeVisible();
  await expect(part.locator('.walk-context').getByRole('link',{name:'Ghost Ship',exact:true})).toBeVisible();
  const nextPart = page.locator('.walk-part').filter({has:page.locator('#story-pirate-mirror')});
  await expect(nextPart.locator('.walk-context')).toHaveCount(0);
});

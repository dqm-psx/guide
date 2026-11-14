const {test,expect} = require('@playwright/test');
const {comboBlock} = require('../helpers/psx-save');
const {STATE_KEY} = require('../helpers/keys');
let url;
test.beforeAll(async()=>{ url=await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async()=>{ await (await import('../helpers/modes')).stopGuideServer(); });

async function importParty(page, options) {
  await page.goto(url+'#team-planner?import=save');
  await page.locator('#save-import-file').setInputFiles({name:'sample.sav',mimeType:'application/octet-stream',buffer:comboBlock(options)});
  await page.getByRole('button',{name:'Create team from save'}).click();
  await page.locator('#planner-party-combos-summary').click();
}

for (const [campaign,viewport] of [[0,1280],[1,390],[2,617]]) {
  test('matches two active, learned commands for campaign '+campaign,async({page})=>{
    await page.setViewportSize({width:viewport,height:860});
    await importParty(page,{variant:campaign});
    const panel=page.locator('#planner-party-combos');
    await expect(panel.locator('#planner-combo-count')).toHaveText('2 matches');
    await expect(panel.locator('[data-combo="208"]')).toContainText('500–700 base lightning damage');
    await expect(panel.locator('[data-combo="208"] li')).toHaveCount(2);
    await expect(panel.locator('[data-combo="208"] li a')).toHaveText(['Thordain','Thordain']);
    await expect(panel.locator('[data-combo="209"]')).toContainText('Can try');
    await expect(panel).not.toContainText('Giga Cross Break'); // In the candidate pool and storage.
    expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await panel.getByRole('link',{name:'All 20 battle combos'}).click();
    await expect(page.locator('#article-section-combo-recipes')).toBeFocused();
    await page.locator('#guide-article a[href*="combos=party"]').first().click();
    await expect(page.locator('#planner-party-combos-summary')).toBeFocused();
    await expect(panel.locator('[data-combo="208"]')).toBeVisible();
  });
}

test('ranks saved HP and MP separately for each pair and supports all-MP and zero-cost skills',async({page})=>{
  await importParty(page,{first:[15,61,21,50],second:[15,29,112,119],firstMp:0,secondMp:100});
  const panel=page.locator('#planner-party-combos');
  await expect(panel.locator('.party-combo-match').first()).toContainText('Mega Magic Drain');
  await expect(panel.locator('[data-combo="223"]')).toContainText('Can try');
  await expect(panel.locator('[data-combo="208"]')).toContainText('Needs 15 more MP');
  await expect(panel.locator('[data-combo="217"]')).toContainText('Needs 1 more MP');
  await expect(panel.locator('[data-combo="214"] li small')).toHaveText(['(all MP)','(all MP)']);
  await expect(panel.locator('[data-combo="214"]')).toContainText('Recover first');
  await importParty(page,{first:[15,3,18,58],second:[15,60],firstHp:0});
  await expect(panel.locator('.party-combo-match')).toHaveCount(2);
  await expect(panel.locator('[data-combo="220"]')).toContainText('Unavailable in local battles');
  await expect(panel.locator('[data-combo="208"]')).toContainText('Fainted in this save');
  await expect(panel.locator('[data-combo="208"]')).toContainText('Recover first');
});

test('shows the affordable assignment first when either monster knows both commands',async({page})=>{
  await importParty(page,{first:[3,18],second:[3,18],firstMp:10,secondMp:12});
  const combo=page.locator('[data-combo="209"]');
  await expect(combo).toContainText('Can try');
  await expect(combo.locator(':scope > ul')).toContainText('Bob');
  await expect(combo.locator(':scope > ul')).not.toContainText('Needs');
  await combo.getByText('Other command pairs (1)').click();
  await expect(combo.locator('details ul')).toContainText('Needs 2 more MP');
  const bob=page.locator('#planner-party article').filter({has:page.getByRole('link',{name:'Bob',exact:true})});
  await bob.locator('.planner-card-more > summary').click();
  await bob.getByRole('button',{name:'Move to Farm',exact:false}).click();
  await expect(page.locator('#planner-combo-results')).toContainText('Two active party monsters are needed');
  await expect(combo).toHaveCount(0);
});

test('handles unknown learned skills, old saves and rosters larger than the three battle slots',async({page})=>{
  const entries=[['First',[15]],['Second',[]],['Third',null],['Fourth',[15]],['Stored',[15]]].map(([nickname,knownSkills],i)=>({
    id:'m-'+i,location:i===4?'farm':'party',speciesIndex:11,sex:'male',nickname,plus:0,level:20,favorite:false,
    saveDetails:{schemaVersion:1,speciesIndex:11,level:20,plus:0,knownSkills,campaign:'terry'},
  }));
  const team={id:'t-combos',name:'Party',game:'dqm1',entries,targets:[],activeTargetId:null};
  await page.addInitScript(({key,team})=>localStorage.setItem(key,JSON.stringify({
    version:2,game:'dqm1-2-ps1-v61',activeGame:'dqm1',spriteStyle:'portrait',favoriteSpeciesIndices:[],
    activeTeamId:team.id,teams:[team,{...team,id:'t-other',name:'Other party',entries:[]}],
  })),{key:STATE_KEY,team});
  await page.goto(url+'#offspring-finder'); // Tools loaded before My game.
  await page.locator('.nav a[href="#team-planner"]').click();
  await page.locator('#planner-party-combos-summary').click();
  const panel=page.locator('#planner-party-combos');
  await expect(panel).toContainText('Learned skills are unavailable for Third');
  await expect(panel).not.toContainText('No two active');
  const slots=panel.locator('select');
  await expect(slots).toHaveCount(3);
  await expect(slots.first().locator('option')).toHaveCount(4);
  await slots.nth(2).selectOption('m-3');
  await expect(panel.locator('[data-combo="208"]')).toContainText('Check HP or MP');
  await expect(panel).not.toContainText('Third.');
  await page.locator('#planner-roster-search').fill('Stored');
  await expect(panel.locator('[data-combo="208"]')).toContainText('Fourth');
  await page.locator('#planner-team-select').selectOption('t-other');
  await expect(panel).toBeHidden();
  await page.locator('#planner-team-select').selectOption('t-combos');
  await expect(panel.locator('[data-combo="208"]')).toHaveCount(0);
  await expect(slots.nth(2)).toHaveValue('m-2');
});

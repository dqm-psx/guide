const {test,expect}=require('@playwright/test');
let url,fixture;
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();fixture=await import('../helpers/psx-save');});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});
async function importSave(page,bytes=fixture.planningBlock(2)){
  await page.goto(url+'#team-planner');
  await page.locator('#planner-open-import').click();
  await page.locator('#save-import-file').setInputFiles({name:'synthetic.sav',mimeType:'application/octet-stream',buffer:bytes});
  await page.locator('#save-import-apply').click();
  await expect(page.locator('#save-import-dialog')).not.toBeVisible();
}

test('one imported save supplies both tools, with correct stats, skills, campaign and resistance',async({page})=>{
  await importSave(page);
  const before=await page.evaluate(()=>JSON.stringify(DQMApp.state()));
  await page.locator('#planner-party').getByRole('link',{name:'Skills & growth'}).click();
  await expect(page.locator('#training-owned-select')).not.toHaveValue('');
  await expect(page.locator('#training-species')).toHaveValue('26');await expect(page.locator('#training-campaign')).toHaveValue('tara');
  await expect(page.locator('#training-attack')).toHaveValue('180');await expect(page.locator('#training-cap')).toHaveValue('55');
  await expect(page.locator('#training-known-list li')).toHaveCount(2);
  await expect(page.locator('#training-monster-inputs')).not.toHaveAttribute('open','');
  await expect(page.locator('#training-stats-inputs')).not.toHaveAttribute('open','');
  await page.locator('#training-target').fill('40');
  const skillUrl=page.url();await page.reload();await expect(page.locator('#training-target')).toHaveValue('40');
  await expect(page.locator('#training-attack')).toHaveValue('180');
  await page.goto(url+'#team-planner');
  await page.locator('#planner-party').getByRole('link',{name:'Damage',exact:true}).click();
  await expect(page.locator('#combat-species')).toHaveValue('26');await expect(page.locator('#combat-game')).toHaveValue('tara');
  await expect(page.locator('#combat-attack')).toHaveValue('230');await expect(page.locator('#combat-defense')).toHaveValue('155');
  await expect(page.locator('#combat-resistance option').first()).toHaveText('Individual resistance from save');
  await expect(page.locator('#combat-stat-source')).toContainText('Base Attack 180');
  expect(await page.evaluate(()=>JSON.stringify(DQMApp.state()))).toBe(before);
  await page.locator('#combat-attack').fill('240');
  await expect(page.locator('#combat-owned-select')).toHaveValue('');
  await expect(page.locator('#combat-resistance option').first()).toHaveText('Species default');
  expect(await page.evaluate(()=>JSON.stringify(DQMApp.state()))).toBe(before);
  await page.goto(skillUrl);await expect(page.locator('#training-attack')).toHaveValue('180');
  await page.locator('#training-stats-inputs>summary').click();await page.locator('#training-attack').fill('190');
  await expect(page.locator('#training-owned-select')).toHaveValue('');await expect(page.locator('#training-stats-inputs')).toHaveAttribute('open','');
  await expect(page.locator('#training-state-note')).toContainText('Custom plan');
});

test('a direct tool reload reads the same persisted roster and invalidates deleted selections',async({page})=>{
  await importSave(page);await page.locator('#planner-party').getByRole('link',{name:'Damage',exact:true}).click();
  await page.reload();await expect(page.locator('#combat-owned-select')).not.toHaveValue('');
  await expect(page.locator('#combat-attack')).toHaveValue('230');
  await page.evaluate(()=>{
    const key='dqm-guide-state-v61-v1',state=JSON.parse(localStorage.getItem(key));
    const team=state.teams.find(row=>row.id===state.activeTeamId);team.entries=[];
    const newValue=JSON.stringify(state);localStorage.setItem(key,newValue);
    window.dispatchEvent(new StorageEvent('storage',{key,newValue}));
  });
  await expect(page.locator('#combat-owned-select')).toHaveValue('');await expect(page.locator('#combat-attack')).toHaveValue('');
  await expect(page.locator('#combat-owned')).toContainText('changed or was removed');
});

test('shared calculation links omit local roster IDs and retain the selected individual resistance',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await importSave(page);await page.locator('#planner-party').getByRole('link',{name:'Damage',exact:true}).click();
  await expect(page.locator('#combat-attack')).toHaveValue('230');
  const found=await page.evaluate(()=>COMBAT_REFERENCE.encounters.find(row=>row.game==='tara'&&row.enemies.some(mon=>mon.actionIds.some(id=>COMBAT_REFERENCE.skills.some(skill=>skill.skillId===id)))));
  await page.locator('#combat-area').selectOption(String(found.contextId));
  // Choose an enemy with a supported move through the native table, not translated labels.
  const enemyId=await page.evaluate(area=>COMBAT_REFERENCE.encounters.find(row=>row.game==='tara'&&row.contextId===area).enemies.find(mon=>mon.actionIds.some(id=>COMBAT_REFERENCE.skills.some(skill=>skill.skillId===id))).index,found.contextId);
  await page.locator('#combat-enemy').selectOption(String(enemyId));
  await expect(page.locator('#combat-incoming-result')).toContainText('individual resistance');
  const result=await page.locator('#combat-incoming-result .combat-damage').innerText();
  await page.locator('#combat-copy').click();const shared=await page.evaluate(()=>navigator.clipboard.readText());
  expect(shared).not.toContain('owned=');expect(shared).not.toContain('team=');expect(shared).toContain('resistance=');expect(shared).not.toContain('Bob');
  await page.evaluate(()=>localStorage.clear());await page.goto(shared);await page.reload();
  await expect(page.locator('#combat-incoming-result .combat-damage')).toHaveText(result);
});

test('explicit species links override remembered ownership and tool-first startup preserves the save',async({page})=>{
  await importSave(page);const before=await page.evaluate(()=>localStorage.getItem('dqm-guide-state-v61-v1'));
  await page.locator('#planner-party').getByRole('link',{name:'Skills & growth'}).click();
  await expect(page.locator('#training-attack')).toHaveValue('180');
  await page.goto(url+'#combat-planner?species=11');
  await expect(page.locator('#combat-species')).toHaveValue('11');await expect(page.locator('#combat-owned-select')).toHaveValue('');
  await expect(page.locator('#combat-attack')).toHaveValue('');
  await page.goto(url+'#skill-planner?species=0');await page.reload();
  await expect(page.locator('#training-species')).toHaveValue('0');await expect(page.locator('#training-owned-select')).toHaveValue('');
  await page.goto(url+'#team-planner');await expect(page.locator('#planner-party')).toContainText('Bob');
  expect(await page.evaluate(()=>localStorage.getItem('dqm-guide-state-v61-v1'))).toBe(before);
  await page.locator('#planner-party').getByRole('link',{name:'Damage',exact:true}).click();
  await expect(page.locator('#combat-attack')).toHaveValue('230');
});

for(const delta of [4,1])test(`current candidates preserve removed/upgraded naturals across private-ID-free sharing (delta ${delta})`,async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await importSave(page,fixture.candidateBlock(delta));
  await page.locator('#planner-party').getByRole('link',{name:'Skills & growth'}).click();
  await expect(page.locator('#training-cap')).toHaveValue('55');
  await page.locator('#training-skill').selectOption('64');
  await expect(page.locator('.training-status').first()).toHaveAttribute('data-status','missing-route');
  await page.locator('#training-target').fill('31');expect(page.url()).toContain('pool=current');
  await page.locator('#training-copy').click();const shared=await page.evaluate(()=>navigator.clipboard.readText());
  expect(shared).toContain('pool=current');expect(shared).not.toContain('owned=');expect(shared).not.toContain('team=');
  await page.goto(shared);await page.reload();
  await expect(page.locator('#training-owned-select')).toHaveValue('');
  await expect(page.locator('.training-status').first()).toHaveAttribute('data-status','missing-route');
  await expect(page.locator('#training-target')).toHaveValue('31');
  if(delta===1){await page.locator('#training-skill').selectOption('65');await expect(page.locator('.training-status').first()).toHaveAttribute('data-status','ready');}
});

test('current candidate context survives numeric planning but resets for another species, adventure or parents',async({page})=>{
  await importSave(page,fixture.candidateBlock());await page.locator('#planner-party').getByRole('link',{name:'Skills & growth'}).click();
  await expect(page.locator('#training-cap')).toHaveValue('55');
  const imported=page.url();
  await page.locator('#training-stats-inputs>summary').click();await page.locator('#training-hp').fill('451');
  expect(page.url()).toContain('pool=current');await expect(page.locator('#training-owned-select')).toHaveValue('');
  await page.locator('#training-monster-inputs>summary').click();await page.selectOption('#training-species','11');
  expect(page.url()).not.toContain('pool=current');
  await page.goto(imported);await page.locator('#training-monster-inputs>summary').click();await page.locator('#training-campaign').selectOption('cobi');
  expect(page.url()).not.toContain('pool=current');await expect(page.locator('#training-inherited-list li')).toHaveCount(0);
  await page.goto(imported);await page.locator('.training-inheritance>summary').click();await page.locator('.training-parent-builder>summary').click();await page.selectOption('#training-parent-a','0');
  expect(page.url()).not.toContain('pool=current');await expect(page.locator('#training-owned-select')).toHaveValue('');
});

test('an unavailable imported pool cannot masquerade as a verified empty pool',async({page})=>{
  await importSave(page);await page.evaluate(()=>{
    const key='dqm-guide-state-v61-v1',state=JSON.parse(localStorage.getItem(key));
    state.teams.find(row=>row.id===state.activeTeamId).entries[0].saveDetails.inheritedSkills=null;
    localStorage.setItem(key,JSON.stringify(state));
  });
  await page.reload();await page.locator('#planner-party').getByRole('link',{name:'Skills & growth'}).click();
  await expect(page.locator('#training-errors')).toContainText('no verified learning-candidate pool');
  await expect(page.locator('#training-copy')).toBeDisabled();await expect(page.locator('#training-readiness')).toBeEmpty();
  await page.locator('#training-use-natural').click();await expect(page.locator('#training-errors')).toBeHidden();
  expect(page.url()).not.toContain('pool=current');await expect(page.locator('#training-owned-select')).toHaveValue('');
});

test('an unavailable learned-skill list is not treated as knowing no skills',async({page})=>{
  await importSave(page);await page.evaluate(()=>{
    const key='dqm-guide-state-v61-v1',state=JSON.parse(localStorage.getItem(key));
    state.teams.find(row=>row.id===state.activeTeamId).entries[0].saveDetails.knownSkills=null;
    localStorage.setItem(key,JSON.stringify(state));
  });
  await page.reload();await page.locator('#planner-party').getByRole('link',{name:'Skills & growth'}).click();
  await expect(page.locator('#training-errors')).toContainText('no verified learned-skill list');
  await expect(page.locator('#training-copy')).toBeDisabled();await expect(page.locator('#training-readiness')).toBeEmpty();
  await page.locator('#training-known-pick').selectOption('4');await page.locator('#training-known-add').click();
  await expect(page.locator('#training-errors')).toBeHidden();expect(page.url()).toContain('pool=current');
});

test('owned damage comparison preserves explicit encounter adventure on reload and while switching monsters',async({page})=>{
  await importSave(page);await page.locator('#planner-party').getByRole('link',{name:'Damage',exact:true}).click();
  await expect(page.locator('#combat-attack')).toHaveValue('230');
  await page.locator('#combat-game').selectOption('terry');
  await page.locator('#combat-area').selectOption({index:2});
  const original=await page.locator('#combat-area').inputValue();
  await page.reload();await expect(page.locator('#combat-game')).toHaveValue('terry');await expect(page.locator('#combat-area')).toHaveValue(original);
  await page.locator('#combat-area').selectOption({index:3});
  const changed=await page.locator('#combat-area').inputValue(),enemy=await page.locator('#combat-enemy').inputValue();
  await page.locator('#combat-owned-select').selectOption({index:2});
  await expect(page.locator('#combat-game')).toHaveValue('terry');await expect(page.locator('#combat-area')).toHaveValue(changed);await expect(page.locator('#combat-enemy')).toHaveValue(enemy);
  await page.goto(page.url().replace('game=terry','game=unsupported'));
  await expect(page.locator('#combat-link-note')).toBeVisible();await expect(page.locator('#combat-copy')).toBeDisabled();
});

const {test, expect} = require('@playwright/test');

let url, fixture;
test.beforeAll(async () => {
  url = await (await import('../helpers/modes')).startGuideServer();
  fixture = await import('../helpers/psx-save');
});
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

async function importTeam(page, bytes) {
  await page.goto(url+'#team-planner');
  await page.locator('#planner-open-import').click();
  await page.locator('#save-import-file').setInputFiles({name:'synthetic.sav',mimeType:'application/octet-stream',buffer:bytes});
  await page.locator('#save-import-apply').click();
  await expect(page.locator('#save-import-dialog')).toBeHidden();
  return page.evaluate(() => DQMApp.activeTeam().entries.map(entry => entry.id));
}

test('choosing two saved parents predicts the ordered child and all 27 resistance grades', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const [male,female,young] = await importTeam(page,fixture.planningBlock(2));
  await page.locator('[data-member-breed="'+male+'"]').click();
  const partner = page.locator('#planner-breeding-partner');
  await partner.selectOption(female);
  const panel = page.locator('#planner-selected-pair');
  await expect(panel).toContainText('Dragon Kid +14');
  await expect(panel).toContainText('17 of 27 resistances improve');
  await expect(panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Sleep',exact:true})}).getByRole('cell')).toHaveText(['2','4']);
  await panel.locator('summary').filter({hasText:'Unchanged resistances'}).click();
  await expect(panel.locator('tbody tr:visible')).toHaveCount(27);
  await expect(panel.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Sacrifice / Body Slam'})}).getByRole('cell')).toHaveText(['7 · Innate','7 · Innate']);
  await panel.locator('summary').filter({hasText:'mean for damage'}).click();
  await expect(panel.locator('.offspring-grade-key tbody tr').nth(6)).toContainText('15%10%');
  await expect(panel.locator('.offspring-grade-key tbody tr').nth(7).getByRole('cell')).toHaveText(['0%','0%']);
  await expect(panel.locator('.offspring-grade-key')).toContainText('Status effects use their own success rules');
  for (const width of [320,617,1280]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await panel.getByRole('button',{name:'Swap parents'}).click();
  await expect(panel).toContainText('Drake Slime +14');
  await expect(partner).toHaveValue(male);
  await partner.selectOption(young);
  await expect(panel).toContainText('Both parents must reach level 10');
  await expect(panel.locator('table')).toHaveCount(0);
  await partner.selectOption(male);
  await page.selectOption('#planner-context','room');
  await expect(panel).toContainText('one parent from each Adventure Log');
  await expect(panel.locator('table')).toHaveCount(0);
  await page.selectOption('#planner-context','base');
  await expect(panel).toContainText('base table omits');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('list and matrix Inspect use the selected individual when saved species and + match', async ({page}) => {
  const bytes = fixture.planningBlock(0);
  // Duplicate the male as a farm monster with a distinct Sleep resistance.
  const first = 0x250 + 136*2, other = 0x250 + 136*3;
  bytes.copy(bytes,other,first,first+136);
  fixture.putBits(bytes,other+0x0c,29,3,0);
  const [male,female,duplicate] = await importTeam(page,fixture.finishBlock(bytes));
  await page.locator('[data-member-breed="'+female+'"]').click();
  const individual = id => '[data-planner-pair][data-owned-a="'+id+'"][data-owned-b="'+female+'"]';
  const dialog = page.locator('#planner-pair-dialog');
  for (const [view,host] of [['list','#planner-team-results'],['matrix','#planner-male-grid']]) {
    await page.selectOption('#planner-breeding-view',view);
    for (const [id,grade] of [[male,'4'],[duplicate,'3']]) {
      await page.locator(host).locator(individual(id)).click();
      const sleep = dialog.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Sleep',exact:true})});
      await expect(sleep.getByRole('cell')).toHaveText(['2',grade]);
      await page.locator('#planner-close-pair').click();
    }
  }
});

const {test,expect}=require('@playwright/test');
let url;
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});

test('battle combinations link both ways with their component skills',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url+'#field-guide?kind=mechanic&topic=battle');
  await page.getByRole('link',{name:'Battle combinations: two monsters, one stronger move',exact:true}).click();
  await expect(page.locator('#guide-article')).toContainText('All 20');
  await expect(page.locator('#guide-article')).toContainText('Terry, Cobi and Tara');
  const recipes=page.getByRole('region',{name:'All 20 PlayStation combinations',exact:true});
  await expect(recipes.locator('tbody tr')).toHaveCount(20);
  await expect(page.locator('#guide-article a[href*="entry=skill-e0d35"]')).toHaveCount(1);
  await expect(recipes.getByRole('link',{name:'Chance',exact:true})).toBeVisible();
  await recipes.locator('a[href*="entry=skill-e0c4f"]').first().click();
  await expect(page.locator('#article-title')).toHaveText('Thordain');
  await expect(page.locator('.skill-progression')).toContainText('Battle combinations');
  await page.locator('.skill-progression a[href*="entry=field-battle-combos"]').click();
  await expect(page).toHaveURL(/section=combo-recipes/);
  await expect(page.locator('#article-section-combo-recipes')).toBeFocused();
  expect(errors).toEqual([]);
});

test('resistance explanation stays connected to breeding, damage and the version comparison',async({page})=>{
  await page.goto(url+'#field-guide?entry=field-breed&section=resistance-inheritance');
  await expect(page.locator('#article-section-resistance-inheritance')).toBeVisible();
  await expect(page.locator('#guide-article')).toContainText('No random inheritance roll');
  await expect(page.locator('#guide-article')).toContainText('never falls below its own species');
  await page.getByRole('link',{name:'Damage, Defense and resistance',exact:true}).first().click();
  await page.locator('#article-section-resistance').locator('..').getByRole('link',{name:'Breeding: parents, offspring and resistance',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Breeding: parents, offspring and resistance');
  await page.getByRole('link',{name:'Game Boy, PlayStation and English patch differences',exact:true}).click();
  await expect(page.locator('#article-section-resistance-breeding-changes').locator('..')).toContainText('Game Boy Color DWM2');
  await expect(page.locator('#article-section-battle-combo-changes').locator('..')).toContainText('All 20');
});

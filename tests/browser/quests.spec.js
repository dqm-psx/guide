const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const guide = pathToFileURL(path.resolve(__dirname, '..', '..', 'index.html')).href;

test('quests group objectives by campaign and keep individual arena class links', async ({ page }) => {
  await page.goto(guide+'#field-guide?kind=quest');
  const directory = page.locator('.quest-directory');
  await expect(directory.getByRole('heading', {level:3})).toHaveCount(2);
  await expect(directory.getByRole('heading', {name:'Postgame'})).toHaveCount(2);
  await expect(directory.getByRole('link', {name:'GreatTree Class F'})).toHaveCount(0);
  await directory.getByRole('link', {name:'Qualify for Starry Night'}).click();
  await page.getByRole('link', {name:'GreatTree Class F',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('GreatTree Class F');
  await page.locator('.guide-back').click();
  await page.getByRole('button',{name:'Search filters'}).click();
  await page.locator('#guide-game').selectOption('dqm2');
  await expect(directory.getByRole('heading', {level:3})).toHaveCount(1);
  await expect(directory.getByRole('link', {name:/Sailor Ring/})).toBeVisible();
  await expect(directory.getByRole('link', {name:/Medal Gate/})).toHaveCount(0);
});

test('queen’s requests link to all sixteen monsters and respect the story spoiler setting', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.goto(guide+'#field-guide?entry=quest-the-queen-s-monster-collection-requests');
  await expect(page.locator('.quest-species')).toHaveCount(0);
  await page.getByRole('button',{name:'Reveal this entry'}).click();
  const requests = page.locator('.quest-species a');
  await expect(requests).toHaveCount(16);
  await expect(requests.first()).toHaveAttribute('href','#monster?id=2');
  await expect(requests.last()).toHaveAttribute('href','#monster?id=55');
  await page.locator('.guide-back').click();
  await expect(page.locator('.quest-directory')).toBeVisible();
});

test('optional quests keep their campaign filter and link back to their walkthrough stage', async ({page}) => {
  await page.goto(guide+'#field-guide?kind=quest');
  const types = page.getByRole('navigation',{name:'Quest type'});
  await types.getByRole('link',{name:'Optional quests'}).click();
  await page.getByRole('button',{name:'Search filters'}).click();
  await page.locator('#guide-game').selectOption('dqm2');
  await expect(types.getByRole('link',{name:'Optional quests'})).toHaveAttribute('aria-current','page');
  const directory = page.locator('.quest-directory');
  await expect(directory.getByRole('link',{name:'Win the Pirate Key'})).toHaveCount(0);
  const search = page.locator('#guide-search');
  await search.fill('GreatLog Kids');
  await expect(types.getByRole('link',{name:'Optional quests'})).toHaveAttribute('aria-current','page');
  await expect(page.locator('.guide-count')).toHaveText('No matching entries');
  await types.getByRole('link',{name:'Main story'}).click();
  await expect(page.locator('.guide-row').filter({hasText:"GreatLog Kids' Class"})).toBeVisible();
  await types.getByRole('link',{name:'Optional quests'}).click();
  await search.fill('Sailor Ring');
  await expect(page.locator('.guide-row').filter({hasText:'Collect the Sailor Ring'})).toBeVisible();
  await search.fill('');
  await expect(types.getByRole('link',{name:'Optional quests'})).toHaveAttribute('aria-current','page');
  await directory.getByRole('link',{name:/Find the egg from the message in a bottle/}).click();
  await page.locator('.guide-back').click();
  await expect(types.getByRole('link',{name:'Optional quests'})).toHaveAttribute('aria-current','page');
  await directory.getByRole('link',{name:/Find the egg from the message in a bottle/}).click();
  await page.getByRole('navigation',{name:'Walkthrough chapters'}).getByRole('link',{name:'The Sky Shield and flight'}).click();
  await expect(page.locator('#story-ice-shield')).toBeFocused();
  await page.getByRole('link',{name:'Cobi & Tara quests',exact:true}).click();
  await expect(page.locator('#guide-game')).toHaveValue('dqm2');
  await expect(types.getByRole('link',{name:'All quests'})).toHaveAttribute('aria-current','page');
});

test('taking a quest from either walkthrough stage returns to that stage', async ({page}) => {
  for (const stage of ['story-terry-early-arena','story-terry-collection']) {
    await page.goto(guide+'#field-guide?kind=story&game=dqm1&entry='+stage);
    const section = page.locator('.walk-stage').filter({has:page.locator('#'+stage)});
    await section.getByRole('link',{name:'Catch the Sky Dragon egg'}).click();
    await page.locator('.guide-back').click();
    await expect(page.locator('#'+stage)).toBeFocused();
  }
});

test('Terry’s item search connects Miracle Sign to the queen and her final request', async ({page}) => {
  await page.goto(guide+'#field-guide?kind=item&game=dqm1&q=Miracle+Sign');
  const results = page.getByRole('table',{name:'Items',exact:true}).locator('tbody th a');
  await expect(results).toHaveCount(1);
  await results.first().click();
  const article = page.locator('#guide-article');
  await expect(article.getByRole('heading', {name:'Miracle Mark'})).toBeVisible();
  await expect(article).toContainText('Divine Dragon');
  await expect(article.locator('.item-sources')).not.toContainText('Silver');
  await article.getByRole('link', {name:'Show monsters to the queen'}).click();
  await expect(article.locator('.quest-species a').last()).toHaveText('Divine Dragon');
  await article.locator('.article-steps').getByRole('link', {name:'Miracle Mark'}).click();
  await expect(article.getByRole('heading', {name:'Miracle Mark'})).toBeVisible();
});

test('the Pirate Key quest and shrine explain when Cobi and Tara can breed', async ({ page }) => {
  await page.goto(guide+'#field-guide?entry=quest-win-the-pirate-key');
  const article = page.locator('#guide-article');
  await expect(article).toContainText('Winning Kids’ Class gives you permission');
  await article.getByRole('link', {name:'Monster Professor', exact:true}).click();
  await expect(article).toContainText('finish Water World with the Pirate Key and return to GreatLog');
  await article.getByRole('link', {name:'Water World', exact:true}).first().click();
  await expect(article.locator('#article-title')).toHaveText('Water World');
  await expect(article).toContainText('Clear Water World and return to GreatLog to breed');
});

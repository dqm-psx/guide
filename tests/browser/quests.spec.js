const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');

const guide = pathToFileURL(path.resolve(__dirname, '..', '..', 'index.html')).href;

test('quests group objectives by campaign and keep individual arena class links', async ({ page }) => {
  await page.goto(guide+'#guide?kind=quest');
  const directory = page.locator('.quest-directory');
  await expect(directory.getByRole('heading', {level:3})).toHaveCount(2);
  await expect(directory.getByRole('heading', {name:'Postgame'})).toHaveCount(2);
  await expect(directory.getByRole('link', {name:'GreatTree Class F'})).toHaveCount(0);
  await directory.getByRole('link', {name:'Qualify for Starry Night'}).click();
  await page.getByRole('link', {name:'GreatTree Class F',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('GreatTree Class F');
  await page.locator('.guide-back').click();
  await page.locator('#guide-game').selectOption('dqm2');
  await expect(directory.getByRole('heading', {level:3})).toHaveCount(1);
  await expect(directory.getByRole('link', {name:/Sailor Ring/})).toBeVisible();
  await expect(directory.getByRole('link', {name:/Medal Gate/})).toHaveCount(0);
});

test('queen’s requests link to all sixteen monsters and respect the story spoiler setting', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.goto(guide+'#guide?entry=quest-the-queen-s-monster-collection-requests');
  await expect(page.locator('.quest-species')).toHaveCount(0);
  await page.getByRole('button',{name:'Reveal this entry'}).click();
  const requests = page.locator('.quest-species a');
  await expect(requests).toHaveCount(16);
  await expect(requests.first()).toHaveAttribute('href','#monster?id=2');
  await expect(requests.last()).toHaveAttribute('href','#monster?id=55');
  await page.locator('.guide-back').click();
  await expect(page.locator('.quest-directory')).toBeVisible();
});

test('Terry’s item search connects Miracle Sign to the queen and her final request', async ({page}) => {
  await page.goto(guide+'#guide?kind=item&game=dqm1&q=Miracle+Sign');
  const results = page.locator('.guide-row');
  await expect(results).toHaveCount(1);
  await results.first().click();
  const article = page.locator('#guide-article');
  await expect(article.getByRole('heading', {name:'Miracle Mark'})).toBeVisible();
  await expect(article).toContainText('How Cobi or Tara can obtain one is unconfirmed');
  await article.getByRole('link', {name:'Show monsters to the queen'}).click();
  await expect(article.locator('.quest-species a').last()).toHaveText('Divine Dragon');
  await article.locator('.article-steps').getByRole('link', {name:'Miracle Mark'}).click();
  await expect(article.getByRole('heading', {name:'Miracle Mark'})).toBeVisible();
});

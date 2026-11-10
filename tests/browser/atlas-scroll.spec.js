const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });
test.use({viewport:{width:1915,height:600}});

async function scrollPosition(page) {
  return page.evaluate(() => ({list:document.querySelector('.atlas-scroll').scrollTop,page:window.scrollY}));
}

async function scrollDirectory(page) {
  await page.locator('.atlas-scroll').evaluate(node => { node.scrollTop=node.scrollHeight; });
  await page.evaluate(() => window.scrollTo({top:260,behavior:'instant'}));
  const position=await scrollPosition(page);
  expect(position.list).toBeGreaterThan(100);
  expect(position.page).toBeGreaterThan(40);
  return position;
}

for (const [mode,hash] of [['maps','#atlas'],['encounters','#atlas?tab=encounters']]) {
  test(`${mode} selection keeps the scrolled directory and page in place`, async ({page}) => {
    await page.goto(url+hash);
    const links=page.locator('.atlas-scroll a');
    await expect(links).toHaveCount(16);
    const mouseChoice=links.nth(14);
    const keyboardChoice=links.nth(15);
    const mouseTitle=await mouseChoice.locator('span').textContent();
    const keyboardTitle=await keyboardChoice.locator('span').textContent();
    const before=await scrollDirectory(page);

    await mouseChoice.click();
    await expect(page.locator('#atlas-location')).toHaveText(mouseTitle);
    await expect(mouseChoice).toHaveAttribute('aria-current','true');
    await expect(page.locator('.atlas-scroll [aria-current]')).toHaveCount(1);
    await expect(mouseChoice).toBeFocused();
    await expect.poll(() => scrollPosition(page)).toEqual(before);

    await page.keyboard.press('Tab');
    await expect(keyboardChoice).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#atlas-location')).toHaveText(keyboardTitle);
    await expect(keyboardChoice).toHaveAttribute('aria-current','true');
    await expect(mouseChoice).not.toHaveAttribute('aria-current');
    await expect(keyboardChoice).toBeFocused();
    await expect.poll(() => scrollPosition(page)).toEqual(before);

    await page.goBack();
    await expect(page.locator('#atlas-location')).toHaveText(mouseTitle);
    await expect(mouseChoice).toHaveAttribute('aria-current','true');
    await expect.poll(() => scrollPosition(page)).toEqual(before);
    await page.goForward();
    await expect(page.locator('#atlas-location')).toHaveText(keyboardTitle);
    await expect(keyboardChoice).toHaveAttribute('aria-current','true');
    await expect.poll(() => scrollPosition(page)).toEqual(before);
  });
}

test('changing atlas filters, page, or mode starts the new directory at the top', async ({page}) => {
  const changes=[
    async () => { await page.locator('#atlas-search').fill('GreatTree'); },
    async () => { await page.locator('#atlas-game').selectOption('terry'); },
    async () => { await page.locator('#atlas-region').selectOption('greattree'); },
    async () => { await page.getByRole('navigation',{name:'Location pages'}).getByRole('link',{name:'Next'}).click(); },
    async () => { await page.locator('[data-atlas-tab="encounters"]').click(); },
  ];
  for (const change of changes) {
    await page.goto(url+'#atlas');
    await expect(page.locator('.atlas-scroll a')).toHaveCount(16);
    await scrollDirectory(page);
    await change();
    await expect.poll(() => page.locator('.atlas-scroll').evaluate(node => node.scrollTop)).toBe(0);
  }
});

test('entering the atlas from another view still starts at its heading', async ({page}) => {
  await page.goto(url+'#monster?id=0');
  await expect(page.locator('#monster-heading')).toBeVisible();
  await page.evaluate(() => window.scrollTo({top:500,behavior:'instant'}));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await page.locator('#guide-contents').getByRole('link',{name:'Locations & maps',exact:true}).click();
  await page.locator('#guide-directory .places-nav').getByRole('link',{name:'All maps',exact:true}).click();
  await expect(page.locator('#atlas-heading')).toBeFocused();
  await expect(page.locator('#atlas-heading')).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(200);
  await expect.poll(() => page.locator('.atlas-scroll').evaluate(node => node.scrollTop)).toBe(0);
});

test('mobile navigation closes the menu and focuses locations from a selected map', async ({page}) => {
  await page.setViewportSize({width:375,height:700});
  await page.goto(url+'#atlas?map=map-8-0');
  await expect(page.locator('#atlas-location')).toHaveText('Bazaar');
  const menu=page.locator('#guide-contents');
  await page.getByRole('button',{name:'Browse guide'}).focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await menu.getByRole('link',{name:'Locations & maps',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#field-guide\?kind=location$/);
  await expect(menu).toBeHidden();
  await expect(page.locator('#directory-title')).toBeFocused();
  await expect(page.locator('#directory-title')).toBeInViewport();
});

test('skip to content still focuses the atlas after searching without a hashchange', async ({page}) => {
  await page.goto(url+'#atlas');
  await page.locator('#atlas-search').fill('GreatTree');
  await expect(page).toHaveURL(/#atlas\?q=GreatTree$/);
  const searchedUrl=page.url();
  await page.evaluate(() => window.scrollTo({top:260,behavior:'instant'}));
  await page.locator('a.skip').evaluate(node => node.focus({preventScroll:true}));
  await page.keyboard.press('Enter');
  await expect(page.locator('#atlas-heading')).toBeFocused();
  await expect(page.locator('#atlas-heading')).toBeInViewport();
  await expect(page).toHaveURL(searchedUrl);
  await expect(page.locator('#atlas-search')).toHaveValue('GreatTree');
});

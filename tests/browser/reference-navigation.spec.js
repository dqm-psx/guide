const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });
test.use({viewport:{width:617,height:892}});

const position = page => page.locator('.reference-table-scroll').evaluate(node=>({top:node.scrollTop,left:node.scrollLeft}));
async function scrollList(page,top=1800,left=150) {
  await page.locator('.reference-table-scroll').evaluate((node,offset)=>{
    node.scrollTop=offset.top; node.scrollLeft=offset.left;
  },{top,left});
  return position(page);
}
async function openVisibleEntry(page) {
  const href=await page.locator('.reference-table tbody th a').evaluateAll(links=>links.find(link=>{
    const bounds=link.getBoundingClientRect();
    return bounds.top>300 && bounds.bottom<650;
  }).getAttribute('href'));
  // The sticky name is already visible. Use the actual pointer position;
  // locator.click() scrollIntoView can move a sticky table cell beforehand.
  const bounds=await page.locator('.reference-table tbody th a[href="'+href+'"]').boundingBox();
  await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await expect(page.locator('#guide-article')).toBeVisible();
}

for (const [kind,label] of [['item','Items'],['skill','Skills']]) {
  test(`${label} keeps both scroll axes after browser Back and the article return link`, async ({page}) => {
    await page.goto(url+'#field-guide?kind='+kind);
    await expect(page.locator('.reference-table')).toBeVisible();
    const before=await scrollList(page);
    expect(before.top).toBeGreaterThan(1000);
    expect(before.left).toBeGreaterThan(100);
    await openVisibleEntry(page);
    await page.goBack();
    await expect(page.locator('.reference-table')).toBeVisible();
    await expect.poll(()=>position(page)).toEqual(before);
    await openVisibleEntry(page);
    await page.locator('#guide-article').getByRole('link',{name:'← '+label,exact:true}).click();
    await expect(page.locator('.reference-table')).toBeVisible();
    await expect.poll(()=>position(page)).toEqual(before);
  });
}

test('reference positions belong to their own list and filters, while sorting starts at the first result', async ({page}) => {
  await page.goto(url+'#field-guide?kind=item');
  await expect(page.locator('.item-index')).toBeVisible();
  const itemPosition=await scrollList(page,1900,175);
  await page.evaluate(()=>{location.hash='#field-guide?kind=skill';});
  await expect(page.locator('.skill-index')).toBeVisible();
  await expect.poll(()=>position(page)).toEqual({top:0,left:0});
  const skillPosition=await scrollList(page,1400,200);
  await page.goBack();
  await expect(page.locator('.item-index')).toBeVisible();
  await expect.poll(()=>position(page)).toEqual(itemPosition);
  await page.goForward();
  await expect(page.locator('.skill-index')).toBeVisible();
  await expect.poll(()=>position(page)).toEqual(skillPosition);
  await page.locator('.skill-index th[data-sort="effect"] button').click();
  await expect.poll(async()=>(await position(page)).top).toBe(0);
  const sortedPosition=await scrollList(page,1300,200);
  await openVisibleEntry(page);
  await page.goBack();
  await expect(page.locator('.reference-table')).toBeVisible();
  await expect.poll(()=>position(page)).toEqual(sortedPosition);
  await page.locator('#guide-search').fill('fire');
  await expect.poll(async()=>(await position(page)).top).toBe(0);
  await expect.poll(async()=>(await position(page)).left).toBe(0);
});

test('item source previews lead with shops and keep full reward sources on the item page', async ({page}) => {
  await page.goto(url+'#field-guide?kind=item');
  const book=page.locator('.item-index tr[data-entry="item-19"]');
  await expect(book.locator('.item-source').first()).toContainText('Shop GreatTree / Bazaar');
  await book.getByRole('link',{name:'Adventure Book',exact:true}).click();
  await expect(page.locator('.item-sources')).toContainText('request 13 of 16');
  await page.evaluate(()=>{location.hash='#field-guide?kind=item&game=dqm1';});
  const sources=page.locator('.item-index tr[data-entry="item-1"] .item-source');
  await expect(sources).toHaveCount(2);
  await expect(sources.nth(0)).toContainText('Shop GreatTree / Bazaar');
  await expect(sources.nth(1)).toContainText('Shop Travelers’ Gate item-shop floor');
});

test('walkthrough prose does not link a species name fragment to a different boss', async ({page}) => {
  await page.goto(url+'#field-guide?kind=story&game=dqm1&entry=story-terry-early-arena');
  const stage=page.locator('.walk-part').filter({has:page.locator('#story-terry-early-arena')});
  const egg=stage.locator('li').filter({hasText:/Sky Dragon egg/}).first();
  await expect(egg).toContainText('Sky Dragon egg');
  await expect(egg.getByRole('link',{name:'Dragon',exact:true})).toHaveCount(0);
  await expect(stage.getByRole('link',{name:'Dragon',exact:true}).first()).toBeVisible();
});

test('old field-ability article links open the consolidated movement section', async ({page}) => {
  await page.goto(url+'#field-guide?kind=mechanic&game=dqm2&entry=field-triangle');
  await expect(page).toHaveURL(/entry=field-movement-settings&section=field-abilities/);
  await expect(page.locator('#article-section-field-abilities')).toBeInViewport();
  await expect(page.locator('.article-topic').filter({has:page.locator('#article-section-field-abilities')})).toContainText('Triangle');
  await page.locator('.guide-back').click();
  await expect(page.locator('#guide-directory a[href*="entry=field-triangle"]')).toHaveCount(0);
});

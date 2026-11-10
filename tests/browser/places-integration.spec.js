const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('location maps keep the article, scroll and focus while choosing rooms and layouts', async ({page}) => {
  await page.goto(url+'#field-guide?kind=location&entry=location-water-world');
  const viewer=page.locator('#location-map-browser');
  const picker=viewer.locator('[data-map-control="place"]');
  const layout=viewer.locator('[data-map-control="layout"]');
  await expect(picker).toHaveValue('map-18-1');
  await expect(viewer.locator('[data-map-control="title"]')).toHaveText('Water World');
  await page.locator('.article-lead').getByRole('link',{name:'Ghost Ship',exact:true}).click();
  await expect(picker).toHaveValue('map-29-1');
  await expect(viewer).toBeFocused();
  await expect(page.locator('#atlas')).toBeHidden();
  await picker.selectOption('map-18-1');
  await picker.focus();
  await viewer.evaluate(node => window.scrollTo({top:window.scrollY+node.getBoundingClientRect().top-90,behavior:'instant'}));
  const before=await page.evaluate(()=>window.scrollY);
  await picker.selectOption('map-29-1');
  await expect(page.locator('#article-title')).toHaveText('Water World');
  await expect(viewer.locator('[data-map-control="title"]')).toHaveText('Ghost Ship');
  await expect(page.locator('#atlas')).toBeHidden();
  await expect(page).toHaveURL(/entry=location-water-world.*map=map-29-1/);
  await expect(picker).toBeFocused();
  expect(await page.evaluate(()=>window.scrollY)).toBe(before);

  await layout.focus();
  await layout.selectOption('map-29-2');
  await expect(layout).toBeFocused();
  await expect(page).toHaveURL(/map=map-29-2/);
  const next=viewer.locator('.map-doors a[data-map-id="map-29-3"]').first();
  await next.scrollIntoViewIfNeeded();
  const doorPosition=await page.evaluate(()=>window.scrollY);
  await next.click();
  await expect(page).toHaveURL(/entry=location-water-world.*map=map-29-3/);
  await expect(layout).toHaveValue('map-29-3');
  await expect(viewer.locator('[data-map-control="title"]')).toBeFocused();
  expect(await page.evaluate(()=>window.scrollY)).toBe(doorPosition);
  await page.reload();
  await expect(page.locator('#article-title')).toHaveText('Water World');
  await expect(layout).toHaveValue('map-29-3');
});

test('entrance-specific map images stay inside their world and survive a shared URL', async ({page}) => {
  await page.goto(url+'#field-guide?kind=location&entry=location-sky-world&map=map-48-1');
  const viewer=page.locator('#location-map-browser');
  await expect(viewer.locator('[data-map-control="title"]')).toHaveText('Small Cave');
  await viewer.locator('.map-doors a[data-map-variant="tiles-2253"]').click();
  await expect(page).toHaveURL(/entry=location-sky-world.*map=map-48-0.*variant=tiles-2253/);
  await expect(viewer.locator('[data-map-control="layout"]')).toHaveValue('map-48-0:tiles-2253');
  const image=await viewer.locator('.map-image img').getAttribute('src');
  await page.reload();
  await expect(page.locator('#article-title')).toHaveText('Sky World');
  await expect(viewer.locator('.map-image img')).toHaveAttribute('src',image);
});

test('atlas context connects a place to its world, quests, boss and regional encounters', async ({page}) => {
  await page.goto(url+'#atlas?map=map-29-1');
  const context=page.locator('#atlas-detail .map-guide-context');
  await expect(context.getByRole('link',{name:'Water World',exact:true})).toBeVisible();
  await expect(context.locator('a[href*="entry=story-pirate-mermaids"]')).toBeVisible();
  await expect(context.locator('a[href*="entry=quest-recover-the-moonstone"]')).toBeVisible();
  await expect(context.locator('a[href*="entry=boss-ghost-ship-pirates"]')).toBeVisible();
  await context.getByRole('link',{name:'Water World encounters',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Water World');
  await expect(page.locator('#location-encounters')).toBeFocused();
  await expect(page.locator('#location-encounters')).toBeInViewport();
  await page.locator('#location-encounters details summary').first().click();
  await page.locator('#location-encounters a[href*="tab=encounters"]').first().click();
  const owner=page.locator('#atlas-detail').getByRole('link',{name:'Water World guide and maps'});
  await expect(owner).toBeVisible();
  await owner.click();
  await expect(page.locator('#article-title')).toHaveText('Water World');
  await expect(page.locator('#location-map-browser')).toBeVisible();
});

test('one places navigation includes map-only rooms in the shared guide search', async ({page}) => {
  await page.goto(url+'#field-guide?kind=location');
  const sidebar=page.locator('#guide-contents');
  await expect(sidebar.getByRole('link',{name:'Locations & maps',exact:true})).toHaveAttribute('aria-current','page');
  const navigation=page.getByRole('navigation',{name:'Locations and maps',exact:true});
  await expect(navigation.getByRole('link')).toHaveText(['Overview','Terry’s gates','Cobi & Tara’s worlds','All maps','Wild encounters']);
  await navigation.getByRole('link',{name:'All maps',exact:true}).click();
  await expect(page.locator('#atlas')).toBeVisible();
  await page.getByLabel('Search the guide').fill('Wiston Inn');
  const result=page.locator('.guide-row[href="#atlas?map=map-38-1"]');
  await expect(result).toContainText('Wiston Inn');
  await result.click();
  await expect(page.locator('#atlas-location')).toHaveText('Wiston Inn');
  await page.locator('#atlas-detail .map-guide-context').getByRole('link',{name:'Ice World',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Ice World');
  await expect(page.locator('#location-map-browser [data-map-control="place"]')).toHaveValue('map-19-1');
});

test('gate pages distinguish the entrance from the final area and generated floors', async ({page}) => {
  await page.goto(url+'#field-guide?kind=location&entry=location-townsperson-s-gate');
  const maps=page.locator('.location-maps');
  await expect(maps.getByRole('heading',{name:'Maps',exact:true})).toBeVisible();
  await expect(maps).toContainText('The gate’s regular floors are generated.');
  const picker=maps.locator('[data-map-control="place"]');
  await expect(picker).toHaveValue('map-9-0');
  await expect(picker.locator('option')).toHaveText(["Entrance · Travelers' Gate Chamber",'Final area · Swamp Cave']);
  await expect(maps.locator('.map-gate-selected')).toHaveAttribute('data-gate-id','location-townsperson-s-gate');
  await picker.selectOption('map-72-0');
  await expect(maps.locator('[data-map-control="title"]')).toHaveText('Swamp Cave');
  await expect(maps.locator('.map-gate-pin')).toHaveCount(0);
  await expect(page.locator('#location-encounters .route-roster')).toBeVisible();
  await expect(maps.locator('.route-roster')).toHaveCount(0);
  await page.goto(url+'#field-guide?kind=location&entry=location-medal-gate');
  const medal=page.locator('#location-map-browser .map-gate-selected');
  await expect(medal).toHaveAttribute('data-gate-id','location-medal-gate');
  await expect(medal).toHaveText('Medal Gate');
  await expect(page.locator('#location-map-browser .map-image img')).toHaveAttribute('alt',/Medal Man's Room/);
  await expect(page.locator('#location-encounters .route-roster')).toBeVisible();
});

test('chamber gate markers follow the native floors and stay aligned when zooming', async ({page}) => {
  await page.goto(url+'#atlas?map=map-9-0');
  const detail=page.locator('#atlas-detail');
  const floor=detail.getByRole('combobox',{name:'Floor',exact:true});
  await expect(floor.locator('option')).toHaveText(['B1','B2','B3']);
  await expect(detail.locator('.map-gate-pin')).toHaveCount(13);
  await expect(detail.locator('.gate-portal-links li')).toHaveCount(13);
  const departure=detail.locator('.map-gate-pin[data-gate-id="location-departure-gate"]');
  await expect(departure).toHaveAccessibleName(/Departure Gate/);
  await expect.poll(()=>detail.locator('.map-image img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  async function departurePoint() {
    return departure.evaluate(node=>{
      const pin=node.getBoundingClientRect();
      const map=node.closest('.map-image').querySelector('img').getBoundingClientRect();
      return {x:(pin.x+pin.width/2-map.x)/map.width,y:(pin.y+pin.height/2-map.y)/map.height};
    });
  }
  const fit=await departurePoint();
  expect(fit.x).toBeCloseTo(22/44,3);
  expect(fit.y).toBeCloseTo(13/49,3);
  await detail.locator('[data-map-control="zoom"]').click();
  const zoom=await departurePoint();
  expect(zoom.x).toBeCloseTo(fit.x,3);
  expect(zoom.y).toBeCloseTo(fit.y,3);
  await detail.getByRole('checkbox',{name:'Gate portals',exact:true}).uncheck();
  await expect(detail.locator('.map-gate-pins')).toBeHidden();
  await expect(detail.getByRole('checkbox',{name:'Exit pins',exact:true})).toBeChecked();
  await expect(detail.locator('.map-pins .map-pin').first()).toBeVisible();
  await floor.selectOption('map-9-1');
  await expect(detail.locator('.map-gate-pin')).toHaveCount(3);
  await expect(departure).toHaveCount(0);
  await expect(detail.locator('.map-gate-pin[data-gate-id="location-mirror-gate"]')).toBeVisible();
  await floor.selectOption('map-9-2');
  await expect(detail.locator('.map-gate-pin')).toHaveCount(6);
  await expect(detail.locator('.map-gate-pin[data-gate-id="location-mirror-gate"]')).toHaveCount(0);
  await expect(detail.locator('.map-gate-pin[data-gate-id="location-extinction-gate"]')).toBeVisible();
});

test('gate portal links open the correct entrance floor and keep it when returning from the final area', async ({page}) => {
  await page.goto(url+'#atlas?map=map-9-1');
  await page.locator('#atlas-detail .map-gate-pin[data-gate-id="location-mirror-gate"]').click();
  await expect(page.locator('#article-title')).toHaveText('Mirror Gate');
  const viewer=page.locator('#location-map-browser');
  const picker=viewer.locator('[data-map-control="place"]');
  await expect(picker).toHaveValue('map-9-1');
  await expect(viewer.getByRole('combobox',{name:'Floor',exact:true})).toHaveValue('map-9-1');
  await expect(viewer.locator('.map-gate-selected')).toHaveCount(1);
  await expect(viewer.locator('.map-gate-selected')).toHaveText('Mirror Gate');
  await picker.selectOption('map-91-0');
  await expect(viewer.locator('.map-gate-pin')).toHaveCount(0);
  await picker.selectOption('map-9-1');
  await expect(viewer.getByRole('combobox',{name:'Floor',exact:true})).toHaveValue('map-9-1');
  await expect(viewer.locator('.map-gate-selected')).toHaveText('Mirror Gate');
  await page.goto(url+'#field-guide?entry=location-extinction-gate');
  await expect(viewer.getByRole('combobox',{name:'Floor',exact:true})).toHaveValue('map-9-2');
  await expect(viewer.locator('.map-gate-selected')).toHaveText('Extinction Gate');
});

test('hidden story details do not leak through maps or contextual atlas links', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.goto(url+'#field-guide?kind=location&entry=location-water-world');
  await expect(page.locator('#guide-reveal')).toBeVisible();
  await expect(page.locator('#location-map-browser')).toHaveCount(0);
  await page.goto(url+'#atlas?map=map-29-1');
  await expect(page.locator('#atlas-location')).toHaveText('Ghost Ship');
  await expect(page.locator('#atlas-detail .map-guide-context')).toHaveCount(0);
  await page.goto(url+'#atlas?map=map-9-1');
  await expect(page.locator('#atlas-detail .map-gate-pin')).toHaveCount(3);
  await expect(page.locator('#atlas-detail .gate-portal-links')).not.toContainText('Mirror Gate');
  await expect(page.locator('.map-gate-pin[data-gate-id="location-mirror-gate"]')).toHaveAccessibleName(/spoiler hidden/);
  await page.goto(url+'#field-guide?kind=location&entry=location-water-world');
  await page.locator('#guide-reveal').click();
  await expect(page.locator('#location-map-browser')).toBeVisible();
});

for (const width of [320,375]) {
  test(`integrated maps and navigation fit a ${width}px viewport`, async ({page}) => {
    await page.setViewportSize({width,height:800});
    await page.goto(url+'#field-guide?kind=location&entry=location-water-world');
    const viewer=page.locator('#location-map-browser');
    await viewer.locator('[data-map-control="place"]').selectOption('map-29-1');
    await viewer.locator('[data-map-control="zoom"]').click();
    await expect(viewer.locator('[data-map-control="zoom"]')).toHaveAttribute('aria-pressed','true');
    await viewer.locator('[data-map-control="pins"]').uncheck();
    await expect(viewer.locator('.map-pins')).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.goto(url+'#atlas?map=map-29-1');
    await expect(page.locator('#atlas-detail .map-guide-context')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

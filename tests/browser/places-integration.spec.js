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

test('gate pages show entrance and final-area maps together without a map chooser', async ({page}) => {
  await page.goto(url+'#field-guide?kind=location&entry=location-townsperson-s-gate');
  const maps=page.locator('.location-maps');
  const entrance=maps.getByRole('region',{name:"Entrance · Travelers' Gate Chamber",exact:true});
  const final=maps.getByRole('region',{name:'Final area · Swamp Cave',exact:true});
  await expect(maps.locator('[data-map-control="place"]')).toHaveCount(0);
  await expect(maps.getByRole('heading',{name:'Maps',exact:true})).toHaveCount(0);
  await expect(page.locator('#guide-article .article-lead')).toHaveCount(0);
  const facts=page.locator('.gate-facts');
  await expect(facts).toContainText('Arena requirement');
  await expect(facts.getByRole('link',{name:'Win Class G or higher',exact:true})).toHaveAttribute('href',/entry=quest-arena-dqm1-g/);
  const boss=facts.getByRole('link',{name:'Dragon',exact:true});
  await expect(boss).toHaveAttribute('href',/entry=boss-dragon/);
  await expect(boss.locator('[data-monster-index]')).toBeVisible();
  expect((await facts.boundingBox()).y).toBeLessThan((await maps.boundingBox()).y);
  await expect(entrance).toHaveAttribute('id','gate-map-selected');
  await expect(entrance.locator('.map-image img')).toBeVisible();
  await expect(final.locator('.map-image img')).toBeVisible();
  await expect(entrance.locator('.map-gate-selected')).toHaveAttribute('data-gate-id','location-townsperson-s-gate');
  await expect(final.locator('[data-map-control="title"]')).toHaveText('Swamp Cave');
  await expect(final.locator('.map-gate-pin')).toHaveCount(0);
  const entranceBox=await entrance.boundingBox(), finalBox=await final.boundingBox();
  expect(finalBox.x).toBeGreaterThan(entranceBox.x);
  expect(finalBox.y).toBeCloseTo(entranceBox.y,0);
  // Narrow maps should not be stretched into half-page cards with large gutters.
  for (const panel of [entrance,final]) {
    const card=await panel.boundingBox(), image=await panel.locator('.map-image img').boundingBox();
    expect(card.width-image.width).toBeLessThan(50);
  }
  const marker=await entrance.locator('.map-gate-selected').boundingBox();
  expect(marker.width).toBeGreaterThanOrEqual(24);
  expect(marker.height).toBeGreaterThanOrEqual(24);
  const ids=await maps.locator('[id]').evaluateAll(nodes=>nodes.map(node=>node.id));
  expect(new Set(ids).size).toBe(ids.length);
  await expect(page.locator('#location-encounters .route-roster')).toBeVisible();
  await expect(maps.locator('.route-roster')).toHaveCount(0);
  await page.goto(url+'#field-guide?kind=location&entry=location-medal-gate');
  const medal=page.locator('#location-map-browser .map-gate-selected');
  await expect(medal).toHaveAttribute('data-gate-id','location-medal-gate');
  await expect(medal).toHaveText('Medal Gate');
  await expect(page.locator('#location-map-browser [data-map-role="entrance"] .map-image img')).toHaveAttribute('alt',/Medal Man's Room/);
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

test('gate portal links open the correct entrance floor alongside the final area', async ({page}) => {
  await page.goto(url+'#atlas?map=map-9-1');
  await page.locator('#atlas-detail .map-gate-pin[data-gate-id="location-mirror-gate"]').click();
  await expect(page.locator('#article-title')).toHaveText('Mirror Gate');
  const viewer=page.locator('#location-map-browser');
  await expect(viewer.locator('[data-map-control="place"]')).toHaveCount(0);
  await expect(viewer.getByRole('combobox',{name:'Floor',exact:true})).toHaveValue('map-9-1');
  await expect(viewer.locator('.map-gate-selected')).toHaveCount(1);
  await expect(viewer.locator('.map-gate-selected')).toHaveText('Mirror Gate');
  await expect(viewer.locator('[data-map-role="final"] .map-image img')).toBeVisible();
  await page.goto(url+'#field-guide?entry=location-mirror-gate&map=map-91-0');
  await expect(viewer.locator('[data-map-role="final"] .map-image img')).toBeVisible();
  await expect(viewer.locator('#gate-map-selected')).toHaveAttribute('data-map-place','map-91-0');
  await expect(viewer.locator('.map-gate-selected')).toHaveText('Mirror Gate');
  await expect(viewer.getByRole('combobox',{name:'Floor',exact:true})).toHaveValue('map-9-1');
  await page.goto(url+'#field-guide?entry=location-extinction-gate');
  await expect(viewer.getByRole('combobox',{name:'Floor',exact:true})).toHaveValue('map-9-2');
  await expect(viewer.locator('.map-gate-selected')).toHaveText('Extinction Gate');
});

test('gate floor changes preserve the other map, focus and scroll and survive a shared URL', async ({page}) => {
  await page.goto(url+'#field-guide?entry=location-lost-gate');
  const viewer=page.locator('#location-map-browser');
  const entrance=viewer.locator('[data-map-role="entrance"]');
  const final=viewer.locator('[data-map-role="final"]');
  await entrance.locator('[data-map-control="zoom"]').click();
  const entranceImage=await entrance.locator('.map-image img').getAttribute('src');
  const layout=final.getByRole('combobox',{name:'Layout',exact:true});
  await layout.focus();
  const scroll=await page.evaluate(()=>window.scrollY);
  await layout.selectOption('map-88-1');
  await expect(layout).toBeFocused();
  await expect(viewer.locator('#gate-map-selected')).toHaveCount(1);
  await expect(final).toHaveAttribute('id','gate-map-selected');
  expect(await page.evaluate(()=>window.scrollY)).toBe(scroll);
  await expect(entrance.locator('[data-map-control="zoom"]')).toHaveAttribute('aria-pressed','true');
  await expect(entrance.locator('.map-image img')).toHaveAttribute('src',entranceImage);
  await expect(page).toHaveURL(/entry=location-lost-gate.*map=map-88-1/);
  const finalImage=await final.locator('.map-image img').getAttribute('src');
  await page.reload();
  await expect(final.getByRole('combobox',{name:'Layout',exact:true})).toHaveValue('map-88-1');
  await expect(final.locator('.map-image img')).toHaveAttribute('src',finalImage);
  await expect(entrance.getByRole('combobox',{name:'Floor',exact:true})).toHaveValue('map-9-1');
  await expect(entrance.locator('.map-gate-selected')).toHaveText('Lost Gate');
  await entrance.getByRole('combobox',{name:'Floor',exact:true}).selectOption('map-9-2');
  await expect(entrance).toHaveAttribute('id','gate-map-selected');
  await expect(final).not.toHaveAttribute('id','gate-map-selected');
});

test('Farm Gate marks the portal at the correct point on each native farm layout', async ({page}) => {
  await page.goto(url+'#field-guide?entry=location-farm-gate');
  const viewer=page.locator('#location-map-browser');
  const layout=viewer.getByRole('combobox',{name:'Layout',exact:true});
  const marker=viewer.locator('.map-gate-selected');
  await expect(layout).toHaveValue('map-10-0');
  await expect(marker).toHaveAttribute('style',/left:90%;top:15\.625%/);
  await layout.selectOption('map-10-1');
  await expect(marker).toHaveText('Farm Gate');
  const point=await marker.evaluate(node=>({x:parseFloat(node.style.left)/100,y:parseFloat(node.style.top)/100}));
  expect(point.x).toBeCloseTo(.9,6);
  expect(point.y).toBeCloseTo(20/47,6);
  await page.reload();
  await expect(layout).toHaveValue('map-10-1');
  await expect(marker).toHaveText('Farm Gate');
});

test('generated floors show native terrain samples and distinguish possible special rooms', async ({page}) => {
  await page.goto(url+'#field-guide?entry=location-townsperson-s-gate');
  const generation=page.getByRole('region',{name:'Generated floors',exact:true});
  await expect(generation).toContainText('1–4F · The final area is on 5F.');
  await expect(generation).toContainText('terrain samples; floor layouts are generated for each visit');
  await expect(generation.locator('.gate-terrain-list strong')).toHaveText(['Rocky cave','Mossy cave','Forest paths','Grassland']);
  await expect(generation.locator('.gate-special-floors')).toContainText('Special floors · English patch');
  await expect(generation.locator('.gate-special-floors')).toContainText('3F. They are not guaranteed.');
  await expect(generation.locator('.gate-special-floors li')).toHaveText(['Church']);
  for (const image of await generation.locator('.gate-terrain-list img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
    await expect(image).toHaveAttribute('src',/^maps\/.+\.webp$/);
  }
  await page.goto(url+'#field-guide?entry=location-departure-gate');
  await expect(generation.locator('.gate-special-floors')).toHaveCount(0);
  await expect(generation.locator('.gate-terrain-list strong')).toHaveText(['Rocky cave','Forest paths','Grassland']);
});

test('native final areas and boss fallbacks appear on the gate pages that lacked route records', async ({page}) => {
  await page.goto(url+'#field-guide?entry=location-departure-gate');
  const final=page.locator('#location-map-browser [data-map-role="final"]');
  await expect(final.locator('[data-map-control="title"]')).toHaveText('Bottom of the Old Well');
  await expect(final).toHaveAttribute('data-map-place','map-71-0');
  const healie=page.locator('.gate-facts .gate-boss-link');
  await expect(healie).toContainText('Healie');
  await expect(healie).toHaveAttribute('href',/entry=npc-healie/);
  await expect(healie.locator('[data-monster-index="13"]')).toBeVisible();
  await healie.click();
  await expect(page.locator('#article-title')).toContainText('Healie');

  await page.goto(url+'#field-guide?entry=location-arena-left-gate');
  await expect(final.locator('[data-map-control="title"]')).toHaveText("Spirit's Spring");
  await expect(final).toHaveAttribute('data-map-place','map-84-0');
  await expect.poll(()=>final.locator('.map-image img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  const boss=page.locator('.gate-facts .gate-boss-link');
  await expect(boss).toHaveText('Dungeon Shrimp');
  await expect(boss).toHaveAttribute('href','#monster?id=152');
  await expect(boss.locator('[data-monster-index="152"]')).toBeVisible();
  await boss.click();
  await expect(page.locator('#monster')).toBeVisible();
  await expect(page).toHaveURL(/#monster\?id=152$/);
});

test('a mobile map deep link focuses the requested final-area panel', async ({page}) => {
  await page.setViewportSize({width:375,height:812});
  await page.goto(url+'#field-guide?entry=location-arena-left-gate');
  await page.goto(url+'#field-guide?entry=location-arena-left-gate&map=map-84-0&section=maps');
  const selected=page.locator('#gate-map-selected');
  await expect(selected).toHaveAttribute('data-map-place','map-84-0');
  await expect(selected).toBeFocused();
  await expect(selected.locator('[data-map-control="title"]')).toBeInViewport();
  await expect(selected.locator('.map-image img')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('gate boss alternatives and consecutive encounters keep their order and fit on mobile', async ({page}) => {
  await page.setViewportSize({width:375,height:812});
  for (const [gate,label,species,note] of [
    ['medal','Boss choices',[9,149,122],'Choose one of three encounters.'],
    ['destruction','Boss sequence',[293,294],/Defeat.*return.*second/i]
  ]) {
    await page.goto(url+'#field-guide?entry=location-'+gate+'-gate');
    const facts=page.locator('.gate-facts');
    await expect(facts.locator('dt').filter({hasText:label})).toBeVisible();
    await expect(facts.locator('.gate-boss-note')).toHaveText(note);
    const links=facts.locator('.gate-boss-list .gate-boss-link');
    await expect(links).toHaveCount(species.length);
    for (const [index,id] of species.entries()) {
      await expect(links.nth(index)).toHaveAttribute('href','#monster?id='+id);
      await expect(links.nth(index).locator('[data-monster-index="'+id+'"]').first()).toBeVisible();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await links.last().click();
    await expect(page.locator('#monster')).toBeVisible();
    await expect(page).toHaveURL(new RegExp('#monster\\?id='+species.at(-1)+'$'));
  }
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
  await page.goto(url+'#field-guide?entry=location-townsperson-s-gate');
  await expect(page.locator('#guide-reveal')).toBeVisible();
  await expect(page.locator('.gate-generation')).toHaveCount(0);
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
    await page.goto(url+'#field-guide?entry=location-townsperson-s-gate');
    const entrance=page.locator('[data-map-role="entrance"]');
    const final=page.locator('[data-map-role="final"]');
    await expect(entrance.locator('.map-image img')).toBeVisible();
    await expect(final.locator('.map-image img')).toBeVisible();
    const entranceBox=await entrance.boundingBox(), finalBox=await final.boundingBox();
    expect(finalBox.y).toBeGreaterThanOrEqual(entranceBox.y+entranceBox.height);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

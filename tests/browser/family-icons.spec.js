const {test,expect}=require('@playwright/test');
let url;
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});

test('family labels use the native icon on profiles, library rows and breeding results',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url+'#monster?id=143');
  const identity=page.locator('.monster-profile-identity');
  await expect(identity.locator('.family-label')).toHaveText('Bug Family');
  const icon=identity.locator('img.family-icon');
  await expect(icon).toHaveAttribute('src',/media\/family-5\.webp/);
  expect(await icon.evaluate(image=>({width:image.naturalWidth,height:image.naturalHeight}))).toEqual({width:10,height:10});
  const typography=await identity.locator('.monster-eyebrow').evaluate(node=>({size:getComputedStyle(node).fontSize,transform:getComputedStyle(node).textTransform}));
  expect(parseFloat(typography.size)).toBeGreaterThanOrEqual(13);
  expect(typography.transform).toBe('none');
  await page.goto(url+'#species-index');
  await page.locator('#species-search').fill('Giant Slug');
  await expect(page.locator('#species-rows .family-icon')).toHaveAttribute('src',/media\/family-5\.webp/);
  await page.goto(url+'#offspring-finder?target=45');
  await expect(page.locator('#reverse-rows .family-icon').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('all eleven family icons decode and the profile fits a narrow screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(url+'#monster?id=11');
  const slime=page.locator('.monster-profile-identity .family-label');
  await expect(slime).toHaveText('Slime Family');
  await expect(slime.locator('img')).toHaveAttribute('width','10');
  const decoded=await page.evaluate(async()=>Promise.all(Object.values(FAMILY_ICONS).map(async frame=>{
    const image=new Image();image.src=frame.src;await image.decode();return [image.naturalWidth,image.naturalHeight];
  })));
  expect(decoded).toEqual(Array(11).fill([10,10]));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.monster-profile-identity .family-label')).toBeVisible();
});

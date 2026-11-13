const path = require('node:path');
const {test,expect} = require('@playwright/test');
let server,url;

test.beforeAll(async()=>{
  const started = await (await import('../helpers/serve')).startServer({root:path.resolve(__dirname,'../../site-dist'),prefix:'/guide/'});
  server=started.server;
  url=started.baseURL;
});
test.afterAll(async()=>{
  if (!server) return;
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
});

test.use({javaScriptEnabled:false});

test('published Aibou profile includes its egg exchange without unsupported calculator links',async({page})=>{
  await page.goto(url+'entries/');
  await page.locator('a[href="monsters/323/"]').click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Aibou');
  const rewards=page.locator('section').filter({has:page.getByRole('heading',{name:'Enhanced v1.0.74 rewards',exact:true})});
  await expect(rewards).toContainText('312');
  await expect(rewards).toContainText('99');
  await expect(rewards.locator('a[href="articles/quest-aibou-egg/"]')).toBeVisible();
  await expect(page.getByRole('heading',{name:'First-copy breeding',exact:true})).toHaveCount(0);
  await expect(page.locator('a[href^="#skill-planner"],a[href^="#combat-planner"]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Usual recruitment level cap');
  await rewards.locator('a[href="articles/quest-aibou-egg/"]').click();
  await expect(page.getByRole('heading',{level:1})).toContainText('Aibou');
});

test('published standard monster keeps breeding while adding its Survival egg route',async({page})=>{
  await page.goto(url+'monsters/22/');
  await expect(page.getByRole('heading',{name:'Enhanced v1.0.74 rewards',exact:true})).toBeVisible();
  await expect(page.locator('a[href="articles/field-greattree-arena/"]')).toBeVisible();
  await expect(page.getByRole('heading',{name:'First-copy breeding',exact:true})).toBeVisible();
  await expect(page.locator('main')).toContainText('27-battle');
});

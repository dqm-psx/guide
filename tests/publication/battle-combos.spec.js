const path=require('node:path');
const {test,expect}=require('@playwright/test');
let server,url;
test.beforeAll(async()=>{
  const started=await(await import('../helpers/serve')).startServer({root:path.resolve(__dirname,'../../site-dist'),prefix:'/guide/'});
  server=started.server;url=started.baseURL;
});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}});
test.use({javaScriptEnabled:false});

test('published combos and component skill pages remain connected without JavaScript',async({page})=>{
  await page.goto(url+'articles/field-battle-combos/');
  await expect(page.getByRole('link',{name:'Check my party’s battle combos'})).toHaveAttribute('href','#team-planner?tab=roster&combos=party');
  const table=page.getByRole('region',{name:'All 20 PlayStation combinations',exact:true});
  await expect(table.locator('tbody tr')).toHaveCount(20);
  await expect(page.getByRole('link',{name:'Chance',exact:true})).toHaveCount(1);
  await table.locator('a[href="skills/e0c4f/"]').first().click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Thordain');
  await page.getByRole('link',{name:'Kazap',exact:true}).click();
  await expect(page).toHaveURL(/articles\/field-battle-combos\/#article-section-combo-recipes$/);
  await expect(page.getByRole('heading',{name:'All 20 PlayStation combinations',exact:true})).toBeInViewport();
});

test('standalone profiles use each family icon’s own dimensions',async({page})=>{
  await page.goto(url+'monsters/143/');
  const icon=page.locator('.family-icon');
  await expect(icon).toHaveAttribute('src',/family-5\.webp/);
  await expect(page.locator('.family-label')).toContainText('Bug');
  await expect(icon).toHaveAttribute('width','10');
  await page.goto(url+'monsters/11/');
  await expect(icon).toHaveAttribute('src',/family-0\.webp/);
  await expect(icon).toHaveAttribute('width','20');
  await expect(icon).toHaveAttribute('height','20');
});

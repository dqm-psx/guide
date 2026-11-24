const path=require('node:path');
const {test,expect}=require('@playwright/test');
let server,url;
test.beforeAll(async()=>{
  const {startServer}=await import('../helpers/serve.js');
  const started=await startServer({root:path.resolve(__dirname,'../../site-dist')});
  server=started.server;url=started.baseURL;
});
test.afterAll(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});

test('the existing standalone Recruiting URL enhances into its Reference destination',async({page})=>{
  await page.goto(url+'articles/field-recruitment/#article-section-healing-recruitment');
  await expect(page.locator('#article-title')).toHaveText('Recruiting');
  await expect(page.locator('.nav a[href="#recruiting"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#article-section-healing-recruitment')).toBeInViewport();
  await expect(page.locator('#guide-article .guide-back')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#article-section-healing-recruitment')).toBeInViewport();
  await expect(page.locator('.nav a[href="#recruiting"]')).toHaveAttribute('aria-current','page');
});

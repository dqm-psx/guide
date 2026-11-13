const path=require('node:path');
const {test,expect}=require('@playwright/test');
let server,url;
const article='articles/field-restored-content/#article-section-cobi-tara-worlds';
test.beforeAll(async()=>{
  const {startServer}=await import('../helpers/serve.js');
  const started=await startServer({root:path.resolve(__dirname,'../../site-dist')});
  server=started.server;url=started.baseURL;
});
test.afterAll(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});

for(const mode of ['no JavaScript','enhancement unavailable'])test('story comparison is protected with '+mode,async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:mode!=='no JavaScript'});
  try {
    if(mode!=='no JavaScript'){
      await context.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
      await context.route('**/js/entry-page.js*',route=>route.abort());
    }
    const page=await context.newPage();await page.goto(url+article);
    const section=page.locator('#article-section-cobi-tara-worlds').locator('..');
    await expect(section.locator('details')).not.toHaveAttribute('open','');
    await expect(section.getByRole('table')).not.toBeVisible();
    await expect(page.locator('#article-section-which-edition').locator('..').getByRole('table')).toBeVisible();
    await section.locator('summary').click();
    await expect(section.getByRole('table')).toBeVisible();
    await expect(section.getByRole('table')).toContainText('Kameha');
  }finally{await context.close();}
});

test('published subsection enhancement respects the saved spoiler preference',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.goto(url+article);
  await expect(page.locator('#article-title')).toBeVisible();
  const section=page.locator('#article-section-cobi-tara-worlds').locator('..');
  await expect(section).not.toContainText('Kameha');
  await section.getByRole('button',{name:'Reveal this section'}).click();
  await expect(section).toContainText('Kameha');
});

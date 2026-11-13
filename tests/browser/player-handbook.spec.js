const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('starter and recruit names connect the walkthrough, character search and nickname directory', async ({page}) => {
  await page.goto(url+'#field-guide?kind=story&entry=story-terry-opening');
  const steps=page.locator('#guide-article .article-steps');
  await expect(steps.getByRole('link',{name:'Slib',exact:true})).toHaveAttribute('href',/entry=npc-surabou/);
  await steps.getByRole('link',{name:'Healie / Hale',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Healie / Hale');
  await expect(page.locator('#guide-article')).toContainText('Default nickname · Hale');
  await page.goto(url+'#field-guide?q=Surabou');
  await expect(page.locator('.guide-row').first()).toContainText('Slib');
  await page.goto(url+'#field-guide?q=Biino');
  await page.locator('.guide-row').filter({hasText:'Default monster nicknames'}).click();
  await page.setViewportSize({width:320,height:780});
  const table=page.getByRole('table',{name:'Default monster nicknames'});
  await expect(table.getByRole('rowheader',{name:'Biino'})).toBeVisible();
  expect(await table.evaluate(node=>node.scrollWidth <= node.parentElement.clientWidth)).toBe(true);
  await table.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Hale',exact:true})})
    .getByRole('link',{name:'Healie / Hale'}).click();
  await expect(page.locator('#article-title')).toHaveText('Healie / Hale');
});

test('item abbreviations lead to PSX shop prices and a shareable result', async ({page}) => {
  await page.goto(url);
  await page.getByLabel('Search the guide').fill('MedHerb');
  await page.locator('.guide-row').filter({hasText:'Medicinal Herb'}).click();
  await expect(page.locator('#article-title')).toHaveText('Medicinal Herb');
  const heading=page.locator('.item-profile-heading');
  await expect(heading.getByRole('heading',{name:'Medicinal Herb',exact:true})).toBeVisible();
  await expect(heading.locator('[lang="ja"]')).toHaveText('やくそう');
  await expect(heading.locator('.monster-alias')).toHaveText(['MedHerb','Herb','MediHerb']);
  await expect(heading.getByText('Herb',{exact:true})).toHaveAttribute('title','Game Boy-style patch');
  await expect(heading.locator('img')).toBeVisible();
  await expect(page.getByRole('table',{name:'Recorded shop prices'})).toContainText('GreatTree / Bazaar');
  await expect(page.getByRole('table',{name:'Recorded shop prices'})).toContainText('9 G');
  await page.reload();
  await expect(page.locator('#article-title')).toHaveText('Medicinal Herb');
  await page.getByRole('link',{name:'← Search results'}).click();
  await expect(page.locator('#guide-search')).toHaveValue('MedHerb');
  await page.getByLabel('Search the guide').fill('やくそう');
  await expect(page.locator('.guide-row').first()).toContainText('Medicinal Herb');
  await page.getByLabel('Search the guide').fill('buy herb');
  await expect(page.locator('.guide-row').first()).toContainText('Medicinal Herb');
  await expect(page.locator('.guide-row').first()).toContainText('10 G');
  await page.getByLabel('Search the guide').fill('dracy');
  await expect(page.locator('.guide-row').filter({has:page.getByText('Dracky',{exact:true})}).first()).toHaveAttribute('href',/^#monster\?id=/);
  await page.getByLabel('Search the guide').fill('how to breed');
  await expect(page.locator('.guide-row').first()).toHaveAttribute('href','#pair-finder');
});

test('Items includes travel supplies and preserves filters when narrowing the list', async ({page}) => {
  await page.goto(url+'#field-guide?kind=item&page=2');
  const directory = page.locator('#guide-directory');
  const count = directory.getByRole('status');
  await expect(count).toHaveText('91 items');
  await expect(directory.getByRole('table',{name:'Items',exact:true}).locator('tbody tr')).toHaveCount(91);
  await directory.getByRole('link',{name:'Travel & exploration items'}).click();
  await expect(count).toHaveText('8 items');
  await expect(directory.getByText('Chimera Wing',{exact:true})).toBeVisible();
  await expect(directory.getByText('Travel Bookmark',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Search filters'}).click();
  await page.locator('#guide-game').selectOption('dqm1');
  await expect(directory.getByRole('table').locator('tbody tr')).not.toHaveCount(8);
  await expect(directory.getByRole('rowheader',{name:'Chimera Wing'})).toBeVisible();
  await page.getByLabel('Search the guide').fill('ChimWing');
  await directory.getByRole('link',{name:'All items'}).click();
  await expect(page.locator('#guide-kind')).toHaveValue('item');
  await expect(page.locator('#guide-game')).toHaveValue('dqm1');
  await expect(page.locator('#guide-search')).toHaveValue('ChimWing');
  await expect(count).toHaveText('1 item');
  await directory.getByRole('link',{name:/Chimera Wing/}).click();
  await expect(page.locator('#article-title')).toHaveText('Chimera Wing');
  await page.getByRole('link',{name:'← Search results'}).click();
  await expect(page.locator('#guide-kind')).toHaveValue('item');
  await page.getByLabel('Search the guide').fill('Travel Bookmark');
  await expect(directory.getByText('Travel Bookmark',{exact:true})).toBeVisible();
});

test('Items remembers visible columns across reloads and travel supplies', async ({page}) => {
  await page.setViewportSize({width:375,height:800});
  await page.goto(url+'#field-guide?kind=item');
  const directory=page.locator('#guide-directory');
  const table=directory.getByRole('table');
  const columns=directory.getByText('Columns',{exact:true});
  const optional=['In-game description','Effect','Type','Uses','Buy price','Sell price','Where to get it'];
  const option=name=>directory.getByRole('checkbox',{name,exact:true});
  await expect(table.getByRole('columnheader')).toHaveCount(8);
  await columns.focus();
  await page.keyboard.press('Enter');
  await expect(directory.getByRole('checkbox')).toHaveCount(7);
  for (const label of optional) {
    await expect(option(label)).toBeChecked();
    if (label!=='Buy price') await option(label).uncheck();
  }
  await columns.click();
  await expect(table.getByRole('columnheader')).toHaveCount(2);
  const herb=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Medicinal Herb',exact:true})});
  await expect(herb.getByRole('cell')).toHaveText(['10 G']);
  await table.getByRole('button',{name:'Buy price',exact:true}).click();
  const sortedNames=await table.getByRole('rowheader').allTextContents();
  expect(sortedNames.filter(name=>name==='Medicinal Herb' || name==='Adventure Book')).toEqual(['Medicinal Herb','Adventure Book']);
  await columns.click();
  await option('Buy price').uncheck();
  await columns.click();
  await expect(table.getByRole('columnheader')).toHaveAccessibleName('Item name');
  expect(await table.evaluate(node=>node.parentElement.scrollWidth<=node.parentElement.clientWidth)).toBe(true);
  await page.reload();
  await expect(table.getByRole('columnheader')).toHaveAccessibleName('Item name');
  await directory.getByRole('link',{name:'Travel & exploration items'}).click();
  await expect(directory.getByRole('status')).toHaveText('8 items');
  await expect(table.getByRole('columnheader')).toHaveAccessibleName('Item name');
  await columns.click();
  await expect(option('Effect')).not.toBeChecked();
  await option('Effect').check();
  await columns.click();
  await directory.getByRole('link',{name:'All items'}).click();
  await expect(table.getByRole('columnheader')).toHaveCount(2);
  await expect(table.getByRole('columnheader',{name:'Effect',exact:true})).toBeVisible();
  await expect(herb.getByRole('cell')).toContainText(['HP']);
});

test('Items sorts real prices numerically, keeps missing values last and links to sourced profiles', async ({page}) => {
  await page.setViewportSize({width:375,height:800});
  await page.goto(url+'#field-guide?kind=item');
  const index=page.getByRole('table',{name:'Items',exact:true});
  const rows=index.locator('tbody tr');
  await expect(rows).toHaveCount(91);
  const labels = await index.getByRole('button').evaluateAll(buttons=>buttons.map(button=>button.firstChild.textContent.trim()));
  expect(labels).toEqual(['Item name','In-game description','Effect','Type','Uses','Buy price','Sell price','Where to get it']);
  const herb=rows.filter({has:page.getByRole('rowheader',{name:'Medicinal Herb',exact:true})});
  await expect(herb).toContainText('One ally: 30-40 HP restored.');
  await expect(herb.getByRole('cell',{name:'7–8 G',exact:true})).toHaveCount(1);
  const images=rows.locator('th img');
  await expect(images).toHaveCount(91);
  expect(await images.evaluateAll(nodes=>Promise.all(nodes.map(async n=>{await n.decode();return n.naturalWidth>0 && Boolean(n.title);})).then(v=>v.every(Boolean)))).toBe(true);
  const column = label=>index.getByRole('columnheader',{name:label,exact:true}).evaluate(node=>node.cellIndex);
  const typeColumn = await column('Type');
  const collator = new Intl.Collator('en',{sensitivity:'base',numeric:true});
  for (const dir of [1,-1]) {
    await index.getByRole('button',{name:'Type',exact:true}).click();
    const types = await rows.evaluateAll((list,i)=>list.map(row=>row.cells[i].textContent),typeColumn);
    expect(types).toEqual([...types].sort((left,right)=>dir*collator.compare(left,right)));
  }
  await expect(herb.getByRole('cell',{name:'Healing',exact:true})).toHaveCount(1);
  const usesColumn = await column('Uses');
  const useCell = name => index.getByRole('rowheader',{name,exact:true}).evaluate((th,i)=>th.parentElement.cells[i].textContent,usesColumn);
  expect(await useCell('Sea Bell')).toBe('1 hand-in');
  expect(await useCell('Stamina Belt')).toBe('While equipped');
  expect(await useCell('Friendship Staff')).toContain('61%');
  expect(await useCell('Divine Staff')).toContain('11%');
  for (const direction of ['ascending','descending']) {
    await index.getByRole('button',{name:'Uses',exact:true}).click();
    await expect(index.getByRole('columnheader',{name:'Uses'})).toHaveAttribute('aria-sort',direction);
    const names = await rows.getByRole('rowheader').allTextContents();
    const ranks = ['Medicinal Herb','Friendship Staff','Thunder Staff','Divine Staff','Transform Staff'].map(name=>names.indexOf(name));
    expect(ranks.every(rank=>rank>=0)).toBe(true);
    expect(names.indexOf('Stamina Belt')).toBeGreaterThan(Math.max(...ranks));
    expect(ranks).toEqual([...ranks].sort((a,b)=>direction==='ascending' ? a-b : b-a));
  }
  for(const col of ['Buy price','Sell price']){
    const num=await column(col);
    const button=index.getByRole('button',{name:col,exact:true});
    for(const dir of [1,-1]){
      await button.click();
      const prices=await rows.evaluateAll((list,i)=>list.map(row=>{
        const match=row.cells[i].textContent.match(/[0-9][0-9,]*/);
        return match ? Number(match[0].replaceAll(',','')) : null;
      }),num);
      const known=prices.filter(p=>p!==null);
      expect(known.length).toBeGreaterThan(10);
      expect(known.length).toBeLessThan(prices.length);
      expect(prices).toEqual([...known.sort((a,b)=>dir*(a-b)),...Array(prices.length-known.length).fill(null)]);
    }
  }
  await index.getByRole('rowheader',{name:'Miracle Mark'}).getByRole('link').click();
  const article=page.locator('#guide-article');
  await expect(article).toContainText('Silver');
  await expect(article).toContainText('Material');
  await page.goBack();
  await expect(index.getByRole('columnheader',{name:'Sell price'})).toHaveAttribute('aria-sort','descending');
  await page.reload();
  await expect(index.getByRole('columnheader',{name:'Sell price'})).toHaveAttribute('aria-sort','descending');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(375);
});

test('Mechanics sorts by adventure or article and preserves the reader’s place', async ({page}) => {
  await page.setViewportSize({width:320,height:760});
  await page.goto(url);
  await page.getByRole('link',{name:'Browse all mechanics'}).click();
  await expect(page.getByRole('navigation',{name:'Mechanics topics'})).toBeVisible();
  await page.getByRole('navigation',{name:'Mechanics view'}).getByRole('link',{name:'All articles'}).click();
  const index = page.getByRole('table',{name:'Mechanics articles'});
  const sections = index.locator('tbody td');
  await expect(index.getByRole('link')).toHaveCount(22);
  expect([...new Set(await sections.allTextContents())]).toEqual(['General','Terry','Cobi & Tara']);
  await expect(index.getByRole('columnheader',{name:'Section'})).toHaveAttribute('aria-sort','ascending');
  const articleSort = index.getByRole('button',{name:'Article'});
  await articleSort.click();
  await expect(articleSort).toBeFocused();
  const titles = await index.getByRole('link').allTextContents();
  expect(titles).toEqual([...titles].sort(new Intl.Collator('en',{sensitivity:'base',numeric:true}).compare));
  await index.getByRole('link',{name:'Default monster nicknames'}).click();
  await page.getByRole('link',{name:'← Mechanics'}).click();
  await expect(index.getByRole('columnheader',{name:'Article'})).toHaveAttribute('aria-sort','ascending');
  await articleSort.click();
  await page.reload();
  await expect(index.getByRole('columnheader',{name:'Article'})).toHaveAttribute('aria-sort','descending');
  const search = page.getByLabel('Search the guide');
  await search.fill('Bard');
  await expect(search).toBeFocused();
  await expect(index.locator('a[href*="entry=field-wandering-masters"]')).toBeVisible();
  await expect(index.locator('a[href*="entry=field-restored-content"]')).toBeVisible();
  await expect(index.locator('tbody')).toContainText('Bard');
  await search.fill('zzzzzz');
  await expect(page.getByRole('link',{name:'Search all topics for “zzzzzz”'})).toBeVisible();
  await search.fill('');
  await page.locator('#guide-settings summary').click();
  await page.getByLabel('Show story spoilers').uncheck();
  await expect(index.locator('a[href*="entry=field-default-nicknames"]')).toHaveText('Mechanics · spoiler hidden');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
});

test('short searches keep their spelling and scoped searches can reach other topics', async ({page}) => {
  await page.setViewportSize({width:375,height:780});
  await page.goto(url+'#field-guide?kind=npc&q=bard');
  await expect(page.locator('.guide-count')).toHaveText('No matching entries');
  await page.getByRole('link',{name:'Search all topics for “bard”'}).click();
  const results=page.locator('.guide-row');
  await expect(results.first()).toHaveAttribute('href',/entry=field-wandering-masters/);
  await expect(results.first()).toContainText(/Terry.*Bard.*two-room floor.*20/);
  expect(await results.first().locator('.guide-search-excerpt').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
  await expect(results.filter({has:page.locator('strong',{hasText:/bird/i})})).toHaveCount(0);
  const filters=page.getByRole('button',{name:'Search filters'});
  await filters.click();
  await page.locator('#guide-game').selectOption('dqm2');
  await filters.click();
  await expect(results.first()).toContainText(/Cobi and Tara.*Bard.*total EXP/);
  await results.first().click();
  await expect(page.locator('#guide-article .article-topic h3').first()).toContainText('Cobi and Tara');
  await page.locator('.guide-back').click();
  await filters.click();
  await page.locator('#guide-game').selectOption('');
  await filters.click();
  await page.getByLabel('Search the guide').fill('bird');
  await expect(results.filter({has:page.getByText('Bird Slash',{exact:true})})).toHaveCount(1);
  await page.getByLabel('Search the guide').fill('slmie');
  await expect(results.first().locator('strong')).toHaveText('Slime');
});

test('a species hunting question opens the correct campaign and encounter pool', async ({page}) => {
  await page.goto(url);
  await page.getByLabel('Search the guide').fill('Where can I catch Almiraj as Tara?');
  const match=page.locator('.guide-row').filter({hasText:'Almiraj'});
  await expect(match).toContainText('Tara · Ice Field · Lv. 19');
  await match.click();
  await expect(page.locator('#atlas-game')).toHaveValue('tara');
  await expect(page.locator('#atlas-detail')).toContainText('Almiraj');
});

test('event copies share an atlas entry while distinct places and dungeon layouts remain reachable', async ({page}) => {
  await page.goto(url+'#atlas?map=map-12-9&page=3');
  await expect(page.locator('#atlas-location')).toHaveText('GreatLog Storage');
  await page.getByLabel('Find a map').fill('GreatLog Storage');
  await expect(page.locator('.atlas-scroll a')).toHaveCount(1);
  await expect(page.locator('.atlas-scroll a')).toHaveAttribute('aria-current','true');
  await expect(page.locator('#atlas-layout-select')).toHaveCount(0);
  await page.getByLabel('Find a map').fill('Library');
  await expect(page.locator('.atlas-scroll a').filter({hasText:'GreatLog'})).toHaveCount(1);
  await expect(page.locator('.atlas-scroll a').filter({hasText:'GreatTree'})).toHaveCount(1);
  await page.goto(url+'#atlas?map=map-28-2');
  await expect(page.locator('#atlas-layout-select')).toHaveValue('map-28-2');
  await page.locator('#atlas-layout-select').selectOption('map-28-0');
  await expect(page).toHaveURL(/map=map-28-0/);
  await page.goto(url+'#atlas?map=map-48-1');
  await page.locator('.map-doors a[href*="variant="]').click();
  await expect(page.locator('#atlas-layout-select')).toHaveValue('map-48-0:tiles-2253');
  const alternate = await page.locator('.map-image img').getAttribute('src');
  await page.locator('#atlas-layout-select').selectOption('map-48-0');
  await expect(page.locator('.map-image img')).not.toHaveAttribute('src', alternate);
});

test('the Skills directory sorts the whole list and keeps the chosen order through search and back', async ({page}) => {
  await page.goto(url+'#field-guide?kind=skill');
  const table=page.getByRole('table',{name:'Skills',exact:true});
  const rows=table.locator('tbody tr');
  await expect(rows).toHaveCount(169);
  const blaze=table.getByRole('row').filter({has:page.getByRole('link',{name:'Blaze',exact:true})});
  const cells=blaze.getByRole('cell');
  await expect(cells.nth(0)).toHaveText('Attacks with a small fireball.');
  await expect(cells.nth(1)).toContainText(/damage/i);
  await expect(cells.nth(2)).toHaveText('Damage');
  await expect(cells.nth(3)).toHaveText('2');
  await expect(cells.nth(4)).toHaveText('One enemy');
  const headers=table.getByRole('columnheader');
  const labels=['Skill name','In-game description','Effect','Type','MP cost','Target'];
  const collator=new Intl.Collator('en',{sensitivity:'base',numeric:true});
  for (const [index,label] of labels.entries()) {
    const header=headers.nth(index);
    const button=header.getByRole('button',{name:label,exact:true});
    const orders=label==='Skill name' ? ['descending','ascending'] : ['ascending','descending'];
    for (const direction of orders) {
      await button.click();
      await expect(header).toHaveAttribute('aria-sort',direction);
      const values=await rows.evaluateAll((list,i)=>list.map(row=>row.cells[i].textContent.trim()),index);
      if (label==='MP cost') {
        const numeric=values.filter(v=>/^\d+$/.test(v)).map(Number);
        expect(numeric).toContain(0);
        expect(numeric).toEqual([...numeric].sort((a,b)=>direction==='ascending' ? a-b : b-a));
        expect(values.slice(numeric.length)).toEqual(Array(3).fill('All remaining MP'));
      } else {
        expect(values).toEqual([...values].sort((a,b)=>direction==='ascending' ? collator.compare(a,b) : collator.compare(b,a)));
      }
    }
  }
  await table.getByRole('button',{name:'MP cost'}).click();
  await page.getByLabel('Search the guide').fill('Blaze');
  await table.getByRole('link',{name:'Blaze',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Blaze');
  await page.locator('.monster-breadcrumb > a').click();
  await expect(table.getByRole('columnheader',{name:'MP cost'})).toHaveAttribute('aria-sort','ascending');
  await expect(page.getByLabel('Search the guide')).toHaveValue('Blaze');
  await page.getByLabel('Search the guide').fill('');
  await page.getByRole('button',{name:'Search filters'}).click();
  await page.locator('#guide-game').selectOption('dqm1');
  await expect(rows).toHaveCount(125); // Includes the verified Terry-only Dimension Dragon skill.
  await page.reload();
  await expect(rows).toHaveCount(125); // Includes the verified Terry-only Dimension Dragon skill.
  await expect(table.getByRole('columnheader',{name:'MP cost'})).toHaveAttribute('aria-sort','ascending');
});

test('skill profiles explain the effect and link upgrades and learner profiles', async ({page}) => {
  await page.goto(url+'#field-guide?kind=skill&entry=skill-e0c2b');
  await expect(page.locator('#article-title')).toHaveText('Bang');
  await expect(page.locator('.article-lead')).toContainText(/explos|blast|explod/i);
  await expect(page.locator('.skill-combat-facts')).toContainText('MP cost');
  await expect(page.locator('.skill-combat-facts')).toContainText('All enemies');
  await page.goto(url+'#field-guide?kind=skill&q=Blazemore');
  await page.getByRole('table',{name:'Skills',exact:true}).getByRole('link',{name:'Blazemore',exact:true}).click();
  await expect(page.locator('.skill-learners')).toContainText('No monster lists this as a natural skill');
  await expect(page.locator('.skill-progression').getByRole('link',{name:'Blazemost',exact:true})).toBeVisible();
  await page.locator('.skill-progression').getByRole('link',{name:'Blaze',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Blaze');
  await expect(page.locator('.skill-learner-list img').first()).toBeVisible();
  await expect(page.locator('.skill-profile .monster-japanese')).toHaveText('メラ');
  await page.locator('.skill-campaign[open] a').first().click();
  await page.locator('#monster-skills a').filter({hasText:/^Blaze$/}).click();
  await expect(page.locator('#article-title')).toHaveText('Blaze');
});

test('the offline skill profile fits a narrow screen and connects combination ingredients', async ({page}) => {
  const {FILE_URL}=await import('../helpers/modes');
  await page.setViewportSize({width:320,height:760});
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto(FILE_URL+'#field-guide?entry=skill-e0d3b');
  await expect(page.locator('#article-title')).toHaveText('MegaMagic');
  await expect(page.locator('.skill-combat-facts')).toContainText('All remaining MP');
  const related=page.locator('.skill-progression');
  await expect(related.getByRole('link')).toHaveCount(5);
  await expect(page.getByRole('navigation',{name:'Adjacent skills'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await related.getByRole('link',{name:'Blazemost',exact:true}).click();
  await expect(page.locator('.skill-progression').getByRole('link',{name:'MegaMagic',exact:true})).toBeVisible();
});

test('a character links to its native map, and doors continue into the atlas', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(url+'#field-guide?entry=npc-pulio');
  await page.locator('#guide-article .npc-art').evaluate(img=>img.decode());
  await page.getByRole('link',{name:/Monster Farm/}).first().click();
  await expect(page.locator('#atlas-location')).toHaveText('Monster Farm');
  await page.locator('.map-image img').evaluate(img=>img.decode());
  await page.getByRole('button',{name:'Zoom in'}).click();
  await expect(page.getByRole('button',{name:'Fit map'})).toHaveAttribute('aria-pressed','true');
  const door=page.locator('.map-doors a').first();
  const destination=await door.textContent();
  await door.click();
  await expect(page.locator('#atlas-location')).toHaveText(destination);
  await page.goBack();
  await expect(page.locator('#atlas-location')).toHaveText('Monster Farm');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('story visibility persists and skill and encounter species lead to live profiles', async ({page}) => {
  await page.goto(url+'#field-guide?entry=boss-dragon');
  await expect(page.locator('#article-title')).toHaveText('Dragon');
  await page.locator('#guide-settings summary').click();
  await page.getByLabel('Show story spoilers').uncheck();
  await page.reload();
  await page.locator('#guide-settings summary').click();
  await expect(page.getByLabel('Show story spoilers')).not.toBeChecked();
  await page.locator('#guide-settings summary').click();
  await expect(page.locator('#article-title')).not.toHaveText('Dragon');
  await page.getByRole('button',{name:'Reveal this entry'}).click();
  await expect(page.locator('#article-title')).toHaveText('Dragon');
  await page.goto(url+'#field-guide?kind=skill&q=Blaze');
  await page.getByRole('table',{name:'Skills',exact:true}).getByRole('link',{name:'Blaze',exact:true}).click();
  await expect(page.locator('.learning')).toContainText('Minimum learning stats');
  await page.locator('.skill-campaign[open] a').first().click();
  await expect(page.locator('#monster-heading')).toBeVisible();
  await page.goto(url+'#atlas?tab=encounters');
  await page.getByLabel('Find an area or monster').fill('Dracky');
  await expect(page.locator('.encounters')).toContainText('Dracky');
  await page.locator('.encounters .monster-link').first().click();
  await expect(page.locator('#monster')).toBeVisible();
});

test('gate routes connect floor rosters, arena progress, boss records and tactics', async ({page}) => {
  await page.setViewportSize({width:320,height:760});
  await page.goto(url+'#field-guide?entry=location-departure-gate');
  const first=page.locator('.route-roster tbody tr').first();
  await expect(first).toContainText(/1.4/);
  for (const name of ['Antbear','Dracky','Slime']) await expect(first.getByRole('link',{name,exact:true})).toHaveAttribute('href',/^#monster\?id=/);
  await expect(first).toContainText('Lv. 1');
  await page.goto(url+'#field-guide?entry=story-terry-early-arena');
  await expect(page.getByRole('table',{name:'Gates opened by each arena class'}).first()).toContainText('Guardian Gate');
  await page.getByRole('table',{name:'Gates opened by each arena class'}).first().getByRole('link',{name:'Golem',exact:true}).click();
  await expect(page.locator('.boss-art[data-monster-index="248"]')).toBeVisible();
  await expect(page.locator('.battle-stats')).toContainText('HP100');
  await expect(page.locator('.battle-stats')).toContainText('Attack45');
  await expect(page.locator('.battle-member')).toContainText('Lv. 7');
  await expect(page.locator('.battle-member a[href*="skill-"]')).toHaveCount(3);
  await page.locator('.article-lead').getByRole('link',{name:'Sleep Hit'}).click();
  await expect(page.locator('#article-title')).toHaveText('Sleep Hit');
  await page.goto(url+'#field-guide?entry=boss-dark-master');
  await expect(page.locator('.battle-adventure')).toHaveText(['Cobi','Tara']);
  await expect(page.locator('.battle-member')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('campaign walkthroughs read continuously and jump to bookmarked stages', async ({page}) => {
  await page.setViewportSize({width:320,height:780});
  await page.goto(url+'#field-guide?kind=story');
  await expect(page.locator('#article-title')).toHaveText('Terry walkthrough');
  await page.getByRole('navigation',{name:'Walkthrough campaign'}).getByRole('link',{name:'Cobi & Tara'}).click();
  await expect(page.locator('#article-title')).toHaveText('Cobi & Tara walkthrough');
  const contents=page.getByRole('navigation',{name:'Jump to a stage'});
  await contents.getByRole('link',{name:'Sky World'}).click();
  const selection=page.locator('#story-sky-ugor');
  await expect(selection).toBeFocused();
  await expect(selection).toBeInViewport();
  await expect(page.locator('#guide-article')).toContainText('two right-hand tiles once each');
  await expect(page.locator('#story-greatlog-spirit-rewards')).toBeAttached();
  await page.reload();
  await expect(selection).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.locator('#guide-settings summary').click();
  await page.getByLabel('Show story spoilers').uncheck();
  await expect(selection).toHaveText('Chapter 10');
  await expect(page.locator('#guide-article')).not.toContainText('Transform Staff');
  await selection.locator('+ button').click();
  await expect(selection).toHaveText('Ugor and the missing orb');
  await expect(page.locator('#guide-article')).not.toContainText('two right-hand tiles');
});

test('regional filters distinguish encounter pools and keep their rosters shareable', async ({page}) => {
  await page.goto(url+'#atlas?tab=encounters&game=cobi&region=water&q=Sea+Field');
  const sea=page.locator('.atlas-scroll a').filter({has:page.getByText('Sea Field',{exact:true})});
  await expect(sea).toHaveCount(1);
  await sea.click();
  await expect(page.locator('#atlas-location')).toHaveText('Sea Field');
  const pool=page.getByLabel('Encounter pool');
  const options=await pool.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  expect(new Set(options).size).toBe(options.length);
  await pool.selectOption({index:1});
  const address=page.url(), chosen=await pool.inputValue();
  await page.goto(address);
  await expect(pool).toHaveValue(chosen);
});
test('Healie speaks on his own page and links to his rescue quest', async ({page}) => {
  await page.setViewportSize({width:375,height:780});
  await page.goto(url+'#field-guide?kind=npc');
  const characters=page.locator('.character-directory');
  for (const role of ['Pulio','Healie / Hale']) {
    const image=characters.getByRole('link',{name:role,exact:true}).locator('.npc-art');
    const drawingHeight=await image.evaluate(el=>{
      const style=getComputedStyle(el);
      return el.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
    });
    expect(drawingHeight).toBeGreaterThanOrEqual(64);
  }
  await characters.getByRole('link',{name:'Healie / Hale',exact:true}).click();
  const article = page.locator('#guide-article');
  await expect(article.locator('.spoken-lines')).toContainText("Hello! I'm Healie!");
  const quest = article.locator('.character-quests a[href*="quest-rescue-healie"]');
  await expect(quest).toHaveCount(1);
  await quest.click();
  await expect(page).toHaveURL(/entry=quest-rescue-healie/);
});

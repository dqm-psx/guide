'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {articleSections,sectionText}=require('../../js/current-names');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
test('handbook sections preserve legacy text, searchable comparisons and safe standalone anchors',()=>{
  const row={sections:[
    {title:'Old table',intro:'Existing introduction.',rows:[['Role','Existing rules.']]},
    {id:'editions',title:'PSX & patch',paragraphs:['Current rules.'],bullets:['Use the PSX table.'],table:{columns:['Edition','Result'],rows:[['PSX','<native>']]},links:['field-breed'],sources:[{label:'Publisher',url:'https://example.com/game'},{label:'Invalid',url:'javascript:alert(1)'}]},
    {id:'next',title:'Next steps',paragraphs:['Return to the game.']}
  ]};
  const html=articleSections(row,escape,escape,2,null,{sectionHref:id=>'articles/test/#article-section-'+id,articleLink:id=>'<a href="articles/'+id+'/">Breed</a>'});
  assert.match(html,/<dt>Role<\/dt><dd>Existing rules\.<\/dd>/);
  assert.match(html,/href="articles\/test\/#article-section-editions"/);
  assert.match(html,/id="article-section-editions" tabindex="-1"/);
  assert.match(html,/<th scope="row">PSX<\/th><td>&lt;native>/);
  assert.match(html,/href="articles\/field-breed\/"/);
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('undefined'));
  assert.ok(sectionText(row.sections[1]).includes('<native>'));
});

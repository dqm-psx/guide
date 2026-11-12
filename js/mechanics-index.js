/* Shared handbook chapters and sortable article index, including standalone HTML. */
(() => {
  'use strict';
  const sections = ['both', 'dqm1', 'dqm2'];
  const alphabetical = new Intl.Collator('en', {sensitivity:'base', numeric:true});
  const topics = [
    {id:'editions',title:'PSX & the English patch',description:'What changes between the Game Boy games, the Japanese PlayStation remake and this patch.',
      entries:['field-restored-content','field-retail-bugs','field-movement-settings']},
    {id:'raising',title:'Raising & breeding',description:'Learn skills, plan growth and understand what carries over to the next generation.',
      entries:['field-growth','field-skill-inheritance','field-breed','field-eggs','field-personality','field-farm'],
      tools:[['#skill-planner','Skill & growth planner'],['#pair-finder','Find offspring'],['#offspring-finder','Find parents']]},
    {id:'battle',title:'Battle & the arena',description:'Damage, equipment, battle commands and arena rewards.',
      entries:['field-damage-and-resistance','field-equipment','field-arena-items','field-battle-text-speed','field-colosseum-prizes'],
      tools:[['#combat-planner','Damage calculator'],['#field-guide?kind=skill','Skills']]},
    {id:'exploration',title:'Exploration & recruitment',description:'Find monsters, recruit them and prepare for the journey.',
      entries:['field-wandering-masters','field-recruitment','field-packing','field-generated-keys','field-medals','field-default-nicknames'],
      tools:[['#field-guide?kind=location','Locations & maps'],['#field-guide?kind=item','Items']]},
    {id:'saves',title:'Two-player & saves',description:'Manage monsters, share breeding partners and use your saved team across the guide.',
      entries:['field-two-save-breeding','field-storage','field-triangle'],
      tools:[['#team-planner','My game']]}
  ];
  function topicFor(article) {
    return topics.find(topic=>topic.id===article.topic) || topics.find(topic=>topic.entries.includes(article.id)) || topics[3];
  }
  function handbook(articles,{escape,titleFor,linkTo,topicHref,activeTopic='',tools=true}) {
    const available=topics.filter(topic=>articles.some(article=>topicFor(article)===topic));
    const nav=topicHref ? '<nav class="handbook-topics" aria-label="Mechanics topics">'+
      [['','All topics'],...available.map(topic=>[topic.id,topic.title])].map(([id,title])=>
        '<a href="'+escape(topicHref(id))+'"'+(activeTopic===id?' aria-current="page"':'')+'>'+escape(title)+'</a>').join('')+'</nav>' : '';
    return nav+'<div class="handbook-chapters">'+available.filter(topic=>!activeTopic || topic.id===activeTopic).map((topic,index)=>{
      const members=articles.filter(article=>topicFor(article)===topic).sort((a,b)=>{
        const ai=topic.entries.indexOf(a.id),bi=topic.entries.indexOf(b.id);
        return (ai<0?999:ai)-(bi<0?999:bi) || alphabetical.compare(a.title,b.title);
      });
      return '<section class="handbook-chapter" aria-labelledby="mechanics-'+topic.id+'"><div class="handbook-chapter-heading"><span class="chapter-number" aria-hidden="true">'+String(topics.indexOf(topic)+1).padStart(2,'0')+'</span><div><h3 id="mechanics-'+topic.id+'">'+escape(topic.title)+'</h3><p>'+escape(topic.description)+'</p></div></div><ul>'+members.map(article=>
        '<li>'+linkTo(article.id,titleFor(article))+'</li>').join('')+'</ul>'+
        (tools && topic.tools ? '<nav class="handbook-tools" aria-label="'+escape(topic.title)+' tools">'+topic.tools.map(([url,label])=>'<a href="'+escape(url)+'">'+escape(label)+' <span aria-hidden="true">→</span></a>').join('')+'</nav>' : '')+'</section>';
    }).join('')+'</div>';
  }

  function sorted(rows, key, descending = false) {
    const direction = descending ? -1 : 1;
    return rows.sort((a,b) => {
      const byTitle = alphabetical.compare(a.title, b.title);
      if (key === 'title') return direction * byTitle;
      return direction * (a.section - b.section) || byTitle;
    });
  }
  function render(articles, {games, titleFor, linkTo, escape, excerptFor}) {
    const rows = articles.map(article => ({
      article, title:titleFor(article), section:sections.indexOf(article.game)
    }));
    const body = sorted(rows, 'section').map(({article, title, section}) => {
      const excerpt = excerptFor?.(article);
      const sectionName = article.game === 'both' ? 'General' : games[article.game];
      return '<tr data-section="'+section+'" data-entry="'+escape(article.id)+'"><th scope="row">'+
        linkTo(article.id, title)+(excerpt ? '<small>'+escape(excerpt)+'</small>' : '')+
        '</th><td>'+escape(sectionName)+'</td></tr>';
    }).join('');
    return '<table class="mechanics-index" aria-label="Mechanics articles"><thead><tr>'+
      '<th scope="col" data-sort="title">Article</th><th scope="col" data-sort="section" aria-sort="ascending">Section</th>'+
      '</tr></thead><tbody>'+body+'</tbody></table>';
  }

  function enableSorting(table, initialOrder, onChange) {
    const body = table.tBodies[0];
    const rows = Array.from(body.rows, row => ({
      row, title:row.cells[0].querySelector('a').textContent, section:Number(row.dataset.section)
    }));
    DQMSortableIndex.enable(table, initialOrder, (key, descending) => {
      body.append(...sorted(rows, key, descending).map(item => item.row));
    }, onChange);
  }

  globalThis.DQMMechanicsIndex = {render, enableSorting,handbook,topics,topicFor};
  const published = globalThis.document?.querySelector('#mechanics .mechanics-index');
  if (published) enableSorting(published);
})();

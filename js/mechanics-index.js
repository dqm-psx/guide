/* The interactive guide and the standalone index use the same Mechanics table. */
(() => {
  'use strict';
  const sections = ['both', 'dqm1', 'dqm2'];
  const alphabetical = new Intl.Collator('en', {sensitivity:'base', numeric:true});

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

  globalThis.DQMMechanicsIndex = {render, enableSorting};
  const published = globalThis.document?.querySelector('#mechanics .mechanics-index');
  if (published) enableSorting(published);
})();

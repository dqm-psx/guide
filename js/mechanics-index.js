/* The interactive guide and the standalone index use the same Mechanics table. */
(() => {
  'use strict';
  const sections = ['both', 'dqm1', 'dqm2'];
  const alphabetical = new Intl.Collator('en', {sensitivity:'base', numeric:true});
  const orders = ['section', '-section', 'title', '-title'];

  function sorted(rows, order) {
    return rows.sort((a,b) => {
      const byTitle = alphabetical.compare(a.title, b.title);
      if (order === 'title') return byTitle;
      if (order === '-title') return -byTitle;
      return (order === '-section' ? b.section - a.section : a.section - b.section) || byTitle;
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
    const headers = Array.from(table.tHead.rows[0].cells);
    const rows = Array.from(body.rows, row => ({
      row, title:row.cells[0].querySelector('a').textContent, section:Number(row.dataset.section)
    }));
    let order = orders.includes(initialOrder) ? initialOrder : 'section';
    function update() {
      const column = order.replace('-', '');
      const descending = order.startsWith('-');
      body.append(...sorted(rows, order).map(item => item.row));
      for (const head of headers) {
        const active = head.dataset.sort === column;
        if (active) head.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
        else head.removeAttribute('aria-sort');
        head.querySelector('span').textContent = active ? (descending ? '↓' : '↑') : '↕';
      }
    }
    for (const head of headers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = head.textContent;
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      button.append(' ', arrow);
      button.onclick = () => {
        order = order === head.dataset.sort ? '-'+head.dataset.sort : head.dataset.sort;
        update();
        onChange?.(order);
      };
      head.replaceChildren(button);
    }
    update();
  }

  globalThis.DQMMechanicsIndex = {render, enableSorting};
  const published = globalThis.document?.querySelector('#mechanics .mechanics-index');
  if (published) enableSorting(published);
})();

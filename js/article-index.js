/* Shared article catalogue for the guide and its standalone HTML index. */
(() => {
  'use strict';
  const sectionOrder = ['both', 'dqm1', 'dqm2'];
  const alphabetical = new Intl.Collator('en', {sensitivity:'base', numeric:true});

  function render(articles, {games, titleFor, linkTo, escape}) {
    const rows = articles.map(article => {
      const title = titleFor(article);
      const section = article.game === 'both' ? 'General' : games[article.game];
      return {article, title, section};
    }).sort((a,b) => alphabetical.compare(a.title, b.title));
    const body = rows.map(({article, title, section}) =>
      '<tr data-game="'+escape(article.game)+'" data-entry="'+escape(article.id)+'"><th scope="row">'+
      linkTo(article.id, title)+'</th><td>'+escape(section)+'</td></tr>').join('');
    return '<table class="article-index" aria-label="Gameplay articles"><thead><tr>'+
      '<th scope="col" data-column="title">Article</th><th scope="col" data-column="section">Section</th>'+
      '</tr></thead><tbody>'+body+'</tbody></table>';
  }

  // Keep the headers as plain text when JavaScript is disabled; the generated
  // table already lists every article alphabetically in that case.
  function enableSorting(table, initialSort, onChange) {
    const body = table.tBodies[0];
    const headers = Array.from(table.tHead.rows[0].cells);
    let current = ['title', '-title', 'section', '-section'].includes(initialSort) ? initialSort : 'title';

    function update() {
      const column = current.replace('-', '');
      const descending = current.startsWith('-');
      const rows = Array.from(body.rows).sort((a,b) => {
        const titleOrder = alphabetical.compare(a.cells[0].textContent, b.cells[0].textContent);
        if (column === 'title') return descending ? -titleOrder : titleOrder;
        const bySection = sectionOrder.indexOf(a.dataset.game) - sectionOrder.indexOf(b.dataset.game);
        return (descending ? -bySection : bySection) || titleOrder;
      });
      body.append(...rows);
      for (const head of headers) {
        const active = head.dataset.column === column;
        if (active) head.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
        else head.removeAttribute('aria-sort');
        head.querySelector('.sort-arrow').textContent = active ? (descending ? '↓' : '↑') : '↕';
      }
    }

    for (const head of headers) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = head.textContent;
      const arrow = document.createElement('span');
      arrow.className = 'sort-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      button.append(' ', arrow);
      button.onclick = () => {
        current = current === head.dataset.column ? '-'+head.dataset.column : head.dataset.column;
        update();
        onChange?.(current);
      };
      head.replaceChildren(button);
    }
    update();
  }

  globalThis.DQMArticleIndex = {render, enableSorting};
  const published = globalThis.document?.querySelector('#published-articles .article-index');
  if (published) enableSorting(published, 'title');
})();

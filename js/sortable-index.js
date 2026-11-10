/* Header controls shared by the interactive and standalone reference tables. */
(() => {
  'use strict';
  function enable(table, initialOrder, sortRows, onChange) {
    const headers = Array.from(table.tHead.rows[0].cells);
    const defaultKey = headers.find(head => head.hasAttribute('aria-sort')).dataset.sort;
    const valid = headers.some(({dataset}) => initialOrder === dataset.sort || initialOrder === '-'+dataset.sort);
    let order = valid ? initialOrder : defaultKey;
    function update() {
      const descending = order.startsWith('-');
      const key = descending ? order.slice(1) : order;
      sortRows(key, descending);
      for (const head of headers) {
        const active = head.dataset.sort === key;
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
  globalThis.DQMSortableIndex = {enable};
})();

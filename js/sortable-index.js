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
  const alphabetical = new Intl.Collator('en', {sensitivity:'base', numeric:true});
  function compare(a, b, numeric, descending) {
    // Unrecorded values and variable costs follow fixed values in either direction.
    if (a == null || b == null) return Number(a == null) - Number(b == null);
    const direction = descending ? -1 : 1;
    if (numeric) {
      const left = Number(a), right = Number(b);
      if (Number.isFinite(left) && Number.isFinite(right)) return direction * (left - right);
      if (Number.isFinite(left)) return -1;
      if (Number.isFinite(right)) return 1;
    }
    return direction * alphabetical.compare(a,b);
  }
  function enableRows(table, initialOrder, onChange) {
    const body = table.tBodies[0];
    const headers = Array.from(table.tHead.rows[0].cells);
    const columns = new Map(headers.map(head => [head.dataset.sort, head]));
    const rows = Array.from(body.rows, row => {
      const values = {};
      for (const head of headers) {
        const cell = row.cells[head.cellIndex];
        values[head.dataset.sort] = cell.hasAttribute('data-missing') ? null :
          cell.dataset.sortValue ?? cell.textContent.trim();
      }
      return {row, values};
    });
    enable(table, initialOrder, (key, descending) => {
      const numeric = columns.get(key).hasAttribute('data-numeric');
      rows.sort((a,b) => compare(a.values[key],b.values[key],numeric,descending) ||
        alphabetical.compare(a.values.name,b.values.name) ||
        alphabetical.compare(a.row.dataset.entry,b.row.dataset.entry));
      body.append(...rows.map(entry => entry.row));
    }, order => {
      table.parentElement.scrollTop = 0;
      onChange?.(order);
    });
  }
  globalThis.DQMSortableIndex = {enable, enableRows, alphabetical};
})();

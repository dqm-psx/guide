/* The same rows and skill links serve the guide and its standalone HTML index. */
(() => {
  'use strict';
  const columns = [
    ['name', 'Skill name'], ['description', 'In-game description'], ['effect', 'Effect'],
    ['type', 'Type'], ['mpCost', 'MP cost'], ['target', 'Target']
  ];
  const alphabetical = new Intl.Collator('en', {sensitivity:'base', numeric:true});

  function render(skills, {escape, linkTo}) {
    const headers = columns.map(([key,label]) =>
      '<th scope="col" data-sort="'+key+'"'+(key === 'name' ? ' aria-sort="ascending"' : '')+'>'+label+'</th>');
    const body = [...skills].sort((a,b) => alphabetical.compare(a.name,b.name) ||
      alphabetical.compare(a.id,b.id)).map(skill => {
      const cells = columns.map(([key]) => {
        if (key === 'name') return '<th scope="row">'+linkTo(skill.id,skill.name)+'</th>';
        if (skill[key] == null || skill[key] === '') return '<td data-missing>—</td>';
        return '<td>'+escape(skill[key])+'</td>';
      });
      return '<tr data-entry="'+escape(skill.id)+'">'+cells.join('')+'</tr>';
    });
    return '<div class="skill-index-panel"><p class="skill-scroll-hint">Scroll sideways to see all columns.</p>'+
      '<div class="skill-index-scroll" tabindex="0" role="region" aria-label="Scrollable skill list">'+
      '<table class="skill-index" aria-label="Skills" aria-describedby="skill-range-note"><thead><tr>'+headers.join('')+'</tr></thead><tbody>'+
      body.join('')+'</tbody></table></div>'+
      '<p id="skill-range-note" class="skill-index-note">Base damage ranges are for your monsters, before resistance and other modifiers.</p></div>';
  }

  function compare(a, b, key, descending) {
    // Keep unrecorded fields last whichever direction the reader chooses.
    if (a == null || b == null) return Number(a == null) - Number(b == null);
    const direction = descending ? -1 : 1;
    if (key === 'mpCost') {
      // "All remaining MP" is a variable cost and follows all fixed costs.
      const left = Number(a), right = Number(b);
      if (Number.isFinite(left) && Number.isFinite(right)) return direction * (left - right);
      if (Number.isFinite(left)) return -1;
      if (Number.isFinite(right)) return 1;
    }
    return direction * alphabetical.compare(a,b);
  }

  function enableSorting(table, initialOrder, onChange) {
    const body = table.tBodies[0];
    const rows = Array.from(body.rows, row => {
      const values = {};
      columns.forEach(([key], i) => {
        const cell = row.cells[i];
        values[key] = cell.hasAttribute('data-missing') ? null : cell.textContent.trim();
      });
      return {row, values};
    });
    DQMSortableIndex.enable(table, initialOrder, (key, descending) => {
      rows.sort((a,b) => compare(a.values[key], b.values[key], key, descending) ||
        alphabetical.compare(a.values.name, b.values.name) ||
        alphabetical.compare(a.row.dataset.entry, b.row.dataset.entry));
      body.append(...rows.map(entry => entry.row));
    }, order => {
      table.parentElement.scrollTop = 0;
      onChange?.(order);
    });
  }

  globalThis.DQMSkillIndex = {render, enableSorting};
  const published = globalThis.document?.querySelector('#skills .skill-index');
  if (published) enableSorting(published);
})();

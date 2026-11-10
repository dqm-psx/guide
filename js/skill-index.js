/* The same rows and skill links serve the guide and its standalone HTML index. */
(() => {
  'use strict';
  const columns = [
    ['name', 'Skill name'], ['description', 'In-game description'], ['effect', 'Effect'],
    ['type', 'Type'], ['mpCost', 'MP cost'], ['target', 'Target']
  ];
  const {alphabetical, enableRows} = DQMSortableIndex;

  function render(skills, {escape, linkTo}) {
    const headers = columns.map(([key,label]) =>
      '<th scope="col" data-sort="'+key+'"'+(key === 'name' ? ' aria-sort="ascending"' : '')+
      (key === 'mpCost' ? ' data-numeric' : '')+'>'+label+'</th>');
    const body = [...skills].sort((a,b) => alphabetical.compare(a.name,b.name) ||
      alphabetical.compare(a.id,b.id)).map(skill => {
      const cells = columns.map(([key]) => {
        if (key === 'name') return '<th scope="row">'+linkTo(skill.id,skill.name)+'</th>';
        if (skill[key] == null || skill[key] === '') return '<td data-missing>—</td>';
        return '<td>'+escape(skill[key])+'</td>';
      });
      return '<tr data-entry="'+escape(skill.id)+'">'+cells.join('')+'</tr>';
    });
    return '<div class="reference-table-panel"><p class="table-scroll-hint">Scroll sideways to see all columns.</p>'+
      '<div class="reference-table-scroll" tabindex="0" role="region" aria-label="Scrollable skill list">'+
      '<table class="reference-table skill-index" aria-label="Skills" aria-describedby="skill-range-note"><thead><tr>'+headers.join('')+'</tr></thead><tbody>'+
      body.join('')+'</tbody></table></div>'+
      '<p id="skill-range-note" class="reference-table-note">Base damage ranges are for your monsters, before resistance and other modifiers.</p></div>';
  }

  globalThis.DQMSkillIndex = {render, enableSorting:enableRows};
  const published = globalThis.document?.querySelector('#skills .skill-index');
  if (published) enableRows(published);
})();

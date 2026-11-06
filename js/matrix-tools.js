/* Keep a matrix readable while tracing a row and column; keyboard movement
   follows the same two axes without introducing hundreds of new shortcuts. */
(() => {
  'use strict';
  for (const grid of document.querySelectorAll('.planner-grid')) {
    function highlight(cell) {
      grid.querySelectorAll('.planner-crosshair').forEach(el => el.classList.remove('planner-crosshair'));
      if (!cell) return;
      const table = cell.closest('table.planner-matrix');
      if (!table) return;
      const column = cell.cellIndex;
      Array.from(cell.parentElement.children).forEach(el => el.classList.add('planner-crosshair'));
      Array.from(table.rows).forEach(row => row.cells[column]?.classList.add('planner-crosshair'));
    }
    grid.addEventListener('pointerover', e => highlight(e.target.closest('td')));
    grid.addEventListener('pointerleave', () => highlight(grid.contains(document.activeElement) ? document.activeElement.closest('td') : null));
    grid.addEventListener('focusin', e => highlight(e.target.closest('td')));
    grid.addEventListener('keydown', e => {
      const button = e.target.closest('button.planner-cell');
      if (!button || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
      const cell = button.closest('td'), row = cell.parentElement, table = cell.closest('table');
      let rowIndex = row.rowIndex, column = cell.cellIndex;
      if (e.key === 'ArrowLeft') column--;
      if (e.key === 'ArrowRight') column++;
      if (e.key === 'ArrowUp') rowIndex--;
      if (e.key === 'ArrowDown') rowIndex++;
      if (e.key === 'Home') column = 1;
      if (e.key === 'End') column = row.cells.length - 1;
      const target = table.rows[rowIndex]?.cells[column]?.querySelector('button.planner-cell');
      e.preventDefault();
      if (target) target.focus({preventScroll:false});
    });
  }
})();

/* En celulares las tablas se muestran como fichas: cada celda lleva el nombre de su columna */
(function () {
  const SKIP = '.perm-grid, .subtbl, .sched, .pmatrix, .no-rt';
  const label = () => {
    document.querySelectorAll('table.tbl, .tw > table').forEach(t => {
      if (t.matches(SKIP)) return;
      const heads = [...t.querySelectorAll('thead th')].map(th => th.innerText.trim());
      if (!heads.length) return;
      t.classList.add('rt');
      t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { if (!td.hasAttribute('data-label')) td.setAttribute('data-label', td.hasAttribute('colspan') ? '' : (heads[i] || '')); }));
    });
  };
  let q = 0; new MutationObserver(() => { if (!q) q = requestAnimationFrame(() => { q = 0; label(); }); }).observe(document.body, { childList: true, subtree: true });
  label();
})();

/* Ordered classic scripts keep the downloaded guide usable from file://.
   All scripts in a group download together but execute in dependency order. */
(() => {
  'use strict';
  const groups = JSON.parse(document.getElementById('guide-assets').textContent);
  const loaded = new Set(), pending = new Map();
  function script(url) {
    if (loaded.has(url)) return;
    if (pending.has(url)) return pending.get(url);
    const task = new Promise((resolve,reject) => {
      const node = document.createElement('script');
      node.async = false;
      node.src = url;
      node.onload = () => { loaded.add(url); pending.delete(url); resolve(); };
      node.onerror = () => { pending.delete(url); node.remove(); reject(new Error('Unable to open '+url.split('?')[0])); };
      document.head.append(node);
    });
    pending.set(url,task);
    return task;
  }
  function ready(view, hash) {
    const route = new URLSearchParams(String(hash || '').split('?')[1] || '');
    const home = view === 'field-guide' && !['entry','game','q','kind'].some(key => route.get(key));
    if (home) return null;
    const group = view === 'field-guide' || view === 'atlas' ? [...groups.field] : [...groups.tools];
    if (view === 'field-guide' && /^(npc|boss)-/.test(route.get('entry') || '')) group.push(...groups.dialogue);
    if (view === 'monster' || view === 'sources') group.unshift(groups.profile[0]);
    if (view === 'monster') group.push(groups.profile[1]);
    if (view === 'breeding-tree' || view === 'team-planner') group.push(...groups.tree);
    if (view === 'breeding-table' || view === 'team-planner') group.push(...groups.matrix);
    const files = [...groups.shared, ...group].filter(url => !loaded.has(url));
    return files.length ? Promise.all(files.map(script)) : null;
  }
  window.DQMAssets = Object.freeze({ready});
})();

/* Visible names shared by guide profiles, maps and standalone pages. */
(() => {
  'use strict';
  const editions = {gameboy:'Game Boy-style patch', delocalized:'Delocalized patch', vibecoded:'Vibecoded patch'};
  const japanese = row => row.names?.japanese || row.japanese;
  const keyFor = name => String(name || '').normalize('NFKC').replace(/[’‘]/g,"'").trim();
  function aliasesMarkup(row, {escape, translations} = {}) {
    const names = row.names || {};
    const title = row.title || row.display_name || row.name;
    const aliases = new Map();
    const add = (name, source) => {
      const key = keyFor(name);
      if (!key || key === keyFor(title) || key === keyFor(japanese(row))) return;
      if (!aliases.has(key)) aliases.set(key, {name, sources:new Set()});
      if (source) aliases.get(key).sources.add(source);
    };
    add(names.current || row.current_name);
    add(names.short || row.short_name, 'Current menu');
    for (const [key, forms] of Object.entries(names.editions || {})) {
      const edition = editions[key] || key;
      add(forms.full, edition);
      if (forms.short !== forms.full) add(forms.short, edition+' menu');
    }
    // Article aliases also contain search questions and keywords. For these
    // entries, only the translation snapshot establishes alternate names.
    const narrative = !row.names && ['mechanic','quest','story','tool'].includes(row.kind);
    const recorded = narrative ? translations?.entries?.[row.id]?.aliases : row.aliases;
    for (const alias of recorded || []) add(alias);
    if (!aliases.size) return '';
    return '<div class="monster-aliases"><span>Also known as</span> '+
      Array.from(aliases.values(), ({name, sources}) => '<span class="monster-alias"'+
        (sources.size ? ' title="'+escape([...sources].join(' · '))+'"' : '')+'>'+escape(name)+'</span>').join(' ')+'</div>';
  }
  function markup(row, options) {
    const name = japanese(row);
    return (name ? '<p class="monster-japanese" lang="ja">'+options.escape(name)+'</p>' : '')+aliasesMarkup(row, options);
  }
  globalThis.DQMEntryNames = {markup, aliasesMarkup};
})();

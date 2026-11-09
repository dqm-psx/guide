(() => {
  const panel = document.getElementById('guide-settings');
  const summary = panel.querySelector('summary');
  const spoilers = document.getElementById('guide-spoilers');
  const extras = document.getElementById('show-internal');
  const styleKey = 'dqm-guide-sprite-style-v1';
  const pendingKey = 'dqm-guide-pending-sprite';
  const sessionKey = 'dqm-guide-reference-session-v1';
  const storyKey = 'dqm-guide-story-spoilers';
  function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function write(key, value) { try { localStorage.setItem(key, value); } catch {} }
  function syncStyle(style) {
    panel.querySelectorAll('[data-sprite-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spriteStyle===style)));
  }
  function savedSession() { try { return JSON.parse(read(sessionKey)) || {}; } catch { return {}; } }
  extras.checked = savedSession().showInternal === true;
  spoilers.checked = read(storyKey) !== 'hide';
  syncStyle(read(styleKey) || 'portrait');
  const libraryExtras = document.getElementById('library-extra-slots');
  libraryExtras.checked = extras.checked;
  libraryExtras.addEventListener('change', () => {
    extras.checked = libraryExtras.checked;
    extras.dispatchEvent(new Event('change',{bubbles:true}));
  });
  extras.addEventListener('change', () => {
    libraryExtras.checked = extras.checked;
    if (!window.DQMApp) write(sessionKey, JSON.stringify({...savedSession(), version:1, showInternal:extras.checked}));
  });
  spoilers.addEventListener('change', () => {
    write(storyKey,spoilers.checked ? 'show' : 'hide');
    window.DQMField?.setSpoilers(spoilers.checked);
  });
  panel.addEventListener('click', e => {
    const style = e.target.closest('[data-sprite-style]')?.dataset.spriteStyle;
    if (!style || window.DQMApp) return;
    write(styleKey,style);
    write(pendingKey,style);
    syncStyle(style);
  });
  function dismiss() { panel.open = false; }
  document.addEventListener('click', e => {
    if (!panel.contains(e.target)) dismiss();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && panel.open) { dismiss(); summary.focus(); }
  });
  window.addEventListener('hashchange', dismiss);
  function shareLink() {
    const link = document.getElementById('entry-permalink');
    if (!link) return;
    const [view, query] = (window.DQMEntryHash?.() || location.hash).slice(1).split('?');
    const params = new URLSearchParams(query || '');
    let path = '';
    if (view==='monster' && /^\d+$/.test(params.get('id') || '')) path='monsters/'+params.get('id')+'/';
    if (view==='atlas' && /^map-\d+-\d+$/.test(params.get('map') || '')) {
      const row=window.PLAYER_ATLAS?.maps.find(m=>m.id===params.get('map'));
      if (row) path='places/'+(row.placeId || row.id)+'/';
    }
    const entry=params.get('entry');
    if (view==='field-guide' && /^[\w-]+$/.test(entry || '')) path=entry.startsWith('skill-') ? 'skills/'+entry.slice(6)+'/' : 'articles/'+entry+'/';
    link.hidden=!path;
    if (path) link.href=new URL(path,document.baseURI).href;
  }
  window.addEventListener('guide-view-rendered',shareLink);
  window.addEventListener('hashchange',shareLink);
  shareLink();
})();

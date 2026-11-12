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
  const share = document.getElementById('entry-share');
  const status = document.getElementById('entry-copy-status');
  const input = document.getElementById('entry-copy-url');
  let entryURL = '';
  function shareLink() {
    const [view, query] = (window.DQMEntryHash?.() || location.hash).slice(1).split('?');
    const params = new URLSearchParams(query || '');
    let path = '';
    if (view==='monster' && /^\d+$/.test(params.get('id') || '')) path='monsters/'+params.get('id')+'/';
    if (view==='atlas' && params.get('tab')==='encounters' && /^(?:terry|cobi|tara)-\d+$/.test(params.get('area') || '')) {
      path='index.html#atlas?tab=encounters&area='+params.get('area');
    } else if (view==='atlas' && /^map-\d+-\d+$/.test(params.get('map') || '')) {
      const row=window.PLAYER_ATLAS?.maps.find(m=>m.id===params.get('map'));
      if (row) {
        const place=row.placeId || row.id;
        const variant=params.get('variant');
        path=place===row.id && !variant ? 'places/'+place+'/' : 'index.html#atlas?map='+row.id+
          (variant ? '&variant='+encodeURIComponent(variant) : '');
      }
    }
    const entry=params.get('entry');
    if (view==='field-guide' && /^[\w-]+$/.test(entry || '')) path=entry.startsWith('skill-') ? 'skills/'+entry.slice(6)+'/' : 'articles/'+entry+'/';
    if (view==='field-guide' && entry?.startsWith('location-')) {
      const map=window.PLAYER_ATLAS?.maps.find(row=>row.id===params.get('map'));
      const belongs=map && window.DQMAtlas?.context.mapsForLocation(entry).some(row=>row.id===(map.placeId || map.id));
      if (belongs) {
        const selection=new URLSearchParams({entry,map:map.id});
        if (map.arrivalVariants?.some(row=>row.id===params.get('variant'))) selection.set('variant',params.get('variant'));
        if (params.get('section')==='encounters') selection.set('section','encounters');
        path+='#field-guide?'+selection;
      } else if (params.get('section')==='encounters') path+='#location-encounters';
    }
    if (view==='field-guide') path=window.DQMField?.walkthroughPath?.(params) || path;
    const section=params.get('section');
    if (view==='field-guide' && path && /^[\w-]+$/.test(section || '') &&
        document.getElementById('article-section-'+section)) path+='#article-section-'+section;
    // The published edition has standalone entries. A local development server
    // serves the hash router, and a downloaded file needs a public URL to share.
    const published = document.querySelector('.footer-links a[href="entries/"]');
    let url = '';
    if (path) {
      if (location.protocol === 'file:') url = new URL(path, 'https://dqm-psx.github.io/guide/').href;
      else if (published) url = new URL(path, document.baseURI).href;
      else url = location.href;
    }
    if (url !== entryURL) {
      entryURL = url;
      status.textContent = '';
      input.hidden = true;
      input.value = '';
    }
    share.hidden = !url;
  }
  document.getElementById('entry-permalink').addEventListener('click', async () => {
    shareLink();
    const url = entryURL;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      if (url !== entryURL) return;
      input.hidden = true;
      status.textContent = 'Entry link copied.';
    } catch {
      if (url !== entryURL) return;
      status.textContent = 'Copy the selected link.';
      input.value = url;
      input.hidden = false;
      input.focus();
      input.select();
    }
  });
  window.addEventListener('guide-view-rendered',shareLink);
  window.addEventListener('hashchange',shareLink);
  shareLink();
})();

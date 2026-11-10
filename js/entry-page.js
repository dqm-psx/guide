/* Published entries already contain their text and links. Enhance them with
   the interactive guide when its shell is available at the same origin. */
(() => {
  const route = document.currentScript.dataset.route;
  const originalPath = location.pathname;
  if (!route || !/^https?:$/.test(location.protocol)) return;
  window.DQMEntryHash = () => {
    if (location.pathname === originalPath && route.startsWith('#atlas?map=') &&
        /^#map-\d+-\d+$/.test(location.hash)) return '#atlas?map='+location.hash.slice(1);
    if (location.pathname === originalPath && route.startsWith('#field-guide?entry=location-') &&
        location.hash === '#location-encounters') return route+'&section=encounters';
    if (location.pathname === originalPath && route.startsWith('#field-guide?kind=story&game=') &&
        /^#story-[\w-]+$/.test(location.hash)) {
      return route+'&entry='+location.hash.slice(1);
    }
    return location.hash || (location.pathname === originalPath ? route : '');
  };
  async function enhance() {
    const response = await fetch(new URL('index.html',document.baseURI));
    if (!response.ok) return;
    const doc = new DOMParser().parseFromString(await response.text(),'text/html');
    if (!doc.querySelector('#guide-assets')) return;
    const previous = Array.from(document.body.childNodes);
    const originalTitle = document.title;
    const styles = [...doc.querySelectorAll('link[rel=stylesheet]')].map(link=>{
      const style = document.importNode(link,true);
      document.head.append(style);
      return style;
    });
    const sourceScripts = [...doc.body.querySelectorAll('script[src]')];
    sourceScripts.forEach(script=>script.remove());
    document.body.replaceChildren(...Array.from(doc.body.childNodes,node=>document.importNode(node,true)));
    const entryStyle = document.querySelector('link[href*="entry-page.css"]');
    entryStyle.disabled=true;
    try {
      for (const source of sourceScripts) {
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');
          script.onload=resolve;
          script.onerror=reject;
          script.src=source.getAttribute('src');
          document.body.append(script);
        });
      }
      // Route-specific data can fail after the shell scripts have parsed.
      await window.DQMAssets.ready(window.DQMViews.viewFor(route),route);
      if (document.getElementById('view-load-status')) throw Error('Entry data unavailable');
    } catch {
      document.title = originalTitle;
      styles.forEach(link=>link.remove());
      entryStyle.disabled=false;
      document.body.replaceChildren(...previous);
    }
  }
  enhance().catch(()=>{ /* The complete static reference remains available. */ });
})();

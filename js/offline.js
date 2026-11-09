/* DQM-guide offline installer.

   Registers the service worker that lets a saved or installed copy start
   without a network. The page itself already runs offline once loaded; this
   file adds a real cache so the first load of a later visit can be offline too.

   Every step is guarded: file://, private modes, and browsers without service
   workers page on exactly as before, with no console noise and no thrown
   error. There are no imports and nothing here throws. */
(function (root) {
  "use strict";

  function canRegister() {
    try {
      if (!root.navigator || !("serviceWorker" in root.navigator)) return false;
      var protocol = root.location && root.location.protocol;
      // Service workers need a secure context; file: is excluded on purpose
      // because the page must keep working when opened straight from disk.
      return protocol === "http:" || protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function register() {
    try {
      // Relative to the page, so an install under a subpath scopes to that
      // subpath instead of the whole origin.
      var registration = root.navigator.serviceWorker.register(new URL("sw.js", document.baseURI), { scope: new URL("./",document.baseURI).href });
      if (registration && typeof registration.catch === "function") {
        registration.catch(function () {
          // Offline support is an enhancement; a failure must not affect the
          // page, so the rejection is swallowed on purpose.
        });
      }
    } catch (error) {
      // Some browsers throw synchronously when calls are blocked by settings.
    }
  }

  if (!canRegister()) return;

  const serviceWorker = root.navigator.serviceWorker;
  const button = document.getElementById('download-offline');
  const status = document.getElementById('offline-status');
  const seen = new Set();
  function warm(urls) {
    const controller = serviceWorker.controller;
    if (!controller) return;
    const added = urls.filter(url => !seen.has(url));
    if (added.length) {
      added.forEach(url=>seen.add(url));
      controller.postMessage({type:'warm',urls:added});
    }
  }
  function warmVisited() { warm(performance.getEntriesByType('resource').map(entry=>entry.name)); }
  if (typeof PerformanceObserver !== 'undefined') {
    new PerformanceObserver(list=>warm(list.getEntries().map(entry=>entry.name))).observe({entryTypes:['resource']});
  }
  function request(type) {
    return new Promise((resolve,reject)=>{
      const channel = new MessageChannel();
      const worker = serviceWorker.controller;
      if (!worker) return reject(Error('No active worker'));
      channel.port1.onmessage = e=>{ channel.port1.close(); e.data.error ? reject(Error()) : resolve(e.data); };
      worker.postMessage({type},[channel.port2]);
    });
  }
  function ready() {
    if (!serviceWorker.controller) return;
    seen.clear();
    warmVisited();
    if (!button) return;
    button.hidden=false;
    request('status').then(({complete})=>{
      if (complete) { button.disabled=true; button.textContent='Offline guide downloaded'; }
    }).catch(()=>{});
  }
  serviceWorker.addEventListener('controllerchange',ready);
  ready();
  button?.addEventListener('click',async()=>{
    button.disabled=true;
    status.textContent='Downloading guide tools and maps…';
    try {
      await request('download');
      status.textContent='Ready to use offline.';
      button.textContent='Offline guide downloaded';
    } catch {
      status.textContent='Download interrupted. Reconnect and try again.';
      button.disabled=false;
    }
  });

  // Wait for load so registration never competes with the page's own assets.
  if (root.document && root.document.readyState === "complete") register();
  else root.addEventListener("load", register, { once: true });
})(globalThis);

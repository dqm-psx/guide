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
      var registration = root.navigator.serviceWorker.register("sw.js", { scope: "./" });
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

  // Wait for load so registration never competes with the page's own assets.
  if (root.document && root.document.readyState === "complete") register();
  else root.addEventListener("load", register, { once: true });
})(globalThis);

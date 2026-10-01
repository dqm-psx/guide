/* DQM-guide storage adapter: the only module that touches localStorage or window.
   Every operation is defensive: reads, writes, removes, and availability probes
   never throw, so a failed storage call can never destroy the session state. */
(function (root) {
  'use strict';

  const PROBE_KEY = 'dqm-guide-storage-probe';

  function create(options = {}) {
    // Reading the localStorage property itself can throw (a SecurityError when
    // the document is denied storage access), so acquire it defensively. A
    // missing adapter leaves the session usable but unsaved, as documented.
    let storage = options.storage;
    if (storage === undefined) {
      try {
        storage = root.localStorage;
      } catch {
        storage = null;
      }
    }
    const eventTarget = options.eventTarget !== undefined ? options.eventTarget : root.window;

    function available() {
      try {
        if (!storage || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
          return false;
        }
        storage.setItem(PROBE_KEY, '1');
        storage.removeItem(PROBE_KEY);
        return true;
      } catch {
        return false;
      }
    }

    function read(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    }

    function write(key, value) {
      try {
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }

    function remove(key) {
      try {
        storage.removeItem(key);
      } catch {
        // Removal is best-effort; never throw.
      }
    }

    function subscribe(key, callback) {
      if (!eventTarget || typeof eventTarget.addEventListener !== 'function') {
        return function () {};
      }
      const listener = event => {
        if (event.key !== key) return;
        callback(event.newValue);
      };
      eventTarget.addEventListener('storage', listener);
      return function unsubscribe() {
        if (eventTarget && typeof eventTarget.removeEventListener === 'function') {
          eventTarget.removeEventListener('storage', listener);
        }
      };
    }

    return Object.freeze({ available, read, write, remove, subscribe });
  }

  root.DQMStorage = Object.freeze({ create });
})(globalThis);

const path = require('node:path');
const { startServer } = require('./serve');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');

let server = null;
let serverUrl = null;
let starting = null;
let refs = 0;

// The server is shared by every spec file in a worker, and files interleave
// when tests run in parallel, so closing is reference counted: the server
// shuts down only after the last user stops. Concurrent first starts reuse
// one in-flight start.
async function startGuideServer() {
  if (server) {
    refs += 1;
    return serverUrl;
  }
  if (!starting) {
    starting = startServer({ root: REPO_ROOT }).then(started => {
      server = started.server;
      serverUrl = started.baseURL + 'index.html';
      starting = null;
      return serverUrl;
    });
  }
  await starting;
  refs += 1;
  return serverUrl;
}

async function stopGuideServer() {
  refs -= 1;
  if (refs <= 0 && server && !starting) {
    refs = 0;
    const closing = server;
    server = null;
    serverUrl = null;
    await new Promise(resolve => closing.close(resolve));
  }
}

/**
 * The served mode the browser suite runs against: a static server mounted at
 * /guide/ so asset paths are exercised the way GitHub Pages mounts the page.
 * Spec files load these lifecycle functions with a dynamic import in
 * beforeAll/afterAll: a static relative require from a test file trips a
 * Node 23 + Playwright 1.61 incompatibility in the synchronous ESM resolve
 * hooks. The file:// contract is pinned by tests/browser/file-mode.spec.js.
 */
module.exports = { REPO_ROOT, FILE_URL, startGuideServer, stopGuideServer };

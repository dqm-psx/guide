const path = require('node:path');
const { startServer } = require('./serve');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');

let server = null;
let serverUrl = null;

async function startGuideServer() {
  if (!server) {
    const started = await startServer({ root: REPO_ROOT });
    server = started.server;
    serverUrl = started.baseURL + 'index.html';
  }
  return serverUrl;
}

async function stopGuideServer() {
  if (server) {
    await new Promise(resolve => server.close(resolve));
    server = null;
    serverUrl = null;
  }
}

/**
 * The two ways the shipped page must work: opened directly from disk and
 * served from a static server under /guide/. Spec files define the mode
 * list locally (it is needed at collection time) and load these lifecycle
 * functions with a dynamic import in beforeAll/afterAll: a static relative
 * require from a test file trips a Node 23 + Playwright 1.61 incompatibility
 * in the synchronous ESM resolve hooks.
 */
module.exports = { REPO_ROOT, FILE_URL, startGuideServer, stopGuideServer };

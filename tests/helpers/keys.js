const path = require('node:path');
const { loadScripts } = require('./load-scripts');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function api(scriptPath, globalName) {
  return loadScripts([path.join(REPO_ROOT, scriptPath)])[globalName];
}

const appState = api('js/app-state.js', 'DQMAppState');
const theme = api('js/theme.js', 'DQMTheme');
const session = api('js/session.js', 'DQMSession');

const keys = {
  STATE_KEY: appState.STORAGE_KEY,
  LEGACY_TEAM_KEY: appState.LEGACY_TEAM_KEY,
  LEGACY_SPRITE_KEY: appState.LEGACY_SPRITE_KEY,
  THEME_KEY: theme.STORAGE_KEY,
  SESSION_KEY: session.KEY,
};

// localStorage keys must come from the app itself; a renamed key in the app
// should not strand test seeds against the new name. Fail fast, since an
// undefined key would otherwise seed a literal "undefined" localStorage key
// and let every read-back assertion pass vacuously.
for (const [name, value] of Object.entries(keys)) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`tests/helpers/keys.js: app no longer exports ${name}`);
  }
}

module.exports = keys;

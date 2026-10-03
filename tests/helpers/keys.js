const path = require('node:path');
const { loadScripts } = require('./load-scripts');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function api(scriptPath, globalName) {
  return loadScripts([path.join(REPO_ROOT, scriptPath)])[globalName];
}

const appState = api('js/app-state.js', 'DQMAppState');
const theme = api('js/theme.js', 'DQMTheme');
const session = api('js/session.js', 'DQMSession');

// localStorage keys must come from the app itself; a renamed key in the app
// should not strand test seeds against the new name.
module.exports = {
  STATE_KEY: appState.STORAGE_KEY,
  LEGACY_TEAM_KEY: appState.LEGACY_TEAM_KEY,
  LEGACY_SPRITE_KEY: appState.LEGACY_SPRITE_KEY,
  THEME_KEY: theme.STORAGE_KEY,
  SESSION_KEY: session.KEY,
};

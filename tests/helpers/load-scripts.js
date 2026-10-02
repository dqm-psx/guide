const vm = require('node:vm');
const fs = require('node:fs');

/**
 * Load classic scripts into a shared vm context so pure tests exercise the
 * exact shipped files. Later scripts see the globals assigned by earlier
 * ones, mirroring the <script src> load order in index.html.
 */
function loadScripts(files, extra = {}) {
  const context = vm.createContext({ console, ...extra });
  for (const file of files) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context;
}

module.exports = { loadScripts };

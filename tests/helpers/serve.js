const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/**
 * Tiny static file server over node:http. Serves `root` under the URL
 * prefix (default /guide/) so the page can be tested from a nested path,
 * like GitHub Pages would mount it. No dependencies.
 */
function startServer({ root, prefix = '/guide/', port = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith(prefix)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const relative = pathname.slice(prefix.length).replace(/^\/+/, '');
      const filePath = path.resolve(root, relative);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      fs.stat(filePath, (statErr, stat) => {
        const target = !statErr && stat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
        fs.readFile(target, (readErr, data) => {
          if (readErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
          }
          const type = CONTENT_TYPES[path.extname(target).toLowerCase()];
          if (!type) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': type });
          res.end(data);
        });
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port: actualPort } = server.address();
      resolve({ server, port: actualPort, baseURL: `http://127.0.0.1:${actualPort}${prefix}` });
    });
  });
}

module.exports = { startServer };

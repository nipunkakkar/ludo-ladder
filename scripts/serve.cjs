const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 5062);
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json' };
http.createServer((req, res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (_) { res.writeHead(400); res.end(); return; }
  const file = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (!file.startsWith(root + path.sep) || file.includes(path.sep + '.git' + path.sep) || file.includes(path.sep + 'node_modules' + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes);
  });
}).listen(port, '127.0.0.1', () => console.log(`Ludo Ladder: http://127.0.0.1:${port}/`));

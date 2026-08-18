const fs = require('fs');
const http = require('http');
const path = require('path');

const webRoot = path.resolve(__dirname, '..', 'www');
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gz': 'application/gzip',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
};

const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent((request.url || '/').split('?')[0]);
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.resolve(webRoot, `.${requested}`);

  if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`EstacionaScan disponible en http://localhost:${port}`);
  console.log('Presioná Ctrl+C para detener el servidor.');
});

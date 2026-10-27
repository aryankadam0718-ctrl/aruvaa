const http = require('http');
const fs   = require('fs');
const path = require('path');

const MIME = {
  '.html':'text/html','.js':'application/javascript','.css':'text/css',
  '.glb':'model/gltf-binary','.gltf':'model/gltf+json',
  '.mp4':'video/mp4',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.ico':'image/x-icon','.svg':'image/svg+xml','.json':'application/json',
  '.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf',
};

const PORT = 3000;
const ROOT = __dirname;

const MOBILE_UA = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i;

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/login.html';

  const ua       = req.headers['user-agent'] || '';
  const isMobile = MOBILE_UA.test(ua);
  const isWww    = url.startsWith('/www/');
  const isHtml   = url.endsWith('.html');

  // Mobile on root HTML → send to www/ version
  if (isMobile && !isWww && isHtml) {
    res.writeHead(302, { Location: '/www' + url });
    res.end();
    return;
  }

  // Desktop on www/ HTML → send to root version
  if (!isMobile && isWww && isHtml) {
    res.writeHead(302, { Location: url.slice(4) }); // remove /www
    res.end();
    return;
  }

  const filePath = path.join(ROOT, decodeURIComponent(url));
  fs.stat(filePath, (err, stat) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + url); return; }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const range = req.headers.range;

    // Video/audio scrubbing needs real byte-range support — without it
    // <video>.seekable stays stuck at [0,0] no matter how the file is encoded.
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end   = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, () => {
  console.log('\n  ARUVA Dev Server');
  console.log('  Web  → http://localhost:' + PORT + '/home.html');
  console.log('  Mob  → http://localhost:' + PORT + '/www/home.html  (or use Edge F12 mobile mode)\n');
});

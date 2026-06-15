const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DEST = path.join(__dirname, 'www');

// Files & folders to copy
const COPY = [
  'home.html','aruva.html','shop.html','product.html',
  'login.html','account.html','cart.html','checkout.html',
  'about.html','aruva-app.html','aruva-login.html','admin.html',
  'css','js','manifest.json','sw.js',
  'image.png','background 3.jpg','background 4.jpg','background 5.jpg',
  'ice hoodie new.jpg','ice hoodie.jpg','track baggy image.jpg',
];

// Create www folder
if (!fs.existsSync(DEST)) fs.mkdirSync(DEST);

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(f => copyRecursive(path.join(src, f), path.join(dest, f)));
  } else {
    fs.copyFileSync(src, dest);
  }
}

COPY.forEach(f => {
  copyRecursive(path.join(SRC, f), path.join(DEST, f));
  console.log('✓ Copied:', f);
});

// Create index.html redirect
fs.writeFileSync(path.join(DEST, 'index.html'),
  `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=home.html"></head></html>`
);

// Replace localhost:3000 with configurable server URL
const SERVER_URL = process.env.ARUVA_SERVER || 'http://192.168.0.106:3000';
const htmlFiles = fs.readdirSync(DEST).filter(f => f.endsWith('.html'));
htmlFiles.forEach(f => {
  const file = path.join(DEST, f);
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/http:\/\/localhost:3000/g, SERVER_URL);
  fs.writeFileSync(file, content);
});

// Same for JS files
const jsDir = path.join(DEST, 'js');
if (fs.existsSync(jsDir)) {
  fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).forEach(f => {
    const file = path.join(jsDir, f);
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/http:\/\/localhost:3000/g, SERVER_URL);
    fs.writeFileSync(file, content);
  });
}

console.log(`\n✅ App built! Server: ${SERVER_URL}`);
console.log('👉 Now run: npm run cap:sync');

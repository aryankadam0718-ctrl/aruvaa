// Generates ARUVA launcher icons — uses canvas to redraw the star/M mark accurately
// Run: node gen-icon.js
const {createCanvas, loadImage} = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZES = {
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi':  144,
  'mipmap-xxxhdpi': 192,
};
const RES = 'C:\\aruva\\app\\src\\main\\res';

// Source logo (white bg with dark mark — invert + set black bg)
const LOGO_SRC = 'C:\\aruva\\logo-src.png';

async function makeIcon(size) {
  const src = await loadImage(LOGO_SRC);
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');

  // Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  // Draw logo into an offscreen canvas to process pixels
  const tmp = createCanvas(src.width, src.height);
  const tx = tmp.getContext('2d');
  tx.drawImage(src, 0, 0);
  const img = tx.getImageData(0, 0, src.width, src.height);
  const d = img.data;

  // Invert: white bg+dark mark → black bg+white mark; ignore watermark alpha
  for (let i = 0; i < d.length; i += 4) {
    const brightness = (d[i] + d[i+1] + d[i+2]) / 3;
    // Dark pixels → white (the actual logo shape)
    const v = brightness < 160 ? 255 : 0;
    d[i] = d[i+1] = d[i+2] = v;
    // Suppress the faint grey watermark (very light grey → transparent)
    d[i+3] = brightness < 220 ? 255 : 0;
  }
  tx.putImageData(img, 0, 0);

  // Compute tight bounding box to crop out the white padding
  const raw = tx.getImageData(0, 0, src.width, src.height);
  let minX = src.width, maxX = 0, minY = src.height, maxY = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const a = raw.data[(y * src.width + x) * 4 + 3];
      if (a > 0) { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); }
    }
  }
  const pad = size * 0.12;
  const dw = maxX - minX + 1, dh = maxY - minY + 1;
  const scale = Math.min((size - pad*2) / dw, (size - pad*2) / dh);
  const dx = (size - dw * scale) / 2;
  const dy = (size - dh * scale) / 2;

  ctx.drawImage(tmp, minX, minY, dw, dh, dx, dy, dw * scale, dh * scale);
  return c;
}

(async () => {
  for (const [dir, size] of Object.entries(SIZES)) {
    const canvas = await makeIcon(size);
    const outDir = path.join(RES, dir);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(outDir, 'ic_launcher.png'), buf);
    fs.writeFileSync(path.join(outDir, 'ic_launcher_round.png'), buf);
    console.log(`Written ${size}x${size} → ${dir}`);
  }

  // Adaptive foreground (transparent bg, white mark)
  const fg = await makeIcon(192);
  fs.writeFileSync(path.join(RES, 'mipmap-xxhdpi', 'ic_launcher_foreground.png'), fg.toBuffer('image/png'));
  console.log('Done.');
})();

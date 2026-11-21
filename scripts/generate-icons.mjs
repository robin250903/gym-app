// Erzeugt die App-Icons (PNG) ohne externe Abhängigkeiten.
// Aufruf: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(OUT, { recursive: true });

const BG = [14, 16, 19];
const ACCENT = [184, 243, 74];

// Signed distance zu einem abgerundeten Rechteck (Mittelpunkt cx/cy, halbe Breite hw/hh, Radius r)
function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

// Hantel in normierten Koordinaten (0..1). scale < 1 lässt Rand für maskable Icons.
function dumbbell(x, y, scale) {
  const u = (x - 0.5) / scale + 0.5;
  const v = (y - 0.5) / scale + 0.5;
  const shapes = [
    [0.5, 0.5, 0.2, 0.035, 0.02], // Stange
    [0.27, 0.5, 0.045, 0.2, 0.03], // innere Scheiben
    [0.73, 0.5, 0.045, 0.2, 0.03],
    [0.18, 0.5, 0.035, 0.14, 0.025], // äußere Scheiben
    [0.82, 0.5, 0.035, 0.14, 0.025],
  ];
  let d = Infinity;
  for (const [cx, cy, hw, hh, r] of shapes) d = Math.min(d, sdRoundRect(u, v, cx, cy, hw, hh, r));
  return d * scale;
}

function render(size, scale) {
  const SS = 4; // Supersampling
  const px = Buffer.alloc(size * size * 3);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (i + (sx + 0.5) / SS) / size;
          const y = (j + (sy + 0.5) / SS) / size;
          if (dumbbell(x, y, scale) <= 0) cov++;
        }
      }
      const a = cov / (SS * SS);
      const o = (j * size + i) * 3;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(BG[c] * (1 - a) + ACCENT[c] * a);
    }
  }
  return encodePng(size, size, px);
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // Bit-Tiefe
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const files = [
  ['apple-touch-icon.png', 180, 0.9],
  ['icon-192.png', 192, 0.9],
  ['icon-512.png', 512, 0.9],
  ['icon-maskable-512.png', 512, 0.7],
];
for (const [name, size, scale] of files) {
  writeFileSync(join(OUT, name), render(size, scale));
  console.log('geschrieben:', name);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#0e1013"/>
<g fill="#b8f34a">
<rect x="19" y="29.8" width="26" height="4.4" rx="1.3"/>
<rect x="14.4" y="20" width="5.8" height="24" rx="1.9"/>
<rect x="43.8" y="20" width="5.8" height="24" rx="1.9"/>
<rect x="9.2" y="24" width="4.6" height="16" rx="1.6"/>
<rect x="50.2" y="24" width="4.6" height="16" rx="1.6"/>
</g></svg>`;
writeFileSync(join(OUT, 'favicon.svg'), svg);
console.log('geschrieben: favicon.svg');

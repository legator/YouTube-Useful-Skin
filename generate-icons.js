/**
 * generate-icons.js
 * Run with: node generate-icons.js
 * Creates 16×16, 48×48, 128×128 PNG icons from inline SVGs using the Canvas API
 * Requires no external dependencies — uses built-in Node 'canvas' polyfill isn't
 * available so we write minimal valid PNGs from scratch.
 *
 * ALTERNATIVE: If you have ImageMagick or sharp installed you can convert the
 * SVG files instead. This script creates single-colour placeholder PNGs that are
 * valid and will load in Chrome.
 */

const fs = require('fs');
const path = require('path');

// Minimal valid PNG generator for solid-colour + simple shapes
// We'll create the PNGs using raw zlib deflate (Node built-in)

const zlib = require('zlib');

function createPNG(width, height, drawFn) {
  // RGBA pixel buffer
  const pixels = Buffer.alloc(width * height * 4, 0);

  // Draw callback — sets pixels
  drawFn(pixels, width, height);

  // Build raw image data with filter bytes
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const deflated = zlib.deflateSync(raw);

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcData = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(crcData));
    return Buffer.concat([len, typeB, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', iend),
  ]);
}

// CRC32
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) | 0;
}

function setPixel(pixels, w, x, y, r, g, b, a) {
  if (x < 0 || x >= w || y < 0) return;
  const i = (y * w + x) * 4;
  if (i + 3 >= pixels.length) return;
  // Alpha blend
  const srcA = a / 255;
  const dstA = pixels[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  pixels[i]     = Math.round((r * srcA + pixels[i] * dstA * (1 - srcA)) / outA);
  pixels[i + 1] = Math.round((g * srcA + pixels[i+1] * dstA * (1 - srcA)) / outA);
  pixels[i + 2] = Math.round((b * srcA + pixels[i+2] * dstA * (1 - srcA)) / outA);
  pixels[i + 3] = Math.round(outA * 255);
}

function drawIcon(pixels, w, h) {
  const r = Math.max(2, Math.round(w * 0.15));

  // Fill rounded rect with #e53935
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let inside = true;
      // Corner checks
      if (x < r && y < r) {
        inside = ((x - r) ** 2 + (y - r) ** 2) <= r * r;
      } else if (x >= w - r && y < r) {
        inside = ((x - (w - r - 1)) ** 2 + (y - r) ** 2) <= r * r;
      } else if (x < r && y >= h - r) {
        inside = ((x - r) ** 2 + (y - (h - r - 1)) ** 2) <= r * r;
      } else if (x >= w - r && y >= h - r) {
        inside = ((x - (w - r - 1)) ** 2 + (y - (h - r - 1)) ** 2) <= r * r;
      }
      if (inside) {
        setPixel(pixels, w, x, y, 0xe5, 0x39, 0x35, 255);
      }
    }
  }

  // Draw play triangle (white)
  const cx = w * 0.375;
  const cy = h * 0.25;
  const bx = w * 0.375;
  const by = h * 0.75;
  const tx = w * 0.75;
  const ty = h * 0.5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Point in triangle test using barycentric coordinates
      const d1 = (x - tx) * (cy - ty) - (cx - tx) * (y - ty);
      const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
      const d3 = (x - bx) * (ty - by) - (tx - bx) * (y - by);
      const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
      const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
      if (!(hasNeg && hasPos)) {
        setPixel(pixels, w, x, y, 255, 255, 255, 255);
      }
    }
  }
}

// Generate icons
const sizes = [16, 48, 128];
const dir = path.join(__dirname, 'icons');

for (const size of sizes) {
  const png = createPNG(size, size, drawIcon);
  const outPath = path.join(dir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created ${outPath} (${png.length} bytes)`);
}

console.log('Done!');

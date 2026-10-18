// Generates the PWA icon set.
//
// A tiny PNG encoder built on node:zlib, so the icons are produced without
// pulling in an image library (sharp/canvas) just to draw a rounded square and
// a graduation cap. Run with: node scripts/generate-icons.mjs

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, "..", "public", "icons");

// ── PNG encoding ─────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * @param {string} path
 * @param {number} size
 * @param {(x: number, y: number) => [number, number, number, number]} sample
 */
function writePng(path, size, sample) {
  const raw = Buffer.alloc(size * (size * 4 + 1));

  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = sample(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  writeFileSync(path, png);
  return png.length;
}

// ── Drawing helpers ──────────────────────────────────────────

const COLORS = {
  primary: [79, 70, 229], // indigo-600, matches --primary
  primaryDark: [67, 56, 202],
  accent: [245, 158, 11], // amber-500, matches --accent
  white: [255, 255, 255],
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mix(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Signed distance to a rounded rectangle, used for antialiased edges. */
function roundedRectDistance(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - radius;
}

/** Coverage in [0,1] from a signed distance, giving 1px antialiasing. */
function coverage(distance, feather = 1) {
  return Math.min(1, Math.max(0, 0.5 - distance / feather));
}

/** Diamond (rotated square) distance — the body of the graduation cap. */
function diamondDistance(px, py, cx, cy, halfW, halfH) {
  const dx = Math.abs(px - cx) / halfW;
  const dy = Math.abs(py - cy) / halfH;
  return (dx + dy - 1) * Math.min(halfW, halfH);
}

function drawIcon(size, { padding, radius, maskable }) {
  const center = size / 2;
  const half = size / 2 - padding;
  const cornerRadius = maskable ? 0 : radius;

  // Cap geometry scales with the tile.
  const capHalfW = half * 0.62;
  const capHalfH = capHalfW * 0.52;
  const capY = center - half * 0.06;

  // Band under the cap.
  const bandTop = capY + capHalfH * 0.55;
  const bandBottom = capY + capHalfH * 1.85;
  const bandHalfW = capHalfW * 0.62;

  // Tassel.
  const tasselX = center + capHalfW * 0.78;
  const tasselY = capY + capHalfH * 1.25;
  const tasselR = half * 0.1;

  return (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;

    // Background tile
    const bgDistance = roundedRectDistance(px, py, center, center, half, half, Math.min(cornerRadius, half));
    const bgCoverage = coverage(bgDistance);
    if (bgCoverage <= 0) return [0, 0, 0, 0];

    // Vertical gradient for a little depth.
    const gradient = Math.min(1, Math.max(0, py / size));
    let color = mix(COLORS.primary, COLORS.primaryDark, gradient * 0.85);

    // Cap body
    const capCoverage = coverage(diamondDistance(px, py, center, capY, capHalfW, capHalfH));
    if (capCoverage > 0) color = mix(color, COLORS.white, capCoverage);

    // Cap band
    const bandCoverage = coverage(
      roundedRectDistance(px, py, center, (bandTop + bandBottom) / 2, bandHalfW, (bandBottom - bandTop) / 2, half * 0.05),
    );
    if (bandCoverage > 0) color = mix(color, COLORS.white, bandCoverage * 0.92);

    // Tassel dot
    const tasselCoverage = coverage(Math.hypot(px - tasselX, py - tasselY) - tasselR);
    if (tasselCoverage > 0) color = mix(color, COLORS.accent, tasselCoverage);

    return [Math.round(color[0]), Math.round(color[1]), Math.round(color[2]), Math.round(bgCoverage * 255)];
  };
}

// ── Output ───────────────────────────────────────────────────

mkdirSync(outputDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, options: { padding: 12, radius: 42, maskable: false } },
  { file: "icon-512.png", size: 512, options: { padding: 32, radius: 112, maskable: false } },
  // Maskable icons are inset so the safe zone survives any launcher shape.
  { file: "icon-maskable-512.png", size: 512, options: { padding: 102, radius: 0, maskable: true } },
  { file: "apple-touch-icon.png", size: 180, options: { padding: 0, radius: 0, maskable: true } },
];

for (const target of targets) {
  const bytes = writePng(join(outputDir, target.file), target.size, drawIcon(target.size, target.options));
  console.log(`  ${target.file.padEnd(28)} ${target.size}×${target.size}  ${(bytes / 1024).toFixed(1)} KB`);
}

console.log(`\nIcons written to ${outputDir}`);

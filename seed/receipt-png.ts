// Placeholder receipt images for seeded "receipt-backed" logs: a till-roll sketch crossed
// by a diagonal amber band, so nobody mistakes one for a real receipt. Dependency-free PNG.

import { deflateSync } from 'node:zlib';

const W = 160;
const H = 260;

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function receiptPng(seed: number): Buffer {
  let s = seed * 2654435761;
  const r = () => ((s = (s * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  const px = Buffer.alloc(W * H * 3, 0xff);
  const set = (x: number, y: number, v: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    px.set(v, (y * W + x) * 3);
  };
  const rect = (x0: number, y0: number, w: number, h: number, v: [number, number, number]) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, v);
  };

  rect(0, 0, W, H, [250, 248, 242]);
  rect(30, 16, 100, 8, [60, 60, 60]); // header
  let y = 40;
  while (y < H - 50) {
    const w = 40 + Math.floor(r() * 70);
    rect(14, y, w, 4, [150, 150, 150]);
    rect(W - 14 - 24, y, 24, 4, [110, 110, 110]); // amount column
    y += 12 + Math.floor(r() * 4);
  }
  rect(14, H - 40, W - 28, 2, [80, 80, 80]);
  rect(W - 14 - 40, H - 32, 40, 6, [40, 40, 40]); // total
  for (let i = -H; i < W; i += 1) {
    for (let t = 0; t < 14; t++) {
      const x = i + t;
      const yy = Math.round(H * 0.55 - i * 0.6);
      set(x, yy, [217, 119, 6]);
    }
  }

  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let row = 0; row < H; row++) {
    raw[row * (W * 3 + 1)] = 0;
    px.copy(raw, row * (W * 3 + 1) + 1, row * W * 3, (row + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

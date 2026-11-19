// Minimal PNG reader/writer for Chromium screenshots (8-bit, colour type 2 or 6, not interlaced). Only node:zlib.
import { inflateSync, deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 2: 3, 6: 4 };

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
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
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function readChunks(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file (bad signature)');
  const chunks = [];
  let pos = 8;
  while (pos < buf.length) {
    if (pos + 12 > buf.length) throw new Error('truncated PNG (incomplete chunk header)');
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    if (pos + 12 + len > buf.length) throw new Error(`truncated PNG (chunk ${type} runs past end of file)`);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (buf.readUInt32BE(pos + 8 + len) !== crc32(buf.subarray(pos + 4, pos + 8 + len))) throw new Error(`corrupt PNG (bad CRC in chunk ${type})`);
    chunks.push({ type, data });
    pos += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

// Undo the five scanline filters; returns raw rows without the filter bytes.
function unfilter(data, width, height, bpp) {
  const stride = width * bpp;
  if (data.length < height * (stride + 1)) throw new Error('corrupt PNG (image data shorter than its header says)');
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const type = data[y * (stride + 1)];
    if (type > 4) throw new Error(`corrupt PNG (unknown filter type ${type})`);
    const src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0;
      const b = y > 0 ? out[dst - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[dst - stride + x - bpp] : 0;
      const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][type];
      out[dst + x] = (data[src + x] + pred) & 0xff;
    }
  }
  return out;
}

export function decodePng(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr || ihdr.data.length < 13) throw new Error('corrupt PNG (missing IHDR)');
  const width = ihdr.data.readUInt32BE(0), height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8], colorType = ihdr.data[9], interlace = ihdr.data[12];
  if (depth !== 8 || !CHANNELS[colorType] || interlace !== 0) {
    throw new Error(`unsupported PNG (bit depth ${depth}, colour type ${colorType}, interlace ${interlace}); need 8-bit RGB or RGBA, not interlaced`);
  }
  if (!width || !height) throw new Error('corrupt PNG (zero size)');
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  let raw;
  try { raw = inflateSync(idat); } catch (e) { throw new Error(`corrupt PNG (cannot inflate image data: ${e.message})`); }
  const channels = CHANNELS[colorType];
  return { width, height, colorType, channels, pixels: unfilter(raw, width, height, channels) };
}

export function encodePng({ width, height, colorType, channels, pixels }) {
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); // filter byte 0
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// Cut an image into slices at most maxHeight tall; consecutive slices share `overlap` rows. Always at least one slice.
export function sliceRows(image, maxHeight, overlap) {
  if (maxHeight <= overlap) throw new Error('slice height must exceed the overlap');
  const stride = image.width * image.channels;
  const slices = [];
  for (let top = 0; ; top += maxHeight - overlap) {
    const bottom = Math.min(top + maxHeight, image.height);
    slices.push({ ...image, height: bottom - top, pixels: image.pixels.subarray(top * stride, bottom * stride) });
    if (bottom >= image.height) return slices;
  }
}

export function slicePng(buf, maxHeight, overlap = 100) {
  return sliceRows(decodePng(buf), maxHeight, overlap).map(encodePng);
}

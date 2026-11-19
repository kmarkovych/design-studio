import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { decodePng, encodePng, sliceRows, slicePng } from '../skills/studio-run/scripts/png.mjs';
import { rowImage } from './helpers.mjs';

test('encode then decode round-trips pixels', () => {
  const img = rowImage(5, 7);
  const back = decodePng(encodePng(img));
  assert.equal(back.width, 5);
  assert.equal(back.height, 7);
  assert.ok(back.pixels.equals(img.pixels));
});

// Build a PNG by hand with every filter type, to prove the decoder undoes all five.
test('decodes sub, up, average and paeth filtered scanlines', () => {
  const w = 4, h = 5, bpp = 3, stride = w * bpp;
  const px = Buffer.from(Array.from({ length: h * stride }, (_, i) => (i * 37 + (i >> 3) * 11) & 255));
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(stride + 1);
    row[0] = y; // filter type 0..4
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      row[x + 1] = (px[y * stride + x] - [0, a, b, (a + b) >> 1, paeth(a, b, c)][y]) & 255;
    }
    rows.push(row);
  }
  const plain = encodePng({ width: w, height: h, colorType: 2, channels: 3, pixels: px });
  // swap in the filtered data: rebuild file from the plain one's IHDR with new IDAT
  const filtered = encodePng({ width: w, height: h, colorType: 2, channels: 3, pixels: Buffer.alloc(h * stride) });
  assert.equal(plain.length > 0 && filtered.length > 0, true);
  const idatAt = filtered.indexOf('IDAT') - 4;
  const oldLen = filtered.readUInt32BE(idatAt);
  const rest = filtered.subarray(idatAt + 12 + oldLen);
  const idat = deflateSync(Buffer.concat(rows));
  const chunkBuf = Buffer.alloc(12 + idat.length);
  chunkBuf.writeUInt32BE(idat.length, 0);
  chunkBuf.write('IDAT', 4, 'latin1');
  idat.copy(chunkBuf, 8);
  chunkBuf.writeUInt32BE(crc(chunkBuf.subarray(4, 8 + idat.length)), 8 + idat.length);
  const out = decodePng(Buffer.concat([filtered.subarray(0, idatAt), chunkBuf, rest]));
  assert.ok(out.pixels.equals(px));
});

function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  return (c ^ 0xffffffff) >>> 0;
}

test('slices overlap by 100 rows and a short image gives one slice', () => {
  const s = sliceRows(rowImage(2, 3000), 1400, 100);
  assert.deepEqual(s.map((x) => x.height), [1400, 1400, 400]);
  assert.equal(s[1].pixels[0], 1300 & 255);
  assert.equal(sliceRows(rowImage(2, 10), 1400, 100).length, 1);
  assert.equal(slicePng(encodePng(rowImage(2, 10)), 1400).length, 1);
});

test('rejects non-PNG, corrupt CRC, and unsupported formats with clear messages', () => {
  assert.throws(() => decodePng(Buffer.from('hello world')), /not a PNG/);
  const good = encodePng(rowImage(2, 2));
  const bad = Buffer.from(good);
  bad[bad.length - 1] ^= 1;
  assert.throws(() => decodePng(bad), /CRC|corrupt/);
  assert.throws(() => decodePng(good.subarray(0, 30)), /truncated/);
  const gray = encodePng({ ...rowImage(2, 2), colorType: 0 });
  assert.throws(() => decodePng(gray), /unsupported PNG/);
});

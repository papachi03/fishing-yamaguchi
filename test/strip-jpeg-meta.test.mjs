import test from 'node:test';
import assert from 'node:assert/strict';
import { stripJpegMeta } from '../src/js/lib/strip-jpeg-meta.js';

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];

/** マーカー1つ分（長さ付き）を作る。payloadはバイトの配列 */
function seg(marker, payload) {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
}
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const app1Exif = seg(0xe1, [...EXIF_HEADER, 0x4d, 0x4d, 0x00, 0x2a, 0x11, 0x22]);
const app0Jfif = seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02]);
const app2Icc = seg(0xe2, [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f]);
const comment = seg(0xfe, [0x68, 0x69]);
const sos = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34];

const bytes = (...parts) => new Uint8Array(parts.flat());
const has = (arr, sig) => {
  outer: for (let i = 0; i <= arr.length - sig.length; i++) {
    for (let j = 0; j < sig.length; j++) if (arr[i + j] !== sig[j]) continue outer;
    return true;
  }
  return false;
};

test('APP1のEXIFを落とす', () => {
  const out = stripJpegMeta(bytes(SOI, app1Exif, sos, EOI));
  assert.equal(has(out, EXIF_HEADER), false);
  assert.deepEqual([...out], [...bytes(SOI, sos, EOI)]);
});

test('APP0（JFIF）とAPP2（ICC）は残す', () => {
  const out = stripJpegMeta(bytes(SOI, app0Jfif, app2Icc, app1Exif, sos, EOI));
  assert.deepEqual([...out], [...bytes(SOI, app0Jfif, app2Icc, sos, EOI)]);
});

test('コメントとAPP13のような箱も落とす', () => {
  const app13 = seg(0xed, [0x50, 0x68, 0x6f, 0x74, 0x6f]);
  const out = stripJpegMeta(bytes(SOI, comment, app13, sos, EOI));
  assert.deepEqual([...out], [...bytes(SOI, sos, EOI)]);
});

test('落とすものが無ければ同じバイト列をそのまま返す', () => {
  const input = bytes(SOI, app0Jfif, sos, EOI);
  assert.equal(stripJpegMeta(input), input);
});

test('画像データの中にEXIFらしい並びがあっても壊さない（SOS以降は触らない）', () => {
  const sosWithSig = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, ...EXIF_HEADER, 0x99];
  const input = bytes(SOI, sosWithSig, EOI);
  assert.deepEqual([...stripJpegMeta(input)], [...input]);
});

test('JPEGでないものは触らない', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  assert.equal(stripJpegMeta(png), png);
});

test('途中で壊れていても落ちない', () => {
  const broken = bytes(SOI, app1Exif, [0x00, 0x11, 0x22]);
  const out = stripJpegMeta(broken);
  assert.equal(has(out, EXIF_HEADER), false);
  assert.ok(out.length > 0);
});

test('短すぎる入力でも落ちない', () => {
  assert.doesNotThrow(() => stripJpegMeta(new Uint8Array([0xff])));
  assert.doesNotThrow(() => stripJpegMeta(new Uint8Array()));
});

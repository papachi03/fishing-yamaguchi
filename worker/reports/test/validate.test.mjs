import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePost, validatePhoto, jstDate } from '../src/validate.js';
import { jpegBytes } from './fakes.mjs';

const NOW = new Date('2026-09-20T03:00:00Z'); // JST 2026-09-20 12:00
const base = { name: 'つりお', spotId: 'hagi-koshigahama', comment: '風が強かったです' };

test('最小の入力で通る。日付の初期値は今日（JST）', () => {
  const v = validatePost(base, NOW);
  assert.equal(v.ok, true);
  assert.deepEqual(v.post, {
    name: 'つりお', spotId: 'hagi-koshigahama', areaId: 'hagi',
    comment: '風が強かったです', fish: '', wind: '', date: '2026-09-20',
  });
});

test('JSTの日付になる（UTCでは前日でも）', () => {
  assert.equal(jstDate(new Date('2026-09-19T16:00:00Z')), '2026-09-20');
});

test('名前：空・21文字・予約語を弾く', () => {
  assert.equal(validatePost({ ...base, name: '  ' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, name: 'あ'.repeat(21) }, NOW).ok, false);
  assert.equal(validatePost({ ...base, name: 'あ'.repeat(20) }, NOW).ok, true);
  for (const n of ['ダディ', 'ﾀﾞﾃﾞｨ', 'だでぃ', 'Ｄａｄｄｙ', 'Y F J', '管理人', '公式アカウント', 'Admin']) {
    assert.equal(validatePost({ ...base, name: n }, NOW).ok, false, n);
  }
});

test('名前：ゼロ幅文字をはさんだ予約語も弾く', () => {
  for (const n of ['ダ\u200Bディ', 'D\u200Baddy']) {
    assert.equal(validatePost({ ...base, name: n }, NOW).ok, false, JSON.stringify(n));
  }
});

test('名前：改行やタブは1つの空白に畳む', () => {
  assert.equal(validatePost({ ...base, name: 'つり\r\nお' }, NOW).post.name, 'つり お');
  assert.equal(validatePost({ ...base, name: 'つり\tお' }, NOW).post.name, 'つり お');
});

test('場所：リストに無いIDを弾く。場所不明はエリアなし', () => {
  assert.equal(validatePost({ ...base, spotId: 'nowhere' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, spotId: 'unknown' }, NOW).post.areaId, null);
  assert.equal(validatePost({ ...base, spotId: 'hofu-city' }, NOW).post.areaId, 'hofu');
});

test('コメント：空・401文字を弾く。制御文字は消す', () => {
  assert.equal(validatePost({ ...base, comment: '' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, comment: 'あ'.repeat(401) }, NOW).ok, false);
  assert.equal(validatePost({ ...base, comment: 'あ\u0007い\r\nう' }, NOW).post.comment, 'あい\nう');
});

test('魚・風：リストに無い値を弾く', () => {
  assert.equal(validatePost({ ...base, fish: 'aji', wind: 'stronger' }, NOW).ok, true);
  assert.equal(validatePost({ ...base, fish: 'kujira' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, wind: 'typhoon' }, NOW).ok, false);
});

test('日付：未来・32日前・形式違いを弾く。31日前は通る', () => {
  assert.equal(validatePost({ ...base, date: '2026-09-21' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, date: '2026-08-19' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, date: '2026-08-20' }, NOW).ok, true);
  assert.equal(validatePost({ ...base, date: '9/20' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, date: '2026-13-40' }, NOW).ok, false);
});

test('写真：なし・JPEG・大きすぎ・JPEG以外・EXIF入り', () => {
  assert.deepEqual(validatePhoto(null), { ok: true, hasPhoto: false });
  assert.deepEqual(validatePhoto(jpegBytes()), { ok: true, hasPhoto: true });
  assert.equal(validatePhoto(jpegBytes({ size: 3 * 1024 * 1024 })).ok, true);
  assert.equal(validatePhoto(jpegBytes({ size: 3 * 1024 * 1024 + 1 })).ok, false);
  assert.equal(validatePhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])).ok, false);
  assert.equal(validatePhoto(jpegBytes({ exif: true })).ok, false);
});

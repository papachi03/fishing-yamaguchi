// 釣れた時のシェア画像：道具の行は釣れた時点の釣り方で変わる（2026-10-15 部員の指摘：ヤエンで釣ったのに「エギ3.5号オレンジ」と出た）
import test from 'node:test';
import assert from 'node:assert/strict';
import { gearOfCatch } from '../src/js/ikabu/games/share-card.js';

const egi = { size: '3.5号', colorName: 'オレンジ', colorHex: '#ff8a00' };

test('エギング：エギの号数と色（色の丸あり）', () => {
  const g = gearOfCatch({ method: 'egi', egi });
  assert.equal(g.line, 'エギ 3.5号 オレンジ');
  assert.equal(g.hex, '#ff8a00');
});
test('ヤエン：エギは出さず「ヤエン」とアジ（色の丸なし）', () => {
  const g = gearOfCatch({ method: 'yaen', egi, ajiName: '活きアジ' });
  assert.equal(g.line, 'ヤエン 活きアジ');
  assert.equal(g.label, 'ヤエン');
  assert.equal(g.hex, null);
  assert.ok(!g.line.includes('エギ') && !g.short.includes('号'));
});
test('テーラー：エギは出さない（色の丸なし）', () => {
  const g = gearOfCatch({ method: 'tailor', egi });
  assert.equal(g.line, 'テーラー 電気ウキ');
  assert.equal(g.hex, null);
});
test('邪道エギング：エギにエサを足して書く', () => {
  const g = gearOfCatch({ method: 'jado', egi, baitName: 'ササミ' });
  assert.equal(g.line, 'エギ 3.5号 オレンジ＋ササミ');
  assert.equal(g.hex, '#ff8a00');
});
test('前の記録（釣り方なし）はエギングとして書く。英語も同じ形', () => {
  assert.equal(gearOfCatch({ egi }).line, 'エギ 3.5号 オレンジ');
  assert.equal(gearOfCatch({ method: 'yaen', egi, ajiName: 'Live horse mackerel' }, 'en').line, 'Yaen Live horse mackerel');
});

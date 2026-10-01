// バインダーのシェア（2026-10-01）：見せるカードの選び方と集計（純粋な部分）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickShareCards, shareSummary, SHARE_MAX } from '../src/js/ikabu/games/binder-share.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const ur = CARDS.find((c) => c.rarity === 'UR').no, sr = CARDS.find((c) => c.rarity === 'SR').no;

test('レア度の高い順→番号順に最大12枚。持っていないカードは入らない', () => {
  const owned = { 1: 3, 2: 1, [sr]: 1, [ur]: 2 };
  const p = pickShareCards(CARDS, owned);
  assert.equal(p[0].card.no, ur); assert.equal(p[0].n, 2);
  assert.equal(p[1].card.no, sr);
  assert.deepEqual(p.slice(2).map((x) => x.card.no), [1, 2]);
  const many = Object.fromEntries(CARDS.map((c) => [c.no, 1]));
  assert.equal(pickShareCards(CARDS, many).length, SHARE_MAX);
  assert.equal(pickShareCards(CARDS, {}).length, 0);
});

test('集計：種類・枚数・レア度ごとの種類数', () => {
  const s = shareSummary(CARDS, { 1: 3, [ur]: 1 });
  assert.equal(s.kinds, 2); assert.equal(s.total, 4); assert.equal(s.all, CARDS.length);
  assert.equal(s.by.UR, 1); assert.equal(s.by.N, 1); assert.equal(s.by.SSR, 0);
});

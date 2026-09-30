import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RATES, rollRarity, pull, exchange, progress, omen, emptyCards, PITY_SR, PITY_UR, SHARD_FROM, SHARD_COST, rank } from '../src/js/ikabu/games/gacha.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));

test('カードは120枚で、どのレア度にも1枚以上ある', () => {
  assert.equal(CARDS.length, 120);
  for (const r of Object.keys(RATES)) assert.ok(CARDS.some((c) => c.rarity === r), r);
});

test('確率の合計は100%。乱数の位置でレア度が決まる（0.59→N、0.61→R、0.999→UR）', () => {
  assert.ok(Math.abs(Object.values(RATES).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(rollRarity(0.59), 'N'); assert.equal(rollRarity(0.61), 'R'); assert.equal(rollRarity(0.999), 'UR');
  assert.equal(rollRarity(0.0, 'SR'), 'SR');   // 確定の段より下は出ない
  assert.equal(rollRarity(0.0, 'UR'), 'UR');
});

test('たくさん引くと確率どおりに近づく（10,000回でNが55〜65%）', () => {
  let rec = emptyCards();
  const count = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
  for (let i = 0; i < 1000; i++) { const p = pull(rec, CARDS, 10, { seed: `t${i}` }); rec = p.rec; for (const x of p.results) count[x.rarity] += 1; }
  assert.ok(count.N / 10000 > 0.5 && count.N / 10000 < 0.7, String(count.N));
  assert.ok(count.UR > 0);
});

test('10連はR以上が1枚は入る（100回の10連すべて）', () => {
  let rec = emptyCards();
  for (let i = 0; i < 100; i++) {
    const p = pull(rec, CARDS, 10, { seed: `ten${i}` }); rec = p.rec;
    assert.ok(p.results.some((x) => rank(x.rarity) >= rank('R')));
  }
});

test('天井：SR以上が29回出なければ30回目はSR以上、URは100回目', () => {
  const rec = { ...emptyCards(), sinceSR: PITY_SR - 1 };
  const p = pull(rec, CARDS, 1, { seed: 'low' });   // どんな乱数でも
  assert.ok(rank(p.results[0].rarity) >= rank('SR')); assert.equal(p.results[0].guaranteed, 'pitySR');
  const rec2 = { ...emptyCards(), sinceUR: PITY_UR - 1 };
  const q = pull(rec2, CARDS, 1, { seed: 'low' });
  assert.equal(q.results[0].rarity, 'UR'); assert.equal(q.rec.sinceUR, 0);
});

test('同じ seed なら同じ結果。ダブりはかけらになり枚数も増える', () => {
  const a = pull(emptyCards(), CARDS, 10, { seed: 'same' });
  const b = pull(emptyCards(), CARDS, 10, { seed: 'same' });
  assert.deepEqual(a.results.map((x) => x.card.no), b.results.map((x) => x.card.no));
  let rec = emptyCards();
  const first = pull(rec, CARDS, 1, { seed: 'dup' }); rec = first.rec;
  assert.equal(first.results[0].isNew, true); assert.equal(first.results[0].shards, 0);
  const no = first.results[0].card.no;
  rec.owned[no] = 1;
  const again = pull(rec, CARDS, 1, { seed: 'dup' });
  assert.equal(again.results[0].isNew, false);
  assert.equal(again.results[0].shards, SHARD_FROM[again.results[0].rarity]);
  assert.equal(again.rec.owned[no], 2);
});

test('かけらで交換：足りなければ不可、足りれば減って1枚増える', () => {
  const ur = CARDS.find((c) => c.rarity === 'UR');
  assert.equal(exchange({ ...emptyCards(), shards: 10 }, ur).ok, false);
  const e = exchange({ ...emptyCards(), shards: SHARD_COST.UR }, ur);
  assert.equal(e.ok, true); assert.equal(e.rec.shards, 0); assert.equal(e.rec.owned[ur.no], 1);
});

test('集めた率と演出の判定', () => {
  const rec = { ...emptyCards(), owned: { 1: 1, 2: 3 } };
  const p = progress(rec, CARDS);
  assert.equal(p.have, 2); assert.equal(p.all, 120); assert.equal(p.kind.squid.have, 2);
  const o = omen([{ rarity: 'N' }, { rarity: 'R' }, { rarity: 'R' }, { rarity: 'N' }, { rarity: 'N' }, { rarity: 'N' }, { rarity: 'N' }, { rarity: 'N' }, { rarity: 'R' }, { rarity: 'SR' }]);
  assert.equal(o.top, 'SR'); assert.equal(o.sure, 'kiloUp'); assert.equal(o.nabura, true); assert.equal(o.comeback, true);
  assert.equal(omen([{ rarity: 'UR' }]).sure, 'goldInk');
});

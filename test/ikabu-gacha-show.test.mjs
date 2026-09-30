import test from 'node:test';
import assert from 'node:assert/strict';
import { planShow, tierOf, summarize, FIGHT_MS, REVEAL_MS } from '../src/js/ikabu/games/gacha-show.js';

const res = (...rs) => rs.map((rarity, i) => ({ card: { no: i + 1 }, rarity, isNew: i % 2 === 0, shards: i % 2 ? 3 : 0 }));
const lo = () => 0.99;   // 「外れる予感」は出ない乱数
const hi = () => 0.01;   // 何でも出る乱数

test('確定は必ず当たる：SRならキロアップ、SSRなら止まらない、URなら墨（金か虹）', () => {
  assert.equal(planShow(res('N', 'SR'), lo).fight, 'kiloUp');
  assert.equal(planShow(res('SSR'), lo).fight, 'runaway');
  const ur = planShow(res('N', 'UR'), lo);
  assert.equal(ur.fight, 'runaway');
  assert.equal(ur.ink, 'gold');
  assert.equal(planShow(res('UR'), hi).ink, 'rainbow');
  assert.equal(planShow(res('N', 'R'), lo).ink, null);
});

test('予感は外れてよい：時合いは SR以上なら必ず、Nだけでも乱数次第で出る。常夜灯はR以上の時だけ', () => {
  assert.equal(planShow(res('SR'), lo).jiai, true);
  assert.equal(planShow(res('N'), lo).jiai, false);
  assert.equal(planShow(res('N'), hi).jiai, true);
  assert.equal(planShow(res('N'), hi).lamp, false);
  assert.equal(planShow(res('R'), hi).lamp, true);
});

test('駆け引きの長さ：通常2秒・キロアップ4.2秒・止まらない6秒。動きを減らす設定なら0.9秒', () => {
  assert.equal(planShow(res('N'), lo).fightMs, FIGHT_MS.normal);
  assert.equal(planShow(res('SR'), lo).fightMs, FIGHT_MS.kiloUp);
  assert.equal(planShow(res('SSR'), lo, { reduced: true }).fightMs, 900);
});

test('10連：R以上が3枚でナブラ、最後がSR以上で逆転バラシ。めくりの長さはレア度ごと', () => {
  const ten = res('N', 'N', 'R', 'N', 'R', 'N', 'N', 'N', 'R', 'SR');
  const p = planShow(ten, lo);
  assert.equal(p.nabura, true);
  assert.equal(p.comeback, true);
  assert.equal(p.reveals.length, 10);
  assert.equal(p.reveals[9].ms, REVEAL_MS.SR);
  assert.equal(p.totalRevealMs, REVEAL_MS.N * 6 + REVEAL_MS.R * 3 + REVEAL_MS.SR);
  assert.equal(planShow(res('N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'R'), lo).nabura, false);
});

test('段の名前とまとめ', () => {
  assert.deepEqual(['N', 'R', 'SR', 'SSR', 'UR'].map(tierOf), ['n', 'r', 'sr', 'ssr', 'ur']);
  const s = summarize(res('N', 'R', 'UR', 'N'));
  assert.deepEqual(s, { fresh: 2, shards: 6, top: 'UR' });
});

// 掛かり方（2026-10-17 ぱっぱ・部員 aji131703 さんの案）：ガッツリ抱き／触腕掛かり（10杯に1〜2杯）。
// 秋・冬（身が薄い）は張りの上限で身切れ、触腕は早く切れてゲソになりやすい。春・夏（身が厚い）は抱いていれば身切れせず振り切られる
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEgi, tick, holdFor, TENT_CHANCE, TENT_BREAK_AT, THICK_SEASONS, thickSeason, seasonOf } from '../src/js/ikabu/games/egi.js';

// 張りが上限に届く直前のファイトを作る（巻き続けている）
const fight = ({ month, hold, tension, rand = () => 0.99 }) => {
  const s = createEgi({ seed: 'h', month, rand });
  s.phase = 'fight';
  s.pressing = true;
  s.dist = 20; s.depth = 4;
  s.hooking = { id: 'aori', weight: 800, mantle: 20, power: 1, hold };
  s.tension = tension;
  s.events.length = 0;
  return s;
};
const until = (s, sec = 3) => { for (let t = 0; t < sec && s.phase === 'fight'; t += 0.02) tick(s, 0.02); return s.events.map((e) => e.type); };

test('季節：春・初夏・夏は身が厚い、秋・冬は薄い', () => {
  assert.deepEqual(THICK_SEASONS, ['spring', 'earlySummer', 'summer']);
  for (const m of [4, 5, 6, 7, 8]) assert.equal(thickSeason({ month: m }), true, `${m}月`);
  for (const m of [9, 10, 11, 12, 1, 2, 3]) assert.equal(thickSeason({ month: m }), false, `${m}月`);
  assert.equal(seasonOf(5), 'spring');
});

test('秋・冬のガッツリ抱き：張り100で身切れ（今までどおり）', () => {
  const s = fight({ month: 10, hold: 'hug', tension: 99 });
  const ev = until(s);
  assert.ok(ev.includes('break'), ev.join(','));
  assert.equal(s.last, 'break');
  assert.equal(s.lastHold, 'hug');
});

test(`秋・冬の触腕掛かり：張り${TENT_BREAK_AT}で身切れ（早い）`, () => {
  const s = fight({ month: 10, hold: 'tent', tension: TENT_BREAK_AT - 1 });
  const ev = until(s, 0.5);
  assert.ok(ev.includes('break'), ev.join(','));
  assert.equal(s.lastHold, 'tent');
  // 抱きならこの張りでは切れない
  const h = fight({ month: 10, hold: 'hug', tension: TENT_BREAK_AT - 1 });
  for (let t = 0; t < 0.1; t += 0.02) tick(h, 0.02);
  assert.equal(h.phase, 'fight');
});

test('春・夏のガッツリ抱き：身切れせず、振り切られて逃げられる', () => {
  for (const month of [5, 7]) {
    const s = fight({ month, hold: 'hug', tension: 99 });
    const ev = until(s);
    assert.ok(ev.includes('shaken'), `${month}月 ${ev.join(',')}`);
    assert.ok(!ev.includes('break'));
    assert.equal(s.last, 'shaken');
  }
});

test('春・夏の触腕掛かり：張り100で身切れ（ゲソになりやすい）', () => {
  const s = fight({ month: 5, hold: 'tent', tension: 99, rand: () => 0.5 });   // 0.5 < TENT_GESO(0.6) → ゲソ
  const ev = until(s);
  assert.ok(ev.includes('break'), ev.join(','));
  assert.ok(ev.includes('geso'), '触腕掛かりはゲソだけ上がりやすい');
  const a = fight({ month: 10, hold: 'hug', tension: 99, rand: () => 0.5 });   // 抱きは 0.5 ≥ GESO_CHANCE(0.3) → ゲソにならない
  assert.ok(!until(a).includes('geso'));
});

test(`触腕掛かりはおよそ${TENT_CHANCE * 100}%（外道・ボスはいつも抱き）`, () => {
  let tent = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    const r = (i * 0.61803398875) % 1;   // むらの少ない並び
    tent += holdFor({ hooking: { id: 'aori' }, rand: () => r }) === 'tent' ? 1 : 0;
  }
  assert.ok(Math.abs(tent / N - TENT_CHANCE) < 0.01, String(tent / N));
  assert.equal(holdFor({ hooking: { id: 'kasago', gedo: true }, rand: () => 0 }), 'hug');
  assert.equal(holdFor({ hooking: { id: 'aori', boss: true }, rand: () => 0 }), 'hug');
});

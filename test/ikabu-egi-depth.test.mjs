// 釣り場の水深（浅場・ふつう・深場 2026-10-06 ぱっぱ）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEgi, press, release, tick, DEPTH_RANGE } from '../src/js/ikabu/games/egi.js';

function bottomsOf(depth, n = 60) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = createEgi({ seed: `d${depth}${i}`, depth });
    press(s); for (let k = 0; k < 20; k++) tick(s, 0.05); release(s); tick(s, 0.05);
    out.push(s.bottom);
  }
  return out;
}
test('水深の設定で、底の深さの範囲が変わる（浅場3〜5m・ふつう5〜10m・深場10〜16m）', () => {
  for (const [d, [a, w]] of Object.entries(DEPTH_RANGE)) {
    const b = bottomsOf(d);
    assert.ok(b.every((x) => x >= a && x <= a + w), `${d}: ${b.join(',')}`);
  }
  assert.ok(Math.max(...bottomsOf('shallow')) < Math.min(...bottomsOf('deep')));
});
test('知らない水深は「ふつう」として扱う', () => {
  assert.equal(createEgi({ depth: 'xyz' }).depthPref, 'normal');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShakeDetector, makeGravityFilter } from '../src/js/ikabu/games/shake.js';

// 揺れの大きさの並び（10ミリ秒ごと）を入れて、振ったと数えた回数を返す
const count = (mags) => { const d = makeShakeDetector(); return mags.filter((m, i) => d(m, i * 10)).length; };
const flick = [2, 8, 18, 25, 16, 6, 2, 1, 1, 1];   // 竿のように1回クイッと振る（約0.1秒）

test('1回振ると1回、2回振ると2回（1回の振りを2回と数えない）', () => {
  assert.equal(count(flick), 1);
  assert.equal(count([...flick, ...flick.map(() => 1), ...flick]), 2);   // 0.2秒あけて2回（速い2段しゃくり）
});

test('歩く揺れ（3〜6）では、しゃくりにならない', () => {
  const walk = Array.from({ length: 300 }, (_, i) => 4.5 + 1.5 * Math.sin(i / 3));
  assert.equal(count(walk), 0);
});

test('強く振り続けても、0.18秒より短い間隔では数えない', () => {
  const d = makeShakeDetector();
  assert.equal(d(20, 0), true);
  assert.equal(d(3, 50), false);
  assert.equal(d(20, 100), false);   // まだ 0.18 秒たっていない
  assert.equal(d(3, 150), false);
  assert.equal(d(20, 200), true);
});

test('重力を含む値でも、じっとしていれば揺れは0に近い', () => {
  const f = makeGravityFilter();
  let m = 0;
  for (let i = 0; i < 50; i++) m = f(0, 9.8, 0.3);
  assert.ok(m < 0.1, String(m));
});

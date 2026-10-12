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

// スマホの傾き（2026-10-04）：0 度＝画面を立てて自分に向けている、90 度＝上向き。縦・横どちらで持っても同じ
import { pitchOf } from '../src/js/ikabu/games/shake.js';
test('pitchOf：立てる 0 度・上向き 90 度・45 度で持つ 45 度。横持ちでも同じ', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 0.5, `${a} ≒ ${b}`);
  near(pitchOf(0, -9.8, 0), 0);
  near(pitchOf(0, 0, -9.8), 90);
  near(pitchOf(0, -6.93, -6.93), 45);
  near(pitchOf(-6.93, 0, -6.93), 45);   // 横持ち
});

// ---- 奥へ倒すとテンションフォール（2026-10-12 まれに入らない不具合の直し） ----
import { makeTiltGate } from '../src/js/ikabu/games/shake.js';
// 角度の並び（50ミリ秒ごと）を入れて、出来事（'enter'／'exit'）を返す。canEnter は入ってよいか（エンジンの返事）
const run = (gate, angles, t0 = 0, canEnter = () => true) => angles.map((p, i) => gate.update(p, t0 + i * 50, canEnter)).filter(Boolean);
const hold = (deg, n) => Array(n).fill(deg);

test('ふつう：持った角度が落ち着いてから基準を取り、奥へ15度倒すと入り、戻すと終わる', () => {
  const g = makeTiltGate();
  assert.deepEqual(run(g, [...hold(30, 12), ...hold(47, 6), ...hold(31, 6)]), ['enter', 'exit']);
});

test('着水の直後にスマホがまだ前に傾いて動いていても、落ち着いた角度を基準にする（前は最初の1回で基準を取り、15度倒しても入らなかった）', () => {
  const g = makeTiltGate();
  // 投げた勢いで 50 度前後をうろうろ → 30 度で落ち着く → 30＋16 度に倒す
  const moving = [50, 42, 55, 38, 47, 33];
  assert.deepEqual(run(g, [...moving, ...hold(30, 12), ...hold(46, 6)]), ['enter']);
});

test('基準より起こしたら、基準をそこに合わせる（起こした所から15度で入る）', () => {
  const g = makeTiltGate();
  assert.deepEqual(run(g, [...hold(40, 12), ...hold(25, 6), ...hold(41, 6)]), ['enter']);
});

test('倒したまましゃくって受け付けが止まっても、角度が落ち着けばそこを基準に再開する（前は9度より起こさないと、その投げのあいだ効かなかった）', () => {
  const g = makeTiltGate();
  const ev = run(g, [...hold(30, 12), ...hold(46, 4)]);
  assert.deepEqual(ev, ['enter']);
  g.engineEnded();   // ボタンや振りでしゃくった＝エンジン側でテンションフォールが終わった
  // 持ち方が少し前のまま（基準＋10度）で落ち着く → 再開 → そこからさらに15度倒すと入る
  assert.deepEqual(run(g, [...hold(40, 16), ...hold(56, 6)], 1000), ['enter']);
});

test('振った直後の0.8秒は入らない（振った勢いの角度で誤って入らない）', () => {
  const g = makeTiltGate();
  run(g, hold(30, 12));
  g.block(600);
  assert.deepEqual(run(g, hold(48, 6), 650), []);      // 0.65〜0.9秒：まだ止めている
  assert.deepEqual(run(g, hold(48, 4), 1450), ['enter']);   // 0.8秒を過ぎて、倒したままなら入る
});

test('エンジンが入れない時（しゃくる前の沈下中など）は入らず、入れるようになったら入る', () => {
  const g = makeTiltGate();
  let ok = false;
  assert.deepEqual(run(g, [...hold(30, 12), ...hold(47, 4)], 0, () => ok), []);
  ok = true;
  assert.deepEqual(run(g, hold(47, 2), 800, () => ok), ['enter']);
});

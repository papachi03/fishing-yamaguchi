// テンションフォールの入り方（2026-10-04 ぱっぱ）
//   ① 2段しゃくりの後に押し続けたら、3回目のしゃくりにせずテンションフォール（holdFall）
//   ② 振ってしゃくる機能：スマホを奥へ倒すとテンションフォール、戻すと終わる。倒したまま振り上げればしゃくり（setTiltFall）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEgi, press, release, tick, holdFall, setTiltFall } from '../src/js/ikabu/games/egi.js';

const run = (s, seconds, step = 0.05) => { const ev = []; for (let t = 0; t < seconds - 1e-9; t += step) ev.push(...tick(s, step)); return ev; };
const ready = () => {
  const s = createEgi({ seed: 'tf1', month: 10, tod: 'evening', rand: () => 0.99 });
  press(s); run(s, 0.8); release(s); run(s, 3);   // 投げて沈める
  press(s); release(s); run(s, 0.2); press(s); release(s); run(s, 0.3);   // 2段しゃくり
  return s;
};

test('2段しゃくりの後の holdFall：しゃくりは増えず、すぐテンションフォール。離すとフリーフォールに戻る', () => {
  const s = ready();
  const jerks = s.jerks.length;
  assert.equal(s.phase, 'action');
  const ok = holdFall(s);
  assert.equal(ok, true);
  assert.equal(s.tensionFall, true);
  assert.ok(s.events.some((e) => e.type === 'fall' && e.mode === 'tension'));
  run(s, 1);
  assert.equal(s.jerks.length, jerks, 'しゃくりの回数は増えない');
  assert.equal(s.tensionFall, true);
  release(s);
  assert.equal(s.tensionFall, false);
});

test('holdFall は誘い（action）の間だけ。沈下中・投げる前は何もしない', () => {
  const s = createEgi({ seed: 'tf2', month: 10, tod: 'evening', rand: () => 0.99 });
  assert.equal(holdFall(s), false);
  press(s); run(s, 0.8); release(s); run(s, 0.5);
  assert.equal(s.phase, 'sinking');
  assert.equal(holdFall(s), false);
});

test('setTiltFall：倒すとテンションフォール、戻すと終わる。倒したままのしゃくりで終わる', () => {
  const s = ready();
  assert.equal(setTiltFall(s, true), true);
  assert.equal(s.tensionFall, true);
  run(s, 0.5);
  assert.equal(s.tensionFall, true, '指を押していなくても続く');
  assert.equal(setTiltFall(s, false), true);
  assert.equal(s.tensionFall, false);
  setTiltFall(s, true);
  press(s); release(s);   // 倒したまま振り上げた＝しゃくり
  assert.equal(s.tiltFall, false);
  assert.equal(s.tensionFall, false);
});

// 🔰初心者練習のイカの食いつきを測る（2026-10-03 ぱっぱ：食いつきが悪くて練習にならない）
//   初心者らしい動き（底を待たずに2秒でしゃくる・アワセは0.9秒遅れ）で、1投ごとに「アタリが出たか」「最初のアタリまでの秒」「釣れたか」を数える
//   node dev/easy_bite.mjs
import { createEgi, press, release, tick } from '../src/js/ikabu/games/egi.js';
const run = (s, sec, step = 0.05) => { for (let t = 0; t < sec && s.phase !== 'over'; t += step) tick(s, step); };
function trip(seed, { easy = true, month = 10, tod = 'evening', exp = 7 } = {}) {
  const s = createEgi({ seed, month, tod, conditions: { expectation: exp, wind: 1, gust: 2 }, easy });
  const step = 0.05; let guard = 0;
  const casts = []; let cur = null;
  const off = s.events ? null : null; void off;
  while (s.phase !== 'over' && guard++ < 40000) {
    if (s.phase === 'ready') { if (cur) casts.push(cur); cur = { signal: false, first: null, at: s.t, caught: false }; press(s); run(s, 0.8, step); release(s); continue; }
    if (s.phase === 'result') { press(s); release(s); continue; }
    if (s.phase === 'sinking') { run(s, 2.0, step); if (s.phase === 'sinking') { press(s); release(s); } continue; }
    if (s.phase === 'action') { press(s); for (let t = 0; t < 3 && s.phase === 'action'; t += step) tick(s, step); if (s.pressing) release(s); continue; }
    if (s.phase === 'signal') { if (cur && !cur.signal) { cur.signal = true; cur.first = s.t - cur.at; } run(s, 0.9, step); if (s.phase === 'signal') { press(s); release(s); } continue; }
    if (s.phase === 'fight') { if (!s.pressing) press(s); run(s, step, step); if (s.phase === 'fight' && s.tension > 90) { release(s); run(s, 0.5, step); } if (s.phase !== 'fight' && s.pressing) release(s); continue; }
    run(s, step, step);
  }
  if (cur) casts.push(cur);
  return { casts, catches: s.catches.length };
}
const N = 120;
for (const c of [{ month: 10, exp: 7 }, { month: 10, exp: 4 }, { month: 3, exp: 5 }, { month: 7, tod: 'night', exp: 5 }, { month: 1, tod: 'night', exp: 4 }]) {
  const R = Array.from({ length: N }, (_, i) => trip(`eb${i}`, c));
  const casts = R.flatMap((r) => r.casts);
  const withSig = casts.filter((x) => x.signal);
  const firsts = withSig.map((x) => x.first).sort((a, b) => a - b);
  const zeroTrip = R.filter((r) => r.catches === 0).length / N;
  console.log(`${c.month}月 ${c.tod ?? 'evening'} 期待${c.exp}：1投でアタリが出た ${(withSig.length / casts.length * 100).toFixed(0)}%  最初のアタリまで 中央値 ${firsts[Math.floor(firsts.length / 2)]?.toFixed(1)}秒  1釣行の釣果 平均 ${(R.reduce((a, r) => a + r.catches, 0) / N).toFixed(2)}杯  ボウズ ${(zeroTrip * 100).toFixed(0)}%`);
}

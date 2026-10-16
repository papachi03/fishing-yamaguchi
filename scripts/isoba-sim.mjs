// 磯場の難しさを機械で測る（2026-10-16）。node scripts/isoba-sim.mjs [釣行の数]
//   既存テスト（test/ikabu-egi.test.mjs の noviceTrip）と同じ「人らしい自動プレイ」で、堤防と磯場を比べる
//   初心者：2秒沈めたらしゃくる（底は気にしない）。しゃくったら3秒フォール。アタリは0.9秒遅れで合わせる
//   上手（カウント）：その距離の底をカウントして、底の0.8m手前でしゃくる。フォールも底の手前で切り上げる。アタリは0.3秒で合わせる
//   1釣行＝5投（エギ3本）。釣れた数・失ったエギ・藻に掛かった回数・釣れた釣行の割合を平均する
import { createEgi, press, release, tick } from '../src/js/ikabu/games/egi.js';
import { isoPartOver } from '../src/js/ikabu/games/isoba.js';

const TRIPS = Number(process.argv[2] ?? 150);
const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20'];
const step = 0.05;
const run = (s, sec) => { for (let t = 0; t < sec && s.phase !== 'over'; t += step) { tick(s, step); s._ev.push(...s.events); } };

function trip(style, seed, stage, day) {
  const s = createEgi({ seed, stage, fieldSeed: day, month: 10, tod: 'evening', conditions: { expectation: 7, wind: 1, gust: 2 } });
  s._ev = [];
  const good = style === 'good';
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 30000) {
    if (s.phase === 'ready') { press(s); run(s, 0.8); release(s); continue; }
    if (s.phase === 'result') { press(s); release(s); continue; }
    if (s.phase === 'sinking' || s.phase === 'action') {
      if (good) {
        // 底の手前（0.8m）まで沈めてからしゃくる＝カウント。底が近いほど早めに
        let t = 0;
        // 上手：見えている岩・藻の高さ分も含めて、その手前でしゃくる（磯場の肝）
        const ceil = () => { const p = s.field ? isoPartOver(s.field, s.dist) : null; return s.bottom - (p ? p.h : 0) - 0.8; };
        while ((s.phase === 'sinking' || s.phase === 'action') && s.depth < ceil() && t < 6) { run(s, step); t += step; }
        if (s.phase === 'sinking' || s.phase === 'action') { press(s); run(s, 0.1); release(s); }
      } else {
        run(s, s.phase === 'sinking' ? 2.0 : 3.0);
        if (s.phase === 'sinking' || s.phase === 'action') { press(s); run(s, 0.1); release(s); }
      }
      continue;
    }
    if (s.phase === 'signal') { run(s, good ? 0.3 : 0.9); if (s.phase === 'signal') { press(s); release(s); } continue; }
    if (s.phase === 'fight') {
      if (!s.pressing) press(s);
      run(s, step);
      if (s.phase === 'fight' && s.tension > 90) { release(s); run(s, 0.5); }
      if (s.phase !== 'fight' && s.pressing) release(s);
      continue;
    }
    run(s, step);
  }
  return { catch: s.catches.length, lost: s._ev.filter((e) => e.type === 'snag').length, weed: s._ev.filter((e) => e.type === 'weed').length, free: s._ev.filter((e) => e.type === 'isoFree').length };
}

for (const stage of ['pier', 'isoba']) {
  for (const style of ['novice', 'good']) {
    const rs = Array.from({ length: TRIPS }, (_, i) => trip(style, `${style}${stage}${i}`, stage, DAYS[i % DAYS.length]));
    const avg = (k) => (rs.reduce((a, r) => a + r[k], 0) / TRIPS).toFixed(2);
    const got = Math.round((rs.filter((r) => r.catch > 0).length / TRIPS) * 100);
    console.log(`${stage === 'isoba' ? '磯場' : '堤防'}・${style === 'good' ? '上手（カウント）' : '初心者'}：釣れた釣行 ${got}%／釣れた ${avg('catch')}杯／失ったエギ ${avg('lost')}本／藻 ${avg('weed')}回／外れた ${avg('free')}回`);
  }
}

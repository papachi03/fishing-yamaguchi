import test from 'node:test';
import assert from 'node:assert/strict';
import { createRush, rushSwap, rushFlash, CAP, DRAIN, PACE, inflowAt, panicOf } from '../src/js/ikabu/games/inkrush.js';
import { SIZE, findHint, INK_NEED } from '../src/js/ikabu/games/match3.js';
import { recordRush, emptyM3, mergeM3 } from '../src/js/ikabu/games/records.js';

const playHint = (seed, max = 400) => {
  const g = createRush({ seed });
  let n = 0;
  while (!g.over && n++ < max) { const h = findHint(g.board); if (!h) break; rushSwap(g, h[0], h[1]); }
  return g;
};

test('墨のがれ（A案）：同じ種なら同じ盤面（世界中で同じ）。最初は水位0、手数は無制限、流れ込む量は手が進むほど増える', () => {
  const a = createRush({ seed: '2026-09-29' }), b = createRush({ seed: '2026-09-29' });
  assert.deepEqual(a.board, b.board);
  assert.equal(a.rush.level, 0);
  assert.equal(a.moves, Infinity);
  assert.ok(inflowAt(0) < inflowAt(PACE[PACE.length - 1][0]));
});

test('1手ごとに水位が上がる。一番上の列のマスを消すと、穴の数×DRAIN だけ抜けて点になる', () => {
  let seenDrain = false;
  for (let s = 0; s < 100 && !seenDrain; s++) {
    const g = createRush({ seed: 'drain' + s });
    g.rush.level = 20;
    const h = findHint(g.board);
    const r = rushSwap(g, h[0], h[1]);
    const rise = r.events.find((e) => e.type === 'rise');
    assert.ok(rise && rise.amount === inflowAt(1));
    const d = r.events.find((e) => e.type === 'drain');
    if (d) {
      seenDrain = true;
      assert.equal(d.amount, Math.min(20, d.cols.length * DRAIN));
      assert.ok(d.cols.every((c) => c < SIZE));
      assert.equal(g.rush.level, 20 - d.amount + rise.amount);
      assert.ok(g.score >= d.points);
    }
  }
  assert.ok(seenDrain, '上の列が消える手が見つからなかった');
});

test('墨フラッシュは手数を使わない（水位は上がらない）が、上の列に穴が開けば抜ける', () => {
  const g = createRush({ seed: 'flash' });
  g.charge = INK_NEED; g.rush.level = 20;
  const r = rushFlash(g, 0);
  assert.ok(r.ok);
  assert.equal(g.rush.turn, 0);
  assert.ok(!r.events.some((e) => e.type === 'rise'));
  assert.ok(g.rush.level <= 20);
});

test('水位が CAP で飲み込まれて終わる。ヒントどおりに打つと 15〜120 手のあいだで終わる', () => {
  const turns = [];
  for (let s = 0; s < 12; s++) { const g = playHint('end' + s); assert.ok(g.over); assert.equal(g.rush.reason, 'drown'); assert.equal(g.rush.level, CAP); assert.equal(panicOf(g), 1); turns.push(g.rush.turn); }
  const med = turns.sort((a, b) => a - b)[6];
  assert.ok(med >= 15 && med <= 120, String(turns));
});

test('記録：しのいだ手数のベストと今日の盤面のベスト。控えの統合でも残る', () => {
  const g = playHint('rec');
  let rec = recordRush(emptyM3(), g, { day: '2026-09-29' });
  assert.equal(rec.rush.best, g.rush.turn);
  assert.equal(rec.rush.daily.turns, g.rush.turn);
  const m = mergeM3(rec, { ...emptyM3(), rush: { best: 999, bestScore: 1, played: 3, daily: { day: '2026-09-28', turns: 5 } } });
  assert.equal(m.rush.best, 999);
  assert.equal(m.rush.daily.day, '2026-09-29');
});

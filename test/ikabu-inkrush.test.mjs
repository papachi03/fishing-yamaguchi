import test from 'node:test';
import assert from 'node:assert/strict';
import { createRush, rushSwap, rushFlash, rushTick, rushHint, LID, CAP, START, DRAIN, PACE, LID_FIRST, inflowAt, panicOf, lidCols } from '../src/js/ikabu/games/inkrush.js';
import { SIZE, INK_NEED, findMatches } from '../src/js/ikabu/games/match3.js';
import { recordRush, emptyM3, mergeM3 } from '../src/js/ikabu/games/records.js';

// 2秒に1手、ヒントどおりに打つ人
const playHint = (seed, secPerMove = 2, max = 600) => {
  const g = createRush({ seed });
  let n = 0;
  while (!g.over && n++ < max) { rushTick(g, secPerMove); if (g.over) break; const h = rushHint(g.board); if (!h) { rushTick(g, 1); continue; } rushSwap(g, h[0], h[1]); }
  return g;
};

test('墨のがれ（時間制）：同じ種なら同じ盤面。最初から墨がたまり（START）、手数は無制限、流れ込む速さは時間とともに上がる', () => {
  const a = createRush({ seed: '2026-09-29' }), b = createRush({ seed: '2026-09-29' });
  assert.deepEqual(a.board, b.board);
  assert.equal(a.rush.level, START);
  assert.equal(a.moves, Infinity);
  assert.ok(inflowAt(0) < inflowAt(PACE[PACE.length - 1][0]));
});

test('時間で水位が上がる。消したマスの数×DRAIN だけ抜けて点になる', () => {
  const g = createRush({ seed: 'time' });
  rushTick(g, 5);
  assert.ok(Math.abs(g.rush.level - (START + inflowAt(0) * 5)) < 1e-9);
  const h = rushHint(g.board);
  const r = rushSwap(g, h[0], h[1]);
  const d = r.events.find((e) => e.type === 'drain');
  assert.ok(d && d.amount > 0 && d.points > 0);
  const cleared = r.steps.filter((st) => st.kind !== 'lidbreak').reduce((n, st) => n + st.cleared.length, 0);
  assert.ok(Math.abs(g.rush.flushed - cleared * DRAIN) < 1e-9);
});

test('ふたは LID_FIRST 秒で一番上の列に降り、その列は抜けない。隣でそろえると割れる', () => {
  const g = createRush({ seed: 'lid' });
  const ev = rushTick(g, LID_FIRST + 0.01);
  assert.ok(ev.some((e) => e.type === 'lid'));
  for (let c = 0; c < SIZE; c++) assert.equal(g.board[c], LID);
  assert.equal(lidCols(g.board).size, SIZE);
  assert.equal(findMatches(g.board).length, 0);
  // どこかで手を打ち続ければ、いつかふたの隣がそろって割れる
  let broken = false;
  for (let n = 0; n < 60 && !broken; n++) { const h = rushHint(g.board); if (!h) break; const r = rushSwap(g, h[0], h[1]); if (r.events.some((e) => e.type === 'lidbreak')) broken = true; }
  assert.ok(broken, 'ふたが割れる例が無かった');
  assert.ok(lidCols(g.board).size < SIZE);
});

test('ふたのマスは動かせない・墨フラッシュの的にできない', () => {
  const g = createRush({ seed: 'fixed' });
  rushTick(g, LID_FIRST + 0.01);
  assert.equal(rushSwap(g, 0, 1).ok, false);
  assert.equal(rushSwap(g, 0, SIZE).ok, false);
  g.charge = INK_NEED;
  assert.equal(rushFlash(g, 0).ok, false);
});

test('水位が CAP で飲み込まれて終わる。2秒に1手なら 30〜200 秒のあいだ', () => {
  const secs = [];
  for (let s = 0; s < 10; s++) { const g = playHint('end' + s); assert.ok(g.over); assert.equal(g.rush.reason, 'drown'); assert.equal(panicOf(g), 1); secs.push(g.rush.t); }
  const med = secs.sort((a, b) => a - b)[5];
  assert.ok(med >= 30 && med <= 200, String(secs.map(Math.round)));
});

test('記録：しのいだ秒のベストと今日の盤面のベスト。控えの統合でも残る', () => {
  const g = playHint('rec');
  let rec = recordRush(emptyM3(), g, { day: '2026-09-29' });
  assert.equal(rec.rush.best, Math.floor(g.rush.t));
  assert.equal(rec.rush.daily.turns, Math.floor(g.rush.t));
  const m = mergeM3(rec, { ...emptyM3(), rush: { best: 999, bestScore: 1, played: 3, daily: { day: '2026-09-28', turns: 5 } } });
  assert.equal(m.rush.best, 999);
  assert.equal(m.rush.daily.day, '2026-09-29');
});

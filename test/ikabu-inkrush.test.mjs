import test from 'node:test';
import assert from 'node:assert/strict';
import { createRush, rushSwap, rushFlash, rushTick, rushHint, HOLE, holes, CAP, START, HOLE_RATE, OPEN_BURST, ROW_FIRST, PACE, inflowAt, panicOf } from '../src/js/ikabu/games/inkrush.js';
import { SIZE, INK_NEED, findMatches } from '../src/js/ikabu/games/match3.js';
import { recordRush, emptyM3, mergeM3 } from '../src/js/ikabu/games/records.js';

const BOTTOM = (SIZE - 1) * SIZE;
// 時間を少しずつ進める（一度に大きく進めると、その時点の速さで全部足される）
const tickTo = (g, sec) => { while (!g.over && g.rush.t < sec - 1e-9) rushTick(g, Math.min(0.5, sec - g.rush.t)); };   // 終わったら進めない（進めないと無限ループ）
// 2秒に1手、ヒントどおりに打つ人
const playHint = (seed, secPerMove = 2, max = 600) => {
  const g = createRush({ seed });
  let n = 0;
  while (!g.over && n++ < max) { tickTo(g, g.rush.t + secPerMove); if (g.over) break; const h = rushHint(g.board); if (!h) continue; rushSwap(g, h[0], h[1]); }
  return g;
};

test('墨のがれ（第4版）：同じ種なら同じ盤面。最初から墨がたまり（START）、手数は無制限、流れ込む速さは時間とともに上がる', () => {
  const a = createRush({ seed: '2026-09-29' }), b = createRush({ seed: '2026-09-29' });
  assert.deepEqual(a.board, b.board);
  assert.equal(a.rush.level, START);
  assert.equal(a.moves, Infinity);
  assert.ok(inflowAt(0) < inflowAt(PACE[PACE.length - 1][0]));
  assert.deepEqual(holes(a.board), []);
});

test('一番下で消えたマスは穴になり、開いた瞬間に抜け、開いている間は時間で抜け続ける', () => {
  let seen = false;
  for (let s = 0; s < 200 && !seen; s++) {
    const g = createRush({ seed: 'hole' + s });
    g.rush.level = 25;
    const h = rushHint(g.board);
    if (!h) continue;
    const r = rushSwap(g, h[0], h[1]);
    const ev = r.events.find((e) => e.type === 'hole');
    if (!ev) continue;
    seen = true;
    assert.ok(ev.cells.every((i) => i >= BOTTOM && g.board[i] === HOLE));
    assert.equal(holes(g.board).length, ev.cells.length);
    assert.ok(Math.abs(g.rush.level - (25 - ev.cells.length * OPEN_BURST)) < 1e-9);
    const lv = g.rush.level;
    rushTick(g, 1);
    assert.ok(Math.abs(g.rush.level - (lv + inflowAt(g.rush.t) * 1 - holes(g.board).length * HOLE_RATE)) < 1e-9);
  }
  assert.ok(seen, '一番下がそろう手が見つからなかった');
});

test('穴のマスは動かせない・墨フラッシュの的にできない・上に落ちてくるマークは穴に入らない', () => {
  const g = createRush({ seed: 'fixed' });
  g.board[BOTTOM] = HOLE;
  assert.equal(rushSwap(g, BOTTOM, BOTTOM + 1).ok, false);
  g.charge = INK_NEED;
  assert.equal(rushFlash(g, BOTTOM).ok, false);
  const h = rushHint(g.board);
  if (h) { rushSwap(g, h[0], h[1]); assert.equal(g.board[BOTTOM], HOLE, '手を打っても穴はそのまま'); }
});

test('ROW_FIRST 秒で上から一列降り、盤面が1段下がって穴はふさがる。同じ種なら同じ列が降る', () => {
  const g = createRush({ seed: 'row' });
  g.rush.level = 0;
  g.board[BOTTOM] = HOLE;
  const oldTop = g.board.slice(0, SIZE * 2);
  tickTo(g, ROW_FIRST - 0.5);   // ちょうど ROW_FIRST まで進めると、その中で降りてしまう
  const tk = rushTick(g, 0.6);
  assert.ok(tk.events.some((e) => e.type === 'row'));
  assert.deepEqual(holes(g.board), []);
  assert.equal(g.rush.rows, 1);
  assert.deepEqual(g.board.slice(SIZE, SIZE * 2), oldTop.slice(0, SIZE), '前の一番上の列が1段下がっている');
  const g2 = createRush({ seed: 'row' }); g2.rush.level = 0; g2.board[BOTTOM] = HOLE; tickTo(g2, ROW_FIRST - 0.5); rushTick(g2, 0.6);
  assert.deepEqual(g2.board.slice(0, SIZE), g.board.slice(0, SIZE));
  assert.equal(findMatches(g.board).length, 0);
});

test('水位が CAP で飲み込まれて終わる。一番下を狙わない人（ヒントどおり）は 15〜200 秒のあいだ', () => {
  const secs = [];
  for (let s = 0; s < 10; s++) { const g = playHint('end' + s); assert.ok(g.over); assert.equal(g.rush.reason, 'drown'); assert.equal(panicOf(g), 1); secs.push(g.rush.t); }
  const med = secs.sort((a, b) => a - b)[5];
  assert.ok(med >= 15 && med <= 200, String(secs.map(Math.round)));
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

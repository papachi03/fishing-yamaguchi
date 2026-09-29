import test from 'node:test';
import assert from 'node:assert/strict';
import { createRush, rushSwap, rushHint, INK, DROWN, PACE, paceAt, inkCount, panicOf } from '../src/js/ikabu/games/inkrush.js';
import { SIZE } from '../src/js/ikabu/games/match3.js';
import { recordRush, emptyM3, mergeM3 } from '../src/js/ikabu/games/records.js';

const N = SIZE * SIZE;
const playRandom = (seed, max = 300) => {
  const g = createRush({ seed });
  let n = 0;
  while (!g.over && n++ < max) { const h = rushHint(g.board); if (!h) break; rushSwap(g, h[0], h[1]); }
  return g;
};

test('墨のがれ：同じ種なら同じ盤面と同じ予告（世界中で同じ）。最初は墨が無く、手数は無制限', () => {
  const a = createRush({ seed: '2026-09-29' }), b = createRush({ seed: '2026-09-29' });
  assert.deepEqual(a.board, b.board);
  assert.deepEqual(a.rush.next, b.rush.next);
  assert.equal(inkCount(a.board), 0);
  assert.equal(a.moves, Infinity);
});

test('墨は予告した列の一番上に落ち、ペースは手が進むほど速くなる', () => {
  const g = createRush({ seed: 'drop' });
  const cols = g.rush.next.cols;
  const first = g.rush.next.in;
  for (let k = 0; k < first; k++) { const h = rushHint(g.board); rushSwap(g, h[0], h[1]); }
  for (const c of cols) assert.equal(g.board[c], INK, `列${c}の一番上が墨`);
  assert.ok(paceAt(0)[1] > paceAt(40)[1] || paceAt(0)[2] < paceAt(40)[2]);
  assert.deepEqual(PACE[0][0], 0);
});

test('墨のマスは動かせない（ヒントにも出ない）', () => {
  const g = createRush({ seed: 'fixed' });
  g.board[0] = INK; g.board[1] = INK;
  const h = rushHint(g.board);
  assert.ok(!h || (h[0] !== 0 && h[1] !== 0 && h[0] !== 1 && h[1] !== 1));
  assert.equal(rushSwap(g, 0, 1).ok, false);
});

test('墨の下のマークが消えると、墨は流れ落ちて外へ（点と数に入る）', () => {
  let seen = false;
  for (let s = 0; s < 200 && !seen; s++) {
    const g = createRush({ seed: 'flow' + s });
    // 上の列に墨を置き、その真下がそろう手を探す
    for (let c = 0; c < SIZE; c++) g.board[c] = INK;
    const h = rushHint(g.board);
    if (!h) continue;
    const before = g.rush.flushed;
    const r = rushSwap(g, h[0], h[1]);
    if (r.steps.some((st) => st.kind === 'flush')) {
      seen = true;
      assert.ok(g.rush.flushed > before);
      assert.ok(r.steps.find((st) => st.kind === 'flush').points > 0);
    }
  }
  assert.ok(seen, '流れ落ちる例が見つからなかった');
});

test('墨が DROWN 個で飲み込まれて終わる。でたらめに打っても 20〜150 手のあいだで終わる', () => {
  const turns = [];
  for (let s = 0; s < 12; s++) { const g = playRandom('end' + s); assert.ok(g.over); assert.equal(g.rush.reason, 'drown'); assert.ok(inkCount(g.board) >= DROWN); turns.push(g.rush.turn); assert.ok(panicOf(g) >= 1); }
  const med = turns.sort((a, b) => a - b)[6];
  assert.ok(med >= 20 && med <= 150, String(turns));
});

test('記録：しのいだ手数のベストと今日の盤面のベスト。控えの統合でも残る', () => {
  const g = playRandom('rec');
  let rec = recordRush(emptyM3(), g, { day: '2026-09-29' });
  assert.equal(rec.rush.best, g.rush.turn);
  assert.equal(rec.rush.daily.turns, g.rush.turn);
  const m = mergeM3(rec, { ...emptyM3(), rush: { best: 999, bestScore: 1, played: 3, daily: { day: '2026-09-28', turns: 5 } } });
  assert.equal(m.rush.best, 999);
  assert.equal(m.rush.daily.day, '2026-09-29');
});

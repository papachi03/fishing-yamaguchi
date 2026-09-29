import test from 'node:test';
import assert from 'node:assert/strict';
import { createRush, rushSwap, rushFlash, rushTick, rushHint, inked, openBottom, CAP, START, HOLE_RATE, CELL_HOLD, ROW_FIRST, PACE, inflowAt, panicOf } from '../src/js/ikabu/games/inkrush.js';
import { SIZE, INK_NEED, findMatches, swapWorks } from '../src/js/ikabu/games/match3.js';
import { recordRush, emptyM3, mergeM3 } from '../src/js/ikabu/games/records.js';

const N = SIZE * SIZE;
const tickTo = (g, sec) => { while (!g.over && g.rush.t < sec - 1e-9) rushTick(g, Math.min(0.5, sec - g.rush.t)); };
const playHint = (seed, secPerMove = 2, max = 600) => {
  const g = createRush({ seed });
  let n = 0;
  while (!g.over && n++ < max) { tickTo(g, g.rush.t + secPerMove); if (g.over) break; const h = rushHint(g.board); if (!h) continue; rushSwap(g, h[0], h[1]); }
  return g;
};

test('墨のがれ（第5版）：同じ種なら同じ盤面。最初は満杯で墨は入っていない。手数は無制限', () => {
  const a = createRush({ seed: '2026-09-29' }), b = createRush({ seed: '2026-09-29' });
  assert.deepEqual(a.board, b.board);
  assert.equal(a.rush.level, START);
  assert.equal(a.moves, Infinity);
  assert.equal(a.board.filter((v) => v === null).length, 0);
  assert.deepEqual(inked(a.board), []);
  assert.ok(inflowAt(0) < inflowAt(PACE[PACE.length - 1][0]));
});

test('消した所は空いたまま（落ちない・補充しない）。部屋とつながった空き間には墨が入り、その分水位が下がる', () => {
  let seen = false;
  for (let s = 0; s < 200 && !seen; s++) {
    const g = createRush({ seed: 'keep' + s });
    const h = rushHint(g.board);
    if (!h || !swapWorks(g.board, h[0], h[1])) continue;
    const before = g.board.filter((v) => v !== null).length;
    const lv = g.rush.level;
    rushSwap(g, h[0], h[1]);
    const after = g.board.filter((v) => v !== null).length;
    assert.ok(after < before, '消えた分だけ空く');
    const ink = inked(g.board).length;
    if (ink > 0) { seen = true; assert.ok(Math.abs(g.rush.level - Math.max(0, lv - ink * CELL_HOLD)) < 1e-6 || g.rush.level < lv); }
  }
  assert.ok(seen, '一番上に空きができる例が見つからなかった');
});

test('一番下まで道が通ると、時間で墨が抜け続ける', () => {
  const g = createRush({ seed: 'path' });
  for (let r = 0; r < SIZE; r++) g.board[r * SIZE + 2] = null;   // 3列目をまっすぐ空ける
  assert.ok(openBottom(g.board).includes(N - SIZE + 2));
  g.rush.open = openBottom(g.board);
  g.rush.level = 20;
  rushTick(g, 1);
  assert.ok(Math.abs(g.rush.level - (20 + inflowAt(1) - HOLE_RATE)) < 1e-9);
});

test('マークは隣の空いた所へ動かせる（そろわなくても）。空き同士は動かせない', () => {
  const g = createRush({ seed: 'slide' });
  g.board[0] = null;
  const v = g.board[1];
  const r = rushSwap(g, 1, 0);
  assert.ok(r.ok);
  assert.equal(g.board[0], v);
  assert.equal(g.board[1], null);
  g.board[2] = null;
  assert.equal(rushSwap(g, 1, 2).ok, false, '空き同士');
});

test('ROW_FIRST 秒で各列にブロックが降り、空いた所の一番下（上から見て最初のマークの手前）まで落ちる。そろわない色', () => {
  const g = createRush({ seed: 'row' });
  g.rush.level = 0;
  for (let r = 0; r < 4; r++) g.board[r * SIZE + 1] = null;   // 2列目の上4つを空ける
  tickTo(g, ROW_FIRST - 0.5);
  const tk = rushTick(g, 0.6);
  const ev = tk.events.find((e) => e.type === 'row');
  assert.ok(ev);
  const l = ev.landed.find((x) => x.at % SIZE === 1);
  assert.equal(l.at, 3 * SIZE + 1, '4段目に止まる');
  assert.equal(findMatches(g.board).length, 0);
});

test('墨フラッシュで空きは的にできない', () => {
  const g = createRush({ seed: 'flash' });
  g.board[0] = null; g.charge = INK_NEED;
  assert.equal(rushFlash(g, 0).ok, false);
});

test('水位が CAP で飲み込まれて終わる。ヒントどおりなら 15〜300 秒のあいだ', () => {
  const secs = [];
  for (let s = 0; s < 8; s++) { const g = playHint('end' + s); assert.ok(g.over); assert.equal(g.rush.reason, 'drown'); assert.equal(panicOf(g), 1); secs.push(g.rush.t); }
  const med = secs.sort((a, b) => a - b)[4];
  assert.ok(med >= 15 && med <= 300, String(secs.map(Math.round)));
});

test('記録：しのいだ秒のベストと今日の盤面のベスト。控えの統合でも残る', () => {
  const g = playHint('rec');
  let rec = recordRush(emptyM3(), g, { day: '2026-09-29' });
  assert.equal(rec.rush.best, Math.floor(g.rush.t));
  const m = mergeM3(rec, { ...emptyM3(), rush: { best: 999, bestScore: 1, played: 3, daily: { day: '2026-09-28', turns: 5 } } });
  assert.equal(m.rush.best, 999);
});

// なぞって動かす（パズドラ式・2026-09-29）
import { rushDragStep, rushDrop, near } from '../src/js/ikabu/games/inkrush.js';
test('なぞる：つかんだマークは通ったマス（斜めも）と1つずつ入れ替わり、離すまで消えない', () => {
  const g = createRush({ seed: 'drag' });
  const held = g.board[0];
  assert.ok(near(0, 1) && near(0, SIZE + 1) && !near(0, 2) && !near(SIZE - 1, SIZE));
  assert.ok(rushDragStep(g, 0, 1));
  assert.ok(rushDragStep(g, 1, SIZE + 2));   // 斜め
  assert.equal(g.board[SIZE + 2], held);
  assert.ok(!rushDragStep(g, SIZE + 2, SIZE + 4), '2マス先へは動かない');
  assert.ok(g.board.every((k) => k !== null), '離すまで消えない');
});
test('なぞる：離すとそろった所がまとめて消え、補充されない。そろわなくても動かした形のまま', () => {
  let cleared = false;
  for (let s = 0; s < 60 && !cleared; s++) {
    const g = createRush({ seed: 'drop' + s });
    // 1列目の3マスを同じ色にして、離す
    const k = g.board[SIZE * 3];
    g.board[SIZE * 3 + 1] = k; g.board[SIZE * 3 + 2] = k;
    const r = rushDrop(g, SIZE * 3);
    assert.ok(r.ok);
    if (r.steps.length) { cleared = true; assert.ok(g.board.some((x) => x === null), '消えた所は空いたまま'); }
  }
  assert.ok(cleared);
  const g2 = createRush({ seed: 'nomatch' });
  const before = [...g2.board];
  const r2 = rushDrop(g2, 0);
  assert.ok(r2.ok && r2.steps.length === 0);
  assert.deepEqual(g2.board, before);
});

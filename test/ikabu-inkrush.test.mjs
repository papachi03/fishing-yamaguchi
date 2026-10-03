import test from 'node:test';
import assert from 'node:assert/strict';
import { createRush, rushSwap, rushFlash, rushTick, rushHint, inked, openBottom, CAP, START, HOLE_RATE, CELL_HOLD, ROW_FIRST, PACE, inflowAt, panicOf } from '../src/js/ikabu/games/inkrush.js';
import { SIZE, INK_NEED, findMatches, swapWorks } from '../src/js/ikabu/games/match3.js';
import { recordRush, emptyM3, mergeM3, RUSH_BADGES, backfillRush } from '../src/js/ikabu/games/records.js';
import { readFileSync } from 'node:fs';

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
  let { rec } = recordRush(emptyM3(), g, { day: '2026-09-29' });
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

// 降ってくるブロックに、たまにライン（2026-09-29）
import { SPECIAL_RATE } from '../src/js/ikabu/games/inkrush.js';
import { isLine } from '../src/js/ikabu/games/match3.js';
test('降ってくるブロックはだいたい SPECIAL_RATE の割合でラインになり、落ちた時点ではそろっていない。同じ種なら同じ', () => {
  let lines = 0, all = 0;
  for (let s = 0; s < 80; s++) {
    const g = createRush({ seed: 'sp' + s });
    for (let c = 0; c < SIZE; c++) g.board[c] = null;   // 一番上の列を空けて、ブロックが降りられるように
    const before = g.board.map((k) => k);
    const ev = rushTick(g, ROW_FIRST + 0.01).events.find((e) => e.type === 'row');
    for (const l of ev.landed) { all++; if (isLine(g.board[l.at])) lines++; }
    assert.equal(findMatches(g.board).length, 0);
    const g2 = createRush({ seed: 'sp' + s }); for (let c = 0; c < SIZE; c++) g2.board[c] = null; rushTick(g2, ROW_FIRST + 0.01);
    assert.deepEqual(g2.board, g.board);
    void before;
  }
  const rate = lines / all;
  assert.ok(rate > SPECIAL_RATE * 0.4 && rate < SPECIAL_RATE * 2, `ラインの割合 ${rate}`);
});

// 墨ダマ・レアイカは、つかんで離すと発動（2026-09-30 友だちの感想「虹色のマスの効果が分からない・消せない」）
import { fireable } from '../src/js/ikabu/games/inkrush.js';
import { BALL, RARE, colorOf, countColors } from '../src/js/ikabu/games/match3.js';
test('離したマークが墨ダマなら、いちばん多いマークが全部消える（墨ダマも）。レアイカならまわり9マス', () => {
  assert.ok(fireable(BALL) && fireable(RARE) && !fireable(0) && !fireable(null));
  const g = createRush({ seed: 'ball' });
  const at = SIZE * 2 + 2;
  g.board[at] = BALL;
  const n = countColors(g.board);
  const top = n.indexOf(Math.max(...n));
  const r = rushDrop(g, at);
  assert.ok(r.ok && r.steps.length >= 1);
  assert.equal(r.steps[0].kind, 'ball');
  assert.ok(r.steps[0].cleared.includes(at), '墨ダマ自身も消える');
  assert.ok(g.board.every((v) => colorOf(v) !== top), 'いちばん多いマークが残っていない');
  assert.ok(r.steps[0].fx.some((f) => f.type === 'ball'), '光の筋の演出');
  const g2 = createRush({ seed: 'rare' });
  g2.board[at] = RARE;
  const r2 = rushDrop(g2, at);
  assert.equal(r2.steps[0].kind, 'blast');
  for (const d of [-SIZE - 1, -SIZE, -SIZE + 1, -1, 0, 1, SIZE - 1, SIZE, SIZE + 1]) assert.equal(g2.board[at + d], null, `まわり ${d}`);
  // ふつうのマークを離しても発動しない（そろわなければ何も起きない）
  const g3 = createRush({ seed: 'nomatch' });
  assert.equal(rushDrop(g3, 0).steps.length, 0);
});

test('墨のがれのバッジ：時間・点数・発動で取れ、2回目は新しく出ない。控えの統合で早い日付が残る', () => {
  const g = { score: 13500, rush: { t: 155, flushed: 420, fired: 1 } };
  const { rec, fresh } = recordRush(emptyM3(), g, { today: '2026-09-30' });
  assert.deepEqual(fresh, ['r_join', 'r_30s', 'r_fire', 'r_60s', 'r_5k', 'r_120s', 'r_10k', 'r_flush', 'r_150s', 'r_13k']);
  assert.equal(recordRush(rec, g, { today: '2026-10-01' }).fresh.length, 0);
  const m = mergeM3(rec, { ...emptyM3(), rush: { best: 1, bestScore: 1, played: 1, daily: null, badges: { r_join: '2026-09-29', r_18k: '2026-09-29' } } });
  assert.equal(m.rush.badges.r_join, '2026-09-29');
  assert.equal(m.rush.badges.r_18k, '2026-09-29');
  assert.equal(m.rush.badges.r_13k, '2026-09-30');
});

test('墨のがれのバッジは文言がそろっている', () => {
  const src = readFileSync(new URL('../src/js/ikabu/games/play-text.js', import.meta.url), 'utf8');
  for (const b of RUSH_BADGES) assert.ok(src.includes(b.id + ': { name:'), b.id);
});

test('バッジ以前の記録（2分35秒・13,200点）からも時間と点のバッジが付き、2回目は変えない', () => {
  const rec = backfillRush({ ...emptyM3(), rush: { best: 155, bestScore: 13200, played: 4, daily: null } }, { today: '2026-09-30' });
  assert.deepEqual(Object.keys(rec.rush.badges), ['r_join', 'r_30s', 'r_60s', 'r_5k', 'r_120s', 'r_10k', 'r_150s', 'r_13k']);
  rec.rush.badges.r_join = '2026-09-29';
  assert.equal(backfillRush(rec).rush.badges.r_join, '2026-09-29');
  assert.equal(backfillRush(emptyM3()).rush, null);
});

// ほぼ全消し・全消し（2026-10-03）：しきいを下回った瞬間に1回だけ、点とブロックの遅れ。実績（バッジ）は付けない（ぱっぱ）
import { NEAR_CLEAR, NEAR_BONUS, NEAR_DELAY, ALL_BONUS, ALL_DELAY, marksLeft } from '../src/js/ikabu/games/inkrush.js';
test('ほぼ全消し（残り3個以下）と全消し（0）で、点が増え次のブロックが遅れる。下回った瞬間だけ', () => {
  const g = createRush({ seed: 'clear' });
  // マーク4個だけ残した盤（そろわない並び）にして、1個消す形を作る
  g.board = Array(N).fill(null);
  const keep = [0, 2, 15, 28];
  keep.forEach((i, k) => { g.board[i] = k % 5; });
  g.rush.marks = marksLeft(g.board);
  assert.equal(g.rush.marks, 4);
  const s0 = g.score, n0 = g.rush.nextRow;
  g.board[28] = null;   // 1個減って3個＝ほぼ全消し
  let r = rushDrop(g, null);
  const near = r.events.find((e) => e.type === 'nearClear');
  assert.ok(near, JSON.stringify(r.events));
  assert.equal(g.score - s0 >= NEAR_BONUS, true);
  assert.equal(g.rush.nextRow, n0 + NEAR_DELAY);
  // もう一度動かしても（3個のまま）出ない
  r = rushDrop(g, null);
  assert.equal(r.events.some((e) => e.type === 'nearClear'), false);
  // 全部消えた＝全消し
  const s1 = g.score, n1 = g.rush.nextRow;
  g.board = Array(N).fill(null);
  r = rushDrop(g, null);
  const all = r.events.find((e) => e.type === 'allClear');
  assert.ok(all);
  assert.equal(g.score - s1 >= ALL_BONUS, true);
  assert.equal(g.rush.nextRow, n1 + ALL_DELAY);
  assert.equal(NEAR_CLEAR, 3);
  // 実績（バッジ）は増やしていない
  assert.equal(RUSH_BADGES.some((b) => /clear/i.test(b.id)), false);
});

// 墨つなぎ（3マッチ）の判定。画面を持たない純粋なロジックだけを試す
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, findMatches, swap, findHint, hasMove, inkFlash, SIZE, RARE, MOVES, INK_NEED, POINT,
  BALL, lineH, lineV, createdFor, colorOf,
} from '../src/js/ikabu/games/match3.js';

// 盤面を文字で書いて作る（0〜4 = 通常のマーク、R = 黒いレアイカ）。
// 手で書いた盤面に最初からそろいが混ざっていないことも確かめる
const board = (rows) => {
  const b = rows.join('').split('').map((c) => (c === 'R' ? RARE : Number(c)));
  assert.equal(findMatches(b).length, 0, 'テスト用の盤面に最初からそろいがある');
  return b;
};

test('新しい盤面は6×6で、最初からそろっている所が無く、動かせる手がある', () => {
  for (const seed of ['2026-09-24', 'a', 'b', 'c', 'd', 'e', 'f']) {
    const g = createGame({ seed });
    assert.equal(g.board.length, SIZE * SIZE);
    assert.equal(findMatches(g.board).length, 0);
    assert.ok(hasMove(g.board));
    assert.equal(g.moves, MOVES);
    assert.equal(g.score, 0);
    assert.equal(g.over, false);
  }
});

test('同じ種なら同じ盤面（今日の一戦は世界中で同じ）', () => {
  assert.deepEqual(createGame({ seed: 'x' }).board, createGame({ seed: 'x' }).board);
  assert.notDeepEqual(createGame({ seed: 'x' }).board, createGame({ seed: 'y' }).board);
});

test('横3つのそろいを見つける（縦は無し）', () => {
  const b = [
    '000123',
    '123401',
    '124012',
    '310123',
    '201234',
    '012340',
  ].join('').split('').map(Number);
  const cells = new Set(findMatches(b).flat());
  assert.deepEqual([...cells].sort((a, c) => a - c), [0, 1, 2]);
});

test('そろわない入れ替えは元に戻り、手数も減らない', () => {
  const g = createGame({ seed: 'no-match' });
  g.board = board(['012340', '123401', '234012', '340123', '401234', '012340']);
  const before = [...g.board];
  const r = swap(g, 0, 1);
  assert.equal(r.ok, false);
  assert.deepEqual(g.board, before);
  assert.equal(g.moves, MOVES);
});

test('隣でないマスとは入れ替えられない', () => {
  const g = createGame({ seed: 'far' });
  assert.equal(swap(g, 0, 2).ok, false);
  assert.equal(swap(g, 0, 7).ok, false); // ななめ
  assert.equal(swap(g, 5, 6).ok, false); // 行の端をまたぐ
  assert.equal(swap(g, 0, 0).ok, false);
});

test('そろう入れ替えで消え、点が入り、手数が1減り、盤面は埋まったまま', () => {
  const g = createGame({ seed: 'match' });
  g.board = board(['001234', '230401', '234012', '340123', '401234', '012340']);
  // 0行2列の 1 と、1行2列の 0 を入れ替えると 0行目が 0,0,0 になる
  const r = swap(g, 2, 8);
  assert.equal(r.ok, true);
  assert.ok(g.score >= 3 * POINT);
  assert.equal(g.moves, MOVES - 1);
  assert.ok(g.board.every((v) => Number.isInteger(v)), '盤面に穴が無い');
  assert.equal(findMatches(g.board).length, 0, '連鎖し終わった後はそろいが残らない');
  assert.ok(hasMove(g.board), '終わった後も動かせる手がある（無ければ混ぜ直す）');
  assert.ok(r.steps.length >= 1, '消えた段階の記録（演出用）がある');
  assert.ok(g.charge > 0, '消した数だけ墨がたまる');
});

test('4つ一直線にそろえると「ライン」が生まれる（横に並べたら、横一列を消すライン）', () => {
  const g = createGame({ seed: 'four' });
  g.board = board(['003041', '230412', '341203', '412324', '124130', '241301']);
  // 0行2列の 3 と 1行2列の 0 を入れ替えると 0行目が 0,0,0,0 になる
  const r = swap(g, 2, 8);
  assert.equal(r.ok, true);
  assert.ok(r.steps[0].created.some((c) => c.kind === lineH(0)), 'よこラインが生まれた記録');
});

test('レアイカは入れ替えるだけで使え、移った先のまわり9マスが消える', () => {
  const g = createGame({ seed: 'rare' });
  g.board = board(['012340', '1R3401', '234012', '340123', '401234', '012340']);
  const r = swap(g, 7, 8); // R が 1行2列へ移って爆発
  assert.equal(r.ok, true);
  const first = new Set(r.steps[0].cleared);
  for (const i of [1, 2, 3, 7, 8, 9, 13, 14, 15]) assert.ok(first.has(i), `${i} が消える`);
  assert.equal(g.moves, MOVES - 1);
});

test('墨がたまると墨フラッシュで、選んだマークを盤面から全部消せる（手数は使わない）', () => {
  const g = createGame({ seed: 'flash' });
  assert.equal(inkFlash(g, 0).ok, false, 'たまっていなければ使えない');
  g.charge = INK_NEED;
  const kind = g.board[0];
  const targets = g.board.map((v, i) => (v === kind ? i : -1)).filter((i) => i >= 0);
  const r = inkFlash(g, 0);
  assert.equal(r.ok, true);
  const first = new Set(r.steps[0].cleared);
  for (const i of targets) assert.ok(first.has(i));
  assert.ok(g.charge < INK_NEED, '使うと墨は空になる（連鎖した分だけたまり直す）');
  assert.equal(g.moves, MOVES);
  assert.equal(g.flashes, 1);
});

test('ヒントは、実際にそろう入れ替えを返す', () => {
  for (const seed of ['h1', 'h2', 'h3']) {
    const g = createGame({ seed });
    const h = findHint(g.board);
    assert.ok(h);
    assert.equal(swap(g, h[0], h[1]).ok, true);
  }
});

test('手数を使い切ると終わり、それ以上は動かせない', () => {
  const g = createGame({ seed: 'end' });
  g.moves = 1;
  const h = findHint(g.board);
  swap(g, h[0], h[1]);
  assert.equal(g.moves, 0);
  assert.equal(g.over, true);
  const h2 = findHint(g.board);
  assert.equal(swap(g, h2[0], h2[1]).ok, false);
  g.charge = INK_NEED;
  assert.equal(inkFlash(g, 0).ok, false, '終わった後は墨フラッシュも使えない');
});

test('連鎖するほど1匹あたりの点が上がる（段目 × 基本点）', () => {
  let seen = 0;
  for (let s = 0; s < 400 && seen < 3; s++) {
    const g = createGame({ seed: 'chain-' + s });
    const h = findHint(g.board);
    const r = swap(g, h[0], h[1]);
    if (r.steps.length < 2) continue;
    seen++;
    r.steps.forEach((st, k) => {
      if (st.kind !== 'match') return;
      assert.equal(st.points, st.cleared.length * POINT * (k + 1));
    });
    assert.equal(r.maxChain, r.steps.length);
  }
  assert.ok(seen > 0, '連鎖の起きる盤面が見つからなかった');
});

/* ---------- スペシャルパネル（2026-09-27） ---------- */
const runOf = (cells, dir, color) => ({ cells, dir, color });

test('生まれるパネル：L字・T字＝レアイカ／5つ一直線＝墨ダマ／4つ縦一列＝たてライン', () => {
  // L字：横 0,1,2 と縦 2,8,14（同じ色）→ 交わる2にレアイカ
  assert.deepEqual(createdFor([runOf([0, 1, 2], 'h', 1), runOf([2, 8, 14], 'v', 1)]), [{ at: 2, kind: RARE }]);
  assert.deepEqual(createdFor([runOf([6, 7, 8, 9, 10], 'h', 2)], [9]), [{ at: 9, kind: BALL }]);
  assert.deepEqual(createdFor([runOf([3, 9, 15, 21], 'v', 4)], [15]), [{ at: 15, kind: lineV(4) }]);
  assert.deepEqual(createdFor([runOf([0, 1, 2], 'h', 1)]), []);
});

test('ラインはふつうのイカと同じ色としてそろう。消えると一列ぜんぶ消える', () => {
  assert.equal(colorOf(lineH(3)), 3);
  assert.equal(colorOf(lineV(0)), 0);
  assert.equal(colorOf(RARE), null);
  const g = createGame({ seed: 'line' });
  const b = board(['012340', '123401', '234012', '340123', '401234', '012340']);
  // 1列目を 4(0行)・2(1行)・よこライン色2(2行) にして、0行1列と0行2列(2)を入れ替えると、縦に 2,2,ライン2 がそろう
  b[1] = 4; b[7] = 2; b[13] = lineH(2);
  g.board = b;
  const r = swap(g, 1, 2);
  assert.equal(r.ok, true);
  const first = new Set(r.steps[0].cleared);
  assert.ok(first.has(13), 'ラインもそろいに入る');
  for (const i of [12, 13, 14, 15, 16, 17]) assert.ok(first.has(i), `${i} が消える（2行目ぜんぶ）`);
  assert.ok(r.steps[0].fx.some((f) => f.type === 'line' && f.dir === 'h'));
});

test('スペシャル同士を入れ替えるとコンボ技：ライン＋ライン＝十字、レアイカ＋レアイカ＝5×5', () => {
  const g = createGame({ seed: 'combo' });
  const b = board(['012340', '123401', '234012', '340123', '401234', '012340']);
  b[14] = lineH(1); b[15] = lineV(3);
  g.board = [...b];
  const r = swap(g, 14, 15);
  assert.equal(r.ok, true);
  const first = new Set(r.steps[0].cleared);
  for (let c = 0; c < SIZE; c++) assert.ok(first.has(12 + c), '2行目ぜんぶ');
  for (let r0 = 0; r0 < SIZE; r0++) assert.ok(first.has(r0 * SIZE + 3), '3列目ぜんぶ');
  assert.ok(r.steps[0].fx.some((f) => f.type === 'combo' && f.name === 'cross'));
  const h = createGame({ seed: 'combo2' });
  const c2 = [...b]; c2[14] = RARE; c2[15] = RARE;
  h.board = c2;
  const r2 = swap(h, 14, 15);
  const f2 = new Set(r2.steps[0].cleared);
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    const rr = 2 + dr, cc = 3 + dc;
    if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) assert.ok(f2.has(rr * SIZE + cc), `${rr},${cc}`);
  }
});

test('墨ダマは入れ替えた相手と同じ色を全部消す。墨ダマ＋ラインは、その色がぜんぶラインになって発動', () => {
  const g = createGame({ seed: 'ball' });
  const b = board(['012340', '123401', '234012', '340123', '401234', '012340']);
  b[14] = BALL;
  g.board = [...b];
  const color = b[15];
  const targets = b.map((v, i) => (colorOf(v) === color ? i : -1)).filter((i) => i >= 0);
  const r = swap(g, 14, 15);
  assert.equal(r.ok, true);
  const first = new Set(r.steps[0].cleared);
  for (const i of targets) assert.ok(first.has(i));
  const h = createGame({ seed: 'ball2' });
  const c2 = [...b]; c2[15] = lineH(c2[15]);
  h.board = c2;
  const r2 = swap(h, 14, 15);
  assert.ok(r2.steps[0].fx.some((f) => f.name === 'ballline'));
  assert.ok(r2.steps[0].fx.filter((f) => f.type === 'line').length >= 3, 'その色のラインがいくつも発動');
});

test('消える範囲に別のスペシャルがあると、それも発動する（連鎖）', () => {
  const g = createGame({ seed: 'chainfx' });
  const b = board(['012340', '1R3401', '234012', '340123', '401234', '012340']);
  b[8] = lineV(3);   // レアイカ（7）の爆発の範囲に、たてライン
  g.board = [...b];
  const r = swap(g, 7, 13);   // レアイカを下へ動かして爆発（範囲に 8 のたてラインが入る）
  const first = new Set(r.steps[0].cleared);
  assert.ok(r.steps[0].fx.some((f) => f.type === 'bomb'));
  assert.ok(first.has(8), '爆発の範囲にたてラインが入る');
  for (let r0 = 0; r0 < SIZE; r0++) assert.ok(first.has(r0 * SIZE + 2), '2列目ぜんぶ（巻き込まれたたてライン）');
});


import { dailyGoals, starsOf } from '../src/js/ikabu/games/match3.js';
test('その日の目標：同じ種なら世界中で同じ。★＜★★＜★★★で、★★は2,000点以上', () => {
  const a = dailyGoals('2026-09-29');
  const b = dailyGoals('2026-09-29');
  assert.deepEqual(a, b);
  assert.ok(a.star < a.goal && a.goal < a.star3, JSON.stringify(a));
  assert.ok(a.goal >= 2000 && a.goal % 100 === 0, String(a.goal));
  assert.equal(starsOf(a.goal - 1, a), 1);
  assert.equal(starsOf(a.goal, a), 2);
  assert.equal(starsOf(a.star3, a), 3);
});

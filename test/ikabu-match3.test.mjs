// 墨つなぎ（3マッチ）の判定。画面を持たない純粋なロジックだけを試す
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, findMatches, swap, findHint, hasMove, inkFlash, SIZE, RARE, MOVES, INK_NEED, POINT,
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

test('4つ以上そろえると黒いレアイカが1匹生まれる', () => {
  const g = createGame({ seed: 'four' });
  g.board = board(['003041', '230412', '341203', '412324', '124130', '241301']);
  // 0行2列の 3 と 1行2列の 0 を入れ替えると 0行目が 0,0,0,0 になる
  const r = swap(g, 2, 8);
  assert.equal(r.ok, true);
  assert.ok(r.steps[0].created.some((c) => c.kind === RARE), 'レアイカが生まれた記録');
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

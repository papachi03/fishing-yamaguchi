// 墨のがれ：上から墨がボトボト落ちてきて、盤面の上のイカを飲み込んでいく。下のマークを消して墨を下へ落とし、
// 一番下まで落とせば盤面の外へ流れ出る（2026-09-29 ぱっぱ：ロイヤルマッチの救出ステージのイメージ）。
// 盤面・そろえ・スペシャルは墨つなぎ（match3.js）と同じ。違いは次の4つ：
//   ・手数の制限なし。競うのは「何手しのいだか」（同じなら点）
//   ・数手ごとに、予告した列の一番上へ墨が落ちる（その列の一番上の墨でないマスが墨になる＝飲み込まれる）
//   ・墨は動かせず、そろえに使えない。ただしライン・レアイカ・墨ダマの範囲に入れば流せる（＝消える）
//   ・盤面の墨が DROWN 個に達したら終わり。動かせる手が無くなったら、墨はそのままでマークだけ混ぜ直し、罰として墨が落ちる
import { createGame, swap, adjacent, cascade, dropAndFill, findMatches, findRuns, isSpecial, hasMove, SIZE, RARE, BALL, inkFlash } from './match3.js';

export const INK = 40;                 // 墨のかたまり（そろえられない・動かせない）
export const DROWN = 14;               // 盤面の墨がこの数に達したら飲み込まれる
export const STUCK_INK = 2;            // 手詰まりで混ぜ直すとき、罰として落ちる墨の数
export const FLUSH_POINT = 40;         // 墨を1つ流し出すごとの点
// 落ちるペース：[この手から, 何手ごとに, 何個]。しのぐほど速く・多く
export const PACE = [[0, 2, 1], [6, 1, 1], [14, 1, 2], [26, 1, 3]];
const N = SIZE * SIZE;
const colOf = (i) => i % SIZE;

export const paceAt = (turn) => { let p = PACE[0]; for (const q of PACE) if (turn >= q[0]) p = q; return p; };
export const inkCount = (b) => b.filter((v) => v === INK).length;
// 焦り（0〜1）：墨の割合。イカの表情はこれで決める
export const panicOf = (g) => Math.min(1, inkCount(g.board) / DROWN);

// 墨をよけた「動かせる手」：どちらも墨でなく、入れ替えるとそろう（またはスペシャルを使う）
function rushSwapWorks(b, a, c) {
  if (!adjacent(a, c) || b[a] === INK || b[c] === INK) return false;
  if (b[a] === RARE || b[c] === RARE || b[a] === BALL || b[c] === BALL) return true;
  if (isSpecial(b[a]) && isSpecial(b[c])) return true;
  const t = [...b];
  [t[a], t[c]] = [t[c], t[a]];
  return findMatches(t).length > 0;
}
export function rushHint(b) {
  for (let i = 0; i < N; i++) {
    if (colOf(i) < SIZE - 1 && rushSwapWorks(b, i, i + 1)) return [i, i + 1];
    if (i + SIZE < N && rushSwapWorks(b, i, i + SIZE)) return [i, i + SIZE];
  }
  return null;
}
export const rushHasMove = (b) => rushHint(b) !== null;

// 次に墨が落ちる列（予告用）。同じ列を選ばない
function pickColumns(g, n) {
  const cols = [];
  while (cols.length < n) {
    const c = Math.floor(g.rand() * SIZE);
    if (!cols.includes(c)) cols.push(c);
  }
  return cols.sort((a, b) => a - b);
}

export function createRush({ seed = String(Date.now()) } = {}) {
  const g = createGame({ seed: `rush:${seed}` });
  g.moves = Infinity;
  g.noShuffle = true;
  g.rush = { turn: 0, flushed: 0, next: [], reason: null };
  scheduleNext(g);
  return g;
}
function scheduleNext(g) {
  const [, every, n] = paceAt(g.rush.turn);
  const untilDrop = every - (g.rush.turn % every);   // あと何手で落ちるか（1＝次の手の後）
  g.rush.next = { cols: pickColumns(g, n), in: untilDrop };
}

// 墨を落とす：予告した列の一番上の「墨でないマス」を墨にする。列が全部墨なら何も起きない
function dropInk(g, cols) {
  const hit = [];
  for (const c of cols) {
    for (let r = 0; r < SIZE; r++) {
      const i = r * SIZE + c;
      if (g.board[i] !== INK) { g.board[i] = INK; hit.push(i); break; }
    }
  }
  return hit;
}

// 墨は液体：支えていたマークが消えて1マスでも下へ落ちた墨は、そのまま流れ落ちて盤面の外へ（点になる）。
// 落として補充した結果そろえば、その連鎖も続ける。before＝入れ替える前の盤面（どの墨が動いたかを見る）
function flushBottom(g, steps, before) {
  for (;;) {
    const bottom = [];
    for (let i = 0; i < N; i++) if (g.board[i] === INK && (i >= (SIZE - 1) * SIZE || (before && before[i] !== INK))) bottom.push(i);
    if (!bottom.length) return;
    for (const i of bottom) g.board[i] = null;
    const points = bottom.length * FLUSH_POINT;
    g.score += points;
    g.rush.flushed += bottom.length;
    before = [...g.board];   // これ以降に動いた墨だけを次の周で見る
    dropAndFill(g);
    steps.push({ kind: 'flush', cleared: bottom, created: [], points, chain: 0, fx: [], board: [...g.board] });
    if (findRuns(g.board).length) steps.push(...cascade(g, null).steps);
  }
}

// 1手：入れ替え → 連鎖 → 下に来た墨を流す → 手を数える → 予告の墨が落ちる → 飲み込まれ／手詰まりの判定
export function rushSwap(g, a, b) {
  if (g.over || !rushSwapWorks(g.board, a, b)) return { ok: false, steps: [] };
  const before = [...g.board];
  const r = swap(g, a, b);
  const steps = [...r.steps];
  // スペシャル（ライン・レアイカ・墨ダマ）の範囲で消えた墨も「流した」に数える（墨は入れ替えでは増えない）
  const blown = inkCount(before) - inkCount(g.board);
  if (blown > 0) { g.score += blown * FLUSH_POINT; g.rush.flushed += blown; steps[steps.length - 1].points += blown * FLUSH_POINT; }
  flushBottom(g, steps, before);
  return afterMove(g, steps);
}
// 墨フラッシュ（手数は使わないが、墨は落ちてくる）
export function rushFlash(g, idx) {
  if (g.over || g.board[idx] === INK) return { ok: false, steps: [] };
  const before = [...g.board];
  const r = inkFlash(g, idx);
  if (!r.ok) return r;
  const steps = [...r.steps];
  flushBottom(g, steps, before);
  return afterMove(g, steps, false);
}
// 手詰まり：墨の位置はそのまま、墨でないマークだけを混ぜ直す（そろいが無く、動かせる盤面になるまで）
function rushShuffle(g) {
  const idx = g.board.map((v, i) => (v === INK ? -1 : i)).filter((i) => i >= 0);
  for (let tries = 0; tries < 200; tries++) {
    const vals = idx.map((i) => g.board[i]);
    for (let k = vals.length - 1; k > 0; k--) { const j = Math.floor(g.rand() * (k + 1)); [vals[k], vals[j]] = [vals[j], vals[k]]; }
    const b = [...g.board]; idx.forEach((i, k) => { b[i] = vals[k]; });
    if (findMatches(b).length === 0 && rushHasMove(b)) { g.board = b; return true; }
  }
  return false;
}

function afterMove(g, steps, countTurn = true) {
  if (countTurn) g.rush.turn += 1;
  const events = [];
  if (countTurn && --g.rush.next.in <= 0) {
    const hit = dropInk(g, g.rush.next.cols);
    events.push({ type: 'ink', cells: hit });
    scheduleNext(g);
  }
  let ink = inkCount(g.board);
  if (ink < DROWN && !rushHasMove(g.board)) {
    // 手詰まり：混ぜ直して、罰の墨が落ちる（混ざらないほど墨だらけなら、飲み込まれ）
    const extra = dropInk(g, pickColumns(g, STUCK_INK));
    const ok = rushShuffle(g);
    events.push({ type: 'stuck', cells: extra, shuffled: ok });
    ink = inkCount(g.board);
    if (!ok) ink = DROWN;
  }
  if (ink >= DROWN) { g.over = true; g.rush.reason = 'drown'; }
  return { ok: true, steps, events, maxChain: steps.length, shuffled: false, panic: panicOf(g), over: g.over, reason: g.rush.reason };
}

// 墨のがれ（第4版・2026-09-29 ぱっぱ）：盤面の上にイカの部屋（岩の穴）。最初から墨がたまっていて、手を打たなくても
// 時間とともに水位が上がる（だんだん速く）。**盤面の一番下の列のマークを消すと、そこに穴が開く。穴が開いている間は墨が抜け続ける**（穴が多いほど速い）。
// 一定時間ごとに上から新しい一列が降りてきて、盤面全体が1段下がり、穴はふさがれる（栓）。また一番下を消して穴を開ける、の繰り返し。
// 水位が CAP で飲み込まれて終わり。競うのは「何秒しのいだか」。今日の盤面（と、降ってくる列）は世界中で同じ。
import { createGame, swap, swapWorks, inkFlash, cascade, findRuns, adjacent, SIZE, KINDS, FIXED } from './match3.js';

export const HOLE = FIXED;              // 一番下の穴（動かせない・そろえられない・マークが入らない）
export const CAP = 30;                  // 水位がここで飲み込まれる
export const START = 10;                // 最初の水位
export const HOLE_RATE = 1.0;           // 穴1つが1秒に抜く墨
export const OPEN_BURST = 1.5;          // 穴が開いた瞬間に抜ける墨
export const FLUSH_POINT = 20;          // 墨を1抜くごとの点
export const ROW_EVERY = 16;            // 上から一列が降る間隔（秒）。最初は ROW_FIRST 秒後
export const ROW_FIRST = 18;
// 流れ込む速さ（1秒あたり）：[この秒から, 速さ]。しのぐほど速く
export const PACE = [[0, 1.0], [20, 1.4], [40, 2.0], [60, 2.8], [90, 3.8], [120, 5.2]];
export const inflowAt = (sec) => { let v = PACE[0][1]; for (const [from, amt] of PACE) if (sec >= from) v = amt; return v; };
export const panicOf = (g) => Math.min(1, (g.rush?.level ?? 0) / CAP);
const N = SIZE * SIZE;
const colOf = (i) => i % SIZE;
const BOTTOM = (SIZE - 1) * SIZE;

export function createRush({ seed = String(Date.now()) } = {}) {
  const g = createGame({ seed: `rush:${seed}` });
  g.moves = Infinity;
  g.rush = { t: 0, level: START, flushed: 0, rows: 0, reason: null, nextRow: ROW_FIRST };
  return g;
}
export const holes = (b) => { const out = []; for (let c = 0; c < SIZE; c++) if (b[BOTTOM + c] === HOLE) out.push(c); return out; };

// 動かせる手（穴をよける）
const swapOk = (b, a, c) => adjacent(a, c) && b[a] !== HOLE && b[c] !== HOLE && swapWorks(b, a, c);
export function rushHint(b) {
  for (let i = 0; i < N; i++) {
    if (colOf(i) < SIZE - 1 && swapOk(b, i, i + 1)) return [i, i + 1];
    if (i + SIZE < N && swapOk(b, i, i + SIZE)) return [i, i + SIZE];
  }
  return null;
}
function reshuffle(g) {
  const idx = g.board.map((v, i) => (v === HOLE ? -1 : i)).filter((i) => i >= 0);
  for (let tries = 0; tries < 200; tries++) {
    const vals = idx.map((i) => g.board[i]);
    for (let k = vals.length - 1; k > 0; k--) { const j = Math.floor(g.rand() * (k + 1)); [vals[k], vals[j]] = [vals[j], vals[k]]; }
    const b = [...g.board]; idx.forEach((i, k) => { b[i] = vals[k]; });
    if (findRuns(b).length === 0 && rushHint(b)) { g.board = b; return true; }
  }
  return false;
}

// 上から一列降りる：盤面全体が1段下がり、一番下の列（穴も）は押し出される。新しい列は「隣2つと同じにならない」ように作る
function dropRow(g) {
  const b = g.board;
  for (let r = SIZE - 1; r >= 1; r--) for (let c = 0; c < SIZE; c++) b[r * SIZE + c] = b[(r - 1) * SIZE + c];
  for (let c = 0; c < SIZE; c++) {
    const ban = new Set();
    if (c >= 2 && b[c - 1] === b[c - 2]) ban.add(b[c - 1]);
    if (b[SIZE + c] === b[2 * SIZE + c]) ban.add(b[SIZE + c]);
    const ok = [...Array(KINDS).keys()].filter((k) => !ban.has(k));
    b[c] = ok[Math.floor(g.rand() * ok.length)];
  }
  g.rush.rows += 1;
  return findRuns(b).length ? cascade(g, null).steps : [];   // 降りた拍子にそろったら、その連鎖も
}

// 時間を進める：水位が上がる（穴があれば抜ける）／一列が降る。dt＝秒
export function rushTick(g, dt) {
  if (g.over || dt <= 0) return { events: [], steps: [] };
  const events = [], steps = [];
  g.rush.t += dt;
  const h = holes(g.board).length;
  const out = Math.min(g.rush.level, h * HOLE_RATE * dt);
  g.rush.level += inflowAt(g.rush.t) * dt - out;
  if (out > 0) { g.rush.flushed += out; g.score += Math.round(out * FLUSH_POINT); }
  if (g.rush.t >= g.rush.nextRow) {
    g.rush.nextRow += ROW_EVERY;
    const plugged = holes(g.board);
    steps.push(...dropRow(g));
    events.push({ type: 'row', plugged });
    if (!rushHint(g.board)) { reshuffle(g); events.push({ type: 'stuck' }); }
  }
  if (g.rush.level >= CAP) { g.rush.level = CAP; g.over = true; g.rush.reason = 'drown'; events.push({ type: 'over' }); }
  return { events, steps };
}

// 1手の後：一番下で消えたマスは穴になる（落ちてきたマークは穴から落ちて消える）
function afterMove(g, r) {
  const steps = [...r.steps];
  const events = [];
  const opened = [];
  for (const st of steps) for (const i of st.cleared) if (i >= BOTTOM && g.board[i] !== HOLE) { g.board[i] = HOLE; opened.push(i); }
  if (opened.length) {
    const burst = Math.min(g.rush.level, opened.length * OPEN_BURST);
    g.rush.level -= burst;
    g.rush.flushed += burst;
    const points = Math.round(burst * FLUSH_POINT) + opened.length * 40;
    g.score += points;
    steps.push({ kind: 'hole', cleared: [], created: [], points, chain: 0, fx: [], board: [...g.board], opened });
    events.push({ type: 'hole', cells: opened, cols: opened.map(colOf) });
  }
  if (r.shuffled) events.push({ type: 'stuck' });
  return { ok: true, steps, events, maxChain: r.maxChain, shuffled: r.shuffled, panic: panicOf(g), over: g.over };
}
export function rushSwap(g, a, b) {
  if (g.over || !swapOk(g.board, a, b)) return { ok: false, steps: [] };
  const r = swap(g, a, b);
  if (!r.ok) return r;
  return afterMove(g, r);
}
export function rushFlash(g, idx) {
  if (g.over || g.board[idx] === HOLE) return { ok: false, steps: [] };
  const r = inkFlash(g, idx);
  if (!r.ok) return r;
  return afterMove(g, r);
}

// 墨のがれ（第3版・時間制／2026-09-29 ぱっぱ）：盤面の上にイカの部屋（岩の穴）。最初から墨がたまっていて、手を打たなくても
// 時間とともに水位が上がる（だんだん速く）。マークを消すと、消したマスを墨が通って盤面の下へ抜け、水位が下がる。
// 数十秒ごとに、上から「ふた」（墨で固まったブロック）が一列分降ってくる。ふたのある列は墨が流れない。ふたの隣でそろえると壊れる。
// 水位が CAP で飲み込まれて終わり。競うのは「何秒しのいだか」。今日の盤面（と、ふたが降る時刻）は世界中で同じ。
import { createGame, swap, swapWorks, inkFlash, cascade, dropAndFill, findRuns, adjacent, SIZE, FIXED } from './match3.js';

export const LID = FIXED;               // ふた（動かせない・そろえられない・その場に留まる）
export const CAP = 30;                  // 水位がここで飲み込まれる
export const START = 12;                // 最初の水位
export const DRAIN = 1.0;               // ふたの無い列で1マス消すごとに抜ける墨
export const FLUSH_POINT = 20;          // 墨を1抜くごとの点
export const STUCK_INK = 3;             // 手詰まりで混ぜ直した罰
export const LID_EVERY = 20;            // ふたが降る間隔（秒）。最初は LID_FIRST 秒後
export const LID_FIRST = 22;
export const LID_COLS = 3;              // 一度に降るふたの数（6列のうち。全列だと抜け道が無くなって一気に終わった：2026-09-29 実機）
// 流れ込む速さ（1秒あたり）：[この秒から, 速さ]。しのぐほど速く
export const PACE = [[0, 1.2], [20, 1.6], [40, 2.2], [60, 3.0], [90, 4.0], [120, 5.5]];   // 2.5秒に1手のでたらめ50秒・2秒に1手の上手84秒・1.5秒なら107秒（rush_sim.mjs）
export const inflowAt = (sec) => { let v = PACE[0][1]; for (const [from, amt] of PACE) if (sec >= from) v = amt; return v; };
export const panicOf = (g) => Math.min(1, (g.rush?.level ?? 0) / CAP);
const N = SIZE * SIZE;
const colOf = (i) => i % SIZE;

export function createRush({ seed = String(Date.now()) } = {}) {
  const g = createGame({ seed: `rush:${seed}` });
  g.moves = Infinity;
  g.rush = { t: 0, level: START, flushed: 0, lids: 0, reason: null, nextLid: LID_FIRST };
  return g;
}

export const lidCols = (b) => { const s = new Set(); for (let i = 0; i < N; i++) if (b[i] === LID) s.add(colOf(i)); return s; };

// 時間を進める：水位が上がる／ふたが降る。dt＝秒。返り値は出来事
export function rushTick(g, dt) {
  if (g.over || dt <= 0) return [];
  const events = [];
  g.rush.t += dt;
  g.rush.level += inflowAt(g.rush.t) * dt;
  if (g.rush.t >= g.rush.nextLid) {
    g.rush.nextLid += LID_EVERY;
    const cells = [];
    const open = [...Array(SIZE).keys()].filter((c) => g.board[c] !== LID);
    for (let k = 0; k < LID_COLS && open.length; k++) { const c = open.splice(Math.floor(g.rand() * open.length), 1)[0]; g.board[c] = LID; cells.push(c); }
    cells.sort((a, b) => a - b);
    g.rush.lids += 1;
    events.push({ type: 'lid', cells });
    // ふたで手が無くなったら混ぜ直す（罰なし：時間が罰）
    if (!hasMoveWithLid(g.board)) { reshuffle(g); events.push({ type: 'stuck', amount: 0 }); }
  }
  if (g.rush.level >= CAP) { g.rush.level = CAP; g.over = true; g.rush.reason = 'drown'; events.push({ type: 'over' }); }
  return events;
}

// ふたをよけた「動かせる手」
function swapOk(b, a, c) {
  // （前は仮のゲームで swap を試していたが、乱数が一定だと補充が同じ色になり連鎖が止まらずメモリを食い尽くした：2026-09-29）
  return adjacent(a, c) && b[a] !== LID && b[c] !== LID && swapWorks(b, a, c);
}
export function rushHint(b) {
  for (let i = 0; i < N; i++) {
    if (colOf(i) < SIZE - 1 && swapOk(b, i, i + 1)) return [i, i + 1];
    if (i + SIZE < N && swapOk(b, i, i + SIZE)) return [i, i + SIZE];
  }
  return null;
}
const hasMoveWithLid = (b) => rushHint(b) !== null;
function reshuffle(g) {
  const idx = g.board.map((v, i) => (v === LID ? -1 : i)).filter((i) => i >= 0);
  for (let tries = 0; tries < 200; tries++) {
    const vals = idx.map((i) => g.board[i]);
    for (let k = vals.length - 1; k > 0; k--) { const j = Math.floor(g.rand() * (k + 1)); [vals[k], vals[j]] = [vals[j], vals[k]]; }
    const b = [...g.board]; idx.forEach((i, k) => { b[i] = vals[k]; });
    if (findRuns(b).length === 0 && hasMoveWithLid(b)) { g.board = b; return true; }
  }
  return false;
}

// 消えたマスの隣のふたを壊す。壊れたら落として補充し、そろえば連鎖も続ける
function breakLids(g, steps) {
  const near = new Set();
  for (const st of steps) for (const i of st.cleared) for (const j of [i - 1, i + 1, i - SIZE, i + SIZE]) if (adjacent(i, j) && g.board[j] === LID) near.add(j);
  if (!near.size) return [];
  const broken = [...near];
  for (const j of broken) g.board[j] = null;
  dropAndFill(g);
  steps.push({ kind: 'lidbreak', cleared: broken, created: [], points: broken.length * 50, chain: 0, fx: [], board: [...g.board] });
  g.score += broken.length * 50;
  if (findRuns(g.board).length) steps.push(...cascade(g, null).steps);
  return broken;
}

function afterMove(g, r) {
  const steps = [...r.steps];
  const broken = breakLids(g, steps);
  const events = [];
  if (broken.length) events.push({ type: 'lidbreak', cells: broken });
  // 抜ける：ふたの無い列で消したマスの数
  const blocked = lidCols(g.board);
  let cells = 0; const cols = new Set();
  for (const st of steps) for (const i of st.cleared) if (st.kind !== 'lidbreak' && !blocked.has(colOf(i))) { cells += 1; cols.add(colOf(i)); }
  const drain = Math.min(g.rush.level, cells * DRAIN);
  if (drain > 0) {
    g.rush.level -= drain;
    g.rush.flushed += drain;
    const points = Math.round(drain * FLUSH_POINT);
    g.score += points;
    events.push({ type: 'drain', cols: [...cols].sort((a, b) => a - b), amount: Math.round(drain * 10) / 10, points });
  }
  if (r.shuffled) { g.rush.level = Math.min(CAP, g.rush.level + STUCK_INK); events.push({ type: 'stuck', amount: STUCK_INK }); }
  return { ok: true, steps, events, maxChain: r.maxChain, shuffled: r.shuffled, panic: panicOf(g), over: g.over };
}

export function rushSwap(g, a, b) {
  if (g.over || !swapOk(g.board, a, b)) return { ok: false, steps: [] };
  const r = swap(g, a, b);
  if (!r.ok) return r;
  return afterMove(g, r);
}
export function rushFlash(g, idx) {
  if (g.over || g.board[idx] === LID) return { ok: false, steps: [] };
  const r = inkFlash(g, idx);
  if (!r.ok) return r;
  return afterMove(g, r);
}

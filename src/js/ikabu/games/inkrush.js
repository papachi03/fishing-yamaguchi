// 墨のがれ（A案・2026-09-29 ぱっぱ）：盤面の上にイカの部屋（岩の穴）。上の割れ目から墨が流れ込み、部屋の底から水位が上がって
// イカを足元から飲み込んでいく。盤面は部屋の床。**盤面の一番上の列のマークを消すと、その列に穴が開いて墨が盤面を通って下へ抜ける**。
// 盤面・そろえ・スペシャル・墨フラッシュは墨つなぎ（match3.js）と同じ。競うのは「何手しのいだか」（同じなら点）。
//   ・手数の制限なし。毎手、墨の水位が上がる（しのぐほど速く）
//   ・消したマスのうち一番上の列にあるものが「穴」。穴1つにつき DRAIN 分の墨が抜ける。たてライン・レアイカ・墨ダマで上の列を広く消すほど大きく抜ける
//   ・水位が CAP に達したら飲み込まれて終わり。手詰まりは混ぜ直し（墨つなぎと同じ）＋罰として墨が増える
import { createGame, swap, inkFlash, SIZE, hasMove } from './match3.js';

export const CAP = 30;                  // 水位がここで飲み込まれる
export const DRAIN = 3;                 // 一番上の列のマスを1つ消すごとに抜ける墨
export const FLUSH_POINT = 30;          // 墨を1抜くごとの点
export const STUCK_INK = 4;             // 手詰まりの罰
// 流れ込む量：[この手から, 1手ごとに増える水位]。しのぐほど速く
export const PACE = [[0, 2], [8, 3], [16, 4], [24, 5], [32, 6], [40, 8]];   // でたらめ24手・点で選ぶ34手・上の列を狙う42手（rush_sim.mjs）
export const inflowAt = (turn) => { let v = PACE[0][1]; for (const [from, amt] of PACE) if (turn >= from) v = amt; return v; };
export const panicOf = (g) => Math.min(1, (g.rush?.level ?? 0) / CAP);

export function createRush({ seed = String(Date.now()) } = {}) {
  const g = createGame({ seed: `rush:${seed}` });
  g.moves = Infinity;
  g.rush = { turn: 0, level: 0, flushed: 0, reason: null, inflow: inflowAt(0) };
  return g;
}

// 消えたマスのうち、一番上の列にあるもの＝穴（列ごとに1つ）
const holesOf = (steps) => {
  const cols = new Set();
  for (const st of steps) for (const i of st.cleared) if (i < SIZE) cols.add(i);
  return [...cols].sort((a, b) => a - b);
};

function afterMove(g, r, countTurn = true) {
  const steps = [...r.steps];
  const holes = holesOf(steps);
  const events = [];
  // 抜ける
  const drain = Math.min(g.rush.level, holes.length * DRAIN);
  if (holes.length) {
    g.rush.level -= drain;
    g.rush.flushed += drain;
    const points = drain * FLUSH_POINT;
    g.score += points;
    events.push({ type: 'drain', cols: holes, amount: drain, points });
  }
  // 手詰まりで混ぜ直した：罰の墨
  if (r.shuffled) { g.rush.level += STUCK_INK; events.push({ type: 'stuck', amount: STUCK_INK }); }
  // 手を数えて、墨が流れ込む
  if (countTurn) {
    g.rush.turn += 1;
    const inflow = inflowAt(g.rush.turn);
    g.rush.level += inflow;
    g.rush.inflow = inflowAt(g.rush.turn + 1);   // 次の手で増える量（予告）
    events.push({ type: 'rise', amount: inflow });
  }
  if (g.rush.level >= CAP) { g.over = true; g.rush.reason = 'drown'; g.rush.level = CAP; }
  return { ok: true, steps, events, holes, maxChain: r.maxChain, shuffled: r.shuffled, panic: panicOf(g), over: g.over, reason: g.rush.reason };
}

export function rushSwap(g, a, b) {
  if (g.over) return { ok: false, steps: [] };
  const r = swap(g, a, b);
  if (!r.ok) return r;
  return afterMove(g, r);
}
// 墨フラッシュ（手数は使わない＝墨は増えない。上の列に穴が開けば抜ける）
export function rushFlash(g, idx) {
  if (g.over) return { ok: false, steps: [] };
  const r = inkFlash(g, idx);
  if (!r.ok) return r;
  return afterMove(g, r, false);
}
export { hasMove as rushHasMove };

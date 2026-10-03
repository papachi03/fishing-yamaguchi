// 墨のがれ（第5版・2026-09-29 ぱっぱ A案）：盤面の上にイカの部屋（岩の穴）。最初から墨がたまっていて、時間とともに水位が上がる（だんだん速く）。
//   ・マークを消した所は**空いたまま**（上のマークは落ちない・補充しない）。部屋とつながった空き間には墨が流れ込む
//   ・部屋から空き間をつたって**一番下の列まで道が通れば、そこから墨が抜ける**（一番下で開いているマスが多いほど速い）
//   ・一定時間ごとに、各列の上から1つずつブロックが降ってきて、その列の空いた所の一番下まで落ちる（道がふさがる＝栓）
//   ・水位が CAP で飲み込まれて終わり。競うのは「何秒しのいだか」。今日の盤面（と降ってくるブロック）は世界中で同じ
import { swapMatches, createGame, swap, swapWorks, inkFlash, findMatches, adjacent, cascade, lineH, lineV, SIZE, KINDS, BALL, RARE } from './match3.js';

export const CAP = 30;                  // 水位がここで飲み込まれる
export const START = 8;                // 最初の水位
export const HOLE_RATE = 0.7;           // 一番下の開いたマス1つが1秒に抜く墨
export const OPEN_BURST = 1.2;          // 道が新しく一番下に届いた瞬間に抜ける墨（1マスごと）
export const CELL_HOLD = 0.6;           // 空き間1マスに入る墨（空き間が部屋とつながると水位が下がる／ふさがると押し戻される）
export const FLUSH_POINT = 20;          // 墨を1抜くごとの点
export const ROW_EVERY = 7;             // ブロックが降る間隔（秒）。最初は ROW_FIRST 秒後
export const ROW_FIRST = 12;
// 降ってくるブロックがスペシャル（ライン）になる確率（2026-09-29 ぱっぱ：3消しばかりでスペシャルが出ない）。
//   降ってくるのはラインだけ。墨ダマ・レアイカは5つ一直線・L字T字で生まれ、つかんで離すと発動する（rushDrop）
export const SPECIAL_RATE = 0.1;
// ほぼ全消し・全消しのごほうび（2026-10-03 ぱっぱ）。自動で400回遊ばせて全消しは0回・残り6個以下は上手な手で2%（ikabu-research/sim/rush_allclear.mjs）
//   ＝ほぼ全消しは「上手な人がたまに見る」、全消しは「伝説」。どちらも盤のマークがその数を下回った瞬間に1回（また増えてから下回れば、もう一度）
export const NEAR_CLEAR = 6;                 // 残りのマークがこれ以下で「ほぼ全消し」
export const NEAR_BONUS = 300, NEAR_DELAY = 2;     // 点・次のブロックが遅れる秒
export const ALL_BONUS = 1000, ALL_DELAY = 5;
// 流れ込む速さ（1秒あたり）：[この秒から, 速さ]。しのぐほど速く
export const PACE = [[0, 0.5], [20, 0.9], [40, 1.4], [60, 2.0], [90, 2.8], [120, 4.0], [160, 5.5]];   // 道を意識して2秒に1手で約100秒・でたらめ33秒（rush_sim.mjs）
export const inflowAt = (sec) => { let v = PACE[0][1]; for (const [from, amt] of PACE) if (sec >= from) v = amt; return v; };
export const panicOf = (g) => Math.min(1, (g.rush?.level ?? 0) / CAP);
const N = SIZE * SIZE;
const colOf = (i) => i % SIZE;
const rowOf = (i) => Math.floor(i / SIZE);
const BOTTOM = (SIZE - 1) * SIZE;

export function createRush({ seed = String(Date.now()) } = {}) {
  const g = createGame({ seed: `rush:${seed}` });
  g.moves = Infinity;
  g.noRefill = true;
  g.noShuffle = true;
  g.rush = { t: 0, level: START, flushed: 0, rows: 0, reason: null, nextRow: ROW_FIRST, open: [], held: 0 };
  return g;
}

// 部屋とつながった空き間（墨が入っているマス）。一番上の列の空きから、上下左右につながった空き
export function inked(b) {
  const seen = new Uint8Array(N);
  const q = [];
  for (let c = 0; c < SIZE; c++) if (b[c] === null) { seen[c] = 1; q.push(c); }
  while (q.length) {
    const i = q.pop();
    for (const j of [i - 1, i + 1, i - SIZE, i + SIZE]) if (adjacent(i, j) && !seen[j] && b[j] === null) { seen[j] = 1; q.push(j); }
  }
  const out = [];
  for (let i = 0; i < N; i++) if (seen[i]) out.push(i);
  return out;
}
// 墨が抜けている一番下のマス（道が通っている所）
export const openBottom = (b) => inked(b).filter((i) => i >= BOTTOM);

// 動かせる手：そろう入れ替え、または「マークを隣の空いた所へ動かす」（そろわなくても可。補充が無いので、これが無いと4〜8手で手詰まりになった）
const isMove = (b, a, c) => adjacent(a, c) && (b[a] === null) !== (b[c] === null);
const swapOk = (b, a, c) => adjacent(a, c) && !(b[a] === null && b[c] === null) && (swapWorks(b, a, c) || isMove(b, a, c));
export function rushHint(b) {
  // 順に：本当にそろう手 → 特殊パネルを使う手 → 空きへ動かすだけの手（2026-10-01 感想「アシストどおりでも連鎖しない」）
  const real = (i, j) => adjacent(i, j) && b[i] !== null && b[j] !== null && swapMatches(b, i, j);
  const both = (i, j) => adjacent(i, j) && b[i] !== null && b[j] !== null && swapWorks(b, i, j);
  for (const test of [real, both]) {
    for (let i = 0; i < N; i++) {
      if (colOf(i) < SIZE - 1 && test(i, i + 1)) return [i, i + 1];
      if (i + SIZE < N && test(i, i + SIZE)) return [i, i + SIZE];
    }
  }
  for (let i = 0; i < N; i++) {
    if (colOf(i) < SIZE - 1 && swapOk(b, i, i + 1)) return [i, i + 1];
    if (i + SIZE < N && swapOk(b, i, i + SIZE)) return [i, i + SIZE];
  }
  return null;
}

// 降ってくるブロック：各列に1つ、その列の空いた所の一番下まで落ちる。落ちてそろわない色を選ぶ
function dropBlocks(g) {
  const b = g.board;
  const landed = [];
  for (let c = 0; c < SIZE; c++) {
    // 一番下の空きより上にマークがあると、そこまでしか落ちない（上から見て最初のマークの手前）
    let top = -1;
    for (let r = 0; r < SIZE; r++) { if (b[r * SIZE + c] !== null) break; top = r * SIZE + c; }
    const i = top >= 0 ? top : -1;
    if (i < 0) continue;   // 列の一番上が埋まっている：降りられない
    const ok = [...Array(KINDS).keys()].filter((k) => { b[i] = k; const m = findMatches(b).length === 0; b[i] = null; return m; });
    const pool = ok.length ? ok : [...Array(KINDS).keys()];
    b[i] = pool[Math.floor(g.rand() * pool.length)];
    if (g.rand() < SPECIAL_RATE) b[i] = g.rand() < 0.5 ? lineH(b[i]) : lineV(b[i]);
    landed.push({ at: i, from: -1, rows: rowOf(i) + 1 });
  }
  g.rush.rows += 1;
  return landed;
}

function drainUpdate(g) {
  // 盤面の空き間に入っている墨（受け皿）：増えた分だけ部屋の水位が下がり、減った分（ふさがれた）だけ上がる
  const held = inked(g.board).length;
  const dHold = (held - g.rush.held) * CELL_HOLD;
  g.rush.held = held;
  g.rush.level = Math.max(0, g.rush.level - dHold);
  if (dHold > 0) { g.rush.flushed += dHold; g.score += Math.round(dHold * FLUSH_POINT); }
  const open = openBottom(g.board);
  const before = new Set(g.rush.open);
  const fresh = open.filter((i) => !before.has(i));
  g.rush.open = open;
  let burst = 0;
  if (fresh.length) {
    burst = Math.min(g.rush.level, fresh.length * OPEN_BURST);
    g.rush.level -= burst;
    g.rush.flushed += burst;
    g.score += Math.round(burst * FLUSH_POINT) + fresh.length * 40;
  }
  return { open, fresh, burst, dHold };
}

// 時間を進める：水位が上がる（道が通っていれば抜ける）／ブロックが降る。dt＝秒
export function rushTick(g, dt) {
  if (g.over || dt <= 0) return { events: [], steps: [] };
  const events = [];
  g.rush.t += dt;
  const out = Math.min(g.rush.level, g.rush.open.length * HOLE_RATE * dt);
  g.rush.level += inflowAt(g.rush.t) * dt - out;
  if (out > 0) { g.rush.flushed += out; g.score += Math.round(out * FLUSH_POINT); }
  if (g.rush.t >= g.rush.nextRow) {
    g.rush.nextRow += ROW_EVERY;
    const before = g.rush.open.length;
    const landed = dropBlocks(g);
    drainUpdate(g);
    g.rush.marks = marksLeft(g.board);   // ブロックが降って増えた（また減らせば、もう一度ごほうび）
    events.push({ type: 'row', landed, plugged: Math.max(0, before - g.rush.open.length) });
  }
  if (g.rush.level >= CAP) { g.rush.level = CAP; g.over = true; g.rush.reason = 'drown'; events.push({ type: 'over' }); }
  return { events, steps: [] };
}

// 盤のマークの数（空き・墨の入ったマスは数えない）
export const marksLeft = (b) => b.reduce((n, v) => n + (v === null ? 0 : 1), 0);
// ほぼ全消し・全消しの判定：しきいを下回った瞬間だけ（marks の前回の値と比べる）
function clearBonus(g) {
  const m = marksLeft(g.board);
  const prev = g.rush.marks ?? SIZE * SIZE;
  g.rush.marks = m;
  if (m === 0 && prev > 0) { g.score += ALL_BONUS; g.rush.nextRow += ALL_DELAY; g.rush.allClears = (g.rush.allClears ?? 0) + 1; return { type: 'allClear', points: ALL_BONUS, delay: ALL_DELAY }; }
  if (m <= NEAR_CLEAR && prev > NEAR_CLEAR) { g.score += NEAR_BONUS; g.rush.nextRow += NEAR_DELAY; g.rush.nearClears = (g.rush.nearClears ?? 0) + 1; return { type: 'nearClear', points: NEAR_BONUS, delay: NEAR_DELAY, left: m }; }
  return null;
}
function afterMove(g, r) {
  const d = drainUpdate(g);
  const events = [];
  const cb = clearBonus(g);   // 知らせは最後（「道が通った」より後に出して、上書きされないように）
  if (d.fresh.length) events.push({ type: 'hole', cells: d.fresh, cols: d.fresh.map(colOf), amount: Math.round(d.burst * 10) / 10 });
  if (d.dHold > 0) events.push({ type: 'fill', amount: Math.round(d.dHold * 10) / 10 });
  if (cb) events.push(cb);
  return { ok: true, steps: [...r.steps], events, maxChain: r.maxChain, shuffled: false, panic: panicOf(g), over: g.over };
}
export function rushSwap(g, a, b) {
  if (g.over || !swapOk(g.board, a, b)) return { ok: false, steps: [] };
  if (!swapWorks(g.board, a, b)) {
    // そろわない：マークを空いた所へ動かすだけ
    [g.board[a], g.board[b]] = [g.board[b], g.board[a]];
    return afterMove(g, { ok: true, steps: [], maxChain: 0, moved: true });
  }
  const r = swap(g, a, b);
  if (!r.ok) return r;
  return afterMove(g, r);
}
// なぞって動かす（2026-09-29 パズドラ式・ぱっぱ「1タップ1マスはストレス」）：押している間、つかんだマークが指について行き、
//   通ったマス（斜めも可）と1つずつ入れ替わる。そろっていても、離すまでは消えない
export const near = (a, b) => a !== b && a >= 0 && b >= 0 && a < N && b < N && Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1;
export function rushDragStep(g, from, to) {
  if (g.over || !near(from, to) || g.board[from] === null) return false;
  [g.board[from], g.board[to]] = [g.board[to], g.board[from]];
  return true;
}
// つかんで離すと発動するパネル（2026-09-30 友だちの感想「虹色のマスの効果が分からない・消せない」：このモードは入れ替えが無いので、
//   墨ダマ・レアイカは生まれても発動できなかった → 離した時に発動させる。墨ダマ＝いちばん多いマークを全部、レアイカ＝まわり9マス）
export const fireable = (v) => v === BALL || v === RARE;
// 指を離した：そろった所をまとめて消す（連鎖も）。そろわなくても動かした形のまま（補充なし）
export function rushDrop(g, at) {
  if (g.over) return { ok: false, steps: [] };
  const v = at == null ? null : g.board[at];
  const first = fireable(v) ? { kind: v === BALL ? 'ball' : 'blast', cells: [at], fx: [] } : null;   // 範囲は cascade の expand が広げる
  if (first) g.rush.fired = (g.rush.fired ?? 0) + 1;   // バッジ「切り札」用（2026-09-30）
  const r = cascade(g, first, at == null ? [] : [at]);
  return afterMove(g, r);
}
export function rushFlash(g, idx) {
  if (g.over || g.board[idx] === null) return { ok: false, steps: [] };
  const r = inkFlash(g, idx);
  if (!r.ok) return r;
  return afterMove(g, r);
}

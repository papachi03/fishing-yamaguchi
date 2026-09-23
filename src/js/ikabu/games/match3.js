// 墨つなぎ：6×6 の3マッチパズル。画面を持たない純粋なロジック（node --test で試せる）。
// 画面側は swap / inkFlash が返す steps（消えた段階ごとの記録）を順に見せれば演出になる。
import { seeded } from './rng.js';

export const SIZE = 6;
export const KINDS = 5; // いかり・太陽・波・星・貝
export const RARE = 9; // 黒いレアイカ（4つ以上そろえると生まれる）
export const MOVES = 20;
export const INK_NEED = 36; // 墨フラッシュに必要な、消した数
export const POINT = 10; // 1匹あたりの基本点（連鎖の段目を掛ける）
export const GOAL = 1500;

const N = SIZE * SIZE;
const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;
const isNormal = (v) => Number.isInteger(v) && v >= 0 && v < KINDS;
export const adjacent = (a, b) =>
  a !== b && a >= 0 && b >= 0 && a < N && b < N &&
  ((rowOf(a) === rowOf(b) && Math.abs(a - b) === 1) || (colOf(a) === colOf(b) && Math.abs(a - b) === SIZE));

// 横・縦に3つ以上並んだ同じマークのまとまりを返す（各まとまりはマス番号の配列）
export function findMatches(b) {
  const groups = [];
  const scan = (start, step, count) => {
    let run = [start];
    for (let k = 1; k <= count; k++) {
      const i = start + step * k;
      const same = k < count && isNormal(b[i]) && b[i] === b[run[0]];
      if (same) {
        run.push(i);
      } else {
        if (run.length >= 3 && isNormal(b[run[0]])) groups.push(run);
        run = [i];
      }
    }
  };
  for (let r = 0; r < SIZE; r++) scan(r * SIZE, 1, SIZE);
  for (let c = 0; c < SIZE; c++) scan(c, SIZE, SIZE);
  return groups;
}

// 入れ替えてみて、そろうか（またはレアイカを動かすか）を調べる。盤面は変えない
function swapWorks(b, a, c) {
  if (!adjacent(a, c)) return false;
  if (b[a] === RARE || b[c] === RARE) return true;
  const t = [...b];
  [t[a], t[c]] = [t[c], t[a]];
  return findMatches(t).length > 0;
}

export function findHint(b) {
  for (let i = 0; i < N; i++) {
    if (colOf(i) < SIZE - 1 && swapWorks(b, i, i + 1)) return [i, i + 1];
    if (rowOf(i) < SIZE - 1 && swapWorks(b, i, i + SIZE)) return [i, i + SIZE];
  }
  return null;
}
export const hasMove = (b) => findHint(b) !== null;

// そろいが無く、動かせる手がある盤面になるまで作り直す
function freshBoard(rand) {
  for (;;) {
    const b = new Array(N);
    for (let i = 0; i < N; i++) {
      // 左2つ・上2つと同じにならないマークを選ぶ（最初からそろわないように）
      const ban = new Set();
      if (colOf(i) >= 2 && b[i - 1] === b[i - 2]) ban.add(b[i - 1]);
      if (rowOf(i) >= 2 && b[i - SIZE] === b[i - 2 * SIZE]) ban.add(b[i - SIZE]);
      const ok = [...Array(KINDS).keys()].filter((k) => !ban.has(k));
      b[i] = ok[Math.floor(rand() * ok.length)];
    }
    if (findMatches(b).length === 0 && hasMove(b)) return b;
  }
}

function shuffle(g) {
  for (let tries = 0; tries < 200; tries++) {
    const b = [...g.board];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(g.rand() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    if (findMatches(b).length === 0 && hasMove(b)) {
      g.board = b;
      return;
    }
  }
  g.board = freshBoard(g.rand); // どうしても混ざらないときは作り直す
}

export function createGame({ seed = String(Date.now()) } = {}) {
  const rand = seeded(seed);
  return { board: freshBoard(rand), rand, moves: MOVES, score: 0, charge: 0, flashes: 0, maxChain: 0, cleared: 0, over: false };
}

const blastCells = (center) => {
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const r = rowOf(center) + dr;
      const c = colOf(center) + dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push(r * SIZE + c);
    }
  return out;
};

// 消えたマスを下に詰め、上から新しいマークを入れる
function dropAndFill(g) {
  for (let c = 0; c < SIZE; c++) {
    const col = [];
    for (let r = SIZE - 1; r >= 0; r--) {
      const v = g.board[r * SIZE + c];
      if (v !== null) col.push(v);
    }
    for (let r = SIZE - 1, k = 0; r >= 0; r--, k++) {
      g.board[r * SIZE + c] = k < col.length ? col[k] : Math.floor(g.rand() * KINDS);
    }
  }
}

// 1段分を消して記録する
function clearStep(g, kind, cells, chain, created = []) {
  const set = new Set(cells);
  for (const c of created) set.delete(c.at);
  const cleared = [...set].sort((a, b) => a - b);
  const points = cleared.length * POINT * chain;
  for (const i of cleared) g.board[i] = null;
  for (const c of created) g.board[c.at] = c.kind;
  g.score += points;
  g.cleared += cleared.length;
  // 墨フラッシュで消した分は墨に戻さない（連続で撃てないように）
  if (kind !== 'flash') g.charge = Math.min(INK_NEED, g.charge + cleared.length);
  dropAndFill(g);
  return { kind, cleared, created, points, chain, board: [...g.board] };
}

// そろいが無くなるまで連鎖させる。first は最初の段（爆発・墨フラッシュ）で、無ければそろいから始める
function cascade(g, first, prefer = []) {
  const steps = [];
  if (first) steps.push(clearStep(g, first.kind, first.cells, 1));
  for (;;) {
    const groups = findMatches(g.board);
    if (!groups.length) break;
    const chain = steps.length + 1;
    const cells = groups.flat();
    // 4つ以上のまとまりからは、レアイカを1匹生む（入れ替えたマスが含まれていればそこに）
    const created = [];
    for (const grp of groups) {
      if (grp.length < 4) continue;
      const at = grp.find((i) => prefer.includes(i)) ?? grp[Math.floor(grp.length / 2)];
      if (!created.some((c) => c.at === at)) created.push({ at, kind: RARE });
    }
    steps.push(clearStep(g, 'match', cells, chain, created));
    prefer = [];
  }
  g.maxChain = Math.max(g.maxChain, steps.length);
  let shuffled = false;
  if (!hasMove(g.board)) {
    shuffle(g);
    shuffled = true;
  }
  return { ok: true, steps, maxChain: steps.length, shuffled };
}

export function swap(g, a, b) {
  if (g.over || !adjacent(a, b) || !swapWorks(g.board, a, b)) return { ok: false, steps: [] };
  [g.board[a], g.board[b]] = [g.board[b], g.board[a]];
  let first = null;
  const rares = [a, b].filter((i) => g.board[i] === RARE);
  if (rares.length) first = { kind: 'blast', cells: [...new Set(rares.flatMap(blastCells))] };
  const res = cascade(g, first, [a, b]);
  g.moves -= 1;
  if (g.moves <= 0) g.over = true;
  return res;
}

// 墨フラッシュ：選んだマスと同じマークを全部消す（レアイカを選んだらその場で爆発）。手数は使わない
export function inkFlash(g, idx) {
  if (g.over || g.charge < INK_NEED || idx < 0 || idx >= N) return { ok: false, steps: [] };
  const kind = g.board[idx];
  const cells = kind === RARE ? blastCells(idx) : g.board.map((v, i) => (v === kind ? i : -1)).filter((i) => i >= 0);
  g.charge = 0;
  g.flashes += 1;
  return cascade(g, { kind: 'flash', cells });
}

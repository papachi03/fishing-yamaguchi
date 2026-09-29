// 墨つなぎ：6×6 の3マッチパズル。画面を持たない純粋なロジック（node --test で試せる）。
// 画面側は swap / inkFlash が返す steps（消えた段階ごとの記録）を順に見せれば演出になる。
import { seeded } from './rng.js';

export const SIZE = 6;
export const KINDS = 5; // いかり・太陽・波・星・貝
export const RARE = 9; // 黒いレアイカ（L字・T字にそろえると生まれる。動かすとまわり3×3が消える）
// スペシャルパネル（2026-09-27 ぱっぱ：一直線に消すパネル・スペシャル同士のコンボ）
//   よこライン＝10+色（4つ横一列で生まれる。消えると横一列を消す）、たてライン＝20+色（4つ縦一列）。色はふつうのイカと同じにそろう
//   墨ダマ＝BALL（5つ一直線で生まれる。入れ替えた相手と同じ色を全部消す）
export const LINE_H = 10;
export const LINE_V = 20;
export const BALL = 30;
export const lineH = (color) => LINE_H + color;
export const lineV = (color) => LINE_V + color;
// そろえる時の色（ふつう0〜4・ラインはその色・レアイカと墨ダマは色なし＝null）
export const colorOf = (v) => (Number.isInteger(v) && v >= 0 && v < KINDS ? v : Number.isInteger(v) && v >= LINE_H && v < LINE_V + KINDS && v % 10 < KINDS ? v % 10 : null);
export const isLine = (v) => Number.isInteger(v) && v >= LINE_H && v < LINE_V + KINDS;
export const isSpecial = (v) => v === RARE || v === BALL || isLine(v);
export const MOVES = 20;
export const INK_NEED = 36; // 墨フラッシュに必要な、消した数
export const POINT = 10; // 1匹あたりの基本点
// 点の配分（2026-09-29）：連鎖（運）の倍率を緩め、自分で狙った技（特殊パネルを作る・使う）を厚くする。
//   直す前は点の6割が「自分で選んだ後の連鎖」で決まり、でたらめに動かしても上手な手と点が変わらなかった
export const CHAIN_MULT = (chain) => 1 + 0.5 * (chain - 1);   // 1, 1.5, 2, 2.5 …（前は 1, 2, 3, 4）
export const SKILL_MULT = 2;      // ライン・レアイカ・墨ダマ・コンボで消したマスは2倍
export const BORN_BONUS = 60;     // 特殊パネルを1つ作るごとに（狙って作れる予告とセット）
export const FLASH_BIG = 10;      // 墨フラッシュで一度にこれ以上消せたら「大ぶしゅー」＝1.5倍
export const GOAL = 1500;   // ★（一つ星のバッジの線）。★★＝その日の目標、★★★はその上（dailyGoals）

const N = SIZE * SIZE;
const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;
const isNormal = (v) => colorOf(v) !== null;   // そろえられる（ふつうのイカとライン）
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
      const same = k < count && isNormal(b[i]) && colorOf(b[i]) === colorOf(b[run[0]]);
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

// そろいを向きつきで返す：[{ cells, dir: 'h'|'v', color }]
export function findRuns(b) {
  const runs = [];
  for (const grp of findMatches(b)) runs.push({ cells: grp, dir: grp.length > 1 && grp[1] - grp[0] === 1 ? 'h' : 'v', color: colorOf(b[grp[0]]) });
  return runs;
}

// 入れ替えてみて、そろうか（またはレアイカ・墨ダマを動かすか、スペシャル同士か）を調べる。盤面は変えない
export function swapWorks(b, a, c) {
  if (!adjacent(a, c)) return false;
  if (b[a] === RARE || b[c] === RARE || b[a] === BALL || b[c] === BALL) return true;
  if (isSpecial(b[a]) && isSpecial(b[c])) return true;
  const t = [...b];
  [t[a], t[c]] = [t[c], t[a]];
  return findMatches(t).length > 0;
}

// 入れ替えの予告（2026-09-29 狙って作る楽しさ）：null＝そろわない／{ special }＝そろう（special は特殊パネルができる・使う）
export function previewSwap(b, a, c) {
  if (!swapWorks(b, a, c)) return null;
  if (isSpecial(b[a]) || isSpecial(b[c])) return { special: true };
  const t = [...b];
  [t[a], t[c]] = [t[c], t[a]];
  return { special: createdFor(findRuns(t), [a, c]).length > 0 };
}
// 色ごとの数（墨フラッシュで何を消すか選ぶ材料）
export const countColors = (b) => { const n = Array(KINDS).fill(0); for (const v of b) { const c = colorOf(v); if (c != null) n[c] += 1; } return n; };
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

const rowCells = (i) => Array.from({ length: SIZE }, (_, c) => rowOf(i) * SIZE + c);
const colCells = (i) => Array.from({ length: SIZE }, (_, r) => r * SIZE + colOf(i));
const blastCells = (center, R = 1) => {
  const out = [];
  for (let dr = -R; dr <= R; dr++)
    for (let dc = -R; dc <= R; dc++) {
      const r = rowOf(center) + dr;
      const c = colOf(center) + dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push(r * SIZE + c);
    }
  return out;
};

// 消えたマスを下に詰め、上から新しいマークを入れる
// FIXED（墨のがれの「ふた」）はその場に留まり、ほかのマークはそれをよけて詰まる
export const FIXED = 41;
export function dropAndFill(g) {
  if (g.noRefill) return;   // 墨のがれ（第5版）：消した所は空いたまま（落ちない・補充しない）
  for (let c = 0; c < SIZE; c++) {
    const col = [];
    for (let r = SIZE - 1; r >= 0; r--) {
      const v = g.board[r * SIZE + c];
      if (v !== null && v !== FIXED) col.push(v);
    }
    for (let r = SIZE - 1, k = 0; r >= 0; r--) {
      const i = r * SIZE + c;
      if (g.board[i] === FIXED) continue;
      g.board[i] = k < col.length ? col[k] : Math.floor(g.rand() * KINDS);
      k++;
    }
  }
}

// 盤面でいちばん多い色（墨ダマが巻き込まれた時・レアイカと入れ替えた時に使う）
function commonColor(b) {
  const n = new Array(KINDS).fill(0);
  for (const v of b) { const c = colorOf(v); if (c !== null) n[c] += 1; }
  return n.indexOf(Math.max(...n));
}
const colorCells = (b, color) => b.map((v, i) => (colorOf(v) === color ? i : -1)).filter((i) => i >= 0);
// 消す範囲にスペシャルパネルが入っていたら、それも発動させて範囲を広げる（連鎖）。fx＝演出の記録（ライン・爆発・墨ダマ）
function expand(b, cells, fx, fired = new Set()) {
  const set = new Set(cells);
  const queue = [...set];
  while (queue.length) {
    const i = queue.shift();
    const v = b[i];
    if (!isSpecial(v) || fired.has(i)) continue;
    fired.add(i);
    let add = [];
    if (isLine(v) && v < LINE_V) { add = rowCells(i); fx.push({ type: 'line', dir: 'h', at: i }); }
    else if (isLine(v)) { add = colCells(i); fx.push({ type: 'line', dir: 'v', at: i }); }
    else if (v === RARE) { add = blastCells(i); fx.push({ type: 'bomb', at: i, r: 1 }); }
    else if (v === BALL) { const color = commonColor(b); add = colorCells(b, color); fx.push({ type: 'ball', at: i, color, cells: add }); }
    for (const j of add) if (!set.has(j)) { set.add(j); queue.push(j); }
  }
  return [...set];
}

// 1段分を消して記録する
function clearStep(g, kind, cells0, chain, created = [], fx = []) {
  const cells = expand(g.board, cells0, fx);
  const set = new Set(cells);
  for (const c of created) set.delete(c.at);
  const cleared = [...set].sort((a, b) => a - b);
  const skill = kind !== 'match' && kind !== 'flash';   // ライン・爆発・墨ダマ・コンボ（自分で撃った技）
  const big = kind === 'flash' && cleared.length >= FLASH_BIG;
  const points = Math.round(cleared.length * POINT * CHAIN_MULT(chain) * (skill ? SKILL_MULT : 1) * (big ? 1.5 : 1)) + created.length * BORN_BONUS;
  for (const i of cleared) g.board[i] = null;
  for (const c of created) g.board[c.at] = c.kind;
  g.score += points;
  g.cleared += cleared.length;
  // 墨フラッシュで消した分は墨に戻さない（連続で撃てないように）
  if (kind !== 'flash') g.charge = Math.min(INK_NEED, g.charge + cleared.length);
  dropAndFill(g);
  return { kind, cleared, created, points, chain, fx, big, board: [...g.board] };
}

// そろいが無くなるまで連鎖させる。first は最初の段（爆発・墨フラッシュ）で、無ければそろいから始める
export function cascade(g, first, prefer = []) {
  const steps = [];
  if (first) steps.push(clearStep(g, first.kind, first.cells, 1, [], first.fx ?? []));
  for (;;) {
    const runs = findRuns(g.board);
    if (!runs.length) break;
    const chain = steps.length + 1;
    const cells = runs.flatMap((r) => r.cells);
    steps.push(clearStep(g, 'match', cells, chain, createdFor(runs, prefer)));
    prefer = [];
  }
  g.maxChain = Math.max(g.maxChain, steps.length);
  let shuffled = false;
  // 墨のがれ（inkrush.js）は混ぜ直さず「手詰まり＝終わり」にする（g.noShuffle）
  if (!hasMove(g.board) && !g.noShuffle) {
    shuffle(g);
    shuffled = true;
  }
  return { ok: true, steps, maxChain: steps.length, shuffled };
}

// そろいから生まれるパネル。入れ替えたマス（prefer）が含まれていればそこに、無ければまとまりの真ん中に
//   同じ色の横と縦のそろいが交わる（L字・T字）→ レアイカ／5つ以上一直線 → 墨ダマ／4つ一直線 → ライン（横なら横一列を消す）
export function createdFor(runs, prefer = []) {
  const created = [];
  const used = new Set();
  const put = (cells, kind) => {
    const at = cells.find((i) => prefer.includes(i)) ?? cells[Math.floor(cells.length / 2)];
    if (created.some((c) => c.at === at)) return;
    created.push({ at, kind });
  };
  runs.forEach((h, x) => {
    if (h.dir !== 'h') return;
    runs.forEach((v, y) => {
      if (v.dir !== 'v' || v.color !== h.color || used.has(x) || used.has(y)) return;
      const cross = h.cells.find((i) => v.cells.includes(i));
      if (cross == null) return;
      used.add(x); used.add(y);
      created.push({ at: cross, kind: RARE });
    });
  });
  runs.forEach((r, x) => {
    if (used.has(x)) return;
    if (r.cells.length >= 5) put(r.cells, BALL);
    else if (r.cells.length === 4) put(r.cells, r.dir === 'h' ? lineH(r.color) : lineV(r.color));
  });
  return created;
}

// 入れ替えた2マスがスペシャルの時の、最初の段（コンボ技）。b はもう入れ替えた後の盤面、a→b へ動かした
function specialFirst(board, a, b) {
  const A = board[a], B = board[b];
  const fx = [];
  const both = isSpecial(A) && isSpecial(B);
  if (A === BALL && B === BALL) { fx.push({ type: 'combo', name: 'ballball', at: b }); return { kind: 'combo', cells: board.map((_, i) => i), fx }; }
  if (A === BALL || B === BALL) {
    const ball = A === BALL ? a : b;
    const other = A === BALL ? b : a;
    const ov = board[other];
    if (ov === RARE) {
      const color = commonColor(board);
      fx.push({ type: 'combo', name: 'ballrare', at: other }, { type: 'ball', at: ball, color, cells: colorCells(board, color) });
      return { kind: 'combo', cells: [ball, ...colorCells(board, color), ...blastCells(other)], fx };
    }
    const color = colorOf(ov);
    const targets = colorCells(board, color);
    if (isLine(ov)) {
      // 墨ダマ＋ライン：その色がぜんぶラインに変わって一斉に発動
      for (const i of targets) board[i] = ov < LINE_V ? lineH(color) : lineV(color);
      fx.push({ type: 'combo', name: 'ballline', at: other });
    }
    fx.push({ type: 'ball', at: ball, color, cells: targets });
    return { kind: both ? 'combo' : 'ball', cells: [ball, ...targets], fx };
  }
  if (both) {
    // ライン＋ライン＝十字／ライン＋レアイカ＝太い十字（3行・3列）／レアイカ＋レアイカ＝5×5
    const lines = [A, B].filter(isLine).length;
    const at = b;
    if (lines === 2) { fx.push({ type: 'combo', name: 'cross', at }, { type: 'line', dir: 'h', at }, { type: 'line', dir: 'v', at }); return { kind: 'combo', cells: [a, ...rowCells(at), ...colCells(at)], fx, fired: [a, b] }; }
    if (lines === 1) {
      const cells = [a];
      for (let d = -1; d <= 1; d++) {
        const r = rowOf(at) + d, c = colOf(at) + d;
        if (r >= 0 && r < SIZE) cells.push(...rowCells(r * SIZE));
        if (c >= 0 && c < SIZE) cells.push(...colCells(c));
      }
      fx.push({ type: 'combo', name: 'bigcross', at });
      return { kind: 'combo', cells, fx, fired: [a, b] };
    }
    fx.push({ type: 'combo', name: 'bigbomb', at }, { type: 'bomb', at, r: 2 });
    return { kind: 'combo', cells: [a, ...blastCells(at, 2)], fx, fired: [a, b] };
  }
  const rares = [a, b].filter((i) => board[i] === RARE);
  if (rares.length) return { kind: 'blast', cells: rares.flatMap((i) => blastCells(i)), fx: [] };
  return null;
}

export function swap(g, a, b) {
  if (g.over || !adjacent(a, b) || !swapWorks(g.board, a, b)) return { ok: false, steps: [] };
  [g.board[a], g.board[b]] = [g.board[b], g.board[a]];
  const first = specialFirst(g.board, a, b);
  if (first?.fired) {
    // コンボに使った2つは、その場で発動済み（範囲の中でもう一度起動しない）
    for (const i of first.fired) g.board[i] = colorOf(g.board[i]) ?? 0;
  }
  const res = cascade(g, first ? { kind: first.kind, cells: [...new Set(first.cells)], fx: first.fx } : null, [a, b]);
  g.moves -= 1;
  if (g.moves <= 0) g.over = true;
  return res;
}

// 墨フラッシュ：選んだマスと同じマークを全部消す（レアイカを選んだらその場で爆発）。手数は使わない
// その日の盤面の目標（2026-09-29）：でたらめに動かしても4回に3回は1,500点に届いていたので、盤面ごとに「上手に選んで届くかどうか」の線を機械で決める。
//   決め方：この種で、毎手「そろえた瞬間の点（連鎖や落ちてくるマークの運は見ない＝人と同じ見え方）がいちばん大きい入れ替え」を選んで20手遊んだ点。
//   落ちてくるマークは種から決まるので、世界中で同じ目標になる。
//   ★＝1,500（バッジの線のまま）／★★＝その8割（今日の目標）／★★★＝その105%。100点単位に丸める
export function dailyGoals(seed) {
  const g = createGame({ seed });
  for (let m = 1; m <= MOVES && !g.over; m++) {
    let best = null, bestPts = -1;
    for (let i = 0; i < N; i++) {
      for (const j of [i + 1, i + SIZE]) {
        if (!adjacent(i, j) || (j === i + 1 && colOf(i) === SIZE - 1)) continue;
        const t = { ...g, board: [...g.board], rand: seeded(`${seed}:goal:${m}:${i}:${j}`) };
        const r = swap(t, i, j);
        if (!r?.ok) continue;
        const pts = r.steps[0]?.points ?? 0;   // 最初の段だけ（その先の連鎖は運）
        if (pts > bestPts) { best = [i, j]; bestPts = pts; }
      }
    }
    if (!best) break;
    swap(g, best[0], best[1]);   // 本番と同じ乱数の流れで進める
  }
  const round100 = (x) => Math.max(0, Math.round(x / 100) * 100);
  const goal = Math.max(GOAL + 500, round100(g.score * 0.8));
  return { star: GOAL, goal, star3: Math.max(goal + 700, round100(g.score * 1.05)), model: g.score };
}
export const starsOf = (score, goals) => (score >= goals.star3 ? 3 : score >= goals.goal ? 2 : score >= goals.star ? 1 : 0);

export function inkFlash(g, idx) {
  if (g.over || g.charge < INK_NEED || idx < 0 || idx >= N) return { ok: false, steps: [] };
  const kind = g.board[idx];
  const color = colorOf(kind);
  const cells = color === null ? [idx] : colorCells(g.board, color);   // スペシャル（レアイカ・墨ダマ）を選んだら、その場で発動
  g.charge = 0;
  g.flashes += 1;
  return cascade(g, { kind: 'flash', cells });
}

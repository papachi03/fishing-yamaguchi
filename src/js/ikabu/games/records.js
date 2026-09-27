// あそび場の記録（このブラウザだけに残る）。localStorage は読めない・書けない環境があるので必ず try/catch で包む。
// バッジの判定は純粋関数（node --test で試せる）。
import { GOAL } from './match3.js';
import { POINTS, catchPoints } from './progress.js';

export const KEY_EGI = 'ikabu.egi.v1';
export const KEY_M3 = 'ikabu.sumi.v1';

// 墨つなぎのバッジ（小松氏の設計案）。check は1戦の結果 { score, maxChain, flashes } を受ける
export const BADGES = [
  { id: 'join', check: () => true },                       // 入部しました：1戦を完走
  { id: 'star1', check: (g) => g.score >= GOAL },          // 一つ星のイカ：1,500点
  { id: 'skilled', check: (g) => g.score >= 2400 },        // イカした腕前：2,400点
  { id: 'chain', check: (g) => g.maxChain >= 3 },          // 連鎖の達人：3連鎖
  { id: 'ink', check: (g) => g.flashes >= 2 },             // 墨の使い手：1戦で墨フラッシュ2回
  { id: 'captain', check: (g) => g.score >= 3500 },        // 部長への道：3,500点
];

export const badgesFor = (g) => BADGES.filter((b) => b.check(g)).map((b) => b.id);

export function readJSON(key) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ---------- 記録を消さないために（2026-09-27 ぱっぱ：1年かけてそろえる図鑑が突然消えると、一気にやる気がなくなる） ----------
 * readRecord / writeRecord：
 *   書くたびに、同じ記録を「控え」（キー.bak）にも書く。本体が読めない形に壊れていたら控えから戻す。
 *   （はじめは「1つ前」を控えにしていたが、1回しか書いていないと控えが無く戻せなかった→最新と同じ物を控えに）
 *   壊れた本体は、上書きする前に「キー.broken」へ退避する（白紙のまま上書きして記録を失わない）
 */
const BAK = (key) => `${key}.bak`;
const BROKEN = (key) => `${key}.broken`;
const store = () => globalThis.localStorage;

export function readRecord(key) {
  let broken = false;
  try {
    const raw = store()?.getItem(key);
    if (raw) {
      try { return { value: JSON.parse(raw), source: 'main', broken: false }; } catch { broken = true; }
    }
    const bak = store()?.getItem(BAK(key));
    if (bak) {
      try { return { value: JSON.parse(bak), source: 'backup', broken }; } catch { /* 控えも読めない */ }
    }
  } catch { /* 読めない環境 */ }
  return { value: null, source: 'none', broken };
}

export function writeRecord(key, value) {
  try {
    const st = store();
    if (!st) return false;
    const cur = st.getItem(key);
    if (cur) {
      let ok = true;
      try { JSON.parse(cur); } catch { ok = false; }
      if (!ok && !st.getItem(BROKEN(key))) st.setItem(BROKEN(key), cur);
    }
    const text = JSON.stringify(value);
    st.setItem(key, text);
    try { st.setItem(BAK(key), text); } catch { /* 控えが書けなくても本体は書けている */ }
    return true;
  } catch {
    return false;
  }
}

// このブラウザで記録を保存できるか（プライベートブラウズ・保存を切っている設定では false）
export function storageWorks() {
  try {
    const st = store();
    if (!st) return false;
    st.setItem('ikabu.probe', '1');
    const ok = st.getItem('ikabu.probe') === '1';
    st.removeItem('ikabu.probe');
    return ok;
  } catch {
    return false;
  }
}

/* ---------- 墨つなぎ ---------- */

export const emptyM3 = () => ({ best: 0, played: 0, goals: 0, badges: {}, daily: null });

// 1戦の結果を記録に足す。新しく取れたバッジの id を返す
export function recordM3(rec, g, { day = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const r = rec ?? emptyM3();
  r.played += 1;
  r.best = Math.max(r.best, g.score);
  if (g.score >= GOAL) r.goals += 1;
  if (day) r.daily = { day, score: Math.max(r.daily?.day === day ? r.daily.score : 0, g.score) };
  const fresh = [];
  for (const id of badgesFor(g)) {
    if (!r.badges[id]) {
      r.badges[id] = today;
      fresh.push(id);
    }
  }
  return { rec: r, fresh };
}

/* ---------- しゃくって抱かせろ！ ---------- */

// points＝部員レベルの釣りポイント、gedo＝外道の記録（2026-09-27。progress.js）
export const emptyEgi = () => ({ best: 0, sessions: 0, species: {}, bestOne: null, points: 0, gedo: {} });

const dayOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// 釣り上げた1杯を、その場で記録に足す（2026-09-27：釣行の途中でページを閉じても消えないように）。
// tripTotal＝この釣行でここまでに釣った合計（自己ベストもその場で更新）。初めての種なら fresh=true
export function recordEgiCatch(rec, c, { counted = true, date = new Date(), tripTotal = c.weight } = {}) {
  const r = rec ?? emptyEgi();
  if (!counted) return { rec: r, fresh: false, points: 0 };
  const fresh = !r.species[c.id];
  if (fresh) r.species[c.id] = { count: 0, weight: 0, mantle: 0, first: dayOf(date) };
  const sp = r.species[c.id];
  sp.count += 1;
  sp.weight = Math.max(sp.weight, c.weight);
  sp.mantle = Math.max(sp.mantle, c.mantle);
  if (!r.bestOne || c.weight > r.bestOne.weight) r.bestOne = { id: c.id, weight: c.weight, mantle: c.mantle };
  r.best = Math.max(r.best, tripTotal);
  const points = catchPoints(c, { fresh });
  r.points = (r.points ?? 0) + points;
  return { rec: r, fresh, points };
}

// 外道（カサゴ・海藻・長靴など）を1つ記録に足す。図鑑とは別。初めてなら fresh=true
export function recordGedo(rec, g, { counted = true, date = new Date() } = {}) {
  const r = rec ?? emptyEgi();
  if (!counted) return { rec: r, fresh: false, points: 0 };
  r.gedo = r.gedo ?? {};
  const fresh = !r.gedo[g.id];
  if (fresh) r.gedo[g.id] = { count: 0, weight: 0, first: dayOf(date) };
  r.gedo[g.id].count += 1;
  r.gedo[g.id].weight = Math.max(r.gedo[g.id].weight, g.weight ?? 0);
  r.points = (r.points ?? 0) + POINTS.gedo;
  return { rec: r, fresh, points: POINTS.gedo };
}

// 釣行を終えた（釣果は1杯ずつ記録済み）：釣行の数と自己ベストだけ
export function recordEgiTrip(rec, catches, { counted = true } = {}) {
  const r = rec ?? emptyEgi();
  const total = catches.reduce((sum, c) => sum + c.weight, 0);
  if (!counted) return { rec: r, total, counted: false, points: 0 };
  r.sessions += 1;
  r.best = Math.max(r.best, total);
  r.points = (r.points ?? 0) + POINTS.trip;   // 最後まで釣った（ボウズでも）
  return { rec: r, total, counted: true, points: POINTS.trip };
}

// 1釣行の結果（catches = [{ id, weight, mantle }]）を記録に足す。初めて釣った種の id を返す。
// counted=false（季節モード・練習）は図鑑にも自己ベストにも数えない（ダディ指示 2026-09-25：
// 「実際のシーズンで釣って図鑑に記録しよう！」＝簡単にコンプさせない）。date は初めて釣った日の記録用
export function recordEgi(rec, catches, { counted = true, date = new Date() } = {}) {
  let r = rec ?? emptyEgi();
  const fresh = [];
  let sum = 0;
  for (const c of catches) {
    sum += c.weight;
    const got = recordEgiCatch(r, c, { counted, date, tripTotal: sum });
    r = got.rec;
    if (got.fresh) fresh.push(c.id);
  }
  const t = recordEgiTrip(r, catches, { counted });
  return { rec: t.rec, fresh, total: t.total, counted: t.counted };
}

/* ---------- 引き継ぎコード（2026-09-27）：機種変更・別のブラウザへ。サーバーは使わない ----------
 * 書き出し：記録（エギング・墨つなぎ）を JSON → UTF-8 → base64url にして「IKABU1-<検査>-<本文>」
 * 読み込み：今の記録と合わせる（多い方・大きい方・早い日付を残す。読み込みで記録が減ることはない）
 */
const b64enc = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64dec = (str) => {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
};
const check = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1679616;   // 36^4
  return h.toString(36).padStart(4, '0');
};

export function exportCode({ egi = null, sumi = null } = {}, { date = new Date() } = {}) {
  const body = b64enc(JSON.stringify({ v: 1, at: dayOf(date), egi, sumi }));
  return `IKABU1-${check(body)}-${body}`;
}

export function importCode(text) {
  const m = String(text ?? '').replace(/\s+/g, '').match(/^IKABU1-([0-9a-z]{4})-([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('format');
  if (check(m[2]) !== m[1]) throw new Error('check');
  const data = JSON.parse(b64dec(m[2]));
  if (data?.v !== 1) throw new Error('version');
  return { egi: data.egi ?? null, sumi: data.sumi ?? null, at: data.at ?? null };
}

const earlier = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

export function mergeEgi(a, b) {
  const x = a ?? emptyEgi();
  if (!b) return x;
  const r = { best: Math.max(x.best ?? 0, b.best ?? 0), sessions: Math.max(x.sessions ?? 0, b.sessions ?? 0), species: {}, bestOne: x.bestOne ?? null,
    points: Math.max(x.points ?? 0, b.points ?? 0), gedo: {} };
  for (const id of new Set([...Object.keys(x.gedo ?? {}), ...Object.keys(b.gedo ?? {})])) {
    const p = x.gedo?.[id];
    const q = b.gedo?.[id];
    r.gedo[id] = { count: Math.max(p?.count ?? 0, q?.count ?? 0), weight: Math.max(p?.weight ?? 0, q?.weight ?? 0), first: earlier(p?.first, q?.first) };
  }
  for (const id of new Set([...Object.keys(x.species ?? {}), ...Object.keys(b.species ?? {})])) {
    const p = x.species?.[id];
    const q = b.species?.[id];
    r.species[id] = {
      count: Math.max(p?.count ?? 0, q?.count ?? 0),
      weight: Math.max(p?.weight ?? 0, q?.weight ?? 0),
      mantle: Math.max(p?.mantle ?? 0, q?.mantle ?? 0),
      first: earlier(p?.first, q?.first),
    };
  }
  if (b.bestOne && (!r.bestOne || b.bestOne.weight > r.bestOne.weight)) r.bestOne = b.bestOne;
  return r;
}

export function mergeM3(a, b) {
  const x = a ?? emptyM3();
  if (!b) return x;
  const badges = { ...(b.badges ?? {}) };
  for (const [id, d] of Object.entries(x.badges ?? {})) badges[id] = earlier(d, badges[id]);
  const daily = !x.daily ? b.daily ?? null : !b.daily ? x.daily
    : x.daily.day === b.daily.day ? { day: x.daily.day, score: Math.max(x.daily.score, b.daily.score) }
    : x.daily.day > b.daily.day ? x.daily : b.daily;
  return { best: Math.max(x.best ?? 0, b.best ?? 0), played: Math.max(x.played ?? 0, b.played ?? 0), goals: Math.max(x.goals ?? 0, b.goals ?? 0), badges, daily };
}

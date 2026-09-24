// あそび場の記録（このブラウザだけに残る）。localStorage は読めない・書けない環境があるので必ず try/catch で包む。
// バッジの判定は純粋関数（node --test で試せる）。
import { GOAL } from './match3.js';

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

export const emptyEgi = () => ({ best: 0, sessions: 0, species: {}, bestOne: null });

// 1釣行の結果（catches = [{ id, weight, mantle }]）を記録に足す。初めて釣った種の id を返す。
// counted=false（季節モード・練習）は図鑑にも自己ベストにも数えない（ダディ指示 2026-09-25：
// 「実際のシーズンで釣って図鑑に記録しよう！」＝簡単にコンプさせない）。date は初めて釣った日の記録用
export function recordEgi(rec, catches, { counted = true, date = new Date() } = {}) {
  const r = rec ?? emptyEgi();
  if (!counted) return { rec: r, fresh: [], total: catches.reduce((s, c) => s + c.weight, 0), counted: false };
  r.sessions += 1;
  const total = catches.reduce((s, c) => s + c.weight, 0);
  r.best = Math.max(r.best, total);
  const fresh = [];
  for (const c of catches) {
    if (!r.species[c.id]) {
      r.species[c.id] = { count: 0, weight: 0, mantle: 0, first: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` };
      fresh.push(c.id);
    }
    const sp = r.species[c.id];
    sp.count += 1;
    sp.weight = Math.max(sp.weight, c.weight);
    sp.mantle = Math.max(sp.mantle, c.mantle);
    if (!r.bestOne || c.weight > r.bestOne.weight) r.bestOne = { id: c.id, weight: c.weight, mantle: c.mantle };
  }
  return { rec: r, fresh, total, counted: true };
}

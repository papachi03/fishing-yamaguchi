// 部員レベルと釣りスキルの解放（2026-09-27 ぱっぱ決定：解放は「レベル＋季節」）。
// 画面を持たない純粋な関数（node --test で試せる）。記録そのものは records.js に残す。
//
//   ・釣りポイント：釣った数・重さ・図鑑の初登録・外道・釣行の完走でたまる。数えるのは図鑑と同じく「今日の萩の海」だけ
//   ・レベルが上がると釣りスキル（邪道エギング Lv3・ヤエン Lv5・テーラー Lv8）が解放される
//   ・解放した釣り方は、その季節が来たら使える（リアルタイム＝今の月、季節モード＝選んだ季節）
//   設計の元：C:\Users\my\ikabu-research\new-methods-design.md
import { seasonOf } from './egi.js';

export const POINTS = {
  catch: 10,     // 1杯
  per100g: 1,    // 重さ100gごと
  fresh: 30,     // 図鑑に初めて載った
  gedo: 2,       // 外道
  trip: 3,       // 釣行を最後まで（ボウズでも）
};

// そのレベルになるのに要る累計ポイント（LEVELS[n-1] が Lv n）。数字は仮：初心者ボットで何回の釣行で届くかを測って決める
export const LEVELS = [0, 50, 120, 210, 320, 450, 600, 780, 980, 1200, 1440, 1700, 1980, 2280, 2600];
export const MAX_LEVEL = LEVELS.length;

export function levelOf(points = 0) {
  const p = Math.max(0, Number(points) || 0);
  let level = 1;
  while (level < MAX_LEVEL && p >= LEVELS[level]) level += 1;
  const from = LEVELS[level - 1];
  const to = level < MAX_LEVEL ? LEVELS[level] : null;
  return { level, points: p, from, to, need: to == null ? 0 : to - p, frac: to == null ? 1 : (p - from) / (to - from) };
}

// 1杯のポイント
export const catchPoints = (c, { fresh = false } = {}) => POINTS.catch + Math.floor((c.weight ?? 0) / 100) * POINTS.per100g + (fresh ? POINTS.fresh : 0);

// 釣り方。months＝リアルタイムで使える月、seasons＝季節モードで使える季節（egi.js の SEASON_MODES の key）。
// ready＝もう遊べる（false は「準備中」＝まだ作っていない）
export const METHODS = {
  egi: { level: 1, months: null, seasons: null, ready: true },
  jado: { level: 3, months: [3, 4, 5, 6], seasons: ['spring', 'earlySummer'], ready: true },
  yaen: { level: 5, months: [4, 5, 6], seasons: ['spring'], ready: true },
  tailor: { level: 8, months: [12, 1, 2, 3], seasons: ['winter'], ready: false },
};
export const METHOD_IDS = Object.keys(METHODS);

// その釣り方が今使えるか。mode：'live'（今日の萩の海＝今の月で見る）／'practice'（季節モード＝選んだ季節で見る）／'beginner'（エギングだけ）
//   'ok' 使える／'level' レベルが足りない／'season' 季節ではない／'soon' 準備中／'beginner' 初心者練習では使えない
export function methodState(id, { level = 1, month = 1, mode = 'live' } = {}) {
  const m = METHODS[id];
  if (!m) return 'soon';
  if (id === 'egi') return 'ok';
  if (mode === 'beginner') return 'beginner';
  if (level < m.level) return 'level';
  if (!m.ready) return 'soon';
  const inSeason = mode === 'live' ? m.months.includes(month) : m.seasons.includes(seasonOf(month));
  return inSeason ? 'ok' : 'season';
}

// 次にその釣り方の季節が来る月（リアルタイム用の「次は3月から」）
export function nextSeasonMonth(id, month) {
  const m = METHODS[id];
  if (!m?.months) return null;
  for (let k = 0; k < 12; k++) {
    const x = ((month - 1 + k) % 12) + 1;
    if (m.months.includes(x)) return x;
  }
  return null;
}

// レベルが上がって新しく解放された釣り方（before→after のレベルで）
export const unlockedBetween = (before, after) => METHOD_IDS.filter((id) => METHODS[id].level > before && METHODS[id].level <= after);

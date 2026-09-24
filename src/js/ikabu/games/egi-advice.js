// エギングの「釣り人の言い方」を決める純粋な関数（node --test で試せる。DOM・i18n に触らない）
//   ・今の時期に合うエギの号数（イカの顔ぶれ × 号数の相性）
//   ・しゃくり方の手ほどき（イカの気分 × やったこと）
//   ・アタリの種類の名前
import { speciesPool, sizeMatch, EGI_SIZES } from './egi.js';

// 号数ごとの相性（0〜1）。出やすさで重みづけした平均
export function sizeScores(month, tod) {
  const pool = speciesPool(month, tod);
  const total = pool.reduce((a, p) => a + p.w, 0);
  return Object.fromEntries(EGI_SIZES.map((size) => [size, pool.reduce((a, p) => a + p.w * sizeMatch(size, p.ideal), 0) / total]));
}

// 「今の時期のおすすめ」：一番合う号数と、それに近い（95%以上）号数
export function recommendedSizes(month, tod) {
  const sc = sizeScores(month, tod);
  const best = Math.max(...Object.values(sc));
  return EGI_SIZES.filter((s) => sc[s] >= best * 0.95);
}

// エギの特徴（表示用のランク）。飛距離は重いほど遠く、根掛かりは速く沈むほどしやすい
export const distRank = (size) => ({ 2.5: 'short', 3: 'mid', 3.5: 'far' })[size] ?? 'mid';
export const snagRank = (type) => ({ shallow: 'low', normal: 'mid', deep: 'high' })[type] ?? 'mid';

// しゃくりの評価（rhythm イベント）→ 手ほどきのキー。null なら何も言わない
//   ev: { streak, darts, mood }
export function rhythmHintKey(ev) {
  const n = ev.streak;
  const active = ev.mood === 'active';
  if (n >= 5) return 'tooMany';
  if (ev.darts > 0) return active ? 'dartActive' : 'dartCalm';
  if (!active && n === 1) return 'calmOne';
  if (!active && n >= 3) return 'calmMany';
  if (active && (n === 2 || n === 3)) return 'goodRhythm';
  if (n === 1) return 'oneMore';
  return null;
}

export const BITE_KINDS = ['run', 'tap', 'stop', 'slack'];

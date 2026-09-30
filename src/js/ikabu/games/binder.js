// バインダーの並べ替え・絞り込み（2026-09-30）。純粋な部分（node --test で確かめる）。画面は binder-ui.js
import { rank } from './gacha.js';

export const SORTS = ['no', 'rarity', 'name', 'kind'];          // 番号順・レア度順（高い順→番号）・名前順（五十音）・タイプ順（イカ→テクニック→トラップ）
export const KIND_ORDER = ['squid', 'tech', 'trap'];
export const KIND_LABEL = { squid: ['イカ', 'Squid'], tech: ['テクニック', 'Technique'], trap: ['トラップ', 'Trap'] };
export const RARITY_LABEL = { N: 'N', R: 'R', SR: 'SR', SSR: 'SSR', UR: 'UR' };

// owned: { [no]: 枚数 }。sort: SORTS のどれか。filter: { kind: 'all'|kind, rarity: 'all'|rarity, owned: 'all'|'have'|'missing' }
export function arrange(cards, owned = {}, { sort = 'no', kind = 'all', rarity = 'all', have = 'all' } = {}) {
  let list = cards.filter((c) => (kind === 'all' || c.kind === kind) && (rarity === 'all' || c.rarity === rarity));
  if (have === 'have') list = list.filter((c) => (owned[c.no] ?? 0) > 0);
  if (have === 'missing') list = list.filter((c) => (owned[c.no] ?? 0) === 0);
  const byNo = (a, b) => a.no - b.no;
  const cmp = {
    no: byNo,
    rarity: (a, b) => rank(b.rarity) - rank(a.rarity) || byNo(a, b),
    name: (a, b) => a.name.localeCompare(b.name, 'ja') || byNo(a, b),
    kind: (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || byNo(a, b),
  }[sort] ?? byNo;
  return [...list].sort(cmp);
}

// 持っている合計枚数（ダブり込み）と種類数
export function counts(cards, owned = {}) {
  let total = 0, kinds = 0;
  for (const c of cards) { const n = owned[c.no] ?? 0; total += n; if (n > 0) kinds += 1; }
  return { total, kinds, all: cards.length };
}

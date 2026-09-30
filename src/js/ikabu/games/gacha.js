// ガチャの仕組み（2026-09-30 カードバトル構想の②）。演出は gacha-ui.js、ここは数字だけ（node --test で試せる）。
//   設計：ikabu-research\cardbattle\設計案_イカ部カードバトル.md 3章
//   ・シングル＝1🎫、10連＝10🎫。確率 N60／R28／SR9／SSR2.5／UR0.5（画面に表示する）
//   ・10連は R以上が1枚確定。SR以上が30回出なければ次はSR以上確定（天井）。URは100回で確定
//   ・ダブりは「墨のかけら」（N1・R3・SR10・SSR30・UR100）。かけらで交換（N5・R15・SR60・SSR200・UR600）
//   ・記録は ikabu.cards.v1（持っているカード・かけら・引いた回数・天井のカウント）
import { readJSON, writeJSON } from './records.js';
import { seeded } from './rng.js';

export const KEY_CARDS = 'ikabu.cards.v1';
export const RATES = { N: 0.60, R: 0.28, SR: 0.09, SSR: 0.025, UR: 0.005 };
export const RARITY_ORDER = ['N', 'R', 'SR', 'SSR', 'UR'];
export const SHARD_FROM = { N: 1, R: 3, SR: 10, SSR: 30, UR: 100 };
export const SHARD_COST = { N: 5, R: 15, SR: 60, SSR: 200, UR: 600 };
export const PITY_SR = 30;
export const PITY_UR = 100;
export const COST_SINGLE = 1;
export const COST_TEN = 10;

export const emptyCards = () => ({ owned: {}, shards: 0, pulls: 0, sinceSR: 0, sinceUR: 0, log: [] });
export const rank = (r) => RARITY_ORDER.indexOf(r);

// 乱数（0〜1）からレア度を引く。floor＝「この段以上を確定」
export function rollRarity(u, floor = 'N') {
  let acc = 0;
  const min = rank(floor);
  // 確定がある時は、その段より下の確率を切り捨てて残りで引き直す（比率は元のまま）
  const pool = RARITY_ORDER.filter((r) => rank(r) >= min);
  const total = pool.reduce((s, r) => s + RATES[r], 0);
  for (const r of pool) { acc += RATES[r] / total; if (u < acc) return r; }
  return pool[pool.length - 1];
}

// カード一覧から、そのレア度のカードを1枚（乱数で）
export function pickCard(cards, rarity, u) {
  const pool = cards.filter((c) => c.rarity === rarity);
  if (!pool.length) throw new Error(`no cards of rarity ${rarity}`);
  return pool[Math.min(pool.length - 1, Math.floor(u * pool.length))];
}

// n 回引く。乱数は seed から（同じ seed なら同じ結果＝テストと再現用）。戻り：{ rec, results:[{card, rarity, isNew, shards, guaranteed}] }
export function pull(rec, cards, n, { seed = `${Date.now()}` } = {}) {
  const r = { ...emptyCards(), ...(rec ?? {}), owned: { ...(rec?.owned ?? {}) }, log: [...(rec?.log ?? [])] };
  const rnd = seeded(`gacha:${seed}`);
  const results = [];
  let tenHasR = false;
  for (let i = 0; i < n; i++) {
    let floor = 'N';
    let guaranteed = null;
    if (r.sinceUR >= PITY_UR - 1) { floor = 'UR'; guaranteed = 'pityUR'; }
    else if (r.sinceSR >= PITY_SR - 1) { floor = 'SR'; guaranteed = 'pitySR'; }
    else if (n >= COST_TEN && i === n - 1 && !tenHasR) { floor = 'R'; guaranteed = 'tenR'; }
    const rarity = rollRarity(rnd(), floor);
    const card = pickCard(cards, rarity, rnd());
    if (rank(rarity) >= rank('R')) tenHasR = true;
    r.pulls += 1;
    r.sinceSR = rank(rarity) >= rank('SR') ? 0 : r.sinceSR + 1;
    r.sinceUR = rarity === 'UR' ? 0 : r.sinceUR + 1;
    const had = r.owned[card.no] ?? 0;
    r.owned[card.no] = had + 1;
    const shards = had > 0 ? SHARD_FROM[rarity] : 0;   // ダブりはかけらにもなる（枚数はそのまま残す＝集めたい人向け）
    r.shards += shards;
    results.push({ card, rarity, isNew: had === 0, shards, guaranteed });
  }
  r.log.push({ at: new Date().toISOString().slice(0, 10), n, top: results.reduce((m, x) => (rank(x.rarity) > rank(m) ? x.rarity : m), 'N') });
  if (r.log.length > 200) r.log = r.log.slice(-200);
  return { rec: r, results };
}

// かけらで交換
export function exchange(rec, card) {
  const r = { ...emptyCards(), ...(rec ?? {}), owned: { ...(rec?.owned ?? {}) } };
  const cost = SHARD_COST[card.rarity];
  if (r.shards < cost) return { rec: r, ok: false };
  r.shards -= cost;
  r.owned[card.no] = (r.owned[card.no] ?? 0) + 1;
  return { rec: r, ok: true };
}

// 集めた率（バインダー用）
export function progress(rec, cards) {
  const owned = cards.filter((c) => (rec?.owned?.[c.no] ?? 0) > 0);
  const by = (key, list) => Object.fromEntries([...new Set(list.map((c) => c[key]))].map((k) => [k, { have: owned.filter((c) => c[key] === k).length, all: list.filter((c) => c[key] === k).length }]));
  return { have: owned.length, all: cards.length, kind: by('kind', cards), rarity: by('rarity', cards) };
}

// 10連の演出の判定（設計「出現演出のパターン」）。gacha-ui が使う
export function omen(results) {
  const top = results.reduce((m, x) => (rank(x.rarity) > rank(m) ? x.rarity : m), 'N');
  const rPlus = results.filter((x) => rank(x.rarity) >= rank('R')).length;
  const last = results[results.length - 1];
  return {
    top,
    sure: top === 'UR' ? 'goldInk' : top === 'SSR' ? 'runaway' : top === 'SR' ? 'kiloUp' : null,   // 確定演出
    nabura: results.length >= 10 && rPlus >= 3,                                                         // ナブラ
    comeback: results.length >= 10 && rank(last.rarity) >= rank('SR'),                                 // 逆転バラシ
  };
}

export const readCards = () => ({ ...emptyCards(), ...(readJSON(KEY_CARDS) ?? {}) });
export const writeCards = (r) => writeJSON(KEY_CARDS, r);

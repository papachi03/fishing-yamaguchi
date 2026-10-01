// デッキ編成の純粋な部分（2026-10-01）。画面は deck-ui.js
//   ・使えるカード＝スターターデッキの分（全員が持っている）＋バインダーで持っている分。同名は2枚まで
//   ・保存は ikabu.deck.v1 = { nos: [30枚の番号] }。検査は battle.js の checkDeck
import { DECK_RULE, DECK_SIZE, checkDeck } from './battle.js';

export const KEY_DECK = 'ikabu.deck.v1';
export const DECK_SLOTS = 3;   // 3つまで保存（2026-10-01 ぱっぱ）

// 保存の形：{ slots: [{ nos, name } ×3], active: 0〜2 }。古い形 { nos } はデッキ1に引き継ぐ
export function normalizeStore(raw, starter) {
  const slots = Array.from({ length: DECK_SLOTS }, (_, i) => ({ nos: null, name: `デッキ${i + 1}` }));
  let active = 0;
  if (raw && Array.isArray(raw.slots)) {
    raw.slots.slice(0, DECK_SLOTS).forEach((s, i) => { if (s && Array.isArray(s.nos)) slots[i].nos = s.nos.slice(); if (s?.name) slots[i].name = String(s.name).slice(0, 12); });
    active = Number.isInteger(raw.active) && raw.active >= 0 && raw.active < DECK_SLOTS ? raw.active : 0;
  } else if (raw && Array.isArray(raw.nos)) {
    slots[0].nos = raw.nos.slice();
  }
  return { slots: slots.map((s) => ({ ...s, nos: s.nos ?? starter.slice() })), active };
}
// 対戦に使うデッキ（active が検査に通らなければスターター）
export function activeDeck(raw, starter, cards) {
  const st = normalizeStore(raw, starter);
  const nos = st.slots[st.active].nos;
  return checkDeck(nos, cards).ok ? nos : starter.slice();
}

// 番号ごとに「何枚まで入れられるか」（所持＋スターター、上限2）
export function availableCopies(owned = {}, starter = []) {
  const avail = {};
  for (const no of starter) avail[no] = (avail[no] ?? 0) + 1;
  for (const [no, n] of Object.entries(owned)) avail[no] = (avail[no] ?? 0) + n;
  for (const no of Object.keys(avail)) avail[no] = Math.min(DECK_RULE.copies, avail[no]);
  return avail;
}

// 1枚足す。戻り：{ ok, deck, why }。why: full（30枚）・copies（2枚まで）・none（持っていない）・SSR・UR
export function addCard(deck, no, avail, cards) {
  const c = cards.find((x) => x.no === no);
  if (!c) return { ok: false, deck, why: 'none' };
  if (deck.length >= DECK_SIZE) return { ok: false, deck, why: 'full' };
  const have = deck.filter((n) => n === no).length;
  if (have >= (avail[no] ?? 0)) return { ok: false, deck, why: (avail[no] ?? 0) === 0 ? 'none' : 'copies' };
  const byNo = new Map(cards.map((x) => [x.no, x]));
  if (c.rarity === 'SSR' && deck.filter((n) => byNo.get(n)?.rarity === 'SSR').length >= DECK_RULE.SSR) return { ok: false, deck, why: 'SSR' };
  if (c.rarity === 'UR' && deck.filter((n) => byNo.get(n)?.rarity === 'UR').length >= DECK_RULE.UR) return { ok: false, deck, why: 'UR' };
  return { ok: true, deck: [...deck, no] };
}
export function removeCard(deck, no) {
  const i = deck.lastIndexOf(no);
  return i < 0 ? deck : [...deck.slice(0, i), ...deck.slice(i + 1)];
}
// 種類ごとの枚数と、決まりの幅
export function summary(deck, cards) {
  const byNo = new Map(cards.map((x) => [x.no, x]));
  const cnt = { squid: 0, tech: 0, trap: 0 };
  for (const n of deck) { const c = byNo.get(n); if (c) cnt[c.kind] += 1; }
  return { ...cnt, total: deck.length, rule: DECK_RULE, check: checkDeck(deck, cards) };
}

// おすすめ編成：持っているカード（avail）から30枚を組む。決め方：
//   ①イカ14枚＝強さ（攻＋防、レア度で少し加点）の高い順。ただし潮1〜2の軽いイカを最低4枚は入れる（序盤に出せる）
//   ②マーク：入れたイカのマークで一番多いものを「主のマーク」にし、テクニックは同じマークを優先（潮1安くなる）
//   ③テクニック11枚＝攻撃を上げるもの・引くものを優先。トラップ5枚＝攻撃を止める・弱めるものを優先
//   ④同じカードは2枚まで・SSR2・UR1（addCard の決まりどおり）。足りない種類はある分で埋める
export function recommendDeck(cards, avail) {
  const has = (c) => (avail[c.no] ?? 0) > 0;
  const rarityBonus = { N: 0, R: 0.5, SR: 1, SSR: 1.5, UR: 2 };
  let deck = [];
  const tryAdd = (no) => { const r = addCard(deck, no, avail, cards); if (r.ok) deck = r.deck; return r.ok; };
  // ⓪ 持っている UR・SSR は先に入れる（決まりの上限 UR1・SSR2 まで。2026-10-01 ぱっぱ「おすすめが SSR を選ばない」）
  //   レア度の加点より潮の割引が大きく、軽いカードばかり選んでいた。強いカードは枚数の上限があるので、先に確保してから残りを選ぶ
  const topFirst = cards.filter((c) => (c.rarity === 'UR' || c.rarity === 'SSR') && has(c))
    .sort((a, b) => rarityBonus[b.rarity] - rarityBonus[a.rarity] || (b.kind === 'squid') - (a.kind === 'squid') || b.cost - a.cost);
  for (const c of topFirst) tryAdd(c.no);
  // count：何枚入ったかの数え方（kind だけ、または「潮2以下のイカ」のように絞る）
  const fill = (list, want, kind, count = (c) => c.kind === kind) => { const n = () => deck.filter((no) => { const c = cards.find((x) => x.no === no); return c && count(c); }).length; for (const c of list) { if (n() >= want) break; for (let k = 0; k < (avail[c.no] ?? 0); k++) { if (n() >= want) break; if (!tryAdd(c.no)) break; } } };
  // ①イカ：軽いイカを先に4枚（潮1〜2で強い順）、残りは強い順
  const squids = cards.filter((c) => c.kind === 'squid' && has(c));
  const power = (c) => c.atk + c.def + rarityBonus[c.rarity] - c.cost * 0.6;   // 重いカードは少し割り引く（出せる回数が少ない）
  const light = squids.filter((c) => c.cost <= 2).sort((a, b) => power(b) - power(a));
  fill(light, 4, 'squid', (c) => c.kind === 'squid' && c.cost <= 2);   // 軽いイカそのものを4枚（先に入れた UR・SSR は数えない）
  fill(squids.slice().sort((a, b) => power(b) - power(a)), 14, 'squid');
  // ②主のマーク
  const byNo = new Map(cards.map((c) => [c.no, c]));
  const markCount = {};
  for (const n of deck) { const m = byNo.get(n).mark; markCount[m] = (markCount[m] ?? 0) + 1; }
  const mainMark = Object.entries(markCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  // ③テクニック：攻撃を上げる・引く を優先、主のマークに加点
  const techScore = (c) => {
    const e = c.effect ?? '';
    let sc = 0;
    if (/攻撃\+/.test(e)) sc += 3;
    if (/引く/.test(e)) sc += 2;
    if (/防御-/.test(e)) sc += 2;
    if (/全部/.test(e)) sc += 1;
    if (c.mark === mainMark) sc += 1.5;
    sc += rarityBonus[c.rarity] * 0.5 - c.cost * 0.3;
    return sc;
  };
  const techs = cards.filter((c) => c.kind === 'tech' && has(c)).sort((a, b) => techScore(b) - techScore(a));
  fill(techs, 11, 'tech');
  // トラップ：攻撃を止める・弱めるものを優先
  const trapScore = (c) => { const e = c.effect ?? ''; let sc = 0; if (/止め/.test(e)) sc += 3; if (/攻撃-/.test(e)) sc += 2; if (/手札に戻す/.test(e)) sc += 2; if (/釣られず/.test(e)) sc += 2; sc += rarityBonus[c.rarity] * 0.5 - c.cost * 0.3; return sc; };
  const traps = cards.filter((c) => c.kind === 'trap' && has(c)).sort((a, b) => trapScore(b) - trapScore(a));
  fill(traps, 5, 'trap');
  // ④30枚に届かない時は、種類の幅の中で埋める（イカ15・テク12・トラップ6まで）
  for (const [list, want, kind] of [[squids.slice().sort((a, b) => power(b) - power(a)), 15, 'squid'], [techs, 12, 'tech'], [traps, 6, 'trap']]) { if (deck.length >= DECK_SIZE) break; fill(list, want, kind); }
  return { deck, mainMark };
}

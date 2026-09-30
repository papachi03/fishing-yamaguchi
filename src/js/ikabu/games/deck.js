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

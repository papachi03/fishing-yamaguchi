import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { availableCopies, addCard, removeCard, summary } from '../src/js/ikabu/games/deck.js';
import { starterDeck } from '../src/js/ikabu/games/battle.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const STARTER = starterDeck(CARDS);

test('使える枚数＝スターター＋所持、上限2', () => {
  const avail = availableCopies({ 14: 5, 120: 1 }, STARTER);
  assert.equal(avail[14], 2);      // アオリはスターターに2枚＋所持5 → 2
  assert.equal(avail[120], 1);     // 持っている1枚
  assert.equal(avail[119] ?? 0, 0);
});

test('足す：30枚まで・同名2枚まで・持っていないと不可・SSR2/UR1', () => {
  const avail = availableCopies({ 117: 2, 118: 2, 119: 1, 120: 1 }, STARTER);   // SSR/UR を持っている想定
  let deck = [];
  assert.equal(addCard(deck, 14, avail, CARDS).ok, true);
  deck = addCard(deck, 14, avail, CARDS).deck; deck = addCard(deck, 14, avail, CARDS).deck;
  assert.equal(addCard(deck, 14, avail, CARDS).why, 'copies');
  assert.equal(addCard(deck, 50, avail, CARDS).why, 'none');
  const ssr = CARDS.filter((c) => c.rarity === 'SSR').map((c) => c.no);
  const a2 = availableCopies(Object.fromEntries(ssr.map((n) => [n, 1])), []);
  let d2 = [];
  d2 = addCard(d2, ssr[0], a2, CARDS).deck; d2 = addCard(d2, ssr[1], a2, CARDS).deck;
  assert.equal(addCard(d2, ssr[2], a2, CARDS).why, 'SSR');
  const full = STARTER.slice();
  assert.equal(addCard(full, 1, availableCopies({ 1: 2 }, STARTER), CARDS).why, 'full');
  assert.deepEqual(removeCard([1, 2, 1], 1), [1, 2]);
});

test('まとめ：スターターは検査に通る', () => {
  const s = summary(STARTER, CARDS);
  assert.equal(s.total, 30); assert.equal(s.check.ok, true);
  assert.ok(s.squid >= 12 && s.tech >= 9 && s.trap >= 4);
});

test('デッキは3つまで保存。古い形 { nos } はデッキ1に引き継ぐ。使うデッキが検査に通らなければスターター', async () => {
  const { normalizeStore, activeDeck } = await import('../src/js/ikabu/games/deck.js');
  const old = normalizeStore({ nos: [1, 2, 3] }, STARTER);
  assert.equal(old.slots.length, 3); assert.deepEqual(old.slots[0].nos, [1, 2, 3]); assert.deepEqual(old.slots[1].nos, STARTER); assert.equal(old.active, 0);
  assert.deepEqual(activeDeck({ nos: [1, 2, 3] }, STARTER, CARDS), STARTER);   // 3枚では検査に通らない
  const st = normalizeStore({ slots: [{ nos: STARTER, name: 'A' }, { nos: STARTER }], active: 1 }, STARTER);
  assert.equal(st.slots[0].name, 'A'); assert.equal(st.slots[1].name, 'デッキ2'); assert.equal(st.active, 1);
  assert.deepEqual(activeDeck(st, STARTER, CARDS), STARTER);
});

test('おすすめ編成：持っているカードだけで30枚・検査に通る。スターターだけでも、たくさん持っていても組める', async () => {
  const { recommendDeck, availableCopies: ac } = await import('../src/js/ikabu/games/deck.js');
  const { checkDeck } = await import('../src/js/ikabu/games/battle.js');
  // スターターだけ
  const a1 = ac({}, STARTER);
  const r1 = recommendDeck(CARDS, a1);
  assert.equal(r1.deck.length, 30); assert.equal(checkDeck(r1.deck, CARDS).ok, true, checkDeck(r1.deck, CARDS).errors.join(','));
  assert.ok(r1.deck.every((no) => (a1[no] ?? 0) >= r1.deck.filter((n) => n === no).length), '持っている枚数の範囲');
  // 全部2枚ずつ持っている
  const a2 = ac(Object.fromEntries(CARDS.map((c) => [c.no, 2])), []);
  const r2 = recommendDeck(CARDS, a2);
  assert.equal(r2.deck.length, 30); assert.equal(checkDeck(r2.deck, CARDS).ok, true, checkDeck(r2.deck, CARDS).errors.join(','));
  const rar = (no) => CARDS.find((c) => c.no === no).rarity;
  assert.ok(r2.deck.filter((n) => rar(n) === 'UR').length <= 1 && r2.deck.filter((n) => rar(n) === 'SSR').length <= 2);
  assert.ok(r2.deck.filter((n) => CARDS.find((c) => c.no === n).kind === 'squid' && CARDS.find((c) => c.no === n).cost <= 2).length >= 4, '軽いイカが4枚以上');
  assert.ok(r2.mainMark);
});

test('おすすめ編成：持っている UR と SSR は必ず入る（上限 UR1・SSR2）。2026-10-01 ぱっぱ「SSR を選ばない」', async () => {
  const { recommendDeck, availableCopies: ac } = await import('../src/js/ikabu/games/deck.js');
  const ur = CARDS.filter((c) => c.rarity === 'UR' && c.no <= 120).map((c) => c.no);
  const ssr = CARDS.filter((c) => c.rarity === 'SSR' && c.no <= 120).map((c) => c.no);
  // UR を1枚・SSR を3枚（うち2枚しか入らない）持っている
  const avail = ac({ [ur[0]]: 1, [ssr[0]]: 1, [ssr[1]]: 1, [ssr[2]]: 1 }, STARTER);
  const r = recommendDeck(CARDS, avail);
  assert.equal(r.deck.length, 30);
  assert.ok(r.deck.includes(ur[0]), 'UR が入る');
  assert.equal(r.deck.filter((n) => ssr.includes(n)).length, 2, 'SSR は2枚まで入る');
});

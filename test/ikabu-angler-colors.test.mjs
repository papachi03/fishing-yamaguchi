// キャラの色違い（2026-10-13 ぱっぱ）：キャラを持っていれば🎫5で色を入手・着替え。表情と立ち絵の絵の住所が色で替わる
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ANGLERS, RUSH_MOODS, buyAngler, emptyAnglers, normalizeAnglers, buyColor, useColor, colorOf, anglerSrc, anglerJet, rushFaceSrc, COLORS, COLOR_COST } from '../src/js/ikabu/games/anglers.js';
import { emptyTickets } from '../src/js/ikabu/games/tickets.js';

const day = '2026-10-13';
const tk = (n) => ({ ...emptyTickets(), n });
const pub = (p) => new URL(`../public${p}`, import.meta.url);

test('色違いはキャラを持っていないと買えない。持っていれば🎫5でその色になり、そのキャラを使う', () => {
  assert.equal(COLOR_COST, 5);
  assert.equal(buyColor(emptyAnglers(), tk(10), 'mimi', 'pink', { day }).why, 'nochar');
  const got = buyAngler(emptyAnglers(), tk(20), 'mimi', { day });
  const c = buyColor(got.rec, got.tickets, 'mimi', 'pink', { day });
  assert.equal(c.ok, true);
  assert.equal(c.tickets.n, 5);
  assert.equal(c.rec.current, 'mimi');
  assert.equal(colorOf(c.rec, 'mimi'), 'pink');
  assert.equal(buyColor(c.rec, c.tickets, 'mimi', 'pink', { day }).why, 'owned');
  assert.equal(buyColor(c.rec, tk(4), 'mimi', 'mint', { day }).why, 'tickets');
  assert.equal(buyColor(c.rec, tk(9), 'mimi', 'gold', { day }).why, 'unknown');
});
test('部長（最初から持っている）も色違いを買える', () => {
  const c = buyColor(emptyAnglers(), tk(5), 'shiro', 'mint', { day });
  assert.equal(c.ok, true);
  assert.equal(colorOf(c.rec, 'shiro'), 'mint');
});
test('持っている色・元の色には着替えられる。持っていない色には替えられない', () => {
  const r = { owned: ['shiro', 'aori'], current: 'shiro', colors: { aori: ['mint'] }, color: {} };
  assert.equal(useColor(r, 'aori', 'pink').ok, false);
  const m = useColor(r, 'aori', 'mint');
  assert.equal(m.ok, true);
  assert.equal(m.rec.current, 'aori');
  assert.equal(colorOf(m.rec, 'aori'), 'mint');
  assert.equal(colorOf(useColor(m.rec, 'aori', '').rec, 'aori'), '');
});
test('壊れた記録でも、色は持っている物だけ残る（持っていない色を着ていたら元の色）', () => {
  const r = normalizeAnglers({ owned: ['shiro'], current: 'shiro', colors: { shiro: ['pink', 'gold'] }, color: { shiro: 'mint' } });
  assert.deepEqual(r.colors, { shiro: ['pink'] });
  assert.equal(colorOf(r, 'shiro'), '');
});
test('色違いの絵の住所', () => {
  assert.deepEqual(COLORS, ['pink', 'mint', 'purple']);
  assert.equal(anglerSrc('mimi', 'pink'), '/assets/ikabu/anglers/mimi_pink.webp');
  assert.equal(anglerJet('shiro', 'mint'), '/assets/ikabu/anglers/shiro_mint_jet.webp');
  assert.equal(anglerSrc('aori', ''), '/assets/ikabu/anglers/aori.webp');
  assert.equal(rushFaceSrc('yari', 'panic', 'purple'), '/assets/ikabu/rush-chars/yari_purple_panic.webp');
});
test('全10体×3色の絵（立ち絵・ジェット・墨のがれの5表情）がそろっている', () => {
  for (const a of ANGLERS) for (const c of COLORS) {
    assert.ok(existsSync(pub(anglerSrc(a.id, c))), anglerSrc(a.id, c));
    assert.ok(existsSync(pub(anglerJet(a.id, c))), anglerJet(a.id, c));
    for (const m of RUSH_MOODS) assert.ok(existsSync(pub(rushFaceSrc(a.id, m, c))), rushFaceSrc(a.id, m, c));
  }
});

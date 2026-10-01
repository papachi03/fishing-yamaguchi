// 釣り人キャラ（2026-10-02）：🎫で入手・使う
import test from 'node:test';
import assert from 'node:assert/strict';
import { ANGLERS, buyAngler, useAngler, normalizeAnglers, emptyAnglers } from '../src/js/ikabu/games/anglers.js';
import { emptyTickets } from '../src/js/ikabu/games/tickets.js';

const day = '2026-10-02';
const tk = (n) => ({ ...emptyTickets(), n });

test('最初は部長（白イカ）だけ持っていて、使っている', () => {
  const r = normalizeAnglers(null);
  assert.deepEqual(r.owned, ['shiro']);
  assert.equal(r.current, 'shiro');
  assert.equal(ANGLERS.length, 6);
});
test('🎫10枚でアオリが手に入り、そのまま使う。🎫は10枚減る', () => {
  const r = buyAngler(emptyAnglers(), tk(12), 'aori', { day });
  assert.equal(r.ok, true);
  assert.ok(r.rec.owned.includes('aori'));
  assert.equal(r.rec.current, 'aori');
  assert.equal(r.tickets.n, 2);
});
test('🎫が足りなければ手に入らない。持っているキャラは二重に買えない', () => {
  assert.equal(buyAngler(emptyAnglers(), tk(9), 'aori', { day }).why, 'tickets');
  const got = buyAngler(emptyAnglers(), tk(20), 'yari', { day });
  assert.equal(buyAngler(got.rec, got.tickets, 'yari', { day }).why, 'owned');
});
test('持っていないキャラには替えられない。知らない値は部長に戻る', () => {
  assert.equal(useAngler(emptyAnglers(), 'mongo').ok, false);
  assert.deepEqual(normalizeAnglers({ owned: ['xxx'], current: 'xxx' }), { owned: ['shiro'], current: 'shiro' });
});

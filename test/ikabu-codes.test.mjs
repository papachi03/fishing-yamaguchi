import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, hashCode, redeem, lockState, LOCK_AFTER, LOCK_MS } from '../src/js/ikabu/games/codes.js';
import { emptyTickets } from '../src/js/ikabu/games/tickets.js';

const D = '2026-10-10';
const mk = async (code, extra = {}) => ({ id: extra.id ?? code.toLowerCase(), h: await hashCode(code), n: extra.n ?? 5, ...extra });

test('入力のゆらぎ：全角・小文字・空白・区切り違いを同じコードにそろえる', () => {
  assert.equal(normalize('ikabu 8k3t p2wq'), 'IKABU-8K3T-P2WQ');
  assert.equal(normalize('ＩＫＡＢＵ－８Ｋ３Ｔ－Ｐ２ＷＱ'), 'IKABU-8K3T-P2WQ');
  assert.equal(normalize('  ikabu--8k3t_p2wq  '), 'IKABU-8K3T-P2WQ');
  assert.equal(normalize('い'), '');
});

test('正しいコードで枚数ぶん増え、同じコードは二度と使えない', async () => {
  const table = [await mk('IKABU-TEST-0001', { id: 'stamp1010', n: 10 })];
  const a = await redeem('ikabu test 0001', { table, tickets: emptyTickets(), day: D });
  assert.equal(a.ok, true); assert.equal(a.got, 10); assert.equal(a.rec.n, 10);
  const b = await redeem('IKABU-TEST-0001', { table, tickets: a.rec, day: D });
  assert.equal(b.ok, false); assert.equal(b.reason, 'used'); assert.equal(b.rec.n, 10);
});

test('合わないコードは bad。期間の外は notyet / expired', async () => {
  const table = [await mk('IKABU-TEST-0002', { id: 'ev', n: 3, from: '2026-10-10', until: '2026-10-17' })];
  assert.equal((await redeem('IKABU-XXXX-YYYY', { table, tickets: emptyTickets(), day: D })).reason, 'bad');
  assert.equal((await redeem('IKABU-TEST-0002', { table, tickets: emptyTickets(), day: '2026-10-09' })).reason, 'notyet');
  assert.equal((await redeem('IKABU-TEST-0002', { table, tickets: emptyTickets(), day: '2026-10-18' })).reason, 'expired');
  assert.equal((await redeem('IKABU-TEST-0002', { table, tickets: emptyTickets(), day: '2026-10-17' })).ok, true);
});

test('ハッシュは Python の作り方（sha256("salt:code")）と同じ', async () => {
  // python: hashlib.sha256('ikabu-tickets-2026:IKABU-TEST-0001'.encode()).hexdigest()
  assert.equal(await hashCode('IKABU-TEST-0001'), '8c4a21b0f195071f47b447caca8f7f6b23d5ed1a052181bcb729c10258a9d45f');
});

test('当て推量よけ：3回外したら30秒待ち、30秒たてば解ける', () => {
  assert.equal(lockState(LOCK_AFTER - 1, 0, 1000).locked, false);
  const l = lockState(LOCK_AFTER, 1000, 1000 + 5000);
  assert.equal(l.locked, true); assert.equal(l.wait, LOCK_MS - 5000);
  assert.equal(lockState(LOCK_AFTER, 1000, 1000 + LOCK_MS).locked, false);
});

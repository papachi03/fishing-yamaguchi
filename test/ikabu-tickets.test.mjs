import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyTickets, earnPlay, earnSumiGoal, earnRush60, earnCert, earnCode, spend, todayLeft, CAP, DAILY_PLAY_MAX, CERT_BONUS } from '../src/js/ikabu/games/tickets.js';

const D = '2026-09-30';

test('1戦遊ぶと1枚。その日の最初は+1で計2枚。1日の遊びの分は5枚まで', () => {
  let r = emptyTickets();
  let a = earnPlay(r, { day: D });
  assert.equal(a.got, 2); assert.deepEqual(a.why, ['play', 'first']);
  r = a.rec;
  for (let i = 0; i < 4; i++) r = earnPlay(r, { day: D }).rec;
  assert.equal(r.n, 6);
  const more = earnPlay(r, { day: D });
  assert.equal(more.got, 0); assert.equal(more.rec.n, 6);
  assert.equal(more.rec.today.play, DAILY_PLAY_MAX);
});

test('日付が変わると今日の分が戻る。持ち数はそのまま', () => {
  let r = emptyTickets();
  for (let i = 0; i < 6; i++) r = earnPlay(r, { day: D }).rec;
  const next = earnPlay(r, { day: '2026-10-01' });
  assert.equal(next.got, 2); assert.equal(next.rec.n, 8);
});

test('墨つなぎの目標と墨のがれ60秒は1日1回ずつ。59秒はもらえない', () => {
  let r = emptyTickets();
  assert.equal(earnSumiGoal(r, { day: D }).got, 1);
  r = earnSumiGoal(r, { day: D }).rec;
  assert.equal(earnSumiGoal(r, { day: D }).got, 0);
  assert.equal(earnRush60(r, { day: D, seconds: 59 }).got, 0);
  assert.equal(earnRush60(r, { day: D, seconds: 60 }).got, 1);
  r = earnRush60(r, { day: D, seconds: 60 }).rec;
  assert.equal(earnRush60(r, { day: D, seconds: 200 }).got, 0);
});

test('認定証は10枚・認定証ごとに1回。コードは枚数ぶん・同じコードは二度と不可', () => {
  let r = emptyTickets();
  assert.equal(earnCert(r, 'sumi', { day: D }).got, CERT_BONUS);
  r = earnCert(r, 'sumi', { day: D }).rec;
  assert.equal(earnCert(r, 'sumi', { day: D }).got, 0);
  assert.equal(earnCert(r, 'rush', { day: D }).got, CERT_BONUS);
  const c = earnCode(r, 'stamp-1010', 10, { day: D });
  assert.equal(c.got, 10);
  assert.equal(earnCode(c.rec, 'stamp-1010', 10, { day: D }).got, 0);
});

test('持てる上限は300。超える分は切り捨て', () => {
  let r = { ...emptyTickets(), n: 295, earned: 295 };
  const c = earnCode(r, 'big', 10, { day: D });
  assert.equal(c.got, 5); assert.equal(c.rec.n, CAP);
});

test('使う：足りなければ false、足りれば減る', () => {
  const r = { ...emptyTickets(), n: 10, earned: 10 };
  assert.equal(spend(r, 11, { day: D }).ok, false);
  const s = spend(r, 10, { day: D });
  assert.equal(s.ok, true); assert.equal(s.rec.n, 0); assert.equal(s.rec.spent, 10);
});

test('今日あと何枚：何もしていない日は 5+1+1+1=8、1戦遊ぶと6', () => {
  const r = emptyTickets();
  assert.equal(todayLeft(r, { day: D }), 8);
  assert.equal(todayLeft(earnPlay(r, { day: D }).rec, { day: D }), 6);
});

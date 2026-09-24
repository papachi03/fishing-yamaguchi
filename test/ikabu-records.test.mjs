// あそび場の記録とバッジ（localStorage に触らない純粋な部分）
import test from 'node:test';
import assert from 'node:assert/strict';
import { badgesFor, recordM3, recordEgi, emptyM3, emptyEgi, readJSON, writeJSON } from '../src/js/ikabu/games/records.js';

test('墨つなぎのバッジは点数・連鎖・墨の回数で決まる', () => {
  assert.deepEqual(badgesFor({ score: 100, maxChain: 1, flashes: 0 }), ['join']);
  assert.deepEqual(badgesFor({ score: 1500, maxChain: 3, flashes: 2 }), ['join', 'star1', 'chain', 'ink']);
  assert.deepEqual(badgesFor({ score: 3500, maxChain: 1, flashes: 0 }), ['join', 'star1', 'skilled', 'captain']);
});

test('記録は自己ベストを保ち、バッジは初めて取った日付だけ残す', () => {
  let r = recordM3(emptyM3(), { score: 1600, maxChain: 2, flashes: 0 }, { day: '2026-09-24', today: '2026-09-24' });
  assert.deepEqual(r.fresh, ['join', 'star1']);
  assert.equal(r.rec.best, 1600);
  assert.equal(r.rec.goals, 1);
  r = recordM3(r.rec, { score: 900, maxChain: 3, flashes: 0 }, { day: '2026-09-25', today: '2026-09-25' });
  assert.deepEqual(r.fresh, ['chain']);
  assert.equal(r.rec.best, 1600, 'ベストは下がらない');
  assert.equal(r.rec.badges.join, '2026-09-24', '入部の日付は最初のまま');
  assert.equal(r.rec.played, 2);
});

test('エギングの記録：合計の自己ベスト、初めての種、種ごとの最大', () => {
  let r = recordEgi(emptyEgi(), [{ id: 'aori', weight: 400, mantle: 18 }, { id: 'aori', weight: 900, mantle: 24 }]);
  assert.deepEqual(r.fresh, ['aori']);
  assert.equal(r.total, 1300);
  assert.equal(r.rec.best, 1300);
  assert.equal(r.rec.species.aori.count, 2);
  assert.equal(r.rec.species.aori.weight, 900);
  assert.deepEqual(r.rec.bestOne, { id: 'aori', weight: 900, mantle: 24 });
  r = recordEgi(r.rec, []);
  assert.deepEqual(r.fresh, []);
  assert.equal(r.rec.sessions, 2);
  assert.equal(r.rec.best, 1300, 'ボウズでもベストは残る');
});

test('localStorage が無い環境でも読み書きは落ちない', () => {
  assert.equal(readJSON('x'), null);
  assert.equal(writeJSON('x', { a: 1 }), true); // globalThis.localStorage が無いときは何もせず true（?. で抜ける）
});

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

// 今日の萩の海：時計と日の出入りから時間帯を決める（純粋関数）
import { todFromClock } from '../src/js/ikabu/games/sea-live.js';
test('日の出±1h は朝マズメ、日の入り±1h は夕マズメ、その間は日中、外は夜', () => {
  const at = (h, m = 0) => new Date(2026, 8, 24, h, m);
  const sunrise = at(6, 10);
  const sunset = at(18, 20);
  assert.equal(todFromClock(at(5, 30), sunrise, sunset), 'morning');
  assert.equal(todFromClock(at(7, 0), sunrise, sunset), 'morning');
  assert.equal(todFromClock(at(12, 0), sunrise, sunset), 'day');
  assert.equal(todFromClock(at(17, 30), sunrise, sunset), 'evening');
  assert.equal(todFromClock(at(19, 10), sunrise, sunset), 'evening');
  assert.equal(todFromClock(at(23, 0), sunrise, sunset), 'night');
  assert.equal(todFromClock(at(12, 0), null, null), 'night', '日の出入りが計算できない緯度では夜扱い');
});

// エギングの手ほどき（純粋関数）
import { sizeScores, recommendedSizes, rhythmHintKey } from '../src/js/ikabu/games/egi-advice.js';
test('号数のおすすめ：秋の新子は2.5号、春の親イカは3.5号', () => {
  assert.ok(recommendedSizes(10, 'day').includes(2.5));
  assert.ok(!recommendedSizes(10, 'day').includes(3.5));
  const spring = sizeScores(4, 'morning');
  assert.ok(spring[3.5] > spring[2.5]);
});
test('しゃくりの手ほどき：やる気のある日のダートは褒め、渋い日のダートはたしなめる。5回以上はしゃくりすぎ', () => {
  assert.equal(rhythmHintKey({ streak: 2, darts: 1, mood: 'active' }), 'dartActive');
  assert.equal(rhythmHintKey({ streak: 2, darts: 1, mood: 'calm' }), 'dartCalm');
  assert.equal(rhythmHintKey({ streak: 6, darts: 0, mood: 'active' }), 'tooMany');
  assert.equal(rhythmHintKey({ streak: 1, darts: 0, mood: 'calm' }), 'calmOne');
  assert.equal(rhythmHintKey({ streak: 2, darts: 0, mood: 'active' }), 'goodRhythm');
  assert.equal(rhythmHintKey({ streak: 4, darts: 0, mood: 'active' }), null);
});

// 2026-09-30 友だちの感想「部長への道がすぐ取れる」→ 上の段を足した（ふつうに遊んで取れない数字）
test('墨つなぎの難しいバッジ：6連鎖・墨4回・5,000/7,000/9,000点・今日の一戦で★★★', () => {
  assert.deepEqual(badgesFor({ score: 1850, maxChain: 4, flashes: 2 }), ['join', 'star1', 'chain', 'ink'], 'ふつうの1戦では上の段は取れない');
  const all = badgesFor({ score: 9000, maxChain: 6, flashes: 4 }, { stars: 3 });
  for (const id of ['stars3', 'chain6', 'ink4', 'score5k', 'score7k', 'score9k']) assert.ok(all.includes(id), id);
  assert.ok(!badgesFor({ score: 6999, maxChain: 1, flashes: 0 }).includes('score7k'));
  assert.ok(!badgesFor({ score: 9999, maxChain: 1, flashes: 0 }).includes('stars3'), '★★★は今日の一戦の結果が要る');
  const r = recordM3(emptyM3(), { score: 5200, maxChain: 6, flashes: 1 }, { day: '2026-09-30', today: '2026-09-30', stars: 3 });
  assert.ok(r.fresh.includes('score5k') && r.fresh.includes('chain6') && r.fresh.includes('stars3'));
});

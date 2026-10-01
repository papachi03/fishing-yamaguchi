// 記録を消さないために（2026-09-27 ぱっぱ：1年かけてそろえる図鑑が突然消えると、一気にやる気がなくなる）
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readRecord, writeRecord, storageWorks, recordEgiCatch, recordEgiTrip, recordEgi, emptyEgi, emptyM3,
  exportCode, importCode, mergeEgi, mergeM3, KEY_EGI,
} from '../src/js/ikabu/games/records.js';

// ブラウザの localStorage の代わり
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('釣れた瞬間に1杯ずつ記録：釣行の途中でやめても、それまでの釣果は図鑑と自己ベストに残る', () => {
  let rec = emptyEgi();
  rec = recordEgiCatch(rec, { id: 'aori', weight: 800, mantle: 20 }, { tripTotal: 800 }).rec;
  const got = recordEgiCatch(rec, { id: 'kensaki', weight: 300, mantle: 18 }, { tripTotal: 1100 });
  assert.equal(got.fresh, true);
  rec = got.rec;
  // ここで釣行の途中でやめた（recordEgiTrip は呼ばれない）
  assert.deepEqual(Object.keys(rec.species).sort(), ['aori', 'kensaki']);
  assert.equal(rec.best, 1100);
  assert.equal(rec.bestOne.id, 'aori');
  assert.equal(rec.sessions, 0);
  // 釣行を終えたら、釣行の数だけ増える（釣果を二重に数えない）
  rec = recordEgiTrip(rec, [{ id: 'aori', weight: 800 }, { id: 'kensaki', weight: 300 }]).rec;
  assert.equal(rec.sessions, 1);
  assert.equal(rec.species.aori.count, 1);
  // 季節モード（練習）は数えない
  const r2 = recordEgiCatch(emptyEgi(), { id: 'aori', weight: 800, mantle: 20 }, { counted: false });
  assert.deepEqual(r2.rec.species, {});
});

test('まとめて記録（recordEgi）は、1杯ずつ＋釣行の終わり と同じ結果', () => {
  const catches = [{ id: 'aori', weight: 800, mantle: 20 }, { id: 'aori', weight: 1200, mantle: 24 }];
  const { rec, fresh, total } = recordEgi(emptyEgi(), catches);
  assert.deepEqual(fresh, ['aori']);
  assert.equal(total, 2000);
  assert.equal(rec.best, 2000);
  assert.equal(rec.species.aori.count, 2);
  assert.equal(rec.species.aori.weight, 1200);
  assert.equal(rec.sessions, 1);
});

test('記録が壊れても白紙にしない：控えから戻し、壊れた本体は上書き前に退避する', () => {
  globalThis.localStorage = fakeStorage();
  const a = { ...emptyEgi(), best: 500, species: { aori: { count: 1, weight: 500, mantle: 18, first: '2026-10-01' } } };
  const b = { ...a, best: 900 };
  assert.equal(writeRecord(KEY_EGI, a), true);
  assert.equal(writeRecord(KEY_EGI, b), true);   // 控えにも同じ b
  assert.equal(readRecord(KEY_EGI).value.best, 900);
  // 本体が壊れた → 控え（最新と同じ）から戻る
  localStorage.setItem(KEY_EGI, '{"best":9');
  const r = readRecord(KEY_EGI);
  assert.equal(r.source, 'backup');
  assert.equal(r.broken, true);
  assert.equal(r.value.best, 900);
  // 戻した記録を書くと、壊れた本体は .broken に退避されてから上書きされる
  writeRecord(KEY_EGI, r.value);
  assert.equal(localStorage.getItem(`${KEY_EGI}.broken`), '{"best":9');
  assert.equal(readRecord(KEY_EGI).source, 'main');
  assert.equal(readRecord(KEY_EGI).value.best, 900);
  // 1回しか書いていなくても戻せる（はじめの作りでは控えが無かった）
  globalThis.localStorage = fakeStorage();
  writeRecord(KEY_EGI, a);
  localStorage.setItem(KEY_EGI, 'xx');
  assert.equal(readRecord(KEY_EGI).value.best, 500);
  assert.equal(storageWorks(), true);
  delete globalThis.localStorage;
  assert.equal(storageWorks(), false);
  assert.equal(readRecord(KEY_EGI).source, 'none');
});

test('引き継ぎコード：書き出して読み込むと同じ記録に戻る。1文字でも欠けたら読まない', () => {
  const egi = { best: 2350, sessions: 12, bestOne: { id: 'aori', weight: 2350, mantle: 34 }, species: { aori: { count: 7, weight: 2350, mantle: 34, first: '2026-04-20' }, daiou: { count: 1, weight: 98000, mantle: 110, first: '2027-01-15' } } };
  const sumi = { best: 1800, played: 30, goals: 9, badges: { join: '2026-09-27' }, daily: { day: '2026-09-27', score: 1600 } };
  const code = exportCode({ egi, sumi });
  assert.match(code, /^IKABU1-[0-9a-z]{4}-/);
  const back = importCode(`  ${code.slice(0, 20)}\n${code.slice(20)}  `);   // 改行や空白が混ざっても読める
  assert.deepEqual(back.egi, egi);
  assert.deepEqual(back.sumi, sumi);
  assert.throws(() => importCode(code.slice(0, -1)));
  assert.throws(() => importCode('こんにちは'));
});

test('読み込み（合わせる）で記録が減ることはない：多い方・大きい方・早い日付を残す', () => {
  const now = { best: 3000, sessions: 20, bestOne: { id: 'aori', weight: 2350, mantle: 34 }, species: { aori: { count: 9, weight: 2350, mantle: 34, first: '2026-05-01' }, kensaki: { count: 2, weight: 400, mantle: 25, first: '2026-07-10' } } };
  const old = { best: 1000, sessions: 5, bestOne: { id: 'mongo', weight: 2500, mantle: 30 }, species: { aori: { count: 3, weight: 1200, mantle: 26, first: '2026-04-20' }, mongo: { count: 1, weight: 2500, mantle: 30, first: '2026-06-01' } } };
  const m = mergeEgi(now, old);
  assert.equal(m.best, 3000);
  assert.equal(m.sessions, 20);
  assert.deepEqual(Object.keys(m.species).sort(), ['aori', 'kensaki', 'mongo']);
  assert.equal(m.species.aori.count, 9);
  assert.equal(m.species.aori.first, '2026-04-20');
  assert.equal(m.bestOne.id, 'mongo');
  assert.deepEqual(mergeEgi(now, null), now);
  const s = mergeM3({ ...emptyM3(), best: 2000, badges: { join: '2026-09-20' } }, { ...emptyM3(), best: 1500, played: 40, badges: { join: '2026-09-27', star1: '2026-09-27' } });
  assert.equal(s.best, 2000);
  assert.equal(s.played, 40);
  assert.deepEqual(s.badges, { join: '2026-09-20', star1: '2026-09-27' });
});

test('テストプレイ版のコード（IKABUT1-）は正式版では読めず、正式版のコードはテストプレイ版で読めない。テストプレイ内では読める（10/2）', () => {
  const egi = { best: 500, sessions: 1, species: {}, bestOne: null, points: 3, gedo: {} };
  const t = exportCode({ egi }, { trial: true });
  const o = exportCode({ egi });
  assert.ok(t.startsWith('IKABUT1-'));
  assert.ok(o.startsWith('IKABU1-'));
  assert.equal(importCode(t, { trial: true }).egi.best, 500);
  assert.throws(() => importCode(t), /other/);
  assert.throws(() => importCode(o, { trial: true }), /other/);
  // 頭だけ書き換えても通らない
  assert.throws(() => importCode(t.replace('IKABUT1-', 'IKABU1-')), /check/);
});

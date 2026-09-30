import test from 'node:test';
import assert from 'node:assert/strict';
import { certStatus, awardCerts, CERT_IDS } from '../src/js/ikabu/games/certs.js';
import { BADGES, RUSH_BADGES, emptyM3, emptyEgi } from '../src/js/ikabu/games/records.js';
import { LEVELS } from '../src/js/ikabu/games/progress.js';

const ZUKAN = ['aori', 'kouika', 'mongo', 'shiriyake', 'kensaki', 'yari', 'surume', 'sodeika', 'akaika', 'daiou'];
const all = (list, day = '2026-09-30') => Object.fromEntries(list.map((b) => [b.id, day]));

test('何もしていない人は、どの認定証もそろっていない（進み具合は 0/…）', () => {
  const s = certStatus({ sumi: emptyM3(), egi: emptyEgi(), zukanIds: ZUKAN });
  assert.equal(s.sumi.done, false); assert.equal(s.sumi.have, 0); assert.equal(s.sumi.need, BADGES.length);
  assert.equal(s.rush.done, false); assert.equal(s.rush.need, RUSH_BADGES.length);
  assert.equal(s.egi.done, false); assert.equal(s.egi.have, 0); assert.equal(s.egi.need, 10);
  assert.equal(s.honor.done, false); assert.equal(s.honor.have, 0);
});

test('墨つなぎのバッジが全部そろうと「墨つなぎ」だけ取れる。11個では取れない', () => {
  const sumi = { ...emptyM3(), badges: all(BADGES) };
  assert.equal(certStatus({ sumi, zukanIds: ZUKAN }).sumi.done, true);
  const eleven = { ...emptyM3(), badges: all(BADGES.slice(1)) };
  const s = certStatus({ sumi: eleven, zukanIds: ZUKAN });
  assert.equal(s.sumi.done, false); assert.equal(s.sumi.have, BADGES.length - 1);
});

test('墨のがれは rush.badges を見る', () => {
  const sumi = { ...emptyM3(), rush: { best: 1, bestScore: 1, played: 1, daily: null, badges: all(RUSH_BADGES) } };
  const s = certStatus({ sumi, zukanIds: ZUKAN });
  assert.equal(s.rush.done, true); assert.equal(s.sumi.done, false);
});

test('エギングは「図鑑コンプ」か「レベル最大」のどちらかで取れる', () => {
  const zukan = { ...emptyEgi(), species: Object.fromEntries(ZUKAN.map((id) => [id, { count: 1 }])) };
  assert.equal(certStatus({ egi: zukan, zukanIds: ZUKAN }).egi.done, true);
  const nine = { ...emptyEgi(), species: Object.fromEntries(ZUKAN.slice(0, 9).map((id) => [id, { count: 1 }])) };
  assert.equal(certStatus({ egi: nine, zukanIds: ZUKAN }).egi.done, false);
  const maxed = { ...emptyEgi(), points: LEVELS[LEVELS.length - 1] };
  const s = certStatus({ egi: maxed, zukanIds: ZUKAN });
  assert.equal(s.egi.done, true); assert.equal(s.egi.level, LEVELS.length);
});

test('3つそろうと名誉部員。日付は最初に取った日のまま、2回目は fresh が空', () => {
  const sumi = { ...emptyM3(), badges: all(BADGES), rush: { best: 1, bestScore: 1, played: 1, daily: null, badges: all(RUSH_BADGES) } };
  const egi = { ...emptyEgi(), species: Object.fromEntries(ZUKAN.map((id) => [id, { count: 1 }])) };
  const s = certStatus({ sumi, egi, zukanIds: ZUKAN });
  assert.equal(s.honor.done, true); assert.equal(s.honor.have, 3);
  const a = awardCerts({}, s, { today: '2026-09-30' });
  assert.deepEqual(a.fresh, CERT_IDS);
  assert.equal(a.certs.honor, '2026-09-30');
  const b = awardCerts(a.certs, s, { today: '2026-10-01' });
  assert.deepEqual(b.fresh, []);
  assert.equal(b.certs.sumi, '2026-09-30');
});

test('片方だけそろった時は、その1枚だけ日付が付く', () => {
  const sumi = { ...emptyM3(), badges: all(BADGES) };
  const s = certStatus({ sumi, zukanIds: ZUKAN });
  const a = awardCerts({}, s, { today: '2026-09-30' });
  assert.deepEqual(a.fresh, ['sumi']);
  assert.equal(a.certs.honor, undefined);
});

// 今日の萩の海のハード（海の中が見えない）と、季節モードのアタリチャレンジの経験値（2026-10-15 ぱっぱ）
//   今日の萩の海＝1倍／ハード＝1.5倍／季節モードのアタリチャレンジ＝0.3倍（経験値だけ・図鑑と自己ベストには入らない）／それ以外の練習＝0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pointRate, catchPoints, ratedPoints, POINTS } from '../src/js/ikabu/games/progress.js';
import { emptyEgi, recordEgiCatch, recordGedo, recordEgiTrip, addEgiPoints } from '../src/js/ikabu/games/records.js';

test('倍率：今日の萩の海1・ハード1.5・季節のアタリチャレンジ0.3・ほかの練習0', () => {
  assert.equal(pointRate({ mode: 'live' }), 1);
  assert.equal(pointRate({ mode: 'live', blind: true }), 1.5);
  assert.equal(pointRate({ mode: 'practice', blind: true }), 0.3);
  assert.equal(pointRate({ mode: 'practice' }), 0);
  assert.equal(pointRate({ mode: 'beginner' }), 0);
});
test('ハードで釣ると経験値1.5倍（800gのアオリ＝18点→27点）。外道・釣行の終わりも1.5倍', () => {
  const c = { id: 'aori', weight: 800, mantle: 20 };
  const normal = recordEgiCatch(emptyEgi(), c, { rate: 1 }).points;
  const hard = recordEgiCatch(emptyEgi(), c, { rate: 1.5 }).points;
  assert.equal(normal, catchPoints(c, { fresh: true }));
  assert.equal(hard, Math.round(normal * 1.5));
  assert.ok(hard > normal);
  assert.equal(recordGedo(emptyEgi(), { id: 'kasago', weight: 100 }, { rate: 1.5 }).points, ratedPoints(POINTS.gedo, 1.5));
  assert.equal(recordEgiTrip(emptyEgi(), [], { rate: 1.5 }).points, ratedPoints(POINTS.trip, 1.5));
});
test('季節モードのアタリチャレンジは経験値だけ（図鑑・自己ベスト・釣行の数は増えない）', () => {
  const c = { id: 'aori', weight: 800, mantle: 20 };
  const r = addEgiPoints(emptyEgi(), ratedPoints(catchPoints(c), 0.3));
  assert.equal(r.points, Math.round(catchPoints(c) * 0.3));
  assert.deepEqual(r.species, {});
  assert.equal(r.best, 0);
  assert.equal(r.sessions, 0);
});
test('画面：今日の萩の海の「ふつう／ハード」の切り替えがある', () => {
  const view = readFileSync(new URL('../src/js/ikabu/views/play.js', import.meta.url), 'utf8');
  assert.ok(view.includes('id="ika-egi-hard"') && view.includes('data-hard="1"'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { SPOTS, AREA_PLACES, UNKNOWN_PLACE, ALL_PLACES, AREA_LABELS, placeById, placeLabel } from '../src/js/data/spot-list.js';
import { FISH, WIND_FEEL, nameOf } from '../src/js/data/report-options.js';

test('IDは重複しない', () => {
  const ids = ALL_PLACES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('5エリアそれぞれに「市内（非公開）」がある', () => {
  for (const areaId of Object.keys(AREA_LABELS)) {
    assert.ok(AREA_PLACES.some((p) => p.areaId === areaId), areaId);
  }
  assert.equal(Object.keys(AREA_LABELS).length, 5);
});

test('釣り場は必ず5エリアのどれかに属する', () => {
  for (const s of SPOTS) assert.ok(AREA_LABELS[s.areaId], `${s.id} → ${s.areaId}`);
});

test('場所不明はエリアを持たない', () => {
  assert.equal(UNKNOWN_PLACE.areaId, null);
  assert.equal(placeById('unknown'), UNKNOWN_PLACE);
  assert.equal(placeById('no-such-id'), null);
});

test('選択肢の名前を引ける', () => {
  assert.equal(nameOf(FISH, 'none'), '釣れなかった');
  assert.equal(nameOf(WIND_FEEL, 'stronger'), '予報より強かった');
  assert.equal(nameOf(FISH, 'xxx'), '');
});

test('placeLabelはnoteが無ければ名前だけ、あれば「名前（note）」の形にする', () => {
  assert.equal(placeLabel({ name: '越ヶ浜漁港' }), '越ヶ浜漁港');
  assert.equal(placeLabel({ name: '深浦漁港', note: '一部区画は釣り禁止' }), '深浦漁港（一部区画は釣り禁止）');
});

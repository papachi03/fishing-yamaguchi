import test from 'node:test';
import assert from 'node:assert/strict';
import { colorFit, bestColors, moonLight, moonPhase, normalizeConditions } from '../src/js/ikabu/games/egi.js';
import { moonAge } from '../src/js/api/fishing.js';

const cond = (moon) => normalizeConditions({ expectation: 6, wind: 2, wave: 0.6, moon });

test('月の明るさ：新月0・満月1。呼び名は 新月→細い月→半月→ふくらんだ月→満月', () => {
  assert.ok(moonLight(0) < 0.01);
  assert.ok(moonLight(14.77) > 0.99);
  assert.equal(moonPhase(0), 'new');
  assert.equal(moonPhase(0.5), 'half');
  assert.equal(moonPhase(1), 'full');
  const m = moonLight(moonAge(new Date('2026-09-29T12:00:00Z')));
  assert.ok(m >= 0 && m <= 1);
});

test('夜だけ：満月はパープルが、新月は赤がいちばん合う。朝夕・日中は月で変わらない', () => {
  assert.ok(colorFit('purple', { tod: 'night', cond: cond(1), mood: 'normal' }) > colorFit('purple', { tod: 'night', cond: cond(0), mood: 'normal' }));
  assert.ok(colorFit('red', { tod: 'night', cond: cond(0), mood: 'normal' }) > colorFit('red', { tod: 'night', cond: cond(1), mood: 'normal' }));
  assert.ok(bestColors({ tod: 'night', cond: cond(1), mood: 'normal' }).includes('purple'));
  assert.ok(bestColors({ tod: 'night', cond: cond(0), mood: 'normal' }).includes('red'));
  for (const tod of ['morning', 'day', 'evening']) for (const c of ['red', 'purple', 'pink', 'brown']) {
    assert.equal(colorFit(c, { tod, cond: cond(0), mood: 'normal' }), colorFit(c, { tod, cond: cond(1), mood: 'normal' }));
  }
});

test('月が無い条件（古い記録など）でも半月として動く', () => {
  assert.equal(normalizeConditions({}).moon, 0.5);
  assert.equal(normalizeConditions({ moon: 'x' }).moon, 0.5);
});

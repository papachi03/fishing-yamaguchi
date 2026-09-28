// 堤防判定：気象庁の注意報・警報で判定を引き上げる（2026-09-29 表向きの差し替えの安全の仕組み）
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSafety } from '../src/js/api/safety.js';

const calm = { wind: 1, gust: null, waveHeight: 0.3, wavePeriod: 3, windDir: 180, facing: 0, seaProfile: 'nihonkai' };

test('注意報・警報が無ければ、今までどおり風と波で決まる', () => {
  assert.equal(assessSafety(calm).level, 0);
  assert.equal(assessSafety({ ...calm, alerts: [] }).level, 0);
});

test('強風・波浪の注意報は「危険」以上、警報は「中止」', () => {
  const adv = assessSafety({ ...calm, alerts: [{ kind: 'advisory', name: '強風注意報' }] });
  assert.equal(adv.level, 2);
  assert.ok(adv.reasons.includes('強風注意報'));
  assert.equal(assessSafety({ ...calm, alerts: [{ kind: 'warning', name: '波浪警報' }] }).level, 3);
});

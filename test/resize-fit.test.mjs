// 写真を決めた大きさに収める段の並び（2026-10-01）。中身の縮小はブラウザでしか動かないので、段の決まりだけ確かめる
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIT_STEPS } from '../src/js/lib/resize-image.js';

test('段は辺も画質も下がっていく順。最初は1600px、最後でも720px（写真部で見られる大きさ）', () => {
  assert.deepEqual(FIT_STEPS[0], [1600, 0.8]);
  for (let i = 1; i < FIT_STEPS.length; i++) {
    assert.ok(FIT_STEPS[i][0] < FIT_STEPS[i - 1][0]);
    assert.ok(FIT_STEPS[i][1] <= FIT_STEPS[i - 1][1]);
  }
  assert.ok(FIT_STEPS.at(-1)[0] >= 720);
});

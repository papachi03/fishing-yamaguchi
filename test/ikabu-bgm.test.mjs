// ゲームのBGM（2026-09-30）：最初はオフ・控えめの音量・エギングがいちばん小さい・曲ファイルとつなぎ目の秒
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { createBgm, TRACKS, DUCK } from '../src/js/ikabu/games/bgm.js';

test('BGMは最初はオフ。オンにしても、曲を決めるまで鳴らさない（window の無い所でも落ちない）', () => {
  const b = createBgm();
  assert.equal(b.on, false);
  assert.equal(b.playing, null);
  b.setTrack('sumi');
  assert.equal(b.track, 'sumi');
  assert.equal(b.playing, null, 'オフの間は鳴らさない');
  b.setTrack('nope');
  assert.equal(b.track, null);
});

test('控えめの音量：エギングがいちばん小さく、聞かせたい音の間はさらに下げる', () => {
  for (const tr of Object.values(TRACKS)) assert.ok(tr.volume > 0 && tr.volume <= 0.2, `${tr.src} ${tr.volume}`);
  assert.ok(TRACKS.egi.volume < TRACKS.sumi.volume && TRACKS.egi.volume < TRACKS.rush.volume);
  assert.ok(DUCK > 0 && DUCK <= 0.5);
});

test('曲ファイルがあり、つなぎ目は前奏の後・曲の終わりの手前', () => {
  for (const [name, tr] of Object.entries(TRACKS)) {
    const p = new URL(`../public${tr.src}`, import.meta.url);
    assert.ok(existsSync(p), name);
    assert.ok(statSync(p).size < 2_000_000, `${name} は2MB未満`);
    assert.ok(tr.loopStart > 4 && tr.loopEnd - tr.loopStart > 40, `${name} の繰り返しは40秒以上`);
  }
});

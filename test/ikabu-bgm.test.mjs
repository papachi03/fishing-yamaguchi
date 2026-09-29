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

// アワセが決まった時の振動（2026-09-30 ぱっぱ：Androidなら激しく）
import { hookPattern } from '../src/js/ikabu/games/feel.js';
test('アワセの振動は強い連打で、大きいイカほど締めが長い。合計1秒以内', () => {
  const small = hookPattern(0.25), big = hookPattern(1.6);
  assert.ok(small.length >= 5);
  assert.ok(big.at(-1) > small.at(-1));
  assert.ok(big.reduce((a, b) => a + b, 0) <= 1000);
  assert.ok(TRACKS.egi.volume <= 0.1, 'エギングのBGMは控えめ');
});

// 2026-09-30 友だちの感想（墨つなぎ）：残り手数がスクロールしないと見えない／墨ダマでどれが一番多く消せるか知りたい
import { readFileSync } from 'node:fs';
test('隠した墨のがれの舞台は場所を取らない（hidden で display:none）。道具の並びは🎵まで入る', () => {
  const css = readFileSync(new URL('../src/css/ikabu.css', import.meta.url), 'utf8');
  assert.match(css, /\.ika-m3-rush\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /\.ika-m3-tools \{ display: grid; grid-template-columns: minmax\(0, 1fr\) auto auto auto auto;/);
  assert.match(css, /\.ika-m3-tools \{ grid-template-columns: 1fr 1fr auto auto; \}/);
});
test('墨ダマを選んだ時の案内は、いちばん多い数を言う（play-text は import.meta.env を読むので文字で確かめる）', () => {
  const src = readFileSync(new URL('../src/js/ikabu/games/play-text.js', import.meta.url), 'utf8');
  assert.match(src, /ballPick: \(lang, n\) =>/);
  assert.match(src, /いちばん多いのは \$\{n\}個/);
});
test('ラインの印は目立つ色（オレンジの帯）、墨フラッシュが使える間はボタンが脈打つ・溜まった時の吹き出しがある', () => {
  const css = readFileSync(new URL('../src/css/ikabu.css', import.meta.url), 'utf8');
  const src = readFileSync(new URL('../src/js/ikabu/games/play-text.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/js/ikabu/games/match3-ui.js', import.meta.url), 'utf8');
  assert.match(css, /\.ika-m3-line \{[^}]*#f47321/);
  assert.match(css, /\.ika-m3-flash\.is-ready:not\(:disabled\) \{[^}]*animation: ika-m3-ready/);
  assert.match(src, /inkReady: pair\('墨フラッシュ たまった！'/);
  assert.match(ui, /callout\(t\(lang, TX\.msg\.inkReady\)/);
});

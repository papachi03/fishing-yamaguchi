// エギングの釣行のまとめの下の「本物の海で釣るなら」（2026-10-17）
import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldLinksHTML, FIELD_FROM } from '../src/js/ikabu/field-links.js';

test('海況へのリンクと、釣り方に合う記事へのリンクが出る（GA4で数える目印つき）', () => {
  const egi = fieldLinksHTML('ja', 'egi');
  assert.match(egi, /本物の海で釣るなら/);
  assert.ok(egi.includes(`href="/sea.html?from=${FIELD_FROM}"`));
  assert.ok(egi.includes(`href="/guides/autumn-eging.html?from=${FIELD_FROM}"`));
  assert.match(fieldLinksHTML('ja', 'yaen'), /\/guides\/yaen-beginner\.html\?from=/);
  assert.match(fieldLinksHTML('ja', 'tailor'), /\/spots\.html\?from=/);
  assert.match(fieldLinksHTML('ja', undefined), /\/guides\/autumn-eging\.html\?from=/);   // 分からない釣り方はエギング
});

test('英語ページでは英語の文言＋（Japanese）の印。日本語の文字は出ない', () => {
  const en = fieldLinksHTML('en', 'yaen');
  assert.match(en, /Fishing the real sea/);
  assert.match(en, /\(Japanese\)/);
  assert.doesNotMatch(en, /[぀-ヿ㐀-鿿]/);
  assert.doesNotMatch(en, /undefined|function /);
});

test('実際の釣りの動画：遊んだ釣り方の見出しへ（目印は # の前）', () => {
  assert.ok(fieldLinksHTML('ja', 'jado').includes(`href="/videos.html?from=${FIELD_FROM}#jado"`));
  assert.ok(fieldLinksHTML('ja', 'yaen').includes(`href="/videos.html?from=${FIELD_FROM}#yaen"`));
  assert.ok(fieldLinksHTML('ja', 'tailor').includes(`href="/videos.html?from=${FIELD_FROM}#tailor"`));
  assert.ok(fieldLinksHTML('ja', 'egi').includes(`href="/videos.html?from=${FIELD_FROM}"`));
  assert.match(fieldLinksHTML("ja", "yaen"), /実際の釣りを動画で見る/);
  assert.ok(fieldLinksHTML("ja", "yaen").includes("i.ytimg.com/vi/Y3suaT2xEkk/"));
});

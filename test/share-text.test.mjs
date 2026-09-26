import test from 'node:test';
import assert from 'node:assert/strict';
import { egiCatchText, egiTripText, sumiText, shareUrl, xIntent } from '../src/js/ikabu/games/share.js';

test('エギング：釣れた1杯の一言。季節モードは（季節モード）と書く', () => {
  assert.equal(egiCatchText('ja', { name: 'アオリイカ', weightG: 1820, practice: false }), 'しゃくって抱かせろ！でアオリイカ 1,820gを釣った🦑 #山口イカ部');
  assert.match(egiCatchText('ja', { name: 'アオリイカ', weightG: 1820, practice: true }), /（季節モード）/);
  assert.match(egiCatchText('en', { name: 'Bigfin reef squid', weightG: 1820, practice: true }), /season mode/);
});

test('エギング：釣行のまとめ。0杯は「ボウズ…でも部員」', () => {
  assert.match(egiTripText('ja', { count: 0, biggest: null }), /ボウズ…でも部員/);
  assert.equal(egiTripText('ja', { count: 3, biggest: { name: 'アオリイカ', weightG: 1820 } }), 'しゃくって抱かせろ！で3杯🦑 最大はアオリイカ 1,820g #山口イカ部');
});

test('墨つなぎ：今日の一戦は日付つき', () => {
  assert.equal(sumiText('ja', { score: 1720, daily: true, dayLabel: '2026/9/27' }), '墨つなぎで1,720点！（今日の一戦 2026/9/27） #山口イカ部');
  assert.doesNotMatch(sumiText('ja', { score: 900, daily: false }), /今日の一戦/);
});

test('URLは本番のあそび場（言語別）、Xのリンクは文章とURLを分けて渡す', () => {
  assert.equal(shareUrl('ja', 'egi'), 'https://yamaguchifishing.com/ikabu/play.html#egi');
  assert.equal(shareUrl('en', 'sumi'), 'https://yamaguchifishing.com/ikabu/en/play.html#sumi');
  const u = new URL(xIntent('テスト #山口イカ部', 'https://yamaguchifishing.com/ikabu/play.html#egi'));
  assert.equal(u.searchParams.get('text'), 'テスト #山口イカ部');
  assert.equal(u.searchParams.get('url'), 'https://yamaguchifishing.com/ikabu/play.html#egi');
});

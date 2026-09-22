import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composeMorningPost,
  jstDateLabel,
  xWeightedLength,
  xIntentUrl,
  X_LIMIT,
  SEA_URL,
  HASHTAGS,
} from '../src/js/lib/morning-post.js';

const AREAS = ['萩', '長門', '下関', '下松', '防府'];
// 2026-09-22 20:00 UTC ＝ 日本時間 9/23(水) 5:00
const DATE = new Date('2026-09-22T20:00:00Z');

test('日付は日本時間で作る（UTCではまだ前日でも）', () => {
  assert.equal(jstDateLabel(DATE), '9/23(水)');
});

test('5エリアが並び、安全は「穏やか」と言い換える', () => {
  const text = composeMorningPost({
    date: DATE,
    rows: [
      { nameJa: '萩', level: 1, wind: 4.2 },
      { nameJa: '長門', level: 2, wind: 5.8 },
      { nameJa: '下関', level: 3, wind: 7.4 },
      { nameJa: '下松', level: 0, wind: 2.1 },
      { nameJa: '防府', level: 0, wind: 2.44 },
    ],
  });
  assert.match(text, /^【9\/23\(水\) 朝の堤防判定】/);
  assert.match(text, /萩　🟡注意　風4\.2m/);
  assert.match(text, /長門　🟠危険　風5\.8m/);
  assert.match(text, /下関　🔴中止　風7\.4m/);
  assert.match(text, /下松　🟢穏やか　風2\.1m/);
  assert.match(text, /防府　🟢穏やか　風2\.4m/);
  assert.doesNotMatch(text, /安全/, 'SNSでは「安全」と書かない');
  assert.match(text, /気象庁の注意報・警報を優先/);
  assert.ok(text.includes(SEA_URL));
  for (const tag of HASHTAGS) assert.ok(text.includes(tag), tag);
});

test('予報を取れなかったエリアは「取得できず」と書き、判定を出さない', () => {
  const text = composeMorningPost({ date: DATE, rows: [{ nameJa: '萩', level: null, wind: null }] });
  assert.match(text, /萩　⚪ 取得できず/);
});

test('一番長くなる日（全エリア「穏やか」＋2桁の風）でもXの上限280に収まる', () => {
  const rows = AREAS.map((nameJa) => ({ nameJa, level: 0, wind: 12.3 }));
  const text = composeMorningPost({ date: new Date('2026-12-30T20:00:00Z'), rows });
  const len = xWeightedLength(text);
  assert.ok(len <= X_LIMIT, `文字数 ${len} が上限 ${X_LIMIT} を超えている`);
});

test('文字数の数え方：日本語は2、英数字は1、URLは23', () => {
  assert.equal(xWeightedLength('あ'), 2);
  assert.equal(xWeightedLength('a'), 1);
  assert.equal(xWeightedLength('https://example.com/very/long/path?x=1'), 23);
});

test('Xの投稿画面を開くリンクは文章を丸ごと渡す', () => {
  const url = xIntentUrl('萩 #釣り\nhttps://a.b/?c=1&d=2');
  assert.ok(url.startsWith('https://x.com/intent/post?text='));
  assert.equal(decodeURIComponent(url.split('text=')[1]), '萩 #釣り\nhttps://a.b/?c=1&d=2');
});

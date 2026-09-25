import test from 'node:test';
import assert from 'node:assert/strict';
import { friendsSectionHTML } from '../src/js/components/friends-html.js';
import { friends } from '../src/js/data/friends.js';

test('実データ：チャンネルリンク・コラボ4本・アイコン・見出しが入る', () => {
  const html = friendsSectionHTML(friends);
  const f = friends[0];
  assert.ok(html.includes(`href="${f.channelUrl}"`));
  assert.equal((html.match(/https:\/\/www\.youtube\.com\/watch\?v=/g) || []).length, 4);
  for (const v of f.collabs) {
    assert.ok(html.includes(`watch?v=${v.id}"`), v.id);
    assert.ok(html.includes(`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`), v.id);
  }
  assert.ok(html.includes('src="/assets/friends/meicho-shingi.webp"'));
  assert.ok(html.includes('id="about-friends-h"'));
  assert.ok(html.includes('山口の釣り仲間'));
  assert.ok(html.includes('名釣心技'));
  assert.ok(html.includes('（めいちょうしんぎ）'));
  assert.ok(html.includes('ダディとのつながり'));
  assert.ok(html.includes('YouTubeチャンネルを見る'));
  // 外部リンクは新しいタブ＋noopener、サムネイルは遅延読み込み
  assert.ok(html.includes('target="_blank" rel="noopener"'));
  assert.ok(html.includes('loading="lazy"'));
});

test('本文の < や " はエスケープされる', () => {
  const html = friendsSectionHTML([
    {
      id: 'x',
      name: 'A<b>',
      kana: 'かな',
      nameEn: 'X',
      area: '下関',
      icon: '/i.webp',
      channelUrl: 'https://www.youtube.com/@x',
      tags: ['<t>'],
      intro: ['1 < 2 "q"'],
      story: '<s>',
      collabs: [{ id: 'abc', title: 'T <1>' }],
    },
  ]);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('A&lt;b&gt;'));
  assert.ok(html.includes('&lt;t&gt;'));
  assert.ok(html.includes('1 &lt; 2 &quot;q&quot;'));
  assert.ok(html.includes('T &lt;1&gt;'));
});

test('base を渡すとアイコンのパスに前置される', () => {
  const html = friendsSectionHTML(friends, { base: '/fishing-yamaguchi/' });
  assert.ok(html.includes('src="/fishing-yamaguchi/assets/friends/meicho-shingi.webp"'));
});

test('空なら何も出さない', () => {
  assert.equal(friendsSectionHTML([]), '');
});

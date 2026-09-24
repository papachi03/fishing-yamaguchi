import test from 'node:test';
import assert from 'node:assert/strict';
import { guides, guideHref, guidesForMonth, guidesForSpecies } from '../src/js/data/guides.js';
import { guideCardsHTML, guideCardHTML, homeGuides } from '../src/js/components/guide-card-html.js';

const eging = guides.find((g) => g.slug === 'autumn-eging');

test('guidesForSpecies：魚種名に「イカ」を含む釣行だけ秋エギング記事に当たる', () => {
  for (const s of ['モンゴウイカ', 'コウイカ', 'ヤリイカ']) {
    assert.deepEqual(guidesForSpecies(s).map((g) => g.slug), ['autumn-eging'], s);
  }
  assert.deepEqual(guidesForSpecies('タイワンガザミ'), []);
  assert.deepEqual(guidesForSpecies(null), []);
  assert.deepEqual(guidesForSpecies(''), []);
});

test('guidesForMonth：秋の3か月だけ。homeGuides は合う月が無ければ全記事に落ちる', () => {
  assert.equal(guidesForMonth(10).length, 1);
  assert.equal(guidesForMonth(3).length, 0);
  assert.equal(homeGuides(10).length, 1);
  assert.equal(homeGuides(3).length, guides.length);
});

test('guideCardsHTML：href・タイトル・写真・帯・リードが入る。1本なら is-single', () => {
  const html = guideCardsHTML([eging]);
  assert.ok(html.startsWith('<div class="guide-cards is-single">'));
  assert.ok(html.includes(`href="${guideHref(eging)}"`));
  assert.ok(html.includes('href="/guides/autumn-eging.html"'));
  assert.ok(html.includes(eging.title));
  assert.ok(html.includes(`src="${eging.image}"`));
  assert.ok(html.includes(`${eging.image1600} 1600w`));
  assert.ok(html.includes(`alt="${eging.alt}"`));
  assert.ok(html.includes('<span class="guide-card-badge">秋の新子シーズン</span>'));
  assert.ok(html.includes(eging.lead));
  assert.ok(html.includes('読む'));
});

test('guideCardsHTML：2本以上なら is-single が付かない。空なら空文字', () => {
  const html = guideCardsHTML([eging, { ...eging, slug: 'x' }]);
  assert.ok(html.startsWith('<div class="guide-cards">'));
  assert.equal((html.match(/class="guide-card"/g) || []).length, 2);
  assert.equal(guideCardsHTML([]), '');
});

test('guideCardHTML：base を付けるとルート基準のパス全部に付く', () => {
  const html = guideCardHTML(eging, { base: '/fishing-yamaguchi/' });
  assert.ok(html.includes('href="/fishing-yamaguchi/guides/autumn-eging.html"'));
  assert.ok(html.includes('src="/fishing-yamaguchi/assets/images/aori_shinko_800.webp"'));
  assert.ok(!html.includes('//'));
});

test('guideCardHTML：タイトル等のHTML特殊文字はそのまま出さない', () => {
  const html = guideCardHTML({ slug: 'a"b', title: '<b>x</b> & y', badge: '"q"', lead: 'a<b', alt: '"' , image: '/i.webp' });
  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt; &amp; y'));
  assert.ok(html.includes('href="/guides/a&quot;b.html"'));
  assert.ok(html.includes('alt="&quot;"'));
  assert.ok(!html.includes('<script'));
});

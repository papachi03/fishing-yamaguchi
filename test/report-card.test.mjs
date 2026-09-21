import test from 'node:test';
import assert from 'node:assert/strict';
import { reportCardHTML, esc } from '../src/js/components/report-card.js';
import { spotListHTML } from '../src/js/components/spot-list-html.js';

const photoUrl = (id) => `https://api.example/photo/${id}`;
const post = {
  id: '8210000000000-0a1b2c3d', name: '<img src=x onerror=alert(1)>', spotId: 'hagi-koshigahama', areaId: 'hagi',
  comment: '</p><script>alert(2)</script>\n2行目', fish: 'aji', wind: 'stronger', date: '2026-09-05', hasPhoto: true,
  createdAt: '2026-09-05T09:00:00.000Z',
};

test('escはHTMLの特殊文字を全部置き換える', () => {
  assert.equal(esc(`<a href="x" onclick='y'>&`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;');
});

test('名前とコメントはエスケープされ、タグとして出ない', () => {
  const html = reportCardHTML(post, photoUrl);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});

test('場所・魚・風・日付が日本語で出る。写真と通報ボタンがある', () => {
  const html = reportCardHTML(post, photoUrl);
  assert.match(html, /越ヶ浜漁港/);
  assert.match(html, /アジ/);
  assert.match(html, /予報より強かった/);
  assert.match(html, /9\/5の情報/);
  assert.match(html, /src="https:\/\/api\.example\/photo\/8210000000000-0a1b2c3d"/);
  assert.match(html, /data-report="8210000000000-0a1b2c3d"/);
});

test('日付が無い・形が違う投稿でも NaN/NaN と出さない', () => {
  for (const date of [undefined, null, '', 'てきとう']) {
    const html = reportCardHTML({ ...post, date }, photoUrl);
    assert.doesNotMatch(html, /NaN/, String(date));
    assert.match(html, /report-meta/);
  }
  // 日付があるときは今までどおり出る
  assert.match(reportCardHTML(post, photoUrl), /9\/5の情報/);
});

test('写真なし・任意項目なし・リストに無い場所でも崩れない', () => {
  const html = reportCardHTML({ ...post, hasPhoto: false, fish: '', wind: '', spotId: 'deleted-spot' }, photoUrl);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /場所不明/);
});

test('釣り場一覧は5エリア分の見出しを持つ', () => {
  const html = spotListHTML();
  for (const label of ['萩', '長門', '下関', '下松', '防府']) assert.match(html, new RegExp(`<dt>${label}</dt>`));
  assert.match(html, /越ヶ浜漁港/);
});

// イカ部の中身のページ（第2段階）で、ブラウザ無しで確かめられる純粋な部分
import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleQty, scaledIngredients } from '../src/js/ikabu/recipe-scale.js';
import { recipes, species, photos, photoById } from '../src/js/ikabu/data.js';
import { parseIkabuPath } from '../scripts/prerender-ikabu.mjs';
import { ikabuShells } from '../scripts/gen-ikabu-shells.mjs';

test('分量は2人分が基準で、4人分は2倍・小数は1桁', () => {
  assert.equal(scaleQty(250, 2), 250);
  assert.equal(scaleQty(250, 4), 500);
  assert.equal(scaleQty(15, 3), 22.5);
  assert.deepEqual(scaledIngredients([[{ ja: '塩', en: 'Salt' }, 2, 'g']], 4)[0][1], 4);
});

test('レシピの写真・図鑑の写真は data.js の中で解決できる', () => {
  for (const s of species) if (s.photo) assert.ok(photoById(s.photo), `${s.id} の写真 ${s.photo} が photos に無い`);
  for (const p of photos) assert.ok(p.author && p.license && p.source, `${p.id} の出典が欠けている`);
  assert.equal(recipes.length, 4);
});

test('殻のパスから page / lang / recipeId を読む', () => {
  assert.deepEqual(parseIkabuPath('G:\\x\\ikabu\\en\\map.html'), { lang: 'en', page: 'map', recipeId: null });
  assert.deepEqual(parseIkabuPath('/x/ikabu/recipes/butter.html'), { lang: 'ja', page: 'recipe', recipeId: 'butter' });
  assert.deepEqual(parseIkabuPath('/x/ikabu/en/recipes/miso.html'), { lang: 'en', page: 'recipe', recipeId: 'miso' });
  assert.equal(parseIkabuPath('/x/sea.html'), null);
});

test('殻の一覧：10ページ×2言語 ＋ レシピ4品×2言語、hreflang は同じ品を指す', () => {
  const shells = ikabuShells();
  assert.equal(shells.length, 28);
  const butterEn = shells.find((s) => s.file === 'ikabu/en/recipes/butter.html');
  assert.equal(butterEn.page, 'recipe');
  assert.equal(butterEn.path('ja'), '/ikabu/recipes/butter.html');
  assert.equal(butterEn.path('en'), '/ikabu/en/recipes/butter.html');
});

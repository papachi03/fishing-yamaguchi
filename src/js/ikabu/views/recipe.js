// recipe：レシピ1品。render(lang, { recipeId }) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 静的ページ ikabu/recipes/<id>.html（ビルド時に recipeId 付きで描く）。既定は2人分で、
// 4人分への切り替えは pages/recipe.js が data-qty から計算して書き換える。
// recipeId が無いとき（古い recipe.html）はレシピの選択肢を出す。?id= は pages/recipe.js が静的ページへ送る
import { t, pair, esc, pageHref, recipeHref } from '../i18n.js';
import { recipes } from '../data.js';
import { pageHead } from './parts.js';
import { foodSafetyHTML, recipeCardHTML } from './recipes.js';
import { BASE_SERVINGS, scaledIngredients } from '../recipe-scale.js';

export const HEAD = {
  num: '03',
  eyebrow: 'THE IKA KITCHEN',
  title: pair('材料と作り方', 'Ingredients & steps'),
  desc: pair('1品ずつのレシピページ。分量と手順を、台所で見やすく。', 'One recipe per page, with quantities and steps laid out for the kitchen.'),
};

export const recipeById = (id) => recipes.find((r) => r.id === id) ?? null;

export function ingredientsHTML(lang, r, servings = BASE_SERVINGS) {
  return scaledIngredients(r.ingredients, servings)
    .map(([name, qty, unit], i) => `<li><span>${t(lang, name)}</span><span class="ika-qty" data-qty="${r.ingredients[i][1]}" data-unit="${esc(unit)}">${qty} ${esc(unit)}</span></li>`)
    .join('');
}

function recipePageHTML(lang, r) {
  const others = recipes.filter((x) => x.id !== r.id);
  return `${pageHead(lang, { num: '03', eyebrow: 'THE IKA KITCHEN', title: r.name, desc: r.intro })}
  <article class="ika-section ika-recipe" data-recipe="${r.id}">
    <div class="wrap">
      <p class="ika-recipe-meta">
        <span class="ika-recipe-kind">${t(lang, r.kind)}</span>
        <span class="ika-recipe-time"><b>${r.time}</b>${t(lang, '分（目安）', 'min, approximate')}</span>
        <span class="ika-recipe-serves" id="ika-serves-label">${t(lang, `${BASE_SERVINGS}人分`, `${BASE_SERVINGS} servings`)}</span>
      </p>
      <div class="ika-recipe-body">
        <aside class="ika-ingredients">
          <h2>${t(lang, '材料', 'Ingredients')}</h2>
          <div class="ika-chips ika-chips--small" id="ika-servings" role="group" aria-label="${t(lang, '人数', 'Servings')}">
            <button type="button" class="ika-chip" data-servings="2" aria-pressed="true">${t(lang, '2人分', '2 servings')}</button>
            <button type="button" class="ika-chip" data-servings="4" aria-pressed="false">${t(lang, '4人分', '4 servings')}</button>
          </div>
          <ul class="ika-ingredient-list" id="ika-ingredient-list">${ingredientsHTML(lang, r)}</ul>
        </aside>
        <div class="ika-method">
          <h2>${t(lang, '作り方', 'Method')}</h2>
          <ol class="ika-steps">${r.steps.map((s) => `<li>${t(lang, s)}</li>`).join('')}</ol>
          <p class="ika-tip"><span class="ika-tip-label">${t(lang, 'コツ', 'Tip')}</span>${t(lang, r.tip)}</p>
          <div class="ika-recipe-actions">
            <button type="button" class="ika-btn ika-btn--sea" id="ika-print">${t(lang, 'レシピを印刷', 'Print recipe')}</button>
            <a class="ika-recipe-back" href="${pageHref('recipes', lang)}">${t(lang, 'ほかのレシピを見る', 'More recipes')} <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </div>
      ${foodSafetyHTML(lang)}
      <p class="ika-print-only">${t(lang, '山口イカ部 イカ食堂 — yamaguchifishing.com/ikabu/', 'Yamaguchi Ika Club, The Ika Kitchen — yamaguchifishing.com/ikabu/en/')}</p>
    </div>
  </article>
  <section class="ika-section ika-section--tint ika-recipe-others">
    <div class="wrap">
      <h2 class="ika-h2-small">${t(lang, 'ほかの一皿', 'More from the kitchen')}</h2>
      <div class="ika-recipe-list">${others.map((x) => recipeCardHTML(lang, x)).join('')}</div>
    </div>
  </section>`;
}

// recipeId が無いとき：品を選ぶページ（古い recipe.html の受け皿）
function chooserHTML(lang) {
  return `${pageHead(lang, HEAD)}
  <section class="ika-section">
    <div class="wrap">
      <p class="ika-sea-p">${t(lang, 'レシピは1品ずつ別のページにあります。作りたい一皿を選んでください。', 'Each recipe has its own page. Choose the dish you would like to make.')}</p>
      <div class="ika-recipe-list">${recipes.map((r) => recipeCardHTML(lang, r)).join('')}</div>
    </div>
  </section>`;
}

export function render(lang, { recipeId = null } = {}) {
  const r = recipeById(recipeId);
  return r ? recipePageHTML(lang, r) : chooserHTML(lang);
}

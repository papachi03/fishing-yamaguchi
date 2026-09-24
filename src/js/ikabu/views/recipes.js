// recipes：イカ食堂の一覧。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
import { t, pair, esc, recipeHref, assetHref } from '../i18n.js';
import { recipes, foodSafety, photoById } from '../data.js';
import { pageHead, creditHTML, noteHTML } from './parts.js';

export const HEAD = {
  num: '03',
  eyebrow: 'THE IKA KITCHEN',
  title: pair('今日のイカを、いただきます。', 'Something good from the squid kitchen.'),
  desc: pair('家庭で作る４つの加熱料理。人数に合わせて分量を切り替えられます。', 'Four home recipes using cooked squid. Switch quantities for two or four servings.'),
};

// 食の安全の注意（一覧・各レシピで共通）
export function foodSafetyHTML(lang) {
  const [label, href] = foodSafety.link;
  return noteHTML(lang, {
    label: foodSafety.label,
    tone: 'orange',
    html: `<p>${t(lang, foodSafety.text)} <a href="${esc(href)}" target="_blank" rel="noopener">${t(lang, label)} ↗</a></p>`,
  });
}

const KIND_ICON = { butter: '🍳', daikon: '🍲', pasta: '🍝', miso: '🥢' };

export function recipeCardHTML(lang, r) {
  return `
  <a class="ika-recipe-card" href="${recipeHref(r.id, lang)}">
    <span class="ika-recipe-kind"><span aria-hidden="true">${KIND_ICON[r.id] ?? '🦑'}</span>${t(lang, r.kind)}</span>
    <span class="ika-recipe-time"><b>${r.time}</b>${t(lang, '分', 'min')}</span>
    <span class="ika-recipe-name">${t(lang, r.name)}</span>
    <span class="ika-recipe-intro">${t(lang, r.intro)}</span>
    <span class="ika-recipe-go">${t(lang, '材料と作り方', 'Ingredients & steps')} <span aria-hidden="true">→</span></span>
  </a>`;
}

export function render(lang) {
  const photo = photoById('grilled');
  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-kitchen-section">
    <div class="wrap">
      <div class="ika-kitchen-intro">
        <div>
          <h2>${t(lang, 'バター醤油から、<br />休日のパスタまで。', 'From soy butter<br />to weekend pasta.')}</h2>
          <p>${t(lang, '下処理済みのイカなら、台所での一歩も気軽に。釣っていない日にも、市販のイカで楽しもう。', 'Cleaned squid makes it easy to start. You do not need to catch your own; store-bought squid is welcome.')}</p>
          <p class="ika-small">${t(lang, 'イカ部が家庭向けに構成したレシピです。写真は別の調理例です。', 'Recipes composed for home cooking by the club. Photography shows separate serving examples.')}</p>
        </div>
        <figure class="ika-kitchen-photo">
          <img src="${assetHref(photo.file)}" alt="${esc(t(lang, photo.caption))}" width="1400" height="1050" loading="lazy" decoding="async" />
          ${creditHTML(lang, photo)}
        </figure>
      </div>
      <div class="ika-recipe-list">${recipes.map((r) => recipeCardHTML(lang, r)).join('')}</div>
      ${foodSafetyHTML(lang)}
    </div>
  </section>`;
}

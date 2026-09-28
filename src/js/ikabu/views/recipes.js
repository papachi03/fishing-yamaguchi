// recipes：イカ食堂の一覧。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 2026-09-28：山口で釣れる5種（アオリ・ケンサキ・ヤリ・コウイカ・モンゴウ）から選べる形に。
// イカの種類での絞り込みは pages/recipes.js（ボタンを押したら data-squid でカードを出し分ける）
import { t, pair, esc, recipeHref, assetHref, pageHref } from '../i18n.js';
import { recipes, foodSafety, photoById } from '../data.js';
import { kitchenSquid, kitchenPrep } from '../kitchen-data.js';
import { pageHead, creditHTML, noteHTML } from './parts.js';

export const HEAD = {
  num: '03',
  eyebrow: 'THE IKA KITCHEN',
  title: pair('今日のイカを、いただきます。', 'Something good from the squid kitchen.'),
  desc: pair(
    `山口で釣れる5種のイカから選べる、${recipes.length}の家庭料理。刺身も、揚げ物も、煮物も。人数に合わせて分量を切り替えられます。`,
    `${recipes.length} home recipes, chosen by the five squid you can catch in Yamaguchi—raw, fried and simmered. Switch quantities for two or four servings.`
  ),
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
export const squidName = (lang, id) => t(lang, kitchenSquid.find((s) => s.id === id)?.name ?? pair(id, id));

export function recipeCardHTML(lang, r) {
  const squid = r.squid ?? [];
  return `
  <a class="ika-recipe-card" href="${recipeHref(r.id, lang)}" data-squid="${esc(squid.join(' '))}">
    <span class="ika-recipe-kind"><span aria-hidden="true">${r.icon ?? KIND_ICON[r.id] ?? '🦑'}</span>${t(lang, r.kind)}</span>
    <span class="ika-recipe-time"><b>${r.time}</b>${t(lang, '分', 'min')}</span>
    <span class="ika-recipe-name">${t(lang, r.name)}</span>
    <span class="ika-recipe-intro">${t(lang, r.intro)}</span>
    ${squid.length ? `<span class="ika-recipe-squid">${squid.map((id) => `<i>${squidName(lang, id)}</i>`).join('')}</span>` : ''}
    ${r.raw ? `<span class="ika-recipe-raw">${t(lang, '生で食べる：冷凍してから', 'Raw: freeze first')}</span>` : ''}
    <span class="ika-recipe-go">${t(lang, '材料と作り方', 'Ingredients & steps')} <span aria-hidden="true">→</span></span>
  </a>`;
}

// 5種のカード。「向く料理」はそのレシピへのリンク
function squidCardsHTML(lang) {
  return kitchenSquid
    .map((s) => {
      const best = s.best.map((id) => recipes.find((r) => r.id === id)).filter(Boolean);
      return `
      <article class="ika-kitchen-squid" id="kitchen-${s.id}">
        <h3>${t(lang, s.name)}</h3>
        <p class="ika-kitchen-season"><span>${t(lang, '旬', 'Season')}</span>${t(lang, s.season)}</p>
        <p>${t(lang, s.body)}</p>
        <p class="ika-kitchen-best-label">${t(lang, '向く料理', 'Best for')}</p>
        <ul class="ika-kitchen-best">${best.map((r) => `<li><a href="${recipeHref(r.id, lang)}">${t(lang, r.name)}</a></li>`).join('')}</ul>
        <a class="ika-kitchen-atlas" href="${pageHref('atlas', lang)}#sp-${s.id}">${t(lang, '図鑑で見る', 'See in the atlas')} <span aria-hidden="true">→</span></a>
      </article>`;
    })
    .join('');
}

function filterHTML(lang) {
  const chip = (id, label, on) => `<button type="button" class="ika-chip" data-squid-filter="${id}" aria-pressed="${on}">${label}</button>`;
  return `<div class="ika-chips ika-kitchen-filter" id="ika-kitchen-filter" role="group" aria-label="${t(lang, 'イカの種類で絞り込む', 'Filter by squid')}">
    ${chip('all', t(lang, 'すべて', 'All'), true)}${kitchenSquid.map((s) => chip(s.id, t(lang, s.name), false)).join('')}
  </div>`;
}

function prepHTML(lang) {
  return `
  <section class="ika-section ika-section--tint ika-kitchen-prep" id="prep">
    <div class="wrap">
      <h2 class="ika-h2-small">${t(lang, '釣ったイカの下処理', 'Handling the squid you caught')}</h2>
      <p class="ika-sea-p">${t(lang, '締める・持ち帰る・さばく・保存する。料理の前に、ここから。', 'Dispatch, chill, clean and store—start here before you cook.')}</p>
      <div class="ika-prep-grid">
        ${kitchenPrep
          .map(
            (p) => `<article class="ika-prep-card${p.raw ? ' ika-prep-card--raw' : ''}">
          <h3>${t(lang, p.title)}</h3>
          <ol>${p.steps.map((s) => `<li>${t(lang, s)}</li>`).join('')}</ol>
        </article>`
          )
          .join('')}
      </div>
    </div>
  </section>`;
}

export function render(lang) {
  const photo = photoById('grilled');
  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-kitchen-section">
    <div class="wrap">
      <div class="ika-kitchen-intro">
        <div>
          <h2>${t(lang, '刺身から、<br />休日のパスタまで。', 'From sashimi<br />to weekend pasta.')}</h2>
          <p>${t(lang, '釣れたイカの種類から、料理を選べます。釣っていない日も、市販のイカで楽しもう。生で食べる料理は、必ず冷凍してから。', 'Pick a dish by the squid you caught—or use store-bought squid on other days. Anything eaten raw must be frozen first.')}</p>
          <p class="ika-small">${t(lang, 'イカ部が家庭向けに構成したレシピです。写真は別の調理例です。', 'Recipes composed for home cooking by the club. Photography shows separate serving examples.')}</p>
          <p class="ika-small"><a href="#prep">${t(lang, '釣ったイカの下処理はこちら', 'How to handle the squid you caught')} ↓</a></p>
        </div>
        <figure class="ika-kitchen-photo">
          <img src="${assetHref(photo.file)}" alt="${esc(t(lang, photo.caption))}" width="1400" height="1050" loading="lazy" decoding="async" />
          ${creditHTML(lang, photo)}
        </figure>
      </div>
      <h2 class="ika-h2-small">${t(lang, '山口で釣れる5種のイカ', 'Five squid you can catch in Yamaguchi')}</h2>
      <div class="ika-kitchen-squids">${squidCardsHTML(lang)}</div>
      <h2 class="ika-h2-small">${t(lang, 'レシピ', 'Recipes')}</h2>
      ${filterHTML(lang)}
      <div class="ika-recipe-list" id="ika-recipe-list">${recipes.map((r) => recipeCardHTML(lang, r)).join('')}</div>
      <p class="ika-small" id="ika-kitchen-empty" hidden>${t(lang, 'このイカのレシピは準備中です。', 'Recipes for this squid are coming soon.')}</p>
      ${foodSafetyHTML(lang)}
    </div>
  </section>
  ${prepHTML(lang)}`;
}

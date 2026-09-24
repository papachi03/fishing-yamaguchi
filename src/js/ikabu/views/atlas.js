// atlas：世界のイカ図鑑。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 13種すべてを最初から HTML に書く。検索・絞り込みは pages/atlas.js が hidden を付け外しするだけ
import { t, pair, esc, assetHref, pageHref } from '../i18n.js';
import { species, speciesGroups, habitats, photoById } from '../data.js';
import { photoDims } from '../photo-dims.js';
import { pageHead, chipsHTML, creditHTML, noteHTML } from './parts.js';

export const HEAD = {
  num: '04',
  eyebrow: 'SQUIDS OF THE WORLD',
  title: pair('世界は、イカでつながっている。', 'An ocean of extraordinary squid.'),
  desc: pair(`沿岸から深海まで、山口→日本→世界の順に${species.length}種。名前・暮らす海・ひとつの不思議を知ろう。`, `${species.length} species, from Yamaguchi to Japan to the world. Learn a name, a habitat and a little wonder.`),
};

const habitatLabel = (key) => habitats.find(([k]) => k === key)?.[1] ?? pair('', '');

// 写真が無い種：部員の写真募集中のカード（図鑑の空欄そのものが「募集」の呼びかけ）
function wantedHTML(lang, s) {
  return `
  <div class="ika-species-wanted" role="img" aria-label="${t(lang, '部員の写真募集中', 'Member photo wanted')}">
    <svg viewBox="0 0 120 120" width="72" height="72" aria-hidden="true">
      <!-- イカのシルエット：胴（ひれ）が上、腕が下。釣り上げたときの向きではなく泳ぐ姿 -->
      <path d="M60 8 L82 46 Q90 60 82 66 L38 66 Q30 60 38 46 Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="49" cy="74" r="4" fill="currentColor"/><circle cx="71" cy="74" r="4" fill="currentColor"/>
      <path d="M40 80 q-4 20 6 32 M50 82 q-2 18 4 30 M60 82 v34 M70 82 q2 18 -4 30 M80 80 q4 20 -6 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    </svg>
    <span class="ika-species-wanted-title">${t(lang, '部員の写真募集中', 'Member photo wanted')}</span>
    <span class="ika-species-wanted-note">${t(lang, `${t(lang, s.name)}の写真、お持ちの部員は掲示板へ`, `Have a photo of a ${t(lang, s.name).toLowerCase()}? Post it on the board`)}</span>
  </div>`;
}

export function speciesCardHTML(lang, s, index) {
  const p = s.photo ? photoById(s.photo) : null;
  const [w, h] = p ? photoDims(p.id) : [4, 3];
  const search = [s.name.ja, s.name.en, s.latin].join(' ').toLowerCase();
  const media = p
    ? `<img src="${assetHref(p.thumb ?? p.file)}" alt="${esc(t(lang, p.caption))}" width="${w}" height="${h}" loading="lazy" decoding="async" />`
    : wantedHTML(lang, s);
  const rows = [
    s.season ? `<div class="ika-species-row"><dt>${t(lang, '季節', 'Season')}</dt><dd>${t(lang, s.season)}</dd></div>` : '',
    s.how ? `<div class="ika-species-row"><dt>${t(lang, '釣り方', 'How')}</dt><dd>${t(lang, s.how)}</dd></div>` : '',
  ].join('');
  return `
  <details class="ika-species${p ? '' : ' ika-species--nophoto'}" id="sp-${s.id}" data-species="${s.id}" data-group="${s.group}" data-habitat="${s.habitat}" data-search="${esc(search)}">
    <summary class="ika-species-summary">
      <figure class="ika-species-media">${media}</figure>
      <div class="ika-species-head">
        <span class="ika-species-zone"><span class="ika-species-no">${String(index + 1).padStart(2, '0')}</span>${t(lang, habitatLabel(s.habitat))}</span>
        <h3 class="ika-species-name">${t(lang, s.name)}</h3>
        <p class="ika-species-latin"><i lang="la">${esc(s.latin)}</i></p>
        <p class="ika-species-hook">${t(lang, s.hook)}</p>
        <span class="ika-species-more" aria-hidden="true"><span class="ika-species-more-open">${t(lang, 'くわしく', 'Details')}</span><span class="ika-species-more-close">${t(lang, 'とじる', 'Close')}</span></span>
      </div>
    </summary>
    <div class="ika-species-body">
      <p>${t(lang, s.desc)}</p>
      ${rows ? `<dl class="ika-species-rows">${rows}</dl>` : ''}
      <p class="ika-species-source"><a href="${esc(s.source)}" target="_blank" rel="noopener">${t(lang, '出典・くわしい解説を読む ↗', 'Read the source ↗')}</a></p>
      ${p ? creditHTML(lang, p) : `<p class="ika-credit">${t(lang, '写真：募集中（掲示板から投稿できます）', 'Photo: wanted. You can post one on the board.')} <a href="${pageHref('index', lang)}#voices">${t(lang, '部員の掲示板 →', 'Members’ board →')}</a></p>`}
    </div>
  </details>`;
}

export function render(lang) {
  let i = 0;
  const groups = speciesGroups
    .map(([key, label]) => {
      const list = species.filter((s) => s.group === key);
      return `
      <section class="ika-atlas-group" data-group="${key}" aria-labelledby="group-${key}">
        <h2 class="ika-atlas-group-title" id="group-${key}"><span class="ika-atlas-group-key">${key === 'yamaguchi' ? 'YAMAGUCHI' : key === 'japan' ? 'JAPAN' : 'WORLD'}</span>${t(lang, label)}<span class="ika-atlas-group-count" data-count="${key}">${list.length}</span></h2>
        <div class="ika-atlas-grid">${list.map((s) => speciesCardHTML(lang, s, i++)).join('')}</div>
      </section>`;
    })
    .join('');

  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-atlas-section">
    <div class="wrap">
      <div class="ika-atlas-tools">
        <label class="ika-search">
          <span class="ika-search-label">${t(lang, '名前で探す', 'Search')}</span>
          <input id="ika-atlas-search" type="search" autocomplete="off" placeholder="${t(lang, '和名・英名・学名', 'Japanese, English or Latin name')}" />
        </label>
        ${chipsHTML(lang, habitats, { attr: 'habitat', label: pair('暮らす海で絞り込む', 'Filter by habitat'), id: 'ika-atlas-filter' })}
        <p class="ika-atlas-count" id="ika-atlas-count" role="status"><b data-total>${species.length}</b> ${t(lang, '種を表示', 'species shown')}</p>
      </div>
      <div id="ika-atlas-list">${groups}</div>
      <p class="ika-atlas-empty" id="ika-atlas-empty" hidden>${t(lang, '該当するイカが見つかりません。', 'No matching squid found.')}</p>
      ${noteHTML(lang, {
        label: pair('図鑑について', 'About this atlas'),
        html: `<p>${t(
          lang,
          'イカの仲間は多様です。この図鑑は入門用で、釣った個体の同定や食用の判断には使わないでください。季節と釣り方は山口での目安で、年や場所で変わります。',
          'The squid family is enormously diverse. This introductory atlas is not a tool for identifying a catch or deciding whether it is edible. Seasons and methods are a rough guide for Yamaguchi and vary by year and place.'
        )}</p>`,
      })}
    </div>
  </section>`;
}

// HOMEの「攻略ガイド」写真カード。ビルド時（vite.config.js）に index.html へ書き込む。
// DOMを触らない純粋な関数なので Node のテストでもそのまま動く。
// 検索エンジンが通信なしで読める本文になる（reports.html の釣り場一覧と同じ考え方）。
import { guides, guideHref, guidesForMonth } from '../data/guides.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// 今月に合う記事。無ければ全記事（棚が空にならないように）
export const homeGuides = (month) => {
  const m = guidesForMonth(month);
  return m.length ? m : guides;
};

// base: サブフォルダ配置（SITE_BASE=/fishing-yamaguchi/ など）のとき、ルート基準のパスの前に付ける
export function guideCardHTML(g, { base = '' } = {}) {
  const b = base.replace(/\/$/, '');
  const src = (p) => (p && p.startsWith('/') ? b + p : p);
  const picture = g.image
    ? `<figure class="guide-card-media">
        <img src="${esc(src(g.image))}"${g.image1600 ? ` srcset="${esc(src(g.image))} 800w, ${esc(src(g.image1600))} 1600w" sizes="(max-width: 760px) 100vw, 60vw"` : ''} alt="${esc(g.alt || g.title)}" width="800" height="450" loading="lazy" decoding="async" />
      </figure>`
    : '';
  return `<a class="guide-card" href="${esc(src(guideHref(g)))}">
      ${picture}
      <div class="guide-card-body">
        ${g.badge ? `<span class="guide-card-badge">${esc(g.badge)}</span>` : ''}
        <h3 class="guide-card-title">${esc(g.title)}</h3>
        ${g.lead ? `<p class="guide-card-lead">${esc(g.lead)}</p>` : ''}
        <span class="guide-card-cta">読む<span aria-hidden="true">→</span></span>
      </div>
    </a>`;
}

export function guideCardsHTML(list, opts = {}) {
  if (!list || !list.length) return '';
  const cls = list.length === 1 ? 'guide-cards is-single' : 'guide-cards';
  return `<div class="${cls}">${list.map((g) => guideCardHTML(g, opts)).join('')}</div>`;
}

import { amazonUrl, rakutenUrl } from '../config/affiliate.js';

// タックル1件のカード。HOMEのGEARセクションとTACKLEページで共用。
export function tackleCardHTML(t, typeLabel = {}) {
  return `
  <article class="tackle-card ${t.owned ? 'is-owned' : ''}" id="${t.id}">
    <div class="tackle-card-head">
      <span class="tackle-type t-mono">${typeLabel[t.type] ?? t.type.toUpperCase()}</span>
      ${t.owned ? '<span class="tackle-owned">ダディの愛用</span>' : ''}
    </div>
    <p class="tackle-brand t-mono">${t.brand}</p>
    <h4 class="tackle-name">${t.name}</h4>
    ${t.spec ? `<p class="tackle-spec t-mono">${t.spec}</p>` : ''}
    <p class="tackle-note">${t.note}</p>
    <div class="tackle-links">
      <a href="${amazonUrl(t)}" target="_blank" rel="sponsored noopener" class="tackle-btn amazon">Amazonで見る</a>
      <a href="${rakutenUrl(t)}" target="_blank" rel="sponsored noopener" class="tackle-btn rakuten">楽天で見る</a>
    </div>
  </article>`;
}

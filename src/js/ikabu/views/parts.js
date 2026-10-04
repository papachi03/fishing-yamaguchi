// 各ページで使い回す部品（純粋関数）。
import { t, esc, pageHref, SECTIONS } from '../i18n.js';

// 絞り込みチップ（写真部・図鑑・地図で共通）。items は [key, pair] の配列。attr はキーを入れる data 属性名
export function chipsHTML(lang, items, { attr, current = 'all', label, id }) {
  return `
  <div class="ika-chips" role="group"${id ? ` id="${id}"` : ''} aria-label="${t(lang, label)}">
    ${items.map(([k, v]) => `<button type="button" class="ika-chip" data-${attr}="${k}" aria-pressed="${String(k === current)}">${t(lang, v)}</button>`).join('')}
  </div>`;
}

// 写真のクレジット1行：撮影者 ・ ライセンス（リンク） ・ 出典。自分たちの写真は © 表記だけ
export function creditHTML(lang, p, { withSource = true } = {}) {
  if (!p) return '';
  if (p.own) return `<p class="ika-credit">© ${esc(p.author)}${withSource ? ` ・ <a href="${esc(p.source)}">${t(lang, '釣果記録', 'Fishing log')}</a>` : ''}</p>`;
  const lic = p.licenseUrl ? `<a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener license">${esc(t(lang, p.license))}</a>` : esc(t(lang, p.license));
  const src = withSource && p.source ? ` ・ <a href="${esc(p.source)}" target="_blank" rel="noopener">${t(lang, '出典', 'Source')} ↗</a>` : '';
  return `<p class="ika-credit">${t(lang, '写真', 'Photo')}: ${esc(p.author)} ・ ${lic}${src}</p>`;
}

// 注意書きの箱（釣り場の目安・食の安全など）
export function noteHTML(lang, { label, html, tone = 'sea' }) {
  return `
  <aside class="ika-note ika-note--${tone}">
    ${label ? `<p class="ika-note-label">${t(lang, label)}</p>` : ''}
    <div class="ika-note-body">${html}</div>
  </aside>`;
}

// ページの見出し：パンくず＋英字の小見出し＋タイトル＋一言
export function pageHead(lang, { eyebrow, title, desc, num, crumb }) {   // crumb：パンくずの短い名前（見出しが長い時。2026-10-04）
  return `
  <header class="ika-page-head">
    <div class="wrap">
      <nav class="ika-crumb" aria-label="${t(lang, '現在地', 'Breadcrumb')}">
        <a href="${pageHref('index', lang)}">${t(lang, 'イカ部トップ', 'Club home')}</a><span aria-hidden="true"> / </span><span>${t(lang, crumb ?? title)}</span>
      </nav>
      <p class="ika-eyebrow">${num ? `<span class="ika-eyebrow-num">${num}</span>` : ''}${eyebrow}</p>
      <h1 class="ika-page-title">${t(lang, title)}</h1>
      ${desc ? `<p class="ika-page-desc">${t(lang, desc)}</p>` : ''}
    </div>
  </header>`;
}

// 準備中のブロック。次の段階で中身が入る場所
export function comingSoon(lang, page, note) {
  const others = SECTIONS.filter((s) => s.page !== page).slice(0, 4);
  return `
  <section class="ika-soon-section">
    <div class="wrap">
      <div class="ika-locker">
        <span class="ika-locker-tag">${t(lang, '準備中', 'Coming soon')}</span>
        <p class="ika-locker-title">${t(lang, 'この部屋は、いま部員が作っています。', 'The members are still building this room.')}</p>
        <p class="ika-locker-note">${t(lang, note ?? '中身がそろい次第、ここに出します。', note ?? 'It will open as soon as the content is ready.')}</p>
        <p class="ika-locker-sub">${t(lang, 'それまでは、ほかの部活動へ。', 'In the meantime, try another activity.')}</p>
        <ul class="ika-locker-links">
          ${others.map((s) => `<li><a href="${pageHref(s.page, lang)}"><span class="ika-nav-num">${s.num}</span>${t(lang, s.label)}</a></li>`).join('')}
          <li><a href="${pageHref('index', lang)}"><span class="ika-nav-num">↩</span>${t(lang, 'トップへ', 'Back to top')}</a></li>
        </ul>
      </div>
    </div>
  </section>`;
}

// 見出し（数字＋英字＋日本語）
export function sectionHead(lang, { num, en, title, note }) {
  return `
  <header class="ika-head">
    <p class="ika-eyebrow"><span class="ika-eyebrow-num">${num}</span>${en}</p>
    <h2>${t(lang, title)}</h2>
    ${note ? `<p class="ika-head-note">${t(lang, note)}</p>` : ''}
  </header>`;
}

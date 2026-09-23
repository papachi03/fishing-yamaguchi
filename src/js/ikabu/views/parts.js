// 各ページで使い回す部品（純粋関数）。
import { t, pageHref, SECTIONS } from '../i18n.js';

// ページの見出し：パンくず＋英字の小見出し＋タイトル＋一言
export function pageHead(lang, { eyebrow, title, desc, num }) {
  return `
  <header class="ika-page-head">
    <div class="wrap">
      <nav class="ika-crumb" aria-label="${t(lang, '現在地', 'Breadcrumb')}">
        <a href="${pageHref('index', lang)}">${t(lang, 'イカ部トップ', 'Club home')}</a><span aria-hidden="true"> / </span><span>${t(lang, title)}</span>
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

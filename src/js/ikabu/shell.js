// イカ部のヘッダーとフッター。
// headerHTML / footerHTML は文字列を返すだけの純粋関数（ビルド時にも使う）。
// mountShell だけがブラウザで動き、殻が空のときに埋める＋メニュー・言語切替の操作を付ける。
import { t, pageHref, assetHref, SECTIONS, navPageOf, esc } from './i18n.js';

const LOGO = '/assets/ikabu/logo_600.png';
const YFJ_HOME = '/';

export function headerHTML(lang, page = 'index') {
  const active = navPageOf(page);
  const other = lang === 'en' ? 'ja' : 'en';
  const nav = SECTIONS.map(
    (s) =>
      `<li><a href="${pageHref(s.page, lang)}"${active === s.page ? ' aria-current="page"' : ''}><span class="ika-nav-num">${s.num}</span>${t(lang, s.label)}</a></li>`
  ).join('');
  // 言語リンクは同じページを指す。クエリとハッシュは mountShell がブラウザで足す
  const langSwitch = `
    <div class="ika-lang" aria-label="Language">
      <a href="${pageHref(page, 'ja')}" lang="ja" data-lang="ja"${lang === 'ja' ? ' aria-current="true"' : ''}>日本語</a>
      <span aria-hidden="true">｜</span>
      <a href="${pageHref(page, 'en')}" lang="en" data-lang="en"${lang === 'en' ? ' aria-current="true"' : ''}>EN</a>
    </div>`;
  return `
  <div class="ika-header-bar">
    <div class="wrap ika-header-inner">
      <a class="ika-brand" href="${pageHref('index', lang)}">
        <img src="${assetHref(LOGO)}" alt="${t(lang, '山口イカ部', 'Yamaguchi Ika Club')}" width="600" height="219" />
      </a>
      <nav class="ika-nav" id="ika-nav" aria-label="${t(lang, 'イカ部のメニュー', 'Club sections')}">
        <ul>${nav}</ul>
      </nav>
      <div class="ika-header-tools">
        ${langSwitch}
        <a class="ika-yfj" href="${assetHref(YFJ_HOME)}" title="YAMAGUCHI FISHING JOURNAL" aria-label="YAMAGUCHI FISHING JOURNAL">
          <span class="ika-yfj-arrow" aria-hidden="true">←</span><span class="ika-yfj-full">YAMAGUCHI FISHING JOURNAL</span><span class="ika-yfj-short" aria-hidden="true">YFJ</span>
        </a>
        <button type="button" class="ika-menu-btn" id="ika-menu-btn" aria-expanded="false" aria-controls="ika-menu" data-open="${t(lang, 'メニュー', 'Menu')}" data-close="${t(lang, 'とじる', 'Close')}">
          <span class="ika-menu-bars" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="ika-menu-label">MENU</span>
        </button>
      </div>
    </div>
    <div class="ika-stripe" aria-hidden="true"></div>
  </div>
  <div class="ika-menu" id="ika-menu" hidden>
    <div class="wrap">
      <p class="ika-menu-eyebrow">${t(lang, '今日は、何イカする？', 'What kind of squid day is it?')}</p>
      <ul class="ika-menu-list">${nav}</ul>
      <div class="ika-menu-foot">
        ${langSwitch.replace('class="ika-lang"', 'class="ika-lang ika-lang--menu"')}
        <a class="ika-yfj" href="${assetHref(YFJ_HOME)}"><span class="ika-yfj-arrow" aria-hidden="true">←</span>YAMAGUCHI FISHING JOURNAL</a>
      </div>
    </div>
  </div>`;
}

export function footerHTML(lang) {
  const nav = SECTIONS.map((s) => `<li><a href="${pageHref(s.page, lang)}"><span class="ika-nav-num">${s.num}</span>${t(lang, s.label)}</a></li>`).join('');
  return `
  <div class="ika-stripe" aria-hidden="true"></div>
  <div class="wrap ika-footer-inner">
    <div class="ika-footer-brand">
      <img src="${assetHref(LOGO)}" alt="" width="600" height="219" />
      <p class="ika-footer-motto">${t(lang, '釣る。食べる。遊ぶ。世界とつながる。', 'Fish. Cook. Play. Meet the world.')}<br />${t(
        lang,
        '場所を明かさなくても、イカ好きはつながれる。',
        'A shared love of squid. Secret fishing spots can stay secret.'
      )}</p>
    </div>
    <nav class="ika-footer-nav" aria-label="${t(lang, '部活動', 'Club sections')}">
      <p class="ika-footer-head">CLUB ACTIVITIES</p>
      <ul>${nav}</ul>
    </nav>
    <div class="ika-footer-links">
      <p class="ika-footer-head">LINKS</p>
      <ul>
        <li><a href="${pageHref('sources', lang)}">${t(lang, '写真と情報の出典', 'Sources & photo credits')}</a></li>
        <li><a href="https://www.pref.yamaguchi.lg.jp/soshiki/108/21930.html" target="_blank" rel="noopener">${t(lang, '山口県の遊漁ルール ↗', 'Yamaguchi fishing rules ↗')}</a></li>
        <li><a href="${assetHref(YFJ_HOME)}">YAMAGUCHI FISHING JOURNAL</a></li>
        <li><a href="${assetHref('/reports.html')}">${t(lang, '現地の声（YFJ）', 'Field reports (YFJ)')}</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap ika-footer-bottom">
    <span>© Yamaguchi Ika Club / YAMAGUCHI FISHING JOURNAL</span>
    <span>${t(lang, 'キャラクター・海のイラスト：AI生成。写真は各クレジット参照。', 'Character and hero illustration: AI-generated. Photography credited individually.')}</span>
  </div>`;
}

// ブラウザ側：殻が空なら埋め、メニューと言語リンクを動かす
export function mountShell({ lang, page }) {
  const header = document.getElementById('ika-header');
  const footer = document.getElementById('ika-footer');
  if (header && !header.innerHTML.trim()) header.innerHTML = headerHTML(lang, page);
  if (footer && !footer.innerHTML.trim()) footer.innerHTML = footerHTML(lang);

  // 言語を切り替えても、同じクエリ（?id=…）とハッシュを保つ
  const tail = location.search + location.hash;
  if (tail) {
    document.querySelectorAll('.ika-lang a[data-lang]').forEach((a) => {
      a.setAttribute('href', a.getAttribute('href').split(/[?#]/)[0] + tail);
    });
  }

  const btn = document.getElementById('ika-menu-btn');
  const menu = document.getElementById('ika-menu');
  if (!btn || !menu) return;
  const setOpen = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.classList.toggle('ika-menu-open', open);
    btn.querySelector('.ika-menu-label').textContent = open ? esc(btn.dataset.close) : 'MENU';
  };
  btn.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) setOpen(false);
  });
  // 広い画面に戻ったら閉じる（開いたままの状態を残さない）
  matchMedia('(min-width: 961px)').addEventListener('change', (e) => e.matches && setOpen(false));
}

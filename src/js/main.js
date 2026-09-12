// 共通レイヤー: ナビゲーション / フッター / 海況ストリップ / 動画の遅延読み込み
import { areas } from './data/areas.js';
import { fetchWeather, describeWeather, windDirection } from './api/weather.js';
import { fetchTide } from './api/tide.js';
import { instagramProfile } from './data/instagram.js';
import { AMAZON_DISCLOSURE } from './config/affiliate.js';
import { assessSafety } from './api/safety.js';
import { url } from './base.js';
import './analytics.js'; // 全ページ共通でGA4を読み込む（各HTMLにタグは書かない）
export { url };

/* ---------------- header / nav ---------------- */

const NAV = [
  { href: '/journal.html', label: 'Journal' },
  { href: '/log.html', label: 'Fishing Log' },
  { href: '/spots.html', label: 'Spots' },
  { href: '/sea.html', label: 'Sea' },
  { href: '/tackle.html', label: 'Tackle' },
  { href: '/about.html', label: 'About' },
];

const TABS = [
  { href: '/sea.html', label: 'Sea', icon: 'M2 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0M6 10c2-6 10-6 12 0' },
  { href: '/log.html', label: 'Log', icon: 'M3 12c4-5 10-5 14 0-4 5-10 5-14 0Zm14 0 4-3m-4 3 4 3M7 12h.01' },
  { href: '/journal.html', label: 'Vlog', icon: 'M4 5h16v14H4zM10 9l5 3-5 3z' },
  { href: '/spots.html', label: 'Spots', icon: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
];

export function mountChrome(active = '') {
  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <a class="brand" href="${url('/')}"><img src="${url('/assets/images/logo_cd_96.png')}" alt="" width="28" height="28" />YFJ<small>山口の海と、ダディの釣り。</small></a>
    <nav class="main-nav" aria-label="メインナビゲーション">
      ${NAV.map(
        (n) =>
          `<a href="${url(n.href)}" ${active === n.href ? 'aria-current="page"' : ''}>${n.label}</a>`
      ).join('')}
      <a class="nav-yt" href="${instagramProfile.youtube}" target="_blank" rel="noopener" aria-label="YouTubeチャンネル Childダディ" title="YouTube">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>
      </a>
    </nav>
    <a class="nav-yt nav-yt--mobile" href="${instagramProfile.youtube}" target="_blank" rel="noopener" aria-label="YouTubeチャンネル Childダディ">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>
    </a>`;
  document.body.prepend(header);

  const tab = document.createElement('nav');
  tab.className = 'tab-bar';
  tab.setAttribute('aria-label', 'クイックナビゲーション');
  tab.innerHTML = TABS.map(
    (t) => `
    <a href="${url(t.href)}" ${active === t.href ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${t.icon}"/></svg>
      <span class="tab-en">${t.label}</span>
    </a>`
  ).join('');
  document.body.append(tab);

  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

export function mountFooterBottom(target) {
  const div = document.createElement('div');
  div.className = 'footer-bottom';
  div.innerHTML = `
    <nav class="footer-nav" aria-label="フッターナビゲーション">
      <a href="${url('/')}">Home</a>
      ${NAV.map((n) => `<a href="${url(n.href)}">${n.label}</a>`).join('')}
    </nav>
    <nav class="footer-social" aria-label="SNS">
      <a href="${instagramProfile.youtube}" target="_blank" rel="noopener">YouTube</a>
      <a href="${instagramProfile.url}" target="_blank" rel="noopener">Instagram</a>
    </nav>
    <p class="footer-note">© YAMAGUCHI FISHING JOURNAL — 山口の海と、ダディの釣り。</p>
    <p class="footer-note">${AMAZON_DISCLOSURE}</p>`;
  target.append(div);
}

/* ---------------- reveal ---------------- */

export function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      }
    },
    { threshold: 0.12 }
  );
  els.forEach((e) => io.observe(e));
}

/* ---------------- lazy video ---------------- */

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function slowConnection() {
  const c = navigator.connection;
  if (!c) return false;
  return c.saveData || /(^|-)2g/.test(c.effectiveType ?? '');
}

// data-src の動画を、画面に入ったら読み込んで再生 / 出たら停止。
// 低速回線・reduced motion では poster のまま。
export function initLazyVideos(scope = document) {
  const vids = scope.querySelectorAll('video[data-src]');
  if (reducedMotion || slowConnection()) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const v = en.target;
        if (en.isIntersecting) {
          if (!v.src) v.src = url(v.dataset.src);
          v.play().catch(() => {});
        } else if (v.src) {
          v.pause();
        }
      }
    },
    { rootMargin: '120px' }
  );
  vids.forEach((v) => io.observe(v));
}

/* ---------------- TODAY'S SEA strip ---------------- */

const fmtTemp = (v) => (v == null ? '—' : Math.round(v));
const fmtWind = (v) => (v == null ? '—' : v.toFixed(1));

function compassSVG(deg) {
  // 風向: 「風が吹いてくる方角」— 矢印は流れの向き(deg+180)に飛ぶ
  const to = deg == null ? 0 : deg + 180;
  return `
  <svg class="compass" viewBox="0 0 44 44" role="img" aria-label="風向">
    <circle cx="22" cy="22" r="20"/>
    <g transform="rotate(${to} 22 22)" class="needle-g">
      <path class="needle" d="M22 7 L26.5 27 L22 23.5 L17.5 27 Z"/>
    </g>
    <text x="22" y="6.5" text-anchor="middle" style="font:5.5px monospace;fill:currentColor;opacity:.5">N</text>
  </svg>`;
}

// list を省略すると全エリア。HOMEは ownAreas（ダディ自身の海）だけを渡す
export async function renderSeaStrip(container, list = areas) {
  container.innerHTML = list
    .map(
      (a) => `
    <article class="sea-card" data-area="${a.id}">
      <div class="area-name">
        <span class="en">${a.nameEn}</span>
        <span class="ja">${a.nameJa}${a.city ? `・${a.city}` : ''}</span>
        <span class="safety-chip" data-safety></span>
      </div>
      <div class="sea-now"><p class="sea-error">海況を取得しています…</p></div>
      <div class="sea-tide"></div>
    </article>`
    )
    .join('');

  await Promise.all(
    list.map(async (a) => {
      const card = container.querySelector(`[data-area="${a.id}"]`);
      const nowEl = card.querySelector('.sea-now');
      const tideEl = card.querySelector('.sea-tide');
      try {
        const [w, t] = await Promise.all([fetchWeather(a), fetchTide(a)]);
        const cond = describeWeather(w.current.code);
        const dir = windDirection(w.current.windDir);
        const now = new Date();
        // JMAモデルは降水確率が欠損することがある → 直近の有効値を使う
        const pop = w.hourly.find((h) => new Date(h.time) >= now && h.pop != null)?.pop;
        nowEl.innerHTML = `
          <p class="temp t-mono">${fmtTemp(w.current.temp)}<span class="unit">°C</span></p>
          <p class="cond">${cond.ja}<span class="pop">降水確率 ${pop ?? '—'}%</span></p>
          <div class="wind-cell">
            ${compassSVG(dir.deg)}
            <p class="wind-num"><b>${fmtWind(w.current.wind)}</b> m/s<small>${dir.en} ・ ${dir.ja}の風${
              w.current.wave != null ? `<br>波 ${w.current.wave.toFixed(1)}m` : ''
            }</small></p>
          </div>`;
        const s = assessSafety({
          wind: w.current.wind,
          gust: w.current.gust,
          waveHeight: w.current.wave,
          wavePeriod: w.current.wavePeriod,
          windDir: w.current.windDir,
          facing: a.facing,
          seaProfile: a.seaProfile,
        });
        const chip = card.querySelector('[data-safety]');
        chip.textContent = s.label;
        chip.classList.add(`lv${s.level}`);
        chip.title = s.reasons.join(' / ') || s.message;
        const highs = t.highs.map((h) => `<b>${h.time}</b>`).join(' / ');
        const lows = t.lows.map((h) => `<b>${h.time}</b>`).join(' / ');
        tideEl.innerHTML = `
          <span><span class="k">High</span>満潮 ${highs || '—'}</span>
          <span><span class="k">Low</span>干潮 ${lows || '—'}</span>
          ${t.isDemo ? '<span class="demo-badge">DEMO DATA</span>' : `<span>${t.tideName ?? ''}</span>`}`;
      } catch (err) {
        nowEl.innerHTML = `<p class="sea-error">海況を取得できませんでした（オフラインの可能性があります）</p>`;
        tideEl.innerHTML = '';
      }
    })
  );

  const stamp = document.querySelector('[data-sea-updated]');
  if (stamp) {
    const d = new Date();
    stamp.textContent = `UPDATED ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')} JST / SOURCE: OPEN-METEO`;
  }
}

/* ---------------- utils ---------------- */

export const fmtDateDot = (iso) => (iso ? iso.replaceAll('-', '.') : null);

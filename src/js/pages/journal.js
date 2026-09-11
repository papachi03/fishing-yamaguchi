import { mountChrome, mountFooterBottom, initReveal, fmtDateDot, slowConnection } from '../main.js';
import { vlogs } from '../data/vlogs.js';

mountChrome('/journal.html');
mountFooterBottom(document.getElementById('footer-mount'));

const feed = document.getElementById('journal-feed');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canPreview = !reduced && !slowConnection();

feed.innerHTML = vlogs
  .map((v) => {
    const meta = [fmtDateDot(v.date), v.species, v.weather, v.tide].filter(Boolean);
    return `
    <article class="journal-entry reveal" id="${v.id}">
      <div class="journal-media" data-preview="${v.preview ? url(v.preview) : ''}">
        <img src="${url(v.poster)}" alt="${v.title}" loading="lazy" decoding="async" />
        <video muted playsinline loop preload="none" poster="${url(v.poster)}" hidden aria-hidden="true"></video>
        <span class="dur t-mono">${v.duration}</span>
      </div>
      <div class="journal-body">
        <p class="date-line t-mono">${meta.map((m) => `<span>${m}</span>`).join('')}</p>
        <h3>${v.title}</h3>
        <p>${v.description}</p>
        <div class="journal-tags">
          ${[v.species, v.cook ? 'CATCH & COOK' : null, v.story ? 'LATEST' : null]
            .filter(Boolean)
            .map((t) => `<span>${t}</span>`)
            .join('')}
        </div>
        ${
          v.highlights?.length
            ? `<div class="journal-highlights">${v.highlights
                .map((h) => `<span><b>${h.t}</b> — ${h.label}</span>`)
                .join('')}</div>`
            : ''
        }
        ${v.tackle ? `<p class="journal-tackle">TACKLE — ${v.tackle}</p>` : ''}
        ${
          v.youtube
            ? `<a class="yt-btn" href="https://www.youtube.com/watch?v=${v.youtube}" target="_blank" rel="noopener">
                 <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>
                 YouTubeで本編を見る（${v.duration}）
               </a>`
            : `<p class="journal-note t-mono">この釣行はYouTube未公開。動画はサイト内のダイジェストのみ</p>`
        }
      </div>
    </article>`;
  })
  .join('');

/* hover / タップでプレビュー動画を再生 */
if (canPreview) {
  feed.querySelectorAll('.journal-media').forEach((m) => {
    const src = m.dataset.preview;
    if (!src) return;
    const video = m.querySelector('video');
    const img = m.querySelector('img');
    let loaded = false;
    const start = () => {
      if (!loaded) {
        video.src = src;
        loaded = true;
      }
      video.hidden = false;
      img.style.opacity = '0';
      video.play().catch(() => {});
    };
    const stop = () => {
      video.pause();
      video.hidden = true;
      img.style.opacity = '1';
    };
    m.addEventListener('mouseenter', start);
    m.addEventListener('mouseleave', stop);
    // モバイル: タップでトグル
    m.addEventListener('click', () => (video.hidden ? start() : stop()));
  });
}

/* アンカー位置に固定ヘッダー分のオフセット */
if (location.hash) {
  const target = document.querySelector(location.hash);
  if (target) setTimeout(() => target.scrollIntoView({ block: 'center' }), 60);
}

initReveal();

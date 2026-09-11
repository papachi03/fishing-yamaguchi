import {
  mountChrome,
  mountFooterBottom,
  initReveal,
  initLazyVideos,
  slowConnection,
  renderSeaStrip,
  fmtDateDot,
  url,
} from '../main.js';
import { featuredCatches } from '../data/catches.js';
import { areas } from '../data/areas.js';
import { featuredTackle } from '../data/tackle.js';
import { tackleCardHTML } from '../components/tackle-card.js';
import { mountInstagram } from '../components/instagram.js';
import { popularVideos, youtubeThumb, youtubeUrl, fmtViews } from '../data/youtube.js';

mountChrome('/');
mountFooterBottom(document.getElementById('footer-mount'));

/* ---- HERO video: 低速回線 / reduced-motion では poster のまま ---- */
const heroVideo = document.getElementById('hero-video');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduced && !slowConnection()) {
  const small = matchMedia('(max-width: 760px)').matches;
  heroVideo.src = url(small
    ? '/assets/video/hero/hero_dusk_720.mp4'
    : '/assets/video/hero/hero_dusk_1440.mp4');
  heroVideo.play().catch(() => {});
}

/* HERO右下の時刻は映像（夕まずめ）に合わせた固定表記。現在時刻は出さない
   （夜中に開くと「22:53なのにこの明るさ」と映像と矛盾するため） */

/* ---- TODAY'S SEA ---- */
renderSeaStrip(document.getElementById('sea-strip'));

/* ---- FISHING LOG (editorial, 4 featured) ---- */
const logRoot = document.getElementById('home-log');
logRoot.innerHTML = featuredCatches
  .slice(0, 4)
  .map((c) => {
    const dataBits = [fmtDateDot(c.date), c.method, c.time].filter(Boolean).join(' / ');
    return `
    <article class="log-item reveal">
      <a href="${url('/log.html')}#${c.id}">
        <figure>
          ${c.weight ? `<span class="log-weight-tag t-mono">${c.weight}</span>` : ''}
          <img src="${url(c.image)}" alt="${c.species}${c.weight ? ' ' + c.weight : ''}" loading="lazy" decoding="async" />
        </figure>
        <div class="log-cap">
          <span class="species">${c.species}</span>
          <span class="data t-mono">${dataBits || '&nbsp;'}</span>
        </div>
      </a>
    </article>`;
  })
  .join('');

/* ---- FIELD NOTES ---- */
document.getElementById('home-areas').innerHTML = areas
  .map(
    (a) => `
  <a class="area-card reveal" href="${url('/spots.html')}#${a.id}">
    <img src="${url(a.image)}" alt="${a.nameJa}エリアの海" loading="lazy" decoding="async" />
    <div class="area-label">
      <p class="en">${a.nameEn}</p>
      <p class="ja">${a.nameJa}${a.city ? `・${a.city}` : ''}</p>
      <p class="desc">${a.description}</p>
      ${a.contributor ? '<span class="contrib">FROM A VIEWER — 視聴者の釣り場</span>' : ''}
    </div>
  </a>`
  )
  .join('');

/* ---- GEAR (愛用タックル) ---- */
document.getElementById('home-gear').innerHTML = featuredTackle
  .map((t) => tackleCardHTML(t, { rod: 'ROD', reel: 'REEL', lure: 'LURE', line: 'LINE', gear: 'GEAR', camera: 'CAMERA' }))
  .join('');

/* ---- INSTAGRAM (最新3件) ---- */
mountInstagram(document.getElementById('home-ig'), 3);

/* ---- YOUTUBE (よく見られている釣り動画3本) ---- */
document.getElementById('home-yt').innerHTML = popularVideos
  .slice(0, 3)
  .map(
    (v, i) => `
  <a class="yt-card reveal" href="${youtubeUrl(v.id)}" target="_blank" rel="noopener">
    <figure>
      <img src="${youtubeThumb(v.id)}" alt="" loading="lazy" decoding="async" />
      <span class="yt-play" aria-hidden="true"></span>
      <span class="yt-rank t-mono" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
      ${v.duration ? `<span class="yt-dur t-mono">${v.duration}</span>` : ''}
    </figure>
    <p class="yt-title">${v.title}</p>
    ${v.views ? `<p class="yt-views t-mono">${fmtViews(v.views)}</p>` : ''}
  </a>`
  )
  .join('');

initReveal();
initLazyVideos();

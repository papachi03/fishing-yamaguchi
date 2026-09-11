import { mountChrome, mountFooterBottom, initReveal, url } from '../main.js';
import { areas } from '../data/areas.js';

mountChrome('/spots.html');
mountFooterBottom(document.getElementById('footer-mount'));

document.getElementById('spot-blocks').innerHTML = areas
  .map(
    (a) => `
  <article class="spot-block reveal" id="${a.id}">
    <figure class="spot-media">
      <img src="${url(a.image)}" alt="${a.nameJa}の海" loading="lazy" decoding="async" />
    </figure>
    <div class="spot-body">
      <p class="en">${a.nameEn}</p>
      <p class="ja">${a.nameJa}${a.city ? `・${a.city}` : ''}</p>
      <p>${a.description}</p>
      ${a.contributor ? `<p class="spot-contrib t-mono">FROM A VIEWER — ${a.contributor}</p>` : ''}
      ${a.homeSpot ? `<p class="coords t-mono">基準の釣り場: ${a.homeSpot.name}</p>` : ''}
      <p class="coords t-mono">${a.lat.toFixed(3)}N, ${a.lon.toFixed(3)}E</p>
      <p style="margin-top: 18px;">
        <a class="sea-more" href="${url('/sea.html')}#${a.id}">今日の${a.nameJa}の海況<span aria-hidden="true">→</span></a>
      </p>
    </div>
  </article>`
  )
  .join('');

if (location.hash) {
  const t = document.querySelector(location.hash);
  if (t) setTimeout(() => t.scrollIntoView({ block: 'start' }), 60);
}

initReveal();

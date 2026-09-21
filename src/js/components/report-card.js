// 投稿1件のカード。ブラウザのAPIに触らない純粋な関数（node --test で試せる）。
// 投稿者が書いた文字は必ず esc() を通すこと。投稿を画面に描くのはこの関数だけにする。
import { placeById } from '../data/spot-list.js';
import { FISH, WIND_FEEL, nameOf } from '../data/report-options.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 日付が無い・形が違う投稿で「NaN/NaN」と出さない（その場合は日付ごと出さない）
const monthDay = (date) => {
  const [, m, d] = String(date ?? '').split('-');
  return Number.isFinite(Number(m)) && Number.isFinite(Number(d)) && m && d ? `${Number(m)}/${Number(d)}` : '';
};

export function reportCardHTML(post, photoUrl) {
  const place = placeById(post.spotId)?.name ?? '場所不明';
  const fish = nameOf(FISH, post.fish);
  const wind = nameOf(WIND_FEEL, post.wind);
  const day = monthDay(post.date);
  return `
  <article class="report-card reveal" data-id="${esc(post.id)}">
    ${post.hasPhoto ? `<figure class="report-photo"><img src="${esc(photoUrl(post.id))}" alt="${esc(place)}の写真" loading="lazy" decoding="async" /></figure>` : ''}
    <div class="report-body">
      <p class="report-place">${esc(place)}</p>
      <p class="report-meta t-mono">${esc(post.name)}${day ? ` ・ ${esc(day)}の情報` : ''}</p>
      ${fish || wind ? `<p class="report-tags">${fish ? `<span>${esc(fish)}</span>` : ''}${wind ? `<span class="wind wind-${esc(post.wind)}">風：${esc(wind)}</span>` : ''}</p>` : ''}
      <p class="report-comment">${esc(post.comment)}</p>
      <button type="button" class="report-flag t-mono" data-report="${esc(post.id)}">不適切な投稿を知らせる</button>
    </div>
  </article>`;
}

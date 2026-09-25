// ABOUTの「山口の釣り仲間（Friends）」欄。ビルド時（vite.config.js）に about.html へ書き込む。
// DOMを触らない純粋な関数なので Node のテストでもそのまま動く。
// 検索エンジンが通信なしで読める本文になる（HOMEの攻略ガイドカードと同じ考え方）。
import { youtubeThumb } from '../data/youtube.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const watchUrl = (id) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

// base: サブフォルダ配置（SITE_BASE=/fishing-yamaguchi/ など）のとき、ルート基準のパスの前に付ける
export function friendCardHTML(f, { base = '' } = {}) {
  const b = base.replace(/\/$/, '');
  const src = (p) => (p && p.startsWith('/') ? b + p : p);
  const tags = (f.tags || []).map((t) => `<li>${esc(t)}</li>`).join('');
  const intro = (f.intro || []).map((line) => `<p>${esc(line)}</p>`).join('');
  const collabs = (f.collabs || [])
    .map(
      (v) => `<a class="friend-video" href="${esc(watchUrl(v.id))}" target="_blank" rel="noopener">
          <figure><img src="${esc(youtubeThumb(v.id))}" alt="" width="480" height="270" loading="lazy" decoding="async" /><span class="yt-play" aria-hidden="true"></span></figure>
          <span class="friend-video-title">${esc(v.title)}</span>
        </a>`,
    )
    .join('');
  return `<article class="friend-card" id="friend-${esc(f.id)}">
      <div class="friend-profile">
        <img class="friend-icon" src="${esc(src(f.icon))}" alt="${esc(f.name)}のアイコン" width="120" height="120" loading="lazy" decoding="async" />
        <div class="friend-head">
          <p class="friend-name"><span class="friend-name-ja">${esc(f.name)}</span><span class="friend-kana">（${esc(f.kana)}）</span></p>
          <p class="friend-name-en t-label">${esc(f.nameEn)}</p>
          <div class="friend-chips">
            <span class="friend-area">${esc(f.area)}</span>
            ${tags ? `<ul class="friend-tags">${tags}</ul>` : ''}
          </div>
        </div>
      </div>
      <div class="friend-intro">${intro}</div>
      ${f.story ? `<blockquote class="friend-story"><p class="friend-story-label">ダディとのつながり</p><p>${esc(f.story)}</p></blockquote>` : ''}
      <a class="friend-channel yt-cta" href="${esc(f.channelUrl)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .6 12a31 31 0 0 0 .4 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.3-1.6.4-3.2.4-4.8s-.1-3.2-.4-4.8ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>
        YouTubeチャンネルを見る
      </a>
      ${collabs ? `<div class="friend-collabs"><p class="friend-collabs-h">コラボ動画</p><div class="friend-videos">${collabs}</div></div>` : ''}
    </article>`;
}

export function friendsSectionHTML(list, opts = {}) {
  if (!list || !list.length) return '';
  return `<div class="friends-head">
        <div class="sec-head">
          <p class="en" id="about-friends-h">Friends</p>
          <p class="ja">山口の釣り仲間</p>
        </div>
        <p class="friends-lead">山口県で活動している釣りYouTuberの仲間たち。</p>
      </div>
      <div class="friends-list">${list.map((f) => friendCardHTML(f, opts)).join('')}</div>`;
}

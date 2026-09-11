// Instagramの表示。
//   自動取得したフィード（instagram-feed.json）があれば → 自前の写真グリッド
//   無ければ → Instagram公式の埋め込み（embed.js）にフォールバック
import { instagramFeed, instagramPosts } from '../data/instagram.js';
import { url } from '../base.js';

const fmtDate = (iso) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '');
const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// キャプションの1行目だけ（ハッシュタグの羅列は落とす）
function shortCaption(caption) {
  const first = (caption ?? '').split('\n').find((l) => l.trim() && !l.trim().startsWith('#')) ?? '';
  return first.length > 60 ? first.slice(0, 60) + '…' : first;
}

function tileHTML(p) {
  const badge =
    p.mediaType === 'VIDEO' ? '<span class="ig-badge">REEL</span>'
    : p.mediaType === 'CAROUSEL_ALBUM' ? '<span class="ig-badge">+</span>'
    : '';
  const cap = shortCaption(p.caption);
  return `
  <a class="ig-tile" href="${p.permalink}" target="_blank" rel="noopener">
    <figure>
      <img src="${url(p.image)}" alt="${escapeHtml(cap || 'Instagramの投稿')}" loading="lazy" decoding="async" />
      ${badge}
    </figure>
    <div class="ig-tile-cap">
      <span class="t-mono">${fmtDate(p.timestamp)}</span>
      ${cap ? `<p>${escapeHtml(cap)}</p>` : ''}
    </div>
  </a>`;
}

let scriptLoaded = false;
function embedHTML(post) {
  return `
  <div class="ig-item">
    <blockquote class="instagram-media" data-instgrm-permalink="${post.url}" data-instgrm-version="14"
      style="background:#fff;border:0;margin:0;max-width:540px;min-width:280px;width:100%;">
      <a href="${post.url}" target="_blank" rel="noopener">Instagramで見る</a>
    </blockquote>
  </div>`;
}
function mountEmbeds(container, posts) {
  container.innerHTML = posts.map(embedHTML).join('');
  if (!scriptLoaded) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    s.onload = () => window.instgrm?.Embeds?.process();
    document.body.append(s);
    scriptLoaded = true;
  } else {
    window.instgrm?.Embeds?.process();
  }
}

/** container に最新 n 件を表示する */
export function mountInstagram(container, n = 6) {
  if (instagramFeed.length) {
    container.classList.add('is-grid');
    container.innerHTML = instagramFeed.slice(0, n).map(tileHTML).join('');
    return 'grid';
  }
  mountEmbeds(container, instagramPosts.slice(0, n));
  return 'embed';
}

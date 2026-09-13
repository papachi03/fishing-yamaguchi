// Instagramの表示。
//
// データ源は3段構え（上から順に使う）:
//   1. Cloudflare Worker（tproject-jp.com/ig/feed?shop=fishing）… 1時間ごとに自動更新される最新の投稿
//      → 取れたらこれで描き直す。投稿したら最大1時間で反映される（手作業なし）
//   2. instagram-feed.json … scripts/build-instagram.mjs で取り込んだ静的データ（フォールバック）
//      → ページを開いた瞬間はまずこれで描く（Workerの応答を待って真っ白にしない）
//      → Workerが落ちている／未認可のときも、これが出続けるのでサイトは壊れて見えない
//   3. instagramPosts（手書きのURL一覧）… 1も2も無いときだけ、Instagram公式の埋め込み
//
// Workerの仕組み自体は Tproject の共通基盤（Desktop\Instagram連携_引き継ぎ\仕組み\）。
// 釣りサイトは SHOPS に `fishing` として登録してある。
import { instagramFeed, instagramPosts } from '../data/instagram.js';
import { url } from '../base.js';

// Tproject共通のInstagram中継Worker。CORSはこのサイトのオリジンだけに許可されている
const FEED_ENDPOINT = 'https://tproject-jp.com/ig/feed?shop=fishing';

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
  // 画像は「/assets/...」（静的）か「https://...」（Worker経由のInstagram CDN）。url() は前者だけにベースを付ける
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

// Workerの投稿 { id, caption, type, image, link, postedAt } → 表示部品の形に揃える
function fromWorker(p) {
  return {
    mediaType: p.type,
    caption: p.caption,
    permalink: p.link,
    image: p.image,
    timestamp: p.postedAt,
  };
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

function renderGrid(container, posts, n) {
  container.classList.add('is-grid');
  container.innerHTML = posts.slice(0, n).map(tileHTML).join('');
}

// 裏でWorkerの最新を取りに行き、取れたときだけ描き直す。
// 失敗（ネットワーク・CORS・未認可＝fallback:true・0件）はすべて「何もしない」＝手元のデータが残る。
async function refreshFromWorker(container, n) {
  const res = await fetch(FEED_ENDPOINT);
  if (!res.ok) return false;
  const data = await res.json();
  if (data.fallback || !Array.isArray(data.posts) || data.posts.length === 0) return false;
  renderGrid(container, data.posts.map(fromWorker), n);
  return true;
}

/** container に最新 n 件を表示する。戻り値は最初に描いたときの方式 */
export function mountInstagram(container, n = 6) {
  let mode;
  if (instagramFeed.length) {
    renderGrid(container, instagramFeed, n);
    mode = 'grid';
  } else {
    mountEmbeds(container, instagramPosts.slice(0, n));
    mode = 'embed';
  }
  // 最新化は非同期。失敗しても最初の描画はそのまま
  refreshFromWorker(container, n).catch(() => {});
  return mode;
}

// YouTube の動画の枠（記事・あそび場で共通）。表紙の画像は自前で持ち、押すまで YouTube を読み込まない（youtube-nocookie）。
// YouTube のサムネイルは作られるまで灰色の仮の絵になるうえ、表示するだけで YouTube へ通信するため
import { t, esc, assetHref } from './i18n.js';

// ytHTML(lang, { id, poster, label })：poster は /assets/ からのパス、label は再生ボタンの読み上げ（pair）
export function ytHTML(lang, { id, poster, label }) {
  return `<div class="ika-yt">
      <button type="button" class="ika-yt-play" data-yt="${esc(id)}" aria-label="${t(lang, label)}">
        <img src="${assetHref(poster)}" alt="" loading="lazy" width="1280" height="720">
        <span class="ika-yt-btn" aria-hidden="true">▶</span>
      </button>
    </div>`;
}

// ページの中の枠をすべて、押したら埋め込みに差し替えるようにする
export function mountYouTube(root = document) {
  root.querySelectorAll('.ika-yt-play').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(btn.dataset.yt)}?autoplay=1&rel=0`;
      f.title = btn.getAttribute('aria-label');
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      btn.closest('.ika-yt')?.classList.add('is-playing');
      btn.replaceWith(f);
    });
  });
}

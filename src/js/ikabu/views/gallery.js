// gallery：写真部。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 全部の写真を最初から HTML に書く。絞り込みは hidden の付け外し、拡大表示は <dialog>（pages/gallery.js）
import { t, pair, esc, assetHref } from '../i18n.js';
import { photos, photoCats } from '../data.js';
import { photoDims } from '../photo-dims.js';
import { pageHead, chipsHTML, creditHTML, noteHTML } from './parts.js';

export const HEAD = {
  num: '05',
  eyebrow: 'THE PHOTO CLUB',
  title: pair('イカのある風景。', 'Life, with a little squid.'),
  desc: pair('部員の釣果、山口の海、イカの姿、食卓。撮影者と撮影地を添えた、部の参考アルバム。', 'Our catches, the Yamaguchi coast, squid life and the table. A club reference album, with photographers and locations credited.'),
};

const catLabel = (key) => photoCats.find(([k]) => k === key)?.[1] ?? pair('', '');

export function photoTileHTML(lang, p) {
  const [w, h] = photoDims(p.id);
  return `
  <figure class="ika-photo${p.own ? ' ika-photo--own' : ''}" data-cat="${p.cat}" data-id="${p.id}">
    <button type="button" class="ika-photo-btn" data-open="${p.id}" aria-label="${esc(t(lang, p.title))}${t(lang, '（拡大して見る）', ' (enlarge)')}">
      <img src="${assetHref(p.thumb ?? p.file)}" alt="${esc(t(lang, p.caption))}" width="${w}" height="${h}" loading="lazy" decoding="async" />
      <span class="ika-photo-cat">${t(lang, catLabel(p.cat))}</span>
    </button>
    <figcaption>
      <span class="ika-photo-title">${t(lang, p.title)}</span>
      <span class="ika-photo-by">${p.own ? `© ${esc(p.author)}` : `${t(lang, '写真', 'Photo')}: ${esc(p.author)} ・ ${esc(t(lang, p.license))}`}</span>
    </figcaption>
  </figure>`;
}

export function render(lang) {
  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-gallery-section">
    <div class="wrap">
      ${chipsHTML(lang, photoCats, { attr: 'cat', label: pair('写真の種類で絞り込む', 'Filter photos'), id: 'ika-gallery-filter' })}
      <p class="ika-gallery-count" role="status"><b id="ika-gallery-count">${photos.length}</b> ${t(lang, '枚', 'photos')}</p>
      <div class="ika-gallery" id="ika-gallery">${photos.map((p) => photoTileHTML(lang, p)).join('')}</div>
      ${noteHTML(lang, {
        label: pair('写真について', 'About the photos'),
        html: `<p>${t(
          lang,
          '「部員の釣果」は部員が山口で釣った実物です（釣り場は非公開）。それ以外は出典を明記した参考写真で、部員の釣果として扱っていません。今後の写真募集でも、正確な釣り場の位置情報は公開しない方針です。',
          '“Our catches” are real squid caught by members in Yamaguchi (locations kept private). Everything else is a credited reference photograph, not claimed as a member catch. Future member submissions will not reveal precise fishing locations either.'
        )}</p>`,
      })}
    </div>
  </section>

  <!-- 拡大表示（pages/gallery.js が中身を入れる）。写真の中身はブラウザで差し替えるので最初は空 -->
  <dialog class="ika-lightbox" id="ika-lightbox" aria-label="${t(lang, '写真の拡大表示', 'Enlarged photo')}">
    <div class="ika-lightbox-inner">
      <button type="button" class="ika-lightbox-close" id="ika-lightbox-close" aria-label="${t(lang, 'とじる', 'Close')}">×</button>
      <figure class="ika-lightbox-figure">
        <img id="ika-lightbox-img" src="" alt="" />
        <figcaption class="ika-lightbox-cap" id="ika-lightbox-cap"></figcaption>
      </figure>
      <div class="ika-lightbox-nav">
        <button type="button" class="ika-lightbox-prev" id="ika-lightbox-prev" aria-label="${t(lang, '前の写真', 'Previous photo')}">←</button>
        <span class="ika-lightbox-pos" id="ika-lightbox-pos"></span>
        <button type="button" class="ika-lightbox-next" id="ika-lightbox-next" aria-label="${t(lang, '次の写真', 'Next photo')}">→</button>
      </div>
    </div>
  </dialog>`;
}

// 拡大表示のキャプション（pages/gallery.js から。写真データは data.js の pair なので lang が要る）
export function lightboxCaptionHTML(lang, p) {
  return `
    <strong>${t(lang, p.title)}</strong>
    <span>${t(lang, p.caption)}</span>
    ${creditHTML(lang, p)}`;
}

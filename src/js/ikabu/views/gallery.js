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

// 投稿フォームの文言（2026-10-01）。写真部に投稿すると🎫1枚（1日1回）。掲載は部長が確認してから
export const POST_TEXT = {
  eyebrow: 'POST YOUR SQUID',
  title: pair('部員の写真、募集中。', 'Share your squid photo.'),
  lead: pair('投稿すると、その場で🎫チケット1枚（1日1回）。写真は部長が確認してから写真部に並びます。釣り場の名前は書かなくて大丈夫です。', 'Post a photo and get 🎫 1 ticket right away (once a day). Photos appear after the club captain checks them. No need to name the spot.'),
  photo: pair('写真（JPEG・1枚。送る前に縮小して撮影場所の情報は消します）', 'Photo (one JPEG; resized before sending, location data removed)'),
  cat: pair('写真の種類', 'Category'),
  name: pair('ニックネーム（20文字まで）', 'Nickname (up to 20 characters)'),
  comment: pair('ひとこと（120文字まで・なくてもOK）', 'A few words (up to 120 characters, optional)'),
  agree: pair('写真部への掲載に同意します（自分で撮った写真です）', 'I agree to have this shown in the gallery (it is my own photo)'),
  submit: pair('投稿する（🎫1枚）', 'Post (🎫 +1)'),
  off: pair('投稿の受け付けは準備中です。もうしばらくお待ちください。', 'Submissions are not open yet. Please check back soon.'),
  ugcTitle: pair('部員の投稿', 'Member posts'),
  ugcLead: pair('投稿してくれた写真。撮影地は載せていません。', 'Photos from members. Locations are not shown.'),
  ugcLoading: pair('読み込み中…', 'Loading…'),
  ugcEmpty: pair('まだ投稿がありません。最初の一枚をお待ちしています。', 'No posts yet. Be the first.'),
  ugcError: pair('投稿を読み込めませんでした。時間をおいて開き直してください。', 'Could not load posts. Please try again later.'),
  albumTitle: pair('部の参考アルバム', 'Club reference album'),
};

export function postFormHTML(lang) {
  const T = POST_TEXT;
  const cats = photoCats.filter(([k]) => k !== 'all');
  return `
  <section class="ika-section ika-photopost" id="ika-photo-post" aria-labelledby="ika-photopost-title">
    <div class="wrap">
      <div class="ika-photopost-card">
        <p class="ika-eyebrow">${T.eyebrow}</p>
        <h2 class="ika-photopost-title" id="ika-photopost-title">📷 ${t(lang, T.title)}</h2>
        <p class="ika-photopost-lead">${t(lang, T.lead)}</p>
        <form class="ika-photopost-form" id="ika-photopost-form" novalidate>
          <label class="ika-photopost-field"><span class="ika-photopost-label">${t(lang, T.photo)}</span>
            <input type="file" id="ika-pp-photo" name="photo" accept="image/*" required /></label>
          <fieldset class="ika-photopost-field ika-photopost-cats"><legend class="ika-photopost-label">${t(lang, T.cat)}</legend>
            ${cats.map(([k, v], i) => `<label class="ika-photopost-cat"><input type="radio" name="cat" value="${k}"${i === 0 ? ' checked' : ''} /><span>${t(lang, v)}</span></label>`).join('')}
          </fieldset>
          <label class="ika-photopost-field"><span class="ika-photopost-label">${t(lang, T.name)}</span>
            <input type="text" id="ika-pp-name" name="name" maxlength="20" autocomplete="nickname" required /></label>
          <label class="ika-photopost-field"><span class="ika-photopost-label">${t(lang, T.comment)}</span>
            <textarea id="ika-pp-comment" name="comment" maxlength="120" rows="2"></textarea></label>
          <label class="ika-photopost-agree"><input type="checkbox" id="ika-pp-agree" name="agree" value="1" required /><span>${t(lang, T.agree)}</span></label>
          <div class="ika-photopost-ts" id="ika-pp-ts"></div>
          <div class="ika-photopost-actions">
            <button type="submit" class="ika-btn ika-btn--primary" id="ika-pp-submit">${t(lang, T.submit)}</button>
          </div>
          <p class="ika-photopost-msg" id="ika-pp-msg" role="status" aria-live="polite"></p>
        </form>
        <p class="ika-photopost-off" id="ika-pp-off" hidden>${t(lang, T.off)}</p>
      </div>
    </div>
  </section>`;
}

// 投稿された写真のタイル（pages/gallery.js がブラウザで並べる。写真の住所は Worker）
export function ugcTileHTML(lang, p, src) {
  return `
  <figure class="ika-photo ika-photo--own ika-photo--ugc" data-cat="${esc(p.cat)}" data-id="${esc(p.id)}">
    <button type="button" class="ika-photo-btn" data-open="${esc(p.id)}" aria-label="${esc(p.name)}${t(lang, '（拡大して見る）', ' (enlarge)')}">
      <img src="${esc(src)}" alt="${esc(p.comment || p.name)}" loading="lazy" decoding="async" />
      <span class="ika-photo-cat">${t(lang, catLabel(p.cat))}</span>
    </button>
    <figcaption>
      <span class="ika-photo-title">${esc(p.comment || t(lang, '部員の投稿', 'Member post'))}</span>
      <span class="ika-photo-by">📷 ${esc(p.name)}</span>
    </figcaption>
  </figure>`;
}
export const ugcCaptionHTML = (lang, p) => `
    <strong>${esc(p.comment || t(lang, '部員の投稿', 'Member post'))}</strong>
    <span>${t(lang, catLabel(p.cat))} ・ ${esc(p.createdAt?.slice(0, 10) ?? '')}</span>
    <p class="ika-credit">📷 ${esc(p.name)}</p>`;

export function render(lang) {
  const T = POST_TEXT;
  return `${pageHead(lang, HEAD)}
  ${postFormHTML(lang)}
  <section class="ika-section ika-gallery-section">
    <div class="wrap">
      ${chipsHTML(lang, photoCats, { attr: 'cat', label: pair('写真の種類で絞り込む', 'Filter photos'), id: 'ika-gallery-filter' })}
      <h2 class="ika-gallery-h2">${t(lang, T.ugcTitle)}</h2>
      <p class="ika-gallery-lead">${t(lang, T.ugcLead)}</p>
      <p class="ika-gallery-status" id="ika-ugc-status" role="status">${t(lang, T.ugcLoading)}</p>
      <div class="ika-gallery" id="ika-ugc"></div>
      <h2 class="ika-gallery-h2">${t(lang, T.albumTitle)}</h2>
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

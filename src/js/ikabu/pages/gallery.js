// イカ部「gallery」の入口。写真はビルド時に書き込み済み。ここでは絞り込みと <dialog> の拡大表示。
// 2026-10-01：投稿フォーム（Worker へ送る・🎫1枚）と、掲載済みの投稿の一覧を足した
import { boot } from '../boot.js';
import { render, lightboxCaptionHTML, ugcTileHTML, ugcCaptionHTML, POST_TEXT } from '../views/gallery.js';
import { photos, photoById } from '../data.js';
import { t, assetHref } from '../i18n.js';
import { mountTicketEarn } from '../games/tickets-ui.js';
import { photoPostEnabled, TURNSTILE_SITE_KEY, fetchIkabuPhotos, submitIkabuPhoto, ikabuPhotoUrl } from '../api/photos.js';
import { resizeToFit } from '../../lib/resize-image.js';

const { lang } = boot(render);
mountTicketEarn({ lang });   // 投稿が届いたら「🎫 チケット1枚ゲット！」

const filterBox = document.getElementById('ika-gallery-filter');
const grid = document.getElementById('ika-gallery');
const ugcGrid = document.getElementById('ika-ugc');
const ugcStatus = document.getElementById('ika-ugc-status');
const count = document.getElementById('ika-gallery-count');
let cat = 'all';
const ugc = new Map();   // id → 投稿（拡大表示の説明に使う）

/* ---------- 絞り込み（参考アルバムと部員の投稿の両方に効く） ---------- */

const grids = () => [ugcGrid, grid].filter(Boolean);
const visibleIds = () => grids().flatMap((g) => [...g.querySelectorAll('.ika-photo:not([hidden])')].map((f) => f.dataset.id));

function applyFilter(next) {
  cat = next;
  filterBox.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
  grids().forEach((g) => g.querySelectorAll('.ika-photo').forEach((f) => (f.hidden = !(cat === 'all' || f.dataset.cat === cat))));
  if (count) count.textContent = String([...grid.querySelectorAll('.ika-photo:not([hidden])')].length);
}

filterBox?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ika-chip[data-cat]');
  if (btn) applyFilter(btn.dataset.cat);
});

/* ---------- 拡大表示（<dialog>。Esc とフォーカスの戻りはブラウザに任せる） ---------- */

const dlg = document.getElementById('ika-lightbox');
const img = document.getElementById('ika-lightbox-img');
const cap = document.getElementById('ika-lightbox-cap');
const pos = document.getElementById('ika-lightbox-pos');
let currentId = null;
let opener = null;

function show(id) {
  const p = photoById(id);
  const u = ugc.get(id);
  if (!p && !u) return;
  currentId = id;
  if (p) {
    img.src = assetHref(p.file);
    img.alt = t(lang, p.caption);
    cap.innerHTML = lightboxCaptionHTML(lang, p);
  } else {
    img.src = ikabuPhotoUrl(u.id);
    img.alt = u.comment || u.name;
    cap.innerHTML = ugcCaptionHTML(lang, u);
  }
  const ids = visibleIds();
  pos.textContent = `${ids.indexOf(id) + 1} / ${ids.length}`;
}

function step(dir) {
  const ids = visibleIds();
  const i = ids.indexOf(currentId);
  if (i < 0) return;
  show(ids[(i + dir + ids.length) % ids.length]);
}

for (const g of grids()) {
  g.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-open]');
    if (!btn || !dlg?.showModal) return;
    opener = btn;
    show(btn.dataset.open);
    dlg.showModal();
  });
}

document.getElementById('ika-lightbox-close')?.addEventListener('click', () => dlg.close());
document.getElementById('ika-lightbox-prev')?.addEventListener('click', () => step(-1));
document.getElementById('ika-lightbox-next')?.addEventListener('click', () => step(1));
dlg?.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
// 写真の外（暗いところ）を押したら閉じる
dlg?.addEventListener('click', (e) => {
  if (e.target === dlg) dlg.close();
});
dlg?.addEventListener('close', () => {
  img.src = '';
  opener?.focus();
});

// ?photo=id で開く（出典ページなどからのリンク用）
const wanted = new URLSearchParams(location.search).get('photo');
if (wanted && photos.some((p) => p.id === wanted) && dlg?.showModal) {
  show(wanted);
  dlg.showModal();
}

/* ---------- 部員の投稿の一覧（掲載済みだけ。Worker から読む） ---------- */

async function loadUgc() {
  if (!ugcGrid || !ugcStatus) return;
  if (!photoPostEnabled) { ugcStatus.textContent = t(lang, POST_TEXT.ugcEmpty); return; }
  try {
    const posts = await fetchIkabuPhotos();
    ugc.clear();
    for (const p of posts) ugc.set(p.id, p);
    ugcGrid.innerHTML = posts.map((p) => ugcTileHTML(lang, p, ikabuPhotoUrl(p.id))).join('');
    ugcStatus.textContent = posts.length ? '' : t(lang, POST_TEXT.ugcEmpty);
    ugcStatus.hidden = posts.length > 0;
    applyFilter(cat);
  } catch {
    ugcStatus.textContent = t(lang, POST_TEXT.ugcError);
  }
}
loadUgc();

/* ---------- 投稿フォーム ---------- */

const form = document.getElementById('ika-photopost-form');
const msg = document.getElementById('ika-pp-msg');
const submitBtn = document.getElementById('ika-pp-submit');
const off = document.getElementById('ika-pp-off');
let widgetId = null;

function say(text, isError = false) {
  if (!msg) return;
  msg.textContent = text;
  msg.classList.toggle('is-error', isError);
}
// ロボット除け（Turnstile）。受付が準備中のときは Cloudflare のスクリプトを読み込まない
function loadTurnstile() {
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  document.head.append(s);
}
function mountTurnstile(tries = 0) {
  if (window.turnstile) {
    widgetId = window.turnstile.render('#ika-pp-ts', { sitekey: TURNSTILE_SITE_KEY, theme: 'light' });
  } else if (tries < 50) {
    setTimeout(() => mountTurnstile(tries + 1), 200);
  }
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const token = widgetId !== null && window.turnstile ? window.turnstile.getResponse(widgetId) : '';
  if (!token) return say(t(lang, 'ロボットでないことの確認が終わるまで、少しお待ちください。', 'Please wait for the robot check to finish.'), true);

  submitBtn.disabled = true;
  say(t(lang, '送信しています…', 'Sending…'));
  try {
    const file = document.getElementById('ika-pp-photo').files[0];
    if (!file) return say(t(lang, '写真を選んでください。', 'Please choose a photo.'), true);
    let blob, fit;
    try {
      fit = await resizeToFit(file);   // 300KB 目安まで縮小し、撮影情報（位置など）を落とす（2026-10-01 iPhoneの送信失敗の対策）
      blob = fit.blob;
    } catch {
      return say(t(lang, 'この写真は読み込めませんでした。別の写真でお試しください。', 'Could not read this photo. Please try another.'), true);
    }
    // 送る中身は1つずつ組み立てる。new FormData(form) だと、iPhoneで選んだ元の写真（HEIC など）まで一度
    // 抱え込むので使わない（2026-10-01 ぱっぱのiPhoneで送信が Worker に届かなかった件の対策）
    const data = new FormData();
    data.set('cat', form.querySelector('input[name=cat]:checked')?.value ?? '');
    data.set('name', document.getElementById('ika-pp-name').value);
    data.set('comment', document.getElementById('ika-pp-comment').value);
    data.set('agree', document.getElementById('ika-pp-agree').checked ? '1' : '');
    data.set('cf-turnstile-response', token);
    data.set('photo', new File([await blob.arrayBuffer()], 'photo.jpg', { type: 'image/jpeg' }));

    const result = await submitIkabuPhoto(data, { size: blob.size, side: fit.side, src: file.type || '?', srcSize: file.size });
    if (!result.ok) return say(result.error, true);

    form.reset();
    // 🎫は「投稿が届いた時点」で付ける（2026-10-01 ぱっぱ）。付与は tickets-ui（1日1枚）
    dispatchEvent(new CustomEvent('ikabu:game', { detail: { game: 'photo', counted: true } }));
    say(t(lang, '投稿しました。ありがとうございます！ 部長が確認してから写真部に並びます。', 'Posted. Thank you! It will appear once the club captain has checked it.'));
  } finally {
    submitBtn.disabled = false;
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);   // トークンは1回しか使えない
  }
});

if (photoPostEnabled) {
  loadTurnstile();
  mountTurnstile();
} else if (form) {
  form.hidden = true;
  if (off) off.hidden = false;
}

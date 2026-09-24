// イカ部「gallery」の入口。写真はビルド時に書き込み済み。ここでは絞り込みと <dialog> の拡大表示
import { boot } from '../boot.js';
import { render, lightboxCaptionHTML } from '../views/gallery.js';
import { photos, photoById } from '../data.js';
import { t, assetHref } from '../i18n.js';

const { lang } = boot(render);

const filterBox = document.getElementById('ika-gallery-filter');
const grid = document.getElementById('ika-gallery');
const count = document.getElementById('ika-gallery-count');
let cat = 'all';

/* ---------- 絞り込み ---------- */

const visibleIds = () => [...grid.querySelectorAll('.ika-photo:not([hidden])')].map((f) => f.dataset.id);

function applyFilter(next) {
  cat = next;
  filterBox.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
  grid.querySelectorAll('.ika-photo').forEach((f) => (f.hidden = !(cat === 'all' || f.dataset.cat === cat)));
  if (count) count.textContent = String(visibleIds().length);
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
  if (!p) return;
  currentId = id;
  img.src = assetHref(p.file);
  img.alt = t(lang, p.caption);
  cap.innerHTML = lightboxCaptionHTML(lang, p);
  const ids = visibleIds();
  pos.textContent = `${ids.indexOf(id) + 1} / ${ids.length}`;
}

function step(dir) {
  const ids = visibleIds();
  const i = ids.indexOf(currentId);
  if (i < 0) return;
  show(ids[(i + dir + ids.length) % ids.length]);
}

grid?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-open]');
  if (!btn || !dlg?.showModal) return;
  opener = btn;
  show(btn.dataset.open);
  dlg.showModal();
});

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

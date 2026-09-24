// イカ部「map」の入口。一覧はビルド時に書き込み済み。ここでは
//   (1) Leaflet（public/vendor に同梱・このページだけ読む）で地図を出してピンを打つ
//   (2) 絞り込みチップ、カード⇔ピンの相互ハイライト
// 地図が読めなくても一覧は生きているので、失敗したら枠に一言出すだけにする。
import { boot } from '../boot.js';
import { render, spotNumber } from '../views/map.js';
import { spots } from '../data.js';
import { t, assetHref } from '../i18n.js';

const { lang } = boot(render);

const LEAFLET_DIR = '/vendor/leaflet-1.9.4';
const mapEl = document.getElementById('ika-map');
const spotsEl = document.getElementById('ika-spots');
const filters = document.getElementById('ika-map-filters');

let map = null;
const markers = new Map(); // spot.id → L.marker
let filter = 'all';
let active = null;

/* ---------- 絞り込み ---------- */

function applyFilter(next) {
  filter = next;
  filters.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
  spotsEl.querySelectorAll('.ika-spot').forEach((card) => {
    const show = filter === 'all' || card.dataset.type === filter;
    card.hidden = !show;
    const m = markers.get(card.dataset.spot);
    if (m && map) show ? m.addTo(map) : m.remove();
  });
  if (active && !spots.some((s) => s.id === active && (filter === 'all' || s.type === filter))) highlight(null);
}

filters?.addEventListener('click', (e) => {
  const b = e.target.closest('.ika-chip[data-filter]');
  if (b) applyFilter(b.dataset.filter);
});

/* ---------- カードとピンの相互ハイライト ---------- */

function highlight(id, { scroll = false } = {}) {
  active = id;
  spotsEl.querySelectorAll('.ika-spot').forEach((card) => card.classList.toggle('is-active', card.dataset.spot === id));
  markers.forEach((m, sid) => {
    const el = m.getElement?.();
    if (el) el.classList.toggle('is-active', sid === id);
  });
  if (scroll && id) document.getElementById(`spot-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

spotsEl?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-spot-focus]');
  if (!btn) return;
  const s = spots.find((x) => x.id === btn.dataset.spotFocus);
  if (!s) return;
  highlight(s.id);
  if (map) {
    map.flyTo(s.pos, 11, { duration: 0.8 });
    markers.get(s.id)?.openPopup();
    // スマホでは地図が上にあるので、ピンが見えるところまで戻す
    if (matchMedia('(max-width: 900px)').matches) mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

/* ---------- Leaflet を読んで地図を出す ---------- */

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = assetHref(`${LEAFLET_DIR}/leaflet.css`);
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = assetHref(`${LEAFLET_DIR}/leaflet.js`);
    js.defer = true;
    js.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet が読み込めませんでした')));
    js.onerror = () => reject(new Error('Leaflet が読み込めませんでした'));
    document.head.appendChild(js);
  });
}

function pinIcon(L, s) {
  return L.divIcon({
    className: 'ika-pin-wrap',
    html: `<span class="ika-pin ika-pin--${s.type}"><b>${spotNumber(s)}</b></span>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
}

async function initMap() {
  if (!mapEl) return;
  let L;
  try {
    L = await loadLeaflet();
  } catch {
    mapEl.querySelector('.ika-map-fallback-title').textContent = t(lang, '地図を読み込めませんでした。', 'The map could not load.');
    return;
  }
  mapEl.innerHTML = '';
  mapEl.classList.add('is-ready');
  map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView([34.34, 131.25], 9);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  }).addTo(map);
  for (const s of spots) {
    const m = L.marker(s.pos, { icon: pinIcon(L, s), title: t(lang, s.name), alt: t(lang, s.name), keyboard: true });
    m.bindPopup(`<strong>${spotNumber(s)}. ${t(lang, s.name)}</strong><br>${t(lang, s.tag)}`, { closeButton: false });
    m.on('click', () => highlight(s.id, { scroll: true }));
    markers.set(s.id, m);
  }
  applyFilter(filter);
  // 5つ全部が入る範囲に寄せる（縦長画面では少し余白を取る）
  map.fitBounds(L.latLngBounds(spots.map((s) => s.pos)), { padding: [36, 36], maxZoom: 10 });
}

initMap();

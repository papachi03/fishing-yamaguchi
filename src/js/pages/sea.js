import { mountChrome, mountFooterBottom, initReveal } from '../main.js';
import { areas, areaById } from '../data/areas.js';
import { fetchWeather } from '../api/weather.js';
import { fetchTide } from '../api/tide.js';
import { dashHTML, sourceNoteText, toggleHTML, hhmm } from './sea-render.js';

mountChrome('/sea.html');
mountFooterBottom(document.getElementById('footer-mount'));

const dash = document.getElementById('sea-dash');
const toggle = document.getElementById('area-toggle');
const sourceNote = document.getElementById('source-note');

// ビルド時に取得して埋め込んだ予報（scripts/prerender-sea.mjs）。
// 開いた時の取得に失敗したら、これを「○時○分時点」として代わりに見せる。
let snapshot = null;
try {
  const el = document.getElementById('sea-snapshot');
  if (el) snapshot = JSON.parse(el.textContent);
} catch {
  snapshot = null;
}

// 事前描画済みのエリア（最初の1回だけ「取得しています…」で中身を消さないために使う）
let prerendered = dash.dataset.prerendered || null;

const weatherCache = new Map();
const tideCache = new Map();

const hashId = location.hash.slice(1);
let current = areas.some((a) => a.id === hashId) ? hashId : 'hagi';

toggle.innerHTML = toggleHTML(areas, current);

// 事前描画の中身はフェードイン待ち（.reveal）なので、最新の予報を待たずに表示を始める
if (prerendered) initReveal();

function selectArea(id) {
  current = id;
  toggle.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.area === current;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  render();
}

toggle.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-area]');
  if (!btn) return;
  history.replaceState(null, '', `#${btn.dataset.area}`);
  selectArea(btn.dataset.area);
});

// ページを開いたまま URL のハッシュだけが変わった場合にも切り替える。
// （#hofu を見ている人に #hagi のリンクを送っても何も起きない、という状態を防ぐ）
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (!areas.some((a) => a.id === id) || id === current) return;
  selectArea(id);
});

async function loadWeather(area) {
  if (weatherCache.has(area.id)) return weatherCache.get(area.id);
  const w = await fetchWeather(area);
  weatherCache.set(area.id, w); // 成功した時だけ覚える（失敗は次の切り替えで取り直す）
  return w;
}

async function loadTide(area) {
  if (tideCache.has(area.id)) return tideCache.get(area.id);
  const t = await fetchTide(area);
  tideCache.set(area.id, t);
  return t;
}

const fmtDateTime = (d) => `${d.getMonth() + 1}/${d.getDate()} ${hhmm(d)}`;

async function render() {
  const areaId = current;
  const area = areaById(areaId);

  // 事前描画が出ているエリアは、最新の予報が届くまでそのまま見せておく
  if (prerendered !== areaId) {
    dash.innerHTML = '<p class="sea-error">海況を取得しています…</p>';
  }
  prerendered = null;

  const [wr, tr] = await Promise.allSettled([loadWeather(area), loadTide(area)]);
  if (areaId !== current) return; // 取得中に別のエリアへ切り替えられた

  const now = new Date();
  let w = wr.status === 'fulfilled' ? wr.value : null;
  const t = tr.status === 'fulfilled' ? tr.value : null;
  let updatedLabel = `UPDATED ${hhmm(now)} JST`;
  let notice = '';

  if (!w && snapshot?.areas?.[areaId]) {
    w = snapshot.areas[areaId];
    const at = new Date(snapshot.fetchedAt);
    updatedLabel = `${fmtDateTime(at)} 時点の予報`;
    notice = `最新の予報を取得できなかったため、${fmtDateTime(at)} 時点の予報を表示しています。`;
  }

  dash.innerHTML = dashHTML({ area, w, t, now, updatedLabel, notice });
  sourceNote.textContent = sourceNoteText(area, t);
  initReveal();
}

render();

import { mountChrome, mountFooterBottom, initReveal } from '../main.js';
import { areas, areaById } from '../data/areas.js';
import { loadSnapshot, atNow } from '../api/sea-snapshot.js';
import { fetchObservation } from '../api/observation.js';
import { fetchTide } from '../api/tide.js';
import { dashHTML, sourceNoteText, toggleHTML, hhmm } from './sea-render.js';
import { mountAreaReports, cancelAreaReports } from '../components/area-reports.js';
import { bindReportButtons } from '../components/report-flag.js';

mountChrome('/sea.html');
mountFooterBottom(document.getElementById('footer-mount'));

const dash = document.getElementById('sea-dash');
const toggle = document.getElementById('area-toggle');
const sourceNote = document.getElementById('source-note');
const reportsBox = document.getElementById('sea-reports');
bindReportButtons(reportsBox);

// 予報はビルド時（3時間ごと）に取得して埋め込んだもの（scripts/prerender-sea.mjs）を使う。
// 2026-09-24 乗り換え：予報の取得元（met.no）は User-Agent を名乗れる場所からしか呼べないため、
// ブラウザからは取りに行かない。開いたときにブラウザが取るのは、気象庁アメダスの実測だけ。

// 事前描画済みのエリア（最初の1回だけ「取得しています…」で中身を消さないために使う）
let prerendered = dash.dataset.prerendered || null;

const tideCache = new Map();
const obsCache = new Map();

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
  const snap = await loadSnapshot(import.meta.env.BASE_URL);
  const w = snap?.areas?.[area.id];
  if (!w) throw new Error('snapshot に予報が無い');
  return { w: atNow(w), fetchedAt: new Date(snap.fetchedAt) };
}

// アメダスの実測（10分ごと）。5分は使い回す
async function loadObservation(area) {
  const hit = obsCache.get(area.id);
  if (hit && Date.now() - hit.at < 5 * 60e3) return hit.v;
  const v = await fetchObservation(area.id);
  obsCache.set(area.id, { at: Date.now(), v });
  return v;
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
  // 前のエリアの「現地の声」を残さない（海況が届いてから、このエリアの分を取りに行く）。
  // 取得中のものも捨てる。空にするだけだと、遅れて帰ってきた前のエリアぶんが描かれてしまう
  cancelAreaReports();
  reportsBox.innerHTML = '';

  const [wr, tr, or] = await Promise.allSettled([loadWeather(area), loadTide(area), loadObservation(area)]);
  if (areaId !== current) return; // 取得中に別のエリアへ切り替えられた

  const now = new Date();
  const w = wr.status === 'fulfilled' ? wr.value.w : null;
  const t = tr.status === 'fulfilled' ? tr.value : null;
  const obs = or.status === 'fulfilled' ? or.value : null;
  const updatedLabel = w ? `${fmtDateTime(wr.value.fetchedAt)} 発表の予報` : `UPDATED ${hhmm(now)} JST`;

  dash.innerHTML = dashHTML({ area, w, t, now, updatedLabel, obs });
  sourceNote.textContent = sourceNoteText(area, t);
  initReveal();
  mountAreaReports(reportsBox, areaId); // 待たない。失敗しても海況には影響させない
}

render();

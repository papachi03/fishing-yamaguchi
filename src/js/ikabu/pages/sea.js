// イカ部「sea」の入口。説明文はビルド時に書き込み済み。ここでは YFJ の海況ロジック
// （weather / tide / sea-render / area-reports）をそのまま使い、lang を渡して生きた数字を入れる。
// 見た目はイカ部の CSS（.ikabu .sea-dash …）で上書きし、YFJ 本体の sea.html には触らない。
import { boot } from '../boot.js';
import { render } from '../views/sea.js';
import { t } from '../i18n.js';
import { areas, areaById } from '../../data/areas.js';
import { loadSnapshot, atNow } from '../../api/sea-snapshot.js';
import { fetchObservation } from '../../api/observation.js';
import { fetchTide } from '../../api/tide.js';
import { dashHTML, sourceNoteText, hhmm } from '../../pages/sea-render.js';
import { mountAreaReports, cancelAreaReports } from '../../components/area-reports.js';
import { bindReportButtons, REPORT_FLAG_LABELS } from '../../components/report-flag.js';
import { initReveal } from '../../main.js';

const { lang } = boot(render);

const dash = document.getElementById('ika-sea-dash');
const toggle = document.getElementById('ika-area-toggle');
const sourceNote = document.getElementById('ika-sea-source');
const reportsBox = document.getElementById('ika-sea-reports');
bindReportButtons(reportsBox, REPORT_FLAG_LABELS[lang]);

const weatherCache = new Map();
const tideCache = new Map();

// 山口マップの「この海域の風と波 →」は #hagi のようなハッシュで飛んでくる
const validId = (id) => areas.some((a) => a.id === id);
let current = validId(location.hash.slice(1)) ? location.hash.slice(1) : 'hagi';

function selectArea(id) {
  current = id;
  toggle.querySelectorAll('button[data-area]').forEach((b) => {
    const on = b.dataset.area === current;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-selected', String(on));
  });
  renderArea();
}

toggle.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-area]');
  if (!btn) return;
  history.replaceState(null, '', `#${btn.dataset.area}`);
  selectArea(btn.dataset.area);
});

// 開いたまま URL のハッシュだけ変わった場合（別ページのリンクから）にも切り替える
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (validId(id) && id !== current) selectArea(id);
});

// 予報は本家と同じく、サイトのビルド時（3時間ごと）に取った sea-snapshot を読む
// （met.no は User-Agent を名乗れる場所からしか呼べない規約のため、ブラウザから直接取りに行かない。2026-09-29）
async function loadWeather(area) {
  if (weatherCache.has(area.id)) return weatherCache.get(area.id);
  const snap = await loadSnapshot(import.meta.env.BASE_URL);
  const w = snap?.areas?.[area.id];
  if (!w) throw new Error('snapshot に予報が無い');
  const v = { w, fetchedAt: new Date(snap.fetchedAt) };
  weatherCache.set(area.id, v); // 成功した時だけ覚える
  return v;
}
// アメダスの実測（参考・判定には使わない）
async function loadObservation(area) {
  try {
    return await fetchObservation(area.id);
  } catch {
    return null;
  }
}
async function loadTide(area) {
  if (tideCache.has(area.id)) return tideCache.get(area.id);
  const tide = await fetchTide(area);
  tideCache.set(area.id, tide);
  return tide;
}

async function renderArea() {
  const areaId = current;
  const area = areaById(areaId);
  dash.innerHTML = `<p class="sea-error">${t(lang, '海況を取得しています…', 'Loading sea conditions…')}</p>`;
  cancelAreaReports();
  reportsBox.innerHTML = '';

  const [wr, tr, or] = await Promise.allSettled([loadWeather(area), loadTide(area), loadObservation(area)]);
  if (areaId !== current) return; // 取得中に別のエリアへ切り替えられた

  const now = new Date();
  const w = wr.status === 'fulfilled' ? atNow(wr.value.w, now) : null;
  const tide = tr.status === 'fulfilled' ? tr.value : null;
  const obs = or.status === 'fulfilled' ? or.value : null;
  const at = wr.status === 'fulfilled' ? wr.value.fetchedAt : null;
  const updatedLabel = at
    ? t(lang, `${at.getMonth() + 1}/${at.getDate()} ${hhmm(at)} 発表の予報`, `Forecast issued ${at.getMonth() + 1}/${at.getDate()} ${hhmm(at)} JST`)
    : `UPDATED ${hhmm(now)} JST`;
  dash.innerHTML = dashHTML({ area, w, t: tide, now, updatedLabel, obs, lang });
  sourceNote.textContent = sourceNoteText(area, tide, lang);
  initReveal();
  mountAreaReports(reportsBox, areaId, lang); // 待たない。失敗しても海況には影響させない
}

selectArea(current);

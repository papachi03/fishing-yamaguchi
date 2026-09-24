// イカ部「sea」の入口。説明文はビルド時に書き込み済み。ここでは YFJ の海況ロジック
// （weather / tide / sea-render / area-reports）をそのまま使って、生きた数字を入れる。
// 見た目はイカ部の CSS（.ikabu .sea-dash …）で上書きし、YFJ 本体の sea.html には触らない。
import { boot } from '../boot.js';
import { render } from '../views/sea.js';
import { t } from '../i18n.js';
import { localizeSeaHTML } from '../sea-i18n.js';
import { areas, areaById } from '../../data/areas.js';
import { fetchWeather } from '../../api/weather.js';
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

async function loadWeather(area) {
  if (weatherCache.has(area.id)) return weatherCache.get(area.id);
  const w = await fetchWeather(area);
  weatherCache.set(area.id, w); // 成功した時だけ覚える
  return w;
}
async function loadTide(area) {
  if (tideCache.has(area.id)) return tideCache.get(area.id);
  const tide = await fetchTide(area);
  tideCache.set(area.id, tide);
  return tide;
}

// 英語ページ用の出典行（日本語は YFJ と同じ文をそのまま使う）
function sourceLine(area, tide) {
  if (lang !== 'en') return sourceNoteText(area, tide);
  const coord = area.contributor ? '' : ` / ${area.lat.toFixed(3)}, ${area.lon.toFixed(3)}`;
  const tideNote = tide ? ` / Tide: JMA tide tables (${tide.stationName})` : '';
  return `Weather and wind: Open-Meteo${tideNote}${coord} / Reference information for planning a trip. Always check official JMA warnings and advisories.`;
}

async function renderArea() {
  const areaId = current;
  const area = areaById(areaId);
  dash.innerHTML = `<p class="sea-error">${t(lang, '海況を取得しています…', 'Loading sea conditions…')}</p>`;
  cancelAreaReports();
  reportsBox.innerHTML = '';

  const [wr, tr] = await Promise.allSettled([loadWeather(area), loadTide(area)]);
  if (areaId !== current) return; // 取得中に別のエリアへ切り替えられた

  const now = new Date();
  const w = wr.status === 'fulfilled' ? wr.value : null;
  const tide = tr.status === 'fulfilled' ? tr.value : null;
  dash.innerHTML = localizeSeaHTML(dashHTML({ area, w, t: tide, now, updatedLabel: `UPDATED ${hhmm(now)} JST` }), lang);
  sourceNote.textContent = sourceLine(area, tide);
  initReveal();
  // 現地の声（イカ以外も含む、このエリアの最新2件）。描き終わったら英語に置き換える
  mountAreaReports(reportsBox, areaId).then(() => {
    if (lang === 'en' && reportsBox.innerHTML) reportsBox.innerHTML = localizeSeaHTML(reportsBox.innerHTML, lang);
  });
}

selectArea(current);

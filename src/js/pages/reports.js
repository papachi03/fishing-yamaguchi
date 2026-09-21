// 「現地の声」ページ：投稿フォームと、投稿の一覧（エリア／釣り場／魚種で絞り込み）
import { mountChrome, mountFooterBottom, initReveal } from '../main.js';
import { SPOTS, AREA_PLACES, UNKNOWN_PLACE, AREA_LABELS, placeById, placeLabel } from '../data/spot-list.js';
import { FISH, WIND_FEEL } from '../data/report-options.js';
import { reportsEnabled, TURNSTILE_SITE_KEY, fetchPosts, submitPost, photoUrl } from '../api/reports.js';
import { reportCardHTML, esc } from '../components/report-card.js';
import { bindReportButtons } from '../components/report-flag.js';
import { spotListHTML } from '../components/spot-list-html.js';
import { resizeToJpeg } from '../lib/resize-image.js';

mountChrome('/reports.html');
mountFooterBottom(document.getElementById('footer-mount'));

const form = document.getElementById('report-form');
const msg = document.getElementById('rf-msg');
const submitBtn = document.getElementById('rf-submit');
const listEl = document.getElementById('report-list');
const filterEl = document.getElementById('report-filter');
const areaSel = document.getElementById('ff-area');
const spotSel = document.getElementById('ff-spot');
const fishSel = document.getElementById('ff-fish');
const clearBtn = document.getElementById('ff-clear');

// 本番ビルドでは vite.config.js が書き込み済み。手元（npm run dev）では空なのでここで埋める
const spotNames = document.getElementById('spot-names');
if (!spotNames.children.length) spotNames.innerHTML = spotListHTML();

const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
const isFish = (id) => FISH.some((f) => f.id === id);
// 素の添字参照（AREA_LABELS[id]）だと #constructor などが通ってしまうので hasOwn で判定する
const isArea = (id) => typeof id === 'string' && Object.hasOwn(AREA_LABELS, id);
// そのエリアで選べる場所（漁港・堤防のあとに「市内（非公開）」）
const placesOf = (areaId) => [...SPOTS.filter((s) => s.areaId === areaId), ...AREA_PLACES.filter((p) => p.areaId === areaId)];

/* ---------- フォームの選択肢 ---------- */

// 一部禁止・時間制限のある場所は、選ぶ前に一言分かるようラベルに注意書きを足す（placeLabel）
document.getElementById('rf-spot').innerHTML =
  option('', '選んでください') +
  Object.entries(AREA_LABELS)
    .map(([areaId, label]) => `<optgroup label="${esc(label)}">${placesOf(areaId).map((p) => option(p.id, placeLabel(p))).join('')}</optgroup>`)
    .join('') +
  option(UNKNOWN_PLACE.id, UNKNOWN_PLACE.name);

document.getElementById('rf-fish').innerHTML = option('', '選ばない') + FISH.map((f) => option(f.id, f.name)).join('');

document.getElementById('rf-wind').innerHTML = WIND_FEEL.map(
  (w) => `<label class="wind-choice"><input type="radio" name="wind" value="${esc(w.id)}" /><span>${esc(w.name)}</span></label>`
).join('');

// 日付は日本時間の今日〜31日前
const jst = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const dateEl = document.getElementById('rf-date');
dateEl.max = jst(new Date());
dateEl.min = jst(new Date(Date.now() - 31 * 86400 * 1000));
dateEl.value = dateEl.max;

/* ---------- ロボット除け（Turnstile） ---------- */

let widgetId = null;
// 受付が準備中（接続先が未設定）のときは Cloudflare のスクリプトを読み込まない。HTMLには書かず、ここで足す
function loadTurnstile() {
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  s.async = true;
  document.head.append(s);
}
function mountTurnstile(tries = 0) {
  if (window.turnstile) {
    widgetId = window.turnstile.render('#ts-widget', { sitekey: TURNSTILE_SITE_KEY, theme: 'light' });
  } else if (tries < 50) {
    setTimeout(() => mountTurnstile(tries + 1), 200);
  }
}

/* ---------- 絞り込み（エリア → 釣り場 → 魚種） ---------- */

// URLのハッシュ（#area=nagato&spot=nagato-senzaki-jinkoto&fish=aori）。
// SEAページから来る #hagi の形も、これまでどおりエリア指定として読む
function readHash() {
  const raw = location.hash.slice(1);
  if (isArea(raw)) return { area: raw, spot: '', fish: '' };
  const q = new URLSearchParams(raw);
  const place = placeById(q.get('spot'));
  const spot = place?.areaId ? place.id : ''; // 「場所不明」は釣り場としては絞り込めない
  let area = isArea(q.get('area')) ? q.get('area') : '';
  if (spot && !area) area = place.areaId;
  const fish = isFish(q.get('fish')) ? q.get('fish') : '';
  return { area, spot: spot && place.areaId === area ? spot : '', fish };
}

function writeHash({ area, spot, fish }) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ area, spot, fish })) if (v) q.set(k, v);
  const s = q.toString();
  history.replaceState(null, '', s ? `#${s}` : location.pathname + location.search);
}

let filter = readHash();
let loadSeq = 0;
const filterActive = () => Boolean(filter.area || filter.spot || filter.fish);

areaSel.innerHTML = option('', 'すべて') + Object.entries(AREA_LABELS).map(([id, label]) => option(id, label)).join('');
fishSel.innerHTML = option('', 'すべて') + FISH.map((f) => option(f.id, f.name)).join('');

// エリアを選ぶまで釣り場は「すべて」だけ。エリアを変えたら釣り場の選択は「すべて」に戻す
function fillSpotOptions(areaId) {
  spotSel.innerHTML = option('', 'すべて') + (areaId ? placesOf(areaId).map((p) => option(p.id, p.name)).join('') : '');
  spotSel.disabled = !areaId;
}

function syncFilterUI() {
  areaSel.value = filter.area;
  fillSpotOptions(filter.area);
  spotSel.value = filter.spot;
  fishSel.value = filter.fish;
  clearBtn.hidden = !filterActive();
}

function applyFilter(next) {
  filter = next;
  writeHash(filter);
  syncFilterUI();
  loadList();
}

filterEl.addEventListener('change', (e) => {
  if (e.target === areaSel) applyFilter({ area: areaSel.value, spot: '', fish: filter.fish });
  else if (e.target === spotSel) applyFilter({ ...filter, spot: spotSel.value });
  else if (e.target === fishSel) applyFilter({ ...filter, fish: fishSel.value });
});

const clearFilter = () => applyFilter({ area: '', spot: '', fish: '' });
clearBtn.addEventListener('click', clearFilter);

// 投稿したばかりの1件を、いまの絞り込みの中に出してよいか
const matchesFilter = (post) =>
  (!filter.area || post.areaId === filter.area) && (!filter.spot || post.spotId === filter.spot) && (!filter.fish || post.fish === filter.fish);

/* ---------- 一覧 ---------- */

async function loadList() {
  const seq = ++loadSeq;
  if (!reportsEnabled) {
    listEl.innerHTML = '<p class="sea-error">投稿の受け付けは準備中です。もうしばらくお待ちください。</p>';
    return;
  }
  listEl.setAttribute('aria-busy', 'true');
  try {
    const posts = await fetchPosts(filter);
    if (seq !== loadSeq) return; // 読み込み中に別の条件へ切り替えられた
    if (posts.length) {
      listEl.innerHTML = posts.map((p) => reportCardHTML(p, photoUrl)).join('');
    } else if (filterActive()) {
      listEl.innerHTML =
        '<p class="sea-error">この条件の投稿はまだありません。<button type="button" class="report-filter-clear" data-clear>条件をクリア</button></p>';
    } else {
      listEl.innerHTML = '<p class="sea-error">まだ投稿がありません。最初の一件をお待ちしています。</p>';
    }
    initReveal();
  } catch {
    if (seq !== loadSeq) return;
    listEl.innerHTML = '<p class="sea-error">投稿を読み込めませんでした。時間をおいて開き直してください。</p>';
  } finally {
    if (seq === loadSeq) listEl.removeAttribute('aria-busy');
  }
}

listEl.addEventListener('click', (e) => {
  if (e.target.closest('button[data-clear]')) clearFilter();
});
bindReportButtons(listEl); // 通報ボタン（sea.html と共通）

/* ---------- 投稿 ---------- */

function say(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle('is-error', isError);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const token = widgetId !== null && window.turnstile ? window.turnstile.getResponse(widgetId) : '';
  if (!token) return say('ロボットでないことの確認が終わるまで、少しお待ちください。', true);

  submitBtn.disabled = true;
  say('送信しています…');
  try {
    const data = new FormData(form);
    data.delete('photo');
    const file = document.getElementById('rf-photo').files[0];
    if (file) {
      let blob;
      try {
        blob = await resizeToJpeg(file);
      } catch {
        return say('この写真は読み込めませんでした。別の写真でお試しください。', true);
      }
      data.set('photo', blob, 'photo.jpg');
    }
    data.set('cf-turnstile-response', token);

    const result = await submitPost(data);
    if (!result.ok) return say(result.error, true);

    form.reset();
    dateEl.value = dateEl.max;
    if (matchesFilter(result.post)) {
      say('投稿しました。ありがとうございます。');
      listEl.querySelector('.sea-error')?.remove();
      listEl.insertAdjacentHTML('afterbegin', reportCardHTML(result.post, photoUrl));
      initReveal();
    } else {
      // 一覧に出ない理由が分からないと「消えた」と思われるので、一言添える
      say('投稿しました。ありがとうございます。いまの絞り込み条件では表示されないため、条件をクリアすると見られます。');
    }
  } finally {
    submitBtn.disabled = false;
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId); // トークンは1回しか使えない
  }
});

if (reportsEnabled) {
  loadTurnstile();
  mountTurnstile();
} else {
  form.hidden = true;
}
writeHash(filter); // #hagi の形や、読めなかった条件を、いま効いている条件どおりに整える
syncFilterUI();
loadList();

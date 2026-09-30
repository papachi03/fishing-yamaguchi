// 投稿1件のカード。ブラウザのAPIに触らない純粋な関数（node --test で試せる）。
// 投稿者が書いた文字は必ず esc() を通すこと。投稿を画面に描くのはこの関数だけにする。
// lang='en'（イカ部の英語ページ）では見出し・タグ・ボタンだけ英語にする。投稿者の文字（名前・本文）は
// 書かれたまま出し、釣り場名（固有名詞）も日本語のまま。エリア名だけローマ字にする
import { placeById, AREA_LABELS, AREA_LABELS_EN } from '../data/spot-list.js';
import { FISH, WIND_FEEL, nameOf } from '../data/report-options.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 日付が無い・形が違う投稿で「NaN/NaN」と出さない（その場合は日付ごと出さない）
const monthDay = (date) => {
  const [, m, d] = String(date ?? '').split('-');
  return Number.isFinite(Number(m)) && Number.isFinite(Number(d)) && m && d ? `${Number(m)}/${Number(d)}` : '';
};

const LABELS = {
  ja: { unknown: '場所不明', photoAlt: (place) => `${place}の写真`, dated: (day) => ` ・ ${day}の情報`, wind: '風：', flag: '不適切な投稿を知らせる' },
  en: { unknown: 'Location unknown', photoAlt: (place) => `Photo from ${place}`, dated: (day) => ` ・ ${day}`, wind: 'Wind: ', flag: 'Report this post' },
};

// 「○○市内（詳しい場所は非公開）」は英語ページでローマ字に。個別の釣り場名（固有名詞）はそのまま
function placeName(place, lang) {
  if (!place) return null;
  if (lang === 'en' && place.id === 'unknown') return null;
  if (lang === 'en' && place.id.endsWith('-city') && AREA_LABELS_EN[place.areaId]) return `${AREA_LABELS_EN[place.areaId]} (exact location private)`;
  return place.name;
}

// 釣り場の名前だけだと、土地に詳しくない人にはどこの話か分からない（2026-09-30 30代の女性から）→ エリア名を添える。
// 「下関市内（詳しい場所は非公開）」のように名前にエリアが入っているもの・場所不明には付けない
export function areaOfPlace(p, lang = 'ja') {
  if (!p?.areaId || p.id.endsWith('-city')) return null;
  const area = (lang === 'en' ? AREA_LABELS_EN : AREA_LABELS)[p.areaId];
  return area && !p.name.startsWith(AREA_LABELS[p.areaId]) ? area : null;
}

export function reportCardHTML(post, photoUrl, lang = 'ja') {
  const L = LABELS[lang] ?? LABELS.ja;
  const p = placeById(post.spotId);
  const place = placeName(p, lang) ?? L.unknown;
  const area = areaOfPlace(p, lang);
  const where = area ? (lang === 'en' ? `${place}, ${area}` : `${area}・${place}`) : place;
  const fish = nameOf(FISH, post.fish, lang);
  const wind = nameOf(WIND_FEEL, post.wind, lang);
  const day = monthDay(post.date);
  return `
  <article class="report-card reveal" data-id="${esc(post.id)}">
    ${post.hasPhoto ? `<figure class="report-photo"><img src="${esc(photoUrl(post.id))}" alt="${esc(L.photoAlt(where))}" loading="lazy" decoding="async" /></figure>` : ''}
    <div class="report-body">
      ${area ? `<p class="report-area t-mono">${esc(area)}</p>` : ''}<p class="report-place">${esc(place)}</p>
      <p class="report-meta t-mono">${esc(post.name)}${day ? esc(L.dated(day)) : ''}</p>
      ${fish || wind ? `<p class="report-tags">${fish ? `<span>${esc(fish)}</span>` : ''}${wind ? `<span class="wind wind-${esc(post.wind)}">${L.wind}${esc(wind)}</span>` : ''}</p>` : ''}
      <p class="report-comment">${esc(post.comment)}</p>
      <button type="button" class="report-flag t-mono" data-report="${esc(post.id)}">${L.flag}</button>
    </div>
  </article>`;
}

// map：山口マップ。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 地図（Leaflet）はブラウザで pages/map.js が後から載せる。スポット一覧は最初から HTML にある
// ので、地図が読めなくても一覧と公式リンクは使える。
import { t, pair, esc, pageHref } from '../i18n.js';
import { spots, mapFilters, infoSources } from '../data.js';
import { pageHead, chipsHTML, noteHTML } from './parts.js';

export const HEAD = {
  num: '01',
  eyebrow: 'YAMAGUCHI FIELD GUIDE',
  title: pair('海への入口を、地図から。', 'Find your way to the coast.'),
  desc: pair('公開されている遊漁船の案内と、イカの食文化を楽しむ立ち寄り先。ピンは「エリアの目安」で、釣り場そのものは示しません。', 'Publicly listed boat-trip information and stops to explore local squid food culture. Pins mark areas, never exact fishing spots.'),
};

const RULES_URL = infoSources.find(([n]) => typeof n === 'object' && n.ja.includes('遊漁'))?.[1] ?? 'https://www.pref.yamaguchi.lg.jp/soshiki/108/21930.html';

// 地図のピンの番号（1〜）。地図・一覧・出典で同じ番号を使う
export const spotNumber = (s) => spots.indexOf(s) + 1;

export function spotCardHTML(lang, s) {
  const n = spotNumber(s);
  const links = s.links.map(([name, href]) => `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(name)} ↗</a>`).join('');
  return `
  <article class="ika-spot ika-spot--${s.type}" id="spot-${s.id}" data-spot="${s.id}" data-type="${s.type}">
    <button type="button" class="ika-spot-head" data-spot-focus="${s.id}" aria-label="${t(lang, `${t(lang, s.name)}を地図で見る`, `Show ${t(lang, s.name)} on the map`)}">
      <span class="ika-spot-num" aria-hidden="true">${n}</span>
      <span class="ika-spot-title">
        <span class="ika-spot-name">${t(lang, s.name)}</span>
        <span class="ika-spot-tag">${t(lang, s.tag)}</span>
      </span>
    </button>
    <p class="ika-spot-desc">${t(lang, s.desc)}</p>
    <p class="ika-spot-notes">${t(lang, s.notes)}</p>
    <div class="ika-spot-links">${links}</div>
    <a class="ika-spot-sea" href="${pageHref('sea', lang)}#${s.seaArea}">${t(lang, 'この海域の風と波', 'Wind & waves for this area')} <span aria-hidden="true">→</span></a>
  </article>`;
}

export function render(lang) {
  const cards = spots.map((s) => spotCardHTML(lang, s)).join('');
  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-map-section">
    <div class="wrap">
      ${chipsHTML(lang, mapFilters, { attr: 'filter', label: pair('種類で絞り込む', 'Filter by type'), id: 'ika-map-filters' })}
      <div class="ika-map-layout">
        <div class="ika-map-col">
          <div class="ika-map-frame">
            <div class="ika-map" id="ika-map" aria-label="${t(lang, '山口県の遊漁船エリアと食文化スポットの地図', 'Map of boat-fishing areas and food-culture stops in Yamaguchi')}">
              <!-- 地図が読めるまで／読めなかったときの表示。Leaflet が動いたら pages/map.js が中身を置き換える -->
              <div class="ika-map-fallback">
                <p class="ika-map-fallback-title">${t(lang, '地図を読み込んでいます', 'Loading the map')}</p>
                <p>${t(lang, '地図が出ない場合も、下のエリア案内と公式リンクはそのまま使えます。', 'If the map does not appear, the area guide and official links below still work.')}</p>
              </div>
            </div>
            <div class="ika-map-legend" aria-hidden="true">
              <span><i class="ika-pin-sample ika-pin-sample--boat"></i>${t(lang, '船釣りの案内', 'Boat fishing')}</span>
              <span><i class="ika-pin-sample ika-pin-sample--food"></i>${t(lang, 'イカを味わう', 'Food culture')}</span>
            </div>
          </div>
          <p class="ika-map-meta">${t(lang, 'ピンはエリアの目安。釣りが許可された堤防・磯の位置を示すものではありません。', 'Pins indicate approximate areas, not permission to fish from a particular harbor or shore.')}</p>
        </div>
        <div class="ika-spots" id="ika-spots" role="list">${cards}</div>
      </div>
      ${noteHTML(lang, {
        label: pair('部則その一', 'Club rule one'),
        tone: 'orange',
        html: `<p><strong>${t(lang, '秘密の場所は、秘密のままで。', 'Secret spots can stay secret.')}</strong> ${t(
          lang,
          '釣行前に船の案内・現地の掲示・駐車ルールを確認しよう。掲載先との提携・予約代行はありません。',
          'Check operator information, local notices and parking rules before visiting. Listed businesses are independent; we do not handle bookings.'
        )} <a href="${RULES_URL}" target="_blank" rel="noopener">${t(lang, '山口県の遊漁ルールを確認 ↗', 'Read the prefectural fishing rules ↗')}</a></p>`,
      })}
      <p class="ika-small">${t(lang, '公式案内の確認日：2026年9月21日。最新の営業・出船状況はリンク先へ。', 'Sources checked: 21 September 2026. Follow the official links for current operations.')}</p>
    </div>
  </section>`;
}

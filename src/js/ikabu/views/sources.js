// sources：出典。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。操作は無い。
// 写真は data.js の photos をそのまま並べる（ライセンス・撮影者はここで書き換えない）
import { t, pair, esc, assetHref, pageHref } from '../i18n.js';
import { photos, species, infoSources, spots } from '../data.js';
import { photoDims } from '../photo-dims.js';
import { pageHead, sectionHead, creditHTML } from './parts.js';

export const HEAD = {
  num: '',
  eyebrow: 'SOURCES & CREDITS',
  title: pair('情報にも、写真にも、出どころを。', 'Every fact and photograph has a source.'),
  desc: pair('写真・地図・海況・生きものの出典一覧。外部情報の確認日：2026年9月21日。', 'Credits for photographs, maps, forecasts and wildlife information. External sources checked on 21 September 2026.'),
};

function photoRowHTML(lang, p) {
  const [w, h] = photoDims(p.id);
  return `
  <li class="ika-source-photo${p.own ? ' ika-source-photo--own' : ''}" id="photo-${p.id}">
    <a class="ika-source-thumb" href="${pageHref('gallery', lang)}?photo=${p.id}"><img src="${assetHref(p.thumb ?? p.file)}" alt="" width="${w}" height="${h}" loading="lazy" decoding="async" /></a>
    <div class="ika-source-text">
      <h3>${t(lang, p.title)}${p.own ? `<span class="ika-tag ika-tag--sea">${t(lang, '部員の写真', 'Our photo')}</span>` : ''}</h3>
      <p>${t(lang, p.caption)}</p>
      ${creditHTML(lang, p)}
    </div>
  </li>`;
}

export function render(lang) {
  const own = photos.filter((p) => p.own);
  const cc = photos.filter((p) => !p.own);
  const info = infoSources.map(([name, href]) => `<li><a href="${esc(href)}" target="_blank" rel="noopener">${esc(t(lang, name))} ↗</a></li>`).join('');
  const sp = species.map((s) => `<li><a href="${esc(s.source)}" target="_blank" rel="noopener">${t(lang, s.name)} <i lang="la">${esc(s.latin)}</i> ↗</a></li>`).join('');
  const spotLinks = spots
    .map((s) => `<li><strong>${t(lang, s.name)}</strong>: ${s.links.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join(' ／ ')}</li>`)
    .join('');

  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-sources-section">
    <div class="wrap">
      ${sectionHead(lang, { num: 'PHOTO', en: 'OUR OWN PHOTOGRAPHS', title: pair('部員の写真', 'Our own photographs'), note: pair('YAMAGUCHI FISHING JOURNAL の釣果記録・Vlog から。転載はご遠慮ください。', 'From the YAMAGUCHI FISHING JOURNAL fishing log and vlogs. Please do not reuse without permission.') })}
      <ul class="ika-source-photos">${own.map((p) => photoRowHTML(lang, p)).join('')}</ul>

      ${sectionHead(lang, { num: 'CC', en: 'OPENLY LICENSED PHOTOGRAPHS', title: pair('公開ライセンスの写真', 'Openly licensed photographs'), note: pair('ウィキメディア・コモンズなどから、ライセンスの条件に従って使用。画像自体は改変せず、画面表示では枠に合わせて一部をトリミングしています。', 'Used from Wikimedia Commons and similar sources under their licence terms. Original files are unaltered; display frames may crop the edges.') })}
      <ul class="ika-source-photos">${cc.map((p) => photoRowHTML(lang, p)).join('')}</ul>
    </div>
  </section>

  <section class="ika-section ika-section--tint">
    <div class="wrap">
      ${sectionHead(lang, { num: 'DATA', en: 'MAPS, FORECASTS & WILDLIFE', title: pair('地図・海況・生きもの', 'Maps, forecasts and wildlife') })}
      <div class="ika-source-cols">
        <div>
          <h3 class="ika-h3-small">${t(lang, '地図と海況', 'Maps and sea conditions')}</h3>
          <ul class="ika-source-list">${info}
            <li><a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noopener">Open-Meteo Marine ↗</a></li>
            <li><a href="https://www.data.jma.go.jp/kaiyou/db/tide/suisan/index.php" target="_blank" rel="noopener">${t(lang, '気象庁 潮位表', 'JMA tide tables')} ↗</a></li>
          </ul>
          <h3 class="ika-h3-small">${t(lang, '山口マップの掲載先', 'Map listings')}</h3>
          <ul class="ika-source-list">${spotLinks}</ul>
        </div>
        <div>
          <h3 class="ika-h3-small">${t(lang, '世界のイカ図鑑', 'Squid atlas')}</h3>
          <ul class="ika-source-list">${sp}</ul>
        </div>
      </div>
    </div>
  </section>

  <section class="ika-section">
    <div class="wrap ika-source-notes">
      ${sectionHead(lang, { num: 'NOTE', en: 'ABOUT THIS SITE', title: pair('このサイトについて', 'About this site') })}
      <dl class="ika-source-dl">
        <div><dt>${t(lang, 'キャラクターとイラスト', 'Character and illustrations')}</dt><dd>${t(lang, 'ロゴのイカ、HEROの夜の海、スタンプ案は AI 生成をもとに部で整えたもの。写真ではありません。', 'The logo squid, the night-sea hero scene and the sticker concepts were developed by the club from AI-generated drafts. They are not photographs.')}</dd></div>
        <div><dt>${t(lang, 'Open-Meteo の利用条件', 'Open-Meteo terms')}</dt><dd>${t(lang, '天気・風・波は Open-Meteo の無料（非商用）API で取得しています。イカ部で物販などを始める前に、利用契約を見直します。', 'Weather, wind and waves come from Open-Meteo’s free, non-commercial API. Before the club sells anything, the service plan will be reviewed.')}</dd></div>
        <div><dt>${t(lang, '釣り場について', 'Fishing locations')}</dt><dd>${t(lang, '地図のピンはエリアの目安で、釣りの許可や立ち入りの可否を示しません。部員の釣果写真も釣り場は非公開です。', 'Map pins mark approximate areas and say nothing about permission or access. Member catch photos never disclose the spot.')}</dd></div>
        <div><dt>${t(lang, '掲示板の投稿', 'Board posts')}</dt><dd>${t(lang, '「現地の声」の投稿は投稿者のものです。不適切な投稿は各カードのボタンから知らせてください。', 'Field reports belong to the people who post them. Use the button on each card to report an inappropriate post.')}</dd></div>
      </dl>
      <p class="ika-more"><a href="${pageHref('index', lang)}">${t(lang, 'イカ部トップへ →', 'Back to the club home →')}</a></p>
    </div>
  </section>`;
}

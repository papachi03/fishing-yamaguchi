// sea：風と波。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 生きた数字（天気・潮）はブラウザで pages/sea.js が YFJ の海況ロジックで入れる。
// ここには「何を見ているか」の説明・安全の注意・出典を最初から書いておく（検索エンジンに空に見えないように）。
import { t, pair, esc, pageHref, assetHref } from '../i18n.js';
import { areas } from '../../data/areas.js';
import { SEA_PROFILES, SAFETY_LEVELS } from '../../api/safety.js';
import { pageHead, noteHTML, sectionHead } from './parts.js';

export const HEAD = {
  num: '02',
  eyebrow: 'WIND & WAVES',
  title: pair('今日の海は、いかが？', "How's the sea today?"),
  desc: pair('萩・長門・下関・下松・防府の風と波。ジャーナル本編の海況（天気・潮・安全の目安）を、そのまま部室から。', 'Wind and waves for Hagi, Nagato, Shimonoseki, Kudamatsu and Hofu. The journal’s sea page (weather, tide and a safety guide), viewed from the clubroom.'),
};

const AREA_EN = { hagi: 'Hagi', nagato: 'Nagato', shimonoseki: 'Shimonoseki', kudamatsu: 'Kudamatsu', hofu: 'Hofu' };
const SIDE = { nihonkai: pair('日本海側', 'Sea of Japan side'), setouchi: pair('瀬戸内側', 'Seto Inland Sea side') };

// エリア切替（ビルド時に書く。pages/sea.js がハッシュに合わせて active を付け替える）
export function areaToggleHTML(lang, current = 'hagi') {
  return areas
    .map(
      (a) => `<button type="button" role="tab" data-area="${a.id}" aria-selected="${String(a.id === current)}" class="ika-sea-tab${a.id === current ? ' is-active' : ''}">
        <span class="ika-sea-tab-en">${a.nameEn}</span><span class="ika-sea-tab-ja" lang="ja">${a.nameJa}</span>
      </button>`
    )
    .join('');
}

function safetyTableHTML(lang) {
  const rows = SAFETY_LEVELS.map(
    (l) => `
      <li class="ika-sea-level lv${l.level}">
        <span class="ika-sea-level-badge">${lang === 'en' ? l.labelEn : l.label}</span>
        <span>${lang === 'en' ? l.messageEn : l.message}</span>
      </li>`
  ).join('');
  const thresholds = Object.entries(SEA_PROFILES)
    .map(([key, pf]) => {
      const [w1, w2, w3] = pf.wind;
      const [h1, h2, h3] = pf.wave;
      return `
      <li>
        <strong>${t(lang, SIDE[key])}</strong>${pf.provisional ? `<em>${t(lang, '暫定', 'provisional')}</em>` : ''}
        <span>${t(lang, `風速 〜${w1} 安全 / ${w1}〜${w2} 注意 / ${w2}〜${w3} 危険 / ${w3}〜 中止`, `Wind up to ${w1} safe / ${w1}–${w2} caution / ${w2}–${w3} danger / ${w3}+ stop`)}</span>
        <span>${t(lang, `突風 ${pf.gust[0]}〜 注意 / ${pf.gust[1]}〜 危険 ・ 波高 ${h1.toFixed(1)} / ${h2.toFixed(1)} / ${h3.toFixed(1)}m`, `Gust ${pf.gust[0]}+ caution / ${pf.gust[1]}+ danger ・ Wave ${h1.toFixed(1)} / ${h2.toFixed(1)} / ${h3.toFixed(1)} m`)}</span>
      </li>`;
    })
    .join('');
  return `
  <ul class="ika-sea-levels">${rows}</ul>
  <ul class="ika-sea-thresholds">${thresholds}</ul>`;
}

export function render(lang) {
  const areaList = areas
    .map((a) => `<li><strong>${a.nameEn}</strong> <span>${t(lang, a.nameJa, AREA_EN[a.id])}</span> — ${t(lang, SIDE[a.seaProfile])}${a.contributor ? `<small>${t(lang, '友人・視聴者の海（場所は伏せています）', 'A friend’s or viewer’s waters (location kept private)')}</small>` : ''}</li>`)
    .join('');

  const guide = [
    { k: 'Wind', title: pair('風速・突風', 'Wind & gust'), body: pair('m/s（秒速）。堤防で一番効く数字。予報値は体感より弱く出るので、しきい値の側で織り込んであります。矢印は風の流れる向き。', 'In m/s. The number that matters most on a breakwater. Forecasts read weaker than it feels, so the thresholds already allow for that. Arrows show where the wind flows to.') },
    { k: 'Wave', title: pair('波高・周期', 'Wave height & period'), body: pair('波の高さ（m）と、波と波の間隔（秒）。周期が長い（7秒〜）のに波が高い日は、うねりが堤防を洗います。', 'Height in metres and the interval between waves in seconds. Long periods (7 s+) with tall waves mean swell washing over the breakwater.') },
    { k: 'Tide', title: pair('潮汐', 'Tide'), body: pair('気象庁の潮位表から、その日の満潮・干潮と1時間ごとの潮位。イカは潮が動く時間帯に口を使いやすい、というのが部の経験則。', 'High and low tides and hourly levels from JMA tide tables. Club experience: squid feed more readily when the tide is moving.') },
    { k: 'Bite', title: pair('期待値（10段階）', 'Bite expectation (out of 10)'), body: pair('潮の動き・まずめ（朝夕の薄明かり）・潮回りから出す、ジャーナル独自の目安。釣果を約束するものではありません。', 'The journal’s own guide, from tide flow, twilight (mazume) and tide type. It does not promise a catch.') },
  ]
    .map((g) => `<li class="ika-sea-guide-item"><span class="ika-sea-guide-key">${g.k}</span><h3>${t(lang, g.title)}</h3><p>${t(lang, g.body)}</p></li>`)
    .join('');

  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-sea-section">
    <div class="wrap">
      <div class="ika-sea-toggle" role="tablist" aria-label="${t(lang, 'エリア切り替え', 'Choose an area')}" id="ika-area-toggle">${areaToggleHTML(lang)}</div>
      <!-- 生きた海況（ブラウザで pages/sea.js が YFJ の sea-render で描く） -->
      <div class="ika-sea-dash sea-dash" id="ika-sea-dash" aria-live="polite">
        <p class="sea-error">${t(lang, '海況を取得しています…', 'Loading sea conditions…')}</p>
      </div>
      <div id="ika-sea-reports"></div>
      <p class="ika-sea-source" id="ika-sea-source">${t(lang, '天気・風: MET Norway（補正あり）・気象庁 ／ 波: NOAA WaveWatch III・気象庁 ／ 潮汐: 気象庁 潮位表 ／ このページは釣行判断の参考情報です。警報・注意報は必ず気象庁の発表を確認してください。', 'Weather and wind: MET Norway (corrected) and JMA / Waves: NOAA WaveWatch III and JMA / Tide: JMA tide tables / This page is reference information for planning a trip. Always check official JMA warnings and advisories.')}</p>
    </div>
  </section>

  <section class="ika-section ika-section--tint ika-sea-guide-section">
    <div class="wrap">
      ${sectionHead(lang, { num: 'READ', en: 'HOW TO READ THE NUMBERS', title: pair('数字の読み方', 'How to read the numbers'), note: pair('ジャーナル本編と同じ仕組み・同じ基準。5つのエリアは、部員が実際に通っている海と、友人・視聴者の海です。', 'Same system and thresholds as the main journal. The five areas are waters our members actually fish, plus a friend’s and a viewer’s.') })}
      <ul class="ika-sea-guide">${guide}</ul>

      <h3 class="ika-sea-h3">${t(lang, '堤防の安全判定', 'Breakwater safety levels')}</h3>
      <p class="ika-sea-p">${t(lang, '風速・突風・波高・風向から4段階で出します。海に向かって吹く風（向かい風）は波が立つので1段階上げ、長い周期のうねりも1段階上げます。', 'Four levels from wind, gust, wave height and wind direction. An onshore wind (blowing from the sea) builds waves, so it raises the level by one; so does long-period swell.')}</p>
      ${safetyTableHTML(lang)}

      <h3 class="ika-sea-h3">${t(lang, '5つのエリア', 'The five areas')}</h3>
      <ul class="ika-sea-areas">${areaList}</ul>

      ${noteHTML(lang, {
        label: pair('海に出る前に', 'Before you go'),
        tone: 'orange',
        html: `<p>${t(
          lang,
          'ここに出る数字は予報です。気象庁の警報・注意報が出ている時はそちらが優先。堤防ではライフジャケットを着け、波をかぶる場所には立たないでください。釣れなくても部員です。',
          'Everything here is a forecast. JMA warnings and advisories always come first. Wear a life jacket on the breakwater and stay off anywhere waves can reach. No catch? Still a member.'
        )}</p>`,
      })}

      <div class="ika-sea-sources">
        <p class="ika-sea-sources-head">${t(lang, 'データの出どころ', 'Data sources')}</p>
        <ul>
          <li><a href="https://api.met.no/weatherapi/locationforecast/2.0/documentation" target="_blank" rel="noopener">MET Norway ↗</a> ／ <a href="https://www.jma.go.jp/bosai/" target="_blank" rel="noopener">${t(lang, '気象庁', 'JMA')} ↗</a> — ${t(lang, '天気・風（地域ごとに補正し、気象庁の地域時系列予報と強いほう）・降水確率・注意報・警報、アメダスの実測', 'weather and wind (corrected for each area, the stronger of that and JMA’s regional forecast), rain chance, advisories and warnings, AMeDAS observations')}</li>
          <li><a href="https://www.pacioos.hawaii.edu/waves/model-global/" target="_blank" rel="noopener">NOAA WaveWatch III ↗</a> — ${t(lang, '波高（瀬戸内は気象庁の予報）', 'wave height (JMA forecasts for the Seto Inland Sea)')}</li>
          <li><a href="https://www.data.jma.go.jp/kaiyou/db/tide/suisan/index.php" target="_blank" rel="noopener">${t(lang, '気象庁 潮位表 ↗', 'JMA tide tables ↗')}</a> — ${t(lang, '満潮・干潮と毎時潮位（萩・仙崎は共用の観測点）', 'high and low tides and hourly levels (Hagi and Nagato share one station)')}</li>
          <li><a href="${assetHref('/sea.html')}">${t(lang, 'ジャーナル本編の海況ページ →', 'The journal’s own sea page →')}</a> — ${t(lang, '同じ数字を、ジャーナルの見た目で', 'the same numbers in the journal’s style')}</li>
        </ul>
        ${lang === 'en' ? `<p class="ika-small">Field reports are shown as posted (names and comments are not translated). Individual spot names stay in Japanese.</p>` : ''}
      </div>
    </div>
  </section>`;
}

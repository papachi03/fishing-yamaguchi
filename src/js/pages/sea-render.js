// SEAページのダッシュボードHTMLを組み立てる部分。
//
// ブラウザ（sea.js）と、ビルド時の事前描画（scripts/prerender-sea.mjs）の両方から使う。
// そのため document / window / location には触らないこと（Node上でも動く純粋な関数だけにする）。
//
// なぜ事前描画するのか（2026-09-14）:
//   以前はHTMLに「取得しています…」の1行しか無く、中身はすべてページを開いた後に
//   Open-Meteo から取っていた。Googlebot のクロール環境ではこの取得が失敗し、
//   ページ全体が「取得できませんでした」の1行になって「ソフト404」と判定され、
//   検索に一切出なかった。今はビルド時に取得した予報をHTMLに書き込んでおき、
//   開いた人のブラウザで最新の予報に差し替える。
//
// 言語（2026-09-24）:
//   イカ部の英語ページ（/ikabu/en/sea.html）からは lang='en' で呼ぶ。省略時は 'ja' で、
//   YFJ 本体（sea.html・prerender-sea）の出力は1文字も変わらない（test/sea-render.test.mjs で固定）。
//   文言はすべて下の T にまとめ、描画の関数はそこから引くだけにしてある。

import { describeWeather, windDirection } from '../api/weather.js';
import { calcExpectation, seasonalTargets } from '../api/fishing.js';
import {
  assessSafety,
  windLevel,
  gustLevel,
  waveLevel,
  isOnshore,
  legendText,
  profileOf,
} from '../api/safety.js';

const fmt1 = (v) => (v == null ? '—' : v.toFixed(1));
const fmt0 = (v) => (v == null ? '—' : String(Math.round(v)));
const pad2 = (n) => String(n).padStart(2, '0');

export const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

// 画面の文言。ja は従来の文字列そのまま（変えると YFJ の見た目が変わる）
const T = {
  ja: {
    compassLabel: (dir) => `風向 ${dir}`,
    tideChartLabel: (station) => `${station}の潮位の推移（気象庁の予測値）`,
    biteHead: 'Bite — 今の期待値',
    biteSpot: (spot, exp) => `${spot} / ${exp.tideName}・月齢${exp.moonAge.toFixed(1)}`,
    starsLabel: (n) => `10段階中${n}`,
    barFlow: '潮の動き', barSun: 'まずめ', barRange: '潮回り',
    sunNote: (rise, set) => `日出 ${rise} / 日入 ${set} —\n        潮の動き・まずめ・潮回りから算出した独自の目安です（実釣を保証するものではありません）。`,
    safetyFallback: (wind, wave) => `風速${wind}m/s・波高${wave}m`,
    onshore: ' ／ 海からの風',
    reasonSep: ' ／ ',
    legend: (legend, pfLabel, provisional) => `${legend}（${pfLabel}の基準）。気象庁の注意報・警報が出ている時はそちらを優先${provisional ? ' ／ この海域のしきい値は暫定です' : ''}`,
    legendFeel: '数字は予報値です。海の上では<strong>+2m/sほど強く感じます</strong>（表示5m ≒ 体感7〜8m）。上のしきい値はその体感を織り込んであります',
    seasonHead: 'In Season — 今月の旬',
    seasonMonth: (m) => `${m}月 / 堤防釣りの一般的な目安`,
    tideHead: 'Tide — 潮汐',
    tideStation: (name, proxy) => `観測地点: ${name}${proxy ? '（付近に専用の観測地点が無いため共用）' : ''}`,
    tideHigh: '満潮 ', tideLow: '干潮 ',
    tideSource: (src) => `出典: ${src}`,
    popMax: (v) => `降水確率 最大 ${v}%`,
    hiLo: (h, l) => `H ${h}° / L ${l}°`,
    windDir: (dir) => `${dir.en}（${dir.ja}）`,
    gust: '突風',
    wavePeriod: (p) => `周期 ${p}秒`,
    waveHeight: '波高',
    hourlyHead: 'Hourly — 時間別',
    thTime: '時刻', thWeather: '天気', thTemp: '気温 °C', thPop: '降水 %', thWind: '風 m/s', thGust: '突風 m/s', thWave: '波高 m',
    areaSub: (area) => `${area.nameJa}の海`,
    noWeather: '天気・風・波の予報を取得できませんでした。時間をおいて開き直してください。潮汐と基準は下に表示しています。',
    sourceNote: (area, t) => {
      // 視聴者の方の釣り場（contributor 付き）は場所が特定できないよう座標を出さない
      const coordNote = area.contributor ? '' : ` / 座標 ${area.lat.toFixed(3)}, ${area.lon.toFixed(3)}`;
      const tideNote = t ? ` / 潮汐: 気象庁 潮位表（${t.stationName}）` : '';
      return `天気・風: Open-Meteo${tideNote}${coordNote} / このページは釣行判断の参考情報です。警報・注意報は必ず気象庁の発表を確認してください。`;
    },
  },
  en: {
    compassLabel: (dir) => `Wind direction ${dir}`,
    tideChartLabel: (station) => `Tide level at ${station} (JMA prediction)`,
    biteHead: 'Bite — expectation right now',
    biteSpot: (spot, exp) => `${spot} / ${exp.tideName} · moon age ${exp.moonAge.toFixed(1)}`,
    starsLabel: (n) => `${n} out of 10`,
    barFlow: 'Tide flow', barSun: 'Twilight', barRange: 'Tide type',
    sunNote: (rise, set) => `Sunrise ${rise} / Sunset ${set} —\n        Our own estimate from tide flow, twilight and tide type. It does not guarantee a catch.`,
    safetyFallback: (wind, wave) => `wind ${wind} m/s · waves ${wave} m`,
    onshore: ' / onshore wind',
    reasonSep: ' / ',
    legend: (legend, pfLabel, provisional) => `${legend} (${pfLabel} thresholds). JMA advisories and warnings always take precedence${provisional ? ' / thresholds for this area are provisional' : ''}`,
    legendFeel: 'Numbers are forecast values. On the water the wind <strong>feels about 2 m/s stronger</strong> (5 m/s shown ≈ 7–8 m/s felt). The thresholds above already allow for that',
    seasonHead: 'In season — this month',
    seasonMonth: (m) => `Month ${m} / general guide for breakwater fishing`,
    tideHead: 'Tide',
    tideStation: (name, proxy) => `Station: ${name}${proxy ? ' (nearest station, shared)' : ''}`,
    tideHigh: 'High ', tideLow: 'Low ',
    tideSource: (src) => `Source: ${src}`,
    popMax: (v) => `Rain chance up to ${v}%`,
    hiLo: (h, l) => `H ${h}° / L ${l}°`,
    windDir: (dir) => dir.en,
    gust: 'Gust',
    wavePeriod: (p) => `Period ${p} s`,
    waveHeight: 'Wave height',
    hourlyHead: 'Hourly — next 24 hours',
    thTime: 'Time', thWeather: 'Weather', thTemp: 'Temp °C', thPop: 'Rain %', thWind: 'Wind m/s', thGust: 'Gust m/s', thWave: 'Wave m',
    areaSub: (area) => `${area.nameRoman ?? area.nameEn} coast`,
    noWeather: 'The weather, wind and wave forecast could not be loaded. Please try again later. Tide and safety thresholds are shown below.',
    sourceNote: (area, t) => {
      const coordNote = area.contributor ? '' : ` / ${area.lat.toFixed(3)}, ${area.lon.toFixed(3)}`;
      const tideNote = t ? ` / Tide: JMA tide tables (${t.stationNameEn ?? t.stationName})` : '';
      return `Weather and wind: Open-Meteo${tideNote}${coordNote} / Reference information for planning a trip. Always check official JMA warnings and advisories.`;
    },
  },
};
const textOf = (lang) => T[lang] ?? T.ja;

// 日本語では観測地点名・釣り場名・出典をそのまま、英語では en の名前を使う
const stationName = (t, lang) => (lang === 'en' ? t.stationNameEn ?? t.stationName : t.stationName);
const tideSource = (t, lang) => (lang === 'en' ? t.sourceEn ?? t.source : t.source);
const homeSpotName = (area, lang) => (lang === 'en' ? area.homeSpot?.nameEn ?? area.homeSpot?.name ?? area.nameRoman ?? area.nameEn : area.homeSpot?.name ?? area.nameJa);

function arrow(deg) {
  // 風の流れの向き（deg+180）に矢印を回す
  const rot = deg == null ? 0 : Math.round(deg + 180);
  return `<span class="arrow" style="transform: rotate(${rot}deg)" aria-hidden="true">↑</span>`;
}

function bigCompass(deg, dirText, lang) {
  const to = deg == null ? 0 : deg + 180;
  return `
  <svg viewBox="0 0 120 120" width="96" height="96" role="img" aria-label="${textOf(lang).compassLabel(dirText)}">
    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(32,35,42,.25)" stroke-width="1.5"/>
    <circle cx="60" cy="60" r="3" fill="rgba(32,35,42,.4)"/>
    ${['N', 'E', 'S', 'W']
      .map((d, i) => {
        const a = (i * Math.PI) / 2 - Math.PI / 2;
        const x = 60 + Math.cos(a) * 44, y = 60 + Math.sin(a) * 44;
        return `<text x="${x}" y="${y + 3.5}" text-anchor="middle" style="font:10px 'IBM Plex Mono',monospace;fill:rgba(32,35,42,.5)">${d}</text>`;
      })
      .join('')}
    <g transform="rotate(${to} 60 60)">
      <path d="M60 16 L70 66 L60 57 L50 66 Z" fill="#2f6b66"/>
    </g>
  </svg>`;
}

// "HH:MM" → 小数の時（9:30 → 9.5）
const hhmmToHour = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h + m / 60;
};

function tideChartSVG(tide, now, lang) {
  const W = 720, H = 200, padL = 40, padR = 14, padT = 26, padB = 26;
  const levels = tide.curve.map((p) => p.level);
  const min = Math.min(...levels) - 15, max = Math.max(...levels) + 15;
  const x = (h) => padL + ((W - padL - padR) * h) / 24;
  const y = (lv) => padT + (H - padT - padB) * (1 - (lv - min) / (max - min));
  const pts = tide.curve.map((p) => `${x(p.hour).toFixed(1)},${y(p.level).toFixed(1)}`);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const gridHours = [0, 6, 12, 18, 24];

  // 満潮・干潮の位置に点と時刻・潮位を打つ
  const peak = (p, kind) => {
    const hx = x(hhmmToHour(p.time));
    const hy = y(p.level);
    // 端で見切れないようラベルを内側に寄せる
    const anchor = hx < 70 ? 'start' : hx > W - 70 ? 'end' : 'middle';
    const labelY = kind === 'high' ? hy - 10 : hy + 17;
    return `
      <circle class="peak-dot ${kind === 'low' ? 'low' : ''}" cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="3.5"/>
      <text class="peak-label" x="${hx.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}">${p.time} ${p.level}cm</text>`;
  };

  // 現在の潮位（曲線上の点）
  const nowLevel = tide.curve.reduce((best, p) =>
    Math.abs(p.hour - nowH) < Math.abs(best.hour - nowH) ? p : best
  );

  return `
  <svg class="tide-chart" viewBox="0 0 ${W} ${H}" role="img"
       aria-label="${textOf(lang).tideChartLabel(stationName(tide, lang))}">
    ${gridHours
      .map(
        (h) => `<line class="axis" x1="${x(h)}" y1="${padT}" x2="${x(h)}" y2="${H - padB}"/>
                <text x="${x(h)}" y="${H - 8}" text-anchor="middle">${pad2(h)}:00</text>`
      )
      .join('')}
    <polygon class="fill" points="${x(0)},${H - padB} ${pts.join(' ')} ${x(24)},${H - padB}"/>
    <polyline class="curve" points="${pts.join(' ')}"/>
    <line class="nowline" x1="${x(nowH)}" y1="${padT}" x2="${x(nowH)}" y2="${H - padB}"/>
    <circle class="now-dot" cx="${x(nowH).toFixed(1)}" cy="${y(nowLevel.level).toFixed(1)}" r="4.5"/>
    ${tide.highs.map((p) => peak(p, 'high')).join('')}
    ${tide.lows.map((p) => peak(p, 'low')).join('')}
    <text x="${padL - 6}" y="${y(max - 15) + 3}" text-anchor="end">${Math.round(max - 15)}cm</text>
    <text x="${padL - 6}" y="${y(min + 15) + 3}" text-anchor="end">${Math.round(min + 15)}cm</text>
  </svg>`;
}

// ★10段階の期待値パネル
function bitePanelHTML(area, exp, lang) {
  if (!exp) return '';
  const L = textOf(lang);

  const stars =
    '★'.repeat(exp.stars) +
    `<span class="off">${'☆'.repeat(10 - exp.stars)}</span>`;

  // 内訳（calcExpectationと同じ配点）を再現して見せる
  const bar = (label, value, maxValue) => `
    <div class="bite-bar-row">
      <span>${label}</span>
      <span class="bite-bar"><i style="width:${((value / maxValue) * 100).toFixed(0)}%"></i></span>
      <span class="val">${value.toFixed(1)}/${maxValue}</span>
    </div>`;

  const fmtTime = (d) => (d ? hhmm(d) : '—');

  return `
    <div class="bite-panel reveal">
      <div class="bite-head">
        <h3>${L.biteHead}</h3>
        <span class="bite-spot">${L.biteSpot(homeSpotName(area, lang), exp)}</span>
      </div>
      <p class="bite-stars" role="img" aria-label="${L.starsLabel(exp.stars)}">${stars}</p>
      <p class="bite-score">${exp.score.toFixed(1)} / 10</p>
      <p class="bite-message">${exp.message}</p>
      <div class="bite-reasons">${exp.reasons.map((r) => `<span>${r}</span>`).join('')}</div>
      <div class="bite-breakdown">
        ${bar(L.barFlow, exp.breakdown.flow, 6)}
        ${bar(L.barSun, exp.breakdown.sun, 2)}
        ${bar(L.barRange, exp.breakdown.range, 2)}
      </div>
      <p class="source-note" style="margin-top:16px;">
        ${L.sunNote(fmtTime(exp.sunrise), fmtTime(exp.sunset))}
      </p>
    </div>`;
}

// 堤防の安全判定（風速・突風・波高・風向）
function safetyBandHTML(area, w, lang) {
  const L = textOf(lang);
  const s = assessSafety({
    wind: w.current.wind,
    gust: w.current.gust,
    waveHeight: w.current.wave,
    wavePeriod: w.current.wavePeriod,
    windDir: w.current.windDir,
    facing: area.facing,
    seaProfile: area.seaProfile,
    lang,
  });
  const onshore = isOnshore(w.current.windDir, area.facing);
  const pf = profileOf(area.seaProfile);
  return `
    <div class="safety-band lv${s.level} reveal" role="status">
      <div class="safety-main">
        <span class="safety-badge">${s.label}</span>
        <p class="safety-msg">${s.message}</p>
      </div>
      <p class="safety-reasons t-mono">${
        s.reasons.length ? s.reasons.join(L.reasonSep) : L.safetyFallback(fmt1(w.current.wind), fmt1(w.current.wave))
      }${onshore && w.current.wind < pf.wind[0] ? L.onshore : ''}</p>
      ${safetyLegendHTML(area, lang)}
    </div>`;
}

// 安全判定の基準（予報が取れなくても表示できる部分）
function safetyLegendHTML(area, lang) {
  const L = textOf(lang);
  const pf = profileOf(area.seaProfile);
  const pfLabel = lang === 'en' ? pf.labelEn ?? pf.label : pf.label;
  return `
      <p class="safety-legend t-mono">${L.legend(legendText(area.seaProfile, lang), pfLabel, pf.provisional)}</p>
      <p class="safety-legend t-mono">${L.legendFeel}</p>`;
}

// 今月の旬（魚・イカ）
function seasonPanelHTML(now, lang) {
  const L = textOf(lang);
  const s = seasonalTargets(now, lang);
  const tag = (list, cls = '') =>
    `<dd class="season-tags ${cls}">${list.map((n) => `<span>${n}</span>`).join('')}</dd>`;

  return `
    <div class="season-panel reveal">
      <div class="season-head">
        <h3>${L.seasonHead}</h3>
        <span class="season-month">${L.seasonMonth(s.month)}</span>
      </div>
      <dl class="season-groups">
        <div class="season-group"><dt>Fish</dt>${tag(s.fish)}</div>
        <div class="season-group"><dt>Squid</dt>${tag(s.squid, 'squid')}</div>
      </dl>
    </div>`;
}

function tidePanelHTML(t, now, lang) {
  const L = textOf(lang);
  return `
    <div class="tide-panel reveal">
      <div class="tide-panel-head">
        <h3>${L.tideHead}</h3>
        <span class="bite-spot">${L.tideStation(stationName(t, lang), t.isProxy)}</span>
      </div>
      ${tideChartSVG(t, now, lang)}
      <div class="tide-times">
        <span><span class="k">High</span>${L.tideHigh}${t.highs
          .map((h) => `<b>${h.time}</b> ${h.level}cm`)
          .join(' / ')}</span>
        <span><span class="k">Low</span>${L.tideLow}${t.lows
          .map((h) => `<b>${h.time}</b> ${h.level}cm`)
          .join(' / ')}</span>
      </div>
      <p class="source-note" style="margin-top: 12px;">${L.tideSource(tideSource(t, lang))}</p>
    </div>`;
}

function weatherHTML(area, w, now, updatedLabel, lang) {
  const L = textOf(lang);
  const cond = describeWeather(w.current.code, lang);
  const dir = windDirection(w.current.windDir);

  // 直近24時間（現在時刻の1時間前から）。予報が古くて「今」を含まない場合は先頭から
  const idx = w.hourly.findIndex((h) => new Date(h.time) >= now);
  const startIdx = Math.max(0, idx - 1);
  const hours = w.hourly.slice(startIdx, startIdx + 24);
  const today = w.daily[0];
  // 時間別の天気は日本語では4文字まで（列幅の都合）。英語は短い1語にそろえてある
  const cell = (code) => (lang === 'en' ? describeWeather(code, lang).text : describeWeather(code).ja.slice(0, 4));

  return `
      <dl class="dash-now">
        <div><dt>Weather</dt><dd style="font-family:var(--font-mincho);font-size:clamp(18px,2.2vw,24px);">${cond.text}<span class="sub t-mono">${L.popMax(fmt0(today?.popMax))}</span></dd></div>
        <div><dt>Temp</dt><dd>${fmt1(w.current.temp)}<small>°C</small><span class="sub t-mono">${L.hiLo(fmt0(today?.tMax), fmt0(today?.tMin))}</span></dd></div>
        <div><dt>Wind</dt><dd>${fmt1(w.current.wind)}<small>m/s</small><span class="sub t-mono">${L.windDir(dir)}</span></dd></div>
        <div><dt>Gust</dt><dd>${fmt1(w.current.gust)}<small>m/s</small><span class="sub t-mono">${L.gust}</span></dd></div>
        <div><dt>Wave</dt><dd>${fmt1(w.current.wave)}<small>m</small><span class="sub t-mono">${w.current.wavePeriod != null ? L.wavePeriod(fmt0(w.current.wavePeriod)) : L.waveHeight}</span></dd></div>
        <div style="display:grid;place-items:center;">${bigCompass(dir.deg, lang === 'en' ? dir.en : dir.ja, lang)}</div>
      </dl>
    </div>

    ${safetyBandHTML(area, w, lang)}
    __BITE__
    <div class="reveal">
      <h3 class="t-label" style="margin-bottom: 12px;">${L.hourlyHead}</h3>
      <div class="hourly-scroll">
        <table class="hourly-table">
          <thead>
            <tr><th>${L.thTime}</th>${hours.map((h) => {
              const d = new Date(h.time);
              const isNow = d.getHours() === now.getHours() && d.getDate() === now.getDate();
              return `<th ${isNow ? 'class="now-col"' : ''}>${pad2(d.getHours())}</th>`;
            }).join('')}</tr>
          </thead>
          <tbody>
            <tr><th>${L.thWeather}</th>${hours.map((h) => `<td>${cell(h.code)}</td>`).join('')}</tr>
            <tr><th>${L.thTemp}</th>${hours.map((h) => `<td>${fmt0(h.temp)}</td>`).join('')}</tr>
            <tr><th>${L.thPop}</th>${hours.map((h) => `<td>${fmt0(h.pop)}</td>`).join('')}</tr>
            <tr><th>${L.thWind}</th>${hours.map((h) => `<td class="lv${windLevel(h.wind, area.seaProfile)}">${arrow(h.windDir)} ${fmt1(h.wind)}</td>`).join('')}</tr>
            <tr><th>${L.thGust}</th>${hours.map((h) => `<td class="lv${gustLevel(h.gust, area.seaProfile)}">${fmt1(h.gust)}</td>`).join('')}</tr>
            <tr><th>${L.thWave}</th>${hours.map((h) => `<td class="lv${waveLevel(h.wave, area.seaProfile)}">${fmt1(h.wave)}</td>`).join('')}</tr>
          </tbody>
        </table>
      </div>
    </div>`;
}

/**
 * ダッシュボード全体のHTML。
 *   w: 天気（null なら天気・風・波の欄を省き、取得できなかった旨を出す）
 *   t: 潮汐（null なら潮汐と期待値を省く）
 *   updatedLabel: 見出し右の「いつ時点の予報か」
 *   notice: 見出しの下に出す注意書き（古い予報を出しているとき等）
 *   lang: 'ja'（既定）か 'en'
 * 潮汐・今月の旬・安全基準は、天気が取れなくても必ず出す。
 */
export function dashHTML({ area, w, t, now, updatedLabel, notice = '', lang = 'ja' }) {
  const L = textOf(lang);
  const exp = t ? calcExpectation(area, t, now, lang) : null;

  const head = `
    <div class="reveal">
      <div class="sea-strip-head" style="margin-bottom: 14px;">
        <h2 class="t-display" style="font-size: clamp(30px,4.4vw,52px);">${area.nameEn}<span class="ja t-mincho">${L.areaSub(area)}</span></h2>
        <p class="sea-updated t-mono">${updatedLabel}</p>
      </div>
      ${notice ? `<p class="sea-error" style="margin-bottom:14px;">${notice}</p>` : ''}`;

  const body = w
    ? weatherHTML(area, w, now, updatedLabel, lang).replace('__BITE__', bitePanelHTML(area, exp, lang))
    : `
      <p class="sea-error">${L.noWeather}</p>
    </div>
    <div class="safety-band reveal">${safetyLegendHTML(area, lang)}</div>
    ${bitePanelHTML(area, exp, lang)}`;

  return `${head}${body}
    ${t ? tidePanelHTML(t, now, lang) : ''}
    ${seasonPanelHTML(now, lang)}`;
}

export function sourceNoteText(area, t, lang = 'ja') {
  return textOf(lang).sourceNote(area, t);
}

export function toggleHTML(areas, current) {
  return areas
    .map(
      (a) =>
        `<button role="tab" data-area="${a.id}" aria-selected="${a.id === current}"
        class="${a.id === current ? 'active' : ''}">${a.nameEn}</button>`
    )
    .join('');
}

// HTMLに埋め込む予報は、時間別を「取得時刻から48時間」に絞って軽くする
export function trimWeather(w) {
  const from = Date.now() - 2 * 3600 * 1000;
  const to = from + 50 * 3600 * 1000;
  return {
    ...w,
    hourly: w.hourly.filter((h) => {
      const ts = new Date(h.time).getTime();
      return ts >= from && ts <= to;
    }),
  };
}

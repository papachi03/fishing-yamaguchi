import { mountChrome, mountFooterBottom, initReveal } from '../main.js';
import { areas, areaById } from '../data/areas.js';
import { fetchWeather, describeWeather, windDirection } from '../api/weather.js';
import { fetchTide } from '../api/tide.js';
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

mountChrome('/sea.html');
mountFooterBottom(document.getElementById('footer-mount'));

const dash = document.getElementById('sea-dash');
const toggle = document.getElementById('area-toggle');
const cache = new Map();

const hashId = location.hash.slice(1);
let current = areas.some((a) => a.id === hashId) ? hashId : 'hagi';

toggle.innerHTML = areas
  .map(
    (a) =>
      `<button role="tab" data-area="${a.id}" aria-selected="${a.id === current}"
        class="${a.id === current ? 'active' : ''}">${a.nameEn}</button>`
  )
  .join('');

toggle.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-area]');
  if (!btn) return;
  current = btn.dataset.area;
  history.replaceState(null, '', `#${current}`);
  toggle.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.area === current;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  render();
});

// ページを開いたまま URL のハッシュだけが変わった場合にも切り替える。
// （#hofu を見ている人に #hagi のリンクを送っても何も起きない、という状態を防ぐ）
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (!areas.some((a) => a.id === id) || id === current) return;
  current = id;
  toggle.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.area === current;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  render();
});

const fmt1 = (v) => (v == null ? '—' : v.toFixed(1));
const fmt0 = (v) => (v == null ? '—' : String(Math.round(v)));

function arrow(deg) {
  // 風の流れの向き（deg+180）に矢印を回す
  const rot = deg == null ? 0 : Math.round(deg + 180);
  return `<span class="arrow" style="transform: rotate(${rot}deg)" aria-hidden="true">↑</span>`;
}

function bigCompass(deg, ja) {
  const to = deg == null ? 0 : deg + 180;
  return `
  <svg viewBox="0 0 120 120" width="96" height="96" role="img" aria-label="風向 ${ja}">
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

function tideChartSVG(tide) {
  const W = 720, H = 200, padL = 40, padR = 14, padT = 26, padB = 26;
  const levels = tide.curve.map((p) => p.level);
  const min = Math.min(...levels) - 15, max = Math.max(...levels) + 15;
  const x = (h) => padL + ((W - padL - padR) * h) / 24;
  const y = (lv) => padT + (H - padT - padB) * (1 - (lv - min) / (max - min));
  const pts = tide.curve.map((p) => `${x(p.hour).toFixed(1)},${y(p.level).toFixed(1)}`);
  const now = new Date();
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
       aria-label="${tide.stationName}の潮位の推移（気象庁の予測値）">
    ${gridHours
      .map(
        (h) => `<line class="axis" x1="${x(h)}" y1="${padT}" x2="${x(h)}" y2="${H - padB}"/>
                <text x="${x(h)}" y="${H - 8}" text-anchor="middle">${String(h).padStart(2, '0')}:00</text>`
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
function bitePanelHTML(area, exp) {
  if (!exp) return '';

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

  const fmtTime = (d) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '—';

  return `
    <div class="bite-panel reveal">
      <div class="bite-head">
        <h3>Bite — 今の期待値</h3>
        <span class="bite-spot">${area.homeSpot?.name ?? area.nameJa} / ${exp.tideName}・月齢${exp.moonAge.toFixed(1)}</span>
      </div>
      <p class="bite-stars" role="img" aria-label="10段階中${exp.stars}">${stars}</p>
      <p class="bite-score">${exp.score.toFixed(1)} / 10</p>
      <p class="bite-message">${exp.message}</p>
      <div class="bite-reasons">${exp.reasons.map((r) => `<span>${r}</span>`).join('')}</div>
      <div class="bite-breakdown">
        ${bar('潮の動き', exp.breakdown.flow, 6)}
        ${bar('まずめ', exp.breakdown.sun, 2)}
        ${bar('潮回り', exp.breakdown.range, 2)}
      </div>
      <p class="source-note" style="margin-top:16px;">
        日出 ${fmtTime(exp.sunrise)} / 日入 ${fmtTime(exp.sunset)} —
        潮の動き・まずめ・潮回りから算出した独自の目安です（実釣を保証するものではありません）。
      </p>
    </div>`;
}

// 堤防の安全判定（風速・突風・波高・風向）
function safetyBandHTML(area, w) {
  const s = assessSafety({
    wind: w.current.wind,
    gust: w.current.gust,
    waveHeight: w.current.wave,
    wavePeriod: w.current.wavePeriod,
    windDir: w.current.windDir,
    facing: area.facing,
    seaProfile: area.seaProfile,
  });
  const onshore = isOnshore(w.current.windDir, area.facing);
  const pf = profileOf(area.seaProfile);
  const legend = legendText(area.seaProfile);
  return `
    <div class="safety-band lv${s.level} reveal" role="status">
      <div class="safety-main">
        <span class="safety-badge">${s.label}</span>
        <p class="safety-msg">${s.message}</p>
      </div>
      <p class="safety-reasons t-mono">${
        s.reasons.length ? s.reasons.join(' ／ ') : `風速${fmt1(w.current.wind)}m/s・波高${fmt1(w.current.wave)}m`
      }${onshore && w.current.wind < pf.wind[0] ? ' ／ 海からの風' : ''}</p>
      <p class="safety-legend t-mono">${legend}（${pf.label}の基準）。気象庁の注意報・警報が出ている時はそちらを優先${
        pf.provisional ? ' ／ この海域のしきい値は暫定です' : ''
      }</p>
      <p class="safety-legend t-mono">数字は予報値です。海の上では<strong>+2m/sほど強く感じます</strong>（表示5m ≒ 体感7〜8m）。上のしきい値はその体感を織り込んであります</p>
    </div>`;
}

// 今月の旬（魚・イカ）
function seasonPanelHTML() {
  const s = seasonalTargets();
  const tag = (list, cls = '') =>
    `<dd class="season-tags ${cls}">${list.map((n) => `<span>${n}</span>`).join('')}</dd>`;

  return `
    <div class="season-panel reveal">
      <div class="season-head">
        <h3>In Season — 今月の旬</h3>
        <span class="season-month">${s.month}月 / 堤防釣りの一般的な目安</span>
      </div>
      <dl class="season-groups">
        <div class="season-group"><dt>Fish</dt>${tag(s.fish)}</div>
        <div class="season-group"><dt>Squid</dt>${tag(s.squid, 'squid')}</div>
      </dl>
    </div>`;
}

async function load(areaId) {
  if (cache.has(areaId)) return cache.get(areaId);
  const area = areaById(areaId);
  const [w, t] = await Promise.all([fetchWeather(area), fetchTide(area)]);
  const data = { area, w, t };
  cache.set(areaId, data);
  return data;
}

async function render() {
  dash.innerHTML = '<p class="sea-error">海況を取得しています…</p>';
  let data;
  try {
    data = await load(current);
  } catch {
    dash.innerHTML =
      '<p class="sea-error">海況を取得できませんでした。ネットワーク接続を確認してください。</p>';
    return;
  }
  const { area, w, t } = data;
  const cond = describeWeather(w.current.code);
  const dir = windDirection(w.current.windDir);
  const now = new Date();
  // 期待値は「今」を基準にするので、キャッシュせず描画のたびに計算する
  const exp = calcExpectation(area, t, now);

  // 直近24時間（現在時刻の1時間前から）
  const startIdx = Math.max(
    0,
    w.hourly.findIndex((h) => new Date(h.time) >= now) - 1
  );
  const hours = w.hourly.slice(startIdx, startIdx + 24);
  const today = w.daily[0];

  dash.innerHTML = `
    <div class="reveal">
      <div class="sea-strip-head" style="margin-bottom: 14px;">
        <h2 class="t-display" style="font-size: clamp(30px,4.4vw,52px);">${area.nameEn}<span class="ja t-mincho">${area.nameJa}の海</span></h2>
        <p class="sea-updated t-mono">UPDATED ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} JST</p>
      </div>
      <dl class="dash-now">
        <div><dt>Weather</dt><dd style="font-family:var(--font-mincho);font-size:clamp(18px,2.2vw,24px);">${cond.ja}<span class="sub t-mono">降水確率 最大 ${fmt0(today?.popMax)}%</span></dd></div>
        <div><dt>Temp</dt><dd>${fmt1(w.current.temp)}<small>°C</small><span class="sub t-mono">H ${fmt0(today?.tMax)}° / L ${fmt0(today?.tMin)}°</span></dd></div>
        <div><dt>Wind</dt><dd>${fmt1(w.current.wind)}<small>m/s</small><span class="sub t-mono">${dir.en}（${dir.ja}）</span></dd></div>
        <div><dt>Gust</dt><dd>${fmt1(w.current.gust)}<small>m/s</small><span class="sub t-mono">突風</span></dd></div>
        <div><dt>Wave</dt><dd>${fmt1(w.current.wave)}<small>m</small><span class="sub t-mono">${w.current.wavePeriod != null ? `周期 ${fmt0(w.current.wavePeriod)}秒` : '波高'}</span></dd></div>
        <div style="display:grid;place-items:center;">${bigCompass(dir.deg, dir.ja)}</div>
      </dl>
    </div>

    ${safetyBandHTML(area, w)}

    ${bitePanelHTML(area, exp)}

    <div class="reveal">
      <h3 class="t-label" style="margin-bottom: 12px;">Hourly — 時間別</h3>
      <div class="hourly-scroll">
        <table class="hourly-table">
          <thead>
            <tr><th>時刻</th>${hours.map((h) => {
              const d = new Date(h.time);
              const isNow = d.getHours() === now.getHours() && d.getDate() === now.getDate();
              return `<th ${isNow ? 'class="now-col"' : ''}>${String(d.getHours()).padStart(2, '0')}</th>`;
            }).join('')}</tr>
          </thead>
          <tbody>
            <tr><th>天気</th>${hours.map((h) => `<td>${describeWeather(h.code).ja.slice(0, 4)}</td>`).join('')}</tr>
            <tr><th>気温 °C</th>${hours.map((h) => `<td>${fmt0(h.temp)}</td>`).join('')}</tr>
            <tr><th>降水 %</th>${hours.map((h) => `<td>${fmt0(h.pop)}</td>`).join('')}</tr>
            <tr><th>風 m/s</th>${hours.map((h) => `<td class="lv${windLevel(h.wind, area.seaProfile)}">${arrow(h.windDir)} ${fmt1(h.wind)}</td>`).join('')}</tr>
            <tr><th>突風 m/s</th>${hours.map((h) => `<td class="lv${gustLevel(h.gust, area.seaProfile)}">${fmt1(h.gust)}</td>`).join('')}</tr>
            <tr><th>波高 m</th>${hours.map((h) => `<td class="lv${waveLevel(h.wave, area.seaProfile)}">${fmt1(h.wave)}</td>`).join('')}</tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="tide-panel reveal">
      <div class="tide-panel-head">
        <h3>Tide — 潮汐</h3>
        <span class="bite-spot">観測地点: ${t.stationName}${
          t.isProxy ? '（付近に専用の観測地点が無いため共用）' : ''
        }</span>
      </div>
      ${tideChartSVG(t)}
      <div class="tide-times">
        <span><span class="k">High</span>満潮 ${t.highs
          .map((h) => `<b>${h.time}</b> ${h.level}cm`)
          .join(' / ')}</span>
        <span><span class="k">Low</span>干潮 ${t.lows
          .map((h) => `<b>${h.time}</b> ${h.level}cm`)
          .join(' / ')}</span>
      </div>
      <p class="source-note" style="margin-top: 12px;">出典: ${t.source}</p>
    </div>

    ${seasonPanelHTML()}`;

  // 視聴者の方の釣り場（contributor 付き）は場所が特定できないよう座標を出さない
  const coordNote = area.contributor ? '' : ` / 座標 ${area.lat.toFixed(3)}, ${area.lon.toFixed(3)}`;
  document.getElementById('source-note').textContent =
    `天気・風: Open-Meteo / 潮汐: 気象庁 潮位表（${t.stationName}）${coordNote} / このページは釣行判断の参考情報です。警報・注意報は必ず気象庁の発表を確認してください。`;

  initReveal();
}

render();

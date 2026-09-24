// 気象データ取得レイヤー。
// UI側はこのモジュールの返す形（current / hourly / daily）だけに依存する（プロバイダ差し替え可能）。
//
// 2026-09-24 乗り換え：Open-Meteo（無料は非商用のみ。YFJ はアフィリエイトがあるため撤退）から、
// 無料・商用可のデータの組み合わせへ。
//   風・向き・気温・雨量・天気 … MET Norway Locationforecast 2.0（CC BY 4.0）
//                                 ※User-Agent に連絡先が必須・キャッシュ必須 → ブラウザからは呼ばない。
//                                   ビルド時（scripts/prerender-sea.mjs）と Worker（朝の堤防判定）だけが呼ぶ
//   波の高さ・周期・向き       … NOAA WaveWatch III（PacIOOS ERDDAP ww3_global、0.5度格子、無料で利用・再配布可）
//                                 瀬戸内は格子が陸扱いで値が無い → 気象庁の波の予報（文章、0.5m刻み）
//   雨の確率（6時間ごと）       … 気象庁 天気予報（出典表記で商用可）
//   風速の答え合わせ・補正      … wind-correction.js（アメダス実測と気象庁の地域時系列予報で合わせる）
//   突風                        … 出さない（無料・商用可で1時間ごとの突風予報が無い。ダディ了承 2026-09-24）
//
// ★判定の基準（safety.js の風3/5/7・波1.0/1.2/1.5）は Open-Meteo の数字で地元の実感から決めた値。
//   met.no の風・NOAA の波はそれより強く／高く出るので、wind-correction.js の補正を通してから返す。

import { correctWind, correctWave } from './wind-correction.js';

const UA = 'YamaguchiFishingJournal/1.0 (+https://yamaguchifishing.com)';
const METNO = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const WW3 = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global.json';
const JMA_FORECAST = 'https://www.jma.go.jp/bosai/forecast/data/forecast/350000.json';
const JST_MS = 9 * 3600 * 1000;
const HOURS = 72;

export const SOURCE_LABEL = '風・天気: MET Norway（補正あり） / 波: NOAA WaveWatch III・気象庁 / 降水確率: 気象庁';

// エリアごとの取り先。jma＝気象庁の予報区（一次細分）、ww3＝波の格子（海のマス）、setouchi＝波は気象庁の「瀬戸内側」
export const AREA_SOURCES = {
  hagi: { jma: '350040', ww3: [34.5, 131.0], amedas: '81071', amedasName: '萩' },
  nagato: { jma: '350040', ww3: [34.5, 131.0], amedas: '81116', amedasName: '油谷' },
  shimonoseki: { jma: '350010', ww3: [34.0, 130.5], amedas: '81428', amedasName: '下関' },
  kudamatsu: { jma: '350030', ww3: null, setouchi: true, amedas: '81386', amedasName: '下松' },
  hofu: { jma: '350020', ww3: null, setouchi: true, amedas: '81371', amedasName: '防府' },
};

const WMO = new Map([
  [0, { ja: '快晴', icon: 'sun' }],
  [1, { ja: '晴れ', icon: 'sun' }],
  [2, { ja: '晴れ時々曇り', icon: 'sun-cloud' }],
  [3, { ja: '曇り', icon: 'cloud' }],
  [45, { ja: '霧', icon: 'fog' }],
  [48, { ja: '霧氷', icon: 'fog' }],
  [51, { ja: '霧雨', icon: 'rain' }],
  [53, { ja: '霧雨', icon: 'rain' }],
  [55, { ja: '霧雨', icon: 'rain' }],
  [61, { ja: '小雨', icon: 'rain' }],
  [63, { ja: '雨', icon: 'rain' }],
  [65, { ja: '大雨', icon: 'rain' }],
  [66, { ja: '着氷性の雨', icon: 'rain' }],
  [67, { ja: '着氷性の雨', icon: 'rain' }],
  [71, { ja: '小雪', icon: 'snow' }],
  [73, { ja: '雪', icon: 'snow' }],
  [75, { ja: '大雪', icon: 'snow' }],
  [77, { ja: '霧雪', icon: 'snow' }],
  [80, { ja: 'にわか雨', icon: 'rain' }],
  [81, { ja: 'にわか雨', icon: 'rain' }],
  [82, { ja: '激しいにわか雨', icon: 'rain' }],
  [85, { ja: 'にわか雪', icon: 'snow' }],
  [86, { ja: 'にわか雪', icon: 'snow' }],
  [95, { ja: '雷雨', icon: 'storm' }],
  [96, { ja: '雷雨・ひょう', icon: 'storm' }],
  [99, { ja: '雷雨・ひょう', icon: 'storm' }],
]);

export function describeWeather(code) {
  return WMO.get(code) ?? { ja: '—', icon: 'cloud' };
}

// met.no の天気記号（symbol_code）→ 表示に使う WMO 風のコード（describeWeather がそのまま使えるように）
const SYMBOL_TO_WMO = {
  clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45,
  lightrain: 61, rain: 63, heavyrain: 65,
  lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
  lightsleet: 66, sleet: 66, heavysleet: 67, lightsleetshowers: 66, sleetshowers: 66, heavysleetshowers: 67,
  lightsnow: 71, snow: 73, heavysnow: 75, lightsnowshowers: 85, snowshowers: 85, heavysnowshowers: 86,
};
export function symbolToWmo(symbol) {
  if (!symbol) return null;
  const base = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (base.includes('thunder')) return 95;
  return SYMBOL_TO_WMO[base] ?? null;
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const DIRS_JA = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];

export function windDirection(deg) {
  if (deg == null || Number.isNaN(deg)) return { en: '—', ja: '—', deg: null };
  const i = Math.round(deg / 22.5) % 16;
  return { en: DIRS[i], ja: DIRS_JA[i], deg };
}

/* ---------------- 時刻（すべて日本時間の "YYYY-MM-DDTHH:00" で扱う。サーバーは UTC で動くため自前で変換） ---------------- */

export const jstHourKey = (date) => new Date(date.getTime() + JST_MS).toISOString().slice(0, 13) + ':00';
const jstDate = (date) => new Date(date.getTime() + JST_MS).toISOString().slice(0, 10);
const keyToDate = (key) => new Date(`${key}:00+09:00`);

async function getJSON(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return res.json();
}

/* ---------------- 取得元ごと ---------------- */

// met.no：1時間ごと（約60時間）、その先は6時間ごと。6時間ごとの区間は同じ値で埋める
export async function fetchMetno(area, fetchImpl = fetch) {
  const d = await getJSON(`${METNO}?lat=${area.lat}&lon=${area.lon}`, fetchImpl);
  const out = {};
  const series = d.properties?.timeseries ?? [];
  series.forEach((ts, i) => {
    const t = new Date(ts.time);
    const det = ts.data?.instant?.details ?? {};
    const n1 = ts.data?.next_1_hours;
    const n6 = ts.data?.next_6_hours;
    const next = series[i + 1] ? new Date(series[i + 1].time) : new Date(t.getTime() + 3600e3);
    const span = Math.max(1, Math.round((next - t) / 3600e3));
    const sym = n1?.summary?.symbol_code ?? n6?.summary?.symbol_code ?? null;
    const rain = n1 ? n1.details?.precipitation_amount : n6 ? (n6.details?.precipitation_amount ?? 0) / 6 : null;
    for (let k = 0; k < Math.min(span, 6); k++) {
      const key = jstHourKey(new Date(t.getTime() + k * 3600e3));
      out[key] ??= { wind: det.wind_speed ?? null, windDir: det.wind_from_direction ?? null, temp: det.air_temperature ?? null, rain, code: symbolToWmo(sym), interpolated: k > 0 };
    }
  });
  return { updated: d.properties?.meta?.updated_at ?? null, hourly: out };
}

// NOAA WaveWatch III（PacIOOS）。格子が陸扱いのエリア（瀬戸内）は null
export async function fetchWaves(area, now = new Date(), fetchImpl = fetch) {
  const cell = AREA_SOURCES[area.id]?.ww3;
  if (!cell) return null;
  const iso = (d) => d.toISOString().slice(0, 13) + ':00:00Z';
  const t0 = iso(new Date(now.getTime() - 3 * 3600e3));
  const t1 = iso(new Date(now.getTime() + HOURS * 3600e3));
  const [lat, lon] = cell;
  const q = ['Thgt', 'Tper', 'Tdir'].map((v) => `${v}%5B(${t0}):1:(${t1})%5D%5B(0.0)%5D%5B(${lat})%5D%5B(${lon})%5D`).join(',');
  const d = await getJSON(`${WW3}?${q}`, fetchImpl);
  const cols = d.table.columnNames;
  const out = {};
  for (const row of d.table.rows) {
    const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
    if (r.Thgt == null || Number.isNaN(r.Thgt)) continue;
    out[jstHourKey(new Date(r.time))] = { wave: r.Thgt, wavePeriod: r.Tper, waveDir: r.Tdir };
  }
  return out;
}

// 全角の数字・点を半角へ
const half = (s) => String(s ?? '').replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

// 気象庁の波の文章（例「１メートル　後　１．５メートル　ただし　瀬戸内側　では　０．５メートル」）→ [前半, 後半] の数字
export function parseJmaWaves(text, { setouchi = false } = {}) {
  if (!text) return null;
  const t = half(text).replace(/\s+/g, ' ');
  const [main, ...rest] = t.split('ただし');
  let part = main;
  if (setouchi) {
    const sub = rest.join(' ').match(/瀬戸内側\s*では\s*(.+)$/);
    if (sub) part = sub[1];
  } else if (/瀬戸内側/.test(main) && !/日本海/.test(main)) {
    part = main;
  }
  const nums = [...part.matchAll(/(\d+(?:\.\d+)?)\s*メートル/g)].map((m) => Number(m[1]));
  if (!nums.length) return null;
  return [nums[0], nums[1] ?? nums[0]];
}

// 気象庁の天気予報：エリアの予報区の「日ごとの波」と「6時間ごとの雨の確率」
export async function fetchJma(area, fetchImpl = fetch) {
  const src = AREA_SOURCES[area.id];
  if (!src) return null;
  const fc = await getJSON(JMA_FORECAST, fetchImpl);
  const first = fc[0];
  const pick = (ts) => ts.areas.find((a) => a.area.code === src.jma);
  const daily = first.timeSeries[0];
  const dArea = pick(daily);
  const waves = {};
  daily.timeDefines.forEach((t, i) => {
    const v = parseJmaWaves(dArea?.waves?.[i], { setouchi: src.setouchi });
    if (v) waves[jstDate(new Date(t))] = v;
  });
  const popsTs = first.timeSeries[1];
  const pArea = pick(popsTs);
  const pops = popsTs.timeDefines.map((t, i) => ({ from: new Date(t), pop: pArea?.pops?.[i] === '' ? null : Number(pArea?.pops?.[i]) }));
  return { report: first.reportDatetime, waves, pops };
}

// アメダスの今日の最高・最低気温（実測）。予報は「これから先」しか無いので、夜に取ると今日の最高・最低が
// 残りの数時間だけになる。すでに過ぎた時間の分をこれで補う
export async function fetchTodayObsTemps(area, fetchImpl = fetch) {
  const code = AREA_SOURCES[area.id]?.amedas;
  if (!code) return null;
  const res = await fetchImpl('https://www.jma.go.jp/bosai/amedas/data/latest_time.txt', { headers: { 'User-Agent': UA } });
  const m = (await res.text()).trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (!m) return null;
  const block = `${m[1]}${m[2]}${m[3]}_${String(Math.floor(Number(m[4]) / 3) * 3).padStart(2, '0')}`;
  const d = await getJSON(`https://www.jma.go.jp/bosai/amedas/data/point/${code}/${block}.json`, fetchImpl);
  const keys = Object.keys(d).sort();
  const v = d[keys[keys.length - 1]] ?? {};
  return { date: `${m[1]}-${m[2]}-${m[3]}`, max: v.maxTemp?.[0] ?? null, min: v.minTemp?.[0] ?? null };
}

/* ---------------- まとめる ---------------- */

const popAt = (pops, date) => {
  let v = null;
  for (const p of pops ?? []) if (p.from <= date && p.pop != null && !Number.isNaN(p.pop)) v = p.pop;
  const last = pops?.[pops.length - 1];
  // 最後の区間（6時間）より先は分からない
  if (last && date - last.from >= 6 * 3600e3) return null;
  return v;
};

/**
 * area: { id, lat, lon, ... }（src/js/data/areas.js）を受け取り、現況 + 時間別 + 3日分のサマリを返す。
 * ブラウザからは呼ばない（met.no の規約上、User-Agent を名乗れる場所＝ビルド時・Worker でだけ呼ぶ）。
 */
export async function fetchWeather(area, { now = new Date(), fetchImpl = fetch } = {}) {
  const [mn, wv, jm, obsT] = await Promise.all([
    fetchMetno(area, fetchImpl),
    fetchWaves(area, now, fetchImpl).catch(() => null),
    fetchJma(area, fetchImpl).catch(() => null),
    fetchTodayObsTemps(area, fetchImpl).catch(() => null),
  ]);

  // 今日の0時（日本時間）から72時間
  const start = keyToDate(`${jstDate(now)}T00:00`);
  const hourly = [];
  for (let h = 0; h < HOURS; h++) {
    const date = new Date(start.getTime() + h * 3600e3);
    const key = jstHourKey(date);
    const m = mn.hourly[key];
    if (!m) continue;
    const hourJst = Number(key.slice(11, 13));
    const w = wv?.[key];
    let wave = w?.wave ?? null;
    let wavePeriod = w?.wavePeriod ?? null;
    if (wave == null && jm?.waves?.[key.slice(0, 10)]) {
      const [am, pm] = jm.waves[key.slice(0, 10)];
      wave = hourJst < 12 ? am : pm;
      wavePeriod = null;
    } else if (wave != null) {
      wave = correctWave(area.id, wave);
    }
    hourly.push({
      time: key,
      temp: m.temp,
      pop: popAt(jm?.pops, date),
      code: m.code,
      wind: correctWind(area.id, { wind: m.wind, windDir: m.windDir, hour: hourJst }),
      windDir: m.windDir,
      windRaw: m.wind,
      gust: null,
      rain: m.rain,
      wave,
      wavePeriod,
    });
  }
  if (!hourly.length) throw new Error('met.no: 予報が空');

  const nowKey = jstHourKey(now);
  const cur = hourly.find((h) => h.time === nowKey) ?? hourly.find((h) => keyToDate(h.time) >= now) ?? hourly[hourly.length - 1];

  const days = [...new Set(hourly.map((h) => h.time.slice(0, 10)))].slice(0, 3);
  const daily = days.map((date) => {
    const hs = hourly.filter((h) => h.time.startsWith(date));
    const temps = hs.map((h) => h.temp).filter((v) => v != null);
    if (obsT?.date === date) temps.push(...[obsT.max, obsT.min].filter((v) => v != null));
    const pops = hs.map((h) => h.pop).filter((v) => v != null);
    const dayCodes = hs.filter((h) => { const hr = Number(h.time.slice(11, 13)); return hr >= 6 && hr <= 18; }).map((h) => h.code).filter((v) => v != null);
    return {
      date,
      tMax: temps.length ? Math.max(...temps) : null,
      tMin: temps.length ? Math.min(...temps) : null,
      popMax: pops.length ? Math.max(...pops) : null,
      code: mostSevere(dayCodes),
    };
  });

  return {
    fetchedAt: now.toISOString(),
    source: SOURCE_LABEL,
    current: {
      temp: cur.temp,
      code: cur.code,
      wind: cur.wind,
      windDir: cur.windDir,
      gust: null,
      precipitation: cur.rain,
      wave: cur.wave,
      wavePeriod: cur.wavePeriod,
      waveDir: wv?.[cur.time]?.waveDir ?? null,
    },
    hourly,
    daily,
  };
}

// 1日の天気は「いちばん悪い天気」で代表させる（晴れ時々雨 → 雨）。同じ重さなら多い方
const SEVERITY = (c) => (c == null ? -1 : c >= 95 ? 9 : c >= 71 && c <= 86 && c !== 80 && c !== 81 && c !== 82 ? 8 : c >= 61 ? 7 : c >= 51 ? 6 : c >= 45 ? 5 : c);
function mostSevere(codes) {
  if (!codes.length) return null;
  const count = new Map();
  for (const c of codes) count.set(c, (count.get(c) ?? 0) + 1);
  // 雨が1時間だけでも出るなら「にわか雨」扱いにしたいので、雨系は2時間以上ある時だけ代表にする
  const ranked = [...count.entries()].sort((a, b) => SEVERITY(b[0]) - SEVERITY(a[0]) || b[1] - a[1]);
  const rainy = ranked.find(([c, n]) => c >= 51 && n >= 2);
  if (rainy) return rainy[0];
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// 風速・波高の補正（2026-09-24 新設）。
//
// なぜ要るか：safety.js の判定基準（風3/5/7・波1.0/1.2/1.5）は Open-Meteo の表示値を見た地元の釣り人の
//   実感から決めた数字。乗り換え先の met.no の風は Open-Meteo より数m/s強く、NOAA の波は約0.3m高く出た
//   （2026-09-24 夜の比較）。補正なしで替えると、同じ海でも判定が1〜2段厳しくなる。
//
// 決め方：Open-Meteo が使えるうちに、1時間ごとに met.no・Open-Meteo・アメダス実測・気象庁の地域時系列予報を
//   記録している（C:\Users\my\weather-compare、2026-09-24〜約5日）。そこから
//     ① 風：エリア × 時間帯 × 風向き（8方位）ごとの「met.no → 目標」の式（a × 生の値 + b）
//     ② 波：エリアごとの「NOAA → 目標」の式
//   を求めて、下の表を埋める。表が空のあいだは補正しない（生の値をそのまま返す）。
//   目標は、判定基準を変えずに済むよう、まずは Open-Meteo 相当の数字にする。
//
// ★表を埋めたら、test/wind-correction.test.mjs に「代表的な値の補正結果」を足して固定すること。

// 時間帯の区切り（日本時間）。海風・陸風で傾向が変わるので、少なくとも昼と夜は分ける
export const HOUR_BANDS = [
  { key: 'night', from: 0, to: 6 },
  { key: 'morning', from: 6, to: 12 },
  { key: 'afternoon', from: 12, to: 18 },
  { key: 'evening', from: 18, to: 24 },
];
export const bandOf = (hour) => HOUR_BANDS.find((b) => hour >= b.from && hour < b.to)?.key ?? 'night';

// 8方位（風が吹いてくる方角）。N=0, NE=1, …, NW=7
export const octantOf = (deg) => (deg == null || Number.isNaN(deg) ? null : Math.round(((deg % 360) + 360) % 360 / 45) % 8);

// 風の補正表：WIND[areaId][band] = { a, b, dir?: { [octant]: { a, b } } }。無ければ補正しない
export const WIND = {};
// 波の補正表：WAVE[areaId] = { a, b }
export const WAVE = {};

const round1 = (v) => Math.round(v * 10) / 10;

export function correctWind(areaId, { wind, windDir, hour }) {
  if (wind == null) return null;
  const band = WIND[areaId]?.[bandOf(hour)];
  if (!band) return wind;
  const o = octantOf(windDir);
  const k = (o != null && band.dir?.[o]) || band;
  return Math.max(0, round1(k.a * wind + k.b));
}

export function correctWave(areaId, wave) {
  if (wave == null) return null;
  const k = WAVE[areaId];
  if (!k) return wave;
  return Math.max(0, Math.round((k.a * wave + k.b) * 100) / 100);
}

// 堤防釣りの安全判定。
//
// 風速・突風・波高・風向から 0〜3 の4段階で「今日、堤防に立てるか」を返す。
// 数値は一般的な目安（釣り情報サイト複数と気象庁の注意報基準を参考）で、
// 気象庁の警報・注意報が出ている時はそちらが優先。
//
//   風速   〜5 安全 / 5〜7 注意 / 7〜10 危険 / 10〜 中止
//   突風   10〜 注意 / 15〜 危険（平均風速の1.5〜2倍になるのが普通）
//   波高   〜1.0 安全 / 1.0〜1.2 注意 / 1.2〜1.5 危険 / 1.5〜 中止（堤防を波が洗う）
//   うねり 周期7秒以上 かつ 波高1.0以上 は1段階上げる
//   向かい風（海から陸へ吹く風）は波が立つので、風速5以上なら1段階上げる

export const SAFETY_LEVELS = [
  { level: 0, key: 'ok', label: '安全', short: 'OK', message: '堤防で釣りができるコンディションです。' },
  { level: 1, key: 'caution', label: '注意', short: '注意', message: '軽い仕掛けは流されます。港内・風裏を選んでください。' },
  { level: 2, key: 'danger', label: '危険', short: '危険', message: '外向きの堤防は避けてください。ライフジャケット必須。' },
  { level: 3, key: 'stop', label: '中止', short: '中止', message: '今日は堤防に立たないでください。' },
];

// 風向(deg, 風が吹いてくる方角) が、海に向いた方角(facing) から ±60° 以内なら向かい風
export function isOnshore(windDir, facing) {
  if (windDir == null || facing == null) return false;
  const diff = Math.abs(((windDir - facing + 540) % 360) - 180);
  return diff <= 60;
}

export function assessSafety({ wind, gust, waveHeight, wavePeriod, windDir, facing }) {
  const reasons = [];
  let level = 0;
  const bump = (to, why) => {
    if (to > level) level = to;
    if (why) reasons.push(why);
  };

  if (wind != null) {
    if (wind >= 10) bump(3, `風速${wind.toFixed(1)}m/s`);
    else if (wind >= 7) bump(2, `風速${wind.toFixed(1)}m/s`);
    else if (wind >= 5) bump(1, `風速${wind.toFixed(1)}m/s`);
  }
  if (gust != null) {
    if (gust >= 15) bump(2, `突風${gust.toFixed(1)}m/s`);
    else if (gust >= 10) bump(1, `突風${gust.toFixed(1)}m/s`);
  }
  if (waveHeight != null) {
    if (waveHeight >= 1.5) bump(3, `波高${waveHeight.toFixed(1)}m`);
    else if (waveHeight >= 1.2) bump(2, `波高${waveHeight.toFixed(1)}m`);
    else if (waveHeight >= 1.0) bump(1, `波高${waveHeight.toFixed(1)}m`);
    if (wavePeriod != null && wavePeriod >= 7 && waveHeight >= 1.0) {
      bump(Math.min(3, level + 1), `周期${wavePeriod.toFixed(0)}秒のうねり`);
    }
  }
  if (wind != null && wind >= 5 && isOnshore(windDir, facing)) {
    bump(Math.min(3, level + 1), '向かい風（海から吹いて波が立つ）');
  }

  return { ...SAFETY_LEVELS[level], reasons };
}

// 時間別テーブルのセル用（風速だけで段階を返す）
export const windLevel = (v) => (v == null ? 0 : v >= 10 ? 3 : v >= 7 ? 2 : v >= 5 ? 1 : 0);
export const gustLevel = (v) => (v == null ? 0 : v >= 15 ? 2 : v >= 10 ? 1 : 0);
export const waveLevel = (v) => (v == null ? 0 : v >= 1.5 ? 3 : v >= 1.2 ? 2 : v >= 1.0 ? 1 : 0);

// 釣行期待値と旬の魚。
//
// Discordブリッジ（秘書クロロ）と同じロジックをサイトへ移植したもの。
// 仕様を変えるときは discord-claude-bridge/index.js 側も合わせること。
//
// ⚠️ chowari.jp の「爆釣指数(BI)」は同社独自のアルゴリズムなので再現していない。
//    ここは釣りの一般的なセオリーだけで組んだ独自の目安。

// =====================================================
// 潮名・月齢
// =====================================================

// 簡易月齢（新月からの日数）。天文計算の近似値で、±1日程度の誤差がある。
export function moonAge(date = new Date()) {
  // 2000-01-06 18:14 UTC を新月の基準にする
  const base = Date.UTC(2000, 0, 6, 18, 14);
  const synodic = 29.530588853;
  const days = (date.getTime() - base) / 86400000;
  return ((days % synodic) + synodic) % synodic;
}

// 月齢から 大潮/中潮/小潮/長潮/若潮 を判定する（一般的な目安の区分）
export function tideName(age) {
  const a = age % 29.53;
  if (a < 2 || a > 27.5 || (a > 12.5 && a < 17)) return '大潮';
  if ((a >= 2 && a < 5.5) || (a >= 17 && a < 20.5)) return '中潮';
  if ((a >= 5.5 && a < 8) || (a >= 20.5 && a < 23)) return '小潮';
  if (a >= 8 && a < 9) return '長潮';
  if (a >= 9 && a < 10.5) return '若潮';
  return '中潮';
}

// =====================================================
// 日出・日入（まずめ判定に使う簡易計算）
// =====================================================

export function sunTimes(lat, lon, date = new Date()) {
  const rad = Math.PI / 180;
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);

  // 太陽赤緯の近似
  const decl =
    23.45 * rad * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));

  const latRad = lat * rad;
  const cosH = -Math.tan(latRad) * Math.tan(decl);
  if (cosH > 1 || cosH < -1) return { sunrise: null, sunset: null };

  const H = Math.acos(cosH) / rad / 15; // 時間角（時）

  // 均時差の近似
  const B = ((2 * Math.PI) / 364) * (dayOfYear - 81);
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // 日本標準時（東経135度基準）
  const solarNoon = 12 - (lon - 135) / 15 - eot / 60;

  const toDate = (h) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(Math.round(h * 60));
    return d;
  };

  return { sunrise: toDate(solarNoon - H), sunset: toDate(solarNoon + H) };
}

// =====================================================
// 釣行期待値（10点満点 = ★10個）
// =====================================================
//
// 配点:
//   潮の動き  0〜6点 … 潮止まり（満干潮の前後30分）は最低。中間ほど高い
//   まずめ    0〜2点 … 日出・日入の前後1時間が最高、2時間以内で半分
//   潮回り    0〜2点 … 大潮2 / 中潮1.5 / 小潮1 / 長潮・若潮0.5

function parseTimeToday(timeStr, base) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!m) return null;
  const d = new Date(base);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

export function calcExpectation(area, tide, date = new Date()) {
  const extremes = [...(tide?.highs ?? []), ...(tide?.lows ?? [])]
    .map((p) => parseTimeToday(p.time, date))
    .filter(Boolean);

  if (extremes.length === 0) return null;

  const minutesToNearest = Math.min(
    ...extremes.map((t) => Math.abs(date - t) / 60000)
  );

  // ① 潮の動き
  const flowPoint =
    minutesToNearest <= 30
      ? 0.5
      : (Math.min(minutesToNearest, 180) / 180) * 6;

  // ② まずめ
  const lat = area.homeSpot?.lat ?? area.lat;
  const lon = area.homeSpot?.lon ?? area.lon;
  const { sunrise, sunset } = sunTimes(lat, lon, date);
  const sunGaps = [sunrise, sunset]
    .filter(Boolean)
    .map((t) => Math.abs(date - t) / 60000);
  const minutesToSun = sunGaps.length ? Math.min(...sunGaps) : Infinity;

  const sunPoint = minutesToSun <= 60 ? 2 : minutesToSun <= 120 ? 1 : 0;

  // ③ 潮回り
  const age = moonAge(date);
  const name = tideName(age);
  const rangePoint =
    name === '大潮' ? 2 : name === '中潮' ? 1.5 : name === '小潮' ? 1 : 0.5;

  const score = Math.max(0, Math.min(10, flowPoint + sunPoint + rangePoint));

  const reasons = [];
  if (minutesToNearest <= 30) reasons.push('潮止まり前後');
  else if (minutesToNearest >= 120) reasons.push('潮がよく動く時間帯');
  if (sunPoint === 2) reasons.push('まずめ時');
  reasons.push(name);

  const message =
    score >= 8
      ? '今釣れる絶好のチャンスです！'
      : score >= 6
        ? '今は釣れそうですね！'
        : score >= 4
          ? 'ぼちぼち狙えそうな時間帯です。'
          : '今は釣れる時間ではないかもしれないです！';

  return {
    score,
    stars: Math.round(score),
    message,
    reasons,
    tideName: name,
    moonAge: age,
    sunrise,
    sunset,
    // 画面で内訳を見せるための各項目の得点
    breakdown: { flow: flowPoint, sun: sunPoint, range: rangePoint },
  };
}

// =====================================================
// 月別・旬の魚（堤防釣り）
// =====================================================
//
// 山口県 日本海側（萩・長門）の一般的な傾向。
// 特定の釣果データに基づくものではないので、実際とズレたら更新する。

const SEASONAL = {
  1: { fish: ['メバル', 'アラカブ', 'ヒラメ', 'サヨリ'], squid: ['ヤリイカ'] },
  2: { fish: ['メバル', 'アラカブ', 'ヒラメ', 'サヨリ'], squid: ['ヤリイカ'] },
  3: { fish: ['メバル', 'キビレ', 'サヨリ'], squid: ['コウイカ'] },
  4: { fish: ['キビレ', 'マダイ', 'クロダイ'], squid: ['コウイカ'] },
  5: { fish: ['マダイ', 'クロダイ', 'アジ'], squid: ['アオリイカ'] },
  6: { fish: ['アジ', 'イサキ', 'キス'], squid: ['アオリイカ'] },
  7: { fish: ['アジ', 'イサキ', 'キス', 'ハマチ'], squid: ['アオリイカ'] },
  8: { fish: ['アジ', 'キス', 'ハマチ', 'チヌ'], squid: ['アオリイカ'] },
  9: { fish: ['アジ', 'チヌ', 'ハマチ'], squid: ['アオリイカ'] },
  10: { fish: ['タチウオ', 'チヌ', 'マダイ'], squid: ['アオリイカ'] },
  11: { fish: ['タチウオ', 'メバル', 'アラカブ'], squid: ['ヤリイカ'] },
  12: { fish: ['メバル', 'アラカブ', 'ヒラメ'], squid: ['ヤリイカ'] },
};

export function seasonalTargets(date = new Date()) {
  const month = date.getMonth() + 1;
  return { month, ...(SEASONAL[month] ?? { fish: [], squid: [] }) };
}

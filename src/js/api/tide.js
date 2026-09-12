// 潮汐データレイヤー。
//
// ✅ 気象庁の潮位表（天文潮位の予測値）を使った実データ。
//
// 気象庁のサーバーはCORSを許可していないため、ブラウザから直接は取得できない。
// そこで `scripts/build-tide.mjs` が年間データを取得してJSONに変換し、
// ここではそのJSONを読むだけにしている。
//
// 年が変わったら（または新しい年のデータが必要になったら）:
//   node scripts/build-tide.mjs 2027
// を実行して JSON を追加し、下の TIDE_DATA に import を足す。
//
// 観測地点:
//   萩(K5)   … 萩・長門（仙崎には専用の観測地点が無いため共用）
//   弟子待(A1) … 下関エリア（彦島の観測点。同じ響灘側で最寄り）
//   徳山(QA)   … 下松エリア（徳山湾・約5km。瀬戸内側）
//   三田尻(J9) … 防府エリア（防府市三田尻そのもの＝代用ではない）
//
// 返り値:
// {
//   isDemo: false,
//   source: string,
//   stationName: string,      // 実際の観測地点名
//   isProxy: boolean,         // その釣り場専用の観測点ではない場合 true
//   highs: [{ time: 'HH:MM', level: cm }],
//   lows:  [{ time: 'HH:MM', level: cm }],
//   curve: [{ hour: 0-24, level: cm }],
// }

// 地点ごとに**動的import**にしている。静的importにすると4地点ぶんのJSON
// （1地点約90KB）が全ページ共通のバンドルに入り、潮汐を表示しないページ
// （JOURNAL・TACKLE・ABOUT等）まで重くなる。実測で 177KB → 344KB に膨らんだため
// 動的importに変更した（2026-09-13）。地点を足すときはここに1行足す。
const LOADERS = {
  K5: { 2026: () => import('../data/tide/K5-2026.json') },
  A1: { 2026: () => import('../data/tide/A1-2026.json') },
  QA: { 2026: () => import('../data/tide/QA-2026.json') },
  J9: { 2026: () => import('../data/tide/J9-2026.json') },
};

// 一度読んだ地点はメモリに残す（エリアのタブを行き来しても再取得しない）
const cache = new Map();

async function loadDataset(stn, year) {
  const key = `${stn}-${year}`;
  if (cache.has(key)) return cache.get(key);
  const loader = LOADERS[stn]?.[year];
  if (!loader) return null;
  const mod = await loader();
  const data = mod.default ?? mod;
  cache.set(key, data);
  return data;
}

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function fetchTide(area, date = new Date()) {
  const stn = area.tideStn ?? 'K5';
  const year = date.getFullYear();
  const dataset = await loadDataset(stn, year);

  if (!dataset) {
    throw new Error(`潮汐データが未取得です（地点${stn} / ${year}年）`);
  }

  const day = dataset.days[dateKey(date)];
  if (!day) {
    throw new Error(`潮汐データに該当日がありません（${dateKey(date)}）`);
  }

  // 毎時潮位（24点）を0〜24時の曲線にする。24時は翌日0時の値で閉じる。
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const tomorrow = dataset.days[dateKey(nextDay)];

  const curve = day.hourly.map((level, hour) => ({ hour, level }));
  curve.push({ hour: 24, level: tomorrow?.hourly?.[0] ?? day.hourly[23] });

  return {
    isDemo: false,
    source: dataset.source,
    sourceUrl: dataset.sourceUrl,
    stationName: dataset.stationName,
    isProxy: area.tideIsProxy ?? true,
    highs: day.highs,
    lows: day.lows,
    curve,
  };
}

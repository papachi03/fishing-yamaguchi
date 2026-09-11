// 気象庁の年間潮位表（固定長テキスト）を取得して、サイト用のJSONに変換する。
//
// なぜビルド時に取り込むか:
//   気象庁のサーバーはCORSを許可していないため、ブラウザから直接は取得できない。
//   Node（＝CORSの制約を受けない）で取得してJSONに落とし、サイトはそれを読む。
//
// 使い方:
//   node scripts/build-tide.mjs          … 今年ぶんを取得
//   node scripts/build-tide.mjs 2027     … 年を指定
//
// 出典: 気象庁 潮位表
//   https://www.data.jma.go.jp/kaiyou/db/tide/suisan/
//
// 固定長フォーマット（1行 = 1日 / 136文字）:
//   1-72    毎時潮位 24個 × 3桁（cm、潮位表基準面上）
//   73-74   年（下2桁）
//   75-76   月
//   77-78   日
//   79-80   地点記号
//   81-108  満潮 4組 × 7桁（時刻4桁 + 潮位3桁）
//   109-136 干潮 4組 × 7桁（同上）
//   時刻・潮位が "9999"/"999" の枠は「該当なし」

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 取得する観測地点。
//   萩(K5)   … 越ヶ浜・仙崎で共用（仙崎には専用の観測地点が無い）
//   弟子待(A1) … 下関エリアで使う。彦島の観測点で、同じ響灘側で最寄り
//   ※「下関(DS)」は潮位観測所の記号で、潮位表のテキストは A1 でしか配布されていない
const STATIONS = [
  { code: 'K5', name: '萩' },
  { code: 'A1', name: '下関（弟子待）' },
];

const year = Number(process.argv[2]) || new Date().getFullYear();

function parseLine(line) {
  // 時刻4桁+潮位3桁 の組を切り出す。該当なし(9999/999)は捨てる。
  const readPairs = (start) => {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const at = start + i * 7;
      const timeRaw = line.slice(at, at + 4);
      const levelRaw = line.slice(at + 4, at + 7);
      if (!timeRaw.trim() || timeRaw === '9999') continue;

      const hh = Number(timeRaw.slice(0, 2));
      const mm = Number(timeRaw.slice(2, 4));
      const level = Number(levelRaw);
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || level === 999) continue;

      out.push({
        time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
        level,
      });
    }
    return out;
  };

  const hourly = [];
  for (let i = 0; i < 24; i++) {
    hourly.push(Number(line.slice(i * 3, i * 3 + 3)));
  }

  const yy = Number(line.slice(72, 74));
  const mo = Number(line.slice(74, 76));
  const da = Number(line.slice(76, 78));

  return {
    date: `${2000 + yy}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`,
    hourly,
    highs: readPairs(80),
    lows: readPairs(108),
  };
}

async function buildStation(station) {
  const url = `https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/${year}/${station.code}.txt`;
  process.stdout.write(`取得中: ${station.name}(${station.code}) ${year}年 … `);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);

  const text = await res.text();
  const days = text
    .split('\n')
    .filter((l) => l.trim().length >= 78)
    .map(parseLine)
    .filter((d) => d.date.startsWith(String(year)));

  console.log(`${days.length}日分`);

  const byDate = {};
  for (const d of days) {
    byDate[d.date] = { hourly: d.hourly, highs: d.highs, lows: d.lows };
  }

  return {
    station: station.code,
    stationName: station.name,
    year,
    source: '気象庁 潮位表（天文潮位の予測値）',
    sourceUrl: 'https://www.data.jma.go.jp/kaiyou/db/tide/suisan/',
    days: byDate,
  };
}

const outDir = resolve(__dirname, '../src/js/data/tide');
await mkdir(outDir, { recursive: true });

for (const station of STATIONS) {
  const data = await buildStation(station);
  const outPath = resolve(outDir, `${station.code}-${year}.json`);
  await writeFile(outPath, JSON.stringify(data), 'utf8');
  console.log(`書き出し: ${outPath}`);
}

console.log('完了');

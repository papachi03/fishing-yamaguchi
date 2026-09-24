// 海況ダッシュボードの固定入力（天気・潮・時刻）。
// sea-render.js の出力を「英語対応の前後で日本語が1文字も変わらない」ことの確認に使う。
// Date は JST 固定にできないので、日付・時刻だけを見る描画に影響しないよう 2026-09-24 12:00（ローカル）にする
import { areaById } from '../../src/js/data/areas.js';

export const NOW = new Date(2026, 8, 24, 12, 0, 0);

const hourlyTime = (i) => {
  const d = new Date(2026, 8, 24, 0, 0, 0);
  d.setHours(d.getHours() + i);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:00`;
};

// WMO コードを一巡させて、天気名の対訳がすべて描かれるようにする
const CODES = [0, 1, 2, 3, 45, 48, 51, 61, 63, 65, 66, 71, 73, 75, 77, 80, 82, 85, 95, 96, 99, 2, 3, 1, 0, 1, 2, 3, 61, 63];

export const weather = {
  current: { temp: 24.6, code: 0, wind: 2.5, windDir: 0, gust: 9.0, wave: 0.3, wavePeriod: 6 },
  hourly: Array.from({ length: 30 }, (_, i) => ({
    time: hourlyTime(i),
    temp: 20 + (i % 6),
    pop: (i * 7) % 100,
    code: CODES[i],
    wind: (i % 9) * 1.1,
    windDir: (i * 45) % 360,
    gust: (i % 9) * 2.1,
    wave: (i % 5) * 0.4,
    wavePeriod: 4 + (i % 5),
  })),
  daily: [{ popMax: 40, tMax: 25, tMin: 20 }],
};

// 向かい風＋うねりで「危険」になる版
export const weatherRough = {
  ...weather,
  current: { temp: 18.2, code: 63, wind: 5.4, windDir: 350, gust: 11.0, wave: 1.3, wavePeriod: 8 },
};

export const tide = {
  isDemo: false,
  source: '気象庁 潮位表（天文潮位の予測値）',
  sourceUrl: 'https://www.data.jma.go.jp/kaiyou/db/tide/suisan/',
  stationName: '萩',
  stationNameEn: 'Hagi',
  sourceEn: 'JMA tide tables (predicted astronomical tide)',
  isProxy: false,
  highs: [{ time: '09:10', level: 86 }, { time: '21:55', level: 67 }],
  lows: [{ time: '02:35', level: 42 }, { time: '16:22', level: 32 }],
  curve: Array.from({ length: 25 }, (_, h) => ({ hour: h, level: Math.round(60 + 25 * Math.sin(((h - 3) / 12) * Math.PI)) })),
};

export const tideProxy = { ...tide, stationName: '下関（弟子待）', stationNameEn: 'Shimonoseki (Deshimachi)', isProxy: true };

export const areaHagi = areaById('hagi');
export const areaShimonoseki = areaById('shimonoseki');
export const areaHofu = areaById('hofu');

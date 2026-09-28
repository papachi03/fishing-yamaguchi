// アメダス（気象庁）の実測。ページを開いたときにブラウザから直接取る（気象庁は CORS 可・出典表記で商用可）。
//   10分ごとの観測。公開は観測の10〜20分後。観測所は釣り場から離れていることがあるので、必ず観測所名と時刻を添えて出す。
//   ★判定（safety.js）には使わない。判定の基準は予報の数字で決めてあるため、実測は「参考」として見せるだけ（2026-09-24）。

import { AREA_SOURCES } from './weather.js';

const BASE = 'https://www.jma.go.jp/bosai/amedas/data';

// アメダスの風向コード（0=静穏、1=北北東 … 16=北）→ 角度（風が吹いてくる方角）
export const amedasDirToDeg = (code) => (code == null || code === 0 ? null : (code % 16) * 22.5);

const fmtBlock = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(Math.floor(d.getHours() / 3) * 3).padStart(2, '0');
  return `${y}${m}${day}_${h}`;
};

// latest_time.txt の時刻（日本時間の ISO）を、日本時間の年月日時として読む（ブラウザの時計・時差に左右されない）
const parseJst = (iso) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
};

/**
 * エリアの観測所の最新の実測を返す。
 * { station, at: 'HH:MM', wind, windDir（角度）, temp, gustMax, gustAt, windHistory: [{ at, wind }]（3時間分、10分ごと） }
 */
export async function fetchObservation(areaId, fetchImpl = fetch) {
  const src = AREA_SOURCES[areaId];
  if (!src?.amedas) return null;
  const latestText = await (await fetchImpl(`${BASE}/latest_time.txt`)).text();
  const latest = parseJst(latestText.trim());
  if (!latest) throw new Error('amedas latest_time');
  const res = await fetchImpl(`${BASE}/point/${src.amedas}/${fmtBlock(latest)}.json`);
  if (!res.ok) throw new Error(`amedas ${res.status}`);
  const d = await res.json();
  const keys = Object.keys(d).sort();
  if (!keys.length) return null;
  const k = keys[keys.length - 1];
  const v = d[k];
  const at = `${k.slice(8, 10)}:${k.slice(10, 12)}`;
  return {
    station: src.amedasName,
    at,
    wind: v.wind?.[0] ?? null,
    windDir: amedasDirToDeg(v.windDirection?.[0]),
    calm: v.windDirection?.[0] === 0,
    temp: v.temp?.[0] ?? null,
    gustMax: v.gust?.[0] ?? null,
    gustAt: v.gustTime ? `${v.gustTime.hour}:${String(v.gustTime.minute).padStart(2, '0')}` : null,
    windHistory: keys.map((kk) => ({ at: `${kk.slice(8, 10)}:${kk.slice(10, 12)}`, wind: d[kk].wind?.[0] ?? null })),
  };
}

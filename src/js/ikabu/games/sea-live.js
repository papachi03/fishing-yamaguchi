// 「今日の萩の海」：YFJ の海況（天気・潮汐・安全判定・期待値）を、エギングゲームの条件に変える。
// 取り方は風と波（pages/sea.js / sea-render.js）と同じ関数を使う。todFromClock は純粋関数（node --test で試せる）
import { areaById } from '../../data/areas.js';
import { loadSnapshot, atNow } from '../../api/sea-snapshot.js';
import { fetchTide } from '../../api/tide.js';
import { assessSafety } from '../../api/safety.js';
import { calcExpectation, sunTimes, moonAge } from '../../api/fishing.js';
import { moonLight } from './egi.js';

export const HAGI = areaById('hagi');

// 時計と日の出・日の入りから時間帯を決める：日の出±1h＝朝マズメ、日の入り±1h＝夕マズメ、その間＝日中、それ以外＝夜
export function todFromClock(now, sunrise, sunset) {
  const h = 60 * 60 * 1000;
  if (sunrise && Math.abs(now - sunrise) <= h) return 'morning';
  if (sunset && Math.abs(now - sunset) <= h) return 'evening';
  if (sunrise && sunset && now > sunrise && now < sunset) return 'day';
  return 'night';
}

// 予報は本家と同じく、サイトのビルド時（3時間ごと）に取った sea-snapshot を読み、今の1時間に合わせる
// （met.no は User-Agent を名乗れる場所からしか呼べない規約のため、ブラウザから直接取りに行かない。2026-09-29）
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
async function snapshotWeather(area, now) {
  const snap = await loadSnapshot(BASE_URL);
  const w = snap?.areas?.[area.id];
  if (!w) throw new Error('snapshot に予報が無い');
  return { ...atNow(w, now), fetchedAt: w.fetchedAt ?? snap.fetchedAt };
}

// 今の萩の海。天気か潮汐の片方が取れなくても、取れた分で組み立てる（両方だめなら throw）
export async function loadHagiSea({ lang = 'ja', now = new Date(), area = HAGI } = {}) {
  const [wr, tr] = await Promise.allSettled([snapshotWeather(area, now), fetchTide(area, now)]);
  const w = wr.status === 'fulfilled' ? wr.value : null;
  const tide = tr.status === 'fulfilled' ? tr.value : null;
  if (!w && !tide) throw (wr.reason ?? tr.reason ?? new Error('sea data unavailable'));

  const lat = area.homeSpot?.lat ?? area.lat;
  const lon = area.homeSpot?.lon ?? area.lon;
  const { sunrise, sunset } = sunTimes(lat, lon, now);
  const exp = tide ? calcExpectation(area, tide, now, lang) : null;
  const safety = w
    ? assessSafety({ wind: w.current.wind, gust: w.current.gust, waveHeight: w.current.wave, wavePeriod: w.current.wavePeriod, windDir: w.current.windDir, facing: area.facing, seaProfile: area.seaProfile, alerts: w.current.alerts ?? w.alerts, lang })
    : null;
  return {
    area,
    now,
    month: now.getMonth() + 1,
    tod: todFromClock(now, sunrise, sunset),
    sunrise,
    sunset,
    // ゲームに渡す条件（egi.js の normalizeConditions が受ける形）
    conditions: {
      expectation: exp ? exp.score : 5,
      wind: w?.current.wind ?? 3,
      gust: w ? w.current.gust ?? null : 5,
      wave: w?.current.wave ?? 0.5,
      safety: safety?.key ?? 'ok',
      moon: moonLight(moonAge(now)),   // 今夜の月の明るさ（本物の月齢から）
    },
    expectation: exp,          // { score, stars, message, tideName, reasons } または null
    safety,                    // { key, level, label, message, reasons } または null
    weather: w ? { wind: w.current.wind, gust: w.current.gust, wave: w.current.wave, fetchedAt: w.fetchedAt, source: w.source } : null,
    tide: tide ? { source: lang === 'en' ? tide.sourceEn : tide.source, stationName: lang === 'en' ? tide.stationNameEn : tide.stationName } : null,
    partial: !w || !tide,
  };
}

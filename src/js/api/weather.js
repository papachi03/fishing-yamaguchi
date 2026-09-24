// 気象データ取得レイヤー。
// Open-Meteo (https://open-meteo.com/) — 無料・APIキー不要・CORS対応。
// JMA（気象庁）モデルを優先的に使う。
// UI側はこのモジュールの返す形だけに依存する（プロバイダ差し替え可能）。

const BASE = 'https://api.open-meteo.com/v1/forecast';

const WMO = new Map([
  [0, { ja: '快晴', en: 'Clear', icon: 'sun' }],
  [1, { ja: '晴れ', en: 'Mostly sunny', icon: 'sun' }],
  [2, { ja: '晴れ時々曇り', en: 'Partly cloudy', icon: 'sun-cloud' }],
  [3, { ja: '曇り', en: 'Cloudy', icon: 'cloud' }],
  [45, { ja: '霧', en: 'Fog', icon: 'fog' }],
  [48, { ja: '霧氷', en: 'Rime fog', icon: 'fog' }],
  [51, { ja: '霧雨', en: 'Drizzle', icon: 'rain' }],
  [53, { ja: '霧雨', en: 'Drizzle', icon: 'rain' }],
  [55, { ja: '霧雨', en: 'Drizzle', icon: 'rain' }],
  [61, { ja: '小雨', en: 'Light rain', icon: 'rain' }],
  [63, { ja: '雨', en: 'Rain', icon: 'rain' }],
  [65, { ja: '大雨', en: 'Heavy rain', icon: 'rain' }],
  [66, { ja: '着氷性の雨', en: 'Freezing rain', icon: 'rain' }],
  [67, { ja: '着氷性の雨', en: 'Freezing rain', icon: 'rain' }],
  [71, { ja: '小雪', en: 'Light snow', icon: 'snow' }],
  [73, { ja: '雪', en: 'Snow', icon: 'snow' }],
  [75, { ja: '大雪', en: 'Heavy snow', icon: 'snow' }],
  [77, { ja: '霧雪', en: 'Snow grains', icon: 'snow' }],
  [80, { ja: 'にわか雨', en: 'Showers', icon: 'rain' }],
  [81, { ja: 'にわか雨', en: 'Showers', icon: 'rain' }],
  [82, { ja: '激しいにわか雨', en: 'Heavy showers', icon: 'rain' }],
  [85, { ja: 'にわか雪', en: 'Snow showers', icon: 'snow' }],
  [86, { ja: 'にわか雪', en: 'Snow showers', icon: 'snow' }],
  [95, { ja: '雷雨', en: 'Thunderstorm', icon: 'storm' }],
  [96, { ja: '雷雨・ひょう', en: 'Thunder & hail', icon: 'storm' }],
  [99, { ja: '雷雨・ひょう', en: 'Thunder & hail', icon: 'storm' }],
]);

// 天気名。ja / en を両方持ち、text は lang に合わせた方（省略時は日本語＝従来どおり）
export function describeWeather(code, lang = 'ja') {
  const w = WMO.get(code) ?? { ja: '—', en: '—', icon: 'cloud' };
  return { ...w, text: lang === 'en' ? w.en : w.ja };
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const DIRS_JA = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];

export function windDirection(deg) {
  if (deg == null || Number.isNaN(deg)) return { en: '—', ja: '—', deg: null };
  const i = Math.round(deg / 22.5) % 16;
  return { en: DIRS[i], ja: DIRS_JA[i], deg };
}

// area: { lat, lon } を受け取り、現況 + 時間別 + 今日のサマリを返す
export async function fetchWeather(area) {
  const params = new URLSearchParams({
    latitude: String(area.lat),
    longitude: String(area.lon),
    timezone: 'Asia/Tokyo',
    current:
      'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation',
    hourly:
      'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    forecast_days: '3',
    wind_speed_unit: 'ms',
  });
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`weather fetch failed: ${res.status}`);
  const d = await res.json();

  const hourly = (d.hourly?.time ?? []).map((t, i) => ({
    time: t,
    temp: d.hourly.temperature_2m?.[i],
    pop: d.hourly.precipitation_probability?.[i],
    code: d.hourly.weather_code?.[i],
    wind: d.hourly.wind_speed_10m?.[i],
    windDir: d.hourly.wind_direction_10m?.[i],
    gust: d.hourly.wind_gusts_10m?.[i],
  }));

  // 波高（Open-Meteo Marine）。取れなくても天気は返す
  const marine = await fetchMarine(area).catch(() => null);
  if (marine) {
    for (const h of hourly) {
      const m = marine.hourlyByTime[h.time];
      if (m) {
        h.wave = m.wave;
        h.wavePeriod = m.wavePeriod;
      }
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    source: 'Open-Meteo',
    current: {
      temp: d.current?.temperature_2m,
      code: d.current?.weather_code,
      wind: d.current?.wind_speed_10m,
      windDir: d.current?.wind_direction_10m,
      gust: d.current?.wind_gusts_10m,
      precipitation: d.current?.precipitation,
      wave: marine?.current.wave ?? null,
      wavePeriod: marine?.current.wavePeriod ?? null,
      waveDir: marine?.current.waveDir ?? null,
    },
    hourly,
    daily: (d.daily?.time ?? []).map((t, i) => ({
      date: t,
      tMax: d.daily.temperature_2m_max?.[i],
      tMin: d.daily.temperature_2m_min?.[i],
      popMax: d.daily.precipitation_probability_max?.[i],
      code: d.daily.weather_code?.[i],
    })),
  };
}

// 波高・周期（Open-Meteo Marine API、APIキー不要・CORS可）。
// 釣り場の座標（homeSpot）があればそちらで取る。沿岸ぎりぎりだと格子から外れて
// null になることがあるので、その場合は area の座標で取り直す。
const MARINE = 'https://marine-api.open-meteo.com/v1/marine';

export async function fetchMarine(area) {
  const spot = area.homeSpot ?? area;
  const params = new URLSearchParams({
    latitude: String(spot.lat),
    longitude: String(spot.lon),
    timezone: 'Asia/Tokyo',
    current: 'wave_height,wave_period,wave_direction',
    hourly: 'wave_height,wave_period',
    forecast_days: '3',
  });
  const res = await fetch(`${MARINE}?${params}`);
  if (!res.ok) throw new Error(`marine fetch failed: ${res.status}`);
  const d = await res.json();

  const hourlyByTime = {};
  (d.hourly?.time ?? []).forEach((t, i) => {
    hourlyByTime[t] = { wave: d.hourly.wave_height?.[i], wavePeriod: d.hourly.wave_period?.[i] };
  });

  return {
    current: {
      wave: d.current?.wave_height ?? null,
      wavePeriod: d.current?.wave_period ?? null,
      waveDir: d.current?.wave_direction ?? null,
    },
    hourlyByTime,
  };
}

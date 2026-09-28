// 海況データの乗り換え（2026-09-24）：取得元の文字や記号を、画面が使う形に直す部分のテスト
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJmaWaves, symbolToWmo, jstHourKey, fetchWeather } from '../src/js/api/weather.js';
import { correctWind, correctWave, bandOf, octantOf } from '../src/js/api/wind-correction.js';
import { atNow } from '../src/js/api/sea-snapshot.js';
import { amedasDirToDeg } from '../src/js/api/observation.js';

test('気象庁の波の文章：全角・「後」・瀬戸内側の但し書きを読み分ける', () => {
  const t = '１メートル　後　１．５メートル　ただし　瀬戸内側　では　０．５メートル';
  assert.deepEqual(parseJmaWaves(t), [1, 1.5]);
  assert.deepEqual(parseJmaWaves(t, { setouchi: true }), [0.5, 0.5]);
  assert.deepEqual(parseJmaWaves('０．５メートル　後　１メートル', { setouchi: true }), [0.5, 1]);
  assert.equal(parseJmaWaves(''), null);
});

test('met.no の天気記号 → 表示用のコード', () => {
  assert.equal(symbolToWmo('clearsky_night'), 0);
  assert.equal(symbolToWmo('partlycloudy_day'), 2);
  assert.equal(symbolToWmo('lightrainshowers_day'), 80);
  assert.equal(symbolToWmo('heavyrainandthunder'), 95);
  assert.equal(symbolToWmo(null), null);
});

test('時刻は日本時間の正時のキー（サーバーが UTC でも同じ）', () => {
  assert.equal(jstHourKey(new Date('2026-09-24T15:30:00Z')), '2026-09-25T00:00');
});

test('補正：表の無いエリアは生の値／萩は比率（2026-09-29）／時間帯・方位の区切り', () => {
  assert.equal(correctWind('nowhere', { wind: 5.3, windDir: 60, hour: 23 }), 5.3);
  assert.equal(correctWave('kudamatsu', 0.57), 0.57);   // 瀬戸内は気象庁の文章なので補正しない
  assert.equal(correctWind('hagi', { wind: 5.3, windDir: 60, hour: 23 }), 2.0);   // 0.376 × 5.3
  assert.equal(correctWind('hagi', { wind: 20, windDir: 60, hour: 12 }), 7.5);   // 強い風でもつぶれず比例する
  assert.equal(correctWave('hagi', 0.57), 0.46);
  assert.equal(bandOf(5), 'night');
  assert.equal(bandOf(13), 'afternoon');
  assert.equal(octantOf(350), 0);
  assert.equal(octantOf(95), 2);
});

test('アメダスの風向コード：0は静穏、16は北', () => {
  assert.equal(amedasDirToDeg(0), null);
  assert.equal(amedasDirToDeg(16), 0);
  assert.equal(amedasDirToDeg(4), 90);
});

test('埋め込んだ予報の「今」を、開いた時刻の1時間に合わせ直す', () => {
  const w = { current: { wind: 1, gust: 9 }, hourly: [{ time: '2026-09-25T07:00', wind: 3.2, windDir: 10, temp: 20, code: 1, wave: 0.4, wavePeriod: 4 }] };
  const r = atNow(w, new Date(2026, 8, 25, 7, 40));
  assert.equal(r.current.wind, 3.2);
  assert.equal(r.current.gust, null);
  assert.equal(atNow(w, new Date(2026, 8, 25, 9, 0)).current.wind, 1);   // 無い時刻はそのまま
});

test('fetchWeather：取得元をまとめて、画面が使う形（current/hourly/daily）を返す', async () => {
  const now = new Date('2026-09-24T14:10:00Z');   // 日本時間 23:10
  const fake = async (url) => {
    const u = String(url);
    const json = (o) => ({ ok: true, json: async () => o, text: async () => JSON.stringify(o) });
    if (u.includes('api.met.no')) {
      return json({ properties: { meta: { updated_at: 'x' }, timeseries: [
        { time: '2026-09-24T14:00:00Z', data: { instant: { details: { wind_speed: 5.3, wind_from_direction: 60, air_temperature: 19.6 } }, next_1_hours: { summary: { symbol_code: 'fair_night' }, details: { precipitation_amount: 0 } } } },
        { time: '2026-09-24T15:00:00Z', data: { instant: { details: { wind_speed: 5.1, wind_from_direction: 70, air_temperature: 19.4 } }, next_1_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0 } } } },
      ] } });
    }
    if (u.includes('pacioos')) return json({ table: { columnNames: ['time', 'depth', 'latitude', 'longitude', 'Thgt', 'Tper', 'Tdir'], rows: [['2026-09-24T14:00:00Z', 0, 34.5, 131, 0.57, 3.2, 20]] } });
    if (u.includes('forecast/350000')) {
      return json([{ reportDatetime: 'r', timeSeries: [
        { timeDefines: ['2026-09-24T17:00:00+09:00', '2026-09-25T00:00:00+09:00'], areas: [{ area: { code: '350040' }, waves: ['１メートル', '１メートル　後　１．５メートル'] }] },
        { timeDefines: ['2026-09-24T18:00:00+09:00', '2026-09-25T00:00:00+09:00'], areas: [{ area: { code: '350040' }, pops: ['0', '10'] }] },
      ] }]);
    }
    if (u.includes('VPFD/350040')) return json({ areaTimeSeries: { timeDefines: [{ dateTime: '2026-09-24T21:00:00+09:00' }, { dateTime: '2026-09-25T00:00:00+09:00' }], wind: [{ range: '3 5' }, { range: '0 2' }] } });
    if (u.includes('warning/350000')) return json({ areaTypes: [{ areas: [] }, { areas: [{ code: '3520400', warnings: [{ code: '15', status: '発表' }, { code: '16', status: '解除' }] }] }] });
    if (u.includes('latest_time')) return { ok: true, text: async () => '2026-09-24T23:00:00+09:00' };
    if (u.includes('amedas/data/point')) return json({ '20260924230000': { maxTemp: [26.7, 0], minTemp: [17.6, 0] } });
    throw new Error(`unexpected ${u}`);
  };
  const w = await fetchWeather({ id: 'hagi', lat: 34.408, lon: 131.399 }, { now, fetchImpl: fake });
  // 23時：met.no 5.3 × 0.376 = 2.0 と、気象庁 時系列 3〜5（真ん中 4）の強いほう
  assert.equal(w.current.wind, 4);
  assert.equal(w.hourly[0].windRaw, 5.3);
  assert.equal(w.hourly[0].windJma, 4);
  assert.equal(w.hourly[1].wind, 1.9);   // 0時：5.1 × 0.376 = 1.9 と 0〜2（1）の強いほう
  assert.equal(w.current.gust, null);
  assert.equal(w.current.wave, 0.46);
  assert.deepEqual(w.current.alerts.map((a) => a.name), ['強風注意報']);   // 解除は数えない
  assert.equal(w.hourly[0].time, '2026-09-24T23:00');
  assert.equal(w.hourly[1].pop, 10);
  assert.equal(w.daily[0].tMax, 26.7);   // 過ぎた時間の分はアメダスの実測で補う
  assert.equal(w.daily[0].tMin, 17.6);
});

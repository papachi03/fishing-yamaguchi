// 2026-09-30：NOAA が取れなかった時に、気象庁の地域の予報文「1.5メートル」がそのまま入って萩が「中止」になった件と、
// アメダスの最大瞬間の時刻が世界標準時のまま出ていた件
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather, prevWavesOf } from '../src/js/api/weather.js';
import { correctWave } from '../src/js/api/wind-correction.js';
import { assessSafety } from '../src/js/api/safety.js';
import { fetchObservation } from '../src/js/api/observation.js';
import { atNow } from '../src/js/api/sea-snapshot.js';

const json = (o) => ({ ok: true, json: async () => o, text: async () => JSON.stringify(o) });
const down = { ok: false, status: 503, json: async () => ({}) };

const baseFake = async (url) => {
  const u = String(url);
  if (u.includes('api.met.no')) {
    return json({ properties: { meta: { updated_at: 'x' }, timeseries: [
      { time: '2026-09-29T15:00:00Z', data: { instant: { details: { wind_speed: 1.3, wind_from_direction: 160, air_temperature: 19.3 } }, next_1_hours: { summary: { symbol_code: 'clearsky_night' }, details: { precipitation_amount: 0 } } } },
    ] } });
  }
  if (u.includes('pacioos')) return json({ table: { columnNames: ['time', 'depth', 'latitude', 'longitude', 'Thgt', 'Tper', 'Tdir'], rows: [['2026-09-29T15:00:00Z', 0, 34.5, 131, 0.9, 4, 20]] } });
  if (u.includes('forecast/350000')) {
    return json([{ reportDatetime: 'r', timeSeries: [
      { timeDefines: ['2026-09-30T00:00:00+09:00'], areas: [{ area: { code: '350040' }, waves: ['１．５メートル'] }, { area: { code: '350020' }, waves: ['０．５メートル'] }] },
      { timeDefines: ['2026-09-30T00:00:00+09:00'], areas: [{ area: { code: '350040' }, pops: ['0'] }, { area: { code: '350020' }, pops: ['0'] }] },
    ] }]);
  }
  if (u.includes('VPFD')) return json({ areaTimeSeries: { timeDefines: [{ dateTime: '2026-09-30T00:00:00+09:00' }], wind: [{ range: '0 2' }] } });
  if (u.includes('warning/350000')) return json({ areaTypes: [{ areas: [] }, { areas: [] }] });
  if (u.includes('latest_time')) return { ok: true, text: async () => '2026-09-30T00:10:00+09:00' };
  if (u.includes('amedas/data/point')) return json({});
  throw new Error(`unexpected ${u}`);
};
const noNoaa = async (url) => (String(url).includes('pacioos') ? down : baseFake(url));
const HAGI = { id: 'hagi', lat: 34.408, lon: 131.399 };
const NOW = new Date('2026-09-29T15:20:00Z');   // 日本時間 9/30 0:20

test('波：NOAA が取れた時は NOAA（補正あり）', async () => {
  const w = await fetchWeather(HAGI, { now: NOW, fetchImpl: baseFake });
  assert.equal(w.current.waveSrc, 'ww3');
  assert.equal(w.current.waveRough, false);
  assert.equal(w.current.wave, correctWave('hagi', 0.9));
});

test('波：NOAA が1回目だけ失敗した時は取り直す', async () => {
  let n = 0;
  const flaky = async (url) => (String(url).includes('pacioos') && n++ === 0 ? down : baseFake(url));
  const w = await fetchWeather(HAGI, { now: NOW, fetchImpl: flaky });
  assert.equal(w.current.waveSrc, 'ww3');
});

test('波：NOAA が取れない時は、前回取れた NOAA の値を使う（代用の値は引き継がない）', async () => {
  const prevWaves = prevWavesOf({ fetchedAt: '2026-09-29T09:56:00Z', hourly: [
    { time: '2026-09-30T00:00', wave: 0.7, wavePeriod: 4, waveSrc: 'ww3' },
    { time: '2026-09-30T01:00', wave: 1.5, waveSrc: 'jma-rough' },
  ] }, NOW);
  assert.deepEqual(Object.keys(prevWaves), ['2026-09-30T00:00']);
  const w = await fetchWeather(HAGI, { now: NOW, fetchImpl: noNoaa, prevWaves });
  assert.equal(w.current.waveSrc, 'ww3-prev');
  assert.equal(w.current.wave, 0.7);
});

test('波：前回の予報が12時間より古ければ使わない', () => {
  assert.equal(prevWavesOf({ fetchedAt: '2026-09-29T02:00:00Z', hourly: [{ time: '2026-09-30T00:00', wave: 0.7, waveSrc: 'ww3' }] }, NOW), null);
  assert.equal(prevWavesOf(null, NOW), null);
});

test('波：NOAA も前回の値も無い時は気象庁の予報文で代用し、判定は「危険」まで（中止にしない）', async () => {
  const w = await fetchWeather(HAGI, { now: NOW, fetchImpl: noNoaa });
  assert.equal(w.current.waveSrc, 'jma-rough');
  assert.equal(w.current.waveRough, true);
  assert.equal(w.current.wave, 1.5);
  // 9/29 18時の萩（風4m/s 北東＝向かい風、波1.5m）：代用の波なら「危険」
  const rough = assessSafety({ waveHeight: 1.5, waveRough: true, wind: 4, windDir: 40, facing: 0 });
  assert.equal(rough.level, 2);
  assert.ok(rough.reasons.some((r) => r.includes('気象庁の地域の目安')));
  // NOAA の1.5m なら今までどおり「中止」
  assert.equal(assessSafety({ waveHeight: 1.5, wind: 1 }).level, 3);
  // 代用でも、風そのもので中止なら中止
  assert.equal(assessSafety({ waveHeight: 1.5, waveRough: true, wind: 8 }).level, 3);
});

test('画面で「今の時間」に合わせ直しても、代用の印は引き継ぐ', () => {
  const w = atNow({ current: { wave: 0.7 }, hourly: [{ time: '2026-09-30T00:00', wind: 1, wave: 1.5, waveSrc: 'jma-rough' }] }, new Date(2026, 8, 30, 0, 20));
  assert.equal(w.current.waveRough, true);
});

test('瀬戸内（防府）は気象庁の予報文が本来の取り先なので、代用扱いにしない', async () => {
  const w = await fetchWeather({ id: 'hofu', lat: 34.0, lon: 131.5 }, { now: NOW, fetchImpl: baseFake });
  assert.equal(w.current.waveSrc, 'jma');
  assert.equal(w.current.waveRough, false);
});

test('アメダスの最大瞬間の時刻は世界標準時で届く → 日本時間に直す', async () => {
  const fake = async (u) => {
    if (String(u).includes('latest_time')) return { ok: true, text: async () => '2026-09-30T00:10:00+09:00' };
    return json({ '20260930001000': { wind: [2.6, 0], windDirection: [8, 0], gust: [4.5, 0], gustTime: { hour: 15, minute: 9 } } });
  };
  const o = await fetchObservation('hagi', fake);
  assert.equal(o.gustAt, '0:09');
});

test('実測は判定を上げるだけ：予報より強ければ実測の風で、弱くても下げない', () => {
  assert.equal(assessSafety({ wind: 2, obsWind: 5.5 }).level, 2);
  assert.ok(assessSafety({ wind: 2, obsWind: 5.5 }).reasons[0].includes('（実測）'));
  assert.equal(assessSafety({ wind: 6, obsWind: 1 }).level, 2);
  assert.equal(assessSafety({ wind: null, obsWind: 7.2 }).level, 3);
  assert.equal(assessSafety({ wind: 2, obsWind: null }).level, 0);
});

test('実測が「新しい」のは40分以内だけ', async () => {
  const { freshObs } = await import('../src/js/pages/sea-render.js');
  const now = new Date(2026, 8, 30, 0, 30);
  assert.ok(freshObs({ atMs: new Date(2026, 8, 30, 0, 10).getTime(), wind: 2.6 }, now));
  assert.equal(freshObs({ atMs: new Date(2026, 8, 29, 23, 40).getTime(), wind: 2.6 }, now), null);
  assert.equal(freshObs({ atMs: new Date(2026, 8, 30, 0, 10).getTime(), wind: null }, now), null);
  assert.equal(freshObs(null, now), null);
});

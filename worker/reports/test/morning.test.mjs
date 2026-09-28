import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { sendMorningDraft, morningRows, hourAt } from '../src/morning.js';

// 予報ファイルが無い日（Open-Meteoへ直接聞く）を基本にする
const noSnap = async () => null;
import { makeEnv, stubFetch, makeCtx } from './fakes.mjs';

// 萩だけ強風、ほかは穏やか、という偽の予報
const calm = { wind: 1.2, gust: 2.0, wave: 0.3, wavePeriod: 4, windDir: 180 };
const fakeWeather = async (area) => ({
  current: area.id === 'hagi' ? { wind: 7.5, gust: 12, wave: 1.6, wavePeriod: 6, windDir: 0 } : calm,
});

// 2026-09-22 22:00 UTC ＝ 日本時間 9/23(水) 7:00
const NOW = new Date('2026-09-22T22:00:00Z');

test('5エリアの判定を作る（SEAページと同じ関数）', async () => {
  const rows = await morningRows(fakeWeather);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { nameJa: '萩', level: 3, wind: 7.5 });
  assert.equal(rows.find((r) => r.nameJa === '下松').level, 0);
});

test('予報を取れなかったエリアは level: null で、他のエリアは続ける', async () => {
  const flaky = async (area) => {
    if (area.id === 'nagato') throw new Error('timeout');
    return { current: calm };
  };
  const rows = await morningRows(flaky);
  assert.equal(rows.find((r) => r.nameJa === '長門').level, null);
  assert.equal(rows.find((r) => r.nameJa === '萩').level, 0);
});

test('Discordに下書きと「Xで投稿する」リンクを送る（メンションは展開させない）', async () => {
  const env = makeEnv();
  const f = stubFetch(() => new Response(null, { status: 204 }));
  try {
    const ok = await sendMorningDraft(env, { now: NOW, getSnapshot: noSnap, fetchW: fakeWeather });
    assert.equal(ok, true);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].url, env.DISCORD_WEBHOOK_URL);
    const body = JSON.parse(f.calls[0].init.body);
    assert.match(body.content, /朝の堤防判定（X投稿の下書き）/);
    assert.match(body.content, /【9\/23\(水\) 朝の堤防判定】/);
    assert.match(body.content, /萩　🔴中止　風7\.5m/);
    assert.match(body.content, /https:\/\/x\.com\/intent\/post\?text=/);
    assert.doesNotMatch(body.content, /安全/, 'SNSでは「安全」と書かない');
    assert.deepEqual(body.allowed_mentions, { parse: [] });
    assert.ok(body.content.length <= 2000, 'Discordの上限を超えている');
  } finally {
    f.restore();
  }
});

test('メンション先が設定されていれば、その1人だけを@で呼んで鳴らす', async () => {
  const env = makeEnv({ DISCORD_MENTION_USER_ID: '427260359473364992' });
  const f = stubFetch(() => new Response(null, { status: 204 }));
  try {
    await sendMorningDraft(env, { now: NOW, getSnapshot: noSnap, fetchW: fakeWeather });
    const body = JSON.parse(f.calls[0].init.body);
    assert.match(body.content, /^<@427260359473364992>\n/);
    assert.deepEqual(body.allowed_mentions, { parse: [], users: ['427260359473364992'] });
    // X投稿リンクの本文にはメンションが混ざらない
    const intent = body.content.match(/https:\/\/x\.com\/intent\/post\?text=\S+/)[0];
    assert.doesNotMatch(decodeURIComponent(intent), /<@/);
  } finally {
    f.restore();
  }
});

test('メンション先がIDの形でなければ、メンションしない', async () => {
  const env = makeEnv({ DISCORD_MENTION_USER_ID: '@everyone' });
  const f = stubFetch(() => new Response(null, { status: 204 }));
  try {
    await sendMorningDraft(env, { now: NOW, getSnapshot: noSnap, fetchW: fakeWeather });
    const body = JSON.parse(f.calls[0].init.body);
    assert.doesNotMatch(body.content, /^<@/);
    assert.deepEqual(body.allowed_mentions, { parse: [] });
  } finally {
    f.restore();
  }
});

test('全エリア取得できなかった日は、その旨を先頭に出す', async () => {
  const env = makeEnv();
  const f = stubFetch(() => new Response(null, { status: 204 }));
  try {
    await sendMorningDraft(env, { now: NOW, getSnapshot: noSnap, fetchW: async () => { throw new Error('down'); } });
    const body = JSON.parse(f.calls[0].init.body);
    assert.match(body.content, /^⚠ 予報を取得できませんでした/);
  } finally {
    f.restore();
  }
});

test('Webhookが未設定なら何も送らない', async () => {
  const env = makeEnv({ DISCORD_WEBHOOK_URL: undefined });
  const f = stubFetch(() => new Response(null, { status: 204 }));
  try {
    assert.equal(await sendMorningDraft(env, { now: NOW, getSnapshot: noSnap, fetchW: fakeWeather }), false);
    assert.equal(f.calls.length, 0);
  } finally {
    f.restore();
  }
});

test('Workerの定期実行（scheduled）が用意されている', () => {
  assert.equal(typeof worker.scheduled, 'function');
  const { ctx } = makeCtx();
  assert.ok(ctx.waitUntil);
});

// 9/23 7:00 JST の時間帯を持つ予報ファイル。萩だけ強風
const hourly = (wind) => [
  { time: '2026-09-23T06:00', wind: 9, gust: 14, wave: 2, wavePeriod: 6, windDir: 0 },
  { time: '2026-09-23T07:00', wind, gust: wind * 1.5, wave: 0.3, wavePeriod: 4, windDir: 180 },
];
const snapshot = {
  fetchedAt: '2026-09-22T20:17:00Z',
  areas: { hagi: { hourly: hourly(7.5) }, nagato: { hourly: hourly(1.1) }, shimonoseki: { hourly: hourly(1.2) }, kudamatsu: { hourly: hourly(1.3) } },
};

test('予報ファイルの「今の時間帯（日本時間の正時）」の値を使う', () => {
  assert.equal(hourAt(snapshot.areas.hagi, NOW).time, '2026-09-23T07:00');
  assert.equal(hourAt(snapshot.areas.hagi, new Date('2026-09-22T22:59:00Z')).time, '2026-09-23T07:00');
  assert.equal(hourAt(snapshot.areas.hagi, new Date('2026-09-22T23:00:00Z')), null, '8時台の値は無い');
  assert.equal(hourAt(undefined, NOW), null);
});

test('予報ファイルにある地域はそれを使い、欠けている地域だけOpen-Meteoへ直接聞く', async () => {
  const asked = [];
  const direct = async (area) => { asked.push(area.id); return { current: calm }; };
  const rows = await morningRows(direct, { snapshot, now: NOW });
  const ids = ['hagi', 'nagato', 'shimonoseki', 'kudamatsu', 'hofu'];
  const missing = ids.filter((id) => !snapshot.areas[id]);
  assert.deepEqual(asked, missing);
  assert.equal(rows[0].wind, 7.5);
  assert.equal(rows[0].level, 3);
});

test('送信：予報ファイルを使い、見出しは送った時刻で変わる（夜に送れば「夜の」）', async () => {
  const env = makeEnv();
  const f = stubFetch(() => new Response(null, { status: 204 }));
  try {
    const night = new Date('2026-09-23T12:30:00Z'); // 21:30 JST
    const nightSnap = { fetchedAt: '2026-09-23T11:00:00Z', areas: Object.fromEntries(Object.keys(snapshot.areas).map((k) => [k, { hourly: [{ time: '2026-09-23T21:00', wind: 2, gust: 3, wave: 0.3, wavePeriod: 4, windDir: 180 }] }])) };
    await sendMorningDraft(env, { now: night, getSnapshot: async () => nightSnap, fetchW: async () => ({ current: calm }) });
    const body = JSON.parse(f.calls[0].init.body);
    assert.match(body.content, /🌙 夜の堤防判定（X投稿の下書き）/);
    assert.match(body.content, /【9\/23\(水\) 夜の堤防判定】/);
    assert.doesNotMatch(body.content, /朝の堤防判定/);
  } finally {
    f.restore();
  }
});

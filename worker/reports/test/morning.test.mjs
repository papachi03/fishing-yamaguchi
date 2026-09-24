import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { sendMorningDraft, morningRows } from '../src/morning.js';
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
    const ok = await sendMorningDraft(env, { now: NOW, fetchW: fakeWeather });
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
    await sendMorningDraft(env, { now: NOW, fetchW: fakeWeather });
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
    await sendMorningDraft(env, { now: NOW, fetchW: fakeWeather });
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
    await sendMorningDraft(env, { now: NOW, fetchW: async () => { throw new Error('down'); } });
    const body = JSON.parse(f.calls[0].init.body);
    assert.match(body.content, /^⚠ 今朝は予報を取得できませんでした/);
  } finally {
    f.restore();
  }
});

test('Webhookが未設定なら何も送らない', async () => {
  const env = makeEnv({ DISCORD_WEBHOOK_URL: undefined });
  const f = stubFetch(() => new Response(null, { status: 204 }));
  try {
    assert.equal(await sendMorningDraft(env, { now: NOW, fetchW: fakeWeather }), false);
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

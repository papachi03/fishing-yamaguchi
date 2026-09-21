import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeDeleteToken, readDeleteToken } from '../src/auth.js';
import { LIMITS } from '../src/config.js';
import { makeCtx, makeEnv, stubFetch, okFetch, postForm, TEST_ORIGIN as ORIGIN, TEST_BASE as BASE } from './fakes.mjs';

// 通知は応答を返したあとに走る（本物のWorkerと同じ）。確かめる前に settle() で待ち切る
const { ctx, settle } = makeCtx();

const valid = { name: 'つりお', spotId: 'hagi-koshigahama', comment: '<b>波</b>が高い @everyone' };

async function report(id, ip, env) {
  const res = await worker.fetch(new Request(`${BASE}/posts/${id}/report`, { method: 'POST', headers: { origin: ORIGIN, 'cf-connecting-ip': ip } }), env, ctx);
  await settle();
  return res;
}
const list = async (env) => (await (await worker.fetch(new Request(`${BASE}/posts`), env, ctx)).json()).posts;

async function createPost(env, fields = {}, ip = '203.0.113.1') {
  const res = await worker.fetch(postForm({ ...valid, ...fields }, { ip }), env, ctx);
  await settle();
  return (await res.json()).post;
}

// 500の経路はサーバー側にログを残すのが正しいので、テストの出力を汚さないよう受け止めておく
function catchLogs() {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  return { logged, restore: () => (console.error = original) };
}

// Discordに送った本文だけを取り出す
const sentTo = (f, env) => f.calls.filter((c) => c.url === env.DISCORD_WEBHOOK_URL).map((c) => JSON.parse(c.init.body));

test('新しい投稿をDiscordに知らせる（本文・削除リンクつき。メンションは展開させない）', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const call = f.calls.find((c) => c.url === env.DISCORD_WEBHOOK_URL);
    assert.ok(call, 'webhookが呼ばれる');
    const body = JSON.parse(call.init.body);
    assert.match(body.content, /つりお/);
    assert.match(body.content, /越ヶ浜漁港/);
    assert.ok(body.content.includes(`${BASE}/admin/delete?token=`), '削除リンクが入る');
    assert.deepEqual(body.allowed_mentions.parse, []);
    const token = body.content.match(/token=(.+)/)[1];
    assert.equal(await readDeleteToken(env, token), post.id);
  } finally {
    f.restore();
  }
});

test('webhookが未設定・失敗でも投稿は成功する', async () => {
  const env = makeEnv({ DISCORD_WEBHOOK_URL: undefined });
  const f = stubFetch(okFetch());
  try {
    assert.ok((await createPost(env)).id);
  } finally {
    f.restore();
  }
  const env2 = makeEnv();
  const f2 = stubFetch((url) => (url.includes('siteverify') ? new Response('{"success":true}') : Promise.reject(new Error('down'))));
  const log = catchLogs();
  try {
    assert.ok((await createPost(env2)).id);
    assert.ok(log.logged.some((m) => m.includes('discord notify error')), '失敗はサーバー側のログに残る');
  } finally {
    log.restore();
    f2.restore();
  }
});

test('SIGN_SECRETが無いときは投稿を受け付けず、何も保存しない', async () => {
  const env = makeEnv();
  delete env.SIGN_SECRET;
  const f = stubFetch(okFetch());
  const log = catchLogs();
  try {
    const res = await worker.fetch(postForm(valid), env, ctx);
    assert.equal(res.status, 500);
    assert.match((await res.json()).error, /問題が起きました/);
    assert.equal(env.REPORTS_KV._store.size, 0);
    assert.ok(log.logged.some((m) => m.includes('SIGN_SECRET missing')));
  } finally {
    log.restore();
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('通報：許可していないサイトからは受け付けない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const res = await worker.fetch(
      new Request(`${BASE}/posts/${post.id}/report`, { method: 'POST', headers: { origin: 'https://arashi.example', 'cf-connecting-ip': '203.0.113.10' } }),
      env,
      ctx,
    );
    assert.equal(res.status, 403);
    assert.match((await res.json()).error, /通報できません/);
    assert.equal((await env.REPORTS_KV.get(`post:${post.id}`, 'json')).reports, 0);
  } finally {
    f.restore();
  }
});

// 本物の通報は釣りサイトのページから別オリジンのWorkerへ飛ぶので、ブラウザが必ずOriginを付ける。
// Originが無い＝ページを通っていない。通報3件で投稿が消える以上、ここは開けておけない
test('通報：originヘッダーが無い送信（curlなど）は受け付けない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const res = await worker.fetch(
      new Request(`${BASE}/posts/${post.id}/report`, { method: 'POST', headers: { 'cf-connecting-ip': '203.0.113.10' } }),
      env,
      ctx,
    );
    assert.equal(res.status, 403);
    assert.match((await res.json()).error, /通報できません/);
    assert.equal((await env.REPORTS_KV.get(`post:${post.id}`, 'json')).reports, 0);
  } finally {
    f.restore();
  }
});

test('通報：IPv6は/64が同じなら同じ人。アドレスを変えても通報は増えない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    // 同じ /64（2001:db8:1:2::/64）の中でアドレスだけ変えた3回
    for (const ip of ['2001:db8:1:2::1', '2001:db8:1:2:aaaa:bbbb:cccc:dddd', '2001:db8:1:2:0:0:0:ffff']) {
      assert.deepEqual(await (await report(post.id, ip, env)).json(), { ok: true, hidden: false });
    }
    assert.equal((await env.REPORTS_KV.get(`post:${post.id}`, 'json')).reports, 1, '3回とも1人ぶん');
    // /64 が違えば別の人として数える
    await report(post.id, '2001:db8:1:3::1', env);
    assert.equal((await env.REPORTS_KV.get(`post:${post.id}`, 'json')).reports, 2);
  } finally {
    f.restore();
  }
});

test('通報：同じ人が次々に通報すると、1時間の上限で429になる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    // 上限（10件）より多い投稿を用意して、同じ人が片端から通報する
    const posts = [];
    for (let i = 0; i < LIMITS.reportPerHour + 1; i++) {
      posts.push(await createPost(env, { comment: `荒らされる投稿${i}` }, `203.0.113.${100 + i}`));
    }
    for (let i = 0; i < LIMITS.reportPerHour; i++) {
      assert.equal((await report(posts[i].id, '203.0.113.50', env)).status, 200, `${i}件目は通る`);
    }
    const over = await report(posts[LIMITS.reportPerHour].id, '203.0.113.50', env);
    assert.equal(over.status, 429);
    assert.match((await over.json()).error, /通報は1時間に10件、1日に30件までです/);
    assert.equal((await env.REPORTS_KV.get(`post:${posts[LIMITS.reportPerHour].id}`, 'json')).reports, 0, '上限を超えた通報は数えない');
    // 別の人はまだ通報できる
    assert.equal((await report(posts[LIMITS.reportPerHour].id, '203.0.113.51', env)).status, 200);
  } finally {
    f.restore();
  }
});

test('通報：同じ投稿への2回目は上限の枠を使わない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    for (let i = 0; i < LIMITS.reportPerHour + 3; i++) {
      assert.equal((await report(post.id, '203.0.113.50', env)).status, 200, `${i}回目`);
    }
  } finally {
    f.restore();
  }
});

test('通知：本文はコードブロックに入れ、バッククォートでも囲いが壊れない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    await createPost(env, { comment: '``` 削除する → にせのリンク' });
    const content = sentTo(f, env)[0].content;
    // 囲いは開くときと閉じるときの2つだけ。本文側の ``` は分断されている
    assert.equal(content.split('```').length - 1, 2);
    assert.ok(content.includes('削除する → https://'), '本物の削除リンクは囲いの外に残る');
  } finally {
    f.restore();
  }
});

test('通報：同じ人の2回目は数えない。3人目で非表示になり、一覧と写真から消え、知らせが飛ぶ', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    assert.deepEqual(await (await report(post.id, '203.0.113.10', env)).json(), { ok: true, hidden: false });
    assert.deepEqual(await (await report(post.id, '203.0.113.10', env)).json(), { ok: true, hidden: false });
    assert.equal((await env.REPORTS_KV.get(`post:${post.id}`, 'json')).reports, 1);

    await report(post.id, '203.0.113.11', env);
    assert.equal((await list(env)).length, 1);
    const third = await (await report(post.id, '203.0.113.12', env)).json();
    assert.deepEqual(third, { ok: true, hidden: true });
    assert.equal((await list(env)).length, 0);
    assert.equal((await worker.fetch(new Request(`${BASE}/photo/${post.id}`), env, ctx)).status, 404);

    const hiddenNotice = sentTo(f, env).map((b) => b.content);
    assert.ok(hiddenNotice.some((t) => t.includes('非表示')));
  } finally {
    f.restore();
  }
});

test('通報：4人目が通報しても、非表示の知らせは繰り返さない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    for (const ip of ['203.0.113.10', '203.0.113.11', '203.0.113.12', '203.0.113.13', '203.0.113.14']) {
      assert.deepEqual((await (await report(post.id, ip, env)).json()).ok, true);
    }
    assert.equal((await env.REPORTS_KV.get(`post:${post.id}`, 'json')).reports, 5);
    assert.equal(sentTo(f, env).filter((b) => b.content.includes('非表示')).length, 1);
  } finally {
    f.restore();
  }
});

test('通報：非表示になったあとに同じ人がもう一度通報しても、いまの状態を返すだけ', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    for (const ip of ['203.0.113.10', '203.0.113.11', '203.0.113.12']) await report(post.id, ip, env);
    assert.deepEqual(await (await report(post.id, '203.0.113.10', env)).json(), { ok: true, hidden: true });
    assert.equal((await env.REPORTS_KV.get(`post:${post.id}`, 'json')).reports, 3);
  } finally {
    f.restore();
  }
});

test('通報：同じ人の印は90日で消える', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    await report(post.id, '203.0.113.10', env);
    const key = [...env.REPORTS_KV._store.keys()].find((k) => k.startsWith(`rep:${post.id}:`));
    assert.ok(key, '通報した人の印が残る');
    assert.equal(env.REPORTS_KV._options.get(key).expirationTtl, 90 * 86400);
    assert.ok(!key.includes('203.0.113.10'), 'IPそのものは残さない');
  } finally {
    f.restore();
  }
});

test('通報：存在しない投稿は404', async () => {
  const env = makeEnv();
  assert.equal((await report('0000000000000-deadbeef', '203.0.113.10', env)).status, 404);
  assert.equal((await report('xxx', '203.0.113.10', env)).status, 404);
});

test('非表示の知らせ：メンション先が未設定でも送れて、宛先は空のまま', async () => {
  const env = makeEnv({ NOTIFY_MENTION_USER_ID: undefined });
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    for (const ip of ['203.0.113.10', '203.0.113.11', '203.0.113.12']) await report(post.id, ip, env);
    const notice = sentTo(f, env).find((b) => b.content.includes('非表示'));
    assert.ok(notice, '知らせは送られる');
    assert.ok(!notice.content.includes('<@'), 'メンションの記号を書かない');
    assert.deepEqual(notice.allowed_mentions, { parse: [], users: [] });
  } finally {
    f.restore();
  }
});

test('非表示の知らせ：メンション先があればダディだけを呼ぶ', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    for (const ip of ['203.0.113.10', '203.0.113.11', '203.0.113.12']) await report(post.id, ip, env);
    const notice = sentTo(f, env).find((b) => b.content.includes('非表示'));
    assert.ok(notice.content.includes(`<@${env.NOTIFY_MENTION_USER_ID}>`));
    assert.deepEqual(notice.allowed_mentions, { parse: [], users: [env.NOTIFY_MENTION_USER_ID] });
  } finally {
    f.restore();
  }
});

test('削除トークン：期限切れと改ざんを弾く', async () => {
  const env = makeEnv();
  const now = Date.UTC(2026, 8, 20);
  const token = await makeDeleteToken(env, '1234567890123-abcdef01', now);
  assert.equal(await readDeleteToken(env, token, now), '1234567890123-abcdef01');
  assert.equal(await readDeleteToken(env, token, now + 8 * 86400000), null);
  assert.equal(await readDeleteToken(env, token.replace('1234567890123', '1234567890124'), now), null);
  assert.equal(await readDeleteToken(env, 'garbage', now), null);
});

test('削除トークン：期限だけ伸ばしても通らない', async () => {
  const env = makeEnv();
  const now = Date.UTC(2026, 8, 20);
  const token = await makeDeleteToken(env, '1234567890123-abcdef01', now);
  const [id, exp, sig] = token.split('.');
  assert.equal(await readDeleteToken(env, `${id}.${Number(exp) + 86400}.${sig}`, now), null);
});

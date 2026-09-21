import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeDeleteToken, makeAdminCookie } from '../src/auth.js';
import { makeCtx, makeEnv, stubFetch, okFetch, jpegBytes, postForm, TEST_ORIGIN as ORIGIN, TEST_BASE as BASE } from './fakes.mjs';

// 通知は応答を返したあとに走る。確かめる前に settle() で待ち切る
const { ctx, settle } = makeCtx();

const valid = { name: 'つりお', spotId: 'hagi-koshigahama', comment: '<script>alert(1)</script>' };

// 管理ページはWorker自身が返すので、フォームの送信元originはWorkerのorigin（=BASE）になる。
// origin: null を渡すとヘッダーそのものを付けない（素の<form>送信でOriginが付かないブラウザの再現）
const call = (path, env, { method = 'GET', cookie = '', form = null, origin = BASE, secFetchSite, referer, ip = '203.0.113.50' } = {}) =>
  worker.fetch(
    new Request(`${BASE}${path}`, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(origin !== null ? { origin } : {}),
        ...(secFetchSite ? { 'sec-fetch-site': secFetchSite } : {}),
        ...(referer ? { referer } : {}),
        'cf-connecting-ip': ip,
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
      redirect: 'manual',
    }),
    env,
    ctx
  );

async function login(env) {
  const res = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'aikotoba-test' } });
  assert.equal(res.status, 303);
  return res.headers.get('set-cookie').split(';')[0];
}

async function createPost(env, opts) {
  const res = await worker.fetch(postForm(valid, opts), env, ctx);
  await settle();
  return (await res.json()).post;
}

const publicPosts = async (env) => (await (await worker.fetch(new Request(`${BASE}/posts`), env, ctx)).json()).posts;

test('合言葉なしでは一覧を見せず、入力欄を出す（検索に載せない）', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    await createPost(env);
    const res = await call('/admin', env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const html = await res.text();
    assert.match(html, /合言葉/);
    assert.match(html, /noindex, nofollow/);
    assert.doesNotMatch(html, /つりお/);
  } finally {
    f.restore();
  }
});

test('合言葉が違うと入れない。6回目は回数制限', async () => {
  const env = makeEnv();
  for (let i = 0; i < 5; i++) {
    const res = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'wrong' } });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
  }
  const blocked = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'aikotoba-test' } });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('set-cookie'), null);
});

test('合言葉の送信はよそのサイトからは受け取らない', async () => {
  const env = makeEnv();
  const res = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'aikotoba-test' }, origin: 'https://evil.example' });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('Cookieは HttpOnly・Secure・SameSite=Strict・/admin 限定', async () => {
  const env = makeEnv();
  const res = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'aikotoba-test' } });
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const c = res.headers.get('set-cookie');
  for (const part of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/admin', 'Max-Age=604800']) assert.ok(c.includes(part), part);
});

test('細工したCookieでは入れない', async () => {
  const env = makeEnv();
  const cookie = await login(env);
  const [, value] = cookie.split('=');
  const [exp] = value.split('.');
  // 署名を作り直さずに期限だけ伸ばす／署名を差し替える、のどちらも通らない
  for (const bad of [`yfj_admin=${Number(exp) + 86400}.${value.split('.')[1]}`, `yfj_admin=${exp}.${'0'.repeat(64)}`, 'yfj_admin=']) {
    const res = await call('/admin', env, { cookie: bad });
    assert.match(await res.text(), /合言葉/, bad);
  }
});

test('期限の切れたCookieでは入れない', async () => {
  const env = makeEnv();
  const expired = (await makeAdminCookie(env, Date.now() - 8 * 86400 * 1000)).split(';')[0];
  const res = await call('/admin', env, { cookie: expired });
  assert.match(await res.text(), /合言葉/);
});

test('一覧には非表示の投稿も出て、本文はエスケープされる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const stored = await env.REPORTS_KV.get(`post:${post.id}`, 'json');
    await env.REPORTS_KV.put(`post:${post.id}`, JSON.stringify({ ...stored, hidden: true, reports: 3 }));
    const html = await (await call('/admin', env, { cookie: await login(env) })).text();
    assert.match(html, /非表示/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
  } finally {
    f.restore();
  }
});

test('削除：本文も写真も消え、一覧からも消える。Cookieなし・よそのサイトからは拒否', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env, { photo: jpegBytes() });
    const cookie = await login(env);
    assert.equal((await call(`/admin/posts/${post.id}/delete`, env, { method: 'POST' })).status, 403);
    assert.equal((await call(`/admin/posts/${post.id}/delete`, env, { method: 'POST', cookie, origin: 'https://evil.example' })).status, 403);
    // GETでは消えない（リンクを踏ませるだけで削除されない）
    await call(`/admin/posts/${post.id}/delete`, env, { cookie });
    assert.ok(await env.REPORTS_KV.get(`post:${post.id}`), 'GETでは残っている');

    const res = await call(`/admin/posts/${post.id}/delete`, env, { method: 'POST', cookie });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('location'), '/admin');
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal(await env.REPORTS_KV.get(`post:${post.id}`), null);
    assert.equal((await env.REPORTS_KV.getWithMetadata(`photo/${post.id}.jpg`)).value, null);
    assert.equal((await publicPosts(env)).length, 0);
  } finally {
    f.restore();
  }
});

test('削除：素の<form>送信でOriginが付かないブラウザでも sec-fetch-site: same-origin なら通る', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const cookie = await login(env);
    const res = await call(`/admin/posts/${post.id}/delete`, env, {
      method: 'POST',
      cookie,
      origin: null,
      secFetchSite: 'same-origin',
    });
    assert.equal(res.status, 303);
    assert.equal(await env.REPORTS_KV.get(`post:${post.id}`), null);
  } finally {
    f.restore();
  }
});

test('削除：Originが無く sec-fetch-site が cross-site、または両方無いときは従来どおり拒否', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const cookie = await login(env);
    assert.equal(
      (
        await call(`/admin/posts/${post.id}/delete`, env, {
          method: 'POST',
          cookie,
          origin: null,
          secFetchSite: 'cross-site',
        })
      ).status,
      403
    );
    assert.equal(
      (await call(`/admin/posts/${post.id}/delete`, env, { method: 'POST', cookie, origin: null })).status,
      403
    );
    assert.ok(await env.REPORTS_KV.get(`post:${post.id}`), '拒否されて残っている');
  } finally {
    f.restore();
  }
});

test('再表示：非表示を解いて通報数を0に戻し、一覧に戻る', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    for (const ip of ['203.0.113.21', '203.0.113.22', '203.0.113.23']) {
      await worker.fetch(new Request(`${BASE}/posts/${post.id}/report`, { method: 'POST', headers: { origin: ORIGIN, 'cf-connecting-ip': ip } }), env, ctx);
    }
    await settle();
    assert.equal((await publicPosts(env)).length, 0, '通報3件で非表示になっている');

    const cookie = await login(env);
    assert.equal((await call(`/admin/posts/${post.id}/restore`, env, { method: 'POST', cookie })).status, 303);
    const stored = await env.REPORTS_KV.get(`post:${post.id}`, 'json');
    assert.equal(stored.hidden, false);
    assert.equal(stored.reports, 0);
    assert.equal((await publicPosts(env)).length, 1);
  } finally {
    f.restore();
  }
});

test('再表示もCookieとよそのサイトの確認をする', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    assert.equal((await call(`/admin/posts/${post.id}/restore`, env, { method: 'POST' })).status, 403);
    const cookie = await login(env);
    assert.equal((await call(`/admin/posts/${post.id}/restore`, env, { method: 'POST', cookie, origin: 'https://evil.example' })).status, 403);
  } finally {
    f.restore();
  }
});

test('管理用の写真は、非表示の投稿でも見られる（Cookie必須）', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env, { photo: jpegBytes() });
    const stored = await env.REPORTS_KV.get(`post:${post.id}`, 'json');
    await env.REPORTS_KV.put(`post:${post.id}`, JSON.stringify({ ...stored, hidden: true }));
    assert.equal((await call(`/admin/photo/${post.id}`, env)).status, 403);
    const res = await call(`/admin/photo/${post.id}`, env, { cookie: await login(env) });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
    // 公開の経路では、非表示の投稿の写真は見られないまま
    assert.equal((await worker.fetch(new Request(`${BASE}/photo/${post.id}`), env, ctx)).status, 404);
  } finally {
    f.restore();
  }
});

test('Discordの削除リンク：開いただけでは消えず、確認を押すと消える', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const token = await makeDeleteToken(env, post.id);
    const page = await call(`/admin/delete?token=${encodeURIComponent(token)}`, env);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /この投稿を削除しますか/);
    assert.ok(await env.REPORTS_KV.get(`post:${post.id}`));

    const done = await call('/admin/delete-by-token', env, { method: 'POST', form: { token } });
    assert.equal(done.status, 200);
    assert.match(await done.text(), /削除しました/);
    assert.equal(await env.REPORTS_KV.get(`post:${post.id}`), null);
    assert.equal((await publicPosts(env)).length, 0);

    assert.equal((await call('/admin/delete?token=bad', env)).status, 400);
  } finally {
    f.restore();
  }
});

test('削除リンクの確認画面：非表示の投稿では写真を出さず、管理ページへ案内する', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env, { photo: jpegBytes() });
    const stored = await env.REPORTS_KV.get(`post:${post.id}`, 'json');
    await env.REPORTS_KV.put(`post:${post.id}`, JSON.stringify({ ...stored, hidden: true }));
    const token = await makeDeleteToken(env, post.id);
    const page = await (await call(`/admin/delete?token=${encodeURIComponent(token)}`, env)).text();
    assert.doesNotMatch(page, /<img/, '公開経路では見られないので画像を出さない');
    assert.match(page, /写真は管理ページでご確認ください/);
  } finally {
    f.restore();
  }
});

test('削除リンク：偽のトークンでは消せず、GETでは消えない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const token = await makeDeleteToken(env, post.id);
    const forged = `${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`;

    assert.equal((await call('/admin/delete-by-token', env, { method: 'POST', form: { token: forged } })).status, 400);
    // GETは状態を変えない（合言葉も無いのでここでは入口ごと断る）
    assert.equal((await call(`/admin/delete-by-token?token=${encodeURIComponent(token)}`, env)).status, 403);
    assert.ok(await env.REPORTS_KV.get(`post:${post.id}`), '投稿は残っている');
  } finally {
    f.restore();
  }
});

// 2026-09-21：ダディのiPhone（Discordのアプリ内ブラウザ）から削除フォームを送ったら
// 「操作できません」で弾かれた。この経路は合言葉のCookieではなく署名付きトークンで本人を確かめるので、
// オリジンの手がかりが無くても通す（トークンを知らない相手は何を送っても弾かれる）。
// ここを「安全のため」と言って元に戻すと、また本人が削除できなくなる。
test('削除リンク：Origin・sec-fetch-site・Refererが何も付かない送信でも削除できる（iPhoneの実機で発覚）', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const token = await makeDeleteToken(env, post.id);
    const res = await call('/admin/delete-by-token', env, { method: 'POST', form: { token }, origin: null });
    assert.equal(res.status, 200);
    assert.equal(await env.REPORTS_KV.get(`post:${post.id}`), null, '投稿が消えている');
  } finally {
    f.restore();
  }
});

test('管理ページの削除：Originが無くてもRefererが自分のサイトなら通る', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const cookie = await login(env);
    const res = await call(`/admin/posts/${post.id}/delete`, env, {
      method: 'POST',
      cookie,
      origin: null,
      referer: `${BASE}/admin`,
    });
    assert.equal(res.status, 303);
    assert.equal(await env.REPORTS_KV.get(`post:${post.id}`), null);
  } finally {
    f.restore();
  }
});

test('管理ページの削除：よそのサイトからのRefererは通さない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const cookie = await login(env);
    const res = await call(`/admin/posts/${post.id}/delete`, env, {
      method: 'POST',
      cookie,
      origin: null,
      referer: 'https://evil.example/attack',
    });
    assert.equal(res.status, 403);
    assert.ok(await env.REPORTS_KV.get(`post:${post.id}`), '投稿は残っている');
  } finally {
    f.restore();
  }
});

test('管理ページの削除：手がかりが何も無い送信は通さない（Cookieで動く経路なので）', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const cookie = await login(env);
    const res = await call(`/admin/posts/${post.id}/delete`, env, { method: 'POST', cookie, origin: null });
    assert.equal(res.status, 403);
    assert.ok(await env.REPORTS_KV.get(`post:${post.id}`), '投稿は残っている');
  } finally {
    f.restore();
  }
});

test('期限切れの削除リンクは断る', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const expired = await makeDeleteToken(env, post.id, Date.now() - 8 * 86400 * 1000);
    assert.equal((await call(`/admin/delete?token=${encodeURIComponent(expired)}`, env)).status, 400);
    assert.equal((await call('/admin/delete-by-token', env, { method: 'POST', form: { token: expired } })).status, 400);
    assert.ok(await env.REPORTS_KV.get(`post:${post.id}`));
  } finally {
    f.restore();
  }
});

test('投稿が上限を超えたら、古い分は出していないと断る', async () => {
  const env = makeEnv();
  const cookie = await login(env);
  const seed = async (n) => {
    for (let i = 0; i < n; i++) {
      const id = `${String(1000000000000 + i)}-0000000${i % 10}`;
      await env.REPORTS_KV.put(`post:${id}`, JSON.stringify({ id, name: 'つりお', spotId: 'hagi-koshigahama', comment: 'テスト', date: '2026-09-20', hidden: false, reports: 0 }));
    }
  };
  await seed(199);
  assert.doesNotMatch(await (await call('/admin', env, { cookie })).text(), /古い投稿/);
  await seed(200);
  assert.match(await (await call('/admin', env, { cookie })).text(), /新しい200件だけを表示/);
});

test('管理ページはどの経路でも検索に載せず、キャッシュもさせない', async () => {
  const env = makeEnv();
  const cookie = await login(env);
  for (const path of ['/admin', '/admin/nothing-here']) {
    const res = await call(path, env, { cookie });
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow', path);
    assert.equal(res.headers.get('cache-control'), 'no-store', path);
  }
});

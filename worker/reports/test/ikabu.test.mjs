// 山口イカ部「写真部」の投稿（2026-10-01）：掲載待ち → 部長が掲載 → 写真部に並ぶ
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeToken } from '../src/auth.js';
import { validateIkabuPost } from '../src/ikabu.js';
import { makeCtx, makeEnv, stubFetch, okFetch, jpegBytes, TEST_BASE as BASE } from './fakes.mjs';

const ORIGIN = 'https://ikabu-trial.hoodhomies.workers.dev';
const { ctx, settle } = makeCtx();
const valid = { name: 'イカ太郎', cat: 'catch', comment: '秋の新子です', agree: '1' };

function postForm(fields, { photo = jpegBytes(), ip = '203.0.113.9', origin = ORIGIN } = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries({ 'cf-turnstile-response': 'tok', ...fields })) form.set(k, v);
  if (photo) form.set('photo', new File([photo], 'a.jpg', { type: 'image/jpeg' }));
  return new Request(`${BASE}/ikabu/photos`, { method: 'POST', headers: { origin, 'cf-connecting-ip': ip }, body: form });
}
const get = (path, env, headers = {}) => worker.fetch(new Request(`${BASE}${path}`, { headers }), env, ctx);
const list = async (env) => (await (await get('/ikabu/photos', env, { origin: ORIGIN })).json()).posts;

// 管理ページに合言葉で入った Cookie
async function adminCookie(env) {
  const form = new FormData();
  form.set('passphrase', 'aikotoba-test');
  const res = await worker.fetch(new Request(`${BASE}/admin/login`, { method: 'POST', headers: { origin: BASE }, body: form }), env, ctx);
  return res.headers.get('set-cookie').split(';')[0];
}
const run = async (fn) => {
  const f = stubFetch(okFetch());
  try {
    await fn(f);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
};

test('入力の検査：種類・同意が必要、ひとことは無くてもよい・120文字まで・1行に畳む', () => {
  assert.equal(validateIkabuPost(valid).ok, true);
  assert.equal(validateIkabuPost({ ...valid, comment: '' }).ok, true);
  assert.equal(validateIkabuPost({ ...valid, comment: 'a\nb\n\nc' }).post.comment, 'a b c');
  assert.match(validateIkabuPost({ ...valid, cat: 'xxx' }).error, /種類/);
  assert.match(validateIkabuPost({ ...valid, cat: 'constructor' }).error, /種類/);
  assert.match(validateIkabuPost({ ...valid, agree: '' }).error, /同意/);
  assert.match(validateIkabuPost({ ...valid, name: 'ダディ' }).error, /お名前/);
  assert.match(validateIkabuPost({ ...valid, comment: 'あ'.repeat(121) }).error, /120/);
});

test('投稿すると201で「掲載待ち」。一覧にも写真にも出ない。Discordに掲載確認のリンクが飛ぶ', async () => {
  const env = makeEnv();
  await run(async (f) => {
    const res = await worker.fetch(postForm(valid), env, ctx);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.pending, true);
    assert.equal('by' in body.post, false);
    assert.equal('approved' in body.post, false);
    assert.deepEqual(await list(env), []);
    assert.equal((await get(`/ikabu/photo/${body.post.id}`, env)).status, 404);
    await settle();
    const discord = f.calls.find((c) => c.url.includes('discord'));
    assert.ok(discord, 'Discordへ送っている');
    const content = JSON.parse(discord.init.body).content;
    assert.match(content, /写真部/);
    assert.match(content, /\/admin\/ikabu\/review\?token=/);
    assert.match(content, /イカ太郎/);
    // 現地の声の一覧には混ざらない
    assert.deepEqual((await (await get('/posts', env, { origin: ORIGIN })).json()).posts, []);
  });
});

test('写真が無い・撮影情報が残っている・ロボット判定に失敗、はそれぞれ断る', async () => {
  const env = makeEnv();
  await run(async () => {
    const r1 = await worker.fetch(postForm(valid, { photo: null }), env, ctx);
    assert.equal(r1.status, 400);
    assert.match((await r1.json()).error, /写真を選んで/);
    assert.equal(env.REPORTS_KV._store.size, 0);
  });
  // 撮影情報は受け取り側で落とすので、落ちた後は通る（EXIF入りでも断らない＝現地の声と同じ）
  await run(async () => {
    const r2 = await worker.fetch(postForm(valid, { photo: jpegBytes({ exif: true }) }), env, ctx);
    assert.equal(r2.status, 201);
    const stored = [...env.REPORTS_KV._store.entries()].find(([k]) => k.startsWith('ikabu/photo/'));
    assert.ok(stored);
    assert.equal(new TextDecoder().decode(stored[1]).includes('Exif'), false, '保存した写真にExifが無い');
  });
  const f = stubFetch(okFetch(false));
  try {
    const r3 = await worker.fetch(postForm(valid, { ip: '203.0.113.10' }), env, ctx);
    assert.equal(r3.status, 403);
  } finally {
    await settle();
    f.restore();
  }
});

test('Discordのリンク（トークン）で掲載すると一覧と写真に出る。現地の声の削除トークンでは開けない', async () => {
  const env = makeEnv();
  await run(async () => {
    const { post } = await (await worker.fetch(postForm(valid), env, ctx)).json();
    const token = await makeToken(env, 'ika', post.id);
    const page = await get(`/admin/ikabu/review?token=${token}`, env);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /載せますか/);
    // 用途の違うトークンは無効
    const wrong = await get(`/admin/ikabu/review?token=${await makeToken(env, 'del', post.id)}`, env);
    assert.equal(wrong.status, 400);

    const form = new FormData();
    form.set('token', token);
    form.set('action', 'approve');
    const ok = await worker.fetch(new Request(`${BASE}/admin/ikabu/review`, { method: 'POST', body: form }), env, ctx);
    assert.equal(ok.status, 200);
    const posts = await list(env);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].id, post.id);
    assert.equal(posts[0].cat, 'catch');
    assert.equal('approved' in posts[0], false);
    assert.equal((await get(`/ikabu/photo/${post.id}`, env)).status, 200);
  });
});

test('管理ページ：掲載待ちが上に出る。掲載→取り下げ→削除', async () => {
  const env = makeEnv();
  await run(async () => {
    const { post } = await (await worker.fetch(postForm(valid), env, ctx)).json();
    const cookie = await adminCookie(env);
    const page = await get('/admin/ikabu', env, { cookie });
    assert.equal(page.status, 200);
    const text = await page.text();
    assert.match(text, /掲載待ち 1件/);
    assert.match(text, /掲載する/);
    // 合言葉なしは合言葉の画面（入ったら写真部の管理へ戻る）。2026-10-01 ぱっぱのiPhoneで「操作できません」になった
    const login = await get('/admin/ikabu', env);
    assert.equal(login.status, 200);
    assert.match(await login.text(), /name="next" value="\/admin\/ikabu"/);
    const lf = new FormData();
    lf.set('passphrase', 'aikotoba-test'); lf.set('next', '/admin/ikabu');
    const back = await worker.fetch(new Request(`${BASE}/admin/login`, { method: 'POST', headers: { origin: BASE }, body: lf }), env, ctx);
    assert.equal(back.status, 303); assert.equal(back.headers.get('location'), '/admin/ikabu');
    const evil = new FormData();
    evil.set('passphrase', 'aikotoba-test'); evil.set('next', 'https://evil.example');
    assert.equal((await worker.fetch(new Request(`${BASE}/admin/login`, { method: 'POST', headers: { origin: BASE, 'cf-connecting-ip': '203.0.113.77' }, body: evil }), env, ctx)).headers.get('location'), '/admin');

    const act = (kind) =>
      worker.fetch(new Request(`${BASE}/admin/ikabu/posts/${post.id}/${kind}`, { method: 'POST', headers: { cookie, origin: BASE } }), env, ctx);
    assert.equal((await act('approve')).status, 303);
    assert.equal((await list(env)).length, 1);
    assert.equal((await act('unapprove')).status, 303);
    assert.equal((await list(env)).length, 0);
    assert.equal((await get(`/ikabu/photo/${post.id}`, env)).status, 404);
    assert.equal((await act('delete')).status, 303);
    assert.equal([...env.REPORTS_KV._store.keys()].filter((k) => k.startsWith('ikabu:post:') || k.startsWith('ikabu/photo/')).length, 0);
    // よそのサイトからの送信は弾く
    const bad = await worker.fetch(new Request(`${BASE}/admin/ikabu/posts/${post.id}/approve`, { method: 'POST', headers: { cookie, origin: 'https://evil.example' } }), env, ctx);
    assert.equal(bad.status, 403);
  });
});

test('投稿の枠は1時間3件（現地の声とは別に数える）。生のIPは残さない', async () => {
  const env = makeEnv();
  await run(async () => {
    for (let i = 0; i < 3; i++) assert.equal((await worker.fetch(postForm(valid, { ip: '198.51.100.5' }), env, ctx)).status, 201);
    assert.equal((await worker.fetch(postForm(valid, { ip: '198.51.100.5' }), env, ctx)).status, 429);
    const all = [...env.REPORTS_KV._store.entries()].map(([k, v]) => k + (typeof v === 'string' ? v : '')).join('\n');
    assert.equal(all.includes('198.51.100.5'), false);
    // 現地の声の枠はまだ空いている
    const yfj = new FormData();
    for (const [k, v] of Object.entries({ 'cf-turnstile-response': 'tok', name: 'つりお', spotId: 'hagi-koshigahama', comment: 'いい凪' })) yfj.set(k, v);
    const res = await worker.fetch(new Request(`${BASE}/posts`, { method: 'POST', headers: { origin: 'https://papachi03.github.io', 'cf-connecting-ip': '198.51.100.5' }, body: yfj }), env, ctx);
    assert.equal(res.status, 201);
  });
});

test('受付番号（cid）：同じ番号で2回届いても1件。status で届いたか分かる（2026-10-01 iPhoneの送信途中エラー対策）', async () => {
  const env = makeEnv();
  await run(async (f) => {
    assert.deepEqual(await (await get('/ikabu/photos/status?cid=abcd-1234-efgh', env, { origin: ORIGIN })).json(), { ok: true, arrived: false, id: null });
    const r1 = await worker.fetch(postForm({ ...valid, cid: 'abcd-1234-efgh' }), env, ctx);
    assert.equal(r1.status, 201);
    const p1 = (await r1.json()).post;
    const st = await (await get('/ikabu/photos/status?cid=abcd-1234-efgh', env, { origin: ORIGIN })).json();
    assert.equal(st.arrived, true); assert.equal(st.id, p1.id);
    const r2 = await worker.fetch(postForm({ ...valid, cid: 'abcd-1234-efgh' }), env, ctx);
    const b2 = await r2.json();
    assert.equal(r2.status, 201); assert.equal(b2.duplicate, true); assert.equal(b2.post.id, p1.id);
    assert.equal([...env.REPORTS_KV._store.keys()].filter((k) => k.startsWith('ikabu:post:')).length, 1);
    await settle();
    assert.equal(f.calls.filter((c) => c.url.includes('discord')).length, 1, 'Discord への通知も1回');
    assert.equal((await get('/ikabu/photos/status?cid=x', env)).status, 400);
  });
});

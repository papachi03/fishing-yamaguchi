import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeCtx, makeEnv, stubFetch, okFetch, jpegBytes, postForm, TEST_ORIGIN as ORIGIN, TEST_BASE as BASE } from './fakes.mjs';

const { ctx, settle } = makeCtx();
const valid = { name: 'つりお', spotId: 'hagi-koshigahama', comment: '北風が強く、体感は5mありました' };
const get = (path, env, headers = {}) => worker.fetch(new Request(`${BASE}${path}`, { headers }), env, ctx);

test('投稿すると201で公開用の形が返り、一覧に出る', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const res = await worker.fetch(postForm({ ...valid, fish: 'aji', wind: 'stronger' }), env, ctx);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    const { ok, post } = await res.json();
    assert.equal(ok, true);
    assert.equal(post.name, 'つりお');
    assert.equal(post.areaId, 'hagi');
    assert.equal(post.hasPhoto, false);
    assert.equal('by' in post, false);
    assert.equal('reports' in post, false);

    const list = await (await get('/posts', env, { origin: ORIGIN })).json();
    assert.equal(list.posts.length, 1);
    assert.equal(list.posts[0].id, post.id);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('生のIPを保存しない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    await worker.fetch(postForm(valid, { ip: '198.51.100.77' }), env, ctx);
    const all = [...env.REPORTS_KV._store.entries()].map(([k, v]) => k + v).join('\n');
    assert.equal(all.includes('198.51.100.77'), false);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('入力がおかしいと400で日本語の理由が返り、何も保存しない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const res = await worker.fetch(postForm({ ...valid, name: 'ダディ' }), env, ctx);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /お名前/);
    assert.equal(env.REPORTS_KV._store.size, 0);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('Turnstileに失敗すると403で、保存しない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch(false));
  try {
    const res = await worker.fetch(postForm(valid), env, ctx);
    assert.equal(res.status, 403);
    assert.equal((await get('/posts', env)).status, 200);
    assert.equal((await (await get('/posts', env)).json()).posts.length, 0);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('同じ人は1時間に3件まで。4件目は429。別の人は投稿できる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    for (let i = 0; i < 3; i++) {
      assert.equal((await worker.fetch(postForm(valid), env, ctx)).status, 201);
    }
    const fourth = await worker.fetch(postForm(valid), env, ctx);
    assert.equal(fourth.status, 429);
    assert.match((await fourth.json()).error, /1時間に3件/);
    assert.equal((await worker.fetch(postForm(valid, { ip: '203.0.113.2' }), env, ctx)).status, 201);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('写真つきの投稿はKVに入り、/photo/<id> で取れる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const res = await worker.fetch(postForm(valid, { photo: jpegBytes() }), env, ctx);
    const { post } = await res.json();
    assert.equal(post.hasPhoto, true);
    const img = await get(`/photo/${post.id}`, env);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/jpeg');
    assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

// 以前は400で断っていたが、スマホの写真はほとんどEXIF入りで投稿できなくなるため、
// 受け取って撮影情報だけ落として保存する方式に変えた（2026-09-21）
test('EXIF入りの写真も受け取り、保存する前に撮影情報を落とす', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const res = await worker.fetch(postForm(valid, { photo: jpegBytes({ exif: true }) }), env, ctx);
    assert.equal(res.status, 201);
    const { post } = await res.json();
    assert.equal(post.hasPhoto, true);

    const saved = new Uint8Array((await env.REPORTS_KV.getWithMetadata(`photo/${post.id}.jpg`, 'arrayBuffer')).value);
    const sig = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
    const found = (() => {
      outer: for (let i = 0; i <= saved.length - sig.length; i++) {
        for (let j = 0; j < sig.length; j++) if (saved[i + j] !== sig[j]) continue outer;
        return true;
      }
      return false;
    })();
    assert.equal(found, false, '保存した写真に撮影情報が残っている');
    assert.equal(saved[0], 0xff, 'JPEGとして壊れている');
    assert.equal(saved[1], 0xd8, 'JPEGとして壊れている');
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('一覧はエリアで絞れ、新しい順で、件数を絞れる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    await worker.fetch(postForm({ ...valid, comment: '1件目' }, { ip: '203.0.113.11' }), env, ctx);
    await new Promise((r) => setTimeout(r, 5));
    await worker.fetch(postForm({ ...valid, spotId: 'hofu-city', comment: '2件目' }, { ip: '203.0.113.12' }), env, ctx);
    await new Promise((r) => setTimeout(r, 5));
    await worker.fetch(postForm({ ...valid, comment: '3件目' }, { ip: '203.0.113.13' }), env, ctx);

    const all = (await (await get('/posts', env)).json()).posts;
    assert.deepEqual(all.map((p) => p.comment), ['3件目', '2件目', '1件目']);
    const hagi = (await (await get('/posts?area=hagi&limit=1', env)).json()).posts;
    assert.deepEqual(hagi.map((p) => p.comment), ['3件目']);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('IP_SALTが無いときは投稿を受け付けず、何も保存しない', async () => {
  const env = makeEnv();
  delete env.IP_SALT;
  const f = stubFetch(okFetch());
  // 500の経路はサーバー側にログを残すのが正しいので、テストの出力を汚さないよう受け止めておく
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    const res = await worker.fetch(postForm(valid), env, ctx);
    assert.equal(res.status, 500);
    assert.match((await res.json()).error, /問題が起きました/);
    assert.equal(env.REPORTS_KV._store.size, 0);
    assert.ok(logged.some((m) => m.includes('IP_SALT missing')));
  } finally {
    console.error = originalError;
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('非表示にした投稿の写真は404', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const { post } = await (await worker.fetch(postForm(valid, { photo: jpegBytes() }), env, ctx)).json();
    assert.equal((await get(`/photo/${post.id}`, env)).status, 200);

    const stored = JSON.parse(env.REPORTS_KV._store.get(`post:${post.id}`));
    stored.hidden = true;
    env.REPORTS_KV._store.set(`post:${post.id}`, JSON.stringify(stored));

    assert.equal((await get(`/photo/${post.id}`, env)).status, 404);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('一覧には hidden・reports・by が出ない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    await worker.fetch(postForm(valid), env, ctx);
    const [item] = (await (await get('/posts', env)).json()).posts;
    for (const key of ['hidden', 'reports', 'by']) assert.equal(key in item, false, key);
  } finally {
    try {
      await settle();
    } finally {
      f.restore();
    }
  }
});

test('許可していないサイトにはCORSヘッダーを付けない。知らない経路は404', async () => {
  const env = makeEnv();
  const res = await get('/posts', env, { origin: 'https://evil.example' });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal((await get('/nope', env)).status, 404);
  assert.equal((await get('/photo/not-an-id', env)).status, 404);
});

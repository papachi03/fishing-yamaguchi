// GET /posts の絞り込み（spot・fish）。索引の50件を超えた古い投稿も拾えること。
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { newId, putPost, rebuildIndex } from '../src/store.js';
import { placeById } from '../../../src/js/data/spot-list.js';
import { makeCtx, makeEnv, TEST_BASE as BASE } from './fakes.mjs';

const { ctx } = makeCtx();
const get = (path, env) => worker.fetch(new Request(`${BASE}${path}`), env, ctx);
const posts = async (path, env) => (await (await get(path, env)).json()).posts;

// Turnstile や上限を通さず、保存の形で直接まく（並びは newId の時刻で決まる）
const T0 = Date.parse('2026-09-20T00:00:00Z');
async function seed(env, items) {
  for (const [i, it] of items.entries()) {
    const post = {
      id: newId(T0 + i * 1000), // あとの要素ほど新しい
      name: 'つりお', comment: it.comment ?? `${i}`, fish: it.fish ?? '', wind: '', date: '2026-09-20',
      spotId: it.spotId, areaId: placeById(it.spotId).areaId, hasPhoto: false,
      createdAt: new Date(T0 + i * 1000).toISOString(), hidden: it.hidden ?? false, reports: 0, by: 'abcd',
    };
    await putPost(env, post);
  }
  await rebuildIndex(env);
}

const HAGI = 'hagi-koshigahama';
const NAGATO = 'nagato-senzaki-jinkoto';

test('spot で1か所だけに絞れる', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: HAGI, comment: '萩' }, { spotId: NAGATO, comment: '長門' }, { spotId: 'hagi-city', comment: '萩市内' }]);
  assert.deepEqual((await posts(`/posts?spot=${NAGATO}`, env)).map((p) => p.comment), ['長門']);
  assert.deepEqual((await posts('/posts?spot=hagi-city', env)).map((p) => p.comment), ['萩市内']);
});

test('fish で絞れる（場所不明の投稿も対象）', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: HAGI, fish: 'aji', comment: 'アジ' }, { spotId: 'unknown', fish: 'aori', comment: '不明でアオリ' }, { spotId: NAGATO, fish: 'aori', comment: '長門でアオリ' }]);
  assert.deepEqual((await posts('/posts?fish=aori', env)).map((p) => p.comment), ['長門でアオリ', '不明でアオリ']);
});

test('area と fish を組み合わせられる', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: HAGI, fish: 'aji', comment: '萩アジ' }, { spotId: NAGATO, fish: 'aji', comment: '長門アジ' }, { spotId: HAGI, fish: 'aori', comment: '萩アオリ' }]);
  assert.deepEqual((await posts('/posts?area=hagi&fish=aji', env)).map((p) => p.comment), ['萩アジ']);
});

test('索引の50件より古い投稿も、絞り込めば拾える', async () => {
  const env = makeEnv();
  // 0番目（いちばん古い）だけ長門。残り50件は萩なので、索引には長門が入らない
  await seed(env, [{ spotId: NAGATO, comment: '51件目' }, ...Array.from({ length: 50 }, () => ({ spotId: HAGI }))]);
  assert.equal((await posts('/posts', env)).length, 50);
  assert.equal((await posts('/posts', env)).some((p) => p.comment === '51件目'), false);
  assert.deepEqual((await posts(`/posts?spot=${NAGATO}`, env)).map((p) => p.comment), ['51件目']);
  assert.deepEqual((await posts('/posts?area=nagato', env)).map((p) => p.comment), ['51件目']);
});

test('リストに無い spot・fish は絞り込み無しとして無視する', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: HAGI }, { spotId: NAGATO }]);
  assert.equal((await posts('/posts?spot=no-such-spot', env)).length, 2);
  assert.equal((await posts('/posts?fish=dragon', env)).length, 2);
  assert.equal((await get('/posts?spot=no-such-spot', env)).status, 200);
});

test('絞り込んだ結果にも hidden・reports・by が出ず、非表示の投稿は含まれない', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: NAGATO, comment: '見える' }, { spotId: NAGATO, comment: '非表示', hidden: true }]);
  const list = await posts(`/posts?spot=${NAGATO}`, env);
  assert.deepEqual(list.map((p) => p.comment), ['見える']);
  for (const key of ['hidden', 'reports', 'by']) assert.equal(key in list[0], false, key);
});

test('spot=unknown（場所不明）は場所の絞り込みとして無視する', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: 'unknown', comment: '不明' }, { spotId: HAGI, comment: '萩' }]);
  assert.equal((await posts('/posts?spot=unknown', env)).length, 2);
});

test('絞り込み時も limit の上限が効く', async () => {
  const env = makeEnv();
  await seed(env, Array.from({ length: 3 }, (_, i) => ({ spotId: HAGI, comment: `${i}` })));
  assert.deepEqual((await posts('/posts?area=hagi&limit=2', env)).map((p) => p.comment), ['2', '1']);
  assert.equal((await posts('/posts?fish=aji&limit=1', env)).length, 0);
});

// KVの読み取り回数（無料枠1日10万回）を守るための要。SEAページは全ページ表示でここを通る
test('索引だけで足りる絞り込みは、200件の読み直しをしない', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: HAGI, comment: '萩1' }, { spotId: HAGI, comment: '萩2' }, { spotId: NAGATO, comment: '長門' }]);
  env.REPORTS_KV._resetCalls();

  // SEAページが出す問い合わせそのもの（エリア指定・2件）
  assert.deepEqual((await posts('/posts?area=hagi&limit=2', env)).map((p) => p.comment), ['萩2', '萩1']);
  assert.equal(env.REPORTS_KV._calls.list, 0, '投稿キーの一覧を取りに行かない');
  assert.equal(env.REPORTS_KV._calls.get, 1, '索引1キーを読むだけ');
});

test('索引で足りないときだけ200件を読み直す', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: HAGI, comment: '萩1' }, { spotId: NAGATO, comment: '長門' }]);
  env.REPORTS_KV._resetCalls();

  // 長門は索引に1件しかないので、2件欲しいと言われたら深いほうを見に行く
  assert.deepEqual((await posts('/posts?area=nagato&limit=2', env)).map((p) => p.comment), ['長門']);
  assert.equal(env.REPORTS_KV._calls.list, 1);
});

test('絞り込み無しの一覧は索引1キーだけで返す', async () => {
  const env = makeEnv();
  await seed(env, [{ spotId: HAGI }, { spotId: NAGATO }]);
  env.REPORTS_KV._resetCalls();
  assert.equal((await posts('/posts', env)).length, 2);
  assert.equal(env.REPORTS_KV._calls.list, 0);
  assert.equal(env.REPORTS_KV._calls.get, 1);
});

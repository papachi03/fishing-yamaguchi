// 投稿の保存場所。本文・写真とも同じKV（1投稿1キー・写真は別キー）。
// 需要が増えてKVの無料枠（書き込み1日1000回・容量1GB）に近づいたら、
// このファイルの写真の get/put/delete だけをR2に差し替えれば移行できる。
// 一覧の表示は「公開用の索引」1キーを読むだけで済むようにしてある（閲覧のたびにKVを何十回も読まない）。
import { LIMITS } from './config.js';

const POST = 'post:';
const INDEX = 'index:public';

/** 新しい投稿ほど辞書順で前に来るID（KVのlistは辞書順なので、これで新しい順に並ぶ） */
export function newId(now = Date.now()) {
  const inv = String(9999999999999 - now).padStart(13, '0');
  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${inv}-${rand}`;
}
export const isId = (s) => /^[0-9]{13}-[0-9a-f]{8}$/.test(String(s));
export const photoKey = (id) => `photo/${id}.jpg`;

/** 新しい順（IDは新しいほど辞書順で前）。索引の作り直しと一覧の絞り込みで共通に使う */
export const byNewest = (a, b) => (a.id < b.id ? -1 : 1);

export const getPost = (env, id) => env.REPORTS_KV.get(POST + id, 'json');
export const putPost = (env, post) => env.REPORTS_KV.put(POST + post.id, JSON.stringify(post));

export const putPhoto = (env, id, bytes) =>
  env.REPORTS_KV.put(photoKey(id), bytes, { metadata: { contentType: 'image/jpeg' } });
export const getPhoto = (env, id) => env.REPORTS_KV.getWithMetadata(photoKey(id), 'arrayBuffer');

export async function removePost(env, id) {
  await env.REPORTS_KV.delete(POST + id);
  await env.REPORTS_KV.delete(photoKey(id));
}

/** 非表示のものも含めて新しい順（管理ページと索引の作り直しで使う） */
export async function listPosts(env, limit = 200) {
  const { keys } = await env.REPORTS_KV.list({ prefix: POST, limit });
  const posts = await Promise.all(keys.map((k) => env.REPORTS_KV.get(k.name, 'json')));
  return posts.filter(Boolean);
}

/** 外に出してよい項目だけ（hidden・reports・by は出さない） */
export const toPublic = ({ id, name, spotId, areaId, comment, fish, wind, date, hasPhoto, createdAt }) => ({
  id, name, spotId, areaId, comment, fish, wind, date, hasPhoto, createdAt,
});

/**
 * 公開用の索引を作り直す。
 * KVのlistは書いた直後の内容がすぐ見えないことがあるので、いま書いた投稿は upsert で、
 * いま消した投稿は removeId で明示して、索引には必ず反映させる。
 */
export async function rebuildIndex(env, { upsert = null, removeId = null } = {}) {
  let posts = await listPosts(env);
  if (upsert) posts = [upsert, ...posts.filter((p) => p.id !== upsert.id)];
  if (removeId) posts = posts.filter((p) => p.id !== removeId);
  posts.sort(byNewest);
  const pub = posts.filter((p) => !p.hidden).slice(0, LIMITS.indexSize).map(toPublic);
  await env.REPORTS_KV.put(INDEX, JSON.stringify(pub));
  return pub;
}

export const getIndex = async (env) => (await env.REPORTS_KV.get(INDEX, 'json')) ?? [];

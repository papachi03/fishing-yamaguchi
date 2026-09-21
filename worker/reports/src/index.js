/**
 * YFJ「現地の声」Worker
 *
 * 釣りサイト（papachi03.github.io/fishing-yamaguchi）の投稿を受け取り、保存し、配る。
 * ⚠️ tproject-jp.com の下には置かない（誰でも投稿できる場所が荒らされると、ドメインごと
 *    Googleセーフブラウジングに判定される恐れがある。2026-09-13〜15の教訓）。workers.dev で動かす。
 *
 * 経路
 *   GET  /posts?area=&spot=&fish=&limit=   公開中の投稿（新しい順。3つの絞り込みは組み合わせ可）
 *   POST /posts                       投稿（multipart/form-data）
 *   GET  /photo/<id>                  写真
 *   POST /posts/<id>/report           通報                       … Task 4
 *   /admin…                           管理ページ                 … Task 5
 */
import { LIMITS, ALLOWED_ORIGINS } from './config.js';
import { validatePost, validatePhoto } from './validate.js';
import { ipHashOf, verifyTurnstile, allowPost, allowReport } from './guard.js';
import { newId, isId, getPost, putPost, putPhoto, getPhoto, toPublic, rebuildIndex, getIndex, listPosts, byNewest } from './store.js';
import { stripJpegMeta } from '../../../src/js/lib/strip-jpeg-meta.js';
import { placeById } from '../../../src/js/data/spot-list.js';
import { FISH } from '../../../src/js/data/report-options.js';
import { requireSignSecret } from './auth.js';
import { notifyNewPost, notifyHidden } from './notify.js';
import { handleAdmin } from './admin.js';

// vary は許可・不許可にかかわらず必ず付ける。付け忘れると、CORSヘッダーの無い応答が
// 途中のキャッシュに載り、あとから許可originの人に配られてしまう（/posts は30秒キャッシュ）
function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowed = ALLOWED_ORIGINS.includes(origin) ? { 'access-control-allow-origin': origin } : {};
  return { vary: 'Origin', ...allowed };
}

// ブラウザからのCORSは「読ませない」だけで、送りつけること自体は止められない。
// 本物の通報は必ず釣りサイトのページから別オリジンのここへ飛んでくるので、ブラウザが必ず Origin を付ける。
// 逆にOriginが無い送信（curlなど）は、ページを通っていない＝受け取らない
const fromAllowedSite = (request) => ALLOWED_ORIGINS.includes(request.headers.get('origin'));

export function json(obj, status, request, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(request), ...extra },
  });
}

// 訪問者に見えるので日本語で、CORSヘッダーも付ける（Task 4の通報はブラウザからここに届く）
export const notFound = (request) => json({ ok: false, error: '見つかりませんでした。' }, 404, request);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      // 管理ページは公開の経路（CORS・キャッシュ）とは別世界なので、いちばん先に振り分ける
      const admin = await handleAdmin(request, env, url);
      if (admin) return admin;

      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: { ...corsHeaders(request), 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400' },
        });
      }
      if (path === '/posts' && request.method === 'GET') return await handleList(url, request, env);
      if (path === '/posts' && request.method === 'POST') return await handleCreate(request, env, ctx);

      const rep = path.match(/^[/]posts[/]([^/]+)[/]report$/);
      if (rep && request.method === 'POST') return await handleReport(rep[1], request, env, ctx);

      const photo = path.match(/^[/]photo[/]([^/]+)$/);
      if (photo && request.method === 'GET') return await handlePhoto(photo[1], request, env);

      return notFound(request);
    } catch (err) {
      console.error('unhandled', err && err.stack ? err.stack : String(err));
      return json({ ok: false, error: '処理中に問題が起きました。時間をおいてもう一度お試しください。' }, 500, request);
    }
  },
};

async function handleList(url, request, env) {
  const area = url.searchParams.get('area') || '';
  // リストに無いIDは「絞り込み無し」として黙って無視する（古いリンクや手打ちでエラー画面にしない）。
  // 「場所不明」（areaIdなし）は釣り場としては絞り込めない
  const spotPlace = placeById(url.searchParams.get('spot'));
  const spot = spotPlace?.areaId ? spotPlace.id : '';
  const fishId = url.searchParams.get('fish') || '';
  const fish = FISH.some((x) => x.id === fishId) ? fishId : '';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || LIMITS.indexSize, 1), LIMITS.indexSize);

  const matches = (p) => (!area || p.areaId === area) && (!spot || p.spotId === spot) && (!fish || p.fish === fish);

  let posts;
  if (area || spot || fish) {
    // まず公開用の索引（KVを1回読むだけ）で絞る。SEAページは各エリア2件しか要らないので、
    // ふつうはここで足りる。KVの読み取り回数（無料枠1日10万回）を守るための要
    posts = (await getIndex(env)).filter(matches);
    if (posts.length < limit) {
      // 索引は最新50件しか持たない。欲しい件数に届かないときだけ、保存されている投稿から直接探す
      // （索引だけで絞ると、古い投稿が取りこぼされる）
      posts = (await listPosts(env, 200)).filter((p) => !p.hidden).sort(byNewest).map(toPublic).filter(matches);
    }
  } else {
    posts = await getIndex(env);
  }
  return json({ ok: true, posts: posts.slice(0, limit) }, 200, request, { 'cache-control': 'public, max-age=30' });
}

async function handleCreate(request, env, ctx) {
  // 署名の鍵が無いまま受け付けると、あとで消せない（偽造できる削除リンクしか出せない）投稿が残る
  requireSignSecret(env);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '送信の形式が正しくありません。' }, 400, request);
  }

  const fields = Object.fromEntries(['name', 'spotId', 'comment', 'fish', 'wind', 'date'].map((k) => [k, form.get(k)]));
  const v = validatePost(fields);
  if (!v.ok) return json({ ok: false, error: v.error }, 400, request);

  // 写真（最大3MB）を読み込んでEXIFまで調べる前に、人かどうかを先に確かめる。
  // 逆順だと、ロボットの送信1回ごとに3MBの読み込みを肩代わりさせられる
  if (!(await verifyTurnstile(form.get('cf-turnstile-response'), request, env))) {
    return json({ ok: false, error: 'ロボットでないことの確認に失敗しました。ページを読み込み直して、もう一度お試しください。' }, 403, request);
  }

  const file = form.get('photo');
  let bytes = null;
  if (file && typeof file !== 'string' && file.size > 0) {
    if (file.size > LIMITS.photoBytes) return json({ ok: false, error: '写真が大きすぎます（3MBまで）。' }, 400, request);
    // 送信前にブラウザでも落としているが、端末によっては残ることがあるので受け取り側でも必ず落とす
    bytes = stripJpegMeta(new Uint8Array(await file.arrayBuffer()));
  }
  const pv = validatePhoto(bytes);
  if (!pv.ok) return json({ ok: false, error: pv.error }, 400, request);

  const hash = await ipHashOf(request, env);
  if (!(await allowPost(env, hash))) {
    return json({ ok: false, error: `投稿は1時間に${LIMITS.perHour}件、1日に${LIMITS.perDay}件までです。時間をおいてお試しください。` }, 429, request);
  }

  const id = newId();
  const post = { id, ...v.post, hasPhoto: pv.hasPhoto, createdAt: new Date().toISOString(), hidden: false, reports: 0, by: hash };
  if (pv.hasPhoto) await putPhoto(env, id, bytes);
  await putPost(env, post);
  await rebuildIndex(env, { upsert: post });

  // 通知の失敗は投稿の成否に影響させない
  ctx.waitUntil(notifyNewPost(env, post, new URL(request.url).origin).catch((e) => console.error('notify failed', String(e))));

  return json({ ok: true, post: toPublic(post) }, 201, request);
}

async function handlePhoto(id, request, env) {
  if (!isId(id)) return notFound(request);
  const post = await getPost(env, id);
  if (!post || post.hidden || !post.hasPhoto) return notFound(request);
  const { value } = await getPhoto(env, id);
  if (!value) return notFound(request);
  return new Response(value, {
    headers: {
      'content-type': 'image/jpeg',
      'x-content-type-options': 'nosniff',
      // 非表示・削除がなるべく早く効くよう、長くは控えさせない
      'cache-control': 'public, max-age=3600',
    },
  });
}

async function handleReport(id, request, env, ctx) {
  // 通報3件で公開中の投稿が消え、ダディのDiscordにも鳴る。釣りサイトのページ以外からは撃たせない
  if (!fromAllowedSite(request)) return json({ ok: false, error: 'この場所からは通報できません。' }, 403, request);
  if (!isId(id)) return notFound(request);
  const post = await getPost(env, id);
  if (!post) return notFound(request);

  // 同じ人の通報は1件と数える（生のIPは残さない）
  const hash = await ipHashOf(request, env);
  const seenKey = `rep:${id}:${hash}`;
  if (await env.REPORTS_KV.get(seenKey)) return json({ ok: true, hidden: post.hidden }, 200, request);

  // 同じ人が次々と別の投稿を通報して回るのを止める（同じ投稿の2回目は上で返るので枠を使わない）
  if (!(await allowReport(env, hash))) {
    return json({ ok: false, error: `通報は1時間に${LIMITS.reportPerHour}件、1日に${LIMITS.reportPerDay}件までです。時間をおいてお試しください。` }, 429, request);
  }

  post.reports = (post.reports || 0) + 1;
  // 非表示に切り替わる瞬間だけ知らせる。4件目以降で繰り返さない
  const hideNow = !post.hidden && post.reports >= LIMITS.reportsToHide;
  if (hideNow) post.hidden = true;
  await putPost(env, post);
  // 数えたあとに印を付ける。先に付けると、保存に失敗した人が90日間「通報済み」のまま数えられない
  await env.REPORTS_KV.put(seenKey, '1', { expirationTtl: 90 * 86400 });
  if (hideNow) {
    await rebuildIndex(env, { upsert: post });
    ctx.waitUntil(notifyHidden(env, post, new URL(request.url).origin).catch((e) => console.error('notify failed', String(e))));
  }
  return json({ ok: true, hidden: post.hidden }, 200, request);
}

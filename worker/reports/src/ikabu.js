/**
 * 山口イカ部「写真部」の投稿（2026-10-01）。「現地の声」と同じWorker・同じKVに相乗りし、キーの頭で分ける。
 *
 *   ・投稿は「掲載待ち」で保存し、部長（ぱっぱ）が Discord のリンクか管理ページで「掲載する」を押したら写真部に並ぶ
 *     （他人の写真や関係ない画像が勝手に載らないように）。🎫はサイト側が「投稿が届いた時点」で付ける
 *   ・釣り場の欄は作らない（写真部の「釣り場は公開しない」方針）。写真の撮影情報はブラウザと受け取り側の両方で落とす
 *   ・荒らし対策は現地の声と同じ：Turnstile・1時間3件・1日10件（投稿の枠は別に数える）・生のIPは残さない
 *
 * 経路（公開）
 *   GET  /ikabu/photos?limit=       掲載済みの投稿（新しい順）
 *   POST /ikabu/photos              投稿（multipart：photo・cat・name・comment・agree・cf-turnstile-response・cid）
 *   GET  /ikabu/photos/status?cid=  受付番号 cid の投稿が届いているか（iPhone が送信の途中で「失敗」と出す件の確かめ用・2026-10-01）
 *   GET  /ikabu/photo/<id>          写真（掲載済みだけ）
 * 経路（管理）
 *   GET  /admin/ikabu                         一覧（合言葉）。掲載待ちが上
 *   POST /admin/ikabu/posts/<id>/(approve|unapprove|delete)
 *   GET  /admin/ikabu/photo/<id>              写真（掲載待ちも見られる・合言葉）
 *   GET  /admin/ikabu/review?token=           Discord のリンク（合言葉なし。署名付きトークンが鍵）：写真を見て 掲載／削除
 *   POST /admin/ikabu/review                  その実行（token・action）
 *   GET  /admin/ikabu/review-photo?token=     そのリンク用の写真
 */
import { LIMITS } from './config.js';
import { json, notFound } from './http.js';
import { cleanName, validatePhoto } from './validate.js';
import { ipHashOf, verifyTurnstile, allowIkabuPost } from './guard.js';
import { newId, isId, byNewest } from './store.js';
import { stripJpegMeta } from '../../../src/js/lib/strip-jpeg-meta.js';
import { requireSignSecret, makeToken, readToken, isAdmin } from './auth.js';
import { sendDiscord, quoted } from './notify.js';
import { html, sameOrigin, logRefusal, forbidden, missing, loginPage } from './admin.js';

export const IKABU = {
  cats: { catch: '部員の釣果', sea: '山口の海', life: 'イカの姿', food: '食卓' },
  comment: 120,
  indexSize: 60,
  listLimit: 300,
};
const TOKEN_PURPOSE = 'ika';

/* ---------- 保存（キーの頭で現地の声と分ける） ---------- */
const POST = 'ikabu:post:';
const INDEX = 'ikabu:index:public';
const photoKey = (id) => `ikabu/photo/${id}.jpg`;
// 受付番号（ブラウザが付ける）→ 投稿ID。同じ番号で2回届いても1件にする（送り直しで二重にならない）。1日で消える
const cidKey = (cid) => `ikabu:cid:${cid}`;
const isCid = (s) => /^[A-Za-z0-9-]{8,40}$/.test(String(s ?? ''));

const getPost = (env, id) => env.REPORTS_KV.get(POST + id, 'json');
const putPost = (env, post) => env.REPORTS_KV.put(POST + post.id, JSON.stringify(post));
const putPhoto = (env, id, bytes) => env.REPORTS_KV.put(photoKey(id), bytes, { metadata: { contentType: 'image/jpeg' } });
const getPhoto = (env, id) => env.REPORTS_KV.getWithMetadata(photoKey(id), 'arrayBuffer');
async function removePost(env, id) {
  await env.REPORTS_KV.delete(POST + id);
  await env.REPORTS_KV.delete(photoKey(id));
}
async function listPosts(env, limit = IKABU.listLimit) {
  const { keys } = await env.REPORTS_KV.list({ prefix: POST, limit });
  const posts = await Promise.all(keys.map((k) => env.REPORTS_KV.get(k.name, 'json')));
  return posts.filter(Boolean);
}
/** 外に出してよい項目だけ（approved・by は出さない） */
export const toPublic = ({ id, name, cat, comment, createdAt }) => ({ id, name, cat, comment, createdAt });

async function rebuildIndex(env, { upsert = null, removeId = null } = {}) {
  let posts = await listPosts(env);
  if (upsert) posts = [upsert, ...posts.filter((p) => p.id !== upsert.id)];
  if (removeId) posts = posts.filter((p) => p.id !== removeId);
  posts.sort(byNewest);
  const pub = posts.filter((p) => p.approved).slice(0, IKABU.indexSize).map(toPublic);
  await env.REPORTS_KV.put(INDEX, JSON.stringify(pub));
  return pub;
}
const getIndex = async (env) => (await env.REPORTS_KV.get(INDEX, 'json')) ?? [];

/* ---------- 入力の検査（純粋） ---------- */
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const fail = (error) => ({ ok: false, error });

export function validateIkabuPost(f) {
  const n = cleanName(f.name);
  if (!n.ok) return n;
  const cat = String(f.cat ?? '');
  if (!Object.hasOwn(IKABU.cats, cat)) return fail('写真の種類を選んでください。');
  // ひとことは1行（改行は空白に畳む）。無くてもよい
  const comment = String(f.comment ?? '').normalize('NFKC').replace(CONTROL, '').replace(/\s+/g, ' ').trim();
  if ([...comment].length > IKABU.comment) return fail(`ひとことは${IKABU.comment}文字までです。`);
  if (String(f.agree ?? '') !== '1') return fail('写真部への掲載に同意してください。');
  return { ok: true, post: { name: n.name, cat, comment } };
}

/* ---------- 公開の経路 ---------- */
export async function handleIkabu(request, env, ctx, url) {
  const path = url.pathname;
  if (path === '/ikabu/photos' && request.method === 'GET') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || IKABU.indexSize, 1), IKABU.indexSize);
    const posts = (await getIndex(env)).slice(0, limit);
    return json({ ok: true, posts }, 200, request, { 'cache-control': 'public, max-age=30' });
  }
  if (path === '/ikabu/photos' && request.method === 'POST') return handleCreate(request, env, ctx);
  if (path === '/ikabu/photos/status' && request.method === 'GET') {
    const cid = url.searchParams.get('cid');
    if (!isCid(cid)) return json({ ok: false, error: '受付番号が正しくありません。' }, 400, request);
    const id = await env.REPORTS_KV.get(cidKey(cid));
    return json({ ok: true, arrived: Boolean(id), id: id || null }, 200, request, { 'cache-control': 'no-store' });
  }
  const photo = path.match(/^[/]ikabu[/]photo[/]([^/]+)$/);
  if (photo && request.method === 'GET') {
    const id = photo[1];
    if (!isId(id)) return notFound(request);
    const post = await getPost(env, id);
    if (!post || !post.approved) return notFound(request);
    const { value } = await getPhoto(env, id);
    if (!value) return notFound(request);
    return new Response(value, {
      headers: { 'content-type': 'image/jpeg', 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=3600' },
    });
  }
  return null;
}

async function handleCreate(request, env, ctx) {
  requireSignSecret(env);
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '送信の形式が正しくありません。' }, 400, request);
  }
  const v = validateIkabuPost(Object.fromEntries(['name', 'cat', 'comment', 'agree'].map((k) => [k, form.get(k)])));
  if (!v.ok) return json({ ok: false, error: v.error }, 400, request);
  // 受付番号：同じ番号がすでに届いていれば、その投稿を返す（保存も通知もしない）
  const cid = isCid(form.get('cid')) ? String(form.get('cid')) : null;
  if (cid) {
    const dupId = await env.REPORTS_KV.get(cidKey(cid));
    if (dupId) {
      const dup = await getPost(env, dupId);
      if (dup) return json({ ok: true, post: toPublic(dup), pending: !dup.approved, duplicate: true }, 201, request);
    }
  }

  // 写真（最大3MB）を読む前に、人かどうかを先に確かめる（現地の声と同じ順）
  if (!(await verifyTurnstile(form.get('cf-turnstile-response'), request, env))) {
    return json({ ok: false, error: 'ロボットでないことの確認に失敗しました。ページを読み込み直して、もう一度お試しください。' }, 403, request);
  }
  // 写真は「ファイル」か「文字（base64）」のどちらかで受ける。
  // 2026-10-01 ぱっぱの iPhone（Safari）で、ファイルを入れた送信だけが届かず（Load failed）、同じ大きさの文字は届いた → サイトは文字で送る
  const file = form.get('photo');
  const b64 = form.get('photo_b64');
  let raw = null;
  if (file && typeof file !== 'string' && file.size > 0) {
    if (file.size > LIMITS.photoBytes) return json({ ok: false, error: '写真が大きすぎます（3MBまで）。' }, 400, request);
    raw = new Uint8Array(await file.arrayBuffer());
  } else if (typeof b64 === 'string' && b64.length > 0) {
    if (b64.length > LIMITS.photoBytes * 1.4) return json({ ok: false, error: '写真が大きすぎます（3MBまで）。' }, 400, request);
    try {
      raw = Uint8Array.from(atob(b64.replace(/^data:[^,]*,/, '')), (c) => c.charCodeAt(0));
    } catch {
      return json({ ok: false, error: '写真のデータが読めませんでした。もう一度お試しください。' }, 400, request);
    }
  }
  if (!raw || raw.length === 0) return json({ ok: false, error: '写真を選んでください。' }, 400, request);
  const bytes = stripJpegMeta(raw);
  const pv = validatePhoto(bytes);
  if (!pv.ok) return json({ ok: false, error: pv.error }, 400, request);

  const hash = await ipHashOf(request, env);
  if (!(await allowIkabuPost(env, hash))) {
    return json({ ok: false, error: `投稿は1時間に${LIMITS.perHour}件、1日に${LIMITS.perDay}件までです。時間をおいてお試しください。` }, 429, request);
  }

  const id = newId();
  const post = { id, ...v.post, createdAt: new Date().toISOString(), approved: false, by: hash };
  await putPhoto(env, id, bytes);
  await putPost(env, post);
  if (cid) await env.REPORTS_KV.put(cidKey(cid), id, { expirationTtl: 86400 });
  // 掲載待ちなので索引は変わらない（掲載した時に作り直す）

  ctx.waitUntil(notifyNewIkabuPost(env, post, new URL(request.url).origin).catch((e) => console.error('ikabu notify failed', String(e))));
  return json({ ok: true, post: toPublic(post), pending: true }, 201, request);
}

async function notifyNewIkabuPost(env, post, origin) {
  const token = await makeToken(env, TOKEN_PURPOSE, post.id);
  return sendDiscord(env, [
    '📷 写真部：新しい投稿（掲載待ち）',
    `**${post.name}** ｜ ${IKABU.cats[post.cat]}`,
    post.comment ? quoted(post.comment) : '',
    `写真 → ${origin}/admin/ikabu/review-photo?token=${token}`,
    `確認して掲載／削除 → ${origin}/admin/ikabu/review?token=${token}`,
  ], { mention: true });
}

/* ---------- 管理の経路（admin.js から呼ばれる） ---------- */
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
const imgHeaders = { 'content-type': 'image/jpeg', 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' };

const postBlock = (p, photoPath) =>
  `<p class="meta">${p.approved ? '' : '<span class="tag">掲載待ち</span> '}<strong>${esc(p.name)}</strong> ｜ ${esc(IKABU.cats[p.cat] ?? p.cat)} ｜ ${esc(p.createdAt.slice(0, 10))}</p>
${p.comment ? `<p>${esc(p.comment)}</p>` : ''}
<img src="${photoPath}" alt="" loading="lazy">`;

const listPage = (posts) => {
  const pending = posts.filter((p) => !p.approved);
  const shown = posts.filter((p) => p.approved);
  const block = (p) => `<section class="post${p.approved ? '' : ' hidden'}">${postBlock(p, `/admin/ikabu/photo/${p.id}`)}
<div>${p.approved
    ? `<form method="post" action="/admin/ikabu/posts/${p.id}/unapprove"><button type="submit">取り下げる</button></form>`
    : `<form method="post" action="/admin/ikabu/posts/${p.id}/approve"><button type="submit">掲載する</button></form>`}
<form method="post" action="/admin/ikabu/posts/${p.id}/delete" onsubmit="return confirm('この投稿を削除します。元に戻せません。')"><button class="danger" type="submit">削除</button></form></div></section>`;
  return html(`<h1>写真部の投稿 管理（掲載待ち ${pending.length}件・掲載中 ${shown.length}件）</h1>
<p class="tools"><a href="/admin">← 現地の声の管理へ</a></p>
${posts.length ? '' : '<p>投稿はまだありません。</p>'}
${pending.map(block).join('')}${shown.map(block).join('')}`);
};

const backLink = '<p><a href="/admin/ikabu">写真部の管理ページへ</a></p>';
const badLink = () => html('<h1>リンクが無効です</h1><p>期限が切れているか、リンクが途中で切れています。管理ページから操作してください。</p>', 400);

export async function handleIkabuAdmin(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  // Discord のリンク（合言葉なし。署名付きトークンが鍵。現地の声の削除リンクと同じ考え方で同一オリジン判定は入れない）
  if (path === '/admin/ikabu/review-photo' && method === 'GET') {
    const id = await readToken(env, TOKEN_PURPOSE, url.searchParams.get('token'));
    if (!id || !isId(id)) return badLink();
    const { value } = await getPhoto(env, id);
    if (!value) return missing();
    return new Response(value, { headers: imgHeaders });
  }
  if (path === '/admin/ikabu/review' && method === 'GET') {
    const token = url.searchParams.get('token');
    const id = await readToken(env, TOKEN_PURPOSE, token);
    if (!id || !isId(id)) return badLink();
    const post = await getPost(env, id);
    if (!post) return html('<h1>この投稿はすでに削除されています</h1>');
    return html(`<h1>${post.approved ? 'この投稿は掲載中です' : 'この投稿を写真部に載せますか'}</h1>
<section class="post">${postBlock(post, `/admin/ikabu/review-photo?token=${esc(token)}`)}</section>
${post.approved ? '' : `<form method="post" action="/admin/ikabu/review"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="action" value="approve"><button type="submit">掲載する</button></form>`}
<form method="post" action="/admin/ikabu/review" onsubmit="return confirm('この投稿を削除します。元に戻せません。')"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="action" value="delete"><button class="danger" type="submit">削除する</button></form>`);
  }
  if (path === '/admin/ikabu/review' && method === 'POST') {
    const form = await request.formData();
    const id = await readToken(env, TOKEN_PURPOSE, form.get('token'));
    if (!id || !isId(id)) return badLink();
    const action = form.get('action');
    if (action === 'approve') {
      const post = await getPost(env, id);
      if (!post) return html('<h1>この投稿はすでに削除されています</h1>');
      await approve(env, post);
      return html(`<h1>掲載しました</h1><p>写真部に並びます（反映まで30秒ほど）。</p>${backLink}`);
    }
    if (action === 'delete') {
      await removePost(env, id);
      await rebuildIndex(env, { removeId: id });
      return html(`<h1>削除しました</h1><p>この画面は閉じて大丈夫です。</p>${backLink}`);
    }
    return badLink();
  }

  // ここから下は合言葉が必要。一覧を直接開いた時は「操作できません」でなく合言葉の画面を出す（入ったらここへ戻る）
  if (!(await isAdmin(request, env))) return path === '/admin/ikabu' && method === 'GET' ? loginPage('', 200, '/admin/ikabu') : forbidden();

  if (path === '/admin/ikabu' && method === 'GET') {
    const posts = await listPosts(env);
    posts.sort(byNewest);
    return listPage(posts);
  }
  const photo = path.match(/^[/]admin[/]ikabu[/]photo[/]([^/]+)$/);
  if (photo && method === 'GET' && isId(photo[1])) {
    const { value } = await getPhoto(env, photo[1]);
    if (!value) return missing();
    return new Response(value, { headers: imgHeaders });
  }
  const action = path.match(/^[/]admin[/]ikabu[/]posts[/]([^/]+)[/](approve|unapprove|delete)$/);
  if (action && method === 'POST' && isId(action[1])) {
    if (!sameOrigin(request, url)) return (logRefusal(request, path), forbidden());
    const [, id, kind] = action;
    if (kind === 'delete') {
      await removePost(env, id);
      await rebuildIndex(env, { removeId: id });
    } else {
      const post = await getPost(env, id);
      if (post) {
        if (kind === 'approve') await approve(env, post);
        else {
          const off = { ...post, approved: false };
          await putPost(env, off);
          await rebuildIndex(env, { removeId: id });
        }
      }
    }
    return new Response(null, { status: 303, headers: { location: '/admin/ikabu', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
  }
  return missing();
}

async function approve(env, post) {
  const on = { ...post, approved: true, approvedAt: new Date().toISOString() };
  await putPost(env, on);
  await rebuildIndex(env, { upsert: on });
}

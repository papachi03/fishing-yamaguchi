// ダディ専用の管理ページ。合言葉で入り、投稿の削除と再表示ができる。
// Workerが自分でHTMLを返す（釣りサイト側には置かない＝管理の入口を公開サイトから切り離す）。
import { checkPassphrase, makeAdminCookie, isAdmin, readDeleteToken } from './auth.js';
import { allowLogin, ipHashOf } from './guard.js';
import { listPosts, getPost, putPost, removePost, rebuildIndex, getPhoto, isId } from './store.js';
import { placeById } from '../../../src/js/data/spot-list.js';
import { sendMorningDraft } from './morning.js';
import { FISH, WIND_FEEL, nameOf } from '../../../src/js/data/report-options.js';

// 管理ページに出す件数。1ページに全部出す代わりの上限（ページ送りは作らない）
const LIST_LIMIT = 200;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

function html(body, status = 200) {
  return new Response(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>現地の声 管理｜YFJ</title>
<style>
  body{margin:0;padding:20px;background:#f1ece1;color:#20232a;font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.7}
  main{max-width:720px;margin:0 auto}
  h1{font-size:20px} .post{background:#fff;border-radius:12px;padding:16px;margin:0 0 14px;box-shadow:0 1px 8px rgba(0,0,0,.06)}
  .post.hidden{border-left:6px solid #c2571f} .meta{font-size:13px;color:#4c5058} .tag{display:inline-block;background:#c2571f;color:#fff;border-radius:999px;padding:0 10px;font-size:12px}
  img{max-width:100%;border-radius:8px;margin-top:8px} p{margin:6px 0;white-space:pre-wrap;word-break:break-word}
  form{display:inline} button{font:inherit;padding:9px 18px;border-radius:999px;border:1px solid #20232a;background:#fff;cursor:pointer;margin:8px 8px 0 0}
  button.danger{background:#c2571f;border-color:#c2571f;color:#fff} input{font:inherit;padding:10px;width:100%;max-width:320px;box-sizing:border-box}
  .msg{color:#c2571f}
  .tools{display:block;margin:0 0 20px;padding:0 0 18px;border-bottom:1px solid rgba(32,35,42,.15)} .tools button{margin:0}
  .tools small{display:block;margin-top:6px;font-size:12px;color:#4c5058}
</style></head><body><main>${body}</main></body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
        // same-origin＝よそのサイトには送らないが、自分への送信では手がかりとして使える（sameOriginの判定に使う）
        'referrer-policy': 'same-origin',
      },
    }
  );
}

const loginPage = (message = '', status = 200) =>
  html(
    `<h1>現地の声 管理</h1>${message ? `<p class="msg">${esc(message)}</p>` : ''}
<form method="post" action="/admin/login"><p><label>合言葉<br><input type="password" name="passphrase" autocomplete="current-password" required></label></p>
<button type="submit">入る</button></form>`,
    status
  );

// photoPath が null のときは、この画面では写真を出せない（合言葉なしで開ける削除リンクの確認画面）
function postBlock(p, photoPath) {
  const extras = [nameOf(FISH, p.fish), nameOf(WIND_FEEL, p.wind)].filter(Boolean).join(' ／ ');
  const photo = !p.hasPhoto ? '' : photoPath ? `<img src="${photoPath}" alt="" loading="lazy">` : '<p class="meta">写真は管理ページでご確認ください。</p>';
  return `<p class="meta">${p.hidden ? '<span class="tag">非表示</span> ' : ''}<strong>${esc(p.name)}</strong> ｜ ${esc(placeById(p.spotId)?.name ?? p.spotId)} ｜ ${esc(p.date)} ｜ 通報 ${esc(p.reports || 0)}件</p>
${extras ? `<p class="meta">${esc(extras)}</p>` : ''}<p>${esc(p.comment)}</p>
${photo}`;
}

const listPage = (posts, truncated) =>
  html(`<h1>現地の声 管理（${posts.length}件）</h1>
<form class="tools" method="post" action="/admin/morning"><button type="submit">今の堤防判定をDiscordへ送る</button><small>今の時刻の予報で下書きを送ります（見出しは時刻に合わせて朝・昼・夜）</small></form>
${posts.length ? '' : '<p>投稿はまだありません。</p>'}
${truncated ? `<p class="msg">新しい${LIST_LIMIT}件だけを表示しています。これより古い投稿はこの画面には出ません。</p>` : ''}
${posts
  .map(
    (p) => `<section class="post${p.hidden ? ' hidden' : ''}">${postBlock(p, `/admin/photo/${p.id}`)}
<div><form method="post" action="/admin/posts/${p.id}/delete" onsubmit="return confirm('この投稿を削除します。元に戻せません。')"><button class="danger" type="submit">削除</button></form>
${p.hidden ? `<form method="post" action="/admin/posts/${p.id}/restore"><button type="submit">再表示</button></form>` : ''}</div></section>`
  )
  .join('')}`);

// 管理ページはWorker自身が返すので、フォームの送信元は必ずこのWorkerのorigin。
// 公開側の ALLOWED_ORIGINS（釣りサイト）とは別物なので、ここでは自分のoriginだけを通す。
//
// 素の<form method="post">はナビゲーション扱いになり、ブラウザによって付く手がかりが違う。
// 2026-09-21、ダディのiPhone（Discordのアプリ内ブラウザ）から削除フォームを送ったら「操作できません」に
// なった。そのため手がかりを3つ順番に見る：Origin → sec-fetch-site → Referer。
// どれも攻撃者のページからの送信では同一オリジンにならないのでCSRFの守りは崩れない。
// （Refererを使えるようにするため、管理ページの referrer-policy は no-referrer ではなく same-origin。
//   よそのサイトには送られないので、投稿の中身が外に漏れることはない）
const sameOrigin = (request, url) => {
  const origin = request.headers.get('origin');
  if (origin) return origin === url.origin;
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const referer = request.headers.get('referer');
  if (referer) return referer === url.origin || referer.startsWith(`${url.origin}/`);
  return false; // 手がかりが何も無い＝判断できないので通さない
};
// 弾いたときに手がかりを残す（次に同じことが起きたら wrangler tail で見られるように）
const logRefusal = (request, path) =>
  console.warn(
    'admin refused',
    path,
    'origin=', request.headers.get('origin'),
    'sec-fetch-site=', request.headers.get('sec-fetch-site'),
    'referer=', request.headers.get('referer') ? 'あり' : 'なし'
  );
const forbidden = () => html('<h1>操作できません</h1><p>もう一度、管理ページから入り直してください。</p>', 403);
const missing = () => html('<h1>見つかりませんでした</h1><p>管理ページに戻ってお試しください。</p>', 404);
// 303にも noindex を付ける（リダイレクトそのものが検索結果に拾われないように）
const seeAdmin = (extra = {}) =>
  new Response(null, { status: 303, headers: { location: '/admin', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', ...extra } });

async function deletePost(env, id) {
  await removePost(env, id);
  await rebuildIndex(env, { removeId: id });
}

export async function handleAdmin(request, env, url) {
  const path = url.pathname;
  if (path !== '/admin' && !path.startsWith('/admin/')) return null;
  const method = request.method;

  if (path === '/admin' && method === 'GET') {
    if (!(await isAdmin(request, env))) return loginPage();
    // ページ送りは作らない。上限に届いたときだけ「古い分は出ていない」と断る
    const posts = await listPosts(env, LIST_LIMIT);
    return listPage(posts, posts.length >= LIST_LIMIT);
  }

  if (path === '/admin/login' && method === 'POST') {
    if (!sameOrigin(request, url)) return (logRefusal(request, path), forbidden());
    // 合言葉を見る前に回数を数える。当たっていても枠を使い切っていたら入れない
    if (!(await allowLogin(env, await ipHashOf(request, env)))) {
      return loginPage('試行回数が多すぎます。1時間ほどおいてからお試しください。', 429);
    }
    const form = await request.formData();
    if (!(await checkPassphrase(env, form.get('passphrase')))) return loginPage('合言葉が違います。', 401);
    return seeAdmin({ 'set-cookie': await makeAdminCookie(env) });
  }

  // Discordの削除リンク（合言葉なしで使える。トークンそのものが鍵）。
  // GETは確認の画面を出すだけで、消すのは下のPOST
  if (path === '/admin/delete' && method === 'GET') {
    const token = url.searchParams.get('token');
    const id = await readDeleteToken(env, token);
    if (!id || !isId(id)) return html('<h1>リンクが無効です</h1><p>期限が切れているか、リンクが途中で切れています。管理ページから削除してください。</p>', 400);
    const post = await getPost(env, id);
    if (!post) return html('<h1>この投稿はすでに削除されています</h1>');
    // 非表示の投稿の写真は公開経路では見られない。壊れた画像を出さず、管理ページへ案内する
    return html(`<h1>この投稿を削除しますか</h1><section class="post">${postBlock(post, post.hidden ? null : `/photo/${post.id}`)}</section>
<form method="post" action="/admin/delete-by-token"><input type="hidden" name="token" value="${esc(token)}"><button class="danger" type="submit">削除する</button></form>`);
  }

  if (path === '/admin/delete-by-token' && method === 'POST') {
    // ここは同一オリジンの判定をしない。合言葉のCookieではなく「署名付きトークン」で本人を確かめる経路なので、
    // トークンを知らない相手は何を送っても弾かれ、知っている相手（＝ダディのDiscordを見られる人）は
    // どうせリンクを自分で開ける。判定を入れると端末によって本人が削除できなくなる害の方が大きい。
    // 「リンクを開いただけで消える」事故は、GETでは消さずこのPOSTを必要にすることで防いでいる。
    const id = await readDeleteToken(env, (await request.formData()).get('token'));
    if (!id || !isId(id)) return html('<h1>リンクが無効です</h1><p>期限が切れているか、リンクが途中で切れています。管理ページから削除してください。</p>', 400);
    await deletePost(env, id);
    return html('<h1>削除しました</h1><p>この画面は閉じて大丈夫です。</p>');
  }

  // ここから下は合言葉が必要
  if (!(await isAdmin(request, env))) return forbidden();

  // 管理用の写真。非表示の投稿でも見られるのがこの経路の目的（公開の /photo は非表示を隠す）
  const photo = path.match(/^[/]admin[/]photo[/]([^/]+)$/);
  if (photo && method === 'GET' && isId(photo[1])) {
    const { value } = await getPhoto(env, photo[1]);
    if (!value) return missing();
    return new Response(value, {
      headers: { 'content-type': 'image/jpeg', 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' },
    });
  }

  // 堤防判定を今の予報で送り直す（定期実行の確認・送り忘れの取り返し用。2026-09-24追加）
  if (path === '/admin/morning' && method === 'POST') {
    if (!sameOrigin(request, url)) return (logRefusal(request, path), forbidden());
    const ok = await sendMorningDraft(env);
    return ok
      ? html('<h1>送りました</h1><p>Discordの「釣り通知」を確認してください。</p><p><a href="/admin">管理ページに戻る</a></p>')
      : html('<h1>送れませんでした</h1><p>Discordへの送信に失敗しました。時間をおいてもう一度お試しください。</p><p><a href="/admin">管理ページに戻る</a></p>', 502);
  }

  const action = path.match(/^[/]admin[/]posts[/]([^/]+)[/](delete|restore)$/);
  if (action && method === 'POST' && isId(action[1])) {
    if (!sameOrigin(request, url)) return (logRefusal(request, path), forbidden());
    const [, id, kind] = action;
    if (kind === 'delete') {
      await deletePost(env, id);
    } else {
      const post = await getPost(env, id);
      if (post) {
        // 通報数も0に戻す。残したままだと、あと1件の通報でまた消えてしまう
        const restored = { ...post, hidden: false, reports: 0 };
        await putPost(env, restored);
        await rebuildIndex(env, { upsert: restored });
      }
    }
    return seeAdmin();
  }

  return missing();
}

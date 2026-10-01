// 署名まわり。削除リンクのトークンと、管理ページのCookie（Task 5）に使う。

export async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 比較にかかる時間から中身を推測されないよう、最後まで比べる */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * 鍵が無いまま署名すると "undefined" を鍵にすることになり、このリポジトリを読んだ誰でも
 * 削除リンクを偽造できてしまう。IP_SALT と同じ考え方で、動かさないほうがよい
 */
export function requireSignSecret(env) {
  if (!env.SIGN_SECRET) throw new Error('SIGN_SECRET missing');
}

const TOKEN_DAYS = 7;

// 用途・投稿ID・期限の全部に署名するので、どれを書き換えても署名が合わなくなる。
// 用途（del＝現地の声の削除リンク、ika＝写真部の掲載確認リンク）を入れるので、片方のリンクをもう片方に流用できない
const tokenMessage = (purpose, postId, exp) => `${purpose}:${postId}.${exp}`;

/** Discordの通知に付けるリンク用。形は <postId>.<期限の秒>.<署名> */
export async function makeToken(env, purpose, postId, now = Date.now()) {
  requireSignSecret(env);
  const exp = Math.floor(now / 1000) + TOKEN_DAYS * 86400;
  return `${postId}.${exp}.${await hmacHex(tokenMessage(purpose, postId, exp), env.SIGN_SECRET)}`;
}

export async function readToken(env, purpose, token, now = Date.now()) {
  requireSignSecret(env);
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [postId, exp, sig] = parts;
  if (!/^[0-9]+$/.test(exp) || Number(exp) < Math.floor(now / 1000)) return null;
  return safeEqual(sig, await hmacHex(tokenMessage(purpose, postId, exp), env.SIGN_SECRET)) ? postId : null;
}

// 現地の声の削除リンク（これまでの名前のまま）
export const makeDeleteToken = (env, postId, now = Date.now()) => makeToken(env, 'del', postId, now);
export const readDeleteToken = (env, token, now = Date.now()) => readToken(env, 'del', token, now);

// ここから下は管理ページ（Task 5）の合言葉とCookie
const ADMIN_COOKIE = 'yfj_admin';
const ADMIN_DAYS = 7;
const ADMIN_MAX_AGE = ADMIN_DAYS * 86400;

// 期限にも署名するので、Cookieの中の期限だけを伸ばしても通らない
const adminMessage = (exp) => `admin:${exp}`;

/** 合言葉の照合。長さの違いも漏らさないよう、両方を同じ長さの署名にしてから比べる */
export async function checkPassphrase(env, input) {
  requireSignSecret(env);
  if (!env.ADMIN_PASSPHRASE || typeof input !== 'string' || !input) return false;
  const [a, b] = await Promise.all([hmacHex(input, env.SIGN_SECRET), hmacHex(env.ADMIN_PASSPHRASE, env.SIGN_SECRET)]);
  return safeEqual(a, b);
}

/** Set-Cookie に入れる値そのもの */
export async function makeAdminCookie(env, now = Date.now()) {
  requireSignSecret(env);
  const exp = Math.floor(now / 1000) + ADMIN_MAX_AGE;
  const value = `${exp}.${await hmacHex(adminMessage(exp), env.SIGN_SECRET)}`;
  return `${ADMIN_COOKIE}=${value}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADMIN_MAX_AGE}`;
}

export async function isAdmin(request, env, now = Date.now()) {
  requireSignSecret(env);
  const raw = (request.headers.get('cookie') || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${ADMIN_COOKIE}=`));
  if (!raw) return false;
  const [exp, sig] = raw.slice(ADMIN_COOKIE.length + 1).split('.');
  if (!/^[0-9]+$/.test(exp || '') || Number(exp) < Math.floor(now / 1000)) return false;
  return safeEqual(sig || '', await hmacHex(adminMessage(exp), env.SIGN_SECRET));
}

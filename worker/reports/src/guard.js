// 荒らし対策の入口：IPのハッシュ化・Turnstileの検証・連続投稿の制限。
import { LIMITS } from './config.js';

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 「同じ人」を数えるための粗いキー。
 * IPv6は1人に /64（2の64乗個）が配られるのが普通なので、アドレス全部で数えると
 * 同じ人がいくらでも別人になれてしまう。先頭4かたまり（/64）までに丸めて数える。
 * IPv4は1つ1つが別の人なのでそのまま使う。
 */
export function ipGroupKey(ip) {
  const s = String(ip);
  if (!s.includes(':')) return s; // IPv4 か 'unknown'
  // ::ffff:203.0.113.1 のようなIPv4射影は、中身のIPv4で数える（全部が同じ /64 に潰れてしまうため）
  const mapped = s.match(/^[0:]*:ffff:([0-9.]+)$/i);
  if (mapped) return mapped[1];
  const [before, after] = s.split('::');
  const head = before ? before.split(':') : [];
  const tail = after ? after.split(':') : [];
  // '::' があるところは 0 で埋めて8かたまりに戻す
  const fill = s.includes('::') ? Array(Math.max(0, 8 - head.length - tail.length)).fill('0') : [];
  const hextets = [...head, ...fill, ...tail].slice(0, 4);
  while (hextets.length < 4) hextets.push('0');
  return `${hextets.map((h) => h.toLowerCase().padStart(4, '0')).join(':')}::/64`;
}

/** 生のIPは保存しない。塩を混ぜたハッシュの先頭16桁だけを「同じ人か」の判定に使う */
export async function ipHashOf(request, env) {
  // 塩が無いまま動かすと、16桁のハッシュはIPv4の全空間から総当たりで逆引きできてしまう。
  // 「生のIPを持たない」が崩れるくらいなら、投稿を受け付けないほうがよい
  if (!env.IP_SALT) throw new Error('IP_SALT missing');
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return (await sha256Hex(`${ipGroupKey(ip)}|${env.IP_SALT}`)).slice(0, 16);
}

export async function verifyTurnstile(token, request, env) {
  if (!token || typeof token !== 'string') return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: request.headers.get('cf-connecting-ip') || '',
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('turnstile verify error', String(err));
    return false;
  }
}

const count = async (env, key) => Number(await env.REPORTS_KV.get(key)) || 0;

/** 1時間・1日の枠が空いていれば1つ使って true。投稿と通報で同じ形を使う */
async function allowInWindow(env, prefix, hash, perHour, perDay, now) {
  const hourKey = `${prefix}:${hash}:h:${Math.floor(now / 3600000)}`;
  // 1日の区切りは日本時間（投稿者に見せている日付もJST。UTCだと朝9時に上限が戻ってしまう）
  const dayKey = `${prefix}:${hash}:d:${Math.floor((now + 9 * 3600000) / 86400000)}`;
  const [h, d] = await Promise.all([count(env, hourKey), count(env, dayKey)]);
  if (h >= perHour || d >= perDay) return false;
  await Promise.all([
    env.REPORTS_KV.put(hourKey, String(h + 1), { expirationTtl: 7200 }),
    env.REPORTS_KV.put(dayKey, String(d + 1), { expirationTtl: 93600 }),
  ]);
  return true;
}

/** 投稿は1時間3件・1日10件 */
export const allowPost = (env, hash, now = Date.now()) => allowInWindow(env, 'rl', hash, LIMITS.perHour, LIMITS.perDay, now);

/** 通報は1時間10件・1日30件（通報3件で投稿が消えるので、ここも数を絞る） */
export const allowReport = (env, hash, now = Date.now()) =>
  allowInWindow(env, 'rr', hash, LIMITS.reportPerHour, LIMITS.reportPerDay, now);

/** 管理ページの合言葉の試行は1時間5回まで */
export async function allowLogin(env, hash, now = Date.now()) {
  const key = `al:${hash}:${Math.floor(now / 3600000)}`;
  const n = await count(env, key);
  if (n >= LIMITS.adminLoginPerHour) return false;
  await env.REPORTS_KV.put(key, String(n + 1), { expirationTtl: 7200 });
  return true;
}

// 公開の経路で共通の応答の形（CORS・JSON）。index.js と ikabu.js の両方から使う（2026-10-01）
import { ALLOWED_ORIGINS } from './config.js';

// vary は許可・不許可にかかわらず必ず付ける。付け忘れると、CORSヘッダーの無い応答が
// 途中のキャッシュに載り、あとから許可originの人に配られてしまう（/posts は30秒キャッシュ）
export function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const allowed = ALLOWED_ORIGINS.includes(origin) ? { 'access-control-allow-origin': origin } : {};
  return { vary: 'Origin', ...allowed };
}

// ブラウザからのCORSは「読ませない」だけで、送りつけること自体は止められない。
// 本物の通報は必ず釣りサイトのページから別オリジンのここへ飛んでくるので、ブラウザが必ず Origin を付ける。
// 逆にOriginが無い送信（curlなど）は、ページを通っていない＝受け取らない
export const fromAllowedSite = (request) => ALLOWED_ORIGINS.includes(request.headers.get('origin'));

export function json(obj, status, request, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(request), ...extra },
  });
}

// 訪問者に見えるので日本語で、CORSヘッダーも付ける
export const notFound = (request) => json({ ok: false, error: '見つかりませんでした。' }, 404, request);

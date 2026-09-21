// Discordへの通知（「秘書クロロに伝達」サーバーのwebhook）。
// 通知は「気づくための仕組み」であって、失敗しても投稿や通報の処理は止めない。
import { LIMITS } from './config.js';
import { makeDeleteToken } from './auth.js';
import { placeById } from '../../../src/js/data/spot-list.js';
import { FISH, WIND_FEEL, nameOf } from '../../../src/js/data/report-options.js';

const NL = '\n';
const FENCE = '```';
const ZERO_WIDTH = String.fromCharCode(0x200b);

// 投稿の本文をそのまま並べると、通知自身の行（「削除する →」など）を真似できてしまう。
// コードブロックに入れて地の文と分ける。囲いを壊されないよう、本文のバッククォートは
// 幅ゼロの文字ではさんで隣り合わせないようにする（3つ並ばなければ囲いは閉じない）
function quoted(text) {
  const safe = String(text).split(FENCE[0]).join(FENCE[0] + ZERO_WIDTH);
  return [FENCE, safe, FENCE].join(NL);
}

async function send(env, lines, { mention = false } = {}) {
  if (!env.DISCORD_WEBHOOK_URL) return false;
  // メンション先は個人のDiscordユーザーIDなので、コードに書かずWorkerのsecretから読む。
  // 未設定のときは「undefined」を出さず、誰も呼ばずに送る
  const to = mention ? env.NOTIFY_MENTION_USER_ID : null;
  const content = (to ? `<@${to}>${NL}` : '') + lines.filter(Boolean).join(NL);
  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: '秘書クロロ',
        content: content.slice(0, 1900),
        // 投稿の本文に @everyone などが書かれていても展開させない
        allowed_mentions: { parse: [], users: to ? [to] : [] },
      }),
    });
    if (!res.ok) console.error('discord notify failed', res.status);
    return res.ok;
  } catch (err) {
    console.error('discord notify error', String(err));
    return false;
  }
}

function summary(post) {
  const extras = [nameOf(FISH, post.fish), nameOf(WIND_FEEL, post.wind)].filter(Boolean).join(' ／ ');
  return [
    `**${post.name}** ｜ ${placeById(post.spotId)?.name ?? post.spotId} ｜ ${post.date}`,
    extras,
    quoted(post.comment),
  ].filter(Boolean).join(NL);
}

export async function notifyNewPost(env, post, origin) {
  const token = await makeDeleteToken(env, post.id);
  return send(env, [
    '🎣 現地の声：新しい投稿',
    summary(post),
    post.hasPhoto ? `${origin}/photo/${post.id}` : '',
    `削除する → ${origin}/admin/delete?token=${token}`,
  ]);
}

export async function notifyHidden(env, post, origin) {
  return send(env, [
    `⚠️ 現地の声：通報が${LIMITS.reportsToHide}件に達したため、投稿を自動で非表示にしました`,
    summary(post),
    `確認・再表示・削除 → ${origin}/admin`,
  ], { mention: true });
}

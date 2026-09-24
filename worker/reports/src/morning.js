// 毎朝7:00（日本時間）に「堤防判定」のX投稿の下書きをDiscordへ送る（2026-09-22追加）。
// 2026-09-24：5:00→7:00に変更し、ダディのスマホで鳴るよう@メンションを付けた
// （投稿忘れ対策。X APIの自動投稿は有料のため見送り、ダディが手で押す運用のまま）。
// Cloudflareの定期実行（Cron Trigger）から呼ばれる。投稿そのものはダディが手で行う。
//
// 判定はSEAページと同じ関数（assessSafety）を同じ現在値で呼ぶ。サイトとXで数字が
// 食い違わないよう、ここで独自の計算をしないこと。
// GitHub Actionsではなくここに置いた理由：Webhookが既にこのWorkerのsecretにあり、
// GitHubの「60日pushが無いと止まる」「混雑で数十分遅れる」も無いため。

import { areas } from '../../../src/js/data/areas.js';
import { fetchWeather } from '../../../src/js/api/weather.js';
import { assessSafety } from '../../../src/js/api/safety.js';
import { composeMorningPost, morningDiscordContent } from '../../../src/js/lib/morning-post.js';

// 予報APIが応答しないまま止まると、Discordまで届かずに終わる（2026-09-24、手動送信が途中で切れた）。
// 1エリア10秒で見切って「取得できず」として先へ進む
const WEATHER_TIMEOUT_MS = 10000;
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms))]);

/** 5エリアの判定。予報を取れなかったエリアは level: null */
export async function morningRows(fetchW = fetchWeather) {
  return Promise.all(
    areas.map(async (area) => {
      try {
        const w = await withTimeout(fetchW(area), WEATHER_TIMEOUT_MS, `weather ${area.id}`);
        const s = assessSafety({
          wind: w.current.wind,
          gust: w.current.gust,
          waveHeight: w.current.wave,
          wavePeriod: w.current.wavePeriod,
          windDir: w.current.windDir,
          facing: area.facing,
          seaProfile: area.seaProfile,
        });
        return { nameJa: area.nameJa, level: s.level, wind: w.current.wind };
      } catch (err) {
        console.error('morning: weather failed', area.id, String(err));
        return { nameJa: area.nameJa, level: null, wind: null };
      }
    })
  );
}

export async function sendMorningDraft(env, { now = new Date(), fetchW = fetchWeather } = {}) {
  if (!env.DISCORD_WEBHOOK_URL) {
    console.error('morning: DISCORD_WEBHOOK_URL missing');
    return false;
  }
  const t0 = Date.now();
  const rows = await morningRows(fetchW);
  console.log('morning: rows', Date.now() - t0, 'ms', rows.map((r) => `${r.nameJa}:${r.level}`).join(' '));
  const text = composeMorningPost({ date: now, rows });
  const draft = morningDiscordContent(text, rows.every((r) => r.level == null));
  // 通知を鳴らすためのメンション。IDは wrangler.toml の [vars]（git管理外）に置く
  const mentionId = /^\d{17,20}$/.test(env.DISCORD_MENTION_USER_ID ?? '') ? env.DISCORD_MENTION_USER_ID : null;
  const content = mentionId ? `<@${mentionId}>\n${draft}` : draft;
  const res = await withTimeout(fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: '秘書クロロ',
      content,
      // 鳴らすのは指定した1人だけ。下書き本文の@や@everyoneは展開させない
      allowed_mentions: mentionId ? { parse: [], users: [mentionId] } : { parse: [] },
      flags: 4, // リンクのプレビュー（埋め込み）を出さない。通知が長くなりすぎるため
    }),
  }), WEATHER_TIMEOUT_MS, 'discord').catch((err) => {
    console.error('morning: discord error', String(err));
    return null;
  });
  if (!res) return false;
  if (!res.ok) console.error('morning: discord failed', res.status, (await res.text().catch(() => '')).slice(0, 300));
  else console.log('morning: discord ok', res.status, Date.now() - t0, 'ms');
  return res.ok;
}

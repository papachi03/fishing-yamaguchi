// 毎朝5:00（日本時間）に「堤防判定」のX投稿の下書きをDiscordへ送る（2026-09-22追加）。
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

/** 5エリアの判定。予報を取れなかったエリアは level: null */
export async function morningRows(fetchW = fetchWeather) {
  return Promise.all(
    areas.map(async (area) => {
      try {
        const w = await fetchW(area);
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
  const rows = await morningRows(fetchW);
  const text = composeMorningPost({ date: now, rows });
  const content = morningDiscordContent(text, rows.every((r) => r.level == null));
  const res = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: '秘書クロロ',
      content,
      allowed_mentions: { parse: [] },
      flags: 4, // リンクのプレビュー（埋め込み）を出さない。通知が長くなりすぎるため
    }),
  });
  if (!res.ok) console.error('morning: discord failed', res.status);
  return res.ok;
}

// 毎朝7:00（日本時間）に「堤防判定」のX投稿の下書きをDiscordへ送る（2026-09-22追加）。
// 2026-09-24：5:00→7:00に変更し、ダディのスマホで鳴るよう@メンションを付けた
// （投稿忘れ対策。X APIの自動投稿は有料のため見送り、ダディが手で押す運用のまま）。
// Cloudflareの定期実行（Cron Trigger）と、管理ページの「今すぐ送る」ボタンから呼ばれる。
//
// 判定はSEAページと同じ関数（assessSafety）を使う。サイトとXで数字が
// 食い違わないよう、ここで独自の計算をしないこと。
//
// 予報の出どころ（2026-09-24変更）：
//   ① 釣りサイトがビルド時（3時間ごと）に取った予報 /data/sea-snapshot.json の「今の時間帯」の値
//   ② ①が無い・古い（6時間超）・その地域だけ欠けている場合に限り、Open-Meteoへ直接聞く
//   Worker から Open-Meteo に直接聞くと、応答が返ってこない地域が出る（9/24夜、5地域中3地域が
//   10秒待っても返らず、定期実行のテストも2回Discordまで届かなかった）。GitHub Actions からの取得は安定している。

import { areas } from '../../../src/js/data/areas.js';
import { fetchWeather } from '../../../src/js/api/weather.js';
import { assessSafety } from '../../../src/js/api/safety.js';
import { composeMorningPost, morningDiscordContent } from '../../../src/js/lib/morning-post.js';

export const SNAPSHOT_URL = 'https://yamaguchifishing.com/data/sea-snapshot.json';
const SNAPSHOT_MAX_AGE_MS = 6 * 3600 * 1000;
// 1つの問い合わせを待つ上限。応答が無いまま止まってDiscordまで届かない事故を防ぐ
const TIMEOUT_MS = 10000;

const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms))]);

const judge = (area, c) => {
  const s = assessSafety({
    wind: c.wind,
    gust: c.gust,
    waveHeight: c.wave,
    wavePeriod: c.wavePeriod,
    windDir: c.windDir,
    facing: area.facing,
    seaProfile: area.seaProfile,
  });
  return { nameJa: area.nameJa, level: s.level, wind: c.wind };
};

/** 釣りサイトの予報ファイルを取る。使えなければ null */
export async function loadSnapshot(now = new Date()) {
  try {
    const res = await withTimeout(fetch(`${SNAPSHOT_URL}?t=${now.getTime()}`), TIMEOUT_MS, 'snapshot');
    if (!res.ok) throw new Error(`status ${res.status}`);
    const snap = await res.json();
    const age = now.getTime() - new Date(snap.fetchedAt).getTime();
    if (!(age >= 0 && age <= SNAPSHOT_MAX_AGE_MS)) throw new Error(`stale ${Math.round(age / 60000)}min`);
    return snap;
  } catch (err) {
    console.error('morning: snapshot unusable', String(err));
    return null;
  }
}

/**
 * 予報ファイルの中から「今の時間帯」（日本時間の正時）の値を取り出す。
 * Open-Meteoの時刻は "2026-09-25T07:00" の形（日本時間・時差の表記なし）
 */
export function hourAt(weather, now) {
  const j = new Date(now.getTime() + 9 * 3600 * 1000);
  const key = `${j.toISOString().slice(0, 13)}:00`;
  const h = weather?.hourly?.find((x) => x.time === key);
  return h && h.wind != null ? h : null;
}

/** 5エリアの判定。予報を取れなかったエリアは level: null */
export async function morningRows(fetchW = fetchWeather, { snapshot = null, now = new Date() } = {}) {
  return Promise.all(
    areas.map(async (area) => {
      const h = hourAt(snapshot?.areas?.[area.id], now);
      if (h) return judge(area, h);
      try {
        const w = await withTimeout(fetchW(area), TIMEOUT_MS, `weather ${area.id}`);
        return judge(area, w.current);
      } catch (err) {
        console.error('morning: weather failed', area.id, String(err));
        return { nameJa: area.nameJa, level: null, wind: null };
      }
    })
  );
}

export async function sendMorningDraft(env, { now = new Date(), fetchW = fetchWeather, getSnapshot = loadSnapshot } = {}) {
  if (!env.DISCORD_WEBHOOK_URL) {
    console.error('morning: DISCORD_WEBHOOK_URL missing');
    return false;
  }
  const t0 = Date.now();
  const snapshot = await getSnapshot(now);
  const rows = await morningRows(fetchW, { snapshot, now });
  console.log('morning: rows', Date.now() - t0, 'ms', snapshot ? `snapshot ${snapshot.fetchedAt}` : 'no snapshot', rows.map((r) => `${r.nameJa}:${r.level}`).join(' '));
  const text = composeMorningPost({ date: now, rows });
  const draft = morningDiscordContent(text, rows.every((r) => r.level == null), now);
  // 通知を鳴らすためのメンション。IDは wrangler.toml の [vars]（git管理外）に置く
  const mentionId = /^\d{17,20}$/.test(env.DISCORD_MENTION_USER_ID ?? '') ? env.DISCORD_MENTION_USER_ID : null;
  const content = mentionId ? `<@${mentionId}>\n${draft}` : draft;
  const res = await withTimeout(
    fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: '秘書クロロ',
        content,
        // 鳴らすのは指定した1人だけ。下書き本文の@や@everyoneは展開させない
        allowed_mentions: mentionId ? { parse: [], users: [mentionId] } : { parse: [] },
        flags: 4, // リンクのプレビュー（埋め込み）を出さない。通知が長くなりすぎるため
      }),
    }),
    TIMEOUT_MS,
    'discord'
  ).catch((err) => {
    console.error('morning: discord error', String(err));
    return null;
  });
  if (!res) return false;
  if (!res.ok) console.error('morning: discord failed', res.status, (await res.text().catch(() => '')).slice(0, 300));
  else console.log('morning: discord ok', res.status, Date.now() - t0, 'ms');
  return res.ok;
}

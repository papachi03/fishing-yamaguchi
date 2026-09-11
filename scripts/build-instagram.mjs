// Instagramの自分の投稿を公式API（Instagram API with Instagram Login）で取得し、
// サイト用のJSONと画像に落とす。潮汐の build-tide.mjs と同じ「ビルド前に取り込む」型。
//
// なぜビルド時か:
//   アクセストークンをサイト本体に埋め込むと誰でも見られる。Node側で取得して
//   結果（画像・JSON）だけをサイトに置けば、トークンは手元の .env から出ない。
//   また、APIが返す画像URLは数日で失効するため、画像を自前で保存しておく必要がある。
//
// 使い方:
//   1. site/.env に INSTAGRAM_ACCESS_TOKEN=（長期トークン）を書く（.env.example 参照）
//   2. node scripts/build-instagram.mjs          … 最新24件を取得
//      node scripts/build-instagram.mjs 12       … 件数を指定
//   3. 出力: src/js/data/instagram-feed.json / assets/instagram/<id>.jpg
//
// トークンは60日で失効する。このスクリプトは実行のたびに有効期限を延長し、
// 新しいトークンを .env に書き戻す（旧 .env は .env.bak に退避）。
// 60日以上一度も実行しないと失効するので、月1回は実行すること。

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_FILE = resolve(ROOT, '.env');
const OUT_JSON = resolve(ROOT, 'src/js/data/instagram-feed.json');
const OUT_DIR = resolve(ROOT, 'assets/instagram');
const API = 'https://graph.instagram.com/v25.0';
const LIMIT = Number(process.argv[2] ?? 24);

// ---------- .env ----------
async function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const text = await readFile(ENV_FILE, 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
  }
  return env;
}

async function writeEnvToken(newToken) {
  const text = existsSync(ENV_FILE) ? await readFile(ENV_FILE, 'utf8') : '';
  await copyFile(ENV_FILE, ENV_FILE + '.bak').catch(() => {});
  const updated = /^INSTAGRAM_ACCESS_TOKEN=/m.test(text)
    ? text.replace(/^INSTAGRAM_ACCESS_TOKEN=.*$/m, `INSTAGRAM_ACCESS_TOKEN=${newToken}`)
    : text + `\nINSTAGRAM_ACCESS_TOKEN=${newToken}\n`;
  await writeFile(ENV_FILE, updated, 'utf8');
}

// ---------- API ----------
async function api(path, params) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body.error?.message ?? `${res.status} ${res.statusText}`;
    throw new Error(`Instagram API: ${msg}`);
  }
  return body;
}

async function refreshToken(token) {
  // 発行から24時間以上たったトークンだけ延長できる。当日は 400 が返るので無視する
  try {
    const r = await api('refresh_access_token', { grant_type: 'ig_refresh_token', access_token: token });
    if (r.access_token) {
      await writeEnvToken(r.access_token);
      const days = Math.round((r.expires_in ?? 0) / 86400);
      console.log(`トークンを延長しました（残り約${days}日）。.env を更新。`);
      return r.access_token;
    }
  } catch (e) {
    console.log(`トークン延長はスキップ: ${e.message}`);
  }
  return token;
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`画像取得失敗 ${res.status}: ${url}`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

// ---------- main ----------
const env = await readEnv();
let token = env.INSTAGRAM_ACCESS_TOKEN;
if (!token) {
  console.error('INSTAGRAM_ACCESS_TOKEN が .env にありません。.env.example と docs/INSTAGRAM_SETUP.md を参照してください。');
  process.exit(1);
}

token = await refreshToken(token);

const me = await api('me', { fields: 'id,username', access_token: token });
console.log(`取得中: @${me.username} の投稿 最新${LIMIT}件 …`);

const media = await api('me/media', {
  fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
  limit: String(LIMIT),
  access_token: token,
});

await mkdir(OUT_DIR, { recursive: true });

const feed = [];
for (const m of media.data ?? []) {
  // 動画はサムネイル、画像・カルーセルは media_url（カルーセルは1枚目）
  const src = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
  if (!src) continue;
  const file = resolve(OUT_DIR, `${m.id}.jpg`);
  if (!existsSync(file)) {
    await download(src, file);
    process.stdout.write('.');
  }
  feed.push({
    id: m.id,
    permalink: m.permalink,
    caption: m.caption ?? '',
    mediaType: m.media_type, // IMAGE | VIDEO | CAROUSEL_ALBUM
    timestamp: m.timestamp,
    image: `/assets/instagram/${m.id}.jpg`,
  });
}
console.log('');

await writeFile(
  OUT_JSON,
  JSON.stringify({ username: me.username, fetchedAt: new Date().toISOString(), posts: feed }, null, 2),
  'utf8'
);
console.log(`書き出し: ${OUT_JSON}（${feed.length}件）`);
console.log('完了');

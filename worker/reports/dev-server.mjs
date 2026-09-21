// 手元の通し確認用：Workerを http://127.0.0.1:8787 で動かす（wranglerもCloudflareのログインも要らない）。
// データはメモリの中だけ。止めると消える。
//   起動： npm run dev:worker
//   管理ページ： http://127.0.0.1:8787/admin （合言葉 dev-pass）
// Turnstileは Cloudflare公式の「必ず通る」テスト用の鍵を使う（本物のsiteverifyに問い合わせる＝ネット接続が要る）。
import http from 'node:http';
import worker from './src/index.js';
import { fakeKV } from './test/fakes.mjs';

const env = {
  REPORTS_KV: fakeKV(),
  TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
  IP_SALT: 'dev-salt',
  SIGN_SECRET: 'dev-sign-secret-dev-sign-secret',
  ADMIN_PASSPHRASE: 'dev-pass',
  // DISCORD_WEBHOOK_URL は入れない（手元の試し投稿で本物のDiscordを鳴らさない）
};
const PORT = 8787;

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers(Object.entries(req.headers).filter(([, v]) => typeof v === 'string'));
    // 手元だけの仕掛け：x-dev-ip を付けると「別の人」になれる（通報3件→非表示の確認用）。本番のWorkerには無い
    headers.set('cf-connecting-ip', req.headers['x-dev-ip'] || req.socket.remoteAddress || '127.0.0.1');
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const request = new Request(`http://127.0.0.1:${PORT}${req.url}`, {
      method: req.method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    });
    const pending = [];
    const response = await worker.fetch(request, env, { waitUntil: (p) => pending.push(p) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    await Promise.allSettled(pending);
    console.log(req.method, req.url, response.status);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`yfj-reports dev server: http://127.0.0.1:${PORT}`));

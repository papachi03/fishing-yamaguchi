// SEAページの事前描画（ビルド時に実行。vite.config.js のプラグインから呼ぶ）。
//
// なぜ必要か（2026-09-14）:
//   SEAページは中身をすべて「開いた後に」Open-Meteo から取っていたため、Googlebot の
//   クロール環境では取得に失敗し、ページが「海況を取得できませんでした」の1行になって
//   Search Console で「ソフト404」＝インデックス登録不可と判定されていた。
//   ここでビルド時に5エリアの予報を取得し、
//     ① 萩のダッシュボードをHTMLに直接書き込む（Googlebotは通信しなくても中身を読める）
//     ② 5エリア分の予報を <script type="application/json" id="sea-snapshot"> に埋め込む
//        （開いた人のブラウザで取得に失敗したら「○時○分時点の予報」として代わりに見せる）
//   GitHub Actions が3時間ごとにビルドし直すので、埋め込んだ予報は最大3時間ほど古いだけ。
//
// 予報の取得に失敗してもビルドは止めない（天気の欄を省いて潮汐・基準だけ書き込む）。
// 無効にしたいとき: PRERENDER_SEA=0 npm run build

import { createServer } from 'vite';

const TIMEOUT_MS = 20000;

const withTimeout = (p, ms, label) =>
  Promise.race([
    p,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: ${ms}ms でタイムアウト`)), ms)),
  ]);

// JSON を <script> の中に安全に置く（"</script>" などで途中終了しないように）
const safeJSON = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

export async function prerenderSea(html, root) {
  // 日付・時刻はすべて日本時間で扱う（CIのサーバーはUTCのため）
  process.env.TZ = 'Asia/Tokyo';

  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });

  try {
    const { areas, areaById } = await server.ssrLoadModule('/src/js/data/areas.js');
    const { fetchWeather } = await server.ssrLoadModule('/src/js/api/weather.js');
    const { fetchTide } = await server.ssrLoadModule('/src/js/api/tide.js');
    const render = await server.ssrLoadModule('/src/js/pages/sea-render.js');

    const now = new Date();
    const snapshot = { fetchedAt: now.toISOString(), areas: {} };
    const log = [];

    for (const area of areas) {
      try {
        const w = await withTimeout(fetchWeather(area), TIMEOUT_MS, area.id);
        snapshot.areas[area.id] = render.trimWeather(w);
        log.push(`${area.id}:ok`);
      } catch (e) {
        log.push(`${area.id}:NG(${e.message})`);
      }
    }

    const first = areaById('hagi');
    let t = null;
    try {
      t = await fetchTide(first, now);
    } catch (e) {
      log.push(`tide:NG(${e.message})`);
    }

    const w = snapshot.areas[first.id] ?? null;
    const dash = render.dashHTML({
      area: first,
      w,
      t,
      now,
      updatedLabel: `${now.getMonth() + 1}/${now.getDate()} ${render.hhmm(now)} ${w ? '時点の予報' : '更新'}`,
    });

    let out = html;
    // from は文字列か正規表現。置き換え後の文字列に "$" が含まれても壊れないよう関数で渡す
    const replaceOnce = (from, to, label) => {
      const found = typeof from === 'string' ? out.includes(from) : from.test(out);
      if (!found) throw new Error(`sea.html に「${label}」の目印が見つかりません`);
      out = out.replace(from, () => to);
    };

    replaceOnce(
      '<div class="sea-page-toggle" role="tablist" aria-label="エリア切り替え" id="area-toggle"></div>',
      `<div class="sea-page-toggle" role="tablist" aria-label="エリア切り替え" id="area-toggle">${render.toggleHTML(areas, first.id)}</div>`,
      'エリア切り替え'
    );
    replaceOnce(
      /<div class="sea-dash" id="sea-dash">\s*<p class="sea-error">海況を取得しています…<\/p>\s*<\/div>/,
      `<div class="sea-dash" id="sea-dash" data-prerendered="${first.id}">${dash}</div>`,
      'ダッシュボード'
    );
    replaceOnce(
      'id="source-note"></p>',
      `id="source-note">${render.sourceNoteText(first, t)}</p>`,
      '出典'
    );
    replaceOnce(
      '<script type="module" src="/src/js/pages/sea.js"></script>',
      `<script type="application/json" id="sea-snapshot">${safeJSON(snapshot)}</script>\n  <script type="module" src="/src/js/pages/sea.js"></script>`,
      'スクリプト'
    );

    console.log(`[prerender-sea] ${now.toISOString()} ${log.join(' ')}`);
    return out;
  } finally {
    await server.close();
  }
}

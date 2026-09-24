// イカ部ページの事前描画（ビルド時に実行。vite.config.js の prerender-ikabu プラグインから呼ぶ）。
//
// なぜ必要か：小松氏の元サイトは全ページ JavaScript だけで描画しており Google には空に見えた
//   （YFJ の SEA で起きた「ソフト404」と同じ）。そこでブラウザと同じ render(lang) を
//   ビルド時にも呼び、ヘッダー・本文・フッターを HTML に書き込む。
//   dev（npm run dev）では殻のまま配信し、ブラウザ側の boot() が同じ関数で描く。
//
// view は import.meta.env（base.js）を使うので、素の node ではなく vite の ssrLoadModule で読む。
// 20ページで毎回サーバーを立てると遅いので、1つを使い回して closeBundle で閉じる。
import { createServer } from 'vite';

let server = null;

async function getServer(root, base) {
  if (server) return server;
  server = await createServer({
    root,
    base,
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    // watch: null … ファイル監視を切る（残っているとビルド後に node が終了しない）
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  return server;
}

export async function closePrerenderIkabu() {
  if (server) await server.close();
  server = null;
}

// ファイル名から page と lang を取り出す。/ikabu/ 配下でなければ null。
// /ikabu/recipes/<id>.html（/ikabu/en/recipes/<id>.html）は page='recipe' ＋ recipeId
export function parseIkabuPath(filename) {
  const p = filename.replace(/\\/g, '/');
  const r = p.match(/\/ikabu\/(en\/)?recipes\/([a-z0-9-]+)\.html$/);
  if (r) return { lang: r[1] ? 'en' : 'ja', page: 'recipe', recipeId: r[2] };
  const m = p.match(/\/ikabu\/(en\/)?([a-z]+)\.html$/);
  if (!m) return null;
  return { lang: m[1] ? 'en' : 'ja', page: m[2], recipeId: null };
}

const MARKS = {
  header: '<header id="ika-header"></header>',
  main: '<main id="main"></main>',
  footer: '<footer id="ika-footer"></footer>',
};

export async function prerenderIkabu(html, { filename, root, base }) {
  const target = parseIkabuPath(filename);
  if (!target) return html;
  const { page, lang, recipeId } = target;

  for (const [k, mark] of Object.entries(MARKS)) {
    if (!html.includes(mark)) throw new Error(`[prerender-ikabu] ${filename}: ${k} の目印 ${mark} が見つかりません（scripts/gen-ikabu-shells.mjs で作り直してください）`);
  }

  const s = await getServer(root, base);
  const shell = await s.ssrLoadModule('/src/js/ikabu/shell.js');
  const view = await s.ssrLoadModule(`/src/js/ikabu/views/${page}.js`);
  if (typeof view.render !== 'function') throw new Error(`[prerender-ikabu] views/${page}.js に render(lang) がありません`);

  // replace の第2引数に関数を渡す：本文に "$&" などがあっても置換パターンとして解釈されない
  return html
    .replace(MARKS.header, () => `<header id="ika-header">${shell.headerHTML(lang, page, { recipeId })}</header>`)
    .replace(MARKS.main, () => `<main id="main">${view.render(lang, { recipeId })}</main>`)
    .replace(MARKS.footer, () => `<footer id="ika-footer">${shell.footerHTML(lang, page)}</footer>`);
}

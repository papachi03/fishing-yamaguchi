import { defineConfig } from 'vite';
import { resolve } from 'path';
import { prerenderSea } from './scripts/prerender-sea.mjs';
import { prerenderIkabu, closePrerenderIkabu } from './scripts/prerender-ikabu.mjs';
import { IKABU_PAGES } from './scripts/gen-ikabu-shells.mjs';

// イカ部：ikabu/<page>.html と ikabu/en/<page>.html（殻は scripts/gen-ikabu-shells.mjs が作る）
const ikabuInputs = Object.fromEntries(
  IKABU_PAGES.flatMap((p) => [
    [`ikabu-${p}`, resolve(__dirname, `ikabu/${p}.html`)],
    [`ikabu-en-${p}`, resolve(__dirname, `ikabu/en/${p}.html`)],
  ])
);

export default defineConfig({
  // GitHub Pages のサブフォルダ配置に対応。CIでは SITE_BASE=/fishing-yamaguchi/ を渡す。
  base: process.env.SITE_BASE || '/',
  plugins: [
    {
      // SEAページに予報を書き込む（Googlebot対策。詳細は scripts/prerender-sea.mjs）。
      // ビルド時だけ動く。npm run dev では従来どおりブラウザで取得する
      name: 'prerender-sea',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          if (!ctx.filename.replace(/\\/g, '/').endsWith('/sea.html')) return html;
          if (process.env.PRERENDER_SEA === '0') return html;
          return prerenderSea(html, __dirname);
        },
      },
    },
    {
      // 「現地の声」ページに、選べる釣り場の一覧を書き込む（検索エンジンが通信なしで読める本文にする）
      name: 'prerender-reports',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          if (!ctx.filename.replace(/\\/g, '/').endsWith('/reports.html')) return html;
          const mark = '<dl class="spot-names-list" id="spot-names"></dl>';
          if (!html.includes(mark)) throw new Error('reports.html に釣り場一覧の目印が見つかりません');
          const { spotListHTML } = await import('./src/js/components/spot-list-html.js');
          return html.replace(mark, () => `<dl class="spot-names-list" id="spot-names">${spotListHTML()}</dl>`);
        },
      },
    },
    {
      // イカ部：/ikabu/ 配下の殻に、ブラウザと同じ render(lang) でヘッダー・本文・フッターを書き込む
      // （詳細は scripts/prerender-ikabu.mjs）。dev ではブラウザ側で描く
      name: 'prerender-ikabu',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          return prerenderIkabu(html, { filename: ctx.filename, root: __dirname, base: process.env.SITE_BASE || '/' });
        },
      },
      closeBundle: closePrerenderIkabu,
    },
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        sea: resolve(__dirname, 'sea.html'),
        journal: resolve(__dirname, 'journal.html'),
        log: resolve(__dirname, 'log.html'),
        spots: resolve(__dirname, 'spots.html'),
        about: resolve(__dirname, 'about.html'),
        tackle: resolve(__dirname, 'tackle.html'),
        reports: resolve(__dirname, 'reports.html'),
        invite: resolve(__dirname, 'invite.html'),
        ...ikabuInputs,
      },
    },
  },
});

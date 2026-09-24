import { defineConfig } from 'vite';
import { resolve } from 'path';
import { prerenderSea } from './scripts/prerender-sea.mjs';
import { prerenderIkabu, closePrerenderIkabu } from './scripts/prerender-ikabu.mjs';
import { ikabuShells } from './scripts/gen-ikabu-shells.mjs';

// イカ部：ikabu/<page>.html、ikabu/en/<page>.html、ikabu/(en/)recipes/<id>.html（殻は scripts/gen-ikabu-shells.mjs が作る）
const ikabuInputs = Object.fromEntries(
  ikabuShells().map((s) => [`ikabu-${s.file.replace(/^ikabu\//, '').replace(/\.html$/, '').replace(/\//g, '-')}`, resolve(__dirname, s.file)])
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
          // YFJ 本体の sea.html だけ（イカ部の ikabu/sea.html・ikabu/en/sea.html も末尾が同じなので、場所まで比べる）
          if (resolve(ctx.filename) !== resolve(__dirname, 'sea.html')) return html;
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
          if (resolve(ctx.filename) !== resolve(__dirname, 'reports.html')) return html;
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

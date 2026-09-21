import { defineConfig } from 'vite';
import { resolve } from 'path';
import { prerenderSea } from './scripts/prerender-sea.mjs';

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
      },
    },
  },
});

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { prerenderSea } from './scripts/prerender-sea.mjs';

// SEAの事前描画で取った予報。generateBundle で dist/data/sea-snapshot.json として出す
let seaSnapshot = null;

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
          return prerenderSea(html, __dirname, (s) => { seaSnapshot = s; });
        },
      },
      // 朝の堤防判定（Worker）が読む予報ファイル。1エリアも取れなかったときは出さない（古い値を残さない）
      generateBundle() {
        if (!seaSnapshot || !Object.keys(seaSnapshot.areas).length) return;
        this.emitFile({ type: 'asset', fileName: 'data/sea-snapshot.json', source: JSON.stringify(seaSnapshot) });
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
      // HOMEの「攻略ガイド」写真カードを本文に書き込む（JS無し・検索エンジンでも読める）。
      // 「今月」はビルドした日の月。サイトは3時間ごとに再ビルドされるので月替わりも追従する。
      // devでも同じ見た目にするため apply は付けない
      name: 'prerender-home-guides',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          // トップの index.html だけ。イカ部（ikabu/**/index.html）など下の階層の index.html は対象外
          if (ctx.filename.replace(/\\/g, '/') !== resolve(__dirname, 'index.html').replace(/\\/g, '/')) return html;
          const mark = '<div class="home-guides" id="home-guides"></div>';
          if (!html.includes(mark)) throw new Error('index.html に攻略ガイドの目印が見つかりません');
          const { guideCardsHTML, homeGuides } = await import('./src/js/components/guide-card-html.js');
          const list = homeGuides(new Date().getMonth() + 1);
          const base = process.env.SITE_BASE || '';
          return html.replace(mark, () => `<div class="home-guides" id="home-guides">${guideCardsHTML(list, { base })}</div>`);
        },
      },
    },
    {
      // 攻略記事（guides/*.html）の道具カードを本文に書き込む。devでも同じ見た目にするため apply は付けない
      name: 'prerender-guide-tackle',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          if (!ctx.filename.replace(/\\/g, '/').includes('/guides/')) return html;
          const { fillGuideTackle } = await import('./src/js/components/guide-tackle-html.js');
          return fillGuideTackle(html);
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
        invite: resolve(__dirname, 'invite.html'),
        'guides/autumn-eging': resolve(__dirname, 'guides/autumn-eging.html'),
      },
    },
  },
});

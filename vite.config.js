import { defineConfig } from 'vite';
import { resolve } from 'path';
import { prerenderSea } from './scripts/prerender-sea.mjs';
import { prerenderIkabu, closePrerenderIkabu } from './scripts/prerender-ikabu.mjs';
import { ikabuShells } from './scripts/gen-ikabu-shells.mjs';

// イカ部：ikabu/<page>.html、ikabu/en/<page>.html、ikabu/(en/)recipes/<id>.html（殻は scripts/gen-ikabu-shells.mjs が作る）
const ikabuInputs = Object.fromEntries(
  ikabuShells().map((s) => [`ikabu-${s.file.replace(/^ikabu\//, '').replace(/\.html$/, '').replace(/\//g, '-')}`, resolve(__dirname, s.file)])
);

// SEAの事前描画で取った予報。generateBundle で dist/data/sea-snapshot.json として出す
let seaSnapshot = null;

export default defineConfig({
  // GitHub Pages のサブフォルダ配置に対応。CIでは SITE_BASE=/fishing-yamaguchi/ を渡す。
  base: process.env.SITE_BASE || '/',
  plugins: [
    {
      // SEAページに予報を書き込む（Googlebot対策。詳細は scripts/prerender-sea.mjs）。
      // ビルド時だけ動く。npm run dev では dev-sea-snapshot（下）が予報ファイルをその場で作る
      name: 'prerender-sea',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          // YFJ 本体の sea.html だけ（イカ部の ikabu/sea.html・ikabu/en/sea.html も末尾が同じなので、場所まで比べる）
          if (resolve(ctx.filename) !== resolve(__dirname, 'sea.html')) return html;
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
      // npm run dev 用：/data/sea-snapshot.json をその場で作って返す（本番はビルド時に dist/data へ出す）。
      // 2026-09-24 乗り換えで、ブラウザは予報を直接取らず、このファイル（か埋め込み）を読むようになったため。
      // 取得元（met.no）に負担をかけないよう30分は使い回す
      name: 'dev-sea-snapshot',
      apply: 'serve',
      configureServer(server) {
        let cache = null;
        server.middlewares.use(async (req, res, next) => {
          if (!req.url || !req.url.split('?')[0].endsWith('/data/sea-snapshot.json')) return next();
          try {
            if (!cache || Date.now() - cache.at > 30 * 60e3) {
              const { areas } = await server.ssrLoadModule('/src/js/data/areas.js');
              const { fetchWeather } = await server.ssrLoadModule('/src/js/api/weather.js');
              const { trimWeather } = await server.ssrLoadModule('/src/js/pages/sea-render.js');
              const snap = { fetchedAt: new Date().toISOString(), areas: {} };
              for (const a of areas) {
                try {
                  snap.areas[a.id] = trimWeather(await fetchWeather(a));
                } catch (e) {
                  console.warn(`[dev-sea-snapshot] ${a.id}: ${e.message} ${e.cause?.code ?? e.cause?.message ?? ""}`);
                }
              }
              cache = { at: Date.now(), body: JSON.stringify(snap) };
            }
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(cache.body);
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      },
    },
    {
      // 「現地の声」ページと釣り場ページに、釣り場の名前の一覧を書き込む（検索エンジンが通信なしで読める本文にする）
      // 釣り場ページは 2026-09-28 から（数も一覧から数えて書き込む＝「74か所」がいつも事実どおり）
      name: 'prerender-reports',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          // ルートの reports.html / spots.html だけ（イカ部の下の階層に同じ名前があっても触らない：イカ部側の書き方に合わせる）
          const f = resolve(ctx.filename);
          if (f !== resolve(__dirname, 'reports.html') && f !== resolve(__dirname, 'spots.html')) return html;
          const mark = '<dl class="spot-names-list" id="spot-names"></dl>';
          if (!html.includes(mark)) throw new Error(`${f} に釣り場一覧の目印が見つかりません`);
          const { spotListHTML } = await import('./src/js/components/spot-list-html.js');
          const { SPOTS } = await import('./src/js/data/spot-list.js');
          return html
            .replace(mark, () => `<dl class="spot-names-list" id="spot-names">${spotListHTML()}</dl>`)
            .replace('<span class="spot-count"></span>', `<span class="spot-count">${SPOTS.length}</span>`);
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
      // ABOUTの「山口の釣り仲間（Friends）」欄を本文に書き込む（JS無し・検索エンジンでも読める）。
      // devでも同じ見た目にするため apply は付けない
      name: 'prerender-about-friends',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          // ルートの about.html だけ。下の階層の about.html は対象外
          if (ctx.filename.replace(/\\/g, '/') !== resolve(__dirname, 'about.html').replace(/\\/g, '/')) return html;
          const mark = '<div class="friends" id="about-friends"></div>';
          if (!html.includes(mark)) throw new Error('about.html に釣り仲間の目印が見つかりません');
          const { friendsSectionHTML } = await import('./src/js/components/friends-html.js');
          const { friends } = await import('./src/js/data/friends.js');
          const base = process.env.SITE_BASE || '';
          return html.replace(mark, () => `<div class="friends" id="about-friends">${friendsSectionHTML(friends, { base })}</div>`);
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
        'guides/autumn-eging': resolve(__dirname, 'guides/autumn-eging.html'),
        'guides/family-sabiki': resolve(__dirname, 'guides/family-sabiki.html'),
        ...ikabuInputs,
        'guides/yaen-beginner': resolve(__dirname, 'guides/yaen-beginner.html'),
      },
    },
  },
});

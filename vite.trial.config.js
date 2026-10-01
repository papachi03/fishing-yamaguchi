// テストプレイ用（ikabu-trial）：エギング・墨つなぎの専用ページだけを別にビルドする（2026-09-29）。
//   npx vite build --config vite.trial.config.js   → dist-trial/
// 考え方は vite.egi.config.js と同じ（入口をこのページだけにして、イカ部のほかの中身が入らないように）
import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'path';
import base from './vite.config.js';

export default defineConfig(async (env) => {
  const b = typeof base === 'function' ? await base(env) : base;
  const { build, ...rest } = b;
  return mergeConfig(rest, {
    // テストプレイ版の印（views/trial-notice.js が注意書きを出す）
    define: { __IKABU_TRIAL__: 'true' },
    publicDir: false,
    build: {
      outDir: 'dist-trial',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          'ikabu-egi': resolve(__dirname, 'ikabu/egi.html'),
          'ikabu-en-egi': resolve(__dirname, 'ikabu/en/egi.html'),
          'ikabu-sumi': resolve(__dirname, 'ikabu/sumi.html'),
          'ikabu-en-sumi': resolve(__dirname, 'ikabu/en/sumi.html'),
          // 2026-09-30 TOP・ガチャ・カード
          'ikabu-games': resolve(__dirname, 'ikabu/games.html'),
          'ikabu-en-games': resolve(__dirname, 'ikabu/en/games.html'),
          'ikabu-gacha': resolve(__dirname, 'ikabu/gacha.html'),
          'ikabu-en-gacha': resolve(__dirname, 'ikabu/en/gacha.html'),
          'ikabu-cards': resolve(__dirname, 'ikabu/cards.html'),
          'ikabu-en-cards': resolve(__dirname, 'ikabu/en/cards.html'),
          // 2026-10-01 写真部（投稿フォーム・🎫1枚）
          'ikabu-gallery': resolve(__dirname, 'ikabu/gallery.html'),
          'ikabu-en-gallery': resolve(__dirname, 'ikabu/en/gallery.html'),
        },
      },
    },
  });
});

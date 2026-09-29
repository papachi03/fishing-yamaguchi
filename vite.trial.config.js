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
        },
      },
    },
  });
});

// エギング専用ページだけを別にビルドする設定（釣り仲間に試してもらう確認URL用）。
//   npx vite build --config vite.egi.config.js   → dist-egi/
// サイト全体のビルドでは部品（data.js など）がページ間で共有され、イカ部の他のページの文章まで
// 同じファイルに入る。ぱっぱ指示（2026-09-24）で釣り仲間にはイカ部の中身を見せないので、
// 入口をこのページだけにして、使う部品だけが残るようにする。
import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'path';
import base from './vite.config.js';

export default defineConfig(async (env) => {
  const b = typeof base === 'function' ? await base(env) : base;
  const { build, ...rest } = b;
  return mergeConfig(rest, {
    publicDir: false,   // public/（サイト全体のサイトマップ・画像など）はコピーしない。必要な画像は別に選んで入れる
    build: {
      outDir: 'dist-egi',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          'ikabu-egi': resolve(__dirname, 'ikabu/egi.html'),
          'ikabu-en-egi': resolve(__dirname, 'ikabu/en/egi.html'),
        },
      },
    },
  });
});

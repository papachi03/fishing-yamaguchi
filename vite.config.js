import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // GitHub Pages のサブフォルダ配置に対応。CIでは SITE_BASE=/fishing-yamaguchi/ を渡す。
  base: process.env.SITE_BASE || '/',
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
      },
    },
  },
});

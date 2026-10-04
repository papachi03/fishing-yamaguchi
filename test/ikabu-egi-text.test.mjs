// エギングの画面が使う文言（TX.〇〇.〇〇）が、play-text.js に本当にあるかを確かめる（2026-10-04）
//   v148 でアタリチャレンジの文言を msg の途中に差し込み、jet・resist・break などが別のまとまりに入って
//   「ジェット噴射！」「抵抗している！」が空の吹き出しになった（ぱっぱ：カサゴのシルエットのやり取りで白い空の枠）
//   play-text.js は import.meta.env を読むので、写しを作って置き換えてから読み込む
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// 読み込む先（i18n.js → base.js など）も同じように写し、import.meta.env を置き換える
function copyTree(url, dir, done = new Map()) {
  if (done.has(url.href)) return done.get(url.href);
  const out = join(dir, `m${done.size}.mjs`);
  done.set(url.href, out);
  let src = readFileSync(url, 'utf8').replace(/import\.meta\.env/g, '({ BASE_URL: "/", DEV: false })');
  src = src.replace(/(from\s+|import\s*\()'(\.{1,2}\/[^']+)'/g, (m, kw, rel) => `${kw}'${pathToFileURL(copyTree(new URL(rel, url), dir, done)).href}'`);
  writeFileSync(out, src);
  return out;
}
async function loadText() {
  const dir = mkdtempSync(join(tmpdir(), 'ikabu-text-'));
  return import(pathToFileURL(copyTree(new URL('../src/js/ikabu/games/play-text.js', import.meta.url), dir)).href);
}

test('エギングの画面が使う TX.msg・TX.blind・TX.cue の文言が全部ある（空の吹き出しにならない）', async () => {
  const { EGI_TEXT } = await loadText();
  const ui = readFileSync(new URL('../src/js/ikabu/games/egi-ui.js', import.meta.url), 'utf8');
  const missing = [];
  for (const group of ['msg', 'blind', 'cue', 'jado', 'yaen', 'gedo']) {
    const keys = new Set([...ui.matchAll(new RegExp(`TX\\.${group}\\.(\\w+)`, 'g'))].map((m) => m[1]));
    for (const k of keys) if (EGI_TEXT[group]?.[k] == null) missing.push(`${group}.${k}`);
  }
  assert.deepEqual(missing, []);
});

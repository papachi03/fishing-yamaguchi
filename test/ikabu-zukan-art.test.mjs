// ゲーム図鑑：10種すべてに見分け方と絵（デフォルメ・リアル調）があること。
// play-text.js は vite の設定（import.meta.env）に頼るので node では読み込めない → 文法チェック＋文字列で確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../src/js/ikabu/games/play-text.js', import.meta.url));
const pub = fileURLToPath(new URL('../public/assets/ikabu/zukan/', import.meta.url));
const src = readFileSync(file, 'utf8');
const block = src.slice(src.indexOf('export const GAME_ZUKAN = ['), src.indexOf('export const zukanById'));
const ids = [...block.matchAll(/\{ id: '([a-z]+)'/g)].map((m) => m[1]);

test('play-text.js に文法の誤りがない', () => {
  execFileSync(process.execPath, ['--check', file]);
});

test('図鑑の10種すべてに見分け方がある', () => {
  assert.equal(ids.length, 10);
  assert.equal((block.match(/point: pair\(/g) ?? []).length, 10);
});

test('図鑑の10種にデフォルメとリアル調の絵がある', () => {
  for (const id of ids) {
    assert.ok(existsSync(`${pub}deform/${id}.webp`), `${id} デフォルメ`);
    assert.ok(existsSync(`${pub}${id}.webp`), `${id} リアル調`);
  }
});

test('見分けの決め手（ぱっぱ指摘）が文に入っている', () => {
  assert.match(block, /id: 'mongo'[\s\S]*?コーヒー豆/);
  assert.match(block, /id: 'aori'[\s\S]*?1枚/);
});

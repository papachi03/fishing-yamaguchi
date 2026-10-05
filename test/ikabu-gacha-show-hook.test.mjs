// エギを抱くイカ（2026-10-05 ぱっぱ：毎回ケンサキだった）
import test from 'node:test';
import assert from 'node:assert/strict';
import { hookOf, planShow } from '../src/js/ikabu/games/gacha-show.js';

const share = (top, n = 4000) => { let a = 0; let s = 1; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; for (let i = 0; i < n; i++) if (hookOf(top, rnd).species === 'aori') a++; return a / n; };
test('抱くイカ：UR・SSR は必ず大きなアオリ、SR は7割5分ほどアオリ、R・N はたまにアオリ（外れの予感）', () => {
  assert.deepEqual(hookOf('UR', () => 0.9), { species: 'aori', len: 112 });
  assert.deepEqual(hookOf('SSR', () => 0.9), { species: 'aori', len: 100 });
  assert.ok(Math.abs(share('SR') - 0.75) < 0.04);
  assert.ok(Math.abs(share('R') - 0.10) < 0.03);
  assert.ok(Math.abs(share('N') - 0.05) < 0.02);
  const kinds = new Set(); for (let i = 0; i < 40; i++) kinds.add(hookOf('N', () => (i % 40) / 40 + 0.06).species);
  assert.ok(kinds.size >= 3, [...kinds].join(','));   // ケンサキだけにならない
});
test('台本に抱くイカが入る', () => {
  const plan = planShow([{ rarity: 'SSR', card: {}, isNew: true }], () => 0.5);
  assert.equal(plan.hook.species, 'aori');
});

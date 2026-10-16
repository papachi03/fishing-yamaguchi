// 部長のオス／メス（2026-10-16 ぱっぱ）：最初から無料で切り替え。メスは女性アングラー版の絵。色違いはオスだけ
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { RUSH_MOODS, emptyAnglers, normalizeAnglers, useSex, useColor, buyColor, buyAngler, lookOf, sexOf, anglerSrc, anglerJet, rushFaceSrc, FEMALE } from '../src/js/ikabu/games/anglers.js';
import { emptyTickets } from '../src/js/ikabu/games/tickets.js';

const day = '2026-10-16';
const tk = (n) => ({ ...emptyTickets(), n });
const pub = (p) => new URL(`../public${p}`, import.meta.url);

test('最初はオス。メスへの切り替えは🎫なしでいつでもでき、部長を使う', () => {
  const r0 = emptyAnglers();
  assert.equal(sexOf(r0), '');
  const bought = buyAngler(r0, tk(10), 'aori', { day }).rec;   // アオリを使っている時でも
  const f = useSex(bought, FEMALE);
  assert.equal(f.ok, true);
  assert.equal(f.rec.current, 'shiro');
  assert.equal(sexOf(f.rec), FEMALE);
  assert.equal(lookOf(f.rec, 'shiro'), FEMALE);
  assert.equal(lookOf(f.rec, 'aori'), '');   // ほかのキャラには関係しない
  const m = useSex(f.rec, '');
  assert.equal(sexOf(m.rec), '');
  assert.equal(useSex(r0, 'x').ok, false);
});

test('記録を読み直しても、メスは残る。知らない値はオスにもどす', () => {
  assert.equal(sexOf(normalizeAnglers({ sex: 'f' })), FEMALE);
  assert.equal(sexOf(normalizeAnglers({ sex: 'm' })), '');
  assert.equal('sex' in normalizeAnglers({ sex: 'zzz' }), false);
});

test('部長の色を選ぶ・買うとオスになる（色違いはオスだけ）', () => {
  const f = useSex(emptyAnglers(), FEMALE).rec;
  const bought = buyColor(f, tk(5), 'shiro', 'pink', { day });
  assert.equal(bought.ok, true);
  assert.equal(sexOf(bought.rec), '');
  assert.equal(lookOf(bought.rec, 'shiro'), 'pink');
  const f2 = useSex(bought.rec, FEMALE).rec;
  assert.equal(lookOf(f2, 'shiro'), FEMALE);   // メスの時は色より優先
  assert.equal(sexOf(useColor(f2, 'shiro', '').rec), '');
});

test('メスの絵の住所（エギングの立ち絵・驚き・墨のがれの5表情）がそろっていて、ファイルがある', () => {
  const paths = [anglerSrc('shiro', FEMALE), anglerJet('shiro', FEMALE), ...RUSH_MOODS.map((m) => rushFaceSrc('shiro', m, FEMALE))];
  assert.deepEqual(paths.slice(0, 2), ['/assets/ikabu/anglers/shiro_f.webp', '/assets/ikabu/anglers/shiro_f_jet.webp']);
  for (const p of paths) assert.ok(existsSync(pub(p)), p);
  assert.equal(rushFaceSrc('shiro', 'drown', FEMALE), '/assets/ikabu/rush-chars/shiro_f_doom.webp');
  // ほかのキャラに 'f' を渡しても、ふつうの絵のまま
  assert.equal(anglerSrc('aori', FEMALE), '/assets/ikabu/anglers/aori.webp');
});

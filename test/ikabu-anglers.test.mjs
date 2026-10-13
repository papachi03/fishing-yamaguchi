// 釣り人キャラ（2026-10-02）：🎫で入手・使う
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ANGLERS, buyAngler, useAngler, normalizeAnglers, emptyAnglers, rushFaceSrc, RUSH_MOODS } from '../src/js/ikabu/games/anglers.js';
import { emptyTickets } from '../src/js/ikabu/games/tickets.js';

const day = '2026-10-02';
const tk = (n) => ({ ...emptyTickets(), n });
const pub = (p) => new URL(`../public${p}`, import.meta.url);
// 文言（play-text.js）はブラウザ用の設定を読むので、ここでは文字として調べる
const playText = readFileSync(new URL('../src/js/ikabu/games/play-text.js', import.meta.url), 'utf8');

test('最初は部長（白イカ）だけ持っていて、使っている', () => {
  const r = normalizeAnglers(null);
  assert.deepEqual(r.owned, ['shiro']);
  assert.equal(r.current, 'shiro');
  assert.equal(ANGLERS.length, 10);   // 2026-10-13 かわいい系4体（ミミイカ・ダンゴイカ・ハワイミミイカ・ヒメイカ）を足した
});
test('🎫10枚でアオリが手に入り、そのまま使う。🎫は10枚減る', () => {
  const r = buyAngler(emptyAnglers(), tk(12), 'aori', { day });
  assert.equal(r.ok, true);
  assert.ok(r.rec.owned.includes('aori'));
  assert.equal(r.rec.current, 'aori');
  assert.equal(r.tickets.n, 2);
});
test('🎫が足りなければ手に入らない。持っているキャラは二重に買えない', () => {
  assert.equal(buyAngler(emptyAnglers(), tk(9), 'aori', { day }).why, 'tickets');
  const got = buyAngler(emptyAnglers(), tk(20), 'yari', { day });
  assert.equal(buyAngler(got.rec, got.tickets, 'yari', { day }).why, 'owned');
});
test('持っていないキャラには替えられない。知らない値は部長に戻る', () => {
  assert.equal(useAngler(emptyAnglers(), 'mongo').ok, false);
  assert.deepEqual(normalizeAnglers({ owned: ['xxx'], current: 'xxx' }), { owned: ['shiro'], current: 'shiro' });
});
test('かわいい系4体も🎫10枚で手に入る', () => {
  for (const id of ['mimi', 'dango', 'hawaii', 'hime']) {
    const r = buyAngler(emptyAnglers(), tk(10), id, { day });
    assert.equal(r.ok, true, id);
    assert.equal(r.tickets.n, 0, id);
  }
});
test('全キャラの絵（エギングの立ち絵・ジェット・墨のがれの5表情）がそろっていて、名前もある', () => {
  for (const a of ANGLERS) {
    assert.ok(existsSync(pub(a.src)), a.src);
    assert.ok(existsSync(pub(a.jet)), a.jet);
    for (const m of RUSH_MOODS) assert.ok(existsSync(pub(rushFaceSrc(a.id, m))), `${a.id} ${m}`);
    assert.ok(playText.split('\n').some((l) => l.includes('names: {') && l.includes(` ${a.id}: pair(`)), `名前 ${a.id}`);
  }
});
test('墨のがれの表情：部長は前からの絵、溺れた時はピンチの顔、知らないキャラは部長', () => {
  assert.equal(rushFaceSrc('shiro', 'calm'), '/assets/ikabu/mascot/wink.webp');
  assert.equal(rushFaceSrc('mimi', 'drown'), '/assets/ikabu/rush-chars/mimi_doom.webp');
  assert.equal(rushFaceSrc('xxx', 'panic'), '/assets/ikabu/mascot/rush-panic.webp');
});

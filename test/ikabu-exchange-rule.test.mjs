// 墨のかけらで交換できるカード（2026-10-16 ぱっぱ）：ふつう＝いつでも／フェス＝開催中だけ／未公開・シークレット＝できない
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exchangeState, FES } from '../src/js/ikabu/games/fes.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const at = (d) => new Date(`${d}T12:00:00+09:00`);

test('ふつうのカードは、いつでも交換できる', () => {
  assert.equal(exchangeState(CARDS.find((c) => !c.limit), at('2026-10-16')).ok, true);
});
test('シークレットのカードは交換できない', () => {
  const sec = CARDS.find((c) => c.limit?.secret);
  if (sec) assert.deepEqual(exchangeState(sec, at('2026-10-16')), { ok: false, why: 'secret' });
});
test('フェスのカードは、始まる前は×・開催中は○・終わった後は×', () => {
  for (const f of FES) {
    const c = CARDS.find((x) => x.limit?.fes === f.id);
    if (!c) continue;
    const before = new Date(new Date(`${f.from}T12:00:00+09:00`).getTime() - 86400000);
    const after = new Date(new Date(`${f.until}T12:00:00+09:00`).getTime() + 86400000);
    assert.deepEqual(exchangeState(c, before), { ok: false, why: 'upcoming' }, f.id);
    assert.equal(exchangeState(c, at(f.from)).ok, true, f.id);
    assert.equal(exchangeState(c, at(f.until)).ok, true, f.id);
    assert.deepEqual(exchangeState(c, after), { ok: false, why: 'ended' }, f.id);
  }
});
test('バインダー：交換できないカードには交換のボタンを出さない', () => {
  const ui = readFileSync(new URL('../src/js/ikabu/games/binder-ui.js', import.meta.url), 'utf8');
  assert.ok(ui.includes('exchangeState(c)') && ui.includes('ex.ok ?'));
});

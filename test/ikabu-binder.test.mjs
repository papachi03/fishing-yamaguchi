import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arrange, counts, SORTS } from '../src/js/ikabu/games/binder.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));

test('番号順が既定。レア度順は UR が先頭、タイプ順はイカ→テクニック→トラップ、名前順は五十音', () => {
  assert.equal(arrange(CARDS)[0].no, 1);
  assert.equal(arrange(CARDS, {}, { sort: 'rarity' })[0].rarity, 'UR');
  const byKind = arrange(CARDS, {}, { sort: 'kind' });
  assert.equal(byKind[0].kind, 'squid'); assert.equal(byKind[byKind.length - 1].kind, 'trap');
  const byName = arrange(CARDS, {}, { sort: 'name' });
  assert.ok(byName[0].name.localeCompare(byName[1].name, 'ja') <= 0);
  assert.equal(arrange(CARDS).length, 120);
  assert.deepEqual(SORTS, ['no', 'rarity', 'name', 'kind']);
});

test('絞り込み：タイプ・レア度・持っている／いない', () => {
  const owned = { 1: 2, 51: 1 };
  assert.equal(arrange(CARDS, owned, { kind: 'tech' }).every((c) => c.kind === 'tech'), true);
  assert.equal(arrange(CARDS, owned, { rarity: 'UR' }).length, 6);
  assert.deepEqual(arrange(CARDS, owned, { have: 'have' }).map((c) => c.no), [1, 51]);
  assert.equal(arrange(CARDS, owned, { have: 'missing' }).length, 118);
  assert.deepEqual(counts(CARDS, owned), { total: 3, kinds: 2, all: 120 });
});

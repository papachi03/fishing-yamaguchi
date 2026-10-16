// ストーリーから対戦に入って戻った時、サイトの帯（ロゴ・あそび場TOPへ）が前に出て、一覧の×・音のボタンが押せなくなっていた（2026-10-16 ぱっぱ）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battle = readFileSync(new URL('../src/js/ikabu/games/battle-ui.js', import.meta.url), 'utf8');
const story = readFileSync(new URL('../src/js/ikabu/games/story-ui.js', import.meta.url), 'utf8');

test('対戦を閉じても、下にストーリーの画面があれば帯を隠す印（is-battle）を外さない', () => {
  const line = battle.split('\n').find((l) => l.includes('function close()'));
  assert.ok(line && line.includes(".ika-st") && line.includes("remove('is-battle')"), line);
});
test('ストーリーの一覧を出す時は、帯を隠す印を付け直す', () => {
  const i = story.indexOf('function list()');
  assert.ok(i > 0 && story.slice(i, i + 200).includes("add('is-battle')"));
});

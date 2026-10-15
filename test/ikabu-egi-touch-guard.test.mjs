// エギングの舞台の上に出す窓は、スマホの指で押せる・上下に動かせること（2026-10-15 部員の指摘：キャラ一覧が押せない・動かせない）
//   舞台は長押し対策で touchstart を止め（noLongPress）、CSS で touch-action: none。窓はその両方から外す
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../src/js/ikabu/games/egi-ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/css/ikabu.css', import.meta.url), 'utf8');
const guard = ui.split('\n').find((l) => l.includes('const noLongPress ='));

for (const pop of ['.ika-egi-anglerpop', '.ika-egi-colorpop', '.ika-egi-card']) {
  test(`長押し対策の除外に ${pop} が入っている（指で押せる）`, () => {
    assert.ok(guard && guard.includes(pop), guard);
  });
}
test('キャラ一覧の窓は、舞台の中でも指で上下に動かせる（touch-action: pan-y）', () => {
  assert.ok(/\.ika-egi-anglerpop \{[^}]*touch-action: pan-y/.test(css));
});

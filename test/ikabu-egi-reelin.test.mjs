// 回収ボタン（2026-10-16 ぱっぱ・部員の要望）：押したらすぐ手元まで巻いて、その1投を終える（1投分を使う）。
// 巻いている間に抱くことはしない（イカはフォールで抱く）。エギと邪道だけ。沈下・誘いの間だけ押せる
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEgi, press, release, tick, reelIn, canReelIn, tripTicketOk, QUICK_REEL_SEC, QUICK_REEL_MAX, CASTS } from '../src/js/ikabu/games/egi.js';

const calm = () => 0.99;
const run = (s, seconds, step = 0.05) => { for (let t = 0; t < seconds - 1e-9; t += step) tick(s, step); };
const cast = (s) => { press(s); run(s, 0.8); release(s); };

test('沈下中に押すと、その場で回収になり、1投分が減ったまま次の構えへ', () => {
  const s = createEgi({ seed: 'r1', rand: calm });
  assert.equal(canReelIn(s), false, '投げる前は押せない');
  cast(s);
  assert.equal(s.phase, 'sinking');
  assert.equal(s.casts, CASTS - 1);
  assert.equal(canReelIn(s), true);
  s.events.length = 0;
  assert.equal(reelIn(s), true);
  assert.equal(s.phase, 'result');
  assert.equal(s.last, 'recover');
  assert.equal(s.dist, 0);
  assert.equal(s.manualRecover, true);
  assert.equal(s.casts, CASTS - 1, '回数は投げた時の1回だけ');
  assert.equal(s.catches.length, 0, '巻いてもイカは抱かない');
  assert.deepEqual(s.events.map((e) => [e.type, e.manual]), [['recover', true]]);
  assert.equal(reelIn(s), false, '結果の間は押せない');
});

test('誘い（しゃくった後）でも押せる。次に投げたら印は消える', () => {
  const s = createEgi({ seed: 'r2', rand: calm });
  cast(s);
  run(s, 30);   // 着底まで沈める
  press(s); release(s);   // しゃくり
  assert.equal(s.phase, 'action');
  assert.equal(reelIn(s), true);
  press(s); release(s);   // 結果→次の構え
  run(s, 0.1);
  cast(s);
  assert.equal(s.manualRecover, false);
});

test('最後の1投で回収すると、そこで釣りは終わる', () => {
  const s = createEgi({ seed: 'r3', rand: calm });
  s.casts = 1;
  cast(s);
  assert.equal(reelIn(s), true);
  assert.equal(s.phase, 'over');
});

test('ヤエン・テーラーでは押せない。邪道は押せる', () => {
  for (const method of ['yaen', 'tailor']) {
    const s = createEgi({ seed: 'r4', rand: calm, method });
    cast(s);
    assert.equal(canReelIn(s), false, method);
    assert.equal(reelIn(s), false, method);
  }
  const j = createEgi({ seed: 'r5', rand: calm, method: 'jado' });
  cast(j);
  assert.equal(canReelIn(j), true);
  assert.equal(reelIn(j), true);
  assert.equal(j.last, 'recover');
});

test('画面：回収ボタンがあり、長押し対策の対象とし、押した処理につながっている', () => {
  const view = readFileSync(new URL('../src/js/ikabu/views/play.js', import.meta.url), 'utf8');
  const ui = readFileSync(new URL('../src/js/ikabu/games/egi-ui.js', import.meta.url), 'utf8');
  assert.match(view, /id="ika-egi-reelin"/);
  assert.match(ui, /\[el\.btn, el\.dartBtn, el\.reelInBtn, el\.stage\]/);
  assert.match(ui, /el\.reelInBtn\?\.addEventListener\('pointerdown'/);
});

// すぐ回収（2026-10-16 ぱっぱ：回収はファーミングのためではない）：投げて10秒より前の回収が1回の釣行で3回以上なら🎫・経験値なし
const next = (s) => { press(s); release(s); run(s, 0.1); };   // 結果→次の構え
test(`投げて${QUICK_REEL_SEC}秒より前の回収を数え、${QUICK_REEL_MAX}回以上なら🎫・経験値の数に入れない`, () => {
  const s = createEgi({ seed: 'q1', rand: calm });
  for (let i = 0; i < QUICK_REEL_MAX - 1; i++) { cast(s); run(s, 2); reelIn(s); next(s); }
  assert.equal(s.quickReels, QUICK_REEL_MAX - 1);
  assert.equal(tripTicketOk(s), true, 'キャストミスのやり直しが1〜2回なら数える');
  cast(s); run(s, 2); reelIn(s);
  assert.equal(s.quickReels, QUICK_REEL_MAX);
  assert.equal(s.reelIns, QUICK_REEL_MAX, '使った回数そのものも数えておく（厳しくする時のため）');
  assert.equal(tripTicketOk(s), false);
});
test(`${QUICK_REEL_SEC}秒より後の回収は「すぐ回収」に数えない。イカが釣れた釣行はいつも数える`, () => {
  const s = createEgi({ seed: 'q2', rand: calm });
  let used = 0;
  for (let i = 0; i < 4; i++) { cast(s); run(s, QUICK_REEL_SEC + 1); if (reelIn(s)) used += 1; next(s); }
  assert.equal(used, 4);
  assert.equal(s.reelIns, 4);
  assert.equal(s.quickReels, 0);
  assert.equal(tripTicketOk(s), true);
  const q = createEgi({ seed: 'q3', rand: calm });
  q.quickReels = QUICK_REEL_MAX + 1;
  q.catches.push({ id: 'aori', weight: 300, mantle: 15 });
  assert.equal(tripTicketOk(q), true);
});
test('画面：すぐ回収の釣行は🎫を出さず、まとめのカードに一言', () => {
  const ui = readFileSync(new URL('../src/js/ikabu/games/egi-ui.js', import.meta.url), 'utf8');
  const tk = readFileSync(new URL('../src/js/ikabu/games/tickets-ui.js', import.meta.url), 'utf8');
  assert.match(ui, /noTickets: !ticketOk/);
  assert.match(ui, /counted: counted && ticketOk/, '経験値・釣行の数も入れない');
  assert.match(ui, /blindPractice && ticketOk/);
  assert.match(ui, /O\.quickReel/);
  assert.match(tk, /if \(d\.noTickets\) return;/);
});

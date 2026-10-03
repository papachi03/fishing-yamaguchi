// ストーリーモード（2026-10-03）：進み具合・名前・🎫の初回だけ／考える力 Lv1〜3／場のルール
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyStory, cleanName, heroName, fillName, nextBattle, canPlay, chapterCleared, recordWin, recordLoss, hintReady, mergeStory, DEFAULT_NAME, STORY_TICKETS } from '../src/js/ikabu/games/story.js';
import { newGame, play, attack, endTurn, starterDeck, statOf, costOf, canAttack, BACK, EGI } from '../src/js/ikabu/games/battle.js';
import { brainNext } from '../src/js/ikabu/games/cpu-brain.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const EFFECTS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-effects.json', import.meta.url), 'utf8'));
const byName = (name) => CARDS.find((c) => c.name === name);
const mk = (opts = {}) => newGame({ myDeck: starterDeck(CARDS), cpuDeck: starterDeck(CARDS, { practice: true }), cards: CARDS, effects: EFFECTS, seed: 'story', ...opts });
const give = (st, side, name) => { const c = byName(name); const x = { uid: 9000 + Math.random(), no: c.no, card: c, buffs: [], sick: true, skipNext: false, skipThis: false, attacked: false, shield: false, resting: false, faceDown: false, flags: {} }; st.players[side].hand.push(x); return x; };
const onField = (st, side, name, slot = 0) => { const x = give(st, side, name); st.players[side].hand.pop(); x.sick = false; st.players[side].front[slot] = x; return x; };

test('名前：空なら「アオ」、8文字まで、絵文字と記号は落ちる', () => {
  assert.equal(cleanName(''), DEFAULT_NAME);
  assert.equal(cleanName('   '), DEFAULT_NAME);
  assert.equal(cleanName('イカ太郎🦑'), 'イカ太郎');
  assert.equal(cleanName('あいうえおかきくけこ'), 'あいうえおかきく');
  assert.equal(cleanName('<b>x</b>'), 'bx/b');
  assert.equal(heroName({ name: 'ゲソ' }), 'ゲソ');
  assert.equal(fillName('{name}、勝負だ！ {name}！', 'ゲソ'), 'ゲソ、勝負だ！ ゲソ！');
});

test('進み具合：勝っていない最初の戦だけ押せる。勝った戦は再戦できる', () => {
  let s = emptyStory();
  assert.equal(nextBattle(s, 1, 9), 1);
  assert.equal(canPlay(s, 1, 1, 9), true);
  assert.equal(canPlay(s, 1, 2, 9), false);
  s = recordWin(s, 1, 1, { day: '2026-10-03' }).story;
  assert.equal(nextBattle(s, 1, 9), 2);
  assert.equal(canPlay(s, 1, 1, 9), true);    // 再戦
  assert.equal(canPlay(s, 1, 2, 9), true);
  assert.equal(canPlay(s, 1, 3, 9), false);
  for (let i = 2; i <= 9; i++) s = recordWin(s, 1, i, { day: '2026-10-03' }).story;
  assert.equal(chapterCleared(s, 1, 9), true);
  assert.equal(nextBattle(s, 1, 9), null);
});

test('🎫は初めて勝った時だけ2枚。再戦は0枚。負けは数えてヒントは2回目から', () => {
  let s = emptyStory();
  const a = recordWin(s, 1, 3, { day: '2026-10-03' });
  assert.equal(a.first, true); assert.equal(a.got, STORY_TICKETS);
  const b = recordWin(a.story, 1, 3, { day: '2026-10-04' });
  assert.equal(b.first, false); assert.equal(b.got, 0);
  assert.equal(b.story.cleared['ch1-3'], '2026-10-03');   // 日付は最初のまま
  let l = recordLoss(emptyStory(), 1, 5);
  assert.equal(l.hint, false); assert.equal(hintReady(l.story, 1, 5), false);
  l = recordLoss(l.story, 1, 5);
  assert.equal(l.hint, true); assert.equal(hintReady(l.story, 1, 5), true);
});

test('引き継ぎの合わせ方：勝ちは早い日付、負けは多い方、🎫の印は残る、名前は空の方を埋める', () => {
  const a = { ...emptyStory(), name: '', cleared: { 'ch1-1': '2026-10-05' }, losses: { 'ch1-2': 1 }, tickets: { 'ch1-1': true } };
  const b = { ...emptyStory(), name: 'ゲソ', cleared: { 'ch1-1': '2026-10-03', 'ch1-2': '2026-10-06' }, losses: { 'ch1-2': 3 }, tickets: { 'ch1-2': true } };
  const m = mergeStory(a, b);
  assert.equal(m.name, 'ゲソ');
  assert.deepEqual(m.cleared, { 'ch1-1': '2026-10-03', 'ch1-2': '2026-10-06' });
  assert.equal(m.losses['ch1-2'], 3);
  assert.deepEqual(m.tickets, { 'ch1-1': true, 'ch1-2': true });
  assert.deepEqual(mergeStory(a, null).cleared, a.cleared);
});

test('場のルール：夜＝星の攻撃+1、夏の夜＝太陽の技が潮-1、荒れ＝後列4、試験＝相手が先攻、相手のエギは変えられる', () => {
  const night = mk({ rule: 'night' });
  const yari = onField(night, 'cpu', 'ヤリイカ');     // 星 4/1
  const ken = onField(night, 'cpu', 'ケンサキイカ', 1);   // 太陽 3/3
  assert.equal(statOf(night, yari, 'atk'), 5);
  assert.equal(statOf(night, ken, 'atk'), 3);
  const summer = mk({ rule: 'summerNight' });
  const dart = give(summer, 'me', 'ダート');         // 太陽・潮1
  const jerk = give(summer, 'me', 'しゃくり');       // いかり・潮1
  assert.equal(costOf(summer, 'me', dart), 0);
  assert.equal(costOf(summer, 'me', jerk), 1);
  const rough = mk({ rule: 'rough' });
  assert.equal(rough.players.me.back.length, 4);
  assert.equal(rough.players.cpu.back.length, 4);
  assert.equal(mk().players.me.back.length, BACK);
  const exam = mk({ rule: 'exam', first: 'me' });
  assert.equal(exam.first, 'cpu'); assert.equal(exam.active, 'cpu');
  const weak = mk({ cpuEgi: 3 });
  assert.equal(weak.players.cpu.egi, 3); assert.equal(weak.players.me.egi, EGI);
});

test('考える力：Lv1 はテクニックを使わず、釣れなくても突っ込む。Lv3 は弾かれる攻撃をしない', () => {
  // 相手（me）の前列に防御の高いイカ、CPU の前列に弱いイカ
  const st = mk({ first: 'cpu' });
  st.turn = 4; st.active = 'cpu'; st.players.cpu.noAttack = false; st.players.cpu.tide = 0; st.players.cpu.tideMax = 0;
  st.players.cpu.hand.length = 0;
  onField(st, 'me', 'コウイカ');            // 2/4
  const atk = onField(st, 'cpu', 'ジンドウイカ（ヒイカ）');   // 1/2 → 弾かれる
  assert.equal(canAttack(st, 'cpu', atk).ok, true);
  const a1 = brainNext(st, 1);
  assert.equal(a1.type, 'attack'); assert.equal(a1.target?.card.name, 'コウイカ');   // Lv1：突っ込む
  const a3 = brainNext(st, 3);
  assert.equal(a3.type, 'end');   // Lv3：弾かれるので待つ
  // 前列が空なら Lv3 もダイレクト
  st.players.me.front[0] = null;
  assert.deepEqual([brainNext(st, 3).type, brainNext(st, 3).target], ['attack', null]);
});

test('考える力：Lv3 は釣れる相手を弱いイカから釣り、Lv1 はテクニックを無視する', () => {
  const st = mk({ first: 'cpu' });
  st.turn = 6; st.active = 'cpu'; st.players.cpu.noAttack = false; st.players.cpu.tide = 5; st.players.cpu.tideMax = 5;
  st.players.cpu.hand.length = 0;
  onField(st, 'me', 'ジンドウイカ（ヒイカ）');               // 1/2
  onField(st, 'cpu', 'スルメイカ');           // 4/4
  onField(st, 'cpu', 'ケンサキイカ', 1);      // 3/3 ← 釣れる中でいちばん弱い方で釣る
  const a3 = brainNext(st, 3);
  assert.equal(a3.type, 'attack'); assert.equal(a3.x.card.name, 'ケンサキイカ'); assert.equal(a3.target.card.name, 'ジンドウイカ（ヒイカ）');
  // Lv1：手札にテクニックしか無ければ使わずに攻撃へ
  give(st, 'cpu', 'しゃくり');
  const a1 = brainNext(st, 1);
  assert.equal(a1.type, 'attack');
});

// 自動対戦：Lv1 ＜ Lv2 ＜ Lv3 の順に強い（スターター vs 練習デッキ、Lv2 の自分を相手に）
function autoBattle(myLevel, cpuLevel, seed) {
  const st = mk({ seed: `auto-${seed}`, first: seed % 2 ? 'me' : 'cpu', cpuDeck: starterDeck(CARDS) });   // 同じデッキ同士（デッキの差を混ぜない）
  let guard = 0;
  while (!st.winner && guard++ < 400) {
    const side = st.active;
    const a = brainNext(st, side === 'me' ? myLevel : cpuLevel, side);
    if (a.type === 'end') { endTurn(st); continue; }
    if (a.type === 'shakuri') { st.players[side].tide -= 2; a.x.shakuri = true; a.x.buffs.push({ stat: 'atk', n: 1, expires: st.turn, starts: 0 }); continue; }
    if (a.type === 'play') { const r = play(st, side, a.x, { target: a.target }); if (!r.ok) { endTurn(st); } continue; }
    const r = attack(st, side, a.x, a.target); if (!r.ok) endTurn(st);
  }
  return st.winner;
}
test('自動対戦：Lv1 は Lv2・Lv3 に大きく負け越し、Lv3 は Lv2 と同等以上（同じデッキ・各60戦）', () => {
  const rate = (a, b) => { let w = 0; for (let i = 0; i < 60; i++) if (autoBattle(a, b, i) === 'me') w++; return w / 60; };
  const r31 = rate(3, 1), r32 = rate(3, 2), r21 = rate(2, 1), r13 = rate(1, 3);
  assert.ok(r31 >= 0.8, `Lv3 vs Lv1 ${r31}`);
  assert.ok(r21 >= 0.8, `Lv2 vs Lv1 ${r21}`);
  assert.ok(r32 >= 0.3, `Lv3 vs Lv2 ${r32}`);   // Lv2 が既に最善に近い（200戦で 51%）。60戦の揺れを見込んで「はっきり弱くはない」だけを見る
  assert.ok(r13 <= 0.25, `Lv1 vs Lv3 ${r13}`);
});

// 相手のデッキ（story-data.js）は全部 30 枚・規則どおり。台本の {name} は差し替え、絵のファイルがそろっている
import { BATTLES_CH1, deckNos, CHARS, CHAPTERS } from '../src/js/ikabu/games/story-data.js';
import { SCRIPT_CH1, PROLOGUE, EPILOGUE } from '../src/js/ikabu/games/story-script.js';
import { checkDeck } from '../src/js/ikabu/games/battle.js';
import { existsSync } from 'node:fs';
test('第1章：9人の相手のデッキと課題デッキが規則どおり（30枚・同名2枚まで・SSR2/UR1）', () => {
  assert.equal(BATTLES_CH1.length, 9);
  assert.equal(CHAPTERS[0].count, 9);
  for (const b of BATTLES_CH1) {
    const r = checkDeck(deckNos(b.deck), CARDS);
    assert.deepEqual(r, { ok: true, errors: [] }, `第${b.i}戦 ${b.foe}: ${r.errors.join('／')}`);
    if (b.myDeck) assert.deepEqual(checkDeck(deckNos(b.myDeck), CARDS), { ok: true, errors: [] }, `第${b.i}戦 課題デッキ`);
    assert.ok(CHARS[b.foe], b.foe);
    assert.ok(SCRIPT_CH1[b.i]?.before?.length && SCRIPT_CH1[b.i].win?.length && SCRIPT_CH1[b.i].lose?.length && SCRIPT_CH1[b.i].hint?.length, `第${b.i}戦の台本`);
    for (const f of ['normal', 'attack', 'lose']) assert.ok(existsSync(new URL(`../public/assets/ikabu/story/chars/${b.foe}_${f}.webp`, import.meta.url)), `${b.foe}_${f}`);
    assert.ok(existsSync(new URL(`../public/assets/ikabu/story/bg/${b.bg}.webp`, import.meta.url)), b.bg);
    assert.ok(existsSync(new URL(`../public/assets/ikabu/story/stage/${b.stage}.webp`, import.meta.url)), b.stage);
  }
  for (const f of ['normal', 'attack', 'lose']) assert.ok(existsSync(new URL(`../public/assets/ikabu/story/chars/ao_${f}.webp`, import.meta.url)));
  // 台本に出る人は全員 CHARS にいる。'{name}' 以外の変数は使っていない
  for (const line of [...PROLOGUE, ...EPILOGUE, ...Object.values(SCRIPT_CH1).flatMap((s) => [...s.before, ...s.win, ...s.lose, ...s.hint])]) {
    assert.ok(CHARS[line.who], line.who);
    assert.ok(!/\{(?!name\})/.test(line.text), line.text);
  }
});

// 点検で見つけた直し（2026-10-03）：夜のイカ・夜のテクニックは番号の一覧／カラーチェンジが効く／同じ数字は「互角」
import { isNight, markOf } from '../src/js/ikabu/games/battle.js';
test('夜のイカ・夜のテクニック：真冬の大槍は夜、常夜灯・ナイトエギングなど夜の技は夜。ケンサキイカがいると夜の技が潮1安い', () => {
  const card = (name) => CARDS.find((c) => c.name === name);
  for (const n of ['ケンサキイカ', 'ヤリイカ', 'ホタルイカ', 'アカイカ', '真冬の大槍', '常夜灯', 'ナイトエギング', '夜光エギ', '満月の夜', '新月', 'イカメタル', 'ヤリイカの接岸']) assert.equal(isNight(card(n)), true, n);
  for (const n of ['アオリイカ', 'コウイカ', 'しゃくり', '夕マズメ（時合い）']) assert.equal(isNight(card(n)), false, n);
  const st = mk();
  onField(st, 'me', 'ケンサキイカ');
  const lamp = give(st, 'me', '常夜灯');          // 太陽・潮2。ケンサキ（太陽）がいるので同じマークで-1、夜の技で-1
  assert.equal(costOf(st, 'me', lamp), 0);
  const night = give(st, 'me', 'ナイトエギング');  // 星・潮2：夜の技で-1
  assert.equal(costOf(st, 'me', night), 1);
});
test('エギのカラーチェンジ：選んだイカのマークが変わり、同じマークの割引・夜のルールに効く。釣られたら元に戻る', () => {
  const st = mk({ rule: 'night' });
  st.active = 'me'; st.players.me.tide = 5; st.players.me.tideMax = 5;
  const ao = onField(st, 'me', 'アオリイカ');      // 波・5/5
  const cc = give(st, 'me', 'エギのカラーチェンジ');
  const r = play(st, 'me', cc, { target: ao, mark: 'star' });
  assert.equal(r.ok, true);
  assert.equal(markOf(ao), 'star');
  assert.equal(statOf(st, ao, 'atk'), 6);           // 夜：星のイカは攻撃+1
  const fs = give(st, 'me', 'フリーフォール');     // 星の技：星のイカがいるので潮1安い
  assert.equal(costOf(st, 'me', fs), 0);
});
test('攻撃＝防御は「互角」（「バラシ」はカードの説明どおり、弾かれて次の番は休み）', () => {
  const src = readFileSync(new URL('../src/js/ikabu/games/battle.js', import.meta.url), 'utf8');
  assert.ok(src.includes("'互角！ どちらも残った'"));
  assert.ok(!src.includes("'バラシ！ どちらも残った'"));
});

// 守り・お邪魔のカード（2026-10-04 ぱっぱ「一度攻め切られると何を出しても歯が立たない」）
//   前は「このターン」までの効き目で、自分の番に使うと相手が攻めてくる番には切れていた（空振り）。CPU も守りを使わなかった
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame, play, attack, endTurn, cpuNext, starterDeck, statOf } from '../src/js/ikabu/games/battle.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const EFFECTS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-effects.json', import.meta.url), 'utf8'));
const byName = (name) => CARDS.find((c) => c.name === name);
const mk = () => newGame({ myDeck: starterDeck(CARDS), cpuDeck: starterDeck(CARDS), cards: CARDS, effects: EFFECTS, seed: 'guard', first: 'me' });
const inst = (name) => { const c = byName(name); return { uid: 9000 + Math.random(), no: c.no, card: c, buffs: [], sick: false, skipNext: false, skipThis: false, attacked: false, shield: false, resting: false, faceDown: false, flags: {} }; };
const give = (st, side, name) => { const x = inst(name); st.players[side].hand.push(x); return x; };
const onField = (st, side, name, slot = 0) => { const x = inst(name); st.players[side].front[slot] = x; return x; };
// 盤面をまっさらに：前列・後列（トラップ）を空にし、潮をたっぷりに
const clean = (st) => { for (const s of ['me', 'cpu']) { const p = st.players[s]; p.front = [null, null, null]; p.back = p.back.map(() => null); p.tideMax = 8; p.tide = 8; p.noAttack = false; } return st; };
// 相手の番へ進めて、潮と攻撃の許しを整える
const toCpuTurn = (st) => { endTurn(st); const p = st.players.cpu; p.tide = 8; p.noAttack = false; for (const x of p.front) if (x) { x.sick = false; x.attacked = false; } };

test('ダート：自分の番に使うと、相手の番も攻撃されない（次の自分の番の始めに外れる）', () => {
  const st = clean(mk());
  const mine = onField(st, 'me', 'ヤリイカ');
  const foe = onField(st, 'cpu', 'アカイカ');
  assert.equal(play(st, 'me', give(st, 'me', 'ダート'), { target: mine }).ok, true);
  toCpuTurn(st);
  assert.equal(mine.shield, true);
  assert.equal(attack(st, 'cpu', foe, mine).ok, false);   // 守られている
  endTurn(st);
  assert.equal(mine.shield, false);
});

test('ドラグ調整・新月：相手のイカの攻撃-は、相手の番の終わりまで効く', () => {
  const st = clean(mk());
  const foe = onField(st, 'cpu', 'アカイカ');
  const a0 = statOf(st, foe, 'atk');
  play(st, 'me', give(st, 'me', 'ドラグ調整'), { target: foe });
  toCpuTurn(st);
  assert.equal(statOf(st, foe, 'atk'), Math.max(0, a0 - 2));
  endTurn(st);
  assert.equal(statOf(st, foe, 'atk'), a0);   // 自分の次の番には戻る
  const st2 = clean(mk());
  const f2 = onField(st2, 'cpu', 'アカイカ');
  play(st2, 'me', give(st2, 'me', '新月'));
  toCpuTurn(st2);
  assert.equal(statOf(st2, f2, 'atk'), Math.max(0, a0 - 2));
});

test('風裏を探す：相手の場のイカ1体を手札に戻す（潮3）', () => {
  const st = clean(mk());
  const foe = onField(st, 'cpu', 'アカイカ');
  const card = give(st, 'me', '風裏を探す');
  assert.equal(card.card.cost, 3);
  assert.equal(play(st, 'me', card, { target: foe }).ok, true);
  assert.equal(st.players.cpu.front.includes(foe), false);
  assert.equal(st.players.cpu.hand.includes(foe), true);
});

test('CPU：次の番で釣られそうな自分のイカを、守りのテクニックで守る', () => {
  const st = clean(mk());
  endTurn(st);                                   // CPU の番に
  const p = st.players.cpu; p.tide = 8; p.hand.length = 0; p.noAttack = false;
  const mine = onField(st, 'cpu', 'ジンドウイカ（ヒイカ）');   // 防御2：相手のヤリイカ（攻撃4）に釣られる。防御+2で4になれば釣られない
  mine.attacked = true;                                         // もう攻撃は済んだ
  onField(st, 'me', 'ヤリイカ');
  const guard = give(st, 'cpu', 'テンションフォール');
  const a = cpuNext(st, 'cpu');
  assert.equal(a.type, 'play');
  assert.equal(a.x, guard);
  assert.equal(a.target, mine);
  // 守っても釣られる相手（攻撃6のアカイカ）なら、使わずに温存する
  st.players.me.front[0] = inst('アカイカ');
  assert.equal(cpuNext(st, 'cpu').type, 'end');
});

test('着底：前列に出したイカは、次の相手の番の終わりまで防御+2（自分の次の番に戻る）', () => {
  const st = clean(mk());
  const x = give(st, 'me', 'ジンドウイカ（ヒイカ）');
  const d0 = x.card.def;
  assert.equal(play(st, 'me', x).ok, true);
  assert.equal(statOf(st, x, 'def'), d0 + 2);
  assert.ok(x.flags.settle != null);
  toCpuTurn(st);
  assert.equal(statOf(st, x, 'def'), d0 + 2);                 // 相手の番も防御+2
  const foe = onField(st, 'cpu', 'ヤリイカ');                  // 攻撃4 は 防御4 を釣れない
  const r = attack(st, 'cpu', foe, x);
  assert.notEqual(r.result, 'catch');
  endTurn(st);
  assert.equal(x.flags.settle, undefined);                      // 自分の次の番には外れる
  assert.ok(statOf(st, x, 'def') <= d0);                        // （弾いた時の守りの疲れで-1になることはある）
});

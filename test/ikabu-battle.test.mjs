import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame, play, attack, endTurn, cpuNext, checkDeck, starterDeck, statOf, costOf, canAttack, DECK_SIZE } from '../src/js/ikabu/games/battle.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const EFFECTS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-effects.json', import.meta.url), 'utf8'));
const byName = (name) => CARDS.find((c) => c.name === name);
const mk = (opts = {}) => newGame({ myDeck: starterDeck(CARDS), cpuDeck: starterDeck(CARDS, { practice: true }), cards: CARDS, effects: EFFECTS, seed: 'test', ...opts });
// 手札に好きなカードを足す（テスト用）
// 潮をたっぷりに（ターンの始めに tideMax から回復するので tideMax を上げる）
const rich = (st) => { for (const s of ['me', 'cpu']) { st.players[s].tideMax = 9; st.players[s].tide = 8; } return st; };
const give = (st, side, name) => { const c = byName(name); const x = { uid: 9000 + Math.random(), no: c.no, card: c, buffs: [], sick: true, skipNext: false, skipThis: false, attacked: false, shield: false, resting: false, faceDown: false, flags: {} }; st.players[side].hand.push(x); return x; };

test('120枚すべてに効果の型がある（効果なしのイカは空の配列）', () => {
  for (const c of CARDS) assert.ok(Array.isArray(EFFECTS[String(c.no)]), `${c.no} ${c.name}`);
  assert.equal(Object.keys(EFFECTS).length, 120);
});

test('スターターデッキは検査に通り、練習デッキはNだけ', () => {
  const d = starterDeck(CARDS);
  assert.equal(d.length, DECK_SIZE);
  assert.deepEqual(checkDeck(d, CARDS), { ok: true, errors: [] });
  const p = starterDeck(CARDS, { practice: true });
  assert.ok(p.every((no) => CARDS.find((c) => c.no === no).rarity === 'N'));
  assert.equal(checkDeck(p, CARDS).ok, true);
  assert.equal(checkDeck([...d.slice(0, 29), 120, 120], CARDS).ok, false);   // 31枚・UR2枚
});

test('最初：手札5枚→先攻は1枚引いて6枚、潮1。先攻の最初のターンは攻撃できない', () => {
  const st = mk();
  assert.equal(st.turn, 1); assert.equal(st.active, 'me');
  assert.equal(st.players.me.hand.length, 6); assert.equal(st.players.cpu.hand.length, 5);
  assert.equal(st.players.me.tide, 1); assert.equal(st.players.me.tideMax, 1);
  assert.equal(st.players.me.noAttack, true);
});

test('イカを出す：潮を払い前列へ。1ターン1体。出したターンは攻撃できず、次のターンから', () => {
  const st = mk();
  const hii = give(st, 'me', 'ジンドウイカ（ヒイカ）');   // 潮1・出た時に1枚引く
  const before = st.players.me.hand.length;
  assert.equal(play(st, 'me', hii).ok, true);
  assert.equal(st.players.me.front[0], hii);
  assert.equal(st.players.me.tide, 0);
  assert.equal(st.players.me.hand.length, before);   // 1枚使って1枚引いた
  const another = give(st, 'me', 'シリヤケイカ');
  assert.equal(play(st, 'me', another).why, 'summoned');
  assert.equal(canAttack(st, 'me', hii).why, 'noAttack');
  endTurn(st); endTurn(st);   // CPUのターン→自分のターン
  assert.equal(st.turn, 3); assert.equal(st.players.me.tideMax, 2);
  assert.equal(canAttack(st, 'me', hii).ok, true);
});

test('攻撃と防御の比べ：＞釣る／＝バラシ／＜弾かれて次のターン攻撃できない。ダイレクトはエギ1個＋相手が1枚引く', () => {
  const st = rich(mk());
  const me1 = give(st, 'me', 'スルメイカ');   // 4/4
  play(st, 'me', me1);
  endTurn(st);
  const cpu1 = give(st, 'cpu', 'コウイカ');    // 2/4・相手のターンは防御+1
  play(st, 'cpu', cpu1);
  endTurn(st);
  // 自分のターン：スルメ(4) vs コウイカ(4+1=5) → 弾かれる
  const r1 = attack(st, 'me', me1, cpu1);
  assert.equal(r1.result, 'blocked'); assert.equal(r1.D, 5);
  assert.equal(me1.skipNext, true);
  endTurn(st); endTurn(st);
  assert.equal(canAttack(st, 'me', me1).why, 'tired');
  endTurn(st); endTurn(st);
  assert.equal(canAttack(st, 'me', me1).ok, true);
  // 相手の前列を空にしてダイレクト
  st.players.cpu.front = [null, null, null];
  const handBefore = st.players.cpu.hand.length;
  const r2 = attack(st, 'me', me1, null);
  assert.equal(r2.result, 'direct'); assert.equal(st.players.cpu.egi, 4);
  assert.equal(st.players.cpu.hand.length, handBefore + 1);
  assert.equal(attack(st, 'me', me1, null).why, 'attacked');
});

test('バラシ：攻撃＝防御で両方残る。同じマークのイカがいるとテクニックは潮1安い', () => {
  const st = rich(mk());
  const a = give(st, 'me', 'スルメイカ'); play(st, 'me', a); endTurn(st);
  const b = give(st, 'cpu', 'スルメイカ'); play(st, 'cpu', b); endTurn(st);
  const r = attack(st, 'me', a, b);
  assert.equal(r.result, 'tie');
  assert.ok(st.players.me.front.includes(a) && st.players.cpu.front.includes(b));
  const shaku = give(st, 'me', 'しゃくり');   // いかり・潮1。スルメイカ（いかり）がいるので0
  assert.equal(costOf(st, 'me', shaku), 0);
});

test('テクニック：しゃくりで攻撃+2（このターン）→ ターンが終わると消える', () => {
  const st = rich(mk());
  const a = give(st, 'me', 'スルメイカ'); play(st, 'me', a);
  const shaku = give(st, 'me', 'しゃくり');
  assert.equal(play(st, 'me', shaku).why, 'needTarget');
  assert.equal(play(st, 'me', shaku, { target: a }).ok, true);
  assert.equal(statOf(st, a, 'atk'), 6);
  endTurn(st);
  assert.equal(statOf(st, a, 'atk'), 4);
});

test('トラップ：根掛かりは相手の攻撃を止めて捨て札へ。1回だけ', () => {
  const st = rich(mk());
  const a = give(st, 'me', 'スルメイカ'); play(st, 'me', a); endTurn(st);
  const trap = give(st, 'cpu', '根掛かり'); assert.equal(play(st, 'cpu', trap).ok, true);
  assert.equal(st.players.cpu.back[0], trap);
  const b = give(st, 'cpu', 'シリヤケイカ'); play(st, 'cpu', b); endTurn(st);
  const r = attack(st, 'me', a, b);
  assert.equal(r.result, 'trapped'); assert.equal(r.trap, trap);
  assert.equal(st.players.cpu.back[0], null);
  assert.ok(st.players.cpu.front.includes(b));
});

test('エギ5個を全部奪われたら負け。山札が尽きて引けなくても負け', () => {
  const st = mk();
  st.players.cpu.egi = 1; st.players.cpu.front = [null, null, null];
  rich(st);
  const a = give(st, 'me', 'ヤリイカ');   // 出たターンに攻撃できる
  play(st, 'me', a);
  st.players.me.noAttack = false;
  const r = attack(st, 'me', a, null);
  assert.equal(r.win, true); assert.equal(st.winner, 'me');
  const st2 = mk();
  st2.players.cpu.deck = [];
  endTurn(st2);   // CPUのターンの始めに引けない
  assert.equal(st2.winner, 'me');
});

test('CPUの手：イカを出す→釣れる相手を攻撃→トラップを伏せる→終わり。試合が最後まで進む', () => {
  const st = mk({ first: 'cpu' });
  let guard = 0;
  while (!st.winner && guard++ < 400) {
    if (st.active === 'cpu') {
      const a = cpuNext(st);
      if (a.type === 'end') endTurn(st);
      else if (a.type === 'play') assert.equal(play(st, 'cpu', a.x, { target: a.target }).ok, true, a.x.card.name);
      else assert.equal(attack(st, 'cpu', a.x, a.target).ok, true, a.x.card.name);
    } else {
      const a = cpuNext(st, 'me');   // 自分側も同じ頭脳で回す
      if (a.type === 'end') endTurn(st);
      else if (a.type === 'play') play(st, 'me', a.x, { target: a.target });
      else attack(st, 'me', a.x, a.target);
    }
  }
  assert.ok(st.winner, '勝負がつく');
  assert.ok(guard < 400);
});

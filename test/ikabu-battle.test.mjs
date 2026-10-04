import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame, play, attack, endTurn, cpuNext, checkDeck, starterDeck, statOf, costOf, canAttack, shakuri, canShakuri, DECK_SIZE } from '../src/js/ikabu/games/battle.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const EFFECTS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-effects.json', import.meta.url), 'utf8'));
const byName = (name) => CARDS.find((c) => c.name === name);
const mk = (opts = {}) => newGame({ myDeck: starterDeck(CARDS), cpuDeck: starterDeck(CARDS, { practice: true }), cards: CARDS, effects: EFFECTS, seed: 'test', ...opts });
// 手札に好きなカードを足す（テスト用）
// 潮をたっぷりに（ターンの始めに tideMax から回復するので tideMax を上げる）
const rich = (st) => { for (const s of ['me', 'cpu']) { st.players[s].tideMax = 9; st.players[s].tide = 8; } return st; };
const give = (st, side, name) => { const c = byName(name); const x = { uid: 9000 + Math.random(), no: c.no, card: c, buffs: [], sick: true, skipNext: false, skipThis: false, attacked: false, shield: false, resting: false, faceDown: false, flags: {} }; st.players[side].hand.push(x); return x; };

test('134枚すべてに効果の型がある（効果なしのイカは空の配列）', () => {
  for (const c of CARDS) assert.ok(Array.isArray(EFFECTS[String(c.no)]), `${c.no} ${c.name}`);
  assert.equal(Object.keys(EFFECTS).length, 134);
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

test('最初の手札には、自分の最初のターンの潮（先攻1・後攻2）で出せるイカが必ず1枚ある', () => {
  for (const first of ['me', 'cpu']) for (let i = 0; i < 200; i++) {
    const st = mk({ seed: `m${i}`, first });
    for (const side of ['me', 'cpu']) {
      const p = st.players[side];
      const hand = side === first ? p.hand.slice(0, 5) : p.hand;   // 先攻の6枚目は引いた分
      const tide = side === first ? 1 : 2;
      assert.ok(hand.some((x) => x.card.kind === 'squid' && x.card.cost <= tide), `${first}先攻 ${side} seed m${i}`);
      assert.equal(p.hand.length + p.deck.length, DECK_SIZE);   // カードが増えも減りもしない
    }
    for (const side of ['me', 'cpu']) assert.equal(typeof st.players[side].shiodome, 'boolean');   // 配り直したかの印（画面の「潮止まり」）
    const fp = st.players[first];   // 先攻は潮1で実際に前列へ出せる
    assert.equal(fp.tide, 1);
    assert.ok(fp.hand.some((x) => x.card.kind === 'squid' && costOf(st, first, x) <= fp.tide), `先攻が出せない seed m${i}`);
  }
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
      else if (a.type === 'shakuri') assert.equal(shakuri(st, 'cpu', a.x).ok, true, a.x.card.name);
      else if (a.type === 'play') assert.equal(play(st, 'cpu', a.x, { target: a.target }).ok, true, a.x.card.name);
      else assert.equal(attack(st, 'cpu', a.x, a.target).ok, true, a.x.card.name);
    } else {
      const a = cpuNext(st, 'me');   // 自分側も同じ頭脳で回す
      if (a.type === 'end') endTurn(st);
      else if (a.type === 'shakuri') shakuri(st, 'me', a.x);
      else if (a.type === 'play') play(st, 'me', a.x, { target: a.target });
      else attack(st, 'me', a.x, a.target);
    }
  }
  assert.ok(st.winner, '勝負がつく');
  assert.ok(guard < 400);
});

test('潮しゃくり：潮2で攻撃+1（このターン・1体1回）。守りの疲れ：弾かれるたびに受けたイカの防御-1（ずっと）', () => {
  const st = rich(mk());
  const a = give(st, 'me', 'スルメイカ'); play(st, 'me', a); endTurn(st);
  const b = give(st, 'cpu', 'コウイカ'); play(st, 'cpu', b); endTurn(st);   // 2/4・相手のターンは防御+1 → 5
  // 4 vs 5 → 弾かれる → コウイカの防御が1下がる（ずっと）
  assert.equal(attack(st, 'me', a, b).result, 'blocked');
  assert.equal(statOf(st, b, 'def'), 4);
  endTurn(st); endTurn(st); endTurn(st); endTurn(st);   // 休みを挟んで自分のターン
  assert.equal(statOf(st, b, 'def'), 4);   // ずっと
  // 潮しゃくりで 4+1=5 > 4 → 釣れる
  const tide = st.players.me.tide;
  assert.equal(shakuri(st, 'me', a).ok, true);
  assert.equal(st.players.me.tide, tide - 2);
  assert.equal(statOf(st, a, 'atk'), 5);
  assert.equal(canShakuri(st, 'me', a).why, 'shakuried');   // 1体1回
  assert.equal(attack(st, 'me', a, b).result, 'catch');
  endTurn(st);
  assert.equal(statOf(st, a, 'atk'), 4);   // このターンだけ
});

test('部長デッキは検査に通り、練習デッキより強い（SR入り・SSR1枚）。部長同士でも試合が最後まで進む', async () => {
  const { cpuDeck } = await import('../src/js/ikabu/games/battle.js');
  const b = cpuDeck(CARDS, 'bucho');
  assert.equal(checkDeck(b, CARDS).ok, true, checkDeck(b, CARDS).errors.join(','));
  const r = (no) => CARDS.find((c) => c.no === no).rarity;
  assert.ok(b.some((no) => r(no) === 'SR')); assert.equal(b.filter((no) => r(no) === 'SSR').length, 1);
  const st = newGame({ myDeck: b, cpuDeck: b, cards: CARDS, effects: EFFECTS, seed: 'bucho', first: 'cpu' });
  let guard = 0;
  while (!st.winner && guard++ < 400) {
    const side = st.active; const a = cpuNext(st, side);
    if (a.type === 'end') endTurn(st); else if (a.type === 'shakuri') shakuri(st, side, a.x); else if (a.type === 'play') play(st, side, a.x, { target: a.target }); else attack(st, side, a.x, a.target);
  }
  assert.ok(st.winner);
});

test('納竿：7枚を超えた分は選んだカードを捨てる。指定が無ければコストの高い順（CPU）', async () => {
  const { overflow } = await import('../src/js/ikabu/games/battle.js');
  const st = mk();
  while (st.players.me.hand.length < 9) give(st, 'me', 'しゃくり');
  const big = give(st, 'me', 'アオリイカ');   // 潮3（手札で一番高い）
  assert.equal(overflow(st, 'me'), 3);
  const pick = st.players.me.hand.slice(0, 3);
  endTurn(st, { discard: pick });
  assert.equal(st.players.me.hand.length, 7);
  assert.ok(st.players.me.hand.includes(big));
  assert.ok(pick.every((x) => st.players.me.grave.includes(x)));
  const st2 = mk(); endTurn(st2);   // CPUのターンへ
  while (st2.players.cpu.hand.length < 9) give(st2, 'cpu', 'しゃくり');
  const big2 = give(st2, 'cpu', 'アオリイカ');
  endTurn(st2);
  assert.ok(!st2.players.cpu.hand.includes(big2));   // 高いコストから捨てた
  assert.equal(st2.players.cpu.hand.length, 7);
});

test('後攻の追い風：後攻は自分の最初の2ターンだけ潮+1（3ターン目からは無し）。先攻には無い', () => {
  const st = mk({ first: 'me' });
  assert.equal(st.players.me.tailwind, false); assert.equal(st.players.me.tide, 1);
  endTurn(st);   // T2 後攻（cpu）1回目
  assert.equal(st.players.cpu.tailwind, true); assert.equal(st.players.cpu.tide, 2);
  endTurn(st); endTurn(st);   // T4 後攻 2回目
  assert.equal(st.players.cpu.tailwind, true); assert.equal(st.players.cpu.tide, 3);
  endTurn(st); endTurn(st);   // T6 後攻 3回目
  assert.equal(st.players.cpu.tailwind, false); assert.equal(st.players.cpu.tide, 3);
});

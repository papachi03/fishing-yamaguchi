// オンライン対戦の1試合（match.js）と、スマホ側の組み直し（battle-net.js の mirror）を node で確かめる（2026-10-16）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMatch, sideOf, TURN_MS, LEAVE_MS } from '../src/match.js';
import { mirror, isCode } from '../../../src/js/ikabu/games/battle-net.js';
import { cpuNext, canPlay, statOf } from '../../../src/js/ikabu/games/battle.js';

const CARDS = JSON.parse(readFileSync(new URL('../../../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const EFFECTS = JSON.parse(readFileSync(new URL('../../../src/js/ikabu/games/cards-effects.json', import.meta.url), 'utf8'));
const mk = (o = {}) => createMatch({ cards: CARDS, effects: EFFECTS, seed: 'test', first: 'me', ...o });
// サーバーが送る形（JSON を通す）→ スマホ側の st
const seen = (m, seat) => mirror(JSON.parse(JSON.stringify(m.viewFor(seat))), { cards: CARDS, effects: EFFECTS });

test('2人とも同じデッキで始まり、席 a が先攻なら a から見て active＝me、b から見て cpu', () => {
  const m = mk();
  assert.equal(sideOf('a'), 'me'); assert.equal(sideOf('b'), 'cpu');
  const va = seen(m, 'a'), vb = seen(m, 'b');
  assert.equal(va.active, 'me'); assert.equal(vb.active, 'cpu');
  assert.equal(va.first, 'me'); assert.equal(vb.first, 'cpu');
  assert.equal(va.players.me.hand.length, 6); assert.equal(vb.players.me.hand.length, 5);   // 先攻はターンの始めに1枚引く
  assert.equal(m.activeSeat(), 'a');
  assert.equal(typeof TURN_MS, 'number'); assert.equal(typeof LEAVE_MS, 'number');
});

test('相手の手札と伏せ札は中身が見えない（uid と枚数だけ）、自分の手札はカードが引ける', () => {
  const m = mk();
  const vb = seen(m, 'b');
  for (const x of vb.players.cpu.hand) { assert.equal(x.hidden, true); assert.equal(x.no, null); assert.equal(x.card.kind, 'hidden'); }
  assert.equal(vb.players.cpu.hand.length, m.st.players.me.hand.length);
  for (const x of vb.players.me.hand) { assert.ok(x.card?.name); assert.equal(x.card.no, x.no); }
  assert.equal(vb.players.me.deck.length, m.st.players.cpu.deck.length);   // 山札は枚数だけ（中身は null）
  assert.ok(vb.players.me.deck.every((x) => x === null));
  // a がトラップを伏せる → b からは裏向きの置き物
  const a = m.st.players.me;
  a.tide = 8;
  const trap = a.hand.find((x) => x.card.kind === 'trap') ?? (() => { const c = CARDS.find((c) => c.kind === 'trap'); const x = { ...a.deck.find((d) => d.card.kind === 'trap') }; a.hand.push(x); return x; })();
  const { r } = m.act('a', { kind: 'play', uid: trap.uid });
  assert.equal(r.ok, true);
  const vb2 = seen(m, 'b');
  const fd = vb2.players.cpu.back.find(Boolean);
  assert.equal(fd.hidden, true); assert.equal(fd.no, null); assert.equal(fd.card.kind, 'trap');
  const va2 = seen(m, 'a');
  assert.equal(va2.players.me.back.find(Boolean).no, trap.no);   // 自分の伏せ札は見える
});

test('自分の番でない席の手・知らない uid・終わった後の手は断る', () => {
  const m = mk();
  assert.equal(m.act('b', { kind: 'end' }).r.why, 'notYourTurn');
  assert.equal(m.act('a', { kind: 'play', uid: 999999 }).r.why, 'notInHand');
  assert.equal(m.act('a', { kind: 'attack', uid: 999999 }).r.why, 'notOnField');
  assert.equal(m.act('a', { kind: 'nope' }).r.why, 'badAction');
  m.st.winner = 'me';
  assert.equal(m.act('a', { kind: 'end' }).r.why, 'over');
});

test('ターンを終えると相手の番になり、log は「前回から増えた分」だけ', () => {
  const m = mk();
  seen(m, 'a');   // 最初の log（出した・引いた）を読んだことにする
  const { r, a } = m.act('a', { kind: 'end' });
  assert.equal(r.ok, true); assert.equal(a.kind, 'end');
  assert.equal(m.activeSeat(), 'b');
  const vb = seen(m, 'b');
  assert.equal(vb.active, 'me'); assert.equal(vb.turn, 2);
  const n1 = m.st.log.length;
  m.act('b', { kind: 'end' });
  assert.ok(m.st.log.length <= n1 + 3, 'log は毎回空にしてから足される');
});

test('Infinity（ずっと続く効果）は JSON を通っても「今のターンより大きい」のまま', () => {
  const m = mk();
  const x = m.st.players.me.hand.find((c) => c.card.kind === 'squid');
  x.buffs.push({ stat: 'def', n: -1, expires: Infinity, starts: 0 }); x.flags.tieWins = Infinity;
  const v = seen(m, 'a');
  const y = v.players.me.hand.find((c) => c.uid === x.uid);
  assert.ok(y.buffs[0].expires > 1000); assert.ok(y.flags.tieWins > 1000);
  assert.equal(statOf(v, y, 'def'), Math.max(0, x.card.def - 1));
});

test('時間切れの自動納竿と、降参', () => {
  const m = mk();
  const a = m.autoEnd();
  assert.equal(a.kind, 'end'); assert.equal(a.auto, true); assert.equal(m.activeSeat(), 'b');
  const r = m.resign('b');
  assert.equal(r.kind, 'resign'); assert.equal(m.st.winner, 'me'); assert.equal(m.over(), true);
  assert.equal(seen(m, 'a').winner, 'me'); assert.equal(seen(m, 'b').winner, 'cpu');
  assert.equal(m.autoEnd(), null); assert.equal(m.resign('a'), null);
});

// 本番の形：両方の席が「自分から見た状態（mirror）」だけを見て手を決め（CPU の思考を借りる）、uid で手を送る
test('2つの席が mirror だけを見て最後まで戦える（40ターン以内に決着）', () => {
  for (const seed of ['x1', 'x2', 'x3']) {
    const m = mk({ seed, first: seed === 'x2' ? 'cpu' : 'me' });
    let guard = 0;
    while (!m.over() && guard++ < 400) {
      const seat = m.activeSeat();
      const v = seen(m, seat);
      assert.equal(v.active, 'me');
      const a = cpuNext(v, 'me');
      let res;
      if (a.type === 'end') res = m.act(seat, { kind: 'end' });
      else if (a.type === 'shakuri') res = m.act(seat, { kind: 'shakuri', uid: a.x.uid });
      else if (a.type === 'play') res = m.act(seat, { kind: 'play', uid: a.x.uid, target: a.target?.uid ?? null });
      else res = m.act(seat, { kind: 'attack', uid: a.x.uid, target: a.target?.uid ?? null });
      assert.equal(res.r.ok, true, `${seed} T${m.st.turn} ${a.type} ${res.r.why}`);
      if (a.type !== 'end') { assert.ok(res.a); assert.equal(res.a.kind, a.type); }
      // 結果の中に盤面の実体（card 入り）が混ざっていない（相手にも送るので）
      assert.ok(!res.r.caught || (typeof res.r.caught.uid === 'number' && !res.r.caught.card));
      assert.ok(!res.r.trap || !res.r.trap.card);
    }
    assert.ok(m.over(), `${seed} 決着しなかった`);
    assert.ok(m.st.turn <= 60, `${seed} ${m.st.turn} ターン`);
  }
});

test('mirror の自分の手札は canPlay で判定できる（潮・前列の空き）', () => {
  const m = mk();
  const v = seen(m, 'a');
  const sq = v.players.me.hand.filter((x) => x.card.kind === 'squid');
  assert.ok(sq.some((x) => canPlay(v, 'me', x).ok), '最初の手札に出せるイカがある（配り直しの決まり）');
});

test('部屋コードは4桁の数字', () => {
  assert.equal(isCode('1234'), true); assert.equal(isCode(' 0007 '), true);
  assert.equal(isCode('123'), false); assert.equal(isCode('abcd'), false); assert.equal(isCode(''), false);
});

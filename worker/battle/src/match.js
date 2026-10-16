// オンライン対戦の1試合（2026-10-16・第1段階）。battle.js をそのまま動かし、各席に「見せてよい分」だけを渡す
//   ・席は a／b。battle.js の中では a＝'me'、b＝'cpu' として進め、相手に送るときは読み替える（相手から見れば自分が 'me'）
//   ・DOM も Cloudflare の仕組みも触らない（node --test で確かめる）。部屋（room.js）が通信と時間を受け持つ
//   ・第1段階は2人とも同じデッキ（スターター）。第2段階で deckA／deckB を外から渡す
import { newGame, play, attack, endTurn, shakuri, starterDeck, checkDeck } from '../../../src/js/ikabu/games/battle.js';

export const TURN_MS = 60_000;     // 1ターンの持ち時間
export const LEAVE_MS = 30_000;    // 通信が切れてから負けになるまで
const SIDE = { a: 'me', b: 'cpu' };
const otherSeat = (seat) => (seat === 'a' ? 'b' : 'a');
export const sideOf = (seat) => SIDE[seat];

// JSON にできない値（Infinity）を大きな数に。画面では「今のターンより大きいか」しか見ないので同じ意味になる
const BIG = 1e9;
const num = (v) => (v === Infinity ? BIG : v);
const serCard = (x) => {
  if (!x) return null;
  const { card, ...rest } = x;   // card は番号から引けるので送らない（軽くする）
  return { ...rest, buffs: x.buffs.map((b) => ({ ...b, expires: num(b.expires), starts: num(b.starts ?? 0) })), flags: Object.fromEntries(Object.entries(x.flags).map(([k, v]) => [k, num(v)])) };
};
// 相手の伏せカード・手札：番号も中身も見せない（uid だけ。画面の枚数と裏向きの絵に使う）
const facedown = (x) => (x ? { uid: x.uid, no: null, hidden: true, card: { kind: 'trap', name: '', cost: 0 }, buffs: [], flags: {} } : null);
const inHand = (x) => ({ uid: x.uid, no: null, hidden: true, card: { kind: 'hidden', name: '', cost: 0 }, buffs: [], flags: {} });

export function createMatch({ cards, effects, deckA = null, deckB = null, seed = `${Date.now()}`, first = null } = {}) {
  const same = starterDeck(cards);
  const myDeck = deckA ?? same, cpuDeck = deckB ?? same;
  for (const [name, d] of [['a', myDeck], ['b', cpuDeck]]) { const c = checkDeck(d, cards); if (!c.ok) throw new Error(`deck ${name}: ${c.errors.join('・')}`); }
  const st = newGame({ myDeck, cpuDeck, cards, effects, first: first ?? (Math.random() < 0.5 ? 'me' : 'cpu'), seed });
  const m = { st, deadline: 0 };

  const P = (side) => st.players[side];
  const byUid = (list, uid) => list.find((x) => x && String(x.uid) === String(uid)) ?? null;
  // 席から見た状態。log は「前回送った後に増えた分」だけ（act の前に空にする）
  m.viewFor = (seat) => {
    const me = SIDE[seat], op = SIDE[otherSeat(seat)];
    const rel = (s) => (s == null ? null : s === me ? 'me' : 'cpu');
    const pub = (p, mine) => ({
      egi: p.egi, tide: p.tide, tideMax: p.tideMax, tideNext: p.tideNext, tailwind: !!p.tailwind, summoned: p.summoned, techUsed: p.techUsed, techLimit: p.techLimit, noAttack: p.noAttack, lost: p.lost, shiodome: !!p.shiodome,
      front: p.front.map(serCard), back: p.back.map(mine ? serCard : facedown), hand: mine ? p.hand.map(serCard) : p.hand.map(inHand), grave: p.grave.map(serCard), deck: p.deck.length,
    });
    return { turn: st.turn, active: rel(st.active), first: rel(st.first), winner: rel(st.winner), rule: st.rule, log: st.log.map((l) => ({ ...l, side: rel(l.side) })), players: { me: pub(P(me), true), cpu: pub(P(op), false) }, deadline: m.deadline };
  };
  // 結果の中の盤面の実体を、uid と番号だけにする（相手にも送るので、見せてよい物だけ）
  const slim = (r) => { if (!r) return r; const { trap, caught, ...rest } = r; if (trap) rest.trap = { uid: trap.uid, no: trap.no }; if (caught) rest.caught = { uid: caught.uid, no: caught.no }; return rest; };

  // 席の手を進める。戻り値 { r, a }：r＝結果（ok／why…）、a＝相手に見せる「何をしたか」
  m.act = (seat, msg) => {
    const side = SIDE[seat], en = P(SIDE[otherSeat(seat)]), p = P(side);
    st.log = [];
    if (st.winner) return { r: { ok: false, why: 'over' } };
    if (st.active !== side) return { r: { ok: false, why: 'notYourTurn' } };
    switch (msg?.kind) {
      case 'play': {
        const x = byUid(p.hand, msg.uid); if (!x) return { r: { ok: false, why: 'notInHand' } };
        const target = msg.target != null ? byUid(p.front, msg.target) ?? byUid(en.front, msg.target) : null;
        if (msg.target != null && !target) return { r: { ok: false, why: 'noTarget' } };
        const r = play(st, side, x, { target, mark: msg.mark ?? null });
        return { r: slim(r), a: r.ok ? { kind: 'play', uid: x.uid, no: x.card.kind === 'trap' ? null : x.no, cardKind: x.card.kind, target: target?.uid ?? null } : null };
      }
      case 'attack': {
        const x = byUid(p.front, msg.uid); if (!x) return { r: { ok: false, why: 'notOnField' } };
        const target = msg.target != null ? byUid(en.front, msg.target) : null;
        if (msg.target != null && !target) return { r: { ok: false, why: 'noTarget' } };
        const r = attack(st, side, x, target);
        if (r.ok && r.result === 'catch') r.caught = target;
        return { r: slim(r), a: r.ok ? { kind: 'attack', uid: x.uid, target: target?.uid ?? null } : null };
      }
      case 'shakuri': {
        const x = byUid(p.front, msg.uid); if (!x) return { r: { ok: false, why: 'notOnField' } };
        const r = shakuri(st, side, x);
        return { r: slim(r), a: r.ok ? { kind: 'shakuri', uid: x.uid } : null };
      }
      case 'end': {
        const discard = (msg.discard ?? []).map((u) => byUid(p.hand, u)).filter(Boolean);
        endTurn(st, { discard });
        return { r: { ok: true }, a: { kind: 'end' } };
      }
      default: return { r: { ok: false, why: 'badAction' } };
    }
  };
  // 持ち時間切れ：納竿はコストの高い順に自動で捨てて、ターンを終える
  m.autoEnd = () => { st.log = []; if (st.winner) return null; endTurn(st); return { kind: 'end', auto: true }; };
  // 投了・通信が戻らない：相手の勝ち
  m.resign = (seat) => { st.log = []; if (st.winner) return null; st.winner = SIDE[otherSeat(seat)]; st.log.push({ turn: st.turn, side: st.active, text: '相手が降参した' }); return { kind: 'resign', seat }; };
  m.activeSeat = () => (st.active === 'me' ? 'a' : 'b');
  m.over = () => !!st.winner;
  return m;
}

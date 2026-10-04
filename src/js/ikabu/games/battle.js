// イカ部カードバトルの頭脳（2026-09-30）。設計案 4章 v2。DOM に触らない（node --test で確かめる）。画面は battle-ui.js
//   ・30枚デッキ／前列3・後列3／エギ5＝ライフ／潮＝コスト（ターンごとに最大+1・上限8・毎ターン回復）
//   ・出したターンは攻撃できない（haste を除く）／攻撃 vs 防御：＞釣る・＝バラシ（両方残る）・＜弾かれる（次のターン攻撃できない）
//   ・相手の前列が0体の時だけダイレクト（エギ1個）。奪われた側は1枚引く。エギ0か、山札が尽きて引けないと負け
//   ・先攻は最初のターン攻撃できない。同じマークのイカが前列にいると、そのマークのテクニックは潮1安い
//   ・カードの効果は cards-effects.json（make_effects.py が effect の文から機械的に作る）
//   2026-10-01 膠着の解消（ぱっぱ「終盤カードが減らないし攻撃補助が無いと詰む」）：
//   ・潮しゃくり：余った潮2で自分の前列のイカ1体の攻撃+1（このターン・1体につき1回）＝ shakuri()
//   ・守りの疲れ：攻撃が弾かれる（攻撃＜防御）たびに、受けたイカの防御が1下がる（ずっと・0まで）
import { seeded } from './rng.js';

export const FRONT = 3, BACK = 3, EGI = 5, HAND_MAX = 7, TIDE_MAX = 8, DECK_SIZE = 30, START_HAND = 5;
export const DECK_RULE = { squid: [12, 15], tech: [9, 12], trap: [4, 6], copies: 2, SSR: 2, UR: 1 };
export const NIGHT = ['ケンサキ', 'ヤリ', 'アカ', 'ホタル'];
export const SHAKURI_COST = 2, SHAKURI_ATK = 1, WEAR_DEF = 1;
export const TAILWIND_TURNS = 2, TAILWIND_TIDE = 1;   // 後攻の追い風：自分の最初の2ターンは潮+1（2026-10-01 自動対戦で先攻71%→54%）
const other = (side) => (side === 'me' ? 'cpu' : 'me');
// 夜のイカ・夜のテクニック（2026-10-03）：名前の文字で決めると「真冬の大槍」（ヤリイカ）が漏れ、「常夜灯」「ナイトエギング」などの夜の技が
//   夜に数えられていなかった（ぱっぱの点検の依頼で発覚）→ カードの番号で決める。画面ではカードに🌙を出す
export const NIGHT_NOS = new Set([
  4, 5, 7, 15, 22, 23, 34, 49, 125, 126, 128,   // イカ：ケンサキ・ヤリ・ホタル・アカ・欧州ヤリ・カリフォルニアヤリ・アメリカオオアカ・ヤリの群れ・月夜のケンサキ・スナイプヤリ・真冬の大槍
  68, 71, 76, 85, 86, 90, 127,                   // テクニック：常夜灯・ナイトエギング・夜光エギ・満月の夜・新月・イカメタル・ヤリイカの接岸
]);
export const isNight = (card) => NIGHT_NOS.has(card.no);
// そのカードの今のマーク（エギのカラーチェンジで変わる）
export const markOf = (x) => x.mark ?? x.card.mark;
export const MARK_IDS = ['anchor', 'sun', 'wave', 'star', 'shell'];

/* ---------- デッキの検査 ---------- */
export function checkDeck(nos, cards) {
  const byNo = new Map(cards.map((c) => [c.no, c]));
  const list = nos.map((n) => byNo.get(n)).filter(Boolean);
  const errors = [];
  if (list.length !== DECK_SIZE) errors.push(`枚数が${list.length}枚（30枚ちょうど）`);
  const cnt = (k) => list.filter((c) => c.kind === k).length;
  for (const k of ['squid', 'tech', 'trap']) { const [lo, hi] = DECK_RULE[k]; const n = cnt(k); if (n < lo || n > hi) errors.push(`${{ squid: 'イカ', tech: 'テクニック', trap: 'トラップ' }[k]}が${n}枚（${lo}〜${hi}）`); }
  const copies = new Map(); for (const c of list) copies.set(c.no, (copies.get(c.no) ?? 0) + 1);
  for (const [no, n] of copies) if (n > DECK_RULE.copies) errors.push(`${byNo.get(no).name}が${n}枚（同じカードは2枚まで）`);
  const ssr = list.filter((c) => c.rarity === 'SSR').length, ur = list.filter((c) => c.rarity === 'UR').length;
  if (ssr > DECK_RULE.SSR) errors.push(`SSRが${ssr}枚（2枚まで）`);
  if (ur > DECK_RULE.UR) errors.push(`URが${ur}枚（1枚まで）`);
  return { ok: errors.length === 0, errors };
}

// スターターデッキ（N・Rだけ・30枚・誰でも持っている）。practice=true は「初心者練習デッキ」（CPU用。Nだけ・弱め）
//   2026-10-01 組み直し：攻撃4〜6のRと、攻撃補助のテクニック（しゃくり・2段しゃくり・3段しゃくり…）を2枚ずつ。安い順だと攻撃2ばかりで詰んだ
const STARTER = {
  //   2026-10-04 潮1で出せるイカを1枚→5枚に（スルメ・ヤリ・ハリ・スレたイカ→シリヤケ×2・ヒメコウ×2）。先攻の潮止まり83%→36%、部長に勝つ割合は39%→38%で同じ（ぱっぱ）
  squid: [14, 14, 15, 28, 29, 6, 5, 12, 4, 4, 1, 2, 2, 24, 24],     // アオリ×2・アカ・アルゼンチン・NZスルメ・スルメ・ヤリ・トビ・ケンサキ×2・ヒイカ・シリヤケ×2・ヒメコウ×2
  tech: [51, 51, 65, 65, 66, 64, 70, 69, 67, 55, 68],               // しゃくり×2・2段×2・3段・ディープ・朝マズメ・夕マズメ・スラック・フリーフォール・常夜灯
  trap: [96, 99, 103, 108],                                          // 根掛かり・濁り潮・バラシ・フグ
};
const PRACTICE = {
  squid: [6, 6, 5, 4, 4, 11, 21, 23, 2, 2, 3, 3, 1, 22],             // Nだけ。スルメ×2・ヤリ・ケンサキ×2・ハリ・欧州コウ・カリフォルニアヤリ…
  tech: [51, 51, 64, 52, 54, 55, 58, 61, 63, 60, 56],
  trap: [96, 99, 101, 97, 98],
};
const BUCHO = {
  squid: [50, 50, 48, 18, 14, 14, 15, 28, 29, 6, 5, 5, 12, 4],       // 部長アオリ×2・春の大物・テカギ・アオリ×2・アカ・アルゼンチン・NZスルメ・スルメ・ヤリ×2・トビ・ケンサキ
  tech: [93, 83, 84, 51, 51, 65, 65, 66, 70, 69, 68],                  // 部長の号令（SSR）・強力なフッキング・墨フラッシュ・しゃくり×2・2段×2・3段・朝マズメ・夕マズメ・常夜灯
  trap: [115, 116, 96, 103, 108],                                      // 干潮・急な雷・根掛かり・バラシ・フグ
};
export const CPU_DECKS = {
  practice: { name: ['初心者練習デッキ', 'Beginner practice'], counted: false },
  bucho: { name: ['部長デッキ', "Captain's deck"], counted: true },
};
export function cpuDeck(cards, level = 'practice') {
  const src = level === 'bucho' ? BUCHO : level === 'starter' ? STARTER : PRACTICE;
  const have = new Set(cards.map((c) => c.no));
  return [...src.squid, ...src.tech, ...src.trap].filter((no) => have.has(no));
}
export function starterDeck(cards, { practice = false } = {}) {
  const src = practice ? PRACTICE : STARTER;
  const have = new Set(cards.map((c) => c.no));
  const deck = [...src.squid, ...src.tech, ...src.trap].filter((no) => have.has(no));
  return deck;
}

/* ---------- 状態 ---------- */
let uidSeq = 1;
const inst = (card) => ({ uid: uidSeq++, no: card.no, card, buffs: [], sick: true, skipNext: false, skipThis: false, attacked: false, shield: false, resting: false, faceDown: false, flags: {} });
const player = (nos, byNo, rnd, { egi = EGI, back = BACK } = {}) => {
  const deck = nos.map((n) => inst(byNo.get(n)));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { deck, hand: [], front: [null, null, null], back: Array(back).fill(null), grave: [], egi, tideMax: 0, tide: 0, tideNext: 0, summoned: false, techUsed: 0, techLimit: null, noAttack: false, lost: null };
};

// 場のルール（ストーリーモード 2026-10-03。両者に同じだけ効く）
//   night：星のイカの攻撃+1 ／ summerNight：太陽のテクニックが潮1安い ／ rough：後列の枠が4 ／ exam：相手（cpu）が先攻
export const FIELD_RULES = {
  night: { back: BACK }, summerNight: { back: BACK }, rough: { back: 4 }, exam: { back: BACK, first: 'cpu' },
};
export function newGame({ myDeck, cpuDeck, cards, effects, first = 'me', seed = `${Date.now()}`, cpuEgi = EGI, rule = null }) {
  const byNo = new Map(cards.map((c) => [c.no, c]));
  const rnd = seeded(`battle:${seed}`);
  const fr = rule ? FIELD_RULES[rule] : null;
  if (fr?.first) first = fr.first;
  const back = fr?.back ?? BACK;
  const st = { turn: 0, active: first, first, players: { me: player(myDeck, byNo, rnd, { back }), cpu: player(cpuDeck, byNo, rnd, { egi: cpuEgi, back }) }, effects, byNo, log: [], winner: null, rnd, pending: null, rule };
  for (const side of ['me', 'cpu']) dealStart(st, side, rnd);
  startTurn(st);
  return st;
}
const P = (st, side) => st.players[side];
// 最初の手札：自分の最初のターンの潮で出せるイカが1枚も無ければ配り直す（最大10回）。2026-10-01 ぱっぱ「前列に出せないと詰む」
//   潮は先攻1・後攻2（追い風）。前は両方「潮2以下」で判定していたので、先攻の手札がコスト2のイカだけでも配り直さなかった（2026-10-04 ぱっぱ指摘）
//   10回で出なければ、山札の中のいちばん安いイカを手札のいちばん高いカードと入れ替える（山札に1枚あれば必ず出せる）
//   配り直した時は p.shiodome＝true（画面で「潮止まり・仕切り直し」と知らせる。2026-10-04 ぱっぱの名付け）
export const MULLIGAN_MAX_COST = 2;
export const firstTide = (st, side) => 1 + (side !== st.first ? TAILWIND_TIDE : 0);
function dealStart(st, side, rnd) {
  const p = P(st, side), max = firstTide(st, side);
  const ok = (x) => x.card.kind === 'squid' && x.card.cost <= max;
  for (let tries = 0; tries < 10; tries++) {
    for (let i = 0; i < START_HAND; i++) draw(st, side);
    if (p.hand.some(ok)) { p.shiodome = tries > 0; return; }
    if (tries === 9) break;
    p.deck.push(...p.hand.splice(0));   // 戻して混ぜ直す
    for (let i = p.deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p.deck[i], p.deck[j]] = [p.deck[j], p.deck[i]]; }
  }
  p.shiodome = true;
  const cheap = p.deck.filter(ok).sort((a, b) => a.card.cost - b.card.cost)[0];
  if (!cheap) return;   // 山札にも無い（そういうデッキ）
  const high = [...p.hand].sort((a, b) => b.card.cost - a.card.cost)[0];
  p.hand[p.hand.indexOf(high)] = cheap; p.deck[p.deck.indexOf(cheap)] = high;
}
export const effectsOf = (st, no) => st.effects[String(no)] ?? [];
const passive = (st, x, name) => effectsOf(st, x.no).some((e) => e.when === 'passive' && e.do === name);
const say = (st, text) => { st.log.push({ turn: st.turn, side: st.active, text }); if (st.log.length > 200) st.log.shift(); };

function draw(st, side, n = 1) {
  const p = P(st, side);
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) { p.lost = 'deck'; return false; }
    if (p.hand.length >= HAND_MAX + 3) return true;   // 手札が多すぎる時は引かない（納竿で7枚に整える）
    p.hand.push(p.deck.shift());
  }
  return true;
}
export function startTurn(st) {
  st.turn += 1;
  const side = st.active, p = P(st, side);
  p.tideMax = Math.min(TIDE_MAX, p.tideMax + 1);
  p.tide = Math.max(0, p.tideMax + p.tideNext); p.tideNext = 0;
  p.tailwind = side !== st.first && Math.ceil(st.turn / 2) <= TAILWIND_TURNS;   // 後攻の追い風
  if (p.tailwind) p.tide = Math.min(TIDE_MAX, p.tide + TAILWIND_TIDE);
  p.summoned = false; p.techUsed = 0; p.techLimit = null; p.noAttack = st.turn === 1;   // 先攻の最初のターンは攻撃できない
  for (const x of p.front) if (x) { x.sick = false; x.attacked = false; x.shield = false; x.shakuri = false; x.skipThis = x.skipNext; x.skipNext = false; if (x.resting) { x.resting = false; } }
  for (const x of P(st, other(side)).front) if (x) x.shield = false;
  if (!draw(st, side)) { finish(st, other(side)); return st; }
  fireTraps(st, other(side), 'enemyTurnStart', {});
  return st;
}
// 納竿で捨てる枚数（7枚を超えた分）
export const overflow = (st, side) => Math.max(0, P(st, side).hand.length - HAND_MAX);
export function endTurn(st, { discard = null } = {}) {
  const side = st.active, p = P(st, side);
  const n = overflow(st, side);
  if (n > 0) {   // 納竿：超えた分を捨てる。選んだカードがあればそれを、無ければコストの高い順（CPU）
    const chosen = (discard ?? []).filter((x) => p.hand.includes(x)).slice(0, n);
    const rest = p.hand.filter((x) => !chosen.includes(x)).sort((a, b) => b.card.cost - a.card.cost);
    for (const x of [...chosen, ...rest.slice(0, n - chosen.length)]) { p.hand.splice(p.hand.indexOf(x), 1); p.grave.push(x); say(st, `${x.card.name}を捨てた（納竿）`); }
  }
  for (const s of ['me', 'cpu']) for (const x of P(st, s).front) if (x) { x.buffs = x.buffs.filter((b) => b.expires > st.turn); for (const k of Object.keys(x.flags)) if (x.flags[k] <= st.turn) delete x.flags[k]; }
  st.active = other(side);
  return startTurn(st);
}
function finish(st, winner) { st.winner = winner; say(st, winner === 'me' ? '勝った！' : '負けた…'); }

/* ---------- 数字 ---------- */
export function statOf(st, x, stat) {
  if (!x) return 0;
  let v = x.card[stat] ?? 0;
  for (const b of x.buffs) if (b.stat === stat && (b.starts ?? 0) <= st.turn) v += b.n;
  if (stat === 'def' && passive(st, x, 'defOnEnemyTurn') && ownerOf(st, x) !== st.active) v += effectsOf(st, x.no).find((e) => e.do === 'defOnEnemyTurn').n;
  if (stat === 'atk' && x.flags.zeroAtk) return 0;
  if (stat === 'atk' && st.rule === 'night' && markOf(x) === 'star') v += 1;   // 場のルール「夜」
  return Math.max(0, v);
}
export const ownerOf = (st, x) => (P(st, 'me').front.includes(x) || P(st, 'me').back.includes(x) || P(st, 'me').hand.includes(x) ? 'me' : 'cpu');
const buff = (st, x, stat, n, until) => {
  if (!x) return;
  const expires = until === 'forever' ? Infinity : until === 'oppTurnEnd' ? st.turn + 1 : until === 'nextTurn' ? st.turn + 2 : st.turn;
  x.buffs.push({ stat, n, expires, starts: until === 'nextTurn' ? st.turn + 2 : 0 });
};
export function costOf(st, side, x) {
  const p = P(st, side);
  let c = x.card.cost;
  if (x.card.kind === 'tech') {
    if (p.front.some((f) => f && markOf(f) === x.card.mark)) c -= 1;   // 同じマークのイカがいると潮1安い（イカのマークはカラーチェンジで変わる）
    if (st.rule === 'summerNight' && x.card.mark === 'sun') c -= 1;   // 場のルール「夏の夜」
    for (const f of p.front) if (f) for (const e of effectsOf(st, f.no)) if (e.when === 'passive' && e.do === 'techCheaper' && (e.only === 'all' || (e.only === 'night' && isNight(x.card)))) { c -= e.n; break; }
  }
  return Math.max(0, c);
}

/* ---------- 効果 ---------- */
// who → 対象の一覧（1体を選ぶものは ctx.target を使う）
function resolveWho(st, side, who, ctx) {
  const me = P(st, side), en = P(st, other(side));
  const own = me.front.filter(Boolean), enemy = en.front.filter(Boolean);
  switch (who) {
    case 'ownOne': case 'enemyOne': case 'ownNightOne': case 'ownTiredOne': return ctx.target ? [ctx.target] : [];
    case 'same': return ctx.last ? [ctx.last] : [];
    case 'ownAll': return own;
    case 'enemyAll': return enemy;
    case 'ownNight': return own.filter((x) => isNight(x.card));
    case 'ownCheap': return own.filter((x) => x.card.cost <= 1);
    case 'target': return ctx.target ? [ctx.target] : [];
    case 'attacker': return ctx.attacker ? [ctx.attacker] : [];
    case 'defender': return ctx.defender ? [ctx.defender] : [];
    case 'entered': return ctx.entered ? [ctx.entered] : [];
    default: return [];
  }
}
// 対象を選ぶ必要がある効果か（画面で「対象を選んでください」を出す）
export function needsTarget(st, x) {
  const e = effectsOf(st, x.no).find((e) => ['ownOne', 'enemyOne', 'ownNightOne', 'ownTiredOne'].includes(e.who) && (e.when === 'play' || e.when === 'enter'));
  return e ? e.who : null;
}
// 手札のテクニックにいちばん多いマーク（カラーチェンジで CPU が選ぶ・選ばなかった時）。無ければ今のまま
function favoriteMark(p, x) {
  const n = {}; for (const h of p.hand) if (h.card.kind === 'tech') n[h.card.mark] = (n[h.card.mark] ?? 0) + 1;
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
  return best ?? (x ? markOf(x) : 'anchor');
}
function removeFromFront(st, side, x) { const p = P(st, side); const i = p.front.indexOf(x); if (i >= 0) p.front[i] = null; }
function run(st, side, acts, ctx) {
  const me = P(st, side), en = P(st, other(side));
  for (const a of acts) {
    const targets = a.who ? resolveWho(st, side, a.who, ctx) : [];
    switch (a.do) {
      case 'draw': draw(st, side, a.n); break;
      case 'drawEnemy': draw(st, other(side), a.n); break;
      case 'tide': me.tide = a.ignoreCap ? me.tide + a.n : Math.min(TIDE_MAX, me.tide + a.n); break;
      case 'tideEnemyNext': en.tideNext += a.n; break;
      case 'buff': for (const x of targets) buff(st, x, a.stat, a.n, a.until); if (targets[0]) ctx.last = targets[0]; break;
      case 'shield': for (const x of targets) x.shield = true; if (targets[0]) ctx.last = targets[0]; break;
      case 'rest': for (const x of targets) { x.resting = true; x.attacked = true; buff(st, x, 'atk', a.thenAtk, 'nextTurn'); } break;
      case 'flag': for (const x of targets) x.flags[a.flag] = a.until === 'forever' ? Infinity : st.turn; break;
      case 'zeroAtk': for (const x of targets) x.flags.zeroAtk = st.turn; break;
      case 'heal': for (const x of targets) { x.skipThis = false; x.skipNext = false; } break;
      case 'bounce': for (const x of targets) { const o = ownerOf(st, x); removeFromFront(st, o, x); x.buffs = []; x.flags = {}; delete x.mark; P(st, o).hand.push(x); } break;
      case 'catch': for (const x of targets) if (a.maxDef == null || statOf(st, x, 'def') <= a.maxDef) caught(st, other(side), x, side); break;
      case 'tutor': { const i = me.deck.findIndex((x) => x.card.name === a.name); if (i >= 0) me.hand.push(...me.deck.splice(i, 1)); break; }
      case 'tutorSquid': { let n = a.n ?? 1; for (let i = 0; i < me.deck.length && n > 0; i++) { const x = me.deck[i]; if (x.card.kind === 'squid' && (a.maxCost == null || x.card.cost <= a.maxCost)) { me.hand.push(...me.deck.splice(i, 1)); i--; n--; } } break; }
      case 'peekPick': { const top = me.deck.slice(0, a.n); if (top.length) { const best = top.reduce((m, x) => (x.card.cost > m.card.cost ? x : m), top[0]); me.deck.splice(me.deck.indexOf(best), 1); me.hand.push(best); } break; }
      case 'summonFromDeck': { const slot = me.front.indexOf(null); const i = me.deck.findIndex((x) => x.card.kind === 'squid' && x.card.cost <= a.maxCost); if (slot >= 0 && i >= 0) { const x = me.deck.splice(i, 1)[0]; x.sick = true; me.front[slot] = x; } break; }
      case 'revealTrap': { const i = en.back.findIndex((x) => x && x.card.kind === 'trap'); if (i >= 0) { en.grave.push(en.back[i]); en.back[i] = null; say(st, 'トラップを見破った！'); } break; }
      case 'changeMark': {   // 2026-10-03：前は効果なしだった。選んだマーク（ctx.mark）に変える。CPU・選ばなかった時は手札のテクニックに多いマーク
        const m = MARK_IDS.includes(ctx.mark) ? ctx.mark : favoriteMark(me, targets[0]);
        for (const x of targets) { x.mark = m; say(st, `${x.card.name}のマークが変わった`); }
        break;
      }
      case 'discardEnemy': if (en.hand.length) en.grave.push(en.hand.splice(Math.floor(st.rnd() * en.hand.length), 1)[0]); break;
      case 'limitTech': en.techLimit = a.n; break;
      case 'noAttack': en.noAttack = true; break;
      case 'tire': for (const x of targets) x.skipNext = true; break;
      case 'block': ctx.blocked = true; break;
      case 'negate': ctx.negated = true; break;
      case 'saveToHand': ctx.saved = true; break;
      default: break;
    }
  }
}
// 伏せたトラップが条件で開く（1つの出来事につき、条件に合う最初の1枚だけ）
function fireTraps(st, side, when, ctx) {
  const p = P(st, side);
  for (let i = 0; i < p.back.length; i++) {
    const x = p.back[i];
    if (!x || x.card.kind !== 'trap') continue;
    const acts = effectsOf(st, x.no).filter((e) => e.when === when);
    if (!acts.length) continue;
    if (acts.some((a) => a.onlyNight) && !(ctx.attacker && isNight(ctx.attacker.card))) continue;
    p.back[i] = null; p.grave.push(x);
    say(st, `トラップ「${x.card.name}」が開いた！`);
    ctx.trap = x;
    run(st, side, acts, ctx);
    return x;
  }
  return null;
}
function caught(st, side, x, bySide) {
  // side＝釣られる側。藻場のようなトラップで助かることがある
  const ctx = { defender: x };
  fireTraps(st, side, 'ownCaught', ctx);
  removeFromFront(st, side, x);
  x.buffs = []; x.flags = {}; delete x.mark;
  if (ctx.saved) { P(st, side).hand.push(x); say(st, `${x.card.name}は手札に戻った`); return; }
  P(st, side).grave.push(x);
  say(st, `${x.card.name}を釣った！`);
  run(st, side, effectsOf(st, x.no).filter((e) => e.when === 'caught'), { target: pickEnemyForCaught(st, side) });
}
const pickEnemyForCaught = (st, side) => P(st, other(side)).front.filter(Boolean).sort((a, b) => statOf(st, b, 'atk') - statOf(st, a, 'atk'))[0] ?? null;

/* ---------- 手（プレイヤー／CPU 共通） ---------- */
export function canPlay(st, side, x) {
  const p = P(st, side);
  if (st.active !== side || st.winner) return { ok: false, why: 'notYourTurn' };
  if (!p.hand.includes(x)) return { ok: false, why: 'notInHand' };
  if (x.card.kind === 'squid') { if (p.summoned) return { ok: false, why: 'summoned' }; if (!p.front.includes(null)) return { ok: false, why: 'frontFull' }; }
  if (x.card.kind === 'trap' && !p.back.includes(null)) return { ok: false, why: 'backFull' };
  if (x.card.kind === 'tech' && p.techLimit != null && p.techUsed >= p.techLimit) return { ok: false, why: 'techLimit' };
  if (costOf(st, side, x) > p.tide) return { ok: false, why: 'tide' };
  return { ok: true };
}
// target：対象のイカ（要る時だけ）。戻り値：{ ok, why, events }
export function play(st, side, x, { target = null, mark = null } = {}) {
  const c = canPlay(st, side, x);
  if (!c.ok) return c;
  const p = P(st, side), en = P(st, other(side));
  const need = needsTarget(st, x);
  if (need && !target) return { ok: false, why: 'needTarget', who: need };
  p.tide -= costOf(st, side, x);
  p.hand.splice(p.hand.indexOf(x), 1);
  const ctx = { target, mark };
  if (x.card.kind === 'squid') {
    x.sick = true; x.attacked = false; x.skipNext = false; x.skipThis = false;
    p.front[p.front.indexOf(null)] = x; p.summoned = true;
    say(st, `${x.card.name}を出した`);
    run(st, side, effectsOf(st, x.no).filter((e) => e.when === 'enter'), ctx);
    fireTraps(st, other(side), 'enemySquidEnter', { entered: x });
  } else if (x.card.kind === 'tech') {
    p.techUsed += 1;
    say(st, `${x.card.name}！`);
    fireTraps(st, other(side), 'enemyTech', ctx);
    if (ctx.negated) { say(st, `${x.card.name}は無効になった`); p.grave.push(x); return { ok: true, negated: true }; }
    run(st, side, effectsOf(st, x.no).filter((e) => e.when === 'play'), ctx);
    p.grave.push(x);
  } else {
    x.faceDown = true;
    p.back[p.back.indexOf(null)] = x;
    say(st, 'カードを伏せた');
  }
  check(st);
  return { ok: true };
}
// 潮しゃくり：潮2で自分の前列のイカ1体の攻撃+1（このターン・1体1回）
export function canShakuri(st, side, x) {
  const p = P(st, side);
  if (st.active !== side || st.winner) return { ok: false, why: 'notYourTurn' };
  if (!p.front.includes(x)) return { ok: false, why: 'notOnField' };
  if (x.shakuri) return { ok: false, why: 'shakuried' };
  if (p.tide < SHAKURI_COST) return { ok: false, why: 'tide' };
  return { ok: true };
}
export function shakuri(st, side, x) {
  const c = canShakuri(st, side, x);
  if (!c.ok) return c;
  P(st, side).tide -= SHAKURI_COST; x.shakuri = true;
  buff(st, x, 'atk', SHAKURI_ATK, 'turnEnd');
  say(st, `${x.card.name}を潮でしゃくった（攻撃+${SHAKURI_ATK}）`);
  return { ok: true };
}
export function canAttack(st, side, x) {
  const p = P(st, side);
  if (st.active !== side || st.winner) return { ok: false, why: 'notYourTurn' };
  if (!p.front.includes(x)) return { ok: false, why: 'notOnField' };
  if (p.noAttack) return { ok: false, why: 'noAttack' };
  if (x.attacked) return { ok: false, why: 'attacked' };
  if (x.sick && !passive(st, x, 'haste')) return { ok: false, why: 'sick' };
  if (x.skipThis) return { ok: false, why: 'tired' };
  return { ok: true };
}
// target：相手のイカ。null＝ダイレクトアタック（相手の前列が0体の時だけ）
export function attack(st, side, x, target = null) {
  const c = canAttack(st, side, x);
  if (!c.ok) return c;
  const en = P(st, other(side));
  const enemies = en.front.filter(Boolean);
  if (enemies.length && (!target || !enemies.includes(target))) return { ok: false, why: 'mustTargetSquid' };
  if (!enemies.length && target) return { ok: false, why: 'noTarget' };
  if (target && target.shield) return { ok: false, why: 'shielded' };
  x.attacked = true;
  const ctx = { attacker: x, defender: target };
  const ignore = passive(st, x, 'ignoreTrapOnAttack') || x.flags.ignoreTrap != null;
  say(st, `${x.card.name}の攻撃！`);
  if (!ignore) fireTraps(st, other(side), 'enemyAttack', ctx);
  if (ctx.blocked) { say(st, '攻撃は止められた'); check(st); return { ok: true, result: 'trapped', trap: ctx.trap }; }
  run(st, side, effectsOf(st, x.no).filter((e) => e.when === 'attack'), { target });
  if (!target) {
    en.egi -= 1; say(st, `ダイレクトアタック！ エギを1個奪った（残り${en.egi}）`);
    if (en.egi <= 0) { finish(st, side); return { ok: true, result: 'direct', win: true }; }
    draw(st, other(side), 1);   // 奪われた側は1枚引く
    check(st);
    return { ok: true, result: 'direct', trap: ctx.trap };
  }
  const A = statOf(st, x, 'atk'), D = statOf(st, target, 'def');
  const tieWins = passive(st, x, 'tieWins') || x.flags.tieWins != null;
  let result;
  if (A > D || (A === D && tieWins)) { caught(st, other(side), target, side); result = 'catch'; }
  else if (A === D) { say(st, '互角！ どちらも残った'); result = 'tie'; }   // 「バラシ」はカードの説明どおり「弾かれて次の番は休み」の意味に（2026-10-03）
  else { say(st, `${target.card.name}に弾かれた`); if (!passive(st, x, 'noTiredWhenBlocked')) x.skipNext = true; buff(st, target, 'def', -WEAR_DEF, 'forever'); result = 'blocked'; }   // 守りの疲れ：受けた側の防御-1（ずっと）
  check(st);
  return { ok: true, result, A, D, trap: ctx.trap };
}
function check(st) {
  if (st.winner) return;
  for (const s of ['me', 'cpu']) { const p = P(st, s); if (p.egi <= 0 || p.lost) { finish(st, other(s)); return; } }
}

/* ---------- CPU の手（読みやすい型） ---------- */
// 次の1手を返す：{ type:'play', x, target } | { type:'attack', x, target } | { type:'end' }
export function cpuNext(st, side = 'cpu') {
  if (st.active !== side || st.winner) return { type: 'end' };
  const p = P(st, side), en = P(st, other(side));
  const enemies = en.front.filter(Boolean);
  const own = p.front.filter(Boolean);
  const strength = (x) => x.card.atk + x.card.def;
  // 1. イカを出す（出せる中でいちばん強いもの）
  const squids = p.hand.filter((x) => x.card.kind === 'squid' && canPlay(st, side, x).ok).sort((a, b) => strength(b) - strength(a));
  if (squids.length) {
    const x = squids[0];
    const need = needsTarget(st, x);
    const target = need === 'enemyOne' ? enemies.sort((a, b) => statOf(st, b, 'atk') - statOf(st, a, 'atk'))[0] ?? null : need === 'ownOne' ? own[0] ?? null : null;
    if (!need || target) return { type: 'play', x, target };
  }
  // 2. 攻撃（釣れる相手がいれば釣る。前列が空ならダイレクト）
  const ready = own.filter((x) => canAttack(st, side, x).ok);
  for (const x of ready) {
    if (!enemies.length) return { type: 'attack', x, target: null };
    const A = statOf(st, x, 'atk');
    const catchable = enemies.filter((e) => !e.shield && statOf(st, e, 'def') < A).sort((a, b) => strength(b) - strength(a));
    if (catchable.length) return { type: 'attack', x, target: catchable[0] };
  }
  // 2b. 潮しゃくり：+1で釣れるようになる相手がいるなら潮を使う
  for (const x of ready) {
    if (!enemies.length || !canShakuri(st, side, x).ok) continue;
    const A = statOf(st, x, 'atk') + SHAKURI_ATK;
    if (enemies.some((e) => !e.shield && statOf(st, e, 'def') < A)) return { type: 'shakuri', x };
  }
  // 3. テクニック：攻撃+ で釣れるようになるなら使う。引くカードは手札が少ない時に使う
  const techs = p.hand.filter((x) => x.card.kind === 'tech' && canPlay(st, side, x).ok);
  for (const x of techs) {
    const acts = effectsOf(st, x.no);
    const drawAct = acts.find((a) => a.do === 'draw' || a.do === 'tutorSquid' || a.do === 'peekPick');
    const atkBuff = acts.find((a) => a.do === 'buff' && a.who === 'ownOne' && a.stat === 'atk' && a.n > 0);
    const defDebuff = acts.find((a) => a.do === 'buff' && a.who === 'enemyOne' && a.stat === 'def' && a.n < 0);
    if (atkBuff && ready.length && enemies.length) {
      for (const r of ready) { const A = statOf(st, r, 'atk') + atkBuff.n; if (enemies.some((e) => !e.shield && statOf(st, e, 'def') < A)) return { type: 'play', x, target: r }; }
    }
    if (defDebuff && ready.length && enemies.length) {
      for (const e of enemies) { const D = statOf(st, e, 'def') + defDebuff.n; if (ready.some((r) => statOf(st, r, 'atk') > D)) return { type: 'play', x, target: e }; }
    }
    if (drawAct && !needsTarget(st, x) && p.hand.length <= 4) return { type: 'play', x, target: null };
  }
  // 3b. 全体のテクニック（自分全部+／相手全部-）：釣れる相手が増えるなら使う
  for (const x of techs) {
    const acts = effectsOf(st, x.no);
    const allBuff = acts.find((a) => a.do === 'buff' && a.who === 'ownAll' && a.stat === 'atk' && a.n > 0);
    const allDebuff = acts.find((a) => a.do === 'buff' && a.who === 'enemyAll' && a.stat === 'def' && a.n < 0);
    if (!ready.length || !enemies.length) continue;
    const gain = (dAtk, dDef) => ready.filter((r) => enemies.some((e) => !e.shield && statOf(st, e, 'def') + dDef < statOf(st, r, 'atk') + dAtk)).length - ready.filter((r) => enemies.some((e) => !e.shield && statOf(st, e, 'def') < statOf(st, r, 'atk'))).length;
    if (allBuff && gain(allBuff.n, 0) > 0) return { type: 'play', x, target: null };
    if (allDebuff && gain(0, allDebuff.n) > 0) return { type: 'play', x, target: null };
  }
  // 4. トラップを伏せる
  const trap = p.hand.find((x) => x.card.kind === 'trap' && canPlay(st, side, x).ok);
  if (trap) return { type: 'play', x: trap, target: null };
  // 5. 弾かれない相手がいなくても、相手の前列が空ならダイレクトは上で済んでいる。残りは待つ
  return { type: 'end' };
}

/* ---------- 画面用のまとめ ---------- */
export const view = (st, side) => {
  const p = P(st, side);
  return { egi: p.egi, tide: p.tide, tideMax: p.tideMax, hand: p.hand.length, deck: p.deck.length, grave: p.grave.length };
};

// CPU の「考える力」（2026-10-03 ストーリーモード）。battle.js の cpuNext（＝Lv2）を土台に、弱い Lv1 と強い Lv3 を足す
//   Lv1：出せる中でいちばん強いイカを出す → 攻撃できるイカは全部攻撃（釣れなくても突っ込む）。テクニック・トラップは使わない
//   Lv2：battle.js の cpuNext そのまま
//   Lv3：Lv2 に加えて ①弾かれる攻撃はしない ③釣れる相手は攻撃力の高い順（次にエギを狙う脅威）に、釣れる中でいちばん弱いイカで釣る
//        ⑤自分の前列が空で相手がいる時は、相手の攻撃を受け止められる防御のイカを優先して出す
//   自動対戦（同じデッキ同士・200戦）：Lv1 vs Lv2 9%・Lv3 vs Lv1 96%・Lv3 vs Lv2 51%。この規則では「釣れるなら攻める」が最善で Lv2 が既に最善に近い。
//   難しさの差は主に「デッキの強さ・相手のエギの数」で付ける（story-data.js）
//   戻り値は cpuNext と同じ：{ type:'play'|'attack'|'shakuri'|'end', x, target }
import { cpuNext, canPlay, canAttack, canShakuri, needsTarget, statOf, SHAKURI_ATK } from './battle.js';

export const BRAIN_LEVELS = [1, 2, 3];
const P = (st, side) => st.players[side];
const other = (s) => (s === 'me' ? 'cpu' : 'me');
const strength = (x) => x.card.atk + x.card.def;

function lv1(st, side) {
  const p = P(st, side), en = P(st, other(side));
  const enemies = en.front.filter(Boolean);
  const squids = p.hand.filter((x) => x.card.kind === 'squid' && canPlay(st, side, x).ok && !needsTarget(st, x)).sort((a, b) => strength(b) - strength(a));
  if (squids.length) return { type: 'play', x: squids[0], target: null };
  const ready = p.front.filter((x) => x && canAttack(st, side, x).ok);
  if (ready.length) {
    const x = ready[0];
    if (!enemies.length) return { type: 'attack', x, target: null };
    const open = enemies.filter((e) => !e.shield);
    if (!open.length) return { type: 'end' };
    // いちばん弱い相手に突っ込む（釣れなくても）
    return { type: 'attack', x, target: open.sort((a, b) => statOf(st, a, 'def') - statOf(st, b, 'def'))[0] };
  }
  return { type: 'end' };
}

function lv3(st, side) {
  const p = P(st, side), en = P(st, other(side));
  const enemies = en.front.filter(Boolean);
  const open = enemies.filter((e) => !e.shield);
  const ready = p.front.filter((x) => x && canAttack(st, side, x).ok);
  // ③ 釣れる相手がいれば、強い相手（攻撃＋防御）から釣る。釣るのは「釣れる中でいちばん弱いイカ」＝強いイカを次の相手に残す
  for (const e of open.slice().sort((a, b) => statOf(st, b, 'atk') - statOf(st, a, 'atk') || strength(b) - strength(a))) {
    const D = statOf(st, e, 'def');
    const hitter = ready.filter((x) => statOf(st, x, 'atk') > D).sort((a, b) => statOf(st, a, 'atk') - statOf(st, b, 'atk'))[0];   // 釣れる中でいちばん弱いイカで
    if (hitter) return { type: 'attack', x: hitter, target: e };
  }
  // 前列が空ならダイレクト
  if (!enemies.length && ready.length) return { type: 'attack', x: ready.sort((a, b) => statOf(st, b, 'atk') - statOf(st, a, 'atk'))[0], target: null };
  // ⑤ 相手の前列にイカがいて自分の前列が空いている時は、「相手のいちばん強い攻撃を受け止められる」イカを優先して出す（Lv2 は攻撃＋防御の合計で選ぶ）
  if (!p.summoned && p.front.includes(null) && enemies.length) {
    const threat = Math.max(...enemies.map((e) => statOf(st, e, 'atk')));
    const squids = p.hand.filter((x) => x.card.kind === 'squid' && canPlay(st, side, x).ok && !needsTarget(st, x));
    const wall = squids.filter((x) => x.card.def >= threat).sort((a, b) => strength(b) - strength(a))[0];
    if (wall && !p.front.some(Boolean)) return { type: 'play', x: wall, target: null };
  }
  // 残りは Lv2 の手順（イカを出す → 攻撃 → 潮しゃくり → テクニック → トラップ）。潮しゃくりを先にすると潮が尽きてイカが出せない（自動対戦で判明）
  //   ただし「弾かれる攻撃」と「守りに回る時の攻撃」は捨てる
  const a = cpuNext(st, side);
  if (a.type === 'attack') {
    if (!a.target) return a;
    const A = statOf(st, a.x, 'atk'), D = statOf(st, a.target, 'def');
    if (A <= D) return afterAttack(st, side, a);   // ① 弾かれる（同じ数字はバラシで無駄）→ 攻撃しない
    return a;
  }
  return a;
}
// 攻撃を見送った後、まだ出せる物（テクニック・トラップ）があるかを Lv2 にもう一度聞く。攻撃しか返ってこなければ終わる
function afterAttack(st, side, skipped) {
  const p = P(st, side);
  for (const x of p.front) if (x === skipped.x) x.attacked = true;   // 仮に「攻撃済み」にして次の候補を聞く
  const b = cpuNext(st, side);
  for (const x of p.front) if (x === skipped.x) x.attacked = false;
  if (b.type === 'attack' && b.target && statOf(st, b.x, 'atk') <= statOf(st, b.target, 'def')) return { type: 'end' };
  return b;
}

export function brainNext(st, level = 2, side = 'cpu') {
  if (st.active !== side || st.winner) return { type: 'end' };
  if (level <= 1) return lv1(st, side);
  if (level >= 3) return lv3(st, side);
  return cpuNext(st, side);
}

// ガチャ演出の「台本」を決める（2026-09-30）。DOM に触らない純粋な部分（node --test で確かめる）。
//   考え方（設計案 3章・ぱっぱ「演出や動きが命」）：
//   ・結果（results）は先に引いてある。台本は結果を見て組む＝演出で結果が変わることはない
//   ・「予感」は外れてよい（時合いは SR 以上なら必ず、それ以外でも 15% で出る）
//   ・「確定」は必ず当たる（キロアップ＝SR以上、止まらない＝SSR以上、金の墨＝UR。虹はURの半分）
//   ・レア度ごとの結果の見せ方（N/R は静かに、SR は金、SSR は稲妻＋暗転、UR は金→虹で長く）
import { omen, rank } from './gacha.js';

export const FIGHT_MS = { normal: 2000, kiloUp: 4200, runaway: 6000 };
export const REVEAL_MS = { N: 700, R: 800, SR: 2000, SSR: 4600, UR: 7000 };
// エギを抱くイカ（2026-10-05 ぱっぱ「毎回ケンサキなので、SR高確率なら抱くイカの種類を変える」）
export const HOOK_OTHERS = ['kensaki', 'yari', 'surume', 'kouika'];
export function hookOf(top, rnd = Math.random) {
  const r = rank(top);
  const other = () => ({ species: HOOK_OTHERS[Math.min(HOOK_OTHERS.length - 1, Math.floor(rnd() * HOOK_OTHERS.length))], len: 72 });
  if (r >= rank('UR')) return { species: 'aori', len: 112 };
  if (r >= rank('SSR')) return { species: 'aori', len: 100 };
  if (r >= rank('SR')) return rnd() < 0.75 ? { species: 'aori', len: 88 } : other();
  const fake = r >= rank('R') ? 0.1 : 0.05;
  return rnd() < fake ? { species: 'aori', len: 76 } : other();
}
export const FIGHT_TEXT = {
  kiloUp: ['キロアップだ！', 'A kilo-up!'],
  runaway: ['止まらない…！', "It won't stop…"],
  boss: ['ボスか！？', 'A boss!?'],
};

// results: pull() の results。rnd: 0〜1 を返す関数（テストでは固定）。
export function planShow(results, rnd = Math.random, { firstToday = false, reduced = false } = {}) {
  const o = omen(results);
  const top = o.top;
  const r = rank(top);
  const jiai = r >= rank('SR') || rnd() < 0.15;                 // 予感：時合い（空がオレンジに）
  const lamp = r >= rank('R') ? rnd() < 0.5 : false;            // 予感：常夜灯が点く
  const ink = top === 'UR' ? (rnd() < 0.5 ? 'rainbow' : 'gold') : null;   // 確定：金の墨／虹の墨（URだけ）
  const fight = r >= rank('SSR') ? 'runaway' : r >= rank('SR') ? 'kiloUp' : 'normal';
  const approach = r >= rank('R') || rnd() < 0.4;               // イカがエギに寄ってくる（Rでなくても4割は寄る＝外れる予感）
  const reveals = results.map((x) => ({ rarity: x.rarity, ms: reduced ? 500 : REVEAL_MS[x.rarity] }));
  return {
    top, jiai, lamp, ink, fight, approach,
    fightMs: reduced ? 900 : FIGHT_MS[fight],
    nabura: o.nabura,           // 10連で R以上が3枚以上：投げた時に群れの波紋
    comeback: o.comeback,       // 10連の最後が SR以上：10枚目の前に「バラシ…？」→「まだ付いてる！」
    boss: firstToday,           // その日の最初：部長が顔を出す
    reveals,
    totalRevealMs: reveals.reduce((s, x) => s + x.ms, 0),
    hook: hookOf(top, rnd),     // 抱くイカ（最後に引く＝ほかの予感の乱数の順番を変えない）
  };
}

// 結果画面の見せ方の段（CSS の data-tier に使う）
export const tierOf = (rarity) => (rarity === 'UR' ? 'ur' : rarity === 'SSR' ? 'ssr' : rarity === 'SR' ? 'sr' : rarity === 'R' ? 'r' : 'n');

// 10連のまとめ：NEW の枚数・かけら・いちばん上のレア度
export function summarize(results) {
  return {
    fresh: results.filter((x) => x.isNew).length,
    shards: results.reduce((s, x) => s + (x.shards ?? 0), 0),
    top: results.reduce((m, x) => (rank(x.rarity) > rank(m) ? x.rarity : m), 'N'),
  };
}

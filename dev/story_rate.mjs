// ストーリー第1章の難しさを測る（2026-10-03）：自分＝スターターデッキ（考える力 Lv1＝初心者らしい／Lv2＝慣れた人）で、9人の相手と各 N 戦
//   node dev/story_rate.mjs [N]
import { readFileSync } from 'node:fs';
import { newGame, play, attack, endTurn, starterDeck } from '../src/js/ikabu/games/battle.js';
import { brainNext } from '../src/js/ikabu/games/cpu-brain.js';
import { BATTLES_CH1, deckNos } from '../src/js/ikabu/games/story-data.js';
const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const EFFECTS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-effects.json', import.meta.url), 'utf8'));
const N = Number(process.argv[2] ?? 200);
function run(b, myLevel, seed) {
  const st = newGame({ myDeck: b.myDeck ? deckNos(b.myDeck) : starterDeck(CARDS), cpuDeck: deckNos(b.deck), cards: CARDS, effects: EFFECTS, seed: `st${b.i}-${seed}`, first: seed % 2 ? 'me' : 'cpu', cpuEgi: b.cpuEgi, rule: b.rule });
  let g = 0;
  while (!st.winner && g++ < 400) {
    const side = st.active; const m = brainNext(st, side === 'me' ? myLevel : b.brain, side);
    if (m.type === 'end') { endTurn(st); continue; }
    if (m.type === 'shakuri') { st.players[side].tide -= 2; m.x.shakuri = true; m.x.buffs.push({ stat: 'atk', n: 1, expires: st.turn, starts: 0 }); continue; }
    if (m.type === 'play') { if (!play(st, side, m.x, { target: m.target }).ok) endTurn(st); continue; }
    if (!attack(st, side, m.x, m.target).ok) endTurn(st);
  }
  return st.winner;
}
console.log('戦  相手        エギ 頭  初心者(Lv1) 慣れた人(Lv2)');
for (const b of BATTLES_CH1) {
  const r = (lv) => { let w = 0; for (let i = 0; i < N; i++) if (run(b, lv, i) === 'me') w++; return `${String(Math.round(w / N * 100)).padStart(3)}%`; };
  console.log(`${b.i}  ${b.foe.padEnd(10)}  ${b.cpuEgi}   Lv${b.brain}  ${r(1)}        ${r(2)}`);
}

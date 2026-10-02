import { readFileSync } from 'node:fs';
import { newGame, play, attack, endTurn, starterDeck } from '../src/js/ikabu/games/battle.js';
import { brainNext } from '../src/js/ikabu/games/cpu-brain.js';
const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const EFFECTS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-effects.json', import.meta.url), 'utf8'));
function run(a, b, seed) {
  const st = newGame({ myDeck: starterDeck(CARDS), cpuDeck: starterDeck(CARDS), cards: CARDS, effects: EFFECTS, seed: `r${seed}`, first: seed % 2 ? 'me' : 'cpu' });
  let g = 0;
  while (!st.winner && g++ < 400) {
    const side = st.active; const m = brainNext(st, side === 'me' ? a : b, side);
    if (m.type === 'end') { endTurn(st); continue; }
    if (m.type === 'shakuri') { st.players[side].tide -= 2; m.x.shakuri = true; m.x.buffs.push({ stat: 'atk', n: 1, expires: st.turn, starts: 0 }); continue; }
    if (m.type === 'play') { if (!play(st, side, m.x, { target: m.target }).ok) endTurn(st); continue; }
    if (!attack(st, side, m.x, m.target).ok) endTurn(st);
  }
  return st.winner;
}
const N = 200;
for (const [a, b] of [[1,1],[2,1],[3,1],[3,2],[2,2],[3,3],[1,2],[1,3],[2,3]]) { let w = 0; for (let i = 0; i < N; i++) if (run(a, b, i) === 'me') w++; console.log(`Lv${a} vs Lv${b}: ${(w / N * 100).toFixed(0)}%`); }

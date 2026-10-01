import { createEgi, press, release, tick } from '../src/js/ikabu/games/egi.js';
const cast = (s) => { press(s); for (let t = 0; t < 0.8; t += 0.05) tick(s, 0.05); release(s); };
function fight(tackle, rand) {
  const s = createEgi({ rand, tackle }); cast(s); s.phase = 'fight'; s.tension = 30; s.dist = 12; s.hooking = { id: 'aori', weight: 900, mantle: 20, power: 0.8 };
  let why = null, time = 0, peak = 0;
  while (!why && time < 180) { if (s.tension < 60 && !s.pressing) press(s); else if (s.tension > 70 && s.pressing) release(s); for (const e of tick(s, 0.05)) if (['landed','break','unhooked'].includes(e.type)) why = e.type; peak = Math.max(peak, s.tension); time += 0.05; }
  return `${why} ${time.toFixed(0)}s 張り最大${peak.toFixed(0)}`;
}
let seed = 7; const prng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (const rod of ['stiff','medium','soft']) for (const drag of ['tight','normal','loose']) {
  seed = 7; console.log(rod, drag, '| ジェット無し:', fight({rod,drag}, () => 0.99), '| ふつうの乱数:', fight({rod,drag}, prng));
}

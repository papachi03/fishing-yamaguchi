// 底から、0.6秒おきにしゃくり続けて、水面近く（1.5m より浅い）に来るまで何回しゃくれるか（10/2 感想「2回しかできない」）
import { createEgi, press, release, tick } from '../src/js/ikabu/games/egi.js';
const run = (s, sec) => { for (let t = 0; t < sec; t += 0.05) tick(s, 0.05); };
for (const rod of ['stiff', 'medium', 'soft']) for (const drag of ['tight', 'normal', 'loose']) {
  const r = [];
  for (const bottom of [6, 8, 10]) {
    const s = createEgi({ rand: () => 0.99, tackle: { rod, drag } });
    press(s); run(s, 0.8); release(s); run(s, 2); s.bottom = bottom; s.depth = bottom;
    let n = 0;
    while (s.depth >= 1.5 && n < 20) { press(s); release(s); run(s, 0.6); n++; }
    r.push(n);
  }
  console.log(rod.padEnd(6), drag.padEnd(6), '底6m/8m/10m で', r.join(' / '), '回');
}

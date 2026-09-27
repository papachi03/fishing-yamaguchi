// テーラー（2026-09-28）の見た目：夜の堤防に電気ウキ3本・置き竿2本・糸・水中のテーラー・灯りの近くで見えるイカ。
// 動き（アタリの段階・抱く位置）は egi.js の s.floats。ここは描くだけ（egi-ui.js が毎コマ呼ぶ）。
//   ウキの見え方（ぱっぱの実釣）：倒れる＝触った／斜め＝抱いた／がっつり沈む＝合わせどき／海藻＝ゆっくり傾いて戻らない／フグ＝細かくピクピク
//   灯りの近くのウキ（緑）だけ、水中のイカがテーラーのどこ（頭側／根元）を抱いたか見える
import { svgEl, huggingSquid, speciesColors } from '../squid-art.js';
import { SCENE, depthY } from './egi-scene.js';
import { tanaDepth } from './egi.js';

export const FLOAT_COLORS = { green: '#6dff9a', red: '#ff6a6a', orange: '#ffb347' };
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NAVY = '#16233a';

// 置き竿2本（堤防の竿立て）。握りの位置と角度
const HOLDERS = [
  { x: 146, y: SCENE.pierTop, ang: 52, len: 170 },
  { x: 170, y: SCENE.pierTop, ang: 36, len: 176 },
];
const rodTip = (h) => ({ x: h.x + Math.cos((h.ang * Math.PI) / 180) * h.len, y: h.y - Math.sin((h.ang * Math.PI) / 180) * h.len });

// ウキ1本（原点＝水面の位置。上が光る頭、下が糸の付け根）
function floatShape(color) {
  const g = svgEl('g', { class: 'ika-tl-float' });
  const glow = svgEl('circle', { cx: '0', cy: '-19', r: '13', fill: FLOAT_COLORS[color], opacity: '0.35', class: 'ika-tl-glow' });
  g.append(
    glow,
    svgEl('path', { d: 'M0,-24 L0,-12', stroke: FLOAT_COLORS[color], 'stroke-width': '4.2', 'stroke-linecap': 'round' }),   // 光る頭
    svgEl('path', { d: 'M0,-12 Q4.5,-6 4,2 Q3,8 0,10 Q-3,8 -4,2 Q-4.5,-6 0,-12 Z', fill: '#f4ead8', stroke: NAVY, 'stroke-width': '1.6' }),   // 浮力の胴
    svgEl('path', { d: 'M0,10 L0,17', stroke: NAVY, 'stroke-width': '1.8', 'stroke-linecap': 'round' }),
  );
  return { g, glow };
}

// テーラー（原点＝真ん中）：上にオモリ、真ん中にエサ（ササミ）を巻いた胴、下（根元）に傘のような掛け針
function tailorShape() {
  const g = svgEl('g', { class: 'ika-tl-rig' });
  const hooks = [-5, -2.5, 0, 2.5, 5].map((x) => `M${x},9 L${x * 1.5},14 M${x * 1.5},14 l${x >= 0 ? -1.5 : 1.5},-2`).join(' ');
  g.append(
    svgEl('path', { d: 'M0,-17 L0,-12', stroke: NAVY, 'stroke-width': '1.4' }),
    svgEl('rect', { x: '-2.6', y: '-12.5', width: '5.2', height: '4.5', rx: '1.4', fill: '#5a6470', stroke: NAVY, 'stroke-width': '1.2' }),   // オモリ
    svgEl('rect', { x: '-3.6', y: '-8', width: '7.2', height: '17', rx: '2.4', fill: '#f6efe2', stroke: NAVY, 'stroke-width': '1.3' }),     // ササミを巻いた胴
    svgEl('path', { d: 'M-3.6,-4 L3.6,-2 M-3.6,1 L3.6,3 M-3.6,6 L3.6,8', stroke: '#c9bba0', 'stroke-width': '1' }),                            // 糸で巻いた筋
    svgEl('path', { d: hooks, fill: 'none', stroke: NAVY, 'stroke-width': '1.2', 'stroke-linecap': 'round' }),                                 // 根元の掛け針
  );
  return g;
}

// 取り込みの時にエギの位置に出すテーラー（egi-ui.js の egiWater・egiAir に入れる）
export function tailorDeco() {
  const g = svgEl('g', { class: 'ika-tl-deco', style: 'display:none', transform: 'translate(0,16) scale(1.1)' });
  g.append(tailorShape());
  return g;
}

export function buildTailor(sc) {
  const under = svgEl('g', { class: 'ika-tl-under', style: 'display:none' });
  const air = svgEl('g', { class: 'ika-tl-air', style: 'display:none' });
  const cone = svgEl('path', { fill: '#ffe9a8', opacity: '0.08', class: 'ika-tl-cone' });   // 常夜灯が届く水中（ここだけイカが見える）
  under.append(cone);
  const rods = HOLDERS.map(() => {
    const o = svgEl('path', { fill: 'none', stroke: NAVY, 'stroke-width': '5', 'stroke-linecap': 'round' });
    const i = svgEl('path', { fill: 'none', stroke: '#f4ead8', 'stroke-width': '2.6', 'stroke-linecap': 'round' });
    air.append(o, i);
    return { o, i };
  });
  const items = [0, 1, 2].map((i) => {
    const line = svgEl('path', { fill: 'none', stroke: '#fff8e6', 'stroke-width': '1.6', opacity: '0.8' });
    const leader = svgEl('path', { fill: 'none', stroke: '#fff8e6', 'stroke-width': '1.1', opacity: '0.5' });
    const rig = tailorShape();
    const squid = svgEl('g', { class: 'ika-tl-squid', opacity: '0' });
    under.append(leader, squid, rig);
    const color = ['green', 'red', 'orange'][i];
    const fl = floatShape(color);
    const hit = svgEl('circle', { r: '30', fill: 'transparent', 'data-float': String(i), class: 'ika-tl-hit', style: 'cursor:pointer' });
    fl.g.append(hit);
    air.append(line);
    sc.air.append(fl.g);
    return { line, leader, rig, squid, fl, color, ang: 0, dy: 0, squidId: null, squidKey: null };
  });
  sc.under.append(under);
  sc.air.insertBefore(air, sc.air.firstChild);
  return { under, air, cone, rods, items, shown: false };
}

// 毎コマ。geo：{ W, X(距離→x), mainTip（竿を持っているイカの竿先）, now, dt, reduced, fighting（掛けたウキの番号） }
export function drawTailor(T, s, geo) {
  if (!T) return;
  const on = s?.method === 'tailor' && ['tailor', 'fight', 'result', 'over'].includes(s.phase) && s.floats?.length;
  if (!on) {
    if (T.shown) { T.under.style.display = 'none'; T.air.style.display = 'none'; T.items.forEach((it) => it.fl.g.setAttribute('opacity', '0')); T.shown = false; }
    return;
  }
  if (!T.shown) { T.under.style.display = ''; T.air.style.display = ''; T.shown = true; }
  const { X, now, dt, reduced } = geo;
  const sy = SCENE.surface;
  const k = 1 - Math.exp(-dt * 7);
  const tips = [geo.mainTip, ...HOLDERS.map(rodTip)];
  T.rods.forEach((r, j) => {
    const h = HOLDERS[j];
    const tp = rodTip(h);
    const d = `M${h.x},${h.y} L${f1(tp.x)},${f1(tp.y)}`;
    r.o.setAttribute('d', d); r.i.setAttribute('d', d);
  });
  // 常夜灯が届く範囲（灯りの近くのウキのまわりだけ、水中が明るい）
  const lit = s.floats.find((f) => f.lit);
  if (lit) {
    const cx = X(lit.dist);
    const yb = depthY(s.bottom * 0.9);
    T.cone.setAttribute('d', `M${f1(cx - 70)},${sy} L${f1(cx + 70)},${sy} L${f1(cx + 110)},${f1(yb)} L${f1(cx - 110)},${f1(yb)} Z`);
  }
  const tanaY = depthY(tanaDepth(s));
  s.floats.forEach((f, i) => {
    const it = T.items[i];
    const fighting = s.phase === 'fight' && s.setIdx === i;
    const shown = !fighting && (f.bait > 0 || f.stage !== 'idle');
    it.fl.g.setAttribute('opacity', shown ? '1' : '0');
    it.line.setAttribute('opacity', shown ? '0.8' : '0');
    it.leader.setAttribute('opacity', shown ? (f.lit ? '0.6' : '0.25') : '0');
    it.rig.setAttribute('opacity', shown ? (f.lit ? '1' : '0.28') : '0');
    if (!shown) { it.squid.setAttribute('opacity', '0'); return; }
    // ウキの傾き（度）と沈み（px）の目標
    const ph = i * 1.9;
    const since = s.t - (f.at ?? 0);
    let ang = reduced ? 0 : Math.sin(now * 1.3 + ph) * 3;
    let dy = reduced ? 0 : Math.sin(now * 1.7 + ph) * 1.5;
    switch (f.stage) {
      case 'touch': ang = 72 + (reduced ? 0 : Math.sin(now * 9 + ph) * 6); dy = 2; break;   // 倒れる＝触った
      case 'lean': ang = 42 + (reduced ? 0 : Math.sin(now * 5 + ph) * 3); dy = 4; break;     // 斜め＝抱いた
      case 'sink': ang = 12; dy = 42; break;                                                   // がっつり沈む（光る頭まで水の中）
      case 'weed': ang = clamp(since * 16, 0, 50); dy = 3; break;                             // ゆっくり傾いたまま
      case 'fugu': ang = reduced ? 20 : Math.sin(now * 26 + ph) * 16; dy = reduced ? 1 : Math.sin(now * 33) * 2.5; break;   // 細かくピクピク
      default: break;
    }
    // 投げ直した直後は上から落ちてくる
    const drop = f.stage === 'idle' && since < 0.45 ? (1 - since / 0.45) * -60 : 0;
    const quick = f.stage === 'fugu' || f.stage === 'touch';
    it.ang += (ang - it.ang) * (quick ? 1 : k);
    it.dy += (dy + drop - it.dy) * (drop ? 1 : k);
    const fx = X(f.dist);
    const fy = sy + it.dy;
    it.fl.g.setAttribute('transform', `translate(${f1(fx)},${f1(fy)}) rotate(${f1(it.ang)}) scale(1.45)`);   // スマホでも見えるように大きめ
    it.fl.glow.setAttribute('opacity', f.stage === 'sink' ? '0.55' : String(0.3 + (reduced ? 0 : Math.sin(now * 2 + ph) * 0.05)));
    // 竿先→ウキの糸（ゆるく垂れる）
    const tp = tips[i];
    const mx = (tp.x + fx) / 2;
    const my = Math.max(tp.y, fy) - 10 + Math.abs(fx - tp.x) * 0.08;
    it.line.setAttribute('d', `M${f1(tp.x)},${f1(tp.y)} Q${f1(mx)},${f1(my)} ${f1(fx)},${f1(fy - 30)}`);
    // ウキ→テーラー（タナの深さ）。沈んでいる時は引き込まれて下へ
    const rigY = tanaY + (f.stage === 'sink' ? 16 : f.stage === 'lean' ? 6 : 0);
    const rigX = fx + (f.stage === 'lean' || f.stage === 'sink' ? 6 : 0);
    it.leader.setAttribute('d', `M${f1(fx)},${f1(fy + 24)} L${f1(rigX)},${f1(rigY - 21)}`);
    it.rig.setAttribute('transform', `translate(${f1(rigX)},${f1(rigY)}) rotate(${f1(f.stage === 'sink' ? 8 : 0)}) scale(1.25)`);
    // 灯りの近くだけ：テーラーを抱いたイカが見える（頭側＝上／根元＝下）
    const hugging = f.lit && f.squid && ['touch', 'lean', 'sink'].includes(f.stage);
    if (hugging) {
      const key = `${f.squid.id}:${f.squid.mantle}`;
      if (it.squidKey !== key) {
        it.squid.innerHTML = '';
        const art = huggingSquid({ species: f.squid.id, len: clamp(f.squid.mantle * 1.1, 26, 46), colors: speciesColors(f.squid.id) });
        art.querySelectorAll('.ika-art-egi').forEach((e) => { e.style.display = 'none'; });
        it.squid.append(art);
        it.squidKey = key;
      }
      const reach = f.stage === 'touch' ? 14 : 0;   // 触っているだけの時は少し離れている
      const hy = rigY + (f.hold === 'head' ? -9 : 9);
      it.squid.setAttribute('transform', `translate(${f1(rigX - 14 + reach)},${f1(hy)}) rotate(-90)`);
      it.squid.setAttribute('opacity', f.stage === 'touch' ? '0.75' : '1');
    } else it.squid.setAttribute('opacity', '0');
  });
}

// タップした位置（SVG の座標）に近いウキの番号。無ければ -1
export function tailorHit(T, s, X, pt) {
  if (!T || !s?.floats?.length) return -1;
  let best = -1;
  let bd = 46;
  s.floats.forEach((f, i) => {
    const d = Math.hypot(pt.x - X(f.dist), pt.y - (SCENE.surface - 6));
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

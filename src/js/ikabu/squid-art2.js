// イカの絵・第2版（2026-09-29、ぱっぱ「単調な図形で作られていて、ひんそに見える」）。
// 楕円と一定の太さの線でなく、生き物として描く：肩がふくらむ胴、波打つ薄い膜のひれ、根元が太く先が細い足（吸盤つき）、
// 先が広がる2本の触腕、虹彩と光のある目、線の強弱、皮の色素の点。絵柄（アイボリー＋紺）と座標の決まりは squid-art.js と同じ。
//   原点＝糸の結び目（エギの頭）、+y が下。足がエギの側（上）、胴は下（y=44 から len）。
// 2026-09-29 全種に展開（SHAPE の表で種類ごとの形を切り替える）
import { svgEl, ART, egiShape, BODY } from './squid-art.js';

const f = (n) => Number(n.toFixed(2));
// 点の列をなめらかな閉じた道に（中点を通る二次ベジェ）
function smoothPath(pts, close = true) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = '';
  const m0 = mid(pts[0], pts[1]);
  d += `M${f(m0[0])},${f(m0[1])}`;
  for (let i = 1; i < n + (close ? 1 : 0); i++) {
    const p = pts[i % n];
    const q = pts[(i + 1) % n];
    const m = mid(p, q);
    if (!close && i === n - 1) { d += ` L${f(p[0])},${f(p[1])}`; break; }
    d += ` Q${f(p[0])},${f(p[1])} ${f(m[0])},${f(m[1])}`;
  }
  return d + (close ? ' Z' : '');
}
// 決まった並びの疑似乱数（描くたびに点の位置が変わらないように）
function lcg(seed) {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// 二次ベジェの上の点と向き
const qPoint = (p0, p1, p2, t) => [
  (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
  (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1],
];
const qTangent = (p0, p1, p2, t) => {
  const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
  const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
  const L = Math.hypot(dx, dy) || 1;
  return [dx / L, dy / L];
};

// 足1本：中心線（二次ベジェ）に沿って、根元 w0 → 先 w1 の太さで塗りの形にする。吸盤は内側（x=0 の側）に並べる
//   club: 触腕の先の広がり（ヒレのような小さな葉）
function taperedArm({ p0, p1, p2, w0 = 2.4, w1 = 0.7, suckers = true, club = false, front = true, color = null }, C) {
  const N = 14;
  const L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = qPoint(p0, p1, p2, t);
    const [tx, ty] = qTangent(p0, p1, p2, t);
    const w = w0 + (w1 - w0) * (t ** 0.85);
    L.push([x - ty * w, y + tx * w]);
    R.push([x + ty * w, y - tx * w]);
  }
  const tip = qPoint(p0, p1, p2, 1);
  const pts = [...L, tip, ...R.reverse()];
  const g = svgEl('g', { class: front ? 'ika-arm-front' : 'ika-arm-back' });
  g.__root = p0;
  g.__reach = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]);
  g.append(svgEl('path', { d: smoothPath(pts), fill: color ?? C.arm ?? C.ivory, stroke: C.navy, 'stroke-width': '1.7', 'stroke-linejoin': 'round' }));
  // 内側の面（少し暗い）：足の丸みを出す
  const inner = [];
  for (let i = 2; i <= N - 1; i++) {
    const t = i / N;
    const [x, y] = qPoint(p0, p1, p2, t);
    const [tx, ty] = qTangent(p0, p1, p2, t);
    const w = (w0 + (w1 - w0) * t ** 0.85) * 0.5;
    const side = p0[0] <= 0 ? 1 : -1;   // 左の足は右（内）側、右の足は左（内）側
    inner.push([x - ty * w * side * 0.4, y + tx * w * side * 0.4]);
  }
  if (suckers) {
    const side = p0[0] <= 0 ? 1 : -1;
    for (let i = 3; i <= N - 1; i += 2) {
      const t = i / N;
      const [x, y] = qPoint(p0, p1, p2, t);
      const [tx, ty] = qTangent(p0, p1, p2, t);
      const w = w0 + (w1 - w0) * t ** 0.85;
      const r = Math.max(0.45, w * 0.36);
      g.append(svgEl('circle', { cx: f(x - ty * w * side * 0.5), cy: f(y + tx * w * side * 0.5), r: f(r), fill: C.navy, opacity: '0.55' }));
    }
  }
  if (club) {
    const [tx, ty] = qTangent(p0, p1, p2, 1);
    const ang = (Math.atan2(ty, tx) * 180) / Math.PI;
    g.append(svgEl('ellipse', { cx: f(tip[0] + tx * 2.2), cy: f(tip[1] + ty * 2.2), rx: '4.2', ry: '2.1', transform: `rotate(${f(ang)} ${f(tip[0] + tx * 2.2)} ${f(tip[1] + ty * 2.2)})`, fill: color ?? C.arm ?? C.ivory, stroke: C.navy, 'stroke-width': '1.5' }));
    for (const s of [-1, 1]) g.append(svgEl('circle', { cx: f(tip[0] + tx * 2.2 + ty * s * 0.9), cy: f(tip[1] + ty * 2.2 - tx * s * 0.9), r: '0.6', fill: C.navy, opacity: '0.6' }));
  }
  return g;
}

// アオリイカの頭と胴（足は別）。len＝胴長、W＝肩の半幅
// 種類ごとの形（2026-09-29 ぱっぱの見本：スルメ／ケンサキ／ヤリの図、モンゴウ・コウイカ・シリヤケ・ソデイカの写真）
//   kind: squid（細長い胴・先がとがる）／cuttle（丸く幅広い胴・先は丸い）
//   fin: oval（胴全体を包む葉の形＝アオリ）／rhombus（finFrom から先の菱形。finW＝広さ）／skirt（胴を一周する細い膜）
//   ratio＝肩の半幅／胴長、tip＝先の伸び（ヤリは槍のように長い）
export const SHAPE = {
  aori: { kind: 'squid', ratio: 0.3, fin: 'oval', midline: true, dashes: true, band: true },
  default: { kind: 'squid', ratio: 0.3, fin: 'oval', midline: true, dashes: true, band: true },
  kensaki: { kind: 'squid', ratio: 0.19, fin: 'rhombus', finFrom: 0.42, finW: 0.95, dashes: true, finThin: true },
  yari: { kind: 'squid', ratio: 0.15, fin: 'rhombus', finFrom: 0.4, finW: 0.8, tip: 6, dashes: true },
  hiika: { kind: 'squid', ratio: 0.3, fin: 'rhombus', finFrom: 0.6, finW: 0.85, spots: true, bigEye: true, tentK: 0.8 },   // 見本：透けた胴に赤茶の点がびっしり、大きな目
  surume: { kind: 'squid', ratio: 0.2, fin: 'rhombus', finFrom: 0.62, finW: 1.15, stripe: 0.3 },
  akaika: { kind: 'squid', ratio: 0.22, fin: 'rhombus', finFrom: 0.58, finW: 1.25, stripe: 0.45, tentK: 1.3 },   // 見本：後ろ4割の幅広い菱形、長い触腕
  sodeika: { kind: 'squid', ratio: 0.26, fin: 'rhombus', finFrom: 0.03, finW: 1.2 },
  daiou: { kind: 'squid', ratio: 0.2, fin: 'rhombus', finFrom: 0.78, finW: 0.6, bigEye: true, tentK: 1.7 },   // 見本：小さなひれ、大きな目、極端に長い触腕
  kouika: { kind: 'cuttle', ratio: 0.36, fin: 'skirt', lines: true, spine: true, whiteTent: true },
  mongo: { kind: 'cuttle', ratio: 0.38, fin: 'skirt', lines: true, beans: true, whiteTent: true },
  shiriyake: { kind: 'cuttle', ratio: 0.36, fin: 'skirt', whiteDots: true, finDots: true, tailMark: true, whiteTent: true },
};
export const shapeOf = (species) => SHAPE[species] ?? SHAPE.default;

// 胴の半幅。squid＝肩は前寄り（t≈0.3）で先はとがる涙の形／cuttle＝両端が丸い楕円
const mantleHW = (sh, W, t) => sh.kind === 'cuttle'
  ? W * Math.sin(Math.PI * (0.05 + 0.95 * t)) ** 0.5
  : W * Math.sin(Math.PI * (0.12 + 0.88 * t) * 0.92) ** 0.75 * (1 - 0.35 * t ** 2);
// ひれの張り出し（波なし）
function finExtra(sh, W, t) {
  if (sh.fin === 'oval') return (W * 0.75 + 3) * Math.sin(Math.PI * t ** 0.9) ** 1.1 * (1 - t) ** 0.25;
  if (sh.fin === 'skirt') return (W * 0.3 + 2.2) * Math.sin(Math.PI * t) ** 0.3;
  const u = (t - sh.finFrom) / (1 - sh.finFrom);
  if (u <= 0) return 0;
  return (W * sh.finW + 3) * (u < 0.55 ? u / 0.55 : (1 - u) / 0.45) ** 0.9;
}
// ひれの道。phase＝波の位相（進めると波が前から後ろへ流れる）、amp＝波の高さの倍率（0 で止まったひれ）
function finPath(sh, W, len, top, phase = 0, amp = 1) {
  const finL = [], finR = [];
  const NF = 28;
  const skirt = sh.fin === 'skirt';
  const wave = (W * (skirt ? 0.1 : 0.13) + 0.6) * amp;   // コウイカの仲間はひれ全体が細かくひらひら
  const freq = skirt ? 3.2 : 2.2;
  const tail = top + len + (sh.tip ?? 2);
  for (let i = 0; i <= NF; i++) {
    const t = i / NF;
    const y = top + 5 + (len - 1) * t;
    const body = mantleHW(sh, W, t);
    const ex = finExtra(sh, W, t);
    const edge = ex <= 0.01 || i === NF ? 0 : Math.min(1, ex / 3);
    finL.push([-(body + ex + edge * wave * Math.sin(2 * Math.PI * freq * t - phase)), y]);
    finR.push([body + ex + edge * wave * Math.sin(2 * Math.PI * freq * t - phase + 1.2), y]);
  }
  return smoothPath([...finL, [0, tail], ...finR.reverse()]);
}

// 頭と胴（足は別）。種類は SHAPE で切り替える
function speciesBody({ species = 'default', len = 56, colors: C = ART, seed = 7 }) {
  const sh = shapeOf(species);
  const top = 44;
  const W = Math.max(6, len * sh.ratio);
  const parts = [];
  const rnd = lcg(seed);
  const tail = top + len + (sh.tip ?? 2);
  const hwAt = (t) => mantleHW(sh, W, t);

  // ひれ（animateSquid が phase を進めて波打たせる）
  const fin = svgEl('path', { class: 'ika-fin', d: finPath(sh, W, len, top, 0, 0), fill: C.fin ?? C.ivory, stroke: C.navy, 'stroke-width': sh.fin === 'skirt' ? '1.8' : '2.2', 'stroke-linejoin': 'round', opacity: sh.finThin ? '0.8' : '0.96' });
  fin.__fin = { sh, W, len, top };
  parts.push(fin);
  // ひれの筋（薄い放射の線）：膜の張りを出す。スカートには入れない
  if (sh.fin !== 'skirt') {
    const NF = 28;
    for (let i = 2; i < NF - 2; i += 3) {
      const t = i / NF;
      const ex = finExtra(sh, W, t);
      if (ex < 2) continue;
      const y = top + 5 + (len - 1) * t;
      const body = hwAt(t);
      for (const s of [-1, 1]) parts.push(svgEl('path', { d: `M${f(s * body * 0.95)},${f(y - 1)} Q${f(s * (body + ex * 0.5))},${f(y + 1)} ${f(s * (body + ex * 0.88))},${f(y + 3)}`, fill: 'none', stroke: C.navy, 'stroke-width': '0.7', 'stroke-linecap': 'round', opacity: '0.16' }));
    }
  }
  // シリヤケ：ひれのつけ根に沿って白い点の列
  if (sh.finDots) for (let i = 1; i < 9; i++) { const t = i / 9; const hw = hwAt(t); for (const s of [-1, 1]) parts.push(svgEl('circle', { cx: f(s * (hw + 1.2)), cy: f(top + 5 + (len - 1) * t), r: '1', fill: '#fff6ea', opacity: '0.9' })); }

  // 胴
  const mL = [], mR = [];
  const NM = 22;
  for (let i = 0; i <= NM; i++) {
    const t = i / NM;
    const y = top + len * t;
    const hw = hwAt(t);
    mL.push([-hw, y]);
    mR.push([hw, y]);
  }
  parts.push(svgEl('path', { d: smoothPath([...mL, [0, tail], ...mR.reverse()]), fill: C.ivory, stroke: C.navy, 'stroke-width': '3.2', 'stroke-linejoin': 'round' }));
  // コウイカ：尻の小さなとげ
  if (sh.spine) parts.push(svgEl('path', { d: `M-2.4,${f(tail - 5)} L0,${f(tail + 5)} L2.4,${f(tail - 5)} Z`, fill: '#f6ecd8', stroke: C.navy, 'stroke-width': '1.8', 'stroke-linejoin': 'round' }));
  // 胴の厚み：左上に明るい面、右に細い影
  const hiPts = mL.slice(2, NM - 3).map(([x, y]) => [x * 0.55 - W * 0.12, top + 4 + (y - top) * 0.9]);
  parts.push(svgEl('path', { d: smoothPath([...hiPts, [-W * 0.05, top + len * 0.88], ...hiPts.map(([x, y]) => [x * 0.35 + W * 0.05, y]).reverse()]), fill: C.hi ?? '#ffffff', opacity: '0.34' }));
  const shPts = mR.slice(3, NM - 2).map(([x, y]) => [x * 0.98, y]);
  parts.push(svgEl('path', { d: smoothPath([...shPts, ...shPts.map(([x, y]) => [x * 0.72, y]).reverse()]), fill: C.navy, opacity: '0.09' }));

  // 模様
  if (sh.stripe && C.mark) {   // スルメ・アカイカ：背中の真ん中の濃い帯（正体が分かったら）
    const sw = W * sh.stripe;
    parts.push(svgEl('path', { d: `M${f(-sw)},${top + 4} Q${f(-sw * 1.1)},${f(top + len * 0.55)} 0,${f(tail - 4)} Q${f(sw * 1.1)},${f(top + len * 0.55)} ${f(sw)},${top + 4} Z`, fill: C.mark, opacity: '0.85' }));
  }
  if (sh.midline) {   // アオリ：背筋の細い線と、両側の斑点の帯
    parts.push(svgEl('path', { d: `M0,${top + 7} Q${f(-W * 0.06)},${f(top + len * 0.5)} 0,${f(top + len - 3)}`, fill: 'none', stroke: C.navy, 'stroke-width': '1.2', 'stroke-linecap': 'round', opacity: '0.35' }));
    for (let i = 0; i < 26; i++) {
      const t = 0.08 + rnd() * 0.84;
      const x = (rnd() * 2 - 1) * hwAt(t) * 0.32;
      parts.push(svgEl('circle', { cx: f(x), cy: f(top + len * t), r: f(0.5 + rnd() * 0.8), fill: C.mark ?? C.navy, opacity: C.mark ? '0.4' : '0.16' }));
    }
  }
  if (sh.lines) {   // コウイカ・モンゴウ：背中の細かい横じま（少し波打つ）
    for (let i = 1; i <= 9; i++) {
      const t = 0.08 + i * 0.09;
      const hw = hwAt(t) * 0.8;
      const y = top + len * t;
      parts.push(svgEl('path', { d: `M${f(-hw)},${f(y)} Q${f(-hw * 0.5)},${f(y - 1.2)} 0,${f(y)} Q${f(hw * 0.5)},${f(y + 1.2)} ${f(hw)},${f(y)}`, fill: 'none', stroke: sh.beans ? C.navy : C.mark ?? C.navy, 'stroke-width': '1', 'stroke-linecap': 'round', opacity: sh.beans ? '0.22' : C.mark ? '0.75' : '0.18' }));
    }
  }
  if (sh.beans) {   // モンゴウ：横長の「コーヒー豆」（楕円＋まん中の筋）が散らばる＝見分けの決め手
    const bw = Math.max(2.4, W * 0.18), bh = bw * 0.5;
    for (const [fx, ty, a] of [[-0.45, 0.2, -8], [0.38, 0.28, 10], [-0.05, 0.4, 0], [-0.5, 0.55, 6], [0.42, 0.58, -6], [0.02, 0.72, 4], [-0.35, 0.84, 5], [0.3, 0.86, -4]]) {
      const x = fx * W, cy = top + len * ty;
      const g = svgEl('g', { transform: `rotate(${a} ${f(x)} ${f(cy)})`, opacity: '0.75' });
      g.append(
        svgEl('ellipse', { cx: f(x), cy: f(cy), rx: f(bw), ry: f(bh), fill: C.mark ?? 'none', stroke: C.navy, 'stroke-width': '1.3' }),
        svgEl('path', { d: `M${f(x - bw * 0.6)},${f(cy)} Q${f(x)},${f(cy + bh * 0.35)} ${f(x + bw * 0.6)},${f(cy)}`, fill: 'none', stroke: C.navy, 'stroke-width': '1', 'stroke-linecap': 'round' }),
      );
      parts.push(g);
    }
  }
  if (sh.whiteDots) {   // シリヤケ：白い丸い点がたくさん
    for (let i = 0; i < 34; i++) {
      const t = 0.06 + rnd() * 0.86;
      const x = (rnd() * 2 - 1) * hwAt(t) * 0.85;
      parts.push(svgEl('circle', { cx: f(x), cy: f(top + len * t), r: f(0.8 + rnd() * 0.8), fill: '#fff6ea', opacity: '0.85' }));
    }
  }
  if (sh.spots) {   // ヒイカ：細かい赤茶の点がびっしり
    for (let i = 0; i < 70; i++) {
      const t = 0.05 + rnd() * 0.9;
      parts.push(svgEl('circle', { cx: f((rnd() * 2 - 1) * hwAt(t) * 0.9), cy: f(top + len * t), r: f(0.45 + rnd() * 0.5), fill: C.mark ?? C.navy, opacity: C.mark ? '0.55' : '0.16' }));
    }
  }
  if (sh.tailMark) parts.push(svgEl('ellipse', { cx: '0', cy: f(tail - 8), rx: f(W * 0.45), ry: '6', fill: C.mark ?? '#b5532b', opacity: '0.8' }));
  if (sh.dashes) {   // 白い短い線と薄い点（皮のつぶつぶ）
    for (let i = 0; i < 22; i++) {
      const t = 0.1 + rnd() * 0.78;
      const x = (rnd() * 2 - 1) * hwAt(t) * 0.85;
      const y = top + len * t;
      if (i % 4 === 3) { parts.push(svgEl('circle', { cx: f(x), cy: f(y), r: f(0.6 + rnd() * 0.5), fill: C.mark ?? C.navy, opacity: C.mark ? '0.3' : '0.14' })); continue; }
      const L2 = 0.9 + rnd() * 1.3;
      const a = (rnd() - 0.5) * 0.9;
      parts.push(svgEl('path', { d: `M${f(x - Math.sin(a) * L2)},${f(y - Math.cos(a) * L2)} L${f(x + Math.sin(a) * L2)},${f(y + Math.cos(a) * L2)}`, stroke: '#ffffff', 'stroke-width': '1.1', 'stroke-linecap': 'round', opacity: '0.6' }));
    }
  } else {
    for (let i = 0; i < 12; i++) {   // ほかの種類：薄い点だけ
      const t = 0.1 + rnd() * 0.78;
      parts.push(svgEl('circle', { cx: f((rnd() * 2 - 1) * hwAt(t) * 0.8), cy: f(top + len * t), r: f(0.5 + rnd() * 0.6), fill: C.navy, opacity: '0.12' }));
    }
  }
  // 胴の口（頭とのつなぎ目）
  const mouth = hwAt(0.02);
  parts.push(svgEl('path', { d: `M${f(-mouth * 0.7)},${top + 1} Q0,${top + 4} ${f(mouth * 0.7)},${top + 1}`, fill: 'none', stroke: C.navy, 'stroke-width': '1.4', 'stroke-linecap': 'round', opacity: '0.6' }));

  // 頭：胴の口から前へ。コウイカの仲間は胴に比べて小さい
  const hw = sh.kind === 'cuttle' ? Math.min(10, W * 0.42) : Math.min(11, Math.max(6.5, W * 0.7));
  const neck = sh.kind === 'cuttle' ? mouth * 0.55 : mouth * 0.7;
  parts.push(svgEl('path', { d: `M${f(-neck)},${top + 2} C${f(-hw - 1)},${top - 4} ${f(-hw - 1)},${top - 12} ${f(-hw * 0.55)},${top - 16} Q0,${top - 19} ${f(hw * 0.55)},${top - 16} C${f(hw + 1)},${top - 12} ${f(hw + 1)},${top - 4} ${f(neck)},${top + 2} Z`, fill: C.ivory, stroke: C.navy, 'stroke-width': '3', 'stroke-linejoin': 'round' }));
  // 目：頭の両端の縦長の楕円、黒目は縁より一回り小さく（ぱっぱ 2026-09-29。キラキラは入れない）。ダイオウは大きい
  const er = Math.min(sh.bigEye ? 5 : 3.2, hw * (sh.bigEye ? 0.5 : 0.3));
  for (const s of [-1, 1]) {
    const ex = s * (hw * 0.92), ey = top - 7;
    parts.push(
      svgEl('ellipse', { cx: f(ex), cy: f(ey), rx: f(er * 0.62 + 0.8), ry: f(er * 1.35 + 0.8), fill: C.eye ?? '#cfd9d4', stroke: C.navy, 'stroke-width': '1.2' }),
      svgEl('ellipse', { cx: f(ex), cy: f(ey), rx: f(er * 0.42), ry: f(er * 1.0), fill: C.navy }),
    );
  }
  return parts;
}

const bodyScale = (len) => Math.min(1.8, Math.max(0.75, len / 56));
const bodyGroup = (parts, len) => { const g = svgEl('g', { class: 'ika-body' }); g.__len = len; g.append(...parts); return g; };

// 動き（毎フレーム呼ぶ）：ひれの波打ち・足の揺れ・胴の脈動。t＝秒、speed＝速さの倍率（逃げる・ファイトは速く）、
//   calm＝1 で静かに泳ぐ、0 で止まる。jet＝噴射からの経過が短いほど 1（横に縮んで縦に伸びる）。
//   第2版の絵（.ika-art-v2）だけに効き、第1版の絵には何もしない
export function animateSquid(node, t, { speed = 1, calm = 1, jet = 0 } = {}) {
  if (!node || !node.querySelector) return;
  const root = node.classList?.contains('ika-art-v2') ? node : node.querySelector('.ika-art-v2');
  if (!root) return;
  const fin = root.querySelector('.ika-fin');
  if (fin?.__fin) {
    const { sh, W, len, top } = fin.__fin;
    fin.setAttribute('d', finPath(sh, W, len, top, t * (3.2 * speed), calm));
  }
  // 足：根元を中心に小さく揺れる（1本ずつ位相を変える）。長い足ほど大きく
  const arms = root.querySelectorAll('.ika-arm-front, .ika-arm-back');
  arms.forEach((a, i) => {
    if (!a.__root) return;
    const [rx, ry] = a.__root;
    const side = rx < 0 ? -1 : 1;
    const deg = calm * (2.2 + a.__reach * 0.06) * Math.sin(t * (1.6 + (i % 3) * 0.35) * speed + i * 1.1) * side;
    a.setAttribute('transform', `rotate(${deg.toFixed(2)} ${rx} ${ry})`);
  });
  // 胴：ゆっくり呼吸のように膨らむ。ジェットの直後は横に縮んで縦に伸びる
  const body = root.querySelector('.ika-body');
  if (body) {
    const breathe = 1 + 0.02 * calm * Math.sin(t * 2.1 * speed);
    const sx = breathe * (1 - 0.1 * jet);
    const sy = (2 - breathe) * (1 + 0.06 * jet);
    body.setAttribute('transform', `translate(0 44) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(0 -44)`);
  }
}

// 足の配置。squid＝長い足が外へ広がる／cuttle＝足は短く太く、触腕は白く長い
function armSet(sh, pose, C) {
  const cut = sh.kind === 'cuttle';
  const tent = cut ? { color: '#f4efe6', w0: 1.8, w1: 0.8 } : { w0: 2.1, w1: 0.9 };
  const k = cut ? 0.72 : 1;   // 足の長さの倍率
  const P = (x, y) => [x * (cut ? 1.1 : 1), y];
  const scaleArm = (p0, p1, p2, kk = k) => ({ p0: P(...p0), p1: [P(...p1)[0], p0[1] + (p1[1] - p0[1]) * kk], p2: [P(...p2)[0], p0[1] + (p2[1] - p0[1]) * kk] });
  const kt = k * (sh.tentK ?? 1);   // 触腕の長さ
  if (pose === 'hug') {
    return {
      back: [
        taperedArm({ ...scaleArm([-9, 31], [-18, 12], [-6, -1]), ...tent, club: true, front: false }, C),
        taperedArm({ ...scaleArm([9, 31], [18, 12], [6, -1]), ...tent, club: true, front: false }, C),
        taperedArm({ ...scaleArm([-5, 32], [-14, 18], [-4, 4]), w0: 3.1, w1: 1.1, front: false }, C),
        taperedArm({ ...scaleArm([5, 32], [14, 18], [4, 4]), w0: 3.1, w1: 1.1, front: false }, C),
      ],
      front: [
        taperedArm({ ...scaleArm([-8, 30], [-11, 22], [-4, 13]), w0: 3.3, w1: 1.2 }, C),
        taperedArm({ ...scaleArm([8, 30], [11, 22], [4, 13]), w0: 3.3, w1: 1.2 }, C),
        taperedArm({ ...scaleArm([-3, 30], [-5, 25], [-1, 19]), w0: 2.4, w1: 0.9 }, C),
        taperedArm({ ...scaleArm([3, 30], [5, 25], [1.5, 20]), w0: 2.4, w1: 0.9 }, C),
      ],
    };
  }
  return {
    back: [
      taperedArm({ ...scaleArm([-4, 31], [-14, 12], [-12, -12], kt), ...tent, club: true, front: false }, C),
      taperedArm({ ...scaleArm([4, 31], [14, 12], [12, -12], kt), ...tent, club: true, front: false }, C),
      taperedArm({ ...scaleArm([-9, 30], [-17, 16], [-13, 2]), w0: 3.1, w1: 1.1, front: false }, C),
      taperedArm({ ...scaleArm([9, 30], [17, 16], [13, 2]), w0: 3.1, w1: 1.1, front: false }, C),
      taperedArm({ ...scaleArm([-3, 29], [-8, 12], [-6, -4]), w0: 3.1, w1: 1.1, front: false }, C),
      taperedArm({ ...scaleArm([3, 29], [8, 12], [6, -4]), w0: 3.1, w1: 1.1, front: false }, C),
    ],
    front: [
      taperedArm({ ...scaleArm([-7, 29], [-11, 18], [-9, 6]), w0: 3.3, w1: 1.2 }, C),
      taperedArm({ ...scaleArm([7, 29], [11, 18], [9, 6]), w0: 3.3, w1: 1.2 }, C),
      taperedArm({ ...scaleArm([-1.5, 30], [-3, 18], [-2.5, 6]), w0: 2.8, w1: 1.1 }, C),
      taperedArm({ ...scaleArm([1.5, 30], [3, 18], [2.5, 6]), w0: 2.8, w1: 1.1 }, C),
    ],
  };
}

// エギを抱いたイカ（足がエギを包み、胴が下）。座標は squid-art.js の huggingSquid と同じ
export function huggingSquid({ species = 'default', len = 56, colors = ART } = {}) {
  const C = colors;
  const sh = shapeOf(species);
  const k = bodyScale(len);
  const g = svgEl('g', { class: 'ika-art-hug ika-art-v2' });
  const back = svgEl('g', { transform: `scale(${k.toFixed(3)})` });
  const front = svgEl('g', { transform: `scale(${k.toFixed(3)})` });
  const arms = armSet(sh, 'hug', C);
  back.append(...arms.back);
  front.append(bodyGroup(speciesBody({ species, len: len / k, colors: C, seed: 7 }), len / k), ...arms.front);
  g.append(back, egiShape(), front);
  return g;
}

// 泳いでいるイカ（エギ無し）。足は前（-y）へそろえて、少し開く
export function swimmingSquid({ species = 'default', len = 56, colors = ART } = {}) {
  const C = colors;
  const sh = shapeOf(species);
  const k = bodyScale(len);
  const g = svgEl('g', { class: 'ika-art-swim ika-art-v2', transform: `scale(${k.toFixed(3)})` });
  len /= k;
  const arms = armSet(sh, 'swim', C);
  g.append(...arms.back, bodyGroup(speciesBody({ species, len, colors: C, seed: 11 }), len), ...arms.front);
  return g;
}

export { BODY };

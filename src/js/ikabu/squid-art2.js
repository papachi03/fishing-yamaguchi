// イカの絵・第2版（2026-09-29、ぱっぱ「単調な図形で作られていて、ひんそに見える」）。
// 楕円と一定の太さの線でなく、生き物として描く：肩がふくらむ胴、波打つ薄い膜のひれ、根元が太く先が細い足（吸盤つき）、
// 先が広がる2本の触腕、虹彩と光のある目、線の強弱、皮の色素の点。絵柄（アイボリー＋紺）と座標の決まりは squid-art.js と同じ。
//   原点＝糸の結び目（エギの頭）、+y が下。足がエギの側（上）、胴は下（y=44 から len）。
// まずアオリイカだけ。ほかの種類は squid-art.js の形に戻す（比べて OK が出てから広げる）
import { svgEl, ART, egiShape, BODY, huggingSquid as huggingSquid1, swimmingSquid as swimmingSquid1 } from './squid-art.js';

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
function taperedArm({ p0, p1, p2, w0 = 2.4, w1 = 0.7, suckers = true, club = false, front = true }, C) {
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
  g.append(svgEl('path', { d: smoothPath(pts), fill: C.arm ?? C.ivory, stroke: C.navy, 'stroke-width': '1.7', 'stroke-linejoin': 'round' }));
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
    g.append(svgEl('ellipse', { cx: f(tip[0] + tx * 2.2), cy: f(tip[1] + ty * 2.2), rx: '4.2', ry: '2.1', transform: `rotate(${f(ang)} ${f(tip[0] + tx * 2.2)} ${f(tip[1] + ty * 2.2)})`, fill: C.arm ?? C.ivory, stroke: C.navy, 'stroke-width': '1.5' }));
    for (const s of [-1, 1]) g.append(svgEl('circle', { cx: f(tip[0] + tx * 2.2 + ty * s * 0.9), cy: f(tip[1] + ty * 2.2 - tx * s * 0.9), r: '0.6', fill: C.navy, opacity: '0.6' }));
  }
  return g;
}

// アオリイカの頭と胴（足は別）。len＝胴長、W＝肩の半幅
// 胴の半幅：肩は前寄り（t≈0.3）で、先はとがる涙の形
const mantleHW = (W, t) => W * Math.sin(Math.PI * (0.12 + 0.88 * t) * 0.92) ** 0.75 * (1 - 0.35 * t ** 2);
// ひれの道。phase＝波の位相（進めると波が前から後ろへ流れる）、amp＝波の高さの倍率（0 で止まったひれ）
function finPath(W, len, top, phase = 0, amp = 1) {
  const finL = [], finR = [];
  const NF = 28;
  const wave = (W * 0.13 + 0.6) * amp;
  for (let i = 0; i <= NF; i++) {
    const t = i / NF;
    const y = top + 5 + (len - 1) * t;
    const body = mantleHW(W, t);
    const edge = i === 0 || i === NF ? 0 : 1;
    const extra = (W * 0.75 + 3) * Math.sin(Math.PI * t ** 0.9) ** 1.1 * (1 - t) ** 0.25;
    // 左右で位相をずらすと、本物のように互い違いにうねる
    finL.push([-(body + extra + edge * wave * Math.sin(2 * Math.PI * 2.2 * t - phase)), y]);
    finR.push([body + extra + edge * wave * Math.sin(2 * Math.PI * 2.2 * t - phase + 1.2), y]);
  }
  return smoothPath([...finL, [0, top + len + 2], ...finR.reverse()]);
}

function aoriBody({ len = 56, colors: C = ART, seed = 7 }) {
  const top = 44;
  const W = Math.max(6, len * 0.3);
  const parts = [];
  const rnd = lcg(seed);

  // ひれ：胴を包む薄い膜。真ん中で最も広く、縁は波打つ。波は前から後ろへ流れる（animateSquid が phase を進める）
  const fin = svgEl('path', { class: 'ika-fin', d: finPath(W, len, top, 0, 0), fill: C.fin ?? C.ivory, stroke: C.navy, 'stroke-width': '2.2', 'stroke-linejoin': 'round', opacity: '0.96' });
  fin.__fin = { W, len, top };
  parts.push(fin);
  // ひれの筋（薄い放射の線）：膜の張りを出す
  const NF = 28;
  for (let i = 4; i < NF - 3; i += 4) {
    const t = i / NF;
    const y = top + 5 + (len - 1) * t;
    const body = mantleHW(W, t);
    const extra = (W * 0.75 + 3) * Math.sin(Math.PI * t ** 0.9) ** 1.1 * (1 - t) ** 0.25;
    for (const s of [-1, 1]) parts.push(svgEl('path', { d: `M${f(s * body * 0.95)},${f(y - 1)} Q${f(s * (body + extra * 0.5))},${f(y + 1)} ${f(s * (body + extra * 0.88))},${f(y + 3)}`, fill: 'none', stroke: C.navy, 'stroke-width': '0.7', 'stroke-linecap': 'round', opacity: '0.16' }));
  }

  // 胴：肩がふくらみ、先が締まる
  const mL = [], mR = [];
  const NM = 22;
  for (let i = 0; i <= NM; i++) {
    const t = i / NM;
    const y = top + len * t;
    const hw = mantleHW(W, t);
    mL.push([-hw, y]);
    mR.push([hw, y]);
  }
  const mantle = smoothPath([...mL, [0, top + len + 2], ...mR.reverse()]);
  parts.push(svgEl('path', { d: mantle, fill: C.ivory, stroke: C.navy, 'stroke-width': '3.2', 'stroke-linejoin': 'round' }));
  // 胴の厚み：左上に明るい面、右に細い影
  const hiPts = mL.slice(2, NM - 3).map(([x, y]) => [x * 0.55 - W * 0.12, top + 4 + (y - top) * 0.9]);
  const hiPath = smoothPath([...hiPts, [-W * 0.05, top + len * 0.88], ...hiPts.map(([x, y]) => [x * 0.35 + W * 0.05, y]).reverse()]);
  parts.push(svgEl('path', { d: hiPath, fill: C.hi ?? '#ffffff', opacity: '0.34' }));
  const shPts = mR.slice(3, NM - 2).map(([x, y]) => [x * 0.98, y]);
  parts.push(svgEl('path', { d: smoothPath([...shPts, ...shPts.map(([x, y]) => [x * 0.72, y]).reverse()]), fill: C.navy, opacity: '0.09' }));
  // 皮の色素の点（つぶつぶ）。正体が分かったら模様の色を少し混ぜる
  // 背筋：真ん中の細い線と、その両側に斑点の帯（写真：背筋に沿って茶色のまだら）
  parts.push(svgEl('path', { d: `M0,${top + 7} Q${f(-W * 0.06)},${f(top + len * 0.5)} 0,${f(top + len - 3)}`, fill: 'none', stroke: C.navy, 'stroke-width': '1.2', 'stroke-linecap': 'round', opacity: '0.35' }));
  for (let i = 0; i < 26; i++) {
    const t = 0.08 + rnd() * 0.84;
    const hw = mantleHW(W, t);
    const x = (rnd() * 2 - 1) * hw * 0.32;
    parts.push(svgEl('circle', { cx: f(x), cy: f(top + len * t), r: f(0.5 + rnd() * 0.8), fill: C.mark ?? C.navy, opacity: C.mark ? '0.4' : '0.16' }));
  }
  for (let i = 0; i < 22; i++) {
    const t = 0.1 + rnd() * 0.78;
    const hw = mantleHW(W, t) * 0.85;
    const x = (rnd() * 2 - 1) * hw;
    const y = top + len * t;
    if (i % 4 === 3) { parts.push(svgEl('circle', { cx: f(x), cy: f(y), r: f(0.6 + rnd() * 0.5), fill: C.mark ?? C.navy, opacity: C.mark ? '0.3' : '0.14' })); continue; }
    const L2 = 0.9 + rnd() * 1.3;
    const a = (rnd() - 0.5) * 0.9;   // 体の向きにほぼ沿った短い線
    parts.push(svgEl('path', { d: `M${f(x - Math.sin(a) * L2)},${f(y - Math.cos(a) * L2)} L${f(x + Math.sin(a) * L2)},${f(y + Math.cos(a) * L2)}`, stroke: '#ffffff', 'stroke-width': '1.1', 'stroke-linecap': 'round', opacity: '0.6' }));
  }
  // 胴の口（頭とのつなぎ目）：細い線
  parts.push(svgEl('path', { d: `M${f(-W * 0.5)},${top + 1} Q0,${top + 4} ${f(W * 0.5)},${top + 1}`, fill: 'none', stroke: C.navy, 'stroke-width': '1.4', 'stroke-linecap': 'round', opacity: '0.6' }));

  // 頭：胴の口から前へ、目の張り出し
  const hw = Math.min(11, W * 0.7);
  const head = `M${f(-W * 0.48)},${top + 2} C${f(-hw - 1)},${top - 4} ${f(-hw - 1)},${top - 12} ${f(-hw * 0.55)},${top - 16} Q0,${top - 19} ${f(hw * 0.55)},${top - 16} C${f(hw + 1)},${top - 12} ${f(hw + 1)},${top - 4} ${f(W * 0.48)},${top + 2} Z`;
  parts.push(svgEl('path', { d: head, fill: C.ivory, stroke: C.navy, 'stroke-width': '3', 'stroke-linejoin': 'round' }));
  // 目：大きな目に、虹彩・光・まぶたのくぼみ
  // 目：上から見た本物（ぱっぱの写真 2026-09-29）は、頭の両端に小さな黒い粒として見えるだけ。
  // 大きな丸い目にせず、頭の縁から少しはみ出す黒い粒＋薄い銀色の縁にする
  const er = Math.min(3.2, hw * 0.3);
  for (const s of [-1, 1]) {
    const ex = s * (hw * 0.92), ey = top - 7;
    parts.push(
      svgEl('circle', { cx: f(ex), cy: f(ey), r: f(er + 0.9), fill: C.eye ?? '#cfd9d4', stroke: C.navy, 'stroke-width': '1.2' }),
      svgEl('circle', { cx: f(ex), cy: f(ey), r: f(er), fill: C.navy }),
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
    const { W, len, top } = fin.__fin;
    fin.setAttribute('d', finPath(W, len, top, t * (3.2 * speed), calm));
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

// エギを抱いたアオリイカ（足がエギを包み、胴が下）。座標は squid-art.js の huggingSquid と同じ
export function huggingSquid({ species = 'default', len = 56, colors = ART } = {}) {
  if (species !== 'aori' && species !== 'default') return huggingSquid1({ species, len, colors });
  const C = colors;
  const k = bodyScale(len);
  const g = svgEl('g', { class: 'ika-art-hug ika-art-v2' });
  const back = svgEl('g', { transform: `scale(${k.toFixed(3)})` });
  const front = svgEl('g', { transform: `scale(${k.toFixed(3)})` });
  back.append(
    // 奥：2本の触腕がエギの頭まで回り込む。奥の足2本
    taperedArm({ p0: [-9, 31], p1: [-18, 12], p2: [-6, -1], w0: 2.1, w1: 0.9, club: true, front: false }, C),
    taperedArm({ p0: [9, 31], p1: [18, 12], p2: [6, -1], w0: 2.1, w1: 0.9, club: true, front: false }, C),
    taperedArm({ p0: [-5, 32], p1: [-14, 18], p2: [-4, 4], w0: 3.1, w1: 1.1, front: false }, C),
    taperedArm({ p0: [5, 32], p1: [14, 18], p2: [4, 4], w0: 3.1, w1: 1.1, front: false }, C),
  );
  front.append(
    bodyGroup(aoriBody({ len: len / k, colors: C, seed: 7 }), len / k),
    // 手前：4本の足がエギを抱えこむ
    taperedArm({ p0: [-8, 30], p1: [-11, 22], p2: [-4, 13], w0: 3.3, w1: 1.2 }, C),
    taperedArm({ p0: [8, 30], p1: [11, 22], p2: [4, 13], w0: 3.3, w1: 1.2 }, C),
    taperedArm({ p0: [-3, 30], p1: [-5, 25], p2: [-1, 19], w0: 2.4, w1: 0.9 }, C),
    taperedArm({ p0: [3, 30], p1: [5, 25], p2: [1.5, 20], w0: 2.4, w1: 0.9 }, C),
  );
  g.append(back, egiShape(), front);
  return g;
}

// 泳いでいるアオリイカ（エギ無し）。足は前（-y）へそろえて、少し開く
export function swimmingSquid({ species = 'default', len = 56, colors = ART } = {}) {
  if (species !== 'aori' && species !== 'default') return swimmingSquid1({ species, len, colors });
  const C = colors;
  const k = bodyScale(len);
  const g = svgEl('g', { class: 'ika-art-swim ika-art-v2', transform: `scale(${k.toFixed(3)})` });
  len /= k;
  g.append(
    // 触腕2本：長く、先に広いへら
    taperedArm({ p0: [-4, 31], p1: [-14, 12], p2: [-12, -12], w0: 2.1, w1: 0.9, club: true, front: false }, C),
    taperedArm({ p0: [4, 31], p1: [14, 12], p2: [12, -12], w0: 2.1, w1: 0.9, club: true, front: false }, C),
    // 奥の足4本：外へ広がって先がくるっと曲がる
    taperedArm({ p0: [-9, 30], p1: [-17, 16], p2: [-13, 2], w0: 3.1, w1: 1.1, front: false }, C),
    taperedArm({ p0: [9, 30], p1: [17, 16], p2: [13, 2], w0: 3.1, w1: 1.1, front: false }, C),
    taperedArm({ p0: [-3, 29], p1: [-8, 12], p2: [-6, -4], w0: 3.1, w1: 1.1, front: false }, C),
    taperedArm({ p0: [3, 29], p1: [8, 12], p2: [6, -4], w0: 3.1, w1: 1.1, front: false }, C),
    bodyGroup(aoriBody({ len, colors: C, seed: 11 }), len),
    // 手前の足4本
    taperedArm({ p0: [-7, 29], p1: [-11, 18], p2: [-9, 6], w0: 3.3, w1: 1.2 }, C),
    taperedArm({ p0: [7, 29], p1: [11, 18], p2: [9, 6], w0: 3.3, w1: 1.2 }, C),
    taperedArm({ p0: [-1.5, 30], p1: [-3, 18], p2: [-2.5, 6], w0: 2.8, w1: 1.1 }, C),
    taperedArm({ p0: [1.5, 30], p1: [3, 18], p2: [2.5, 6], w0: 2.8, w1: 1.1 }, C),
  );
  return g;
}

export { BODY };

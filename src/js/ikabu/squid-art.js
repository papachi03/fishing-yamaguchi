// イカとエギの絵（SVG の DOM 要素）。HERO（hero-anim.js）とあそび場のエギングゲーム（games/egi-ui.js）で共有する。
// 平らなイラストの流儀：アイボリーの体に紺の太い縁、エギは朱。
//
// 向きの決まり：原点は「糸の結び目（エギの頭）」で、+y が下。
//   イカはエギを足（ゲソ）で抱くので、足がエギの側（上）、胴は下に垂れる。
//   泳いでいる姿は同じ部品を rotate() で回して使う（胴の先が進行方向＝ジェット噴射で後ろ向きに走る）。
const SVG_NS = 'http://www.w3.org/2000/svg';
export const svgEl = (name, attrs = {}) => {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export const ART = { navy: '#182c47', ivory: '#f4ead8', egi: '#f47321', egiLine: '#16233a', egiStripe: '#ffd2a8' };

// エギ：オレンジの胴に紺の縁、目、背中の布の筋、尻のカンナ。原点は糸の結び目で、+y 方向に伸びる（長さ ≈ 36）
export function egiShape() {
  const g = svgEl('g', { class: 'ika-art-egi' });
  g.append(
    svgEl('path', { d: 'M0,-2 Q7,4 6,16 Q5,26 0,30 Q-5,26 -6,16 Q-7,4 0,-2 Z', fill: ART.egi, stroke: ART.egiLine, 'stroke-width': '3', 'stroke-linejoin': 'round' }),
    svgEl('path', { d: 'M-3,8 L3,8 M-4,15 L4,15 M-3,22 L3,22', stroke: ART.egiStripe, 'stroke-width': '1.6', 'stroke-linecap': 'round' }),
    svgEl('circle', { cx: '0', cy: '3.5', r: '1.8', fill: ART.egiLine }),
    svgEl('path', { d: 'M-4,30 L-6,35 M0,31 L0,36 M4,30 L6,35', stroke: ART.egiLine, 'stroke-width': '1.6', 'stroke-linecap': 'round' }),
  );
  return g;
}

// 足1本：紺の太線の上にアイボリーの細線を重ねて、縁取りのある足にする
function arm(d, front, C, sw = 1) {
  const g = svgEl('g', { class: front ? 'ika-arm-front' : 'ika-arm-back' });
  g.append(
    svgEl('path', { d, fill: 'none', stroke: C.navy, 'stroke-width': String(7 * sw), 'stroke-linecap': 'round' }),
    svgEl('path', { d, fill: 'none', stroke: C.arm ?? C.ivory, 'stroke-width': String(3.6 * sw), 'stroke-linecap': 'round' }),
  );
  return g;
}

// 種類ごとの体つき（胴の縦横比・ヒレの形）。len は胴長（描画単位）、ratio は 半幅/胴長
//   squid   … 細長い胴。ヒレは後ろ半分の菱形（ケンサキ・ヤリ）か胴の全長に沿う楕円（アオリ）
//   cuttle  … 丸い胴。ヒレは胴のまわりを一周する薄いスカート（コウイカ・モンゴウ・シリヤケ）
export const BODY = {
  aori: { kind: 'squid', ratio: 0.36, fin: 'oval' },
  kensaki: { kind: 'squid', ratio: 0.2, fin: 'rhombus', finFrom: 0.5 },
  yari: { kind: 'squid', ratio: 0.18, fin: 'rhombus', finFrom: 0.42 },
  surume: { kind: 'squid', ratio: 0.2, fin: 'rhombus', finFrom: 0.62, stripe: 0.3 },
  sodeika: { kind: 'squid', ratio: 0.3, fin: 'rhombus', finFrom: 0.0 },
  akaika: { kind: 'squid', ratio: 0.22, fin: 'rhombus', finFrom: 0.7, stripe: 0.45 },
  daiou: { kind: 'squid', ratio: 0.2, fin: 'round', bigEye: true },
  hiika: { kind: 'squid', ratio: 0.34, fin: 'round' },
  kouika: { kind: 'cuttle', ratio: 0.5, fin: 'skirt', spine: true, lines: true },
  mongo: { kind: 'cuttle', ratio: 0.52, fin: 'skirt', spots: true },
  shiriyake: { kind: 'cuttle', ratio: 0.48, fin: 'skirt', tailMark: true, finDots: true },
  default: { kind: 'squid', ratio: 0.22, fin: 'rhombus', finFrom: 0.55 },
};

// 種ごとの色（図鑑のイラストに合わせた色）。釣り上げて正体が分かったときだけ使う。
//   ivory＝胴と頭、fin＝ヒレ、arm＝足、mark＝模様、hi＝目の光
const HI = '#ffffff';
export const SPECIES_COLORS = {
  aori: { ivory: '#efd8b4', fin: '#f3e4c8', arm: '#f2dcbc', mark: '#a0612e', hi: HI },
  kouika: { ivory: '#b88450', fin: '#dcc298', arm: '#e6cba2', mark: '#f6e7cc', hi: HI },
  mongo: { ivory: '#b07a44', fin: '#dbbb88', arm: '#e3c69a', mark: '#4f2b12', hi: HI },
  shiriyake: { ivory: '#c9683a', fin: '#e2a272', arm: '#edc4a0', mark: '#3e1e0e', hi: HI },
  kensaki: { ivory: '#ea7458', fin: '#f4ab96', arm: '#f2bcac', hi: HI },
  yari: { ivory: '#f0c3aa', fin: '#f6d6c4', arm: '#f5d3c2', hi: HI },
  surume: { ivory: '#c96a40', fin: '#dc946c', arm: '#eab99c', mark: '#4e2410', hi: HI },
  sodeika: { ivory: '#d8332d', fin: '#e4493e', arm: '#f18a7a', hi: HI },
  akaika: { ivory: '#c2314f', fin: '#d4546c', arm: '#ea92a2', mark: '#35102c', hi: HI },
  daiou: { ivory: '#cf623f', fin: '#d97c5a', arm: '#e9a283', hi: HI },
};
export const speciesColors = (species) => ({ ...ART, ...(SPECIES_COLORS[species] ?? {}) });

// 頭と胴（足は別）。y=36 に頭の付け根、胴は y=44 から len だけ下へ
function bodyParts(opts, C) {
  const b = BODY[opts.species] ?? BODY.default;
  const len = Math.max(24, opts.len ?? 56);
  const W = Math.max(6, len * b.ratio);
  const top = 44;
  const tail = top + len;
  const parts = [];
  // ヒレ（胴の後ろに置く）
  if (b.fin === 'oval') {
    parts.push(svgEl('ellipse', { cx: '0', cy: String(top + len * 0.55), rx: String(W + 7), ry: String(len * 0.47), fill: C.fin ?? C.ivory, stroke: C.navy, 'stroke-width': '3.4' }));
  } else if (b.fin === 'rhombus') {
    const y0 = top + len * (b.finFrom ?? 0.5);
    const fw = W + Math.max(6, len * 0.16);
    parts.push(svgEl('path', { d: `M0,${y0} L${fw},${(y0 + tail) / 2 + len * 0.08} L0,${tail + 3} L${-fw},${(y0 + tail) / 2 + len * 0.08} Z`, fill: C.fin ?? C.ivory, stroke: C.navy, 'stroke-width': '3.4', 'stroke-linejoin': 'round' }));
  } else if (b.fin === 'round') {
    parts.push(svgEl('ellipse', { cx: '0', cy: String(tail - len * 0.2), rx: String(W + 6), ry: String(len * 0.26), fill: C.fin ?? C.ivory, stroke: C.navy, 'stroke-width': '3' }));
  } else {
    parts.push(svgEl('ellipse', { cx: '0', cy: String(top + len * 0.5), rx: String(W + 5), ry: String(len * 0.5 + 3), fill: C.fin ?? C.ivory, stroke: C.navy, 'stroke-width': '3.4' }));
  }
  if (b.spine) parts.push(svgEl('path', { d: `M-2.6,${tail - 4} L0,${tail + 8} L2.6,${tail - 4} Z`, fill: '#f6ecd8', stroke: C.navy, 'stroke-width': '2', 'stroke-linejoin': 'round' }));
  // 胴
  const mantle = b.kind === 'cuttle'
    ? `M${-W},${top + 6} Q${-W - 2},${top + len * 0.6} 0,${tail} Q${W + 2},${top + len * 0.6} ${W},${top + 6} Q0,${top - 4} ${-W},${top + 6} Z`
    : `M${-W},${top} Q${-W - 3},${top + len * 0.5} 0,${tail} Q${W + 3},${top + len * 0.5} ${W},${top} Z`;
  parts.push(svgEl('path', { d: mantle, fill: C.ivory, stroke: C.navy, 'stroke-width': '3.6', 'stroke-linejoin': 'round' }));
  // 模様：胴の筋（squid）／コーヒー豆の模様（モンゴウ）／焼けた尻（シリヤケ）
  if (b.kind === 'squid') parts.push(svgEl('path', { d: `M${-W * 0.4},${top + 8} Q${-W * 0.5},${top + len * 0.5} ${-W * 0.1},${tail - 12}`, fill: 'none', stroke: C.navy, 'stroke-width': '2', 'stroke-linecap': 'round', opacity: '0.55' }));
  // 背中の真ん中の帯（スルメ＝こげ茶、アカイカ＝黒紫）。色が付いているとき（正体が分かった後）だけ
  if (b.stripe && C.mark) {
    const sw = W * b.stripe;
    parts.push(svgEl('path', { d: `M${-sw},${top + 4} Q${-sw * 1.1},${top + len * 0.55} 0,${tail - 4} Q${sw * 1.1},${top + len * 0.55} ${sw},${top + 4} Z`, fill: C.mark, opacity: '0.85' }));
  }
  // コウイカ：背中の細い横じま
  if (b.lines && C.mark) {
    for (let i = 1; i <= 6; i++) {
      const y = top + len * (0.1 + i * 0.12);
      const hw = W * Math.sin(Math.PI * Math.min(0.95, (y - top) / len * 0.9 + 0.1)) * 0.75;
      parts.push(svgEl('path', { d: `M${-hw},${y} L${hw},${y}`, stroke: C.mark, 'stroke-width': '1.3', 'stroke-linecap': 'round', opacity: '0.9' }));
    }
  }
  // シリヤケ：ヒレのつけ根に沿って白い点
  if (b.finDots) {
    for (const f of [0.25, 0.45, 0.65, 0.82]) {
      const y = top + len * f;
      const hw = W * (f < 0.5 ? 0.98 : 1 - (f - 0.5) * 1.1);
      for (const sx of [-1, 1]) parts.push(svgEl('circle', { cx: String(sx * (hw - 2)), cy: String(y), r: '1.3', fill: '#fff6ea' }));
    }
  }
  // モンゴウは胴に横長の「コーヒー豆」形（楕円＋まん中の筋）が散らばるのが見分けの決め手（ダディ指摘 2026-09-25）
  if (b.spots) {
    const bw = Math.max(2.4, W * 0.2), bh = bw * 0.55;
    for (const [x, y, a] of [[-W * 0.45, 0.24, -8], [W * 0.38, 0.32, 10], [-W * 0.05, 0.45, 0], [-W * 0.5, 0.6, 6], [W * 0.42, 0.62, -6], [W * 0.02, 0.78, 4]]) {
      const cy = top + len * y;
      const g = svgEl('g', { transform: `rotate(${a} ${x} ${cy})`, opacity: '0.7' });
      g.append(
        svgEl('ellipse', { cx: String(x), cy: String(cy), rx: String(bw), ry: String(bh), fill: C.mark ?? 'none', stroke: C.navy, 'stroke-width': '1.4' }),
        svgEl('path', { d: `M${x - bw * 0.6},${cy} Q${x},${cy + bh * 0.35} ${x + bw * 0.6},${cy}`, fill: 'none', stroke: C.navy, 'stroke-width': '1.1', 'stroke-linecap': 'round' }),
      );
      parts.push(g);
    }
  }
  if (b.tailMark) parts.push(svgEl('ellipse', { cx: '0', cy: String(tail - 7), rx: String(W * 0.5), ry: '6', fill: C.mark ?? '#b5532b', opacity: '0.8' }));
  // 頭と目（足の付け根）
  const hr = Math.min(12, W + 2);
  parts.push(
    svgEl('ellipse', { cx: '0', cy: '41', rx: String(hr), ry: '8.5', fill: C.ivory, stroke: C.navy, 'stroke-width': '3.6' }),
    ...(b.bigEye ? [-1, 1].map((sx) => svgEl('circle', { cx: String(sx * hr * 0.46), cy: '41', r: '5', fill: '#fff6ea', stroke: C.navy, 'stroke-width': '1.6' })) : []),
    svgEl('circle', { cx: String(-hr * 0.46), cy: '41', r: b.bigEye ? '3.4' : '2.8', fill: C.navy }),
    svgEl('circle', { cx: String(hr * 0.46), cy: '41', r: b.bigEye ? '3.4' : '2.8', fill: C.navy }),
    svgEl('circle', { cx: String(-hr * 0.46 + 0.8), cy: '40.2', r: '0.9', fill: C.hi ?? C.ivory }),
    svgEl('circle', { cx: String(hr * 0.46 + 0.8), cy: '40.2', r: '0.9', fill: C.hi ?? C.ivory }),
  );
  return parts;
}

// エギを抱いたイカ（足がエギを包み、胴が下）。HERO の「釣れたイカ」と同じ組み立て。
//   species: BODY のキー（省略時は HERO と同じ形）、len: 胴長（描画単位）
// 大きなイカは足も頭も大きい：胴長 56 を基準に全体を k 倍し、エギだけ実寸のまま置く
const bodyScale = (len) => Math.min(1.8, Math.max(0.75, len / 56));

export function huggingSquid({ species = 'default', len = 56, colors = ART } = {}) {
  const C = colors;
  const k = bodyScale(len);
  const g = svgEl('g', { class: 'ika-art-hug' });
  const back = svgEl('g', { transform: `scale(${k.toFixed(3)})` });
  const front = svgEl('g', { transform: `scale(${k.toFixed(3)})` });
  back.append(
    // 奥の足と、エギに巻きついた2本の長い触腕
    arm('M-10,36 Q-16,20 -8,8', false, C),
    arm('M10,36 Q16,20 8,8', false, C),
    arm('M-5,36 Q-14,16 -2,2', false, C),
    arm('M5,36 Q14,16 2,2', false, C),
  );
  front.append(
    // 手前の足（エギを抱えこむ）
    arm('M-7,37 Q-9,24 -3,16', true, C),
    arm('M7,37 Q9,24 3,16', true, C),
    arm('M-2,38 Q-3,28 1,20', true, C),
    ...bodyParts({ species, len: len / k }, C),
  );
  g.append(back, egiShape(), front);
  return g;
}

// 泳いでいるイカ（エギ無し）。足は前（-y）へそろえて伸ばす。抱く前の「気になっている」姿
export function swimmingSquid({ species = 'default', len = 56, colors = ART } = {}) {
  const C = colors;
  const k = bodyScale(len);
  const g = svgEl('g', { class: 'ika-art-swim', transform: `scale(${k.toFixed(3)})` });
  len /= k;
  g.append(
    arm('M-9,36 Q-12,22 -7,12', false, C),
    arm('M9,36 Q12,22 7,12', false, C),
    arm('M-4,36 Q-6,18 -3,6', false, C),
    arm('M4,36 Q6,18 3,6', false, C),
    arm('M-6,37 Q-7,26 -4,17', true, C),
    arm('M6,37 Q7,26 4,17', true, C),
    arm('M0,38 Q0,26 0,10', true, C),
    ...bodyParts({ species, len }, C),
  );
  return g;
}

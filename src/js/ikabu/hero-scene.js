// イカ部トップ HERO の「夜の海」シーン：座標の決まりと形の計算と、ビルド時にも使う静止 SVG。
// DOM・window には触らない（views/index.js から呼ばれ、prerender-ikabu が node で実行するため）。
// 動かすのは hero-anim.js（ここで作った SVG の要素を class で探して属性を書き換える）。
//
// 座標系：元イラスト hero_original.png（1536×1024）のピクセルをそのまま「世界座標」にする。
//   bg.webp は (0,0)-(1536,1024) に置き、その外側は空のグラデーションと海の帯で無限に延ばす。
//   画面には worldRight を右端として、縦横比に合わせた範囲（viewBox）を切り出す。
//   →「世界」を広くしたので、超ワイド画面でも黒帯や引き伸ばしが出ない。
import { t } from './i18n.js';

/* ------------------------------------------------------------------
   調整する数字はここだけ（単位：世界座標＝元イラストのピクセル）
   ------------------------------------------------------------------ */
export const HERO_ANIM = {
  // レイヤー画像（サイトのルート基準。画面に出すときは assetHref を通す）
  layers: {
    bg: '/assets/ikabu/hero-layers/bg.webp',       // 3:2 空＋山＋海（太陽・竿・イカ・堤防なし）
    pier: '/assets/ikabu/hero-layers/pier.png',    // 堤防＋係船柱＋クーラー（透過PNG、key-magenta.py --trim --pad 2）
    squid: '/assets/ikabu/hero-layers/squid.png',  // イカ＋竿の握り＋リール（透過PNG、同上）
  },
  still: '/assets/ikabu/hero_1600.webp',           // レイヤーが読めなかったときに右側へ敷く静止画

  bgBox: { x: 0, y: 0, w: 1536, h: 1024 },
  // squid.png（888×991）：ChatGPT の 1254 の画像を 0.66 倍・(-8,+2) ずらしで置くと元の絵と合う
  squidBox: { x: 106, y: 71, w: 586, h: 654 },
  pierBox: { x: 0, y: 583, w: 891, h: 353 },
  squidSeat: { x: 400, y: 710 },     // 呼吸とひねりの支点（堤防に座っている点）

  // 竿：描かれた握りの切れ端（squid.png の 1254 座標で (935,758)、約49°右上向き）の 6px 内側から描く
  rodGrip: { x: 605, y: 506 },
  rodTipRest: { x: 1228, y: 187 },
  rodBend: { x: 880, y: 189 },       // grip→bend の向き＝竿の出だし（49°、切れ端と同じ）
  rodGuides: [0.37, 0.65, 1],
  rodWidth: { grip: 16, tip: 5 },
  rodOutline: 10,
  hookPull: 0.34,

  lineWater: { x: 1305, y: 862 },
  restRipple: { rx: 58, ry: 22 },

  sunCenter: { x: 578, y: 395 },
  sunR: 190,
  horizonY: 620,
  shimmer: [
    { x: 790, y: 632, rx: 54, ry: 4 },
    { x: 830, y: 654, rx: 40, ry: 4 },
    { x: 780, y: 676, rx: 62, ry: 5 },
    { x: 845, y: 700, rx: 34, ry: 4 },
    { x: 800, y: 726, rx: 48, ry: 5 },
    { x: 1180, y: 640, rx: 70, ry: 4 },
    { x: 1120, y: 668, rx: 46, ry: 4 },
    { x: 1240, y: 700, rx: 60, ry: 5 },
  ],
  // 波の線：世界の左端から右端まで（堤防の手前は堤防が上に載るので隠れる）
  waves: [
    { y: 690, len: 260, amp: 4, speed: 0.55 },
    { y: 762, len: 300, amp: 5, speed: 0.42 },
    { y: 838, len: 240, amp: 4, speed: 0.6 },
    { y: 932, len: 320, amp: 5, speed: 0.38 },
    { y: 1040, len: 360, amp: 5, speed: 0.33 },
  ],

  // 画面に切り出す範囲
  world: {
    right: 1400,          // 右端（bg の右 136px は切る＝糸が右端の近くに落ちる）
    left: -6000,          // 空と海をここまで延ばす
    top: -4000,
    bottom: 4000,
    bgFade: 320,          // bg.webp の左端と下端をこの幅でグラデーションに溶かす
  },
  view: {
    // PC：縦に 1300 世界px を見せ（イカ≈高さの 50%）、水平線を高さの 60% に置く
    //   textMargin：堤防の左端と文字の列のあいだに空ける世界px。horizonFracNarrow：幅 1366px 以下
    desktop: { height: 1300, horizonFrac: 0.6, horizonFracNarrow: 0.72, textMargin: 60 },
    // スマホ：文字ブロックの下の帯に、この矩形（堤防の左端〜糸、上はマントの先、下はステッカーまで）が全部入るように縮める
    // y0 は投げ直しで振りかぶった竿先の高さまで含める（含めないと竿先が文字やボタンにかかる）
    mobile: { content: { x0: -30, x1: 1400, y0: -170, y1: 1120 }, gap: 12 },
    // JS が無いときの既定（16:10 で PC のルールと同じ）。他の比率は右寄せで切る
    fallbackViewBox: '-680 -160 2080 1300',
  },

  // bg.webp から測った色（世界を延ばすときの空と海）
  sky: [[-4000, '#000817'], [0, '#000817'], [300, '#020f23'], [500, '#061d3c'], [619, '#0b284e']],
  sea: [[620, '#337e8b'], [632, '#2f7a88'], [648, '#14596f'], [700, '#12566e'], [800, '#0c4c66'], [850, '#125970'], [900, '#0b4863'], [1024, '#0a4762'], [4000, '#083d56']],
  colors: {
    navy: '#182c47',
    ivory: '#f4ead8',
    glow: '#fff6dc',
    sun: '#e4552a',
    sunGlow: '#ff8a4a',
    wave: 'rgba(205, 240, 238, 0.42)',
  },

  timing: {
    breath: 4,
    nibbleMin: 5, nibbleMax: 8, nibbleLen: 0.8,
    hookRise: 0.18, hookHold: 1.2, hookRelease: 0.65,
    calloutStay: 7,
  },
};

/* ------------------------------------------------------------------
   形の計算（hero-anim.js と静止 SVG で共有）
   ------------------------------------------------------------------ */
export const TAU = Math.PI * 2;
export const lerp = (a, b, k) => a + (b - a) * k;
export const bez = (p0, c, p2, k) => ({
  x: (1 - k) ** 2 * p0.x + 2 * k * (1 - k) * c.x + k * k * p2.x,
  y: (1 - k) ** 2 * p0.y + 2 * k * (1 - k) * c.y + k * k * p2.y,
});
const f1 = (v) => v.toFixed(1);

// 竿の先端と曲がりの制御点。pull=抱いた引き(0-1)、dip=アタリの引き込み(px)、bob=揺れ(px)
export function rodPose(cfg, { pull = 0, dip = 0, bob = 0 } = {}) {
  const toWater = { x: cfg.lineWater.x - cfg.rodTipRest.x, y: cfg.lineWater.y - cfg.rodTipRest.y };
  const tip = {
    x: cfg.rodTipRest.x + dip * 0.25 + toWater.x * cfg.hookPull * pull,
    y: cfg.rodTipRest.y + bob + dip * 0.9 + toWater.y * cfg.hookPull * pull,
  };
  // 制御点は先端ほど下げない：根元は上を向いたまま、先だけ水面へ引かれて「しなる」
  const bend = {
    x: cfg.rodBend.x + toWater.x * 0.1 * pull + dip * 0.1,
    y: cfg.rodBend.y + bob * 0.5 + toWater.y * 0.12 * pull + dip * 0.5,
  };
  return { tip, bend };
}

// 竿を「太さの変わる帯」として1本の塗りパスに
export function rodPathD(p0, c, p2, w0, w1, extra = 0) {
  const N = 22;
  const left = [];
  const right = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const p = bez(p0, c, p2, k);
    const q = bez(p0, c, p2, Math.min(1, k + 0.01));
    const r = bez(p0, c, p2, Math.max(0, k - 0.01));
    let nx = -(q.y - r.y);
    let ny = q.x - r.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    const hw = (lerp(w0, w1, k) + extra) / 2;
    left.push(`${f1(p.x + nx * hw)},${f1(p.y + ny * hw)}`);
    right.push(`${f1(p.x - nx * hw)},${f1(p.y - ny * hw)}`);
  }
  return `M${left.join('L')}L${right.reverse().join('L')}Z`;
}

// 糸：先端→水面。sway で横にたるむ。droop は長さに対する割合で下にたるむ（飛んでいるエギを追う糸）
export function lineD(tip, water, sway = 0, droop = 0) {
  const L = droop ? Math.hypot(water.x - tip.x, water.y - tip.y) : 0;
  const mid = { x: (tip.x + water.x) / 2 + sway, y: (tip.y + water.y) / 2 + L * droop };
  return `M${f1(tip.x)},${f1(tip.y)}Q${f1(mid.x)},${f1(mid.y)} ${water.x},${water.y}`;
}

// 波の線：世界の左端から右端まで。s=経過秒、i=何本目（位相をずらす）
export function waveD(cfg, wv, i, s = 0) {
  const x0 = cfg.world.left;
  const x1 = cfg.world.right;
  const step = 60;
  const pts = [];
  for (let x = x0; x <= x1 + step; x += step) {
    const y = wv.y + wv.amp * Math.sin((x / wv.len) * TAU - s * wv.speed * TAU * 0.35 + i);
    pts.push(`${x},${f1(y)}`);
  }
  return `M${pts.join('L')}`;
}

/* ------------------------------------------------------------------
   画面に切り出す範囲（viewBox）
   ------------------------------------------------------------------ */

// w,h = 表示領域のピクセル。mobile のときは文字ブロックの高さ textH を避けた帯に内容を収める
export function computeViewBox(cfg, w, h, { mobile = false, textH = 0 } = {}) {
  if (!mobile) {
    // 見せる高さ。幅が狭い（16:10 など）ときは引いて、堤防の左端（＋余白）が幅の 47% より右に来るようにする
    //   堤防の左端 px = w - (right - pierBox.x + margin) × scale, scale = h / H  →  H ≥ (…) × h / (0.53 w)
    const d = cfg.view.desktop;
    const H = Math.max(d.height, ((cfg.world.right - cfg.pierBox.x + d.textMargin) * h) / (0.53 * w));
    const W = (w / h) * H;
    // 幅 1366px 以下は文字が海にかからないよう水平線を下げる
    const frac = w <= 1366 ? d.horizonFracNarrow : d.horizonFrac;
    return { x: cfg.world.right - W, y: cfg.horizonY - frac * H, w: W, h: H };
  }
  const c = cfg.view.mobile.content;
  const cw = c.x1 - c.x0;
  const ch = c.y1 - c.y0;
  const avail = Math.max(200, h - textH - cfg.view.mobile.gap);
  const scale = Math.min(w / cw, avail / ch);
  const W = w / scale;
  const H = h / scale;
  const bandH = avail / scale;
  const bottom = c.y1 + (bandH - ch) / 2;
  return { x: c.x0 - (W - cw) / 2, y: bottom - H, w: W, h: H };
}

// 世界座標 → 表示領域のピクセル
export const project = (vb, w, wx, wy) => {
  const scale = w / vb.w;
  return { x: (wx - vb.x) * scale, y: (wy - vb.y) * scale };
};

/* ------------------------------------------------------------------
   静止 SVG（ビルド時に HTML へ書き込む。休んでいる姿勢）
   ------------------------------------------------------------------ */
export function sceneSVG(cfg, assetHref, lang = 'ja') {
  const C = cfg.colors;
  const W = cfg.world;
  const { tip, bend } = rodPose(cfg);
  const gradStops = (list, y0, y1) =>
    list.map(([y, c]) => `<stop offset="${(((y - y0) / (y1 - y0)) * 100).toFixed(2)}%" stop-color="${c}" />`).join('');
  const skyTop = cfg.sky[0][0];
  const seaBottom = cfg.sea[cfg.sea.length - 1][0];
  const guides = cfg.rodGuides.map((k) => {
    const p = bez(cfg.rodGrip, bend, tip, k);
    return `<g class="ika-sc-guide" transform="translate(${f1(p.x)} ${f1(p.y)})"><circle r="11" fill="${C.navy}" /><circle r="4" fill="${C.ivory}" /></g>`;
  }).join('');
  const shimmer = cfg.shimmer.map((s) => `<ellipse class="ika-sc-shimmer" cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" fill="${C.sunGlow}" opacity="0.16" />`).join('');
  const waves = cfg.waves.map((wv, i) => `<path class="ika-sc-wave" d="${waveD(cfg, wv, i)}" fill="none" stroke="${C.wave}" stroke-width="3" stroke-linecap="round" />`).join('');
  const ripples = Array.from({ length: 4 }, () => `<ellipse class="ika-sc-ripple" cx="${cfg.lineWater.x}" cy="${cfg.lineWater.y}" rx="0" ry="0" fill="none" stroke="${C.glow}" stroke-width="3" opacity="0" />`).join('');
  const splash = Array.from({ length: 10 }, () => `<circle class="ika-sc-splash" r="7" fill="${C.glow}" opacity="0" />`).join('');
  const seat = cfg.squidSeat;

  return `<svg class="ika-scene" viewBox="${cfg.view.fallbackViewBox}" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="ika-sky" gradientUnits="userSpaceOnUse" x1="0" y1="${skyTop}" x2="0" y2="${cfg.horizonY}">${gradStops(cfg.sky, skyTop, cfg.horizonY)}</linearGradient>
    <linearGradient id="ika-sea" gradientUnits="userSpaceOnUse" x1="0" y1="${cfg.horizonY}" x2="0" y2="${seaBottom}">${gradStops(cfg.sea, cfg.horizonY, seaBottom)}</linearGradient>
    <radialGradient id="ika-sunglow"><stop offset="55%" stop-color="${C.sunGlow}" stop-opacity="0.55" /><stop offset="100%" stop-color="${C.sunGlow}" stop-opacity="0" /></radialGradient>
    <linearGradient id="ika-bgfade-x" gradientUnits="userSpaceOnUse" x1="${cfg.bgBox.x}" y1="0" x2="${cfg.bgBox.x + W.bgFade}" y2="0"><stop offset="0" stop-color="#000" /><stop offset="1" stop-color="#fff" /></linearGradient>
    <linearGradient id="ika-bgfade-y" gradientUnits="userSpaceOnUse" x1="0" y1="${cfg.bgBox.y + cfg.bgBox.h - W.bgFade}" x2="0" y2="${cfg.bgBox.y + cfg.bgBox.h}"><stop offset="0" stop-color="#fff" /><stop offset="1" stop-color="#000" /></linearGradient>
    <mask id="ika-bgmask" maskUnits="userSpaceOnUse" x="${cfg.bgBox.x}" y="${cfg.bgBox.y}" width="${cfg.bgBox.w}" height="${cfg.bgBox.h}">
      <rect x="${cfg.bgBox.x}" y="${cfg.bgBox.y}" width="${cfg.bgBox.w}" height="${cfg.bgBox.h}" fill="url(#ika-bgfade-x)" />
      <rect x="${cfg.bgBox.x}" y="${cfg.bgBox.y + cfg.bgBox.h - W.bgFade}" width="${cfg.bgBox.w}" height="${W.bgFade}" fill="url(#ika-bgfade-y)" style="mix-blend-mode: multiply" />
    </mask>
  </defs>
  <!-- 空と海（bg.webp の外側まで延ばす） -->
  <rect x="${W.left}" y="${W.top}" width="${W.right - W.left + 2000}" height="${cfg.horizonY - W.top}" fill="url(#ika-sky)" />
  <rect x="${W.left}" y="${cfg.horizonY}" width="${W.right - W.left + 2000}" height="${W.bottom - cfg.horizonY}" fill="url(#ika-sea)" />
  <image class="ika-sc-bg" href="${assetHref(cfg.layers.bg)}" x="${cfg.bgBox.x}" y="${cfg.bgBox.y}" width="${cfg.bgBox.w}" height="${cfg.bgBox.h}" preserveAspectRatio="none" mask="url(#ika-bgmask)" />
  <!-- 太陽と照り返しと波 -->
  <circle class="ika-sc-sunglow" cx="${cfg.sunCenter.x}" cy="${cfg.sunCenter.y}" r="${cfg.sunR * 1.45}" fill="url(#ika-sunglow)" />
  <circle cx="${cfg.sunCenter.x}" cy="${cfg.sunCenter.y}" r="${cfg.sunR}" fill="${C.sun}" />
  ${shimmer}
  ${waves}
  <!-- 堤防とイカ（イカは座っている点を支点に呼吸・ひねり） -->
  <image class="ika-sc-pier" href="${assetHref(cfg.layers.pier)}" x="${cfg.pierBox.x}" y="${cfg.pierBox.y}" width="${cfg.pierBox.w}" height="${cfg.pierBox.h}" preserveAspectRatio="none" />
  <g class="ika-sc-squid" transform="translate(${seat.x} ${seat.y}) translate(${-seat.x} ${-seat.y})">
    <image class="ika-sc-squid-img" href="${assetHref(cfg.layers.squid)}" x="${cfg.squidBox.x}" y="${cfg.squidBox.y}" width="${cfg.squidBox.w}" height="${cfg.squidBox.h}" preserveAspectRatio="none" />
  </g>
  <!-- 糸と竿 -->
  <path class="ika-sc-lineglow" d="${lineD(tip, cfg.lineWater)}" fill="none" stroke="${C.glow}" stroke-width="12" stroke-linecap="round" opacity="0.2" />
  <path class="ika-sc-line" d="${lineD(tip, cfg.lineWater)}" fill="none" stroke="${C.ivory}" stroke-width="5" stroke-linecap="round" opacity="0.9" />
  <ellipse class="ika-sc-restripple" cx="${cfg.lineWater.x}" cy="${cfg.lineWater.y}" rx="${cfg.restRipple.rx}" ry="${cfg.restRipple.ry}" fill="none" stroke="${C.ivory}" stroke-width="4" opacity="0.75" />
  ${ripples}
  <path class="ika-sc-rod-outline" d="${rodPathD(cfg.rodGrip, bend, tip, cfg.rodWidth.grip, cfg.rodWidth.tip, cfg.rodOutline)}" fill="${C.navy}" />
  <path class="ika-sc-rod" d="${rodPathD(cfg.rodGrip, bend, tip, cfg.rodWidth.grip, cfg.rodWidth.tip)}" fill="${C.ivory}" />
  ${guides}
  ${splash}
  <title>${t(lang, '堤防の先でイカが釣り竿を構え、夕日の海を眺めている', 'A squid fishing from a breakwater at dusk')}</title>
</svg>`;
}

// エギングゲームの舞台（横から見た海の断面）。座標の決まりと、ビルド時にも書き込む静止 SVG。
// DOM・window には触らない（views/play.js から呼ばれ、prerender-ikabu が node で実行する）。
// 動かすのは egi-ui.js（ここで作った SVG の要素を class で探し、糸・エギ・イカを足す）。
//
// 座標系：高さ 620 固定。幅は表示領域の縦横比で egi-ui.js が決め直す（既定 1000）。
//   左に堤防と釣り人（HERO と同じ squid.png）、水面は y=290、水中は深さに比例して下へ。
// 世界は画面より広く描く（空は上へ 2H、海と海底は左右へ W ずつ、下へ 2H）。投げの最中にカメラが少し引いても
//   舞台の地色が見えない＝空・海・堤防が必ず画面を埋める。
import { t } from '../i18n.js';
import { HERO_ANIM } from '../hero-scene.js';

export const SCENE = {
  H: 620,
  W0: 1000,            // JS が無いときの幅
  surface: 290,        // 水面
  seabed: 600,         // 最大水深の y
  maxDepth: 12,        // m（egi.js の底は 5〜10m）
  rangeM: 44,          // 右端までの距離（m）。最大飛距離 40m が収まる
  pierRight: 190,      // 堤防の右端
  pierTop: 236,        // 堤防の上面
  squidBox: { x: 30, y: 70, w: 150, h: 167 },   // squid.png（HERO と同じ比率 586:654）
  grip: { x: 158, y: 181 },                     // 竿の握り（squid.png の切れ端の位置）
  rod: { len: 178, rest: 42, width: [11, 4], outline: 6 },  // 長さ・休みの角度（度、右上向き）
  lamp: { x: 120, y: 120 },                     // 夜の常夜灯
};

// 時間帯ごとの空と海の色（上→下）
export const PALETTE = {
  morning: { sky: ['#1b3557', '#e58c5c', '#ffe1b3'], hills: '#2a4a63', sea: ['#3d95a4', '#0d5468', '#063242'], sun: { x: 0.82, y: 0.78, r: 34, color: '#ffb24a' }, text: '#ffffff' },
  day: { sky: ['#3f98cf', '#9dd7f2', '#d9f1fb'], hills: '#5f8fa8', sea: ['#45b3c6', '#0f667c', '#08404f'], sun: { x: 0.6, y: 0.18, r: 30, color: '#fff2b0' }, text: '#ffffff' },
  evening: { sky: ['#2a1c4e', '#d6573c', '#ffb06e'], hills: '#33254a', sea: ['#2f8b9c', '#0a4f66', '#053040'], sun: { x: 0.72, y: 0.8, r: 36, color: '#ff7a3a' }, text: '#ffffff' },
  night: { sky: ['#020814', '#071a33', '#0e2d4d'], hills: '#050f1e', sea: ['#0d3f50', '#062632', '#03151c'], moon: { x: 0.78, y: 0.28, r: 22 }, text: '#ffffff' },
};

const f1 = (v) => (Math.round(v * 10) / 10).toString();
// 空の一番上の色（空の最初の色を暗くする）
const darker = (hex, k = 0.55) => '#' + hex.slice(1).match(/../g).map((h) => Math.round(parseInt(h, 16) * k).toString(16).padStart(2, '0')).join('');

// 深さ（m）→ y、距離（m）→ x（幅 W のとき）
// 画面の縦に入れる深さ（深場は 18m を入れる。2026-10-06）
let depthMax = SCENE.maxDepth;
export const setDepthMax = (m) => { depthMax = m; };
export const depthY = (depth) => SCENE.surface + (depth / depthMax) * (SCENE.seabed - SCENE.surface);
export const distX = (dist, W) => SCENE.pierRight + (dist / SCENE.rangeM) * (W - SCENE.pierRight - 70);   // 右端に大物の胴が入る余白

// 海底の線（世界の左端から右端まで、ゆるい起伏＋岩。堤防の後ろは堤防が隠す）
export function seabedD(bottom, W, seedish = 0) {
  const y = depthY(bottom);
  const pts = [];
  const n = 27;
  for (let i = 0; i <= n; i++) {
    const x = -W + (3 * W * i) / n;
    const bump = Math.sin(i * 1.7 + seedish) * 6 + Math.cos(i * 0.9 + seedish * 2) * 4;
    pts.push(`${f1(x)},${f1(y + bump)}`);
  }
  return `M${-W},${2 * SCENE.H} L${pts.join(' L')} L${2 * W},${2 * SCENE.H} Z`;
}

// 岩：海底の上に3つほど（根掛かりの「根」）
export function rocksSVG(bottom, W, seedish = 0) {
  const y = depthY(bottom);
  return [0.28, 0.55, 0.8].map((k, i) => {
    const x = SCENE.pierRight + (W - SCENE.pierRight) * k + Math.sin(seedish + i) * 30;
    const r = 14 + (i % 2) * 8;
    return `<path d="M${f1(x - r)},${f1(y + 4)} Q${f1(x - r * 0.6)},${f1(y - r)} ${f1(x)},${f1(y - r * 0.8)} Q${f1(x + r * 0.7)},${f1(y - r * 0.9)} ${f1(x + r)},${f1(y + 4)} Z" fill="#1d3d4a" stroke="#0b2a33" stroke-width="3" stroke-linejoin="round" />`;
  }).join('');
}

// 藻場の絵（2026-09-27）。weed＝{ kind, from, to, height }、X＝距離(m)→横の位置。揺れは CSS（.ika-eg-weed-blade）
const WEED_COLORS = { amamo: ['#6cc06a', '#46a052'], hondawara: ['#7a6a2a', '#5a4d1c'], umitoranoo: ['#6d9a3c', '#4f7a2a'] };
export function weedSVG(weed, bottom, X) {
  if (!weed) return '';
  const yb = depthY(bottom);
  const h = depthY(bottom) - depthY(bottom - weed.height);   // 藻の高さ（px）
  const x0 = Math.min(X(weed.from), X(weed.to));
  const x1 = Math.max(X(weed.from), X(weed.to));
  const [c, dark] = WEED_COLORS[weed.kind] ?? WEED_COLORS.amamo;
  const n = Math.max(4, Math.round((x1 - x0) / (weed.kind === 'amamo' ? 8 : 12)));   // アマモは密に
  const blades = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    const hh = h * (0.75 + 0.25 * Math.abs(Math.sin(i * 2.3)));
    const sw = (i % 2 ? 1 : -1) * 6;
    let d;
    if (weed.kind === 'amamo') {
      d = `<path d="M${f1(x)},${f1(yb)} Q${f1(x + sw)},${f1(yb - hh * 0.5)} ${f1(x - sw * 0.6)},${f1(yb - hh)}" fill="none" stroke="${i % 3 ? c : dark}" stroke-width="4.5" stroke-linecap="round"/>`;
    } else if (weed.kind === 'hondawara') {
      const br = [0.35, 0.55, 0.75].map((k) => `<path d="M${f1(x)},${f1(yb - hh * k)} l${f1(sw * 1.3)},${f1(-hh * 0.12)}" stroke="${c}" stroke-width="2" stroke-linecap="round"/><circle cx="${f1(x + sw * 1.3)}" cy="${f1(yb - hh * k - hh * 0.12)}" r="2.2" fill="${dark}"/>`).join('');
      d = `<path d="M${f1(x)},${f1(yb)} L${f1(x + sw * 0.4)},${f1(yb - hh)}" stroke="${dark}" stroke-width="2.6" stroke-linecap="round"/>${br}`;
    } else {
      const fr = [0.3, 0.5, 0.7, 0.88].map((k) => `<path d="M${f1(x)},${f1(yb - hh * k)} l-5,-4 M${f1(x)},${f1(yb - hh * k)} l5,-4" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`).join('');
      d = `<path d="M${f1(x)},${f1(yb)} L${f1(x)},${f1(yb - hh)}" stroke="${dark}" stroke-width="2.2" stroke-linecap="round"/>${fr}`;
    }
    blades.push(`<g class="ika-eg-weed-blade" style="animation-delay:${(-(i % 5) * 0.6).toFixed(1)}s">${d}</g>`);
  }
  const rocks = WEEDS_ROCKY[weed.kind]
    ? `<path d="M${f1(x0 - 10)},${f1(yb + 4)} Q${f1(x0 + (x1 - x0) * 0.3)},${f1(yb - 12)} ${f1((x0 + x1) / 2)},${f1(yb - 8)} Q${f1(x1 - (x1 - x0) * 0.2)},${f1(yb - 14)} ${f1(x1 + 10)},${f1(yb + 4)} Z" fill="#1d3d4a" stroke="#0b2a33" stroke-width="2.5"/>`
    : '';
  return `<g class="ika-eg-weed" data-kind="${weed.kind}">${rocks}${blades.join('')}</g>`;
}
const WEEDS_ROCKY = { hondawara: true, umitoranoo: true };

function moonSVG(cx, cy, r, light, sky, surface, W) {
  const k = Math.max(0, Math.min(1, light));
  if (k < 0.06) return '';
  const off = (1 - k) * r * 2;   // かげの円をずらす量（満月で0）
  const glow = k > 0.5 ? `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r * 2.4)}" fill="#fff3c4" opacity="${(0.12 * k).toFixed(2)}" />` : '';
  const road = k > 0.5 ? `<rect x="${f1(cx - r * 0.9)}" y="${surface}" width="${f1(r * 1.8)}" height="60" fill="#fff3c4" opacity="${(0.18 * k).toFixed(2)}" />` : '';
  void W;
  return `${glow}<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${r}" fill="#fff3c4" />${off > 0.5 ? `<circle cx="${f1(cx - off)}" cy="${f1(cy - off * 0.25)}" r="${r}" fill="${sky}" />` : ''}${road}`;
}

// 舞台の静止 SVG。tod は時間帯、W は幅、bottom は海底の深さ（m）
export function egiSceneSVG({ lang = 'ja', tod = 'evening', W = SCENE.W0, bottom = 8, assetHref = (p) => p, moon = 0.5 } = {}) {
  const P = PALETTE[tod] ?? PALETTE.evening;
  const S = SCENE;
  const stops = (list) => list.map((c, i) => `<stop offset="${(i / (list.length - 1)) * 100}%" stop-color="${c}" />`).join('');
  const night = tod === 'night';
  const sun = P.sun
    ? `<circle class="ika-eg-sun" cx="${f1(W * P.sun.x)}" cy="${f1(S.surface * P.sun.y)}" r="${P.sun.r}" fill="${P.sun.color}" />`
    // 月の満ち欠け（2026-09-29）：満月は丸く明るく水面に光の道、新月は見えない
    : moonSVG(W * P.moon.x, S.surface * P.moon.y, P.moon.r, moon, P.sky[1], S.surface, W);
  const stars = night
    ? [0.3, 0.42, 0.5, 0.61, 0.69, 0.9, 0.95, 0.36, 0.55, 0.84].map((k, i) => `<circle cx="${f1(W * k)}" cy="${f1(20 + ((i * 37) % 120))}" r="${1.2 + (i % 3) * 0.5}" fill="#fff" opacity="0.8" />`).join('')
    : '';
  // 遠くの山（水平線の上）
  const hills = `<path d="M${-W},${S.surface} L${S.pierRight - 60},${S.surface} Q${f1(W * 0.3)},${S.surface - 48} ${f1(W * 0.45)},${S.surface - 22} Q${f1(W * 0.6)},${S.surface - 62} ${f1(W * 0.78)},${S.surface - 26} Q${f1(W * 0.9)},${S.surface - 40} ${W},${S.surface - 16} Q${f1(W * 1.2)},${S.surface - 44} ${f1(W * 1.45)},${S.surface - 20} Q${f1(W * 1.7)},${S.surface - 56} ${2 * W},${S.surface - 30} L${2 * W},${S.surface} Z" fill="${P.hills}" />`;
  // 常夜灯（夜だけ）：柱と灯り、水面の照り返し
  const lamp = night
    ? `<g class="ika-eg-lamp"><rect x="${S.lamp.x - 3}" y="${S.lamp.y}" width="6" height="${S.pierTop - S.lamp.y}" fill="#1a2a3a" /><circle cx="${S.lamp.x}" cy="${S.lamp.y - 6}" r="10" fill="#ffe9a8" /><circle cx="${S.lamp.x}" cy="${S.lamp.y - 6}" r="34" fill="url(#ika-eg-lampglow)" /><ellipse cx="${S.pierRight + 70}" cy="${S.surface + 8}" rx="120" ry="14" fill="#ffe9a8" opacity="0.14" /></g>`
    : '';
  const ripples = Array.from({ length: 4 }, () => `<ellipse class="ika-eg-ripple" cx="0" cy="${S.surface}" rx="0" ry="0" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0" />`).join('');
  const splash = Array.from({ length: 8 }, () => `<circle class="ika-eg-splash" r="4" fill="#ffffff" opacity="0" />`).join('');
  return `<svg class="ika-eg-svg" viewBox="0 0 ${W} ${S.H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t(lang, '堤防からエギを投げる横から見た海。ボタンで操作します', 'Side view of the sea from a breakwater. Play with the button below')}" focusable="false" data-tod="${tod}">
  <defs>
    <linearGradient id="ika-eg-sky" gradientUnits="userSpaceOnUse" x1="0" y1="${-S.H}" x2="0" y2="${S.surface}">${stops([darker(P.sky[0]), ...P.sky])}</linearGradient>
    <linearGradient id="ika-eg-sea" gradientUnits="userSpaceOnUse" x1="0" y1="${S.surface}" x2="0" y2="${S.H}">${stops(P.sea)}</linearGradient>
    <radialGradient id="ika-eg-lampglow"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.55" /><stop offset="1" stop-color="#ffe9a8" stop-opacity="0" /></radialGradient>
    <linearGradient id="ika-eg-pier" gradientUnits="userSpaceOnUse" x1="0" y1="${S.pierTop}" x2="0" y2="${S.H}"><stop offset="0" stop-color="#d9d2c0" /><stop offset="${((S.surface - S.pierTop) / (S.H - S.pierTop)).toFixed(3)}" stop-color="#c4bcab" /><stop offset="${((S.surface - S.pierTop) / (S.H - S.pierTop) + 0.002).toFixed(3)}" stop-color="#5e6b70" /><stop offset="1" stop-color="#2c3d45" /></linearGradient>
  </defs>
  <rect class="ika-eg-skyrect" x="${-W}" y="${-2 * S.H}" width="${3 * W}" height="${2 * S.H + S.surface}" fill="url(#ika-eg-sky)" />
  ${stars}${sun}${hills}
  <rect class="ika-eg-searect" x="${-W}" y="${S.surface}" width="${3 * W}" height="${2 * S.H}" fill="url(#ika-eg-sea)" />
  <!-- 海底と岩（投げるたびに深さが変わるので egi-ui.js が書き換える） -->
  <g class="ika-eg-bottom"><path class="ika-eg-seabed" d="${seabedD(bottom, W)}" fill="#c9b787" stroke="#0b2a33" stroke-width="3" />${rocksSVG(bottom, W)}</g>
  <!-- 水中で動くもの（気配のイカ・エギ・抱いたイカ・墨）はここに入る -->
  <g class="ika-eg-under"></g>
  <!-- 水面 -->
  <path class="ika-eg-wave" d="M${S.pierRight},${S.surface} L${2 * W},${S.surface}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3" stroke-linecap="round" />
  ${ripples}${splash}
  <!-- 堤防（水面の上は明るいコンクリート、水中は暗い壁） -->
  <rect x="${-W}" y="${S.pierTop}" width="${S.pierRight + W}" height="${2 * S.H - S.pierTop}" fill="url(#ika-eg-pier)" />
  <rect x="${-W}" y="${S.pierTop}" width="${S.pierRight + W}" height="8" fill="#ece5d3" />
  <rect x="${S.pierRight - 6}" y="${S.pierTop}" width="6" height="${2 * S.H - S.pierTop}" fill="#1f3038" opacity="0.6" />
  ${lamp}
  <!-- 釣り人（HERO と同じイカ） -->
  <image class="ika-eg-angler" href="${assetHref(HERO_ANIM.layers.squid)}" x="${S.squidBox.x}" y="${S.squidBox.y}" width="${S.squidBox.w}" height="${S.squidBox.h}" preserveAspectRatio="none" />
  <!-- 竿・糸・空中のもの（egi-ui.js が描く） -->
  <path class="ika-eg-rod-outline" d="" fill="#16233a" />
  <path class="ika-eg-rod" d="" fill="#f4ead8" />
  <path class="ika-eg-line" d="" fill="none" stroke="#fff8e6" stroke-width="2.4" stroke-linecap="round" opacity="0.95" />
  <g class="ika-eg-air"></g>
</svg>`;
}

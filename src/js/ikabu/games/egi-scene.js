// エギングゲームの舞台（横から見た海の断面）。座標の決まりと、ビルド時にも書き込む静止 SVG。
// DOM・window には触らない（views/play.js から呼ばれ、prerender-ikabu が node で実行する）。
// 動かすのは egi-ui.js（ここで作った SVG の要素を class で探し、糸・エギ・イカを足す）。
//
// 座標系：高さ 620 固定。幅は表示領域の縦横比で egi-ui.js が決め直す（既定 1000）。
//   左に堤防と釣り人（HERO と同じ squid.png）、水面は y=290、水中は深さに比例して下へ。
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

// 深さ（m）→ y、距離（m）→ x（幅 W のとき）
export const depthY = (depth) => SCENE.surface + (depth / SCENE.maxDepth) * (SCENE.seabed - SCENE.surface);
export const distX = (dist, W) => SCENE.pierRight + (dist / SCENE.rangeM) * (W - SCENE.pierRight - 70);   // 右端に大物の胴が入る余白

// 海底の線（堤防の壁の下端から右端まで、ゆるい起伏＋岩）
export function seabedD(bottom, W, seedish = 0) {
  const y = depthY(bottom);
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const x = SCENE.pierRight + ((W - SCENE.pierRight) * i) / n;
    const bump = Math.sin(i * 1.7 + seedish) * 6 + Math.cos(i * 0.9 + seedish * 2) * 4;
    pts.push(`${f1(x)},${f1(y + bump)}`);
  }
  return `M${SCENE.pierRight},${f1(SCENE.H)} L${pts.join(' L')} L${W},${SCENE.H} Z`;
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

// 舞台の静止 SVG。tod は時間帯、W は幅、bottom は海底の深さ（m）
export function egiSceneSVG({ lang = 'ja', tod = 'evening', W = SCENE.W0, bottom = 8, assetHref = (p) => p } = {}) {
  const P = PALETTE[tod] ?? PALETTE.evening;
  const S = SCENE;
  const stops = (list) => list.map((c, i) => `<stop offset="${(i / (list.length - 1)) * 100}%" stop-color="${c}" />`).join('');
  const night = tod === 'night';
  const sun = P.sun
    ? `<circle class="ika-eg-sun" cx="${f1(W * P.sun.x)}" cy="${f1(S.surface * P.sun.y)}" r="${P.sun.r}" fill="${P.sun.color}" />`
    : `<circle cx="${f1(W * P.moon.x)}" cy="${f1(S.surface * P.moon.y)}" r="${P.moon.r}" fill="#fff3c4" /><circle cx="${f1(W * P.moon.x - 9)}" cy="${f1(S.surface * P.moon.y - 6)}" r="${P.moon.r}" fill="${P.sky[1]}" />`;
  const stars = night
    ? [0.3, 0.42, 0.5, 0.61, 0.69, 0.9, 0.95, 0.36, 0.55, 0.84].map((k, i) => `<circle cx="${f1(W * k)}" cy="${f1(20 + ((i * 37) % 120))}" r="${1.2 + (i % 3) * 0.5}" fill="#fff" opacity="0.8" />`).join('')
    : '';
  // 遠くの山（水平線の上）
  const hills = `<path d="M${S.pierRight - 60},${S.surface} Q${f1(W * 0.3)},${S.surface - 48} ${f1(W * 0.45)},${S.surface - 22} Q${f1(W * 0.6)},${S.surface - 62} ${f1(W * 0.78)},${S.surface - 26} Q${f1(W * 0.9)},${S.surface - 40} ${W},${S.surface - 16} L${W},${S.surface} Z" fill="${P.hills}" />`;
  // 常夜灯（夜だけ）：柱と灯り、水面の照り返し
  const lamp = night
    ? `<g class="ika-eg-lamp"><rect x="${S.lamp.x - 3}" y="${S.lamp.y}" width="6" height="${S.pierTop - S.lamp.y}" fill="#1a2a3a" /><circle cx="${S.lamp.x}" cy="${S.lamp.y - 6}" r="10" fill="#ffe9a8" /><circle cx="${S.lamp.x}" cy="${S.lamp.y - 6}" r="34" fill="url(#ika-eg-lampglow)" /><ellipse cx="${S.pierRight + 70}" cy="${S.surface + 8}" rx="120" ry="14" fill="#ffe9a8" opacity="0.14" /></g>`
    : '';
  const ripples = Array.from({ length: 4 }, () => `<ellipse class="ika-eg-ripple" cx="0" cy="${S.surface}" rx="0" ry="0" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0" />`).join('');
  const splash = Array.from({ length: 8 }, () => `<circle class="ika-eg-splash" r="4" fill="#ffffff" opacity="0" />`).join('');
  return `<svg class="ika-eg-svg" viewBox="0 0 ${W} ${S.H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t(lang, '堤防からエギを投げる横から見た海。ボタンで操作します', 'Side view of the sea from a breakwater. Play with the button below')}" focusable="false" data-tod="${tod}">
  <defs>
    <linearGradient id="ika-eg-sky" x1="0" y1="0" x2="0" y2="1">${stops(P.sky)}</linearGradient>
    <linearGradient id="ika-eg-sea" gradientUnits="userSpaceOnUse" x1="0" y1="${S.surface}" x2="0" y2="${S.H}">${stops(P.sea)}</linearGradient>
    <radialGradient id="ika-eg-lampglow"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.55" /><stop offset="1" stop-color="#ffe9a8" stop-opacity="0" /></radialGradient>
    <linearGradient id="ika-eg-pier" gradientUnits="userSpaceOnUse" x1="0" y1="${S.pierTop}" x2="0" y2="${S.H}"><stop offset="0" stop-color="#d9d2c0" /><stop offset="${((S.surface - S.pierTop) / (S.H - S.pierTop)).toFixed(3)}" stop-color="#c4bcab" /><stop offset="${((S.surface - S.pierTop) / (S.H - S.pierTop) + 0.002).toFixed(3)}" stop-color="#5e6b70" /><stop offset="1" stop-color="#2c3d45" /></linearGradient>
  </defs>
  <rect class="ika-eg-skyrect" x="0" y="0" width="${W}" height="${S.surface}" fill="url(#ika-eg-sky)" />
  ${stars}${sun}${hills}
  <rect class="ika-eg-searect" x="0" y="${S.surface}" width="${W}" height="${S.H - S.surface}" fill="url(#ika-eg-sea)" />
  <!-- 海底と岩（投げるたびに深さが変わるので egi-ui.js が書き換える） -->
  <g class="ika-eg-bottom"><path class="ika-eg-seabed" d="${seabedD(bottom, W)}" fill="#c9b787" stroke="#0b2a33" stroke-width="3" />${rocksSVG(bottom, W)}</g>
  <!-- 水中で動くもの（気配のイカ・エギ・抱いたイカ・墨）はここに入る -->
  <g class="ika-eg-under"></g>
  <!-- 水面 -->
  <path class="ika-eg-wave" d="M${S.pierRight},${S.surface} L${W},${S.surface}" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="3" stroke-linecap="round" />
  ${ripples}${splash}
  <!-- 堤防（水面の上は明るいコンクリート、水中は暗い壁） -->
  <rect x="-20" y="${S.pierTop}" width="${S.pierRight + 20}" height="${S.H - S.pierTop}" fill="url(#ika-eg-pier)" />
  <rect x="-20" y="${S.pierTop}" width="${S.pierRight + 20}" height="8" fill="#ece5d3" />
  <rect x="${S.pierRight - 6}" y="${S.pierTop}" width="6" height="${S.H - S.pierTop}" fill="#1f3038" opacity="0.6" />
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

// イカ部トップの「動くHERO」。
//
// 仕組み：イラストを画像レイヤー（bg / pier / squid）に分け、動くもの（太陽・竿・糸・波・波紋・しぶき）は
// ここで SVG に描く。レイヤー画像が3枚とも読めたときだけ静止画（hero_1600.webp）と入れ替えるので、
// JS が無い・レイヤーがまだ無い・読めない、のどれでも静止画のまま崩れない。
//
// 座標はすべて元イラスト（hero_original.png、1536×1024）のピクセルで書く。
// 本物のレイヤーが届いたら、下の HERO_ANIM の数字（箱の位置・竿の根元と先・糸が入る点）だけ直せばよい。
import { t, pageHref } from './i18n.js';
import { url } from '../base.js';

/* ------------------------------------------------------------------
   調整する数字はここだけ（単位：元イラストのピクセル。左上が 0,0）
   ------------------------------------------------------------------ */
export const HERO_ANIM = {
  viewBox: { w: 1536, h: 1024 },

  // レイヤー画像。3枚とも読めないと動かない（静止画のまま）
  layers: {
    bg: '/assets/ikabu/hero-layers/bg.webp',       // 3:2 空＋山＋平らな海（太陽・竿・イカ・堤防なし）
    pier: '/assets/ikabu/hero-layers/pier.png',    // 3:2 堤防＋係船柱＋クーラー（透過PNG）
    squid: '/assets/ikabu/hero-layers/squid.png',  // 1:1 イカ＋竿の握り＋リール（透過PNG）
  },

  // レイヤーを置く箱（元イラスト上の位置と大きさ）。画像の縦横比と箱の縦横比は合わせる。
  //   squid.png は ChatGPT の 1254×1254 を key-magenta.py --trim --pad 2 で切った 888×991（元の x=173, y=104 から）。
  //   1254 の画像を元イラストへ 0.66 倍・(-8, +2) ずらしで置くと、マントの先と目と触手の下端が元の絵と合い、
  //   触手が堤防の上面（y≈695）に 25px ほど乗る。→ 箱 = (-8 + 173×0.66, 2 + 104×0.66, 888×0.66, 991×0.66)
  //   イカを動かしたいときは x, y だけ、大きさを変えたいときは w と h を同じ比で。
  squidBox: { x: 106, y: 71, w: 586, h: 654 },
  //   pier.png は 1536×1024 から同じく --trim --pad 2 で切った 891×353（元の x=0, y=583 から）。元の絵と同じ位置に戻すだけ
  pierBox: { x: 0, y: 583, w: 891, h: 353 },
  // イカが堤防に「座っている」点。呼吸（縦の伸び縮み）と抱いたときのひねりの支点
  squidSeat: { x: 400, y: 710 },

  // 竿：握り（描かれた握り＋リールの「切れ端」が終わる点。squid.png では 1254 座標で (935, 758)、45°右上向き）→ 先端。
  //   継ぎ目を隠すため 6px だけ切れ端の内側から描き始める。rodBend は休んでいるときの曲がりの制御点で、
  //   握りから rodBend への向きが竿の出だしの角度（いまは 45°：切れ端と同じ）
  rodGrip: { x: 605, y: 506 },
  rodTipRest: { x: 1228, y: 187 },
  rodBend: { x: 900, y: 211 },
  rodGuides: [0.37, 0.65, 1],          // ガイド（糸を通す輪）の位置。竿に沿った割合（1 = 先端）
  rodWidth: { grip: 16, tip: 5 },      // 竿の太さ（根元→先で細くなる）。根元は切れ端の太さに合わせる
  rodOutline: 10,                      // 紺の縁取り（両側合わせた太さ）
  hookPull: 0.34,                       // 抱いたとき、先端が「糸の入る点」へ向かって動く割合

  // 糸が水面に入る点（波紋の中心）
  lineWater: { x: 1305, y: 862 },
  restRipple: { rx: 58, ry: 22 },      // 休んでいるときの小さな輪

  // 太陽と水平線（bg.webp の水平線は y≈620）
  sunCenter: { x: 578, y: 395 },
  sunR: 190,
  horizonY: 620,
  // 太陽の照り返し（堤防とイカに隠れない、水平線のすぐ下の帯に置く）
  shimmer: [
    { x: 790, y: 632, rx: 54, ry: 4 },
    { x: 830, y: 654, rx: 40, ry: 4 },
    { x: 780, y: 676, rx: 62, ry: 5 },
    { x: 845, y: 700, rx: 34, ry: 4 },
    { x: 800, y: 726, rx: 48, ry: 5 },
  ],
  // 波の線（左端 x0 は堤防の右にかからないように）
  waves: [
    { y: 690, x0: 760, x1: 1536, len: 260, amp: 4, speed: 0.55 },
    { y: 762, x0: 930, x1: 1536, len: 300, amp: 5, speed: 0.42 },
    { y: 838, x0: 900, x1: 1536, len: 240, amp: 4, speed: 0.6 },
    { y: 932, x0: 700, x1: 1536, len: 320, amp: 5, speed: 0.38 },
  ],

  // 色（イラストと同じ紺・アイボリー・朱。CSS の配色とは独立）
  colors: {
    navy: '#182c47',
    ivory: '#f4ead8',
    glow: '#fff6dc',
    sun: '#e4552a',
    sunGlow: '#ff8a4a',
    wave: 'rgba(205, 240, 238, 0.42)',
  },

  // 時間（秒）
  timing: {
    breath: 4,             // 呼吸の周期
    nibbleMin: 5, nibbleMax: 8, nibbleLen: 0.8,
    hookRise: 0.18, hookHold: 1.2, hookRelease: 0.65,  // 合計 ≈ 2秒で元に戻る
    calloutStay: 7,        // 「抱いた！」を出しておく秒数（フォーカスやホバー中は消さない）
  },
};

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const setAttrs = (e, attrs) => { for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); };
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const TAU = Math.PI * 2;

// 2次ベジェ上の点
const bez = (p0, c, p2, k) => ({
  x: (1 - k) ** 2 * p0.x + 2 * k * (1 - k) * c.x + k * k * p2.x,
  y: (1 - k) ** 2 * p0.y + 2 * k * (1 - k) * c.y + k * k * p2.y,
});

const loadImage = (src) => new Promise((resolve, reject) => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => resolve(im);
  im.onerror = () => reject(new Error(`hero layer failed: ${src}`));
  im.src = src;
});

/* ------------------------------------------------------------------
   組み立て
   ------------------------------------------------------------------ */

// art: .ika-hero-art。戻り値は Promise<boolean>（動くHEROに入れ替えたら true）
//   demo: 'hooked' で抱いた姿勢のまま止める（開発時のスクリーンショット用。pages/index.js が dev のときだけ渡す）
export async function mountHeroAnim(art, { lang = 'ja', demo = null, config = HERO_ANIM } = {}) {
  if (!art) return false;
  const frame = art.querySelector('.ika-hero-frame');
  const still = art.querySelector('.ika-hero-img');
  if (!frame || !still) return false;

  let images;
  try {
    // 3枚同時に読む。どれか1枚でも失敗したら静止画のまま（何も出さない）
    images = await Promise.all(['bg', 'pier', 'squid'].map((k) => loadImage(url(config.layers[k]))));
  } catch {
    return false;
  }
  if (!still.isConnected) return false;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = buildScene(config, images, lang);
  still.classList.add('is-replaced');
  frame.appendChild(scene.stage);
  art.appendChild(scene.callout);

  const anim = createAnimator(config, scene, { reduced, lang });
  bindInput(scene, anim);
  watchVisibility(scene.stage, anim);

  if (demo === 'hooked') anim.hook({ freeze: true });
  else anim.start();
  return true;
}

function pct(v, base) { return `${(v / base) * 100}%`; }

function buildScene(cfg, [bgImg, pierImg, squidImg], lang) {
  const { w: VW, h: VH } = cfg.viewBox;
  const C = cfg.colors;

  const stage = document.createElement('div');
  stage.className = 'ika-hero-stage';
  stage.setAttribute('role', 'button');
  stage.setAttribute('tabindex', '0');
  stage.setAttribute('aria-label', t(lang, 'タップしてイカを釣ろう', 'Tap to hook a squid'));

  // 1. 背景
  bgImg.className = 'ika-hero-layer ika-hero-layer--bg';
  bgImg.alt = '';
  bgImg.draggable = false;
  stage.appendChild(bgImg);

  // 2. 空と海の演出（太陽・照り返し・波）
  const fx = svgEl('svg', { class: 'ika-hero-fx', viewBox: `0 0 ${VW} ${VH}`, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  const defs = svgEl('defs');
  const gradId = `ika-sun-glow-${Math.random().toString(36).slice(2, 7)}`;
  const grad = svgEl('radialGradient', { id: gradId });
  grad.append(svgEl('stop', { offset: '55%', 'stop-color': C.sunGlow, 'stop-opacity': '0.55' }), svgEl('stop', { offset: '100%', 'stop-color': C.sunGlow, 'stop-opacity': '0' }));
  defs.appendChild(grad);
  fx.appendChild(defs);
  const sunGlow = svgEl('circle', { cx: cfg.sunCenter.x, cy: cfg.sunCenter.y, r: cfg.sunR * 1.45, fill: `url(#${gradId})` });
  const sun = svgEl('circle', { cx: cfg.sunCenter.x, cy: cfg.sunCenter.y, r: cfg.sunR, fill: C.sun });
  const shimmer = cfg.shimmer.map((s) => svgEl('ellipse', { cx: s.x, cy: s.y, rx: s.rx, ry: s.ry, fill: C.sunGlow, opacity: '0.16' }));
  const waves = cfg.waves.map(() => svgEl('path', { fill: 'none', stroke: C.wave, 'stroke-width': '3', 'stroke-linecap': 'round' }));
  fx.append(sunGlow, sun, ...shimmer, ...waves);
  stage.appendChild(fx);

  // 3. 堤防、4. イカ（箱の位置は % にして、どの画面幅でも同じ場所に載る）
  const placeLayer = (img, box, cls) => {
    img.className = `ika-hero-layer ${cls}`;
    img.alt = '';
    img.draggable = false;
    img.style.left = pct(box.x, VW);
    img.style.top = pct(box.y, VH);
    img.style.width = pct(box.w, VW);
    img.style.height = pct(box.h, VH);
    return img;
  };
  stage.appendChild(placeLayer(pierImg, cfg.pierBox, 'ika-hero-layer--pier'));
  const squid = placeLayer(squidImg, cfg.squidBox, 'ika-hero-layer--squid');
  squid.style.transformOrigin = `${pct(cfg.squidSeat.x - cfg.squidBox.x, cfg.squidBox.w)} ${pct(cfg.squidSeat.y - cfg.squidBox.y, cfg.squidBox.h)}`;
  stage.appendChild(squid);

  // 5. 竿と糸（いちばん上）
  const rig = svgEl('svg', { class: 'ika-hero-rig', viewBox: `0 0 ${VW} ${VH}`, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  const lineGlow = svgEl('path', { fill: 'none', stroke: C.glow, 'stroke-width': '12', 'stroke-linecap': 'round', opacity: '0.2' });
  const line = svgEl('path', { fill: 'none', stroke: C.ivory, 'stroke-width': '5', 'stroke-linecap': 'round', opacity: '0.9' });
  const rodOutline = svgEl('path', { fill: C.navy });
  const rodFill = svgEl('path', { fill: C.ivory });
  const guides = cfg.rodGuides.map(() => {
    const g = svgEl('g');
    g.append(svgEl('circle', { r: '11', fill: C.navy }), svgEl('circle', { r: '4', fill: C.ivory }));
    return g;
  });
  const restRipple = svgEl('ellipse', { cx: cfg.lineWater.x, cy: cfg.lineWater.y, rx: cfg.restRipple.rx, ry: cfg.restRipple.ry, fill: 'none', stroke: C.ivory, 'stroke-width': '4', opacity: '0.75' });
  const ripples = Array.from({ length: 4 }, () => svgEl('ellipse', { cx: cfg.lineWater.x, cy: cfg.lineWater.y, fill: 'none', stroke: C.glow, 'stroke-width': '3', opacity: '0' }));
  const splash = Array.from({ length: 10 }, () => svgEl('circle', { r: '7', fill: C.glow, opacity: '0' }));
  rig.append(lineGlow, line, restRipple, ...ripples, rodOutline, rodFill, ...guides, ...splash);
  stage.appendChild(rig);

  // 「抱いた！」の吹き出し（枠の外に置く：枠は overflow:hidden で傾いているため）
  const callout = document.createElement('div');
  callout.className = 'ika-hero-callout';
  callout.hidden = true;
  callout.setAttribute('aria-live', 'polite');
  const word = document.createElement('span');
  word.className = 'ika-hero-callout-word';
  word.textContent = t(lang, '抱いた！', 'Hooked!');
  const link = document.createElement('a');
  link.className = 'ika-hero-callout-link';
  link.href = pageHref('play', lang);
  link.textContent = t(lang, 'エギングゲームで遊ぶ →', 'Play the egi game →');
  callout.append(word, link);

  return { stage, callout, squid, sunGlow, shimmer, waves, lineGlow, line, rodOutline, rodFill, guides, restRipple, ripples, splash };
}

/* ------------------------------------------------------------------
   動き：requestAnimationFrame で SVG の属性を直接書き換える（依存なし・軽い）
   ------------------------------------------------------------------ */

function createAnimator(cfg, sc, { reduced, lang }) {
  const T = cfg.timing;
  const st = {
    running: false,
    raf: 0,
    t0: 0,
    now: 0,            // 経過秒
    nibbleAt: 0,       // 次のアタリの時刻
    hookAt: -Infinity, // 最後に抱いた時刻
    freeze: false,     // 開発用：抱いた姿勢で止める
    ripples: [],       // { start, big }
    splash: [],        // { x, y, vx, vy, start }
    calloutTimer: 0,
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const scheduleNibble = () => { st.nibbleAt = st.now + rand(T.nibbleMin, T.nibbleMax); };

  // 竿の形を「太さの変わる帯」として1本のパスにする（外側=紺、内側=アイボリー）
  const rodPath = (p0, c, p2, w0, w1, extra) => {
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
      left.push(`${(p.x + nx * hw).toFixed(1)},${(p.y + ny * hw).toFixed(1)}`);
      right.push(`${(p.x - nx * hw).toFixed(1)},${(p.y - ny * hw).toFixed(1)}`);
    }
    return `M${left.join('L')}L${right.reverse().join('L')}Z`;
  };

  // 1フレーム分の姿勢を計算して描く
  function draw(s) {
    const hookAge = s - st.hookAt;
    // 抱いたときの引き（0→1→0）。freeze 中は 1 のまま
    let pull = 0;
    if (st.freeze) pull = 1;
    else if (hookAge >= 0) {
      if (hookAge < T.hookRise) pull = easeOut(hookAge / T.hookRise);
      else if (hookAge < T.hookRise + T.hookHold) pull = 1 - 0.06 * Math.sin((hookAge - T.hookRise) * 9); // 引きの震え
      else pull = 1 - easeInOut(clamp01((hookAge - T.hookRise - T.hookHold) / T.hookRelease));
    }
    const hooked = hookAge >= 0 && (st.freeze || hookAge < T.hookRise + T.hookHold + T.hookRelease);

    // アタリ（2回続けて小さく引き込む）
    const nAge = s - st.nibbleAt;
    let dip = 0;
    if (!hooked && nAge >= 0 && nAge < T.nibbleLen) dip = Math.abs(Math.sin((nAge / T.nibbleLen) * TAU)) * (1 - nAge / T.nibbleLen) * 22;
    else if (!hooked && nAge >= T.nibbleLen) scheduleNibble();

    // 呼吸とひねり
    const breath = 1 + 0.0075 + 0.0075 * Math.sin((s / T.breath) * TAU);
    const yank = -4 * pull;
    sc.squid.style.transform = `rotate(${yank.toFixed(2)}deg) scaleY(${breath.toFixed(4)})`;

    // 竿：先端の休み位置＋揺れ＋アタリ＋引き
    const bob = 5 * Math.sin((s / 3.1) * TAU);
    const toWater = { x: cfg.lineWater.x - cfg.rodTipRest.x, y: cfg.lineWater.y - cfg.rodTipRest.y };
    const tip = {
      x: cfg.rodTipRest.x + dip * 0.25 + toWater.x * cfg.hookPull * pull,
      y: cfg.rodTipRest.y + bob + dip * 0.9 + toWater.y * cfg.hookPull * pull,
    };
    // 曲がりの制御点は先端ほど下げない：根元側は上を向いたまま、先だけ水面へ引き込まれて「しなる」
    const bend = {
      x: cfg.rodBend.x + toWater.x * 0.1 * pull + dip * 0.1,
      y: cfg.rodBend.y + bob * 0.5 + toWater.y * 0.12 * pull + dip * 0.5,
    };
    sc.rodOutline.setAttribute('d', rodPath(cfg.rodGrip, bend, tip, cfg.rodWidth.grip, cfg.rodWidth.tip, cfg.rodOutline));
    sc.rodFill.setAttribute('d', rodPath(cfg.rodGrip, bend, tip, cfg.rodWidth.grip, cfg.rodWidth.tip, 0));
    cfg.rodGuides.forEach((k, i) => {
      const p = bez(cfg.rodGrip, bend, tip, k);
      sc.guides[i].setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    });

    // 糸：休んでいるときは少したるんで揺れ、アタリ・抱いたときはピンと張る
    const taut = Math.max(pull, dip > 0 ? 0.5 : 0);
    const sway = (1 - taut) * (16 * Math.sin((s / 5.3) * TAU) + 6 * Math.sin((s / 1.7) * TAU));
    const mid = { x: (tip.x + cfg.lineWater.x) / 2 + sway, y: (tip.y + cfg.lineWater.y) / 2 };
    const d = `M${tip.x.toFixed(1)},${tip.y.toFixed(1)}Q${mid.x.toFixed(1)},${mid.y.toFixed(1)} ${cfg.lineWater.x},${cfg.lineWater.y}`;
    sc.line.setAttribute('d', d);
    sc.lineGlow.setAttribute('d', d);
    sc.line.setAttribute('opacity', (0.85 + 0.15 * taut).toFixed(2));
    sc.line.setAttribute('stroke-width', (5 + 2 * taut).toFixed(1));
    sc.lineGlow.setAttribute('opacity', (0.18 + 0.3 * taut).toFixed(2));
    sc.lineGlow.setAttribute('stroke-width', (12 + 10 * taut).toFixed(1));

    // 太陽の暈（ゆっくり脈打つ）と照り返し
    sc.sunGlow.setAttribute('opacity', (0.75 + 0.25 * Math.sin((s / 6) * TAU)).toFixed(3));
    sc.shimmer.forEach((e, i) => e.setAttribute('opacity', (0.12 + 0.1 * Math.sin((s / (2.4 + i * 0.35)) * TAU + i * 1.3)).toFixed(3)));

    // 波：位相をずらしながら流す
    cfg.waves.forEach((wv, i) => {
      const pts = [];
      const N = 26;
      for (let j = 0; j <= N; j++) {
        const x = lerp(wv.x0, wv.x1, j / N);
        const y = wv.y + wv.amp * Math.sin((x / wv.len) * TAU - s * wv.speed * TAU * 0.35 + i);
        pts.push(`${x.toFixed(0)},${y.toFixed(1)}`);
      }
      sc.waves[i].setAttribute('d', `M${pts.join('L')}`);
    });

    // 糸が入る点の輪（休み）、広がる波紋、しぶき
    const rr = 1 + 0.05 * Math.sin((s / 2.2) * TAU) + 0.35 * pull;
    setAttrs(sc.restRipple, { rx: (cfg.restRipple.rx * rr).toFixed(1), ry: (cfg.restRipple.ry * rr).toFixed(1) });
    st.ripples = st.ripples.filter((r) => s - r.start < 1.6);
    sc.ripples.forEach((e, i) => {
      const r = st.ripples[i];
      if (!r) { e.setAttribute('opacity', '0'); return; }
      const k = (s - r.start) / 1.6;
      const rx = (20 + 110 * k) * (r.big ? 1.7 : 1);
      setAttrs(e, { rx: rx.toFixed(1), ry: (rx * 0.38).toFixed(1), opacity: (0.7 * (1 - k)).toFixed(2) });
    });
    st.splash = st.splash.filter((p) => s - p.start < 0.75);
    sc.splash.forEach((e, i) => {
      const p = st.splash[i];
      if (!p) { e.setAttribute('opacity', '0'); return; }
      const a = s - p.start;
      setAttrs(e, { cx: (p.x + p.vx * a).toFixed(1), cy: (p.y - p.vy * a + 900 * a * a).toFixed(1), r: (p.r * (1 - a / 0.75)).toFixed(1), opacity: (0.95 * (1 - a / 0.75)).toFixed(2) });
    });
  }

  function frame(now) {
    if (!st.running) return;
    st.now = (now - st.t0) / 1000;
    draw(st.now);
    st.raf = requestAnimationFrame(frame);
  }

  const api = {
    start() {
      if (reduced) { draw(0); return; }   // 動きを減らす設定：休みの姿勢を1回描くだけ
      if (st.running) return;
      st.running = true;
      st.t0 = performance.now() - st.now * 1000;   // 止めていた間の時間は進めない
      if (st.nibbleAt < st.now + 1) st.nibbleAt = st.now + rand(2, 4);
      st.raf = requestAnimationFrame(frame);
    },
    stop() {
      st.running = false;
      cancelAnimationFrame(st.raf);
    },
    hook({ freeze = false } = {}) {
      st.freeze = freeze;
      const busy = st.now - st.hookAt < T.hookRise + T.hookHold;
      if (!busy || freeze) {
        st.hookAt = st.now;
        st.ripples.push({ start: st.now, big: true }, { start: st.now + 0.25, big: false });
        const w = cfg.lineWater;
        st.splash = Array.from({ length: 10 }, (_, i) => {
          const ang = lerp(-2.6, -0.5, i / 9) + rand(-0.15, 0.15);
          const sp = rand(260, 520);
          return { x: w.x, y: w.y, vx: Math.cos(ang) * sp * 0.55, vy: -Math.sin(ang) * sp, r: rand(5, 10), start: st.now };
        });
      }
      showCallout();
      if (reduced || freeze) draw(freeze ? st.now : 0);
      else api.start();
    },
  };

  function showCallout() {
    const c = sc.callout;
    c.hidden = false;
    c.classList.remove('is-pop');
    void c.offsetWidth; // 連続タップでも毎回ポンと出す（アニメーションをやり直す）
    c.classList.add('is-pop');
    clearTimeout(st.calloutTimer);
    if (st.freeze) return;
    const hide = () => {
      // 読んでいる・押そうとしている最中は消さない
      if (c.matches(':hover, :focus-within')) { st.calloutTimer = setTimeout(hide, 2000); return; }
      c.hidden = true;
    };
    st.calloutTimer = setTimeout(hide, T.calloutStay * 1000);
  }

  return api;
}

function bindInput(sc, anim) {
  sc.stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    anim.hook();
  });
  sc.stage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      anim.hook();
    }
  });
}

// 画面の外にあるとき・タブが隠れているときは止める（電池を食わない）
function watchVisibility(stage, anim) {
  let inView = true;
  const sync = () => (inView && !document.hidden ? anim.start() : anim.stop());
  if ('IntersectionObserver' in window) {
    inView = false;
    new IntersectionObserver((entries) => { inView = entries.some((en) => en.isIntersecting); sync(); }, { threshold: 0.05 }).observe(stage);
  }
  document.addEventListener('visibilitychange', sync);
}

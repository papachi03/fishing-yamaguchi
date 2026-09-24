// イカ部トップの「動くHERO」。
//
// 静止した SVG（hero-scene.js の sceneSVG。ビルド時に HTML へ書き込み済み）の要素を class で探し、
// requestAnimationFrame で属性を書き換えて動かす。JS が無くても静止画として成り立つ。
//
//  ・画面の縦横比に合わせて viewBox を決め直す（PC：右寄せで高さ基準／スマホ：文字の下の帯にイカ〜糸を収める）
//  ・ステッカー・吹き出し・「タップで釣る」ボタンは data-world="x,y"（世界座標）を持ち、同じ写像で置く
//  ・タップ→「抱いた！」の物語：アタリ → アワセ → ファイト（走る・ドラグ）→ 寄せ・浮上（墨）→ 取り込み → 休み
//  ・reduced-motion：動かさず吹き出しだけ。画面外・非表示タブでは止める
import { HERO_ANIM, TAU, lerp, bez, rodPose, rodPathD, lineD, waveD, computeViewBox, project } from './hero-scene.js';
import { t } from './i18n.js';
import { url } from '../base.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs = {}) => {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
const setAttrs = (e, attrs) => { for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); };
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
// バネのように行き過ぎて戻る（アワセ・着地）
const spring = (k) => 1 - Math.exp(-6 * k) * Math.cos(9 * k);
const f1 = (v) => v.toFixed(1);
const rand = (a, b) => a + Math.random() * (b - a);
const MOBILE = '(max-width: 760px)';

// 物語の区切り（秒）。合計 ≈ 7.6 秒
const STORY = {
  bite: 0,      // アタリ：糸が走る
  hookset: 0.4, // アワセ：竿を立てる。「抱いた！」
  fight: 0.9,   // ファイト：走る・ドラグが鳴る
  drag: 2.4,    // ドラグが滑る（〜2.9）
  rise: 4.5,    // 寄せ・浮上：墨を吐く
  land: 6.0,    // 取り込み：「ゲット！」
  settle: 7.0,  // 休みへ戻る（イカを外し、エギを投げ直す）
  end: 8.0,
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const im = new Image();
  im.onload = () => resolve(im);
  im.onerror = () => reject(new Error(`hero layer failed: ${src}`));
  im.src = src;
});

/* ------------------------------------------------------------------
   組み立て
   ------------------------------------------------------------------ */

// view: .ika-hero-view。demo（dev のみ）：'static' 動かさない／'fallback' レイヤー失敗を装う／
//   'hooked'（= phase:hookset）／'phase:bite|hookset|fight|drag|ink|landing' その場面で止める
export async function mountHeroAnim(view, { lang = 'ja', demo = null, config = HERO_ANIM } = {}) {
  if (!view) return false;
  const svg = view.querySelector('svg.ika-scene');
  if (!svg) return false;

  const sc = collect(view, svg, config);
  const layout = createLayout(view, svg, sc, config);
  layout.update();

  // レイヤー画像が読めなければ、静止画（元イラスト）を右側に敷いて SVG は隠す
  const files = demo === 'fallback'
    ? Object.fromEntries(Object.entries(config.layers).map(([k, v]) => [k, v.replace('/hero-layers/', '/hero-layers/_missing/')]))
    : config.layers;
  try {
    await Promise.all(Object.values(files).map((p) => loadImage(url(p))));
  } catch {
    showStill(view, config);
    return false;
  }
  if (demo === 'static') return true;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anim = createAnimator(config, sc, { reduced, lang });
  bindInput(view, sc, anim);
  watchVisibility(view, anim);

  if (demo && /^(hooked|phase:)/.test(demo)) {
    const phase = demo === 'hooked' ? 'hookset' : demo.slice('phase:'.length);
    anim.freezePhase(phase);
  }
  anim.start();
  return true;
}

function showStill(view, cfg) {
  view.classList.add('is-nolayers');
  const im = document.createElement('img');
  im.className = 'ika-hero-still';
  im.src = url(cfg.still);
  im.alt = '';
  view.querySelector('.ika-hero-scene')?.appendChild(im);
}

// SVG の要素と、HTML 側の付属品（ステッカー・吹き出し・ボタン）を集める。物語で使う部品はここで足す
function collect(view, svg, cfg) {
  const q = (s) => svg.querySelector(s);
  const qa = (s) => [...svg.querySelectorAll(s)];
  const C = cfg.colors;
  const sc = {
    view, svg,
    squid: q('.ika-sc-squid'),
    sunGlow: q('.ika-sc-sunglow'),
    shimmer: qa('.ika-sc-shimmer'),
    waves: qa('.ika-sc-wave'),
    lineGlow: q('.ika-sc-lineglow'),
    line: q('.ika-sc-line'),
    rodOutline: q('.ika-sc-rod-outline'),
    rod: q('.ika-sc-rod'),
    guides: qa('.ika-sc-guide'),
    restRipple: q('.ika-sc-restripple'),
    ripples: qa('.ika-sc-ripple'),
    splash: qa('.ika-sc-splash'),
    callout: view.querySelector('.ika-hero-callout'),
    calloutWord: view.querySelector('.ika-hero-callout-word'),
    calloutLink: view.querySelector('.ika-hero-callout-link'),
    dragTag: view.querySelector('.ika-hero-drag'),
    inkTag: view.querySelector('.ika-hero-ink'),
    worldEls: [...view.querySelectorAll('[data-world]')],
  };

  // 引き波（V字）・墨・釣れた小さなイカ（平らな絵柄：アイボリーに紺の縁）。糸の下、竿の上に置く
  sc.wake = svgEl('path', { class: 'ika-sc-wake', fill: 'none', stroke: C.glow, 'stroke-width': '3', 'stroke-linecap': 'round', opacity: '0' });
  // 墨：明るい縁（暗い海と分ける）＋濃い本体＋3方向へ伸びる筋
  sc.ink = svgEl('g', { class: 'ika-sc-ink', opacity: '0' });
  sc.inkRim = svgEl('ellipse', { fill: 'none', stroke: 'rgba(205, 240, 238, 0.6)', 'stroke-width': '4' });
  sc.inkBody = svgEl('ellipse', { fill: '#050c1a' });
  sc.inkArms = [0, 1, 2].map(() => svgEl('ellipse', { fill: '#050c1a' }));
  sc.ink.append(sc.inkRim, ...sc.inkArms, sc.inkBody);
  // 持ち上げたイカから落ちるしずく（墨2つ・水2つ）
  sc.drips = [0, 1, 2, 3].map((i) => svgEl('circle', { r: i < 2 ? '6' : '4', fill: i < 2 ? '#050c1a' : C.glow, opacity: '0' }));
  sc.catchG = svgEl('g', { class: 'ika-sc-catch', opacity: '0' });
  const body = 'M0,-52 L-18,-16 Q-26,6 -16,12 L-6,14 Q-9,30 -3,36 Q0,26 0,18 Q0,26 3,36 Q9,30 6,14 L16,12 Q26,6 18,-16 Z';
  sc.catchG.append(
    svgEl('path', { d: 'M0,-52 L-15,-32 L-11,-20 M0,-52 L15,-32 L11,-20', fill: C.ivory, stroke: C.navy, 'stroke-width': '5', 'stroke-linejoin': 'round' }),
    svgEl('path', { d: body, fill: C.ivory, stroke: C.navy, 'stroke-width': '5', 'stroke-linejoin': 'round' }),
    svgEl('circle', { cx: '-6', cy: '-2', r: '2.6', fill: C.navy }),
    svgEl('circle', { cx: '6', cy: '-2', r: '2.6', fill: C.navy }),
  );
  svg.insertBefore(sc.ink, sc.lineGlow);
  svg.insertBefore(sc.wake, sc.lineGlow);
  svg.insertBefore(sc.catchG, sc.rodOutline);
  sc.drips.forEach((d) => svg.insertBefore(d, sc.rodOutline));
  return sc;
}

/* ------------------------------------------------------------------
   画面への写像：viewBox と、data-world を持つ HTML 要素の位置
   ------------------------------------------------------------------ */
function createLayout(view, svg, sc, cfg) {
  const mq = matchMedia(MOBILE);
  const copy = view.querySelector('.ika-hero-copy');
  let vb = null;
  const update = () => {
    const w = view.clientWidth;
    const h = view.clientHeight;
    if (!w || !h) return;
    const mobile = mq.matches;
    // スマホ：文字ブロックの「中身の下端」まで（padding-bottom はシーンの帯なので含めない）
    const cta = copy?.querySelector('.ika-cta');
    const textH = mobile && cta ? cta.getBoundingClientRect().bottom - view.getBoundingClientRect().top : 0;
    vb = computeViewBox(cfg, w, h, { mobile, textH });
    svg.setAttribute('viewBox', `${f1(vb.x)} ${f1(vb.y)} ${f1(vb.w)} ${f1(vb.h)}`);
    svg.setAttribute('preserveAspectRatio', 'none'); // viewBox は表示領域と同じ比率なので歪まない
    for (const el of sc.worldEls) {
      // data-world-mobile があればスマホではそちら（縦長の帯では置き場所が変わる）
      const [wx, wy] = ((mobile && el.dataset.worldMobile) || el.dataset.world).split(',').map(Number);
      const p = project(vb, w, wx, wy);
      el.style.left = `${p.x.toFixed(0)}px`;
      el.style.top = `${p.y.toFixed(0)}px`;
      el.classList.add('is-placed');
    }
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(update);
    ro.observe(view);
    if (copy) ro.observe(copy);
  } else {
    addEventListener('resize', update);
  }
  return { update, get vb() { return vb; } };
}

/* ------------------------------------------------------------------
   動き
   ------------------------------------------------------------------ */
function createAnimator(cfg, sc, { reduced, lang }) {
  const T = cfg.timing;
  const st = {
    running: false, raf: 0, t0: 0, now: 0,
    nibbleAt: 0,
    hookAt: -Infinity,
    freeze: null,        // 物語の時刻（秒）で止める（開発用）
    ripples: [], splash: [],
    calloutTimer: 0,
  };
  const scheduleNibble = () => { st.nibbleAt = st.now + rand(T.nibbleMin, T.nibbleMax); };
  const seat = cfg.squidSeat;
  const pierPoint = { x: 1010, y: 885 };   // 寄せたときに糸が入る点（堤防の右下の手前）

  // ファイト中の入水点（ジグザグに走り、遠ざかる）
  // 右端（world.right）から出ないよう、左寄りに振る
  const runOffset = (f) => ({
    x: (-45 + Math.sin(f * 1.9) * 75) * Math.min(1, f / 0.6),
    y: -70 * (1 - Math.cos(Math.min(f, 2.2) * 1.3)) / 2,
  });

  // 物語の時刻 a（秒）から、その瞬間の姿勢を出す
  function story(a) {
    const o = { pull: 0, taut: 0, sway: 0, lean: 0, entry: { ...cfg.lineWater }, vel: { x: 0, y: 0 }, drag: 0, ink: 0, catch: null };
    if (a < STORY.bite || a >= STORY.end) return o;
    if (a < STORY.hookset) {
      // アタリ：たるんだ糸が横に跳ねてピンと伸びる
      const k = (a - STORY.bite) / (STORY.hookset - STORY.bite);
      o.sway = 55 * Math.sin(k * Math.PI * 2.5) * (1 - k * 0.5);
      o.taut = k;
      return o;
    }
    if (a < STORY.fight) {
      // アワセ：竿を立てる（バネで行き過ぎて戻る）、糸は張って明るい
      const k = (a - STORY.hookset) / (STORY.fight - STORY.hookset);
      o.pull = Math.min(1.15, spring(k) * 1.05);
      o.taut = 1;
      o.lean = -11 * spring(k);
      return o;
    }
    if (a < STORY.rise) {
      // ファイト：入水点がジグザグに走り、竿先がポンピングで跳ねる。途中でドラグが滑る
      const f = a - STORY.fight;
      const pump = Math.abs(Math.sin(f * 2.6));
      o.pull = 0.72 + 0.28 * pump;
      o.taut = 1;
      o.lean = -5 - 3 * pump;
      const r0 = runOffset(f);
      const r1 = runOffset(f + 0.05);
      const slip = a >= STORY.drag ? easeOut(clamp01((a - STORY.drag) / 0.5)) : 0;
      o.entry = { x: cfg.lineWater.x + r0.x - 40 * slip, y: cfg.lineWater.y + r0.y - 55 * slip };
      o.vel = { x: r1.x - r0.x, y: r1.y - r0.y };
      if (a >= STORY.drag && a < STORY.drag + 0.9) {
        o.drag = 1;
        o.pull = 0.55 + 0.1 * pump;   // 糸が出ていくぶん竿は少し戻る
      }
      return o;
    }
    // 寄せ：入水点が堤防のほうへ。浮いてきたイカと墨
    const rf = STORY.rise - STORY.fight;
    const riseEnd = { x: cfg.lineWater.x + runOffset(rf).x - 40, y: cfg.lineWater.y + runOffset(rf).y - 55 };
    if (a < STORY.land) {
      const k = easeInOut((a - STORY.rise) / (STORY.land - STORY.rise));
      o.entry = { x: lerp(riseEnd.x, pierPoint.x, k), y: lerp(riseEnd.y, pierPoint.y, k) };
      o.pull = lerp(0.8, 0.6, k);
      o.taut = 1;
      o.lean = -4;
      o.ink = clamp01((k - 0.15) / 0.7);
      const show = clamp01((k - 0.3) / 0.4);
      o.catch = { x: o.entry.x, y: o.entry.y + 30 * (1 - show), scale: 0.6 + 0.4 * show, rot: 70 - 20 * show, opacity: show, alongLine: 0 };
      return o;
    }
    if (a < STORY.settle) {
      // 取り込み：糸の先（＝イカ）が糸に沿って持ち上がる。糸はイカで終わり、海には残らない
      const k = easeInOut((a - STORY.land) / (STORY.settle - STORY.land));
      o.entry = { ...pierPoint };
      o.pull = lerp(0.6, 0.25, k);
      o.taut = 1;
      o.lean = -4 + 6 * k;
      o.ink = 1 - k * 0.6;
      o.catch = { x: pierPoint.x, y: pierPoint.y, scale: 1, rot: 20 - 20 * k, opacity: 1, alongLine: 0.42 * k };
      o.lineTo = 'catch';
      return o;
    }
    // 休みへ：イカを外して、エギを投げ直す（糸の先が弧を描いて元の入水点へ落ちる）
    const k = (a - STORY.settle) / (STORY.end - STORY.settle);
    o.entry = { ...cfg.lineWater };
    o.pull = 0.25 * (1 - easeInOut(k));
    o.taut = 1 - k;
    o.lean = 2 * (1 - k);
    o.ink = 0.4 * (1 - k);
    o.catch = { x: pierPoint.x, y: pierPoint.y, scale: 1, rot: 0, opacity: 1 - clamp01(k / 0.3), alongLine: 0.42 };
    o.lineTo = 'drop';
    o.dropK = clamp01((k - 0.15) / 0.75);
    return o;
  }

  function draw(s) {
    const a = st.freeze != null ? st.freeze : s - st.hookAt;
    const inStory = a >= 0 && a < STORY.end;
    const o = story(inStory ? a : -1);

    // アタリ（物語の外でだけ）
    const nAge = s - st.nibbleAt;
    let dip = 0;
    if (!inStory && nAge >= 0 && nAge < T.nibbleLen) dip = Math.abs(Math.sin((nAge / T.nibbleLen) * TAU)) * (1 - nAge / T.nibbleLen) * 22;
    else if (!inStory && nAge >= T.nibbleLen) scheduleNibble();

    // イカ（釣り人）：呼吸とのけぞり
    const breath = 1 + 0.0075 + 0.0075 * Math.sin((s / T.breath) * TAU);
    sc.squid.setAttribute('transform', `translate(${seat.x} ${seat.y}) rotate(${f1(o.lean)}) scale(1 ${breath.toFixed(4)}) translate(${-seat.x} ${-seat.y})`);

    // 竿
    const bob = 5 * Math.sin((s / 3.1) * TAU);
    const { tip, bend } = rodPose(cfg, { pull: o.pull, dip, bob });
    sc.rodOutline.setAttribute('d', rodPathD(cfg.rodGrip, bend, tip, cfg.rodWidth.grip, cfg.rodWidth.tip, cfg.rodOutline));
    sc.rod.setAttribute('d', rodPathD(cfg.rodGrip, bend, tip, cfg.rodWidth.grip, cfg.rodWidth.tip));
    cfg.rodGuides.forEach((k, i) => {
      const p = bez(cfg.rodGrip, bend, tip, k);
      sc.guides[i].setAttribute('transform', `translate(${f1(p.x)} ${f1(p.y)})`);
    });

    // 糸の先：ふだんは入水点。取り込み中は持ち上げたイカ、投げ直し中は弧を描いて落ちるエギ
    const liftPoint = { x: lerp(pierPoint.x, tip.x, 0.42), y: lerp(pierPoint.y, tip.y, 0.42) };
    let lineEnd = o.entry;
    if (o.lineTo === 'catch') lineEnd = { x: lerp(pierPoint.x, tip.x, o.catch.alongLine), y: lerp(pierPoint.y, tip.y, o.catch.alongLine) };
    else if (o.lineTo === 'drop') {
      const k = o.dropK;
      lineEnd = { x: lerp(liftPoint.x, cfg.lineWater.x, k), y: lerp(liftPoint.y, cfg.lineWater.y, k * k) - 90 * Math.sin(Math.PI * k) };
    }
    const inWater = !o.lineTo || (o.lineTo === 'drop' && o.dropK >= 1);

    // 糸：休みはたるんで揺れ、張ると真っ直ぐで明るい
    const taut = Math.max(o.taut, dip > 0 ? 0.5 : 0);
    const idleSway = (1 - taut) * (16 * Math.sin((s / 5.3) * TAU) + 6 * Math.sin((s / 1.7) * TAU));
    const d = lineD(tip, lineEnd, inWater ? idleSway + o.sway : 0);
    sc.line.setAttribute('d', d);
    sc.lineGlow.setAttribute('d', d);
    sc.line.setAttribute('opacity', (0.85 + 0.15 * taut).toFixed(2));
    sc.line.setAttribute('stroke-width', (5 + 2 * taut).toFixed(1));
    sc.lineGlow.setAttribute('opacity', (0.18 + 0.3 * taut).toFixed(2));
    sc.lineGlow.setAttribute('stroke-width', (12 + 10 * taut).toFixed(1));

    // 入水点の輪・引き波（V字。水面なので縦は半分に潰す）
    const rr = 1 + 0.05 * Math.sin((s / 2.2) * TAU) + 0.3 * o.pull;
    setAttrs(sc.restRipple, { cx: f1(o.entry.x), cy: f1(o.entry.y), rx: f1(cfg.restRipple.rx * rr), ry: f1(cfg.restRipple.ry * rr), opacity: inWater ? '0.75' : '0' });
    const speed = Math.hypot(o.vel.x, o.vel.y);
    if (speed > 0.5) {
      const ux = o.vel.x / speed;
      const uy = o.vel.y / speed;
      const L = 110;
      const e = o.entry;
      const b = { x: e.x - ux * L, y: e.y - uy * L * 0.5 };
      const nx = -uy * L * 0.3;
      const ny = ux * L * 0.15;
      sc.wake.setAttribute('d', `M${f1(b.x + nx)},${f1(b.y + ny)}L${f1(e.x)},${f1(e.y)}L${f1(b.x - nx)},${f1(b.y - ny)}`);
      sc.wake.setAttribute('opacity', Math.min(0.8, speed / 12).toFixed(2));
    } else {
      sc.wake.setAttribute('opacity', '0');
    }

    // 墨：ぷしゅっと広がって薄れる。縁は明るく、筋は3方向へ伸びる
    if (o.ink > 0) {
      const g = o.ink;
      const cx = o.entry.x - 40 * g;
      const cy = o.entry.y + 8;
      const rx = 40 + 200 * g;
      const ry = 14 + 60 * g;
      setAttrs(sc.inkBody, { cx: f1(cx), cy: f1(cy), rx: f1(rx), ry: f1(ry) });
      setAttrs(sc.inkRim, { cx: f1(cx), cy: f1(cy), rx: f1(rx + 6), ry: f1(ry + 4) });
      sc.inkArms.forEach((e, i) => {
        const ang = [-0.9, 0.25, 1.15][i];
        const len = (60 + 110 * g) * [1, 0.8, 0.9][i];
        const ax = cx + Math.cos(ang) * len * 0.9;
        const ay = cy + Math.sin(ang) * len * 0.3;
        setAttrs(e, { cx: f1(ax), cy: f1(ay), rx: f1(len * 0.55), ry: f1(10 + 22 * g), transform: `rotate(${(ang * 18).toFixed(1)} ${f1(ax)} ${f1(ay)})` });
      });
      sc.ink.setAttribute('opacity', (0.92 * (1 - g * 0.35)).toFixed(2));
    } else {
      sc.ink.setAttribute('opacity', '0');
    }
    if (sc.inkTag) sc.inkTag.hidden = !(o.ink > 0.05 && o.ink < 0.85 && !o.catch?.alongLine);
    if (o.catch) {
      const c = o.catch;
      // 取り込みでは糸に沿って持ち上げる（入水点→竿先）。持ち上がったら糸に吊られて少し揺れる
      const px = lerp(c.x, tip.x, c.alongLine);
      const py = lerp(c.y, tip.y, c.alongLine);
      const swing = c.alongLine ? 7 * Math.sin(s * 7.5) * Math.min(1, c.alongLine / 0.2) : 0;
      sc.catchG.setAttribute('transform', `translate(${f1(px)} ${f1(py)}) rotate(${f1(c.rot + swing)}) scale(${(3.2 * c.scale).toFixed(3)})`);
      sc.catchG.setAttribute('opacity', c.opacity.toFixed(2));
      // しずく：持ち上がっているあいだ、触手の先から落ちる
      sc.drips.forEach((d, i) => {
        if (!c.alongLine) { d.setAttribute('opacity', '0'); return; }
        const ph = (s * 1.3 + i * 0.27) % 1;
        setAttrs(d, { cx: f1(px + [-14, 12, -4, 20][i] + swing * 5), cy: f1(py + 110 + ph * ph * 160), opacity: (c.opacity * (1 - ph) * 0.9).toFixed(2) });
      });
    } else {
      sc.catchG.setAttribute('opacity', '0');
      sc.drips.forEach((d) => d.setAttribute('opacity', '0'));
    }
    if (sc.dragTag) sc.dragTag.hidden = !o.drag;

    // 太陽の暈・照り返し・波
    sc.sunGlow.setAttribute('opacity', (0.75 + 0.25 * Math.sin((s / 6) * TAU)).toFixed(3));
    sc.shimmer.forEach((e, i) => e.setAttribute('opacity', (0.12 + 0.1 * Math.sin((s / (2.4 + i * 0.35)) * TAU + i * 1.3)).toFixed(3)));
    cfg.waves.forEach((wv, i) => sc.waves[i].setAttribute('d', waveD(cfg, wv, i, s)));

    // 広がる波紋・しぶき
    st.ripples = st.ripples.filter((r) => s - r.start < 1.6);
    sc.ripples.forEach((e, i) => {
      const r = st.ripples[i];
      if (!r) { e.setAttribute('opacity', '0'); return; }
      const k = (s - r.start) / 1.6;
      const rx = (20 + 110 * k) * (r.big ? 1.7 : 1);
      setAttrs(e, { cx: f1(r.x), cy: f1(r.y), rx: f1(rx), ry: f1(rx * 0.38), opacity: (0.7 * (1 - k)).toFixed(2) });
    });
    st.splash = st.splash.filter((p) => s - p.start < 0.75);
    sc.splash.forEach((e, i) => {
      const p = st.splash[i];
      if (!p) { e.setAttribute('opacity', '0'); return; }
      const age = s - p.start;
      setAttrs(e, { cx: f1(p.x + p.vx * age), cy: f1(p.y - p.vy * age + 900 * age * age), r: f1(p.r * (1 - age / 0.75)), opacity: (0.95 * (1 - age / 0.75)).toFixed(2) });
    });

    if (inStory && st.freeze == null) fireEvents(a, o);
    else if (st.freezeBurst && !st.splash.length) burst(st.freezeBurst);   // 止めた場面のしぶきを繰り返す（開発用）
  }

  // 前フレームから今フレームの間に通過した節目を一度だけ起こす（吹き出し・しぶき・波紋）
  let lastA = -1;
  function fireEvents(a, o) {
    const passed = (tm) => lastA < tm && a >= tm;
    if (passed(STORY.bite + 0.05)) st.ripples.push({ start: st.now, x: o.entry.x, y: o.entry.y, big: false });
    if (passed(STORY.hookset)) { showCallout('hooked'); st.ripples.push({ start: st.now, x: o.entry.x, y: o.entry.y, big: true }); }
    if (passed(STORY.rise + 0.5)) st.ripples.push({ start: st.now, x: o.entry.x, y: o.entry.y, big: true });
    if (passed(STORY.land)) { burst(o.entry); showCallout('got'); }
    // 投げ直したエギが着水（dropK が 1 になる時刻）：小さなしぶきと波紋
    if (passed(STORY.settle + (STORY.end - STORY.settle) * 0.9)) { burst(cfg.lineWater, 6); st.ripples.push({ start: st.now, x: cfg.lineWater.x, y: cfg.lineWater.y, big: true }); }
    lastA = a;
  }
  function burst(at, n = 10) {
    st.splash = Array.from({ length: n }, (_, i) => {
      const ang = lerp(-2.6, -0.5, i / (n - 1)) + rand(-0.15, 0.15);
      const sp = rand(260, 520);
      return { x: at.x, y: at.y, vx: Math.cos(ang) * sp * 0.55, vy: -Math.sin(ang) * sp, r: rand(5, 10), start: st.now };
    });
  }

  function showCallout(kind) {
    const c = sc.callout;
    if (!c) return;
    const got = kind === 'got';
    if (sc.calloutWord) sc.calloutWord.textContent = got ? t(lang, 'ゲット！', 'Got it!') : t(lang, '抱いた！', 'Hooked!');
    if (sc.calloutLink) sc.calloutLink.hidden = !got;
    c.hidden = false;
    c.classList.remove('is-pop');
    void c.offsetWidth; // 毎回ポンと出し直す
    c.classList.add('is-pop');
    clearTimeout(st.calloutTimer);
    if (st.freeze != null || !got) return;   // 「抱いた！」は「ゲット！」に置き換わるまで出しておく
    const hide = () => {
      if (c.matches(':hover, :focus-within')) { st.calloutTimer = setTimeout(hide, 2000); return; }
      c.hidden = true;
    };
    st.calloutTimer = setTimeout(hide, T.calloutStay * 1000);
  }

  function frame(now) {
    if (!st.running) return;
    st.now = (now - st.t0) / 1000;
    draw(st.now);
    st.raf = requestAnimationFrame(frame);
  }

  const api = {
    start() {
      if (reduced) { draw(0); return; }
      if (st.running) return;
      st.running = true;
      st.t0 = performance.now() - st.now * 1000;   // 止めていた間は進めない（物語も途中から続く）
      if (st.nibbleAt < st.now + 1) st.nibbleAt = st.now + rand(2, 4);
      st.raf = requestAnimationFrame(frame);
    },
    stop() {
      st.running = false;
      cancelAnimationFrame(st.raf);
    },
    // タップ：休み中なら物語を始める。ファイト中にもう一度押すと寄せまで飛ばして早く終わる
    hook() {
      if (reduced) { showCallout('got'); return; }
      const a = st.now - st.hookAt;
      if (a >= 0 && a < STORY.end) {
        if (a < STORY.rise) { st.hookAt = st.now - STORY.rise; lastA = STORY.rise - 0.001; }
        return;
      }
      st.hookAt = st.now;
      lastA = -1;
      api.start();
    },
    // 開発用：物語のある場面で止める
    freezePhase(name) {
      const at = { bite: 0.2, hookset: 0.62, fight: 1.9, drag: 2.7, ink: 5.3, landing: 6.7 }[name];
      if (at == null) return;
      st.freeze = at;
      if (at >= STORY.hookset) showCallout(at >= STORY.land ? 'got' : 'hooked');
      if (name === 'landing') st.freezeBurst = story(at).entry;
    },
  };
  return api;
}

function bindInput(view, sc, anim) {
  // 画面のどこを押しても釣れる。ただし文字・ボタン・リンクの上は除く
  view.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('a, button, .ika-hero-copy, .ika-hero-callout')) return;
    anim.hook();
  });
  view.querySelector('.ika-hook-btn')?.addEventListener('click', () => anim.hook());
}

// 画面の外・非表示タブでは止める（電池を食わない）
function watchVisibility(view, anim) {
  let inView = true;
  const sync = () => (inView && !document.hidden ? anim.start() : anim.stop());
  if ('IntersectionObserver' in window) {
    inView = false;
    new IntersectionObserver((entries) => { inView = entries.some((en) => en.isIntersecting); sync(); }, { threshold: 0.05 }).observe(view);
  }
  document.addEventListener('visibilitychange', sync);
}

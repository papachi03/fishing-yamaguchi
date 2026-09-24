// しゃくって抱かせろ！の画面側。判定は egi.js（純粋ロジック）に任せ、ここは
//   1. ボタン・画面・キーボードの入力を press / release に変える
//   2. 毎フレーム tick(dt) を呼び、返ってきた出来事（events）で見た目の状態を切り替える
//   3. SVG の舞台（egi-scene.js）の上に、竿・糸・エギ・イカ・墨を描く
//   4. 結果カード・釣行のまとめ・記録（localStorage）を出す
//
// 見た目の決まり（釣り人が見て違和感の無いように）：
//   ・イカはフォール中にだけ寄ってきて、エギを足で抱く。抱いたイカは胴が外（沖）を向いて走る
//   ・釣り上げたイカは足が上（エギ側）、胴が下に垂れる。糸は必ず竿先→エギ（イカ）で終わる
//   ・根掛かりは底にいる時だけ。墨は水面まで寄せた時に吐く
import { createEgi, press, release, tick, speciesPool, seasonOf, totalWeight, CASTS, EGI_STOCK, SIGNAL_LATE } from './egi.js';
import { SCENE, PALETTE, egiSceneSVG, seabedD, rocksSVG, depthY, distX } from './egi-scene.js';
import { svgEl, egiShape, huggingSquid, swimmingSquid, ART } from '../squid-art.js';
import { rodPathD, lerp } from '../hero-scene.js';
import { EGI_TEXT as TX, TOD, SEASON, speciesName, speciesById, YAMAGUCHI_SQUID } from './play-text.js';
import { aroundHTML } from '../views/play.js';
import { readJSON, writeJSON, recordEgi, emptyEgi, KEY_EGI } from './records.js';
import { photoById } from '../data.js';
import { t, esc, assetHref, pageHref } from '../i18n.js';

const f1 = (v) => v.toFixed(1);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const setAttrs = (e, attrs) => { for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); };
// 胴の向き m（単位ベクトル）→ 回転角（度）。部品は +y が胴の先なので (−sinθ, cosθ) = m
const angleOf = (mx, my) => (Math.atan2(-mx, my) * 180) / Math.PI;
// 角度の差を −180〜180 に畳む（最短の向きに回す）
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const mantleUnits = (cm) => clamp(cm * 3.4, 26, 120);   // 胴長 cm → 描画単位（エギ ≈ 10cm ≈ 36 単位）

export function mountEgi(root, { lang = 'ja', demo = null } = {}) {
  if (!root) return null;
  const q = (id) => root.querySelector(`#${id}`);
  const el = {
    stage: q('ika-egi-stage'), scene: q('ika-egi-scene'), btn: q('ika-egi-btn'),
    casts: q('ika-egi-casts'), egis: q('ika-egi-egis'),
    count: q('ika-egi-count'), countLabel: q('ika-egi-count-label'), countNum: q('ika-egi-count-num'), depth: q('ika-egi-depth'),
    callout: q('ika-egi-callout'), flash: q('ika-egi-flash'), card: q('ika-egi-card'),
    power: q('ika-egi-power'), tension: q('ika-egi-tension'), dist: q('ika-egi-dist'), log: q('ika-egi-log'),
    setup: q('ika-egi-setup'), tod: q('ika-egi-tod'), month: q('ika-egi-month'), season: q('ika-egi-season'), hint: q('ika-egi-hint'), around: q('ika-egi-around'), locked: q('ika-egi-locked'),
    catches: q('ika-egi-catches'), records: q('ika-egi-records'),
  };
  const powerFill = el.power.querySelector('.ika-egi-gauge-fill');
  const tensionFill = el.tension.querySelector('.ika-egi-gauge-fill');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 設定と記録 ---------- */
  const settings = { month: new Date().getMonth() + 1, tod: 'evening' };
  let rec = readJSON(KEY_EGI) ?? emptyEgi();
  let s = null;            // ゲームの状態（egi.js）
  let W = SCENE.W0;        // 舞台の幅（表示領域の比率で決まる）
  let now = 0;             // 経過秒
  let frozen = false;      // 開発用：判定を止めて見た目だけ動かす
  let castAt = 0;
  let hookDepth = 0;       // 掛かった時の深さ・距離（寄せるほど浮いてくる）
  let hookDist = 1;
  let inked = false;
  let firstSpecies = [];

  /* ---------- 見た目の状態 ---------- */
  const V = {
    egi: { x: 0, y: 0, ang: 0, mode: 'tip' },       // tip（竿先にぶら下がる）/ flight / water / stuck / lift
    flight: null,                                    // { t0, from, to, dur, mode }
    hug: { on: false, x: 0, y: 0, ang: 0, alpha: 0, node: null },
    swim: [0, 1].map(() => ({ x: 0, y: 0, ang: -90, alpha: 0, node: null, species: 'aori', len: 50 })),
    escape: null,                                    // 逃げていくイカ { node, x, y, ang, t0 }
    ink: null,                                       // { t0, x, y }
    land: null,                                      // 取り込み { t0, from }
    jerkAt: -9, castSwing: -9, ripples: [], splash: [], entry: null,
    lineBroken: false, ghost: null,                  // 根掛かりで残したエギ
    lastJet: -9,
  };

  /* ---------- 舞台の組み立て ---------- */
  let sc = null;   // SVG の要素
  function buildScene() {
    const bottom = s?.bottom || 8;
    el.scene.innerHTML = egiSceneSVG({ lang, tod: settings.tod, W, bottom, assetHref });
    const svg = el.scene.querySelector('svg');
    sc = {
      svg,
      under: svg.querySelector('.ika-eg-under'), air: svg.querySelector('.ika-eg-air'), bottomG: svg.querySelector('.ika-eg-bottom'),
      rod: svg.querySelector('.ika-eg-rod'), rodOutline: svg.querySelector('.ika-eg-rod-outline'), line: svg.querySelector('.ika-eg-line'),
      wave: svg.querySelector('.ika-eg-wave'), ripples: [...svg.querySelectorAll('.ika-eg-ripple')], splash: [...svg.querySelectorAll('.ika-eg-splash')],
    };
    // 動く部品（1回だけ作り、舞台を作り直したときは付け直す）
    if (!sc.nodes) sc.nodes = makeNodes();
    const n = sc.nodes;
    sc.under.append(n.swim[0], n.swim[1], n.escape, n.ink, n.ghost, n.egiWater, n.hugWater, n.jet);
    sc.air.append(n.entry, n.egiAir, n.hugAir, ...n.drips);
    updateBottom(bottom);
    if (s) draw(0);   // 作り直した直後に1回描く（ループが止まっていても竿と糸が出るように）
  }
  function makeNodes() {
    const mk = (cls) => svgEl('g', { class: cls, opacity: '0' });
    const n = {
      swim: V.swim.map(() => mk('ika-eg-swim')),
      escape: mk('ika-eg-escape'),
      ink: svgEl('g', { class: 'ika-eg-ink', opacity: '0' }),
      ghost: mk('ika-eg-ghost'),
      egiWater: mk('ika-eg-egi'), egiAir: mk('ika-eg-egi'),
      hugWater: mk('ika-eg-hug'), hugAir: mk('ika-eg-hug'),
      jet: svgEl('ellipse', { class: 'ika-eg-jet', fill: '#dff6f8', opacity: '0' }),
      entry: svgEl('ellipse', { class: 'ika-eg-entry', rx: '10', ry: '3.5', fill: 'none', stroke: '#fff', 'stroke-width': '2', opacity: '0' }),
      drips: [0, 1, 2].map((i) => svgEl('circle', { r: i === 0 ? '4' : '3', fill: i === 0 ? '#050c1a' : '#dff6f8', opacity: '0' })),
    };
    n.egiWater.append(egiShape());
    n.egiAir.append(egiShape());
    n.ghost.append(egiShape());
    n.inkBody = svgEl('ellipse', { fill: '#050c1a' });
    n.inkRim = svgEl('ellipse', { fill: 'none', stroke: 'rgba(205,240,238,0.6)', 'stroke-width': '3' });
    n.inkArms = [0, 1, 2].map(() => svgEl('ellipse', { fill: '#050c1a' }));
    n.ink.append(n.inkRim, ...n.inkArms, n.inkBody);
    return n;
  }
  // 海底：投げるたびに深さが変わる
  function updateBottom(bottom) {
    sc.bottomG.innerHTML = `<path class="ika-eg-seabed" d="${seabedD(bottom, W, s?.casts ?? 0)}" fill="#c9b787" stroke="#0b2a33" stroke-width="3" />${rocksSVG(bottom, W, s?.casts ?? 0)}`;
  }
  // 気配のイカ・抱いたイカの絵は、種類が決まるたびに作り直す
  function setSquidArt(node, kind, species, len) {
    node.innerHTML = '';
    node.append(kind === 'hug' ? huggingSquid({ species, len }) : swimmingSquid({ species, len, colors: { ...ART, ivory: '#8fb6bf', navy: '#0e2733' } }));
  }
  function relayout() {
    const w = el.stage.clientWidth;
    const h = el.stage.clientHeight;
    if (!w || !h) return;
    const nextW = Math.round(SCENE.H * (w / h));
    if (Math.abs(nextW - W) < 4 && sc) return;
    W = nextW;
    buildScene();
  }

  /* ---------- 座標 ---------- */
  const X = (dist) => distX(dist, W);
  const Y = (depth) => depthY(depth);
  const tipRest = () => rodGeom(SCENE.rod.rest, 0, null).tip;
  // 釣り上げたイカを吊る点：胴の先が水面から出る高さ（大物は胴の先が水に残ってもよい＝竿先より下）
  const hangPoint = () => ({ x: SCENE.pierRight + 46, y: Math.max(SCENE.surface - 30 - (V.hug.height ?? 130), tipRest().y + 50) });

  // 竿：握りから角度 ang（度、右上向き）に伸び、pull（0〜1）で先が target に引かれてしなる
  function rodGeom(ang, pull, target) {
    const R = SCENE.rod;
    const a = (ang * Math.PI) / 180;
    const dir = { x: Math.cos(a), y: -Math.sin(a) };
    const tip0 = { x: SCENE.grip.x + dir.x * R.len, y: SCENE.grip.y + dir.y * R.len };
    let tip = tip0;
    if (target && pull > 0) tip = { x: tip0.x + (target.x - tip0.x) * 0.28 * pull, y: tip0.y + (target.y - tip0.y) * 0.28 * pull };
    const bend = { x: SCENE.grip.x + dir.x * R.len * 0.52 + (tip.x - tip0.x) * 0.15, y: SCENE.grip.y + dir.y * R.len * 0.52 + (tip.y - tip0.y) * 0.15 };
    return { tip, bend };
  }

  /* ---------- ゲームの作り直し ---------- */
  function newGame() {
    s = createEgi({ month: settings.month, tod: settings.tod });
    castAt = 0; inked = false; firstSpecies = [];
    V.egi.mode = 'tip'; V.flight = null; V.hug.on = false; V.hug.alpha = 0; V.escape = null; V.ink = null; V.land = null; V.lineBroken = false; V.ghost = null;
    V.swim.forEach((w, i) => { w.alpha = 0; w.x = W + 100 + i * 80; w.y = Y(4); });
    const pool = speciesPool(settings.month, settings.tod);
    V.swim.forEach((w, i) => { w.species = (pool[i] ?? pool[0]).id; w.len = 44 + i * 10; setSquidArt(sc.nodes.swim[i], 'swim', w.species, w.len); });
    const tp = tipRest();
    V.egi.x = tp.x; V.egi.y = tp.y + 30; V.egi.ang = 0;
    el.card.hidden = true;
    el.flash.hidden = true;
    el.catches.innerHTML = `<li class="ika-egi-catch-empty">${t(lang, 'まだ釣れていない', 'Nothing yet')}</li>`;
    updateBottom(8);
    syncStock();
    syncSetupLock();
    setButton();
  }

  /* ---------- 設定パネル ---------- */
  function syncSetup() {
    el.tod.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tod === settings.tod)));
    el.month.value = String(settings.month);
    el.season.textContent = t(lang, SEASON[seasonOf(settings.month)]);
    el.hint.textContent = t(lang, TX.setup.hint[settings.tod]);
    el.around.innerHTML = aroundHTML(lang, settings.month, settings.tod);
  }
  const started = () => s && !(s.phase === 'ready' && s.casts === CASTS) && s.phase !== 'over';
  function syncSetupLock() {
    const lock = started();
    el.tod.querySelectorAll('.ika-chip').forEach((b) => { b.disabled = lock; });
    el.month.disabled = lock;
    el.locked.hidden = !lock;
  }
  el.tod.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-tod]');
    if (!b || started()) return;
    settings.tod = b.dataset.tod;
    syncSetup();
    buildScene();
    newGame();
  });
  el.month.addEventListener('change', () => {
    if (started()) { syncSetup(); return; }
    settings.month = Number(el.month.value) || settings.month;
    syncSetup();
    newGame();
  });

  /* ---------- HUD ---------- */
  function syncStock() {
    [...el.casts.children].forEach((i, k) => i.classList.toggle('is-used', k >= s.casts));
    [...el.egis.children].forEach((i, k) => i.classList.toggle('is-used', k >= s.egi));
  }
  const last = { btn: '', count: '', label: '', depth: '', dist: '' };
  function setButton() {
    const key = s.phase === 'over' ? 'over' : s.phase === 'result' ? 'result' : s.phase === 'aiming' ? 'aiming' : s.phase === 'signal' ? 'signal' : s.phase === 'fight' ? 'fight' : s.phase === 'ready' ? 'ready' : 'sink';
    if (last.btn === key) return;
    last.btn = key;
    el.btn.textContent = t(lang, TX.btn[key]);
    el.btn.dataset.phase = key;
    el.power.hidden = key !== 'aiming';
    el.tension.hidden = key !== 'fight';
  }
  function setText(node, keyName, value) {
    if (last[keyName] === value) return;
    last[keyName] = value;
    node.textContent = value;
  }
  let calloutTimer = 0;
  function callout(text, tone = '') {
    el.callout.textContent = text;
    el.callout.className = `ika-egi-callout${tone ? ` is-${tone}` : ''}`;
    el.callout.hidden = false;
    el.callout.classList.remove('is-pop');
    void el.callout.offsetWidth;
    el.callout.classList.add('is-pop');
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => { el.callout.hidden = true; }, 1700);
    el.log.textContent = text;
  }

  /* ---------- 出来事 → 見た目 ---------- */
  function onEvents(events) {
    for (const e of events) {
      switch (e.type) {
        case 'cast': {
          castAt = s.t;
          updateBottom(s.bottom);
          const tp = tipRest();
          V.flight = { t0: now, from: { x: tp.x, y: tp.y }, to: { x: X(s.castDist), y: SCENE.surface }, dur: 0.55 + s.castDist / 100, mode: 'cast' };
          V.egi.mode = 'flight';
          V.castSwing = now;
          V.lineBroken = false;
          callout(t(lang, TX.msg.cast));
          syncStock();
          syncSetupLock();
          break;
        }
        case 'jerk':
          V.jerkAt = now;
          break;
        case 'rhythm':
          callout(t(lang, TX.msg.rhythm[clamp(e.streak, 1, 5)]), e.streak >= 2 && e.streak <= 3 ? 'good' : e.streak >= 5 ? 'bad' : '');
          break;
        case 'signal': {
          const h = s.hooking;
          V.hug.on = true; V.hug.alpha = 1; V.hug.x = V.egi.x; V.hug.y = V.egi.y; V.hug.ang = V.egi.ang; V.hug.t0 = now;
          setSquidArt(sc.nodes.hugWater, 'hug', h.id, mantleUnits(h.mantle));
          setSquidArt(sc.nodes.hugAir, 'hug', h.id, mantleUnits(h.mantle));
          V.hug.height = (44 * clamp(mantleUnits(h.mantle) / 56, 0.75, 1.8) + mantleUnits(h.mantle)) * 1.15;
          V.swim.forEach((w) => { w.alpha = 0; });
          el.flash.hidden = false;
          el.log.textContent = t(lang, TX.msg.signal);
          break;
        }
        case 'hook':
          el.flash.hidden = true;
          hookDepth = Math.max(0.6, s.depth);
          hookDist = Math.max(s.dist, 1);
          inked = false;
          callout(t(lang, TX.msg.hook), 'good');
          break;
        case 'miss':
        case 'let-go':
          el.flash.hidden = true;
          escapeSquid();
          callout(t(lang, e.type === 'miss' ? TX.msg.miss : TX.msg.letgo), 'bad');
          break;
        case 'jet':
          V.lastJet = now;
          if (now - (V.jetCallout ?? -9) > 2.5) { callout(t(lang, TX.msg.jet)); V.jetCallout = now; }
          break;
        case 'break':
        case 'unhooked':
          escapeSquid();
          callout(t(lang, e.type === 'break' ? TX.msg.break : TX.msg.unhooked), 'bad');
          break;
        case 'landed': {
          V.land = { t0: now, from: { x: V.hug.x, y: V.hug.y } };
          burst(V.hug.x, SCENE.surface, 8);
          callout(t(lang, TX.msg.landed), 'good');
          addCatch(e);
          break;
        }
        case 'snag':
          V.egi.mode = 'stuck';
          V.snagAt = now;
          callout(t(lang, TX.msg.snag), 'bad');
          syncStock();
          break;
        case 'recover':
          callout(t(lang, TX.msg.recover));
          break;
        case 'ready':
          resetForNextCast();
          break;
        case 'over':
          break;
        default:
          break;
      }
    }
    if (events.length) {
      setButton();
      if (s.phase === 'result') showResult();
      if (s.phase === 'over') finishSession();
    }
  }

  // イカが離れて泳ぎ去る（すっぽ抜け・身切れ・バレ）
  function escapeSquid() {
    if (!V.hug.on) return;
    const h = s.hooking ?? V.hug.last ?? { id: 'aori', mantle: 15 };
    V.hug.on = false; V.hug.alpha = 0;
    setSquidArt(sc.nodes.escape, 'swim', h.id, mantleUnits(h.mantle));
    V.escape = { x: V.hug.x, y: V.hug.y, ang: -90, t0: now };
  }
  function resetForNextCast() {
    el.card.hidden = true;
    el.flash.hidden = true;
    V.hug.on = false; V.hug.alpha = 0; V.land = null; V.ink = null;
    const tp = tipRest();
    if (V.egi.mode === 'stuck') {
      V.ghost = { x: V.egi.x, y: V.egi.y, ang: V.egi.ang, t0: now };
      V.egi.mode = 'tip'; V.egi.x = tp.x; V.egi.y = tp.y + 30; V.egi.ang = 0;
    } else if (V.egi.mode === 'water' || V.egi.mode === 'hugged') {
      V.flight = { t0: now, from: { x: V.egi.x, y: V.egi.y }, to: { x: tp.x, y: tp.y + 30 }, dur: 0.5, mode: 'lift' };
      V.egi.mode = 'flight';
    } else {
      V.egi.mode = 'tip'; V.egi.x = tp.x; V.egi.y = tp.y + 30;
    }
    V.lineBroken = false;
    setButton();
  }

  /* ---------- 釣果・結果カード ---------- */
  function addCatch(c) {
    if (el.catches.querySelector('.ika-egi-catch-empty')) el.catches.innerHTML = '';
    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(speciesName(lang, c.id))}</span><b>${c.weight.toLocaleString()} g</b>`;
    el.catches.appendChild(li);
    if (!rec.species[c.id] && !firstSpecies.includes(c.id)) firstSpecies.push(c.id);
  }
  function showResult() {
    const why = s.last;
    const T = TX.result;
    let html = '';
    if (why === 'landed') {
      const c = s.catches[s.catches.length - 1];
      const sp = speciesById(c.id);
      const p = sp?.photo ? photoById(sp.photo) : null;
      const first = firstSpecies.includes(c.id);
      html = `
        <p class="ika-egi-card-title is-good">${t(lang, T.landed)}</p>
        ${p ? `<img class="ika-egi-card-photo" src="${assetHref(p.thumb ?? p.file)}" alt="${esc(t(lang, p.caption))}" width="160" height="120" loading="lazy" />` : ''}
        <p class="ika-egi-card-name">${esc(speciesName(lang, c.id))}${first ? ` <span class="ika-tag ika-tag--orange">${t(lang, TX.over.firstCatch)}</span>` : ''}</p>
        <dl class="ika-egi-card-rows"><div><dt>${t(lang, T.mantle)}</dt><dd>${c.mantle} cm</dd></div><div><dt>${t(lang, T.weight)}</dt><dd>${c.weight.toLocaleString()} g</dd></div></dl>
        <p class="ika-egi-card-link"><a href="${pageHref('atlas', lang)}#sp-${esc(c.id)}">${t(lang, T.atlas)}</a></p>`;
    } else {
      const note = { snag: T.snagNote, break: T.breakNote, unhooked: T.unhookedNote, recover: T.recoverNote }[why];
      html = `<p class="ika-egi-card-title${why === 'recover' ? '' : ' is-bad'}">${t(lang, T[why] ?? T.recover)}</p><p class="ika-egi-card-note">${t(lang, note ?? T.recoverNote)}</p>`;
    }
    el.card.innerHTML = `${html}<button type="button" class="ika-btn ika-btn--primary ika-egi-card-btn" data-next>${t(lang, TX.btn.result)}</button>`;
    el.card.className = 'ika-egi-card';
    el.card.hidden = false;
  }
  function finishSession() {
    const catches = s.catches;
    const before = rec.best;
    const { rec: r, fresh, total } = recordEgi(rec, catches);
    rec = r;
    writeJSON(KEY_EGI, rec);
    syncRecords();
    const O = TX.over;
    const list = catches.length
      ? `<ol class="ika-egi-over-list">${catches.map((c) => `<li><span>${esc(speciesName(lang, c.id))}</span><span>${c.mantle} cm</span><b>${c.weight.toLocaleString()} g</b></li>`).join('')}</ol>`
      : `<p class="ika-egi-over-bouzu">${t(lang, O.bouzu)}</p><p class="ika-egi-card-note">${t(lang, O.bouzuSub)}</p>`;
    const noEgi = s.egi <= 0 ? `<p class="ika-egi-card-note">${t(lang, TX.result.noEgi)}</p>` : '';
    el.card.innerHTML = `
      <p class="ika-egi-card-title">${t(lang, O.title)}</p>
      <p class="ika-egi-over-total"><span>${t(lang, O.total)}</span><b>${total.toLocaleString()} g</b>${total > before && total > 0 ? `<span class="ika-tag ika-tag--orange">${t(lang, O.newBest)}</span>` : ''}</p>
      ${list}${noEgi}
      ${fresh.length ? `<p class="ika-egi-card-note">${t(lang, O.zukan)}: ${fresh.map((id) => esc(speciesName(lang, id))).join(', ')} ${t(lang, 'を追加', 'added')}</p>` : ''}
      <button type="button" class="ika-btn ika-btn--primary ika-egi-card-btn" data-restart>${t(lang, TX.btn.over)}</button>`;
    el.card.className = 'ika-egi-card ika-egi-card--over';
    el.card.hidden = false;
    syncSetupLock();
  }
  function syncRecords() {
    const set = (k, v) => { const b = el.records.querySelector(`[data-rec="${k}"]`); if (b) b.textContent = String(v); };
    set('best', rec.best.toLocaleString());
    set('zukan', YAMAGUCHI_SQUID.filter((id) => rec.species[id]).length);
    set('sessions', rec.sessions);
  }
  el.card.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) { press(s); release(s); onEvents(s.events); }
    else if (e.target.closest('[data-restart]')) { newGame(); }
  });

  /* ---------- 入力 ---------- */
  function doPress() {
    if (!s || frozen) return;
    if (s.phase === 'over') return;
    if (s.phase === 'result') { press(s); release(s); onEvents(s.events); return; }
    press(s);
    if (s.phase === 'aiming' && !V.flight) { /* 竿を振りかぶる */ }
    // press() の中で起きる出来事（jerk / hook / miss）は次の tick まで events に残る
    onEvents(s.events.splice(0));
    setButton();
  }
  function doRelease() {
    if (!s || frozen) return;
    release(s);
    onEvents(s.events.splice(0));
    setButton();
  }
  let pointerDown = false;
  const onDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('a, .ika-egi-card, select, .ika-chip')) return;
    pointerDown = true;
    doPress();
    if (e.target === el.btn || e.target.closest('.ika-egi-scene')) e.preventDefault();   // 長押しでスクロール・選択を始めない
  };
  const onUp = () => { if (pointerDown) { pointerDown = false; doRelease(); } };
  el.btn.addEventListener('pointerdown', onDown);
  el.stage.addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  el.btn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); doPress(); }
  });
  el.btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doRelease(); } });
  el.btn.addEventListener('click', (e) => e.preventDefault());
  el.stage.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- 毎フレーム ---------- */
  let raf = 0, running = false, lastNow = 0;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastNow) / 1000);
    lastNow = ts;
    now += dt;
    if (!frozen && s) {
      const ev = tick(s, dt);
      if (ev.length) onEvents(ev);
    }
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }
  // 画面の外・非表示タブでは止める。やり取りの途中で画面外に出ても止めない（急に負けないように）
  let inView = true;
  const sync = () => {
    const idle = !s || ['ready', 'result', 'over'].includes(s.phase);
    if (document.hidden || (!inView && idle && !demo)) stop(); else start();
  };
  document.addEventListener('visibilitychange', sync);
  if ('IntersectionObserver' in window) new IntersectionObserver((en) => { inView = en.some((x) => x.isIntersecting); sync(); }, { threshold: 0.05 }).observe(el.stage);
  if ('ResizeObserver' in window) new ResizeObserver(() => relayout()).observe(el.stage); else addEventListener('resize', relayout);

  function burst(x, y, n = 8) {
    V.splash = Array.from({ length: n }, (_, i) => ({ x, y, vx: lerp(-90, 90, i / (n - 1)) + (Math.random() - 0.5) * 30, vy: 150 + Math.random() * 120, t0: now }));
    V.ripples.push({ x, y: SCENE.surface, t0: now, big: true });
  }

  function draw(dt) {
    const n = sc.nodes;
    const S = SCENE;
    const phase = s.phase;
    const k8 = 1 - Math.exp(-dt * 8);
    const k3 = 1 - Math.exp(-dt * 3);
    const since = s.t - s.lastJerk;
    const wobble = reduced ? 0 : Math.sin(now * 2.1) * 3;

    /* ----- エギの目標位置 ----- */
    let taut = 0.35;
    if (V.egi.mode === 'flight' && V.flight) {
      const F = V.flight;
      const k = clamp((now - F.t0) / F.dur, 0, 1);
      const arc = F.mode === 'cast' ? -140 * Math.sin(Math.PI * k) : -40 * Math.sin(Math.PI * k);
      const px = lerp(F.from.x, F.to.x, F.mode === 'cast' ? easeOut(k) : easeInOut(k));
      const py = lerp(F.from.y, F.to.y, F.mode === 'cast' ? k * k : easeInOut(k)) + arc;
      const vx = px - V.egi.x, vy = py - V.egi.y;
      V.egi.x = px; V.egi.y = py;
      if (Math.hypot(vx, vy) > 0.5) V.egi.ang += wrap(angleOf(-vx / Math.hypot(vx, vy), -vy / Math.hypot(vx, vy)) - V.egi.ang) * 0.3;
      taut = F.mode === 'cast' ? 0.15 : 0.9;
      if (k >= 1) {
        V.flight = null;
        if (F.mode === 'cast') { V.egi.mode = 'water'; burst(F.to.x, S.surface, 7); }
        else { V.egi.mode = 'tip'; }
      }
    } else if (V.egi.mode === 'tip') {
      const tp = tipRest();
      const swing = phase === 'aiming' ? Math.sin(now * 7) * 10 : wobble;
      V.egi.x += (tp.x + swing - V.egi.x) * k8;
      V.egi.y += (tp.y + 32 - V.egi.y) * k8;
      V.egi.ang += wrap(swing * 0.8 - V.egi.ang) * k8;
    } else if (V.egi.mode === 'water' || V.egi.mode === 'stuck') {
      const tx = X(s.dist);
      const ty = Y(Math.min(s.depth, s.bottom)) - (V.egi.mode === 'stuck' ? 0 : 6);
      const jerkFresh = now - V.jerkAt < 0.28;
      const rate = jerkFresh ? 1 - Math.exp(-dt * 16) : k8;
      if (V.egi.mode === 'stuck') {
        const shake = now - V.snagAt < 0.6 && !reduced ? Math.sin(now * 40) * 3 : 0;
        V.egi.x += (tx + shake - V.egi.x) * k8; V.egi.y += (ty + 2 - V.egi.y) * k8;
        V.egi.ang += wrap(-140 - V.egi.ang) * k3;
      } else {
        V.egi.x += (tx - V.egi.x) * rate;
        V.egi.y += (ty - V.egi.y) * rate;
        // 糸は釣り人側（左上）から頭に結ばれている。フォールは頭を下げて（左下）、尻を沖の上へ向けて沈む。
        // しゃくった直後は頭を上げて釣り人側へ飛ぶ
        const target = jerkFresh ? -35 : phase === 'sinking' ? -145 : -135;
        V.egi.ang += wrap(target - V.egi.ang) * (jerkFresh ? 0.45 : k3);
      }
      taut = jerkFresh ? 1 : phase === 'sinking' ? 0.45 : 0.4;
      if (V.egi.mode === 'stuck' && now - V.snagAt > 0.6) V.lineBroken = true;
    }

    /* ----- 抱いたイカ ----- */
    let lineEnd = { x: V.egi.x, y: V.egi.y };
    let hugInAir = false;
    if (V.hug.on) {
      const h = s.hooking;
      if (V.land) {
        // 取り込み：糸に沿って持ち上げ、堤防の先で吊る（足が上・胴が下）
        const k = easeInOut(clamp((now - V.land.t0) / 0.9, 0, 1));
        const hp = hangPoint();
        V.hug.x = lerp(V.land.from.x, hp.x, k);
        V.hug.y = lerp(V.land.from.y, hp.y, k) - 30 * Math.sin(Math.PI * k);
        const swing = reduced ? 0 : 9 * Math.sin((now - V.land.t0) * 5) * Math.exp(-(now - V.land.t0) * 0.5);
        V.hug.ang += wrap(swing - V.hug.ang) * (k >= 1 ? k8 : 1 - Math.exp(-dt * 6));
        hugInAir = V.hug.y < S.surface - 10;
        taut = 1;
      } else if (phase === 'signal') {
        // 抱いた直後：エギごと沖へ引っぱる（ラインが走る）
        const k = clamp((now - V.hug.t0) / 0.5, 0, 1);
        V.hug.x = V.egi.x + 28 * easeOut(k) + (reduced ? 0 : Math.sin(now * 30) * 1.5);
        V.hug.y = Math.min(V.egi.y + 10 * easeOut(k), Y(s.bottom) - 26);
        V.hug.ang += wrap(angleOf(0.95, 0.3) - V.hug.ang) * k8;
        taut = 1;
      } else if (phase === 'fight' && h) {
        // やり取り：距離に応じて浮いてくる。ジェットで沖へ走る。胴は沖向き
        const frac = clamp(s.dist / hookDist, 0, 1);
        const depth = clamp(hookDepth * frac, 1.7, s.bottom - 0.9);
        const tx = X(s.dist) + (now - V.lastJet < 0.35 ? 16 : 0);
        const ty = Y(depth);
        V.hug.x += (tx - V.hug.x) * k8;
        V.hug.y += (ty - V.hug.y) * k8;
        const pull = s.pressing ? -0.15 : 0.25;
        V.hug.ang += wrap(angleOf(0.9, 0.35 + pull) - V.hug.ang) * k3;
        taut = clamp(s.tension / 60, 0.2, 1);
        if (!inked && depth <= 1.0) {
          inked = true;
          V.ink = { t0: now, x: V.hug.x - 10, y: S.surface + 10 };
          callout(t(lang, TX.msg.ink));
        }
      } else {
        // 結果表示中（釣れた後）：吊ったまま揺れる
        const hp = hangPoint();
        V.hug.x += (hp.x - V.hug.x) * k8; V.hug.y += (hp.y - V.hug.y) * k8;
        V.hug.ang += wrap((reduced ? 0 : 5 * Math.sin(now * 2.2)) - V.hug.ang) * k3;
        hugInAir = true;
        taut = 1;
      }
      lineEnd = { x: V.hug.x, y: V.hug.y };
    }

    /* ----- 竿 ----- */
    let rodAng = S.rod.rest;
    let pull = 0;
    if (phase === 'aiming') rodAng = 66;
    else if (now - V.castSwing < 0.35) rodAng = lerp(66, 18, easeOut((now - V.castSwing) / 0.35));
    else if (now - V.castSwing < 1.2) rodAng = lerp(18, S.rod.rest, easeInOut((now - V.castSwing - 0.35) / 0.85));
    else if (phase === 'sinking') rodAng = 30;
    else if (phase === 'action' || phase === 'signal') { const j = now - V.jerkAt; rodAng = j < 0.5 ? lerp(72, 34, easeOut(j / 0.5)) : 34; pull = j < 0.2 ? 0.6 : 0; }
    else if (phase === 'fight') { rodAng = 58; pull = clamp(s.tension / 100, 0.15, 1); }
    else if (V.hug.on) { rodAng = 52; pull = 0.35; }
    if (phase === 'signal') pull = 0.4;
    V.rodAng = V.rodAng == null ? rodAng : V.rodAng + wrap(rodAng - V.rodAng) * (1 - Math.exp(-dt * 10));
    const { tip, bend } = rodGeom(V.rodAng, pull, lineEnd);
    const R = S.rod;
    sc.rodOutline.setAttribute('d', rodPathD(S.grip, bend, tip, R.width[0], R.width[1], R.outline));
    sc.rod.setAttribute('d', rodPathD(S.grip, bend, tip, R.width[0], R.width[1]));

    /* ----- 糸：竿先 → エギ（イカ）。根掛かりで切れたら短く垂れる ----- */
    let d;
    if (V.lineBroken) {
      d = `M${f1(tip.x)},${f1(tip.y)} q${f1(wobble)},20 ${f1(wobble * 0.5)},46`;
    } else {
      const L = Math.hypot(lineEnd.x - tip.x, lineEnd.y - tip.y);
      const sag = (1 - taut) * L * 0.16;
      const mid = { x: (tip.x + lineEnd.x) / 2, y: (tip.y + lineEnd.y) / 2 + sag };
      d = `M${f1(tip.x)},${f1(tip.y)} Q${f1(mid.x)},${f1(mid.y)} ${f1(lineEnd.x)},${f1(lineEnd.y)}`;
    }
    sc.line.setAttribute('d', d);
    sc.line.setAttribute('stroke-width', (2 + 1.2 * taut).toFixed(1));
    sc.line.setAttribute('opacity', (0.8 + 0.2 * taut).toFixed(2));
    // 入水点の輪
    if (!V.lineBroken && lineEnd.y > S.surface + 4 && tip.y < S.surface) {
      const kk = (S.surface - tip.y) / (lineEnd.y - tip.y);
      const ex = lerp(tip.x, lineEnd.x, kk);
      setAttrs(n.entry, { cx: f1(ex), cy: f1(S.surface + 1), rx: f1(9 + 2 * Math.sin(now * 3)), opacity: '0.7' });
    } else n.entry.setAttribute('opacity', '0');

    /* ----- エギの絵（空中と水中で前後を変える） ----- */
    const egiVisible = !V.hug.on || V.egi.mode === 'flight';
    const egiAir = V.egi.y < S.surface;
    const egiT = `translate(${f1(V.egi.x)} ${f1(V.egi.y)}) rotate(${f1(V.egi.ang)}) scale(1.15)`;
    n.egiAir.setAttribute('transform', egiT); n.egiWater.setAttribute('transform', egiT);
    n.egiAir.setAttribute('opacity', egiVisible && egiAir ? '1' : '0');
    n.egiWater.setAttribute('opacity', egiVisible && !egiAir ? '1' : '0');
    if (V.ghost) {
      const a = 1 - clamp((now - V.ghost.t0) / 1.5, 0, 1);
      setAttrs(n.ghost, { transform: `translate(${f1(V.ghost.x)} ${f1(V.ghost.y)}) rotate(${f1(V.ghost.ang)}) scale(1.15)`, opacity: (a * 0.6).toFixed(2) });
      if (a <= 0) V.ghost = null;
    } else n.ghost.setAttribute('opacity', '0');

    const hugT = `translate(${f1(V.hug.x)} ${f1(V.hug.y)}) rotate(${f1(V.hug.ang)}) scale(1.15)`;
    n.hugAir.setAttribute('transform', hugT); n.hugWater.setAttribute('transform', hugT);
    n.hugAir.setAttribute('opacity', V.hug.on && hugInAir ? '1' : '0');
    n.hugWater.setAttribute('opacity', V.hug.on && !hugInAir ? '1' : '0');
    // 吊ったイカから落ちるしずく
    n.drips.forEach((dp, i) => {
      if (!(V.hug.on && hugInAir) || reduced) { dp.setAttribute('opacity', '0'); return; }
      const ph = (now * 1.1 + i * 0.33) % 1;
      setAttrs(dp, { cx: f1(V.hug.x + [-8, 6, 1][i]), cy: f1(V.hug.y + 120 + ph * ph * 90), opacity: (0.85 * (1 - ph)).toFixed(2) });
    });
    // ジェット噴射の水流（胴の先から後ろへ）
    if (V.hug.on && now - V.lastJet < 0.4) {
      const a = 1 - (now - V.lastJet) / 0.4;
      setAttrs(n.jet, { cx: f1(V.hug.x + 70 + 40 * (1 - a)), cy: f1(V.hug.y + 30), rx: f1(18 + 30 * (1 - a)), ry: f1(6 + 4 * (1 - a)), opacity: (0.5 * a).toFixed(2) });
    } else n.jet.setAttribute('opacity', '0');

    /* ----- 気配のイカ：フォール中、気になっているほど寄ってくる（しゃくりの最中は距離をとる） ----- */
    const underwater = V.egi.mode === 'water' && !V.hug.on;
    const falling = underwater && ((phase === 'action' && since >= 1) || (phase === 'sinking' && s.depth > 1.2));
    V.swim.forEach((w, i) => {
      const node = n.swim[i];
      let ta = 0, tx = W + 120, ty = Y(5);
      if (underwater && s.interest > 0.2) {
        const near = falling ? 1 : 0;
        const off = lerp(150 + i * 70, 62 + i * 46, near);
        tx = V.egi.x + off + (reduced ? 0 : Math.sin(now * 1.3 + i * 2) * 10);
        ty = clamp(V.egi.y + [14, -26][i] + (reduced ? 0 : Math.cos(now * 1.1 + i) * 8), S.surface + 40, Y(s.bottom) - 20);
        ta = clamp(0.25 + 0.6 * s.interest, 0, 0.8) * (falling ? 1 : 0.55);
      }
      w.alpha += (ta - w.alpha) * (1 - Math.exp(-dt * 2.2));
      w.x += (tx - w.x) * (1 - Math.exp(-dt * 1.8));
      w.y += (ty - w.y) * (1 - Math.exp(-dt * 1.8));
      const dx = w.x - V.egi.x, dy = w.y - V.egi.y, L = Math.hypot(dx, dy) || 1;
      w.ang += wrap(angleOf(dx / L, dy / L) - w.ang) * k3;
      setAttrs(node, { transform: `translate(${f1(w.x)} ${f1(w.y)}) rotate(${f1(w.ang)})`, opacity: w.alpha.toFixed(2) });
    });
    // 逃げるイカ：胴を先にして沖へ
    if (V.escape) {
      const E = V.escape;
      const a = 1 - clamp((now - E.t0) / 1.3, 0, 1);
      E.x += 260 * dt; E.y += 30 * dt;
      setAttrs(n.escape, { transform: `translate(${f1(E.x)} ${f1(E.y)}) rotate(-84)`, opacity: (a * 0.9).toFixed(2) });
      if (a <= 0) V.escape = null;
    } else n.escape.setAttribute('opacity', '0');

    /* ----- 墨（水面で吐く） ----- */
    if (V.ink) {
      const g = clamp((now - V.ink.t0) / 2.6, 0, 1);
      const cx = V.ink.x - 30 * g, cy = V.ink.y;
      const rx = 30 + 150 * g, ry = 10 + 34 * g;
      setAttrs(n.inkBody, { cx: f1(cx), cy: f1(cy), rx: f1(rx), ry: f1(ry) });
      setAttrs(n.inkRim, { cx: f1(cx), cy: f1(cy), rx: f1(rx + 5), ry: f1(ry + 3) });
      n.inkArms.forEach((e, i) => {
        const ang = [-0.9, 0.25, 1.15][i];
        const len = (40 + 90 * g) * [1, 0.8, 0.9][i];
        const ax = cx + Math.cos(ang) * len * 0.9, ay = cy + Math.sin(ang) * len * 0.3;
        setAttrs(e, { cx: f1(ax), cy: f1(ay), rx: f1(len * 0.55), ry: f1(7 + 16 * g), transform: `rotate(${(ang * 18).toFixed(1)} ${f1(ax)} ${f1(ay)})` });
      });
      n.ink.setAttribute('opacity', (0.9 * (1 - g)).toFixed(2));
      if (g >= 1) V.ink = null;
    } else n.ink.setAttribute('opacity', '0');

    /* ----- 波紋・しぶき・波 ----- */
    V.ripples = V.ripples.filter((r) => now - r.t0 < 1.4);
    sc.ripples.forEach((e, i) => {
      const r = V.ripples[i];
      if (!r) { e.setAttribute('opacity', '0'); return; }
      const k = (now - r.t0) / 1.4;
      const rx = (12 + 70 * k) * (r.big ? 1.5 : 1);
      setAttrs(e, { cx: f1(r.x), cy: f1(r.y), rx: f1(rx), ry: f1(rx * 0.3), opacity: (0.7 * (1 - k)).toFixed(2) });
    });
    V.splash = V.splash.filter((p) => now - p.t0 < 0.6);
    sc.splash.forEach((e, i) => {
      const p = V.splash[i];
      if (!p) { e.setAttribute('opacity', '0'); return; }
      const a = now - p.t0;
      setAttrs(e, { cx: f1(p.x + p.vx * a), cy: f1(p.y - p.vy * a + 700 * a * a), r: f1(4 * (1 - a / 0.6)), opacity: (0.9 * (1 - a / 0.6)).toFixed(2) });
    });
    if (!reduced) {
      const pts = [];
      for (let x = S.pierRight; x <= W + 30; x += 30) pts.push(`${x},${f1(S.surface + 2.5 * Math.sin(x / 42 - now * 1.6))}`);
      sc.wave.setAttribute('d', `M${pts.join(' L')}`);
    }

    /* ----- HUD ----- */
    if (phase === 'aiming') powerFill.style.width = `${(s.power * 100).toFixed(0)}%`;
    if (phase === 'fight') {
      tensionFill.style.width = `${clamp(s.tension, 0, 100).toFixed(0)}%`;
      el.tension.classList.toggle('is-high', s.tension >= 80);
      el.tension.classList.toggle('is-slack', s.tension <= 5);
      setText(el.dist, 'dist', Math.max(0, s.dist).toFixed(0));
    }
    const inWater = phase === 'sinking' || phase === 'action' || phase === 'signal';
    el.count.hidden = !inWater;
    if (inWater) {
      const onBottom = s.depth >= s.bottom;
      const label = phase === 'sinking' ? t(lang, TX.hud.count) : t(lang, TX.hud.fall);
      setText(el.countLabel, 'label', label);
      setText(el.countNum, 'count', String(Math.max(0, Math.floor(phase === 'sinking' ? s.t - castAt : since))));
      setText(el.depth, 'depth', onBottom ? `${t(lang, TX.hud.bottom)}！` : `${t(lang, TX.hud.depth)} ${t(lang, '約', '~')}${s.bottom}m`);
      el.count.classList.toggle('is-bottom', onBottom);
      el.count.classList.toggle('is-warn', onBottom && s.bottomFor > 1.2);
    }
    el.btn.classList.toggle('is-signal', phase === 'signal');
    el.btn.classList.toggle('is-pressing', s.pressing && phase === 'fight');
  }

  /* ---------- 開発用：場面を作って止める ---------- */
  function runDemo(name) {
    const step = (sec) => { for (let k = 0; k < sec / 0.05; k++) { onEvents(tick(s, 0.05)); now += 0.05; draw(0.05); } };
    const jerk = () => { press(s); onEvents(s.events.splice(0)); release(s); };
    const cast = () => { press(s); step(0.72); release(s); onEvents(s.events.splice(0)); };
    const toSignal = () => {
      cast(); step(4.2); jerk(); step(0.3); jerk(); step(2.4);
      const pool = speciesPool(s.month, s.tod);
      s.hooking = { id: pool[0].id, weight: 620, mantle: 21, power: 0.7 };
      s.phase = 'signal'; s.signalAt = s.t; s.events.push({ type: 'signal', t: s.t }); onEvents(s.events.splice(0));
    };
    if (name === 'aiming') { press(s); step(0.45); onEvents(s.events.splice(0)); frozen = true; }
    else if (name === 'sinking') { cast(); step(4.5); frozen = true; }
    else if (name === 'signal') { toSignal(); step(0.35); frozen = true; }
    else if (name === 'fight') { toSignal(); step(0.3); s.rand = () => 0; press(s); onEvents(s.events.splice(0)); release(s); step(1.4); s.tension = 62; s.dist = 9; press(s); frozen = true; }
    else if (name === 'landed') { toSignal(); step(0.3); s.rand = () => 0; press(s); onEvents(s.events.splice(0)); release(s); step(0.4); s.dist = 0.01; press(s); step(0.2); release(s); s.rand = Math.random; frozen = true; }
    else if (name === 'snag') { cast(); step(s.bottom / 0.9 + 1.6); s.rand = () => 0; step(0.3); s.rand = Math.random; frozen = true; }
    else if (name === 'over') {
      s.catches = [{ id: 'aori', weight: 420, mantle: 19 }, { id: 'kouika', weight: 610, mantle: 16 }];
      s.casts = 1; toSignal(); step(0.3); s.rand = () => 0; press(s); onEvents(s.events.splice(0)); release(s); step(0.4); s.dist = 0.01; press(s); step(0.2); release(s); s.rand = Math.random; frozen = true;
    }
    // 止めた場面でも見た目の動き（揺れ・波）は続ける
    setButton();
    if (s.phase === 'result') showResult();
  }

  /* ---------- 起動 ---------- */
  syncSetup();
  relayout();
  if (!sc) buildScene();
  newGame();
  syncRecords();
  el.btn.disabled = false;
  if (demo) runDemo(demo);
  start();

  return {
    get state() { return s; },
    press: doPress, release: doRelease,
    settings, newGame,
  };
}

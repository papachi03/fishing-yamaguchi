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
import { createEgi, press, release, tick, dart, setEgi, speciesPool, seasonOf, CASTS, SIGNAL_GOOD, DEFAULT_CONDITIONS, DEFAULT_EGI, normalizeEgi } from './egi.js';
import { rhythmHintKey } from './egi-advice.js';
import { readJSON as readPref, writeJSON as writePref } from './records.js';
import { createFeel, canVibrate } from './feel.js';
import { loadHagiSea, todFromClock, HAGI } from './sea-live.js';
import { sunTimes } from '../../api/fishing.js';
import { SCENE, PALETTE, egiSceneSVG, seabedD, rocksSVG, depthY, distX } from './egi-scene.js';
import { svgEl, egiShape, huggingSquid, swimmingSquid, ART } from '../squid-art.js';
import { rodPathD, lerp } from '../hero-scene.js';
import { createPendulum, swingEase, flightPoint, headingDeg, flightTime, flightApex, trailingLineD } from '../cast-physics.js';
import { EGI_TEXT as TX, TOD, SEASON, monthLabel, speciesName, speciesById, YAMAGUCHI_SQUID } from './play-text.js';
import { aroundHTML, egiPickerHTML, egiTraitsHTML, egiIconHTML } from '../views/play.js';
import { recommendedSizes } from './egi-advice.js';
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
  // エギング専用ページ（釣り仲間に渡す用）：イカ部の他のページへはリンクしない。写真の出典はその場に書く
  const solo = root.dataset.solo === '1';
  const el = {
    stage: q('ika-egi-stage'), scene: q('ika-egi-scene'), btn: q('ika-egi-btn'),
    casts: q('ika-egi-casts'), egis: q('ika-egi-egis'),
    count: q('ika-egi-count'), countLabel: q('ika-egi-count-label'), countNum: q('ika-egi-count-num'), depth: q('ika-egi-depth'),
    callout: q('ika-egi-callout'), flash: q('ika-egi-flash'), card: q('ika-egi-card'),
    power: q('ika-egi-power'), tension: q('ika-egi-tension'), dist: q('ika-egi-dist'), reel: q('ika-egi-reel'), main: root.querySelector('.ika-egi-main'), log: q('ika-egi-log'),
    setup: q('ika-egi-setup'), tod: q('ika-egi-tod'), month: q('ika-egi-month'), season: q('ika-egi-season'), hint: q('ika-egi-hint'), around: q('ika-egi-around'), locked: q('ika-egi-locked'),
    live: q('ika-egi-live'), liveBody: q('ika-egi-live-body'), liveTime: q('ika-egi-live-time'), liveNotice: q('ika-egi-live-notice'), liveSource: q('ika-egi-live-source'),
    playLive: q('ika-egi-play-live'), playPractice: q('ika-egi-play-practice'), practice: q('ika-egi-practice'), exp: q('ika-egi-exp'), expOut: q('ika-egi-exp-out'), wind: q('ika-egi-wind'), mode: q('ika-egi-mode'), windnote: q('ika-egi-windnote'),
    pick: q('ika-egi-pick'), pickSize: q('ika-egi-size'), pickType: q('ika-egi-type'), pickIcon: q('ika-egi-pick-icon'), pickCurrent: q('ika-egi-pick-current'), pickTraits: q('ika-egi-pick-traits'), pickRec: q('ika-egi-pick-rec'),
    cueSetting: q('ika-egi-cue'), cueLabel: q('ika-egi-cue-label'), spec: q('ika-egi-spec'), fallmode: q('ika-egi-fallmode'), dartBtn: q('ika-egi-dart'),
    catches: q('ika-egi-catches'), records: q('ika-egi-records'),
    feel: q('ika-egi-feel'), feelVib: q('ika-egi-feel-vibrate'), feelSound: q('ika-egi-feel-sound'),
  };
  const powerFill = el.power.querySelector('.ika-egi-gauge-fill');
  const tensionFill = el.tension.querySelector('.ika-egi-gauge-fill');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 設定と記録 ---------- */
  // 条件：mode は 'live'（今日の萩の海）か 'practice'（自分で選ぶ）。時間帯は最初から時計と日の出入りで決める
  const now0 = new Date();
  const sun0 = sunTimes(HAGI.homeSpot?.lat ?? HAGI.lat, HAGI.homeSpot?.lon ?? HAGI.lon, now0);
  const settings = { mode: 'practice', month: now0.getMonth() + 1, tod: todFromClock(now0, sun0.sunrise, sun0.sunset), cond: { ...DEFAULT_CONDITIONS }, live: null, egi: { ...DEFAULT_EGI }, cue: readPref('ikabu.egi.cue') ?? 'real' };
  const feel = createFeel({ vibrate: readPref('ikabu.egi.vibrate') ?? true, sound: readPref('ikabu.egi.sound') ?? false });
  const WIND_PRESET = { calm: { wind: 2, gust: 4, wave: 0.3 }, breezy: { wind: 5, gust: 8, wave: 0.8 }, strong: { wind: 7, gust: 12, wave: 1.3 } };
  let signalsThisCast = 0;
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
    egi: { x: 0, y: 0, ang: 0, mode: 'tip' },       // tip（竿先にぶら下がる・振りかぶり・投げ）/ flight（放たれて飛ぶ・回収の持ち上げ）/ water / stuck
    flight: null,                                    // 回収の持ち上げ { t0, from, to, dur }
    cast: null,                                      // 投げ { t0, from, released, rel:{ t0, from, to, T, apex } }
    pend: createPendulum(SCENE.rod.len / 4),         // タラシの先のエギ（振り子）
    sinkOffset: 0,                                   // 着水するまでに判定側が沈めた分（着水後に見た目が追いつく）
    rodLag: 0, rodPrev: null, hold: null, held: false,
    cam: 1,                                          // 舞台のズーム（1＝ふだん。フルキャストの高い山を追って少し引く）
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
    V.camShown = null;
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
  // lag（度）：振っている向きと逆に竿先が遅れる＝竿がしなる（振りかぶり・キャストで使う）
  function rodGeom(ang, pull, target, lag = 0) {
    const R = SCENE.rod;
    const a = (ang * Math.PI) / 180;
    const dir = { x: Math.cos(a), y: -Math.sin(a) };
    const at = ((ang + lag) * Math.PI) / 180;
    const tipDir = { x: Math.cos(at), y: -Math.sin(at) };
    const tip0 = { x: SCENE.grip.x + tipDir.x * R.len, y: SCENE.grip.y + tipDir.y * R.len };
    let tip = tip0;
    if (target && pull > 0) tip = { x: tip0.x + (target.x - tip0.x) * 0.28 * pull, y: tip0.y + (target.y - tip0.y) * 0.28 * pull };
    const ab = ((ang + lag * 0.3) * Math.PI) / 180;
    const bend = { x: SCENE.grip.x + Math.cos(ab) * R.len * 0.52 + (tip.x - tip0.x) * 0.15, y: SCENE.grip.y - Math.sin(ab) * R.len * 0.52 + (tip.y - tip0.y) * 0.15 };
    return { tip, bend };
  }

  /* ---------- ゲームの作り直し ---------- */
  function newGame() {
    s = createEgi({ month: settings.month, tod: settings.tod, conditions: settings.cond, egi: settings.egi });
    castAt = 0; inked = false; firstSpecies = []; signalsThisCast = 0;
    V.egi.mode = 'tip'; V.flight = null; V.cast = null; V.sinkOffset = 0; V.hug.on = false; V.hug.alpha = 0; V.escape = null; V.ink = null; V.land = null; V.lineBroken = false; V.ghost = null;
    V.swim.forEach((w, i) => { w.alpha = 0; w.x = W + 100 + i * 80; w.y = Y(4); });
    const pool = speciesPool(settings.month, settings.tod);
    V.swim.forEach((w, i) => { w.species = (pool[i] ?? pool[0]).id; w.len = 44 + i * 10; setSquidArt(sc.nodes.swim[i], 'swim', w.species, w.len); });
    const tp = tipRest();
    V.pend.reset(tp);
    V.egi.x = tp.x; V.egi.y = tp.y + SCENE.rod.len / 4; V.egi.ang = 0;
    el.card.hidden = true;
    el.flash.hidden = true;
    el.catches.innerHTML = `<li class="ika-egi-catch-empty">${t(lang, 'まだ釣れていない', 'Nothing yet')}</li>`;
    updateBottom(8);
    syncStock();
    syncSetupLock();
    setButton();
  }

  /* ---------- 設定パネル：今日の萩の海 ／ 練習 ---------- */
  const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(10 - Math.round(n));
  const f1m = (v) => (v == null ? '—' : Number(v).toFixed(1));
  const condLine = () => {
    const c = settings.cond;
    return settings.mode === 'live'
      ? `${t(lang, TX.live.modeLive)}：${t(lang, TX.live.expectation)}★${Math.round(c.expectation)}・${t(lang, TX.live.wind)}${f1m(c.wind)}m・${t(lang, TOD[settings.tod])}`
      : `${t(lang, TX.live.modePractice)}：${t(lang, SEASON[seasonOf(settings.month)])}・${t(lang, TOD[settings.tod])}・${t(lang, TX.live.expectation)}★${Math.round(c.expectation)}・${t(lang, TX.live.wind)}${f1m(c.wind)}m`;
  };
  function syncSetup() {
    syncEgiPick();
    el.tod.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tod === settings.tod)));
    el.month.value = String(settings.month);
    el.season.textContent = t(lang, SEASON[seasonOf(settings.month)]);
    el.hint.textContent = t(lang, TX.setup.hint[settings.tod]);
    el.around.innerHTML = aroundHTML(lang, settings.month, settings.tod, { links: !solo });
    el.expOut.textContent = `★${Math.round(settings.cond.expectation)}`;
    el.mode.textContent = condLine();
    el.live.classList.toggle('is-active', settings.mode === 'live');
    el.practice.classList.toggle('is-active', settings.mode === 'practice');
  }
  const started = () => s && !(s.phase === 'ready' && s.casts === CASTS) && s.phase !== 'over';
  function syncSetupLock() {
    const lock = started();
    root.querySelectorAll('#ika-egi-tod .ika-chip, #ika-egi-wind .ika-chip').forEach((b) => { b.disabled = lock; });
    el.month.disabled = lock;
    el.exp.disabled = lock;
    el.playLive.disabled = lock || !settings.live || settings.live.conditions.safety === 'stop';
    el.playPractice.disabled = lock;
    el.locked.hidden = !lock;
  }
  /* ---------- エギ選び：投げる前（構え・結果表示）ならいつでも替えられる ---------- */
  const typeName = (type) => t(lang, TX.egi.types[type]);
  function syncEgiPick() {
    const e = settings.egi;
    el.pickSize.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.size) === e.size)));
    el.pickType.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === e.type)));
    const rec = recommendedSizes(settings.month, settings.tod);
    el.pickSize.querySelectorAll('.ika-chip').forEach((b) => b.classList.toggle('is-rec', rec.includes(Number(b.dataset.size))));
    el.pickRec.textContent = rec.map((x) => `${x}${t(lang, '号', '')}`).join(' / ');
    el.pickIcon.innerHTML = egiIconHTML(e.size, e.type);
    el.pickCurrent.textContent = TX.egi.current(lang, e.size, typeName(e.type));
    el.pickTraits.innerHTML = egiTraitsHTML(lang, e);
    el.spec.textContent = TX.egi.current(lang, e.size, typeName(e.type));
    const canPick = !s || s.phase === 'ready' || s.phase === 'result' || s.phase === 'over';
    root.querySelectorAll('#ika-egi-size .ika-chip, #ika-egi-type .ika-chip').forEach((b) => { b.disabled = !canPick; });
    el.pick.classList.toggle('is-locked', !canPick);
  }
  function chooseEgi(patch) {
    const next = normalizeEgi({ ...settings.egi, ...patch });
    if (s && s.phase !== 'over' && !setEgi(s, next)) return;   // 投げている最中は替えられない
    settings.egi = next;
    syncEgiPick();
    if (s?.phase === 'result') callout(`${t(lang, TX.egi.changed)}：${TX.egi.current(lang, next.size, typeName(next.type))}`);
  }
  el.pickSize.addEventListener('click', (e) => { const b = e.target.closest('.ika-chip[data-size]'); if (b) chooseEgi({ size: Number(b.dataset.size) }); });
  el.pickType.addEventListener('click', (e) => { const b = e.target.closest('.ika-chip[data-type]'); if (b) chooseEgi({ type: b.dataset.type }); });
  el.cueSetting.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-cue]');
    if (!b) return;
    settings.cue = b.dataset.cue;
    writePref('ikabu.egi.cue', settings.cue);
    syncCueSetting();
  });
  function syncCueSetting() {
    el.cueSetting.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cue === settings.cue)));
  }
  // 手ざわり（振動・小さな音）。振動できない端末（iPhone など）には振動の切り替えを出さない
  if (el.feelVib) el.feelVib.hidden = !canVibrate();
  function syncFeel() {
    el.feel?.querySelectorAll('.ika-chip[data-feel]').forEach((b) => {
      const on = b.dataset.feel === 'vibrate' ? feel.vibrate : feel.sound;
      b.setAttribute('aria-pressed', String((b.dataset.on === '1') === on));
    });
  }
  el.feel?.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-feel]');
    if (!b) return;
    const on = b.dataset.on === '1';
    if (b.dataset.feel === 'vibrate') { feel.setVibrate(on); writePref('ikabu.egi.vibrate', on); if (on) feel.fire('tap'); }
    else { feel.setSound(on); writePref('ikabu.egi.sound', on); if (on) feel.fire('tap'); }
    syncFeel();
  });
  syncFeel();

  // 練習モードに切り替えて、今の練習条件でゲームを作り直す
  function usePractice({ open = true } = {}) {
    settings.mode = 'practice';
    if (open) { el.practice.hidden = false; el.playPractice.setAttribute('aria-expanded', 'true'); }
    syncSetup();
    buildScene();
    newGame();
  }
  // 今日の萩の海の条件でゲームを作り直す
  function useLive() {
    const L = settings.live;
    if (!L || L.conditions.safety === 'stop') return;
    settings.mode = 'live';
    settings.month = L.month;
    settings.tod = L.tod;
    settings.cond = { ...L.conditions };
    syncSetup();
    buildScene();
    newGame();
  }
  el.tod.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-tod]');
    if (!b || started()) return;
    settings.tod = b.dataset.tod;
    usePractice();
  });
  el.month.addEventListener('change', () => {
    if (started()) { syncSetup(); return; }
    settings.month = Number(el.month.value) || settings.month;
    usePractice();
  });
  el.exp.addEventListener('input', () => { el.expOut.textContent = `★${el.exp.value}`; });
  el.exp.addEventListener('change', () => {
    if (started()) { syncSetup(); return; }
    settings.cond = { ...settings.cond, expectation: Number(el.exp.value) };
    usePractice();
  });
  el.wind.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-wind]');
    if (!b || started()) return;
    el.wind.querySelectorAll('.ika-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    settings.cond = { ...settings.cond, ...WIND_PRESET[b.dataset.wind], safety: 'ok' };
    usePractice();
  });
  el.playLive.addEventListener('click', () => { if (!started()) useLive(); });
  el.playPractice.addEventListener('click', () => {
    if (started()) return;
    if (settings.mode === 'practice' && !el.practice.hidden) { el.practice.hidden = true; el.playPractice.setAttribute('aria-expanded', 'false'); return; }
    usePractice();
  });

  // 今日の萩の海を取って、パネルに出す。中止レベルなら練習に、失敗したら練習に（そう言う）
  function renderLive(L) {
    settings.live = L;
    const c = L.conditions;
    const exp = L.expectation;
    const sf = L.safety;
    el.liveBody.innerHTML = `
      <div class="ika-egi-live-exp"><span class="ika-egi-live-stars" aria-label="${t(lang, TX.live.expectation)} ${Math.round(c.expectation)}/10">${stars(c.expectation)}</span><b>${Math.round(c.expectation)}<small>/10</small></b><span class="ika-egi-live-msg">${exp ? esc(exp.message) : ''}</span></div>
      <dl class="ika-egi-live-rows">
        <div><dt>${t(lang, TX.live.wind)}</dt><dd>${f1m(c.wind)}<small>m/s</small></dd></div>
        <div><dt>${t(lang, TX.live.gust)}</dt><dd>${f1m(c.gust)}<small>m/s</small></dd></div>
        <div><dt>${t(lang, TX.live.wave)}</dt><dd>${f1m(c.wave)}<small>m</small></dd></div>
        <div><dt>${t(lang, TX.live.tide)}</dt><dd>${exp ? esc(exp.tideName) : '—'}</dd></div>
        <div><dt>${t(lang, TX.live.tod)}</dt><dd>${t(lang, TOD[L.tod])}<small>${monthLabel(lang, L.month)}・${t(lang, SEASON[seasonOf(L.month)])}</small></dd></div>
      </dl>
      ${sf ? `<p class="ika-egi-live-safety lv${sf.level}"><span class="ika-egi-live-badge">${esc(sf.label)}</span>${esc(sf.message)}</p>` : ''}`;
    el.live.dataset.state = 'ready';
    const at = L.weather?.fetchedAt ? new Date(L.weather.fetchedAt) : L.now;
    el.liveTime.textContent = `${t(lang, TX.live.fetched)} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')} JST`;
    el.liveNotice.hidden = true;
    if (L.partial) { el.liveNotice.textContent = t(lang, TX.live.partial); el.liveNotice.hidden = false; }
    if (c.safety === 'stop') {
      el.liveNotice.textContent = t(lang, TX.live.stop);
      el.liveNotice.hidden = false;
      el.live.dataset.state = 'stop';
      if (!started()) usePractice();
    } else if (!started() && !demo) {
      useLive();
    }
    syncSetupLock();
  }
  function failLive(err) {
    el.live.dataset.state = 'failed';
    el.liveBody.innerHTML = '';
    el.liveNotice.textContent = t(lang, TX.live.failed);
    el.liveNotice.hidden = false;
    if (import.meta.env.DEV) console.warn('[egi] live sea unavailable', err);
    if (!started()) usePractice({ open: false });
    syncSetupLock();
  }

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
    el.btn.textContent = t(lang, TX.btn[key === 'signal' && settings.cue === 'real' ? 'sink' : key]);
    el.btn.dataset.phase = key;
    el.power.hidden = key !== 'aiming';
    el.tension.hidden = key !== 'fight';
    el.dartBtn.disabled = key !== 'sink';   // ダートは沈下・フォール中だけ
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
          signalsThisCast = 0;
          updateBottom(s.bottom);
          V.lineBroken = false;
          V.egi.mode = 'cast';
          V.cast = { t0: now, from: V.rodAng ?? 100, released: false, rel: null, dist: s.castDist, to: { x: X(s.castDist), y: SCENE.surface } };
          if (reduced) landEgi();   // 動きを減らす設定：飛ばさずに着水
          syncStock();
          syncSetupLock();
          break;
        }
        case 'jerk':
          V.jerkAt = now;
          V.jerkKind = e.kind;
          V.jerkDouble = e.double;
          if (e.kind === 'dart') { V.dartAt = now; callout(t(lang, TX.cue.dart)); }
          else if (e.double) callout(t(lang, TX.cue.double));
          setFallMode(null);
          break;
        case 'fall':
          setFallMode(e.mode);
          break;
        case 'rhythm': {
          // 手ほどきは毎回は言わない（ダート・しゃくりすぎ・渋い日の助言は毎回、ふつうの評価は2回に1回）
          const key = rhythmHintKey(e);
          V.rhythmN = (V.rhythmN ?? 0) + 1;
          const always = key === 'tooMany' || key === 'dartActive' || key === 'dartCalm' || key === 'calmMany';
          if (key && (always || V.rhythmN % 2 === 1)) callout(t(lang, TX.hint[key]), key === 'goodRhythm' || key === 'dartActive' ? 'good' : key === 'tooMany' || key === 'dartCalm' || key === 'calmMany' ? 'bad' : '');
          break;
        }
        case 'signal': {
          signalsThisCast += 1;
          const h = s.hooking;
          V.hug.on = true; V.hug.alpha = 1; V.hug.x = V.egi.x; V.hug.y = V.egi.y; V.hug.ang = V.egi.ang; V.hug.t0 = now;
          setSquidArt(sc.nodes.hugWater, 'hug', h.id, mantleUnits(h.mantle));
          setSquidArt(sc.nodes.hugAir, 'hug', h.id, mantleUnits(h.mantle));
          V.hug.height = (44 * clamp(mantleUnits(h.mantle) / 56, 0.75, 1.8) + mantleUnits(h.mantle)) * 1.15;
          V.swim.forEach((w) => { w.alpha = 0; });
          // アタリの出方：走る／竿先にコン／止まる／フケる。本格モードでは糸と竿先だけで見せる
          V.bite = { kind: e.kind, light: e.light, t0: now, amp: e.light ? 0.6 : 1 };
          V.lastBite = V.bite;
          if (settings.cue === 'easy') {
            el.cueLabel.textContent = t(lang, TX.cue.kinds[e.kind]);
            el.cueLabel.className = `ika-egi-cue${e.light ? ' is-light' : ''}`;
            el.cueLabel.hidden = false;
          }
          // 手に伝わるアタリ（コン・走る）だけ震わせる。止まる・フケるは目で気づくアタリなので震わせない
          if (e.kind === 'tap' || e.kind === 'run') feel.fire(e.kind);
          el.log.textContent = t(lang, TX.cue.kinds[e.kind]);
          break;
        }
        case 'hook':
          el.flash.hidden = true;
          el.cueLabel.hidden = true;
          V.bite = null;
          setFallMode(null);
          hookDepth = Math.max(0.6, s.depth);
          hookDist = Math.max(s.dist, 1);
          inked = false;
          callout(t(lang, TX.msg.hook), 'good');
          feel.fire('hook');
          break;
        case 'miss':
        case 'let-go':
          el.flash.hidden = true;
          el.cueLabel.hidden = true;
          escapeSquid();
          callout(t(lang, e.type === 'miss' ? TX.msg.miss : TX.msg.letgo), 'bad');
          // 逃げた後：今のアタリが何だったかを教え、残りの気配を言う
          { const bite = V.lastBite; V.bite = null;
            setTimeout(() => { if (s.phase === 'action' && bite) callout(TX.cue.lesson(lang, t(lang, TX.cue.names[bite.kind]))); }, 1500);
            setTimeout(() => { if (s.phase === 'action') callout(e.squidLeft > 0 ? TX.msg.squidLeft(lang, e.squidLeft) : t(lang, TX.msg.squidGone)); }, 3200); }
          break;
        case 'jet':
          V.lastJet = now;
          feel.fire('jet', { power: s.hooking?.power });
          if (now - (V.jetCallout ?? -9) > 2.5) { callout(t(lang, TX.msg.jet)); V.jetCallout = now; }
          break;
        case 'break':
        case 'unhooked':
          escapeSquid();
          feel.fire('break');
          callout(t(lang, e.type === 'break' ? TX.msg.break : TX.msg.unhooked), 'bad');
          break;
        case 'landed': {
          V.land = { t0: now, from: { x: V.hug.x, y: V.hug.y } };
          burst(V.hug.x, SCENE.surface, 8);
          callout(t(lang, TX.msg.landed), 'good');
          feel.fire('landed');
          addCatch(e);
          break;
        }
        case 'punch':
          // イカパンチ：エギがピクッと弾かれる（描画側）。やさしいモードは文字でも知らせる
          V.punchAt = now;
          feel.fire('punch');
          if (settings.cue === 'easy') {
            el.cueLabel.textContent = t(lang, TX.cue.punch);
            el.cueLabel.className = 'ika-egi-cue is-light';
            el.cueLabel.hidden = false;
            setTimeout(() => { if (s.phase === 'action') el.cueLabel.hidden = true; }, 900);
            callout(t(lang, TX.msg.punch));
          }
          el.log.textContent = t(lang, TX.cue.punch);
          break;
        case 'spooked':
          callout(t(lang, e.left ? TX.msg.spookedLeft : TX.msg.spooked), 'bad');
          break;
        case 'punch-wait':
          if (settings.cue === 'easy') callout(t(lang, TX.msg.punchWait), 'good');
          break;
        case 'snag':
          V.egi.mode = 'stuck';
          V.snagAt = now;
          callout(t(lang, TX.msg.snag), 'bad');
          syncStock();
          break;
        case 'recover':
          callout(t(lang, signalsThisCast === 0 ? TX.msg.noSign : TX.msg.recover));
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
      V.egi.mode = 'tip'; V.egi.x = tp.x; V.egi.y = tp.y + SCENE.rod.len / 4; V.egi.ang = 0; V.pend.reset(tp);
    } else if (V.egi.mode === 'water' || V.egi.mode === 'hugged') {
      V.flight = { t0: now, from: { x: V.egi.x, y: V.egi.y }, to: { x: tp.x, y: tp.y + SCENE.rod.len / 4 }, dur: 0.5 };
      V.egi.mode = 'flight';
    } else {
      V.egi.mode = 'tip'; V.egi.x = tp.x; V.egi.y = tp.y + SCENE.rod.len / 4; V.pend.reset(tp);
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
        ${solo
          ? (p ? `<p class="ika-egi-card-credit">${t(lang, '写真', 'Photo')}：${esc(p.author)}${p.licenseUrl ? `（<a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener">${esc(t(lang, p.license))}</a>）` : ''}</p>` : '')
          : `<p class="ika-egi-card-link"><a href="${pageHref('atlas', lang)}#sp-${esc(c.id)}">${t(lang, T.atlas)}</a></p>`}`;
    } else {
      const note = { snag: T.snagNote, break: T.breakNote, unhooked: T.unhookedNote, recover: signalsThisCast === 0 ? TX.msg.noSign : T.recoverNote }[why];
      html = `<p class="ika-egi-card-title${why === 'recover' ? '' : ' is-bad'}">${t(lang, T[why] ?? T.recover)}</p><p class="ika-egi-card-note">${t(lang, note ?? T.recoverNote)}</p>`;
    }
    el.card.innerHTML = `${html}<p class="ika-egi-card-cond">${esc(condLine())}</p><div class="ika-egi-card-actions"><button type="button" class="ika-btn ika-btn--primary ika-egi-card-btn" data-next>${t(lang, TX.btn.result)}</button><button type="button" class="ika-btn ika-egi-card-btn" data-egi>${t(lang, TX.egi.change)}</button></div>`;
    syncEgiPick();
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
      <p class="ika-egi-card-cond">${esc(condLine())}</p>
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
    else if (e.target.closest('[data-egi]')) {
      // エギ選びへ（替えたら「次の一投へ」でそのまま続けられる）
      el.pick.classList.add('is-flash');
      setTimeout(() => el.pick.classList.remove('is-flash'), 1600);
      el.pick.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      el.pickSize.querySelector('.ika-chip')?.focus({ preventScroll: true });
    }
    else if (e.target.closest('[data-restart]')) { newGame(); }
  });

  /* ---------- 入力 ---------- */
  function doPress() {
    feel.unlock();   // iPhone は最初に触った後でないと音を鳴らせない
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
  function doDart() {
    if (!s || frozen) return;
    if (s.phase !== 'sinking' && s.phase !== 'action') return;
    dart(s);
    onEvents(s.events.splice(0));
    setButton();
  }
  // 指：押した瞬間に決めず 150ms だけ待ち、その間に上へ 24px 以上動いたらダート。動かなければ押下（しゃくり／長押し）。
  //   150ms より早く離したらその場でタップ。マウス・キーボードはすぐ押下（ダートは ↑ キー）
  let ptr = null;   // { id, x, y, timer, pressed, darted }
  const SWIPE = { touch: { ms: 150, px: 24 }, mouse: { ms: 140, px: 16 }, pen: { ms: 150, px: 20 } };
  const canSwipe = () => s && (s.phase === 'sinking' || s.phase === 'action');
  const onDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('a, .ika-egi-card, select, .ika-chip, details')) return;
    if (ptr) return;
    const sw = SWIPE[e.pointerType] ?? SWIPE.touch;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, timer: 0, pressed: false, darted: false, px: sw.px };
    if (canSwipe()) {
      ptr.timer = setTimeout(() => { if (ptr && !ptr.pressed && !ptr.darted) { ptr.pressed = true; doPress(); } }, sw.ms);
    } else {
      ptr.pressed = true;
      doPress();
    }
    if (e.target === el.btn || e.target.closest('.ika-egi-scene')) e.preventDefault();   // 長押しでスクロール・選択を始めない
  };
  const onMove = (e) => {
    if (!ptr || ptr.id !== e.pointerId || ptr.pressed || ptr.darted) return;
    if (ptr.y - e.clientY >= ptr.px && Math.abs(e.clientX - ptr.x) < 60) {
      clearTimeout(ptr.timer);
      ptr.darted = true;
      doDart();
    }
  };
  const onUp = (e) => {
    if (!ptr || (e && e.pointerId != null && ptr.id !== e.pointerId)) return;
    clearTimeout(ptr.timer);
    if (ptr.pressed) doRelease();
    else if (!ptr.darted) { doPress(); doRelease(); }   // 素早いタップ
    ptr = null;
  };
  el.btn.addEventListener('pointerdown', onDown);
  el.stage.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  el.btn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); doPress(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); doDart(); }
  });
  el.btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doRelease(); } });
  // フォールの種類の表示
  function setFallMode(mode) {
    V.fallMode = mode;
    el.fallmode.hidden = !mode;
    if (mode) { el.fallmode.textContent = t(lang, TX.fall[mode]); el.fallmode.dataset.mode = mode; }
  }
  el.btn.addEventListener('click', (e) => e.preventDefault());
  el.stage.addEventListener('contextmenu', (e) => e.preventDefault());
  // スマホの長押し機能（iPhone の拡大鏡・コピーのメニュー・文字選択、Android の選択）を、舞台とボタンの上では出さない。
  // pointerdown の preventDefault だけでは iOS の長押しは止まらないので、touchstart も止める（pointer イベントはそのまま届く）
  const noLongPress = (e) => { if (!e.target.closest('a, select, input, .ika-egi-card button, .ika-egi-card a, details')) e.preventDefault(); };
  for (const node of [el.btn, el.dartBtn, el.stage]) {
    node.addEventListener('touchstart', noLongPress, { passive: false });
    node.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  el.main.addEventListener('selectstart', (e) => {
    const n = e.target.nodeType === 1 ? e.target : e.target.parentElement;
    if (!n?.closest('.ika-egi-card, .ika-egi-gestures, .ika-egi-log')) e.preventDefault();
  });
  // 横向きのスマホ：舞台を画面の高さいっぱいに出す（CSS の横向きレイアウトと同じ条件）。
  // 回したとき・横向きで遊び始めたときに、舞台の上端を画面の上端へ合わせる
  const landscape = matchMedia('(orientation: landscape) and (max-height: 540px)');
  const fitLandscape = () => {
    if (!landscape.matches) return;
    const r = el.main.getBoundingClientRect();
    if (Math.abs(r.top - 6) > 4) scrollTo({ top: scrollY + r.top - 6, behavior: reduced ? 'auto' : 'smooth' });
  };
  landscape.addEventListener?.('change', () => { if (landscape.matches && s && !['ready', 'over'].includes(s.phase)) setTimeout(fitLandscape, 250); });
  el.btn.addEventListener('pointerdown', () => { if (!s || s.phase === 'ready') fitLandscape(); });
  // ダートボタン（どの端末でも確実に）
  // 押した瞬間に反応させる（click 待ちの遅れを無くす）。キーボードは Enter/Space
  el.dartBtn.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') { e.preventDefault(); doDart(); } });
  el.dartBtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); doDart(); } });
  el.dartBtn.addEventListener('click', (e) => e.preventDefault());
  // マウスのホイール上＝ダート（舞台とボタンの上。ダートできる時だけ画面のスクロールを止め、0.35秒に1回）
  let wheelAt = 0;
  const onWheel = (e) => {
    if (!canSwipe() || e.deltaY >= 0) return;
    e.preventDefault();
    if (now - wheelAt < 0.35) return;
    wheelAt = now;
    doDart();
  };
  el.stage.addEventListener('wheel', onWheel, { passive: false });
  el.btn.addEventListener('wheel', onWheel, { passive: false });

  /* ---------- 毎フレーム ---------- */
  let raf = 0, running = false, lastNow = 0;
  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastNow) / 1000);
    lastNow = ts;
    if (V.hold && holdReached(V.hold)) { V.hold = null; V.held = true; }   // 開発用：場面で見た目ごと止める
    if (!V.held) {
      now += dt;
      if (!frozen && s) {
        const ev = tick(s, dt);
        if (ev.length) onEvents(ev);
      }
      draw(dt);
    }
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

  // 着水：しぶきと波紋、糸はたるみ、ここからカウントと沈下が始まる
  function landEgi() {
    const C = V.cast;
    if (!C) return;
    V.cast = null;
    V.egi.mode = 'water';
    V.egi.x = C.to.x; V.egi.y = C.to.y;
    V.egi.ang = -150;
    V.sinkOffset = s.depth;          // 飛んでいる間に判定が沈めた分は、見た目では着水後に追いつかせる
    castAt = s.t;
    V.splashAt = now;
    V.flyDir = null;
    burst(C.to.x, SCENE.surface, 7);
    callout(t(lang, TX.msg.cast));
  }
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

    /* ----- 竿の角度（振りかぶり→振り出し→フォロースルー、しゃくり、やり取り） ----- */
    const SWING = 0.3;
    const C = V.cast;
    let rodAng = S.rod.rest;
    let pull = 0;
    if (phase === 'aiming' && !C) rodAng = 88 + 24 * s.power;                       // 振りかぶる：力をためるほど後ろへ
    else if (C) {
      const k = (now - C.t0) / SWING;
      if (k < 1) rodAng = lerp(C.from, 22, swingEase(k));                            // 一気に前へ（行き過ぎて戻る）
      else {
        // フォロースルー：着水点の方へ竿先を向ける
        const aim = clamp((Math.atan2(S.grip.y - C.to.y, C.to.x - S.grip.x) * 180) / Math.PI, 16, 34);
        rodAng = lerp(22, aim, easeInOut(clamp((now - C.t0 - SWING) / 0.6, 0, 1)));
      }
    }
    else if (phase === 'sinking') rodAng = 30;
    else if (phase === 'action' || phase === 'signal') {
      const j = now - V.jerkAt;
      const top = V.jerkKind === 'dart' ? 80 : V.jerkDouble ? 66 : 72;
      rodAng = j < 0.5 ? lerp(top, 34, easeOut(j / 0.5)) : 34;
      pull = j < 0.2 ? 0.6 : 0;
      if (s.tensionFall) { rodAng = 40; pull = 0.25; }   // テンションフォール：竿を少し立てて糸を張る
      // アタリ：竿先にコン＝一度だけ下へ叩く。走る＝竿先が引かれる
      if (phase === 'signal' && V.bite) {
        const b = now - V.bite.t0;
        if (V.bite.kind === 'tap') { const knock = b < 0.18 ? Math.sin((b / 0.18) * Math.PI) : b < 0.3 ? 0.35 * Math.sin(((b - 0.18) / 0.12) * Math.PI) : 0; rodAng -= 9 * knock * V.bite.amp; pull = 0.5 * knock * V.bite.amp; }
        else if (V.bite.kind === 'run') pull = 0.45 * V.bite.amp;
        else if (V.bite.kind === 'slack') pull = 0;
      }
    }
    else if (phase === 'fight') { rodAng = 58; pull = clamp(s.tension / 100, 0.15, 1); }
    else if (V.hug.on) { rodAng = 52; pull = 0.35; }
    // 竿は目標角へなめらかに（振り出しの最中だけは追従を速く）、しなりは角速度の逆向き
    const prevAng = V.rodAng ?? rodAng;
    V.rodAng = V.rodAng == null ? rodAng : V.rodAng + wrap(rodAng - V.rodAng) * (1 - Math.exp(-dt * (C ? 40 : 10)));
    const rodVel = dt > 0 ? wrap(V.rodAng - prevAng) / dt : 0;
    V.rodLag += (clamp(-rodVel * 0.03, -16, 16) - V.rodLag) * (1 - Math.exp(-dt * 18));
    const tipNow = () => rodGeom(V.rodAng, 0, null, V.rodLag).tip;

    /* ----- エギの目標位置 ----- */
    let taut = 0.35;
    if (V.egi.mode === 'tip' || (V.egi.mode === 'cast' && !C?.released)) {
      // 竿先のタラシにぶら下がる振り子。振りかぶりでは遅れて後ろへ、振り出しでは遠心力で回る
      const tp = tipNow();
      const p = V.pend.step(tp, dt);
      V.egi.x = p.x; V.egi.y = p.y;
      const dx = p.x - tp.x, dy = p.y - tp.y, L = Math.hypot(dx, dy) || 1;
      V.egi.ang += wrap(angleOf(dx / L, dy / L) - V.egi.ang) * 0.6;
      taut = 0.9;
      if (C && !C.released) {
        const k = (now - C.t0) / SWING;
        // 竿が 10〜11 時（前へ 46° 以下）を通った瞬間に放す。振り切っても放していなければそこで放す
        if (V.rodAng <= 46 || k >= 1) {
          C.released = true;
          const distK = clamp((C.dist - 10) / 30, 0, 1);   // 10m → 0、40m → 1
          // 山の高さは、引いたカメラで見える空の上から 15% より下に収まるように上限を決める
          const zT = 1 + 0.36 * distK;
          const yTop = -S.H * (zT - 1) * 0.82;
          const apexMax = (p.y + 0.42 * (C.to.y - p.y) - yTop - 0.15 * (S.surface - yTop)) / 0.93;
          C.rel = { t0: now, from: { x: p.x, y: p.y }, to: C.to, T: flightTime(distK), apex: clamp(flightApex(distK, W / 1000), 16, Math.max(16, apexMax)), distK };
        }
      }
    } else if (V.egi.mode === 'cast' && C?.released) {
      // 放物線。糸は竿先からゆるく張って追いかける
      const R = C.rel;
      const k = (now - R.t0) / R.T;
      const p = flightPoint(R.from, R.to, k, R.apex);
      const q = flightPoint(R.from, R.to, Math.min(1, k + 0.02), R.apex);
      const vl = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      V.flyDir = { x: (q.x - p.x) / vl, y: (q.y - p.y) / vl };
      V.flyK = k;
      V.egi.x = p.x; V.egi.y = p.y;
      V.egi.ang += wrap(headingDeg(R.from, R.to, k, R.apex) - V.egi.ang) * 0.5;
      taut = 0.55;
      if (k >= 1) landEgi();
    } else if (V.egi.mode === 'flight' && V.flight) {
      // 回収：糸に沿って竿先へ持ち上げる
      const F = V.flight;
      const k = clamp((now - F.t0) / F.dur, 0, 1);
      V.egi.x = lerp(F.from.x, F.to.x, easeInOut(k));
      V.egi.y = lerp(F.from.y, F.to.y, easeInOut(k)) - 40 * Math.sin(Math.PI * k);
      V.egi.ang += wrap(0 - V.egi.ang) * k3;
      taut = 0.9;
      if (k >= 1) { V.flight = null; V.egi.mode = 'tip'; V.pend.reset(tipNow()); }
    } else if (V.egi.mode === 'water' || V.egi.mode === 'stuck') {
      V.sinkOffset = Math.max(0, V.sinkOffset - 0.4 * dt);
      const tx = X(s.dist);
      const ty = Y(clamp(s.depth - V.sinkOffset, 0.15, s.bottom)) - (V.egi.mode === 'stuck' ? 0 : 6);
      const jerkFresh = now - V.jerkAt < 0.28;
      const rate = jerkFresh ? 1 - Math.exp(-dt * 16) : k8;
      if (V.egi.mode === 'stuck') {
        const shake = now - V.snagAt < 0.6 && !reduced ? Math.sin(now * 40) * 3 : 0;
        V.egi.x += (tx + shake - V.egi.x) * k8; V.egi.y += (ty + 2 - V.egi.y) * k8;
        V.egi.ang += wrap(-140 - V.egi.ang) * k3;
      } else {
        // ダート：大きく横へ跳ねてから戻る（ジグザグ）。2段：小さく2回目の跳ね
        const dartK = V.dartAt != null ? (now - V.dartAt) / 0.45 : 9;
        const dartX = dartK < 1 ? 48 * Math.sin(Math.PI * dartK) * (dartK < 0.5 ? 1 : -0.6) : 0;
        V.egi.x += (tx + dartX - V.egi.x) * rate;
        V.egi.y += (ty - (dartK < 1 ? 10 * Math.sin(Math.PI * dartK) : 0) - V.egi.y) * rate;
        // 糸は釣り人側（左上）から頭に結ばれている。フォールは頭を下げて（左下）、尻を沖の上へ向けて沈む。
        // しゃくった直後は頭を上げて釣り人側へ飛ぶ。テンションフォールは頭を釣り人側へ向けて滑るように、フリーフォールは頭を下げてまっすぐ
        const target = jerkFresh ? (V.jerkKind === 'dart' ? -60 : -35) : phase === 'sinking' ? -145 : s.tensionFall ? -112 : -140;
        V.egi.ang += wrap(target - V.egi.ang) * (jerkFresh ? 0.45 : k3);
        // イカパンチ：足で叩かれてエギが横へ弾かれ、向きがぶれる（0.35秒）
        const pk = V.punchAt != null ? (now - V.punchAt) / 0.35 : 9;
        if (pk < 1 && !reduced) {
          V.egi.x += 8 * Math.sin(Math.PI * pk) * (pk < 0.5 ? 1 : -0.5);
          V.egi.ang += 20 * Math.sin(2 * Math.PI * pk) * (1 - pk);
        }
      }
      taut = jerkFresh ? 1 : phase === 'sinking' ? 0.45 : s.tensionFall ? 0.95 : 0.3;
      if (V.splashAt && now - V.splashAt < 1.2) taut *= 0.5 + 0.5 * ((now - V.splashAt) / 1.2);   // 着水直後は糸が水面にたるんで置かれる
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
        // 抱いた直後。アタリの種類で見え方が違う：
        //   run   … エギごと沖へ走り、糸がピンと張る（はっきり）
        //   tap   … その場で抱いて竿先を一度叩く（竿側で表現）。糸は張ったまま
        //   stop  … その場で抱いて沈みが止まる（エギが動かない）。糸は少しだけ張る
        //   slack … エギを持ち上げて糸がフケる（大きくたるむ）
        const B = V.bite ?? { kind: 'run', amp: 1 };
        const k = clamp((now - V.hug.t0) / 0.5, 0, 1);
        const jitter = reduced ? 0 : Math.sin(now * 30) * 1.5;
        if (B.kind === 'run') {
          V.hug.x = V.egi.x + 60 * B.amp * easeOut(k) + jitter;
          V.hug.y = Math.min(V.egi.y + 14 * easeOut(k), Y(s.bottom) - 26);
          V.hug.ang += wrap(angleOf(0.95, 0.3) - V.hug.ang) * k8;
          taut = 1;
        } else if (B.kind === 'slack') {
          V.hug.x = V.egi.x - 6 * easeOut(k);
          V.hug.y = V.egi.y - 26 * B.amp * easeOut(k);
          V.hug.ang += wrap(angleOf(0.5, -0.85) - V.hug.ang) * k8;
          taut = 0.02;
        } else {
          V.hug.x = V.egi.x + jitter * 0.5;
          V.hug.y = Math.min(V.egi.y + 2, Y(s.bottom) - 26);
          V.hug.ang += wrap(angleOf(0.9, 0.45) - V.hug.ang) * k8;
          taut = B.kind === 'tap' ? 0.95 : 0.6;
        }
        V.hug.alpha = B.kind === 'stop' || B.kind === 'slack' ? 0.6 : 1;
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

    /* ----- 竿を描く ----- */
    const { tip, bend } = rodGeom(V.rodAng, pull, lineEnd, V.rodLag);
    const R = S.rod;
    sc.rodOutline.setAttribute('d', rodPathD(S.grip, bend, tip, R.width[0], R.width[1], R.outline));
    sc.rod.setAttribute('d', rodPathD(S.grip, bend, tip, R.width[0], R.width[1]));

    /* ----- 糸：竿先 → エギ（イカ）。根掛かりで切れたら短く垂れる ----- */
    let d;
    if (V.lineBroken) {
      d = `M${f1(tip.x)},${f1(tip.y)} q${f1(wobble)},20 ${f1(wobble * 0.5)},46`;
    } else if (V.egi.mode === 'cast' && C?.released && V.flyDir) {
      d = trailingLineD(tip, lineEnd, V.flyDir, V.flyK, reduced ? 0 : Math.sin(now * 9) * 6);
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
    const egiVisible = !V.hug.on || V.egi.mode === 'flight' || V.egi.mode === 'cast';
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
    n.hugWater.setAttribute('opacity', V.hug.on && !hugInAir ? String(V.hug.alpha ?? 1) : '0');
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
      if (underwater && s.interest > 0.2 && i < s.squid) {
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
      for (let x = S.pierRight; x <= W * 1.6; x += 30) pts.push(`${x},${f1(S.surface + 2.5 * Math.sin(x / 42 - now * 1.6))}`);
      sc.wave.setAttribute('d', `M${pts.join(' L')}`);
    }

    /* ----- カメラ：フルキャストの高い山を追って少し引き、着水したら戻る ----- */
    const camTarget = C?.rel ? 1 + 0.36 * C.rel.distK : 1;
    V.cam += (camTarget - V.cam) * (1 - Math.exp(-dt * (camTarget > V.cam ? 6 : 2.5)));
    if (Math.abs(V.cam - (V.camShown ?? 1)) > 0.002) {
      V.camShown = V.cam;
      const z = V.cam;
      sc.svg.setAttribute('viewBox', `${f1(-W * (z - 1) * 0.12)} ${f1(-S.H * (z - 1) * 0.82)} ${f1(W * z)} ${f1(S.H * z)}`);
    }

    /* ----- HUD ----- */
    if (phase === 'aiming') powerFill.style.height = `${(s.power * 100).toFixed(0)}%`;   // 縦のゲージ（下から上へ）
    if (phase === 'fight') {
      tensionFill.style.height = `${clamp(s.tension, 0, 100).toFixed(0)}%`;
      el.tension.classList.toggle('is-high', s.tension >= 80);
      el.tension.classList.toggle('is-slack', s.tension <= 5);
      setText(el.dist, 'dist', Math.max(0, s.dist).toFixed(0));
    }
    el.reel.hidden = phase !== 'fight';   // 残りの距離は舞台の右上に（ゲージの下だと指で隠れて見えない）
    const inWater = (phase === 'sinking' || phase === 'action' || phase === 'signal') && !V.cast;
    el.count.hidden = !inWater;
    if (inWater) {
      const onBottom = s.depth >= s.bottom;
      const label = phase === 'sinking' ? t(lang, TX.hud.count) : t(lang, TX.hud.fall);
      setText(el.countLabel, 'label', label);
      setText(el.countNum, 'count', String(Math.max(0, Math.floor(phase === 'sinking' ? s.t - castAt : since))));
      setText(el.depth, 'depth', onBottom ? `${t(lang, TX.hud.bottom)}！` : `${t(lang, TX.hud.depth)} ${t(lang, '約', '~')}${s.bottom}m`);
      el.count.classList.toggle('is-bottom', onBottom);
      el.windnote.hidden = !(s.windows.good < SIGNAL_GOOD - 0.01 && phase !== 'signal');
      el.count.classList.toggle('is-warn', onBottom && s.bottomFor > 1.2);
    }
    el.btn.classList.toggle('is-signal', phase === 'signal' && settings.cue === 'easy');
    el.flash.hidden = true;   // 帯は使わない（本格：糸と竿先で読む／やさしい：小さなラベル）
    if (phase !== 'signal' && !el.cueLabel.hidden) el.cueLabel.hidden = true;
    el.btn.classList.toggle('is-pressing', s.pressing && phase === 'fight');
  }

  /* ---------- 開発用：場面を作って止める ---------- */
  function runDemo(name) {
    const step = (sec) => { for (let k = 0; k < sec / 0.05; k++) { onEvents(tick(s, 0.05)); now += 0.05; draw(0.05); } };
    const jerk = () => { press(s); onEvents(s.events.splice(0)); release(s); };
    const cast = () => { press(s); step(0.72); release(s); onEvents(s.events.splice(0)); step(0.05); landEgi(); };
    const toSignal = () => {
      cast(); step(4.2); jerk(); step(0.3); jerk(); step(2.4);
      const pool = speciesPool(s.month, s.tod);
      s.hooking = { id: pool[0].id, weight: 620, mantle: 21, power: 0.7 };
      s.phase = 'signal'; s.signalAt = s.t; s.events.push({ type: 'signal', t: s.t }); onEvents(s.events.splice(0));
    };
    // 自動で投げる（実時間で振りかぶり 0.9 秒→放す）。windup / release / flight / splash はその場面で見た目ごと止める
    // holdMs：押している長さ。判定の力は 0.8 秒で最大なので、full＝800ms・weak＝120ms
    const autoCast = (holdName, holdMs = 800) => {
      V.hold = holdName ?? null;
      setTimeout(() => { press(s); onEvents(s.events.splice(0)); setButton(); }, 300);
      setTimeout(() => { release(s); onEvents(s.events.splice(0)); setButton(); }, 300 + holdMs);
    };
    if (name === 'cast' || name === 'castfull') autoCast(null, 800);
    else if (name === 'castweak') autoCast(null, 120);
    else if (name === 'windup') { setTimeout(() => { press(s); onEvents(s.events.splice(0)); setButton(); }, 300); setTimeout(() => { frozen = true; }, 1100); }
    else if (name === 'release' || name === 'flight' || name === 'splash') autoCast(name);
    else if (name === 'aiming') { press(s); step(0.45); onEvents(s.events.splice(0)); frozen = true; }
    else if (name === 'sinking') { cast(); landEgi(); step(4.5); frozen = true; }
    else if (name === 'signal') { toSignal(); step(0.35); frozen = true; }
    else if (name === 'fight') { toSignal(); step(0.3); s.rand = () => 0; press(s); onEvents(s.events.splice(0)); release(s); step(1.4); s.tension = 62; s.dist = 9; press(s); frozen = true; }
    else if (name === 'landed') { toSignal(); step(0.3); s.rand = () => 0; press(s); onEvents(s.events.splice(0)); release(s); step(0.4); s.dist = 0.01; press(s); step(0.2); release(s); s.rand = Math.random; frozen = true; }
    else if (name === 'nosignal') { cast(); step(3); s.squid = 0; s.dist = 2.5; jerk(); step(0.3); frozen = true; }
    else if (name === 'stop') {
      // 取得を待たず、中止レベルの海況を差し込む
      liveDone = true;
      renderLive({ conditions: { expectation: 3, wind: 9.2, gust: 14.5, wave: 1.7, safety: 'stop' }, expectation: { message: t(lang, '今は釣れる時間ではないかもしれないです！', 'Probably not the best hour right now.'), tideName: t(lang, '中潮', 'medium tide') }, safety: { key: 'stop', level: 3, label: t(lang, '中止', 'STOP'), message: t(lang, '今日は堤防に立たないでください。', 'Do not go out on the breakwater today.') }, tod: 'day', month: settings.month, now: new Date(), weather: null, tide: null, partial: false });
    }
    else if (name === 'punch') { cast(); step(2.5); jerk(); step(1.2); s.punchAt = s.t; s.punchPending = true; s.events.push({ type: 'punch', t: s.t }); onEvents(s.events.splice(0)); frozen = true; }
    else if (name === 'snag') { cast(); step(s.bottom / 0.9 + 1.6); s.rand = () => 0; step(0.3); s.rand = Math.random; frozen = true; }
    else if (name === 'tension') { cast(); step(2.5); press(s); onEvents(s.events.splice(0)); step(1.6); frozen = true; }
    else if (name === 'free') { cast(); step(2.5); jerk(); step(1.6); frozen = true; }
    else if (name === 'dart') { cast(); step(2.5); dart(s); onEvents(s.events.splice(0)); step(0.12); frozen = true; }
    else if (name === 'mood') { cast(); step(2.5); dart(s); onEvents(s.events.splice(0)); step(0.3); release(s); step(2.2); frozen = true; }
    else if (name.startsWith('bite:')) {
      // bite:<run|tap|stop|slack>[:easy]
      const [, kind, mode] = name.split(':');
      if (mode === 'easy') { settings.cue = 'easy'; syncCueSetting(); }
      cast(); step(3.2);
      if (kind === 'tap') { press(s); onEvents(s.events.splice(0)); step(0.6); } else { jerk(); step(1.4); }
      const pool = speciesPool(s.month, s.tod);
      s.hooking = { id: pool[0].id, weight: 520, mantle: 20, power: 0.7 };
      s.bite = { kind, light: false };
      s.phase = 'signal'; s.signalAt = s.t; s.events.push({ type: 'signal', t: s.t, kind, light: false, tensionFall: s.tensionFall }); onEvents(s.events.splice(0));
      step(kind === 'tap' ? 0.12 : 0.4);
      frozen = true;
    }
    else if (name === 'over') {
      s.catches = [{ id: 'aori', weight: 420, mantle: 19 }, { id: 'kouika', weight: 610, mantle: 16 }];
      s.casts = 1; toSignal(); step(0.3); s.rand = () => 0; press(s); onEvents(s.events.splice(0)); release(s); step(0.4); s.dist = 0.01; press(s); step(0.2); release(s); s.rand = Math.random; frozen = true;
    }
    // 止めた場面でも見た目の動き（揺れ・波）は続ける
    setButton();
    if (s.phase === 'result') showResult();
  }

  // 開発用：一時停止の条件
  function holdReached(name) {
    const C = V.cast;
    if (name === 'release') return Boolean(C && !C.released && now - C.t0 >= 0.14);
    if (name === 'flight') return Boolean(C?.rel && (now - C.rel.t0) / C.rel.T >= 0.5);
    if (name === 'splash') return Boolean(V.splashAt && now - V.splashAt >= 0.1);
    return false;
  }

  /* ---------- 起動 ---------- */
  syncSetup();
  syncCueSetting();
  relayout();
  if (!sc) buildScene();
  newGame();
  syncRecords();
  el.btn.disabled = false;
  let liveDone = false;
  if (demo) runDemo(demo);
  if (!liveDone) loadHagiSea({ lang }).then(renderLive).catch(failLive);
  start();

  return {
    get state() { return s; },
    press: doPress, release: doRelease,
    settings, newGame,
  };
}

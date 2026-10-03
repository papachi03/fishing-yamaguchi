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
import { rebait, BAITS, AJI, yaenSideAction, yaenAji, yaenFresh, yaenRunning, tailorSet, TANAS, TAILOR_BAITS, YAEN_DIST, YAEN_CHASE, canJadoLift } from './egi.js';
import { levelOf, methodState, nextSeasonMonth, unlockedBetween, METHODS, METHOD_IDS } from './progress.js';
import { createEgi, press, release, tick, dart, setEgi, speciesPool, seasonOf, SEASON_MODES, EGI_COLOR_HEX, colorFit, bestColors, clarityOf, moodOf, CASTS, SIGNAL_GOOD, DEFAULT_CONDITIONS, DEFAULT_EGI, normalizeEgi, normalizeTackle, setTackle, TACKLE, RODS, DRAGS, EGI_RIGS } from './egi.js';
import { rhythmHintKey } from './egi-advice.js';
import { moonPhase, MOON_PRESET } from './egi.js';
import { readJSON as readPref, writeJSON as writePref } from './records.js';
import { createFeel, canVibrate } from './feel.js';
const JET_RESIST = 4;    // ジェットの後、抵抗が残っている秒数（この間に巻くと最初に「チリリリ」を1回）
const RESIST_TENSION = 70;   // 糸の張りがこれ以上で「抵抗がある」＝ドラグ「ジーー」（ゲージが赤くなる80の少し手前）
import { createBgm } from './bgm.js';
import { shakeSupported, requestShakePermission, watchShake } from './shake.js';
import { buildTailor, drawTailor, tailorHit, tailorDeco } from './tailor-ui.js';
import { loadHagiSea, todFromClock, HAGI } from './sea-live.js';
import { sunTimes } from '../../api/fishing.js';
import { SCENE, PALETTE, egiSceneSVG, seabedD, rocksSVG, weedSVG, depthY, distX } from './egi-scene.js';
import { svgEl, egiShape, ART, speciesColors } from '../squid-art.js';
import { huggingSquid, swimmingSquid, animateSquid } from '../squid-art2.js';   // 第2版の絵（2026-09-29 まずアオリイカ。ほかの種類は第1版のまま）
import { rodPathD, lerp } from '../hero-scene.js';
import { createPendulum, swingEase, flightPoint, headingDeg, flightTime, flightApex, trailingLineD } from '../cast-physics.js';
import { EGI_TEXT as TX, TOD, SEASON, monthLabel, speciesName, speciesById, YAMAGUCHI_SQUID, GAME_ZUKAN, zukanById, zukanArt } from './play-text.js';
import { aroundHTML, egiPickerHTML, egiTraitsHTML, egiIconHTML, EGI_LEGS_D } from '../views/play.js';
import { ANGLERS, ANGLER_BASE_H, anglerOf, readAnglers, writeAnglers, buyAngler, useAngler } from './anglers.js';
import { readTickets, writeTickets } from './tickets.js';
import { IS_TRIAL } from '../views/trial-notice.js';
import { utcDay } from './rng.js';
import { recommendedSizes } from './egi-advice.js';
import { recordGedo } from './records.js';
import { readJSON, writeJSON, recordEgiCatch, recordEgiTrip, emptyEgi, KEY_EGI, KEY_M3, readRecord, writeRecord, storageWorks, exportCode, importCode, mergeEgi, mergeM3 } from './records.js';
import { t, esc, assetHref, pageHref } from '../i18n.js';
import { openShareView, shareButtonHTML, shareUrl, egiCatchText, egiTripText, SHARE_VARIANT } from './share.js';

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
    callout: q('ika-egi-callout'), guideTag: q('ika-egi-guide'), flash: q('ika-egi-flash'), card: q('ika-egi-card'),
    power: q('ika-egi-power'), tension: q('ika-egi-tension'), dist: q('ika-egi-dist'), reel: q('ika-egi-reel'), reelLabel: q('ika-egi-reel-label'), reelDelta: q('ika-egi-reel-delta'), main: root.querySelector('.ika-egi-main'), log: q('ika-egi-log'),
    setup: q('ika-egi-setup'), tod: q('ika-egi-tod'), month: q('ika-egi-month'), season: q('ika-egi-season'), hint: q('ika-egi-hint'), around: q('ika-egi-around'), locked: q('ika-egi-locked'),
    live: q('ika-egi-live'), liveBody: q('ika-egi-live-body'), liveTime: q('ika-egi-live-time'), liveNotice: q('ika-egi-live-notice'), liveSource: q('ika-egi-live-source'),
    playLive: q('ika-egi-play-live'), playPractice: q('ika-egi-play-practice'), playBeginner: q('ika-egi-play-beginner'), beginnerHint: q('ika-egi-beginner-hint'), tips: q('ika-egi-tips'), practice: q('ika-egi-practice'), exp: q('ika-egi-exp'), expOut: q('ika-egi-exp-out'), wind: q('ika-egi-wind'), mode: q('ika-egi-mode'), windnote: q('ika-egi-windnote'),
    pick: q('ika-egi-pick'), pickSize: q('ika-egi-size'), pickType: q('ika-egi-type'), pickIcon: q('ika-egi-pick-icon'), pickCurrent: q('ika-egi-pick-current'), pickTraits: q('ika-egi-pick-traits'), pickRec: q('ika-egi-pick-rec'),
    pickRig: q('ika-egi-rig'), popRig: q('ika-egi-colorpop-rig'), tk: q('ika-egi-tk'), anglerPop: q('ika-egi-anglerpop'), rod: q('ika-egi-rod'), drag: q('ika-egi-drag'), rodNote: q('ika-egi-rod-note'), dragNote: q('ika-egi-drag-note'),
    cueSetting: q('ika-egi-cue'), cueLabel: q('ika-egi-cue-label'), spec: q('ika-egi-spec'), fallmode: q('ika-egi-fallmode'), dartBtn: q('ika-egi-dart'),
    catches: q('ika-egi-catches'), records: q('ika-egi-records'), seasons: q('ika-egi-seasons'),
    zukanGrid: q('ika-egi-zukan-grid'), zukanCount: q('ika-egi-zukan-count'), zukanDetail: q('ika-egi-zukan-detail'),
    pickColor: q('ika-egi-color'), colorTip: q('ika-egi-colortip'), colorPop: q('ika-egi-colorpop'), colorPopChips: q('ika-egi-colorpop-chips'), colorPopWhy: q('ika-egi-colorpop-why'),
    feel: q('ika-egi-feel'), feelVib: q('ika-egi-feel-vibrate'), feelSound: q('ika-egi-feel-sound'), feelShake: q('ika-egi-feel-shake'), shakeWarn: q('ika-egi-shake-warn'),
    ajiBox: q('ika-egi-aji'), ajis: q('ika-egi-ajis'), tanaBox: q('ika-egi-tana'), tanas: q('ika-egi-tanas'), tailorBtns: q('ika-egi-tailorbtns'),
    methods: q('ika-egi-methods'), methodAbout: q('ika-egi-method-about'), baitBox: q('ika-egi-bait'), baits: q('ika-egi-baits'),
    baitRow: q('ika-egi-baitrow'), baitFill: q('ika-egi-baitfill'), baitName: q('ika-egi-baitname'),
    levelNum: q('ika-egi-level-num'), levelFill: q('ika-egi-level-fill'), levelNext: q('ika-egi-level-next'),
    gedoGrid: q('ika-egi-gedo-grid'), gedoCount: q('ika-egi-gedo-count'),
  };
  const powerFill = el.power.querySelector('.ika-egi-gauge-fill');
  const tensionFill = el.tension.querySelector('.ika-egi-gauge-fill');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 設定と記録 ---------- */
  // 条件：mode は 'live'（今日の萩の海）か 'practice'（自分で選ぶ）。時間帯は最初から時計と日の出入りで決める
  const now0 = new Date();
  const sun0 = sunTimes(HAGI.homeSpot?.lat ?? HAGI.lat, HAGI.homeSpot?.lon ?? HAGI.lon, now0);
  let lastShare = null;
  const cue = () => (settings.mode === 'beginner' ? 'easy' : settings.cue);   // 初心者練習はアタリを「やさしい表示」に固定
  let guide = 0;
  let dryCasts = 0, tipsNudged = false;
  // 手順の案内は専用の札に、次の手順まで出したままにする（吹き出しは「着水！」などで上書きされて一瞬で消えた。ぱっぱ 9/27）
  const GUIDE_KEYS = [null, 'cast', 'sink', 'fall'];
  function showGuide() {
    if (!el.guideTag) return;
    const key = GUIDE_KEYS[guide];
    el.guideTag.hidden = !key;
    if (key) el.guideTag.textContent = t(lang, TX.guide[key]);
  }   // アタリなしが3投続いたら、一度だけ「コツを見る」を勧める   // 🔰初心者練習の手順案内（1＝投げる前、2＝投げた、3＝しゃくった、0＝おしまい）   // シェアする結果（釣れた1杯／釣行のまとめ）。share.js
  const settings = { mode: 'practice', month: now0.getMonth() + 1, tod: todFromClock(now0, sun0.sunrise, sun0.sunset), cond: { ...DEFAULT_CONDITIONS }, live: null, egi: normalizeEgi({ ...DEFAULT_EGI, rig: readPref('ikabu.egi.rig') }), cue: readPref('ikabu.egi.cue') ?? 'real',
    tackle: normalizeTackle({ rod: readPref('ikabu.egi.rod'), drag: readPref('ikabu.egi.drag') }),   // ロッド・ドラグ（2026-10-01）
    method: METHOD_IDS.includes(readPref('ikabu.egi.method')) ? readPref('ikabu.egi.method') : 'egi',   // 釣り方（2026-09-27）
    bait: BAITS.includes(readPref('ikabu.egi.bait')) ? readPref('ikabu.egi.bait') : 'sasami',
    aji: AJI.includes(readPref('ikabu.egi.aji')) ? readPref('ikabu.egi.aji') : 'live',   // ヤエンのアジ（2026-09-28 案B）
    tana: TANAS.includes(readPref('ikabu.egi.tana')) ? readPref('ikabu.egi.tana') : 'one' };   // テーラーのタナ（2026-09-28）
  // テーラーは冬の夜の釣り：舞台と時間帯は夜に固定
  const todNow = () => (settings.method === 'tailor' ? 'night' : settings.tod);
  const feel = createFeel({ vibrate: readPref('ikabu.egi.vibrate') ?? true, sound: readPref('ikabu.egi.sound') ?? true, dragSample: assetHref('/assets/ikabu/audio/gacha/se_drag.mp3'), reelSample: assetHref('/assets/ikabu/audio/reel-click.mp3') });   // ドラグ音は本物（2026-09-30）   // 音は最初からオン（2026-09-27 ぱっぱ：気づかない人が多い。消したい人が探してオフにする）
  // BGMは最初はオフ（2026-09-30 ぱっぱ：好みがあるので）。オンにした人だけ曲を読み込む
  const bgm = createBgm({ on: readPref('ikabu.egi.bgm') ?? false, track: 'egi', href: assetHref });
  const WIND_PRESET = { calm: { wind: 2, gust: 4, wave: 0.3 }, breezy: { wind: 5, gust: 8, wave: 0.8 }, strong: { wind: 7, gust: 12, wave: 1.3 } };
  let signalsThisCast = 0;
  // 記録（2026-09-27：控えから戻せる読み書き。釣れた瞬間に1杯ずつ保存）
  const loaded = readRecord(KEY_EGI);
  let rec = { ...emptyEgi(), ...(loaded.value ?? {}) };
  rec.species = rec.species ?? {};
  rec.gedo = rec.gedo ?? {};
  rec.points = rec.points ?? 0;
  const canSave = storageWorks();
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
    el.scene.innerHTML = egiSceneSVG({ lang, tod: todNow(), W, bottom, assetHref, moon: (settings.mode === 'live' ? settings.live?.conditions?.moon : settings.cond?.moon) ?? 0.5 });
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
    sc.under.append(n.swim[0], n.swim[1], n.escape, n.ink, n.ghost, n.punchSquid, n.egiWater, n.hugWater, n.jet, n.fx);
    sc.air.append(n.entry, n.egiAir, n.hugAir, n.toolPole, n.tool, n.surprise, ...n.drips);
    sc.tailor = buildTailor(sc);   // テーラーのウキ・置き竿・糸（2026-09-28）
    paintEgi();
    paintAngler();   // 釣り人キャラ（2026-10-02）
    paintJado();   // 部品を作り直したら、エギ／アジの出し分けもやり直す（全画面にしたらヤエンでエギが映った：2026-09-28 ぱっぱ）
    updateBottom(bottom);
    V.camShown = null;
    if (s) draw(0);   // 作り直した直後に1回描く（ループが止まっていても竿と糸が出るように）
  }
  // 邪道エギング（2026-09-27）：エギとスナップのつなぎ目にオモリ、背中にエサ（ぱっぱの写真どおり）
  function jadoDeco() {
    const g = svgEl('g', { class: 'ika-eg-jado', style: 'display:none' });
    const sinker = svgEl('ellipse', { cx: '0', cy: '-6', rx: '3.6', ry: '4.2', fill: '#3b4148', stroke: '#16233a', 'stroke-width': '1.6' });
    const kibinago = svgEl('g', { class: 'ika-eg-bait-kibinago' });
    kibinago.append(
      svgEl('path', { d: 'M5,3 Q10,12 8,24 Q7,28 5,27 Q6,15 3,4 Z', fill: '#d9e2e8', stroke: '#16233a', 'stroke-width': '1.3', 'stroke-linejoin': 'round' }),
      svgEl('path', { d: 'M6,6 Q9,14 7,24', fill: 'none', stroke: '#5b86b0', 'stroke-width': '1.4', 'stroke-linecap': 'round' }),
    );
    const sasami = svgEl('g', { class: 'ika-eg-bait-sasami' });
    sasami.append(
      svgEl('path', { d: 'M4,5 Q10,13 7,25 L4,25 Q6,15 2,6 Z', fill: '#f6dcd3', stroke: '#16233a', 'stroke-width': '1.3', 'stroke-linejoin': 'round' }),
      svgEl('path', { d: 'M2,10 L9,11 M3,18 L9,19', stroke: '#9aa6ad', 'stroke-width': '1', 'stroke-linecap': 'round' }),
    );
    g.append(sinker, kibinago, sasami);
    return g;
  }
  let ajiClipN = 0;
  function ajiDeco() {
    const g = svgEl('g', { class: 'ika-eg-aji', style: 'display:none' });
    // 頭から食べられる（2026-09-27 ぱっぱ：イカはアジを必ず頭から食べる。仕掛けは尻尾に針）。残りの分だけ尾の側を見せる
    const id = `ika-aji-clip-${++ajiClipN}`;
    const clip = svgEl('clipPath', { id });
    clip.append(svgEl('rect', { class: 'ika-eg-aji-clip', x: '-12', y: '-4', width: '24', height: '50' }));
    g.append(clip);
    g.setAttribute('clip-path', `url(#${id})`);
    // 仕掛けはアジの尻尾に針（2026-09-28 ぱっぱ：糸は尻尾の側に付ける）→ 絵を上下逆さにして、尻尾を上（糸の結び目）、頭を下に
    const art = svgEl('g', { transform: 'translate(0,40) scale(1,-1)' });
    g.append(art);
    art.append(
      svgEl('path', { d: 'M0,34 L-6,42 L6,42 Z', fill: '#b9c6cf', stroke: '#16233a', 'stroke-width': '1.6', 'stroke-linejoin': 'round' }),
      svgEl('path', { d: 'M0,-2 Q8,8 6,20 Q4,30 0,35 Q-4,30 -6,20 Q-8,8 0,-2 Z', fill: '#d9e2e8', stroke: '#16233a', 'stroke-width': '2.2', 'stroke-linejoin': 'round' }),
      svgEl('path', { d: 'M-2,6 Q-4,18 -1,30', fill: 'none', stroke: '#5b86b0', 'stroke-width': '2', 'stroke-linecap': 'round' }),
      svgEl('path', { d: 'M4,10 L5,28', stroke: '#e0b64a', 'stroke-width': '1.6', 'stroke-linecap': 'round' }),
      svgEl('circle', { cx: '0', cy: '4', r: '1.8', fill: '#16233a' }),
    );
    return g;
  }
  function paintJado() {
    const n = sc?.nodes;
    if (!n) return;
    const on = settings.method === 'jado';
    const bait = s?.bait ?? settings.bait;
    const yaen = settings.method === 'yaen';
    const tailor = settings.method === 'tailor';
    for (const g of [n.egiWater, n.egiAir, n.ghost]) {
      const egiArt = g.querySelector('.ika-art-egi');
      if (egiArt) egiArt.style.display = yaen || tailor ? 'none' : '';
      const rig = g.querySelector('.ika-tl-deco');
      if (rig) rig.style.display = tailor ? '' : 'none';
      const aji = g.querySelector('.ika-eg-aji');
      if (aji) aji.style.display = yaen ? '' : 'none';
      const d = g.querySelector('.ika-eg-jado');
      if (!d) continue;
      d.style.display = on ? '' : 'none';
      d.querySelector('.ika-eg-bait-kibinago').style.display = bait === 'kibinago' ? '' : 'none';
      d.querySelector('.ika-eg-bait-sasami').style.display = bait === 'sasami' ? '' : 'none';
    }
  }
  function makeNodes() {
    const mk = (cls) => svgEl('g', { class: cls, opacity: '0' });
    const n = {
      swim: V.swim.map(() => mk('ika-eg-swim')),
      escape: mk('ika-eg-escape'),
      ink: svgEl('g', { class: 'ika-eg-ink', opacity: '0' }),
      ghost: mk('ika-eg-ghost'),
      punchSquid: mk('ika-eg-punchsquid'),   // イカパンチで突っ込んでくるイカの影（2026-09-27 ぱっぱ：パンチの動きが見えないと伝わらない）
      egiWater: mk('ika-eg-egi'), egiAir: mk('ika-eg-egi'),
      hugWater: mk('ika-eg-hug'), hugAir: mk('ika-eg-hug'),
      // 取り込みの道具（2026-10-01）：タモ・ギャフの絵。堤防側（左）から出てきてイカを取り、吊り上げに付いていく
      // 釣り人の驚き（ジェットの瞬間。2026-10-02 ぱっぱ）：頭の上の「！」と汗のしずく
      surprise: (() => {
        const g = svgEl('g', { class: 'ika-eg-surprise', opacity: '0' });
        g.append(
          svgEl('circle', { cx: '0', cy: '0', r: '13', fill: '#fff', stroke: '#0b2a2f', 'stroke-width': '3' }),
          svgEl('path', { d: 'M0,-7 L0,2', stroke: '#f47321', 'stroke-width': '4', 'stroke-linecap': 'round' }),
          svgEl('circle', { cx: '0', cy: '7', r: '2.2', fill: '#f47321' }),
          svgEl('path', { class: 'ika-eg-sweat', d: 'M-30,8 Q-35,16 -30,20 Q-25,16 -30,8 Z', fill: '#bfe3ff', stroke: '#0b2a2f', 'stroke-width': '1.6' }),
        );
        return g;
      })(),
      toolPole: svgEl('line', { class: 'ika-eg-tool-pole', opacity: '0', stroke: '#1c2230', 'stroke-width': '5', 'stroke-linecap': 'round' }),   // 伸縮する柄（釣り人の手元から先まで）
      tool: svgEl('image', { class: 'ika-eg-tool', opacity: '0', preserveAspectRatio: 'xMidYMid meet' }),
      jet: svgEl('ellipse', { class: 'ika-eg-jet', fill: '#dff6f8', opacity: '0' }),
      // エフェクト（2026-09-25）：ジェットの水流の筋、泡、パンチの足の影と波紋
      fx: svgEl('g', { class: 'ika-eg-fx' }),
      entry: svgEl('ellipse', { class: 'ika-eg-entry', rx: '10', ry: '3.5', fill: 'none', stroke: '#fff', 'stroke-width': '2', opacity: '0' }),
      drips: [0, 1, 2].map((i) => svgEl('circle', { r: i === 0 ? '4' : '3', fill: i === 0 ? '#050c1a' : '#dff6f8', opacity: '0' })),
    };
    n.jetStreak = svgEl('path', { fill: 'rgba(223,246,248,0.55)', opacity: '0' });
    n.jetCore = svgEl('path', { fill: 'none', stroke: 'rgba(255,255,255,0.8)', 'stroke-width': '2', 'stroke-linecap': 'round', opacity: '0' });
    n.bubbles = Array.from({ length: 18 }, () => svgEl('circle', { r: '2', fill: 'none', stroke: 'rgba(230,250,252,0.85)', 'stroke-width': '1.2', opacity: '0' }));
    n.punchRing = svgEl('ellipse', { fill: 'none', stroke: 'rgba(230,250,252,0.9)', 'stroke-width': '2', opacity: '0' });
    n.punchArms = [0, 1, 2].map(() => svgEl('path', { fill: 'none', stroke: 'rgba(10,28,36,0.92)', 'stroke-width': '8', 'stroke-linecap': 'round', opacity: '0' }));
    n.fx.append(n.jetStreak, n.jetCore, n.punchRing, ...n.punchArms, ...n.bubbles);
    n.egiWater.append(egiShape());
    n.egiAir.append(egiShape());
    n.egiWater.append(jadoDeco(), ajiDeco(), tailorDeco());
    n.egiAir.append(jadoDeco(), ajiDeco(), tailorDeco());
    // 竿先に下がったエギのタップ判定（小さいエギでも押しやすいよう大きめの透明な円）
    n.egiAir.append(svgEl('circle', { class: 'ika-eg-egi-hit', cx: '0', cy: '14', r: '34', fill: 'transparent', 'pointer-events': 'all' }));   // スマホで指 44px 前後になる大きさ
    n.ghost.append(egiShape(), ajiDeco());
    n.inkBody = svgEl('ellipse', { fill: '#050c1a' });
    n.inkRim = svgEl('ellipse', { fill: 'none', stroke: 'rgba(205,240,238,0.6)', 'stroke-width': '3' });
    n.inkArms = [0, 1, 2].map(() => svgEl('ellipse', { fill: '#050c1a' }));
    n.ink.append(n.inkRim, ...n.inkArms, n.inkBody);
    return n;
  }
  // 海底：投げるたびに深さが変わる
  function updateBottom(bottom) {
    sc.bottomG.innerHTML = `<path class="ika-eg-seabed" d="${seabedD(bottom, W, s?.casts ?? 0)}" fill="#c9b787" stroke="#0b2a33" stroke-width="3" />${rocksSVG(bottom, W, s?.casts ?? 0)}${s?.phase !== 'ready' ? weedSVG(s?.weed, bottom, X) : ''}`;
  }
  // 気配のイカ・抱いたイカの絵は、種類が決まるたびに作り直す。
  // 驚き重視（ぱっぱ 2026-09-25）：正体が分かるまでは全種同じ形（大きさだけ違う）、分かったらその種の形・色・目印
  const SHADOW = { ...ART, ivory: '#1f3a46', fin: '#1f3a46', arm: '#1f3a46', navy: '#0a1c24', hi: '#1f3a46' };
  function fishArt(len, revealed) {
    const L = clamp(len * 1.6, 40, 90);
    const body = revealed ? '#c8452f' : '#1f3a46', fin = revealed ? '#e07a4f' : '#1f3a46', line = revealed ? '#5a1a10' : '#0a1c24';
    const g = svgEl('g', { class: 'ika-art-fish' });
    g.append(
      svgEl('path', { d: `M0,${L * 0.95} L${-L * 0.2},${L * 1.18} L${L * 0.2},${L * 1.18} Z`, fill: fin, stroke: line, 'stroke-width': '2', 'stroke-linejoin': 'round' }),
      svgEl('path', { d: `M${L * 0.2},${L * 0.2} L${L * 0.34},${L * 0.28} L${L * 0.3},${L * 0.42} L${L * 0.36},${L * 0.5} L${L * 0.3},${L * 0.64} L${L * 0.33},${L * 0.72} L${L * 0.16},${L * 0.8} Z`, fill: fin, stroke: line, 'stroke-width': '1.6', 'stroke-linejoin': 'round' }),
      svgEl('ellipse', { cx: '0', cy: String(L * 0.5), rx: String(L * 0.24), ry: String(L * 0.5), fill: body, stroke: line, 'stroke-width': '2.4' }),
      svgEl('circle', { cx: String(-L * 0.08), cy: String(L * 0.14), r: String(L * 0.06), fill: revealed ? '#ffe9a8' : '#2d4b58', stroke: line, 'stroke-width': '1.4' }),
    );
    if (revealed) for (const [x, y] of [[0.06, 0.36], [-0.1, 0.52], [0.08, 0.64], [-0.04, 0.78]]) g.append(svgEl('circle', { cx: String(L * x), cy: String(L * y), r: String(L * 0.045), fill: '#7a2416', opacity: '0.7' }));
    return g;
  }
  const FISH = ['kasago'];
  function setSquidArt(node, kind, species, len, revealed = false) {
    node.innerHTML = '';
    if (FISH.includes(species)) { node.append(fishArt(len, revealed)); return; }
    // 正体が分かるまでは暗い色で描いた影。CSS の filter は SVG の中の部品には効かないブラウザがある（ぱっぱのスクショで判明）ので色で作る
    //   ※ 2026-09-28 修正：ヤエンの行を足した時に if/else の組がずれて、抱いたイカの上に青い「泳ぐイカ」が重なっていた（ぱっぱ：釣れた時に青い）
    if (kind !== 'hug') { node.append(swimmingSquid({ species: 'default', len, colors: { ...ART, ivory: '#8fb6bf', navy: '#0e2733' } })); return; }
    node.append(revealed ? huggingSquid({ species, len, colors: speciesColors(species) }) : huggingSquid({ species: 'default', len, colors: SHADOW }));
    const method = s?.method ?? settings.method;
    // テーラー：腕の中はテーラー（egi 側の絵）
    if (method === 'tailor') node.querySelectorAll('.ika-art-egi').forEach((e) => { e.style.display = 'none'; });
    // ヤエン：抱いたイカの腕の中はエギではなくアジ（2026-09-28 ぱっぱ：エギが一瞬映る）
    if (method === 'yaen') {
      node.querySelectorAll('.ika-art-egi').forEach((e) => { e.style.display = 'none'; });
      const aji = ajiDeco(); aji.style.display = ''; aji.removeAttribute('clip-path');
      node.querySelector('.ika-art-hug')?.insertBefore(aji, node.querySelector('.ika-art-hug').children[1] ?? null);
    }
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

  /* ---------- 取り込みの道具（2026-10-01 ぱっぱ：小＝ぶっこ抜き、中＝タモ、大＝ギャフ。絵は GPT） ---------- */
  // 絵は先（網・鉤）だけ。柄は釣り人の手元（SCENE.grip）から先まで線で描き、伸び縮みする（10/2 ぱっぱ：本物は手元を動かさず、伸縮する棒が伸びて取り、縮みながら回収）
  const TOOL = {
    net: { w: 98, h: 150, headX: 0.625, headY: 0.513, src: assetHref('/assets/ikabu/tools/tamo_head.webp') },
    gaff: { w: 74, h: 75, headX: 0.678, headY: 0.5, src: assetHref('/assets/ikabu/tools/gaff_head.webp') },   // 鉤は半分の大きさ（10/2 ぱっぱ「フックが大きい」）
  };
  // 先（網の中心・鉤）を (tx, ty) に置く。絵は手元→先の向きに回し、柄の線は手元から絵の付け根まで
  function drawTool(kind, tx, ty, alpha) {
    const im = sc?.nodes?.tool; const pole = sc?.nodes?.toolPole;
    if (!im || !pole) return;
    if (!alpha) { im.setAttribute('opacity', '0'); pole.setAttribute('opacity', '0'); return; }
    const T = TOOL[kind];
    if (im.dataset.kind !== kind) { im.setAttribute('href', T.src); im.setAttribute('width', String(T.w)); im.setAttribute('height', String(T.h)); im.dataset.kind = kind; }
    const g = SCENE.grip;
    const ang = Math.atan2(ty - g.y, tx - g.x);
    const deg = (ang * 180) / Math.PI;
    const x0 = tx - T.w * T.headX; const y0 = ty - T.h * T.headY;
    im.setAttribute('x', String(x0)); im.setAttribute('y', String(y0));
    im.setAttribute('transform', `rotate(${deg.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)})`);
    im.setAttribute('opacity', String(alpha));
    const d = T.w * T.headX - 6;   // 絵の付け根（左端）まで
    const bx = tx - Math.cos(ang) * d; const by = ty - Math.sin(ang) * d;
    pole.setAttribute('x1', String(g.x)); pole.setAttribute('y1', String(g.y));
    pole.setAttribute('x2', bx.toFixed(1)); pole.setAttribute('y2', by.toFixed(1));
    pole.setAttribute('opacity', String(alpha));
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
  let bonusNote = null;   // ラストチャンス・救済の一言（着水の時に出す）
  function newGame() {
    if (methodNow(settings.method) !== 'ok') settings.method = 'egi';   // 解放・季節の外になった釣り方は、エギングに戻す
    s = createEgi({ tackle: settings.tackle, month: settings.month, tod: todNow(), conditions: settings.cond, egi: settings.egi, easy: settings.mode === 'beginner', method: settings.method, bait: settings.bait, aji: settings.aji, tana: settings.tana });
    V.fastDrags = 0;
    castAt = 0; inked = false; firstSpecies = []; signalsThisCast = 0; bonusNote = null;
    el.stage.classList.remove('is-lastchance');
    V.egi.mode = 'tip'; V.flight = null; V.cast = null; V.sinkOffset = 0; V.hug.on = false; V.hug.alpha = 0; V.escape = null; V.ink = null; V.land = null; V.lineBroken = false; V.ghost = null;
    V.swim.forEach((w, i) => { w.alpha = 0; w.x = W + 100 + i * 80; w.y = Y(4); });
    const pool = speciesPool(settings.month, todNow());
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
    syncMethod();
    setButton();
    showGuide();
  }

  /* ---------- 釣り方・部員レベル（2026-09-27） ---------- */
  let kotsuTaught = false;
  const levelNow = () => levelOf(rec.points).level;
  const methodNow = (id) => methodState(id, { level: levelNow(), month: settings.month, mode: settings.mode });
  const methodName = (id) => t(lang, TX.method.names[id]);
  function methodStateText(id, st) {
    if (st === 'ok') return id === 'egi' ? '' : t(lang, TX.method.season[id]);
    if (st === 'level') return TX.method.level(lang, METHODS[id].level);
    if (st === 'soon') return t(lang, TX.method.soon);
    if (st === 'beginner') return TX.method.level(lang, METHODS[id].level);
    // 季節ではない：リアルタイムなら「3月から」、季節モードなら「春・初夏で」
    return settings.mode === 'live' ? TX.method.nextSeason(lang, nextSeasonMonth(id, settings.month)) : t(lang, TX.method.season[id]);
  }
  function syncMethod() {
    if (!el.methods) return;
    const lock = started();
    el.methods.querySelectorAll('[data-method]').forEach((b) => {
      const id = b.dataset.method;
      const st = methodNow(id);
      b.setAttribute('aria-pressed', String(id === settings.method));
      b.dataset.st = st;
      b.disabled = lock || st === 'beginner';
      const small = b.querySelector('[data-state]');
      if (small) small.textContent = methodStateText(id, st);
    });
    el.methodAbout.textContent = t(lang, TX.method.about[settings.method] ?? TX.method.about.egi);
    const jado = settings.method === 'jado';
    el.baitBox.hidden = !jado;
    el.baits?.querySelectorAll('[data-bait]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.bait === settings.bait)); b.disabled = lock && !(s && (s.phase === 'result')); });
    const yaen = settings.method === 'yaen';
    if (el.ajiBox) {
      el.ajiBox.hidden = !yaen;
      el.ajis.querySelectorAll('[data-aji]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.aji === settings.aji)); b.disabled = lock; });
    }
    const tailor = settings.method === 'tailor';
    if (el.tanaBox) {
      el.tanaBox.hidden = !tailor;
      el.tanas.querySelectorAll('[data-tana]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.tana === settings.tana)); b.disabled = lock; });
    }
    if (el.tailorBtns) el.tailorBtns.hidden = !tailor;
    const gestRow = root.querySelector('#ika-egi-gest-row');
    if (gestRow) gestRow.textContent = t(lang, tailor ? TX.tailor.gest : TX.gestures.row);
    // 残りの投げ（エギ5回）／残りのアジ／残りのエサ（テーラーは9個）の数だけ印を並べ直す
    { const n0 = tailor ? TAILOR_BAITS : CASTS;
      if (el.casts.children.length !== n0) el.casts.innerHTML = Array.from({ length: n0 }, () => '<i></i>').join(''); }
    el.dartBtn.hidden = tailor;   // 邪道エギングは「ふわっと」ボタンとして出す（2026-10-03 ぱっぱ）
    el.baitRow.hidden = !jado;
    if (jado) el.baitRow.querySelector('.ika-egi-stock-label').textContent = t(lang, TX.bait.left);
    ajiShown = null;
    if (yaen) syncAji();
    V.chaseAt = null;
    const castLabel = el.casts?.parentElement?.querySelector('.ika-egi-stock-label');
    if (castLabel) castLabel.textContent = t(lang, yaen ? TX.yaen.aji : tailor ? TX.tailor.bait : TX.hud.casts);
    if (el.egis?.parentElement) el.egis.parentElement.hidden = yaen || tailor;   // ヤエン・テーラーはエギを使わない
    syncSide();
    syncBait();
    paintJado();
  }
  // ヤエンの横のボタン（ダートの場所）：糸を上げる／糸を切る／ヤエン投入
  const dartHTML0 = el.dartBtn.innerHTML;
  // 邪道エギングのダートの場所：「ふわっと」（底から高く一度上げてゆっくり落とす）。着底して止めている時だけ押せる
  let jadoLabel = false;
  function syncJadoLift() {
    const jado = Boolean(s) && s.method === 'jado';
    if (jado !== jadoLabel) {
      jadoLabel = jado;
      if (jado) { el.dartBtn.innerHTML = `<span class="ika-egi-dart-arrow" aria-hidden="true">↑</span><span>${t(lang, TX.jado.lift)}</span>`; el.dartBtn.title = t(lang, TX.jado.liftHint); el.dartBtn.setAttribute('aria-label', `${t(lang, TX.jado.lift)}：${t(lang, TX.jado.liftHint)}`); }
      else if (sideKey === null) { el.dartBtn.innerHTML = dartHTML0; el.dartBtn.title = t(lang, TX.gestures.dartHint); el.dartBtn.setAttribute('aria-label', `${t(lang, TX.gestures.dart)}：${t(lang, TX.gestures.dartHint)}`); }
    }
    if (jado) { const on = !frozen && canJadoLift(s); if (el.dartBtn.disabled === on) el.dartBtn.disabled = !on; }
  }
  let sideKey = null;
  function syncSide() {
    if (!s || s.method !== 'yaen') {
      if (sideKey !== null) { el.dartBtn.innerHTML = dartHTML0; el.dartBtn.classList.remove('is-yaen'); sideKey = null; }
      return;
    }
    const act = yaenSideAction(s) ?? 'none';
    if (act === sideKey && !(act === 'none' && s.yaen?.checked)) return;
    if (act === 'yaen' && sideKey !== 'yaen') callout(t(lang, TX.yaen.near), 'good', 2400);
    sideKey = act;
    el.dartBtn.classList.add('is-yaen');
    el.dartBtn.dataset.act = act;
    // 何もできない時：イカと確かめ済みなら「✓ イカ」、それ以外は「糸を上げる」（押せない）
    el.dartBtn.innerHTML = `<span>${act !== 'none' ? t(lang, TX.yaen.side[act]) : s.yaen?.checked === 'squid' ? t(lang, TX.yaen.side.squidOk) : t(lang, TX.yaen.side.lift)}</span>`;
    el.dartBtn.disabled = act === 'none';
  }
  // ヤエン：アジの残り。イカが画面の右から現れて初めて、どれだけ食べられていたか分かる（2026-09-27 ぱっぱ）
  const YAEN_SEEN = YAEN_DIST + 11;   // これより近いとイカが画面に見えている（見せ方は draw の yaenFar）
  let ajiShown = null;
  function syncAji() {
    if (!s || s.method !== 'yaen') return;
    const bit = s.yaen?.on && ['run', 'draw', 'yaen'].includes(s.phase);
    const seen = bit && !s.yaen.tako && s.dist <= YAEN_SEEN;
    const left = bit ? yaenAji(s) : 1;
    // 待っている間は「アジの鮮度」（時間とともに傷む。2026-09-28 ぱっぱ）、抱かれてイカが見えたら「アジの残り」
    const waiting = s.phase === 'wait';
    const mode = seen ? 'left' : waiting ? 'fresh' : null;
    if (mode !== ajiShown) {
      ajiShown = mode;
      el.baitRow.hidden = !mode;
      if (mode) { el.baitName.textContent = ''; el.baitRow.querySelector('.ika-egi-stock-label').textContent = t(lang, mode === 'left' ? TX.yaen.ajiGauge : s.aji === 'live' ? TX.yaen.vigor : TX.yaen.fresh); }
    }
    if (mode) {
      const v = mode === 'left' ? left : yaenFresh(s);
      el.baitFill.style.width = `${Math.round(v * 100)}%`;
      el.baitFill.parentElement.classList.toggle('is-low', v < 0.35);
    }
    // 絵：食べられた分だけ頭の側を消す（エギの絵の座標で頭 y≈-2、尾 y≈42）
    // 頭は下（尻尾が上で糸につながる）ので、食べられた分だけ下から消す。尻尾と針のあたりは最後まで残る
    const h = 12 + 38 * left;
    sc?.nodes && [sc.nodes.egiWater, sc.nodes.egiAir].forEach((g) => g.querySelector('.ika-eg-aji-clip')?.setAttribute('height', h.toFixed(1)));
  }
  function syncBait() {
    if (!s || s.method !== 'jado') return;
    el.baitFill.style.width = `${Math.round((s.baitLeft ?? 1) * 100)}%`;
    el.baitFill.parentElement.classList.toggle('is-low', (s.baitLeft ?? 1) < 0.5);
    el.baitName.textContent = t(lang, TX.bait.names[s.bait]);
  }
  el.methods?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-method]');
    if (!b || started()) return;
    const id = b.dataset.method;
    const st = methodNow(id);
    if (st === 'ok') {
      const wasNight = todNow() === 'night';
      settings.method = id;
      writePref('ikabu.egi.method', id);
      if ((todNow() === 'night') !== wasNight || id === 'tailor') buildScene();   // テーラーは夜の舞台
      newGame();
      callout(methodName(id), 'good');
    } else if (st === 'level') callout(`${methodName(id)}：${TX.method.level(lang, METHODS[id].level)}`, 'bad', 2600);
    else if (st === 'season') callout(TX.method.seasonNow(lang, methodName(id), settings.mode === 'live' ? `${TX.method.nextSeason(lang, nextSeasonMonth(id, settings.month))}（${t(lang, TX.method.seasonPick)}）` : t(lang, TX.method.season[id])), '', 3600);
    else if (st === 'soon') callout(`${methodName(id)}：${t(lang, TX.method.soon)}`, '', 2200);
  });
  el.tanas?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tana]');
    if (!b || started()) return;
    settings.tana = b.dataset.tana;
    writePref('ikabu.egi.tana', settings.tana);
    newGame();
  });
  // テーラー：色のボタンで、そのウキを合わせる
  function doTailorSet(i) {
    feel.unlock();
    if (!s || frozen || s.method !== 'tailor' || s.phase !== 'tailor') return;
    tailorSet(s, i);
    onEvents(s.events.splice(0));
    setButton();
  }
  el.tailorBtns?.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-float]');
    if (!b) return;
    e.preventDefault();
    doTailorSet(Number(b.dataset.float));
  });
  el.tailorBtns?.addEventListener('keydown', (e) => {
    const b = e.target.closest('[data-float]');
    if (b && (e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); doTailorSet(Number(b.dataset.float)); }
  });
  el.tailorBtns?.addEventListener('click', (e) => e.preventDefault());
  el.ajis?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aji]');
    if (!b || started()) return;
    settings.aji = b.dataset.aji;
    writePref('ikabu.egi.aji', settings.aji);
    newGame();
  });
  el.baits?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bait]');
    if (!b) return;
    settings.bait = b.dataset.bait;
    writePref('ikabu.egi.bait', settings.bait);
    if (s && (s.phase === 'ready' || s.phase === 'result')) rebait(s, settings.bait);
    else if (s && !started()) s.bait = settings.bait;
    syncMethod();
  });
  // レベルが上がったか（before＝ポイントを足す前のレベル）。上がったら一言と、解放された釣り方のカード
  function levelCheck(before) {
    const after = levelNow();
    syncLevel();
    if (after <= before) return;
    setTimeout(() => callout(TX.level.up(lang, after), 'last', 2600), 1200);
    unlockedBetween(before, after).forEach((id, i) => {
      setTimeout(() => callout(`${TX.method.unlocked(lang, methodName(id))} ${t(lang, TX.method.unlockLine[id])}`, 'good', 5200), 4000 + i * 5400);
    });
    syncMethod();
  }
  function syncLevel() {
    if (!el.levelNum) return;
    const L = levelOf(rec.points);
    el.levelNum.textContent = `Lv${L.level}`;
    el.levelFill.style.width = `${Math.round(L.frac * 100)}%`;
    el.levelNext.textContent = L.to == null ? t(lang, TX.level.max) : TX.level.next(lang, L.need);
  }
  // 外道の記録（図鑑の下）
  const GEDO_IDS = Object.keys(TX.gedo.names);
  // 外道の絵（2026-09-27、ChatGPT で釣り人のイカと同じ画風。ikabu-research/zukan-art/gedo_prompts.md）
  const gedoImg = (id, cls = '') => `<img class="ika-egi-gedo-img${cls}" src="${assetHref(`/assets/ikabu/gedo/${id}.webp`)}" alt="" width="64" height="64" decoding="async" />`;
  function syncGedo() {
    if (!el.gedoGrid) return;
    const G = TX.gedo;
    el.gedoGrid.innerHTML = GEDO_IDS.map((id) => {
      const r = rec.gedo[id];
      return r
        ? `<li class="ika-egi-gedo-card is-got"><span class="ika-egi-gedo-icon" aria-hidden="true">${gedoImg(id)}</span><div><p class="ika-egi-zukan-name">${t(lang, G.names[id])}</p><p class="ika-egi-zukan-meta">${t(lang, G.count)} ${r.count}${r.first ? `・${t(lang, TX.zukan.first)} ${r.first}` : ''}</p></div></li>`
        : `<li class="ika-egi-gedo-card"><span class="ika-egi-gedo-icon" aria-hidden="true">${gedoImg(id, ' is-shadow')}</span><div><p class="ika-egi-zukan-name">${t(lang, G.unknown)}</p><p class="ika-egi-zukan-meta">${t(lang, G.hint[id])}</p></div></li>`;
    }).join('');
    if (el.gedoCount) el.gedoCount.textContent = String(GEDO_IDS.filter((id) => rec.gedo[id]).length);
  }
  // 外道が上がった：今日の釣果に書き、「今日の萩の海」なら記録とポイントへ
  function addGedo(g) {
    if (el.catches.querySelector('.ika-egi-catch-empty')) el.catches.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'is-gedo';
    li.innerHTML = `<span>${gedoImg(g.id, ' is-mini')}${esc(t(lang, TX.gedo.names[g.id]))}</span><b>${t(lang, TX.gedo.got)}</b>`;
    el.catches.appendChild(li);
    if (settings.mode !== 'live') return;
    const before = levelNow();
    rec = recordGedo(rec, g).rec;
    saveRec();
    syncRecords();
    levelCheck(before);
  }

  /* ---------- 設定パネル：今日の萩の海 ／ 練習 ---------- */
  const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(10 - Math.round(n));
  const f1m = (v) => (v == null ? '—' : Number(v).toFixed(1));
  const condLine = () => {
    const m = s?.method && s.method !== 'egi' ? `${methodName(s.method)}・` : '';
    return m + condLine0();
  };
  const condLine0 = () => {
    const c = settings.cond;
    if (settings.mode === 'beginner') return `${t(lang, TX.live.modeBeginner)}：${t(lang, SEASON[seasonOf(settings.month)])}・${t(lang, TOD[settings.tod])}・${t(lang, TX.live.expectation)}★${Math.round(c.expectation)}`;
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
    el.playBeginner?.classList.toggle('is-active', settings.mode === 'beginner');
    const sm = SEASON_MODES.find((m) => m.months.includes(settings.month));
    el.seasons?.querySelectorAll('[data-season]').forEach((b) => b.setAttribute('aria-pressed', String(settings.mode === 'practice' && b.dataset.season === sm?.key)));
    syncMethod();
  }
  const started = () => s && !(s.phase === 'ready' && s.casts === (s.method === 'tailor' ? TAILOR_BAITS : CASTS)) && s.phase !== 'over';   // テーラーはエサ9個から（9/28：5回と比べていて、投げる前から設定が押せなかった）
  function syncSetupLock() {
    const lock = started();
    root.querySelectorAll('#ika-egi-tod .ika-chip, #ika-egi-wind .ika-chip, #ika-egi-seasons [data-season]').forEach((b) => { b.disabled = lock; });
    el.month.disabled = lock;
    el.exp.disabled = lock;
    el.playLive.disabled = lock || !settings.live || settings.live.conditions.safety === 'stop';
    el.playPractice.disabled = lock;
    el.locked.hidden = !lock;
    syncMethod();
    syncEgiPick();   // エギ・ロッド・ドラグ・仕掛けも、投げている間は押せない表示に（2026-10-01）
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
    el.pickIcon.innerHTML = egiIconHTML(e.size, e.type, e.color, e.rig);
    syncColorChips();
    paintEgi();
    el.pickCurrent.textContent = TX.egi.current(lang, e.size, typeName(e.type));
    el.pickTraits.innerHTML = egiTraitsHTML(lang, e);
    el.spec.textContent = TX.egi.current(lang, e.size, typeName(e.type));
    const canPick = !s || s.phase === 'ready' || s.phase === 'result' || s.phase === 'over';
    root.querySelectorAll('#ika-egi-size .ika-chip, #ika-egi-type .ika-chip, #ika-egi-rig .ika-chip, #ika-egi-rod .ika-chip, #ika-egi-drag .ika-chip').forEach((b) => { b.disabled = !canPick; });
    el.pick.classList.toggle('is-locked', !canPick);
    for (const box of [el.pickRig, el.popRig]) box?.querySelectorAll('.ika-chip').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.rig === (e.rig ?? 'normal'))); b.disabled = !canPick; });
    syncTackle();
  }
  /* ---------- 釣り人キャラ（2026-10-02）：一覧・🎫で入手・使う ---------- */
  let anglerRec = readAnglers();
  let anglerAsk = null;   // 🎫を使う前の「使う？」を出しているキャラ
  function paintAngler() {
    const im = sc?.svg?.querySelector('.ika-eg-angler');
    if (!im) return;
    const a = anglerOf(anglerRec.current); const B = SCENE.squidBox;
    const extra = B.h * (a.padTop ?? 0) / ANGLER_BASE_H;   // 上に足した余白の分だけ、上へ伸ばして置く（竿の握りの位置は変えない）
    im.setAttribute('href', assetHref(a.src)); im.dataset.face = 'normal';
    im.setAttribute('y', String(B.y - extra)); im.setAttribute('height', String(B.h + extra));
    if (a.jet) { const pre = new Image(); pre.src = assetHref(a.jet); }   // 驚いた顔は先に読んでおく（初めてのジェットで一瞬消えないように）
  }
  function renderAnglerPop() {
    if (!el.anglerPop) return;
    const T = TX.angler; const have = readTickets().n;
    const cards = ANGLERS.map((a) => {
      const owned = anglerRec.owned.includes(a.id); const cur = anglerRec.current === a.id;
      const btn = cur ? `<span class="ika-egi-ang-state">${t(lang, T.using)}</span>`
        : owned ? `<button type="button" class="ika-chip" data-ang-use="${a.id}">${t(lang, T.use)}</button>`
        : anglerAsk === a.id ? `<button type="button" class="ika-chip ika-egi-ang-yes" data-ang-buy="${a.id}">${T.confirm(lang, a.cost)}</button>`
        : `<button type="button" class="ika-chip" data-ang-ask="${a.id}"${have < a.cost ? ' aria-disabled="true"' : ''} aria-label="${t(lang, T.names[a.id])} ${T.buy(lang, a.cost)}">${T.buy(lang, a.cost)}</button>`;
      return `<div class="ika-egi-ang${cur ? ' is-cur' : ''}${owned ? '' : ' is-locked'}"><img src="${assetHref(a.src)}" alt="" width="64" height="72" decoding="async"><b>${esc(t(lang, T.names[a.id]))}</b>${btn}</div>`;
    }).join('');
    el.anglerPop.innerHTML = `<p class="ika-egi-colorpop-title">${t(lang, T.title)}<small>${T.have(lang, have)}</small></p><div class="ika-egi-ang-grid">${cards}</div><p class="ika-egi-colorpop-why">${t(lang, T.note)}</p><button type="button" class="ika-btn ika-egi-ang-close">${t(lang, T.close)}</button>`;
  }
  function openAnglerPop() { anglerAsk = null; renderAnglerPop(); el.anglerPop.hidden = false; }
  el.anglerPop?.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.anglerPop?.addEventListener('click', (e) => {
    const T = TX.angler;
    if (e.target.closest('.ika-egi-ang-close')) { el.anglerPop.hidden = true; return; }
    const use = e.target.closest('[data-ang-use]');
    if (use) { const r = useAngler(anglerRec, use.dataset.angUse); if (r.ok) { anglerRec = r.rec; writeAnglers(anglerRec); paintAngler(); } renderAnglerPop(); return; }
    const ask = e.target.closest('[data-ang-ask]');
    if (ask) {
      const a = anglerOf(ask.dataset.angAsk); const have = readTickets().n;
      if (have < a.cost) { callout(T.short(lang, a.cost - have), 'bad'); return; }
      anglerAsk = a.id; renderAnglerPop(); return;
    }
    const buy = e.target.closest('[data-ang-buy]');
    if (buy) {
      const r = buyAngler(anglerRec, readTickets(), buy.dataset.angBuy, { day: utcDay() });
      anglerAsk = null;
      if (r.ok) {
        anglerRec = r.rec; writeAnglers(anglerRec); writeTickets(r.tickets);
        dispatchEvent(new CustomEvent('ikabu:tickets', { detail: { got: 0, why: [] } }));
        paintAngler();
        callout(T.got(lang, t(lang, T.names[buy.dataset.angBuy])), 'good');
      } else if (r.why === 'tickets') callout(T.short(lang, anglerOf(buy.dataset.angBuy).cost - readTickets().n), 'bad');
      renderAnglerPop();
    }
  });

  /* ---------- タックル（ロッド・ドラグ）とリボン（2026-10-01） ---------- */
  function syncTackle() {
    const tk = settings.tackle;
    el.rod?.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rod === tk.rod)));
    el.drag?.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.drag === tk.drag)));
    if (el.rodNote) el.rodNote.textContent = t(lang, TX.tackle.rodNote[tk.rod]);
    if (el.dragNote) el.dragNote.textContent = t(lang, TX.tackle.dragNote[tk.drag]);
    const e = settings.egi;
    const vals = { rod: t(lang, TX.tackle.rods[tk.rod]), drag: t(lang, TX.tackle.drags[tk.drag]), egi: `${TX.egi.current(lang, e.size, typeName(e.type))}${e.rig === 'rattle' ? `・${t(lang, TX.tackle.rigs.rattle)}` : ''}` };
    el.tk?.querySelectorAll('[data-tk-val]').forEach((b) => { b.textContent = vals[b.dataset.tkVal] ?? ''; });
  }
  function chooseTackle(patch) {
    const next = normalizeTackle({ ...settings.tackle, ...patch });
    if (s && s.phase !== 'over' && !setTackle(s, next)) return;   // 投げている最中は替えられない
    settings.tackle = next;
    writePref('ikabu.egi.rod', next.rod); writePref('ikabu.egi.drag', next.drag);
    syncTackle();
    if (s?.phase === 'result') callout(`${t(lang, TX.tackle.changed)}：${TX.tackle.current(lang, t(lang, TX.tackle.rods[next.rod]), t(lang, TX.tackle.drags[next.drag]))}`);
  }
  el.rod?.addEventListener('click', (e) => { const b = e.target.closest('.ika-chip[data-rod]'); if (b) chooseTackle({ rod: b.dataset.rod }); });
  el.drag?.addEventListener('click', (e) => { const b = e.target.closest('.ika-chip[data-drag]'); if (b) chooseTackle({ drag: b.dataset.drag }); });
  const chooseRig = (rig) => { chooseEgi({ rig }); writePref('ikabu.egi.rig', settings.egi.rig); };
  el.pickRig?.addEventListener('click', (e) => { const b = e.target.closest('.ika-chip[data-rig]'); if (b) chooseRig(b.dataset.rig); });
  el.popRig?.addEventListener('click', (e) => { const b = e.target.closest('.ika-chip[data-rig]'); if (b) chooseRig(b.dataset.rig); });   // 舞台のエギを押した窓からも（2026-10-01 深夜 ぱっぱ）
  // 設定欄のエギの絵を押すと、足なし⇄足つき（ぱっぱ：アイコンをタップで切り替えたい）
  el.pickIcon?.addEventListener('click', () => { const was = settings.egi.rig; chooseRig(was === 'legs' ? 'normal' : 'legs'); if (settings.egi.rig !== was) callout(t(lang, TX.tackle.rigs[settings.egi.rig])); });
  // リボン：押した札だけ開く（もう一度押すと閉じる）
  el.tk?.querySelector('.ika-egi-tk-tabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tk-tab]');
    if (!b) return;
    const key = b.dataset.tkTab;
    const open = b.getAttribute('aria-expanded') !== 'true';
    el.tk.querySelectorAll('[data-tk-tab]').forEach((x) => x.setAttribute('aria-expanded', String(open && x.dataset.tkTab === key)));
    el.tk.querySelectorAll('[data-tk-panel]').forEach((p) => { p.hidden = !(open && p.dataset.tkPanel === key); });
  });
  // 現在のタックルの数字（描画・音で使う）
  const rodNow = () => TACKLE.rod[settings.tackle.rod];
  const dragNow = () => TACKLE.drag[settings.tackle.drag];
  // エギの色：舞台のエギ・アイコン・色のボタンをそろえる
  // 泡：dir=-1 は釣り人側（左）へ吹き出す、1 はエギのまわりに散る。ゆらゆら上へ浮いて消える
  const bubbles = [];
  function spawnBubbles(x, y, count, dir) {
    if (reduced) return;
    for (let i = 0; i < count; i++) {
      bubbles.push({ x, y, vx: dir < 0 ? -(40 + Math.random() * 90) : (Math.random() - 0.5) * 60, vy: -(15 + Math.random() * 30), r: 1.5 + Math.random() * 3, t0: now, life: 0.9 + Math.random() * 0.8, ph: Math.random() * 6 });
    }
    if (bubbles.length > 18) bubbles.splice(0, bubbles.length - 18);
  }
  function paintEgi() {
    const hex = EGI_COLOR_HEX[settings.egi.color] ?? EGI_COLOR_HEX.orange;
    const n = sc?.nodes;
    if (!n) return;
    [n.egiWater, n.egiAir, n.ghost].forEach((g) => g.querySelector('.ika-art-egi path')?.setAttribute('fill', hex));
    // 足つき（パタパタ系）：見た目だけ。舞台のすべてのエギの絵に足を付け外しする（2026-10-01 深夜 ぱっぱ）
    const legs = settings.egi.rig === 'legs';
    sc.svg?.querySelectorAll('.ika-art-egi').forEach((art) => {
      let lg = art.querySelector('.ika-art-egi-legs');
      if (legs && !lg) { lg = svgEl('path', { class: 'ika-art-egi-legs', d: EGI_LEGS_D, fill: 'none', stroke: '#16233a', 'stroke-width': '2.2', 'stroke-linecap': 'round' }); art.appendChild(lg); }
      if (lg) lg.style.display = legs ? '' : 'none';
    });
  }
  const colorOpts = () => ({ tod: settings.tod, cond: settings.cond, mood: moodOf(settings.month, settings.tod, settings.cond) });
  // なぜその色が効くのか（時間帯と、波から見た濁り）
  function colorWhy() {
    const W = TX.egi.colorWhy;
    const tod = settings.tod === 'day' ? W.day : settings.tod === 'night' ? W.night : W.mazume;
    const cl = clarityOf(settings.cond);
    const clear = cl === 'murky' ? W.murky : cl === 'clear' ? W.clear : null;
    const best = bestColors(colorOpts()).map((c) => t(lang, TX.egi.colors[c])).join('・');
    return `${t(lang, tod)}${clear ? `。${t(lang, clear)}` : ''}。${t(lang, TX.egi.colorBest)}：${best}`;
  }
  function syncColorChips() {
    for (const box of [el.pickColor, el.colorPopChips]) box?.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === settings.egi.color)));
  }
  const COLOR_SEEN = 'ikabu.egi.colorSeen';
  let colorSeen = Boolean(readPref(COLOR_SEEN));
  function openColorPop() {
    if (!el.colorPop) return;
    el.colorPopWhy.textContent = colorWhy();
    syncColorChips();
    el.colorPop.hidden = false;
    if (!colorSeen) { colorSeen = true; writePref(COLOR_SEEN, true); }
    el.colorTip.hidden = true;
  }
  function chooseColor(color) {
    const before = settings.egi.color;
    chooseEgi({ color });
    if (settings.egi.color === before) return;
    const fit = colorFit(color, colorOpts());
    // 一言は短く：合う色なら◎、合わない色なら今の条件で合う色を添える（くわしい理由は色選びの窓に出ている）
    const best = bestColors(colorOpts()).map((c) => t(lang, TX.egi.colors[c])).join('・');
    const mark = fit >= 1.08 ? '◎' : fit <= 0.92 ? '△' : '○';
    callout(`${t(lang, TX.egi.colors[color])} ${mark}${fit < 1.08 ? `（${t(lang, TX.egi.colorBest)}：${best}）` : ''}`, fit >= 1.08 ? 'good' : fit <= 0.92 ? 'bad' : '');
    el.colorPop.hidden = true;
  }
  el.pickColor?.addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) chooseColor(b.dataset.color); });
  el.colorPopChips?.addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) chooseColor(b.dataset.color); });
  el.colorPop?.addEventListener('pointerdown', (e) => e.stopPropagation());
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
  if (el.feelVib) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent ?? '');
    el.feelVib.hidden = !canVibrate() && !ios;
    // iPhone：行は出すが押せない。「震えない理由」を添える（感想「当たった時のバイブ機能が欲しい」→ 実は iPhone の Safari が対応していない。2026-10-01）
    if (ios && !canVibrate()) { el.feelVib.querySelectorAll('button').forEach((b) => { b.disabled = true; b.setAttribute('aria-pressed', 'false'); }); el.feelVib.insertAdjacentHTML('beforeend', `<small class="ika-egi-feel-note">${t(lang, TX.feel.noIos)}</small>`); }
  }
  // 振ってしゃくる（試験中）。スマホ（動きの読み取りができて、タッチの端末）だけに出す。最初はオフ
  let shakeOn = false, stopShake = null;
  if (el.feelShake) el.feelShake.hidden = !(shakeSupported() && matchMedia('(pointer: coarse)').matches);
  function onShake() {
    // しゃくり（沈下・フォール）とアワセ（合図）の時だけ。巻いている時（ファイト）に振っても何もしない
    if (!s || frozen || s.method !== 'egi' || !['sinking', 'action', 'signal'].includes(s.phase)) return;
    doPress();
    doRelease();
  }
  async function setShake(on, ask) {
    if (on && ask && (await requestShakePermission()) !== 'granted') { callout(t(lang, TX.feel.shakeDenied), '', 3600); on = false; }
    shakeOn = on;
    stopShake?.();
    stopShake = on ? watchShake(onShake) : null;
    writePref('ikabu.egi.shake', on);
    syncFeel();
  }
  // BGM：舞台の右上のスピーカー（🔊／🔇）。押した時に AudioContext を作れるので iPhone でも鳴る
  const bgmBtn = q('ika-egi-bgmbtn');
  const syncBgmBtn = () => { if (!bgmBtn) return; bgmBtn.textContent = bgm.on ? '🔊' : '🔇'; bgmBtn.setAttribute('aria-pressed', String(bgm.on)); };
  bgmBtn?.addEventListener('click', (e) => { e.stopPropagation(); bgm.setOn(!bgm.on); writePref('ikabu.egi.bgm', bgm.on); syncBgmBtn(); });
  syncBgmBtn();
  function syncFeel() {
    if (el.shakeWarn) el.shakeWarn.hidden = !shakeOn;
    el.feel?.querySelectorAll('.ika-chip[data-feel]').forEach((b) => {
      const on = b.dataset.feel === 'vibrate' ? feel.vibrate : b.dataset.feel === 'shake' ? shakeOn : feel.sound;
      b.setAttribute('aria-pressed', String((b.dataset.on === '1') === on));
    });
  }
  el.feel?.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-feel]');
    if (!b) return;
    const on = b.dataset.on === '1';
    // 注意書きは設定のすぐ下に出す（ゲーム画面の中の案内は、設定を見ている時は目に入らない：2026-09-29 ぱっぱ iPhone で指摘）
    if (b.dataset.feel === 'shake') { setShake(on, true).then(() => { if (shakeOn && el.shakeWarn) { el.shakeWarn.classList.remove('is-pop'); void el.shakeWarn.offsetWidth; el.shakeWarn.classList.add('is-pop'); } }); return; }
    if (b.dataset.feel === 'vibrate') { feel.setVibrate(on); writePref('ikabu.egi.vibrate', on); if (on) feel.fire('tap'); }
    else { feel.setSound(on); writePref('ikabu.egi.sound', on); if (on) feel.fire('tap'); }
    syncFeel();
  });
  syncFeel();
  // 前にオンにしていた人：Android はそのまま見張りを始める。iPhone は許可をボタンでしか頼めないので、もう一度オンを押してもらう
  if (readPref('ikabu.egi.shake') === true && !el.feelShake?.hidden && typeof window.DeviceMotionEvent?.requestPermission !== 'function') setShake(true, false);

  // 練習モードに切り替えて、今の練習条件でゲームを作り直す。
  // user＝人が自分で選んだ（季節・時間帯などを押した）。そのあとに今日の萩の海のデータが届いても、勝手に切り替えない
  let userPicked = false;
  function usePractice({ open = true, user = true } = {}) {
    if (user) userPicked = true;
    settings.mode = 'practice';
    guide = 0; showGuide();
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
    guide = 0; showGuide();
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
  root.querySelector('#ika-egi-moon')?.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-moon]');
    if (!b || started()) return;
    root.querySelectorAll('#ika-egi-moon .ika-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    settings.cond = { ...settings.cond, moon: MOON_PRESET[b.dataset.moon] };
    usePractice();
  });
  el.wind.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-wind]');
    if (!b || started()) return;
    el.wind.querySelectorAll('.ika-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    settings.cond = { ...settings.cond, ...WIND_PRESET[b.dataset.wind], safety: 'ok' };
    usePractice();
  });
  // 季節モード：その季節の代表の月・時間帯、よくある日（期待値7・穏やか）、主役に合うエギで遊ぶ
  el.seasons?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-season]');
    if (!b || started()) return;
    const m = SEASON_MODES.find((x) => x.key === b.dataset.season);
    if (!m) return;
    settings.month = m.month;
    settings.tod = m.tod;
    settings.cond = { ...settings.cond, expectation: 7, ...WIND_PRESET.calm, safety: 'ok' };
    el.exp.value = '7';
    el.wind.querySelectorAll('.ika-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.wind === 'calm')));
    const star = speciesPool(m.month, m.tod).find((p) => p.key === m.stars);
    if (star) {
      const [z0, z1] = star.zone;
      chooseEgi({ size: star.ideal, type: z1 <= 0.6 ? 'shallow' : z0 >= 0.6 ? 'deep' : 'normal' });
    }
    usePractice();
  });
  function useBeginner({ user = true } = {}) {
    if (user) userPicked = true;
    const nowMonth = new Date().getMonth() + 1;
    const m = SEASON_MODES.find((x) => x.months.includes(nowMonth)) ?? SEASON_MODES[0];
    settings.mode = 'beginner';
    settings.month = m.month;
    settings.tod = m.tod;
    settings.cond = { ...settings.cond, expectation: 10, ...WIND_PRESET.calm, safety: 'ok' };
    el.exp.value = '10';
    el.wind.querySelectorAll('.ika-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.wind === 'calm')));
    const star = speciesPool(m.month, m.tod).find((p) => p.key === m.stars);
    if (star) {
      const [z0, z1] = star.zone;
      chooseEgi({ size: star.ideal, type: z1 <= 0.6 ? 'shallow' : z0 >= 0.6 ? 'deep' : 'normal' });
    }
    el.practice.hidden = true;
    el.playPractice.setAttribute('aria-expanded', 'false');
    guide = 1;
    syncSetup();
    buildScene();
    newGame();
  }
  el.playBeginner?.addEventListener('click', () => { if (!started()) useBeginner(); });
  el.playLive.addEventListener('click', () => { if (!started()) useLive(); });
  el.playPractice.addEventListener('click', () => {
    if (started()) return;
    if (settings.mode === 'practice' && !el.practice.hidden) { el.practice.hidden = true; el.playPractice.setAttribute('aria-expanded', 'false'); return; }
    usePractice();
  });

  // 今日の萩の海を取って、パネルに出す。中止レベルなら練習に、失敗したら練習に（そう言う）
  // 月の形（0＝新月〜1＝満月）を小さな絵で
  const moonIcon = (m = 0.5) => { const k = Math.max(0, Math.min(1, m)); const off = (1 - k) * 18; return `<svg class="ika-egi-moonicon" viewBox="-10 -10 20 20" width="18" height="18" aria-hidden="true"><circle r="9" fill="#1c2b44"/><clipPath id="mc${Math.round(k * 100)}"><circle r="9"/></clipPath><g clip-path="url(#mc${Math.round(k * 100)})"><circle r="9" fill="#fff3c4"/><circle cx="${-off.toFixed(1)}" r="9" fill="#1c2b44" opacity="${k < 0.05 ? 1 : 0.96}"/></g></svg>`; };
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
        <div><dt>${t(lang, TX.moon.title)}</dt><dd>${moonIcon(c.moon)}<small>${t(lang, TX.moon.names[moonPhase(c.moon ?? 0.5)])}</small></dd></div>
      </dl>
      ${L.tod === 'night' ? `<p class="ika-egi-live-moon">🌙 ${t(lang, (c.moon ?? 0.5) >= 0.8 ? TX.moon.tip.bright : (c.moon ?? 0.5) <= 0.2 ? TX.moon.tip.dark : TX.moon.tip.mid)}</p>` : ''}
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
      if (!started() && settings.mode !== 'beginner') usePractice({ user: false });
    } else if (!started() && !demo && !userPicked) {
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
    if (!started() && settings.mode !== 'beginner') usePractice({ open: false, user: false });
    syncSetupLock();
  }

  /* ---------- HUD ---------- */
  function syncStock() {
    [...el.casts.children].forEach((i, k) => i.classList.toggle('is-used', k >= s.casts));
    [...el.egis.children].forEach((i, k) => i.classList.toggle('is-used', k >= s.egi));
  }
  const last = { btn: '', count: '', label: '', depth: '', dist: '' };
  function setButton() {
    let key = s.phase === 'over' ? 'over' : s.phase === 'result' ? 'result' : s.phase === 'aiming' ? 'aiming' : s.phase === 'signal' ? 'signal' : s.phase === 'fight' ? 'fight' : s.phase === 'ready' ? 'ready' : 'sink';
    // 邪道エギング：沈んでいる間は「着底を待つ」、底では「ズル引き」（アタリの時も本格表示ならズル引きのまま）
    const jado = s.method === 'jado';
    if (jado && (key === 'sink' || (key === 'signal' && cue() === 'real'))) key = s.phase === 'sinking' ? 'jadoWait' : 'jadoDrag';
    if (s.method === 'tailor') { if (key === 'ready') key = 'tailor-ready'; else if (key === 'sink') key = 'tailor-watch'; else if (key === 'result') key = 'tailor-back'; }
    if (s.method === 'yaen' && key === 'sink') key = `yaen-${s.phase === 'yaen' && s.yaen?.reached ? 'set' : ['wait', 'run', 'draw', 'yaen'].includes(s.phase) ? s.phase : 'sink'}`;
    if (last.btn === key) return;
    last.btn = key;
    el.btn.textContent = key.startsWith('tailor-') ? t(lang, TX.tailor.btn[key.slice(7)]) : key === 'yaen-wait' && s.aji === 'live' ? t(lang, TX.yaen.liveWait) : key.startsWith('yaen-') ? t(lang, TX.yaen.btn[key.slice(5)]) : key === 'jadoWait' ? t(lang, TX.jado.waitBottom) : key === 'jadoDrag' ? t(lang, TX.jado.drag) : t(lang, TX.btn[key === 'signal' && cue() === 'real' ? 'sink' : key]);
    el.btn.dataset.phase = key;
    el.power.hidden = key !== 'aiming';
    el.tension.hidden = key !== 'fight';
    if (s.method !== 'yaen' && s.method !== 'jado') el.dartBtn.disabled = key !== 'sink';   // ダートは沈下・フォール中だけ（邪道は「ふわっと」＝syncJadoLift。ヤエンは横のボタン）
  }
  function setText(node, keyName, value) {
    if (last[keyName] === value) return;
    last[keyName] = value;
    node.textContent = value;
  }
  let calloutTimer = 0;
  function callout(text, tone = '', ms = 1700) {
    ms = Math.max(ms, 1200 + [...String(text)].length * 95);   // 読み切れる長さに（体験版の感想「消えるのが早い」2026-10-01）
    el.callout.textContent = text;
    el.callout.className = `ika-egi-callout${tone ? ` is-${tone}` : ''}`;
    el.callout.hidden = false;
    el.callout.classList.remove('is-pop');
    void el.callout.offsetWidth;
    el.callout.classList.add('is-pop');
    clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => { el.callout.hidden = true; }, ms);
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
          if (guide === 1) { guide = 2; showGuide(); }
          syncStock();
          syncSetupLock();
          break;
        }
        case 'jerk':
          // 2段しゃくりの「遅れて上がる」分は、竿の振りをやり直さない（跳ね上がりが二度見えて違和感。10/2 ぱっぱ）。知らせだけ出す
          if (e.delayed) { callout(t(lang, TX.cue.double)); if (guide === 2) { guide = 3; showGuide(); } setFallMode(null); break; }
          V.jerkAt = now;
          V.jerkKind = e.kind;
          V.jerkDouble = e.double;
          // しゃくりで「ジッ！」。長さはドラグしだい（締め＝短く、ゆるめ＝ジーーー。2026-10-01 ぱっぱ）。
          // 2段しゃくりの「遅れて上がる」知らせ（delayed）では鳴らさない（2回のタップで2回鳴った後にもう1回鳴り「ジー！ジッ…ジー！」と3回になっていた。2026-10-01 ぱっぱ指摘）
          if (!e.delayed) feel.fire('zip', { len: dragNow().zip });
          if (e.kind === 'dart') { V.dartAt = now; callout(t(lang, TX.cue.dart)); }
          else if (e.kind === 'slack') { V.slackAt = now; V.slackSide = -(V.slackSide ?? 1); if (e.slackN === 1) callout(t(lang, TX.cue.slack)); }   // 何回目の連打かに関係なく、スラックジャークに入った1回目で出す
          else if (e.double) callout(t(lang, TX.cue.double));
          if (guide === 2) { guide = 3; showGuide(); }
          setFallMode(null);
          break;
        case 'fall':
          setFallMode(e.mode);
          break;
        // 邪道エギング（2026-09-27）
        case 'jado-lift':
          V.jerkAt = now; V.jerkKind = 'lift'; V.jerkDouble = false;
          break;
        case 'jado-land':
          if (e.called) callout(t(lang, TX.jado.liftCall), 'good', 1800);
          break;
        case 'drag':
          V.jerkAt = now; V.jerkKind = 'drag'; V.jerkDouble = false;
          V.fastDrags = e.good ? 0 : (V.fastDrags ?? 0) + 1;
          if (V.fastDrags === 3) callout(t(lang, TX.jado.tooFast), 'bad');
          else if (e.good && cue() === 'easy') callout(t(lang, TX.jado.goodDrag), 'good', 900);
          break;
        case 'bottom':
          if (s.method === 'yaen') { callout(t(lang, e.live ? TX.yaen.liveBottom : TX.yaen.bottom), '', 2600); break; }
          callout(t(lang, s.rock ? TX.jado.rock : TX.jado.bottom), s.rock ? 'bad' : '', 2600);
          break;
        case 'kotsu':
          V.punchAt = now;   // エギがコツコツ小突かれる（イカパンチと同じ揺れを小さく使う）
          feel.fire('tap');
          syncBait();
          if (cue() === 'easy' || !kotsuTaught) { kotsuTaught = true; callout(t(lang, TX.jado.kotsu), '', 2600); }
          el.log.textContent = t(lang, TX.jado.kotsu);
          break;
        case 'kotsu-wait':
          if (cue() === 'easy') callout(t(lang, TX.jado.kotsuWait), 'good');
          break;
        case 'gedo':
          // ファイトの無い外道（海藻・長靴・空き缶）
          addGedo(e);
          setTimeout(() => callout(`${TX.gedo.icon[e.id] ?? ''} ${t(lang, TX.gedo.names[e.id])}…`, '', 2400), e.id === 'seaweed' ? 900 : 0);
          break;
        // ヤエン（2026-09-27）
        case 'yaen-bite': {
          signalsThisCast += 1;
          const h = s.hooking ?? { id: 'aori', mantle: 24, weight: 1500 };
          V.hug.on = true; V.hug.alpha = 1; V.hug.x = V.egi.x; V.hug.y = V.egi.y; V.hug.ang = V.egi.ang; V.hug.t0 = now;
          V.revealed = false;
          V.heavy = clamp((h.weight ?? 1500) / 1500, 0.25, 1.6);
          setSquidArt(sc.nodes.hugWater, 'hug', h.id, mantleUnits(h.mantle ?? 26));
          setSquidArt(sc.nodes.hugAir, 'hug', h.id, mantleUnits(h.mantle ?? 26), true);
          V.hug.height = (44 * clamp(mantleUnits(h.mantle ?? 26) / 56, 0.75, 1.8) + mantleUnits(h.mantle ?? 26)) * 1.15;
          V.swim.forEach((w) => { w.alpha = 0; });
          feel.fire('run');
          callout(t(lang, TX.yaen.bite), 'good', 2600);
          if (!V.waitTaught) { V.waitTaught = true; setTimeout(() => { if (s.phase === 'run') callout(t(lang, TX.yaen.waitHint), '', 3600); }, 2800); }
          break;
        }
        case 'drag-sound':
          V.dragAt = now; V.dragKind = e.kind;
          if (e.kind === 'run' && now - (V.hug.t0 ?? -9) < 0.5) break;   // 抱いた瞬間は「抱いて走った！」の一言を残す
          if (e.kind !== 'run') feel.fire('tap');
          // 2026-10-03 ぱっぱ：イカがアジを引いたら、引きの強さで本物のドラグ「ジジ」（約0.3秒）〜「ジジー！」（約1秒）。タコのちょろちょろは短い「ジ」。
          //   引きの強さ＝イカの重さ×その時の勢い。この後に巻き始めると「チリリリ」が1回
          if (e.kind === 'jiji' || e.kind === 'choro') {
            const w = s.hooking?.weight ?? 600;
            const str = e.kind === 'choro' ? 0 : clamp((0.35 + 0.65 * Math.random()) * (0.6 + 0.4 * Math.min(1.5, w / 1200)), 0.15, 1);
            feel.fire('zip', { len: e.kind === 'choro' ? 0.15 : 0.25 + 0.75 * str });
            V.pullAt = now;
          }
          callout(`${t(lang, TX.yaen.sounds[e.kind])}${s.phase !== 'yaen' && (cue() === 'easy' || e.kind === 'jiji') ? `　${t(lang, TX.yaen.soundHint[e.kind])}` : ''}`, e.kind === 'jiji' && s.phase === 'draw' ? 'bad' : '', 1500);   // ヤエンを滑らせている間は巻かないので「手を止めて」は出さない
          break;
        case 'draw':
          callout(TX.yaen.draw(lang, e.sec));
          break;
        case 'lift':
          callout(t(lang, e.tako ? TX.yaen.liftTako : TX.yaen.liftSquid), e.tako ? 'bad' : 'good', 3000);
          break;
        case 'yaen-jerk':
          V.jerkAt = now; V.jerkKind = 'lift'; V.jerkDouble = false;
          break;
        case 'yaen-hint':
          callout(t(lang, e.live ? TX.yaen.liveHint : TX.yaen.jerkHint), 'good', 3600);
          break;
        case 'yaen-chase':
          V.chaseAt = now;
          feel.fire('tap');
          callout(t(lang, TX.yaen.chase), 'good', 2200);
          break;
        case 'tired':
          callout(t(lang, TX.yaen.tiredMsg));
          break;
        case 'yaen-stolen':
          V.punchAt = now;
          feel.fire('punch');
          callout(t(lang, TX.yaen.stolenMsg), 'bad', 2600);
          break;
        case 'yaen-eat':
          V.eatAt = now;
          if (!e.drawing) callout(TX.yaen.eat(lang, Math.round(e.ran)), 'good', 3400);
          break;
        case 'yaen-reach':
          callout(t(lang, TX.yaen.reach), 'good', 3000);
          feel.fire('tap');
          break;
        case 'yaen-pull':
          feel.fire('zip', { len: 1.1 });   // 抵抗している時に巻いた＝糸が出ていく「ジジー！」
          V.pullAt = now;
          callout(t(lang, TX.yaen.pull), 'bad', 2200);
          break;
        case 'yaen-in':
          V.yaenAt = now;
          callout(t(lang, TX.yaen.yaenIn), 'good', 2200);
          break;
        case 'yaen-letgo':
          escapeSquid();
          callout(t(lang, TX.yaen.letgo[e.why] ?? TX.yaen.letgo.early), 'bad', 2600);
          break;
        case 'spoiled':
          callout(t(lang, TX.yaen.spoiled));
          break;
        case 'tako-rock':
          V.hug.on = false;
          callout(t(lang, TX.yaen.takoRock), 'bad');
          break;
        case 'cut':
          V.hug.on = false; V.lineBroken = true;
          callout(t(lang, TX.yaen.cut), '');
          break;
        case 'yaen-miss':
          escapeSquid();
          callout(t(lang, TX.yaen.miss), 'bad');
          break;
        case 'rebait':
          syncBait();
          paintJado();
          callout(t(lang, TX.bait.rebaited), 'good');
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
          dryCasts = 0;
          guide = 0; showGuide();   // アタリが来たら案内はおしまい（ここからは「今！」の表示）
          const h = s.hooking;
          V.hug.on = true; V.hug.alpha = 1; V.hug.x = V.egi.x; V.hug.y = V.egi.y; V.hug.ang = V.egi.ang; V.hug.t0 = now;
          setSquidArt(sc.nodes.hugWater, 'hug', h.id, mantleUnits(h.mantle));
          // 正体は水面近くまで寄せるまで分からない（影だけ）。重さは竿の曲がりと引きで伝える
          V.revealed = false;
          V.heavy = clamp(h.weight / 1500, 0.25, 1.6);
          setSquidArt(sc.nodes.hugAir, 'hug', h.id, mantleUnits(h.mantle), true);
          V.hug.height = (44 * clamp(mantleUnits(h.mantle) / 56, 0.75, 1.8) + mantleUnits(h.mantle)) * 1.15;
          V.swim.forEach((w) => { w.alpha = 0; });
          // アタリの出方：走る／竿先にコン／止まる／フケる。本格モードでは糸と竿先だけで見せる
          V.bite = { kind: e.kind, light: e.light, t0: now, amp: (e.light ? 0.6 : 1) * rodNow().signal };   // 柔らかめは穂先に大きく出る、硬めは出にくい（2026-10-01）
          V.lastBite = V.bite;
          if (cue() === 'easy') {
            el.cueLabel.textContent = t(lang, TX.cue.kinds[e.kind]);
            el.cueLabel.className = `ika-egi-cue${e.light ? ' is-light' : ''}`;
            el.cueLabel.hidden = false;
          }
          // 手に伝わるアタリ（コン・走る）だけ震わせる。止まる・フケるは目で気づくアタリなので震わせない
          if (e.kind === 'tap' || e.kind === 'run') feel.fire(e.kind);
          else if (e.kind === 'heavy') feel.fire('run');
          syncBait();
          el.log.textContent = t(lang, TX.cue.kinds[e.kind]);
          break;
        }
        case 'tailor-cast':
          s.floats.forEach((f, k) => setTimeout(() => burst(X(f.dist), SCENE.surface, 5), k * 120));
          feel.fire('tap');
          callout(t(lang, TX.tailor.cast), 'good', 3200);
          if (!V.tailorTaught) { V.tailorTaught = true; setTimeout(() => { if (s.phase === 'tailor') callout(t(lang, TX.tailor.hint), '', 4200); }, 3400); }
          syncStock();
          break;
        case 'tailor-rebait': {
          const f = s.floats[e.i];
          setTimeout(() => burst(X(f.dist), SCENE.surface, 5), 300);
          callout(TX.tailor.rebait(lang, tailorColor(e.i)), '', 1800);
          syncStock();
          break;
        }
        case 'tailor-resume':
          resetForNextCast();
          break;
        case 'tailor-touch':
          feel.fire('punch');
          callout(e.double ? t(lang, TX.tailor.double) : TX.tailor.touch(lang, tailorColor(e.i)), e.double ? 'good' : '', 1800);
          break;
        case 'tailor-lean':
          callout(TX.tailor.lean(lang, tailorColor(e.i)), '', 1800);
          break;
        case 'tailor-sink': {
          feel.fire('run');
          const lit = s.floats[e.i]?.lit;
          callout(`${TX.tailor.sink(lang, tailorColor(e.i))}${lit ? ` ${t(lang, e.head ? TX.tailor.sinkHead : TX.tailor.sinkRoot)}` : ''}`, 'good', 2400);
          break;
        }
        case 'tailor-root':
          if (s.floats[e.i]?.lit) callout(TX.tailor.root(lang, tailorColor(e.i)), 'good', 2000);
          break;
        case 'tailor-gone':
          callout(TX.tailor.gone(lang, tailorColor(e.i)), 'bad', 2200);
          break;
        case 'tailor-weed':
          callout(TX.tailor.weed(lang, tailorColor(e.i)), '', 2400);
          break;
        case 'tailor-fugu':
          callout(TX.tailor.fugu(lang, tailorColor(e.i)), '', 2000);
          break;
        case 'tailor-fugu-gone':
          callout(TX.tailor.fuguGone(lang, tailorColor(e.i)), 'bad', 2000);
          break;
        case 'tailor-miss':
          feel.fire('break');
          callout(t(lang, TX.tailor.miss[e.why] ?? TX.tailor.miss.luck), 'bad', 2200);
          break;
        case 'tailor-nothing':
          callout(t(lang, TX.tailor.nothing), '', 1400);
          break;
        case 'tailor-weedup':
          break;
        case 'hook':
          if (e.tailor) {
            // テーラー：掛けたウキの下（タナ）からやり取り。イカは抱いた姿で、フグは絵を出さない（取り込んでからカードで見せる）
            const h = s.hooking;
            V.egi.mode = 'water'; V.sinkOffset = 0; V.egi.x = X(s.dist); V.egi.y = Y(s.depth); V.egi.ang = 0;
            if (h && !h.gedo) {
              V.hug.on = true; V.hug.alpha = 1; V.hug.x = V.egi.x; V.hug.y = V.egi.y; V.hug.ang = 0; V.hug.t0 = now;
              V.revealed = false;
              V.heavy = clamp((h.weight ?? 250) / 1500, 0.25, 1.6);
              setSquidArt(sc.nodes.hugWater, 'hug', h.id, mantleUnits(h.mantle ?? 26));
              setSquidArt(sc.nodes.hugAir, 'hug', h.id, mantleUnits(h.mantle ?? 26), true);
              V.hug.height = (44 * clamp(mantleUnits(h.mantle ?? 26) / 56, 0.75, 1.8) + mantleUnits(h.mantle ?? 26)) * 1.15;
            }
            hookDepth = Math.max(0.6, s.depth); hookDist = Math.max(s.dist, 1); inked = false;
            callout(t(lang, h?.gedo ? TX.msg.hook : TX.tailor.hit), 'good', 2400);
            feel.fire('hook', { heavy: V.heavy });
            setFallMode(null);
            break;
          }
          if (e.yaen) { hookDepth = Math.max(0.6, s.depth); hookDist = Math.max(s.dist, 1); inked = false; callout(t(lang, TX.yaen.hit), 'good', 2400); feel.fire('hook', { heavy: V.heavy }); setFallMode(null); break; }
          el.flash.hidden = true;
          el.cueLabel.hidden = true;
          V.bite = null;
          // しゃくったら乗ってた（2026-09-27）：離れていくはずだったイカを、エギに抱いた姿に戻す
          if (e.lucky) { V.escape = null; V.hug.on = true; V.hug.alpha = 1; V.hug.x = V.egi.x; V.hug.y = V.egi.y; V.hug.ang = V.egi.ang; V.hug.t0 = now; }
          setFallMode(null);
          hookDepth = Math.max(0.6, s.depth);
          hookDist = Math.max(s.dist, 1);
          inked = false;
          // 針に掛かった瞬間、水中で墨を吐く（ぱっぱ 2026-09-29「抱いて乗った時に墨を吐くとリアル」）。外道は吐かない
          if (!s.hooking?.gedo && !reduced) V.ink = { t0: now, x: V.hug.x + 6, y: Math.max(SCENE.surface + 24, V.hug.y + 26), under: true };
          callout(t(lang, e.lucky ? TX.msg.lucky : s.hooking?.boss ? TX.msg.bossHook : (V.heavy ?? 0) >= 0.66 ? TX.msg.heavy : TX.msg.hook), 'good');
          feel.fire('hook', { heavy: V.heavy });
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
        case 'jet': {
          V.anglerJolt = now;   // 釣り人がビクッ（！と汗）
          // ジェット噴射はイカだけ（2026-09-27 ぱっぱ：カサゴなど外道は「抵抗している！」）
          const gedo = Boolean(s.hooking?.gedo);
          V.lastJet = now;
          V.pullAt = now;   // この後に巻き始めると「チリリリ」が1回（ヤエンのジジッと同じ印）
          if (!gedo) spawnBubbles(V.hug.x - 10, V.hug.y, 6 + Math.round(6 * Math.min(1.6, V.heavy ?? 0.5)), -1);
          feel.fire('jet', { power: s.hooking?.power });
          if (now - (V.jetCallout ?? -9) > 2.5) { callout(t(lang, gedo ? TX.msg.resist : TX.msg.jet)); V.jetCallout = now; }
          break;
        }
        case 'geso':
          V.gesoAt = now;
          addGedo(e);
          break;
        case 'break':
        case 'unhooked':
          escapeSquid();
          feel.fire('break');
          if (e.type === 'break' && V.gesoAt === now) { callout(t(lang, TX.msg.geso), '', 3000); break; }   // ゲソだけ上がってきた
          callout(t(lang, e.type === 'break' ? TX.msg.break : TX.msg.unhooked), 'bad');
          break;
        case 'landed': {
          // 取り込み方は重さで自動（2026-10-01 ぱっぱ）：lift＝ぶっこ抜き／net＝タモ／gaff＝ギャフ。タモ・ギャフは道具が出てから持ち上がる
          const land = e.gedo ? 'lift' : (e.land ?? 'lift');
          V.land = { t0: now, from: { x: V.hug.x, y: V.hug.y }, kind: land, lead: land === 'lift' ? 0 : land === 'net' ? 1.0 : 1.2 };
          if (land === 'lift') burst(V.hug.x, SCENE.surface, 8);
          feel.fire('landed');
          if (e.gedo) { callout(t(lang, TX.gedo.got), ''); addGedo(e); break; }
          callout(t(lang, land === 'net' ? TX.msg.landedNet : land === 'gaff' ? TX.msg.landedGaff : TX.msg.landed), 'good', land === 'lift' ? 1700 : 2600);
          addCatch(e);
          break;
        }
        case 'punch':
          // イカパンチ：エギがピクッと弾かれる（描画側）。やさしいモードは文字でも知らせる
          V.punchAt = now;
          spawnBubbles(V.egi.x, V.egi.y, 5, 1);
          feel.fire('punch');
          if (cue() === 'easy') {
            el.cueLabel.textContent = t(lang, TX.cue.punch);
            el.cueLabel.className = 'ika-egi-cue is-light';
            el.cueLabel.hidden = false;
            setTimeout(() => { if (s.phase === 'action') el.cueLabel.hidden = true; }, 900);
            callout(t(lang, TX.msg.punch));
          }
          el.log.textContent = t(lang, TX.cue.punch);
          break;
        case 'spooked':
          callout(t(lang, e.kotsu ? (e.left ? TX.jado.kotsuLeft : TX.jado.kotsuSpooked) : e.left ? TX.msg.spookedLeft : TX.msg.spooked), 'bad');
          break;
        case 'punch-wait':
          if (cue() === 'easy') callout(t(lang, TX.msg.punchWait), 'good');
          break;
        case 'weedOver':
          callout(t(lang, TX.msg.weedOver[e.kind]), 'good', 3500);
          break;
        case 'weed':
          V.egi.mode = 'stuck';
          V.snagAt = now;
          callout(t(lang, TX.msg.weed), 'bad');
          break;
        case 'snag':
          V.egi.mode = 'stuck';
          V.snagAt = now;
          callout(t(lang, TX.msg.snag), 'bad');
          syncStock();
          break;
        case 'recover':
          if (signalsThisCast === 0 && ++dryCasts >= 3 && !tipsNudged && el.tips && !el.tips.open) {
            tipsNudged = true;
            setTimeout(() => callout(t(lang, TX.tips.nudge), 'good', 5000), 1800);
            el.tips.classList.add('is-flash');
            setTimeout(() => el.tips.classList.remove('is-flash'), 6000);
          }
          callout(t(lang, signalsThisCast === 0 ? TX.msg.noSign : TX.msg.recover));
          break;
        case 'ready':
          if (guide > 0) { guide = 1; showGuide(); }   // アタリが来ないまま次の1投：手順をもう一度
          resetForNextCast();
          if (s.dryCasts >= 2) setTimeout(() => { if (s.phase === 'ready') callout(t(lang, TX.egi.rotateHint)); }, 400);
          break;
        case 'rotation':
          callout(t(lang, TX.egi.rotation), 'good');
          break;
        case 'lure-stale':
          callout(t(lang, TX.egi.lureStale), 'bad');
          break;
        case 'lure-fresh':
          callout(t(lang, TX.egi.lureFresh), 'good');
          break;
        case 'bonus':
          // ラストチャンス：大きく出して、海を金色に光らせる。詳しい一言は着水の時に（着水の知らせの代わり）
          bonusNote = e.kind === 'last' ? (e.guarantee ? TX.egi.lastChanceSure : TX.egi.lastChanceMore)
            : e.hint === 'lure' ? TX.egi.rescueLure : e.hint === 'color' ? TX.egi.rescueColor : TX.egi.rescueZone;
          if (e.kind === 'last') { el.stage.classList.add('is-lastchance'); callout(t(lang, TX.egi.lastChance), 'last', 1600); }
          break;
        case 'over':
          break;
        default:
          break;
      }
    }
    if (events.length) {
      setButton();
      syncSide();
      // タモ・ギャフの取り込みは、道具が出て吊り上げるまで結果カードを待たせる（カードが舞台を隠すため。2026-10-01）
      const landWait = s.phase === 'result' && V.land && V.land.kind !== 'lift' ? Math.round(((V.land.lead ?? 0) + 1.1) * 1000) : 0;
      if (s.phase === 'result') { if (landWait) { const g = s; setTimeout(() => { if (s === g && s.phase === 'result') showResult(); }, landWait); } else showResult(); }
      if (s.phase === 'over') finishSession();
    }
  }

  // イカが離れて泳ぎ去る（すっぽ抜け・身切れ・バレ）
  const tailorColor = (i) => t(lang, TX.tailor.colors[s?.floats?.[i]?.color ?? ['green', 'red', 'orange'][i]]);
  const tbtnLast = [];
  function syncTailorBtns() {
    if (!el.tailorBtns || el.tailorBtns.hidden || !s) return;
    el.tailorBtns.querySelectorAll('[data-float]').forEach((b, i) => {
      const f = s.floats?.[i];
      const st = !f ? 'idle' : !f.bait && f.stage === 'idle' ? 'none' : f.stage;
      const key = `${st}:${s.phase}`;
      if (tbtnLast[i] === key) return;
      tbtnLast[i] = key;
      b.dataset.stage = st;
      b.disabled = s.phase !== 'tailor' || st === 'none';
      b.querySelector('[data-state]').textContent = t(lang, TX.tailor.states[st] ?? TX.tailor.states.idle);
    });
  }
  function escapeSquid() {
    if (!V.hug.on) return;
    const h = s.hooking ?? V.hug.last ?? { id: 'aori', mantle: 15 };
    V.hug.on = false; V.hug.alpha = 0;
    setSquidArt(sc.nodes.escape, 'swim', h.id, mantleUnits(h.mantle));
    V.escape = { x: V.hug.x, y: V.hug.y, ang: -90, t0: now };
  }
  function resetForNextCast() {
    el.stage.classList.remove('is-lastchance');
    bonusNote = null;
    if (sc?.nodes?.hugWater) sc.nodes.hugWater.style.filter = '';
    V.revealed = false;
    el.card.hidden = true;
    el.flash.hidden = true;
    V.hug.on = false; V.hug.alpha = 0; V.land = null; V.ink = null; drawTool('net', 0, 0, 0);
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
    if (settings.mode === 'live' && !rec.species[c.id] && !firstSpecies.includes(c.id)) firstSpecies.push(c.id);
    // 今日の萩の海の釣果は、その場で図鑑と記録に保存する（釣行の途中でページを閉じても消えない）
    if (settings.mode === 'live') {
      const before = levelNow();
      const got = recordEgiCatch(rec, { id: c.id, weight: c.weight, mantle: c.mantle, ...(c.nushi ? { nushi: true } : {}) }, { tripTotal: s.catches.reduce((sum, x) => sum + x.weight, 0) });
      rec = got.rec;
      saveRec();
      syncRecords();
      keepStorage();
      if (got.fresh) backupHintOnce();
      levelCheck(before);
    }
  }
  function showResult() {
    const why = s.last;
    const T = TX.result;
    let html = '';
    if (why === 'landed') {
      const c = s.catches[s.catches.length - 1];
      const z = zukanById(c.id);
      const first = firstSpecies.includes(c.id);
      html = `
        <p class="ika-egi-card-title is-good">${t(lang, T.landed)}</p>
        <div class="ika-egi-card-catch">
          ${z ? `<img class="ika-egi-card-art" src="${assetHref(zukanArt(c.id))}" alt="" width="72" height="84" decoding="async" />` : ''}
          <div>
            <p class="ika-egi-card-name">${esc(speciesName(lang, c.id))}${first ? ` <span class="ika-tag ika-tag--orange">${t(lang, TX.over.firstCatch)}</span>` : ''}</p>
            <dl class="ika-egi-card-rows"><div><dt>${t(lang, T.mantle)}</dt><dd>${c.mantle} cm</dd></div><div><dt>${t(lang, T.weight)}</dt><dd>${c.weight.toLocaleString()} g</dd></div></dl>
          </div>
        </div>
        ${z ? `<p class="ika-egi-card-tip"><b>${t(lang, TX.zukan.point)}</b> ${t(lang, z.point)}</p>` : ''}
        ${solo ? '' : `<p class="ika-egi-card-link"><a href="${pageHref('atlas', lang)}#sp-${esc(c.id)}">${t(lang, T.atlas)}</a></p>`}`;
    } else if (why === 'gedo' || why === 'junk') {
      // 外道（カサゴ）・ゴミ（長靴・空き缶）
      const g = s.gedo[s.gedo.length - 1];
      const G = TX.gedo;
      html = `<p class="ika-egi-card-title">${t(lang, why === 'junk' ? T.junk : T.gedo)}</p>
        <div class="ika-egi-card-catch"><span class="ika-egi-gedo-icon is-big" aria-hidden="true">${g ? gedoImg(g.id) : ''}</span><div><p class="ika-egi-card-name">${esc(t(lang, G.names[g?.id] ?? G.unknown))}</p>${g?.weight ? `<dl class="ika-egi-card-rows"><div><dt>${t(lang, T.weight)}</dt><dd>${g.weight.toLocaleString()} g</dd></div></dl>` : ''}</div></div>
        <p class="ika-egi-card-note">${why === 'junk' ? t(lang, T.junkNote) : ''}${G.line[g?.id] ? t(lang, G.line[g.id]) : ''}${settings.mode === 'live' ? `（${t(lang, G.added)}）` : ''}</p>`;
    } else if (TX.yaen.result[why]) {
      // ヤエンの終わり方。タコ（糸を切った・岩に入られた）はタコの絵と「外道の記録に追加」
      const tako = why === 'cut' || why === 'tako-rock';
      html = `<p class="ika-egi-card-title${tako ? '' : ' is-bad'}">${t(lang, TX.yaen.result[why])}</p>
        ${tako ? `<div class="ika-egi-card-catch"><span class="ika-egi-gedo-icon is-big" aria-hidden="true">${gedoImg('tako')}</span><div><p class="ika-egi-card-name">${t(lang, TX.gedo.names.tako)}</p></div></div>` : ''}
        <p class="ika-egi-card-note">${t(lang, TX.yaen.note[why])}${tako && settings.mode === 'live' ? `（${t(lang, TX.gedo.added)}）` : ''}</p>`;
    } else {
      const note = { weed: T.weedNote, snag: T.snagNote, break: T.breakNote, unhooked: T.unhookedNote, recover: signalsThisCast === 0 ? TX.msg.noSign : T.recoverNote }[why];
      html = `<p class="ika-egi-card-title${why === 'recover' ? '' : ' is-bad'}">${t(lang, T[why] ?? T.recover)}</p><p class="ika-egi-card-note">${t(lang, note ?? T.recoverNote)}</p>`;
    }
    // 邪道エギング：エサがくたびれていたら付け直しを勧める
    const baitLow = s.method === 'jado' && s.baitLeft < 0.5;
    if (baitLow) html += `<p class="ika-egi-card-note ika-egi-card-bait">${t(lang, TX.bait.low)} <button type="button" class="ika-chip" data-rebait>${t(lang, TX.bait.rebait)}</button></p>`;
    // シェア（2026-09-27）：釣れた時だけ。知り合い用のエギング単体ページには出さない
    const canShare = why === 'landed' && !solo;
    if (canShare) lastShare = { kind: 'catch', c: s.catches[s.catches.length - 1], first: firstSpecies.includes(s.catches[s.catches.length - 1].id) };
    el.card.innerHTML = `${html}<p class="ika-egi-card-cond">${esc(condLine())}</p><div class="ika-egi-card-actions"><button type="button" class="ika-btn ika-btn--primary ika-egi-card-btn" data-next>${t(lang, s.method === 'tailor' ? TX.tailor.btn.back : TX.btn.result)}</button>${s.method === 'yaen' || s.method === 'tailor' ? '' : `<button type="button" class="ika-btn ika-egi-card-btn" data-egi>${t(lang, TX.egi.change)}</button>`}${canShare ? shareButtonHTML(lang) : ''}</div>`;
    syncEgiPick();
    el.card.className = 'ika-egi-card';
    el.card.hidden = false;
  }
  function finishSession() {
    const catches = s.catches;
    const before = rec.best;
    const counted = settings.mode === 'live';
    const lvBefore = levelNow();
    const { rec: r, total } = recordEgiTrip(rec, catches, { counted });   // 釣果は釣れた時に保存済み。ここは釣行の数と自己ベスト
    dispatchEvent(new CustomEvent('ikabu:game', { detail: { game: 'egi', counted, tickets: true } }));   // チケット🎫は初心者練習・季節モードでも出す（10/2 ぱっぱ）。釣行の数・自己ベスト（counted）は今日の萩の海だけ
    const fresh = counted ? firstSpecies.slice() : [];
    rec = r;
    saveRec();
    syncRecords();
    const O = TX.over;
    const list = catches.length
      ? `<ol class="ika-egi-over-list">${catches.map((c) => `<li><span>${esc(speciesName(lang, c.id))}</span><span>${c.mantle} cm</span><b>${c.weight.toLocaleString()} g</b></li>`).join('')}</ol>`
      : `<p class="ika-egi-over-bouzu">${t(lang, O.bouzu)}</p><p class="ika-egi-card-note">${t(lang, O.bouzuSub)}</p>`;
    const noEgi = s.egi <= 0 ? `<p class="ika-egi-card-note">${t(lang, TX.result.noEgi)}</p>` : '';
    el.card.innerHTML = `
      <p class="ika-egi-card-title">${t(lang, O.title)}</p>
      <p class="ika-egi-over-total"><span>${t(lang, O.total)}</span><b>${total.toLocaleString()} g</b>${counted && total > before && total > 0 ? `<span class="ika-tag ika-tag--orange">${t(lang, O.newBest)}</span>` : ''}</p>
      ${!counted && catches.length ? `<p class="ika-egi-live-notice">${t(lang, settings.mode === 'beginner' ? O.notCountedBeginner : O.notCounted)}</p>` : ''}
      ${list}${noEgi}
      <p class="ika-egi-card-note">${TX.egi.reviewColor(lang, bestColors({ tod: s.tod, cond: s.cond, mood: s.mood }).map((c) => t(lang, TX.egi.colors[c])).join('・'))}</p>
      ${fresh.length ? `<p class="ika-egi-card-note">${t(lang, O.zukan)}: ${fresh.map((id) => esc(speciesName(lang, id))).join(', ')} ${t(lang, 'を追加', 'added')}</p>` : ''}
      ${s.gedo.length ? `<p class="ika-egi-card-note">${t(lang, TX.gedo.title)}: ${s.gedo.map((g) => `${TX.gedo.icon[g.id] ?? ''}${esc(t(lang, TX.gedo.names[g.id]))}`).join('、')}</p>` : ''}
      ${counted ? `<p class="ika-egi-card-note ika-egi-over-level">${t(lang, TX.level.title)} Lv${levelOf(rec.points).level}${levelOf(rec.points).to == null ? '' : `・${TX.level.next(lang, levelOf(rec.points).need)}`}</p>` : ''}
      <p class="ika-egi-card-cond">${esc(condLine())}</p>
      <div class="ika-egi-card-actions"><button type="button" class="ika-btn ika-btn--primary ika-egi-card-btn" data-restart>${t(lang, TX.btn.over)}</button>${solo ? '' : shareButtonHTML(lang)}<a class="ika-btn ika-egi-card-btn" href="${solo ? pageHref('games', lang) : '#main'}">${t(lang, TX.btn.quit)}</a></div>`;   // 「やめる」（2026-09-30 ぱっぱ：もう一度しか無いとやめられず戸惑う）
    lastShare = { kind: 'trip', catches: catches.slice() };
    if (counted) levelCheck(lvBefore);
    el.card.className = 'ika-egi-card ika-egi-card--over';
    el.card.hidden = false;
    syncSetupLock();
  }
  // マイ図鑑：釣った種は絵・最大・数・初めて釣った日、まだの種は影と手がかり。「今日の萩の海」の釣果だけが残る
  function syncZukan() {
    if (!el.zukanGrid) return;
    const Z = TX.zukan;
    el.zukanGrid.innerHTML = '';
    let got = 0;
    for (const z of GAME_ZUKAN) {
      const r = rec.species[z.id];
      if (r) got += 1;
      const li = document.createElement('li');
      li.className = `ika-egi-zukan-card${r ? ' is-got' : ''}${z.boss ? ' is-boss' : ''}`;
      const img = `<img class="ika-egi-zukan-art${r ? '' : ' is-shadow'}" src="${assetHref(zukanArt(z.id, true))}" alt="" width="160" height="80" loading="lazy" decoding="async" />`;   // 図鑑はリアル調（ぱっぱ 9/25）
      const body = r
        ? `<p class="ika-egi-zukan-name">${esc(speciesName(lang, z.id))}${z.boss ? ` <span class="ika-tag ika-tag--orange">${t(lang, Z.boss)}</span>` : ''}${rec.nushi?.[z.id] ? ` <span class="ika-tag ika-tag--orange" title="${t(lang, Z.nushiNote)} ${rec.nushi[z.id]}">${t(lang, Z.nushi)}</span>` : ''}</p>
           <p class="ika-egi-zukan-meta">${t(lang, Z.best)} ${r.weight.toLocaleString()} g・${r.mantle} cm<br>${t(lang, Z.count)} ${r.count}${r.first ? `・${t(lang, Z.first)} ${r.first}` : ''}</p>
           <p class="ika-egi-zukan-tap">${t(lang, Z.tapHint)} ›</p>`
        : `<p class="ika-egi-zukan-name">${t(lang, Z.unknown)}${z.boss ? ` <span class="ika-tag">${t(lang, Z.boss)}</span>` : ''}</p>
           <p class="ika-egi-zukan-meta">${t(lang, z.hint)}</p>`;
      // 釣った種はボタンにして、見分け方とリアルな姿の画面を開く
      li.innerHTML = r
        ? `<button type="button" class="ika-egi-zukan-open" data-zukan="${z.id}">${img}<div>${body}</div></button>`
        : `<div class="ika-egi-zukan-open">${img}<div>${body}</div></div>`;
      el.zukanGrid.append(li);
    }
    if (el.zukanCount) el.zukanCount.textContent = String(got);
  }
  // 図鑑の詳しい画面：リアル調の絵＋見分け方＋会えるとき＋自分の記録
  function openZukanDetail(id) {
    const z = zukanById(id);
    const r = rec.species[id];
    const d = el.zukanDetail;
    if (!z || !r || !d) return;
    const Z = TX.zukan;
    d.innerHTML = `
      <div class="ika-egi-zukan-detail-body">
        <img class="ika-egi-zukan-detail-real" src="${assetHref(zukanArt(id, true))}" alt="${esc(speciesName(lang, id))}" loading="lazy" decoding="async" />
        <p class="ika-egi-zukan-detail-name" id="ika-egi-zukan-detail-name">${esc(speciesName(lang, id))}${z.boss ? ` <span class="ika-tag ika-tag--orange">${t(lang, Z.boss)}</span>` : ''}</p>
        <dl class="ika-egi-zukan-detail-rows">
          <div><dt>${t(lang, Z.point)}</dt><dd>${t(lang, z.point)}</dd></div>
          <div><dt>${t(lang, Z.where)}</dt><dd>${t(lang, z.hint)}</dd></div>
          <div><dt>${t(lang, Z.best)}</dt><dd>${r.weight.toLocaleString()} g・${r.mantle} cm（${t(lang, Z.count)} ${r.count}）</dd></div>
        </dl>
        <form method="dialog"><button class="ika-btn ika-btn--primary" value="close">${t(lang, Z.close)}</button></form>
      </div>`;
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  el.zukanGrid?.addEventListener('click', (e) => { const b = e.target.closest('[data-zukan]'); if (b) openZukanDetail(b.dataset.zukan); });
  // 外側（暗いところ）を押しても閉じる
  el.zukanDetail?.addEventListener('click', (e) => { if (e.target === el.zukanDetail) el.zukanDetail.close?.(); });
  /* ---------- 記録を消さないために（2026-09-27 ぱっぱ：1年かけてそろえる図鑑が突然消えるとやる気がなくなる） ---------- */
  function saveRec() {
    if (!canSave) return;
    if (!writeRecord(KEY_EGI, rec)) showSaveNote(TX.backup.failed);
  }
  // Android・PC などでは、ブラウザに「このサイトの記録を消さないで」と頼む（最初に図鑑に入った時に1回）
  let persistAsked = false;
  function keepStorage() {
    if (persistAsked) return;
    persistAsked = true;
    navigator.storage?.persisted?.().then((ok) => { if (!ok) navigator.storage.persist?.(); }).catch(() => {});
  }
  const HINTED = 'ikabu.egi.backupHinted';
  function backupHintOnce() {
    if (readPref(HINTED)) return;
    writePref(HINTED, true);
    setTimeout(() => callout(t(lang, TX.backup.hint), 'good', 5200), 2600);
  }
  const saveNote = document.getElementById('ika-egi-save-note');
  function showSaveNote(text) { if (saveNote) { saveNote.textContent = t(lang, text); saveNote.hidden = false; } }
  // iPhone の Safari（ホーム画面から開いていない時）：しばらく開かないと記録を消すことがある
  const isIOS = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!canSave) showSaveNote(TX.backup.noSave);
  else if (loaded.source === 'backup') showSaveNote(TX.backup.restored);
  else if (isIOS && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches) showSaveNote(TX.backup.ios);
  if (loaded.source === 'backup') saveRec();   // 控えから戻した記録を本体に書き戻す
  // 引き継ぎコード
  const backupBox = document.getElementById('ika-egi-backup');
  const backupCode = document.getElementById('ika-egi-backup-code');
  const backupMsg = document.getElementById('ika-egi-backup-msg');
  // テストプレイ版は専用のコード（IKABUT1-）。テストプレイ内では引き継げるが、正式版とは区別する（10/2 ぱっぱ）
  //   ※ backupCode を作った後に置く（前に置くと試遊版でだけページ全体が止まった：10/2）
  if (IS_TRIAL && backupBox) {
    backupCode?.setAttribute('placeholder', (backupCode.getAttribute('placeholder') ?? '').replace('IKABU1-', 'IKABUT1-'));
    backupBox.querySelector('summary')?.insertAdjacentHTML('afterend', `<p class="ika-egi-cue-note ika-egi-backup-trial">🧪 ${t(lang, TX.backup.trialLead)}</p>`);
  }
  const backupSay = (text) => { if (backupMsg) backupMsg.textContent = t(lang, text); };
  backupBox?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-backup]');
    if (!b) return;
    const act = b.dataset.backup;
    if (act === 'export') {
      backupCode.value = exportCode({ egi: rec, sumi: readRecord(KEY_M3).value }, { trial: IS_TRIAL });
      backupCode.select();
      backupSay(TX.backup.exported);
    } else if (act === 'copy') {
      if (!backupCode.value) backupCode.value = exportCode({ egi: rec, sumi: readRecord(KEY_M3).value }, { trial: IS_TRIAL });
      backupCode.select();
      (navigator.clipboard?.writeText(backupCode.value) ?? Promise.reject()).then(() => backupSay(TX.backup.copied), () => { document.execCommand?.('copy'); backupSay(TX.backup.copied); });
    } else if (act === 'import') {
      const text = backupCode.value.trim();
      if (!text) { backupSay(TX.backup.empty); return; }
      let data;
      try { data = importCode(text, { trial: IS_TRIAL }); } catch (err) { backupSay(err?.message === 'other' ? (IS_TRIAL ? TX.backup.officialCode : TX.backup.trialCode) : TX.backup.bad); return; }
      rec = mergeEgi(rec, data.egi);
      saveRec();
      if (data.sumi) writeRecord(KEY_M3, mergeM3(readRecord(KEY_M3).value, data.sumi));
      syncRecords();
      backupSay(TX.backup.imported);
      setTimeout(() => location.reload(), 1500);   // 墨つなぎの記録も読み直すため
    }
  });
  function syncRecords() {
    syncZukan();
    syncGedo();
    syncLevel();
    const set = (k, v) => { const b = el.records.querySelector(`[data-rec="${k}"]`); if (b) b.textContent = String(v); };
    set('best', rec.best.toLocaleString());
    set('zukan', GAME_ZUKAN.filter((z) => rec.species[z.id]).length);
    set('sessions', rec.sessions);
  }
  // 全画面の見た目の時の「エギを選ぶ」の窓：ページの欄（el.pick）をそのまま窓へ移し、閉じたら元の場所へ戻す
  const pickPop = document.createElement('div');
  pickPop.className = 'ika-egi-pickpop';
  pickPop.hidden = true;
  pickPop.setAttribute('role', 'dialog');
  pickPop.innerHTML = `<button type="button" class="ika-btn ika-btn--primary ika-egi-pickpop-close">${t(lang, TX.zukan.close)}</button>`;
  el.main.append(pickPop);
  let pickHome = null;
  function openPickPop() {
    const box = el.tk ?? el.pick;   // タックルの札ごと窓へ（ロッド・ドラグも投げる前なら替えられる。2026-10-01 深夜）
    if (!pickHome) { pickHome = document.createComment('ika-egi-pick'); box.before(pickHome); pickPop.prepend(box); }
    pickPop.hidden = false;
  }
  function closePickPop() {
    if (pickHome) { pickHome.replaceWith(el.tk ?? el.pick); pickHome = null; }
    pickPop.hidden = true;
  }
  pickPop.addEventListener('click', (e) => { if (e.target.closest('.ika-egi-pickpop-close')) closePickPop(); });
  pickPop.addEventListener('pointerdown', (e) => e.stopPropagation());
  // 全画面の見た目が解けたら、窓も閉じて欄を元へ戻す
  new MutationObserver(() => { if (!document.documentElement.classList.contains('is-egi-full')) closePickPop(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  el.card.addEventListener('click', (e) => {
    if (e.target.closest('[data-next]')) { press(s); release(s); onEvents(s.events); }
    else if (e.target.closest('[data-egi]')) {
      // 全画面の見た目（横向き・横画面モード）では、エギ選びの欄は隠れている→画面の上に窓で出す（2026-09-27 ぱっぱ指摘：押しても反応しない）
      if (document.documentElement.classList.contains('is-egi-full')) { openPickPop(); return; }
      // エギ選びへ（替えたら「次の一投へ」でそのまま続けられる）
      el.pick.classList.add('is-flash');
      setTimeout(() => el.pick.classList.remove('is-flash'), 1600);
      (el.tk ?? el.pick).scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
      el.pickSize.querySelector('.ika-chip')?.focus({ preventScroll: true });
    }
    else if (e.target.closest('[data-restart]')) { newGame(); }
    else if (e.target.closest('[data-rebait]')) { rebait(s); onEvents(s.events.splice(0)); e.target.closest('[data-rebait]').disabled = true; }
    else if (e.target.closest('[data-share]')) shareEgi(e.target.closest('[data-share]'));
  });

  /* ---------- シェア（画像は押された時に初めて描く） ---------- */
  const dateLabel = () => { const d = new Date(); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
  function shareEgi(button) {
    if (!lastShare) return;
    const practice = settings.mode !== 'live';
    const common = { mode: settings.mode === 'beginner' ? 'beginner' : practice ? 'season' : 'live', seasonLabel: settings.mode === 'practice' ? t(lang, SEASON[seasonOf(settings.month)]) : '', dateLabel: dateLabel() };
    const opts = { lang, assetHref, variant: SHARE_VARIANT };
    let text, draw;
    if (lastShare.kind === 'catch') {
      const { c, first } = lastShare;
      const name = speciesName(lang, c.id);
      const eg = settings.egi;
      const data = { ...common, speciesId: c.id, speciesName: name, mantleCm: c.mantle, weightG: c.weight, firstCatch: first && !practice,
        egi: { size: t(lang, `${eg.size}号`, `#${eg.size}`), colorName: t(lang, TX.egi.colors[eg.color]), colorHex: EGI_COLOR_HEX[eg.color] } };
      text = egiCatchText(lang, { name, weightG: c.weight, practice });
      draw = async () => (await import('./share-card.js')).drawEgiCatchCard(data, opts);
    } else {
      const cs = lastShare.catches;
      const big = cs.length ? cs.reduce((a, b) => (b.weight > a.weight ? b : a)) : null;
      const biggest = big ? { speciesId: big.id, speciesName: speciesName(lang, big.id), weightG: big.weight } : null;
      text = egiTripText(lang, { count: cs.length, biggest: biggest && { name: biggest.speciesName, weightG: biggest.weightG } });
      draw = async () => (await import('./share-card.js')).drawEgiTripCard({ ...common, count: cs.length, biggest }, opts);
    }
    openShareView({ lang, button, draw, text, url: shareUrl(lang, 'egi') });
  }


  /* ---------- 入力 ---------- */
  function doPress() {
    feel.unlock();   // iPhone は最初に触った後でないと音を鳴らせない
    if (!s || frozen) return;
    if (s.phase === 'over') { newGame(); return; }   // ボタンの表示は「もう一度釣行する」なので、押したら新しい釣行（ぱっぱ指摘 2026-09-25）
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
    if (s.method === 'yaen') { dart(s); onEvents(s.events.splice(0)); setButton(); syncSide(); return; }
    if (s.phase !== 'sinking' && s.phase !== 'action') return;
    dart(s);
    onEvents(s.events.splice(0));
    setButton();
  }
  // 指：押した瞬間に決めず 150ms だけ待ち、その間に上へ 24px 以上動いたらダート。動かなければ押下（しゃくり／長押し）。
  //   150ms より早く離したらその場でタップ。マウス・キーボードはすぐ押下（ダートは ↑ キー）
  let ptr = null;   // { id, x, y, timer, pressed, darted }
  const SWIPE = { touch: { ms: 150, px: 24 }, mouse: { ms: 140, px: 16 }, pen: { ms: 150, px: 20 } };
  const canSwipe = () => s && s.method === 'egi' && (s.phase === 'sinking' || s.phase === 'action');
  // エギを押したか：当たりの円だけだと、スマホではエギの絵が小さく（縦24px ほど）少し外すと「投げる」になった。
  // 投げる前は、エギの絵のまわり EGI_TAP_R px と「← エギをタップで色が選べる」の案内の上も、エギを押したことにする（ぱっぱ指摘 2026-09-27）
  const EGI_TAP_R = 48;
  const inRect = (el0, x, y) => { if (!el0 || el0.hidden) return false; const b = el0.getBoundingClientRect(); return b.width > 0 && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; };
  const touchesEgi = (e) => {
    if (e.target.closest?.('.ika-eg-egi-hit, #ika-egi-colortip')) return true;
    if (inRect(el.colorTip, e.clientX, e.clientY)) return true;
    const node = sc?.nodes?.egiAir?.getAttribute('opacity') === '1' ? sc.nodes.egiAir : sc?.nodes?.egiWater;
    const b = node?.getBoundingClientRect();
    if (!b || !b.width) return false;
    return Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)) <= EGI_TAP_R;
  };
  const onDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (s?.method === 'tailor' && s.phase === 'tailor' && !e.target.closest?.('.ika-egi-btn, .ika-egi-tailorbtns, a, details, .ika-egi-fullbtn, .ika-egi-bgmbtn')) {
      const svg = sc?.svg;
      const m = svg?.getScreenCTM?.();
      if (m) {
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        const i = tailorHit(sc.tailor, s, X, p);
        if (i >= 0) { e.preventDefault(); doTailorSet(i); }
      }
      return;
    }
    if (!e.target.closest?.('.ika-egi-btn, .ika-egi-dart') && s && s.method !== 'yaen' && (s.phase === 'ready' || s.phase === 'result') && !V.flight && touchesEgi(e)) {
      e.preventDefault();
      openColorPop();
      return;
    }
    if (el.anglerPop && !el.anglerPop.hidden) { if (!e.target.closest?.('.ika-egi-anglerpop')) { el.anglerPop.hidden = true; e.preventDefault(); } return; }
    // 釣り人をタップ：キャラ一覧（投げる前・結果表示中・始める前だけ。2026-10-02）
    if (!e.target.closest?.('.ika-egi-btn, .ika-egi-dart, .ika-egi-fullbtn, .ika-egi-bgmbtn, .ika-egi-card') && (!s || s.phase === 'ready' || s.phase === 'result' || s.phase === 'over') && !V.flight && inRect(sc?.svg?.querySelector('.ika-eg-angler'), e.clientX, e.clientY)) {
      e.preventDefault();
      openAnglerPop();
      return;
    }
    if (el.colorPop && !el.colorPop.hidden) { el.colorPop.hidden = true; if (!e.target.closest?.('.ika-egi-btn')) return; }
    if (e.target.closest('a, .ika-egi-card, select, .ika-chip, details, .ika-egi-colorpop, .ika-egi-anglerpop, .ika-egi-fullbtn, .ika-egi-bgmbtn')) return;
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
    // 横画面モード（90度回している）では、ゲームの「上」は画面の右
    const up = rotated() ? e.clientX - ptr.x : ptr.y - e.clientY;
    const side = rotated() ? e.clientY - ptr.y : e.clientX - ptr.x;
    if (up >= ptr.px && Math.abs(side) < 60) {
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
  // 色選びの窓（.ika-egi-colorpop）は除く：touchstart を止めるとスマホでは click が起きず、色のボタンが押せなくなる（ぱっぱ指摘 2026-09-25）
  // 結果・まとめのカード（.ika-egi-card）の中も除く：止めると指でカードの中をスクロールできず、下のボタンに届かない（ぱっぱ指摘 2026-09-25）
  // 全画面ボタン（.ika-egi-fullbtn）も除く：止めると指で押した時に click が起きず、全画面・横画面モードに入れなかった（2026-09-27）
  const noLongPress = (e) => { if (!e.target.closest('a, select, input, textarea, .ika-egi-card, details, .ika-egi-colorpop, .ika-egi-fullbtn, .ika-egi-bgmbtn')) e.preventDefault(); };
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
  // 横向き：カウント・距離の箱を舞台の外（右の列）へ。縦向きに戻したら舞台の右上へ戻す
  const sideHud = document.getElementById('ika-egi-sidehud');
  const stageHud = el.stage.querySelector('.ika-egi-hud');
  let btnFull = false;   // 「⛶ 全画面」ボタンで入った全画面（PC・縦向きのスマホでも）
  // 横画面モード（2026-09-27）：縦向きのまま、ゲーム（.ika-egi-main）だけを時計回りに90度回す。html に .is-egi-rot。
  // 回した後の幅と高さは画面の高さと幅（CSS の --rot-w / --rot-h。アドレスバーの出入りで変わるので、そのつど合わせる）。
  // ロックしていない人がスマホを本当に横にしたら、回すのをやめて、ふつうの横向き全画面に（二重に回らないように）
  let rotMode = false;
  const rotated = () => document.documentElement.classList.contains('is-egi-rot');
  const syncRot = () => {
    const on = rotMode && btnFull && innerHeight > innerWidth;
    const root = document.documentElement;
    root.classList.toggle('is-egi-rot', on);
    if (on) { root.style.setProperty('--rot-w', `${innerHeight}px`); root.style.setProperty('--rot-h', `${innerWidth}px`); }
  };
  addEventListener('resize', () => { if (rotMode) syncRot(); });
  const placeHud = () => {
    if (!sideHud || !stageHud) return;
    const to = landscape.matches || btnFull ? sideHud : stageHud;
    for (const id of ['ika-egi-count', 'ika-egi-reel']) {
      const box = document.getElementById(id);
      if (box && box.parentNode !== to) to.append(box);
    }
  };
  placeHud();
  landscape.addEventListener?.('change', placeHud);
  // 横向きの全画面（ぱっぱ 2026-09-25「横向きにしたらエギング画面が画面全体に」）：
  // 横向きのスマホでは、舞台とボタンだけを画面全体に出す（html に .is-egi-full。見た目は CSS）。
  // あそび場（墨つなぎと同じページ）では、エギングが画面に見えている時だけ。縦に戻せば元のページ
  const fullWanted = () => {
    if (!landscape.matches) return false;
    if (solo) return true;
    const r = el.main.getBoundingClientRect();
    return r.bottom > innerHeight * 0.3 && r.top < innerHeight * 0.7;
  };
  const syncFull = () => {
    if (btnFull) return;
    const on = landscape.matches && (document.documentElement.classList.contains('is-egi-full') || fullWanted());
    document.documentElement.classList.toggle('is-egi-full', on);
    // 縦に戻したら、ブラウザの全画面（Android など）も解除
    if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };
  syncFull();
  landscape.addEventListener?.('change', () => { if (btnFull) return; document.documentElement.classList.remove('is-egi-full'); syncFull(); });
  let fullScrollT = 0;
  addEventListener('scroll', () => { if (!landscape.matches) return; clearTimeout(fullScrollT); fullScrollT = setTimeout(syncFull, 200); }, { passive: true });
  // Android など：全画面の中で指を離したとき、ブラウザの帯（アドレスバー・下のバー）も消す。
  // 指を置いた瞬間（pointerdown）では全画面にできない決まりなので、離したとき（pointerup / touchend）に頼む。iPhone の Safari は非対応（何もしない）
  const goRealFull = () => {
    if (!document.documentElement.classList.contains('is-egi-full') || document.fullscreenElement || !document.fullscreenEnabled) return;
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  };
  el.main.addEventListener('pointerup', goRealFull, true);
  el.main.addEventListener('touchend', goRealFull, true);
  // 「⛶ 全画面」ボタン：PC・Android はブラウザの全画面＋海いっぱいの並び。iPhone（全画面の仕組みが無い）は並びだけ変えて、横向き・ホーム画面に追加を案内
  const fullBtn = document.getElementById('ika-egi-fullbtn');
  const fullNote = document.getElementById('ika-egi-fullnote');
  let fullNoteT = 0;
  const setFullBtn = () => {
    if (!fullBtn) return;
    fullBtn.textContent = t(lang, btnFull ? TX.fullExit : TX.fullBtn);
    fullBtn.dataset.full = btnFull ? 'exit' : 'enter';
    fullBtn.setAttribute('aria-pressed', String(btnFull));
  };
  const showFullNote = (text = TX.fullNote) => {
    if (!fullNote) return;
    fullNote.textContent = t(lang, text);
    fullNote.hidden = false;
    clearTimeout(fullNoteT); fullNoteT = setTimeout(() => { fullNote.hidden = true; }, 6000);
  };
  const enterBtnFull = () => {
    // 縦向きの画面では海が狭く切れて遊びにくい：横に固定できる端末（Android）だけ全画面＋横固定、それ以外（iPhone）は横に倒す案内だけ
    const portrait = innerHeight > innerWidth;
    const canLock = document.fullscreenEnabled && typeof screen.orientation?.lock === 'function';
    btnFull = true;
    // 横に固定できない端末（iPhone など）で縦向き：ゲームだけを90度回して画面いっぱいに（画面の向きのロック中でも横で遊べる）
    rotMode = portrait && !canLock;
    document.documentElement.classList.add('is-egi-full', 'is-egi-full-btn');
    syncRot();
    if (rotMode) showFullNote(TX.fullRotNote);
    placeHud(); setFullBtn();
    if (document.fullscreenEnabled) {
      document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
        .then(() => { if (portrait) return screen.orientation.lock('landscape'); })
        .then(() => {
          // 固定できたはずでも縦のまま（固定の効かない端末）なら、元に戻して案内
          if (portrait) setTimeout(() => { if (btnFull && innerHeight > innerWidth) { exitBtnFull(); showFullNote(); } }, 800);
        })
        .catch(() => { if (portrait) { exitBtnFull(); showFullNote(); } });   // 横に固定できなければ元に戻して案内
    }
  };
  const exitBtnFull = () => {
    btnFull = false;
    rotMode = false;
    syncRot();
    document.documentElement.classList.remove('is-egi-full', 'is-egi-full-btn');
    if (fullNote) fullNote.hidden = true;
    try { screen.orientation?.unlock?.(); } catch (e) { /* 固定していなければ何もしない */ }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    placeHud(); setFullBtn(); syncFull();
  };
  fullBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());
  fullBtn?.addEventListener('click', (e) => { e.stopPropagation(); if (btnFull) exitBtnFull(); else enterBtnFull(); });
  // PC の Esc などでブラウザの全画面が解けたら、並びも元に戻す
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && btnFull) exitBtnFull(); });
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
        if (s.method === 'yaen') { syncSide(); syncAji(); }   // 寄せて45度に入ったら「ヤエン投入」に変える（出来事が無くても）
        syncJadoLift();
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
  function stop() { running = false; cancelAnimationFrame(raf); feel.drag(false); feel.reel(false); }
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
    if (bonusNote) { callout(t(lang, bonusNote), 'good', 4200); bonusNote = null; }
    else callout(t(lang, TX.msg.cast));
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
      const top0 = V.jerkKind === 'drag' ? 48 : V.jerkKind === 'dart' ? 80 : V.jerkKind === 'slack' ? 60 : V.jerkDouble ? 66 : 72;   // ズル引きは竿を小さく立てるだけ
      const top = 34 + (top0 - 34) * (V.jerkKind === 'drag' ? 1 : rodNow().jerk);   // 硬めは大きく、柔らかめは小さく（2026-10-01）
      const jd = 0.5 * dragNow().jerkDur;   // 締め＝キビキビ、ゆるめ＝ふわっと
      rodAng = j < jd ? lerp(top, 34, easeOut(j / jd)) : 34;
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
    else if (phase === 'fight') {
      // 重いイカほど竿が深く曲がり、引き込まれる
      const hv = V.heavy ?? 0.5;
      const bend = TACKLE.rod[settings.tackle.rod]?.bend ?? 1;   // 硬めはほとんど曲がらない・柔らかめは大きくしなる（10/2 ぱっぱ）
      rodAng = 58 - 10 * hv * bend - (now - V.lastJet < 0.25 ? 7 * bend * (1 - (now - V.lastJet) / 0.25) * Math.min(1.4, hv + 0.4) : 0);   // ジェットで竿先がガクッと入る
      pull = clamp((s.tension / 100) * (0.75 + 0.45 * hv) * bend, 0.06, 1.6);
    }
    else if (V.hug.on) { rodAng = 52; pull = 0.35; }
    // 竿は目標角へなめらかに（振り出しの最中だけは追従を速く）、しなりは角速度の逆向き
    const prevAng = V.rodAng ?? rodAng;
    V.rodAng = V.rodAng == null ? rodAng : V.rodAng + wrap(rodAng - V.rodAng) * (1 - Math.exp(-dt * (C ? 40 : 10)));
    const rodVel = dt > 0 ? wrap(V.rodAng - prevAng) / dt : 0;
    V.rodLag += (clamp(-rodVel * 0.03, -16, 16) - V.rodLag) * (1 - Math.exp(-dt * 18));
    const tipNow = () => rodGeom(V.rodAng, 0, null, V.rodLag).tip;

    /* ----- エギの目標位置 ----- */
    let taut = 0.35;
    let sagMul = 1;   // 糸のたるみの大きさ（アタリ「フケる」だけ大きく）
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
      V.sinkOffset = Math.max(0, V.sinkOffset - (s.method === 'jado' ? 1.6 : 0.4) * dt);   // 邪道はオモリで速く沈むので、見た目もすぐ追いつかせる
      // ヤエン（2026-09-27 ぱっぱ：抱いたイカはアジごと画面の外へ走っていく方がおもしろい）：
      //   抱いてから、YAEN_DIST+8m より遠い間は画面の右の外にいる（糸だけが外へ伸びる）。寄せて近づくと右端から姿が戻ってくる
      const yaenFar = s.method === 'yaen' && ['run', 'draw'].includes(phase) && now - (V.hug.t0 ?? -9) > 0.5;   // 抱いた瞬間（0.5秒）は見せてから走らせる
      const nearD = YAEN_DIST + 8;
      const tx = yaenFar && s.dist > nearD ? lerp(X(nearD), W + 90, clamp((s.dist - nearD) / 3, 0, 1)) : X(s.dist);
      const ty = Y(clamp(s.depth - V.sinkOffset, 0.15, s.bottom)) - (V.egi.mode === 'stuck' ? 0 : 6) - (yaenFar && phase === 'run' ? 30 : 0);
      const jerkFresh = now - V.jerkAt < 0.28 * dragNow().jerkDur;   // ゆるいと上がりきるまでが長い
      const rate = jerkFresh ? 1 - Math.exp(-dt * 16 * (dragNow().snap ?? 1)) : k8;   // 締め＝クイックに跳ね上がる／ゆるめ＝ふわっと（10/2 ぱっぱ）
      if (V.egi.mode === 'stuck') {
        const shake = now - V.snagAt < 0.6 && !reduced ? Math.sin(now * 40) * 3 : 0;
        V.egi.x += (tx + shake - V.egi.x) * k8; V.egi.y += (ty + 2 - V.egi.y) * k8;
        V.egi.ang += wrap(-140 - V.egi.ang) * k3;
      } else {
        // ダート：大きく横へ跳ねてから戻る（ジグザグ）。2段：小さく2回目の跳ね
        const dartK = V.dartAt != null ? (now - V.dartAt) / 0.45 : 9;
        const dartX = dartK < 1 ? 80 * rodNow().jerk * Math.sin(Math.PI * dartK) * (dartK < 0.5 ? 1 : -0.6) : 0;   // 横へ大きく（2026-09-29 高さは控えめに）。ロッドで振れ幅が変わる
        // スラックジャーク：左右に小刻みにチョンチョン
        // 1回ごとに左右交互へ鋭く跳ねる（0.22秒）。最初の3割で一気に振り、残りで戻る
        const slackK = V.slackAt != null ? (now - V.slackAt) / 0.22 : 9;
        const slackE = slackK < 1 ? (slackK < 0.3 ? Math.sin((Math.PI / 2) * (slackK / 0.3)) : Math.cos((Math.PI / 2) * ((slackK - 0.3) / 0.7))) : 0;
        const slackX = reduced ? 0 : 46 * rodNow().jerk * (V.slackSide ?? 1) * slackE;
        V.egi.x += (tx + dartX + slackX - V.egi.x) * rate;
        V.egi.y += (ty - (dartK < 1 ? 10 * Math.sin(Math.PI * dartK) : 0) - V.egi.y) * rate;
        // 糸は釣り人側（左上）から頭に結ばれている。フォールは頭を下げて（左下）、尻を沖の上へ向けて沈む。
        // しゃくった直後は頭を上げて釣り人側へ飛ぶ。テンションフォールは頭を釣り人側へ向けて滑るように、フリーフォールは頭を下げてまっすぐ
        const onBed = (s.method === 'jado' || (s.method === 'yaen' && s.aji !== 'live')) && s.depth >= s.bottom;   // 邪道・死にアジ：底に寝かせる
        const swimming = s.method === 'yaen' && s.aji === 'live' && phase === 'wait';   // 活きアジ：沖へ向いて泳ぐ
        const chasing = V.chaseAt != null && now - V.chaseAt < YAEN_CHASE;
        const target = swimming ? -90 + (reduced ? 0 : Math.sin(now * (chasing ? 22 : 9)) * (chasing ? 22 : 12)) : jerkFresh ? (V.jerkKind === 'drag' ? -100 : V.jerkKind === 'dart' ? -60 : -35) : onBed ? -105 : phase === 'sinking' ? -145 : s.tensionFall ? -112 : -140;
        V.egi.ang += wrap(target - V.egi.ang) * (jerkFresh ? 0.45 : k3);
        if (slackK < 1 && !reduced) V.egi.ang += 32 * (V.slackSide ?? 1) * slackE * 0.35;   // 頭を左右に振る
        // イカパンチ：足で叩かれてエギが横へ弾かれ、向きがぶれる（0.35秒）
        const pk = V.punchAt != null ? (now - V.punchAt) / 0.35 : 9;
        if (pk < 1 && !reduced) {
          V.egi.x -= 22 * Math.sin(Math.PI * pk) * (pk < 0.5 ? 1 : -0.4);   // 沖側から叩かれるので手前へ弾かれる
          V.egi.ang += 38 * Math.sin(2 * Math.PI * pk) * (1 - pk);
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
        // 取り込み：糸に沿って持ち上げ、堤防の先で吊る（足が上・胴が下）。タモ・ギャフは道具が届く（lead 秒）まで水面で待つ
        const lead = V.land.lead ?? 0;
        const k = easeInOut(clamp((now - V.land.t0 - lead) / 0.9, 0, 1));
        if (lead > 0 && now - V.land.t0 < lead && !V.land.splashed && now - V.land.t0 > lead - 0.15) { V.land.splashed = true; burst(V.hug.x, SCENE.surface, 8); }
        const hp = hangPoint();
        V.hug.x = lerp(V.land.from.x, hp.x, k);
        V.hug.y = lerp(V.land.from.y, hp.y, k) - 30 * Math.sin(Math.PI * k);
        const swing = reduced ? 0 : 9 * Math.sin((now - V.land.t0) * 5) * Math.exp(-(now - V.land.t0) * 0.5);
        V.hug.ang += wrap(swing - V.hug.ang) * (k >= 1 ? k8 : 1 - Math.exp(-dt * 6));
        hugInAir = V.hug.y < S.surface - 10;
        taut = 1;
        // タモ・ギャフ：道具が堤防側から届く（lead 秒）→ イカを取る → 持ち上げに付いていく → 吊ったら引っ込む
        if (V.land.kind === 'net' || V.land.kind === 'gaff') {
          const net = V.land.kind === 'net';
          const u = clamp((now - V.land.t0) / lead, 0, 1);                       // 届くまで
          const hugH = V.hug.height ?? 100;
          const aimX = V.hug.x + (net ? 4 : 2);
          const aimY = net ? V.hug.y + hugH * 0.55 : V.hug.y + hugH * 0.35;     // タモは胴の下へ、ギャフは胴へ
          // 手元（SCENE.grip）から先がイカまで伸びる（lead 秒）→ 取ったら先はイカに付いたまま、柄が縮みながら手元へ寄せる
          const ex = easeOut(u);
          const tx = u >= 1 ? aimX : lerp(SCENE.grip.x + 20, aimX, ex);
          const ty = u >= 1 ? aimY : lerp(SCENE.grip.y + 10, aimY, ex);
          const fade = k >= 1 ? clamp(1 - (now - V.land.t0 - lead - 0.9) / 0.4, 0, 1) : 1;   // 吊ってから 0.4 秒で消える
          drawTool(V.land.kind, tx, ty, fade);
        } else drawTool('net', 0, 0, 0);
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
          // 2026-10-03 ぱっぱ：前は真上近くを向いて持ち上げ、浅い所では胴が海面から出ていた（本物は水の中で抱いて浮くだけ）。
          //   イカは横向きのまま、胴が海面の下に収まる分だけ持ち上げる。分かりやすさは糸のたるみ（ふつうの約3.5倍）で見せる
          const bodyH = V.hug.height ?? 100;
          const room = V.egi.y - SCENE.surface - 10;                        // エギから海面（少し下）までの余裕
          const lift = Math.min(26 * B.amp * easeOut(k), Math.max(0, room - 0.3 * bodyH));   // 0.3＝横向きの胴の半分の幅
          V.hug.x = V.egi.x - 6 * easeOut(k);
          V.hug.y = V.egi.y - lift;
          V.hug.ang += wrap(angleOf(1, 0) - V.hug.ang) * k8;
          sagMul = 1 + 2.5 * easeOut(k);
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
        const tx = X(s.dist) + (now - V.lastJet < 0.35 ? 10 + 14 * (V.heavy ?? 0.5) : 0);
        const ty = Y(depth);
        V.hug.x += (tx - V.hug.x) * k8;
        V.hug.y += (ty - V.hug.y) * k8;
        const pull = s.pressing ? -0.15 : 0.25;
        V.hug.ang += wrap(angleOf(0.9, 0.35 + pull) - V.hug.ang) * k3;
        taut = clamp(s.tension / 60, 0.2, 1);
        if (!V.revealed && depth <= 2.2) {
          V.revealed = true;
          setSquidArt(sc.nodes.hugWater, 'hug', h.id, mantleUnits(h.mantle), true);
          sc.nodes.hugWater.style.filter = '';
          const big = h.weight >= 1000;
          if (h.nushi) callout(TX.msg.nushiReveal(lang, speciesName(lang, h.id)), 'good', 3200);
          else if (h.boss) callout(TX.msg.bossReveal(lang, speciesName(lang, h.id)), 'good');
          else callout(TX.msg.reveal(lang, speciesName(lang, h.id), big) + (big ? ` ${t(lang, TX.msg.kilo)}` : ''), 'good');
          if (big) feel.fire('hook', { heavy: V.heavy });
        }
        if (!inked && !h.gedo && depth <= 1.0) {
          inked = true;
          V.ink = { t0: now, x: V.hug.x - 10, y: S.surface + 10 };
          callout(t(lang, TX.msg.ink));
        }
      } else if (s.method === 'yaen' && ['run', 'draw', 'yaen'].includes(phase)) {
        V.hug.x += (V.egi.x + 6 - V.hug.x) * k8; V.hug.y += (V.egi.y - V.hug.y) * k8;
        const jig = now - (V.dragAt ?? -9) < 0.5 && !reduced ? 10 * Math.sin((now - V.dragAt) * 30) : 0;
        V.hug.ang += wrap(angleOf(0.9, 0.3) + jig - V.hug.ang) * k3;
        taut = phase === 'draw' ? (s.pressing ? 1 : 0.6) : 0.85;
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
    let lineCtrl = null;   // 糸を曲線で描いたときの制御点（水面の輪の位置をこの曲線から求める）
    if (V.lineBroken) {
      d = `M${f1(tip.x)},${f1(tip.y)} q${f1(wobble)},20 ${f1(wobble * 0.5)},46`;
    } else if (V.egi.mode === 'cast' && C?.released && V.flyDir) {
      d = trailingLineD(tip, lineEnd, V.flyDir, V.flyK, reduced ? 0 : Math.sin(now * 9) * 6);
    } else {
      const L = Math.hypot(lineEnd.x - tip.x, lineEnd.y - tip.y);
      const sag = (1 - taut) * L * 0.16 * sagMul;
      const mid = { x: (tip.x + lineEnd.x) / 2, y: (tip.y + lineEnd.y) / 2 + sag };
      d = `M${f1(tip.x)},${f1(tip.y)} Q${f1(mid.x)},${f1(mid.y)} ${f1(lineEnd.x)},${f1(lineEnd.y)}`;
      lineCtrl = mid;
    }
    sc.line.setAttribute('d', d);
    // ヤエン：竿先で道糸に掛け、糸を伝って滑り降りる針金の仕掛け（ヤエンの位置＝滑った距離 / 残りの距離）
    //   2026-09-28 ぱっぱ（図あり）：上に道糸を通す輪（ガイド）と前の曲げ、そこから下へぶら下がる長い腕、腕の下の端に上向きの掛け針3本。
    //   輪は糸の向きに合わせて回し、腕は重さで下へぶら下がる（届くとイカの下に針が入る）
    if (!sc.yaenNode) {
      sc.yaenNode = svgEl('g', { class: 'ika-eg-yaen', opacity: '0' });
      // 写真のとおり細い1本の針金（2026-09-28 ぱっぱ：太すぎる。写真に忠実に）：
      //   糸を通す小さな輪2つ ＋ 先端の短い曲げ（輪の側）／長い腕 ＋ 腕の下の端に、横へ出た短い掛け針3本
      const WIRE = { fill: 'none', stroke: '#16233a', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
      const body = svgEl('g', {});
      const arm = 'M0,0 L-5,46';
      const hooks = [[-3.4, 32], [-4.2, 39], [-5, 46]].map(([x, y]) => `M${x},${y} l4.2,2.2 q2.4,1.4 3,-1.2 l-0.6,-1.6`).join(' ');
      body.append(
        svgEl('path', { d: arm, ...WIRE }),
        svgEl('path', { d: arm, fill: 'none', stroke: '#c9d4dc', 'stroke-width': '0.6', 'stroke-linecap': 'round' }),
        svgEl('path', { d: hooks, ...WIRE }),
      );
      const rings = svgEl('g', {});
      rings.append(
        svgEl('circle', { cx: '0', cy: '0', r: '2.1', ...WIRE }),
        svgEl('circle', { cx: '0', cy: '-7', r: '2.1', ...WIRE }),
        svgEl('path', { d: 'M0,-7 L0,0 M0,-9 L0,-15 L-7,-15 L-7,-12.5', ...WIRE }),   // 輪をつなぐ針金と、先端の短い曲げ
      );
      const inner = svgEl('g', {});
      inner.append(body, rings);
      sc.yaenInner = inner;
      sc.yaenRings = rings;
      sc.yaenNode.append(inner);
      sc.svg.append(sc.yaenNode);
    }
    if (phase === 'yaen' && s.yaen && lineCtrl) {
      const k = clamp(s.yaen.yaenPos / Math.max(1, s.dist), 0, 1);
      const u = 1 - k;
      const px = u * u * tip.x + 2 * u * k * lineCtrl.x + k * k * lineEnd.x;
      const py = u * u * tip.y + 2 * u * k * lineCtrl.y + k * k * lineEnd.y;
      // たるんだ糸に沿わせる（その場所での糸の向き＝曲線の接線）
      const dx = u * (lineCtrl.x - tip.x) + k * (lineEnd.x - lineCtrl.x);
      const dy = u * (lineCtrl.y - tip.y) + k * (lineEnd.y - lineCtrl.y);
      sc.yaenNode.setAttribute('transform', `translate(${f1(px)},${f1(py)})`);
      sc.yaenRings.setAttribute('transform', `rotate(${f1((Math.atan2(dy, dx) * 180) / Math.PI - 90)})`);   // 輪は糸の向き（前の曲げは竿の側）
      // 竿先で糸に掛けた瞬間：ぽんと大きく出てから落ち着く（どこに入れたか分かるように）
      const pop = V.yaenAt != null ? clamp((now - V.yaenAt) / 0.35, 0, 1) : 1;
      sc.yaenInner.setAttribute('transform', `scale(${(1.1 + (1 - pop) * 0.6).toFixed(2)})`);
      sc.yaenNode.setAttribute('opacity', '1');
    } else sc.yaenNode.setAttribute('opacity', '0');
    sc.line.setAttribute('stroke-width', (2 + 1.2 * taut).toFixed(1));
    sc.line.setAttribute('opacity', (0.8 + 0.2 * taut).toFixed(2));
    // 入水点の輪
    if (!V.lineBroken && lineEnd.y > S.surface + 4 && tip.y < S.surface) {
      // 糸はたるんだ曲線なので、まっすぐな線ではなく曲線が水面と交わる点に輪を置く（ぱっぱ指摘：フリーフォールで輪がずれる）
      const ex = lineCtrl ? quadCrossX(tip, lineCtrl, lineEnd, S.surface) : lerp(tip.x, lineEnd.x, (S.surface - tip.y) / (lineEnd.y - tip.y));
      setAttrs(n.entry, { cx: f1(ex), cy: f1(S.surface + 1), rx: f1(9 + 2 * Math.sin(now * 3)), opacity: '0.7' });
    } else n.entry.setAttribute('opacity', '0');

    /* ----- エギの絵（空中と水中で前後を変える） ----- */
    const egiVisible = !V.hug.on || V.egi.mode === 'flight' || V.egi.mode === 'cast';
    const egiAir = V.egi.y < S.surface;
    // ヤエンのアジは左右を返す：横になった時に青い背中が上・銀の腹が下になるように（2026-09-28 ぱっぱ：活きアジの上下が逆）
    const egiT = `translate(${f1(V.egi.x)} ${f1(V.egi.y)}) rotate(${f1(V.egi.ang)}) scale(${s?.method === 'yaen' ? -1.15 : 1.15} 1.15)`;
    // 最初だけ：投げる前に「← エギをタップで色が選べる」をエギの右に出す（一度でも色を選んだら出さない）
    if (el.colorTip) {
      const showTip = s.method !== 'yaen' && (!colorSeen && phase === 'ready' && V.egi.mode === 'tip' && !V.flight);   // ヤエンはエギを使わないので色選びの案内は出さない
      if (showTip) {
        const eb = n.egiAir.getBoundingClientRect();
        const sb = el.stage.getBoundingClientRect();
        if (eb.width) {
          // 位置は舞台の中の座標で決める。横画面モード（90度回している）では、画面の座標を舞台の座標に読み替える
          //   画面の縦（Y）が舞台の横、画面の右端からの距離が舞台の縦。幅と高さも入れ替わる（2026-09-27 案内がずれて手順と重なった）
          const rot = rotated();
          const right = rot ? eb.bottom - sb.top : eb.right - sb.left;
          const midY = rot ? sb.right - (eb.left + eb.width / 2) : eb.top - sb.top + eb.height / 2;
          const stageW = rot ? sb.height : sb.width;
          const tipLeft = Math.round(right + 6);
          el.colorTip.style.left = `${tipLeft}px`;
          // スマホの狭い舞台では右端からはみ出すので、残りの幅で折り返す
          el.colorTip.style.maxWidth = `${Math.max(90, Math.round(stageW - tipLeft - 8))}px`;
          el.colorTip.style.top = `${Math.round(midY)}px`;
        }
      }
      if (el.colorTip.hidden === showTip) el.colorTip.hidden = !showTip;
    }
    n.egiAir.setAttribute('transform', egiT); n.egiWater.setAttribute('transform', egiT);
    n.egiAir.setAttribute('opacity', egiVisible && egiAir ? '1' : '0');
    n.egiWater.setAttribute('opacity', egiVisible && !egiAir ? '1' : '0');
    if (s.method === 'tailor' && phase !== 'fight') {
      n.egiWater.setAttribute('opacity', '0'); n.egiAir.setAttribute('opacity', '0');
      if (phase !== 'result' || !V.land) sc.line.setAttribute('d', '');
    }
    drawTailor(sc.tailor, s, { W, X, mainTip: tipNow(), now, dt, reduced });
    syncTailorBtns();
    if (V.ghost) {
      const a = 1 - clamp((now - V.ghost.t0) / 1.5, 0, 1);
      setAttrs(n.ghost, { transform: `translate(${f1(V.ghost.x)} ${f1(V.ghost.y)}) rotate(${f1(V.ghost.ang)}) scale(1.15)`, opacity: (a * 0.6).toFixed(2) });
      if (a <= 0) V.ghost = null;
    } else n.ghost.setAttribute('opacity', '0');

    const hugT = `translate(${f1(V.hug.x)} ${f1(V.hug.y)}) rotate(${f1(V.hug.ang)}) scale(1.15)`;
    n.hugAir.setAttribute('transform', hugT); n.hugWater.setAttribute('transform', hugT);
    n.hugAir.setAttribute('opacity', V.hug.on && hugInAir ? '1' : '0');
    n.hugWater.setAttribute('opacity', V.hug.on && !hugInAir ? String(V.hug.alpha ?? 1) : '0');
    // 釣り人の驚き：ジェットの瞬間から 0.7 秒、ビクッと揺れて頭の上に「！」と汗（2026-10-02）
    {
      const jk = V.anglerJolt != null ? (now - V.anglerJolt) / 0.7 : 9;
      const ang = sc.svg.querySelector('.ika-eg-angler');
      const B = SCENE.squidBox;
      if (jk < 1 && !reduced) {
        const shake = Math.sin(jk * Math.PI * 6) * (1 - jk) * 5;
        const hop = -Math.sin(Math.min(1, jk * 3) * Math.PI) * 6;
        ang?.setAttribute('transform', `translate(${f1(shake)} ${f1(hop)})`);
        const a = anglerOf(anglerRec.current);
        if (ang && a.jet && ang.dataset.face !== 'jet') { ang.setAttribute('href', assetHref(a.jet)); ang.dataset.face = 'jet'; }   // 驚いた顔
        const pop = jk < 0.15 ? jk / 0.15 : 1;
        n.surprise.setAttribute('transform', `translate(${f1(B.x + B.w * 0.98)} ${f1(B.y + B.h * 0.36 - 6 * pop)}) scale(${(0.8 + 0.6 * pop).toFixed(2)})`);   // 頭の右横（縦画面だと頭の上は舞台の外になる）
        n.surprise.setAttribute('opacity', String(jk > 0.8 ? (1 - jk) / 0.2 : 1));
      } else {
        if (ang?.getAttribute('transform')) ang.setAttribute('transform', '');
        if (ang && ang.dataset.face === 'jet') { ang.setAttribute('href', assetHref(anglerOf(anglerRec.current).src)); ang.dataset.face = 'normal'; }
        n.surprise.setAttribute('opacity', '0');
      }
    }
    // 吊ったイカから落ちるしずく
    n.drips.forEach((dp, i) => {
      if (!(V.hug.on && hugInAir) || reduced) { dp.setAttribute('opacity', '0'); return; }
      const ph = (now * 1.1 + i * 0.33) % 1;
      setAttrs(dp, { cx: f1(V.hug.x + [-8, 6, 1][i]), cy: f1(V.hug.y + 120 + ph * ph * 90), opacity: (0.85 * (1 - ph)).toFixed(2) });
    });
    // ジェット噴射：頭の下の漏斗から釣り人側へ水を噴いて、胴の先の方向（沖）へ飛ぶ。
    // 太い水流の筋（大きいイカほど長く太い）＋白い芯＋泡
    n.jet.setAttribute('opacity', '0');
    if (V.hug.on && !reduced && now - V.lastJet < 0.5) {
      const a = 1 - (now - V.lastJet) / 0.5;
      const hv = Math.min(1.6, V.heavy ?? 0.5);
      const L = (60 + 70 * hv) * (0.6 + 0.4 * (1 - a));
      const w = 5 + 7 * hv;
      const x0 = V.hug.x - 6, y0 = V.hug.y + 4;
      n.jetStreak.setAttribute('d', `M${f1(x0)},${f1(y0 - w * 0.5)} Q${f1(x0 - L * 0.5)},${f1(y0 - w)} ${f1(x0 - L)},${f1(y0)} Q${f1(x0 - L * 0.5)},${f1(y0 + w)} ${f1(x0)},${f1(y0 + w * 0.5)} Z`);
      n.jetStreak.setAttribute('opacity', (0.75 * a).toFixed(2));
      n.jetCore.setAttribute('d', `M${f1(x0 - 4)},${f1(y0)} L${f1(x0 - L * 0.8)},${f1(y0 + Math.sin(now * 40) * 1.5)}`);
      n.jetCore.setAttribute('opacity', (0.8 * a).toFixed(2));
    } else { n.jetStreak.setAttribute('opacity', '0'); n.jetCore.setAttribute('opacity', '0'); }
    // イカパンチ：エギのまわりに水の輪が広がり、沖側からイカの足の影が一瞬のびて叩く
    // イカパンチの影：沖側から突っ込み（0〜0.25）、叩いて（〜0.45）、離れていく（〜1）。0.75秒
    const pq = V.punchAt != null ? (now - V.punchAt) / 0.75 : 9;
    if (pq < 1 && !reduced) {
      if (!n.punchSquid.firstChild) n.punchSquid.append(swimmingSquid({ species: 'default', len: 64, colors: SHADOW }));
      const lunge = pq < 0.25 ? pq / 0.25 : pq < 0.45 ? 1 : 1 - (pq - 0.45) / 0.55;
      const ease = 1 - (1 - lunge) * (1 - lunge);
      const px = V.egi.x + 150 - 96 * ease, py = V.egi.y + 8;
      const op = Math.min(1, pq * 8) * (pq < 0.8 ? 0.95 : 0.95 * (1 - pq) / 0.2);
      setAttrs(n.punchSquid, { transform: `translate(${f1(px)} ${f1(py)}) rotate(${f1(angleOf(1, 0))})`, opacity: op.toFixed(2) });
      // 叩く瞬間（0.18〜0.6）に2本の触腕がエギまでサッと伸びて戻る
      const reach = pq < 0.18 ? 0 : pq < 0.3 ? (pq - 0.18) / 0.12 : pq < 0.42 ? 1 : pq < 0.6 ? 1 - (pq - 0.42) / 0.18 : 0;
      animateSquid(n.punchSquid, now, { speed: 1.4, reach });
    } else n.punchSquid.setAttribute('opacity', '0');
    const pp = V.punchAt != null ? (now - V.punchAt) / 0.45 : 9;
    if (pp < 1 && !reduced) {
      setAttrs(n.punchRing, { cx: f1(V.egi.x), cy: f1(V.egi.y + 10), rx: f1(8 + 26 * pp), ry: f1(4 + 10 * pp), opacity: (0.9 * (1 - pp)).toFixed(2) });
      const reach = Math.sin(Math.PI * Math.min(1, pp * 1.6));
      n.punchArms.forEach((arm, i) => {
        const sx = V.egi.x + 58 + i * 4, sy = V.egi.y + 6 + (i - 1) * 8;   // 影の頭（突っ込んだ位置）から
        const ex = V.egi.x + 56 - 50 * reach, ey = V.egi.y + 8 + (i - 1) * 5;
        arm.setAttribute('d', `M${f1(sx)},${f1(sy)} Q${f1((sx + ex) / 2)},${f1(sy - 8 + i * 4)} ${f1(ex)},${f1(ey)}`);
        arm.setAttribute('opacity', (0.8 * reach).toFixed(2));
      });
    } else { n.punchRing.setAttribute('opacity', '0'); n.punchArms.forEach((a) => a.setAttribute('opacity', '0')); }
    // 泡
    n.bubbles.forEach((b, i) => {
      const p = bubbles[i];
      if (!p) { b.setAttribute('opacity', '0'); return; }
      const t = now - p.t0;
      if (t > p.life) { b.setAttribute('opacity', '0'); return; }
      const k = t / p.life;
      setAttrs(b, { cx: f1(p.x + p.vx * t * (1 - k * 0.5) + Math.sin(p.ph + t * 9) * 2), cy: f1(Math.max(S.surface + 4, p.y + p.vy * t - 20 * t * t)), r: f1(p.r * (1 + 0.4 * k)), opacity: (0.9 * (1 - k)).toFixed(2) });
    });
    for (let i = bubbles.length - 1; i >= 0; i--) if (now - bubbles[i].t0 > bubbles[i].life) bubbles.splice(i, 1);

    /* ----- イカの体の動き（第2版の絵）：ひれの波・足の揺れ・胴の脈動。逃げる・ファイト・ジェットの直後は速く ----- */
    if (!reduced) {
      const jet = V.lastJet != null ? Math.max(0, 1 - (now - V.lastJet) / 0.6) : 0;
      const fast = phase === 'fight' ? 1.6 : 1;
      for (const node of [n.hugWater, n.hugAir]) animateSquid(node, now, { speed: fast, jet });
      animateSquid(n.escape, now, { speed: 2.4 });
      for (const node of n.swim) animateSquid(node, now, { speed: 1.1 });
    }
    /* ----- 気配のイカ：フォール中、気になっているほど寄ってくる（しゃくりの最中は距離をとる） ----- */
    const underwater = V.egi.mode === 'water' && !V.hug.on;
    const falling = underwater && ((phase === 'action' && since >= 1) || (phase === 'sinking' && s.depth > 1.2));
    V.swim.forEach((w, i) => {
      const node = n.swim[i];
      let ta = 0, tx = W + 120, ty = Y(5);
      if (underwater && s.method === 'yaen' && phase === 'wait' && s.aji === 'live' && i < Math.max(s.squid, V.chaseAt != null && now - V.chaseAt < YAEN_CHASE ? 1 : 0)) {
        const chaseK = V.chaseAt != null ? clamp((now - V.chaseAt) / YAEN_CHASE, 0, 1) : 0;
        // 活きアジは画面の右寄りを泳ぐので、イカは左下（深いほう）から近づく（右から来ると画面の外にはみ出した）
        const chasing = chaseK > 0 && i === 0;
        const off = chasing ? lerp(170, 14, Math.min(1, chaseK * 1.15)) : 150 + i * 70;
        tx = V.egi.x - off * (chasing ? 0.75 : 0.9) + (reduced ? 0 : Math.sin(now * 0.9 + i * 2) * 14);
        ty = clamp(V.egi.y + off * (chasing ? 0.45 : 0.3) + (chasing ? 0 : [20, -30][i]) + (reduced ? 0 : Math.cos(now * 0.8 + i) * 10), S.surface + 40, Y(s.bottom) - 20);
        ta = chaseK > 0 && i === 0 ? 0.85 : 0.35;
      } else if (underwater && s.interest > 0.2 && i < s.squid) {
        const near = falling ? 1 : 0;
        const off = lerp(150 + i * 70, 62 + i * 46, near);
        tx = V.egi.x + off + (reduced ? 0 : Math.sin(now * 1.3 + i * 2) * 10);
        ty = clamp(V.egi.y + [14, -26][i] + (reduced ? 0 : Math.cos(now * 1.1 + i) * 8), S.surface + 40, Y(s.bottom) - 20);
        ta = clamp(0.25 + 0.6 * s.interest, 0, 0.8) * (falling ? 1 : 0.55);
      }
      w.alpha += (ta - w.alpha) * (1 - Math.exp(-dt * 2.2));
      const follow = V.chaseAt != null && now - V.chaseAt < YAEN_CHASE ? 5 : 1.8;   // 追いかける時は速く
      w.x += (tx - w.x) * (1 - Math.exp(-dt * follow));
      w.y += (ty - w.y) * (1 - Math.exp(-dt * follow));
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
      const g = clamp((now - V.ink.t0) / (V.ink.under ? 2.2 : 2.6), 0, 1);
      const cx = V.ink.under ? V.ink.x + 22 * g : V.ink.x - 30 * g, cy = V.ink.under ? V.ink.y + 10 * g : V.ink.y;
      const rx = V.ink.under ? 14 + 70 * g : 30 + 150 * g, ry = V.ink.under ? 12 + 50 * g : 10 + 34 * g;
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
    if (phase === 'aiming') { powerFill.style.height = `${(s.power * 100).toFixed(0)}%`; powerFill.style.setProperty('--v', powerFill.style.height); }   // 縦のゲージ（下から上へ）。--v は横向き全画面の横のゲージ用
    if (phase === 'fight') {
      tensionFill.style.height = `${clamp(s.tension, 0, 100).toFixed(0)}%`;
      tensionFill.style.setProperty('--v', tensionFill.style.height);
      el.tension.classList.toggle('is-high', s.tension >= 80);
      el.tension.classList.toggle('is-slack', s.tension <= 5);
      setText(el.dist, 'dist', Math.max(0, s.dist).toFixed(0));
    }
    // ヤエン（2026-09-28 ぱっぱ）：イカが沖へ走っている間はドラグ「ジーーーッ」を鳴らし続け、ときどきジェットの「シュワッ」と泡。
    //   鳴りやんだら食べ始めた合図。イカまでの距離は大きく出す（走った分は「+◯m」）
    const yRun = yaenRunning(s);
    // エギング：ジェット噴射で走った直後もドラグが「ジジジッ」と出る（ぱっぱ 2026-09-29）
    const jetRun = phase === 'fight' && V.lastJet != null && now - V.lastJet < 0.45;
    const reeling = phase === 'fight' && Boolean(s.pressing);
    // 2026-10-03 ぱっぱ（感想「巻いている時はドラグを鳴らさないで」も受けて）：ふつうに巻いている間はリールの生音「チリ…チリリ…」。
    //   ジェットの直後と、糸の張りが強い（抵抗がある）時だけ、今までのドラグ「ジーー」
    const resist = reeling && s.tension >= RESIST_TENSION;
    feel.drag(yRun || jetRun || resist);
    // ジェットの「ジー！」の後は抵抗が少し残る：その後に巻いたら「チリリリ」を1回だけ、それからゆっくり「チリ… チリ…」（2026-10-03 ぱっぱ）。
    //   抵抗が残るのはジェットから JET_RESIST 秒まで
    // ヤエン：寄せている間（押していて、イカが抵抗していない時）もリールの「チリ… チリ…」（2026-10-03 ぱっぱ）
    const yDraw = s.method === 'yaen' && phase === 'draw' && Boolean(s.pressing) && Boolean(s.yaen?.on) && !(s.t < (s.yaen.resistUntil ?? -1));
    const reelOn = (reeling && !jetRun && !resist) || yDraw;
    if (V.pullAt != null && V.pullAt !== V.reelJetSeen) { V.reelJetSeen = V.pullAt; V.reelBurst = true; }
    // 名前は reelBurst（2026-10-04）：前は burst としたため、同じ draw() の中の水しぶきの関数 burst() を隠し、タモ・ギャフの取り込みで止まった
    const reelBurst = Boolean(V.reelBurst) && now - V.reelJetSeen < JET_RESIST;
    if (feel.reel(reelOn, { burst: reelBurst })) V.reelBurst = false;
    // BGMは、やり取り（掛けた後）の間だけ下げる（ぱっぱ 2026-09-30：ドラグの出る音などが大事。
    //   アタリの合図やヤエンの走りで下げると、音量の変化でアタリが先に分かってしまうので下げない）
    bgm.duck(phase === 'fight');
    if (yRun && now >= (V.jetNext ?? 0)) {
      V.jetNext = now + 0.9 + Math.random() * 0.8;
      feel.fire('whoosh');
      spawnBubbles(Math.min(V.egi.x, W - 24), V.egi.y, 4, -1);
    }
    const yaenDist = s.method === 'yaen' && Boolean(s.yaen?.on) && ['run', 'draw', 'yaen'].includes(phase);
    el.reel.hidden = !(phase === 'fight' || yaenDist);   // 残りの距離は舞台の右上に（ゲージの下だと指で隠れて見えない）
    el.reel.classList.toggle('is-yaen', yaenDist);
    el.reel.classList.toggle('is-run', yaenDist && yRun);
    el.reel.classList.toggle('is-near', yaenDist && phase === 'draw' && s.dist <= YAEN_DIST);
    setText(el.reelLabel, 'reelLabel', t(lang, yaenDist ? TX.yaen.hud.squid : TX.hud.dist));
    if (yaenDist) {
      setText(el.dist, 'dist', Math.max(0, s.dist).toFixed(0));
      const ran = Math.floor(s.dist - (s.yaen.dist0 ?? s.dist));
      const showRan = ran >= 1 && (yRun || now - (V.eatAt ?? -99) < 4);
      el.reelDelta.hidden = !showRan;
      if (showRan) setText(el.reelDelta, 'delta', `+${ran}m`);
    } else el.reelDelta.hidden = true;
    const inWater = ['sinking', 'action', 'signal', 'wait', 'run', 'draw', 'yaen', 'tailor'].includes(phase) && !V.cast;
    el.count.hidden = !inWater;
    if (inWater) {
      const onBottom = s.depth >= s.bottom;
      const label = phase === 'sinking' ? t(lang, TX.hud.count) : s.method === 'jado' ? t(lang, TX.bait.stopFor) : t(lang, TX.hud.fall);   // 邪道：底で止めている秒数
      if (s.method === 'tailor') {
        setText(el.countLabel, 'label', t(lang, TX.tailor.watch));
        setText(el.countNum, 'count', String(Math.max(0, Math.floor(s.t - (s.watchFrom ?? s.t)))));
        setText(el.depth, 'depth', TX.tailor.tana(lang, t(lang, TX.tailor.tanas[s.tana])));
        el.count.classList.toggle('is-bottom', false);
        el.windnote.hidden = true;
      } else if (s.method === 'yaen' && phase !== 'sinking') {
        const bit = s.yaen?.at != null && phase !== 'wait';
        setText(el.countLabel, 'label', t(lang, bit ? TX.yaen.hud.since : TX.yaen.hud.wait));
        setText(el.countNum, 'count', String(Math.max(0, Math.floor(s.t - (bit ? s.yaen.at : s.yaen?.waitFrom ?? s.t)))));
        setText(el.depth, 'depth', phase === 'yaen' ? TX.yaen.yaenPos(lang, Math.floor(s.yaen.yaenPos), Math.round(s.dist)) : phase === 'run' || phase === 'draw' ? (s.dist <= YAEN_DIST && phase === 'draw' ? t(lang, '◎ ヤエンを入れられる', '◎ Yaen ready') : '') : `${t(lang, TX.hud.dist)} ${Math.round(s.dist)}m`);   // 抱いてからの距離は右上の大きな数字へ
        el.count.classList.toggle('is-bottom', true);
        el.windnote.hidden = true;
      } else {
      setText(el.countLabel, 'label', label);
      setText(el.countNum, 'count', String(Math.max(0, Math.floor(phase === 'sinking' ? s.t - castAt : since))));
      setText(el.depth, 'depth', onBottom ? `${t(lang, TX.hud.bottom)}！` : `${t(lang, TX.hud.depth)} ${t(lang, '約', '~')}${s.bottom}m`);
      el.count.classList.toggle('is-bottom', onBottom);
      el.windnote.hidden = !(s.windows.good < SIGNAL_GOOD - 0.01 && phase !== 'signal');
      }
      el.count.classList.toggle('is-warn', onBottom && s.bottomFor > 1.2);
    }
    el.btn.classList.toggle('is-signal', phase === 'signal' && cue() === 'easy');
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
  // はじめての人（釣行0回）は🔰初心者練習から（ぱっぱ 9/27）。今日の萩の海のデータが届いても切り替えない
  if ((rec.sessions ?? 0) === 0 && !demo && el.playBeginner) {
    el.beginnerHint.hidden = false;
    el.playBeginner.classList.add('is-first');
    useBeginner();
  }
  el.btn.disabled = false;
  let liveDone = false;
  if (demo) runDemo(demo);
  if (!liveDone) loadHagiSea({ lang }).then(renderLive).catch(failLive);
  start();

  return {
    get state() { return s; },
    press: doPress, release: doRelease,
    settings, newGame,
    // 開発時だけ：トレーラー撮影から「出来事→見た目」を呼ぶ口（ikabu-research/trailer）。本番ビルドには入らない
    ...(import.meta.env.DEV ? { fire: (evs) => onEvents(evs) } : {}),
  };
}

// 2次ベジェ曲線 P0→(制御点 C)→P1 が y=Y と交わる点の x（竿先から近い方）。交わらなければ直線で近似
function quadCrossX(p0, c, p1, Y) {
  const a = p0.y - 2 * c.y + p1.y, b = 2 * (c.y - p0.y), k = p0.y - Y;
  let tt = null;
  if (Math.abs(a) < 1e-6) tt = Math.abs(b) < 1e-9 ? null : -k / b;
  else {
    const D = b * b - 4 * a * k;
    if (D >= 0) {
      const r = Math.sqrt(D);
      tt = [(-b - r) / (2 * a), (-b + r) / (2 * a)].filter((v) => v >= 0 && v <= 1).sort((x, y) => x - y)[0] ?? null;
    }
  }
  if (tt == null) return p0.x + (p1.x - p0.x) * ((Y - p0.y) / (p1.y - p0.y));
  const u = 1 - tt;
  return u * u * p0.x + 2 * u * tt * c.x + tt * tt * p1.x;
}

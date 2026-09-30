// イカ部ガチャ（フル画面・縦長）の本体。2026-09-30。
//   流れ：入口（ロゴ・🎫・1枚引く／10連）→ 夜の堤防で「投げる」を長押し→はなす → 着水 → 沈む（予感の演出）→ 「？」
//        → 「フッキング」→ 駆け引き（竿がしなる・ドラグ音・揺れ）→ 「乗った！」→ ホワイトアウト → 結果（レア度ごとの見せ方）
//   決まり：結果は先に引く（gacha.js の pull）。台本は gacha-show.js の planShow が結果を見て組む。ここは「見せる」だけ
//   素材：assets/ikabu/gacha/（GPTで描いたロゴ・ボタン・金の墨・虹の墨）、cards/、gacha_result_bg.webp、zukan/（泳ぐイカ）、hero-layers/squid.png（釣り人）
//   音：gacha-audio.js（Audiostock の効果音 6つ・BGM 2曲）。最初はオン、右上で消せる
import { t, esc, pageHref, assetHref } from '../i18n.js';
import { readTickets, writeTickets, spend } from './tickets.js';
import { readCards, writeCards, pull, emptyCards, RATES, PITY_SR, PITY_UR, COST_SINGLE, COST_TEN, pickCard } from './gacha.js';
import CARDS from './cards-data.json';
import { planShow, tierOf, summarize, FIGHT_TEXT } from './gacha-show.js';
import { createGachaAudio } from './gacha-audio.js';
import { readJSON, writeJSON } from './records.js';
import { utcDay } from './rng.js';
import { IS_TRIAL } from '../views/trial-notice.js';
import { swimmingSquid, animateSquid } from '../squid-art2.js';   // 泳ぐイカはエギングと同じ絵（2026-09-30 ぱっぱ）
import { speciesColors } from '../squid-art.js';

/* ---------- 舞台の座標（viewBox 900×1600。画面には slice で敷く） ---------- */
const S = {
  W: 900, H: 1600, surf: 600, pierR: 250, pierTop: 560,
  lamp: { x: 120, y: 230 },
  squid: { x: 40, y: 375, w: 166, h: 185 },        // hero-layers/squid.png（888×991、竿の握りが右下）
  grip: { x: 182, y: 498 },                         // 握り（squid の箱の 85%・66%）
  rod: { len: 230, rest: 40, back: 118 },           // 長さ・休みの角度・振りかぶりの角度（右上向きの度）
  egiRest: { x: 400, y: 668 },
  land: { min: 430, max: 660 },   // 画面は横が切れる（幅375なら x 80〜820 が見える）ので右端に寄せすぎない
  sinkTo: 1250,
  fishBox: { x0: 360, x1: 860, y0: 760, y1: 1420 },
};
const FISH = ['aori', 'kensaki', 'yari', 'kouika'];   // 泳ぐイカ（エギングの泳ぐモデル。2026-09-30 ぱっぱ：図鑑の絵は浮く）
const f1 = (v) => (Math.round(v * 10) / 10).toString();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = (x) => 1 - Math.pow(1 - x, 3);
const KEY_SOUND = 'ikabu.gacha.sound';
const KEY_LASTDAY = 'ikabu.gacha.lastDay';

/* ---------- 文言 ---------- */
const TX = {
  back: ['← あそび場TOPへ', '← Back to TOP'],
  one: ['1枚引く', 'Pull 1'], ten: ['10連', 'Pull 10'],
  cost1: ['🎫 1', '🎫 1'], cost10: ['🎫 10', '🎫 10'],
  rates: ['確率と天井', 'Rates & pity'],
  noTickets: ['🎫が足りません。遊んでためよう', 'Not enough 🎫. Play to earn more'],
  castHint: ['長押しして、はなす', 'Hold, then release'],
  hookHint: ['今だ！', 'Now!'],
  q: ['？', '?'],
  landed: ['乗った！', 'Hooked!'],
  jiai: ['時合いだ…！', 'The bite is on…!'],
  lamp: ['常夜灯に群れが…！', 'A school under the lamp…!'],
  nabura: ['ナブラだ！', 'A feeding frenzy!'],
  goldInk: ['金の墨…！？', 'Golden ink…!?'],
  rainbow: ['虹だ！！', 'A rainbow!!'],
  boss: ['今日はイケる気がする', 'I have a good feeling today'],
  bara: ['バラシ…？', 'Lost it…?'],
  still: ['まだ付いてる！', "It's still on!"],
  again1: ['もう一度（🎫1）', 'Again (🎫1)'], again10: ['10連（🎫10）', 'Pull 10 (🎫10)'],
  binder: ['バインダー', 'Binder'], top: ['TOPへ', 'TOP'],
  skip: ['スキップ', 'Skip'],
  fresh: ['NEW', 'NEW'],
  shards: (lang, n) => (lang === 'en' ? `+${n} ink shards (duplicate)` : `墨のかけら +${n}（ダブり）`),
  sumTen: (lang, s) => (lang === 'en' ? `${s.fresh} new · +${s.shards} shards` : `NEW ${s.fresh}枚 ・ かけら +${s.shards}`),
  pity: (lang, sr, ur) => (lang === 'en' ? `SR+ guaranteed in ${sr} · UR in ${ur}` : `SR以上まであと ${sr} 回 ・ URまであと ${ur} 回`),
  demo: ['デモ（記録しません）', 'Demo (not saved)'],
  sound: ['音', 'Sound'],
  trial: ['🧪 テストプレイ版：カードと🎫は正式版でリセットされます', '🧪 Test play: cards and 🎫 reset at launch'],
};

/* ---------- 舞台の SVG ---------- */
function sceneSVG(lang) {
  const stars = [0.08, 0.2, 0.33, 0.47, 0.58, 0.7, 0.82, 0.93, 0.15, 0.4, 0.62, 0.88].map((k, i) => `<circle cx="${f1(S.W * k)}" cy="${f1(40 + ((i * 53) % 260))}" r="${1.4 + (i % 3) * 0.6}" fill="#fff" opacity="${0.55 + (i % 4) * 0.1}" class="ika-gc-star" style="--d:${(i * 0.7) % 3}s" />`).join('');
  const fish = FISH.map((id, i) => `<g class="ika-gc-fish" data-fish="${i}"></g>`).join('');   // 中身は mount 時に squid-art2 で描く
  return `<svg class="ika-gc-scene" viewBox="0 0 ${S.W} ${S.H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${t(lang, '夜の堤防。エギを投げてイカカードを引く', 'A breakwater at night. Cast to pull a squid card')}" focusable="false">
  <defs>
    <linearGradient id="gc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020814" /><stop offset="0.7" stop-color="#071a33" /><stop offset="1" stop-color="#123a5a" /></linearGradient>
    <linearGradient id="gc-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e4a5c" /><stop offset="0.35" stop-color="#062a38" /><stop offset="1" stop-color="#020f16" /></linearGradient>
    <linearGradient id="gc-pier" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d2c0" /><stop offset="0.055" stop-color="#c4bcab" /><stop offset="0.057" stop-color="#4a5a60" /><stop offset="1" stop-color="#1c2a30" /></linearGradient>
    <radialGradient id="gc-lamp"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.7" /><stop offset="1" stop-color="#ffe9a8" stop-opacity="0" /></radialGradient>
    <radialGradient id="gc-moon"><stop offset="0" stop-color="#fff6d6" /><stop offset="0.8" stop-color="#ffe9a8" /><stop offset="1" stop-color="#ffe9a8" stop-opacity="0" /></radialGradient>
    <filter id="gc-blur"><feGaussianBlur stdDeviation="6" /></filter>
    <radialGradient id="gc-inkfade"><stop offset="0.45" stop-color="#fff" /><stop offset="0.95" stop-color="#000" /></radialGradient>
    <mask id="gc-inkmask" maskContentUnits="objectBoundingBox"><ellipse cx="0.5" cy="0.5" rx="0.5" ry="0.5" fill="url(#gc-inkfade)" /></mask>
  </defs>
  <rect x="0" y="0" width="${S.W}" height="${S.surf}" fill="url(#gc-sky)" />
  ${stars}
  <g class="ika-gc-moon"><circle cx="720" cy="150" r="30" fill="url(#gc-moon)" /><circle cx="720" cy="150" r="70" fill="url(#gc-moon)" opacity="0.18" /></g>
  <path d="M${S.pierR - 40},${S.surf} Q400,${S.surf - 60} 560,${S.surf - 28} Q700,${S.surf - 76} ${S.W},${S.surf - 36} L${S.W},${S.surf} Z" fill="#061426" />
  <rect x="0" y="${S.surf}" width="${S.W}" height="${S.H - S.surf}" fill="url(#gc-sea)" />
  <ellipse cx="560" cy="${S.surf + 12}" rx="220" ry="14" fill="#ffe9a8" class="ika-gc-lampsea" filter="url(#gc-blur)" />
  <g class="ika-gc-shimmer">${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="${520 + i * 60}" cy="${S.surf + 40 + i * 34}" rx="${44 - i * 5}" ry="4" fill="#ffffff" opacity="0.1" />`).join('')}</g>
  <path d="M0,1480 Q150,1450 300,1490 T600,1475 T900,1500 L900,1600 L0,1600 Z" fill="#0b1f2a" />
  ${[40, 130, 640, 760, 850].map((x, i) => `<path d="M${x},1500 q${8 + i * 2},-70 ${18},-118 q6,60 ${18},118 Z" fill="#0e3a3a" opacity="0.8" />`).join('')}
  <g class="ika-gc-under">${fish}</g>
  <g class="ika-gc-ripples">${[0, 1, 2, 3, 4, 5].map(() => `<ellipse class="ika-gc-ripple" cx="0" cy="${S.surf}" rx="0" ry="0" fill="none" stroke="#fff" stroke-width="3" opacity="0" />`).join('')}</g>
  <g class="ika-gc-inkg" transform="translate(600 900)"><image class="ika-gc-inkimg" href="" x="-330" y="-220" width="660" height="440" opacity="0" mask="url(#gc-inkmask)" /></g>
  <path class="ika-gc-wave" d="M${S.pierR},${S.surf} L${S.W},${S.surf}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="3" stroke-linecap="round" />
  <rect x="0" y="${S.pierTop}" width="${S.pierR}" height="${S.H - S.pierTop}" fill="url(#gc-pier)" />
  <rect x="0" y="${S.pierTop}" width="${S.pierR}" height="8" fill="#ece5d3" />
  <rect x="${S.pierR - 6}" y="${S.pierTop}" width="6" height="${S.H - S.pierTop}" fill="#0f1c22" opacity="0.7" />
  <g class="ika-gc-lampg"><rect x="${S.lamp.x - 4}" y="${S.lamp.y}" width="8" height="${S.pierTop - S.lamp.y}" fill="#1a2a3a" /><rect x="${S.lamp.x - 22}" y="${S.lamp.y - 14}" width="44" height="14" rx="4" fill="#26384a" /><circle class="ika-gc-lampbulb" cx="${S.lamp.x}" cy="${S.lamp.y - 6}" r="11" fill="#ffe9a8" /><circle class="ika-gc-lampglow" cx="${S.lamp.x}" cy="${S.lamp.y - 6}" r="120" fill="url(#gc-lamp)" /></g>
  <image class="ika-gc-angler" href="${assetHref('/assets/ikabu/hero-layers/squid.png')}" x="${S.squid.x}" y="${S.squid.y}" width="${S.squid.w}" height="${S.squid.h}" preserveAspectRatio="none" />
  <path class="ika-gc-rod-o" d="" fill="none" stroke="#16233a" stroke-width="13" stroke-linecap="round" />
  <path class="ika-gc-rod" d="" fill="none" stroke="#f4ead8" stroke-width="7" stroke-linecap="round" />
  <path class="ika-gc-line" d="" fill="none" stroke="#fff8e6" stroke-width="2.4" stroke-linecap="round" opacity="0.95" />
  <g class="ika-gc-egi"><path d="M-18,0 q6,-9 18,-9 q14,0 20,9 q-6,9 -20,9 q-12,0 -18,-9 Z" fill="#ff7a3a" stroke="#16233a" stroke-width="2" /><path d="M-8,-8 l3,16 M0,-9 l2,18 M8,-8 l1,16" stroke="#ffd9a8" stroke-width="2" opacity="0.9" /><circle cx="12" cy="-2" r="2.6" fill="#16233a" /><path d="M-18,0 q-8,4 -12,12 M-18,0 q-8,-4 -12,-12" fill="none" stroke="#dfe6ea" stroke-width="2" /></g>
  <g class="ika-gc-splash">${[0, 1, 2, 3, 4, 5, 6, 7].map(() => `<circle r="5" fill="#fff" opacity="0" />`).join('')}</g>
</svg>`;
}

/* ---------- 画面の HTML ---------- */
function pageHTML(lang, { demo }) {
  const A = (p) => assetHref(p);
  const rates = Object.entries(RATES).map(([r, v]) => `<li><b data-rarity="${r}">${r}</b><span>${(v * 100).toFixed(1).replace(/\.0$/, '')}%</span></li>`).join('');
  return `
  <div class="ika-gc" data-phase="lobby">
    <div class="ika-gc-stage">
      ${sceneSVG(lang)}
      <div class="ika-gc-jiai" aria-hidden="true"></div>
      <div class="ika-gc-top">
        <a class="ika-gc-back" href="${pageHref('games', lang)}">${t(lang, ...TX.back)}</a>
        <span class="ika-gc-tickets" aria-live="polite">🎫 <b data-gc-tickets>0</b></span>
        <button type="button" class="ika-gc-sound" data-gc-sound aria-pressed="true" aria-label="${t(lang, ...TX.sound)}">🔊</button>
      </div>
      <div class="ika-gc-lobby">
        <img class="ika-gc-logo" src="${A('/assets/ikabu/gacha/logo.webp')}" alt="${t(lang, 'イカ部ガチャ', 'Squid Gacha')}" width="900" height="506" decoding="async" />
        ${demo ? `<p class="ika-gc-demo">${t(lang, ...TX.demo)}：${esc(demo)}</p>` : ''}
        ${IS_TRIAL ? `<p class="ika-gc-trial">${t(lang, ...TX.trial)}</p>` : ''}
        <div class="ika-gc-pulls">
          <button type="button" class="ika-gc-imgbtn" data-gc-pull="1"><img src="${A('/assets/ikabu/gacha/btn_one.webp')}" alt="${t(lang, ...TX.one)}" width="1120" height="201" /><span>${t(lang, ...TX.cost1)}</span></button>
          <button type="button" class="ika-gc-imgbtn" data-gc-pull="10"><img src="${A('/assets/ikabu/gacha/btn_ten.webp')}" alt="${t(lang, ...TX.ten)}" width="1120" height="201" /><span>${t(lang, ...TX.cost10)}</span></button>
        </div>
        <p class="ika-gc-pity" data-gc-pity></p>
        <button type="button" class="ika-gc-link" data-gc-rates>${t(lang, ...TX.rates)}</button>
      </div>
      <div class="ika-gc-play">
        <p class="ika-gc-hint" data-gc-hint></p>
        <button type="button" class="ika-gc-imgbtn ika-gc-cast" data-gc-cast><img src="${A('/assets/ikabu/gacha/btn_cast.webp')}" alt="${t(lang, '投げる', 'Cast')}" width="1120" height="202" draggable="false" /><i class="ika-gc-charge"><b></b></i></button>
        <button type="button" class="ika-gc-imgbtn ika-gc-hook" data-gc-hook hidden><img src="${A('/assets/ikabu/gacha/btn_hook.webp')}" alt="${t(lang, 'フッキング', 'Hook')}" width="1120" height="200" draggable="false" /></button>
        <div class="ika-gc-tension" data-gc-tension hidden><i></i></div>
      </div>
      <div class="ika-gc-callout" data-gc-callout aria-live="assertive"></div>
      <div class="ika-gc-boss" data-gc-boss aria-hidden="true"><img src="${A('/assets/ikabu/mascot/point.webp')}" alt="" width="433" height="480" /><span>${t(lang, ...TX.boss)}</span></div>
      <div class="ika-gc-white" aria-hidden="true"></div>
      <div class="ika-gc-result" data-gc-result hidden style="background-image:url('${A('/assets/ikabu/gacha_result_bg.webp')}')">
        <div class="ika-gc-dark"></div>
        <img class="ika-gc-bolts" src="${A('/assets/ikabu/gacha/lightning.webp')}" alt="" width="800" height="1200" decoding="async" />
        <img class="ika-gc-rink" data-kind="gold" src="${A('/assets/ikabu/gacha/ink_gold.webp')}" alt="" width="1200" height="800" decoding="async" />
        <img class="ika-gc-rink" data-kind="rainbow" src="${A('/assets/ikabu/gacha/ink_rainbow.webp')}" alt="" width="1200" height="800" decoding="async" />
        <canvas class="ika-gc-particles" width="450" height="800" aria-hidden="true"></canvas>
        <div class="ika-gc-cardwrap" data-gc-cardwrap></div>
        <div class="ika-gc-banner" data-gc-banner aria-live="polite"></div>
        <div class="ika-gc-meta" data-gc-meta></div>
        <div class="ika-gc-grid" data-gc-grid hidden></div>
        <button type="button" class="ika-gc-imgbtn ika-gc-skip" data-gc-skip hidden><img src="${A('/assets/ikabu/gacha/btn_skip.webp')}" alt="${t(lang, ...TX.skip)}" width="1120" height="201" /></button>
        <div class="ika-gc-after" data-gc-after hidden>
          <button type="button" class="ika-gc-imgbtn" data-gc-again="1"><img src="${A('/assets/ikabu/gacha/btn_again.webp')}" alt="${t(lang, ...TX.again1)}" width="1120" height="201" /><span>${t(lang, ...TX.cost1)}</span></button>
          <button type="button" class="ika-gc-imgbtn" data-gc-again="10"><img src="${A('/assets/ikabu/gacha/btn_ten.webp')}" alt="${t(lang, ...TX.again10)}" width="1120" height="201" /></button>
          <a class="ika-gc-imgbtn" href="${pageHref('cards', lang)}"><img src="${A('/assets/ikabu/gacha/btn_binder.webp')}" alt="${t(lang, ...TX.binder)}" width="1120" height="201" /></a>
          <a class="ika-gc-imgbtn" href="${pageHref('games', lang)}"><img src="${A('/assets/ikabu/gacha/btn_top.webp')}" alt="${t(lang, ...TX.top)}" width="1120" height="201" /></a>
        </div>
      </div>
      <div class="ika-gc-rates" data-gc-ratespanel hidden>
        <h2>${t(lang, ...TX.rates)}</h2>
        <ul>${rates}</ul>
        <p>${t(lang, `10連は R以上が1枚確定。SR以上が ${PITY_SR} 回出なければ次は SR以上確定。UR は ${PITY_UR} 回で確定。ダブりは「墨のかけら」になり、バインダーで交換できます（準備中）。`, `Pull 10 guarantees at least one R. SR+ guaranteed after ${PITY_SR} pulls without one; UR guaranteed at ${PITY_UR}. Duplicates become ink shards for the binder (coming soon).`)}</p>
        <button type="button" class="ika-btn" data-gc-ratesclose>${t(lang, '閉じる', 'Close')}</button>
      </div>
      <p class="ika-gc-msg" data-gc-msg role="status"></p>
    </div>
  </div>`;
}

/* ---------- 本体 ---------- */
export function mountGachaPage(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const devOk = import.meta.env.DEV || IS_TRIAL;
  const demo = devOk ? new URLSearchParams(location.search).get('demo') : null;
  document.documentElement.classList.add('is-gacha');
  // ページ専用の書体（2026-09-30 ぱっぱ「ゴシックはダサい。明朝やデザイン書体で」）
  if (!document.getElementById('ika-gc-fonts')) {
    const l = document.createElement('link'); l.id = 'ika-gc-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Kaisei+Tokumin:wght@800&family=Shippori+Mincho+B1:wght@700;800&display=swap';
    document.head.appendChild(l);
  }
  root.innerHTML = pageHTML(lang, { demo });

  const $ = (sel) => root.querySelector(sel);
  const el = {
    gc: $('.ika-gc'), stage: $('.ika-gc-stage'), svg: $('.ika-gc-scene'),
    tickets: $('[data-gc-tickets]'), sound: $('[data-gc-sound]'), pity: $('[data-gc-pity]'), msg: $('[data-gc-msg]'),
    hint: $('[data-gc-hint]'), cast: $('[data-gc-cast]'), charge: $('.ika-gc-charge b'), hook: $('[data-gc-hook]'), tension: $('[data-gc-tension]'),
    callout: $('[data-gc-callout]'), boss: $('[data-gc-boss]'), white: $('.ika-gc-white'),
    result: $('[data-gc-result]'), cardwrap: $('[data-gc-cardwrap]'), banner: $('[data-gc-banner]'), meta: $('[data-gc-meta]'), grid: $('[data-gc-grid]'), skip: $('[data-gc-skip]'), after: $('[data-gc-after]'),
    inkGold: $('.ika-gc-rink[data-kind=gold]'), inkRainbow: $('.ika-gc-rink[data-kind=rainbow]'), canvas: $('.ika-gc-particles'),
    ratesPanel: $('[data-gc-ratespanel]'),
  };
  const sc = {
    rodO: $('.ika-gc-rod-o'), rod: $('.ika-gc-rod'), line: $('.ika-gc-line'), egi: $('.ika-gc-egi'),
    fish: [...root.querySelectorAll('.ika-gc-fish')], ripples: [...root.querySelectorAll('.ika-gc-ripple')], splash: [...root.querySelectorAll('.ika-gc-splash circle')],
    inkg: $('.ika-gc-inkg'), inkimg: $('.ika-gc-inkimg'), lampg: $('.ika-gc-lampg'),
  };

  for (let i = 0; i < FISH.length; i++) sc.fish[i].append(swimmingSquid({ species: FISH[i], len: 62 + i * 10, colors: speciesColors(FISH[i]) }));
  const audio = createGachaAudio({ on: readJSON(KEY_SOUND) ?? true, href: assetHref });
  el.sound.setAttribute('aria-pressed', String(audio.on));
  el.sound.textContent = audio.on ? '🔊' : '🔇';
  el.sound.addEventListener('click', () => {
    audio.setOn(!audio.on); writeJSON(KEY_SOUND, audio.on);
    el.sound.setAttribute('aria-pressed', String(audio.on)); el.sound.textContent = audio.on ? '🔊' : '🔇';
    if (audio.on) { audio.unlock(); audio.bgm(phase === 'lobby' ? 'lobby' : 'rise'); }
  });

  /* ----- 入口の表示 ----- */
  let phase = 'lobby';
  const setPhase = (p) => { phase = p; el.gc.dataset.phase = p; if (devOk) (window.__gcLog ??= []).push([p, Math.round(performance.now())]); };
  function renderLobby() {
    const rec = readCards();
    el.tickets.textContent = String(readTickets().n);
    el.pity.textContent = TX.pity(lang, Math.max(1, PITY_SR - rec.sinceSR), Math.max(1, PITY_UR - rec.sinceUR));
  }
  renderLobby();
  addEventListener('ikabu:tickets', renderLobby);
  addEventListener('storage', renderLobby);
  $('[data-gc-rates]').addEventListener('click', () => { el.ratesPanel.hidden = false; });
  $('[data-gc-ratesclose]').addEventListener('click', () => { el.ratesPanel.hidden = true; });
  let msgTimer = 0;
  const say = (text) => { el.msg.textContent = text; el.msg.classList.add('is-on'); clearTimeout(msgTimer); msgTimer = setTimeout(() => el.msg.classList.remove('is-on'), 2400); };

  /* ----- 舞台の動き（毎フレーム） ----- */
  const V = {
    rodAng: S.rod.rest, rodPull: 0, rodLag: 0,
    egi: { x: S.egiRest.x, y: S.egiRest.y, mode: 'rest' },   // rest | fly | sink | hooked
    flight: null, jig: 0, shake: 0, hooked: null, chargeT: 0, charging: false,
    fish: FISH.map((_, i) => ({ x: S.fishBox.x0 + 90 + i * 130, y: S.fishBox.y0 + 120 + i * 150, dir: i % 2 ? 1 : -1, speed: 0.35 + i * 0.08, ph: i * 1.7, mode: 'swim', tx: 0, ty: 0 })),
  };
  function rodGeom() {
    const a = (V.rodAng * Math.PI) / 180;
    const tip0 = { x: S.grip.x + Math.cos(a) * S.rod.len, y: S.grip.y - Math.sin(a) * S.rod.len };
    let tip = tip0;
    if (V.rodPull > 0) tip = { x: tip0.x + (V.egi.x - tip0.x) * 0.3 * V.rodPull, y: tip0.y + (V.egi.y - tip0.y) * 0.3 * V.rodPull };
    const ab = ((V.rodAng + V.rodLag * 0.3) * Math.PI) / 180;
    const bend = { x: S.grip.x + Math.cos(ab) * S.rod.len * 0.52 + (tip.x - tip0.x) * 0.15, y: S.grip.y - Math.sin(ab) * S.rod.len * 0.52 + (tip.y - tip0.y) * 0.15 };
    return { tip, bend };
  }
  let last = 0;
  function tick(now) { requestAnimationFrame(tick); if (!document.hidden) frame(now); }
  if (devOk) window.__gcFrame = () => frame(performance.now());   // 開発時：裏に回っている画面でも1コマ進める（確認用）
  function frame(now) {
    const dt = Math.min(50, now - (last || now)); last = now;
    // 竿：振りかぶり中はゆっくり後ろへ
    if (V.charging) V.rodAng = Math.min(S.rod.back, V.rodAng + dt * 0.09);
    const { tip, bend } = rodGeom();
    if (V.egi.mode === 'rest') { V.egi.x = tip.x + 6; V.egi.y = tip.y + 95; }   // 投げる前：竿先からぶら下がる（振りかぶりに合わせて動く）
    const rodD = `M${f1(S.grip.x)},${f1(S.grip.y)} Q${f1(bend.x)},${f1(bend.y)} ${f1(tip.x)},${f1(tip.y)}`;
    sc.rodO.setAttribute('d', rodD); sc.rod.setAttribute('d', rodD);
    // エギ
    if (V.flight) {
      const k = clamp((now - V.flight.t0) / V.flight.dur, 0, 1);
      V.egi.x = V.flight.x0 + (V.flight.x1 - V.flight.x0) * k;
      V.egi.y = V.flight.y0 + (V.flight.y1 - V.flight.y0) * k - Math.sin(Math.PI * k) * 300;
      if (k >= 1) { V.flight = null; V.egi.mode = 'sink'; }
    } else if (V.egi.mode === 'sink' && V.sink) {
      const k = ease(clamp((now - V.sink.t0) / V.sink.dur, 0, 1));
      V.egi.y = V.sink.y0 + (V.sink.y1 - V.sink.y0) * k;
      V.egi.x = V.sink.x0 - 30 * k;
    }
    const jx = V.jig ? Math.sin(now / 40) * 8 * V.jig : 0;
    const jy = V.jig ? Math.cos(now / 55) * 6 * V.jig : 0;
    const rot = V.egi.mode === 'fly' ? -20 : V.egi.mode === 'sink' ? 25 : V.egi.mode === 'rest' ? 80 : 0;   // ぶら下がりは頭を上に
    sc.egi.setAttribute('transform', `translate(${f1(V.egi.x + jx)} ${f1(V.egi.y + jy)}) rotate(${rot})`);
    // 糸：竿先 → エギ
    const L = Math.hypot(V.egi.x - tip.x, V.egi.y - tip.y);
    const sag = V.rodPull > 0 || V.flight || V.egi.mode === 'rest' ? 0 : L * 0.12;
    sc.line.setAttribute('d', `M${f1(tip.x)},${f1(tip.y)} Q${f1((tip.x + V.egi.x) / 2)},${f1((tip.y + V.egi.y) / 2 + sag)} ${f1(V.egi.x + jx)},${f1(V.egi.y + jy)}`);
    // 泳ぐイカ
    for (let i = 0; i < V.fish.length; i++) {
      const f = V.fish[i];
      if (f.mode === 'swim') {
        f.x += f.dir * f.speed * dt * 0.06; f.y += Math.sin(now / 900 + f.ph) * 0.12 * dt * 0.06;
        if (f.x < S.fishBox.x0) f.dir = 1; if (f.x > S.fishBox.x1) f.dir = -1;
      } else if (f.mode === 'to') {   // 目標へ寄る（エギに近づく／逃げる）
        f.x += (f.tx - f.x) * f.k * dt * 0.06; f.y += (f.ty - f.y) * f.k * dt * 0.06;
        f.dir = f.tx > f.x ? 1 : -1;
      } else if (f.mode === 'hooked') {   // 掛かった：エギのそばで暴れる
        f.x = V.egi.x + 34 + jx + Math.sin(now / 70) * 10; f.y = V.egi.y + 6 + jy; f.dir = -1;
      }
      const sway = Math.sin(now / 500 + f.ph) * 6;
      sc.fish[i].setAttribute('transform', `translate(${f1(f.x)} ${f1(f.y)}) rotate(${f1((f.dir === 1 ? 90 : -90) + sway)})`);
      if (sc.fish[i].firstChild) animateSquid(sc.fish[i].firstChild, now / 1000, { speed: f.mode === 'hooked' ? 2.2 : 1, jet: f.mode === 'to' ? 0.6 : 0 });
    }
    if (V.shake) el.stage.style.transform = `translate(${(Math.random() - 0.5) * V.shake}px, ${(Math.random() - 0.5) * V.shake}px)`;
    else if (el.stage.style.transform) el.stage.style.transform = '';
  }
  requestAnimationFrame(tick);

  /* ----- 舞台の小さな演出 ----- */
  function ripple(x, big = false) {
    const r = sc.ripples.find((e) => !e.dataset.on) ?? sc.ripples[0];
    r.dataset.on = '1'; r.setAttribute('cx', f1(x)); r.style.setProperty('--rx', big ? '120' : '60');
    r.classList.remove('is-on'); void r.getBBox(); r.classList.add('is-on');
    setTimeout(() => { r.classList.remove('is-on'); delete r.dataset.on; }, 1200);
  }
  function splash(x) {
    sc.splash.forEach((c, i) => {
      c.setAttribute('cx', f1(x + (i - 3.5) * 8)); c.setAttribute('cy', f1(S.surf)); c.style.setProperty('--dx', `${(i - 3.5) * 14}px`); c.style.setProperty('--dy', `${-60 - (i % 3) * 30}px`);
      c.classList.remove('is-on'); void c.getBBox(); c.classList.add('is-on');
    });
    setTimeout(() => sc.splash.forEach((c) => c.classList.remove('is-on')), 900);
  }
  let calloutTimer = 0;
  // key があれば絵（assets/ikabu/gacha/co_<key>.webp）、無ければ文字。英語は文字のまま
  function callout(text, kind = '', ms = 1400, key = null) {
    if (key && lang === 'ja') el.callout.innerHTML = `<img src="${assetHref(`/assets/ikabu/gacha/co_${key}.webp`)}" alt="${esc(text)}" decoding="async" />`;
    else el.callout.textContent = text;
    el.callout.className = `ika-gc-callout is-on ${kind}${key ? ' is-img' : ''}`;
    clearTimeout(calloutTimer); calloutTimer = setTimeout(() => el.callout.classList.remove('is-on'), ms);
  }
  function scatterFish() { for (const f of V.fish) { f.mode = 'to'; f.tx = f.x < 600 ? S.fishBox.x0 + 20 : S.fishBox.x1 - 20; f.ty = clamp(f.y + 160, S.fishBox.y0, S.fishBox.y1); f.k = 0.06; } setTimeout(() => { for (const f of V.fish) if (f.mode === 'to') f.mode = 'swim'; }, 1400); }
  function approachFish(i) { const f = V.fish[i]; f.mode = 'to'; f.k = 0.012; f.tx = V.egi.x + 60; f.ty = V.egi.y + 10; }
  function sceneInk(kind) {
    sc.inkg.setAttribute('transform', `translate(${f1(V.egi.x)} ${f1(V.egi.y)})`);
    sc.inkimg.setAttribute('href', assetHref(`/assets/ikabu/gacha/ink_${kind}.webp`));
    sc.inkimg.classList.remove('is-on'); void sc.inkimg.getBBox(); sc.inkimg.classList.add('is-on');
  }

  /* ----- 投げる：長押し→はなす ----- */
  let castResolve = null;
  function armCast() {
    return new Promise((resolve) => { castResolve = resolve; });
  }
  let chargeT0 = 0, chargeRaf = 0, autoRelease = 0;
  function chargeStart(e) {
    if (phase !== 'cast' || V.charging) return;
    e.preventDefault?.();
    V.charging = true; chargeT0 = performance.now(); audio.unlock();
    const loop = () => { if (!V.charging) return; el.charge.style.width = `${clamp((performance.now() - chargeT0) / 900, 0, 1) * 100}%`; chargeRaf = requestAnimationFrame(loop); };
    loop();
    autoRelease = setTimeout(chargeEnd, 1600);
  }
  function chargeEnd() {
    if (!V.charging) return;
    V.charging = false; cancelAnimationFrame(chargeRaf); clearTimeout(autoRelease);
    const power = clamp((performance.now() - chargeT0) / 900, 0.3, 1);
    el.charge.style.width = '0%';
    castResolve?.(power); castResolve = null;
  }
  el.cast.addEventListener('pointerdown', chargeStart);
  el.cast.addEventListener('pointerup', chargeEnd);
  el.cast.addEventListener('pointercancel', chargeEnd);
  el.cast.addEventListener('pointerleave', chargeEnd);
  el.cast.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); chargeStart(e); } });
  el.cast.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') chargeEnd(); });
  el.cast.addEventListener('contextmenu', (e) => e.preventDefault());

  let hookResolve = null;
  el.hook.addEventListener('click', () => { hookResolve?.(); hookResolve = null; });

  /* ----- 引く ----- */
  async function startPull(n) {
    if (phase !== 'lobby') return;
    audio.unlock();
    let results, isDemo = false;
    if (demo) {
      isDemo = true;
      results = demoResults(demo, n);
    } else {
      const day = utcDay();
      const tk = spend(readTickets(), n === 10 ? COST_TEN : COST_SINGLE, { day });
      if (!tk.ok) { say(t(lang, ...TX.noTickets)); el.gc.classList.add('is-shake-msg'); setTimeout(() => el.gc.classList.remove('is-shake-msg'), 500); return; }
      writeTickets(tk.rec);
      dispatchEvent(new CustomEvent('ikabu:tickets', { detail: { got: 0, why: [] } }));
      const out = pull(readCards(), CARDS, n);
      writeCards(out.rec);
      results = out.results;
      renderLobby();
    }
    const today = utcDay();
    const firstToday = readJSON(KEY_LASTDAY) !== today;
    if (!isDemo) writeJSON(KEY_LASTDAY, today);
    const plan = planShow(results, Math.random, { firstToday, reduced });
    await runShow(results, plan, n);
  }
  root.querySelectorAll('[data-gc-pull]').forEach((b) => b.addEventListener('click', () => startPull(Number(b.dataset.gcPull))));
  root.querySelectorAll('[data-gc-again]').forEach((b) => b.addEventListener('click', () => {
    const need = Number(b.dataset.gcAgain);
    if (!demo && readTickets().n < need) { say(t(lang, ...TX.noTickets)); return; }
    resetToLobby(); startPull(need);
  }));
  function renderAfter() {
    const n = readTickets().n;
    root.querySelectorAll('[data-gc-again]').forEach((b) => b.setAttribute('aria-disabled', String(!demo && n < Number(b.dataset.gcAgain))));
  }

  function demoResults(kind, n) {
    const rnd = Math.random;
    if (kind === 'ten' || kind === 'tenUR' || n === 10) {
      const out = pull(emptyCards(), CARDS, 10, { seed: `demo${Date.now()}` }).results.map((x) => ({ ...x, isNew: true, shards: 0 }));
      if (kind === 'tenUR') out[9] = { card: pickCard(CARDS, 'UR', rnd()), rarity: 'UR', isNew: true, shards: 0, guaranteed: null };
      return out;
    }
    const rarity = ['N', 'R', 'SR', 'SSR', 'UR'].includes(kind) ? kind : 'N';
    return [{ card: pickCard(CARDS, rarity, rnd()), rarity, isNew: true, shards: 0, guaranteed: null }];
  }

  /* ----- 演出の本番 ----- */
  async function runShow(results, plan, n) {
    setPhase('cast');
    audio.preload(['rise', 'splash', 'drag', 'don', 'flip', plan.top === 'SSR' || plan.top === 'UR' ? 'thunder' : 'flip', plan.top === 'UR' ? 'fanfare' : 'flip']);
    el.hint.textContent = t(lang, ...TX.castHint);
    el.hook.hidden = true; el.tension.hidden = true;
    V.egi = { x: S.egiRest.x, y: S.egiRest.y, mode: 'rest' }; V.rodPull = 0; V.rodAng = S.rod.rest; V.hooked = null;
    if (plan.boss && !reduced) { el.boss.classList.add('is-on'); setTimeout(() => el.boss.classList.remove('is-on'), 2600); }

    // 1. 投げる（長押し→はなす）
    const power = await armCast();
    audio.bgm('rise', { xfade: 1.0 });
    el.hint.textContent = '';
    const { tip } = rodGeom();
    V.rodAng = S.rod.rest - 10; V.rodLag = 0;
    const landX = S.land.min + (S.land.max - S.land.min) * power;
    V.egi.mode = 'fly';
    V.flight = { t0: performance.now(), dur: reduced ? 200 : 750, x0: tip.x, y0: tip.y, x1: landX, y1: S.surf };
    if (plan.nabura) setTimeout(() => { callout(t(lang, ...TX.nabura), 'is-warn', 1400, 'nabura'); [landX - 90, landX + 80, landX + 160, landX - 160].forEach((x, i) => setTimeout(() => ripple(x), i * 120)); }, 300);
    await wait(reduced ? 200 : 750);
    // 2. 着水
    audio.se('splash'); splash(landX); ripple(landX, true); scatterFish();
    V.rodAng = S.rod.rest;
    V.sink = { t0: performance.now(), dur: reduced ? 600 : 2300, x0: landX, y0: S.surf, y1: S.sinkTo };
    setPhase('sink');
    // 3. 沈む＝予感の演出
    if (plan.jiai) setTimeout(() => { el.gc.classList.add('is-jiai'); callout(t(lang, ...TX.jiai), 'is-warn', 1400, 'jiai'); }, 350);
    if (plan.lamp) setTimeout(() => { el.gc.classList.add('is-lamp'); callout(t(lang, ...TX.lamp), 'is-warn', 1400, 'lamp'); }, plan.jiai ? 1500 : 500);
    if (plan.ink) setTimeout(() => { sceneInk('gold'); callout(t(lang, ...TX.goldInk), 'is-gold', 1600, 'goldink'); audio.se('don'); if (plan.ink === 'rainbow') setTimeout(() => { sceneInk('rainbow'); callout(t(lang, ...TX.rainbow), 'is-rainbow', 1800, 'rainbow'); }, 1300); }, 900);
    if (plan.approach) setTimeout(() => approachFish(1), 600);
    await wait(reduced ? 700 : plan.ink ? 3600 : 2400);
    // 4. 「？」
    setPhase('ask');
    V.jig = 1; callout(t(lang, ...TX.q), 'is-q', 1000, 'q'); audio.se('flip');
    await wait(reduced ? 500 : 900);
    V.jig = 0.4;
    el.hook.hidden = false; el.hint.innerHTML = lang === 'ja' ? `<img class="ika-gc-hint-img" src="${assetHref('/assets/ikabu/gacha/co_now.webp')}" alt="${t(lang, ...TX.hookHint)}" />` : t(lang, ...TX.hookHint);
    await Promise.race([new Promise((r) => { hookResolve = r; }), wait(4000)]);
    hookResolve = null; el.hook.hidden = true; el.hint.textContent = '';
    // 5. 駆け引き
    setPhase('fight');
    V.fish[1].mode = 'hooked'; V.egi.mode = 'hooked'; V.jig = 1.4; V.rodPull = 1;
    if (!reduced) V.shake = plan.fight === 'runaway' ? 7 : plan.fight === 'kiloUp' ? 5 : 3;
    const drag = await audio.se('drag');
    el.tension.hidden = false;
    const tBar = el.tension.firstElementChild;
    const tLoop = setInterval(() => { tBar.style.width = `${40 + Math.random() * 55}%`; }, 120);
    if (plan.fight !== 'normal') setTimeout(() => callout(t(lang, ...FIGHT_TEXT[plan.fight]), plan.fight === 'runaway' ? 'is-warn' : 'is-gold', 1500, plan.fight === 'runaway' ? 'runaway' : 'kiloup'), 700);
    if (plan.fight === 'runaway') setTimeout(() => callout(t(lang, ...FIGHT_TEXT.boss), 'is-warn is-big', 2000, 'boss'), 2500);   // 2段目は大きく
    if (plan.fight === 'runaway') setTimeout(() => { V.sink = { t0: performance.now(), dur: 2000, x0: V.egi.x + 100, y0: V.egi.y, y1: Math.min(S.fishBox.y1, V.egi.y + 120) }; V.egi.mode = 'sink'; setTimeout(() => { V.egi.mode = 'hooked'; }, 2000); }, 1500);
    await wait(plan.fightMs);
    clearInterval(tLoop); el.tension.hidden = true; drag.stop(0.3);
    // 6. 乗った！
    setPhase('landed');
    V.shake = 0; V.jig = 0; audio.se('don'); callout(t(lang, ...TX.landed), 'is-hit is-big', 1200, 'landed');
    await wait(reduced ? 400 : 800);
    el.white.classList.add('is-on');
    await wait(420);
    // 7. 結果
    await showResult(results, plan, n);
  }

  /* ----- 結果画面 ----- */
  function cardEl(x, big = true) {
    const c = x.card;
    const d = document.createElement('div');
    d.className = 'ika-gc-card'; d.dataset.tier = tierOf(x.rarity);
    d.innerHTML = `<div class="ika-gc-card-in"><img class="ika-gc-face is-back" src="${assetHref('/assets/ikabu/cards/card_back.webp')}" alt="" width="600" height="900" decoding="async" /><img class="ika-gc-face is-front" src="${assetHref(`/assets/ikabu/cards/card_${String(c.no).padStart(3, '0')}${big ? '' : '_240'}.webp`)}" alt="${esc(c.name)}" width="600" height="900" decoding="async" /></div>`;
    return d;
  }
  const rarityImg = (r, cls = 'ika-gc-rimg') => `<img class="${cls}" src="${assetHref(`/assets/ikabu/gacha/rarity_${tierOf(r)}.webp`)}" alt="${r}" decoding="async" />`;
  function metaHTML(x) {
    return `${rarityImg(x.rarity)}<span class="ika-gc-name">${esc(x.card.name)}</span>${x.isNew ? `<i class="ika-gc-new">${t(lang, ...TX.fresh)}</i>` : x.shards ? `<small>${TX.shards(lang, x.shards)}</small>` : ''}`;
  }
  let skipping = false;
  // 1枚を見せる。レア度で長さと派手さが変わる（N/R 静か、SR 金、SSR 稲妻＋暗転、UR 金→虹）
  async function reveal(x, ms, { pause = true } = {}) {
    const tier = tierOf(x.rarity);
    const card = cardEl(x);
    el.cardwrap.hidden = false; el.cardwrap.replaceChildren(card); el.banner.textContent = ''; el.banner.className = 'ika-gc-banner'; el.meta.innerHTML = '';
    el.result.dataset.tier = tier;
    const fast = skipping || reduced;
    const flip = async () => { audio.se('flip'); card.classList.add('is-flip'); await wait(fast ? 150 : 700); el.meta.innerHTML = metaHTML(x); };
    if (tier === 'n' || tier === 'r') {
      await wait(fast ? 60 : 150); await flip();
      el.banner.innerHTML = rarityImg(x.rarity, ''); el.banner.className = 'ika-gc-banner is-on is-small';
      await wait(fast ? 150 : Math.max(200, ms - 850));
    } else if (tier === 'sr') {
      card.classList.add('is-wait'); await wait(fast ? 100 : 500);
      particles('gold', 70); await flip(); card.classList.add('is-glow');
      el.banner.innerHTML = rarityImg('SR', ''); el.banner.className = 'ika-gc-banner is-on';
      await wait(fast ? 300 : Math.max(400, ms - 1200));
    } else if (tier === 'ssr') {
      el.result.classList.add('is-dark'); card.classList.add('is-wait'); await wait(fast ? 150 : 600);
      await lightning(3); await wait(fast ? 100 : 300);
      inkBloom('gold'); audio.se('don'); await wait(fast ? 200 : 700);
      el.result.classList.remove('is-dark'); particles('gold', 160); await flip(); card.classList.add('is-glow', 'is-gold');
      el.banner.innerHTML = rarityImg('SSR', ''); el.banner.className = 'ika-gc-banner is-on is-big';
      await wait(fast ? 400 : Math.max(600, ms - 2900));
    } else {
      el.result.classList.add('is-dark'); card.classList.add('is-wait'); await wait(fast ? 150 : 700);
      await lightning(4); await wait(fast ? 100 : 300);
      inkBloom('gold'); audio.se('don'); await wait(fast ? 300 : 1100);
      inkBloom('rainbow'); audio.se('fanfare'); el.result.classList.add('is-rainbow'); await wait(fast ? 200 : 900);
      el.result.classList.remove('is-dark'); particles('rainbow', 260); await flip(); card.classList.add('is-glow', 'is-rainbowcard');
      el.banner.innerHTML = rarityImg('UR', ''); el.banner.className = 'ika-gc-banner is-on is-big';
      await wait(fast ? 500 : Math.max(900, ms - 4300));
    }
    if (!pause) inkClear();
  }
  async function lightning(times) {
    for (let i = 0; i < times; i++) {
      el.result.classList.add('is-flash'); el.result.dataset.bolt = String(i % 3);
      if (i === 0) audio.se('thunder');
      await wait(skipping || reduced ? 60 : 110);
      el.result.classList.remove('is-flash');
      await wait(skipping || reduced ? 80 : 160 + Math.random() * 180);
    }
  }
  function inkBloom(kind) { const im = kind === 'gold' ? el.inkGold : el.inkRainbow; im.classList.remove('is-on'); void im.offsetWidth; im.classList.add('is-on'); }
  function inkClear() { el.inkGold.classList.remove('is-on'); el.inkRainbow.classList.remove('is-on'); el.result.classList.remove('is-rainbow', 'is-dark', 'is-flash'); }

  async function showResult(results, plan, n) {
    setPhase('result');
    audio.stopAllSe();
    el.result.hidden = false; el.after.hidden = true; el.grid.hidden = true; el.grid.innerHTML = ''; el.skip.hidden = true; skipping = false;
    el.white.classList.remove('is-on');
    if (n === 1) {
      await reveal(results[0], plan.reveals[0].ms);
    } else {
      el.grid.hidden = false;
      for (let i = 0; i < results.length; i++) {
        if (i === 2) el.skip.hidden = false;
        if (i === results.length - 1) {   // 10枚目の前の「ため」
          el.cardwrap.replaceChildren(cardEl(results[i]));
          const c = el.cardwrap.firstElementChild;
          if (plan.comeback && !skipping) {
            c.classList.add('is-bara'); callout(t(lang, ...TX.bara), 'is-dim', 1300, 'bara'); await wait(reduced ? 500 : 1400);
            c.classList.remove('is-bara'); callout(t(lang, ...TX.still), 'is-hit is-big', 1200, 'still'); audio.se('don'); await wait(reduced ? 400 : 900);
          } else { c.classList.add('is-wait'); await wait(skipping ? 100 : reduced ? 300 : 900); }
        }
        await reveal(results[i], plan.reveals[i].ms, { pause: false });
        const cell = document.createElement('div'); cell.className = 'ika-gc-cell'; cell.dataset.tier = tierOf(results[i].rarity);
        cell.innerHTML = `<img src="${assetHref(`/assets/ikabu/cards/card_${String(results[i].card.no).padStart(3, '0')}_240.webp`)}" alt="${esc(results[i].card.name)}" width="240" height="360" />${results[i].isNew ? '<i>NEW</i>' : ''}`;
        el.grid.appendChild(cell);
      }
      el.skip.hidden = true; skipping = false;
      const s = summarize(results);
      el.cardwrap.replaceChildren(); el.cardwrap.hidden = true; el.banner.textContent = ''; el.banner.className = 'ika-gc-banner';
      el.meta.innerHTML = `${rarityImg(s.top)}<span class="ika-gc-name">${TX.sumTen(lang, s)}</span>`;
      el.grid.classList.add('is-done');
    }
    el.after.hidden = false; renderAfter();
    el.tickets.textContent = String(readTickets().n);
    audio.bgm('lobby', { xfade: 2.5 });
  }
  el.skip.addEventListener('click', () => { skipping = true; el.skip.hidden = true; });

  function resetToLobby() {
    inkClear();
    el.result.hidden = true; el.result.removeAttribute('data-tier'); el.grid.classList.remove('is-done'); el.grid.innerHTML = '';
    el.gc.classList.remove('is-jiai', 'is-lamp'); sc.inkimg.classList.remove('is-on'); el.boss.classList.remove('is-on');
    V.fish.forEach((f) => { f.mode = 'swim'; }); V.egi = { x: S.egiRest.x, y: S.egiRest.y, mode: 'rest' }; V.rodPull = 0; V.sink = null; V.jig = 0; V.shake = 0;
    setPhase('lobby'); renderLobby();
  }

  /* ----- 光の粒（canvas） ----- */
  const ctx = el.canvas.getContext('2d');
  let parts = [], partRaf = 0;
  const RAINBOW = ['#ff4d4d', '#ffb14d', '#ffe94d', '#6bff6b', '#4dc3ff', '#b36bff'];
  function particles(kind, n) {
    if (reduced) return;
    const W = el.canvas.width, H = el.canvas.height;
    for (let i = 0; i < n; i++) parts.push({ x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.5 + (Math.random() - 0.5) * 160, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 6, r: 2 + Math.random() * 4, life: 1, col: kind === 'gold' ? (Math.random() < 0.5 ? '#ffd76a' : '#fff2b0') : RAINBOW[i % RAINBOW.length] });
    if (!partRaf) partRaf = requestAnimationFrame(partTick);
  }
  function partTick() {
    const W = el.canvas.width, H = el.canvas.height;
    ctx.clearRect(0, 0, W, H);
    parts = parts.filter((p) => p.life > 0);
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.99; p.life -= 0.012; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    partRaf = parts.length ? requestAnimationFrame(partTick) : 0;
  }

  audio.preload(['lobby']);
  if (audio.on) el.gc.addEventListener('pointerdown', () => { audio.unlock(); if (phase === 'lobby') audio.bgm('lobby'); }, { once: true });
  return { startPull, resetToLobby };
}

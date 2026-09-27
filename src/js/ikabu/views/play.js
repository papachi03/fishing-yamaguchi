// play：イカ部のあそび場。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 遊び方・説明・ゲームの土台（舞台の SVG・盤面の枠・バッジ一覧）は最初から HTML に書き、
// 動く部分は pages/play.js が games/egi-ui.js と games/match3-ui.js を結びつける。
import { t, pair, esc, assetHref, pageHref } from '../i18n.js';
import { pageHead, noteHTML } from './parts.js';
import { ytHTML } from '../yt-facade.js';
import { EGI_TEXT, M3_TEXT, HUB_TEXT, TOD, SEASON, MARKS, RARE_NAME, monthLabel, speciesName, YAMAGUCHI_SQUID, GAME_ZUKAN } from '../games/play-text.js';
import { egiSceneSVG } from '../games/egi-scene.js';
import { tileImg } from '../games/marks.js';
import { TIMES, CASTS, EGI_STOCK, EGI_SIZES, EGI_TYPES, EGI_COLORS, EGI_COLOR_HEX, DEFAULT_EGI, speciesPool, seasonOf, egiSecPerMeter, SEASON_MODES } from '../games/egi.js';
import { recommendedSizes, distRank, snagRank } from '../games/egi-advice.js';
import { METHODS, METHOD_IDS } from '../games/progress.js';
import { BAITS } from '../games/egi.js';

// 釣り方の選択（2026-09-27）：状態（解放・季節）は画面側（egi-ui.js）が書き込む
export const methodPickHTML = (lang) => {
  const T = EGI_TEXT;
  const chips = METHOD_IDS.map((id) => `<button type="button" class="ika-egi-method-chip" data-method="${id}" aria-pressed="${id === 'egi'}"${id === 'egi' ? '' : ' disabled'}><b>${t(lang, T.method.names[id])}</b><small class="ika-egi-method-state" data-state>${id === 'egi' ? '' : T.method.level(lang, METHODS[id].level)}</small></button>`).join('');
  const baits = BAITS.map((b) => `<button type="button" class="ika-chip" data-bait="${b}" aria-pressed="${b === 'sasami'}">${t(lang, T.bait.names[b])}</button>`).join('');
  return `
    <div class="ika-egi-method" id="ika-egi-method">
      <span class="ika-egi-setup-label">${t(lang, T.method.title)}</span>
      <div class="ika-egi-methods" id="ika-egi-methods" role="group" aria-label="${t(lang, T.method.title)}">${chips}</div>
      <p class="ika-egi-method-about" id="ika-egi-method-about">${t(lang, T.method.about.egi)}</p>
      <div class="ika-egi-bait" id="ika-egi-bait" hidden>
        <span class="ika-egi-setup-label">${t(lang, T.bait.title)}</span>
        <div class="ika-chips ika-chips--small" id="ika-egi-baits" role="group" aria-label="${t(lang, T.bait.title)}">${baits}</div>
        <p class="ika-egi-cue-note">${t(lang, T.bait.note)}</p>
      </div>
      <p class="ika-egi-cue-note">${t(lang, T.method.note)}</p>
    </div>`;
};
import { SIZE, MOVES, GOAL, RARE } from '../games/match3.js';

export const HEAD = {
  num: '06',
  eyebrow: 'THE PLAYGROUND',
  title: pair('同じイカで、世界と一戦。', 'One board. A world of players.'),
  desc: pair('エギングゲームと「墨つなぎ」。釣りに行けない日のために、ロゴのイカが働きます。', "An eging game and Ink Link, the three-match puzzle. For days you cannot get to the water."),
};

// 小さなエギの絵（入口カード用）
const egiIconSVG = () => `<svg viewBox="-14 -6 28 46" width="34" height="56" aria-hidden="true" focusable="false"><path d="M0,-2 Q7,4 6,16 Q5,26 0,30 Q-5,26 -6,16 Q-7,4 0,-2 Z" fill="#f47321" stroke="#16233a" stroke-width="3" stroke-linejoin="round"/><path d="M-3,8 L3,8 M-4,15 L4,15 M-3,22 L3,22" stroke="#ffd2a8" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="3.5" r="1.8" fill="#16233a"/><path d="M-4,30 L-6,35 M0,31 L0,36 M4,30 L6,35" stroke="#16233a" stroke-width="1.6" stroke-linecap="round"/></svg>`;

const hubHTML = (lang) => `
  <section class="ika-section ika-play-hub" id="hub" aria-label="${t(lang, HUB_TEXT.pick)}">
    <div class="wrap">
      <p class="ika-eyebrow"><span class="ika-eyebrow-num">PICK</span>${t(lang, 'ゲームを選ぶ', 'PICK A GAME')}</p>
      <div class="ika-play-cards">
        <a class="ika-play-card ika-play-card--egi" href="#egi">
          <span class="ika-play-card-art">${egiIconSVG()}</span>
          <span class="ika-play-card-tag">${t(lang, HUB_TEXT.flagship)}</span>
          <span class="ika-play-card-no">01</span>
          <span class="ika-play-card-name">${t(lang, EGI_TEXT.name)}</span>
          <span class="ika-play-card-desc">${t(lang, EGI_TEXT.tagline)}</span>
          <span class="ika-play-card-go">${t(lang, HUB_TEXT.play)} <span aria-hidden="true">↓</span></span>
        </a>
        <a class="ika-play-card ika-play-card--sumi" href="#sumi">
          <span class="ika-play-card-art ika-play-card-art--marks">${tileImg(0, { href: assetHref, size: 40 })}${tileImg(1, { href: assetHref, size: 40 })}${tileImg(RARE, { href: assetHref, size: 40 })}</span>
          <span class="ika-play-card-tag">${t(lang, HUB_TEXT.daily)}</span>
          <span class="ika-play-card-no">02</span>
          <span class="ika-play-card-name">${t(lang, M3_TEXT.name)}</span>
          <span class="ika-play-card-desc">${t(lang, M3_TEXT.tagline)}</span>
          <span class="ika-play-card-go">${t(lang, HUB_TEXT.play)} <span aria-hidden="true">↓</span></span>
        </a>
      </div>
      <p class="ika-play-note">${t(lang, HUB_TEXT.records)}</p>
      <a class="ika-play-read" href="${pageHref('egi-guide', lang)}">
        <span class="ika-play-read-tag">${t(lang, '読みもの', 'READ')}</span>
        <span class="ika-play-read-title">${t(lang, '部員おすすめ：新子シーズンのエギ選び', "Members' pick: egi for young-squid season")}</span>
        <span class="ika-play-read-desc">${t(lang, '号数と色の考え方、マズメ・日中・夜間の3タイプ別おすすめ', 'Sizes, colors, and picks for dawn, day and night anglers')}</span>
        <span class="ika-play-read-go" aria-hidden="true">→</span>
      </a>
    </div>
  </section>`;

// 遊び方の動画（childダディの YouTube、2026-09-26）。あそび場だけに出し、エギング単体のページ（知り合い用）には出さない
const HOWTO = {
  egi: { id: 'Kdq8l3a82yc', poster: '/assets/ikabu/egi-video-poster.jpg', len: pair('約4分', 'about 4 min') },
  sumi: { id: 'HSpwXXRKXFU', poster: '/assets/ikabu/sumi-video-poster.jpg', len: pair('約3分', 'about 3 min') },
};
const howtoHTML = (lang, game) => {
  const v = HOWTO[game];
  return `
      <div class="ika-howto">
        <div class="ika-howto-video">${ytHTML(lang, { id: v.id, poster: v.poster, label: pair('遊び方の動画を再生', 'Play the how-to video') })}</div>
        <p class="ika-howto-text"><span class="ika-howto-tag">${t(lang, '動画', 'VIDEO')}</span>${t(lang, `遊び方を${v.len.ja}で紹介しています。押すと再生します（YouTube）。`, `A ${v.len.en} how-to video (in Japanese). Tap to play on YouTube.`)}</p>
      </div>`;
};

/* ---------- しゃくって抱かせろ！ ---------- */

// エギの絵（号数で大きさ、タイプで色）。ブラウザ側でも同じ関数で描き直す
export function egiIconHTML(size = 3, type = 'normal', color = 'orange') {
  const k = { 2.5: 0.85, 3: 1, 3.5: 1.15 }[size] ?? 1;
  const fill = EGI_COLOR_HEX[color] ?? '#f47321';
  return `<svg class="ika-egi-pick-icon" viewBox="-16 -8 32 50" width="${Math.round(26 * k)}" height="${Math.round(40 * k)}" aria-hidden="true" focusable="false"><g transform="scale(${k.toFixed(2)})"><path d="M0,-2 Q7,4 6,16 Q5,26 0,30 Q-5,26 -6,16 Q-7,4 0,-2 Z" fill="${fill}" stroke="#16233a" stroke-width="3" stroke-linejoin="round"/><path d="M-3,8 L3,8 M-4,15 L4,15 M-3,22 L3,22" stroke="#ffd2a8" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="3.5" r="1.8" fill="#16233a"/><path d="M-4,30 L-6,35 M0,31 L0,36 M4,30 L6,35" stroke="#16233a" stroke-width="1.6" stroke-linecap="round"/></g></svg>`;
}

// エギの色の丸いボタン（エギ選び欄と、舞台の色選びで同じものを使う）
export function colorChipsHTML(lang, current = 'orange') {
  return EGI_COLORS.map((c) => `<button type="button" class="ika-egi-colorchip" data-color="${c}" aria-pressed="${String(c === current)}" title="${t(lang, EGI_TEXT.egi.colors[c])}" style="--c:${EGI_COLOR_HEX[c]}"><i aria-hidden="true"></i><span>${t(lang, EGI_TEXT.egi.colors[c])}</span></button>`).join('');
}

// エギ選び。ブラウザ側は中身（おすすめ・特徴）だけ差し替える
export function egiPickerHTML(lang, { month = 9, tod = 'evening', egi = DEFAULT_EGI } = {}) {
  const T = EGI_TEXT.egi;
  const rec = recommendedSizes(month, tod);
  const sizes = EGI_SIZES.map((s) => `<button type="button" class="ika-chip ika-egi-size${rec.includes(s) ? ' is-rec' : ''}" data-size="${s}" aria-pressed="${String(s === egi.size)}">${s}${t(lang, '号', '')}</button>`).join('');
  const types = EGI_TYPES.map((k) => `<button type="button" class="ika-chip" data-type="${k}" aria-pressed="${String(k === egi.type)}">${t(lang, T.types[k])}</button>`).join('');
  return `
    <div class="ika-egi-pick-head"><span class="ika-egi-pick-icon-wrap" id="ika-egi-pick-icon">${egiIconHTML(egi.size, egi.type, egi.color)}</span><span class="ika-egi-setup-label">${t(lang, T.title)}</span><b class="ika-egi-pick-current" id="ika-egi-pick-current">${T.current(lang, egi.size, t(lang, T.types[egi.type]))}</b></div>
    <div class="ika-egi-setup-row">
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, T.size)}</span><div class="ika-chips ika-chips--small" id="ika-egi-size" role="group" aria-label="${t(lang, T.size)}">${sizes}</div></div>
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, T.type)}</span><div class="ika-chips ika-chips--small" id="ika-egi-type" role="group" aria-label="${t(lang, T.type)}">${types}</div></div>
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, T.color)}</span><div class="ika-egi-colors" id="ika-egi-color" role="group" aria-label="${t(lang, T.color)}">${colorChipsHTML(lang, egi.color)}</div></div>
    </div>
    <dl class="ika-egi-pick-traits" id="ika-egi-pick-traits">${egiTraitsHTML(lang, egi)}</dl>
    <p class="ika-egi-pick-rec"><span class="ika-egi-pick-star" aria-hidden="true">★</span>${t(lang, T.recommend)}: <b id="ika-egi-pick-rec">${rec.map((s) => `${s}${t(lang, '号', '')}`).join(' / ')}</b></p>`;
}
export function egiTraitsHTML(lang, egi) {
  const T = EGI_TEXT.egi;
  return `
      <div><dt>${t(lang, T.sink)}</dt><dd>${T.sinkUnit(lang, egiSecPerMeter(egi).toFixed(1))}</dd></div>
      <div><dt>${t(lang, T.dist)}</dt><dd>${t(lang, T.distRank[distRank(egi.size)])}</dd></div>
      <div><dt>${t(lang, T.snag)}</dt><dd>${t(lang, T.snagRank[snagRank(egi.type)])}</dd></div>`;
}

// 季節と時間帯で出てくるイカ（名前のチップ）。ブラウザでも同じ関数で差し替える
// links=false（エギング専用ページ）は図鑑ページへのリンクを付けず、名前だけ並べる
export function aroundHTML(lang, month, tod, { links = true } = {}) {
  const ids = [...new Set(speciesPool(month, tod).map((p) => p.id))];
  return ids.map((id) => (links ? `<li><a href="${pageHref('atlas', lang)}#sp-${id}">${esc(speciesName(lang, id))}</a></li>` : `<li><span>${esc(speciesName(lang, id))}</span></li>`)).join('');
}

// 季節モードのカード（春・初夏・夏・秋・冬）。押すとその季節の代表の月・時間帯で遊ぶ（egi-ui.js）
export function seasonCardsHTML(lang) {
  const S = EGI_TEXT.seasons;
  return SEASON_MODES.map((m) => {
    const x = S.modes[m.key];
    return `<button type="button" class="ika-egi-season-card" data-season="${m.key}" aria-pressed="false">
      <span class="ika-egi-season-name">${t(lang, SEASON[m.key])}<small>${t(lang, x.months)}</small></span>
      <span class="ika-egi-season-star">${t(lang, x.star)}</span>
      <span class="ika-egi-season-meta">${t(lang, S.labels.zone)}：${t(lang, S.zone[x.zone])} ・ ${t(lang, S.labels.tod)}：${t(lang, x.tod)} ・ ${t(lang, S.labels.egi)}：${x.egi}${lang === 'en' ? '' : '号'}</span>
    </button>`;
  }).join('');
}

export function egiSetupHTML(lang, { month = 9, tod = 'evening', solo = false } = {}) {
  const T = EGI_TEXT;
  const chips = TIMES.map((k) => `<button type="button" class="ika-chip" data-tod="${k}" aria-pressed="${String(k === tod)}">${t(lang, TOD[k])}</button>`).join('');
  const months = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === month ? ' selected' : ''}>${monthLabel(lang, i + 1)}</option>`).join('');
  const winds = [['calm', T.practice.calm], ['breezy', T.practice.breezy], ['strong', T.practice.strong]]
    .map(([k, v], i) => `<button type="button" class="ika-chip" data-wind="${k}" aria-pressed="${String(i === 0)}">${t(lang, v)}</button>`).join('');
  return `
    <!-- 今日の萩の海：ブラウザで YFJ の海況を取って埋める（取れなければ練習モード） -->
    <div class="ika-egi-live" id="ika-egi-live" data-state="loading">
      <div class="ika-egi-live-head">
        <span class="ika-egi-setup-label">${t(lang, T.live.title)}</span>
        <span class="ika-egi-live-time" id="ika-egi-live-time"></span>
      </div>
      <div class="ika-egi-live-body" id="ika-egi-live-body"><p class="ika-egi-live-loading">${t(lang, T.live.loading)}</p></div>
      <p class="ika-egi-live-notice" id="ika-egi-live-notice" hidden></p>
      <div class="ika-egi-live-actions">
        <button type="button" class="ika-btn ika-btn--primary" id="ika-egi-play-live" disabled>${t(lang, T.live.playLive)}</button>
        <button type="button" class="ika-btn" id="ika-egi-play-practice" aria-expanded="false" aria-controls="ika-egi-practice">${t(lang, T.live.playPractice)}</button>
        <button type="button" class="ika-btn ika-egi-play-beginner" id="ika-egi-play-beginner">${t(lang, T.live.playBeginner)}</button>
      </div>
      <p class="ika-egi-beginner-hint" id="ika-egi-beginner-hint" hidden>${t(lang, T.live.beginnerHint)}</p>
      <details class="ika-egi-tips" id="ika-egi-tips">
        <summary>${t(lang, T.tips.open)}</summary>
        <h4>${t(lang, T.tips.fallTitle)}</h4>
        <svg class="ika-egi-tips-fall" viewBox="0 0 320 170" role="img" aria-label="${t(lang, T.tips.free)} / ${t(lang, T.tips.tension)}">
          <g class="ika-tips-panel">
            <rect x="4" y="4" width="150" height="162" rx="10" fill="#e8f6f7"/>
            <line x1="4" y1="40" x2="154" y2="40" stroke="#138c96" stroke-width="2"/>
            <circle cx="24" cy="14" r="3" fill="#16233a"/>
            <line x1="24" y1="14" x2="90" y2="44" stroke="#16233a" stroke-width="1.5" stroke-dasharray="3 3">
              <animate attributeName="x2" dur="3.2s" repeatCount="indefinite" values="90;92;92" keyTimes="0;0.35;1"/>
              <animate attributeName="y2" dur="3.2s" repeatCount="indefinite" values="44;150;150" keyTimes="0;0.35;1"/>
            </line>
            <g><ellipse rx="11" ry="5" fill="#f47321" stroke="#16233a" stroke-width="1.5" transform="rotate(70)"/>
              <animateMotion dur="3.2s" repeatCount="indefinite" path="M90 44 L92 150 L92 150" keyTimes="0;0.35;1" keyPoints="0;1;1" calcMode="linear"/></g>
          </g>
          <g class="ika-tips-panel">
            <rect x="166" y="4" width="150" height="162" rx="10" fill="#e8f6f7"/>
            <line x1="166" y1="40" x2="316" y2="40" stroke="#138c96" stroke-width="2"/>
            <circle cx="186" cy="14" r="3" fill="#16233a"/>
            <line x1="186" y1="14" x2="296" y2="46" stroke="#16233a" stroke-width="1.5">
              <animate attributeName="x2" dur="3.2s" repeatCount="indefinite" values="296;262;236" keyTimes="0;0.6;1"/>
              <animate attributeName="y2" dur="3.2s" repeatCount="indefinite" values="46;100;140" keyTimes="0;0.6;1"/>
            </line>
            <g><ellipse rx="11" ry="5" fill="#f47321" stroke="#16233a" stroke-width="1.5" transform="rotate(20)"/>
              <animateMotion dur="3.2s" repeatCount="indefinite" path="M296 46 Q270 110 236 140"/></g>
            <g opacity="0"><ellipse cx="0" cy="0" rx="9" ry="16" fill="#f5eedc" stroke="#16233a" stroke-width="1.5"/>
              <animateMotion dur="3.2s" repeatCount="indefinite" path="M300 150 L250 142"/>
              <animate attributeName="opacity" dur="3.2s" repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.8;1"/></g>
          </g>
          <text x="79" y="162" text-anchor="middle" font-size="11" fill="#41585c">${t(lang, "ストン", "Plop")}</text>
          <text x="241" y="162" text-anchor="middle" font-size="11" fill="#41585c">${t(lang, "ふわ〜っ", "Glide")}</text>
        </svg>
        <p class="ika-egi-tips-legend"><span>${t(lang, T.tips.free)}</span><span>${t(lang, T.tips.tension)}</span></p>
        <p>${t(lang, T.tips.fallBody)}</p>
        <h4>${t(lang, T.tips.biteTitle)}</h4>
        <p>${t(lang, T.tips.biteBody)}</p>
        <h4>${t(lang, T.tips.reelTitle)}</h4>
        <p>${t(lang, T.tips.reelBody)}</p>
        <h4>${t(lang, T.tips.weedTitle)}</h4>
        <p>${t(lang, T.tips.weedBody)}</p>
        <h4>${t(lang, T.tips.tempoTitle)}</h4>
        <p>${t(lang, T.tips.tempoBody)}</p>
      </details>
      <p class="ika-egi-live-source" id="ika-egi-live-source">${t(lang, T.live.source)}</p>
    </div>
    ${methodPickHTML(lang)}
    <div class="ika-egi-pick" id="ika-egi-pick">${egiPickerHTML(lang, { month, tod })}</div>
    <div class="ika-egi-cue-setting">
      <span class="ika-egi-setup-label">${t(lang, T.cue.title)}</span>
      <div class="ika-chips ika-chips--small" id="ika-egi-cue" role="group" aria-label="${t(lang, T.cue.title)}">
        <button type="button" class="ika-chip" data-cue="real" aria-pressed="true">${t(lang, T.cue.real)}</button>
        <button type="button" class="ika-chip" data-cue="easy" aria-pressed="false">${t(lang, T.cue.easy)}</button>
      </div>
      <span class="ika-egi-cue-note">${t(lang, T.cue.note)}</span>
    </div>
    <div class="ika-egi-cue-setting ika-egi-feel" id="ika-egi-feel">
      <span class="ika-egi-setup-label">${t(lang, T.feel.title)}</span>
      <div class="ika-chips ika-chips--small" id="ika-egi-feel-vibrate" role="group" aria-label="${t(lang, T.feel.vibrate)}" hidden>
        <span class="ika-egi-feel-name">${t(lang, T.feel.vibrate)}</span>
        <button type="button" class="ika-chip" data-feel="vibrate" data-on="1" aria-pressed="true">${t(lang, T.feel.on)}</button>
        <button type="button" class="ika-chip" data-feel="vibrate" data-on="0" aria-pressed="false">${t(lang, T.feel.off)}</button>
      </div>
      <div class="ika-chips ika-chips--small" id="ika-egi-feel-sound" role="group" aria-label="${t(lang, T.feel.sound)}">
        <span class="ika-egi-feel-name">${t(lang, T.feel.sound)}</span>
        <button type="button" class="ika-chip" data-feel="sound" data-on="1" aria-pressed="false">${t(lang, T.feel.on)}</button>
        <button type="button" class="ika-chip" data-feel="sound" data-on="0" aria-pressed="true">${t(lang, T.feel.off)}</button>
      </div>
      <span class="ika-egi-cue-note">${t(lang, T.feel.note)}</span>
    </div>
    <div class="ika-egi-practice" id="ika-egi-practice" hidden>
      <p class="ika-egi-setup-label">${t(lang, T.seasons.title)}</p>
      <div class="ika-egi-seasons" id="ika-egi-seasons" role="group" aria-label="${t(lang, T.seasons.title)}">${seasonCardsHTML(lang)}</div>
      <p class="ika-egi-cue-note">${t(lang, T.seasons.note)}</p>
      <details class="ika-egi-detail">
      <summary>${t(lang, T.seasons.detail)}</summary>
      <div class="ika-egi-setup-row">
        <div class="ika-egi-setup-item">
          <span class="ika-egi-setup-label">${t(lang, T.setup.tod)}</span>
          <div class="ika-chips ika-chips--small" id="ika-egi-tod" role="group" aria-label="${t(lang, T.setup.tod)}">${chips}</div>
        </div>
        <div class="ika-egi-setup-item">
          <label class="ika-egi-setup-label" for="ika-egi-month">${t(lang, T.setup.month)}</label>
          <select id="ika-egi-month" class="ika-egi-select">${months}</select>
          <span class="ika-tag ika-tag--orange" id="ika-egi-season">${t(lang, SEASON[seasonOf(month)])}</span>
        </div>
        <div class="ika-egi-setup-item">
          <label class="ika-egi-setup-label" for="ika-egi-exp">${t(lang, T.practice.expectation)}</label>
          <input type="range" id="ika-egi-exp" class="ika-egi-range" min="0" max="10" step="1" value="5" />
          <output class="ika-egi-range-out" id="ika-egi-exp-out" for="ika-egi-exp">★5</output>
        </div>
        <div class="ika-egi-setup-item">
          <span class="ika-egi-setup-label">${t(lang, T.practice.wind)}</span>
          <div class="ika-chips ika-chips--small" id="ika-egi-wind" role="group" aria-label="${t(lang, T.practice.wind)}">${winds}</div>
        </div>
      </div>
      <p class="ika-egi-setup-hint" id="ika-egi-hint">${t(lang, T.setup.hint[tod])}</p>
      <div class="ika-egi-around">
        <span class="ika-egi-setup-label">${t(lang, T.setup.around)}</span>
        <ul class="ika-egi-around-list" id="ika-egi-around">${aroundHTML(lang, month, tod, { links: !solo })}</ul>
      </div>
      </details>
    </div>
    <p class="ika-egi-mode" id="ika-egi-mode"></p>
    <p class="ika-egi-setup-locked" id="ika-egi-locked" hidden>${t(lang, T.setup.locked)}</p>`;
}

// solo：エギングだけの専用ページ（views/egi.js）で使うときは見出しを h1 にし、ページの頭を短くする
export const egiHTML = (lang, month, { solo = false } = {}) => {
  const T = EGI_TEXT;
  const H = solo ? 'h1' : 'h2';
  const castIcons = Array.from({ length: CASTS }, () => `<i></i>`).join('');
  const egiIcons = Array.from({ length: EGI_STOCK }, () => `<i></i>`).join('');
  return `
  <section class="ika-section ika-game ika-game--egi" id="egi" aria-labelledby="egi-title">
    <div class="wrap">
      <header class="ika-game-head">
        <p class="ika-eyebrow">${solo ? `<span class="ika-eyebrow-num">EGI</span>${t(lang, '山口イカ部のエギングゲーム', 'YAMAGUCHI IKA CLUB ・ EGING')}` : '<span class="ika-eyebrow-num">01</span>GAME ONE ・ EGING'}</p>
        <${H} id="egi-title">${t(lang, T.name)}</${H}>
        <p class="ika-head-note">${t(lang, T.tagline)}${solo ? t(lang, '今の萩の風・波・潮で釣れ具合が変わります（海の様子とエギの選び方は、ゲーム画面の下）。', ' Today’s real wind, waves and tide in Hagi set the mood (sea conditions and egi choice are below the game).') : ''}</p>
      </header>
      ${solo ? '' : howtoHTML(lang, 'egi')}

      <div class="ika-egi" id="ika-egi" data-lang="${lang}"${solo ? ' data-solo="1"' : ''}>
        <div class="ika-egi-setup" id="ika-egi-setup">${egiSetupHTML(lang, { month, tod: 'evening', solo })}</div>

        <div class="ika-egi-main">
          <div class="ika-egi-stage" id="ika-egi-stage">
            <div class="ika-egi-scene" id="ika-egi-scene">${egiSceneSVG({ lang, tod: 'evening', assetHref })}</div>
            <div class="ika-egi-hud">
              <div class="ika-egi-stock">
                <span class="ika-egi-stock-row"><span class="ika-egi-stock-label">${t(lang, T.hud.casts)}</span><span class="ika-egi-casts" id="ika-egi-casts">${castIcons}</span></span>
                <span class="ika-egi-stock-row"><span class="ika-egi-stock-label">${t(lang, T.hud.egi)}</span><span class="ika-egi-egis" id="ika-egi-egis">${egiIcons}</span><span class="ika-egi-stock-spec" id="ika-egi-spec">${T.egi.current(lang, DEFAULT_EGI.size, t(lang, T.egi.types[DEFAULT_EGI.type]))}</span></span>
                <span class="ika-egi-stock-row" id="ika-egi-baitrow" hidden><span class="ika-egi-stock-label">${t(lang, T.bait.left)}</span><span class="ika-egi-baitbar" aria-hidden="true"><i id="ika-egi-baitfill"></i></span><span class="ika-egi-stock-spec" id="ika-egi-baitname"></span></span>
              </div>
              <div class="ika-egi-count" id="ika-egi-count" hidden>
                <span class="ika-egi-count-label" id="ika-egi-count-label">${t(lang, T.hud.count)}</span>
                <b class="ika-egi-count-num" id="ika-egi-count-num">0</b>
                <span class="ika-egi-count-depth" id="ika-egi-depth"></span>
                <span class="ika-egi-fallmode" id="ika-egi-fallmode" hidden></span>
                <span class="ika-egi-windnote" id="ika-egi-windnote" hidden>${t(lang, T.msg.windy)}</span>
              </div>
              <div class="ika-egi-count ika-egi-reel" id="ika-egi-reel" hidden>
                <span class="ika-egi-count-label">${t(lang, T.hud.dist)}</span>
                <b class="ika-egi-count-num"><span id="ika-egi-dist">0</span><small>m</small></b>
              </div>
            </div>
            <!-- 投げる力・テンションのゲージは舞台の右端に縦で（指で隠れず、竿とイカを見ながら読める。ダディ指定 2026-09-25） -->
            <div class="ika-egi-gauge ika-egi-gauge--power" id="ika-egi-power" hidden aria-hidden="true">
              <span class="ika-egi-gauge-label">${t(lang, T.hud.power)}</span>
              <span class="ika-egi-gauge-track"><i class="ika-egi-gauge-fill"></i><em class="ika-egi-gauge-sweet"></em></span>
            </div>
            <div class="ika-egi-gauge ika-egi-gauge--tension" id="ika-egi-tension" hidden aria-hidden="true">
              <span class="ika-egi-gauge-label">${t(lang, T.hud.tension)}</span>
              <span class="ika-egi-gauge-track"><i class="ika-egi-gauge-fill"></i></span>
            </div>
            <!-- 全画面ボタン（左上の角。全画面の中では「もどる」に変わる） -->
            <button type="button" class="ika-egi-fullbtn" id="ika-egi-fullbtn" data-full="enter" aria-pressed="false">${t(lang, T.fullBtn)}</button>
            <p class="ika-egi-fullnote" id="ika-egi-fullnote" role="status" hidden>${t(lang, T.fullNote)}</p>
            <div class="ika-egi-colortip" id="ika-egi-colortip" hidden>${t(lang, T.egi.colorTap).split('|').map((w) => `<span>${w}</span>`).join('')}</div>
            <div class="ika-egi-colorpop" id="ika-egi-colorpop" role="dialog" aria-label="${t(lang, T.egi.colorTitle)}" hidden>
              <p class="ika-egi-colorpop-title">${t(lang, T.egi.colorTitle)}</p>
              <div class="ika-egi-colors" id="ika-egi-colorpop-chips">${colorChipsHTML(lang, DEFAULT_EGI.color)}</div>
              <p class="ika-egi-colorpop-why" id="ika-egi-colorpop-why"></p>
            </div>
            <div class="ika-egi-callout" id="ika-egi-callout" hidden aria-hidden="true"></div>
            <p class="ika-egi-guide" id="ika-egi-guide" hidden aria-live="polite"></p>
            <div class="ika-egi-cue" id="ika-egi-cue-label" hidden aria-hidden="true"></div>
            <div class="ika-egi-flash" id="ika-egi-flash" hidden aria-hidden="true">${t(lang, T.msg.signal)}</div>
            <div class="ika-egi-card" id="ika-egi-card" hidden></div>
          </div>

          <div class="ika-egi-controls">
            <!-- 横向きのときは、カウント・水深・距離をここ（ボタンの上の空き）へ移す（舞台を広く見せる。ダディ指定 2026-09-25） -->
            <div class="ika-egi-sidehud" id="ika-egi-sidehud"></div>
            <div class="ika-egi-main-row">
              <button type="button" class="ika-egi-btn" id="ika-egi-btn" data-phase="ready">${t(lang, T.btn.ready)}</button>
              <button type="button" class="ika-egi-dart" id="ika-egi-dart" disabled title="${t(lang, T.gestures.dartHint)}" aria-label="${t(lang, T.gestures.dart)}：${t(lang, T.gestures.dartHint)}"><span class="ika-egi-dart-arrow" aria-hidden="true">↑</span><span>${t(lang, T.gestures.dart)}</span></button>
            </div>
          </div>
          <details class="ika-egi-gestures" open>
            <summary>${t(lang, T.gestures.title)}</summary>
            <p>${t(lang, T.gestures.row)}</p>
            <p class="ika-egi-gestures-keys">${t(lang, T.gestures.keys)}</p>
            <p class="ika-egi-gestures-keys">${t(lang, T.gestures.full)}</p>
          </details>
          <p class="ika-egi-log" id="ika-egi-log" role="status" aria-live="polite" aria-label="${t(lang, T.a11y.log)}"></p>
        </div>

        <section class="ika-egi-zukan" id="ika-egi-zukan" aria-labelledby="ika-egi-zukan-title">
          <p class="ika-egi-side-head" id="ika-egi-zukan-title">${t(lang, T.zukan.title)} <b id="ika-egi-zukan-count">0</b> / ${GAME_ZUKAN.length}</p>
          <p class="ika-egi-cue-note">${t(lang, T.zukan.note)}</p>
          <ul class="ika-egi-zukan-grid" id="ika-egi-zukan-grid"></ul>
          <dialog class="ika-egi-zukan-detail" id="ika-egi-zukan-detail" aria-labelledby="ika-egi-zukan-detail-name"></dialog>
          <p class="ika-egi-save-note" id="ika-egi-save-note" hidden></p>
          <details class="ika-egi-backup" id="ika-egi-backup">
            <summary>${t(lang, T.backup.summary)}</summary>
            <p class="ika-egi-cue-note">${t(lang, T.backup.lead)}</p>
            <textarea class="ika-egi-backup-code" id="ika-egi-backup-code" rows="3" spellcheck="false" autocomplete="off" placeholder="${t(lang, T.backup.placeholder)}"></textarea>
            <div class="ika-egi-backup-actions">
              <button type="button" class="ika-btn" data-backup="export">${t(lang, T.backup.export)}</button>
              <button type="button" class="ika-btn" data-backup="copy">${t(lang, T.backup.copy)}</button>
              <button type="button" class="ika-btn" data-backup="import">${t(lang, T.backup.import)}</button>
            </div>
            <p class="ika-egi-backup-msg" id="ika-egi-backup-msg" role="status" aria-live="polite"></p>
          </details>
        </section>
        <section class="ika-egi-gedo" id="ika-egi-gedo" aria-labelledby="ika-egi-gedo-title">
          <p class="ika-egi-side-head" id="ika-egi-gedo-title">${t(lang, T.gedo.title)} <b id="ika-egi-gedo-count">0</b> / ${Object.keys(T.gedo.names).length}</p>
          <p class="ika-egi-cue-note">${t(lang, T.gedo.note)}</p>
          <ul class="ika-egi-gedo-grid" id="ika-egi-gedo-grid"></ul>
        </section>
        <aside class="ika-egi-side" id="ika-egi-side" aria-label="${t(lang, '記録', 'Records')}">
          <p class="ika-egi-side-head">${t(lang, '今日の釣果', 'This session')}</p>
          <ol class="ika-egi-catches" id="ika-egi-catches"><li class="ika-egi-catch-empty">${t(lang, 'まだ釣れていない', 'Nothing yet')}</li></ol>
          <div class="ika-egi-level" id="ika-egi-level">
            <p class="ika-egi-side-head">${t(lang, T.level.title)} <b class="ika-egi-level-num" id="ika-egi-level-num">Lv1</b></p>
            <span class="ika-egi-level-bar" aria-hidden="true"><i id="ika-egi-level-fill"></i></span>
            <p class="ika-egi-level-next" id="ika-egi-level-next"></p>
            <p class="ika-egi-cue-note">${t(lang, T.level.note)}</p>
          </div>
          <p class="ika-egi-side-head">${t(lang, '記録', 'Records')}</p>
          <dl class="ika-egi-records" id="ika-egi-records">
            <div><dt>${t(lang, T.over.best)}</dt><dd><b data-rec="best">0</b> g</dd></div>
            <div><dt>${t(lang, T.over.zukan)}</dt><dd><b data-rec="zukan">0</b> / ${GAME_ZUKAN.length}</dd></div>
            <div><dt>${t(lang, T.over.sessions)}</dt><dd><b data-rec="sessions">0</b></dd></div>
          </dl>
        </aside>
      </div>

      <details class="ika-game-rules">
        <summary>${t(lang, '遊び方', 'How to play')}</summary>
        <ol>${T.rules.map((r) => `<li>${t(lang, r)}</li>`).join('')}</ol>
        <p class="ika-small">${t(lang, 'イカの顔ぶれと抱きやすさは、山口の堤防エギングの目安（季節・時間帯）をもとにしています。図鑑の写真は部員の実物です。', 'Which squid show up, and how eager they are, follows a rough guide to breakwater eging in Yamaguchi by season and time of day. Atlas photos are real member catches.')}</p>
      </details>
    </div>
  </section>`;
};

/* ---------- 墨つなぎ ---------- */

const m3HTML = (lang) => {
  const T = M3_TEXT;
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => `<button type="button" class="ika-m3-cell" role="gridcell" data-i="${i}" tabindex="-1" disabled></button>`).join('');
  // バッジの絵：小松氏のコマを流用（入部＝いかり、一つ星＝星、腕前＝太陽、連鎖＝波、墨＝レアイカ、部長＝貝）
  const BADGE_TILE = { join: 0, star1: 3, skilled: 1, chain: 2, ink: RARE, captain: 4 };
  const badges = Object.entries(T.badges).map(([id, b]) => `
        <li class="ika-m3-badge" data-badge="${id}">
          <span class="ika-m3-badge-mark" aria-hidden="true">${tileImg(BADGE_TILE[id], { href: assetHref, size: 24 })}</span>
          <span class="ika-m3-badge-name">${t(lang, b.name)}</span>
          <span class="ika-m3-badge-how">${t(lang, b.how)}</span>
          <span class="ika-m3-badge-date" data-badge-date></span>
        </li>`).join('');
  const TILE_BG = ['#327de0', '#f87735', '#16bea1', '#ffcf30', '#b066d4'];
  const legend = MARKS.map((m, i) => `<li style="--legend:${TILE_BG[i]}">${tileImg(i, { href: assetHref, size: 26 })}<span>${t(lang, m.name)}</span></li>`).join('') + `<li style="--legend:#102332">${tileImg(RARE, { href: assetHref, size: 26 })}<span>${t(lang, RARE_NAME)}</span></li>`;
  return `
  <section class="ika-section ika-section--tint ika-game ika-game--sumi" id="sumi" aria-labelledby="sumi-title">
    <div class="wrap">
      <header class="ika-game-head">
        <p class="ika-eyebrow"><span class="ika-eyebrow-num">02</span>GAME TWO ・ INK LINK</p>
        <h2 id="sumi-title">${t(lang, T.name)}</h2>
        <p class="ika-head-note">${t(lang, T.tagline)}</p>
      </header>
      ${howtoHTML(lang, 'sumi')}

      <div class="ika-m3" id="ika-m3" data-lang="${lang}">
        <div class="ika-m3-top">
          <div class="ika-chips ika-chips--small" id="ika-m3-mode" role="group" aria-label="${t(lang, 'モード', 'Mode')}">
            <button type="button" class="ika-chip" data-mode="daily" aria-pressed="true">${t(lang, T.mode.daily)}</button>
            <button type="button" class="ika-chip" data-mode="free" aria-pressed="false">${t(lang, T.mode.free)}</button>
          </div>
          <p class="ika-m3-daily" id="ika-m3-daily">${t(lang, T.dailyNote)} <b id="ika-m3-day"></b></p>
        </div>

        <div class="ika-m3-main">
          <dl class="ika-m3-hud">
            <div><dt>${t(lang, T.hud.score)}</dt><dd><b id="ika-m3-score">0</b></dd></div>
            <div><dt>${t(lang, T.hud.moves)}</dt><dd><b id="ika-m3-moves">${MOVES}</b></dd></div>
            <div><dt>${t(lang, T.hud.best)}</dt><dd><b id="ika-m3-best">0</b></dd></div>
          </dl>
          <div class="ika-m3-goal" id="ika-m3-goal"><span class="ika-m3-goal-label">${t(lang, T.hud.goal)} ${GOAL.toLocaleString()}</span><span class="ika-m3-goal-track"><i id="ika-m3-goal-fill"></i></span></div>

          <div class="ika-m3-board-wrap" id="ika-m3-wrap">
            <div class="ika-m3-board" id="ika-m3-board" role="grid" aria-label="${t(lang, T.a11y.board)}" aria-rowcount="${SIZE}" aria-colcount="${SIZE}">${cells}</div>
            <div class="ika-m3-callout" id="ika-m3-callout" hidden aria-hidden="true"></div>
            <div class="ika-m3-card" id="ika-m3-card" hidden></div>
          </div>

          <div class="ika-m3-tools">
            <div class="ika-m3-ink" id="ika-m3-ink">
              <span class="ika-m3-ink-label">${t(lang, T.hud.ink)}</span>
              <span class="ika-m3-ink-track"><i id="ika-m3-ink-fill"></i></span>
            </div>
            <button type="button" class="ika-btn ika-btn--ink ika-m3-flash" id="ika-m3-flash" disabled>${t(lang, T.btn.flash)}</button>
            <button type="button" class="ika-btn ika-m3-hint" id="ika-m3-hint">${t(lang, T.btn.hint)}</button>
          </div>
          <p class="ika-m3-msg" id="ika-m3-msg" role="status" aria-live="polite"></p>
        </div>

        <aside class="ika-m3-side" aria-label="${t(lang, 'バッジ', 'Badges')}">
          <p class="ika-egi-side-head">${t(lang, 'バッジ', 'Badges')}</p>
          <ul class="ika-m3-badges" id="ika-m3-badges">${badges}</ul>
          <p class="ika-egi-side-head">${t(lang, 'マーク', 'Marks')}</p>
          <ul class="ika-m3-legend">${legend}</ul>
        </aside>
      </div>

      <details class="ika-game-rules">
        <summary>${t(lang, '遊び方', 'How to play')}</summary>
        <ol>${T.rules.map((r) => `<li>${t(lang, r)}</li>`).join('')}</ol>
        <p class="ika-small">${t(lang, '操作：マークを押してから、となりを押す（ドラッグでも可）。キーボードは矢印で移動、Enterで選択と入れ替え、Escで取り消し。', 'Controls: tap a mark, then a neighbour (or drag). Keyboard: arrows to move, Enter to select and swap, Escape to cancel.')}</p>
      </details>
    </div>
  </section>`;
};

export function render(lang) {
  const month = new Date().getMonth() + 1;   // ビルド時の月。ブラウザでは egi-ui.js が今の月に直す
  return `${pageHead(lang, HEAD)}
  ${hubHTML(lang)}
  ${egiHTML(lang, month)}
  ${m3HTML(lang)}
  <section class="ika-section ika-play-foot">
    <div class="wrap">
      ${noteHTML(lang, {
        label: pair('あそび場について', 'About the playground'),
        html: `<p>${t(
          lang,
          'ゲームはブラウザの中だけで動き、記録もこのブラウザにだけ残ります。ランキングやアカウントはありません。エギングゲームの判定は遊びのための単純化で、実際の釣りの安全や成果を保証するものではありません。',
          'Both games run entirely in your browser and records are kept only here. There are no rankings and no accounts. The eging game is a playful simplification and says nothing about real-world safety or results.'
        )}</p>`,
      })}
    </div>
  </section>`;
}

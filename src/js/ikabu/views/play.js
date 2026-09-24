// play：イカ部のあそび場。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 遊び方・説明・ゲームの土台（舞台の SVG・盤面の枠・バッジ一覧）は最初から HTML に書き、
// 動く部分は pages/play.js が games/egi-ui.js と games/match3-ui.js を結びつける。
import { t, pair, esc, assetHref, pageHref } from '../i18n.js';
import { pageHead, noteHTML } from './parts.js';
import { EGI_TEXT, M3_TEXT, HUB_TEXT, TOD, SEASON, MARKS, RARE_NAME, monthLabel, speciesName, YAMAGUCHI_SQUID, GAME_ZUKAN } from '../games/play-text.js';
import { egiSceneSVG } from '../games/egi-scene.js';
import { tileImg } from '../games/marks.js';
import { TIMES, CASTS, EGI_STOCK, EGI_SIZES, EGI_TYPES, DEFAULT_EGI, speciesPool, seasonOf, egiSecPerMeter, SEASON_MODES } from '../games/egi.js';
import { recommendedSizes, distRank, snagRank } from '../games/egi-advice.js';
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
    </div>
  </section>`;

/* ---------- しゃくって抱かせろ！ ---------- */

// エギの絵（号数で大きさ、タイプで色）。ブラウザ側でも同じ関数で描き直す
export function egiIconHTML(size = 3, type = 'normal') {
  const k = { 2.5: 0.85, 3: 1, 3.5: 1.15 }[size] ?? 1;
  const fill = { shallow: '#ff9a4d', normal: '#f47321', deep: '#d0451e' }[type] ?? '#f47321';
  return `<svg class="ika-egi-pick-icon" viewBox="-16 -8 32 50" width="${Math.round(26 * k)}" height="${Math.round(40 * k)}" aria-hidden="true" focusable="false"><g transform="scale(${k.toFixed(2)})"><path d="M0,-2 Q7,4 6,16 Q5,26 0,30 Q-5,26 -6,16 Q-7,4 0,-2 Z" fill="${fill}" stroke="#16233a" stroke-width="3" stroke-linejoin="round"/><path d="M-3,8 L3,8 M-4,15 L4,15 M-3,22 L3,22" stroke="#ffd2a8" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="3.5" r="1.8" fill="#16233a"/><path d="M-4,30 L-6,35 M0,31 L0,36 M4,30 L6,35" stroke="#16233a" stroke-width="1.6" stroke-linecap="round"/></g></svg>`;
}

// エギ選び。ブラウザ側は中身（おすすめ・特徴）だけ差し替える
export function egiPickerHTML(lang, { month = 9, tod = 'evening', egi = DEFAULT_EGI } = {}) {
  const T = EGI_TEXT.egi;
  const rec = recommendedSizes(month, tod);
  const sizes = EGI_SIZES.map((s) => `<button type="button" class="ika-chip ika-egi-size${rec.includes(s) ? ' is-rec' : ''}" data-size="${s}" aria-pressed="${String(s === egi.size)}">${s}${t(lang, '号', '')}</button>`).join('');
  const types = EGI_TYPES.map((k) => `<button type="button" class="ika-chip" data-type="${k}" aria-pressed="${String(k === egi.type)}">${t(lang, T.types[k])}</button>`).join('');
  return `
    <div class="ika-egi-pick-head"><span class="ika-egi-pick-icon-wrap" id="ika-egi-pick-icon">${egiIconHTML(egi.size, egi.type)}</span><span class="ika-egi-setup-label">${t(lang, T.title)}</span><b class="ika-egi-pick-current" id="ika-egi-pick-current">${T.current(lang, egi.size, t(lang, T.types[egi.type]))}</b></div>
    <div class="ika-egi-setup-row">
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, T.size)}</span><div class="ika-chips ika-chips--small" id="ika-egi-size" role="group" aria-label="${t(lang, T.size)}">${sizes}</div></div>
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, T.type)}</span><div class="ika-chips ika-chips--small" id="ika-egi-type" role="group" aria-label="${t(lang, T.type)}">${types}</div></div>
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
      </div>
      <p class="ika-egi-live-source" id="ika-egi-live-source">${t(lang, T.live.source)}</p>
    </div>
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

      <div class="ika-egi" id="ika-egi" data-lang="${lang}"${solo ? ' data-solo="1"' : ''}>
        <div class="ika-egi-setup" id="ika-egi-setup">${egiSetupHTML(lang, { month, tod: 'evening', solo })}</div>

        <div class="ika-egi-main">
          <div class="ika-egi-stage" id="ika-egi-stage">
            <div class="ika-egi-scene" id="ika-egi-scene">${egiSceneSVG({ lang, tod: 'evening', assetHref })}</div>
            <div class="ika-egi-hud">
              <div class="ika-egi-stock">
                <span class="ika-egi-stock-row"><span class="ika-egi-stock-label">${t(lang, T.hud.casts)}</span><span class="ika-egi-casts" id="ika-egi-casts">${castIcons}</span></span>
                <span class="ika-egi-stock-row"><span class="ika-egi-stock-label">${t(lang, T.hud.egi)}</span><span class="ika-egi-egis" id="ika-egi-egis">${egiIcons}</span><span class="ika-egi-stock-spec" id="ika-egi-spec">${T.egi.current(lang, DEFAULT_EGI.size, t(lang, T.egi.types[DEFAULT_EGI.type]))}</span></span>
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
            <div class="ika-egi-callout" id="ika-egi-callout" hidden aria-hidden="true"></div>
            <div class="ika-egi-cue" id="ika-egi-cue-label" hidden aria-hidden="true"></div>
            <div class="ika-egi-flash" id="ika-egi-flash" hidden aria-hidden="true">${t(lang, T.msg.signal)}</div>
            <div class="ika-egi-card" id="ika-egi-card" hidden></div>
          </div>

          <div class="ika-egi-controls">
            <div class="ika-egi-main-row">
              <button type="button" class="ika-egi-btn" id="ika-egi-btn" data-phase="ready">${t(lang, T.btn.ready)}</button>
              <button type="button" class="ika-egi-dart" id="ika-egi-dart" disabled title="${t(lang, T.gestures.dartHint)}" aria-label="${t(lang, T.gestures.dart)}：${t(lang, T.gestures.dartHint)}"><span class="ika-egi-dart-arrow" aria-hidden="true">↑</span><span>${t(lang, T.gestures.dart)}</span></button>
            </div>
          </div>
          <details class="ika-egi-gestures" open>
            <summary>${t(lang, T.gestures.title)}</summary>
            <p>${t(lang, T.gestures.row)}</p>
            <p class="ika-egi-gestures-keys">${t(lang, T.gestures.keys)}</p>
          </details>
          <p class="ika-egi-log" id="ika-egi-log" role="status" aria-live="polite" aria-label="${t(lang, T.a11y.log)}"></p>
        </div>

        <section class="ika-egi-zukan" id="ika-egi-zukan" aria-labelledby="ika-egi-zukan-title">
          <p class="ika-egi-side-head" id="ika-egi-zukan-title">${t(lang, T.zukan.title)} <b id="ika-egi-zukan-count">0</b> / ${GAME_ZUKAN.length}</p>
          <p class="ika-egi-cue-note">${t(lang, T.zukan.note)}</p>
          <ul class="ika-egi-zukan-grid" id="ika-egi-zukan-grid"></ul>
        </section>
        <aside class="ika-egi-side" id="ika-egi-side" aria-label="${t(lang, '記録', 'Records')}">
          <p class="ika-egi-side-head">${t(lang, '今日の釣果', 'This session')}</p>
          <ol class="ika-egi-catches" id="ika-egi-catches"><li class="ika-egi-catch-empty">${t(lang, 'まだ釣れていない', 'Nothing yet')}</li></ol>
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

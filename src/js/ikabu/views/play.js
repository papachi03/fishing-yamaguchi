// play：イカ部のあそび場。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。
// 遊び方・説明・ゲームの土台（舞台の SVG・盤面の枠・バッジ一覧）は最初から HTML に書き、
// 動く部分は pages/play.js が games/egi-ui.js と games/match3-ui.js を結びつける。
import { t, pair, esc, assetHref, pageHref } from '../i18n.js';
import { pageHead, noteHTML } from './parts.js';
import { ytHTML } from '../yt-facade.js';
import { EGI_TEXT, M3_TEXT, HUB_TEXT, TOD, SEASON, MARKS, RARE_NAME, monthLabel, speciesName, YAMAGUCHI_SQUID, GAME_ZUKAN } from '../games/play-text.js';
import { egiSceneSVG } from '../games/egi-scene.js';
import { tileImg } from '../games/marks.js';
import { TIMES, CASTS, EGI_STOCK, EGI_SIZES, EGI_TYPES, EGI_COLORS, EGI_COLOR_HEX, DEFAULT_EGI, speciesPool, seasonOf, egiSecPerMeter, SEASON_MODES, EGI_RIGS, RODS, DRAGS, DEFAULT_TACKLE } from '../games/egi.js';
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
      <div class="ika-egi-bait" id="ika-egi-tana" hidden>
        <span class="ika-egi-setup-label">${t(lang, T.tailor.tanaTitle)}</span>
        <div class="ika-chips ika-chips--small" id="ika-egi-tanas" role="group" aria-label="${t(lang, T.tailor.tanaTitle)}">
          ${['half', 'one', 'two'].map((k) => `<button type="button" class="ika-chip" data-tana="${k}" aria-pressed="${k === 'one'}">${t(lang, T.tailor.tanas[k])}</button>`).join('')}
        </div>
        <p class="ika-egi-cue-note">${t(lang, T.tailor.tanaNote)}</p>
      </div>
      <div class="ika-egi-bait" id="ika-egi-aji" hidden>
        <span class="ika-egi-setup-label">${t(lang, T.yaen.ajiTitle)}</span>
        <div class="ika-chips ika-chips--small" id="ika-egi-ajis" role="group" aria-label="${t(lang, T.yaen.ajiTitle)}">
          <button type="button" class="ika-chip" data-aji="live" aria-pressed="true">${t(lang, T.yaen.ajiLive)}</button>
          <button type="button" class="ika-chip" data-aji="dead" aria-pressed="false">${t(lang, T.yaen.ajiDead)}</button>
        </div>
        <p class="ika-egi-cue-note">${t(lang, T.yaen.ajiNote)}</p>
      </div>
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
      ${ticketsHTML(lang)}
      ${certsHTML(lang)}
      <a class="ika-play-read" href="${pageHref('egi-guide', lang)}">
        <span class="ika-play-read-tag">${t(lang, '読みもの', 'READ')}</span>
        <span class="ika-play-read-title">${t(lang, '部員おすすめ：新子シーズンのエギ選び', "Members' pick: egi for young-squid season")}</span>
        <span class="ika-play-read-desc">${t(lang, '号数と色の考え方、マズメ・日中・夜間の3タイプ別おすすめ', 'Sizes, colors, and picks for dawn, day and night anglers')}</span>
        <span class="ika-play-read-go" aria-hidden="true">→</span>
      </a>
    </div>
  </section>`;

// チケット🎫の欄（2026-09-30）：枚数と「今日あと何枚」は games/tickets-ui.js が書き込む
export const ticketsHTML = (lang) => {
  const T = HUB_TEXT.tickets;
  return `
      <section class="ika-tickets" id="ika-tickets" aria-label="${t(lang, T.title)}">
        <div class="ika-tickets-main">
          <span class="ika-tickets-icon" aria-hidden="true">🎫</span>
          <span class="ika-tickets-count"><b data-tickets-n>0</b><small>${t(lang, '枚', '')}</small></span>
          <span class="ika-tickets-left" data-tickets-left></span>
          <span class="ika-tickets-pop" data-tickets-pop aria-live="polite"></span>
        </div>
        <p class="ika-tickets-lead">${t(lang, T.lead)}</p>
        <p class="ika-tickets-how">${t(lang, T.how)}</p>
        <p class="ika-tickets-how"><a class="ika-tickets-photolink" href="${pageHref('gallery', lang)}#ika-photo-post">${t(lang, T.photoLink)}</a></p>
        <div class="ika-tickets-code" id="ika-tickets-code">
          <button type="button" class="ika-btn" data-code-open>${t(lang, T.code)}</button>
          <form class="ika-tickets-form" data-code-form hidden>
            <label class="ika-tickets-form-label" for="ika-tickets-input">${t(lang, T.codeLabel)}</label>
            <div class="ika-tickets-form-row">
              <input class="ika-tickets-input" id="ika-tickets-input" type="text" inputmode="latin" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="24" placeholder="IKABU-XXXX-XXXX" />
              <button type="submit" class="ika-btn ika-btn--primary">${t(lang, T.codeSubmit)}</button>
              <button type="button" class="ika-btn" data-code-cancel>${t(lang, T.codeCancel)}</button>
            </div>
            <p class="ika-tickets-msg" data-code-msg role="status" aria-live="polite"></p>
          </form>
        </div>
      </section>`;
};

// ゴールド認定証の欄（2026-09-30）：中身（そろい具合・取った日）は games/certs-ui.js が記録から書き込む
export const certsHTML = (lang) => {
  const C = HUB_TEXT.certs;
  const card = (id) => `
        <li class="ika-cert ika-cert--${id}" data-cert="${id}">
          <img class="ika-cert-art" src="${assetHref(`/assets/ikabu/certs/cert_${id}_300.webp`)}" alt="" width="300" height="200" loading="lazy" decoding="async" />
          <span class="ika-cert-seal" aria-hidden="true"><i></i></span>
          <span class="ika-cert-name">${t(lang, C.names[id])}</span>
          <span class="ika-cert-how">${t(lang, C.how[id])}</span>
          <span class="ika-cert-progress" data-cert-progress></span>
          <span class="ika-cert-date" data-cert-date></span>
          <button type="button" class="ika-btn ika-cert-make" data-cert-make hidden>${t(lang, C.make)}</button>
        </li>`;
  return `
      <section class="ika-certs" id="ika-certs" aria-label="${t(lang, C.title)}">
        <p class="ika-certs-head"><span class="ika-certs-tag">${t(lang, 'GOLD', 'GOLD')}</span>${t(lang, C.title)}</p>
        <p class="ika-certs-lead">${t(lang, C.lead)}</p>
        <ul class="ika-cert-list">${['sumi', 'rush', 'egi', 'honor'].map(card).join('')}</ul>
        <form class="ika-cert-form" id="ika-cert-form" hidden>
          <label class="ika-cert-form-label" for="ika-cert-name">${t(lang, C.nameLabel)}</label>
          <div class="ika-cert-form-row">
            <input class="ika-cert-input" id="ika-cert-name" type="text" maxlength="16" autocomplete="nickname" placeholder="${t(lang, C.namePlaceholder)}" />
            <button type="submit" class="ika-btn ika-btn--primary">${t(lang, C.draw)}</button>
          </div>
          <p class="ika-cert-form-note">${t(lang, C.nameNote)}</p>
        </form>
      </section>`;
};

// 遊び方の動画（childダディの YouTube、2026-09-26）。2026-09-29 からエギング・墨つなぎの単体ページ（テストプレイ）にも出す
const HOWTO = {
  egi: { id: 'U7OJCHXPQGg', poster: '/assets/ikabu/egi-video-poster.jpg', len: pair('約6分半', 'about 6.5 min') },   // 2026-09-28 第4版（BGM入り・初心者練習／季節／くわしい条件／ヤエン・テーラー）。限定公開
  sumi: { id: 'YNhydWdt2e4', poster: '/assets/ikabu/sumi-video-poster.jpg', len: pair('約6分半', 'about 6.5 min') },   // 2026-09-28 第2版（スペシャルパネル・コンボ）に差し替え。前の動画は非公開
  // 2026-09-29 新モード「墨のがれ」の遊び方（NotebookLMの声・約4分）。限定公開
  rush: { id: 'D-jfzMggEdc', poster: '/assets/ikabu/rush-video-poster.jpg', len: pair('約4分', 'about 4 min'), what: pair('新モード「墨のがれ」の遊び方', 'the new Ink Escape mode') },
};
const howtoHTML = (lang, game) => {
  const v = HOWTO[game];
  return `
      <div class="ika-howto">
        <div class="ika-howto-video">${ytHTML(lang, { id: v.id, poster: v.poster, label: pair('遊び方の動画を再生', 'Play the how-to video') })}</div>
        <p class="ika-howto-text"><span class="ika-howto-tag">${t(lang, '動画', 'VIDEO')}</span>${t(lang, `${v.what ? v.what.ja : '遊び方'}を${v.len.ja}で紹介しています。押すと再生します（YouTube）。`, `A ${v.len.en} how-to video${v.what ? ` for ${v.what.en}` : ''} (in Japanese). Tap to play on YouTube.`)}</p>
      </div>`;
};

/* ---------- しゃくって抱かせろ！ ---------- */

// エギの絵（号数で大きさ、タイプで色）。ブラウザ側でも同じ関数で描き直す
export const EGI_LEGS_D = 'M-5,10 Q-9,8 -10,5 M-5.5,15 Q-9.5,13 -10.5,10 M-5.5,20 Q-9.5,18 -10.5,15 M-4.5,25 Q-8.5,23 -9.5,20 M-3,29 Q-6.5,27 -7.5,24';   // 足つき：腹側（海底を向く -x 側）にエビの足のような短い足5本。足は頭側（-y）へ向く（2026-10-01 ぱっぱ：尻側に向けたら「逆」）   // 足つき：腹側（舞台で海底を向く -x 側。+x だと水面を向いた）にエビの足のような短い足5本（2026-10-01 ぱっぱの絵）   // 足つき：腹側（舞台で海底を向く +x 側）にエビの足のような短い足5本（2026-10-01 ぱっぱの絵。最初 -x 側に描いたら水面を向いた）   // 足つき：腹側（海底側）にエビの足のような短い足5本（2026-10-01 ぱっぱの絵）   // 足つきの足（舞台の絵と同じ形。games/egi-ui.js の paintEgi）
export function egiIconHTML(size = 3, type = 'normal', color = 'orange', rig = 'normal') {
  const k = { 2.5: 0.85, 3: 1, 3.5: 1.15 }[size] ?? 1;
  const fill = EGI_COLOR_HEX[color] ?? '#f47321';
  const legs = rig === 'legs' ? `<path d="${EGI_LEGS_D}" fill="none" stroke="#16233a" stroke-width="2.2" stroke-linecap="round"/>` : '';
  return `<svg class="ika-egi-pick-icon" viewBox="-16 -8 32 50" width="${Math.round(26 * k)}" height="${Math.round(40 * k)}" aria-hidden="true" focusable="false"><g transform="scale(${k.toFixed(2)})"><path d="M0,-2 Q7,4 6,16 Q5,26 0,30 Q-5,26 -6,16 Q-7,4 0,-2 Z" fill="${fill}" stroke="#16233a" stroke-width="3" stroke-linejoin="round"/><path d="M-3,8 L3,8 M-4,15 L4,15 M-3,22 L3,22" stroke="#ffd2a8" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="3.5" r="1.8" fill="#16233a"/><path d="M-4,30 L-6,35 M0,31 L0,36 M4,30 L6,35" stroke="#16233a" stroke-width="1.6" stroke-linecap="round"/>${legs}</g></svg>`;
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
    <div class="ika-egi-pick-head"><button type="button" class="ika-egi-pick-icon-wrap" id="ika-egi-pick-icon" title="${t(lang, EGI_TEXT.tackle.legsTap)}" aria-label="${t(lang, EGI_TEXT.tackle.legsTap)}">${egiIconHTML(egi.size, egi.type, egi.color)}</button><span class="ika-egi-setup-label">${t(lang, T.title)}</span><b class="ika-egi-pick-current" id="ika-egi-pick-current">${T.current(lang, egi.size, t(lang, T.types[egi.type]))}</b></div>
    <div class="ika-egi-setup-row">
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, T.size)}</span><div class="ika-chips ika-chips--small" id="ika-egi-size" role="group" aria-label="${t(lang, T.size)}">${sizes}</div></div>
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, T.type)}</span><div class="ika-chips ika-chips--small" id="ika-egi-type" role="group" aria-label="${t(lang, T.type)}">${types}</div></div>
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, T.color)}</span><div class="ika-egi-colors" id="ika-egi-color" role="group" aria-label="${t(lang, T.color)}">${colorChipsHTML(lang, egi.color)}</div></div>
      <div class="ika-egi-setup-item"><span class="ika-egi-setup-label">${t(lang, EGI_TEXT.tackle.rig)}</span><div class="ika-chips ika-chips--small" id="ika-egi-rig" role="group" aria-label="${t(lang, EGI_TEXT.tackle.rig)}">${EGI_RIGS.map((k) => `<button type="button" class="ika-chip" data-rig="${k}" aria-pressed="${String(k === (egi.rig ?? 'normal'))}">${t(lang, EGI_TEXT.tackle.rigs[k])}</button>`).join('')}</div><small class="ika-egi-cue-note">${t(lang, EGI_TEXT.tackle.rigNote)}</small></div>
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

// タックルのリボン（2026-10-01）：ロッド／ドラグ／エギの3つの札。押した札の中身だけ下に開く（量が多くても縦に伸びない）
export function tackleRibbonHTML(lang, { month = 9, tod = 'evening', tackle = DEFAULT_TACKLE, egi = DEFAULT_EGI } = {}) {
  const T = EGI_TEXT.tackle;
  const tab = (key, label, value) => `<button type="button" class="ika-egi-tk-tab" data-tk-tab="${key}" aria-expanded="${String(key === 'egi')}" aria-controls="ika-egi-tk-${key}"><span class="ika-egi-tk-tab-name">${label}</span><b class="ika-egi-tk-tab-val" data-tk-val="${key}">${value}</b></button>`;
  const rods = RODS.map((k) => `<button type="button" class="ika-chip" data-rod="${k}" aria-pressed="${String(k === tackle.rod)}">${t(lang, T.rods[k])}</button>`).join('');
  const drags = DRAGS.map((k) => `<button type="button" class="ika-chip" data-drag="${k}" aria-pressed="${String(k === tackle.drag)}">${t(lang, T.drags[k])}<small>${t(lang, T.dragTag[k])}</small></button>`).join('');
  return `
    <div class="ika-egi-tk" id="ika-egi-tk">
      <div class="ika-egi-tk-tabs" role="tablist">
        ${tab('rod', t(lang, T.rod), t(lang, T.rods[tackle.rod]))}
        ${tab('drag', t(lang, T.drag), t(lang, T.drags[tackle.drag]))}
        ${tab('egi', t(lang, EGI_TEXT.egi.title), EGI_TEXT.egi.current(lang, egi.size, t(lang, EGI_TEXT.egi.types[egi.type])))}
      </div>
      <div class="ika-egi-tk-panel" id="ika-egi-tk-rod" data-tk-panel="rod" hidden>
        <div class="ika-chips ika-chips--small" id="ika-egi-rod" role="group" aria-label="${t(lang, T.rod)}">${rods}</div>
        <p class="ika-egi-cue-note" id="ika-egi-rod-note">${t(lang, T.rodNote[tackle.rod])}</p>
      </div>
      <div class="ika-egi-tk-panel" id="ika-egi-tk-drag" data-tk-panel="drag" hidden>
        <div class="ika-chips ika-chips--small ika-egi-drags" id="ika-egi-drag" role="group" aria-label="${t(lang, T.drag)}">${drags}</div>
        <p class="ika-egi-cue-note" id="ika-egi-drag-note">${t(lang, T.dragNote[tackle.drag])}</p>
      </div>
      <div class="ika-egi-tk-panel" id="ika-egi-tk-egi" data-tk-panel="egi">
        <div class="ika-egi-pick" id="ika-egi-pick">${egiPickerHTML(lang, { month, tod, egi })}</div>
      </div>
    </div>`;
}

export function egiSetupHTML(lang, { month = 9, tod = 'evening', solo = false } = {}) {
  const T = EGI_TEXT;
  const chips = TIMES.map((k) => `<button type="button" class="ika-chip" data-tod="${k}" aria-pressed="${String(k === tod)}">${t(lang, TOD[k])}</button>`).join('');
  const months = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === month ? ' selected' : ''}>${monthLabel(lang, i + 1)}</option>`).join('');
  const winds = [['calm', T.practice.calm], ['breezy', T.practice.breezy], ['strong', T.practice.strong]]
    .map(([k, v], i) => `<button type="button" class="ika-chip" data-wind="${k}" aria-pressed="${String(i === 0)}">${t(lang, v)}</button>`).join('');
  return `
    <!-- 区画①フィールド（2026-10-01 ぱっぱ：設定はフィールド／タックル／取り込み方の3区画に色分け） -->
    <div class="ika-egi-zone ika-egi-zone--field">
    <p class="ika-egi-zone-head"><b>🌊 ${t(lang, T.zones.field)}</b><small>${t(lang, T.zones.fieldSub)}</small></p>
    <!-- 今日の萩の海：ブラウザで YFJ の海況を取って埋める（取れなければ練習モード） -->
    <div class="ika-egi-live" id="ika-egi-live" data-state="loading">
      <div class="ika-egi-live-head">
        <span class="ika-egi-setup-label">${t(lang, T.live.title)}</span>
        <span class="ika-egi-live-time" id="ika-egi-live-time"></span>
      </div>
      <div class="ika-egi-live-body" id="ika-egi-live-body"><p class="ika-egi-live-loading">${t(lang, T.live.loading)}</p></div>
      <p class="ika-egi-live-notice" id="ika-egi-live-notice" hidden></p>
      <p class="ika-egi-setup-label ika-egi-live-pick">${t(lang, T.live.pick)}</p>
      <div class="ika-egi-live-actions">
        <button type="button" class="ika-btn ika-btn--primary" id="ika-egi-play-live" disabled><b>${t(lang, T.live.playLive)}</b><small>${t(lang, T.live.playLiveSub)}</small></button>
        <button type="button" class="ika-btn" id="ika-egi-play-practice" aria-expanded="false" aria-controls="ika-egi-practice"><b>${t(lang, T.live.playPractice)}</b><small>${t(lang, T.live.playPracticeSub)}</small></button>
        <button type="button" class="ika-btn ika-egi-play-beginner" id="ika-egi-play-beginner"><b>${t(lang, T.live.playBeginner)}</b><small>${t(lang, T.live.playBeginnerSub)}</small></button>
      </div>
      <!-- 季節を選んで遊ぶ：ボタンのすぐ下に開く（2026-09-29 ぱっぱ） -->
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
            <span class="ika-egi-setup-label">${t(lang, T.practice.moon)}</span>
            <div class="ika-chips ika-chips--small" id="ika-egi-moon" role="group" aria-label="${t(lang, T.practice.moon)}"><button type="button" class="ika-chip" data-moon="new" aria-pressed="false">🌑 ${t(lang, T.practice.moonNew)}</button><button type="button" class="ika-chip" data-moon="half" aria-pressed="true">🌓 ${t(lang, T.practice.moonHalf)}</button><button type="button" class="ika-chip" data-moon="full" aria-pressed="false">🌕 ${t(lang, T.practice.moonFull)}</button></div>
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
        <h4>${t(lang, T.tips.lureTitle)}</h4>
        <p>${t(lang, T.tips.lureBody)}</p>
        <h4>${t(lang, T.tips.moveTitle)}</h4>
        <p>${t(lang, T.tips.moveBody)}</p>
      </details>
      <p class="ika-egi-live-source" id="ika-egi-live-source">${t(lang, T.live.source)}</p>
    </div>
    </div>
    <div class="ika-egi-zone ika-egi-zone--tackle" id="ika-egi-tackle">
    <p class="ika-egi-zone-head"><b>🎣 ${t(lang, T.zones.tackle)}</b><small>${t(lang, T.zones.tackleSub)}</small></p>
    ${methodPickHTML(lang)}
    ${tackleRibbonHTML(lang, { month, tod })}
    <p class="ika-egi-cue-note">🦑 ${t(lang, T.angler.tap)}</p>
    </div>
    <div class="ika-egi-zone ika-egi-zone--land">
    <p class="ika-egi-zone-head"><b>🪝 ${t(lang, T.zones.land)}</b><small>${t(lang, T.zones.landSub)}</small></p>
    <p class="ika-egi-land-rule"><span class="ika-egi-land-step"><i>🤏</i>${t(lang, T.land.lift)}<small>〜500g</small></span><span class="ika-egi-land-step"><i>🥅</i>${t(lang, T.land.net)}<small>500g〜1.5kg</small></span><span class="ika-egi-land-step"><i>🪝</i>${t(lang, T.land.gaff)}<small>1.5kg〜</small></span></p>
    <p class="ika-egi-cue-note">${t(lang, T.land.note)}</p>
    </div>
    <div class="ika-egi-zone ika-egi-zone--control">
    <p class="ika-egi-zone-head"><b>🎮 ${t(lang, T.zones.control)}</b></p>
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
      <div class="ika-chips ika-chips--small" id="ika-egi-feel-shake" role="group" aria-label="${t(lang, T.feel.shake)}" hidden>
        <span class="ika-egi-feel-name">${t(lang, T.feel.shake)}</span>
        <button type="button" class="ika-chip" data-feel="shake" data-on="1" aria-pressed="false">${t(lang, T.feel.on)}</button>
        <button type="button" class="ika-chip" data-feel="shake" data-on="0" aria-pressed="true">${t(lang, T.feel.off)}</button>
        <p class="ika-egi-shake-warn" id="ika-egi-shake-warn" role="status" hidden>${t(lang, T.feel.shakeOn)}</p>
        <span class="ika-egi-cue-note">${t(lang, T.feel.shakeNote)}</span>
      </div>
      <span class="ika-egi-cue-note">${t(lang, T.feel.note)}</span>
    </div>
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
        <p class="ika-head-note">${t(lang, T.tagline)}${solo ? t(lang, '今の萩の風・波・潮で釣れ具合が変わります。', ' Today’s real wind, waves and tide in Hagi set the mood.') : ''}</p>
      </header>
      ${howtoHTML(lang, 'egi')}   <!-- 2026-09-29 ぱっぱ：テストプレイ（単体ページ）にも遊び方の動画を出す -->

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
                <span class="ika-egi-count-label" id="ika-egi-reel-label">${t(lang, T.hud.dist)}</span>
                <b class="ika-egi-count-num"><span id="ika-egi-dist">0</span><small>m</small></b>
                <em class="ika-egi-reel-delta" id="ika-egi-reel-delta" hidden></em>
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
            <!-- BGMのスピーカー（右上の角。設定の中の行はやめた：2026-10-01 ぱっぱ） -->
            <button type="button" class="ika-egi-bgmbtn" id="ika-egi-bgmbtn" aria-pressed="false" aria-label="${t(lang, T.feel.bgm)}">🔇</button>
            <p class="ika-egi-fullnote" id="ika-egi-fullnote" role="status" hidden>${t(lang, T.fullNote)}</p>
            <div class="ika-egi-colortip" id="ika-egi-colortip" hidden>${t(lang, T.egi.colorTap).split('|').map((w) => `<span>${w}</span>`).join('')}</div>
            <div class="ika-egi-anglerpop" id="ika-egi-anglerpop" role="dialog" aria-label="${t(lang, T.angler.title)}" hidden></div>
            <div class="ika-egi-colorpop" id="ika-egi-colorpop" role="dialog" aria-label="${t(lang, T.egi.colorTitle)}" hidden>
              <p class="ika-egi-colorpop-title">${t(lang, T.egi.colorTitle)}</p>
              <div class="ika-egi-colors" id="ika-egi-colorpop-chips">${colorChipsHTML(lang, DEFAULT_EGI.color)}</div>
              <p class="ika-egi-colorpop-why" id="ika-egi-colorpop-why"></p>
              <div class="ika-egi-colorpop-rig"><span class="ika-egi-setup-label">${t(lang, T.tackle.rig)}</span><div class="ika-chips ika-chips--small" id="ika-egi-colorpop-rig" role="group" aria-label="${t(lang, T.tackle.rig)}">${EGI_RIGS.map((k) => `<button type="button" class="ika-chip" data-rig="${k}" aria-pressed="${String(k === 'normal')}">${t(lang, T.tackle.rigs[k])}</button>`).join('')}</div></div>
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
            <!-- テーラー（2026-09-28）：3本のウキそれぞれの「合わせる」 -->
            <div class="ika-egi-tailorbtns" id="ika-egi-tailorbtns" hidden>
              ${['green', 'red', 'orange'].map((c, i) => `<button type="button" class="ika-egi-tbtn" data-float="${i}" data-color="${c}" data-stage="idle"><span class="ika-egi-tbtn-dot" aria-hidden="true"></span><b>${t(lang, T.tailor.colors[c])}</b><small data-state>${t(lang, T.tailor.states.idle)}</small></button>`).join('')}
            </div>
            <div class="ika-egi-main-row">
              <button type="button" class="ika-egi-btn" id="ika-egi-btn" data-phase="ready">${t(lang, T.btn.ready)}</button>
              <button type="button" class="ika-egi-dart" id="ika-egi-dart" disabled title="${t(lang, T.gestures.dartHint)}" aria-label="${t(lang, T.gestures.dart)}：${t(lang, T.gestures.dartHint)}"><span class="ika-egi-dart-arrow" aria-hidden="true">↑</span><span>${t(lang, T.gestures.dart)}</span></button>
            </div>
          </div>
          <details class="ika-egi-gestures" open>
            <summary>${t(lang, T.gestures.title)}</summary>
            <p id="ika-egi-gest-row">${t(lang, T.gestures.row)}</p>
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

export const m3HTML = (lang) => {
  const T = M3_TEXT;
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => `<button type="button" class="ika-m3-cell" role="gridcell" data-i="${i}" tabindex="-1" disabled></button>`).join('');
  // バッジの絵：小松氏のコマを流用（入部＝いかり、一つ星＝星、腕前＝太陽、連鎖＝波、墨＝レアイカ、部長＝貝）
  const BADGE_TILE = { join: 0, star1: 3, skilled: 1, chain: 2, ink: RARE, captain: 4, stars3: 3, chain6: 2, ink4: RARE, score5k: 1, score7k: 4, score9k: RARE };
  const badges = Object.entries(T.badges).map(([id, b]) => `
        <li class="ika-m3-badge" data-badge="${id}">
          <span class="ika-m3-badge-mark" aria-hidden="true">${tileImg(BADGE_TILE[id], { href: assetHref, size: 24 })}</span>
          <span class="ika-m3-badge-name">${t(lang, b.name)}</span>
          <span class="ika-m3-badge-how">${t(lang, b.how)}</span>
          <span class="ika-m3-badge-date" data-badge-date></span>
        </li>`).join('');
  const TILE_BG = ['#327de0', '#f87735', '#16bea1', '#ffcf30', '#b066d4'];
  // 墨のがれのバッジ（2026-09-30）：墨つなぎとは別の一覧
  const RUSH_TILE = { r_join: 2, r_30s: 0, r_fire: RARE, r_60s: 1, r_5k: 3, r_120s: 4, r_10k: 3, r_flush: 2, r_150s: 1, r_13k: 4, r_210s: RARE, r_18k: RARE };
  const rushBadges = Object.entries(T.rushBadges).map(([id, b]) => `
        <li class="ika-m3-badge" data-badge="${id}">
          <span class="ika-m3-badge-mark" aria-hidden="true">${tileImg(RUSH_TILE[id], { href: assetHref, size: 24 })}</span>
          <span class="ika-m3-badge-name">${t(lang, b.name)}</span>
          <span class="ika-m3-badge-how">${t(lang, b.how)}</span>
          <span class="ika-m3-badge-date" data-badge-date></span>
        </li>`).join('');
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
      ${howtoHTML(lang, 'rush')}

      <div class="ika-m3" id="ika-m3" data-lang="${lang}">
        <div class="ika-m3-top">
          <div class="ika-chips ika-chips--small ika-m3-modes" id="ika-m3-mode" role="group" aria-label="${t(lang, 'モード', 'Mode')}">
            <button type="button" class="ika-chip" data-mode="daily" aria-pressed="true">${t(lang, T.mode.daily)}</button>
            <button type="button" class="ika-chip" data-mode="free" aria-pressed="false">${t(lang, T.mode.free)}</button>
            <!-- 墨のがれ：別の遊び方なので大きな札にする（10/3 ぱっぱ：小さくて別のモードがあると分かりにくい） -->
            <button type="button" class="ika-chip ika-chip--rush" data-mode="rush" aria-pressed="false"><span class="ika-m3-rush-ic" aria-hidden="true">🌊</span><span class="ika-m3-rush-tx"><b>${t(lang, T.mode.rush)}</b><small>${t(lang, T.mode.rushSub)}</small></span><i class="ika-m3-rush-new">${t(lang, T.mode.rushNew)}</i></button>
          </div>
          <p class="ika-m3-daily" id="ika-m3-daily">${t(lang, T.dailyNote)} <b id="ika-m3-day"></b></p>
          <!-- 説明は1行の要約＋たたんだ「遊び方」（2026-09-30：長い説明で盤面が画面の外に出ていた） -->
          <div class="ika-m3-daily ika-m3-rush-note" id="ika-m3-rush-note" hidden>
            <p>${t(lang, T.rush.lead)}</p>
            <details><summary>${t(lang, T.rush.howto)}</summary><p>${t(lang, T.rush.note)}</p></details>
          </div>
        </div>

        <div class="ika-m3-main">
          <dl class="ika-m3-hud">
            <div><dt>${t(lang, T.hud.score)}</dt><dd><b id="ika-m3-score">0</b></dd></div>
            <div><dt id="ika-m3-moves-label">${t(lang, T.hud.moves)}</dt><dd><b id="ika-m3-moves">${MOVES}</b></dd></div>
            <div><dt>${t(lang, T.hud.best)}</dt><dd><b id="ika-m3-best">0</b></dd></div>
          </dl>
          <div class="ika-m3-goal" id="ika-m3-goal"><span class="ika-m3-goal-label" id="ika-m3-goal-label">${t(lang, T.hud.today)} ${GOAL.toLocaleString()}</span><span class="ika-m3-stars" id="ika-m3-stars" aria-live="polite">☆☆☆</span><span class="ika-m3-goal-track"><i id="ika-m3-goal-fill"></i></span></div>

          <!-- 墨のがれ：イカの舞台（表情・次に落ちる列・墨メーター）。2026-09-29 -->
          <div class="ika-m3-rush" id="ika-m3-rush" hidden>
            <div class="ika-m3-rush-cave has-art" aria-hidden="true" style="background-image:url('${assetHref('/assets/ikabu/tiles/cave.webp')}')"><svg viewBox="0 0 400 184" preserveAspectRatio="none">
              <defs><linearGradient id="ika-cave-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26343d"/><stop offset="1" stop-color="#3b4b55"/></linearGradient>
              <linearGradient id="ika-cave-rock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6f7f88"/><stop offset="1" stop-color="#46545c"/></linearGradient></defs>
              <rect width="400" height="184" fill="url(#ika-cave-bg)"/>
              <path d="M60 184 C70 120 110 96 150 108 C190 80 240 88 262 110 C300 96 336 118 342 184 Z" fill="#33424b"/>
              <path d="M0 0 H400 V20 L382 24 L372 46 L360 26 L338 30 L326 56 L312 28 L286 22 L270 40 L258 20 L230 24 L214 50 L200 22 L176 26 L160 44 L146 22 L118 28 L106 52 L92 26 L70 22 L56 42 L44 22 L20 24 L0 18 Z" fill="url(#ika-cave-rock)" stroke="#1e262b" stroke-width="3" stroke-linejoin="round"/>
              <path d="M0 18 L20 24 L28 60 L18 92 L30 130 L20 160 L28 184 H0 Z" fill="url(#ika-cave-rock)" stroke="#1e262b" stroke-width="3" stroke-linejoin="round"/>
              <path d="M400 20 L382 24 L374 58 L386 96 L372 128 L384 160 L374 184 H400 Z" fill="url(#ika-cave-rock)" stroke="#1e262b" stroke-width="3" stroke-linejoin="round"/>
              <path d="M150 184 L150 158 C150 150 160 146 172 148 L230 148 C242 146 252 152 250 160 L250 184 Z" fill="url(#ika-cave-rock)" stroke="#1e262b" stroke-width="3" stroke-linejoin="round"/>
              <g fill="#8f9ea6" opacity="0.7"><circle cx="12" cy="44" r="3"/><circle cx="16" cy="118" r="2.5"/><circle cx="390" cy="80" r="3"/><circle cx="388" cy="142" r="2.5"/><circle cx="82" cy="10" r="2.5"/><circle cx="300" cy="9" r="3"/></g>
              <g fill="#2e7d5b" stroke="#1e262b" stroke-width="2"><path d="M34 184 C28 168 42 160 34 146 C46 158 40 170 46 184 Z"/><path d="M360 184 C356 170 368 164 362 150 C374 162 368 172 372 184 Z"/></g>
            </svg></div>
            <div class="ika-m3-rush-wall is-l" aria-hidden="true"></div><div class="ika-m3-rush-wall is-r" aria-hidden="true"></div>
            <div class="ika-m3-rush-pipe" aria-hidden="true"><i></i></div>
            <div class="ika-m3-rush-sky" aria-hidden="true"><i></i><i></i><i></i></div>
            <div class="ika-m3-rush-ledge" aria-hidden="true"></div>
            <div class="ika-m3-rush-squid" id="ika-m3-rush-squid" data-mood="calm"><img id="ika-m3-rush-face" src="${assetHref('/assets/ikabu/mascot/wink.webp')}" alt="" width="96" height="100" decoding="async" /><span class="ika-m3-rush-sweat" aria-hidden="true"><i></i><i></i><i></i></span><span class="ika-m3-rush-alert" aria-hidden="true"><i>!</i><i>!</i></span><span class="ika-m3-rush-pale" aria-hidden="true"></span><b id="ika-m3-rush-say">${t(lang, T.rush.moods.calm)}</b></div>
            <div class="ika-m3-rush-pool" id="ika-m3-rush-pool" aria-hidden="true"><svg class="ika-m3-inkwave" viewBox="0 0 200 100" preserveAspectRatio="none"><path class="ika-m3-wave" d="M0 30 Q25 18 50 30 T100 30 T150 30 T200 30 T250 30 T300 30 V100 H0 Z" fill="#132033"/><path class="ika-m3-wave is-2" d="M0 40 Q25 28 50 40 T100 40 T150 40 T200 40 T250 40 T300 40 V100 H0 Z" fill="#1f3050" opacity="0.6"/></svg><i></i></div>
            <div class="ika-m3-rush-gauge" id="ika-m3-rush-gauge" role="status"><b id="ika-m3-rush-level">0/30</b><span id="ika-m3-rush-next"></span></div>
          </div>
          <div class="ika-m3-board-wrap" id="ika-m3-wrap">
            <div class="ika-m3-board" id="ika-m3-board" role="grid" aria-label="${t(lang, T.a11y.board)}" aria-rowcount="${SIZE}" aria-colcount="${SIZE}">${cells}</div>
            <div class="ika-m3-callout" id="ika-m3-callout" hidden aria-hidden="true"></div>
            <div class="ika-m3-card" id="ika-m3-card" hidden></div>
          </div>

          <div class="ika-m3-tools">
            <div class="ika-m3-ink" id="ika-m3-ink">
              <!-- バーの横のイカ：たまるまではふつうの顔、満タンで墨を吐くイカに（2026-09-30 30代女性のアイデア） -->
              <span class="ika-m3-ink-squid" aria-hidden="true"><img class="is-wait" src="${assetHref('/assets/ikabu/mascot/wink.webp')}" alt="" width="40" height="44" decoding="async" /><img class="is-go" src="${assetHref('/assets/ikabu/mascot/squirt.webp')}" alt="" width="46" height="44" decoding="async" /></span>
              <span class="ika-m3-ink-label">${t(lang, T.hud.ink)}</span>
              <span class="ika-m3-ink-track"><i id="ika-m3-ink-fill"></i></span>
            </div>
            <button type="button" class="ika-btn ika-btn--ink ika-m3-flash" id="ika-m3-flash" disabled>${t(lang, T.btn.flash)}</button>
            <button type="button" class="ika-btn ika-m3-sound ika-m3-hint" id="ika-m3-hint" aria-label="${t(lang, T.btn.hint)}" title="${t(lang, T.btn.hint)}">💡</button>
            <button type="button" class="ika-btn ika-m3-sound" id="ika-m3-sound" aria-pressed="true" aria-label="${t(lang, T.btn.soundOff)}">🔊</button>
            <button type="button" class="ika-btn ika-m3-sound ika-m3-bgm" id="ika-m3-bgm" aria-pressed="false" aria-label="${t(lang, T.btn.bgmOn)}" title="${t(lang, T.btn.bgmOn)}">🎵</button>
          </div>
          <p class="ika-m3-msg" id="ika-m3-msg" role="status" aria-live="polite"></p>
          <!-- マスの右下の記号（色の見分けを助ける）：最初は隠す。必要な人だけオン（2026-09-30 感想「右下のマークでイカが隠れる」） -->
          <button type="button" class="ika-m3-symtoggle" id="ika-m3-sym" aria-pressed="false">${t(lang, T.btn.symbolsOn)}</button>
        </div>

        <aside class="ika-m3-side" aria-label="${t(lang, 'バッジ', 'Badges')}">
          <p class="ika-egi-side-head">${t(lang, '墨つなぎのバッジ', 'Ink Link badges')}</p>
          <ul class="ika-m3-badges" id="ika-m3-badges">${badges}</ul>
          <p class="ika-egi-side-head">${t(lang, '墨のがれのバッジ', 'Ink Escape badges')}</p>
          <ul class="ika-m3-badges" id="ika-m3-rbadges">${rushBadges}</ul>
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

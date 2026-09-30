// games：テストプレイ版のTOP（2026-09-30 ぱっぱ「エギング・パズル・ガチャ・カードゲームのページを作って各ゲームから戻れるように」）。
// 4つの入口タイル＋🎫と認定証の欄（各ゲームのページからここへ集約。ゲームの下に重ねて出さない）
import { t, pair, pageHref, assetHref } from '../i18n.js';
import { EGI_TEXT, M3_TEXT, HUB_TEXT } from '../games/play-text.js';
import { tileImg } from '../games/marks.js';
import { RARE } from '../games/match3.js';
import { certsHTML, ticketsHTML } from './play.js';

const TILES = [
  { page: 'egi', no: '01', name: EGI_TEXT.name, desc: EGI_TEXT.tagline, tag: HUB_TEXT.flagship, cls: 'egi' },
  { page: 'sumi', no: '02', name: M3_TEXT.name, desc: pair('3つそろえて消すパズル。時間制の「墨のがれ」も', 'Match three to clear. Includes the timed Ink Escape mode'), tag: HUB_TEXT.daily, cls: 'sumi' },
  { page: 'gacha', no: '03', name: pair('イカ部ガチャ', 'Squid Gacha'), desc: pair('🎫を使って、エギングの動きでカードを引く', 'Spend 🎫 and reel in cards, eging style'), tag: pair('カードを集める', 'Collect cards'), cls: 'gacha' },
  { page: 'cards', no: '04', name: pair('イカカード', 'Squid Cards'), desc: pair('バインダーでコレクション・かけらで交換。対戦は準備中', 'Your binder and shard trades. Battles coming soon'), tag: pair('集めて交換', 'Collect & trade'), cls: 'cards' },
];

export const HEAD = {
  title: pair('イカ部のあそび場', 'The Playground'),
  lead: pair('遊ぶとチケット🎫がたまり、ガチャでカードが引けます。記録はこのブラウザにだけ残ります。', 'Play to earn 🎫 and pull cards in the gacha. Records stay in this browser.'),
};

const tile = (lang, x) => `
        <a class="ika-play-card ika-play-card--${x.cls}" href="${pageHref(x.page, lang)}">
          <span class="ika-play-card-tag">${t(lang, x.tag)}</span>
          <span class="ika-play-card-no">${x.no}</span>
          <span class="ika-play-card-name">${t(lang, x.name)}</span>
          <span class="ika-play-card-desc">${t(lang, x.desc)}</span>
          <span class="ika-play-card-go">${t(lang, HUB_TEXT.play)} <span aria-hidden="true">→</span></span>
        </a>`;

export function render(lang) {
  return `
  <section class="ika-section ika-games-top" id="top">
    <div class="wrap">
      <p class="ika-eyebrow"><span class="ika-eyebrow-num">TOP</span>${t(lang, 'テストプレイ版', 'TEST PLAY')}</p>
      <h1 class="ika-games-title">${t(lang, HEAD.title)}</h1>
      <p class="ika-games-lead">${t(lang, HEAD.lead)}</p>
      <div class="ika-play-cards ika-games-tiles">${TILES.map((x) => tile(lang, x)).join('')}</div>
      ${ticketsHTML(lang)}
      ${certsHTML(lang)}
      <p class="ika-play-note">${t(lang, '先行版です。URLはほかの方に送らないでくださいね。', 'Early access. Please do not share the URL.')}</p>
    </div>
  </section>`;
}

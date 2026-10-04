// studio：LINEスタンプ（2026-10-04 作り直し。前は「スタンプとSNS」で試作8点・SNSは準備中）。
// render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。発売日・LINE STORE の住所は ../stamps.js にまとめてある
import { t, pair, esc, assetHref } from '../i18n.js';
import { LINE_ADD_URL } from '../games/links.js';
import { STAMP_SETS, STAMP_PUNS, STAMP_RELEASE, STAMP_COPYRIGHT } from '../stamps.js';
import { pageHead, sectionHead, noteHTML } from './parts.js';
import { gameTilesHTML } from './games.js';

export const HEAD = {
  num: '07',
  eyebrow: 'LINE STICKERS',
  crumb: pair('LINEスタンプ', 'LINE stickers'),
  title: pair('イカしたスタンプ、<br class="sp-only" />3セット同時発売。', 'Three sticker sets,<br class="sp-only" /> all at once.'),
  desc: pair('山口イカ部のイカが、ダジャレを言いながら動くLINEスタンプ。毎日のあいさつに、山口の言葉に、釣り仲間への返事に。', 'Animated LINE stickers of the Yamaguchi Ika-bu squid, each with a pun. For everyday greetings, Yamaguchi words and replies to your fishing friends.'),
};

function setHTML(lang, s) {
  const grid = s.words.map((w, i) => {
    const no = String(i + 1).padStart(2, '0');
    return `<li class="ika-stk-item"><img src="${assetHref(`/assets/ikabu/stamps/${s.id}/${no}.webp`)}" alt="${esc(t(lang, w))}" width="200" height="200" loading="lazy" decoding="async" /></li>`;   // 言葉は絵の中にあるので下には書かない（alt に残す）
  }).join('');
  const btn = s.storeUrl
    ? `<a class="ika-btn ika-btn--primary ika-stk-buy" href="${esc(s.storeUrl)}" target="_blank" rel="noopener">${t(lang, 'LINE STOREで見る', 'See it on LINE STORE')}</a>`
    : `<span class="ika-stk-soon">${t(lang, STAMP_RELEASE)}</span>`;
  return `
    <article class="ika-sheet ika-stk-set" id="${s.id}">
      <div class="ika-stk-top">
        <span class="ika-sheet-vol">${s.vol}</span>
        <h2>${t(lang, s.title)}</h2>
        <p>${t(lang, s.desc)}</p>
      </div>
      <ul class="ika-stk-grid">${grid}</ul>
      <div class="ika-stk-foot">${btn}<span class="ika-stk-meta">${t(lang, '動くスタンプ・8種類', 'Animated · 8 stickers')}</span></div>
    </article>`;
}

export function render(lang) {
  const sets = STAMP_SETS.map((s) => setHTML(lang, s)).join('');
  const punCards = STAMP_PUNS.map((p) => `
    <article class="ika-pun">
      <p class="ika-pun-jp" lang="ja">${esc(p.jp)}</p>
      <p class="ika-pun-en" lang="en">${esc(p.en)}</p>
      <p class="ika-pun-note">${t(lang, p.note)}</p>
    </article>`).join('');
  const jump = STAMP_SETS.map((s) => `<a href="#${s.id}">${s.vol}</a>`).join('');

  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-studio-section">
    <div class="wrap">
      <nav class="ika-stk-jump" aria-label="${t(lang, 'セットへ移動', 'Jump to a set')}"><span class="ika-stk-soon">${t(lang, STAMP_RELEASE)}</span>${jump}</nav>
      <div class="ika-stk-sets">${sets}</div>
      ${noteHTML(lang, {
        label: pair('スタンプについて', 'About the stickers'),
        html: `<p>${t(lang, 'LINEのスタンプショップで「山口イカ部」と探すと見つかります。キャラクターはAIで作った絵をもとに、部で整えたデザインです。', 'Search “Yamaguchi Ika-bu” in the LINE sticker shop. The character was refined by the club from AI-generated drafts.')}</p><p class="ika-stk-copy">${STAMP_COPYRIGHT}</p>`,
      })}
    </div>
  </section>

  <section class="ika-section ika-section--tint">
    <div class="wrap">
      ${sectionHead(lang, { num: 'PLAY', en: 'MEET THEM IN THE GAMES', title: pair('スタンプのイカたちと、遊ぼう。', 'Play with the squid from the stickers.'), note: pair('どれも無料。スマホで今すぐ遊べます。', 'All free. Play right now on your phone.') })}
      ${gameTilesHTML(lang)}
      <div class="ika-cta ika-stk-line">
        <a class="ika-btn ika-btn--sea" href="${LINE_ADD_URL}" target="_blank" rel="noopener">${t(lang, '公式LINEで友だちになる', 'Add our official LINE')}</a>
        <a class="ika-btn ika-btn--ink" href="https://www.instagram.com/child_daddy_o3z/" target="_blank" rel="noopener">${t(lang, 'Instagramをフォロー', 'Follow on Instagram')}</a>
      </div>
    </div>
  </section>

  <section class="ika-section">
    <div class="wrap">
      ${sectionHead(lang, { num: 'PUN', en: 'INK-REDIBLE WORDS', title: pair('ダジャレの仕組み', 'How the puns work'), note: pair('「イカ」は日本語のいろいろな言葉に隠れています。海外の部員にも笑ってもらえるように、種明かしを。', 'The word ika hides inside all sorts of Japanese phrases. Here is how each one works, so overseas members can laugh along.') })}
      <div class="ika-puns">${punCards}</div>
    </div>
  </section>`;
}

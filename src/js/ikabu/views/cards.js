// cards：イカカード（バインダー＋対戦）。2026-09-30 バインダーは games/binder-ui.js が #ika-binder に組み立てる
import { t, pair } from '../i18n.js';

export const HEAD = { title: pair('イカカード', 'Squid Cards') };

export function render(lang) {
  return `
  <section class="ika-section ika-cards-page" id="ika-cards" aria-label="${t(lang, HEAD.title)}">
    <div class="wrap">
      <p class="ika-eyebrow"><span class="ika-eyebrow-num">04</span>${t(lang, 'イカカード', 'SQUID CARDS')}</p>
      <h1 class="ika-games-title">${t(lang, 'バインダー', 'Binder')}</h1>
      <p class="ika-games-lead">${t(lang, 'ガチャで引いたカードが並びます。ダブりは「墨のかけら」になり、欲しいカードと交換できます。対戦は準備中。', 'Cards you pull line up here. Duplicates become ink shards you can trade for the card you want. Battles coming soon.')}</p>
      <div id="ika-binder"></div>
    </div>
  </section>`;
}

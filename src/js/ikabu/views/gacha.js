// gacha：イカ部ガチャの専用ページ（フル画面）。2026-09-30 着手。本体は games/gacha-page.js が組み立てる（ここは土台だけ）
import { t, pair } from '../i18n.js';

export const HEAD = { title: pair('イカ部ガチャ', 'Squid Gacha') };

export function render(lang) {
  return `
  <section class="ika-gacha-page" id="ika-gacha" data-lang="${lang}" aria-label="${t(lang, HEAD.title)}">
    <div class="ika-gacha-loading">${t(lang, '準備中…', 'Loading…')}</div>
  </section>`;
}

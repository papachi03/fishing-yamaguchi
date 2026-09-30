// イカ部ガチャ（フル画面）の本体。2026-09-30 着手。まずは入口だけ（演出は次の段階で組む）
import { t } from '../i18n.js';
import { pageHref } from '../i18n.js';
import { readTickets } from './tickets.js';

export function mountGachaPage(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const n = readTickets().n;
  root.innerHTML = `
    <div class="ika-gacha-stub">
      <p class="ika-gacha-stub-tickets">🎫 ${n}</p>
      <p class="ika-gacha-stub-text">${t(lang, 'ガチャは制作中です。演出ができたらここで引けます。', 'The gacha is being built. Pulls open here once the show is ready.')}</p>
      <a class="ika-btn" href="${pageHref('games', lang)}">${t(lang, '← あそび場TOPへ', '← Back to TOP')}</a>
    </div>`;
  return {};
}

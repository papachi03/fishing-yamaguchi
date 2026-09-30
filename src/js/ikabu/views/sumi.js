// sumi：墨つなぎだけの専用ページ（テストプレイ用に URL を送って、開いてすぐ遊んでもらう）。
// 盤面はあそび場（views/play.js）と同じ部品。公開前のクラブの各ページへのリンクは置かない（shell.js の SOLO_PAGES）
import { t } from '../i18n.js';
import { m3HTML } from './play.js';

export function render(lang) {
  return `${m3HTML(lang)}
  <section class="ika-section ika-egi-solo-foot">
    <div class="wrap">
      <p>${t(
        lang,
        'ゲームはブラウザの中だけで動き、記録もこのブラウザにだけ残ります。',
        'The game runs entirely in your browser and records stay here.'
      )}</p>
    </div>
  </section>`;
}

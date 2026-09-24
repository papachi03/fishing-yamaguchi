// egi：エギングゲームだけの専用ページ（知り合いに URL を送って、開いてすぐ遊んでもらう用）。
// ゲームの土台はあそび場（views/play.js）と同じ部品を使い、ここではページの頭と足だけを持つ。
import { t, pageHref } from '../i18n.js';
import { egiHTML } from './play.js';

export function render(lang) {
  const month = new Date().getMonth() + 1;   // ビルド時の月。ブラウザでは egi-ui.js が今の月に直す
  return `${egiHTML(lang, month, { solo: true })}
  <section class="ika-section ika-egi-solo-foot">
    <div class="wrap">
      <p>${t(
        lang,
        'ゲームはブラウザの中だけで動き、記録もこのブラウザにだけ残ります。判定は遊びのための単純化で、実際の釣りの安全や成果を保証するものではありません。',
        'The game runs entirely in your browser and records stay here. It is a playful simplification and says nothing about real-world safety or results.'
      )}</p>
      <p class="ika-egi-solo-links">
        <a href="${pageHref('play', lang)}">${t(lang, 'パズル「墨つなぎ」も遊ぶ', 'Also play Ink Link, the puzzle')} →</a>
        <a href="${pageHref('index', lang)}">${t(lang, '山口イカ部のトップへ', 'Yamaguchi Ika Club home')} →</a>
      </p>
    </div>
  </section>`;
}

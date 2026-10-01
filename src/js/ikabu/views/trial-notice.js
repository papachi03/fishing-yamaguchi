// テストプレイ版の注意書き（2026-09-29 ぱっぱ：実績やレベルは正式版でリセットされることを書いておく）。
// テストプレイ用の組み立て（vite.trial.config.js・vite.egi.config.js が __IKABU_TRIAL__ = true を入れる）の時だけ出し、本番のページには出さない
import { t } from '../i18n.js';

// import.meta.env に define で足す方法は効かなかった（2026-09-29 組み立て後も false のまま）→ 専用の印 __IKABU_TRIAL__ を使う
export const IS_TRIAL = typeof __IKABU_TRIAL__ !== 'undefined' && __IKABU_TRIAL__ === true;   // eslint-disable-line no-undef

export function trialNoticeHTML(lang) {
  if (!IS_TRIAL) return '';
  return `<div class="wrap"><p class="ika-trial-note" role="note">🧪 ${t(
    lang,
    'いまはテストプレイ版です。記録・図鑑・部員レベル・🎫チケット・カードなどは、正式版の公開のときにすべてリセットされ、正式版には引き継げません（引き継ぎコードはテストプレイ版の中だけで使えます）。正式版はみんな一斉にスタートです。',
    'This is a test-play version. Records, the field guide, member levels, tickets and cards will all be reset when the official version launches and cannot be carried over (backup codes work only inside the test-play version). Everyone starts together.'
  )}</p></div>`;
}

// 本文は組み立ての時にあらかじめHTMLへ書き込まれ（prerender）、その時は __IKABU_TRIAL__ が効かない。
// ブラウザで開いた時に、ページの頭へ足す（pages/egi.js・pages/sumi.js から呼ぶ）
export function mountTrialNotice(lang) {
  if (!IS_TRIAL || document.querySelector('.ika-trial-note')) return;
  document.querySelector('main')?.insertAdjacentHTML('afterbegin', trialNoticeHTML(lang));
}

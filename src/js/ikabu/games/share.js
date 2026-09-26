// ゲームの結果をシェアする（2026-09-27）。画像は share-card.js（デザインA＝ワッペン、ぱっぱ決定）で描く。
// 流れ（ぱっぱ 9/27）：結果カードの「📷 画像でシェア」→ 結果の画像を画面いっぱいに表示
//   → 長押しで写真に保存（スクショでもOK）→ 下の「𝕏でシェア」で X の投稿画面（一言とURL入り）を開き、写真から貼る。
//   端末の共有メニューは送り先が多すぎて迷うので使わない。X は外から画像を受け取れないので、画像は本人が貼る。
//   ⚠️ ゲームの舞台は長押しメニューを止めているので、表示は舞台の外（body 直下）に出す。本物の全画面中は先に全画面を抜ける
// 画像はブラウザの中で作るだけで、どこにも送らない。知り合い用のエギング単体ページ（solo）には出さない
// i18n.js は Vite の import.meta.env を読むので Node のテストで読めない。ここでは文字列の切り替えだけ自前で
const t = (lang, ja, en) => (lang === 'en' ? en : ja);

export const SHARE_VARIANT = 'A';
const ORIGIN = 'https://yamaguchifishing.com';   // 一言に入れるURLは本番のもの（イカ部の本番公開と同時に効く）
export const shareUrl = (lang, game) => `${ORIGIN}/ikabu/${lang === 'en' ? 'en/' : ''}play.html#${game}`;
const TAG = '#山口イカ部';

// 一言（純粋関数・テストあり）
export function egiCatchText(lang, { name, weightG, practice }) {
  return t(lang, `しゃくって抱かせろ！で${name} ${weightG.toLocaleString()}gを釣った🦑${practice ? '（季節モード）' : ''} ${TAG}`,
    `Caught a ${weightG.toLocaleString()} g ${name} in Shakutte Dakasero! 🦑${practice ? ' (season mode)' : ''} ${TAG}`);
}
export function egiTripText(lang, { count, biggest }) {
  if (!count) return t(lang, `しゃくって抱かせろ！でボウズ…でも部員🦑 ${TAG}`, `Blanked in Shakutte Dakasero!… still a member 🦑 ${TAG}`);
  return t(lang, `しゃくって抱かせろ！で${count}杯🦑 最大は${biggest.name} ${biggest.weightG.toLocaleString()}g ${TAG}`,
    `${count} squid in Shakutte Dakasero! 🦑 Biggest: ${biggest.name} ${biggest.weightG.toLocaleString()} g ${TAG}`);
}
export function sumiText(lang, { score, daily, dayLabel }) {
  return t(lang, `墨つなぎで${score.toLocaleString()}点！${daily ? `（今日の一戦 ${dayLabel}）` : ''} ${TAG}`,
    `${score.toLocaleString()} points in Ink Link!${daily ? ` (Daily match ${dayLabel})` : ''} ${TAG}`);
}

export const xIntent = (text, url) => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

/** 𝕏の投稿画面を新しいタブで開く（押した瞬間に開くので、ポップアップとして止められない） */
export function openX(text, url) {
  window.open(xIntent(text, url), '_blank', 'noopener');
}

/**
 * 結果の画像を画面いっぱいに出す。draw は canvas を返す関数（押された時に初めて share-card.js を読む）。
 * 画像は data: URL の <img>（iPhone の長押し「"写真"に保存」が効く）
 */
export async function openShareView({ lang, draw, text, url, button }) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = t(lang, '画像を作っています…', 'Making the image…');
  let src;
  try {
    src = (await draw()).toDataURL('image/png');
  } catch (err) {
    console.error('share image failed', err);
    button.textContent = t(lang, '画像を作れませんでした', 'Could not make the image');
    setTimeout(() => { button.textContent = label; button.disabled = false; }, 2500);
    return;
  }
  button.textContent = label;
  button.disabled = false;
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});

  const back = document.createElement('div');
  back.className = 'ika-shareview';
  back.innerHTML = `<div class="ika-shareview-box" role="dialog" aria-modal="true" aria-label="${t(lang, 'シェア用の画像', 'Share image')}">
      <img class="ika-shareview-img" src="${src}" alt="${t(lang, '結果の画像', 'Result image')}" width="1200" height="630">
      <p class="ika-shareview-hint">${t(lang, '画像を長押しすると写真に保存できます（スクリーンショットでもOK）。保存したら、𝕏の投稿画面で写真から貼ってください。', 'Long-press the image to save it (or take a screenshot), then attach it in your X post.')}</p>
      <div class="ika-shareview-actions">
        <button type="button" class="ika-btn ika-share-x" data-view="x">${t(lang, '𝕏でシェア', 'Share on 𝕏')}</button>
        <button type="button" class="ika-btn" data-view="close">${t(lang, 'とじる', 'Close')}</button>
      </div>
    </div>`;
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
    button.focus({ preventScroll: true });
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => {
    if (e.target === back || e.target.closest('[data-view="close"]')) close();
    else if (e.target.closest('[data-view="x"]')) openX(text, url);
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(back);
  back.querySelector('[data-view="x"]').focus({ preventScroll: true });
}

/** 結果カードに置くボタン */
export const shareButtonHTML = (lang) =>
  `<button type="button" class="ika-btn ika-share-open" data-share="view">${t(lang, '📷 画像でシェア', '📷 Share image')}</button>`;

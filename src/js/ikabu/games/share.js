// ゲームの結果をシェアする（2026-09-27）。画像は share-card.js（デザインA＝ワッペン、ぱっぱ決定）で描く。
// 「𝕏でシェア」に絞る（ぱっぱ 9/27：端末の共有メニューは送り先が多すぎて迷う）。
//   𝕏でシェア：一言とURL入りの X の投稿画面を開く（X は外から画像を受け取れないので画像は付かない。
//              URL のリンクカードにはサイト共通の画像が出る）
//   画像を保存：結果の画像を保存する（付けたい人は X の投稿画面で自分で添付）
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

const toBlob = (canvas) => new Promise((ok) => canvas.toBlob(ok, 'image/png'));

/** 𝕏の投稿画面を新しいタブで開く（押した瞬間に開くので、ポップアップとして止められない） */
export function openX(text, url) {
  window.open(xIntent(text, url), '_blank', 'noopener');
}

/** 結果の画像を作って保存する。draw は canvas を返す関数（押された時に初めて share-card.js を読む） */
export async function saveImage({ lang, draw, filename, button, after }) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = t(lang, '画像を作っています…', 'Making the image…');
  try {
    const blob = await toBlob(await draw());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    if (after) {
      after.textContent = t(lang, '画像を保存しました。𝕏の投稿画面で添付できます。', 'Image saved. You can attach it in your X post.');
      after.hidden = false;
    }
  } catch (err) {
    console.error('save image failed', err);
    if (after) {
      after.textContent = t(lang, '画像を作れませんでした。もう一度お試しください。', 'Could not make the image. Please try again.');
      after.hidden = false;
    }
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

/** 結果カードに置く部品：大きな「𝕏でシェア」＋小さな「画像を保存」、保存後の案内の置き場 */
export const shareButtonHTML = (lang) =>
  `<span class="ika-share"><button type="button" class="ika-btn ika-share-x" data-share="x">${t(lang, '𝕏でシェア', 'Share on 𝕏')}</button><button type="button" class="ika-share-save" data-share="save">${t(lang, '画像を保存', 'Save image')}</button></span>`;
export const shareAfterHTML = () => `<p class="ika-share-after" data-share-after hidden></p>`;

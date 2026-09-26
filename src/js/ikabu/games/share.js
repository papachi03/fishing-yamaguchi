// ゲームの結果をシェアする（2026-09-27）。画像は share-card.js（デザインA＝ワッペン、ぱっぱ決定）で描く。
// スマホ：端末の共有メニュー（X・LINE・Instagram など）に画像と一言を渡す
// PC・共有メニューで画像を渡せない端末：画像を保存して、文章入りの「Xに投稿」リンクを出す
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

/**
 * 画像を作って共有する。draw は canvas を返す関数（押された時に初めて share-card.js を読む）
 * after は結果を表示する要素（保存した時の「Xに投稿」リンク・失敗の案内）
 */
export async function shareResult({ lang, draw, text, url, filename, button, after }) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = t(lang, '画像を作っています…', 'Making the image…');
  try {
    const canvas = await draw();
    const blob = await toBlob(canvas);
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `${text} ${url}` });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;   // 共有メニューを閉じただけ
      }
    }
    // 共有メニューで画像を渡せない：保存して、Xのリンクを出す
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    if (after) {
      after.innerHTML = `${t(lang, '画像を保存しました。', 'Image saved.')} <a href="${xIntent(text, url)}" target="_blank" rel="noopener">${t(lang, 'Xに投稿する（保存した画像を添付）', 'Post on X (attach the saved image)')} ↗</a>`;
      after.hidden = false;
    }
  } catch (err) {
    console.error('share failed', err);
    if (after) {
      after.textContent = t(lang, '画像を作れませんでした。もう一度お試しください。', 'Could not make the image. Please try again.');
      after.hidden = false;
    }
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

/** 結果カードに置くボタン（data-share）と、保存後の案内の置き場 */
export const shareButtonHTML = (lang) =>
  `<button type="button" class="ika-btn ika-share-btn" data-share>${t(lang, '📷 画像でシェア', '📷 Share image')}</button>`;
export const shareAfterHTML = () => `<p class="ika-share-after" data-share-after hidden></p>`;

// 通報ボタン（「不適切な投稿を知らせる」）のクリックを親要素でまとめて受ける。
// カードは何度も描き直されるので、ボタン個別ではなく親に1回だけ付ける。
// reports.html と sea.html の両方で使う（文言が片方だけずれないよう、ここ1か所にまとめる）。
// イカ部の英語ページ（/ikabu/en/）からは labels を渡して英語にする。省略時は従来どおり日本語
import { reportPost } from '../api/reports.js';

export const REPORT_FLAG_LABELS = {
  ja: { confirm: 'この投稿を「不適切」として知らせますか？', done: '知らせました。ありがとうございます', failed: '送れませんでした' },
  en: { confirm: 'Report this post as inappropriate?', done: 'Reported. Thank you.', failed: 'Could not send' },
};

export function bindReportButtons(container, labels = REPORT_FLAG_LABELS.ja) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-report]');
    if (!btn || btn.disabled) return;
    if (!window.confirm(labels.confirm)) return;
    btn.disabled = true;
    btn.textContent = (await reportPost(btn.dataset.report)) ? labels.done : labels.failed;
  });
}

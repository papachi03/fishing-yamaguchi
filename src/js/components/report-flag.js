// 通報ボタン（「不適切な投稿を知らせる」）のクリックを親要素でまとめて受ける。
// カードは何度も描き直されるので、ボタン個別ではなく親に1回だけ付ける。
// reports.html と sea.html の両方で使う（文言が片方だけずれないよう、ここ1か所にまとめる）。
import { reportPost } from '../api/reports.js';

export function bindReportButtons(container) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-report]');
    if (!btn || btn.disabled) return;
    if (!window.confirm('この投稿を「不適切」として知らせますか？')) return;
    btn.disabled = true;
    btn.textContent = (await reportPost(btn.dataset.report)) ? '知らせました。ありがとうございます' : '送れませんでした';
  });
}

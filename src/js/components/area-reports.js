// SEAページ用：選んでいるエリアの「現地の声」最新2件。
// 海況の表示を絶対に邪魔しないこと（0件・失敗・準備中は、黙って何も出さない）。
import { initReveal, url } from '../main.js';
import { AREA_LABELS } from '../data/spot-list.js';
import { reportsEnabled, fetchPosts, photoUrl } from '../api/reports.js';
import { reportCardHTML } from './report-card.js';

let seq = 0;

/**
 * 進行中の取得を「もう要らない」ことにする。
 * SEAページが枠を空にするときに必ず呼ぶ。呼ばないと、前のエリアぶんの取得が遅れて帰ってきて、
 * 空にしたはずの枠に一瞬だけ前のエリアの投稿が出てしまう
 */
export function cancelAreaReports() {
  seq += 1;
}

export async function mountAreaReports(container, areaId) {
  const mine = ++seq;
  container.innerHTML = '';
  if (!reportsEnabled || !AREA_LABELS[areaId]) return;
  // 取得も描画も try の中。どこで失敗しても例外を外に出さず、枠を出さないだけにする
  try {
    const posts = await fetchPosts({ area: areaId, limit: 2 });
    if (mine !== seq || !posts.length) return; // 取得中に別のエリアへ切り替えられた／投稿なし

    container.innerHTML = `
    <div class="area-reports reveal">
      <div class="tide-panel-head">
        <h3>Reports — 現地の声</h3>
        <span class="bite-spot">${AREA_LABELS[areaId]}エリアの最新の投稿</span>
      </div>
      <div class="report-grid">${posts.map((p) => reportCardHTML(p, photoUrl)).join('')}</div>
      <p><a class="sea-more" href="${url('/reports.html')}#area=${areaId}">もっと見る・投稿する<span aria-hidden="true">→</span></a></p>
    </div>`;
    initReveal();
  } catch {
    if (mine === seq) container.innerHTML = '';
  }
}

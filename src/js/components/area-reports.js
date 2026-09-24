// SEAページ用：選んでいるエリアの「現地の声」最新2件。
// 海況の表示を絶対に邪魔しないこと（0件・失敗・準備中は、黙って何も出さない）。
// lang='en'（イカ部の英語ページ）では見出しとリンクだけ英語。既定は従来どおり日本語
import { initReveal, url } from '../main.js';
import { AREA_LABELS, AREA_LABELS_EN } from '../data/spot-list.js';
import { reportsEnabled, fetchPosts, photoUrl } from '../api/reports.js';
import { reportCardHTML } from './report-card.js';

let seq = 0;

const TEXT = {
  ja: { head: 'Reports — 現地の声', latest: (label) => `${label}エリアの最新の投稿`, more: 'もっと見る・投稿する' },
  en: { head: 'Reports — field reports', latest: (label) => `Latest posts from the ${label} area`, more: 'See more / post a report' },
};

/**
 * 進行中の取得を「もう要らない」ことにする。
 * SEAページが枠を空にするときに必ず呼ぶ。呼ばないと、前のエリアぶんの取得が遅れて帰ってきて、
 * 空にしたはずの枠に一瞬だけ前のエリアの投稿が出てしまう
 */
export function cancelAreaReports() {
  seq += 1;
}

export async function mountAreaReports(container, areaId, lang = 'ja') {
  const mine = ++seq;
  container.innerHTML = '';
  if (!reportsEnabled || !AREA_LABELS[areaId]) return;
  const T = TEXT[lang] ?? TEXT.ja;
  const label = lang === 'en' ? AREA_LABELS_EN[areaId] ?? AREA_LABELS[areaId] : AREA_LABELS[areaId];
  // 取得も描画も try の中。どこで失敗しても例外を外に出さず、枠を出さないだけにする
  try {
    const posts = await fetchPosts({ area: areaId, limit: 2 });
    if (mine !== seq || !posts.length) return; // 取得中に別のエリアへ切り替えられた／投稿なし

    container.innerHTML = `
    <div class="area-reports reveal">
      <div class="tide-panel-head">
        <h3>${T.head}</h3>
        <span class="bite-spot">${T.latest(label)}</span>
      </div>
      <div class="report-grid">${posts.map((p) => reportCardHTML(p, photoUrl, lang)).join('')}</div>
      <p><a class="sea-more" href="${url('/reports.html')}#area=${areaId}">${T.more}<span aria-hidden="true">→</span></a></p>
    </div>`;
    initReveal();
  } catch {
    if (mine === seq) container.innerHTML = '';
  }
}

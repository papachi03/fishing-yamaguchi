// 選べる釣り場の一覧。ビルド時（vite.config.js）と画面（reports.js）の両方で使う。
// 検索エンジンが通信なしで読める本文になる（2026-09-14のソフト404の教訓）。
import { SPOTS, AREA_LABELS, placeLabel } from '../data/spot-list.js';

export function spotListHTML() {
  return Object.entries(AREA_LABELS)
    .map(([areaId, label]) => {
      const names = SPOTS.filter((s) => s.areaId === areaId).map(placeLabel);
      return `<div class="spot-names"><dt>${label}</dt><dd>${names.length ? names.join('・') : '準備中'}</dd></div>`;
    })
    .join('');
}

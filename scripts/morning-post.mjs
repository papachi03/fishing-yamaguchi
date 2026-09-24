// 毎朝の「堤防判定」のX投稿の下書きを、手元で今の予報から作って表示する（送信はしない）。
//   node scripts/morning-post.mjs
//
// 本番は Cloudflare Worker（worker/reports）の定期実行が毎朝7:00にDiscordへ送っている。
// ここはそれと同じ部品（worker/reports/src/morning.js）を使うので、表示される文面は本番と同じ。

import { morningRows } from '../worker/reports/src/morning.js';
import { composeMorningPost, xWeightedLength, X_LIMIT } from '../src/js/lib/morning-post.js';

const rows = await morningRows();
const text = composeMorningPost({ date: new Date(), rows });
console.log(text);
console.log(`--- Xの文字数（重み付き）: ${xWeightedLength(text)} / ${X_LIMIT}`);

// 攻略記事（guides/*.html）の道具カードを、ビルド時にHTMLへ書き込む。
// 記事には <div class="guide-tackle" data-ids="id1,id2"></div> と書いておくだけでよい。
// 本文として書き込むので、検索エンジンが通信なしでカードの中身まで読める。
import { tackle } from '../data/tackle.js';
import { tackleCardHTML } from './tackle-card.js';

const TYPE_LABEL = { rod: 'ROD', reel: 'REEL', lure: 'LURE', line: 'LINE', gear: 'GEAR' };
const MARK = /<div class="guide-tackle" data-ids="([^"]+)"><\/div>/g;

export function fillGuideTackle(html) {
  return html.replace(MARK, (_, ids) => {
    const cards = ids.split(',').map((raw) => {
      const id = raw.trim();
      const item = tackle.find((t) => t.id === id);
      // 書き間違いで空のカードが公開されないよう、ビルドを止める
      if (!item) throw new Error(`攻略記事の道具IDが tackle.js にありません: ${id}`);
      return tackleCardHTML(item, TYPE_LABEL);
    });
    return `<div class="guide-tackle tackle-grid" data-ids="${ids}">${cards.join('')}</div>`;
  });
}

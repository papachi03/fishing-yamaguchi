// アフィリエイト設定。IDはここだけで管理する（他のファイルには書かない）。
//
// Amazon: トラッキングID（アソシエイト・セントラル → トラッキングIDの管理）
// 楽天:   アフィリエイトID（楽天アフィリエイト → アフィリエイトIDの確認）
//
// リンクの組み立て方
//   Amazon 商品:  https://www.amazon.co.jp/dp/<ASIN>?tag=<トラッキングID>
//   Amazon 検索:  https://www.amazon.co.jp/s?k=<検索語>&tag=<トラッキングID>
//   楽天 商品/検索: https://hb.afl.rakuten.co.jp/hgc/<アフィリエイトID>/?pc=<URL>&m=<URL>
//     （pc/m に楽天市場の商品ページか検索結果ページのURLを入れる）

export const affiliate = {
  siteName: 'YAMAGUCHI FISHING JOURNAL',
  amazonTag: 'a01266-22',
  rakutenId: '0db3fb2f.2b3bc4a9.0db3fb30.b9af63ba',
};

// Amazonアソシエイト・プログラム参加者として必須の開示文
export const AMAZON_DISCLOSURE =
  'Amazonのアソシエイトとして、YAMAGUCHI FISHING JOURNALは適格販売により収入を得ています。';

export function amazonUrl(item) {
  if (item.asin) return `https://www.amazon.co.jp/dp/${item.asin}?tag=${affiliate.amazonTag}`;
  const q = encodeURIComponent(item.query ?? item.name);
  return `https://www.amazon.co.jp/s?k=${q}&tag=${affiliate.amazonTag}`;
}

export function rakutenUrl(item) {
  const target =
    item.rakutenUrl ??
    `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(item.query ?? item.name)}/`;
  const enc = encodeURIComponent(target);
  return `https://hb.afl.rakuten.co.jp/hgc/${affiliate.rakutenId}/?pc=${enc}&m=${enc}`;
}

// Instagram（@child_daddy_o3z）。
//
// 2つのデータ源がある:
//   1. instagram-feed.json … 公式APIから自動取得したもの（scripts/build-instagram.mjs が生成）
//      → これがあれば自前の写真グリッドで表示する（速い・デザインを揃えられる）
//   2. instagramPosts      … 手で書いた投稿URLの一覧（フォールバック）
//      → APIがまだ設定されていない時は、Instagram公式の埋め込みで表示する
//
// 通常運用は 1。月1回 `node scripts/build-instagram.mjs` を実行すれば最新になる。

import feed from './instagram-feed.json';

export const instagramProfile = {
  handle: 'child_daddy_o3z',
  url: 'https://www.instagram.com/child_daddy_o3z/',
  youtube: 'https://www.youtube.com/@childdaddy',
  bio: '主に釣り、DIYやキャンプなど大人遊びをVlogに残してます。',
};

// 自動取得した投稿（無ければ空配列）
export const instagramFeed = Array.isArray(feed?.posts) ? feed.posts : [];
export const instagramFetchedAt = feed?.fetchedAt ?? null;

// フォールバック用（手動）。自動取得が動くようになったら消してもよい
export const instagramPosts = [
  { url: 'https://www.instagram.com/p/Dcd0reTJxXY/', date: '2026-08-25' },
  { url: 'https://www.instagram.com/p/Ct02E57vVxE/', date: '2023-06-23' },
  { url: 'https://www.instagram.com/reel/CtckB0PB6Qt/', date: '2023-06-13' },
  { url: 'https://www.instagram.com/reel/Ctaq_QvuuQe/', date: '2023-06-12' },
  { url: 'https://www.instagram.com/p/Cs11RPzSsyG/', date: '2023-05-29' },
  { url: 'https://www.instagram.com/p/Cs15pfPBbl0/', date: '2023-05-29' },
  { url: 'https://www.instagram.com/reel/Cs12wVSuGzF/', date: '2023-05-29' },
  { url: 'https://www.instagram.com/p/Cs12b9CS4Km/', date: '2023-05-29' },
  { url: 'https://www.instagram.com/p/Cs11id6S8Zd/', date: '2023-05-29' },
  { url: 'https://www.instagram.com/reel/Crnq-v4rrTr/', date: '2023-04-29' },
  { url: 'https://www.instagram.com/p/CrAjuZYPGg6/', date: '2023-04-14' },
  { url: 'https://www.instagram.com/p/CqlMKtuv165/', date: '2023-04-03' },
];

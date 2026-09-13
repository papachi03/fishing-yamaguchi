// Instagram（@child_daddy_o3z）。
//
// データ源は3段構え（実際の切り替えは components/instagram.js）:
//   0. Cloudflare Worker（tproject-jp.com/ig/feed?shop=fishing）… 1時間ごとの自動更新。通常はこれが出る
//   1. instagram-feed.json … scripts/build-instagram.mjs で取り込んだ静的データ
//      → 初回描画とフォールバック用。Workerが落ちても・未認可でもこれが出るので壊れて見えない
//   2. instagramPosts      … 手で書いた投稿URLの一覧（1も無いときの最後の逃げ道・公式埋め込み）
//
// ★2026-09-13 以降、月1回の手動取り込みは不要（Workerが自動更新）。
//   ただし 1 は「Workerが止まったときの保険」なので、半年に1回くらい取り直しておくと表示が古くならない。
//   取り直し： node scripts/build-instagram.mjs → npm run build → push

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

// 「現地の声」Workerの決まりごと。数字を変えるときは spec（docs/superpowers/specs/2026-09-20-reports-ugc-design.md）も直す。

export const LIMITS = {
  name: 20,
  comment: 400,
  photoBytes: 3 * 1024 * 1024,
  perHour: 3,
  perDay: 10,
  reportsToHide: 3,
  reportPerHour: 10, // 通報できる数（1時間）
  reportPerDay: 30, //  同じく1日
  maxAgeDays: 31,
  indexSize: 50, // 公開用の索引に入れる件数
  adminLoginPerHour: 5,
};

// 投稿者名に含まれていたら断る言葉（NFKC・小文字化・空白除去のあとで比べる）
export const RESERVED_WORDS = ['ダディ', 'だでぃ', 'daddy', '管理', '運営', '公式', 'yfj', 'admin'];

// 投稿・一覧の取得を許すサイト
export const ALLOWED_ORIGINS = [
  'https://yamaguchifishing.com',
  'https://www.yamaguchifishing.com',
  'https://papachi03.github.io', // 2026-09-21 独自ドメイン移行前の旧URL。リダイレクトされるため実質使われないが、当面は残す
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174', // .claude/launch.json の「yfj-reports-site」はこのポートで動く
  'http://127.0.0.1:5174',
  'http://localhost:4173',
];

// Discordで知らせるときのメンション先は、Workerのsecret `NOTIFY_MENTION_USER_ID` から読む（Task 4）。
// このリポジトリは公開なので、個人のDiscordユーザーIDをここに書かない。

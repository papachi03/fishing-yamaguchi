# Instagram自動取得のセットアップ手順（初回のみ・PCで）

サイトのHOME・ABOUTに、Instagram（@child_daddy_o3z）の最新投稿を自動で並べるための設定。
一度トークンを取れば、あとは `node scripts/build-instagram.mjs` を実行するだけで最新になる。

所要：20〜30分。**すべてぱっぱ自身のログインで行う作業**（クロロは代行できない）。

---

## 0. 前提（済んでいること）

- Instagramを**プロアカウント（クリエイター）**に切り替え済み ✅（2026-09-11 スマホで完了）

## 1. Meta for Developers にログイン

1. https://developers.facebook.com/ を開く
2. 右上 **ログイン** → Instagramと**同じFacebookアカウント**でログイン
   （Facebookを使っていない場合は、ここで無料のFacebookアカウントを作る。ページは不要）
3. 初回は「開発者として登録」の案内が出る → 電話番号かメールで認証して登録

## 2. アプリを作る（2026-09-11 実際の画面で確認済み）

1. 右上 **マイアプリ** → **アプリを作成**
2. アプリ名：`YFJ Feed Tool`（⚠️ 名前に「Instagram」「Insta」「Gram」「Facebook」等を含めると拒否される）
3. 連絡先メール → 次へ
4. ユースケース：**「ユースケースなしでアプリを作成」** を選ぶ（一覧にInstagramは出てこない）
5. ビジネス：**「現時点ではビジネスポートフォリオをリンクしない」** でよい
6. 要件・概要 → **アプリを作成**

## 3. Instagram連携を追加してトークンを発行

1. ダッシュボードの **「Add use cases」** → **「Instagramでメッセージとコンテンツを管理」** にチェック → 保存 → 「Add to app」
2. 左メニュー **ユースケース** → その項目の **カスタマイズ** → 左サブメニュー **「InstagramログインによるAPI設定」**
3. 「1. 必要なメッセージアクセス許可を追加する」の **Add all required permissions**
4. ⚠️ 先に **テスター登録**：左メニュー **アプリの役割 › 役割** → **メンバーを追加** → 「Instagramテスター」を選び `child_daddy_o3z` を検索して追加（これをしないと「開発者の役割が不十分です」エラーになる）
5. Instagram側で承認：`https://www.instagram.com/accounts/manage_access/` → **「テスターへのご招待」** タブ → **承認する**
6. 手順2の画面に戻り、「2. アクセストークンを生成する」の **アカウントを追加** → `child_daddy_o3z` が一覧に出る
7. その行の **「トークンを生成」** → 別ウィンドウ（ポップアップ）で許可 → 表示された長い文字列を **コピー**
   （これが「長期トークン」。**60日有効**。他人に見せない。ポップアップがブロックされたらアドレスバー右端で許可）

（初回は「Meta for Developersアカウントを作成」の登録が入る。電話番号は先に `accountscenter.facebook.com` の「個人の情報 › 連絡先情報」で追加してからでないと認証できない）

## 4. サイトに設定する

1. `G:\fishing-yamaguchi\site\.env.example` をコピーして、同じ場所に **`.env`** という名前で保存
2. `.env` をメモ帳で開き、`INSTAGRAM_ACCESS_TOKEN=` の後ろに、コピーしたトークンを貼り付けて保存

```
INSTAGRAM_ACCESS_TOKEN=IGAAxxxxxxxxxxxxxxxxxxxxxxxx...
```

## 5. 取得を実行

PowerShellで：

```powershell
cd G:\fishing-yamaguchi\site
node scripts/build-instagram.mjs
```

「取得中: @child_daddy_o3z の投稿 最新24件 …」→「完了」と出れば成功。
`npm run dev` でサイトを開くと、HOME下部とABOUTに投稿の写真が並ぶ。

## 6. 以後の運用

- **新しい投稿を反映したい時**：もう一度 `node scripts/build-instagram.mjs` を実行するだけ
- **月に1回は必ず実行する**：実行のたびにトークンの期限が60日延びる。60日以上放置すると失効し、手順3-4からやり直しになる
- サイトを公開（Netlify等）したら、「毎日自動ビルド」の設定でこの実行も自動化できる

## うまくいかない時

| 表示 | 原因と対処 |
|---|---|
| `INSTAGRAM_ACCESS_TOKEN が .env にありません` | `.env` の場所か名前が違う。`site` フォルダ直下に `.env`（先頭にドット） |
| `Instagram API: Invalid OAuth access token` | トークンの貼り間違いか失効。手順3-4で再発行 |
| `Instagram API: ...permission...` | 手順3で接続したアカウントがプロアカウントになっていない |
| 写真が古いまま | ブラウザの再読み込み（Ctrl+F5）。それでも古ければ `npm run build` し直す |

---

### 参考（技術メモ）
- API: `https://graph.instagram.com/v25.0/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp`
- トークン延長: `GET /refresh_access_token?grant_type=ig_refresh_token&access_token=...`（発行後24時間経過してから有効）
- 画像URLは数日で失効するため、`assets/instagram/` に保存し直している
- 公式ドキュメント: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started

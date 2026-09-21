# 「現地の声」公開の手順

**✅ 2026-09-21、下記の1〜5はクロロが実施済み（本番稼働中）。** この文書は、作り直すときと仕組みを思い出すときのための記録です。

| 何を | 実際の値 |
|---|---|
| 受け皿（Worker） | `https://yfj-reports.hoodhomies.workers.dev` |
| KV名前空間 | `yfj-reports`（バインディング名 `REPORTS_KV`） |
| Turnstileウィジェット | `yfj-reports`（ホスト名 `yamaguchifishing.com` と `www.yamaguchifishing.com`・モード「管理」） |
| 登録済みsecret | `TURNSTILE_SECRET` `IP_SALT` `SIGN_SECRET` `ADMIN_PASSPHRASE` `DISCORD_WEBHOOK_URL` の5つ |
| 管理ページ | `https://yfj-reports.hoodhomies.workers.dev/admin`（合言葉はダディが決めたもの） |
| 通知先 | ブログ記事の通知と同じDiscordチャンネル |

費用は0円、クレジットカードの登録も不要です（写真もKVに保存する方式にしたため）。

## 1. 置き場を作る
1. 左メニュー「ストレージとデータベース」→「KV」→「作成」→ 名前 `yfj-reports`

## 2. ロボット除け（Turnstile）を作る
1. 左メニュー「Turnstile」→「ウィジェットを追加」
2. 名前 `yfj-reports`／ホスト名 `yamaguchifishing.com`（`www.` 付きも追加）／モード「管理」
3. 表示された **サイトキー** と **シークレットキー** を控える（サイトキーは公開してよい値、シークレットは秘密）

## 3〜5. Workerを作ってデプロイし、secretを入れる

**ダッシュボードの「コードを編集する」から貼り付ける方法は使いません**（貼り付けはできてもデプロイ操作が分かりにくく、実際には本番に反映されませんでした）。`wrangler` コマンドで行います。

1. `worker/reports` フォルダで `wrangler.toml` を用意する（内容は `worker/reports/README.md`。account_idとKVのidを含むためgit管理外）
2. `npx wrangler deploy` … コードを本番へ
3. secretを5つ登録する（それぞれ1行）

   ```
   printf '%s' '<値>' | npx wrangler secret put TURNSTILE_SECRET
   printf '%s' '<値>' | npx wrangler secret put IP_SALT
   printf '%s' '<値>' | npx wrangler secret put SIGN_SECRET
   printf '%s' '<値>' | npx wrangler secret put ADMIN_PASSPHRASE
   printf '%s' '<値>' | npx wrangler secret put DISCORD_WEBHOOK_URL
   ```

   - `IP_SALT` と `SIGN_SECRET` はでたらめな英数字40文字以上（`python -c "import secrets;print(secrets.token_urlsafe(32))"` でよい）
   - `ADMIN_PASSPHRASE` は管理ページの合言葉。**ダディが決めて、ダディだけが覚えておく**
   - `NOTIFY_MENTION_USER_ID`（任意）を入れると、通報で自動非表示になったときの知らせでダディにメンションが飛ぶ
4. `npx wrangler secret list` で5つ入っているか確認

## 6. サイトに接続先を書く
`src/js/config/reports.js` にWorkerのアドレスとTurnstileのサイトキーを書く（どちらも公開してよい値）。空のままだと投稿欄は「準備中」の表示になる。

## 7. 確かめる
- `https://yfj-reports.hoodhomies.workers.dev/posts` を開いて `{"ok":true,"posts":[]}` と出る（2026-09-21 確認済み）
- `https://yfj-reports.hoodhomies.workers.dev/admin` で合言葉の画面が出る（同）
- サイトの REPORTS ページからテスト投稿 → すぐ一覧に出る → Discordに通知が届く
- 通知の「削除する」リンク → 確認画面 →「削除する」→ 一覧から消える
- Search Console：`reports.html` のURL検査 →「公開URLをテスト」→「登録できます」→「インデックス登録をリクエスト」
- **公開から数日は、Search Consoleの「セキュリティの問題」を毎日見る**
- **公開から数日は、Cloudflareの Workers の「メトリクス」で KV の読み取り回数も見る**（ふつうの閲覧とSEAページの「現地の声」は、最新50件の索引を1回読むだけで済みます。索引で足りないとき——たとえば投稿の少ないエリアや、古い投稿を釣り場・魚で絞り込んだとき——だけ、管理ページと同じ200件を読みにいきます。無料枠は1日10万回）

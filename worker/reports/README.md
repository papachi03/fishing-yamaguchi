# yfj-reports — 「現地の声」Worker

釣りサイトの投稿を受け取り、保存し、配るCloudflare Worker。**workers.dev で動かす（tproject-jp.com の下に置かない）。**

- 設計：`docs/superpowers/specs/2026-09-20-reports-ugc-design.md`
- 公開の手順：`docs/REPORTS_公開手順.md`
- テスト：`npm test`（ネット不要）／手元で動かす：`npm run dev:worker` → http://127.0.0.1:8787
- 本番に出す：`worker/reports` で `npx wrangler deploy`（**2026-09-21 この方法で本番稼働。ダッシュボードの「コードを編集する」は貼り付け後のデプロイ操作が分かりにくく、実際には反映されなかった**）
  - `wrangler.toml` は account_id と KV の id を含むため**git管理外**。手元に無い場合は次の内容で作る（KVのidは `CLOUDFLARE_ACCOUNT_ID=<account_id> npx wrangler kv namespace list` で確認できる）

    ```toml
    name = "yfj-reports"
    main = "src/index.js"
    compatibility_date = "2026-09-21"
    account_id = "<Cloudflareのaccount_id>"

    [[kv_namespaces]]
    binding = "REPORTS_KV"
    id = "<yfj-reports の KV namespace id>"

    # 毎朝5:00（日本時間）の堤防判定のX投稿下書き（src/morning.js）。UTC表記
    [triggers]
    crons = ["0 20 * * *"]
    ```
  - secretの登録も同じ場所から：`printf '%s' '<値>' | npx wrangler secret put <名前>`
  - `npx wrangler login` は要らない（このPCは既に認証済み。Avastが `wrangler login` を誤検知する問題があるので、loginはやり直さない）
- 手元で1本のファイルにまとめたいとき：`npm run build:worker` → `worker/reports/dist/worker.js`（`dist/` はgit管理外）

## 荒らし対策の数（`src/config.js` の `LIMITS`）

| 何を | 上限 | KVのキー |
|---|---|---|
| 投稿 | 1時間3件／1日10件（JST区切り） | `rl:<ipハッシュ>` |
| 通報 | 1時間10件／1日30件（JST区切り） | `rr:<ipハッシュ>` |
| 管理ページのログイン試行 | 1時間5回 | `al:<ipハッシュ>` |
| 通報で非表示になる件数 | 3件（別々の人から） | `rep:<投稿id>:<ipハッシュ>` |

「同じ人」は**生のIPではなく、塩つきSHA-256の先頭16桁**で数える（`guard.js` の `ipHashOf`）。IPv6は1人に /64 が配られるのが普通なので、**先頭4かたまり（/64）まで丸めてから**ハッシュ化する（`ipGroupKey`）。丸めないと、同じ回線の人がアドレスを変えるだけでいくらでも別人になれてしまい、通報3件の非表示も上限もすり抜けられる。IPv4は1つ1つを別の人として数える。

通報（`POST /posts/<id>/report`）は、**`Origin` が `ALLOWED_ORIGINS` に入っているときだけ**受け付ける。本物の通報は釣りサイトのページから別オリジンのWorkerへ飛ぶので、ブラウザが必ず `Origin` を付ける。付いていない送信（curlなど）はページを通っていないので断る。

## 一覧（`GET /posts`）のKV読み取り

KVの読み取りは無料枠で1日10万回。絞り込みは**まず公開用の索引（1キー）を読んで絞り**、欲しい件数に届かないときだけ保存済みの投稿200件を読み直す。SEAページの「現地の声」は各エリア2件しか要らないので、ふつうは索引1回で済む。

## バインディングと秘密の値（Cloudflareのダッシュボードで設定）

| 名前 | 種類 | 中身 |
|---|---|---|
| `REPORTS_KV` | KV | 投稿の本文・索引・回数制限・写真（`photo/<id>.jpg`）。**写真もKVに入れる方式にしたのでR2は不要（カード登録なしで公開できる）。** 需要が増えてKVの無料枠（書き込み1日1000回・容量1GB）に近づいたら、`store.js` の写真の get/put/delete だけをR2に差し替えて移行する |
| `TURNSTILE_SECRET` | secret | Turnstileのシークレットキー |
| `IP_SALT` | secret | IPをハッシュ化するときの塩（ランダムな長い文字列。**変えると同じ人の判定がリセットされる**） |
| `SIGN_SECRET` | secret | 管理Cookieと削除リンクの署名（**変えると全員ログアウト・発行済みの削除リンクが無効になる**） |
| `ADMIN_PASSPHRASE` | secret | 管理ページの合言葉（ダディが決める） |
| `DISCORD_WEBHOOK_URL` | secret | 通知先（無くても動く） |
| `NOTIFY_MENTION_USER_ID` | secret | 通知でメンションするDiscordのユーザーID（任意。未設定ならメンション無しで通知だけ届く。このリポジトリは公開なので、個人のDiscordユーザーIDはここには書かず、必ずCloudflare側のsecretに入れる） |

## 管理ページのフォーム送信について

管理ページ（ログイン・削除・再表示・Discordの削除リンク）は素の `<form method="post">` で送っている。ブラウザによってはこれをナビゲーション扱いにして `Origin` ヘッダーを付けないことがあり、その場合そのままだと「操作できません」になって回避手段が無くなってしまう。そのため `admin.js` の同一オリジン判定は、`Origin` が無いときに限り `sec-fetch-site: same-origin`（ブラウザが自動で付ける値。よそのサイトからの送信では `cross-site` になる）も同一オリジンとして認める作りにしてある。CSRFの守りはこのヘッダーで保たれる。

## 釣り場・魚の選択肢を変えるとき

`src/js/data/spot-list.js`・`report-options.js` を直す → `npm test` → **サイトとWorkerの両方を出し直す**（Workerも同じファイルを取り込んでいるため。片方だけだと、新しい釣り場を選んだ投稿が「場所を選んでください」で弾かれる）。IDは変えない・消さない。

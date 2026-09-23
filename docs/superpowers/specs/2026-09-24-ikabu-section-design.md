# 山口イカ部セクション（/ikabu/）設計

2026-09-24 作成。小松氏との共同企画「山口イカ部」を、YFJ（yamaguchifishing.com）の中の独立セクションとして作る。
背景：小松氏の企画サイト https://yamaguchi-ika-club.swyk-blue.chatgpt.site/ の中身（日英対訳つき）を移植し、YFJの機能（海況・現地の声）を土台として使う。

## 決まっていること（ぱっぱ確認済み）

- 場所：`/ikabu/`（日本語）と `/ikabu/en/`（英語）。全ページで日英を切り替えられる
- 配色：マイアミ・ハリケーンズの **グリーン #005030 × オレンジ #F47321 × 白**。ロゴとHEROイラストは今の紺・アイボリー・朱のまま使う
- ゲーム：新作のエギングゲーム＋「墨つなぎ」（3マッチ）を遊べる形で作り直す
- 図鑑の写真：山口のイカはぱっぱの実写を優先、無い種はウィキメディア・コモンズの公開ライセンス写真を出典つきで使う
- 公開はぱっぱのOK後。それまで全ページ `noindex`
- YFJ本体の見た目は変えない（ナビに「Ikabu」を1つ足すだけ）

## ページ

| page | 日本語名 | 中身 |
|---|---|---|
| index | トップ | HERO（ロゴ＋イラスト）、部則、各ページへの入口、部活動の記録、部員の掲示板 |
| map | 山口マップ | 遊漁船・食文化スポットを Leaflet 地図に |
| sea | 風と波 | YFJ の海況（weather / tide / safety / sea-render）をそのまま使う |
| recipes / recipe | イカ食堂 | レシピ4品、2人分⇔4人分、印刷 |
| atlas | 世界のイカ | 約12種。山口→日本→世界の順、検索と絞り込み |
| gallery | 写真部 | 海・生きもの・食卓。ぱっぱの実写＋公開写真 |
| play | イカ部のあそび場 | エギングゲーム／墨つなぎ |
| studio | スタンプとSNS | スタンプ案の画像とダジャレの解説 |
| sources | 出典 | 写真・情報の出典一覧 |

## 作り（検索エンジンに中身が見えるようにする）

小松氏のサイトは全ページ JavaScript だけで描画しており、Google には空に見える（YFJ の SEA で起きた「ソフト404」と同じ）。
そこで **描画関数を1つにして、ビルド時にも同じ関数で HTML に書き込む**。

```
ikabu/<page>.html, ikabu/en/<page>.html   … 殻（lang・data-page・<main id="main">）
src/js/ikabu/i18n.js    … pair(ja,en) / t() / pageUrl(page, lang)
src/js/ikabu/data.js    … 写真・スポット・レシピ・図鑑・ダジャレ（日英対訳）
src/js/ikabu/shell.js   … ヘッダー（ナビ・言語切替・YFJへ戻る）とフッターの HTML
src/js/ikabu/views/<page>.js … render(lang) → HTML文字列（DOM・window に触らない純粋関数）
src/js/ikabu/pages/<page>.js … 入口。main が空なら render して、そのあと操作（絞り込み・地図・ゲーム）を結びつける
src/css/ikabu.css       … イカ部の見た目（style.css の上に重ねる）
vite.config.js          … prerender-ikabu プラグイン：/ikabu/ 配下の HTML に view と shell を書き込む
```

- 言語はパスで決まる（`/ikabu/en/` なら英語）。切り替えリンクは同じページ・クエリ・ハッシュを保つ
- `hreflang` の相互リンク、`canonical` は各言語のURL
- GA4 は YFJ と同じ `analytics.js` を読み込む
- 利用者の文字（掲示板）は必ず esc() を通す

## 段階

1. 配色・共通部品・言語切替・トップ（日英）・他ページの殻 → ぱっぱ確認
2. 中身のページ（map / sea / recipes / atlas / gallery / studio / sources）→ ぱっぱ確認
3. ゲーム2本 → ぱっぱ確認
4. 公開前チェック（noindex 解除、全ページのコンソールエラー確認、スマホ表示、出典・権利）

## 注意

- Open-Meteo の無料APIは非商用向け。イカ部で物販を始める前に契約条件を見直す（YFJ本体も同じ）
- ロゴ・イラスト・スタンプは AI 生成素材。地域ブランド名（須佐男命いか 等）の商用利用は販売前に確認
- 釣り場の具体的な位置は出さない（地図のピンは「エリアの目安」と明記）

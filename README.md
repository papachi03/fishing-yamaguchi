# YAMAGUCHI FISHING JOURNAL — 山口の海と、ダディの釣り。

## 起動方法

```bash
cd G:\fishing-yamaguchi\site
npm install   # 初回のみ
npm run dev   # 開発サーバー (http://localhost:5173)
npm run build # 本番ビルド (dist/)
```

## 構成

- `index.html` — HOME（HERO → 今日の海 → 最新釣行 → 釣果 → エリア → 夜釣り → 釣って食べる）
- `sea.html` — 海況ダッシュボード（長門/萩切替・時間別・潮汐）
- `journal.html` — 釣行Vlog一覧（ホバーで動画プレビュー）
- `log.html` — 釣果記録（魚種フィルタ）
- `spots.html` — エリア紹介
- `about.html` — サイトについて（プロフィール・Instagram 6件）
- `tackle.html` — タックル（Amazon / 楽天アフィリエイト。8カテゴリ、愛用／定番の2段）

## データの追加方法

- 釣果: `src/js/data/catches.js` に1件追加するだけ（不明項目は null → 表示されない）
- Vlog: `src/js/data/vlogs.js`
- エリア/ポイント: `src/js/data/areas.js`（spots配列にポイントを追加できる構造）
- Instagram: **自動取得** — `node scripts/build-instagram.mjs`（初回設定は `docs/INSTAGRAM_SETUP.md`）。月1回実行するとトークンも延長される。未設定の間は `src/js/data/instagram.js` の手動URL一覧を公式埋め込みで表示
- タックル: `src/js/data/tackle.js`（`asin` があればAmazon商品ページ直リンク、無ければ検索リンク。`rakutenUrl` も同様）

## アフィリエイト

- IDは `src/js/config/affiliate.js` の1箇所だけ（Amazonトラッキングタグ／楽天アフィリエイトID）
- Amazonの開示文はフッター全ページとTACKLEページ上部に自動表示（アソシエイト規約の必須事項）
- 商品画像は使っていない（Amazonの画像はAPI経由以外は転載不可のため）。写真を載せるなら自分で撮ったものを

## API

- 天気・風: **Open-Meteo**（実データ・キー不要・CORS可）— `src/js/api/weather.js`
- 波高・周期: **Open-Meteo Marine** — 同ファイルの `fetchMarine()`（釣り場の座標で取得）
- 堤防の安全判定: `src/js/api/safety.js` — 風速 5/7/10m/s・突風 10/15・波高 1.0/1.2/1.5m・向かい風で 安全/注意/危険/中止 の4段階。HOMEのチップとSEAのバンド、時間別テーブルのセル色に使用
- エリア: 萩(K5)・長門(K5共用)・下関(弟子待 A1)。`scripts/build-tide.mjs` の STATIONS と `areas.js` の `tideStn` を揃えること。下関エリアは視聴者の方の釣り場で、**サイト上では具体地名を出さず「下関」と濁す方針**（`contributor` 付き）
- 潮汐: **気象庁 潮位表の実データ** — `src/js/api/tide.js`
  気象庁はCORSを許可していないため、ビルド前に年間データを取得してJSONに変換しておく。

  ```bash
  node scripts/build-tide.mjs        # 今年ぶん
  node scripts/build-tide.mjs 2027   # 年を指定
  ```

  → `src/js/data/tide/K5-<年>.json` が生成される。**年が変わったら実行し、
  `tide.js` の import に追加すること。**
  観測地点は萩(K5)。仙崎には専用の観測地点が無いため、最寄りの萩を共用している。
- 釣行期待値・旬の魚: `src/js/api/fishing.js`
  ★10段階（潮の動き0-6 + まずめ0-2 + 潮回り0-2）。Discordブリッジ（秘書クロロ）と
  同じロジックなので、仕様を変えるときは `discord-claude-bridge/index.js` も合わせる。

## 動画・画像

元素材（`../movie/`, `../photos/`）は無変更。Web派生素材は `assets/` 以下:

- `assets/video/hero/` — HERO夕まずめ(1440/720)・灯火の夜・朝の海
- `assets/video/previews/` — Vlogカードのプレビュー(6秒/960px)
- `assets/posters/` — 各動画のposter画像
- `assets/images/` — 写真のWebP派生 (1600w/800w)

低速回線・prefers-reduced-motion では動画を読み込まずposter表示にフォールバックする。

# GitHub Pages で公開する手順

公開URL（予定）: `https://papachi03.github.io/fishing-yamaguchi/`

## 事前チェック（2026-09-11 クロロ実施・すべてOK）

- `.env`（Instagramトークン）は `.gitignore` で除外、Gitの追跡対象に含まれていないことを確認済み
- リポジトリは `site` フォルダのみ（親フォルダの元動画36GBは含まない）
- 追跡ファイル全体を秘密情報（トークン・メール・実名・電話番号）でスキャン → 該当なし
- コミットのメールアドレスは `papachi03@users.noreply.github.com`（本物のメールは記録されない）
- サイズ約29MB、100MB超のファイルなし

## ぱっぱがやること（ログインが必要な部分）

### 1. GitHubの設定でメールアドレスを非公開にする（✅ 2026-09-11 設定済み）
- https://github.com/settings/emails の「私のメールアドレスを非公開にしてください」と
  「メールアドレスを公開するコマンドラインプッシュをブロックします」の両方をオンにした
- PC側のGit（全体設定・tproject-site・このリポジトリ）も `207080942+papachi03@users.noreply.github.com` に統一済み

### 2. リポジトリを作る
1. https://github.com/new
2. Repository name: **`fishing-yamaguchi`**（この名前がURLの一部になる。変える場合は `.github/workflows/deploy.yml` の `SITE_BASE` も同じ名前に）
3. **Public** を選ぶ
4. README・.gitignore・ライセンスは**追加しない**（すでにローカルにある）
5. **Create repository**

### 3. push する
PowerShellで（初回はGitHubのログイン画面が出ることがあります）:

```powershell
cd G:\fishing-yamaguchi\site
git remote add origin https://github.com/papachi03/fishing-yamaguchi.git
git push -u origin main
```

### 4. Pages を有効にする
1. リポジトリの **Settings → Pages**
2. **Source** を **GitHub Actions** に変更（「Deploy from a branch」ではない）
3. **Actions** タブを開くと「Deploy to GitHub Pages」が動いている。緑のチェックになれば公開完了（初回2〜3分）
4. `https://papachi03.github.io/fishing-yamaguchi/` を開いて確認

## 以後の更新

```powershell
cd G:\fishing-yamaguchi\site
node scripts/build-instagram.mjs   # 月1回（Instagram新着＋トークン延長）
git add -A
git commit -m "update"
git push
```

push すると自動でビルド・公開される（1〜2分）。潮汐は年が変わる前に `node scripts/build-tide.mjs 2027` を実行して `src/js/api/tide.js` の import を足す。

## 独自ドメインにする時
1. Settings → Pages → Custom domain にドメインを入れる
2. `.github/workflows/deploy.yml` の `SITE_BASE` を `/` に変更
3. `index.html` の `og:image` を `https://<ドメイン>/assets/posters/hero_dusk.jpg` に

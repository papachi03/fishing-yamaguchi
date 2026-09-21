# 「現地の声」投稿機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 釣り人が投稿者名・場所・コメント・写真などを投稿でき、すぐ公開され、通報と管理者削除で守られる「現地の声」を釣りサイトに足す。

**Architecture:** 静的サイト（Vite・GitHub Pages）に `reports.html` を足し、投稿の受け取り・保存・通報・管理は新しいCloudflare Worker `yfj-reports`（workers.dev）が担う。本文はKV（1投稿1キー＋公開用の索引キー）、写真はR2。釣り場・魚・風の選択肢は `src/js/data/` の純粋なESMを**サイトとWorkerの両方が直接import**する（コピーを作らない）。

**Tech Stack:** Vite 5 / vanilla JS（ESM）/ Cloudflare Workers・KV・R2・Turnstile / Discord webhook / テストは `node --test`（Node 24）

**Spec:** `docs/superpowers/specs/2026-09-20-reports-ugc-design.md`

## Global Constraints

- リポジトリのルートは `G:\fishing-yamaguchi\site`。以下のパスはすべてここからの相対。
- Workerは `tproject-jp.com` に置かない（workers.dev のアドレスで動かす）。wranglerは使わず、`esbuild` で1ファイルにまとめてダッシュボードに貼る。
- 文字数：投稿者名20・コメント400。写真はJPEG・3MBまで・1枚。連続投稿は1時間3件・1日10件。通報3件で自動非表示。日付は「今日〜31日前」（JST）だけ。
- 「ダディ」「管理」「運営」「公式」「YFJ」「admin」「daddy」を含む投稿者名は拒否（NFKC正規化・小文字化・空白除去のうえで判定）。
- 生のIPアドレスを保存しない（`SHA-256(ip + IP_SALT)` の先頭16桁だけ使う）。
- 画面に出す投稿者名・コメントは必ずHTMLエスケープする。
- 利用者に見える文言はすべて日本語。英語のエラーを出さない。
- 配布・公開物に本名を入れない（表記は「ダディ」）。
- **本番への公開（Workerのデプロイ・Cloudflareの初期設定・secretの登録・`git push`）はダディが行う。** 実行者は手順書を用意し、公開後の確認だけ行う。このPCでは `npx wrangler login` をAvastが誤検知して止めるため、デプロイは**ダッシュボードに1ファイルを貼る方式**（Task 8）。
- ファイルの削除はしない。必要になったら一覧を見せて確認を取る。
- コミットメッセージは日本語。末尾に `Co-Authored-By` 行（実行時のセッションの指定に従う）。

## File Structure

**新規（データ：サイトとWorkerで共用。ブラウザAPIに触らない純粋なESM）**
- `src/js/data/spot-list.js` — 釣り場・「〇〇市内（非公開）」・「場所不明」の一覧と `placeById`
- `src/js/data/report-options.js` — 魚の選択肢 `FISH`、風の体感 `WIND_FEEL`

**新規（Worker：`worker/reports/`）**
- `src/config.js` — 上限値・予約語・許可するorigin
- `src/validate.js` — 入力の検証（純粋関数）
- `src/guard.js` — IPハッシュ・Turnstile検証・連続投稿の制限
- `src/store.js` — 投稿の保存・取得・削除・索引の作り直し
- `src/auth.js` — HMAC署名・管理Cookie・削除トークン
- `src/notify.js` — Discord通知
- `src/admin.js` — 管理ページのHTML
- `src/index.js` — 経路の振り分けとCORS
- `test/fakes.mjs` — 偽のKV・R2・fetch
- `test/*.test.mjs` — 経路ごとのテスト
- `dev-server.mjs` — 偽のKV/R2でWorkerを `http://127.0.0.1:8787` に立てる（手元の通し確認用。wranglerを使わない）
- `README.md` — バインディング・秘密の値・保守の注意

**新規（サイト）**
- `reports.html` — 「現地の声」ページ（説明・注意書き・釣り場一覧は静的に入れる）
- `src/js/config/reports.js` — 本番の接続先（WorkerのURL・Turnstileのサイトキー。空なら受付は「準備中」）
- `src/js/api/reports.js` — Workerとの通信
- `src/js/lib/resize-image.js` — 写真の縮小・JPEG化（EXIFが消える）
- `src/js/components/report-card.js` — 投稿カードのHTML（純粋関数）と `esc`
- `src/js/components/spot-list-html.js` — 釣り場一覧のHTML（純粋関数。ビルド時と画面の両方で使う）
- `src/js/components/area-reports.js` — SEAページに最新2件を出す
- `src/js/pages/reports.js` — フォームと一覧
- `test/report-card.test.mjs`・`test/spot-list.test.mjs`
- `docs/REPORTS_釣り場リスト候補.md` — 下調べの結果（ダディの確認用）
- `docs/REPORTS_公開手順.md` — ダディ向けの公開手順

**変更**
- `src/js/main.js`（NAVに Reports）／`sea.html`・`src/js/pages/sea.js`（最新2件）／`vite.config.js`（入力追加・釣り場一覧の書き込み）／`public/sitemap.xml`／`src/css/style.css`／`package.json`（`test`・`dev:worker`・`build:worker`）

---

### Task 1: 選択肢のデータ（釣り場・魚・風）と釣り場の下調べ

**Files:**
- Create: `src/js/data/spot-list.js`, `src/js/data/report-options.js`, `test/spot-list.test.mjs`, `docs/REPORTS_釣り場リスト候補.md`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `AREA_LABELS: Record<'hagi'|'nagato'|'shimonoseki'|'kudamatsu'|'hofu', string>`
  - `SPOTS: {id:string, areaId:string, name:string}[]`、`AREA_PLACES`（同じ形）、`UNKNOWN_PLACE: {id:'unknown', areaId:null, name:'場所不明'}`
  - `ALL_PLACES`、`placeById(id): place|null`
  - `FISH: {id,name}[]`、`WIND_FEEL: {id,name}[]`、`nameOf(list, id): string`

- [ ] **Step 1: 失敗するテストを書く** — `test/spot-list.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SPOTS, AREA_PLACES, UNKNOWN_PLACE, ALL_PLACES, AREA_LABELS, placeById } from '../src/js/data/spot-list.js';
import { FISH, WIND_FEEL, nameOf } from '../src/js/data/report-options.js';

test('IDは重複しない', () => {
  const ids = ALL_PLACES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('5エリアそれぞれに「市内（非公開）」がある', () => {
  for (const areaId of Object.keys(AREA_LABELS)) {
    assert.ok(AREA_PLACES.some((p) => p.areaId === areaId), areaId);
  }
  assert.equal(Object.keys(AREA_LABELS).length, 5);
});

test('釣り場は必ず5エリアのどれかに属する', () => {
  for (const s of SPOTS) assert.ok(AREA_LABELS[s.areaId], `${s.id} → ${s.areaId}`);
});

test('場所不明はエリアを持たない', () => {
  assert.equal(UNKNOWN_PLACE.areaId, null);
  assert.equal(placeById('unknown'), UNKNOWN_PLACE);
  assert.equal(placeById('no-such-id'), null);
});

test('選択肢の名前を引ける', () => {
  assert.equal(nameOf(FISH, 'none'), '釣れなかった');
  assert.equal(nameOf(WIND_FEEL, 'stronger'), '予報より強かった');
  assert.equal(nameOf(FISH, 'xxx'), '');
});
```

- [ ] **Step 2: `package.json` の scripts に追加してから、失敗を確認**

```json
"test": "node --test \"test/*.test.mjs\" \"worker/reports/test/*.test.mjs\""
```

Run: `npm test`
Expected: FAIL（`Cannot find module .../spot-list.js`）

- [ ] **Step 3: `src/js/data/report-options.js` を作る**

```js
// 「現地の声」の選択肢。サイトとWorker（worker/reports）の両方がimportする。
// ブラウザのAPIに触らないこと。IDは保存済みの投稿が参照するので変えない（名前は変えてよい）。

export const FISH = [
  { id: 'aji', name: 'アジ' },
  { id: 'aori', name: 'アオリイカ' },
  { id: 'yari', name: 'ヤリイカ' },
  { id: 'kensaki', name: 'ケンサキイカ' },
  { id: 'kouika', name: 'コウイカ・モンゴウイカ' },
  { id: 'kisu', name: 'キス' },
  { id: 'chinu', name: 'チヌ' },
  { id: 'mebaru', name: 'メバル' },
  { id: 'seabass', name: 'シーバス' },
  { id: 'aomono', name: '青物（ヤズ・ハマチ）' },
  { id: 'tachiuo', name: 'タチウオ' },
  { id: 'other', name: 'その他' },
  { id: 'none', name: '釣れなかった' },
];

export const WIND_FEEL = [
  { id: 'weaker', name: '予報より弱かった' },
  { id: 'same', name: '予報どおり' },
  { id: 'stronger', name: '予報より強かった' },
];

export const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? '';
```

- [ ] **Step 4: `src/js/data/spot-list.js` を作る**（釣り場は、まず今サイトが基準にしている2か所だけ。残りはStep 6〜7で足す）

```js
// 「現地の声」で選べる場所。サイトとWorker（worker/reports）の両方がimportする。
// ブラウザのAPIに触らないこと。
//
// ルール
//   - IDは保存済みの投稿が参照するので、一度公開したら変えない・消さない（名前の修正はよい）
//   - 追加は各エリアの末尾に足す
//   - 釣り禁止・立入禁止の場所は載せない。載せるのはダディがOKを出した場所だけ
//     （下調べの記録は docs/REPORTS_釣り場リスト候補.md）

export const AREA_LABELS = {
  hagi: '萩',
  nagato: '長門',
  shimonoseki: '下関',
  kudamatsu: '下松',
  hofu: '防府',
};

export const SPOTS = [
  { id: 'hagi-koshigahama', areaId: 'hagi', name: '越ヶ浜漁港' },
  { id: 'nagato-senzaki-jinkoto', areaId: 'nagato', name: '仙崎人工島' },
];

// 場所を細かく出したくない人向け
export const AREA_PLACES = Object.entries(AREA_LABELS).map(([areaId, label]) => ({
  id: `${areaId}-city`,
  areaId,
  name: `${label}市内（詳しい場所は非公開）`,
}));

export const UNKNOWN_PLACE = { id: 'unknown', areaId: null, name: '場所不明' };

export const ALL_PLACES = [...SPOTS, ...AREA_PLACES, UNKNOWN_PLACE];

export const placeById = (id) => ALL_PLACES.find((p) => p.id === id) ?? null;
```

- [ ] **Step 5: テストが通るのを確認してコミット**

Run: `npm test`
Expected: PASS（5件）

```bash
git add package.json src/js/data/spot-list.js src/js/data/report-options.js test/spot-list.test.mjs
git commit -m "現地の声：場所・魚・風の選択肢データを追加"
```

- [ ] **Step 6: 釣り場の下調べ** — `docs/REPORTS_釣り場リスト候補.md` を作る

対象は萩市・長門市・下関市・下松市・防府市の、**漁港・防波堤・波止・海釣り公園・一般に知られた釣りポイント**。WebSearch／WebFetchで調べ、1か所につき1行で次の表を埋める。

```markdown
# 「現地の声」釣り場リスト候補（下調べ：YYYY-MM-DD）

判定の意味：**掲載候補**＝複数の情報源で釣り場として紹介され、禁止の情報が見当たらない／**要確認**＝禁止・制限の情報が一部にある、または情報源が1つだけ／**除外**＝釣り禁止・立入禁止が確認できた

| エリア | 名前（表示名） | 種類 | 情報源（URL 2つまで） | 釣り禁止・立入禁止の情報 | 判定 | ダディの判断（OK／外す） |
|---|---|---|---|---|---|---|
| 萩 | 越ヶ浜漁港 | 漁港 | … | 見当たらず | 掲載候補 | |
```

守ること：
- 個人のブログだけが根拠の「穴場」は載せない（「有名な釣り場」に限る。spec §7）。
- SOLAS条約の立入制限区域・工場や発電所の敷地・港湾の関係者以外立入禁止区域は**除外**。自治体や港湾管理者の告知を優先して確認する。
- 下関はすでに「視聴者の釣り場は具体地名を出さない」方針で伏せた場所がある（`src/js/data/areas.js` の下関は港名を出していない）。**一般に有名な釣り場の名前を選択肢に出すこと**と、**視聴者個人の釣り場を明かすこと**は別なので、リストには載せてよいが、`areas.js` 側は変えない。
- 1エリア6〜12か所を目安にする（多すぎるとプルダウンが選びにくい）。

- [ ] **Step 7: ダディに確認してもらい、OKの出た場所だけ `SPOTS` に足す**

**ここは人の確認が要る関門。** 候補の表をダディに見せ、「ダディの判断」欄を埋めてもらう。OKの場所だけを、エリアごとに `SPOTS` の末尾へ `{ id: '<area>-<ローマ字>', areaId, name }` の形で足す。IDは半角英小文字とハイフンだけ。

Run: `npm test`
Expected: PASS（IDの重複・エリアの所属チェックが通る）

```bash
git add src/js/data/spot-list.js docs/REPORTS_釣り場リスト候補.md
git commit -m "現地の声：ダディ確認済みの釣り場リストを追加"
```

> Task 2以降はStep 7を待たずに進めてよい（`SPOTS` が2件でも全機能は動く）。公開（Task 8）の前にStep 7を終えること。

---

### Task 2: Workerの土台 — 設定値・入力の検証・テスト用の偽物

**Files:**
- Create: `worker/reports/src/config.js`, `worker/reports/src/validate.js`, `worker/reports/test/fakes.mjs`, `worker/reports/test/validate.test.mjs`

**Interfaces:**
- Consumes: `placeById`（Task 1）、`FISH`・`WIND_FEEL`（Task 1）
- Produces:
  - `LIMITS`・`RESERVED_WORDS`・`ALLOWED_ORIGINS`（`config.js`）
  - `validatePost(fields, now?: Date): {ok:true, post:{name,spotId,areaId,comment,fish,wind,date}} | {ok:false, error:string}`
  - `validatePhoto(bytes: Uint8Array|null): {ok:true, hasPhoto:boolean} | {ok:false, error:string}`
  - `jstDate(d: Date): 'YYYY-MM-DD'`
  - テスト用：`fakeKV()`・`fakeR2()`・`makeEnv()`・`stubFetch(handler)`・`okFetch(turnstileOk?)`・`postForm(fields, {photo?, ip?, origin?}): Request`・`TEST_ORIGIN`・`TEST_BASE`・`jpegBytes({exif?:boolean, size?:number})`

- [ ] **Step 1: テスト用の偽物を作る** — `worker/reports/test/fakes.mjs`

```js
// ネットにつながずにWorkerを試すための偽物。

export function fakeKV() {
  const store = new Map();
  return {
    _store: store,
    async get(key, type) {
      const v = store.get(key);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit);
      return { keys: keys.map((name) => ({ name })), list_complete: true };
    },
  };
}

export function fakeR2() {
  const store = new Map();
  return {
    _store: store,
    async put(key, bytes) {
      store.set(key, bytes);
    },
    async get(key) {
      const bytes = store.get(key);
      if (!bytes) return null;
      return { body: bytes, arrayBuffer: async () => bytes.buffer };
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

export function makeEnv(extra = {}) {
  return {
    REPORTS_KV: fakeKV(),
    REPORTS_R2: fakeR2(),
    TURNSTILE_SECRET: 'test-turnstile-secret',
    IP_SALT: 'test-ip-salt',
    SIGN_SECRET: 'test-sign-secret-please-be-long',
    ADMIN_PASSPHRASE: 'aikotoba-test',
    DISCORD_WEBHOOK_URL: 'https://discord.test/webhook',
    ...extra,
  };
}

// fetch を差し替える。handler(url, init) が Response を返す。呼び出しの記録を返す
export function stubFetch(handler) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push({ url, init });
    return handler(url, init);
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

// Turnstileは成功、Discordは204を返す標準の差し替え
export const okFetch = (turnstileOk = true) => (url) =>
  url.includes('siteverify')
    ? new Response(JSON.stringify({ success: turnstileOk }), { status: 200 })
    : new Response(null, { status: 204 });

export const TEST_ORIGIN = 'https://papachi03.github.io';
export const TEST_BASE = 'https://yfj-reports.example.workers.dev';

// 投稿フォームの送信をまねる Request を作る
export function postForm(fields, { photo = null, ip = '203.0.113.1', origin = TEST_ORIGIN } = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries({ 'cf-turnstile-response': 'tok', ...fields })) form.set(k, v);
  if (photo) form.set('photo', new File([photo], 'a.jpg', { type: 'image/jpeg' }));
  return new Request(`${TEST_BASE}/posts`, {
    method: 'POST',
    headers: { origin, 'cf-connecting-ip': ip },
    body: form,
  });
}

// ごく小さいJPEGらしきバイト列。exif:true で "Exif\0\0" を埋め込む
export function jpegBytes({ exif = false, size = 64 } = {}) {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, exif ? 0xe1 : 0xe0, 0x00, 0x10]);
  if (exif) bytes.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 6);
  return bytes;
}
```

- [ ] **Step 2: 失敗するテストを書く** — `worker/reports/test/validate.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePost, validatePhoto, jstDate } from '../src/validate.js';
import { jpegBytes } from './fakes.mjs';

const NOW = new Date('2026-09-20T03:00:00Z'); // JST 2026-09-20 12:00
const base = { name: 'つりお', spotId: 'hagi-koshigahama', comment: '風が強かったです' };

test('最小の入力で通る。日付の初期値は今日（JST）', () => {
  const v = validatePost(base, NOW);
  assert.equal(v.ok, true);
  assert.deepEqual(v.post, {
    name: 'つりお', spotId: 'hagi-koshigahama', areaId: 'hagi',
    comment: '風が強かったです', fish: '', wind: '', date: '2026-09-20',
  });
});

test('JSTの日付になる（UTCでは前日でも）', () => {
  assert.equal(jstDate(new Date('2026-09-19T16:00:00Z')), '2026-09-20');
});

test('名前：空・21文字・予約語を弾く', () => {
  assert.equal(validatePost({ ...base, name: '  ' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, name: 'あ'.repeat(21) }, NOW).ok, false);
  assert.equal(validatePost({ ...base, name: 'あ'.repeat(20) }, NOW).ok, true);
  for (const n of ['ダディ', 'ﾀﾞﾃﾞｨ', 'だでぃ', 'Ｄａｄｄｙ', 'Y F J', '管理人', '公式アカウント', 'Admin']) {
    assert.equal(validatePost({ ...base, name: n }, NOW).ok, false, n);
  }
});

test('場所：リストに無いIDを弾く。場所不明はエリアなし', () => {
  assert.equal(validatePost({ ...base, spotId: 'nowhere' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, spotId: 'unknown' }, NOW).post.areaId, null);
  assert.equal(validatePost({ ...base, spotId: 'hofu-city' }, NOW).post.areaId, 'hofu');
});

test('コメント：空・401文字を弾く。制御文字は消す', () => {
  assert.equal(validatePost({ ...base, comment: '' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, comment: 'あ'.repeat(401) }, NOW).ok, false);
  assert.equal(validatePost({ ...base, comment: 'あ\u0007い\r\nう' }, NOW).post.comment, 'あい\nう');
});

test('魚・風：リストに無い値を弾く', () => {
  assert.equal(validatePost({ ...base, fish: 'aji', wind: 'stronger' }, NOW).ok, true);
  assert.equal(validatePost({ ...base, fish: 'kujira' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, wind: 'typhoon' }, NOW).ok, false);
});

test('日付：未来・32日前・形式違いを弾く。31日前は通る', () => {
  assert.equal(validatePost({ ...base, date: '2026-09-21' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, date: '2026-08-19' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, date: '2026-08-20' }, NOW).ok, true);
  assert.equal(validatePost({ ...base, date: '9/20' }, NOW).ok, false);
  assert.equal(validatePost({ ...base, date: '2026-13-40' }, NOW).ok, false);
});

test('写真：なし・JPEG・大きすぎ・JPEG以外・EXIF入り', () => {
  assert.deepEqual(validatePhoto(null), { ok: true, hasPhoto: false });
  assert.deepEqual(validatePhoto(jpegBytes()), { ok: true, hasPhoto: true });
  assert.equal(validatePhoto(jpegBytes({ size: 3 * 1024 * 1024 + 1 })).ok, false);
  assert.equal(validatePhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])).ok, false);
  assert.equal(validatePhoto(jpegBytes({ exif: true })).ok, false);
});
```

Run: `npm test`
Expected: FAIL（`Cannot find module .../src/validate.js`）

- [ ] **Step 3: `worker/reports/src/config.js` を作る**

```js
// 「現地の声」Workerの決まりごと。数字を変えるときは spec（docs/superpowers/specs/2026-09-20-reports-ugc-design.md）も直す。

export const LIMITS = {
  name: 20,
  comment: 400,
  photoBytes: 3 * 1024 * 1024,
  perHour: 3,
  perDay: 10,
  reportsToHide: 3,
  maxAgeDays: 31,
  indexSize: 50, // 公開用の索引に入れる件数
  adminLoginPerHour: 5,
};

// 投稿者名に含まれていたら断る言葉（NFKC・小文字化・空白除去のあとで比べる）
export const RESERVED_WORDS = ['ダディ', 'だでぃ', 'daddy', '管理', '運営', '公式', 'yfj', 'admin'];

// 投稿・一覧の取得を許すサイト
export const ALLOWED_ORIGINS = [
  'https://papachi03.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
];

// メンション先（ダディのDiscordユーザーID）は Worker の secret `NOTIFY_MENTION_USER_ID` から読む。公開リポジトリに個人IDを置かない
```

- [ ] **Step 4: `worker/reports/src/validate.js` を作る**

```js
// 入力の検証。ネットにもKVにも触らない純粋な関数だけを置く。
import { LIMITS, RESERVED_WORDS } from './config.js';
import { placeById } from '../../../src/js/data/spot-list.js';
import { FISH, WIND_FEEL } from '../../../src/js/data/report-options.js';

// 改行(\n)とタブ以外の制御文字
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const DAY_MS = 86400 * 1000;

/** 日本時間の日付（YYYY-MM-DD）。WorkerはUTCで動くので必ずこれを通す */
export const jstDate = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const fail = (error) => ({ ok: false, error });

export function validatePost(f, now = new Date()) {
  const name = String(f.name ?? '').normalize('NFKC').replace(CONTROL, '').trim();
  if (!name) return fail('お名前を入れてください。');
  if ([...name].length > LIMITS.name) return fail(`お名前は${LIMITS.name}文字までです。`);
  const key = name.toLowerCase().replace(/\s+/g, '');
  if (RESERVED_WORDS.some((w) => key.includes(w))) {
    return fail('そのお名前は使えません。別のお名前にしてください。');
  }

  const place = placeById(String(f.spotId ?? ''));
  if (!place) return fail('場所を選んでください。');

  const comment = String(f.comment ?? '').replace(/\r\n/g, '\n').replace(CONTROL, '').trim();
  if (!comment) return fail('コメントを入れてください。');
  if ([...comment].length > LIMITS.comment) return fail(`コメントは${LIMITS.comment}文字までです。`);

  const fish = f.fish ? String(f.fish) : '';
  if (fish && !FISH.some((x) => x.id === fish)) return fail('魚の選択が正しくありません。');

  const wind = f.wind ? String(f.wind) : '';
  if (wind && !WIND_FEEL.some((x) => x.id === wind)) return fail('風の体感の選択が正しくありません。');

  const today = jstDate(now);
  const date = f.date ? String(f.date) : today;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return fail('日付が正しくありません。');
  }
  if (date > today) return fail('未来の日付は選べません。');
  if (date < jstDate(new Date(now.getTime() - LIMITS.maxAgeDays * DAY_MS))) {
    return fail(`${LIMITS.maxAgeDays}日より前の情報は投稿できません。`);
  }

  return { ok: true, post: { name, spotId: place.id, areaId: place.areaId, comment, fish, wind, date } };
}

// "Exif\0\0" が先頭64KBにあるか。フォームは写真を作り直して送るので、普通は入ってこない。
// フォームを通さない投稿で位置情報つきの写真が入るのを防ぐ（場所を伏せた人を守る）
function hasExif(bytes) {
  const sig = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const end = Math.min(bytes.length, 65536) - sig.length;
  for (let i = 0; i <= end; i++) {
    if (sig.every((b, j) => bytes[i + j] === b)) return true;
  }
  return false;
}

export function validatePhoto(bytes) {
  if (!bytes || bytes.length === 0) return { ok: true, hasPhoto: false };
  if (bytes.length > LIMITS.photoBytes) return fail('写真が大きすぎます（3MBまで）。');
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    return fail('写真はJPEG形式だけ受け付けます。');
  }
  if (hasExif(bytes)) {
    return fail('写真に撮影情報が残っています。投稿フォームから写真を選び直してください。');
  }
  return { ok: true, hasPhoto: true };
}
```

- [ ] **Step 5: テストが通るのを確認してコミット**

Run: `npm test`
Expected: PASS（Task 1の5件＋このタスクの8件）

```bash
git add worker/reports/src/config.js worker/reports/src/validate.js worker/reports/test/fakes.mjs worker/reports/test/validate.test.mjs
git commit -m "現地の声Worker：設定値と入力の検証を追加"
```

---

### Task 3: 投稿する・一覧を返す・写真を配る

**Files:**
- Create: `worker/reports/src/guard.js`, `worker/reports/src/store.js`, `worker/reports/src/index.js`, `worker/reports/test/posts.test.mjs`

**Interfaces:**
- Consumes: `validatePost`・`validatePhoto`・`LIMITS`・`ALLOWED_ORIGINS`（Task 2）、テスト用の偽物（Task 2）
- Produces:
  - `guard.js`：`sha256Hex(s)`、`ipHashOf(request, env): Promise<string>`（16桁）、`verifyTurnstile(token, request, env): Promise<boolean>`、`allowPost(env, hash, now?): Promise<boolean>`、`allowLogin(env, hash, now?): Promise<boolean>`
  - `store.js`：`newId(now?)`、`isId(s)`、`photoKey(id)`、`getPost(env,id)`、`putPost(env,post)`、`removePost(env,id)`、`listPosts(env,limit?)`、`toPublic(post)`、`rebuildIndex(env,{upsert?,removeId?})`、`getIndex(env)`
  - 保存する投稿の形：`{id,name,spotId,areaId,comment,fish,wind,date,hasPhoto,createdAt,hidden,reports,by}`。公開用（`toPublic`）は `hidden`・`reports`・`by` を除いたもの
  - `index.js`：`export default { fetch(request, env, ctx) }`。このタスクでは `OPTIONS *`・`GET /posts`・`POST /posts`・`GET /photo/<id>`。`json(obj, status, request, extraHeaders?)` と `notFound()` を同ファイル内に定義（Task 4・5が使う）
  - `index.js` は `notifyNewPost` を **`./notify.js` から import する**（Task 4で作る）。このタスクでは中身が空の `notify.js` を置く（Step 3）

- [ ] **Step 1: 失敗するテストを書く** — `worker/reports/test/posts.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeEnv, stubFetch, okFetch, jpegBytes, postForm, TEST_ORIGIN as ORIGIN, TEST_BASE as BASE } from './fakes.mjs';

const ctx = { waitUntil: (p) => p };
const valid = { name: 'つりお', spotId: 'hagi-koshigahama', comment: '北風が強く、体感は5mありました' };
const get = (path, env, headers = {}) => worker.fetch(new Request(`${BASE}${path}`, { headers }), env, ctx);

test('投稿すると201で公開用の形が返り、一覧に出る', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const res = await worker.fetch(postForm({ ...valid, fish: 'aji', wind: 'stronger' }), env, ctx);
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
    const { ok, post } = await res.json();
    assert.equal(ok, true);
    assert.equal(post.name, 'つりお');
    assert.equal(post.areaId, 'hagi');
    assert.equal(post.hasPhoto, false);
    assert.equal('by' in post, false);
    assert.equal('reports' in post, false);

    const list = await (await get('/posts', env, { origin: ORIGIN })).json();
    assert.equal(list.posts.length, 1);
    assert.equal(list.posts[0].id, post.id);
  } finally {
    f.restore();
  }
});

test('生のIPを保存しない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    await worker.fetch(postForm(valid, { ip: '198.51.100.77' }), env, ctx);
    const all = [...env.REPORTS_KV._store.entries()].map(([k, v]) => k + v).join('\n');
    assert.equal(all.includes('198.51.100.77'), false);
  } finally {
    f.restore();
  }
});

test('入力がおかしいと400で日本語の理由が返り、何も保存しない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const res = await worker.fetch(postForm({ ...valid, name: 'ダディ' }), env, ctx);
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /お名前/);
    assert.equal(env.REPORTS_KV._store.size, 0);
  } finally {
    f.restore();
  }
});

test('Turnstileに失敗すると403で、保存しない', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch(false));
  try {
    const res = await worker.fetch(postForm(valid), env, ctx);
    assert.equal(res.status, 403);
    assert.equal((await get('/posts', env)).status, 200);
    assert.equal((await (await get('/posts', env)).json()).posts.length, 0);
  } finally {
    f.restore();
  }
});

test('同じ人は1時間に3件まで。4件目は429。別の人は投稿できる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    for (let i = 0; i < 3; i++) {
      assert.equal((await worker.fetch(postForm(valid), env, ctx)).status, 201);
    }
    const fourth = await worker.fetch(postForm(valid), env, ctx);
    assert.equal(fourth.status, 429);
    assert.match((await fourth.json()).error, /1時間に3件/);
    assert.equal((await worker.fetch(postForm(valid, { ip: '203.0.113.2' }), env, ctx)).status, 201);
  } finally {
    f.restore();
  }
});

test('写真つきの投稿はR2に入り、/photo/<id> で取れる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const res = await worker.fetch(postForm(valid, { photo: jpegBytes() }), env, ctx);
    const { post } = await res.json();
    assert.equal(post.hasPhoto, true);
    const img = await get(`/photo/${post.id}`, env);
    assert.equal(img.status, 200);
    assert.equal(img.headers.get('content-type'), 'image/jpeg');
    assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    f.restore();
  }
});

test('EXIF入りの写真は400', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const res = await worker.fetch(postForm(valid, { photo: jpegBytes({ exif: true }) }), env, ctx);
    assert.equal(res.status, 400);
  } finally {
    f.restore();
  }
});

test('一覧はエリアで絞れ、新しい順で、件数を絞れる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    await worker.fetch(postForm({ ...valid, comment: '1件目' }, { ip: '203.0.113.11' }), env, ctx);
    await new Promise((r) => setTimeout(r, 5));
    await worker.fetch(postForm({ ...valid, spotId: 'hofu-city', comment: '2件目' }, { ip: '203.0.113.12' }), env, ctx);
    await new Promise((r) => setTimeout(r, 5));
    await worker.fetch(postForm({ ...valid, comment: '3件目' }, { ip: '203.0.113.13' }), env, ctx);

    const all = (await (await get('/posts', env)).json()).posts;
    assert.deepEqual(all.map((p) => p.comment), ['3件目', '2件目', '1件目']);
    const hagi = (await (await get('/posts?area=hagi&limit=1', env)).json()).posts;
    assert.deepEqual(hagi.map((p) => p.comment), ['3件目']);
  } finally {
    f.restore();
  }
});

test('許可していないサイトにはCORSヘッダーを付けない。知らない経路は404', async () => {
  const env = makeEnv();
  const res = await get('/posts', env, { origin: 'https://evil.example' });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal((await get('/nope', env)).status, 404);
  assert.equal((await get('/photo/not-an-id', env)).status, 404);
});
```

Run: `npm test`
Expected: FAIL（`Cannot find module .../src/index.js`）

- [ ] **Step 2: `worker/reports/src/guard.js` を作る**

```js
// 荒らし対策の入口：IPのハッシュ化・Turnstileの検証・連続投稿の制限。
import { LIMITS } from './config.js';

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 生のIPは保存しない。塩を混ぜたハッシュの先頭16桁だけを「同じ人か」の判定に使う */
export async function ipHashOf(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  return (await sha256Hex(`${ip}|${env.IP_SALT}`)).slice(0, 16);
}

export async function verifyTurnstile(token, request, env) {
  if (!token || typeof token !== 'string') return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: request.headers.get('cf-connecting-ip') || '',
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('turnstile verify error', String(err));
    return false;
  }
}

const count = async (env, key) => Number(await env.REPORTS_KV.get(key)) || 0;

/** 1時間3件・1日10件。枠が空いていれば1つ使って true */
export async function allowPost(env, hash, now = Date.now()) {
  const hourKey = `rl:${hash}:h:${Math.floor(now / 3600000)}`;
  const dayKey = `rl:${hash}:d:${Math.floor(now / 86400000)}`;
  const [h, d] = await Promise.all([count(env, hourKey), count(env, dayKey)]);
  if (h >= LIMITS.perHour || d >= LIMITS.perDay) return false;
  await Promise.all([
    env.REPORTS_KV.put(hourKey, String(h + 1), { expirationTtl: 7200 }),
    env.REPORTS_KV.put(dayKey, String(d + 1), { expirationTtl: 93600 }),
  ]);
  return true;
}

/** 管理ページの合言葉の試行は1時間5回まで */
export async function allowLogin(env, hash, now = Date.now()) {
  const key = `al:${hash}:${Math.floor(now / 3600000)}`;
  const n = await count(env, key);
  if (n >= LIMITS.adminLoginPerHour) return false;
  await env.REPORTS_KV.put(key, String(n + 1), { expirationTtl: 7200 });
  return true;
}
```

- [ ] **Step 3: `worker/reports/src/store.js` と、空の `worker/reports/src/notify.js` を作る**

`worker/reports/src/store.js`:

```js
// 投稿の保存場所。本文はKV（1投稿1キー）、写真はR2。
// 一覧の表示は「公開用の索引」1キーを読むだけで済むようにしてある（閲覧のたびにKVを何十回も読まない）。
import { LIMITS } from './config.js';

const POST = 'post:';
const INDEX = 'index:public';

/** 新しい投稿ほど辞書順で前に来るID（KVのlistは辞書順なので、これで新しい順に並ぶ） */
export function newId(now = Date.now()) {
  const inv = String(9999999999999 - now).padStart(13, '0');
  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${inv}-${rand}`;
}
export const isId = (s) => /^\d{13}-[0-9a-f]{8}$/.test(String(s));
export const photoKey = (id) => `photo/${id}.jpg`;

export const getPost = (env, id) => env.REPORTS_KV.get(POST + id, 'json');
export const putPost = (env, post) => env.REPORTS_KV.put(POST + post.id, JSON.stringify(post));

export async function removePost(env, id) {
  await env.REPORTS_KV.delete(POST + id);
  await env.REPORTS_R2.delete(photoKey(id));
}

/** 非表示のものも含めて新しい順（管理ページと索引の作り直しで使う） */
export async function listPosts(env, limit = 200) {
  const { keys } = await env.REPORTS_KV.list({ prefix: POST, limit });
  const posts = await Promise.all(keys.map((k) => env.REPORTS_KV.get(k.name, 'json')));
  return posts.filter(Boolean);
}

/** 外に出してよい項目だけ（hidden・reports・by は出さない） */
export const toPublic = ({ id, name, spotId, areaId, comment, fish, wind, date, hasPhoto, createdAt }) => ({
  id, name, spotId, areaId, comment, fish, wind, date, hasPhoto, createdAt,
});

/**
 * 公開用の索引を作り直す。
 * KVのlistは書いた直後の内容がすぐ見えないことがあるので、いま書いた投稿は upsert で、
 * いま消した投稿は removeId で明示して、索引には必ず反映させる。
 */
export async function rebuildIndex(env, { upsert = null, removeId = null } = {}) {
  let posts = await listPosts(env);
  if (upsert) posts = [upsert, ...posts.filter((p) => p.id !== upsert.id)];
  if (removeId) posts = posts.filter((p) => p.id !== removeId);
  posts.sort((a, b) => (a.id < b.id ? -1 : 1));
  const pub = posts.filter((p) => !p.hidden).slice(0, LIMITS.indexSize).map(toPublic);
  await env.REPORTS_KV.put(INDEX, JSON.stringify(pub));
  return pub;
}

export const getIndex = async (env) => (await env.REPORTS_KV.get(INDEX, 'json')) ?? [];
```

`worker/reports/src/notify.js`（Task 4で中身を書く。いまは何もしない）:

```js
// Discordへの通知。中身は Task 4 で入れる。
export async function notifyNewPost() {}
export async function notifyHidden() {}
```

- [ ] **Step 4: `worker/reports/src/index.js` を作る**

```js
/**
 * YFJ「現地の声」Worker
 *
 * 釣りサイト（papachi03.github.io/fishing-yamaguchi）の投稿を受け取り、保存し、配る。
 * ⚠️ tproject-jp.com の下には置かない（誰でも投稿できる場所が荒らされると、ドメインごと
 *    Googleセーフブラウジングに判定される恐れがある。2026-09-13〜15の教訓）。workers.dev で動かす。
 *
 * 経路
 *   GET  /posts?area=<id>&limit=<n>   公開中の投稿（新しい順）
 *   POST /posts                       投稿（multipart/form-data）
 *   GET  /photo/<id>                  写真
 *   POST /posts/<id>/report           通報                       … Task 4
 *   /admin…                           管理ページ                 … Task 5
 */
import { LIMITS, ALLOWED_ORIGINS } from './config.js';
import { validatePost, validatePhoto } from './validate.js';
import { ipHashOf, verifyTurnstile, allowPost } from './guard.js';
import { newId, isId, photoKey, getPost, putPost, toPublic, rebuildIndex, getIndex } from './store.js';
import { notifyNewPost } from './notify.js';

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  return ALLOWED_ORIGINS.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
}

export function json(obj, status, request, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(request), ...extra },
  });
}

export const notFound = () => new Response('Not found', { status: 404 });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: { ...corsHeaders(request), 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-max-age': '86400' },
        });
      }
      if (path === '/posts' && request.method === 'GET') return await handleList(url, request, env);
      if (path === '/posts' && request.method === 'POST') return await handleCreate(request, env, ctx);

      const photo = path.match(/^\/photo\/([^/]+)$/);
      if (photo && request.method === 'GET') return await handlePhoto(photo[1], env);

      return notFound();
    } catch (err) {
      console.error('unhandled', err && err.stack ? err.stack : String(err));
      return json({ ok: false, error: '処理中に問題が起きました。時間をおいてもう一度お試しください。' }, 500, request);
    }
  },
};

async function handleList(url, request, env) {
  const area = url.searchParams.get('area');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || LIMITS.indexSize, 1), LIMITS.indexSize);
  let posts = await getIndex(env);
  if (area) posts = posts.filter((p) => p.areaId === area);
  return json({ ok: true, posts: posts.slice(0, limit) }, 200, request, { 'cache-control': 'public, max-age=30' });
}

async function handleCreate(request, env, ctx) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '送信の形式が正しくありません。' }, 400, request);
  }

  const fields = Object.fromEntries(['name', 'spotId', 'comment', 'fish', 'wind', 'date'].map((k) => [k, form.get(k)]));
  const v = validatePost(fields);
  if (!v.ok) return json({ ok: false, error: v.error }, 400, request);

  const file = form.get('photo');
  let bytes = null;
  if (file && typeof file !== 'string' && file.size > 0) {
    if (file.size > LIMITS.photoBytes) return json({ ok: false, error: '写真が大きすぎます（3MBまで）。' }, 400, request);
    bytes = new Uint8Array(await file.arrayBuffer());
  }
  const pv = validatePhoto(bytes);
  if (!pv.ok) return json({ ok: false, error: pv.error }, 400, request);

  if (!(await verifyTurnstile(form.get('cf-turnstile-response'), request, env))) {
    return json({ ok: false, error: 'ロボットでないことの確認に失敗しました。ページを読み込み直して、もう一度お試しください。' }, 403, request);
  }

  const hash = await ipHashOf(request, env);
  if (!(await allowPost(env, hash))) {
    return json({ ok: false, error: `投稿は1時間に${LIMITS.perHour}件、1日に${LIMITS.perDay}件までです。時間をおいてお試しください。` }, 429, request);
  }

  const id = newId();
  const post = { id, ...v.post, hasPhoto: pv.hasPhoto, createdAt: new Date().toISOString(), hidden: false, reports: 0, by: hash };
  if (pv.hasPhoto) await env.REPORTS_R2.put(photoKey(id), bytes, { httpMetadata: { contentType: 'image/jpeg' } });
  await putPost(env, post);
  await rebuildIndex(env, { upsert: post });

  // 通知の失敗は投稿の成否に影響させない
  ctx.waitUntil(notifyNewPost(env, post, new URL(request.url).origin).catch((e) => console.error('notify failed', String(e))));

  return json({ ok: true, post: toPublic(post) }, 201, request);
}

async function handlePhoto(id, env) {
  if (!isId(id)) return notFound();
  const post = await getPost(env, id);
  if (!post || post.hidden || !post.hasPhoto) return notFound();
  const obj = await env.REPORTS_R2.get(photoKey(id));
  if (!obj) return notFound();
  return new Response(obj.body, {
    headers: {
      'content-type': 'image/jpeg',
      'x-content-type-options': 'nosniff',
      // 非表示・削除がなるべく早く効くよう、長くは控えさせない
      'cache-control': 'public, max-age=3600',
    },
  });
}
```

- [ ] **Step 5: テストが通るのを確認してコミット**

Run: `npm test`
Expected: PASS（このタスクの9件を含め全件）

```bash
git add worker/reports/src/guard.js worker/reports/src/store.js worker/reports/src/notify.js worker/reports/src/index.js worker/reports/test/posts.test.mjs
git commit -m "現地の声Worker：投稿・一覧・写真の配信を追加"
```

---

### Task 4: 通報（3件で自動非表示）とDiscord通知

**Files:**
- Create: `worker/reports/src/auth.js`, `worker/reports/test/report.test.mjs`
- Modify: `worker/reports/src/notify.js`（全体を書き換え）, `worker/reports/src/index.js`

**Interfaces:**
- Consumes: `getPost`・`putPost`・`rebuildIndex`・`isId`（Task 3）、`ipHashOf`（Task 3）、`json`・`notFound`（Task 3）、`LIMITS`・`NOTIFY_MENTION_USER_ID`（Task 2）、`placeById`・`nameOf`・`FISH`・`WIND_FEEL`（Task 1）
- Produces:
  - `auth.js`：`hmacHex(message, secret): Promise<string>`、`safeEqual(a, b): boolean`、`makeDeleteToken(env, postId, now?): Promise<string>`（形は `<postId>.<期限の秒>.<署名>`・7日有効）、`readDeleteToken(env, token, now?): Promise<string|null>`（有効なら postId）
  - `notify.js`：`notifyNewPost(env, post, origin)`、`notifyHidden(env, post, origin)`
  - 経路 `POST /posts/<id>/report` → `{ok:true, hidden:boolean}`

- [ ] **Step 1: 失敗するテストを書く** — `worker/reports/test/report.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeDeleteToken, readDeleteToken } from '../src/auth.js';
import { makeEnv, stubFetch, okFetch, postForm, TEST_ORIGIN as ORIGIN, TEST_BASE as BASE } from './fakes.mjs';

const ctx = { waitUntil: (p) => p };
const valid = { name: 'つりお', spotId: 'hagi-koshigahama', comment: '<b>波</b>が高い @everyone' };

const report = (id, ip, env) =>
  worker.fetch(new Request(`${BASE}/posts/${id}/report`, { method: 'POST', headers: { origin: ORIGIN, 'cf-connecting-ip': ip } }), env, ctx);
const list = async (env) => (await (await worker.fetch(new Request(`${BASE}/posts`), env, ctx)).json()).posts;

async function createPost(env) {
  const res = await worker.fetch(postForm(valid), env, ctx);
  return (await res.json()).post;
}

test('新しい投稿をDiscordに知らせる（本文・削除リンクつき。メンションは展開させない）', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const call = f.calls.find((c) => c.url === env.DISCORD_WEBHOOK_URL);
    assert.ok(call, 'webhookが呼ばれる');
    const body = JSON.parse(call.init.body);
    assert.match(body.content, /つりお/);
    assert.match(body.content, /越ヶ浜漁港/);
    assert.match(body.content, new RegExp(`${BASE}/admin/delete\\?token=`));
    assert.deepEqual(body.allowed_mentions.parse, []);
    const token = body.content.match(/token=([^\s]+)/)[1];
    assert.equal(await readDeleteToken(env, token), post.id);
  } finally {
    f.restore();
  }
});

test('webhookが未設定・失敗でも投稿は成功する', async () => {
  const env = makeEnv({ DISCORD_WEBHOOK_URL: undefined });
  const f = stubFetch(okFetch());
  try {
    assert.ok((await createPost(env)).id);
  } finally {
    f.restore();
  }
  const env2 = makeEnv();
  const f2 = stubFetch((url) => (url.includes('siteverify') ? new Response('{"success":true}') : Promise.reject(new Error('down'))));
  try {
    assert.ok((await createPost(env2)).id);
  } finally {
    f2.restore();
  }
});

test('通報：同じ人の2回目は数えない。3人目で非表示になり、一覧と写真から消え、知らせが飛ぶ', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    assert.deepEqual(await (await report(post.id, '203.0.113.10', env)).json(), { ok: true, hidden: false });
    assert.deepEqual(await (await report(post.id, '203.0.113.10', env)).json(), { ok: true, hidden: false });
    assert.equal((await env.REPORTS_KV.get(`post:${post.id}`, 'json')).reports, 1);

    await report(post.id, '203.0.113.11', env);
    assert.equal((await list(env)).length, 1);
    const third = await (await report(post.id, '203.0.113.12', env)).json();
    assert.deepEqual(third, { ok: true, hidden: true });
    assert.equal((await list(env)).length, 0);

    const hiddenNotice = f.calls.filter((c) => c.url === env.DISCORD_WEBHOOK_URL).map((c) => JSON.parse(c.init.body).content);
    assert.ok(hiddenNotice.some((t) => t.includes('非表示')));
  } finally {
    f.restore();
  }
});

test('通報：存在しない投稿は404', async () => {
  const env = makeEnv();
  assert.equal((await report('0000000000000-deadbeef', '203.0.113.10', env)).status, 404);
  assert.equal((await report('xxx', '203.0.113.10', env)).status, 404);
});

test('削除トークン：期限切れと改ざんを弾く', async () => {
  const env = makeEnv();
  const now = Date.UTC(2026, 8, 20);
  const token = await makeDeleteToken(env, '1234567890123-abcdef01', now);
  assert.equal(await readDeleteToken(env, token, now), '1234567890123-abcdef01');
  assert.equal(await readDeleteToken(env, token, now + 8 * 86400000), null);
  assert.equal(await readDeleteToken(env, token.replace('1234567890123', '1234567890124'), now), null);
  assert.equal(await readDeleteToken(env, 'garbage', now), null);
});
```

Run: `npm test`
Expected: FAIL（`Cannot find module .../src/auth.js`）

- [ ] **Step 2: `worker/reports/src/auth.js` を作る**（管理Cookieの部分は Task 5 で足す）

```js
// 署名まわり。削除リンクのトークンと、管理ページのCookie（Task 5）に使う。

export async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 比較にかかる時間から中身を推測されないよう、最後まで比べる */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DELETE_TOKEN_DAYS = 7;

/** Discordの通知に付ける削除リンク用。形は <postId>.<期限の秒>.<署名> */
export async function makeDeleteToken(env, postId, now = Date.now()) {
  const exp = Math.floor(now / 1000) + DELETE_TOKEN_DAYS * 86400;
  return `${postId}.${exp}.${await hmacHex(`del:${postId}.${exp}`, env.SIGN_SECRET)}`;
}

export async function readDeleteToken(env, token, now = Date.now()) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) return null;
  const [postId, exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Math.floor(now / 1000)) return null;
  return safeEqual(sig, await hmacHex(`del:${postId}.${exp}`, env.SIGN_SECRET)) ? postId : null;
}
```

- [ ] **Step 3: `worker/reports/src/notify.js` を全体書き換え**

```js
// Discordへの通知（「秘書クロロに伝達」サーバーのwebhook）。
// 通知は「気づくための仕組み」であって、失敗しても投稿や通報の処理は止めない。
import { NOTIFY_MENTION_USER_ID } from './config.js';
import { makeDeleteToken } from './auth.js';
import { placeById } from '../../../src/js/data/spot-list.js';
import { FISH, WIND_FEEL, nameOf } from '../../../src/js/data/report-options.js';

async function send(env, text, { mention = false } = {}) {
  if (!env.DISCORD_WEBHOOK_URL) return false;
  const content = (mention ? `<@${NOTIFY_MENTION_USER_ID}>\n` : '') + text;
  try {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: '秘書クロロ',
        content: content.slice(0, 1900),
        // 投稿の本文に @everyone などが書かれていても展開させない
        allowed_mentions: { parse: [], users: mention ? [NOTIFY_MENTION_USER_ID] : [] },
      }),
    });
    if (!res.ok) console.error('discord notify failed', res.status);
    return res.ok;
  } catch (err) {
    console.error('discord notify error', String(err));
    return false;
  }
}

function summary(post) {
  const extras = [nameOf(FISH, post.fish), nameOf(WIND_FEEL, post.wind)].filter(Boolean).join(' ／ ');
  return [
    `**${post.name}** ｜ ${placeById(post.spotId)?.name ?? post.spotId} ｜ ${post.date}`,
    extras,
    post.comment,
  ].filter(Boolean).join('\n');
}

export async function notifyNewPost(env, post, origin) {
  const token = await makeDeleteToken(env, post.id);
  return send(env, [
    '🎣 現地の声：新しい投稿',
    summary(post),
    post.hasPhoto ? `${origin}/photo/${post.id}` : '',
    `削除する → ${origin}/admin/delete?token=${token}`,
  ].filter(Boolean).join('\n'));
}

export async function notifyHidden(env, post, origin) {
  return send(env, [
    '⚠️ 現地の声：通報が3件に達したため、投稿を自動で非表示にしました',
    summary(post),
    `確認・再表示・削除 → ${origin}/admin`,
  ].join('\n'), { mention: true });
}
```

- [ ] **Step 4: `worker/reports/src/index.js` に通報の経路を足す**

import を差し替える：

```js
import { notifyNewPost, notifyHidden } from './notify.js';
```

`fetch` の中、`const photo = ...` の行の**前**に足す：

```js
      const rep = path.match(/^\/posts\/([^/]+)\/report$/);
      if (rep && request.method === 'POST') return await handleReport(rep[1], request, env, ctx);
```

ファイルの末尾に足す：

```js
async function handleReport(id, request, env, ctx) {
  if (!isId(id)) return notFound();
  const post = await getPost(env, id);
  if (!post) return notFound();

  // 同じ人の通報は1件と数える
  const hash = await ipHashOf(request, env);
  const seenKey = `rep:${id}:${hash}`;
  if (await env.REPORTS_KV.get(seenKey)) return json({ ok: true, hidden: post.hidden }, 200, request);
  await env.REPORTS_KV.put(seenKey, '1', { expirationTtl: 90 * 86400 });

  post.reports = (post.reports || 0) + 1;
  const hideNow = !post.hidden && post.reports >= LIMITS.reportsToHide;
  if (hideNow) post.hidden = true;
  await putPost(env, post);
  if (hideNow) {
    await rebuildIndex(env, { upsert: post });
    ctx.waitUntil(notifyHidden(env, post, new URL(request.url).origin).catch((e) => console.error('notify failed', String(e))));
  }
  return json({ ok: true, hidden: post.hidden }, 200, request);
}
```

- [ ] **Step 5: テストが通るのを確認してコミット**

Run: `npm test`
Expected: PASS（このタスクの5件を含め全件）

```bash
git add worker/reports/src/auth.js worker/reports/src/notify.js worker/reports/src/index.js worker/reports/test/report.test.mjs
git commit -m "現地の声Worker：通報と自動非表示、Discord通知を追加"
```

---

### Task 5: 管理ページ（合言葉・一覧・削除・再表示・削除リンク）

**Files:**
- Create: `worker/reports/src/admin.js`, `worker/reports/test/admin.test.mjs`
- Modify: `worker/reports/src/auth.js`（末尾に追加）, `worker/reports/src/index.js`

**Interfaces:**
- Consumes: `hmacHex`・`safeEqual`・`readDeleteToken`（Task 4）、`allowLogin`・`ipHashOf`（Task 3）、`listPosts`・`getPost`・`putPost`・`removePost`・`rebuildIndex`・`photoKey`・`isId`（Task 3）、`placeById`・`nameOf`（Task 1）
- Produces:
  - `auth.js`：`checkPassphrase(env, input): Promise<boolean>`、`makeAdminCookie(env, now?): Promise<string>`（`Set-Cookie` の値そのもの）、`isAdmin(request, env, now?): Promise<boolean>`
  - `admin.js`：`handleAdmin(request, env, url): Promise<Response|null>`（`/admin` で始まらない経路は `null`）
  - 経路：`GET /admin`、`POST /admin/login`、`POST /admin/posts/<id>/delete`、`POST /admin/posts/<id>/restore`、`GET /admin/photo/<id>`、`GET /admin/delete?token=`、`POST /admin/delete-by-token`

- [ ] **Step 1: 失敗するテストを書く** — `worker/reports/test/admin.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { makeDeleteToken } from '../src/auth.js';
import { makeEnv, stubFetch, okFetch, jpegBytes, postForm, TEST_BASE as BASE } from './fakes.mjs';

const ctx = { waitUntil: (p) => p };
const valid = { name: 'つりお', spotId: 'hagi-koshigahama', comment: '<script>alert(1)</script>' };

const call = (path, env, { method = 'GET', cookie = '', form = null, origin = BASE, ip = '203.0.113.50' } = {}) =>
  worker.fetch(
    new Request(`${BASE}${path}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), origin, 'cf-connecting-ip': ip, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      body: form ? new URLSearchParams(form).toString() : undefined,
      redirect: 'manual',
    }),
    env,
    ctx
  );

async function login(env) {
  const res = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'aikotoba-test' } });
  assert.equal(res.status, 303);
  return res.headers.get('set-cookie').split(';')[0];
}

async function createPost(env, opts) {
  const res = await worker.fetch(postForm(valid, opts), env, ctx);
  return (await res.json()).post;
}

test('合言葉なしでは一覧を見せず、入力欄を出す（検索に載せない）', async () => {
  const env = makeEnv();
  const res = await call('/admin', env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  const html = await res.text();
  assert.match(html, /合言葉/);
  assert.doesNotMatch(html, /つりお/);
});

test('合言葉が違うと入れない。6回目は回数制限', async () => {
  const env = makeEnv();
  for (let i = 0; i < 5; i++) {
    const res = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'wrong' } });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
  }
  const blocked = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'aikotoba-test' } });
  assert.equal(blocked.status, 429);
});

test('Cookieは HttpOnly・Secure・SameSite=Strict・/admin 限定', async () => {
  const env = makeEnv();
  const res = await call('/admin/login', env, { method: 'POST', form: { passphrase: 'aikotoba-test' } });
  const c = res.headers.get('set-cookie');
  for (const part of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/admin', 'Max-Age=604800']) assert.ok(c.includes(part), part);
});

test('一覧には非表示の投稿も出て、本文はエスケープされる', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const stored = await env.REPORTS_KV.get(`post:${post.id}`, 'json');
    await env.REPORTS_KV.put(`post:${post.id}`, JSON.stringify({ ...stored, hidden: true, reports: 3 }));
    const html = await (await call('/admin', env, { cookie: await login(env) })).text();
    assert.match(html, /非表示/);
    assert.match(html, /&lt;script&gt;/);
    assert.doesNotMatch(html, /<script>alert/);
  } finally {
    f.restore();
  }
});

test('削除：本文も写真も消え、一覧からも消える。Cookieなし・よそのサイトからは拒否', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env, { photo: jpegBytes() });
    const cookie = await login(env);
    assert.equal((await call(`/admin/posts/${post.id}/delete`, env, { method: 'POST' })).status, 403);
    assert.equal((await call(`/admin/posts/${post.id}/delete`, env, { method: 'POST', cookie, origin: 'https://evil.example' })).status, 403);

    const res = await call(`/admin/posts/${post.id}/delete`, env, { method: 'POST', cookie });
    assert.equal(res.status, 303);
    assert.equal(await env.REPORTS_KV.get(`post:${post.id}`), null);
    assert.equal(env.REPORTS_R2._store.size, 0);
    const list = await (await worker.fetch(new Request(`${BASE}/posts`), env, ctx)).json();
    assert.equal(list.posts.length, 0);
  } finally {
    f.restore();
  }
});

test('再表示：非表示を解いて通報数を0に戻し、一覧に戻る', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    for (const ip of ['203.0.113.21', '203.0.113.22', '203.0.113.23']) {
      await worker.fetch(new Request(`${BASE}/posts/${post.id}/report`, { method: 'POST', headers: { 'cf-connecting-ip': ip } }), env, ctx);
    }
    const cookie = await login(env);
    assert.equal((await call(`/admin/posts/${post.id}/restore`, env, { method: 'POST', cookie })).status, 303);
    const stored = await env.REPORTS_KV.get(`post:${post.id}`, 'json');
    assert.equal(stored.hidden, false);
    assert.equal(stored.reports, 0);
    const list = await (await worker.fetch(new Request(`${BASE}/posts`), env, ctx)).json();
    assert.equal(list.posts.length, 1);
  } finally {
    f.restore();
  }
});

test('管理用の写真は、非表示の投稿でも見られる（Cookie必須）', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env, { photo: jpegBytes() });
    const stored = await env.REPORTS_KV.get(`post:${post.id}`, 'json');
    await env.REPORTS_KV.put(`post:${post.id}`, JSON.stringify({ ...stored, hidden: true }));
    assert.equal((await call(`/admin/photo/${post.id}`, env)).status, 403);
    assert.equal((await call(`/admin/photo/${post.id}`, env, { cookie: await login(env) })).status, 200);
  } finally {
    f.restore();
  }
});

test('Discordの削除リンク：開いただけでは消えず、確認を押すと消える', async () => {
  const env = makeEnv();
  const f = stubFetch(okFetch());
  try {
    const post = await createPost(env);
    const token = await makeDeleteToken(env, post.id);
    const page = await call(`/admin/delete?token=${encodeURIComponent(token)}`, env);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /この投稿を削除しますか/);
    assert.ok(await env.REPORTS_KV.get(`post:${post.id}`));

    const done = await call('/admin/delete-by-token', env, { method: 'POST', form: { token } });
    assert.equal(done.status, 200);
    assert.match(await done.text(), /削除しました/);
    assert.equal(await env.REPORTS_KV.get(`post:${post.id}`), null);

    assert.equal((await call('/admin/delete?token=bad', env)).status, 400);
  } finally {
    f.restore();
  }
});
```

Run: `npm test`
Expected: FAIL（`/admin` が404のため）

- [ ] **Step 2: `worker/reports/src/auth.js` の末尾に足す**

```js
const ADMIN_COOKIE = 'yfj_admin';
const ADMIN_DAYS = 7;

/** 合言葉の照合。長さの違いも漏らさないよう、両方を同じ長さの署名にしてから比べる */
export async function checkPassphrase(env, input) {
  if (!env.ADMIN_PASSPHRASE || typeof input !== 'string' || !input) return false;
  const [a, b] = await Promise.all([hmacHex(input, env.SIGN_SECRET), hmacHex(env.ADMIN_PASSPHRASE, env.SIGN_SECRET)]);
  return safeEqual(a, b);
}

/** Set-Cookie に入れる値そのもの */
export async function makeAdminCookie(env, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ADMIN_DAYS * 86400;
  const value = `${exp}.${await hmacHex(`admin:${exp}`, env.SIGN_SECRET)}`;
  return `${ADMIN_COOKIE}=${value}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADMIN_DAYS * 86400}`;
}

export async function isAdmin(request, env, now = Date.now()) {
  const raw = (request.headers.get('cookie') || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${ADMIN_COOKIE}=`));
  if (!raw) return false;
  const [exp, sig] = raw.slice(ADMIN_COOKIE.length + 1).split('.');
  if (!/^\d+$/.test(exp || '') || Number(exp) < Math.floor(now / 1000)) return false;
  return safeEqual(sig || '', await hmacHex(`admin:${exp}`, env.SIGN_SECRET));
}
```

- [ ] **Step 3: `worker/reports/src/admin.js` を作る**

```js
// ダディ専用の管理ページ。合言葉で入り、投稿の削除と再表示ができる。
// Workerが自分でHTMLを返す（釣りサイト側には置かない＝管理の入口を公開サイトから切り離す）。
import { checkPassphrase, makeAdminCookie, isAdmin, readDeleteToken } from './auth.js';
import { allowLogin, ipHashOf } from './guard.js';
import { listPosts, getPost, putPost, removePost, rebuildIndex, photoKey, isId } from './store.js';
import { placeById } from '../../../src/js/data/spot-list.js';
import { FISH, WIND_FEEL, nameOf } from '../../../src/js/data/report-options.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function html(body, status = 200, extra = {}) {
  return new Response(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>現地の声 管理｜YFJ</title>
<style>
  body{margin:0;padding:20px;background:#f1ece1;color:#20232a;font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;line-height:1.7}
  main{max-width:720px;margin:0 auto}
  h1{font-size:20px} .post{background:#fff;border-radius:12px;padding:16px;margin:0 0 14px;box-shadow:0 1px 8px rgba(0,0,0,.06)}
  .post.hidden{border-left:6px solid #c2571f} .meta{font-size:13px;color:#4c5058} .tag{display:inline-block;background:#c2571f;color:#fff;border-radius:999px;padding:0 10px;font-size:12px}
  img{max-width:100%;border-radius:8px;margin-top:8px} p{margin:6px 0;white-space:pre-wrap;word-break:break-word}
  form{display:inline} button{font:inherit;padding:9px 18px;border-radius:999px;border:1px solid #20232a;background:#fff;cursor:pointer;margin:8px 8px 0 0}
  button.danger{background:#c2571f;border-color:#c2571f;color:#fff} input{font:inherit;padding:10px;width:100%;max-width:320px;box-sizing:border-box}
  .msg{color:#c2571f}
</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer', ...extra } }
  );
}

const loginPage = (message = '', status = 200) =>
  html(`<h1>現地の声 管理</h1>${message ? `<p class="msg">${esc(message)}</p>` : ''}
<form method="post" action="/admin/login"><p><label>合言葉<br><input type="password" name="passphrase" autocomplete="current-password" required></label></p>
<button type="submit">入る</button></form>`, status);

function postBlock(p, photoPath) {
  const extras = [nameOf(FISH, p.fish), nameOf(WIND_FEEL, p.wind)].filter(Boolean).join(' ／ ');
  return `<p class="meta">${p.hidden ? '<span class="tag">非表示</span> ' : ''}<strong>${esc(p.name)}</strong> ｜ ${esc(placeById(p.spotId)?.name ?? p.spotId)} ｜ ${esc(p.date)} ｜ 通報 ${p.reports || 0}件</p>
${extras ? `<p class="meta">${esc(extras)}</p>` : ''}<p>${esc(p.comment)}</p>
${p.hasPhoto ? `<img src="${photoPath}" alt="" loading="lazy">` : ''}`;
}

const listPage = (posts) =>
  html(`<h1>現地の声 管理（${posts.length}件）</h1>
${posts.length ? '' : '<p>投稿はまだありません。</p>'}
${posts.map((p) => `<section class="post${p.hidden ? ' hidden' : ''}">${postBlock(p, `/admin/photo/${p.id}`)}
<div><form method="post" action="/admin/posts/${p.id}/delete" onsubmit="return confirm('この投稿を削除します。元に戻せません。')"><button class="danger" type="submit">削除</button></form>
${p.hidden ? `<form method="post" action="/admin/posts/${p.id}/restore"><button type="submit">再表示</button></form>` : ''}</div></section>`).join('')}`);

const sameOrigin = (request, url) => request.headers.get('origin') === url.origin;
const forbidden = () => html('<h1>操作できません</h1><p>もう一度、管理ページから入り直してください。</p>', 403);
const back = () => new Response(null, { status: 303, headers: { location: '/admin' } });

async function deletePost(env, id) {
  await removePost(env, id);
  await rebuildIndex(env, { removeId: id });
}

export async function handleAdmin(request, env, url) {
  const path = url.pathname;
  if (path !== '/admin' && !path.startsWith('/admin/')) return null;
  const method = request.method;

  if (path === '/admin' && method === 'GET') {
    return (await isAdmin(request, env)) ? listPage(await listPosts(env)) : loginPage();
  }

  if (path === '/admin/login' && method === 'POST') {
    if (!sameOrigin(request, url)) return forbidden();
    if (!(await allowLogin(env, await ipHashOf(request, env)))) return loginPage('試行回数が多すぎます。1時間ほどおいてからお試しください。', 429);
    const form = await request.formData();
    if (!(await checkPassphrase(env, form.get('passphrase')))) return loginPage('合言葉が違います。', 401);
    return new Response(null, { status: 303, headers: { location: '/admin', 'set-cookie': await makeAdminCookie(env) } });
  }

  // Discordの削除リンク（合言葉なしで使える。トークンが鍵）
  if (path === '/admin/delete' && method === 'GET') {
    const token = url.searchParams.get('token');
    const id = await readDeleteToken(env, token);
    const post = id && isId(id) ? await getPost(env, id) : null;
    if (!id) return html('<h1>リンクが無効です</h1><p>期限が切れているか、リンクが途中で切れています。管理ページから削除してください。</p>', 400);
    if (!post) return html('<h1>この投稿はすでに削除されています</h1>');
    return html(`<h1>この投稿を削除しますか</h1><section class="post">${postBlock(post, `/photo/${post.id}`)}</section>
<form method="post" action="/admin/delete-by-token"><input type="hidden" name="token" value="${esc(token)}"><button class="danger" type="submit">削除する</button></form>`);
  }

  if (path === '/admin/delete-by-token' && method === 'POST') {
    if (!sameOrigin(request, url)) return forbidden();
    const id = await readDeleteToken(env, (await request.formData()).get('token'));
    if (!id || !isId(id)) return html('<h1>リンクが無効です</h1>', 400);
    await deletePost(env, id);
    return html('<h1>削除しました</h1><p>この画面は閉じて大丈夫です。</p>');
  }

  // ここから下は合言葉が必要
  if (!(await isAdmin(request, env))) return forbidden();

  const photo = path.match(/^\/admin\/photo\/([^/]+)$/);
  if (photo && method === 'GET' && isId(photo[1])) {
    const obj = await env.REPORTS_R2.get(photoKey(photo[1]));
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, { headers: { 'content-type': 'image/jpeg', 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store' } });
  }

  const action = path.match(/^\/admin\/posts\/([^/]+)\/(delete|restore)$/);
  if (action && method === 'POST' && isId(action[1])) {
    if (!sameOrigin(request, url)) return forbidden();
    const [, id, kind] = action;
    if (kind === 'delete') {
      await deletePost(env, id);
    } else {
      const post = await getPost(env, id);
      if (post) {
        const restored = { ...post, hidden: false, reports: 0 };
        await putPost(env, restored);
        await rebuildIndex(env, { upsert: restored });
      }
    }
    return back();
  }

  return new Response('Not found', { status: 404 });
}
```

- [ ] **Step 4: `worker/reports/src/index.js` から管理ページへ振り分ける**

import を足す：

```js
import { handleAdmin } from './admin.js';
```

`fetch` の中、`if (request.method === 'OPTIONS')` の**前**に足す：

```js
      const admin = await handleAdmin(request, env, url);
      if (admin) return admin;
```

- [ ] **Step 5: テストが通るのを確認してコミット**

Run: `npm test`
Expected: PASS（このタスクの8件を含め全件）

```bash
git add worker/reports/src/auth.js worker/reports/src/admin.js worker/reports/src/index.js worker/reports/test/admin.test.mjs
git commit -m "現地の声Worker：管理ページ（合言葉・削除・再表示・削除リンク）を追加"
```

---

### Task 6: サイト側 — 「現地の声」ページ（フォームと一覧）

**Files:**
- Create: `src/js/config/reports.js`, `src/js/api/reports.js`, `src/js/lib/resize-image.js`, `src/js/components/report-card.js`, `src/js/components/spot-list-html.js`, `src/js/pages/reports.js`, `reports.html`, `test/report-card.test.mjs`
- Modify: `src/js/main.js`（NAV）, `vite.config.js`, `public/sitemap.xml`, `src/css/style.css`（末尾に追加）

**Interfaces:**
- Consumes: Task 1のデータ、Workerの経路（`GET /posts`・`POST /posts`・`POST /posts/<id>/report`・`GET /photo/<id>`。応答は `{ok, posts}`／`{ok, post}`／`{ok:false, error}`）
- Produces:
  - `config/reports.js`：`REPORTS_API_PROD: string`、`TURNSTILE_SITE_KEY_PROD: string`（どちらも空文字なら本番では受付を「準備中」にする。Task 8で値を入れる）
  - `api/reports.js`：`reportsEnabled: boolean`、`TURNSTILE_SITE_KEY: string`、`fetchPosts({area?, limit?}): Promise<post[]>`（失敗は例外）、`submitPost(formData): Promise<{ok:true, post}|{ok:false, error}>`、`reportPost(id): Promise<boolean>`、`photoUrl(id): string`
  - `lib/resize-image.js`：`resizeToJpeg(file, maxSide=1600, quality=0.82): Promise<Blob>`
  - `components/report-card.js`：`esc(s)`、`reportCardHTML(post, photoUrl): string`（ルート要素は `<article class="report-card" data-id>`、通報ボタンは `button[data-report="<id>"]`）
  - `components/spot-list-html.js`：`spotListHTML(): string`（`<div class="spot-names">` の並び。`<dl>` の中に入れて使う）

- [ ] **Step 1: 失敗するテストを書く** — `test/report-card.test.mjs`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { reportCardHTML, esc } from '../src/js/components/report-card.js';
import { spotListHTML } from '../src/js/components/spot-list-html.js';

const photoUrl = (id) => `https://api.example/photo/${id}`;
const post = {
  id: '8210000000000-0a1b2c3d', name: '<img src=x onerror=alert(1)>', spotId: 'hagi-koshigahama', areaId: 'hagi',
  comment: '</p><script>alert(2)</script>\n2行目', fish: 'aji', wind: 'stronger', date: '2026-09-05', hasPhoto: true,
  createdAt: '2026-09-05T09:00:00.000Z',
};

test('escはHTMLの特殊文字を全部置き換える', () => {
  assert.equal(esc(`<a href="x" onclick='y'>&`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;');
});

test('名前とコメントはエスケープされ、タグとして出ない', () => {
  const html = reportCardHTML(post, photoUrl);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});

test('場所・魚・風・日付が日本語で出る。写真と通報ボタンがある', () => {
  const html = reportCardHTML(post, photoUrl);
  assert.match(html, /越ヶ浜漁港/);
  assert.match(html, /アジ/);
  assert.match(html, /予報より強かった/);
  assert.match(html, /9\/5の情報/);
  assert.match(html, /src="https:\/\/api\.example\/photo\/8210000000000-0a1b2c3d"/);
  assert.match(html, /data-report="8210000000000-0a1b2c3d"/);
});

test('写真なし・任意項目なし・リストに無い場所でも崩れない', () => {
  const html = reportCardHTML({ ...post, hasPhoto: false, fish: '', wind: '', spotId: 'deleted-spot' }, photoUrl);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /場所不明/);
});

test('釣り場一覧は5エリア分の見出しを持つ', () => {
  const html = spotListHTML();
  for (const label of ['萩', '長門', '下関', '下松', '防府']) assert.match(html, new RegExp(`<dt>${label}</dt>`));
  assert.match(html, /越ヶ浜漁港/);
});
```

Run: `npm test`
Expected: FAIL（`Cannot find module .../report-card.js`）

- [ ] **Step 2: `src/js/components/report-card.js` と `src/js/components/spot-list-html.js` を作る**

`src/js/components/report-card.js`:

```js
// 投稿1件のカード。ブラウザのAPIに触らない純粋な関数（node --test で試せる）。
// 投稿者が書いた文字は必ず esc() を通すこと。
import { placeById } from '../data/spot-list.js';
import { FISH, WIND_FEEL, nameOf } from '../data/report-options.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const monthDay = (date) => {
  const [, m, d] = String(date).split('-');
  return `${Number(m)}/${Number(d)}`;
};

export function reportCardHTML(post, photoUrl) {
  const place = placeById(post.spotId)?.name ?? '場所不明';
  const fish = nameOf(FISH, post.fish);
  const wind = nameOf(WIND_FEEL, post.wind);
  return `
  <article class="report-card reveal" data-id="${esc(post.id)}">
    ${post.hasPhoto ? `<figure class="report-photo"><img src="${esc(photoUrl(post.id))}" alt="${esc(place)}の写真" loading="lazy" decoding="async" /></figure>` : ''}
    <div class="report-body">
      <p class="report-place">${esc(place)}</p>
      <p class="report-meta t-mono">${esc(post.name)} ・ ${esc(monthDay(post.date))}の情報</p>
      ${fish || wind ? `<p class="report-tags">${fish ? `<span>${esc(fish)}</span>` : ''}${wind ? `<span class="wind wind-${esc(post.wind)}">風：${esc(wind)}</span>` : ''}</p>` : ''}
      <p class="report-comment">${esc(post.comment)}</p>
      <button type="button" class="report-flag t-mono" data-report="${esc(post.id)}">不適切な投稿を知らせる</button>
    </div>
  </article>`;
}
```

`src/js/components/spot-list-html.js`:

```js
// 選べる釣り場の一覧。ビルド時（vite.config.js）と画面（reports.js）の両方で使う。
// 検索エンジンが通信なしで読める本文になる（2026-09-14のソフト404の教訓）。
import { SPOTS, AREA_LABELS } from '../data/spot-list.js';

export function spotListHTML() {
  return Object.entries(AREA_LABELS)
    .map(([areaId, label]) => {
      const names = SPOTS.filter((s) => s.areaId === areaId).map((s) => s.name);
      return `<div class="spot-names"><dt>${label}</dt><dd>${names.length ? names.join('・') : '準備中'}</dd></div>`;
    })
    .join('');
}
```

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 設定と通信を作る**

`src/js/config/reports.js`:

```js
// 「現地の声」の本番の接続先。どちらも公開してよい値（秘密の値はCloudflare側にある）。
// 空のあいだは、本番サイトでは投稿の受付を「準備中」と表示する。
// 値を入れる手順：docs/REPORTS_公開手順.md の「5. サイトに接続先を書く」
export const REPORTS_API_PROD = '';
export const TURNSTILE_SITE_KEY_PROD = '';
```

`src/js/api/reports.js`:

```js
// 「現地の声」Worker（worker/reports）との通信。
import { REPORTS_API_PROD, TURNSTILE_SITE_KEY_PROD } from '../config/reports.js';

// 手元（npm run dev）では worker/reports/dev-server.mjs と、Cloudflare公式の「必ず通る」テスト用キーを使う
const DEV = import.meta.env.DEV;
const API = (DEV ? 'http://127.0.0.1:8787' : REPORTS_API_PROD).replace(/\/$/, '');
export const TURNSTILE_SITE_KEY = DEV ? '1x00000000000000000000AA' : TURNSTILE_SITE_KEY_PROD;
export const reportsEnabled = Boolean(API && TURNSTILE_SITE_KEY);

export const photoUrl = (id) => `${API}/photo/${id}`;

async function call(path, init = {}, timeoutMs = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(`${API}${path}`, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPosts({ area = '', limit = 50 } = {}) {
  if (!reportsEnabled) return [];
  const q = new URLSearchParams({ limit: String(limit), ...(area ? { area } : {}) });
  const res = await call(`/posts?${q}`);
  if (!res.ok) throw new Error(`posts fetch failed: ${res.status}`);
  return (await res.json()).posts ?? [];
}

export async function submitPost(formData) {
  try {
    const res = await call('/posts', { method: 'POST', body: formData }, 60000);
    const data = await res.json().catch(() => null);
    if (data?.ok) return data;
    return { ok: false, error: data?.error || '送信できませんでした。時間をおいてもう一度お試しください。' };
  } catch {
    return { ok: false, error: '通信できませんでした。電波の良い場所でもう一度お試しください。' };
  }
}

export async function reportPost(id) {
  try {
    return (await call(`/posts/${encodeURIComponent(id)}/report`, { method: 'POST' })).ok;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: `src/js/lib/resize-image.js` を作る**

```js
// 写真を縮小してJPEGに作り直す。
// 描き直した画像には元のEXIF（撮影場所のGPSなど）が一切入らない。
// 「場所不明」を選んだ人の写真から場所が漏れるのを防ぐための要の処理なので、
// 元のファイルをそのまま送る近道を作らないこと。

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // createImageBitmap が使えない・読めない端末向け。<img> はEXIFの向きを自動で反映する
    const src = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(src);
    }
  }
}

export async function resizeToJpeg(file, maxSide = 1600, quality = 0.82) {
  const img = await decode(file);
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  if (!w || !h) throw new Error('image has no size');
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('jpeg encode failed');
  return blob;
}
```

- [ ] **Step 5: `reports.html` を作る**

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>REPORTS — 現地の声（萩・長門・下関・下松・防府の釣り場から）| YAMAGUCHI FISHING JOURNAL</title>
  <meta name="description" content="山口県の萩・長門・下関・下松・防府の堤防や漁港から、釣り人が風・波・釣果を写真とコメントで知らせ合うページ。予報と現地の体感のズレも投稿できます。" />
  <link rel="canonical" href="https://papachi03.github.io/fishing-yamaguchi/reports.html" />
  <meta property="og:title" content="REPORTS — 現地の声" />
  <meta property="og:description" content="山口の堤防から、釣り人が今の海を知らせ合うページ。" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://papachi03.github.io/fishing-yamaguchi/reports.html" />
  <meta property="og:image" content="https://papachi03.github.io/fishing-yamaguchi/assets/posters/dawn_sea.jpg" />
  <meta property="og:site_name" content="YAMAGUCHI FISHING JOURNAL" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Shippori+Mincho+B1:wght@600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/src/css/style.css" />
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
</head>
<body>
  <a class="skip-link" href="#main">本文へスキップ</a>
  <main id="main">
    <section class="page-hero">
      <div class="wrap">
        <h1 class="en">Reports</h1>
        <p class="ja">現地の声。堤防に立った人が、今の海を知らせ合う。</p>
      </div>
    </section>
    <section class="page-body">
      <div class="wrap">
        <div class="report-intro">
          <p>予報の風速と、堤防に立ったときの体感は違います。このページは、萩・長門・下関・下松・防府の釣り場から、釣り人が<strong>風・波・釣果</strong>を写真とコメントで知らせ合う場所です。どなたでも投稿でき、投稿はすぐに表示されます。</p>
          <p>「風の体感」を選んでもらえると、このサイトの<a href="./sea.html">海況ページ</a>の安全の目安を、より実際に近づける材料になります。</p>
        </div>

        <h2 class="t-label report-h">Post — 投稿する</h2>
        <form class="report-form" id="report-form" novalidate>
          <label>お名前（ニックネーム可・20文字まで）<input name="name" maxlength="20" required autocomplete="nickname" /></label>
          <label>場所<select name="spotId" id="rf-spot" required></select></label>
          <label>コメント（400文字まで）<textarea name="comment" maxlength="400" rows="4" required></textarea></label>
          <label>写真（任意・1枚）<input type="file" name="photo" id="rf-photo" accept="image/*" /></label>
          <div class="report-form-row">
            <label>釣れた魚（任意）<select name="fish" id="rf-fish"></select></label>
            <label>いつの情報（任意）<input type="date" name="date" id="rf-date" /></label>
          </div>
          <fieldset class="report-wind"><legend>風の体感（任意）</legend><div id="rf-wind"></div></fieldset>
          <div id="ts-widget"></div>
          <p class="report-form-msg" id="rf-msg" role="status" aria-live="polite"></p>
          <button type="submit" class="report-submit" id="rf-submit">投稿する</button>
        </form>
        <ul class="report-rules">
          <li>ほかの人の顔や、車のナンバーが写った写真は載せないでください。</li>
          <li>釣り禁止・立入禁止の場所の情報は削除します。</li>
          <li>写真に記録された撮影場所（位置情報）は、送信前に自動で消えます。</li>
          <li>投稿の削除をご希望の場合は、Instagram（@child_daddy_o3z）のDMでお知らせください。</li>
        </ul>

        <h2 class="t-label report-h">Voices — みんなの投稿</h2>
        <div class="report-filter" id="report-filter" role="tablist" aria-label="エリアで絞り込み"></div>
        <div class="report-grid" id="report-list"><p class="sea-error">投稿を読み込んでいます…</p></div>

        <h2 class="t-label report-h">Spots — 選べる釣り場</h2>
        <p class="report-note">場所を細かく出したくない方は「〇〇市内（詳しい場所は非公開）」または「場所不明」を選べます。釣り禁止・立入禁止の場所は載せていません。</p>
        <dl class="spot-names-list" id="spot-names"></dl>
      </div>
    </section>
  </main>
  <footer class="site-footer"><div id="footer-mount"></div></footer>
  <script type="module" src="/src/js/pages/reports.js"></script>
</body>
</html>
```

- [ ] **Step 6: `src/js/pages/reports.js` を作る**

```js
import { mountChrome, mountFooterBottom, initReveal } from '../main.js';
import { SPOTS, AREA_PLACES, UNKNOWN_PLACE, AREA_LABELS } from '../data/spot-list.js';
import { FISH, WIND_FEEL } from '../data/report-options.js';
import { reportsEnabled, TURNSTILE_SITE_KEY, fetchPosts, submitPost, reportPost, photoUrl } from '../api/reports.js';
import { reportCardHTML, esc } from '../components/report-card.js';
import { spotListHTML } from '../components/spot-list-html.js';
import { resizeToJpeg } from '../lib/resize-image.js';

mountChrome('/reports.html');
mountFooterBottom(document.getElementById('footer-mount'));

const form = document.getElementById('report-form');
const msg = document.getElementById('rf-msg');
const submitBtn = document.getElementById('rf-submit');
const listEl = document.getElementById('report-list');
const filterEl = document.getElementById('report-filter');

// 本番ビルドでは vite.config.js が書き込み済み。手元（npm run dev）では空なのでここで埋める
const spotNames = document.getElementById('spot-names');
if (!spotNames.children.length) spotNames.innerHTML = spotListHTML();

/* ---------- フォームの選択肢 ---------- */

const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;

document.getElementById('rf-spot').innerHTML =
  option('', '選んでください') +
  Object.entries(AREA_LABELS)
    .map(([areaId, label]) => {
      const places = [...SPOTS.filter((s) => s.areaId === areaId), ...AREA_PLACES.filter((p) => p.areaId === areaId)];
      return `<optgroup label="${esc(label)}">${places.map((p) => option(p.id, p.name)).join('')}</optgroup>`;
    })
    .join('') +
  option(UNKNOWN_PLACE.id, UNKNOWN_PLACE.name);

document.getElementById('rf-fish').innerHTML = option('', '選ばない') + FISH.map((f) => option(f.id, f.name)).join('');

document.getElementById('rf-wind').innerHTML = WIND_FEEL.map(
  (w) => `<label class="wind-choice"><input type="radio" name="wind" value="${esc(w.id)}" /><span>${esc(w.name)}</span></label>`
).join('');

// 日付は日本時間の今日〜31日前
const jst = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const dateEl = document.getElementById('rf-date');
dateEl.max = jst(new Date());
dateEl.min = jst(new Date(Date.now() - 31 * 86400 * 1000));
dateEl.value = dateEl.max;

/* ---------- ロボット除け（Turnstile） ---------- */

let widgetId = null;
function mountTurnstile(tries = 0) {
  if (window.turnstile) {
    widgetId = window.turnstile.render('#ts-widget', { sitekey: TURNSTILE_SITE_KEY, theme: 'light' });
  } else if (tries < 50) {
    setTimeout(() => mountTurnstile(tries + 1), 200);
  }
}

/* ---------- 一覧 ---------- */

let currentArea = Object.keys(AREA_LABELS).includes(location.hash.slice(1)) ? location.hash.slice(1) : '';
let loadSeq = 0;

filterEl.innerHTML = [['', 'すべて'], ...Object.entries(AREA_LABELS)]
  .map(([id, label]) => `<button type="button" role="tab" data-area="${esc(id)}" aria-selected="${id === currentArea}" class="${id === currentArea ? 'active' : ''}">${esc(label)}</button>`)
  .join('');

filterEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-area]');
  if (!btn) return;
  currentArea = btn.dataset.area;
  history.replaceState(null, '', currentArea ? `#${currentArea}` : location.pathname);
  filterEl.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.area === currentArea;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  loadList();
});

async function loadList() {
  const seq = ++loadSeq;
  if (!reportsEnabled) {
    listEl.innerHTML = '<p class="sea-error">投稿の受け付けは準備中です。もうしばらくお待ちください。</p>';
    return;
  }
  try {
    const posts = await fetchPosts({ area: currentArea });
    if (seq !== loadSeq) return; // 読み込み中に別のエリアへ切り替えられた
    listEl.innerHTML = posts.length
      ? posts.map((p) => reportCardHTML(p, photoUrl)).join('')
      : '<p class="sea-error">まだ投稿がありません。最初の一件をお待ちしています。</p>';
    initReveal();
  } catch {
    if (seq !== loadSeq) return;
    listEl.innerHTML = '<p class="sea-error">投稿を読み込めませんでした。時間をおいて開き直してください。</p>';
  }
}

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-report]');
  if (!btn || btn.disabled) return;
  if (!window.confirm('この投稿を「不適切」として知らせますか？')) return;
  btn.disabled = true;
  btn.textContent = (await reportPost(btn.dataset.report)) ? '知らせました。ありがとうございます' : '送れませんでした';
});

/* ---------- 投稿 ---------- */

function say(text, isError = false) {
  msg.textContent = text;
  msg.classList.toggle('is-error', isError);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;
  const token = widgetId !== null && window.turnstile ? window.turnstile.getResponse(widgetId) : '';
  if (!token) return say('ロボットでないことの確認が終わるまで、少しお待ちください。', true);

  submitBtn.disabled = true;
  say('送信しています…');
  try {
    const data = new FormData(form);
    data.delete('photo');
    const file = document.getElementById('rf-photo').files[0];
    if (file) {
      let blob;
      try {
        blob = await resizeToJpeg(file);
      } catch {
        return say('この写真は読み込めませんでした。別の写真でお試しください。', true);
      }
      data.set('photo', blob, 'photo.jpg');
    }
    data.set('cf-turnstile-response', token);

    const result = await submitPost(data);
    if (!result.ok) return say(result.error, true);

    say('投稿しました。ありがとうございます。');
    form.reset();
    dateEl.value = dateEl.max;
    if (!currentArea || result.post.areaId === currentArea) {
      listEl.querySelector('.sea-error')?.remove();
      listEl.insertAdjacentHTML('afterbegin', reportCardHTML(result.post, photoUrl));
      initReveal();
    }
  } finally {
    submitBtn.disabled = false;
    if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId); // トークンは1回しか使えない
  }
});

if (reportsEnabled) {
  mountTurnstile();
} else {
  form.hidden = true;
}
loadList();
```

- [ ] **Step 7: ナビ・ビルド・サイトマップ・CSSをつなぐ**

`src/js/main.js` の `NAV` — `Sea` の行の次に足す：

```js
  { href: '/reports.html', label: 'Reports' },
```

`vite.config.js` — `plugins` 配列の `prerender-sea` の要素の**後ろ**に足す：

```js
    {
      // 「現地の声」ページに、選べる釣り場の一覧を書き込む（検索エンジンが通信なしで読める本文にする）
      name: 'prerender-reports',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, ctx) {
          if (!ctx.filename.replace(/\\/g, '/').endsWith('/reports.html')) return html;
          const mark = '<dl class="spot-names-list" id="spot-names"></dl>';
          if (!html.includes(mark)) throw new Error('reports.html に釣り場一覧の目印が見つかりません');
          const { spotListHTML } = await import('./src/js/components/spot-list-html.js');
          return html.replace(mark, () => `<dl class="spot-names-list" id="spot-names">${spotListHTML()}</dl>`);
        },
      },
    },
```

同じファイルの `rollupOptions.input` に足す：

```js
        reports: resolve(__dirname, 'reports.html'),
```

`public/sitemap.xml` — `sea.html` の `</url>` の次に足す：

```xml
  <url>
    <loc>https://papachi03.github.io/fishing-yamaguchi/reports.html</loc>
    <lastmod>2026-09-20</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
```

`src/css/style.css` — 末尾に足す：

```css
/* ==========================================================================
   REPORTS — 現地の声
   ========================================================================== */
.report-intro { max-width: 760px; margin-bottom: clamp(30px, 4vw, 48px); }
.report-intro p { margin-bottom: 12px; }
.report-intro a { color: var(--teal); }
.report-h { margin: clamp(40px, 5vw, 64px) 0 16px; }

.report-form { display: grid; gap: 16px; max-width: 640px; }
.report-form label, .report-wind legend { display: grid; gap: 6px; font-size: 14px; font-weight: 500; }
.report-form input:not([type='radio']), .report-form select, .report-form textarea {
  font: inherit; padding: 12px 14px; border: 1px solid rgba(32, 35, 42, 0.3); border-radius: 8px;
  background: #fff; color: var(--ink); width: 100%;
}
.report-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.report-wind { border: 0; padding: 0; }
.report-wind #rf-wind { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.wind-choice { display: block; font-weight: 400; cursor: pointer; }
.wind-choice input { position: absolute; opacity: 0; }
.wind-choice span { display: block; padding: 10px 16px; border: 1px solid rgba(32, 35, 42, 0.3); border-radius: 999px; background: #fff; }
.wind-choice input:checked + span { background: var(--teal); border-color: var(--teal); color: #fff; }
.wind-choice input:focus-visible + span { outline: 2px solid var(--amber); outline-offset: 2px; }
.report-submit {
  justify-self: start; font: inherit; font-weight: 700; padding: 14px 36px; border: 0; border-radius: 999px;
  background: var(--ink); color: var(--paper); cursor: pointer;
}
.report-submit:disabled { opacity: 0.5; cursor: default; }
.report-form-msg { min-height: 1.6em; font-size: 14px; color: var(--teal); }
.report-form-msg.is-error { color: var(--safe-danger); }
.report-rules, .report-note { max-width: 640px; margin-top: 18px; font-size: 13px; color: var(--ink-soft); }
.report-rules { padding-left: 1.2em; }
.report-rules li { margin-bottom: 4px; }

.report-filter { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
.report-filter button {
  font: inherit; font-size: 13px; padding: 8px 16px; border-radius: 999px; cursor: pointer;
  border: 1px solid rgba(32, 35, 42, 0.3); background: transparent; color: var(--ink);
}
.report-filter button.active { background: var(--ink); border-color: var(--ink); color: var(--paper); }

.report-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
.report-card { background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid rgba(32, 35, 42, 0.12); }
.report-photo { margin: 0; aspect-ratio: 4 / 3; background: var(--paper-warm); }
.report-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.report-body { padding: 16px 18px 14px; }
.report-place { font-family: var(--font-mincho); font-size: 18px; font-weight: 700; }
.report-meta { font-size: 11px; color: var(--ink-soft); margin: 2px 0 10px; }
.report-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.report-tags span { font-size: 12px; padding: 2px 10px; border-radius: 999px; background: var(--paper-warm); }
.report-tags .wind-stronger { background: var(--safe-danger); color: #fff; }
.report-tags .wind-weaker { background: var(--safe-ok); color: #fff; }
.report-comment { font-size: 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
.report-flag { margin-top: 12px; padding: 0; border: 0; background: none; font-size: 10px; color: var(--ink-soft); text-decoration: underline; cursor: pointer; }
.report-flag:disabled { text-decoration: none; cursor: default; }

.spot-names-list { display: grid; gap: 10px; max-width: 760px; margin-top: 14px; }
.spot-names { display: grid; grid-template-columns: 4em 1fr; gap: 12px; font-size: 14px; }
.spot-names dt { font-weight: 700; }

@media (max-width: 560px) {
  .report-form-row { grid-template-columns: 1fr; }
}
```

- [ ] **Step 8: ビルドして、通信なしでも本文があることを確かめてコミット**

Run:
```bash
npm test
npm run build
node -e "const h=require('fs').readFileSync('dist/reports.html','utf8');const t=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');console.log('chars',t.length, /越ヶ浜漁港/.test(t), /位置情報/.test(t))"
```
Expected: テストPASS／ビルド成功（`dist/reports.html` が出力一覧にある）／最後の行が `chars <600以上の数> true true`

```bash
git add src/js/config/reports.js src/js/api/reports.js src/js/lib/resize-image.js src/js/components/report-card.js src/js/components/spot-list-html.js src/js/pages/reports.js reports.html test/report-card.test.mjs src/js/main.js vite.config.js public/sitemap.xml src/css/style.css
git commit -m "現地の声：投稿フォームと一覧のページを追加（受付は接続先を入れるまで準備中）"
```

---

### Task 6 追加分（2026-09-21 ダディ要望・コントローラ裁定）— 場所と魚種での絞り込み

ダディの要望：「長門市 → 仙崎人工島」のように選ぶとその釣り場の投稿だけが見え、魚種を選ぶとその魚の投稿だけが見える。参考にした画面はアングラーズ（エリア別のタイムライン、魚種のプルダウン）。

**決めごと**
- 絞り込みは3つ：**エリア**（萩・長門・下関・下松・防府）／**釣り場**（選んだエリアの中の漁港・堤防。「〇〇市内（非公開）」も選べる）／**魚種**。組み合わせて使える。
- 釣り場のプルダウンは、エリアを選ぶまで「すべて」のみ。エリアを選ぶとそのエリアの釣り場だけが並ぶ（エリアを変えたら釣り場の選択は「すべて」に戻す）。
- 「場所不明」の投稿は、エリアでも釣り場でも絞り込めない（エリア「すべて」のときだけ出る）。魚種では絞り込める。
- 絞り込みの状態はURLのハッシュに残す（例 `#area=nagato&spot=nagato-senzaki-jinkoto&fish=aori`）。SEAページから来る `#hagi` の形も、これまでどおりエリア指定として解釈する。
- 該当0件のときは「この条件の投稿はまだありません。」と出し、「条件をクリア」のボタンを添える。

**Workerの変更（`worker/reports/src/index.js` の `handleList`）**
- `GET /posts` に `spot`（釣り場ID）と `fish`（魚ID）を追加。`area` は今までどおり。
- 絞り込みが1つでも指定された場合は、50件の公開索引ではなく `listPosts(env, 200)` から `hidden` を除いて絞り込む（索引は最新50件しか持たないため、絞り込むと取りこぼすため）。並び順とキャッシュ（30秒）はそのまま。返す形も今までどおり `toPublic` を通したものだけ。
- 不正な `spot`・`fish`（リストに無いID）は「絞り込み無し」として無視する（エラーにしない）。
- テスト：①`spot` で1か所だけに絞れる ②`fish` で絞れる ③`area`＋`fish` の組み合わせ ④索引の50件を超えて古い投稿も絞り込みで拾える（51件作って51件目が出る）⑤不正なIDは無視される ⑥絞り込んだ結果にも `hidden`・`reports`・`by` が出ない。

**サイト側の変更**
- `src/js/api/reports.js` の `fetchPosts({ area, spot, fish, limit })` に `spot`・`fish` を追加（空文字は送らない）。
- `reports.html` の `#report-filter` を、エリアのボタン列から **3つのプルダウン**（エリア／釣り場／魚種）＋「条件をクリア」ボタンに変える。静的HTMLには `<select>` の枠と `<noscript>` 相当の説明文を置き、選択肢はJSで埋める（ビルド時の事前描画は釣り場一覧のところで既に本文を持っているので、これ以上は増やさない）。
- `src/js/pages/reports.js`：3つの選択に応じて `fetchPosts` を呼び直す。エリアを変えたら釣り場を「すべて」に戻す。URLハッシュの読み書き（上記の形）。0件のときの文言とクリアボタン。
- 見た目は既存のトーン（`.report-filter` のスタイルを流用しつつ、プルダウン3つが横に並び、狭い画面では縦に積む）。

**やらないこと**：地図表示、魚種の写真アイコン、フォロー機能、並び替え（新しい順のみ）。

---

### Task 7: SEAページに各エリアの最新2件を出す

**Files:**
- Create: `src/js/components/area-reports.js`
- Modify: `sea.html`, `src/js/pages/sea.js`, `src/css/style.css`（末尾に追加）

**Interfaces:**
- Consumes: `fetchPosts`・`photoUrl`・`reportPost`・`reportsEnabled`（Task 6）、`reportCardHTML`（Task 6）、`initReveal`・`url`（`main.js`）、`AREA_LABELS`（Task 1）
- Produces: `mountAreaReports(container: HTMLElement, areaId: string): Promise<void>`（0件・失敗・準備中のときは `container` を空にするだけ。例外を外に出さない）、`bindReportButtons(container: HTMLElement): void`（通報ボタンのクリックを親要素でまとめて受ける。ページで1回だけ呼ぶ）

- [ ] **Step 1: `src/js/components/area-reports.js` を作る**

```js
// SEAページ用：選んでいるエリアの「現地の声」最新2件。
// 海況の表示を絶対に邪魔しないこと（0件・失敗・準備中は、黙って何も出さない）。
import { initReveal, url } from '../main.js';
import { AREA_LABELS } from '../data/spot-list.js';
import { reportsEnabled, fetchPosts, reportPost, photoUrl } from '../api/reports.js';
import { reportCardHTML } from './report-card.js';

let seq = 0;

export async function mountAreaReports(container, areaId) {
  const mine = ++seq;
  container.innerHTML = '';
  if (!reportsEnabled || !AREA_LABELS[areaId]) return;
  let posts;
  try {
    posts = await fetchPosts({ area: areaId, limit: 2 });
  } catch {
    return;
  }
  if (mine !== seq || !posts.length) return; // 取得中に別のエリアへ切り替えられた／投稿なし

  container.innerHTML = `
    <div class="area-reports reveal">
      <div class="tide-panel-head">
        <h3>Reports — 現地の声</h3>
        <span class="bite-spot">${AREA_LABELS[areaId]}エリアの最新の投稿</span>
      </div>
      <div class="report-grid">${posts.map((p) => reportCardHTML(p, photoUrl)).join('')}</div>
      <p><a class="sea-more" href="${url('/reports.html')}#${areaId}">もっと見る・投稿する<span aria-hidden="true">→</span></a></p>
    </div>`;
  initReveal();
}

// 通報ボタン（カードは何度も描き直されるので、親でまとめて受ける）
export function bindReportButtons(container) {
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-report]');
    if (!btn || btn.disabled) return;
    if (!window.confirm('この投稿を「不適切」として知らせますか？')) return;
    btn.disabled = true;
    btn.textContent = (await reportPost(btn.dataset.report)) ? '知らせました。ありがとうございます' : '送れませんでした';
  });
}
```

- [ ] **Step 2: `sea.html` に置き場所を足す**

`<div class="sea-dash" id="sea-dash">…</div>` の閉じタグの**次の行**（`<p class="source-note" …>` の前）に足す：

```html
        <div id="sea-reports"></div>
```

⚠️ `scripts/prerender-sea.mjs` は `sea-dash` の div を正規表現で丸ごと置き換える。`sea-dash` の**中**には何も足さないこと。

- [ ] **Step 3: `src/js/pages/sea.js` から呼ぶ**

import を足す：

```js
import { mountAreaReports, bindReportButtons } from '../components/area-reports.js';
```

`const sourceNote = document.getElementById('source-note');` の次の行に足す：

```js
const reportsBox = document.getElementById('sea-reports');
bindReportButtons(reportsBox);
```

`render()` の最後、`initReveal();` の次の行に足す：

```js
  mountAreaReports(reportsBox, areaId); // 待たない。失敗しても海況には影響させない
```

- [ ] **Step 4: `src/css/style.css` の末尾に足す**

```css
/* SEAページの「現地の声」 */
.area-reports { margin-top: clamp(36px, 5vw, 60px); }
.area-reports .report-grid { margin: 16px 0 6px; }
```

- [ ] **Step 5: ビルドが通り、SEAの事前描画が壊れていないことを確かめてコミット**

Run:
```bash
npm test
npm run build
node -e "const h=require('fs').readFileSync('dist/sea.html','utf8');console.log(h.includes('data-prerendered=\"hagi\"'), h.includes('id=\"sea-reports\"'), h.includes('id=\"sea-snapshot\"'))"
```
Expected: `true true true`（ビルドのログに `[prerender-sea] … hagi:ok …` が出る）

```bash
git add src/js/components/area-reports.js sea.html src/js/pages/sea.js src/css/style.css
git commit -m "現地の声：SEAページに各エリアの最新2件を表示"
```

---

### Task 8: 手元の通し確認・公開手順書・記録

**Files:**
- Create: `worker/reports/dev-server.mjs`, `worker/reports/README.md`, `docs/REPORTS_公開手順.md`
- Modify: `package.json`（scripts）, `C:\Users\my\.claude\launch.json`（設定を1つ足す）, `C:\Users\my\NEXT_ACTIONS.md`, `C:\Users\my\.claude\projects\C--Users-my\memory\fishing-journal-site.md`

**Interfaces:**
- Consumes: Task 2〜7のすべて
- Produces: `npm run dev:worker`（`http://127.0.0.1:8787`）、`npm run build:worker`（`worker/reports/dist/worker.js`＝ダッシュボードに貼る1ファイル）

- [ ] **Step 1: `worker/reports/dev-server.mjs` を作る**

```js
// 手元の通し確認用：Workerを http://127.0.0.1:8787 で動かす（wranglerもCloudflareのログインも要らない）。
// データはメモリの中だけ。止めると消える。
//   起動： npm run dev:worker
//   管理ページ： http://127.0.0.1:8787/admin （合言葉 dev-pass）
// Turnstileは Cloudflare公式の「必ず通る」テスト用の鍵を使う（本物のsiteverifyに問い合わせる＝ネット接続が要る）。
import http from 'node:http';
import worker from './src/index.js';
import { fakeKV, fakeR2 } from './test/fakes.mjs';

const env = {
  REPORTS_KV: fakeKV(),
  REPORTS_R2: fakeR2(),
  TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
  IP_SALT: 'dev-salt',
  SIGN_SECRET: 'dev-sign-secret-dev-sign-secret',
  ADMIN_PASSPHRASE: 'dev-pass',
  // DISCORD_WEBHOOK_URL は入れない（手元の試し投稿で本物のDiscordを鳴らさない）
};
const PORT = 8787;

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers(Object.entries(req.headers).filter(([, v]) => typeof v === 'string'));
    // 手元だけの仕掛け：x-dev-ip を付けると「別の人」になれる（通報3件→非表示の確認用）。本番のWorkerには無い
    headers.set('cf-connecting-ip', req.headers['x-dev-ip'] || req.socket.remoteAddress || '127.0.0.1');
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const request = new Request(`http://127.0.0.1:${PORT}${req.url}`, {
      method: req.method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    });
    const pending = [];
    const response = await worker.fetch(request, env, { waitUntil: (p) => pending.push(p) });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    await Promise.allSettled(pending);
    console.log(req.method, req.url, response.status);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`yfj-reports dev server: http://127.0.0.1:${PORT}`));
```

`package.json` の scripts に足す：

```json
"dev:worker": "node worker/reports/dev-server.mjs",
"build:worker": "esbuild worker/reports/src/index.js --bundle --format=esm --target=es2022 --outfile=worker/reports/dist/worker.js"
```

（`esbuild` はViteの依存として `node_modules` に入っている。`worker/reports/dist/` は `.gitignore` の `dist` に当たるのでコミットされない）

`C:\Users\my\.claude\launch.json` の `configurations` に足す（**既存の設定は消さない。** 他のセッションが足した設定があればそのまま残す）：

```json
{
  "name": "yfj-reports-dev",
  "runtimeExecutable": "node",
  "runtimeArgs": ["G:/fishing-yamaguchi/site/worker/reports/dev-server.mjs"],
  "port": 8787
}
```

- [ ] **Step 2: 手元で通し確認**（Browserペイン。サーバーは `preview_start` で起動する）

1. `preview_start {name: "yfj-reports-dev"}` と `preview_start {name: "fishing-yamaguchi"}`（`npm run dev`・5173）。後者は作業ディレクトリが `G:\fishing-yamaguchi\site` でないと起動しない。起動できない場合は `npm run build` のうえ `fishing-yamaguchi-dist`（8792）ではなく、**5173で動かす必要がある**（`ALLOWED_ORIGINS` に8792は無い）ので、ダディにターミナルで `npm run dev` を実行してもらう。
2. `http://localhost:5173/reports.html` を開き、名前・場所・コメント・風の体感を入れて投稿 → 「投稿しました」と出て、一覧の先頭にカードが出る。
3. 名前を「ダディ」にして投稿 → 「そのお名前は使えません」と赤字で出る。
4. 写真のEXIFが消えることを、ページ内で確かめる（`javascript_tool`）：

```js
const { resizeToJpeg } = await import('/src/js/lib/resize-image.js');
const c = document.createElement('canvas'); c.width = 3000; c.height = 2000;
c.getContext('2d').fillRect(0, 0, 3000, 2000);
const plain = new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
// SOI の直後に Exif の APP1 を差し込んで「位置情報つきの写真」を作る
const app1 = new Uint8Array([0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08]);
const withExif = new Uint8Array(plain.length + app1.length);
withExif.set(plain.slice(0, 2)); withExif.set(app1, 2); withExif.set(plain.slice(2), 2 + app1.length);
const hasExif = (b) => { for (let i = 0; i < Math.min(b.length, 65536) - 6; i++) if (b[i] === 0x45 && b[i+1] === 0x78 && b[i+2] === 0x69 && b[i+3] === 0x66 && b[i+4] === 0 && b[i+5] === 0) return true; return false; };
const out = await resizeToJpeg(new File([withExif], 'gps.jpg', { type: 'image/jpeg' }));
const outBytes = new Uint8Array(await out.arrayBuffer());
const bmp = await createImageBitmap(out);
({ before: hasExif(withExif), after: hasExif(outBytes), width: bmp.width, height: bmp.height, kb: Math.round(out.size / 1024) })
```
Expected: `{ before: true, after: false, width: 1600, height: 1067, … }`

5. 通報：画面で「不適切な投稿を知らせる」→確認→「知らせました。ありがとうございます」と変わる（これで1件目）。続けて、別の人2人分を手元の仕掛け（`x-dev-ip`）で送る。`<ID>` はカードの `data-id`：

```bash
for ip in 10.0.0.2 10.0.0.3; do curl -s -X POST -H "x-dev-ip: $ip" "http://127.0.0.1:8787/posts/<ID>/report"; echo; done
```
Expected: 2行目が `{"ok":true,"hidden":true}`。`reports.html` を読み込み直すとその投稿が消えている。`/admin` では「非表示」の印つきで残っていて、「再表示」で戻せる。
6. `http://127.0.0.1:8787/admin` → 合言葉 `dev-pass` → 一覧に投稿が出る → 「削除」→ 一覧から消え、`reports.html` を読み込み直すと消えている。
7. `http://localhost:5173/sea.html` → 萩の海況の下に「Reports — 現地の声」が出る（萩の投稿があるとき）。投稿の無いエリアに切り替えると枠ごと消える。dev-server を止めて読み込み直しても、海況は普通に出る。
8. `resize_window {preset: "mobile"}` でフォームとカードが崩れないことを確かめ、`preset: "desktop"` に戻す。スクリーンショットを1枚ずつ撮ってダディに見せる。
9. `read_console_messages {onlyErrors: true}` でエラーが無いこと。

- [ ] **Step 3: 貼り付け用の1ファイルを作り、`worker/reports/README.md` を書く**

Run: `npm run build:worker`
Expected: `worker/reports/dist/worker.js` ができる（数十KB）。`node -e "import('file:///G:/fishing-yamaguchi/site/worker/reports/dist/worker.js').then(m=>console.log(typeof m.default.fetch))"` → `function`

`worker/reports/README.md`:

```markdown
# yfj-reports — 「現地の声」Worker

釣りサイトの投稿を受け取り、保存し、配るCloudflare Worker。**workers.dev で動かす（tproject-jp.com の下に置かない）。**

- 設計：`docs/superpowers/specs/2026-09-20-reports-ugc-design.md`
- 公開の手順：`docs/REPORTS_公開手順.md`
- テスト：`npm test`（ネット不要）／手元で動かす：`npm run dev:worker` → http://127.0.0.1:8787
- 本番に出すファイル：`npm run build:worker` → `worker/reports/dist/worker.js` をダッシュボードの「コードを編集する」に丸ごと貼る

## バインディングと秘密の値（Cloudflareのダッシュボードで設定）

| 名前 | 種類 | 中身 |
|---|---|---|
| `REPORTS_KV` | KV | 投稿の本文・索引・回数制限 |
| `REPORTS_R2` | R2 | 写真（`photo/<id>.jpg`） |
| `TURNSTILE_SECRET` | secret | Turnstileのシークレットキー |
| `IP_SALT` | secret | IPをハッシュ化するときの塩（ランダムな長い文字列。**変えると同じ人の判定がリセットされる**） |
| `SIGN_SECRET` | secret | 管理Cookieと削除リンクの署名（**変えると全員ログアウト・発行済みの削除リンクが無効になる**） |
| `ADMIN_PASSPHRASE` | secret | 管理ページの合言葉（ダディが決める） |
| `DISCORD_WEBHOOK_URL` | secret | 通知先（無くても動く） |

## 釣り場・魚の選択肢を変えるとき

`src/js/data/spot-list.js`・`report-options.js` を直す → `npm test` → **サイトとWorkerの両方を出し直す**（Workerも同じファイルを取り込んでいるため。片方だけだと、新しい釣り場を選んだ投稿が「場所を選んでください」で弾かれる）。IDは変えない・消さない。
```

- [ ] **Step 4: `docs/REPORTS_公開手順.md` を書く**（ダディ向け。画面の操作はダディ、確認はクロロ）

```markdown
# 「現地の声」公開の手順（ダディ向け）

Cloudflareは**ダディの個人アカウント**（Instagram連携のWorkerと同じアカウント）で作業します。所要30分ほど。費用は0円です。
⚠️ 写真の置き場（R2）は無料枠の中で使いますが、**有効にするときにクレジットカードの登録を求められます**（請求は発生しません）。

## 1. 置き場を作る
1. 左メニュー「ストレージとデータベース」→「KV」→「作成」→ 名前 `yfj-reports`
2. 「R2」→（初回は有効化）→「バケットを作成」→ 名前 `yfj-reports-photos`

## 2. ロボット除け（Turnstile）を作る
1. 左メニュー「Turnstile」→「ウィジェットを追加」
2. 名前 `yfj-reports`／ホスト名 `papachi03.github.io`／モード「管理対象」
3. 表示された **サイトキー** と **シークレットキー** を控える（サイトキーは公開してよい値、シークレットは秘密）

## 3. Workerを作ってコードを貼る
1. 「Workers & Pages」→「作成」→ Worker → 名前 `yfj-reports` → いったんそのままデプロイ
2. 「コードを編集する」→ 中身を全部消す → `worker/reports/dist/worker.js` を丸ごと貼る（メモ帳で開いて Ctrl+A → Ctrl+C）→「デプロイ」
   - 貼り付けの目印：コードの中に「現地の声」という文字がある
3. 表示されたアドレス（`https://yfj-reports.○○.workers.dev`）を控える

## 4. つなぐ・秘密の値を入れる（Workerの「設定」）
1. 「バインディング」→ 追加：KV 名前空間 → 変数名 `REPORTS_KV` → `yfj-reports`
2. 「バインディング」→ 追加：R2 バケット → 変数名 `REPORTS_R2` → `yfj-reports-photos`
3. 「変数とシークレット」→ 種類は全部「シークレット」で追加：
   - `TURNSTILE_SECRET` … 2で控えたシークレットキー
   - `IP_SALT` … でたらめな英数字を40文字以上（キーボードを適当に叩いたものでよい）
   - `SIGN_SECRET` … 上とは別の、でたらめな英数字を40文字以上
   - `ADMIN_PASSPHRASE` … **管理ページの合言葉。ダディが決めて、ダディだけが覚えておく**
   - `DISCORD_WEBHOOK_URL` … Discord「秘書クロロに伝達」サーバー → チャンネルの設定 → 連携サービス → ウェブフック → 新しく作ってURLをコピー
4. 「デプロイ」

## 5. サイトに接続先を書く（ここはクロロがやります）
3で控えたアドレスと、2のサイトキーをクロロに伝える → クロロが `src/js/config/reports.js` に書いてコミット → **ダディが `git push`**

## 6. 確かめる（クロロが案内します）
- `https://yfj-reports.○○.workers.dev/posts` を開いて `{"ok":true,"posts":[]}` と出る
- サイトの REPORTS ページからテスト投稿 → すぐ一覧に出る → Discordに通知が届く
- 通知の「削除する」リンク → 確認画面 →「削除する」→ 一覧から消える
- `https://yfj-reports.○○.workers.dev/admin` → 合言葉で入れる
- Search Console：`reports.html` のURL検査 →「公開URLをテスト」→「登録できます」→「インデックス登録をリクエスト」
- **公開から数日は、Search Consoleの「セキュリティの問題」を毎日見る**
```

- [ ] **Step 5: 記録を更新してコミット**

- `C:\Users\my\NEXT_ACTIONS.md` の「釣りサイトYFJ「現地の声」投稿機能」の行を、実装完了・公開待ち（ダディの作業＝釣り場リストの確認／公開手順書の1〜4／push）に書き換える。**Pythonのスクリプトをファイルに書いて実行する（パスは `/` 区切りで書く。ヒアドキュメントに `\` を含むパスを入れない）。書き換え後に該当行を読み直して確かめる。**
- `memory/fishing-journal-site.md` の末尾に、仕組みの要点（Workerの場所・workers.devにした理由・選択肢を変えたら両方出し直す・手元の起動方法）を1段落で足す。

```bash
git add worker/reports/dev-server.mjs worker/reports/README.md docs/REPORTS_公開手順.md package.json
git commit -m "現地の声：手元の確認用サーバー・公開手順書・READMEを追加"
```

- [ ] **Step 6: ダディに報告して、公開の作業を引き継ぐ**

報告に入れること：通し確認の結果（スクリーンショット）／テストの件数／ダディにお願いする作業（釣り場リストの確認・公開手順書の1〜4・最後の `git push`）／R2のカード登録の件。**`git push` とCloudflareの操作は実行者が行わない。**

公開後（ダディから「できた」と連絡が来たら）：`docs/REPORTS_公開手順.md` の6を上から順に確認し、`src/js/config/reports.js` に値を入れるコミットを作る。

# Codex への依頼書：イカ部ガチャの演出（gacha-ui.js）

作るもの：山口イカ部サイトの「カードガチャ」画面の**演出と動き**。仕組み（確率・天井・記録）は `src/js/ikabu/games/gacha.js` にでき上がっていて、テスト済み（`npm test`）。あなたは **画面と動きだけ** を作る。

## 守ること（このリポジトリの決まり）
- 素の JS（ES modules）＋ CSS。ライブラリ・フレームワーク・ビルド設定の変更は不可。文字は日本語（英語は `t(lang, ja, en)` で両方書く）
- 新しく作るファイル：`src/js/ikabu/games/gacha-ui.js`（画面）、`src/css/ikabu.css` の末尾に `/* ガチャ（2026-09-30） */` の節を足す。`src/js/ikabu/views/play.js` にガチャの HTML（`gachaHTML(lang)`）を足し、`src/js/ikabu/pages/play.js` で `mountGacha(document.getElementById('ika-gacha'), { lang })` を呼ぶ。単体ページ（views/sumi.js・views/egi.js・pages/sumi.js・pages/egi.js）にも同じ欄を足す（`ticketsHTML` と同じやり方で、認定証の欄の下）
- 既存の物は壊さない。`npm test` が全部通ること（`npm test 2>&1 | grep "^ℹ fail 0"`）。既存のテストを消したり弱めたりしない
- 削除しない。`rm` を使わない。要らないと思う物は消さずに報告に書く
- `prefers-reduced-motion: reduce` の時は動きを短く（ホワイトアウトと結果は残す）
- スマホ幅（375px）で横にはみ出さない。`document.documentElement.scrollWidth <= innerWidth`
- 音は既存を流用：`createFeel` の `feel.play('cast'|'hook')`（feel.js。'hook' はドン＋シャキーン）。`createSfx`（sumi-sfx.js）の音も可。新しい音源ファイルは足さない
- 画像は `public/assets/ikabu/`：`gacha_result_bg.webp`（縦9:16・1枚引きの結果背景）、`gacha10_bg.webp`（横16:9・10連の結果背景）、`cards/card_NNN.webp`（600×900）、`cards/card_back.webp`（裏面）、`mascot/squirt.webp`（墨を吐くイカ）。パスは `assetHref('/assets/ikabu/...')`（i18n.js）で付ける

## 使う API（gacha.js・tickets.js）
```js
import { readCards, writeCards, pull, omen, RATES, PITY_SR, PITY_UR, COST_SINGLE, COST_TEN } from './gacha.js';
import CARDS from './cards-data.json';                 // [{ no, name, kind:'squid'|'tech'|'trap', rarity:'N'|'R'|'SR'|'SSR'|'UR', mark, cost, atk, def, effect, short }]
import { readTickets, writeTickets, spend } from './tickets.js';
import { utcDay } from './rng.js';
// 引く：🎫を払ってから pull。足りなければ払えない
const tk = spend(readTickets(), COST_TEN, { day: utcDay() });   // { rec, ok }
if (tk.ok) { writeTickets(tk.rec); const { rec, results } = pull(readCards(), CARDS, 10); writeCards(rec); /* results: [{ card, rarity, isNew, shards, guaranteed }] */ }
const o = omen(results);   // { top:'UR'|…, sure:'goldInk'|'runaway'|'kiloUp'|null, nabura:bool, comeback:bool }
```
- 🎫の残りは `readTickets().n`。引いた後は `dispatchEvent(new CustomEvent('ikabu:tickets'))` を投げる（tickets-ui.js に `addEventListener('ikabu:tickets', …)` で欄を更新する1行を足してよい）
- 確率と天井の表示：`RATES`（N 60／R 28／SR 9／SSR 2.5／UR 0.5%）、「SR以上まであと `PITY_SR - rec.sinceSR` 回」「URまであと `PITY_UR - rec.sinceUR` 回」

## 演出の台本（ikabu-research/cardbattle/ガチャ演出_設計.md を要約）
1つの画面（`<section id="ika-gacha">`）の中で、舞台（横長・エギングの海と堤防の雰囲気。SVG か CSS で簡単に）→ 結果、の順に進む。

**シングル／10連 共通の流れ**
1. 投げる：「投げる」ボタンを**長押し→はなす**（エギングと同じ手ざわり。長押しの長さで竿の振りが変わる）。竿が振られ、エギが右へ飛んで着水（放物線・しぶき）。`feel.play('cast')`
2. 沈む：エギがゆっくり沈む（1.5〜2秒）。ここで「予感」の演出（下）
3. 「？」：画面中央に大きく「？」がドンと出る。糸が少し動く
4. 「フッキング」ボタンが出る → 押すと駆け引き（竿がしなる・ドラグ音の代わりに画面の揺れ・テンションのゲージが揺れる）。通常2秒、確定演出つきは4〜6秒
5. 「乗った！」：文字がドンと出る → `feel.play('hook')` → 画面が**ホワイトアウト**（0.4秒で白→結果へ）
6. 結果：シングル＝背景 `gacha_result_bg.webp` の中央にカードが**裏面から表へ回転**して現れる（枠→絵→レア度ロゴの順に見える感じでよい）。SR以上は最後に光の粒。10連＝背景 `gacha10_bg.webp` に5列×2段、0.3秒ずつ裏→表にめくれる。9枚目の後、10枚目の前に「逆転バラシ」か「キロアップ」（`omen.comeback` の時）。全部そろったら NEW のカードが光る
7. 結果の下に「もう一度（1🎫）」「10連（10🎫）」「バインダーへ（後で作る。今は何もしないボタンでよい）」

**予感と確定（`omen()` の結果で出し分け）**
| 名前 | いつ | 何が起きる | 条件 |
|---|---|---|---|
| ふつうの堤防 | 沈む間 | 何も起きない | それ以外 |
| 時合い（夕マズメ） | 投げた後、空がオレンジに | 「時合いだ…！」 | SR以上の**予感**：top が SR以上の時は必ず出す。それ以外でも 15% の確率で出す（外れる予感） |
| 常夜灯 | 夜になり常夜灯が点く | 「常夜灯に群れが…！」 | top が R以上 の時 50% |
| キロアップ | 駆け引きで竿が大きくしなる | 「キロアップだ！」 | `sure === 'kiloUp'`（SR確定） |
| 止まらない | 駆け引きが長引き糸が出続ける | 「止まらない…！ ボスか！？」 | `sure === 'runaway'`（SSR確定） |
| 金の墨 | 着水後、水面に金色の墨 | 「金の墨…！？」 | `sure === 'goldInk'`（UR確定） |
| 虹の墨 | 金の墨がさらに虹色に | 「虹だ！！」 | UR確定のうち 50%（演出が最大） |
| 逆転バラシ | 10枚目の前に「バラシ…？」→「まだ付いてる！」 | 落としてから上げる | `omen.comeback` |
| ナブラ | 10連の投げの時、水面に群れの波紋 | 「ナブラだ！」 | `omen.nabura` |
| 部長登場 | 部長イカが横から顔を出す「今日はイケる気がする」 | お楽しみ | その日の最初の1回（`localStorage` の `ikabu.gacha.lastDay` で判定） |

- 「予感は外れてよい、確定は必ず当たる」の2段。**演出の判定は結果（`results`）を先に引いてから決める**（引いた後に演出を組む＝ズルはできない）
- 文字は大きく短く（1〜2秒で消える）。色：紺 `#16233a`・橙 `#f47321`・金 `#d4a017`・虹は linear-gradient
- 音は `feel.play('cast')` と `feel.play('hook')` だけでよい（無ければ静かに）

**大事にすること（ぱっぱ：「演出や動きが命」）**
- 「来た！」と「もしかして…」の両方を作る：予感→確定の順で気持ちを上げる
- 動きに緩急：投げは速く、沈むはゆっくり、「？」は一瞬止めて、駆け引きはガタガタ、ホワイトアウトは速く、カードは丁寧に
- 10連の9枚目→10枚目の「ため」を必ず作る

## 確かめ方
- `npm test` 全部通る
- 開発サーバー（`npx vite --port 5180`）で `/ikabu/play.html` を開き、`localStorage.setItem('ikabu.tickets.v1', JSON.stringify({n:100,earned:100,spent:0,day:null,today:{},certs:{},codes:{}}))` で🎫を100枚にして、シングルと10連を通しで見る。`?gachaDemo=UR` で UR 確定の演出、`?gachaDemo=ten` で10連（`import.meta.env.DEV` の時だけ効く開発スイッチとして作る）
- 375px 幅で横にはみ出さない
- 終わったら、作ったファイルと、判断に迷った所、確かめた内容を日本語で報告する

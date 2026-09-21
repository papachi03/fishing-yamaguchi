# 「現地の声」釣り場リスト候補（下調べ：2026-09-21、9/21ダディ確認・確定）

判定の意味：**掲載候補**＝複数の情報源で釣り場として紹介され、禁止の情報が見当たらない／**要確認**＝禁止・制限の情報が一部にある、または情報源が1つだけ／**除外**＝釣り禁止・立入禁止が確認できた

## 確定方針（2026-09-21 ダディ指示）

- 一部禁止区画・時間帯の制限がある場所も、**個別の注意書きは付けず掲載する**。釣りのマナー・安全・現地ルールの遵守は投稿者の自己責任とし、投稿フォームの共通の注意書き（reports.html）で一括して促す形にした（`placeLabel`の個別note機能は今回使わない。将来ほんとうに危険な場所が出たら使う）。
- 上記の方針に沿って、釣り禁止・立入禁止が明記された場所、または個人ブログ1件のみが根拠の場所だけを外し、残りは掲載する。ダディが共有した釣り場情報サイト（turi-search.jp）を追加で確認し、**最終的に74か所を掲載**（除外4・保留3）。マリーナ萩・野波瀬漁港は当初「制限あり／禁止」とネット情報にあったが、ダディの実地確認で釣り可能と判明したため掲載した。
- 追加：長門「荒川船舶鉄工所付近」（ダディの実地情報。ネット上に情報源なし）、萩「菊ヶ浜」「嫁泣漁港」（ダディ指定・アオリイカのポイント）、萩の7か所（ダディが共有した https://www.turi-search.jp/2019/05/26/アオリイカの釣り場-萩市-阿武町/ より）。
- **保留**：「大井漁港」（turi-search.jp別記事）は、既存の「大井浦漁港」と紛らわしく同一地点の可能性があるため、いったん見送り。ダディに確認後、別地点と分かれば追加する。
- **9/21追記（ダディ確認）**：「マリーナ萩」は釣りOKとのことで掲載に追加。「野波瀬漁港」は一部制限があるが釣り可能とのことで、除外から掲載に変更した。

## 掲載が確定した釣り場（74か所）

`src/js/data/spot-list.js` の `SPOTS` に反映済み（コミット済み）。ダディが共有した釣り場情報サイト（turi-search.jp の萩・長門・下関・防府のアオリイカ釣り場特集）を追加で確認し、大幅に増補した。

### 萩市（18か所）
越ヶ浜漁港・萩港・三見漁港・江崎港・須佐漁港・宇田港・奈古漁港・大井浦漁港・菊ヶ浜・嫁泣漁港・三見明石浄化センター前・尾ヶ崎（地磯）・萩商港（浜崎商港）・香川津の波止・椿東・中小畑の護岸・美萩海浜公園・笠山（地磯）・マリーナ萩

### 長門市（23か所）
仙崎人工島・仙崎漁港・大日比漁港・川尻岬・久津漁港・掛淵漁港・伊上漁港・荒川船舶鉄工所付近・白潟漁港・湊漁港・小島港・野波瀬漁港・野波瀬・地蔵崎・野波瀬漁港右横の護岸・松島（地磯）・飯井港・田ノ浦漁港・田ノ浦漁港横岸壁・青海島道路沿い・青海島大橋下周辺・大浦漁港・久原漁港・黄波戸漁港

### 下関市（20か所）
室津下漁港・安岡漁港・下関フィッシングパーク・角島・牧崎・湯玉漁港・川棚漁港・涌田漁港・二見漁港・粟野漁港・あるかぽーと・岬之町・東大和町・福浦港・荒田港・西山ふ頭・南風泊港・彦島南公園下海岸・彦島砕石場・南霊園下海岸・長府扇町岸壁・関見台公園下海岸

### 下松市（6か所）
洲鼻港・笠戸大橋下・はなぐり海岸・本浦漁港・深浦漁港・下松第二埠頭

### 防府市（7か所）
富海海岸（富海漁港）・佐波川河口・郷ヶ崎漁港・西浦漁港・中浦漁港・中関埠頭（中関新埠頭）・向島運動公園

## 除外（掲載しない・4か所）

| エリア | 名前 | 理由 |
|---|---|---|
| 長門 | 川尻漁港 | 「港内は釣り禁止」と明記 |
| 長門 | 通漁港（南側波止） | マナー悪化により釣り禁止になったと記載 |
| 防府 | 小茅漁港 | 個人ブログ1件のみが根拠の穴場紹介 |
| 防府 | 三田尻港 | 「大部分が立入禁止」と明記 |

## 保留（ダディに確認中）

| エリア | 名前 | 保留理由 |
|---|---|---|
| 萩 | 大井漁港 | 既存の「大井浦漁港」と紛らわしく、同一地点か別地点か未確認 |
| 下関 | 竹ノ子島 | 「私有地を通るためアクセス制限あり」との記載。時間帯の制限とは性質が違うため掲載せず保留 |
| 防府 | 防府マリーナ | マリーナ萩と同様、民間マリーナのため保留 |

---

## 下調べの詳細（各釣り場の情報源・種類）

以下は、判定の根拠として残す元の下調べ記録です。

### 萩市

| 名前 | 種類 | 情報源 | 釣り禁止・立入禁止の情報 |
|---|---|---|---|
| 越ヶ浜漁港 | 漁港 | 既存SPOTS（サイト基準） | 見当たらず |
| 萩港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihagisi.html / https://uosoku.com/home/cyuu/yamaguchi/hagi/ | 見当たらず（世界遺産隣接の防波堤、初心者向け） |
| 三見漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihagisi.html / https://uosoku.com/hagi/ | 見当たらず |
| 江崎港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihagisi.html | 見当たらず（東側岸壁・西側波止とも釣り可） |
| 須佐漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihagisi.html | 見当たらず（赤灯波止・白灯波止） |
| 宇田港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihagisi.html | 見当たらず（白灯波止） |
| 奈古漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihagisi.html | 白灯波止は立入禁止（他の波止は可）※掲載方針により注記なしで掲載 |
| 大井浦漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihagisi.html | 見当たらず |
| 菊ヶ浜 | 海岸 | https://mk-freestyle.work/post-2645/ ほか複数 | 夏季は海水浴場につき遊泳期間中は釣り不可（季節限定）※掲載方針により注記なしで掲載 |
| 嫁泣漁港 | 漁港 | https://www.turi-search.jp/2019/04/23/%E8%90%A9%E5%B8%82-%E5%AB%81%E6%B3%A3%E6%BC%81%E6%B8%AF/ | 見当たらず |
| 三見明石浄化センター前 | 護岸 | https://www.turi-search.jp/2019/05/26/アオリイカの釣り場-萩市-阿武町/ | 見当たらず |
| 尾ヶ崎（地磯） | 地磯 | 同上 | 見当たらず |
| 萩商港（浜崎商港） | 港 | 同上 | 見当たらず |
| 香川津の波止 | 波止 | 同上 | 見当たらず |
| 椿東・中小畑の護岸 | 護岸 | 同上 | 見当たらず |
| 美萩海浜公園 | 海浜公園 | 同上 | 見当たらず |
| 笠山（地磯） | 地磯 | 同上 | 見当たらず |
| マリーナ萩 | マリーナ（民間） | https://www.turi-search.jp/2019/05/26/アオリイカの釣り場-萩市-阿武町/ | 実地調査時は制限との記載あったが、ダディ確認：釣りOK |

### 長門市

| 名前 | 種類 | 情報源 | 釣り禁止・立入禁止の情報 |
|---|---|---|---|
| 仙崎人工島 | 人工島（波止） | 既存SPOTS（サイト基準） | 見当たらず |
| 仙崎漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchinagatosi.html | 見当たらず（先端波止は波返しなく足場良好） |
| 大日比漁港 | 漁港 | https://www.turi-search.jp/2018/10/20/%E9%95%B7%E9%96%80%E5%B8%82-%E5%A4%A7%E6%97%A5%E6%AF%94%E6%BC%81%E6%B8%AF/ | 見当たらず（外波止2本が釣り可） |
| 川尻岬 | 地磯 | https://c.turihiroba.com/turiba3/yamaguchinagatosi.html | 見当たらず（1級磯として紹介） |
| 久津漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchinagatosi.html | 見当たらず |
| 掛淵漁港 | 漁港 | https://www.turi-search.jp/2018/10/26/%E9%95%B7%E9%96%80%E5%B8%82-%E6%8E%9B%E6%B7%B5%E6%BC%81%E6%B8%AF/ | 見当たらず |
| 伊上漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchinagatosi.html | 見当たらず |
| 荒川船舶鉄工所付近 | ダディの実地情報 | ネット上に情報源なし | 確認できず |
| 野波瀬漁港 | 漁港 | https://www.turi-search.jp/2019/03/15/アオリイカの釣り場-長門市/ | 一部制限あり（ダディ確認：釣り可能） |
| 川尻漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchinagatosi.html | 「港内は釣り禁止」と明記 → 除外 |
| 通漁港（南側波止） | 漁港 | https://c.turihiroba.com/turiba3/yamaguchinagatosi.html | マナー悪化により釣り禁止 → 除外 |

### 下関市

| 名前 | 種類 | 情報源 | 釣り禁止・立入禁止の情報 |
|---|---|---|---|
| 室津下漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchisimonosekisi.html | 見当たらず |
| 安岡漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchisimonosekisi.html | 見当たらず |
| 下関フィッシングパーク | 海釣り公園（有料） | https://shimonoseki-fishingpark.com/index.html | なし（管理された釣り施設） |
| 角島・牧崎 | 地磯 | https://c.turihiroba.com/turiba3/yamaguchisimonosekisi.html | 夜間の釣りが禁止 ※掲載方針により注記なしで掲載 |
| 湯玉漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchisimonosekisi.html | 夜間（18時〜翌朝6時）釣り禁止・撒き餌禁止 ※同上 |
| 川棚漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchisimonosekisi.html | 東波止は立入禁止（他の波止は可）※同上 |
| 涌田漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchisimonosekisi.html | 漁港内は夜間立入禁止 ※同上 |
| 二見漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchisimonosekisi.html | 港内は関係車両以外進入禁止（釣り自体は可） |
| 粟野漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchisimonosekisi.html | 見当たらず |

### 下松市

| 名前 | 種類 | 情報源 | 釣り禁止・立入禁止の情報 |
|---|---|---|---|
| 洲鼻港 | 漁港 | https://kudamatsu-kanko.jp（市観光サイト）/ https://c.turihiroba.com/turiba3/yamaguchikudamatusi.html | 見当たらず |
| 笠戸大橋下 | 護岸 | https://c.turihiroba.com/turiba3/yamaguchikudamatusi.html / turi-search.jp | 見当たらず |
| はなぐり海岸 | 波止・桟橋 | https://c.turihiroba.com/turiba3/yamaguchikudamatusi.html | 見当たらず |
| 本浦漁港 | 漁港 | 同上 | 東波止は立入禁止（西波止・港内は可）※掲載方針により注記なしで掲載 |
| 深浦漁港 | 漁港 | https://www.turi-search.jp/2019/12/26/%E4%B8%8B%E6%9D%BE%E5%B8%82-%E6%B7%B1%E6%B5%A6%E6%BC%81%E6%B8%AF/ | 時期によりフェンスで立入不可の可能性 ※同上 |
| 下松第二埠頭 | 埠頭 | https://c.turihiroba.com/turiba3/yamaguchikudamatusi.html | 立入禁止の区画も多い ※同上 |

### 防府市

| 名前 | 種類 | 情報源 | 釣り禁止・立入禁止の情報 |
|---|---|---|---|
| 富海海岸（富海漁港） | 海岸・波止 | https://c.turihiroba.com/turiba3/yamaguchihoufusi.html | 見当たらず |
| 佐波川河口 | 河口 | https://c.turihiroba.com/turiba3/yamaguchihoufusi.html | 見当たらず |
| 郷ヶ崎漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihoufusi.html | 頭上に電線あり（釣り禁止ではない）※掲載方針により注記なしで掲載 |
| 西浦漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihoufusi.html | 見当たらず |
| 中浦漁港 | 漁港 | https://c.turihiroba.com/turiba3/yamaguchihoufusi.html | 見当たらず |
| 中関埠頭（中関新埠頭） | 埠頭 | https://c.turihiroba.com/turiba3/yamaguchihoufusi.html | 工業地帯に近く要注意 ※同上 |
| 小茅漁港 | 漁港 | 個人ブログ（エギングスポットとして紹介） | 見当たらず → 除外（個人ブログ1件のみが根拠） |
| 三田尻港 | 港 | https://c.turihiroba.com/turiba3/yamaguchihoufusi.html | 「大部分が立入禁止」と明記 → 除外 |

// タックル（アフィリエイト対象）データ。
//
// 1件 = { id, category, type, brand, name, query, asin, rakutenUrl, owned, note, spec }
//   category: tackleCategories の id
//   type:     'rod' | 'reel' | 'lure' | 'line' | 'gear' | 'camera'
//   asin:     Amazonの商品ID。あれば商品ページ直リンク、無ければ query で検索リンク
//   rakutenUrl: 楽天市場の商品ページURL。無ければ query で楽天検索リンク
//   owned:    true = ダディが実際に使っている（Amazonストアフロント「使って良かったもの」
//             掲載品・動画で確認できたもの）。false = これから揃えるなら、の定番候補
//
// 出典: Amazonストアフロント https://www.amazon.co.jp/shop/child のアイデアリスト（2026-09-11取得）

export const tackleCategories = [
  { id: 'eging', en: 'EGING', ja: 'エギング / ヤリイカ', lead: 'アオリイカ・コウイカ・ヤリイカ。このジャーナルの主戦場。' },
  { id: 'yaen', en: 'YAEN', ja: 'ヤエン釣り', lead: '活きアジでアオリイカを掛ける、待ちの釣り。' },
  { id: 'ajing', en: 'AJING', ja: 'アジング', lead: '夜の常夜灯まわり。クーラーが埋まる晩秋のアジ。' },
  { id: 'nomase', en: 'LIVE BAIT', ja: 'アジの泳がせ', lead: '釣ったアジをそのまま泳がせて、大物を待つ。' },
  { id: 'sabiki', en: 'SABIKI', ja: 'サビキ釣り', lead: '家族でも一番手軽。エサと仕掛けと水汲みバケツ。' },
  { id: 'jigging', en: 'SHORE JIGGING', ja: 'ショアジギング', lead: '堤防・磯からの青物狙い。ハマチ・サゴシの回遊シーズンに。' },
  { id: 'light', en: 'NIGHT LIGHT', ja: '灯火フィッシング', lead: '灯火に集まるイカを見ながら釣る、夜の装備。' },
  { id: 'camera', en: 'FILMING', ja: '釣り動画の撮影', lead: 'Vlogを撮るためのGoPro周りと照明。' },
];

const A = (o) => ({ asin: null, rakutenUrl: null, owned: true, spec: null, ...o });

export const tackle = [
  // ---------- エギング / ヤリイカ ----------
  A({ id: 'emeraldas-x', category: 'eging', type: 'rod', brand: 'DAIWA', name: 'エメラルダス X（86ML）',
      query: 'ダイワ エメラルダス X 86ML', asin: 'B07THWQNF4', spec: '8.6ft / ML',
      note: 'ヤリイカの灯火釣りで振っていたロッド。エギングの最初の1本としても扱いやすい。' }),
  A({ id: 'sephia-ss-s86ml-s', category: 'eging', type: 'rod', brand: 'SHIMANO', name: 'セフィア SS S86ML-S',
      query: 'シマノ セフィア SS S86ML-S', spec: '8.6ft / ML / ソリッドティップ',
      note: '2026年に新調したエギングロッド。ソリッドティップで、イカがエギを抱いた小さなアタリが穂先に出る。' }),
  A({ id: 'nexave', category: 'eging', type: 'reel', brand: 'SHIMANO', name: '21 ネクサーブ（C3000DH）',
      query: 'シマノ ネクサーブ C3000DH', asin: 'B09BFNJ3P7', spec: 'C3000 / ダブルハンドル',
      note: 'エメラルダスXと組んでいたリール。価格を抑えつつ、シャクリのリズムが作りやすい。' }),
  A({ id: 'sephia-bb-c3000sdhhg', category: 'eging', type: 'reel', brand: 'SHIMANO', name: '26 セフィア BB C3000SDHHG',
      query: 'シマノ セフィア BB C3000SDHHG', asin: 'B0H41JNYRC', spec: 'C3000 / ダブルハンドル / ハイギア',
      note: 'セフィアSSと組む新しいリール。ダブルハンドルのハイギアで、シャクった後のラインスラックを素早く回収できる。' }),
  A({ id: 'naory-range-hunter', category: 'eging', type: 'lure', brand: 'YAMASHITA', name: 'ナオリー レンジハンター',
      query: 'ヤマシタ ナオリー レンジハンター', asin: 'B07TSBPQS1',
      note: 'ヤリイカ・ヒイカ向けの小型エギ。灯火の下で群れを寄せて掛ける時の主力。' }),
  A({ id: 'esamaki-tera', category: 'eging', type: 'lure', brand: 'YAMARIA', name: 'エサ巻きテーラ デカ針 電気ウキセット',
      query: 'ヤマリア エサ巻きテーラ デカ針', asin: 'B076CY7H5P',
      note: '動画のタックル欄にも出ていた、キビナゴを巻いて使うヤリイカ仕掛け。' }),
  A({ id: 'saltiga-pe', category: 'eging', type: 'line', brand: 'DAIWA', name: 'UVF ソルティガ デュラセンサー X8+Si2',
      query: 'ダイワ ソルティガ デュラセンサー X8 0.6号', asin: 'B083WGLS9D',
      note: 'エギングもサビキもこのPE。' }),
  A({ id: 'emeraldas-leader', category: 'eging', type: 'line', brand: 'DAIWA', name: 'エメラルダス リーダー（フロロ）',
      query: 'ダイワ エメラルダスリーダー 2号', asin: 'B072MRXDQM',
      note: 'エギング用フロロリーダー。' }),
  A({ id: 'sephia-bb-s86ml', category: 'eging', type: 'rod', brand: 'SHIMANO', name: '22 セフィア BB S86ML', owned: false,
      query: 'シマノ セフィア BB S86ML', asin: 'B0B7RNF6X4', spec: '8.6ft / ML',
      note: 'これから揃えるなら。8.6ft MLはエメラルダスXと同じ、いちばん潰しの効く番手。' }),
  // エギは色ごとにASINが分かれる。リンク先は軍艦グリーンなので、名前にも色を入れておく
  A({ id: 'egioh-k', category: 'eging', type: 'lure', brand: 'YAMASHITA', name: 'エギ王 K 3.5号（軍艦グリーン）', owned: false,
      query: 'ヤマシタ エギ王K 3.5号', asin: 'B078ZW65R7', spec: '3.5号 / 22g',
      note: '秋のアオリイカの定番エギ。まず1本ならこれ。' }),

  // ---------- ヤエン ----------
  A({ id: 'aori-yaen-hikkake', category: 'yaen', type: 'lure', brand: 'YAMASHITA', name: 'アオリヤエン 必掛',
      query: 'ヤマシタ アオリヤエン 必掛', asin: 'B0040J3PYU', note: 'ヤエン本体。' }),
  A({ id: 'shimano-yaen', category: 'yaen', type: 'lure', brand: 'SHIMANO', name: 'ヤエン A-RB ラインローラーヤエン L',
      query: 'シマノ ヤエン A-RB L', asin: 'B000AR4BV2', note: 'ローラー付きで送り込みが滑らかなヤエン。' }),
  A({ id: 'liberty-club-seabass', category: 'yaen', type: 'rod', brand: 'DAIWA', name: 'リバティクラブ シーバス',
      query: 'ダイワ リバティクラブ シーバス', asin: 'B0073B25Z2', note: 'ヤエンと泳がせを兼ねる、手頃なシーバスロッド。' }),
  A({ id: 'aorista-bb', category: 'yaen', type: 'reel', brand: 'SHIMANO', name: '13 アオリスタ BB',
      query: 'シマノ 13 アオリスタ BB', asin: 'B00E2BMEXE', spec: 'ヤエン専用 / C3000HG',
      rakutenUrl: 'https://item.rakuten.co.jp/point/4969363031822/',
      note: 'ヤエン専用リール。アジを泳がせている間はレバーで糸を送り出しておき、イカが抱いたらそのまま巻きに移れる。' }),
  A({ id: 'nexave-yaen', category: 'yaen', type: 'reel', brand: 'SHIMANO', name: '21 ネクサーブ',
      query: 'シマノ ネクサーブ', asin: 'B09BFNJ3P7', note: 'ヤエンにも同じネクサーブ。' }),
  A({ id: 'tg-peacemaster', category: 'yaen', type: 'line', brand: 'DUEL', name: 'TG ピースマスター 磯 ビヨンド',
      query: 'デュエル TGピースマスター磯 ビヨンド', asin: 'B015NBD0FC', note: 'ヤエン・泳がせ用のナイロンライン。' }),
  A({ id: 'yaen-stopper-green', category: 'yaen', type: 'gear', brand: 'KATSUICHI', name: 'ヤエンストッパー（グリーン）',
      query: 'カツイチ ヤエンストッパー', asin: 'B000AR646W', note: 'ヤエンを止める位置の目印。' }),
  A({ id: 'yaen-stopper-black', category: 'yaen', type: 'gear', brand: 'KATSUICHI', name: 'ヤエンストッパー（ブラック）',
      query: 'カツイチ ヤエンストッパー ブラック', asin: 'B000BSD5SU', note: '色違い。' }),
  A({ id: 'sasame-chinu-hook', category: 'yaen', type: 'gear', brand: 'SASAME', name: 'カン付チヌ フック 徳用',
      query: 'ささめ針 カン付チヌ 徳用', asin: 'B003Z6B816', note: '活きアジを付ける針。' }),
  A({ id: 'landing-net-set', category: 'yaen', type: 'gear', brand: 'おり釣具', name: 'ランディングネット 3点セット BLUE LARCAL',
      query: 'BLUE LARCAL ランディングネット 3点セット', asin: 'B07PR8FQ65', note: '堤防の高さがあっても届く6mの玉の柄。' }),

  // ---------- アジング ----------
  A({ id: 'crostage-ajing', category: 'ajing', type: 'rod', brand: 'Major Craft', name: '3代目 クロステージ アジング CRX',
      query: 'メジャークラフト クロステージ アジング CRX', asin: 'B01L8PQ7YI', note: 'ジグ単アジングの入門〜中級ロッド。' }),
  A({ id: 'em-ms-2004h', category: 'ajing', type: 'reel', brand: 'DAIWA', name: '16 EM MS 2004H',
      query: 'ダイワ EM MS 2004H', asin: 'B0192ZQTPS', spec: '2000サイズ', note: 'アジング用の小型リール。' }),
  A({ id: 'ajimast', category: 'ajing', type: 'lure', brand: 'Ecogear', name: 'アジ職人 アジマスト',
      query: 'エコギア アジ職人 アジマスト', asin: 'B00IGJBS6M', note: '定番ワーム。' }),
  A({ id: 'ajimast-fat', category: 'ajing', type: 'lure', brand: 'Ecogear', name: 'アジ職人 アジマスト 1.8 ファット',
      query: 'エコギア アジマスト 1.8 ファット', asin: 'B0B24T76Q8', note: 'ファットタイプ。' }),
  A({ id: 'range-cross-head', category: 'ajing', type: 'lure', brand: '土肥富', name: 'レンジクロスヘッド 0.8g',
      query: '土肥富 レンジクロスヘッド 0.8g', asin: 'B00V1QS96O', note: 'ジグヘッド。' }),
  A({ id: 'ajing-master-fluoro', category: 'ajing', type: 'line', brand: 'VARIVAS', name: 'アジングマスター フロロ ブルームーン',
      query: 'バリバス アジングマスター フロロカーボン ブルームーン', asin: 'B08P2Y38N3', note: 'メインライン。' }),
  A({ id: 'small-game-leader', category: 'ajing', type: 'line', brand: 'SUNLINE', name: 'スモールゲームリーダー FC II',
      query: 'サンライン スモールゲームリーダー FC II', asin: 'B01M0QYX8C', note: 'リーダー。' }),
  A({ id: 'gekkabijin-leader', category: 'ajing', type: 'line', brand: 'DAIWA', name: '月下美人 フロロリーダー',
      query: 'ダイワ 月下美人 フロロリーダー', asin: 'B08FQSD945', note: 'リーダーの選択肢その2。' }),

  // ---------- アジの泳がせ ----------
  A({ id: 'liberty-club-nomase', category: 'nomase', type: 'rod', brand: 'DAIWA', name: 'リバティクラブ シーバス',
      query: 'ダイワ リバティクラブ シーバス', asin: 'B0073B25Z2', note: '泳がせにも同じロッド。' }),
  A({ id: 'nexave-nomase', category: 'nomase', type: 'reel', brand: 'SHIMANO', name: '21 ネクサーブ',
      query: 'シマノ ネクサーブ', asin: 'B09BFNJ3P7', note: 'リールもネクサーブ。' }),
  A({ id: 'tg-peacemaster-nomase', category: 'nomase', type: 'line', brand: 'DUEL', name: 'TG ピースマスター 磯 ビヨンド',
      query: 'デュエル TGピースマスター磯 ビヨンド', asin: 'B015NBD0FC', note: 'ナイロンライン。' }),
  A({ id: 'seabass-leader', category: 'nomase', type: 'line', brand: 'VARIVAS', name: 'ショックリーダー シーバス フロロ',
      query: 'バリバス ショックリーダー シーバス フロロカーボン', asin: 'B003PY32AI', note: 'リーダー。' }),
  A({ id: 'rolling-swivel', category: 'nomase', type: 'gear', brand: 'イシナダ釣工業', name: 'ローリングサルカン 徳用',
      query: 'イシナダ ローリングサルカン 徳用', asin: 'B06XW1JFVW', note: 'サルカン。' }),
  A({ id: 'sasame-chinu-hook-nomase', category: 'nomase', type: 'gear', brand: 'SASAME', name: 'カン付チヌ フック 徳用',
      query: 'ささめ針 カン付チヌ 徳用', asin: 'B003Z6B816', note: '針。' }),
  A({ id: 'nasu-omori', category: 'nomase', type: 'gear', brand: 'WakyaJig', name: 'ナスおもり 各種',
      query: 'ナスおもり', asin: 'B08LD2NW5T', note: 'オモリ。' }),
  A({ id: 'color-sinker', category: 'nomase', type: 'gear', brand: 'Fujiwara', name: 'カラーシンカー ナス',
      query: 'フジワラ カラーシンカー ナス', asin: 'B00IHSGQAA', note: '色付きオモリ。' }),
  A({ id: 'landing-net-nomase', category: 'nomase', type: 'gear', brand: 'おり釣具', name: 'ランディングネット 3点セット BLUE LARCAL',
      query: 'BLUE LARCAL ランディングネット 3点セット', asin: 'B07PR8FQ65', note: '大物用に。' }),

  // ---------- サビキ ----------
  A({ id: 'bakucho-sabiki', category: 'sabiki', type: 'lure', brand: 'Riseway', name: '爆釣サビキ 3枚組',
      query: 'ライズウェイ 爆釣サビキ 3枚組', asin: 'B072HXHNSK', note: 'サビキ仕掛け。' }),
  A({ id: 'plakago', category: 'sabiki', type: 'gear', brand: 'Riseway', name: '3P プラカゴ サビキ',
      query: 'ライズウェイ プラカゴ サビキ', asin: 'B07HFSYRNV', note: 'コマセカゴ。' }),
  A({ id: 'amihime', category: 'sabiki', type: 'gear', brand: 'MARUKYU', name: 'アミ姫 600g',
      query: 'マルキュー アミ姫 600g', asin: 'B0711KFYX7', note: '手が汚れないチューブ式のコマセ。' }),
  A({ id: 'amihime-kirara', category: 'sabiki', type: 'gear', brand: 'MARUKYU', name: 'アミ姫 キララ 600g',
      query: 'マルキュー アミ姫 キララ', asin: 'B07HF8869C', note: 'キラキラ入り。' }),
  A({ id: 'emeraldas-x-sabiki', category: 'sabiki', type: 'rod', brand: 'DAIWA', name: 'エメラルダス X',
      query: 'ダイワ エメラルダス X', asin: 'B07THWQNF4', note: 'サビキも同じロッドで。' }),
  A({ id: 'nexave-sabiki', category: 'sabiki', type: 'reel', brand: 'SHIMANO', name: '21 ネクサーブ',
      query: 'シマノ ネクサーブ', asin: 'B09BFNJ3P7', note: 'リール。' }),
  A({ id: 'saltiga-pe-sabiki', category: 'sabiki', type: 'line', brand: 'DAIWA', name: 'UVF ソルティガ デュラセンサー X8+Si2',
      query: 'ダイワ ソルティガ デュラセンサー X8', asin: 'B083WGLS9D', note: 'PEライン。' }),
  A({ id: 'clear-bucket', category: 'sabiki', type: 'gear', brand: 'DAIWA', name: '透明バケツ ポータブル活かし水くみ',
      query: 'ダイワ 透明バケツ 活かし水くみ', asin: 'B098VZ2X5L', note: '水汲みバケツ。' }),
  A({ id: 'bakkan-40', category: 'sabiki', type: 'gear', brand: '—', name: '活かし水汲みバッカン 40cm',
      query: '活かし水汲みバッカン 40cm 折りたたみ', asin: 'B0999C4HVK', note: '折りたたみ式のバッカン。' }),
  A({ id: 'fish-grip', category: 'sabiki', type: 'gear', brand: '—', name: 'フィッシュグリップ（カラビナ付き）',
      query: 'フィッシュグリップ カラビナ付き', asin: 'B087V116P2', note: '魚をつかむ。' }),
  A({ id: 'power-pump', category: 'sabiki', type: 'gear', brand: '冨士灯器', name: 'パワーポンプ FP',
      query: '冨士灯器 パワーポンプ', asin: 'B006LWBOXS', note: '活かしておくためのエアーポンプ。' }),

  // ---------- ショアジギング ----------
  A({ id: 'solpara-x-shorejig', category: 'jigging', type: 'rod', brand: 'Major Craft', name: '2代目 ソルパラ X ショアジギング',
      query: 'メジャークラフト ソルパラ X ショアジギング', asin: 'B07H2QG7QW', note: 'ショアジギング入門の定番ロッド。' }),
  A({ id: 'sahara-22', category: 'jigging', type: 'reel', brand: 'SHIMANO', name: '22 サハラ',
      query: 'シマノ 22 サハラ 4000', asin: 'B09R9L5WKF', note: '価格と信頼性のバランスがいいリール。' }),
  A({ id: 'jigpara-short', category: 'jigging', type: 'lure', brand: 'Major Craft', name: 'ジグパラ ショート 20〜60g',
      query: 'メジャークラフト ジグパラ ショート', asin: 'B012XX5AWY', note: '最初に揃えるメタルジグ。' }),
  A({ id: 'metal-adict-03', category: 'jigging', type: 'lure', brand: 'Little Jack', name: 'METAL ADICT-03',
      query: 'リトルジャック メタルアディクト 03', asin: 'B095H6X14T', note: 'メタルジグ。' }),
  A({ id: 'tg-binbin-switch', category: 'jigging', type: 'lure', brand: 'JACKALL', name: 'TG ビンビンスイッチ 80g',
      query: 'ジャッカル TG ビンビンスイッチ 80g', asin: 'B0C13JX748', note: 'タングステンのスイッチ系。' }),
  A({ id: 'beach-walker-howl', category: 'jigging', type: 'lure', brand: 'DUO', name: 'ビーチウォーカー ハウル 21g',
      query: 'DUO ビーチウォーカー ハウル 21g', asin: 'B079L8D2YH', note: 'ヒラメ・マゴチ狙いのワーム。' }),
  A({ id: 'beach-walker-howl-shad', category: 'jigging', type: 'lure', brand: 'DUO', name: 'ビーチウォーカー ハウルシャッド 4インチ',
      query: 'DUO ビーチウォーカー ハウルシャッド 4インチ', asin: 'B06X93JGSZ', note: '交換用のシャッド。' }),
  A({ id: 'pitbull-8', category: 'jigging', type: 'line', brand: 'SHIMANO', name: 'ピットブル 8本編み 200m',
      query: 'シマノ ピットブル8 200m', asin: 'B079M5QW6W', note: 'PEライン。' }),
  A({ id: 'seabass-leader-jig', category: 'jigging', type: 'line', brand: 'VARIVAS', name: 'ショックリーダー シーバス フロロ',
      query: 'バリバス ショックリーダー シーバス フロロカーボン', asin: 'B003PY32AI', note: 'リーダー。' }),
  A({ id: 'sp-snap', category: 'jigging', type: 'gear', brand: 'SMITH', name: 'SPスナップ',
      query: 'スミス SPスナップ', asin: 'B01FVCB0E6', note: 'スナップ。' }),
  A({ id: 'goriki-snap', category: 'jigging', type: 'gear', brand: 'OWNER', name: 'P-38 剛力スナップ',
      query: 'オーナー 剛力スナップ P-38', asin: 'B099YS651N', note: '強度のあるスナップ。' }),
  A({ id: 'umibozu-pliers', category: 'jigging', type: 'gear', brand: 'UMIBOZU', name: 'フィッシングプライヤー',
      query: 'ウミボウズ フィッシングプライヤー', asin: 'B08LH47T7X', note: '針外し・ラインカッター。' }),
  A({ id: 'landing-net-jig', category: 'jigging', type: 'gear', brand: 'おり釣具', name: 'ランディングネット 3点セット BLUE LARCAL',
      query: 'BLUE LARCAL ランディングネット 3点セット', asin: 'B07PR8FQ65', note: '青物を取り込む。' }),

  // ---------- 灯火フィッシング ----------
  A({ id: 'yn600l', category: 'light', type: 'gear', brand: 'YONGNUO', name: 'YN600L II LEDライト',
      query: 'YONGNUO YN600L II', asin: 'B013OU3HU2', note: '動画にも写っている、海面を照らす600球のLED。イカを寄せる主役。' }),
  A({ id: 'fotopro-tripod', category: 'light', type: 'gear', brand: 'Fotopro', name: '三脚 DIGI-204 120cm',
      query: 'Fotopro DIGI-204', asin: 'B00GD1JHZO', note: 'ライトを堤防に立てる三脚。' }),
  A({ id: 'solar-battery', category: 'light', type: 'gear', brand: 'CXYP', name: 'ソーラー モバイルバッテリー 26800mAh',
      query: 'ソーラーチャージャー モバイルバッテリー 26800mAh', asin: 'B08LYKGQWW', note: '一晩ライトを回す電源。' }),
  A({ id: 'zexus-zx-r730', category: 'light', type: 'gear', brand: '冨士灯器', name: 'ZEXUS ZX-R730 ヘッドライト',
      query: 'ZEXUS ZX-R730', asin: 'B083BK3GD4', note: '最大1200ルーメンの充電式ヘッドライト。夜の計量も手元も。' }),

  // ---------- 撮影 ----------
  // 本体はアクセサリより先（これが無いと他が意味をなさない）。
  // ★本体は「最新モデルを載せる」方針（2026-09-12 ダディ指示）。現行の最上位は HERO13 Black。
  //   新型が出たら name / query / spec / asin を差し替えること（HERO14 は2026年秋に出る見込み）。
  //   なお、サイトに載っている2022年の動画は HERO9 で撮影（元データの firmware HD9.01.01.72.00 で確認）。
  // 以下3点のASINはダディからもらったリンクから取得し、実際の商品ページの表記と一致を確認済み（2026-09-12）。
  // ★Amazonと楽天でセット内容が違う商品は、商品名を素の型番にしておく
  //   （名前にセット名を書くと、もう一方のリンクを踏んだ人に嘘になる）。
  //   HERO13 Black: Amazon=デュアル充電器＋バッテリー3個付き / 楽天=充電口付サイドドア＋2年保証
  A({ id: 'gopro-hero', category: 'camera', type: 'camera', brand: 'GoPro', name: 'HERO13 Black',
      query: 'GoPro HERO13 Black', asin: 'B0DCS3J96Q', spec: '5.3K60 / 10bit HDR / 防水10m',
      rakutenUrl: 'https://item.rakuten.co.jp/gopro/chdhx-131-fw-sd/',
      note: 'Vlogを撮っている本体。ケース無しで水深10mまで使えるので、雨も波しぶきも気にせず堤防に持ち出せる。リンク先はどちらも公式ストアの国内正規品。' }),
  A({ id: 'dji-mic-mini', category: 'camera', type: 'camera', brand: 'DJI', name: 'Mic Mini',
      query: 'DJI Mic Mini', asin: 'B0DDL8WGH5', spec: 'ワイヤレスマイク / 2TX + 1RX',
      rakutenUrl: 'https://item.rakuten.co.jp/dji-shop/6941565991454/',
      note: '超軽量のワイヤレスピンマイク。風のある堤防でも声がクリアに録れて、2人分まで同時に録れる。' }),
  A({ id: 'insta360-flow-2-pro', category: 'camera', type: 'camera', brand: 'Insta360', name: 'Flow 2 Pro クリエイターキット',
      query: 'Insta360 Flow 2 Pro', asin: 'B0DPL2R1TJ', spec: 'スマホ用ジンバル / 三脚・自撮り棒内蔵',
      // variantId はクリエイターキットを選んだ状態で開くために必要（外すと素のFlow 2 Proになる）
      rakutenUrl:
        'https://item.rakuten.co.jp/insta360-shop2/insta360-gimble-flow2pro/?variantId=flow2pro-w-creatkit',
      note: 'スマホ用のAIジンバル。歩きながらの移動シーンを滑らかに。自分を追いかけるトラッキングと内蔵三脚で、一人でも引きの画が撮れる。' }),
  A({ id: 'gopro-wind-cover', category: 'camera', type: 'camera', brand: 'Taisioner', name: 'GoPro 防風スポンジカバー',
      query: 'GoPro 防風カバー スポンジ', asin: 'B08LDBWH8G', note: '海風の風切り音を減らす。Vlogの音が聞き取りやすくなる。' }),
  A({ id: 'gopro-film', category: 'camera', type: 'camera', brand: 'ELECOM', name: 'GoPro 衝撃吸収フィルム',
      query: 'エレコム GoPro 衝撃吸収フィルム', asin: 'B097QJB99Q', note: 'レンズ・画面の保護。' }),
  A({ id: 'gopro-battery-kit', category: 'camera', type: 'camera', brand: 'Vemico', name: 'GoPro バッテリー充電器キット',
      query: 'GoPro バッテリー 充電器キット 1800mAh', asin: 'B08L4ZHG9N', note: '予備バッテリー3本。長い釣行でも撮り切れる。' }),
  A({ id: 'neck-mount', category: 'camera', type: 'camera', brand: 'ActyGo', name: 'ネックレス式マウント',
      query: 'ActyGo ネックレス式マウント GoPro', asin: 'B09SG1KZ3H', note: '両手を空けてPOVで撮るための首掛けマウント。' }),
  A({ id: 'pl-filter-52', category: 'camera', type: 'camera', brand: 'MARUMI', name: 'C-PL フィルター 52mm',
      query: 'マルミ C-PL 52mm', asin: 'B001AI1B9U', note: '海面の反射を抑えて、水の中を見せる。' }),
  A({ id: 'filter-adapter', category: 'camera', type: 'camera', brand: 'Kiowon', name: 'GoPro 52mm フィルターアダプター',
      query: 'GoPro 52mm フィルターアダプター', asin: 'B08N6DJRHR', note: 'PLフィルターをGoProに付けるためのアダプター。' }),
];

export const tackleByCategory = (id) => tackle.filter((t) => t.category === id);
export const ownedTackle = tackle.filter((t) => t.owned);

// HOMEで見せる「愛用」の代表（重複を除いた主役級）
// ロッド2・リール1・灯火2・撮影1 = 「エギング → 夜 → Vlog」の流れが読める6枚
export const featuredTackle = ['sephia-ss-s86ml-s', 'sephia-bb-c3000sdhhg', 'emeraldas-x', 'yn600l', 'zexus-zx-r730', 'neck-mount']
  .map((id) => tackle.find((t) => t.id === id))
  .filter(Boolean);

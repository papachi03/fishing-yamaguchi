// 山口イカ部のデータ（日英対訳）。小松氏の企画サイトの club-data.js を移植し、図鑑と写真を広げたもの。
// ブラウザのAPIに触らない（ビルド時の事前描画でも読むため）。
// 写真の出典は sources ページにそのまま出る。ライセンスと撮影者は書き換えないこと。

export const pair = (ja, en) => ({ ja, en });
// Google マップの検索リンク（公式の URL 形式。スマホでは Google マップのアプリが開き、そこからナビを始められる）
const gmap = (query) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

// 自分たちの写真（YFJ の釣果記録・Vlog から）。種名は YFJ の釣果記録（src/js/data/catches.js）と一致するものだけ使う
const OWN = {
  author: 'Childダディ / YAMAGUCHI FISHING JOURNAL',
  license: pair('撮影者の許可なく転載不可', 'All rights reserved'),
  licenseUrl: '',
  source: 'https://yamaguchifishing.com/log.html',
  own: true,
};

export const photos = [
  // ---- 自分たちの写真 ----
  {
    id: 'own-aori',
    file: '/assets/images/img_4069_1600.webp',
    thumb: '/assets/images/img_4069_800.webp',
    cat: 'catch',
    title: pair('1.6キロの、春の一杯。', 'A 1.6 kg spring squid.'),
    caption: pair('山口県内の堤防で釣ったアオリイカ（2023年5月）。釣り場は非公開。', 'Bigfin reef squid caught from a breakwater in Yamaguchi, May 2023. Location kept private.'),
    ...OWN,
  },
  {
    id: 'own-mongo',
    file: '/assets/images/img_4163_1600.webp',
    thumb: '/assets/images/img_4163_800.webp',
    cat: 'catch',
    title: pair('2キロ超えの、モンゴウイカ。', 'A cuttlefish over 2 kg.'),
    caption: pair('山口県内で釣ったモンゴウイカ（2023年5月）。はかりは2.18kg。', 'A large cuttlefish (mongō-ika) caught in Yamaguchi, May 2023. The scale reads 2.18 kg.'),
    ...OWN,
  },
  {
    id: 'own-kouika',
    file: '/assets/images/img_9781_1600.webp',
    thumb: '/assets/images/img_9781_800.webp',
    cat: 'catch',
    title: pair('春の堤防、コウイカ日和。', 'A spring day for cuttlefish.'),
    caption: pair('ある春の日のコウイカの釣果（2022年4月）。', 'A spring catch of golden cuttlefish, April 2022.'),
    ...OWN,
  },
  {
    id: 'own-yari',
    file: '/assets/images/img_9263_1600.webp',
    thumb: '/assets/images/img_9263_800.webp',
    cat: 'catch',
    title: pair('冬の夜、灯りの下で。', 'Winter nights under the lamp.'),
    caption: pair('冬の夜釣りのヤリイカ（2022年2月）。', 'Spear squid from a winter night session, February 2022.'),
    ...OWN,
  },
  {
    id: 'own-dawn',
    file: '/assets/posters/dawn_sea.jpg',
    thumb: '/assets/posters/dawn_sea.jpg',
    cat: 'sea',
    title: pair('朝マズメの、しずかな海。', 'A quiet sea at first light.'),
    caption: pair('釣行Vlogの一場面。山口の海の朝。', 'A still from one of our fishing vlogs: morning on the Yamaguchi coast.'),
    ...OWN,
  },
  {
    id: 'own-lantern',
    file: '/assets/posters/night_lantern.jpg',
    thumb: '/assets/posters/night_lantern.jpg',
    cat: 'sea',
    title: pair('灯りに、イカが寄ってくる。', 'The lamp that brings squid in.'),
    caption: pair('冬のヤリイカ釣りの灯り。釣行Vlogの一場面。', 'The lamp for winter spear-squid fishing, from one of our vlogs.'),
    ...OWN,
  },

  // ---- 公開ライセンスの写真（ウィキメディア・コモンズ）----
  {
    id: 'motonosumi',
    file: '/assets/ikabu/photos/motonosumi.webp',
    cat: 'sea',
    title: pair('海が刻んだ、元乃隅。', 'Motonosumi, shaped by the sea.'),
    caption: pair('山口県長門市・元乃隅神社近くの海岸。2023年10月撮影。', 'Coast near Motonosumi Shrine, Nagato, Yamaguchi. Photographed in October 2023.'),
    author: 'Zairon',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Nagato_Motonosumi-Inari-jinja_Coast_4.jpg',
  },
  {
    id: 'coast',
    file: '/assets/ikabu/photos/tsunoshima.webp',
    cat: 'sea',
    title: pair('この青に、また会いたい。', 'A blue worth coming back for.'),
    caption: pair('山口県下関市・角島の海辺。釣り許可場所の案内ではありません。', 'The coast of Tsunoshima, Shimonoseki, Yamaguchi. This image does not indicate fishing access.'),
    author: 'ウランボルグ',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Tunoshima_sea_side.JPG',
  },
  {
    id: 'beach',
    file: '/assets/ikabu/photos/beach.webp',
    cat: 'sea',
    title: pair('海を眺めるだけの日も。', 'Some days are just for the sea.'),
    caption: pair('山口県・角島コバルトブルービーチ。', 'Cobalt Blue Beach, Tsunoshima, Yamaguchi.'),
    author: 'Project Kei (Keita.Honda)',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Tsunoshima_Cobalt_Blue_Beach.jpg',
  },
  {
    id: 'reef',
    file: '/assets/ikabu/photos/reef-squid.webp',
    cat: 'life',
    title: pair('海の中で、目が合った。', 'A meeting beneath the surface.'),
    caption: pair('アオリイカ。東ティモールで撮影。山口の釣果写真ではありません。', 'Bigfin reef squid photographed in East Timor; not a Yamaguchi catch.'),
    author: 'Nick Hobgood',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Sepioteuthis_lessoniana_(Bigfin_reef_squid).jpg',
  },
  {
    id: 'shiriyake',
    file: '/assets/ikabu/photos/shiriyake.webp',
    cat: 'life',
    title: pair('おしりに、ひみつの腺。', 'A secret gland at the tail.'),
    caption: pair('シリヤケイカ。葛西臨海水族園の飼育展示個体。', 'Japanese spineless cuttlefish on display at Tokyo Sea Life Park.'),
    author: 'Totti',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Sepiella_japonica_Kasai_1.jpg',
  },
  {
    id: 'surume',
    file: '/assets/ikabu/photos/surume.webp',
    cat: 'life',
    title: pair('食卓でおなじみの、旅するイカ。', 'The familiar squid that travels.'),
    caption: pair('スルメイカ（北海道産）。', 'Japanese flying squid from Hokkaido.'),
    author: 'Almandine（白背景版：Chiswick Chap）',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Todarodes_pacificus_(white_background).jpg',
  },
  {
    id: 'sodeika',
    file: '/assets/ikabu/photos/sodeika.webp',
    cat: 'life',
    title: pair('ひし形の、大きな旅人。', 'A diamond-shaped wanderer.'),
    caption: pair('ソデイカ。ハワイ・カホオラウェ島の海岸で記録された個体。', 'Diamondback squid recorded on the shore of Kahoolawe, Hawaii.'),
    author: 'Forest and Kim Starr',
    license: 'CC BY 3.0 US',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/us/',
    source: 'https://commons.wikimedia.org/wiki/File:Starr-121220-1275-diamondback_squid_Thysanoteuthis_rhombus-Keanakeiki-Kahoolawe_(25105587671).jpg',
  },
  {
    id: 'firefly',
    file: '/assets/ikabu/photos/firefly.webp',
    cat: 'life',
    title: pair('小さな体、大きな不思議。', 'A small squid, a big mystery.'),
    caption: pair('ホタルイカ。富山で撮影された写真。', 'Firefly squid photographed in Toyama.'),
    author: 'kamataryo / iNaturalist',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Watasenia_scintillans_002.jpg',
  },
  {
    id: 'giant',
    file: '/assets/ikabu/photos/giant.webp',
    cat: 'life',
    title: pair('深海から来た、巨大な謎。', 'A giant mystery from the deep.'),
    caption: pair('ダイオウイカの標本。オークランド戦争記念博物館の記録。', 'A giant squid specimen, recorded by Auckland War Memorial Museum.'),
    author: 'Auckland War Memorial Museum',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Architeuthis_dux_68146399.jpg',
  },
  {
    id: 'humboldt',
    file: '/assets/ikabu/photos/humboldt.webp',
    cat: 'life',
    title: pair('水深250メートルの、赤いハンター。', 'A hunter at 250 meters.'),
    caption: pair('アメリカオオアカイカ。米国カリフォルニア州・コーデルバンク海洋保護区、水深約250mで撮影（2005年）。', 'Humboldt squid at about 250 m, Cordell Bank National Marine Sanctuary, California, 2005.'),
    author: 'Rick Starr / NOAA CBNMS',
    license: 'Public domain',
    licenseUrl: 'https://commons.wikimedia.org/wiki/Template:PD-USGov-NOAA',
    source: 'https://commons.wikimedia.org/wiki/File:Sanc1686_-_Flickr_-_NOAA_Photo_Library.jpg',
  },
  {
    id: 'market',
    file: '/assets/ikabu/photos/market.webp',
    cat: 'life',
    title: pair('砂に、化けてみる。', 'Blending into the sand.'),
    caption: pair('カリフォルニアヤリイカ。体色を変えて砂地に溶けこむ。', 'Market squid changing its colors to blend into the sand.'),
    author: 'Minette from Seattle, Washington',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Loligo_opalescens_-_Mimicking_sand.jpg',
  },
  {
    id: 'grilled',
    file: '/assets/ikabu/photos/grilled.webp',
    cat: 'food',
    title: pair('香ばしさまで、ごちそう。', 'Good things come off the grill.'),
    caption: pair('イカ焼きの調理例。山口の店や当サイトのレシピの完成写真ではありません。', 'Grilled squid: a serving example, not a photo of our recipe or a Yamaguchi restaurant.'),
    author: 'Ocdp',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Grilled_squid_001.jpg',
  },
  {
    id: 'miso',
    file: '/assets/ikabu/photos/miso.webp',
    cat: 'food',
    title: pair('小さな一皿に、春の味。', 'A taste of spring on a small plate.'),
    caption: pair('ゆでたホタルイカの辛子酢味噌和え。調理例。', 'Boiled firefly squid with mustard-vinegar miso; a serving example.'),
    author: 'Lombroso',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    source: 'https://commons.wikimedia.org/wiki/File:Boiled_firefly_squids,_with_vinegared_miso.jpg',
  },
  {
    id: 'toyama',
    file: '/assets/ikabu/photos/toyama-dishes.webp',
    cat: 'food',
    title: pair('イカの食文化を、旅する。', 'Travel through squid food culture.'),
    caption: pair('富山で撮影されたホタルイカ料理。醤油漬け・干物・塩辛など。', 'Firefly squid dishes photographed in Toyama, including marinated, dried and fermented preparations.'),
    author: 'Araisyohei / ARAI Syohei',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    source: 'https://commons.wikimedia.org/wiki/File:W._scintillans_in_Toyama_2019-12-09_(1)_sa.jpg',
  },
];

export const photoById = (id) => photos.find((p) => p.id === id) ?? null;

// 写真部の絞り込み
export const photoCats = [
  ['all', pair('すべて', 'All')],
  ['catch', pair('部員の釣果', 'Our catches')],
  ['sea', pair('山口の海', 'Yamaguchi coast')],
  ['life', pair('イカの姿', 'Squid life')],
  ['food', pair('食卓', 'At the table')],
];

// 山口マップ。pos はエリアの目安で、釣り場の許可を示すものではない。
// seaArea は「風と波」（YFJ の src/js/data/areas.js の id）への橋渡し
export const spots = [
  {
    id: 'hagi',
    type: 'boat',
    pos: [34.425, 131.391],
    seaArea: 'hagi',
    name: pair('萩・玉江エリア', 'Hagi / Tamae area'),
    tag: pair('船で、ケンサキイカへ', 'Boat-based squid trips'),
    desc: pair(
      'イカメタルやティップランを案内する遊漁船の公開情報から、釣行を計画。ポイントは船長に相談しよう。',
      'Plan a guided squid trip using operators’ published information. Ask the skipper about actual fishing grounds.'
    ),
    notes: pair(
      'ピンはエリアの目安。集合場所・道具・対象種・空き状況は各船へ確認。',
      'Approximate area pin. Confirm meeting point, tackle, species and availability with the operator.'
    ),
    links: [
      ['康新丸 / Koshinmaru', 'https://www.daini-kouwamaru.com/'],
      ['遊漁船 D’s / D’s', 'https://www.yugyosends.com/'],
    ],
  },
  {
    id: 'ogushi',
    type: 'boat',
    pos: [34.232, 130.923],
    seaArea: 'shimonoseki',
    name: pair('下関・小串エリア', 'Ogushi, Shimonoseki'),
    tag: pair('冬と夏で、違うイカ時間', 'Different squid seasons'),
    desc: pair(
      '小串の遊漁船「海宝」は、ヤリイカメタルやケンサキイカの釣行を案内。季節に合う便を公式案内で探せます。',
      'Kaiho publishes seasonal squid-trip information from Ogushi. Check its guide for the appropriate season and trip.'
    ),
    notes: pair(
      '出船・集合位置は予約時に確認。ここは堤防釣りの許可を示すピンではありません。',
      'Confirm departure details when booking. The pin does not grant shore-fishing permission.'
    ),
    links: [['海宝 / Kaiho', 'https://kaiho-shimonoseki.com/guide.html']],
  },
  {
    id: 'nagato',
    type: 'boat',
    pos: [34.385, 131.045],
    seaArea: 'nagato',
    name: pair('長門・角島方面', 'Nagato / Tsunoshima waters'),
    tag: pair('船の案内から、海を選ぶ', 'Explore with a local skipper'),
    desc: pair(
      '長門・角島・下関方面を案内する「咲丸」のイカ釣り情報をチェック。実際の行き先は天候や魚の状況で変わります。',
      'Sakimaru publishes squid-fishing information for Nagato, Tsunoshima and Shimonoseki waters. Actual grounds depend on the trip and conditions.'
    ),
    notes: pair(
      '海域の紹介です。出航場所は公式のアクセス案内で確認。',
      'An operating-area overview. Use the official access page for the meeting point.'
    ),
    links: [
      ['咲丸 / Sakimaru', 'https://www.sakimaru-yamaguchi.com/'],
      ['出航案内 / Access', 'https://www.sakimaru-yamaguchi.com/access/'],
    ],
  },
  {
    id: 'susa',
    type: 'food',
    pos: [34.623, 131.604],
    seaArea: 'hagi',
    name: pair('萩・須佐', 'Susa, Hagi'),
    tag: pair('須佐男命いかの町', 'A town with a squid story'),
    desc: pair(
      '「須佐男命いか」は、須佐で水揚げされる活ケンサキイカの地域ブランド。食事や直売情報は公式観光案内へ。',
      'Susa Mikoto Ika is a local brand of live swordtip squid landed in Susa. Explore food and market information through the official tourism guide.'
    ),
    notes: pair(
      '食文化の立ち寄り先。営業日・入荷は当日確認。釣り場の案内ではありません。',
      'A food-culture stop, not a fishing-access pin. Confirm opening days and availability.'
    ),
    links: [
      ['公式観光ガイド / Tourism guide', 'https://yamaguchi-tourism.jp/blog/detail_434.html'],
      ['いかマルシェ（スサノモノミトコ館）・地図 / Ika Marche (map)', gmap('いかマルシェ スサノモノミトコ館 山口県萩市須佐429-4')],
      ['ジョイフルセンター須佐・地図 / Joyful Center Susa (map)', gmap('ジョイフルセンター須佐 山口県萩市大字須佐7248-10')],
    ],
  },
  {
    id: 'kottoi',
    type: 'food',
    pos: [34.332, 130.898],
    seaArea: 'shimonoseki',
    name: pair('下関・特牛', 'Kottoi, Shimonoseki'),
    tag: pair('北浦のイカ文化', 'Squid culture on the Kitaura coast'),
    desc: pair(
      '「下関北浦特牛イカ」の背景を知って、旅の食卓へ。市の紹介ページから産地の物語をたどれます。',
      'Discover the story of Shimonoseki Kitaura Kottoi Ika through the city’s official introduction.'
    ),
    notes: pair(
      '産地を示すエリアピン。漁港内への自由な立ち入り・釣りを案内するものではありません。',
      'Regional pin only. It does not indicate unrestricted harbor access or fishing permission.'
    ),
    links: [['下関市の紹介 / City guide', 'https://www.city.shimonoseki.lg.jp/soshiki/60/1174.html']],
  },
  // ここから下：イカが看板のお店があるエリア（ぱっぱ 2026-09-28、案A＝エリアのピンの中にお店を並べる）。
  // お店のリンクは Google マップの検索（押すとアプリが開き、そこからナビ）。住所は 2026-09-28 に Google マップで確認
  {
    id: 'hagi-town',
    type: 'food',
    pos: [34.416, 131.402],
    seaArea: 'hagi',
    name: pair('萩の町なか', 'Central Hagi'),
    tag: pair('活イカを、城下町で', 'Live squid in the castle town'),
    desc: pair(
      '萩の町なかで、活イカの料理を出すお店。釣りの帰りや観光のついでに。',
      'A restaurant in central Hagi known for live squid dishes, handy after fishing or sightseeing.'
    ),
    notes: pair(
      '活イカは海の状態で入荷しない日があります。営業日・入荷はお店へ確認を。',
      'Live squid depends on the sea, so some days it is unavailable. Check opening days and stock with the restaurant.'
    ),
    links: [['萩心海・地図 / Hagi Shinkai (map)', gmap('萩心海 山口県萩市土原370-71')]],
  },
  {
    id: 'misumi',
    type: 'food',
    pos: [34.391, 131.278],
    seaArea: 'nagato',
    name: pair('長門・三隅', 'Misumi, Nagato'),
    tag: pair('イカ丼とゲソ天', 'Squid bowls and fried tentacles'),
    desc: pair(
      '萩と長門のあいだ、三隅の和食のお店。イカ丼が人気で、ゲソは天ぷらにしてくれると評判。',
      'A Japanese restaurant in Misumi, between Hagi and Nagato, popular for its squid rice bowl.'
    ),
    notes: pair(
      '昼と夜で営業時間が分かれています。営業日・入荷はお店へ確認を。',
      'Lunch and dinner hours are separate. Check opening days and stock with the restaurant.'
    ),
    links: [['旬処 いさ路・地図 / Isaji (map)', gmap('旬処 いさ路 山口県長門市三隅下1860-1')]],
  },
  {
    id: 'yuda',
    type: 'food',
    pos: [34.163, 131.455],
    seaArea: 'hofu',
    name: pair('山口市・湯田温泉', 'Yuda Onsen, Yamaguchi City'),
    tag: pair('海から離れて、泳ぐイカ', 'Swimming squid, inland'),
    desc: pair(
      '温泉街で、生けすの「泳ぎ活きイカ」を出すお店。海まで行けない日の、イカの入口に。',
      'A restaurant in the hot-spring town serving live squid from its tank—an easy way in when you cannot reach the coast.'
    ),
    notes: pair(
      '湯田温泉は海から離れたエリアです（風と波のリンクは近くの防府の海）。営業日・入荷はお店へ確認を。',
      'Yuda Onsen is inland (the wind & waves link shows the nearby Hofu coast). Check opening days and stock with the restaurant.'
    ),
    links: [['泳ぎ活きイカ らいが・地図 / Raiga (map)', gmap('長州鶏焼鳥・泳ぎ活きイカ・手作り餃子 らいが 山口県山口市湯田温泉3丁目1-21')]],
  },
  {
    id: 'hofu-town',
    type: 'food',
    pos: [34.052, 131.566],
    seaArea: 'hofu',
    name: pair('防府', 'Hofu'),
    tag: pair('瀬戸内側のイカ料理', 'Squid on the Seto Inland Sea side'),
    desc: pair(
      '防府駅のそばの、イカ料理が看板の和食のお店。瀬戸内側でイカを味わうなら。',
      'A Japanese restaurant near Hofu Station with squid as its specialty, on the Seto Inland Sea side.'
    ),
    notes: pair(
      'しけの日は活イカが無いこともあります。営業日・入荷はお店へ確認を。',
      'Live squid may be unavailable after rough seas. Check opening days and stock with the restaurant.'
    ),
    links: [['いか鮮 本家・地図 / Ikasen Honke (map)', gmap('いか鮮 本家 山口県防府市栄町1丁目5-1 ルルサス防府')]],
  },
];

export const mapFilters = [
  ['all', pair('すべて', 'All')],
  ['boat', pair('船釣りの案内', 'Boat fishing')],
  ['food', pair('イカを味わう', 'Food culture')],
];

export const recipes = [
  {
    id: 'butter',
    name: pair('イカとブロッコリーのバター醤油', 'Squid & broccoli with soy butter'),
    time: 15,
    kind: pair('炒める', 'Sauté'),
    intro: pair('香ばしい醤油とバター。胴もゲソも、野菜と一緒に一皿へ。', 'A quick skillet of squid and broccoli with fragrant soy butter.'),
    ingredients: [
      [pair('下処理済みのイカ', 'Cleaned squid'), 250, 'g'],
      [pair('ブロッコリー', 'Broccoli'), 150, 'g'],
      [pair('バター', 'Butter'), 15, 'g'],
      [pair('醤油', 'Soy sauce'), 10, 'ml'],
      [pair('水', 'Water'), 30, 'ml'],
    ],
    steps: [
      pair('イカは胴を1cm幅、足を食べやすい長さに切り、水分をふく。ブロッコリーは小房に分ける。', 'Slice the mantle into 1cm rings and cut the arms into bite-size pieces. Pat dry. Divide the broccoli into florets.'),
      pair('フライパンにブロッコリーと水を入れ、ふたをして中火で3〜4分蒸す。水分が多ければ飛ばす。', 'Steam broccoli with the water in a covered skillet over medium heat for 3–4 minutes. Let excess water evaporate.'),
      pair('バターとイカを加えて炒める。イカの中心まで十分に加熱してから醤油を回し入れる。', 'Add butter and squid and sauté. Cook the squid thoroughly through its center, then add the soy sauce.'),
      pair('全体に絡めて盛る。好みでレモンを添える。', 'Toss to coat, plate and add lemon if you like.'),
    ],
    tip: pair('イカの厚さで加熱時間は変わります。時計だけで火通りを判断しないで。', 'Cooking time depends on thickness; time alone is not a doneness check.'),
  },
  {
    id: 'daikon',
    name: pair('イカと大根の生姜煮', 'Ginger-simmered squid & daikon'),
    time: 35,
    kind: pair('煮る', 'Simmer'),
    intro: pair('大根に煮汁を含ませて。ごはんに合う、ほっとする味。', 'Tender daikon in a ginger-soy broth, made for a bowl of rice.'),
    ingredients: [
      [pair('下処理済みのイカ', 'Cleaned squid'), 250, 'g'],
      [pair('大根', 'Daikon radish'), 300, 'g'],
      [pair('生姜', 'Fresh ginger'), 10, 'g'],
      [pair('水', 'Water'), 300, 'ml'],
      [pair('醤油', 'Soy sauce'), 25, 'ml'],
      [pair('みりん', 'Mirin'), 25, 'ml'],
      [pair('砂糖', 'Sugar'), 8, 'g'],
    ],
    steps: [
      pair('大根は皮をむいて1.5cm厚の半月切り、生姜は薄切り。イカは食べやすく切る。', 'Peel daikon and cut into 1.5cm half-moons. Thinly slice ginger and cut squid into bite-size pieces.'),
      pair('鍋に大根と水を入れ、ふたを少しずらして15〜20分、串が通るまで煮る。水が減ったら足す。', 'Simmer daikon in the water, partly covered, for 15–20 minutes until easily pierced. Add water if needed.'),
      pair('生姜、醤油、みりん、砂糖、イカを加える。煮立ったら弱めの中火にし、イカの中心まで十分に加熱する。', 'Add ginger, soy, mirin, sugar and squid. Bring to a simmer and cook thoroughly over medium-low heat.'),
      pair('火を止めて5分ほど置き、味をなじませる。', 'Turn off the heat and rest for about 5 minutes to let the flavors settle.'),
    ],
    tip: pair('大根を先にやわらかくすると、イカだけを長く煮続けずに仕上げられます。', 'Soften the daikon first so you do not need to simmer the squid for the entire cooking time.'),
  },
  {
    id: 'pasta',
    name: pair('イカのガーリックトマトパスタ', 'Garlic & tomato squid pasta'),
    time: 25,
    kind: pair('洋風', 'Pasta'),
    intro: pair('冷凍イカでも作れる、休日の一皿。トマトの酸味に海のうまみを。', 'A weekend pasta that works with properly thawed frozen squid, too.'),
    ingredients: [
      [pair('下処理済みのイカ', 'Cleaned squid'), 200, 'g'],
      [pair('乾燥パスタ', 'Dried pasta'), 180, 'g'],
      [pair('カットトマト缶', 'Canned chopped tomatoes'), 300, 'g'],
      [pair('にんにく', 'Garlic'), 8, 'g'],
      [pair('オリーブ油', 'Olive oil'), 20, 'ml'],
      [pair('塩', 'Salt'), 2, 'g'],
    ],
    steps: [
      pair('イカは食べやすく切り、にんにくを刻む。パスタは袋の表示に合わせてゆで始める。', 'Cut squid into bite-size pieces and chop garlic. Cook pasta according to its packet.'),
      pair('フライパンに油とにんにくを入れ弱火で温める。香りが出たらトマトを加え、約8分煮る。', 'Gently warm garlic in olive oil. Add tomatoes and simmer for about 8 minutes.'),
      pair('イカを加え、中心まで十分に火を通す。塩で味を調える。', 'Add squid and cook thoroughly to the center. Season with salt.'),
      pair('パスタを加えて絡める。必要ならパスタのゆで汁を少し足す。', 'Toss in the drained pasta. Loosen with a little pasta water if needed.'),
    ],
    tip: pair('冷凍品は冷蔵庫で解凍し、水分をふいてから使います。', 'Thaw frozen squid in the refrigerator and pat dry before cooking.'),
  },
  {
    id: 'miso',
    name: pair('ゆでホタルイカの酢味噌和え', 'Boiled firefly squid with vinegar miso'),
    time: 10,
    kind: pair('和える', 'Dress'),
    intro: pair('加熱済みのホタルイカで作る、小さなおつまみ。', 'A small savory plate made with ready-cooked firefly squid.'),
    ingredients: [
      [pair('市販の加熱済みホタルイカ', 'Store-bought fully cooked firefly squid'), 120, 'g'],
      [pair('きゅうり', 'Cucumber'), 100, 'g'],
      [pair('味噌', 'Miso'), 25, 'g'],
      [pair('米酢', 'Rice vinegar'), 15, 'ml'],
      [pair('砂糖', 'Sugar'), 8, 'g'],
    ],
    steps: [
      pair('必ず加熱済みの商品を使い、表示に従って扱う。目や口が気になる場合は取り除く。', 'Use a fully cooked product and follow its package instructions. Remove eyes and beaks if preferred.'),
      pair('きゅうりを薄切りにし、水分を軽くふく。', 'Thinly slice the cucumber and pat off excess moisture.'),
      pair('味噌、米酢、砂糖を混ぜて酢味噌を作る。', 'Mix miso, rice vinegar and sugar into a smooth dressing.'),
      pair('食べる直前に和える。好みで練り辛子を少量加える。', 'Dress just before serving. Add a little prepared mustard if you like.'),
    ],
    tip: pair('酢味噌で生のイカを安全にできるわけではありません。加熱済みを使います。', 'Vinegar dressing does not make raw squid safe. Use fully cooked squid.'),
  },
];

export const foodSafety = {
  label: pair('調理前に', 'Before cooking'),
  text: pair(
    'イカは冷蔵で管理し、加熱料理は中心まで十分に火を通します。酢・塩・わさびでアニサキス対策はできません。',
    'Keep squid refrigerated and cook it thoroughly. Vinegar, salt and wasabi do not eliminate Anisakis parasites.'
  ),
  link: [pair('厚生労働省の案内', 'Official food-safety guidance'), 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000042953.html'],
};

// 世界のイカ図鑑。group で「山口で会える → 日本の海 → 世界の海」の順に並べる。
// season / how は山口の釣りの目安（年や場所で変わる）。photo が null の種は「部員の写真募集中」として出す。
export const speciesGroups = [
  ['yamaguchi', pair('山口で会えるイカ', 'Squid you can meet in Yamaguchi')],
  ['japan', pair('日本の海のイカ', 'Squid of Japanese waters')],
  ['world', pair('世界の海のイカ', 'Squid of the wider ocean')],
];

export const habitats = [
  ['all', pair('すべて', 'All')],
  ['coast', pair('沿岸', 'Coastal')],
  ['ocean', pair('外洋・回遊', 'Open ocean')],
  ['deep', pair('深い海', 'Deep sea')],
];

export const species = [
  {
    id: 'aori',
    group: 'yamaguchi',
    habitat: 'coast',
    name: pair('アオリイカ', 'Bigfin reef squid'),
    latin: 'Sepioteuthis lessoniana',
    photo: 'own-aori',
    season: pair('春（大型・産卵期）／秋（新子）', 'Spring (large, spawning) / autumn (young of the year)'),
    how: pair('エギング（堤防・磯）', 'Egi lure fishing from breakwaters and rocks'),
    hook: pair('エギングの主役。', 'The star of egi fishing.'),
    desc: pair(
      '胴のふちに沿って広がる大きなヒレが目印。春は産卵のために浅場へ寄り、秋はその年に生まれた「新子」が釣れる。日本のアオリイカは複数の型に分かれることが分かってきており、写真だけで細かな分類は決めつけない。',
      'Broad fins run the full length of the mantle. In spring, large adults move into the shallows to spawn; in autumn, the young of the year arrive. Japanese reef squid include several distinct forms, so precise identification from a photo is not reliable.'
    ),
    source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/bigfin-reef-squid',
  },
  {
    id: 'kensaki',
    group: 'yamaguchi',
    habitat: 'coast',
    name: pair('ケンサキイカ', 'Swordtip squid'),
    latin: 'Uroteuthis edulis',
    photo: null,
    season: pair('初夏〜秋（夜の船釣りが中心）', 'Early summer to autumn, mostly night boat trips'),
    how: pair('イカメタル・オモリグ（船）', 'Metal jigs and sinker rigs from a boat'),
    hook: pair('須佐男命いかの、正体。', 'The squid behind Susa Mikoto Ika.'),
    desc: pair(
      '胴が細長く、先が剣先のようにとがる。萩・須佐で水揚げされる活ケンサキイカは「須佐男命いか」という地域ブランドになっている。夏の夜、灯りをつけた船からのイカメタルで人気の釣りもの。',
      'A slender squid with a sharply pointed tail. Live swordtip squid landed at Susa in Hagi are sold under the regional brand Susa Mikoto Ika. On summer nights, metal-jig fishing from lit boats is hugely popular.'
    ),
    source: 'https://yamaguchi-tourism.jp/blog/detail_434.html',
  },
  {
    id: 'yari',
    group: 'yamaguchi',
    habitat: 'coast',
    name: pair('ヤリイカ', 'Spear squid'),
    latin: 'Heterololigo bleekeri',
    photo: 'own-yari',
    season: pair('冬〜春（夜）', 'Winter to spring, at night'),
    how: pair('灯りを使った夜釣り（堤防）・船', 'Night fishing with lamps from breakwaters, or by boat'),
    hook: pair('冬の夜、灯りに寄ってくる。', 'Drawn to the lamp on winter nights.'),
    desc: pair(
      '槍の穂先のように細くとがった胴。触腕（長い2本の腕）が短めなのも特徴。冬の夜、堤防の灯りの下に群れで寄ってくることがあり、イカ部のVlogでもおなじみ。',
      'A slim squid shaped like a spearhead, with relatively short feeding tentacles. On winter nights schools may gather under lamps along the breakwater — a regular in our fishing vlogs.'
    ),
    source: 'https://ja.wikipedia.org/wiki/ヤリイカ',
  },
  {
    id: 'kouika',
    group: 'yamaguchi',
    habitat: 'coast',
    name: pair('コウイカ', 'Golden cuttlefish'),
    latin: 'Sepia esculenta',
    photo: 'own-kouika',
    season: pair('春（産卵で浅場へ）', 'Spring, when they move inshore to spawn'),
    how: pair('エギング・餌巻きテーラ（堤防）', 'Egi lures or baited jigs from breakwaters'),
    hook: pair('背中に、白い舟を持っている。', 'It carries a little white boat on its back.'),
    desc: pair(
      '体の中に石灰質の「甲」（舟の形をした硬い骨のようなもの）を持つので、この名前。墨をたっぷり吐くので、釣り上げるときは要注意。',
      'Named for the chalky internal shell, the cuttlebone, shaped like a little boat. It squirts plenty of ink, so land it carefully.'
    ),
    source: 'https://ja.wikipedia.org/wiki/コウイカ',
  },
  {
    id: 'mongo',
    group: 'yamaguchi',
    habitat: 'coast',
    name: pair('モンゴウイカ（カミナリイカ）', 'Kisslip cuttlefish (mongō-ika)'),
    latin: 'Sepia lycidas',
    photo: 'own-mongo',
    season: pair('春〜初夏', 'Spring to early summer'),
    how: pair('エギング（堤防）', 'Egi lures from breakwaters'),
    hook: pair('2キロ超えもある、大物のコウイカ。', 'A cuttlefish that can top 2 kg.'),
    desc: pair(
      'コウイカの仲間の大型種。茶色い胴の背中いっぱいに、コーヒー豆のような形の模様が散らばるのが見分けの決め手。お店で「モンゴウイカ」と呼ばれるイカには、この種のほか輸入の別種も含まれる。',
      'A large member of the cuttlefish family. The giveaway is the coffee-bean-shaped marks scattered across its brown back. In Japanese markets the name mongō-ika is also used for other, imported cuttlefish species.'
    ),
    source: 'https://ja.wikipedia.org/wiki/カミナリイカ',
  },
  {
    id: 'shiriyake',
    group: 'yamaguchi',
    habitat: 'coast',
    name: pair('シリヤケイカ', 'Japanese spineless cuttlefish'),
    latin: 'Sepiella japonica',
    photo: 'shiriyake',
    season: pair('春', 'Spring'),
    how: pair('エギング（堤防）', 'Egi lures from breakwaters'),
    hook: pair('おしりが、焼けている？', 'Why the “burnt bottom”?'),
    desc: pair(
      '胴の後ろの端にある腺から赤茶色の液を出し、おしりが焼けたように見えるのが名前の由来。コウイカの仲間だが、甲の先にとげが無い。',
      'A gland at the rear of the mantle releases a reddish-brown fluid, making the tail look scorched — hence its Japanese name, “burnt-bottom squid.” Unlike its relatives, its cuttlebone has no spine at the tip.'
    ),
    source: 'https://ja.wikipedia.org/wiki/シリヤケイカ',
  },
  {
    id: 'hiika',
    group: 'yamaguchi',
    habitat: 'coast',
    name: pair('ヒイカ（ジンドウイカ）', 'Japanese squid (hi-ika)'),
    latin: 'Loliolus japonica',
    photo: null,
    season: pair('秋〜冬（夜の港）', 'Autumn to winter, in harbors at night'),
    how: pair('小さなエギ・ライトゲーム', 'Tiny egi lures and light tackle'),
    hook: pair('手のひらサイズの、冬の相棒。', 'A palm-sized winter companion.'),
    desc: pair(
      '胴の長さ10cmほどの小さなイカ。寒い時期の夜、港の常夜灯のまわりで小さなエギを使って狙う。釣れる数が多く、はじめてのイカ釣りにも。',
      'A small squid with a mantle of about 10 cm. On cold nights it gathers around harbor lights, where tiny egi lures do the trick. Often caught in good numbers — a friendly first squid.'
    ),
    source: 'https://ja.wikipedia.org/wiki/ジンドウイカ',
  },
  {
    id: 'surume',
    group: 'japan',
    habitat: 'ocean',
    name: pair('スルメイカ', 'Japanese flying squid'),
    latin: 'Todarodes pacificus',
    photo: 'surume',
    season: null,
    how: null,
    hook: pair('食卓の向こうに、回遊の旅。', 'A traveler beyond the dinner plate.'),
    desc: pair(
      '日本のまわりを大きく回遊し、いか釣り漁などで水揚げされるイカ。資源の調査も続けられている。料理の名前から、生きものとしての姿にも目を向けてみよう。',
      'A migratory squid harvested in waters around Japan and studied through fisheries surveys. Look beyond its familiar culinary role to its life at sea.'
    ),
    source: 'https://www.fra.go.jp/jamarc/archive/jyoho/hakusei/surumeika/surumeika.htm',
  },
  {
    id: 'hotaru',
    group: 'japan',
    habitat: 'deep',
    name: pair('ホタルイカ', 'Firefly squid'),
    latin: 'Watasenia scintillans',
    photo: 'firefly',
    season: null,
    how: null,
    hook: pair('小さな体に、青白い光。', 'A small body with its own light.'),
    desc: pair(
      '発光器を持つ小型のイカ。ふだんは深い海に暮らし、富山では発光や生態を伝える展示も行われている。',
      'A small squid with light-producing organs. It normally lives in deeper water; Toyama is known for exhibitions about its light and biology.'
    ),
    source: 'https://hotaruikamuseum.com/museum/hotaruika',
  },
  {
    id: 'sodeika',
    group: 'japan',
    habitat: 'ocean',
    name: pair('ソデイカ', 'Diamondback squid'),
    latin: 'Thysanoteuthis rhombus',
    photo: 'sodeika',
    season: null,
    how: null,
    hook: pair('ひし形のヒレで、大海原を旅する。', 'Diamond fins built for the open ocean.'),
    desc: pair(
      '胴の全長にわたる大きなひし形のヒレを持つ大型のイカ。暖かい外洋を回遊し、日本海側では「タルイカ」、沖縄では「セーイカ」とも呼ばれる。',
      'A large squid with a diamond-shaped fin running the length of its body. It roams warm open seas, and is known in Japan as taru-ika along the Sea of Japan and sē-ika in Okinawa.'
    ),
    source: 'https://ja.wikipedia.org/wiki/ソデイカ',
  },
  {
    id: 'giant',
    group: 'world',
    habitat: 'deep',
    name: pair('ダイオウイカ', 'Giant squid'),
    latin: 'Architeuthis dux',
    photo: 'giant',
    season: null,
    how: null,
    hook: pair('海の大きな謎を、追いかける。', 'Follow one of the ocean’s great mysteries.'),
    desc: pair(
      '長い触腕を持つ巨大なイカ。日本海沿岸でも定置網や漂着で見つかることがある。深海での暮らしにはまだ分からないことが多く、標本や観察記録が研究を支えている。',
      'An enormous squid with long feeding tentacles. It is occasionally found in set nets or washed ashore along Japan’s Sea of Japan coast. Much about its deep-sea life remains unknown; specimens and observations help researchers learn more.'
    ),
    source: 'https://naturalhistory.si.edu/explore/giant-squid',
  },
  {
    id: 'humboldt',
    group: 'world',
    habitat: 'ocean',
    name: pair('アメリカオオアカイカ', 'Humboldt squid'),
    latin: 'Dosidicus gigas',
    photo: 'humboldt',
    season: null,
    how: null,
    hook: pair('色の変化は、会話かも。', 'Color patterns may carry a message.'),
    desc: pair(
      '東太平洋の活動的な捕食者。体表の明暗や模様の変化を使ったコミュニケーションが研究されている。',
      'An active predator of the Eastern Pacific whose changing light-and-dark body patterns are being studied as a means of communication.'
    ),
    source: 'https://www.mbari.org/news/deciphering-the-visual-language-of-humboldt-squid/',
  },
  {
    id: 'market',
    group: 'world',
    habitat: 'coast',
    name: pair('カリフォルニアヤリイカ', 'Market squid'),
    latin: 'Doryteuthis opalescens',
    photo: 'market',
    season: null,
    how: null,
    hook: pair('海を動かす、小さな群れ。', 'Small squid, remarkable gatherings.'),
    desc: pair(
      '北米西岸の沿岸のイカ。モントレー湾では春と秋に産卵のための大きな群れが見られ、海の食物網や漁業とも深く関わっている。',
      'A coastal squid of North America’s west coast. Large spawning schools enter Monterey Bay in spring and fall, linking it to both the marine food web and local fisheries.'
    ),
    source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/common-market-squid',
  },
];

// スタンプとSNS のダジャレ解説（海外の人にも仕組みが伝わるように）
export const puns = [
  { jp: 'いかが？', en: 'How about it?', note: pair('「イカ」と「いかが（どう？）」をかけた、あいさつの定番。', 'Ika means squid. Ikaga means “how about…?”') },
  { jp: 'すみません。', en: 'Ink-scuse me.', note: pair('「墨（すみ）」と「すみません」。イカらしいおわび。', 'Sumi means ink; sumimasen means “excuse me” or “sorry.”') },
  { jp: 'イカんぱい！', en: 'Cheers, squid style.', note: pair('「イカ」と「かんぱい」。部の打ち上げの合言葉。', 'A playful mash-up of ika and kanpai, the Japanese toast.') },
  { jp: 'いからないで！', en: 'Don’t get angry!', note: pair('「怒（いか）らないで」にイカが隠れている。', '“Ika-ranaide!” means “don’t get angry,” with ika hidden inside.') },
  { jp: 'まぁ、いっか。', en: 'Oh well.', note: pair('釣れなかった日の、イカ部の合言葉。', 'Our motto for the days nothing bites.') },
  { jp: '防府く絶倒！', en: 'Hōfu-ku zettō!', note: pair('山口の「防府」と「抱腹絶倒」。ご当地ダジャレの第2弾から。', 'Folds the city of Hōfu into a phrase for helpless laughter — from our Yamaguchi volume.') },
];

// 出典ページ用。写真以外の情報源
export const infoSources = [
  ['OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
  ['Leaflet', 'https://leafletjs.com/'],
  ['Open-Meteo Weather / Marine', 'https://open-meteo.com/en/docs'],
  [pair('山口県：遊漁ルール', 'Yamaguchi fishing rules'), 'https://www.pref.yamaguchi.lg.jp/soshiki/108/21930.html'],
  [pair('厚生労働省：アニサキス予防', 'MHLW food-safety guidance'), 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000042953.html'],
];

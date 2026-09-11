// 釣行エリアデータ。
// 表示順は 萩 → 長門 → 室津（ダディの出身地である萩を先に置く）。
// spots 配列は将来、実際に通っているポイントを追加していくための器。
// 立入禁止・釣り禁止の場所は掲載しない方針。
//
// tideStn は気象庁 潮位表の観測地点コード（scripts/build-tide.mjs の STATIONS と揃える）。
//   萩=K5（仙崎には専用の観測地点が無いため共用）、弟子待=A1（下関・彦島。室津で使う）
// tideIsProxy: その釣り場そのものの観測点ではなく、最寄りを借りている場合 true
// facing: 釣り場が海に向いている方角（度）。風向がこれに近ければ「向かい風」で波が立つ
// contributor: ダディ本人ではなく、情報をくれている人がいるエリアに記載

export const areas = [
  {
    id: 'hagi',
    nameEn: 'HAGI',
    nameJa: '萩',
    lat: 34.408,
    lon: 131.399,
    tideStn: 'K5',
    tideIsProxy: false,
    facing: 0,
    homeSpot: {
      name: '越ヶ浜漁港',
      lat: 34.439,
      lon: 131.423,
    },
    description:
      '城下町の沖に島々が浮かぶ、風と潮の通るエリア。漁港と防波堤が多く、夜釣りの灯りが海面に並ぶ。須佐方面へ北上すれば磯場も豊富。',
    image: '/assets/posters/night_lantern.jpg',
    image800: '/assets/posters/night_lantern.jpg',
    // 将来追加するポイントの構造:
    // { name, fish: [], seasons: [], methods: [], tide, wind, parking, notes }
    spots: [],
  },
  {
    id: 'nagato',
    nameEn: 'NAGATO',
    nameJa: '長門',
    lat: 34.371,
    lon: 131.182,
    tideStn: 'K5',
    tideIsProxy: true,
    facing: 0,
    homeSpot: {
      name: '仙崎人工島',
      lat: 34.388,
      lon: 131.199,
    },
    description:
      '日本海に深く切れ込んだ湾と岬が続くエリア。仙崎・青海島・油谷など、港と磯が近い距離に同居する。冬から春はヤリイカ、春から初夏はコウイカ・アオリイカ、通年でアジやマダイと、季節ごとに狙いが変わる。',
    image: '/assets/images/sunset_cast_1600.webp',
    image800: '/assets/images/sunset_cast_800.webp',
    spots: [],
  },
  {
    id: 'murotsu',
    nameEn: 'MUROTSU',
    nameJa: '室津',
    city: '下関市豊浦町',
    lat: 34.135,
    lon: 130.887,
    tideStn: 'A1',
    tideIsProxy: true,
    facing: 0, // 室津湾は北に開く
    homeSpot: {
      name: '室津市場波止（室津下漁港）',
      lat: 34.13465,
      lon: 130.886784,
    },
    contributor: 'YouTubeの視聴者の方から釣果と海の様子を教えてもらっているエリア',
    description:
      '本州最西端・毘沙ノ鼻に近い響灘側の漁港。市場の波止からコウイカ、時化のあとには鱚やヒラメ、セイゴ、タコまで上がる。ダディの地元ではなく、いつも情報をくれる視聴者の方の釣り場。',
    image: '/assets/posters/dawn_sea.jpg',
    image800: '/assets/posters/dawn_sea.jpg',
    spots: [],
  },
];

export const areaById = (id) => areas.find((a) => a.id === id) ?? null;

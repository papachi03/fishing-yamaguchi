// 攻略記事（guides/*.html）の一覧。SEAの「今月の旬」・HOMEの「攻略ガイド」・JOURNALの各釣行から、合う記事へリンクする。
// 記事を足したら、ここと vite.config.js の input と public/sitemap.xml の3か所に書く。
//   months         : 季節の合う月（SEA・HOMEで出す）
//   speciesPattern : JOURNALの魚種（vlogs.js の species）にこの文字が含まれていたら、その釣行の末尾から記事へ誘導する
//   badge / image / image1600 / alt / lead : HOMEの写真カード用。badge は無くてもよい
export const guides = [
  {
    slug: 'autumn-eging',
    title: '山口で秋の新子アオリを狙う、エギング道具一式',
    months: [9, 10, 11],
    speciesPattern: 'イカ',
    badge: '秋の新子シーズン',
    image: '/assets/images/aori_shinko_800.webp',
    image1600: '/assets/images/aori_shinko_1600.webp',
    alt: '灯火の夜に釣れた秋の新子アオリイカ4杯',
    lead: '実際に使っているロッド2本とリール2台を比べながら、最初の1セットをまとめました。',
  },
  {
    slug: 'family-sabiki',
    title: '家族で行く堤防サビキ、最初にそろえる道具',
    months: [5, 6, 7, 8, 9, 10, 11],
    badge: '家族ではじめる',
    // 元写真が横1500pxしかないため、大きい方も1500px（カードの srcset は 1600w と書かれるが表示に支障はない）
    image: '/assets/images/family_sabiki_800.webp',
    image1600: '/assets/images/family_sabiki_1500.webp',
    alt: 'まな板の上にずらりと並んだアジと、スズキ・カサゴの釣果',
    lead: 'エギングと兼用のロッドとリール、手が汚れないコマセ、水汲みバケツまで。最初の一式をまとめました。',
  },
  {
    // 下書き（2026-10-05）：写真が決まるまで image/image1600/alt は入れない（カードは写真なしで表示される）
    slug: 'yaen-beginner',
    title: 'ヤエン釣り入門、アジを泳がせてアオリを掛ける道具',
    months: [10, 11, 12],
    // ヤエンはアオリイカの釣り。「イカ」だとヤリイカ・モンゴウイカの釣行にも出てしまうので絞る
    speciesPattern: 'アオリ',
    badge: '待ちの釣り',
    lead: 'ヤエン専用リールからヤエン本体、エサのアジを活かす道具まで。最初の一式をまとめました。',
  },
];

export const guideHref = (g) => `/guides/${g.slug}.html`;
export const guidesForMonth = (month) => guides.filter((g) => g.months.includes(month));
export const guidesForSpecies = (species) =>
  species ? guides.filter((g) => g.speciesPattern && species.includes(g.speciesPattern)) : [];

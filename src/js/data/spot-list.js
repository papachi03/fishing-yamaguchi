// 「現地の声」で選べる場所。サイトとWorker（worker/reports）の両方がimportする。
// ブラウザのAPIに触らないこと。
//
// ルール
//   - IDは保存済みの投稿が参照するので、一度公開したら変えない・消さない（名前の修正はよい）
//   - 追加は各エリアの末尾に足す
//   - 釣り禁止・立入禁止の場所は載せない。載せるのはダディがOKを出した場所だけ
//     （下調べの記録は docs/REPORTS_釣り場リスト候補.md。2026-09-21 ダディ確認済み・37か所）
//   - note（任意）：ごく短い一言を「名前（note）」の形で出したいときに使う仕組み（placeLabel参照）。
//     2026-09-21時点では使っていない＝時間帯の制限や立入禁止区画は個別に書き出さず、
//     フォーム側の共通の注意書き（「現地のルールを守ってください」）でまとめて伝える方針にした
//     （ダディ指示：マナーと自己責任を促す一言で足りる）。

export const AREA_LABELS = {
  hagi: '萩',
  nagato: '長門',
  shimonoseki: '下関',
  kudamatsu: '下松',
  hofu: '防府',
};

export const SPOTS = [
  { id: 'hagi-koshigahama', areaId: 'hagi', name: '越ヶ浜漁港' },
  { id: 'hagi-hagikou', areaId: 'hagi', name: '萩港' },
  { id: 'hagi-mitsumi', areaId: 'hagi', name: '三見漁港' },
  { id: 'hagi-esaki', areaId: 'hagi', name: '江崎港' },
  { id: 'hagi-susa', areaId: 'hagi', name: '須佐漁港' },
  { id: 'hagi-uda', areaId: 'hagi', name: '宇田港' },
  { id: 'hagi-nago', areaId: 'hagi', name: '奈古漁港' },
  { id: 'hagi-ooiura', areaId: 'hagi', name: '大井浦漁港' },
  { id: 'hagi-kikugahama', areaId: 'hagi', name: '菊ヶ浜' },
  { id: 'hagi-yomenaki', areaId: 'hagi', name: '嫁泣漁港' },
  { id: 'hagi-mitsumi-akashi', areaId: 'hagi', name: '三見明石浄化センター前' },
  { id: 'hagi-ogasaki', areaId: 'hagi', name: '尾ヶ崎（地磯）' },
  { id: 'hagi-hagishoko', areaId: 'hagi', name: '萩商港（浜崎商港）' },
  { id: 'hagi-kagawazu', areaId: 'hagi', name: '香川津の波止' },
  { id: 'hagi-nakaobata', areaId: 'hagi', name: '椿東・中小畑の護岸' },
  { id: 'hagi-mihagi-kaihin', areaId: 'hagi', name: '美萩海浜公園' },
  { id: 'hagi-kasayama', areaId: 'hagi', name: '笠山（地磯）' },
  { id: 'hagi-marina-hagi', areaId: 'hagi', name: 'マリーナ萩' },

  { id: 'nagato-senzaki-jinkoto', areaId: 'nagato', name: '仙崎人工島' },
  { id: 'nagato-senzaki-gyoko', areaId: 'nagato', name: '仙崎漁港' },
  { id: 'nagato-oohibi', areaId: 'nagato', name: '大日比漁港' },
  { id: 'nagato-kawajirimisaki', areaId: 'nagato', name: '川尻岬' },
  { id: 'nagato-kutsu', areaId: 'nagato', name: '久津漁港' },
  { id: 'nagato-kakebuchi', areaId: 'nagato', name: '掛淵漁港' },
  { id: 'nagato-ikami', areaId: 'nagato', name: '伊上漁港' },
  { id: 'nagato-arakawa', areaId: 'nagato', name: '荒川船舶鉄工所付近' },
  { id: 'nagato-shirokata', areaId: 'nagato', name: '白潟漁港' },
  { id: 'nagato-minato', areaId: 'nagato', name: '湊漁港' },
  { id: 'nagato-kojima', areaId: 'nagato', name: '小島港' },
  { id: 'nagato-nowaze', areaId: 'nagato', name: '野波瀬漁港' },
  { id: 'nagato-nowaze-jizosaki', areaId: 'nagato', name: '野波瀬・地蔵崎' },
  { id: 'nagato-nowaze-gogan', areaId: 'nagato', name: '野波瀬漁港右横の護岸' },
  { id: 'nagato-matsushima', areaId: 'nagato', name: '松島（地磯）' },
  { id: 'nagato-ii', areaId: 'nagato', name: '飯井港' },
  { id: 'nagato-tanoura', areaId: 'nagato', name: '田ノ浦漁港' },
  { id: 'nagato-tanoura-gogan', areaId: 'nagato', name: '田ノ浦漁港横岸壁' },
  { id: 'nagato-omijima-douro', areaId: 'nagato', name: '青海島道路沿い' },
  { id: 'nagato-omijima-ohashi', areaId: 'nagato', name: '青海島大橋下周辺' },
  { id: 'nagato-oura', areaId: 'nagato', name: '大浦漁港' },
  { id: 'nagato-kuhara', areaId: 'nagato', name: '久原漁港' },
  { id: 'nagato-kihado', areaId: 'nagato', name: '黄波戸漁港' },

  { id: 'shimonoseki-murotsushimo', areaId: 'shimonoseki', name: '室津下漁港' },
  { id: 'shimonoseki-yasuoka', areaId: 'shimonoseki', name: '安岡漁港' },
  { id: 'shimonoseki-fishingpark', areaId: 'shimonoseki', name: '下関フィッシングパーク' },
  { id: 'shimonoseki-tsunoshima-makizaki', areaId: 'shimonoseki', name: '角島・牧崎' },
  { id: 'shimonoseki-yudama', areaId: 'shimonoseki', name: '湯玉漁港' },
  { id: 'shimonoseki-kawatana', areaId: 'shimonoseki', name: '川棚漁港' },
  { id: 'shimonoseki-wakuda', areaId: 'shimonoseki', name: '涌田漁港' },
  { id: 'shimonoseki-futami', areaId: 'shimonoseki', name: '二見漁港' },
  { id: 'shimonoseki-awano', areaId: 'shimonoseki', name: '粟野漁港' },
  { id: 'shimonoseki-arukaporto', areaId: 'shimonoseki', name: 'あるかぽーと' },
  { id: 'shimonoseki-misakinocho', areaId: 'shimonoseki', name: '岬之町' },
  { id: 'shimonoseki-higashiyamato', areaId: 'shimonoseki', name: '東大和町' },
  { id: 'shimonoseki-fukuura', areaId: 'shimonoseki', name: '福浦港' },
  { id: 'shimonoseki-arata', areaId: 'shimonoseki', name: '荒田港' },
  { id: 'shimonoseki-nishiyama-futo', areaId: 'shimonoseki', name: '西山ふ頭' },
  { id: 'shimonoseki-haetomari', areaId: 'shimonoseki', name: '南風泊港' },
  { id: 'shimonoseki-hikoshima-minamikoen', areaId: 'shimonoseki', name: '彦島南公園下海岸' },
  { id: 'shimonoseki-hikoshima-saiseki', areaId: 'shimonoseki', name: '彦島砕石場・南霊園下海岸' },
  { id: 'shimonoseki-chofu-ogimachi', areaId: 'shimonoseki', name: '長府扇町岸壁' },
  { id: 'shimonoseki-sekimidai', areaId: 'shimonoseki', name: '関見台公園下海岸' },

  { id: 'kudamatsu-suhana', areaId: 'kudamatsu', name: '洲鼻港' },
  { id: 'kudamatsu-kasadoohashi', areaId: 'kudamatsu', name: '笠戸大橋下' },
  { id: 'kudamatsu-hanaguri', areaId: 'kudamatsu', name: 'はなぐり海岸' },
  { id: 'kudamatsu-honura', areaId: 'kudamatsu', name: '本浦漁港' },
  { id: 'kudamatsu-fukaura', areaId: 'kudamatsu', name: '深浦漁港' },
  { id: 'kudamatsu-daini-futo', areaId: 'kudamatsu', name: '下松第二埠頭' },

  { id: 'hofu-tonomi', areaId: 'hofu', name: '富海海岸（富海漁港）' },
  { id: 'hofu-sabagawa', areaId: 'hofu', name: '佐波川河口' },
  { id: 'hofu-gogasaki', areaId: 'hofu', name: '郷ヶ崎漁港' },
  { id: 'hofu-nishiura', areaId: 'hofu', name: '西浦漁港' },
  { id: 'hofu-nakaura', areaId: 'hofu', name: '中浦漁港' },
  { id: 'hofu-nakazeki', areaId: 'hofu', name: '中関埠頭（中関新埠頭）' },
  { id: 'hofu-mukoshima', areaId: 'hofu', name: '向島運動公園' },
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

// 場所名の表示用ラベル。note があれば「名前（note）」の形にする
export const placeLabel = (p) => (p.note ? `${p.name}（${p.note}）` : p.name);

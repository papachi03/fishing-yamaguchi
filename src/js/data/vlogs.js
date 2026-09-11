// VLOGデータ。movie/ 内の実素材に対応する。
// preview: hover / 特集用の短いWeb派生クリップ（元動画は読み込まない）
// tackle: 動画内で確認できたもののみ記載。不明は null。

export const vlogs = [
  {
    id: 'mongo-dawn',
    title: '朝マズメのモンゴウイカ — 糸引きでフッキング',
    date: null,
    area: null,
    species: 'モンゴウイカ',
    tide: null,
    weather: null,
    duration: '3:31',
    poster: '/assets/posters/mongo_catch.jpg',
    preview: '/assets/video/previews/mongo_catch.mp4',
    heroClip: '/assets/video/hero/dawn_sea.mp4',
    heroPoster: '/assets/posters/dawn_sea.jpg',
    tackle: null,
    story: true,
    description:
      '朝焼けが海面に残る時間帯。エギに食いついたモンゴウイカを、糸の走りだけで捉えて掛けた釣行。ロッドに伝わる前の「糸引き」でアワセる、朝マズメらしい静かな一部始終。',
    highlights: [
      { t: '00:00:22', label: '朝焼けの海面' },
      { t: '00:02:28', label: 'ランディング' },
    ],
  },
  {
    id: 'kouika-present',
    title: '【コウイカ】今回釣れたイカを全部あげます【プレゼント】',
    date: '2022-04-14',
    area: null,
    species: 'コウイカ',
    tide: null,
    weather: '晴れ',
    duration: '20:09',
    youtube: 'K7tnITvZeYo',
    poster: '/assets/posters/vlog_kouika_present.jpg',
    preview: '/assets/video/previews/kouika_present.mp4',
    tackle: null,
    description:
      'コウイカが釣れない地域の友達のために、釣れた分を全部プレゼントする回。昼の透き通った海から夜の連発まで、コウイカ10杯。',
    highlights: [
      { t: '00:03:12', label: '人生初イカの瞬間' },
      { t: '00:19:00', label: 'コウイカ10杯の釣果' },
    ],
  },
  {
    id: 'kouika-egi',
    title: '【コウイカ】釣れまくり！このエギはホンモノでした！！',
    date: '2022-04-08',
    area: null,
    species: 'コウイカ',
    tide: null,
    weather: '晴れ',
    duration: '12:42',
    youtube: 'Prd-FpgvXmk',
    poster: '/assets/posters/vlog_kouika_egi.jpg',
    preview: '/assets/video/previews/kouika_egi.mp4',
    tackle: null,
    description:
      '「もぐもぐサーチ」を投げて放置するだけでヒットが続いた昼の堤防。仕掛けの組み合わせ紹介から、家でイカを捌くところまで。',
    highlights: [
      { t: '00:05:49', label: 'コウイカ10杯目' },
      { t: '00:11:30', label: '自宅でイカを捌く' },
    ],
  },
  {
    id: 'yariika-cd',
    title: '【ヤリイカ】CD式灯火で見えイカ釣りが楽しすぎた',
    date: '2022-03-12',
    area: null,
    species: 'ヤリイカ',
    tide: null,
    weather: null,
    duration: '16:18',
    youtube: 'l61yLE7CTgU',
    poster: '/assets/posters/vlog_yariika_cd.jpg',
    preview: '/assets/video/previews/yariika_cd.mp4',
    tackle: null,
    description:
      '灯火に照らされた緑色の海に、イカの群れが見える。見えイカを狙って掛けていく、夜ならではの釣り。',
    highlights: [{ t: '00:01:40', label: '灯りに集まるイカの群れ' }],
  },
  {
    id: 'yariika-zen',
    title: '【ヤリイカ】え？まだヤリイカって釣れるの？（前編）',
    date: '2022-04-22',
    area: null,
    species: 'ヤリイカ',
    tide: null,
    weather: null,
    duration: '19:35',
    youtube: 'O71B6QOn4qs',
    poster: '/assets/posters/vlog_yariika_zen.jpg',
    preview: '/assets/video/previews/yariika_zen.mp4',
    tackle:
      'ロッド: ダイワ エメラルダスX 86ML / リール: シマノ ネクサーブ C3000DH / リーダー: レグロン EXCEED エギリーダー 2.0号 / エサ巻きテーラ',
    description:
      '4月中旬なのに異例の事態。CD式灯火にヤリイカが集まり、永遠に釣れてる感覚になった夜の前編。',
    highlights: [{ t: '00:06:00', label: '群れを寄せて攻める' }],
  },
  {
    id: 'yariika-go',
    title: '【ヤリイカ】え？まだヤリイカって釣れるの？（後編）',
    date: '2022-04-23',
    area: null,
    species: 'ヤリイカ',
    tide: null,
    weather: null,
    duration: '26:29',
    youtube: 'ONXgL5oc10Q',
    poster: '/assets/posters/vlog_yariika_go.jpg',
    preview: '/assets/video/hero/night_lantern.mp4',
    tackle: null,
    description:
      '緑の灯りの中を泳ぐイカを追った後編。二人分の釣果報告と、灯火の海のいちばん美しい時間。',
    highlights: [
      { t: '00:11:50', label: '灯火の海中を泳ぐイカ' },
      { t: '00:25:30', label: '本日の釣果報告' },
    ],
  },
  {
    id: 'gazami-miso',
    title: '我が家で一番人気！タイワンガザミの味噌汁の作り方',
    date: '2022-10-18',
    area: null,
    species: 'タイワンガザミ',
    tide: null,
    weather: null,
    duration: '16:54',
    youtube: 'cbLq5JyL-Pg',
    poster: '/assets/posters/vlog_gazami.jpg',
    preview: '/assets/video/previews/gazami_cook.mp4',
    tackle: null,
    cook: true,
    description:
      '夜の港で出会ったタイワンガザミを、丁寧に捌いて出汁を取る。20分煮てアクを取る、我が家で一番人気の味噌汁。',
    highlights: [
      { t: '00:01:30', label: '甲羅を外す' },
      { t: '00:07:00', label: '出汁を取る' },
    ],
  },
];

export const latestStory = vlogs.find((v) => v.story) ?? vlogs[0];
export const cookVlogs = vlogs.filter((v) => v.cook);

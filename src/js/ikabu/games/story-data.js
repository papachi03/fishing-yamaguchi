// ストーリーモードの設定（2026-10-03）。台本は story-script.js、進み具合は story.js、画面は story-ui.js
//   設計：ikabu-research\cardbattle\story\第1章_台本と設計.md ／ 組み込み計画.md
//   相手ごと：エギの数（cpuEgi）・考える力（brain 1〜3・cpu-brain.js）・デッキ（30枚・同じカードは2枚まで）・場のルール（rule・battle.js の FIELD_RULES）・盤面（stage）
//   絵：public/assets/ikabu/story/{chars,bg,stage}
export const CHAPTERS = [
  { id: 1, title: ['萩の堤防・候補生編', 'Hagi Pier: Rookie Arc'], goal: ['正式部員証', 'Full membership'], count: 9 },
  { id: 2, title: ['磯・エリート昇格編', 'Rocky Shore: Elite Arc'], goal: ['エリート章', 'Elite badge'], count: 9 },   // 2026-10-15（設計：ikabu-research/cardbattle/story/第2章_台本と設計.md）
  { id: 3, title: ['夜の漁港・四天王（前編）', 'Night Harbor: Big Four I'], goal: ['四天王の印', 'Big Four seal'], count: 0, wip: true },
  { id: 4, title: ['嵐の外海・四天王（後編）〜部長', 'Stormy Sea: Big Four II'], goal: ['部長の推薦状', "Captain's letter"], count: 0, wip: true },
  { id: 5, title: ['深海の門・名誉会長', 'Gate of the Deep'], goal: ['山口イカ部 名誉部員証', 'Honorary membership'], count: 0, wip: true },
];

// 登場人物：立ち絵の名前（chars/<id>_<face>.webp）と表示名
export const CHARS = {
  ao: { name: ['{name}', '{name}'], hero: true },
  raigo: { name: ['ライゴ', 'Raigo'], squid: ['カミナリイカ', 'Cuttlefish'] },
  hiiro: { name: ['ヒイロ', 'Hiiro'], squid: ['ヒイカ', 'Pygmy squid'] },
  hotaru: { name: ['ホタル', 'Hotaru'], squid: ['ホタルイカ', 'Firefly squid'] },
  kouji: { name: ['コウ爺', 'Old Kou'], squid: ['コウイカ', 'Cuttlefish'] },
  kenzaki: { name: ['ケンザキ', 'Kenzaki'], squid: ['ケンサキイカ', 'Swordtip squid'] },
  yarisuke: { name: ['ヤリスケ', 'Yarisuke'], squid: ['ヤリイカ', 'Spear squid'] },
  surume: { name: ['スルメ姐さん', 'Surume'], squid: ['スルメイカ', 'Flying squid'] },
  akatsuki: { name: ['アカツキ', 'Akatsuki'], squid: ['アカイカ', 'Neon flying squid'] },
  // 第2章（2026-10-15）
  tobio: { name: ['トビオ', 'Tobio'], squid: ['トビイカ', 'Flying squid'] },
  hanabi: { name: ['ハナビ', 'Hanabi'], squid: ['ハナイカ', 'Flamboyant cuttlefish'] },
  tsume: { name: ['ツメ', 'Tsume'], squid: ['ツメイカ', 'Hooked squid'] },
  haru: { name: ['ハル', 'Haru'], squid: ['アオリイカ', 'Bigfin reef squid'] },
  hirobi: { name: ['ヒロビ', 'Hirobi'], squid: ['ヒロビレイカ', 'Bigfin squid'] },
  iwao: { name: ['イワオ', 'Iwao'], squid: ['コブシメ', 'Broadclub cuttlefish'] },
  // 顔見せだけ（立ち絵なし・名前の札だけ）
  nyudo: { name: ['大入道', 'Nyudo'] }, yurei: { name: ['ユウレイ', 'Yurei'] }, akuma: { name: ['赤い悪魔', 'Red Devil'] }, sodemaru: { name: ['ソデマル', 'Sodemaru'] },
  unknown: { name: ['？？？', '???'] }, narr: { name: ['', ''] },
};

// 第1章の9戦。rank：候補生／ライバル／修行／部員／エリート（画面の札に出す）
//   deck：{ squid, tech, trap } の番号。myDeck：自分のデッキを固定する戦（第4戦の課題デッキ）だけ
export const BATTLES_CH1 = [
  { i: 1, foe: 'hiiro', rank: ['候補生', 'Rookie'], stars: 1, place: ['漁港の常夜灯の下', 'Under the harbor lamp'], bg: 'jouyatou', stage: 'jouyatou', cpuEgi: 3, brain: 1, rule: null,
    deck: { squid: [1, 1, 2, 2, 8, 8, 9, 9, 10, 10, 24, 24, 26, 26], tech: [57, 57, 58, 58, 51, 51, 53, 53, 55, 59, 61], trap: [99, 99, 97, 100, 101] } },
  { i: 2, foe: 'raigo', rank: ['ライバル', 'Rival'], stars: 1, place: ['堤防の先端', 'Tip of the pier'], bg: 'jouyatou', stage: 'jouyatou', cpuEgi: 3, brain: 1, rule: null,
    deck: { squid: [13, 13, 3, 3, 24, 24, 8, 8, 26, 26, 10, 10, 2, 2], tech: [54, 54, 57, 57, 58, 58, 51, 51, 60, 60, 56], trap: [99, 99, 96, 96, 97] } },
  { i: 3, foe: 'hotaru', rank: ['候補生', 'Rookie'], stars: 2, place: ['光る夜の海', 'Glowing night sea'], bg: 'hotaru_umi', stage: 'hikaru_umi', cpuEgi: 4, brain: 2, rule: 'night',
    deck: { squid: [7, 7, 5, 5, 36, 36, 37, 37, 22, 22, 23, 23, 38, 38], tech: [55, 55, 61, 61, 71, 71, 76, 76, 67, 51, 51], trap: [100, 100, 102, 102, 107] } },
  { i: 4, foe: 'kouji', rank: ['修行', 'Training'], stars: 2, place: ['磯の修行場', 'Training rocks'], bg: 'iso', stage: 'iso', cpuEgi: 4, brain: 2, rule: null,
    deck: { squid: [3, 3, 11, 11, 21, 21, 30, 30, 14, 8, 8, 24, 26], tech: [54, 54, 56, 56, 60, 60, 64, 64, 73, 81, 58], trap: [96, 96, 97, 97, 105, 105] },
    myDeck: { squid: [14, 14, 6, 6, 5, 5, 3, 3, 11, 11, 21, 21, 30], tech: [51, 51, 65, 65, 54, 54, 60, 56, 64, 81, 73], trap: [96, 96, 97, 105, 105, 111] } },
  { i: 5, foe: 'kenzaki', rank: ['部員', 'Member'], stars: 3, place: ['夏の夜の沖', 'Summer night offshore'], bg: 'shugyotou', stage: 'shugyotou', cpuEgi: 5, brain: 2, rule: 'summerNight',
    deck: { squid: [4, 4, 12, 12, 15, 15, 25, 25, 38, 38, 31, 14, 14, 6], tech: [68, 68, 71, 71, 69, 69, 70, 70, 53, 53, 72, 75], trap: [101, 101, 103, 108] } },
  { i: 6, foe: 'yarisuke', rank: ['部員', 'Member'], stars: 3, place: ['冬の夜の堤防', 'Winter night pier'], bg: 'fuyu_teibou', stage: 'shugyotou', cpuEgi: 5, brain: 2, rule: null,
    deck: { squid: [5, 5, 22, 22, 23, 23, 49, 49, 42, 42, 36, 36, 7, 7], tech: [55, 55, 61, 61, 71, 71, 76, 67, 67, 85, 51], trap: [100, 100, 107, 107, 112] } },
  { i: 7, foe: 'surume', rank: ['部員', 'Member'], stars: 4, place: ['荒れた日の漁港', 'Harbor in a storm'], bg: 'areta', stage: 'areta', cpuEgi: 5, brain: 3, rule: 'rough',
    deck: { squid: [6, 6, 16, 16, 28, 28, 29, 29, 40, 18, 18, 35, 20], tech: [51, 51, 52, 52, 65, 65, 66, 77, 79, 83, 83], trap: [98, 98, 106, 106, 109, 117] } },
  { i: 8, foe: 'raigo', rank: ['ライバル', 'Rival'], stars: 4, place: ['堤防の先端・雷雲', 'Tip of the pier, thunderclouds'], bg: 'hagi_mazume', stage: 'bushitsu', cpuEgi: 5, brain: 3, rule: null,
    deck: { squid: [13, 13, 3, 3, 17, 11, 27, 27, 24, 24, 8, 8, 44, 10], tech: [54, 54, 57, 58, 74, 80, 82, 91, 51, 51, 65], trap: [99, 99, 104, 110, 113] } },
  { i: 9, foe: 'akatsuki', rank: ['エリート・試験官', 'Elite examiner'], stars: 5, place: ['イカ部の部室', 'Club room'], bg: 'bushitsu', stage: 'bushitsu', cpuEgi: 5, brain: 3, rule: 'exam',
    deck: { squid: [15, 15, 31, 31, 34, 34, 12, 12, 38, 38, 25, 25, 48, 17], tech: [67, 67, 84, 84, 68, 68, 69, 70, 72, 53, 53], trap: [103, 103, 108, 108, 116] } },
];
// 第2章「磯・エリート昇格編」の9戦（2026-10-15）。相手のエギは全部5・考える力は全部 Lv3。難しさはデッキと場のルールで上げる
// 2026-10-16 山札切れを「エギの数で勝敗」にしたら第2章が易しくなったので、第4〜9戦のイカを同じマークのより強いイカに置き換えて元の勝ち率に戻した
//   （ikabu-research\sim\story_ch2_tune.mjs／story_ch2_fine.mjs で200戦ずつ測定。目標＝変更前の 65/65/78/57/57/20%）
export const BATTLES_CH2 = [
  { i: 1, foe: 'tobio', rank: ['エリート', 'Elite'], stars: 3, place: ['磯の入口・白い波', 'Rocky shore entrance'], bg: 'iso_sarashi', stage: 'iso', cpuEgi: 5, brain: 3, rule: 'sarashi',
    deck: { squid: [12, 12, 25, 25, 4, 4, 38, 38, 15, 15, 1, 1, 31, 24], tech: [53, 53, 59, 59, 68, 68, 70, 70, 69, 72, 65], trap: [101, 101, 103, 108, 99] } },
  { i: 2, foe: 'hanabi', rank: ['エリート', 'Elite'], stars: 3, place: ['磯の潮だまり', 'Tide pool'], bg: 'iso_shiodamari', stage: 'iso', cpuEgi: 5, brain: 3, rule: 'tidepool',
    deck: { squid: [31, 31, 25, 25, 4, 4, 38, 38, 12, 12, 15, 15, 34], tech: [69, 69, 70, 70, 68, 68, 75, 75, 53, 53, 84, 84], trap: [101, 108, 103, 116, 116] } },
  { i: 3, foe: 'raigo', rank: ['ライバル', 'Rival'], stars: 4, place: ['ゴロタ浜', 'Boulder beach'], bg: 'iso_gorota', stage: 'wareme', cpuEgi: 5, brain: 3, rule: null,
    deck: { squid: [13, 13, 33, 33, 24, 24, 27, 27, 3, 3, 8, 8, 10, 17], tech: [54, 54, 57, 58, 82, 82, 74, 80, 65, 65, 91], trap: [99, 99, 104, 113, 113] } },
  { i: 4, foe: 'tsume', rank: ['エリート', 'Elite'], stars: 4, place: ['岩の割れ目', 'Rock crevice'], bg: 'iso_wareme', stage: 'wareme', cpuEgi: 5, brain: 3, rule: 'crevice',
    deck: { squid: [40, 40, 16, 16, 28, 28, 29, 29, 6, 6, 18, 18, 20], tech: [51, 51, 77, 77, 65, 79, 83, 83, 62, 62, 66], trap: [109, 109, 106, 106, 117, 117] } },
  { i: 5, foe: 'haru', rank: ['エリート', 'Elite'], stars: 4, place: ['磯の藻場', 'Seaweed bed'], bg: 'iso_moba', stage: 'moba', cpuEgi: 5, brain: 3, rule: 'moba',
    deck: { squid: [14, 14, 48, 48, 17, 17, 30, 30, 21, 11, 39, 3, 21, 32], tech: [54, 54, 56, 56, 73, 73, 81, 81, 87, 89, 60], trap: [105, 105, 111, 111, 96] } },
  { i: 6, foe: 'hirobi', rank: ['エリート', 'Elite'], stars: 4, place: ['夜の磯', 'Rocky shore at night'], bg: 'iso_yoru', stage: 'iso_yoru', cpuEgi: 5, brain: 3, rule: 'night',
    deck: { squid: [48, 32, 41, 41, 14, 39, 43, 43, 5, 36, 14, 30, 19], tech: [54, 54, 76, 76, 85, 81, 81, 56, 56, 60, 60, 86], trap: [105, 105, 107, 107, 96] } },
  { i: 7, foe: 'kouji', rank: ['修行', 'Training'], stars: 5, place: ['夜の修行場', 'Training rocks at night'], bg: 'iso_yoru', stage: 'iso_yoru', cpuEgi: 5, brain: 3, rule: null,
    deck: { squid: [30, 3, 39, 48, 30, 11, 32, 17, 32, 14, 33, 33, 19], tech: [54, 54, 73, 73, 81, 81, 87, 60, 60, 89, 93], trap: [96, 105, 105, 111, 115, 115] } },
  { i: 8, foe: 'raigo', rank: ['ライバル', 'Rival'], stars: 5, place: ['嵐の前の磯', 'Before the storm'], bg: 'iso_arashi', stage: 'arashi', cpuEgi: 5, brain: 3, rule: 'rough',
    deck: { squid: [13, 13, 33, 33, 19, 17, 24, 24, 27, 27, 44, 19, 10, 10], tech: [54, 54, 82, 82, 74, 80, 57, 58, 91, 93, 65], trap: [99, 99, 104, 110, 113] } },
  { i: 9, foe: 'iwao', rank: ['磯の主・最終試験', 'Shore master exam'], stars: 5, place: ['嵐の磯', 'Storm on the rocks'], bg: 'iso_arashi', stage: 'arashi', cpuEgi: 5, brain: 3, rule: 'stormExam',
    deck: { squid: [48, 17, 44, 33, 19, 19, 30, 3, 39, 21, 30, 11, 46], tech: [54, 54, 73, 73, 81, 81, 89, 89, 93, 87, 56], trap: [105, 105, 111, 111, 115, 115] } },
];
// 章ごとの戦の一覧
export const BATTLES_BY_CH = { 1: BATTLES_CH1, 2: BATTLES_CH2 };
export const deckNos = (d) => [...d.squid, ...d.tech, ...d.trap];

// 場のルールの説明（対戦の前の会話の後に1枚出す）
export const RULE_TEXT = {
  night: { title: ['場のルール：夜', 'Field: Night'], body: ['星マークのイカは攻撃+1（おたがい）', 'Star squids get +1 ATK (both sides)'] },
  summerNight: { title: ['場のルール：夏の夜', 'Field: Summer night'], body: ['太陽マークのテクニックは潮1安い（おたがい）', 'Sun techniques cost 1 less tide (both sides)'] },
  rough: { title: ['場のルール：荒れた天候', 'Field: Rough weather'], body: ['後列に4枚まで伏せられる（おたがい）', 'Up to 4 cards in the back row (both sides)'] },
  exam: { title: ['場のルール：昇格試験', 'Field: Exam'], body: ['試験官が先攻', 'The examiner goes first'] },
  // 第2章（2026-10-15）
  sarashi: { title: ['場のルール：白波', 'Field: Whitewater'], body: ['太陽マークのイカは攻撃+1（おたがい）', 'Sun squids get +1 ATK (both sides)'] },
  tidepool: { title: ['場のルール：潮だまり', 'Field: Tide pool'], body: ['太陽マークのテクニックは潮1安い（おたがい）', 'Sun techniques cost 1 less tide (both sides)'] },
  crevice: { title: ['場のルール：岩の割れ目', 'Field: Crevice'], body: ['後列に4枚まで伏せられる（おたがい）', 'Up to 4 cards in the back row (both sides)'] },
  moba: { title: ['場のルール：藻場', 'Field: Seaweed bed'], body: ['波マークのイカは防御+1（おたがい）', 'Wave squids get +1 DEF (both sides)'] },
  stormExam: { title: ['場のルール：嵐の試験', 'Field: Storm exam'], body: ['試験官が先攻・後列に4枚まで伏せられる（おたがい）', 'The examiner goes first; up to 4 back-row cards (both sides)'] },
};

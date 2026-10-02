// ストーリーモードの設定（2026-10-03）。台本は story-script.js、進み具合は story.js、画面は story-ui.js
//   設計：ikabu-research\cardbattle\story\第1章_台本と設計.md ／ 組み込み計画.md
//   相手ごと：エギの数（cpuEgi）・考える力（brain 1〜3・cpu-brain.js）・デッキ（30枚・同じカードは2枚まで）・場のルール（rule・battle.js の FIELD_RULES）・盤面（stage）
//   絵：public/assets/ikabu/story/{chars,bg,stage}
export const CHAPTERS = [
  { id: 1, title: ['萩の堤防・候補生編', 'Hagi Pier: Rookie Arc'], goal: ['正式部員証', 'Full membership'], count: 9 },
  { id: 2, title: ['磯・エリート昇格編', 'Rocky Shore: Elite Arc'], goal: ['エリート章', 'Elite badge'], count: 0, wip: true },
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
export const deckNos = (d) => [...d.squid, ...d.tech, ...d.trap];

// 場のルールの説明（対戦の前の会話の後に1枚出す）
export const RULE_TEXT = {
  night: { title: ['場のルール：夜', 'Field: Night'], body: ['星マークのイカは攻撃+1（おたがい）', 'Star squids get +1 ATK (both sides)'] },
  summerNight: { title: ['場のルール：夏の夜', 'Field: Summer night'], body: ['太陽マークのテクニックは潮1安い（おたがい）', 'Sun techniques cost 1 less tide (both sides)'] },
  rough: { title: ['場のルール：荒れた天候', 'Field: Rough weather'], body: ['後列に4枚まで伏せられる（おたがい）', 'Up to 4 cards in the back row (both sides)'] },
  exam: { title: ['場のルール：昇格試験', 'Field: Exam'], body: ['試験官が先攻', 'The examiner goes first'] },
};

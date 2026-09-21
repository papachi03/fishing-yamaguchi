// 「現地の声」の選択肢。サイトとWorker（worker/reports）の両方がimportする。
// ブラウザのAPIに触らないこと。IDは保存済みの投稿が参照するので変えない（名前は変えてよい）。

// 並びは「イカ・タコ → 根魚 → 砂物 → チヌ・クロ → 青物・回遊 → その他」。
// 萩・長門の波止で実際に釣れている魚を中心に選んでいる（2026-09-21にダディの指摘で拡張）。
export const FISH = [
  { id: 'aori', name: 'アオリイカ' },
  { id: 'kensaki', name: 'ケンサキイカ' },
  { id: 'yari', name: 'ヤリイカ' },
  { id: 'kouika', name: 'コウイカ・モンゴウイカ' },
  { id: 'shiriyake', name: 'シリヤケイカ' },
  { id: 'tako', name: 'タコ' },
  { id: 'kasago', name: 'カサゴ（アラカブ）' },
  { id: 'kijihata', name: 'キジハタ（アコウ）' },
  { id: 'mebaru', name: 'メバル' },
  { id: 'hirame', name: 'ヒラメ' },
  { id: 'magochi', name: 'マゴチ' },
  { id: 'kisu', name: 'キス' },
  { id: 'karei', name: 'カレイ' },
  { id: 'chinu', name: 'チヌ（クロダイ）' },
  { id: 'kuro', name: 'クロ（メジナ）' },
  { id: 'madai', name: 'マダイ' },
  { id: 'aomono', name: '青物（ヤズ・ハマチ）' },
  { id: 'hiramasa', name: 'ヒラマサ' },
  { id: 'sagoshi', name: 'サゴシ・サワラ' },
  { id: 'tachiuo', name: 'タチウオ' },
  { id: 'kamasu', name: 'カマス' },
  { id: 'aji', name: 'アジ' },
  { id: 'saba', name: 'サバ' },
  { id: 'seabass', name: 'シーバス（スズキ）' },
  { id: 'other', name: 'その他' },
  { id: 'none', name: '釣れなかった' },
];

export const WIND_FEEL = [
  { id: 'weaker', name: '予報より弱かった' },
  { id: 'same', name: '予報どおり' },
  { id: 'stronger', name: '予報より強かった' },
];

export const nameOf = (list, id) => list.find((x) => x.id === id)?.name ?? '';

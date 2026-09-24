// 「現地の声」の選択肢。サイトとWorker（worker/reports）の両方がimportする。
// ブラウザのAPIに触らないこと。IDは保存済みの投稿が参照するので変えない（名前は変えてよい）。

// 並びは「イカ・タコ → 根魚 → 砂物 → チヌ・クロ → 青物・回遊 → その他」。
// 萩・長門の波止で実際に釣れている魚を中心に選んでいる（2026-09-21にダディの指摘で拡張）。
export const FISH = [
  { id: 'aori', name: 'アオリイカ', nameEn: 'Bigfin reef squid' },
  { id: 'kensaki', name: 'ケンサキイカ', nameEn: 'Swordtip squid' },
  { id: 'yari', name: 'ヤリイカ', nameEn: 'Spear squid' },
  { id: 'kouika', name: 'コウイカ・モンゴウイカ', nameEn: 'Cuttlefish' },
  { id: 'shiriyake', name: 'シリヤケイカ', nameEn: 'Spineless cuttlefish' },
  { id: 'tako', name: 'タコ', nameEn: 'Octopus' },
  { id: 'kasago', name: 'カサゴ（アラカブ）', nameEn: 'Scorpionfish (kasago)' },
  { id: 'kijihata', name: 'キジハタ（アコウ）', nameEn: 'Red-spotted grouper (akou)' },
  { id: 'mebaru', name: 'メバル', nameEn: 'Rockfish (mebaru)' },
  { id: 'hirame', name: 'ヒラメ', nameEn: 'Flounder' },
  { id: 'magochi', name: 'マゴチ', nameEn: 'Flathead' },
  { id: 'kisu', name: 'キス', nameEn: 'Whiting (kisu)' },
  { id: 'karei', name: 'カレイ', nameEn: 'Righteye flounder (karei)' },
  { id: 'chinu', name: 'チヌ（クロダイ）', nameEn: 'Black sea bream (chinu)' },
  { id: 'kuro', name: 'クロ（メジナ）', nameEn: 'Largescale blackfish (mejina)' },
  { id: 'madai', name: 'マダイ', nameEn: 'Red sea bream' },
  { id: 'aomono', name: '青物（ヤズ・ハマチ）', nameEn: 'Young yellowtail (yazu / hamachi)' },
  { id: 'hiramasa', name: 'ヒラマサ', nameEn: 'Yellowtail amberjack (hiramasa)' },
  { id: 'sagoshi', name: 'サゴシ・サワラ', nameEn: 'Spanish mackerel (sawara)' },
  { id: 'tachiuo', name: 'タチウオ', nameEn: 'Cutlassfish (tachiuo)' },
  { id: 'kamasu', name: 'カマス', nameEn: 'Barracuda (kamasu)' },
  { id: 'aji', name: 'アジ', nameEn: 'Horse mackerel (aji)' },
  { id: 'saba', name: 'サバ', nameEn: 'Mackerel' },
  { id: 'seabass', name: 'シーバス（スズキ）', nameEn: 'Japanese sea bass (suzuki)' },
  { id: 'other', name: 'その他', nameEn: 'Other' },
  { id: 'none', name: '釣れなかった', nameEn: 'Nothing caught' },
];

export const WIND_FEEL = [
  { id: 'weaker', name: '予報より弱かった', nameEn: 'weaker than forecast' },
  { id: 'same', name: '予報どおり', nameEn: 'as forecast' },
  { id: 'stronger', name: '予報より強かった', nameEn: 'stronger than forecast' },
];

// nameEn はイカ部の英語ページ用（lang='en' のときだけ使う。既定は従来どおり日本語）
export const nameOf = (list, id, lang = 'ja') => {
  const x = list.find((x) => x.id === id);
  if (!x) return '';
  return lang === 'en' ? (x.nameEn ?? x.name) : x.name;
};

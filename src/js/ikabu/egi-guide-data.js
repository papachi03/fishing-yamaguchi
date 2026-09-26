// エギ選び記事のデータ（部員おすすめ：新子シーズンのエギ選び、2026-09-26）。
// 色名・品番はメーカー公式（ヤマシタ エギ王K／デュエル イージーQ キャスト喰わせ＝パタパタ）の 3.0号 のラインナップで確認済み。
// back＝背中の布の色、base＝下地のテープの色（見た目のイメージ。実物の色とは違うことがある）。
// 「部員が選んだ候補」であって、まだ実釣で確かめていない。釣れたら used を true にして「部員愛用」表示に切り替える（ぱっぱ 9/26）
import { pair } from './i18n.js';

// アフィリエイトの表示スイッチ。海況データの乗り換え（Open-Meteo の無料枠から撤退）が終わってから true にする（ぱっぱ 9/26）
export const AFFILIATE_ON = false;
// 冒頭の解説動画（YouTube の動画ID）。childダディのチャンネルに上がったら入れる。null のあいだは「準備中」の枠
export const GUIDE_VIDEO_ID = '5BiXvdxYBj8';   // childダディ「【秋エギング】新子シーズンのエギ選び」（2026-09-26）

export const SERIES = {
  egiohk: { name: pair('ヤマシタ エギ王K', 'YAMASHITA Egi-O K'), sizes: pair('2.5号・3.0号は同じ色', 'Same colors in #2.5 and #3.0') },
  patapata: { name: pair('デュエル パタパタ（イージーQ キャスト喰わせ）', 'DUEL PataPata (EZ-Q Cast Kuwase)'), sizes: pair('2.5号・3.0号・3.5号', '#2.5, #3.0, #3.5') },
};

export const BASES = {
  gold: { label: pair('金テープ', 'Gold tape'), color: '#d9b44a' },
  red: { label: pair('赤テープ', 'Red tape'), color: '#c62a2f' },
  keimura: { label: pair('ケイムラ', 'UV glow'), color: '#9fd3ff' },
  glow: { label: pair('夜光', 'Luminous'), color: '#b8f5c8' },
  none: { label: pair('下地なし', 'No tape'), color: '#e8e2d6' },
};

export const TYPES = [
  ['mazume', pair('マズメエギンガー', 'Dawn & dusk')],
  ['day', pair('日中エギンガー', 'Daytime')],
  ['night', pair('夜間エギンガー', 'Night')],
];

export const TYPE_NOTES = {
  mazume: pair('朝夕の薄暗い時間は、光が赤っぽく弱い。オレンジ・ピンクで目立たせて、赤テープやケイムラでシルエットと光りを足す。', 'At dawn and dusk the light is weak and reddish. Use orange or pink to stand out, with red tape or UV glow for silhouette and shine.'),
  day: pair('明るくて水が澄んでいる日中は、イカにエギがよく見える。金テープで光らせるか、茶・緑・オリーブの自然な色で見切られにくく。', 'In bright, clear daytime water the squid sees the egi well. Flash it with gold tape, or go natural with brown, green or olive.'),
  night: pair('夜は色よりシルエット。赤テープの暗い色で輪郭をはっきりさせる。月が明るい夜はケイムラやパープルも。', 'At night the silhouette matters more than color. Dark colors on red tape give a clear outline. On bright moonlit nights, try UV glow or purple.'),
};

// type: どのタイプ向けか。sub: 補足の時間帯。query: アフィリエイトの検索語（号数は入れず、お店で号数を選べるように）
export const EGIS = [
  // マズメ
  { type: 'mazume', series: 'egiohk', code: '004', name: pair('カクテルオレンジ', 'Cocktail Orange'), base: 'red', back: '#f47a2a', query: 'エギ王K カクテルオレンジ',
    why: pair('マズメの定番。オレンジの背中で目立ち、赤テープでシルエットも出る。', 'The dawn-and-dusk classic: orange stands out, red tape adds a silhouette.') },
  { type: 'mazume', series: 'egiohk', code: '005', name: pair('ムラムラチェリー', 'Mura-Mura Cherry'), base: 'keimura', back: '#e0466f', query: 'エギ王K ムラムラチェリー',
    why: pair('ケイムラが朝夕の光で青白く光る。月の明るい夜にも。', 'UV glow shines in low morning and evening light, and on bright moonlit nights.') },
  { type: 'mazume', series: 'patapata', code: 'KVMO', name: pair('まずめオレンジ', 'Mazume Orange'), base: 'gold', back: '#f28c28', query: 'パタパタ イージーQ キャスト喰わせ まずめオレンジ',
    why: pair('名前どおりのマズメ用。金下地にケイムラ入り。', 'Made for dawn and dusk, as the name says: gold base with UV glow.') },
  { type: 'mazume', series: 'patapata', code: 'LPOG', name: pair('夜光ピンクオレンジ', 'Luminous Pink Orange'), base: 'gold', back: '#f5906e', query: 'パタパタ イージーQ キャスト喰わせ 夜光ピンクオレンジ',
    why: pair('夜光入りで、暗くなり始めても見つけてもらいやすい。', 'Luminous, so it stays easy to find as the light fades.') },
  // 日中
  { type: 'day', series: 'egiohk', code: '001', name: pair('金アジ', 'Gold Aji'), base: 'gold', back: '#6f8a8f', query: 'エギ王K 金アジ',
    why: pair('イカの好物の小魚・アジに似た色。晴れの日に金テープが光る。', 'Looks like horse mackerel, a squid favorite. The gold tape flashes on sunny days.') },
  { type: 'day', series: 'egiohk', code: '082', name: pair('オレノオリーブ', 'Oreno Olive'), base: 'gold', back: '#7c7a3a', query: 'エギ王K オレノオリーブ',
    why: pair('自然なオリーブ色。人の多い堤防のスレたイカにも。', 'A natural olive for wary squid on busy piers.') },
  { type: 'day', series: 'patapata', code: 'RISE', name: pair('リアルイソスジエビ', 'Real Isosuji Shrimp'), base: 'keimura', back: '#d8c3a0', query: 'パタパタ イージーQ キャスト喰わせ リアルイソスジエビ',
    why: pair('本物のエビのような色。日中から夜まで使える万能色。', 'A real-shrimp look that works from day into night.') },
  { type: 'day', series: 'patapata', code: 'KVVP', name: pair('日中ピンク', 'Daytime Pink'), base: 'keimura', back: '#f07aa8', query: 'パタパタ イージーQ キャスト喰わせ 日中ピンク',
    why: pair('日中に目立たせたいときの一本。', 'For when you want to stand out in daylight.') },
  // 夜
  { type: 'night', series: 'egiohk', code: '080', name: pair('ボルカノロック', 'Volcano Rock'), base: 'red', back: '#5a3a2a', query: 'エギ王K ボルカノロック',
    why: pair('赤テープにこげ茶の背中。夜向けの暗い色。', 'Dark brown on red tape, built for the night.') },
  { type: 'night', series: 'egiohk', code: '006', name: pair('軍艦グリーン', 'Gunkan Green'), base: 'red', back: '#3f5a3a', query: 'エギ王K 軍艦グリーン',
    why: pair('赤テープに暗い緑。夜に実績のある色。', 'Dark green on red tape, a proven night color.') },
  { type: 'night', series: 'patapata', code: 'LYYR', name: pair('闇夜ローズ', 'Yamiyo Rose'), base: 'red', back: '#b23a5a', query: 'パタパタ イージーQ キャスト喰わせ 闇夜ローズ',
    why: pair('月の無い暗い夜向け。赤下地でシルエットがはっきり。', 'For moonless nights: the red base gives a clear outline.') },
  { type: 'night', series: 'patapata', code: 'SBTP', name: pair('お月見パープル', 'Otsukimi Purple'), base: 'glow', back: '#6a4aa0', query: 'パタパタ イージーQ キャスト喰わせ お月見パープル',
    why: pair('月の明るい夜に評判の色。', 'Well regarded on bright moonlit nights.') },
];

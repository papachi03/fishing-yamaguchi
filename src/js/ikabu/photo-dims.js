// 写真の縦横（px）。img に width/height を入れて、読み込み中にレイアウトが動かないようにする。
// 値は public/ の実ファイルから測ったもの（表示は CSS の aspect-ratio で切るので比率だけ合っていればよい）
const DIMS = {
  'own-aori': [800, 600],
  'own-mongo': [800, 600],
  'own-kouika': [800, 600],
  'own-yari': [800, 600],
  'own-dawn': [1440, 810],
  'own-lantern': [1280, 670],
  motonosumi: [1400, 860],
  coast: [1400, 1048],
  beach: [1400, 1050],
  reef: [1400, 1050],
  shiriyake: [1400, 1050],
  surume: [1400, 786],
  sodeika: [1400, 1050],
  firefly: [1400, 1050],
  giant: [933, 1400],
  humboldt: [1400, 1050],
  market: [1400, 1400],
  grilled: [1400, 1050],
  miso: [1400, 937],
  toyama: [1400, 933],
};

export const photoDims = (id) => DIMS[id] ?? [1400, 1050];

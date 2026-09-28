// 堤防釣りの安全判定。
//
// 風速・突風・波高・風向から 0〜3 の4段階で「今日、堤防に立てるか」を返す。
// 気象庁の警報・注意報が出ている時はそちらが優先。
//
// ★風速のしきい値は 2026-09-12 に 5/7/10 → 3/5/7 へ引き上げた。
//   萩で実際に釣りをしている地元の方に萩のデータを見てもらった結果
//   「風速3.0mを超えると釣りは厳しい。北風の時は特にきつい」との実感をいただいたため。
//   一般的な目安より厳しいが、山口の日本海側・北向きの堤防という実地の条件に合わせている。
//
// ★★ここが重要（二重補正を防ぐための記録・2026-09-12 ダディ情報）
//   予報の風速は実際の体感より弱く出る。**表示5m ≒ 体感7〜8m（およそ+2m/s）**。
//   上の 3/5/7 は「予報値（この数字そのもの）で判断する値」として決まっている。
//   地元の方も、このサイトに出ている予報値を見て「3.0mで厳しい」と言っている。
//   → **体感に合わせるつもりで、ここからさらに2を引いてはいけない。** 補正が二重にかかる。
//   Open-Meteo の生の値をそのまま表示し、しきい値の側で体感を織り込む設計にしてある。
//
//   風速   〜3 穏やか / 3〜5 注意 / 5〜7 危険 / 7〜 中止
//   突風   6〜 注意 / 10〜 危険（平均風速の1.5〜2倍になるのが普通。
//          2026-09-12に10/15→6/10へ。風速を3/5/7にしたので、平均の約2倍で揃えた）
//   波高   〜1.0 穏やか / 1.0〜1.2 注意 / 1.2〜1.5 危険 / 1.5〜 中止（堤防を波が洗う）
//   うねり 周期7秒以上 かつ 波高1.0以上 は1段階上げる
//   向かい風（海から陸へ吹く風）は波が立つので、風速3以上なら1段階上げる

// ---------------------------------------------------------------------------
// 海域別プロファイル。
//
// 日本海側（萩・長門・下関）と瀬戸内側（下松・防府）では、同じ風速でも
// 波の育ち方がまったく違う。実測（2026-09-13）でも波高は瀬戸内が約半分だった：
//   萩 0.40m / 周期4.5秒 ・ 下松 0.22m / 周期3.1秒 ・ 防府 0.20m / 周期2.7秒
//
// nihonkai: 風速3/5/7・突風6/10。萩の地元の釣り人の実感にもとづく厳しめの値
//           （開けた日本海で波が育つ前提。経緯は上のコメント参照）
// setouchi: 風速5/7/10・突風10/15。**一般的な目安に戻している。**
//           3/5/7は日本海特有の事情で厳しくした数字なので、根拠の及ばない
//           内海には適用しない、という整理。★この値は暫定。
//           下松・防府で実際に釣りをしている方に「何mから厳しいか」を
//           聞けたら、萩と同じやり方で確定させる（それまで暫定と明記する）。
//
// 波高のしきい値は両海域で共通のままにしてある。瀬戸内では通常0.2m前後なので
// 実質発動せず、判定は風速・突風が担う。ここも実感が聞けたら見直す。
export const SEA_PROFILES = {
  nihonkai: {
    label: '日本海側',
    labelEn: 'Sea of Japan side',
    wind: [3, 5, 7],
    gust: [6, 10],
    wave: [1.0, 1.2, 1.5],
    provisional: false,
  },
  setouchi: {
    label: '瀬戸内側',
    labelEn: 'Seto Inland Sea side',
    wind: [5, 7, 10],
    gust: [10, 15],
    wave: [1.0, 1.2, 1.5],
    provisional: true,
  },
};

export const profileOf = (key) => SEA_PROFILES[key] ?? SEA_PROFILES.nihonkai;

// labelEn / messageEn はイカ部の英語ページ用。label / message（日本語）は従来のまま
export const SAFETY_LEVELS = [
  // 一番下の段階は「安全」でなく「穏やか」（安全を保証するように読まれるため。SNS・紹介動画と表記をそろえる 2026-09-28 ぱっぱ）
  // 英語も同じ理由で SAFE でなく CALM（イカ部の英語ページ）
  { level: 0, key: 'ok', label: '穏やか', short: 'OK', message: '堤防で釣りができるコンディションです。', labelEn: 'CALM', messageEn: 'Conditions are fine for fishing from the breakwater.' },
  { level: 1, key: 'caution', label: '注意', short: '注意', message: '軽い仕掛けは流されます。港内・風裏を選んでください。', labelEn: 'CAUTION', messageEn: 'Light rigs will drift. Choose inside the harbor or the lee of the wind.' },
  { level: 2, key: 'danger', label: '危険', short: '危険', message: '外向きの堤防は避けてください。ライフジャケット必須。', labelEn: 'DANGER', messageEn: 'Avoid breakwaters facing the open sea. Life jacket required.' },
  { level: 3, key: 'stop', label: '中止', short: '中止', message: '今日は堤防に立たないでください。', labelEn: 'STOP', messageEn: 'Do not go out on the breakwater today.' },
];

// 判定理由の文言（lang='en' のときだけ英語。既定は従来の日本語）
const REASON = {
  ja: { wind: (v) => `風速${v}m/s`, gust: (v) => `突風${v}m/s`, wave: (v) => `波高${v}m`, swell: (p) => `周期${p}秒のうねり`, onshore: '向かい風（海から吹いて波が立つ）' },
  en: { wind: (v) => `wind ${v} m/s`, gust: (v) => `gusts ${v} m/s`, wave: (v) => `waves ${v} m`, swell: (p) => `swell with a ${p} s period`, onshore: 'onshore wind (blowing in from the sea, waves build)' },
};

// 風向(deg, 風が吹いてくる方角) が、海に向いた方角(facing) から ±60° 以内なら向かい風
export function isOnshore(windDir, facing) {
  if (windDir == null || facing == null) return false;
  const diff = Math.abs(((windDir - facing + 540) % 360) - 180);
  return diff <= 60;
}

// seaProfile を省略すると日本海側の基準（従来の挙動）になる
export function assessSafety({ wind, gust, waveHeight, wavePeriod, windDir, facing, seaProfile, alerts = [], lang = 'ja' }) {
  const pf = profileOf(seaProfile);
  const R = REASON[lang] ?? REASON.ja;
  const [w1, w2, w3] = pf.wind;
  const [g1, g2] = pf.gust;
  const [h1, h2, h3] = pf.wave;

  const reasons = [];
  let level = 0;
  const bump = (to, why) => {
    if (to > level) level = to;
    if (why) reasons.push(why);
  };

  if (wind != null) {
    if (wind >= w3) bump(3, R.wind(wind.toFixed(1)));
    else if (wind >= w2) bump(2, R.wind(wind.toFixed(1)));
    else if (wind >= w1) bump(1, R.wind(wind.toFixed(1)));
  }
  if (gust != null) {
    if (gust >= g2) bump(2, R.gust(gust.toFixed(1)));
    else if (gust >= g1) bump(1, R.gust(gust.toFixed(1)));
  }
  if (waveHeight != null) {
    if (waveHeight >= h3) bump(3, R.wave(waveHeight.toFixed(1)));
    else if (waveHeight >= h2) bump(2, R.wave(waveHeight.toFixed(1)));
    else if (waveHeight >= h1) bump(1, R.wave(waveHeight.toFixed(1)));
    if (wavePeriod != null && wavePeriod >= 7 && waveHeight >= h1) {
      bump(Math.min(3, level + 1), R.swell(wavePeriod.toFixed(0)));
    }
  }
  // 気象庁の注意報・警報（2026-09-29 から実際に取得）：注意報は「危険」以上、警報・特別警報は「中止」。公式の発表を最優先
  for (const a of alerts ?? []) bump(a.kind === 'warning' ? 3 : 2, a.name);
  // 向かい風の発動ラインは、その海域の「注意」のしきい値に合わせる
  if (wind != null && wind >= w1 && isOnshore(windDir, facing)) {
    bump(Math.min(3, level + 1), R.onshore);
  }

  const lv = SAFETY_LEVELS[level];
  // 英語のときは label / message を英語に差し替えて返す（呼び出し側の取り出し方は同じ）
  return lang === 'en' ? { ...lv, label: lv.labelEn, message: lv.messageEn, reasons } : { ...lv, reasons };
}

// 凡例の文字列（海域ごとに数字が変わるので、画面側で使い回せるようにする）
export function legendText(seaProfile, lang = 'ja') {
  const pf = profileOf(seaProfile);
  const [w1, w2, w3] = pf.wind;
  const [h1, h2, h3] = pf.wave;
  if (lang === 'en') return `Wind up to ${w1} calm / ${w1}–${w2} caution / ${w2}–${w3} danger / ${w3}+ stop · Wave ${h1.toFixed(1)} / ${h2.toFixed(1)} / ${h3.toFixed(1)} m`;
  return `風速 〜${w1} 穏やか / ${w1}〜${w2} 注意 / ${w2}〜${w3} 危険 / ${w3}〜 中止 ・ 波高 ${h1.toFixed(1)} / ${h2.toFixed(1)} / ${h3.toFixed(1)}m`;
}

// 時間別テーブルのセル用（その項目だけで段階を返す）。
// 第2引数を省略すると日本海側の基準になる（従来の呼び出しと互換）。
export const windLevel = (v, seaProfile) => {
  if (v == null) return 0;
  const [a, b, c] = profileOf(seaProfile).wind;
  return v >= c ? 3 : v >= b ? 2 : v >= a ? 1 : 0;
};
export const gustLevel = (v, seaProfile) => {
  if (v == null) return 0;
  const [a, b] = profileOf(seaProfile).gust;
  return v >= b ? 2 : v >= a ? 1 : 0;
};
export const waveLevel = (v, seaProfile) => {
  if (v == null) return 0;
  const [a, b, c] = profileOf(seaProfile).wave;
  return v >= c ? 3 : v >= b ? 2 : v >= a ? 1 : 0;
};

// 「今日のエギの色」を決める（2026-09-27）。毎朝の堤防判定（X投稿の下書き）に1行足すために使う。
// 考え方は山口イカ部の記事「部員おすすめ：新子シーズンのエギ選び」と同じ：
//   下地（テープ）＝光ったときの見え方、背中の色＝どれだけ目立たせるか。
//   晴れた日中・夕方は金、曇り・雨はケイムラ、濁り・夜は赤テープのシルエット、月夜はケイムラ・紫。
// 天気は毎朝の判定と同じ萩の予報ファイル（sea-snapshot.json の hourly）から取り、月の明るさは日付から計算する。
// ブラウザのAPIに触らないこと（Worker と Node から使う）。

// 新子シーズン（9〜11月）だけ出す。冬・春は記事がまだ無いので出さない
export const EGI_MONTHS = [9, 10, 11];

// 天気コード（WMO）：0〜1 晴れ／2〜3・霧 くもり／51以上 雨・雪
const isRain = (code) => code != null && code >= 51;
const isClear = (code) => code != null && code <= 1;

/** 月齢（0〜29.5。0＝新月、約14.8＝満月）。2000-01-06 18:14 UTC の新月から数える */
export function moonAge(date) {
  const SYNODIC = 29.530588853;
  const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  return ((days % SYNODIC) + SYNODIC) % SYNODIC;
}

/** 日本時間の「YYYY-MM-DDTHH:00」 */
const jstKey = (date, hour) => {
  const j = new Date(date.getTime() + 9 * 3600 * 1000);
  return `${j.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00`;
};

/**
 * @param {{date: Date, weather: {current?: object, hourly?: object[]}|null}} args  weather は萩の予報
 * @returns {null | {dusk: string, night: string, murky: boolean, moon: number, moonBright: boolean, line: string, reason: string}}
 *   シーズン外・予報が無い日は null（その日は行を出さない）
 */
export function egiColorOfDay({ date, weather }) {
  const month = new Date(date.getTime() + 9 * 3600 * 1000).getUTCMonth() + 1;
  if (!EGI_MONTHS.includes(month) || !weather?.hourly?.length) return null;
  const at = (h) => weather.hourly.find((x) => x.time === jstKey(date, h)) ?? null;
  const dusk = [at(17), at(18)].filter(Boolean);
  const night = at(21);
  if (!dusk.length) return null;

  // 濁りがありそう：今日の夕方までに雨の予報、今雨が降っている、夕方までに波1m以上
  const today = weather.hourly.filter((x) => x.time >= jstKey(date, 0) && x.time <= jstKey(date, 18));
  const murky =
    today.some((x) => isRain(x.code)) ||
    (weather.current?.precipitation ?? 0) > 0.5 ||
    today.some((x) => (x.wave ?? 0) >= 1.0);
  const duskClear = dusk.every((x) => isClear(x.code));
  const age = moonAge(date);
  const moonBright = age >= 10 && age <= 19 && night != null && !isRain(night.code) && night.code <= 2;

  // Xの残りが40字分しかないので短い言い方にする（詳しくは reason に書き、Discordでダディが読む）
  const duskColor = murky ? 'オレンジ×赤' : duskClear ? 'オレンジ×金' : 'ケイムラ';
  const nightColor = murky ? '赤テープ' : moonBright ? 'ケイムラ' : '赤テープ';

  const why = [];
  if (murky) why.push('雨や波で濁りがありそうなので、夕方も夜も赤テープでシルエットを出す（夜は背中が暗い色）');
  else if (duskClear) why.push('夕方は晴れ予報なので、金テープで光らせる');
  else why.push('夕方はくもり予報なので、ケイムラ（オレンジ・ピンク系）で光らせる');
  if (!murky) why.push(moonBright ? `今夜は月が明るい（月齢${Math.round(age)}）のでケイムラや紫` : `今夜は月が暗い（月齢${Math.round(age)}）ので赤テープで背中が暗い色`);

  return {
    dusk: duskColor,
    night: nightColor,
    murky,
    moon: Math.round(age * 10) / 10,
    moonBright,
    line: `🦑エギ色 夕:${duskColor} 夜:${nightColor}`,
    reason: why.join('。') + '。',
  };
}

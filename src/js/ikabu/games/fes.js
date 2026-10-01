// ガチャ限定フェスとシークレットカード（2026-10-01 ぱっぱ×小松さんの計画）。純粋な部分だけ（画面は gacha-page / binder-ui）
//   ・カードの limit：{ fes: '<フェスID>' }＝そのフェスのガチャだけに出る／{ secret: 'mazume'|'night' }＝時間帯が合う時だけ混ざる（告知しない）
//   ・フェスの限定カードは、同じレア度の中で boost 倍 出やすい（フェスを引く理由）。天井・確率の段はそのまま
//   ・期間が終わっても、持っている人のバインダーと対戦ではそのまま使える
const pair = (ja, en) => ({ ja, en });   // i18n.js は import.meta.env を触るので、ここでは使わない（node のテストから読めるように）

export const FES = [
  {
    id: 'autumn2026',
    name: pair('秋の弾幕新子ウェーブフェス！', 'Autumn Baby-Squid Wave Fest!'),
    short: pair('🍂 秋フェス限定', '🍂 Autumn fest only'),
    from: '2026-10-10', until: '2026-11-30',   // 日本時間の日付（両端を含む）
    banner: '/assets/ikabu/gacha/banner_fes_autumn2026.webp',
    cards: [121, 122, 123],
    boost: 3,
  },
  {
    id: 'winter2026',
    name: pair('真冬のヤリイカスナイプフェス！', 'Midwinter Spear-Squid Snipe Fest!'),
    short: pair('❄️ 冬フェス限定', '❄️ Winter fest only'),
    from: '2026-12-10', until: '2027-02-28',
    banner: '/assets/ikabu/gacha/banner_fes_winter2026.webp',
    cards: [126, 127, 128],
    boost: 3,
  },
  {
    id: 'spring2027',
    name: pair('春の親イカラッシュフェス！', 'Spring Big-Mama Rush Fest!'),
    short: pair('🌸 春フェス限定', '🌸 Spring fest only'),
    from: '2027-03-10', until: '2027-05-10',
    banner: '/assets/ikabu/gacha/banner_fes_spring2027.webp',
    cards: [129, 130, 131],
    boost: 3,
  },
  {
    id: 'summer2027',
    name: pair('初夏のBIGモンスターフェス！', 'Early-Summer BIG Monster Fest!'),
    short: pair('🌊 初夏フェス限定', '🌊 Early-summer fest only'),
    from: '2027-05-20', until: '2027-07-31',
    banner: '/assets/ikabu/gacha/banner_fes_summer2027.webp',
    cards: [132, 133, 134],
    boost: 3,
  },
];
export const NORMAL_BANNER = '/assets/ikabu/gacha/banner_normal.webp';

// シークレットの条件（時間帯）。ここ以外の文章には書かない（見つけた人が広める作り）
const SECRET_WHEN = {
  mazume: (tod) => tod === 'morning' || tod === 'evening',
  night: (tod) => tod === 'night',
};

// 日本時間の日付と時刻
export function jst(now = new Date()) {
  const d = new Date(now.getTime() + 9 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}
// 時間帯：朝マズメ 4〜8時、昼 9〜15時、夕マズメ 16〜18時、夜 19〜翌3時
export function todOf(hour) {
  if (hour >= 4 && hour <= 8) return 'morning';
  if (hour >= 9 && hour <= 15) return 'day';
  if (hour >= 16 && hour <= 18) return 'evening';
  return 'night';
}

export const fesById = (id) => FES.find((f) => f.id === id) ?? null;
export const isFesActive = (f, date) => Boolean(f) && f.from <= date && date <= f.until;
// いま開催中のフェス（無ければ null）。force＝確認用（DEV・試遊版だけ）
export function activeFes(now = new Date(), { force = null } = {}) {
  if (force) return fesById(force);
  const { date } = jst(now);
  return FES.find((f) => isFesActive(f, date)) ?? null;
}

export const isLimited = (c) => Boolean(c.limit);
// まだ始まっていないフェスのカード（バインダーでは名前もフェス名も出さない＝「？？？」）
export const isUpcoming = (c, now = new Date()) => { const f = fesOf(c); return Boolean(f) && jst(now).date < f.from; };
export const isSecret = (c) => Boolean(c.limit?.secret);
export const fesOf = (c) => (c.limit?.fes ? fesById(c.limit.fes) : null);

// ガチャの抽選に入れるカード。banner：'normal' か フェスID
export function gachaPool(cards, { banner = 'normal', tod = 'day' } = {}) {
  return cards.filter((c) => {
    if (!c.limit) return true;
    if (c.limit.fes) return c.limit.fes === banner;
    if (c.limit.secret) return Boolean(SECRET_WHEN[c.limit.secret]?.(tod));
    return false;
  });
}
// 同じレア度の中での重み（フェスの限定カードだけ boost 倍）
export function weightFor(banner) {
  const f = fesById(banner);
  return (c) => (f && c.limit?.fes === f.id ? f.boost : 1);
}

// バインダーに出す帯。シークレットは null（持っていてもどこで出たかは書かない）
export function limitLabel(c, lang = 'ja', { short = false } = {}) {
  const f = fesOf(c);
  if (!f) return null;
  if (short) return lang === 'en' ? f.short.en : f.short.ja;
  return lang === 'en' ? `Fest only: ${f.name.en}` : `フェス限定：${f.name.ja}`;
}
export function fesPeriod(f, lang = 'ja') {
  const md = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
  return lang === 'en' ? `${md(f.from)} – ${md(f.until)}` : `${md(f.from)}〜${md(f.until)}`;
}

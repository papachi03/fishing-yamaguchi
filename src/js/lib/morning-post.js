// 毎朝の「堤防判定」をXに投稿するための文章を作る（投稿はダディが手で行う）。
// ブラウザのAPIに触らないこと（GitHub Actions の Node から使う）。

// サイトの「安全」はSNSでは「穏やか」と言い換える。
// SNSで「安全」と書くと保証のように読まれるため（2026-09-22 ダディ了承）
export const X_LABELS = [
  { level: 0, mark: '🟢', label: '穏やか' },
  { level: 1, mark: '🟡', label: '注意' },
  { level: 2, mark: '🟠', label: '危険' },
  { level: 3, mark: '🔴', label: '中止' },
];

export const HASHTAGS = ['#山口県', '#釣り', '#堤防釣り'];

export const SEA_URL = 'https://yamaguchifishing.com/sea.html?utm_source=x&utm_medium=social&utm_campaign=morning';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/** 日本時間の「9/23(火)」 */
export function jstDateLabel(date) {
  const j = new Date(date.getTime() + 9 * 3600 * 1000);
  return `${j.getUTCMonth() + 1}/${j.getUTCDate()}(${WEEK[j.getUTCDay()]})`;
}

/**
 * @param {{date: Date, rows: {nameJa: string, level: number|null, wind: number|null}[]}} args
 *   level が null のエリアは予報を取れなかったもの
 */
export function composeMorningPost({ date, rows }) {
  const lines = rows.map(({ nameJa, level, wind }) => {
    if (level == null) return `${nameJa}　⚪ 取得できず`;
    const l = X_LABELS[level];
    return `${nameJa}　${l.mark}${l.label}　風${wind.toFixed(1)}m`;
  });
  return [
    `【${jstDateLabel(date)} 朝の堤防判定】`,
    ...lines,
    '※予報値の目安です。気象庁の注意報・警報を優先してください',
    SEA_URL,
    HASHTAGS.join(' '),
  ].join('\n');
}

/**
 * Xの文字数の数え方（おおよそ）。日本語などは1文字2、英数字は1、URLは何文字でも23。
 * 上限は280。
 */
export function xWeightedLength(text) {
  let n = 0;
  const rest = text.replace(/https?:\/\/\S+/g, () => {
    n += 23;
    return '';
  });
  for (const ch of rest) {
    const cp = ch.codePointAt(0);
    const light =
      (cp >= 0x0000 && cp <= 0x10ff) ||
      (cp >= 0x2000 && cp <= 0x200d) ||
      (cp >= 0x2010 && cp <= 0x201f) ||
      (cp >= 0x2032 && cp <= 0x2037);
    n += light ? 1 : 2;
  }
  return n;
}

export const X_LIMIT = 280;

/** 文章が入った状態でXの投稿画面を開くリンク */
export const xIntentUrl = (text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

/** Discordに送る本文（下書き＋「Xで投稿する」リンク）。最長でも約1350字でDiscordの上限2000字に収まる */
export function morningDiscordContent(text, allFailed = false) {
  return [
    allFailed ? '⚠ 今朝は予報を取得できませんでした（下書きは参考になりません）' : '🌅 朝の堤防判定（X投稿の下書き）',
    '```',
    text,
    '```',
    `👉 **Xで投稿する**（タップすると文章入りで開きます）\n${xIntentUrl(text)}`,
  ].join('\n');
}

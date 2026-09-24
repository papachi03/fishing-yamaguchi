// studio：スタンプとSNS。render(lang) は HTML 文字列を返すだけ（DOM・window に触らない）。操作は無い。
// SNS はどちらも「準備中」。実在しないアカウントへのリンクは置かない
import { t, pair, esc, assetHref } from '../i18n.js';
import { puns } from '../data.js';
import { pageHead, sectionHead, noteHTML } from './parts.js';

export const HEAD = {
  num: '07',
  eyebrow: 'STICKERS, STORIES & LITTLE JOKES',
  title: pair('イカしたことばを、世界へ。', 'A little ink. A little wit.'),
  desc: pair('紺とオレンジのイカが、会話にも登場。スタンプ試作と、ダジャレの解説、これからの発信。', 'Our navy-and-orange squid joins the conversation. Sticker concepts, pun explanations and the stories we want to tell.'),
};

const SHEETS = [
  {
    file: '/assets/ikabu/stickers-vol1.webp',
    vol: 'VOL. 1',
    alt: pair('第1弾スタンプ試作8点。「いかが？」「いかしてる！」「いからないで！」「まぁ、いっか。」「いかんせん、眠い。」「もう、いかん。」「いかないで！」「いかほど？」', 'Eight volume-one sticker concepts with Japanese squid puns: ikaga?, ikashiteru!, ikaranaide!, maa ikka, ikansen nemui, mou ikan, ikanaide!, ikahodo?'),
    title: pair('イカの言葉で、ごあいさつ。', 'A squid has something to say.'),
    body: pair('「いからないで！」「まぁ、いっか。」<br />いつもの会話に、ちょっとイカした返しを。', '“Ika-ranaide!” means “Don’t get angry,” with ika, squid, hidden inside. “Maa, ikka” means “Oh well.” Japanese wordplay is part of the fun.'),
    tag: pair('LINEスタンプ：販売準備前のデザイン案', 'LINE stickers: design concepts, not on sale'),
  },
  {
    file: '/assets/ikabu/stickers-vol2.webp',
    vol: 'VOL. 2',
    alt: pair('第2弾・山口の地名ダジャレスタンプ試作8点。「防府く絶倒！」「萩れよく、いこう！」「絶好長州！」「ふくみ笑い。」「ふくざつな気持ち。」「おいでませ、すみ家へ。」「ぶち、イカん予感。」「関門だらけじゃ！」', 'Eight volume-two sticker concepts playing on Yamaguchi place names: Hōfu, Hagi, Chōshū, fugu (Shimonoseki’s pufferfish), the Kanmon strait and the local word buchi.'),
    title: pair('地名まで、ダジャレに。', 'Even the place names join in.'),
    body: pair('「防府く絶倒！」「絶好長州！」<br />山口を知ると、もうひとつ笑える。', '“Hōfu-ku zettō” folds the city of Hōfu into a phrase for helpless laughter. Chōshū is the historical name of the region, and fuku is what Shimonoseki calls its famous pufferfish.'),
    tag: pair('第2弾：ご当地ネタを展開', 'Volume two: a local twist'),
  },
];

const SOCIAL = [
  {
    mark: 'YouTube',
    title: pair('一杯のイカ、海から食卓まで。', 'One squid, from coast to kitchen.'),
    body: pair('まずは「3分でわかるイカの下処理」「山口の海の一日」「墨つなぎの連鎖チャレンジ」。日本語音声＋英語字幕の短い動画を企画中。', 'Planned episodes: a three-minute squid preparation guide, a day on Yamaguchi’s coast, and an Ink Link combo challenge. Japanese audio with English subtitles.'),
    small: pair('チャンネルはまだ開設していません。公開後にここから案内します。', 'The channel has not launched yet. Its link will appear here when ready.'),
  },
  {
    mark: 'Instagram',
    title: pair('写真一枚と、イカした一言。', 'One picture. One ink-redible line.'),
    body: pair('海の写真、食卓の一皿、ダジャレのスタンプ。日本語と英語の短い説明を添えて、釣りをしない人にも届ける投稿を企画中。', 'Coastal photographs, a plate from the kitchen and a squid-pun sticker. Short captions in Japanese and English for anglers and non-anglers alike.'),
    small: pair('部のアカウントはまだ開設していません。投稿写真の募集も準備中です。', 'The club account has not launched yet. A member-photo submission process is also being planned.'),
  },
];

export function render(lang) {
  const sheets = SHEETS.map(
    (s) => `
    <article class="ika-sheet">
      <figure class="ika-sheet-figure">
        <img src="${assetHref(s.file)}" alt="${esc(t(lang, s.alt))}" width="1536" height="1024" loading="lazy" decoding="async" />
        <span class="ika-sheet-vol">${s.vol}</span>
      </figure>
      <h2>${t(lang, s.title)}</h2>
      <p>${t(lang, s.body)}</p>
      <span class="ika-tag">${t(lang, s.tag)}</span>
    </article>`
  ).join('');

  const punCards = puns
    .map(
      (p) => `
    <article class="ika-pun">
      <p class="ika-pun-jp" lang="ja">${esc(p.jp)}</p>
      <p class="ika-pun-en" lang="en">${esc(p.en)}</p>
      <p class="ika-pun-note">${t(lang, p.note)}</p>
    </article>`
    )
    .join('');

  const social = SOCIAL.map(
    (s) => `
    <article class="ika-social">
      <span class="ika-tag ika-tag--orange">${t(lang, '開設準備中', 'In preparation')}</span>
      <p class="ika-social-mark">${s.mark}</p>
      <h3>${t(lang, s.title)}</h3>
      <p>${t(lang, s.body)}</p>
      <small>${t(lang, s.small)}</small>
    </article>`
  ).join('');

  return `${pageHead(lang, HEAD)}
  <section class="ika-section ika-studio-section">
    <div class="wrap">
      <div class="ika-sheets">${sheets}</div>
      ${noteHTML(lang, {
        label: pair('スタンプについて', 'About the stickers'),
        html: `<p>${t(lang, 'キャラクターは AI 生成をもとに部で整えたデザイン案です。販売前に地域ブランド名の扱いや権利を確認します。', 'The character artwork is a club design concept developed from AI-generated drafts. Rights and the use of regional brand names will be checked before anything goes on sale.')}</p>`,
      })}
    </div>
  </section>

  <section class="ika-section ika-section--tint">
    <div class="wrap">
      ${sectionHead(lang, { num: 'PUN', en: 'INK-REDIBLE WORDS', title: pair('ダジャレの仕組み', 'How the puns work'), note: pair('「イカ」は日本語のいろいろな言葉に隠れています。海外の部員にも笑ってもらえるように、種明かしを。', 'The word ika hides inside all sorts of Japanese phrases. Here is how each one works, so overseas members can laugh along.') })}
      <div class="ika-puns">${punCards}</div>
    </div>
  </section>

  <section class="ika-section">
    <div class="wrap">
      ${sectionHead(lang, { num: 'SOON', en: 'COMING TO YOUR FEED', title: pair('海の一日を、短い物語に。', 'Small stories from the coast.'), note: pair('どちらも準備中。開設したら、ここに本物のリンクを置きます。', 'Both are in preparation. Real links will appear here once they launch.') })}
      <div class="ika-socials">${social}</div>
    </div>
  </section>`;
}

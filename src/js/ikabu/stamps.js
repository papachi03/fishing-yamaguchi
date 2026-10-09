// 山口イカ部の動くLINEスタンプ（2026-10-04）。3セット同時に 2026-10-10 発売（販売開始ボタンはぱっぱ・小松さんと決定）。
// 発売したら storeUrl に LINE STORE のページの住所を入れる（入っていない間は「10月10日 発売」と出す）。
// 絵はサイト用に軽くした動くWebP（/assets/ikabu/stamps/vol*/01〜08.webp・幅200）。元は C:\Users\my\ikabu-stamps\out\vol*\
import { pair } from './i18n.js';

export const STAMP_RELEASE = pair('2026年10月10日 発売', 'On sale October 10, 2026');
// TOP・あそび場TOP の帯に出す4つ（[セット, 番号]）
export const STAMP_PICKS = [['vol1', '01'], ['vol3', '03'], ['vol2', '01'], ['vol3', '06']];
export const STAMP_COPYRIGHT = '(C)2026 Yamaguchi Ika-bu';

export const STAMP_SETS = [
  {
    id: 'vol1',
    vol: 'VOL. 1',
    title: pair('動く！イカしたダジャレ', 'Squid Puns! Animated'),
    desc: pair('「いかが？」「もう、いかん。」など、毎日のあいさつや返事に使える8種類。', 'Eight everyday greetings and replies, each with a squid pun hidden inside.'),
    storeUrl: 'https://line.me/S/sticker/36965902',
    words: [
      pair('いかが？', 'How about it?'), pair('いかしてる！', 'Looking sharp!'), pair('いからないで！', 'Don’t get angry!'), pair('まぁ、いっか。', 'Oh well.'),
      pair('いかんせん、眠い。', 'Sadly, so sleepy.'), pair('もう、いかん。', 'I’m done for.'), pair('いかないで！', 'Don’t go!'), pair('いかほど？', 'How much?'),
    ],
  },
  {
    id: 'vol2',
    vol: 'VOL. 2',
    title: pair('動く！山口ご当地ダジャレ', 'Local Puns! Animated'),
    desc: pair('防府・萩・長州・ふく・関門…山口の言葉で、イカがダジャレを言いながら動きます。', 'Puns on places and words from Yamaguchi: Hōfu, Hagi, Chōshū, fuku and the Kanmon Strait.'),
    storeUrl: 'https://line.me/S/sticker/36965909',
    words: [
      pair('防府く絶倒！', 'Hōfu-ku zettō!'), pair('萩れよく、いこう！', 'Hagi-re yoku, ikō!'), pair('絶好長州！', 'Zekkō Chōshū!'), pair('ふくみ笑い。', 'Fuku-mi warai.'),
      pair('ふくざつな気持ち。', 'Fuku-zatsu na kimochi.'), pair('おいでませ、すみ家へ。', 'Oidemase, sumika e.'), pair('ぶち、イカん予感。', 'Buchi, ikan yokan.'), pair('関門だらけじゃ！', 'Kanmon darake ja!'),
    ],
  },
  {
    id: 'vol3',
    vol: 'VOL. 3',
    title: pair('動く！毎日使えるイカ返事', 'Replies! Animated'),
    desc: pair('「飲みにイカない？」「イカ同文」「やるしかなイカ」など、誘う・了解・ほめる・はげます時に。', 'Invite, agree, praise, cheer up and calm down — eight squid-pun replies.'),
    storeUrl: 'https://line.me/S/sticker/36987873',
    words: [
      pair('飲みにイカない？', 'Drinks tonight?'), pair('イカせていただきます', 'I’ll be there.'), pair('イーカんじ！', 'Looking good!'), pair('納得イカない！', 'Not convinced!'),
      pair('イカ同文', 'Ditto.'), pair('いいじゃなイカ！', 'Not bad at all!'), pair('やるしかなイカ', 'Only one way: do it.'), pair('イカりを下ろして落ち着こ', 'Drop anchor and calm down.'),
    ],
  },
];

// ダジャレの種明かし（海外の人にも仕組みが伝わるように）。3セットから3つずつ
export const STAMP_PUNS = [
  { jp: 'いかが？', en: 'How about it?', note: pair('「イカ」と「いかが（どう？）」をかけた、あいさつの定番。', 'Ika means squid. Ikaga means “how about…?”') },
  { jp: 'いかしてる！', en: 'Looking sharp!', note: pair('「いかす（かっこいい）」にイカが隠れている。', 'Ikasu is old slang for “cool” — with ika inside.') },
  { jp: 'もう、いかん。', en: 'I’m done for.', note: pair('「いかん（だめだ）」。山口でもよく使う言い方。', 'Ikan means “no good” — a phrase you hear a lot in western Japan.') },
  { jp: '防府く絶倒！', en: 'Hōfu-ku zettō!', note: pair('山口の「防府（ほうふ）」と「抱腹絶倒（大笑い）」。', 'Folds the city of Hōfu into hōfuku zettō, “to roar with laughter.”') },
  { jp: '絶好長州！', en: 'Zekkō Chōshū!', note: pair('「絶好調」と、山口の昔の呼び名「長州」。', 'Zekkōchō means “in top form”; Chōshū is Yamaguchi’s historical name.') },
  { jp: 'ふくみ笑い。', en: 'Fuku-mi warai.', note: pair('「含み笑い」と、下関でのフグの呼び名「ふく」。', 'Fukumi-warai is a quiet chuckle; fuku is what Shimonoseki calls pufferfish.') },
  { jp: 'イカ同文', en: 'Ditto.', note: pair('「以下同文（同じです）」の「以下」がイカに。', 'Ika dōbun, “same as above,” sounds exactly like “squid, same text.”') },
  { jp: 'やるしかなイカ', en: 'Only one way: do it.', note: pair('「やるしかないか」の最後がイカ。', '“Yaru shika nai ka” — there’s no choice but to do it — ends in ika.') },
  { jp: 'イカりを下ろして落ち着こ', en: 'Drop anchor and calm down.', note: pair('「怒り」と船の「錨（いかり）」。どちらもイカり。', 'Ikari means both “anger” and a ship’s “anchor.”') },
];

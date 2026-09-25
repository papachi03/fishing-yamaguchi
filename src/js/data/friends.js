// 山口の釣り仲間（山口県で活動している釣りYouTuber）の紹介。ABOUTの「Friends」欄とHOMEの入口で使う。
// 紹介文はダディの言葉から作る（クロロが想像で書き足さない）。
// 掲載はご本人の了承済み：名釣心技さん 2026-09-25 LINEで「私のことは遠慮なくご自由にお使いください」。
// 仲間が増えたら、ここに1件足すだけで欄に並ぶ。

export const friends = [
  {
    id: 'meicho-shingi',
    name: '名釣心技',
    kana: 'めいちょうしんぎ',
    nameEn: 'MEICHO SHINGI',
    area: '下関',
    icon: '/assets/friends/meicho-shingi.webp',
    channelUrl: 'https://www.youtube.com/@meichoshingi2246',
    tags: ['バケヒラ', 'チヌ', '青物', 'イカ', 'クワガタ'],
    intro: [
      '夏はバケヒラ、チヌ釣りから青物、イカ釣りまでなんでもこなす、下関の釣りYouTuberです。',
      'クワガタを追う姿も必見。シイラとの死闘など、見どころがたくさんあるチャンネルです。',
    ],
    // ダディとのつながり（ダディの言葉）
    story: '息子が憧れて「会いたい」と言ったのをきっかけに連絡し、初めてコラボが実現した方です。',
    // Childダディ側のコラボ動画（YouTube の動画ID）
    collabs: [
      { id: 'vi4yyKhU98s', title: '【ショアジギング】コラボのパワーを使ったらまさかの展開！大型回遊魚を追い求めた記録4Day【青物】' },
      { id: 'sbJy33RDEtw', title: '【コウイカ】名釣さんファミリーとコウイカ調査してきました【コラボ】' },
      { id: 'EHS6L5Y-4UI', title: '【灯火フィッシング】同県YouTuberさんと一緒に灯火フィッシングしたら凄い数の◯◯◯が集まった！【チャンネルコラボ】' },
      { id: 'gc1c6fg2hU0', title: '【ヤリイカ】明かりはNGの常識を覆す新ヤリイカ釣法【灯火フィシング】' },
    ],
  },
];

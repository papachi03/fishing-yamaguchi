// 「風と波」の英語ページ用：YFJ の sea-render.js が作る日本語の HTML を、見出し・単位・凡例だけ英語に置き換える。
// sea-render.js 自体は YFJ 本体（sea.html）と共用なので触らない。ここで「出てくると分かっている文字列」だけを直す。
// 置き換えきれずに日本語のまま残るもの：天気の名前（晴れ・曇り）、期待値の一言メッセージ、今月の旬の魚名、
// 観測地点名・釣り場名（固有名詞）。ページ側の「読み方」欄で補っている。
// ブラウザの API に触らない純粋関数（node --test で試せる）。

const AREA_NAMES = [
  ['萩', 'Hagi'],
  ['長門', 'Nagato'],
  ['下関', 'Shimonoseki'],
  ['下松', 'Kudamatsu'],
  ['防府', 'Hofu'],
];

const TIDE_NAMES = [
  ['大潮', 'spring tide'],
  ['中潮', 'medium tide'],
  ['小潮', 'neap tide'],
  ['長潮', 'long tide'],
  ['若潮', 'young tide'],
];

// 順番に意味がある：長い文を先に、短い語を後に（短い語を先に替えると長い文が壊れる）
const RULES = [
  // 見出し・取得中
  [/海況を取得しています…/g, 'Loading sea conditions…'],
  [/天気・風・波の予報を取得できませんでした。時間をおいて開き直してください。潮汐と基準は下に表示しています。/g, 'The weather, wind and wave forecast could not be loaded. Please try again later. Tide and safety thresholds are shown below.'],
  [/最新の予報を取得できなかったため、([\d/ :]+) 時点の予報を表示しています。/g, 'The latest forecast could not be loaded; showing the forecast as of $1.'],
  [/([\d/]+ \d\d:\d\d) 時点の予報/g, 'Forecast as of $1'],
  ...AREA_NAMES.map(([ja, en]) => [new RegExp(`>${ja}の海<`, 'g'), `>${en} coast<`]),
  // いま（天気・気温・風・突風・波）
  [/降水確率 最大 /g, 'Rain chance up to '],
  [/（[北南東西]+）/g, ''],
  [/aria-label="風向 [^"]*"/g, 'aria-label="Wind direction"'],
  [/>突風</g, '>Gust<'],
  [/周期 (\d+)秒/g, 'Period $1 s'],
  [/>波高</g, '>Wave height<'],
  // 安全判定
  [/safety-badge">安全</g, 'safety-badge">SAFE<'],
  [/safety-badge">注意</g, 'safety-badge">CAUTION<'],
  [/safety-badge">危険</g, 'safety-badge">DANGER<'],
  [/safety-badge">中止</g, 'safety-badge">STOP<'],
  [/堤防で釣りができるコンディションです。/g, 'Conditions are fine for fishing from the breakwater.'],
  [/軽い仕掛けは流されます。港内・風裏を選んでください。/g, 'Light rigs will drift. Choose inside the harbor or the lee of the wind.'],
  [/外向きの堤防は避けてください。ライフジャケット必須。/g, 'Avoid breakwaters facing the open sea. Life jacket required.'],
  [/今日は堤防に立たないでください。/g, 'Do not go out on the breakwater today.'],
  [/周期(\d+)秒のうねり/g, 'swell with a $1 s period'],
  [/向かい風（海から吹いて波が立つ）/g, 'onshore wind (waves build)'],
  [/ ／ 海からの風/g, ' / onshore wind'],
  [/風速([\d.]+)m\/s/g, 'Wind $1 m/s'],
  [/突風([\d.]+)m\/s/g, 'Gust $1 m/s'],
  [/波高([\d.]+)m/g, 'Wave $1 m'],
  [/風速 〜(\d+) 安全 \/ (\d+)〜(\d+) 注意 \/ (\d+)〜(\d+) 危険 \/ (\d+)〜 中止 ・ 波高 ([\d.]+) \/ ([\d.]+) \/ ([\d.]+)m/g, 'Wind up to $1 safe / $2–$3 caution / $4–$5 danger / $6+ stop ・ Wave $7 / $8 / $9 m'],
  [/（日本海側の基準）/g, ' (Sea of Japan thresholds)'],
  [/（瀬戸内側の基準）/g, ' (Seto Inland Sea thresholds)'],
  [/。気象庁の注意報・警報が出ている時はそちらを優先/g, '. JMA advisories and warnings always take precedence'],
  [/ ／ この海域のしきい値は暫定です/g, ' / thresholds for this area are provisional'],
  [/数字は予報値です。海の上では<strong>\+2m\/sほど強く感じます<\/strong>（表示5m ≒ 体感7〜8m）。上のしきい値はその体感を織り込んであります/g, 'Numbers are forecast values. On the water the wind <strong>feels about 2 m/s stronger</strong> (5 m/s shown ≈ 7–8 m/s felt). The thresholds above already allow for that.'],
  // 期待値
  [/Bite — 今の期待値/g, 'Bite — expectation right now'],
  [/・月齢/g, ' · moon age '],
  ...TIDE_NAMES.map(([ja, en]) => [new RegExp(ja, 'g'), en]),
  [/潮止まり前後/g, 'around slack tide'],
  [/潮がよく動く時間帯/g, 'tide moving well'],
  [/まずめ時/g, 'twilight (mazume)'],
  [/aria-label="10段階中(\d+)"/g, 'aria-label="$1 out of 10"'],
  [/>潮の動き</g, '>Tide flow<'],
  [/>まずめ</g, '>Twilight<'],
  [/>潮回り</g, '>Tide type<'],
  [/日出 /g, 'Sunrise '],
  [/ \/ 日入 /g, ' / Sunset '],
  [/潮の動き・まずめ・潮回りから算出した独自の目安です（実釣を保証するものではありません）。/g, 'Our own estimate from tide flow, twilight and tide type. It does not guarantee a catch.'],
  // 時間別
  [/Hourly — 時間別/g, 'Hourly — next 24 hours'],
  [/<th>時刻<\/th>/g, '<th>Time</th>'],
  [/<th>天気<\/th>/g, '<th>Weather</th>'],
  [/<th>気温 °C<\/th>/g, '<th>Temp °C</th>'],
  [/<th>降水 %<\/th>/g, '<th>Rain %</th>'],
  [/<th>風 m\/s<\/th>/g, '<th>Wind m/s</th>'],
  [/<th>突風 m\/s<\/th>/g, '<th>Gust m/s</th>'],
  [/<th>波高 m<\/th>/g, '<th>Wave m</th>'],
  // 潮汐
  [/Tide — 潮汐/g, 'Tide'],
  [/観測地点: /g, 'Station: '],
  [/（付近に専用の観測地点が無いため共用）/g, ' (nearest station, shared)'],
  [/の潮位の推移（気象庁の予測値）/g, ' tide level (JMA prediction)'],
  [/<\/span>満潮 /g, '</span>'],
  [/<\/span>干潮 /g, '</span>'],
  [/出典: 気象庁 潮位表/g, 'Source: JMA tide tables'],
  [/出典: /g, 'Source: '],
  // 今月の旬
  [/In Season — 今月の旬/g, 'In season — this month'],
  [/(\d+)月 \/ 堤防釣りの一般的な目安/g, 'Month $1 / general guide for breakwater fishing'],
  // 現地の声（area-reports.js / report-card.js）
  [/Reports — 現地の声/g, 'Reports — field reports'],
  [/([^>]+)エリアの最新の投稿/g, 'Latest posts from the $1 area'],
  [/もっと見る・投稿する/g, 'See more / post a report'],
  [/不適切な投稿を知らせる/g, 'Report this post'],
  [/の情報<\/p>/g, '</p>'],
  [/風：/g, 'Wind: '],
  [/場所不明/g, 'Location unknown'],
  // 区切りの全角スラッシュ（判定理由の「／」）
  [/ ／ /g, ' / '],
];

export function localizeSeaHTML(html, lang) {
  if (lang !== 'en' || !html) return html;
  let out = html;
  for (const [from, to] of RULES) out = out.replace(from, to);
  return out;
}

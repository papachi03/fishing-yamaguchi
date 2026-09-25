// あそび場の文言（日英対訳）。views/play.js（ビルド時の HTML）と egi-ui.js / match3-ui.js（ブラウザ）で共有する。
// DOM・window には触らない
import { pair, t } from '../i18n.js';
import { species } from '../data.js';

export const TOD = {
  morning: pair('朝マズメ', 'Dawn'),
  day: pair('日中', 'Daytime'),
  evening: pair('夕マズメ', 'Dusk'),
  night: pair('夜', 'Night'),
};
export const SEASON = {
  spring: pair('春', 'Spring'),
  earlySummer: pair('初夏', 'Early summer'),
  summer: pair('夏', 'Summer'),
  autumn: pair('秋', 'Autumn'),
  winter: pair('冬', 'Winter'),
};
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (lang, m) => (lang === 'en' ? MONTHS_EN[m - 1] : `${m}月`);

// 図鑑の種名（短い呼び名）。モンゴウイカ（カミナリイカ）→ モンゴウイカ
export const speciesById = (id) => species.find((s) => s.id === id) ?? null;
// ゲームだけに出る種（図鑑ページに無いもの）の名前
const GAME_NAMES = { akaika: pair('アカイカ', 'Neon flying squid'), daiou: pair('ダイオウイカ', 'Giant squid') };
export const speciesName = (lang, id) => {
  if (GAME_NAMES[id]) return t(lang, GAME_NAMES[id]);
  const s = speciesById(id);
  if (!s) return id;
  return t(lang, s.name).replace(/[（(].*$/, '').trim();
};

// ゲームの図鑑（1年を通してそろえる）。hint はまだ釣っていない種の手がかり（季節・時間・棚）
// point は見分け方（釣ったときと図鑑の詳しい画面に出す）
export const GAME_ZUKAN = [
  { id: 'aori', hint: pair('春はボトムの大物、秋はシャローの新子', 'Big ones on the bottom in spring, young ones in the shallows in autumn'),
    point: pair('胴のまわりをぐるっと囲む大きなエンペラ（ヒレ）が1枚。胴の先で丸くつながる', 'One big fin runs all the way around the body and joins in a round tip') },
  { id: 'kouika', hint: pair('春、ボトムをじっくり', 'Spring, work the bottom slowly'),
    point: pair('胴の先から「針」（甲の先）が飛び出す。背中に細い横じま。別名ハリイカ', 'A sharp spine (the tip of the cuttlebone) sticks out of the rear. Fine stripes across the back') },
  { id: 'mongo', hint: pair('初夏の夕方、シャロー〜中層に大型', 'Early-summer dusk, big ones shallow to mid-water'),
    point: pair('背中いっぱいに、コーヒー豆のような形の模様が散らばる', 'Coffee-bean-shaped marks scattered all over the back') },
  { id: 'shiriyake', hint: pair('初夏、底から巻き上げた瞬間に', 'Early summer, the moment you lift off the bottom'),
    point: pair('胴の先（おしり）が焦げたような色。ヒレのつけ根に白い点が並ぶ', 'The rear end looks burnt. A row of white dots along the fin base') },
  { id: 'kensaki', hint: pair('夏の夜、常夜灯の下', 'Summer nights, under the harbour lamps'),
    point: pair('赤みの強い細長い胴。胴の後ろ半分に大きな菱形のヒレ', 'A slim, reddish body with a big diamond fin on the rear half') },
  { id: 'yari', hint: pair('冬の夜、中層〜浅め', 'Winter nights, mid-water or shallower'),
    point: pair('槍のように細い胴と、矢じり形のヒレ。足が短い', 'A spear-thin body, arrowhead fin and short arms') },
  { id: 'surume', hint: pair('初夏の夜。堤防ではめったに会えない', 'Early-summer nights. Rare from the pier'),
    point: pair('背中の真ん中に濃い茶色の帯。胴の先に小さな菱形のヒレ', 'A dark brown stripe down the back and a small diamond fin at the tip') },
  { id: 'sodeika', boss: true, hint: pair('ボス。春〜夏の昼、アオリを狙って底を探っていると…', 'Boss. Spring–summer days, working the bottom for bigfin reef squid…'),
    point: pair('胴のほぼ全長にわたる大きなヒレが着物の袖のよう。全身が濃い赤', 'Huge fins run almost the whole body like kimono sleeves. Deep red all over') },
  { id: 'akaika', boss: true, hint: pair('ボス。春の夜、中層に…', 'Boss. Spring nights, in mid-water…'),
    point: pair('太く長い筒形の胴。背中の真ん中に黒紫の太い帯', 'A thick, long tube of a body with a broad dark purple stripe down the back') },
  { id: 'daiou', boss: true, hint: pair('伝説。冬の夜、深い底に…', 'Legend. Winter nights, deep on the bottom…'),
    point: pair('とても大きな目と、先が平たく広がった長い触腕2本', 'Enormous eyes and two very long tentacles with flat, wide tips') },
];
export const zukanById = (id) => GAME_ZUKAN.find((z) => z.id === id);
// 図鑑の絵：図鑑（カード・詳しい画面）＝リアル調、釣れたときの結果カード＝デフォルメ（イカ部のキャラと同じ画風）
export const zukanArt = (id, real = false) => `/assets/ikabu/zukan/${real ? '' : 'deform/'}${id}.webp`;

// 山口で会えるイカ（マイ図鑑の分母）
export const YAMAGUCHI_SQUID = species.filter((s) => s.group === 'yamaguchi').map((s) => s.id);

/* ---------- エギングゲーム ---------- */

export const EGI_TEXT = {
  name: pair('しゃくって抱かせろ！', 'Jerk, fall, hug!'),
  tagline: pair('ボタン1つのエギング。投げて、沈めて、しゃくって、フォールで抱かせる。', 'One-button egi fishing. Cast, sink, jerk, and let the squid hug on the fall.'),
  rules: [
    pair('エギを選ぶ：号数は重いほど遠くへ飛び速く沈む。秋の新子は2.5号、春の親イカは3.5号が目安。タイプはシャロー（ゆっくり沈む・根掛かりしにくい）／ノーマル／ディープ（速い・根掛かりしやすい）。投げる前ならいつでも替えられる。', 'Choose your egi: heavier sizes cast farther and sink faster. Size 2.5 for autumn juveniles, 3.5 for big spring squid. Shallow sinks slowly and snags less; deep sinks fast and snags more. Swap any time before a cast.'),
    pair('長押しで力をため、離すと投げる。着水したら「カウント」を数えて沈める。', 'Hold to load the rod, release to cast. After the splash, count the fall.'),
    pair('しゃくり：タップ1回。テンポよく2回で2段しゃくり。ダートは「ダート」ボタンか上へスワイプ（PCは↑キー・ホイール上）。やる気のある日はダートや2段が効き、渋い日は控えめの誘いと長いフォールが効く。', 'Jerks: tap once. Two quick taps make a double jerk. Dart with the Dart button or an upward swipe (ArrowUp or wheel-up on PC). Lively squid love darts and doubles; on slow days, keep it subtle and fall longer.'),
    pair('フォール：しゃくった後に押したまま＝テンションフォール（ゆっくり沈み手前に寄る。アタリが手に出やすい）。離せばフリーフォール（速く沈む）。イカが抱くのはフォール中だけ。', 'Falls: keep holding after a jerk for a tension fall (slow sink, drifting back toward you; bites show in the rod). Release for a free fall (faster). Squid only hug on the fall.'),
    pair('アタリは4種類。ラインが走る／竿先にコン（テンションフォールで出る）／ラインが止まる（沈みが止まる）／ラインがフケる（糸がたるむ）。気づいたらタップでアワセ。猶予はアタリの種類で違い、軽い抱きは短い。', 'Four kinds of bite: the line runs / a knock in the rod tip (tension fall) / the line stops (the sink stops) / the line goes slack (the squid lifted the egi). Tap to set the hook. Each bite gives a different window; light bites give less.'),
    pair('やり取りは押している間だけ巻く。張りすぎは身切れ、ゆるめすぎはバレ。', 'Reel only while holding. Too tight tears the hook out; too slack and it slips off.'),
    pair('底で待ちすぎると根掛かり。エギは3本まで、投げられるのは5投。', 'Sit on the bottom too long and you snag. Three egi, five casts.'),
  ],
  egi: {
    title: pair('エギを選ぶ', 'Choose your egi'),
    size: pair('号数', 'Size'),
    type: pair('タイプ', 'Type'),
    types: { shallow: pair('シャロー', 'Shallow'), normal: pair('ノーマル', 'Normal'), deep: pair('ディープ', 'Deep') },
    sink: pair('沈下', 'Sink'),
    sinkUnit: (lang, sec) => (lang === 'en' ? `about ${sec} s/m` : `約${sec}秒/m`),
    dist: pair('飛距離', 'Cast'),
    distRank: { short: pair('やや短い', 'shorter'), mid: pair('ふつう', 'average'), far: pair('遠い', 'far') },
    snag: pair('根掛かり', 'Snags'),
    snagRank: { low: pair('しにくい', 'rare'), mid: pair('ふつう', 'average'), high: pair('しやすい', 'likely') },
    recommend: pair('今の時期のおすすめ', 'Good for this season'),
    current: (lang, size, type) => (lang === 'en' ? `${size} ${type}` : `${size}号・${type}`),
    change: pair('エギを替える', 'Change egi'),
    changed: pair('エギを替えた', 'Egi changed'),
    color: pair('色', 'Colour'),
    colors: { red: pair('赤', 'Red'), blue: pair('青', 'Blue'), green: pair('緑', 'Green'), purple: pair('紫', 'Purple'), orange: pair('オレンジ', 'Orange'), pink: pair('ピンク', 'Pink'), brown: pair('茶色', 'Brown') },
    colorTap: pair('← エギをタップで|色が選べる', '← Tap the egi|to change its colour'),   // | は狭い画面での折り返し位置
    colorTitle: pair('エギの色', 'Egi colour'),
    colorBest: pair('今の条件で目立つのは', 'Good right now'),
    colorWhy: {
      mazume: pair('マズメは光が赤っぽい。赤・ピンク・オレンジが目立つ時間', 'Dawn and dusk light is reddish: red, pink and orange stand out'),
      day: pair('日中は明るくて水も見えやすい。茶色・緑・青のナチュラル系が効く', 'Bright daytime: natural brown, green and blue work'),
      night: pair('夜はシルエットが大事。紫・赤・ピンクが見つけてもらいやすい', 'At night the silhouette matters: purple, red and pink'),
      murky: pair('波が高く濁りぎみ。オレンジ・ピンクで目立たせよう', 'Rough and murky: make it visible with orange or pink'),
      clear: pair('波が穏やかで澄みぎみ。ナチュラル系で見切られにくく', 'Calm and clear: natural colours look less fake'),
    },
    rotation: pair('色を替えて気を引いた！（カラーローテーション）', 'New colour caught their eye! (colour rotation)'),
    rotateHint: pair('同じ色で反応がない…色を替えてみよう', 'No interest on this colour… try another'),
    reviewColor: (lang, list) => (lang === 'en' ? `Colours that suited today: ${list}` : `今日の条件に合う色：${list}`),
  },
  gestures: {
    title: pair('操作', 'Controls'),
    row: pair('タップ：しゃくり／2回：2段／押したまま：テンションフォール／ダート：ダートボタン・上へスワイプ', 'Tap: jerk / two taps: double / hold: tension fall / dart: Dart button or swipe up'),
    keys: pair('PC：Space・Enter＝タップと長押し、ダート＝↑キー・ホイール上・上へ短くドラッグ', 'PC: Space or Enter = tap and hold; dart = ArrowUp, wheel up, or a short upward drag'),
    dart: pair('ダート', 'Dart'),
    dartHint: pair('大きく横へ跳ばす誘い（沈下・フォール中）', 'A big sideways dart (while sinking or falling)'),
  },
  fall: { tension: pair('テンションフォール', 'Tension fall'), free: pair('フリーフォール', 'Free fall') },
  cue: {
    title: pair('アタリ表示', 'Bite cues'),
    real: pair('本格', 'Real'),
    easy: pair('やさしい', 'Easy'),
    note: pair('本格：糸と竿先だけで読む。やさしい：アタリの種類を文字で知らせる', 'Real: read the line and rod tip only. Easy: the kind of bite is labelled'),
    punch: pair('イカパンチ！', 'Squid punch!'),
    kinds: { run: pair('ラインが走った！', 'The line ran!'), tap: pair('竿先にコン！', 'A knock in the tip!'), stop: pair('ラインが止まった！', 'The line stopped!'), slack: pair('ラインがフケた！', 'The line went slack!') },
    names: { run: pair('走る', 'run'), tap: pair('コン', 'knock'), stop: pair('止まる', 'stop'), slack: pair('フケる', 'slack') },
    lesson: (lang, name) => (lang === 'en' ? `That was a “${name}” bite` : `今のは"${name}"アタリでした`),
    double: pair('2段！', 'Double!'),
    dart: pair('ダート！', 'Dart!'),
  },
  feel: {
    title: pair('手ざわり', 'Feel'),
    vibrate: pair('振動', 'Vibration'),
    sound: pair('小さな音', 'Soft sounds'),
    on: pair('オン', 'On'),
    off: pair('オフ', 'Off'),
    note: pair('手に伝わるアタリ（パンチ・コン・走る）とジェットで震えます。振動はAndroidなどの対応端末だけ（iPhoneは非対応）。音は控えめで、最初はオフです', 'Vibrates on bites you would feel (punch, knock, run) and on jets. Vibration works on Android and similar phones only (not iPhone). Sounds are quiet and off by default'),
  },
  hint: {
    tooMany: pair('しゃくりすぎ…', 'Too many jerks…'),
    dartActive: pair('キレのあるダート。イカが反応してる', 'Sharp dart. The squid are reacting'),
    dartCalm: pair('渋い日にダートは警戒されたかも。控えめに誘って長めのテンションフォールを', 'On a slow day a dart may spook them. Tease gently and use a longer tension fall'),
    calmOne: pair('渋い日は控えめが効く。そのまま長めのフォールを', 'Subtle works on slow days. Give it a longer fall'),
    calmMany: pair('渋い日は誘いすぎ注意。1〜2回で長めのテンションフォール', 'Do not overwork it today. One or two jerks, then a long tension fall'),
    goodRhythm: pair('いいリズム！', 'Nice rhythm!'),
    oneMore: pair('もう一しゃくり', 'One more jerk'),
  },
  btn: {
    ready: pair('長押しで投げる', 'Hold to cast'),
    aiming: pair('離して投げる！', 'Release to cast!'),
    sink: pair('しゃくる', 'Jerk'),
    signal: pair('アワセ！', 'Set the hook!'),
    fight: pair('押している間だけ巻く', 'Hold to reel'),
    result: pair('次の一投へ', 'Next cast'),
    over: pair('もう一度釣行する', 'Fish again'),
  },
  hud: {
    casts: pair('残り投数', 'Casts left'),
    egi: pair('エギ', 'Egi'),
    count: pair('カウント', 'Count'),
    depth: pair('水深', 'Depth'),
    bottom: pair('着底', 'On the bottom'),
    tension: pair('テンション', 'Tension'),
    dist: pair('残り', 'Line out'),
    power: pair('力', 'Power'),
    fall: pair('フォール中', 'Falling'),
  },
  msg: {
    punch: pair('イカパンチ…抱かせる間を', 'A punch… give it time to hug'),
    spooked: pair('パンチに合わせてしまった…警戒された', 'You struck at a punch… it got wary'),
    spookedLeft: pair('パンチに合わせてしまった…イカが離れた', 'You struck at a punch… the squid left'),
    punchWait: pair('いい間。抱く気になった', 'Nice pause. It wants to hug now'),
    cast: pair('着水。カウントを数えよう', 'Splash. Count the fall'),
    bottom: pair('着底！根掛かりに注意', 'On the bottom. Watch for snags'),
    signal: pair('ラインが走った！', 'The line jumped!'),
    hook: pair('乗った！', 'Hooked!'),
    heavy: pair('重い…！', 'Heavy…!'),
    bossHook: pair('な、なんだこの重さは…！？', 'What… what is this weight…!?'),
    bossReveal: (lang, name) => (lang === 'en' ? `BOSS! ${name}!!` : `ボス級！${name}だ！！`),
    reveal: (lang, name, big) => (lang === 'en' ? (big ? `A big one! ${name}!` : `It's a ${name}!`) : (big ? `デカい！${name}だ！` : `${name}だ！`)),
    kilo: pair('キロアップ！', 'Over a kilo!'),
    miss: pair('すっぽ抜け…', 'Missed the hookset…'),
    letgo: pair('離された…アワセが遅い', 'It let go. Too slow'),
    jet: pair('ジェット噴射！', 'Jet!'),
    break: pair('身切れ！', 'The hook tore out!'),
    unhooked: pair('バレた…', 'Slipped off…'),
    landed: pair('ゲット！', 'Landed!'),
    ink: pair('ぷしゅっ', 'Squirt!'),
    snag: pair('根掛かり！エギを1本ロスト', 'Snagged! Lost an egi'),
    recover: pair('回収。次はもう少し沖で', 'Retrieved. Try a longer cast'),
    noSign: pair('この投げは気配なし… 投げる場所や時間を変えるのも手', 'No sign of squid on that cast… try another spot or time'),
    squidLeft: (lang, n) => (lang === 'en' ? `The squid moved off… (maybe ${n} more around)` : `イカが離れていった…（あと${n}匹いるかも）`),
    squidGone: pair('気配が消えた', 'The sign is gone'),
    windy: pair('風で糸がふくらんでアタリが取りにくい', 'Wind bellies the line; bites are harder to read'),
    rhythm: {
      1: pair('もう一しゃくり', 'One more jerk'),
      2: pair('いいリズム！', 'Nice rhythm!'),
      3: pair('いいリズム！', 'Nice rhythm!'),
      4: pair('ちょっと多い', 'A bit much'),
      5: pair('しゃくりすぎ…', 'Too many jerks…'),
    },
    reelHint: pair('張りすぎ注意', 'Easing off'),
    slackHint: pair('ゆるみすぎ！', 'Too slack!'),
  },
  result: {
    landed: pair('釣れた！', 'Caught!'),
    snag: pair('根掛かり', 'Snagged'),
    break: pair('身切れ', 'Tore out'),
    unhooked: pair('バレ', 'Slipped off'),
    recover: pair('回収', 'Retrieved'),
    mantle: pair('胴長', 'Mantle'),
    weight: pair('重さ', 'Weight'),
    atlas: pair('図鑑で見る →', 'See it in the atlas →'),
    snagNote: pair('根掛かりは底にいる時だけ。着底したら早めにしゃくろう。', 'Snags only happen on the bottom. Jerk soon after touchdown.'),
    breakNote: pair('テンションの上限で身切れ。赤い帯に入る前にゆるめよう。', 'Max tension tears the hook out. Ease off before the red band.'),
    unhookedNote: pair('ゆるめっぱなしはバレる。ゼロに落ちる前に巻こう。', 'Constant slack lets it off. Reel before the gauge hits zero.'),
    recoverNote: pair('手前まで来た。飛距離が出ると、フォールの回数が増える。', 'Back at the pier. A longer cast means more falls.'),
    noEgi: pair('エギが無くなった。今日はここまで。', 'Out of egi. That is the day.'),
  },
  over: {
    title: pair('今日の釣行', 'Session summary'),
    total: pair('合計', 'Total'),
    catches: pair('釣果', 'Catches'),
    bouzu: pair('ボウズ。でも部則二、釣れなくても部員。', 'Blanked. Rule two: still a member.'),
    bouzuSub: pair('夕マズメの秋、底までカウントして、しゃくりは2〜3回。', 'Try an autumn dusk, count to the bottom, and keep it to two or three jerks.'),
    best: pair('自己ベスト', 'Personal best'),
    newBest: pair('自己ベスト更新！', 'New personal best!'),
    zukan: pair('マイ図鑑', 'My atlas'),
    firstCatch: pair('初めての種！', 'First of this species!'),
    notCounted: pair('季節モードの釣果は図鑑と記録に残りません。実際のシーズンで「今日の萩の海」で釣って、図鑑に記録しよう！', "Season-mode catches don't go in your atlas or records. Catch them in the real season with “Today in Hagi” to log them!"),
    sessions: pair('釣行', 'Sessions'),
  },
  live: {
    title: pair('今日の萩の海', "Today's sea at Hagi"),
    loading: pair('萩の海況を取得しています…', 'Loading sea conditions for Hagi…'),
    failed: pair('海況を取得できませんでした。ふつうの日の条件で練習モードにしています。', 'Could not load the sea data. Practice mode with an average day instead.'),
    stop: pair('今日の萩は釣行中止レベルの風と波。本物の海はお休みして、練習モードでどうぞ。', 'Hagi is at stop level today: too much wind and wave. Let the real sea rest and try practice mode.'),
    partial: pair('一部のデータが取れなかったので、足りない分はふつうの日の値で補っています。', 'Some data was unavailable; missing values use an average day.'),
    playLive: pair('今日の萩の海で釣る', "Fish today's Hagi sea"),
    playPractice: pair('季節を選んで遊ぶ', 'Pick a season'),
    expectation: pair('期待値', 'Expectation'),
    wind: pair('風', 'Wind'),
    gust: pair('突風', 'Gust'),
    wave: pair('波', 'Wave'),
    tide: pair('潮', 'Tide'),
    tod: pair('いまの時間帯', 'Time of day now'),
    source: pair('天気・波：Open-Meteo ／ 潮汐：気象庁の潮位表（萩）', 'Weather & waves: Open-Meteo / Tide: JMA tide tables (Hagi)'),
    fetched: pair('取得', 'Fetched'),
    modeLive: pair('今日の萩', "Today's Hagi"),
    modePractice: pair('練習', 'Practice'),
    now: pair('いま', 'Now'),
  },
  zukan: {
    title: pair('マイ図鑑', 'My atlas'),
    note: pair('「今日の萩の海」で釣ったイカだけが記録されます。1年を通して全種をそろえよう', 'Only catches with “Today in Hagi” are logged. Fill it across the whole year'),
    unknown: pair('？？？', '???'),
    count: pair('釣った数', 'Caught'),
    best: pair('最大', 'Best'),
    first: pair('初めて', 'First'),
    boss: pair('ボス', 'BOSS'),
    point: pair('見分け方', 'How to tell'),
    where: pair('会えるとき', 'When & where'),
    tapHint: pair('タップで見分け方', 'Tap for details'),
    close: pair('閉じる', 'Close'),
  },
  seasons: {
    title: pair('季節モード', 'Season mode'),
    note: pair('釣れない季節でも、その季節の主役を狙えます。山口・日本海側の釣果記録と部員の実釣をもとにしています。季節モードの釣果は図鑑には残りません', 'Fish any season, even out of season. Based on Yamaguchi Sea-of-Japan catch records and our own trips. Season-mode catches are not logged in your atlas'),
    detail: pair('くわしい条件（月・時間帯・期待値・風）', 'Fine-tune (month, time, expectation, wind)'),
    zone: { bottom: pair('ボトム', 'Bottom'), mid: pair('中層', 'Mid-water'), shallow: pair('シャロー', 'Shallow'), shallowMid: pair('シャロー〜中層', 'Shallow–mid'), midShallow: pair('中層〜浅め', 'Mid–shallow') },
    modes: {
      spring: { months: pair('4〜5月', 'Apr–May'), star: pair('春の親アオリイカ（0.9〜2.5kg）・コウイカ', 'Spawning bigfin reef squid (0.9–2.5 kg), cuttlefish'), zone: 'bottom', tod: pair('夕まずめ', 'Dusk'), egi: '3.5' },
      earlySummer: { months: pair('5月下旬〜7月', 'Late May–Jul'), star: pair('大型モンゴウイカ（1〜2.5kg）・シリヤケイカ', 'Big kisslip cuttlefish (1–2.5 kg), shiriyake cuttlefish'), zone: 'shallowMid', tod: pair('夕まずめ', 'Dusk'), egi: '3.5' },
      summer: { months: pair('7〜8月', 'Jul–Aug'), star: pair('夜のケンサキイカ', 'Swordtip squid at night'), zone: 'shallowMid', tod: pair('夜・常夜灯', 'Night, under the lamps'), egi: '2.5' },
      autumn: { months: pair('9〜11月', 'Sep–Nov'), star: pair('新子のアオリイカ（100〜800g）', 'Young bigfin reef squid (100–800 g)'), zone: 'shallow', tod: pair('日中・まずめ', 'Daytime, dawn and dusk'), egi: '2.5' },
      winter: { months: pair('12〜3月', 'Dec–Mar'), star: pair('ヤリイカ', 'Spear squid'), zone: 'midShallow', tod: pair('夜', 'Night'), egi: '2.5' },
    },
    labels: { star: pair('主役', 'Target'), zone: pair('棚', 'Depth'), tod: pair('時間', 'Time'), egi: pair('エギ', 'Egi') },
  },
  practice: {
    title: pair('練習の条件', 'Practice conditions'),
    expectation: pair('期待値', 'Expectation'),
    wind: pair('風', 'Wind'),
    calm: pair('穏やか', 'Calm'),
    breezy: pair('やや強い', 'Breezy'),
    strong: pair('強い', 'Strong'),
  },
  setup: {
    tod: pair('時間帯', 'Time of day'),
    month: pair('月', 'Month'),
    season: pair('季節', 'Season'),
    around: pair('このとき、堤防のまわりにいるイカ', 'Squid around the pier now'),
    locked: pair('次の釣行で変えられます', 'Change it on your next session'),
    hint: {
      morning: pair('朝は活性が高い。手早く探ろう', 'Active in the morning. Work the water fast'),
      day: pair('日中は渋め。底を丁寧に', 'Slow in daylight. Work the bottom carefully'),
      evening: pair('夕マズメは一番の時合', 'Dusk is the prime time'),
      night: pair('夜は灯りの下。夏はケンサキ、冬はヤリイカ', 'Under the lamp at night. Swordtip in summer, spear squid in winter'),
    },
  },
  a11y: {
    scene: pair('堤防からエギを投げる横から見た海。ボタンで操作します', 'Side view of the sea from a breakwater. Play with the button below'),
    log: pair('ゲームの出来事', 'Game events'),
  },
};

/* ---------- 墨つなぎ ---------- */

export const MARKS = [
  { id: 'anchor', name: pair('いかり', 'Anchor') },
  { id: 'sun', name: pair('太陽', 'Sun') },
  { id: 'wave', name: pair('波', 'Wave') },
  { id: 'star', name: pair('星', 'Star') },
  { id: 'shell', name: pair('貝', 'Shell') },
];
export const RARE_NAME = pair('黒いレアイカ', 'Black rare squid');

export const M3_TEXT = {
  name: pair('墨つなぎ', 'Ink Link'),
  tagline: pair('6×6の3マッチ。20手で1,500点。今日の一戦は、世界中で同じ盤面。', 'A 6×6 match-three. Reach 1,500 in 20 moves. The daily board is the same worldwide.'),
  rules: [
    pair('となりのマークを入れ替えて、同じマークを3つ以上そろえる。', 'Swap neighbouring marks to line up three or more of a kind.'),
    pair('4つ以上で黒いレアイカが生まれる。動かすと、まわり9マスが消える。', 'Four or more spawns a black rare squid. Move it and it clears the 3×3 around it.'),
    pair('消した数で墨がたまる。満タンで「墨フラッシュ」：選んだマークを全部消す。手数は減らない。', 'Clearing marks fills the ink meter. When full, use Ink Flash to clear every mark of one kind, without spending a move.'),
    pair('連鎖するほど1匹あたりの点が上がる。', 'Cascades multiply the points of every mark they clear.'),
  ],
  mode: { daily: pair('今日の一戦', "Today's board"), free: pair('自由に遊ぶ', 'Free play') },
  dailyNote: pair('UTCの日付で決まる盤面。世界のどこで遊んでも同じ。', 'The board is set by the UTC date, so it is the same everywhere in the world.'),
  hud: {
    score: pair('スコア', 'Score'),
    moves: pair('残り手数', 'Moves'),
    best: pair('ベスト', 'Best'),
    goal: pair('目標', 'Goal'),
    ink: pair('墨', 'Ink'),
  },
  btn: {
    flash: pair('墨フラッシュ', 'Ink Flash'),
    hint: pair('ヒント', 'Hint'),
    restart: pair('もう一度', 'Play again'),
    cancel: pair('やめる', 'Cancel'),
  },
  msg: {
    pick: pair('消したいマークを1つ選んで', 'Pick a mark to clear'),
    chain: pair('連鎖！', ' chain!'),
    rare: pair('レアイカ誕生！', 'Rare squid!'),
    blast: pair('ドカン！', 'Boom!'),
    flash: pair('墨フラッシュ！', 'Ink Flash!'),
    shuffled: pair('手が無いので混ぜ直し', 'No moves left, reshuffled'),
    nomatch: pair('そろわない', 'No match'),
    hint: pair('ここが動かせる', 'Try this swap'),
    selected: pair('選択中。となりを押して入れ替え', 'Selected. Tap a neighbour to swap'),
  },
  result: {
    title: pair('一戦終了', 'Board complete'),
    reached: pair('目標達成！', 'Goal reached!'),
    missed: pair('目標まであと', 'Short of the goal by'),
    maxChain: pair('最大連鎖', 'Best cascade'),
    flashes: pair('墨フラッシュ', 'Ink Flashes'),
    newBadge: pair('新しいバッジ', 'New badge'),
  },
  badges: {
    join: { name: pair('入部しました', 'Joined the club'), how: pair('1戦を完走', 'Finish one board') },
    star1: { name: pair('一つ星のイカ', 'One-star squid'), how: pair('1,500点', '1,500 points') },
    skilled: { name: pair('イカした腕前', 'Ink-redible skills'), how: pair('2,400点', '2,400 points') },
    chain: { name: pair('連鎖の達人', 'Cascade master'), how: pair('3連鎖', 'A three-step cascade') },
    ink: { name: pair('墨の使い手', 'Ink handler'), how: pair('1戦で墨フラッシュ2回', 'Two Ink Flashes in one board') },
    captain: { name: pair('部長への道', 'Road to captain'), how: pair('3,500点', '3,500 points') },
  },
  a11y: {
    board: pair('墨つなぎの盤面。矢印キーで移動、Enterで選択と入れ替え、Escで取り消し', 'Ink Link board. Arrow keys to move, Enter to select and swap, Escape to cancel'),
    cell: (lang, r, c, name) => (lang === 'en' ? `Row ${r + 1}, column ${c + 1}: ${name}` : `${r + 1}行${c + 1}列：${name}`),
  },
};

export const HUB_TEXT = {
  pick: pair('選んで遊ぶ', 'Pick a game'),
  records: pair('記録はこのブラウザにだけ残ります（サーバーには送りません）。', 'Records stay in this browser only. Nothing is sent to a server.'),
  play: pair('遊ぶ', 'Play'),
  flagship: pair('看板ゲーム', 'Flagship'),
  daily: pair('毎日ちがう盤面', 'A new board every day'),
};

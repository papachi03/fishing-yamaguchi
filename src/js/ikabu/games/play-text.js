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
  summer: pair('夏', 'Summer'),
  autumn: pair('秋', 'Autumn'),
  winter: pair('冬', 'Winter'),
};
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (lang, m) => (lang === 'en' ? MONTHS_EN[m - 1] : `${m}月`);

// 図鑑の種名（短い呼び名）。モンゴウイカ（カミナリイカ）→ モンゴウイカ
export const speciesById = (id) => species.find((s) => s.id === id) ?? null;
export const speciesName = (lang, id) => {
  const s = speciesById(id);
  if (!s) return id;
  return t(lang, s.name).replace(/[（(].*$/, '').trim();
};

// 山口で会えるイカ（マイ図鑑の分母）
export const YAMAGUCHI_SQUID = species.filter((s) => s.group === 'yamaguchi').map((s) => s.id);

/* ---------- エギングゲーム ---------- */

export const EGI_TEXT = {
  name: pair('しゃくって抱かせろ！', 'Jerk, fall, hug!'),
  tagline: pair('ボタン1つのエギング。投げて、沈めて、しゃくって、フォールで抱かせる。', 'One-button egi fishing. Cast, sink, jerk, and let the squid hug on the fall.'),
  rules: [
    pair('長押しで力をためて、離すと投げる。沈む間は「カウント」を数える。', 'Hold to build power, release to cast. Count the seconds while the egi sinks.'),
    pair('2〜3回しゃくって、フォールで待つ。イカが抱くのはフォール中だけ。', 'Jerk two or three times, then let it fall. Squid only hug on the fall.'),
    pair('ラインが走ったら、すぐアワセ。遅いと離される。', 'When the line jumps, set the hook fast. Wait too long and it lets go.'),
    pair('やり取りは押している間だけ巻く。張りすぎは身切れ、ゆるめすぎはバレ。', 'Reel only while holding. Too tight tears the hook out; too slack and it slips off.'),
    pair('底で待ちすぎると根掛かり。エギは3本まで、投げられるのは5投。', 'Sit on the bottom too long and you snag. Three egi, five casts.'),
  ],
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
    cast: pair('着水。カウントを数えよう', 'Splash. Count the fall'),
    bottom: pair('着底！根掛かりに注意', 'On the bottom. Watch for snags'),
    signal: pair('ラインが走った！', 'The line jumped!'),
    hook: pair('乗った！', 'Hooked!'),
    miss: pair('すっぽ抜け…', 'Missed the hookset…'),
    letgo: pair('離された…アワセが遅い', 'It let go. Too slow'),
    jet: pair('ジェット噴射！', 'Jet!'),
    break: pair('身切れ！', 'The hook tore out!'),
    unhooked: pair('バレた…', 'Slipped off…'),
    landed: pair('ゲット！', 'Landed!'),
    ink: pair('ぷしゅっ', 'Squirt!'),
    snag: pair('根掛かり！エギを1本ロスト', 'Snagged! Lost an egi'),
    recover: pair('回収。次はもう少し沖で', 'Retrieved. Try a longer cast'),
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
    sessions: pair('釣行', 'Sessions'),
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
      night: pair('夜は灯りの下。冬はヤリイカ・ヒイカ', 'Under the lamp at night. Winter brings spear squid and hi-ika'),
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

// しゃくって抱かせろ！：エギングのゲーム。画面を持たない純粋なロジック（node --test で試せる）。
// 本物の釣りの待ち時間に、釣り人が遊ぶ暇つぶし＝再現度が高いほど良い（2026-09-24 ぱっぱ）。
//
// 操作（画面側がこの関数を呼ぶ）：
//   構え中       … press で力をため、release で投げる
//   沈下・フォール … press＝しゃくり（テンポよく2回＝2段しゃくり）。dart()＝ダート（上へ強くスワイプ）。
//                   しゃくった後に押したままにする＝テンションフォール、離す＝フリーフォール
//   アタリ       … press＝アワセ（アタリは「走る・止まる・フケる・竿先にコン」の4種類で、画面が見せ方を変える）
//   やり取り     … 押している間だけ巻く（張りすぎると身切れ、ゆるめすぎるとバレ）
// 画面側は tick(dt) を毎フレーム呼び、state と state.events（起きたこと）を見て描く。
import { seeded, pickWeighted } from './rng.js';

export const CASTS = 5; // 1回の釣行で投げられる回数
// ラストチャンスと救済（2026-09-27、ぱっぱ：本物どおりだと釣れない日はほぼ釣れない＝離脱される）
//   ラストチャンス：最後の1投は必ずイカが近くにいて、抱く勢いが LAST_BOOST 倍。まだ1杯も釣れていなければ、
//     しゃくってフォールさせている間（合計 LAST_GUARANTEE 秒）に必ずアタリが1回出る（アワセ・ファイトは腕しだい）
//   救済：RESCUE_AFTER 投つづけて何の反応（アタリ・イカパンチ）もなければ、次の投げは必ずイカが1匹近くにいる＋ヒント。
//     1回の釣行で1回まで（悪い日と良い日の差を残す。上手な人が悪い日に毎回2杯取れてしまった）
//   🔰初心者練習はもともと釣れやすいので、どちらも入れない
export const LAST_BOOST = 1.8;
export const LAST_GUARANTEE = 2.5;
export const RESCUE_AFTER = 2;
// しゃくったら乗ってた（2026-09-27、YAMASHITA 川上さんのエギングレッスンより：アタリが取れなくても、次のしゃくりで乗っていることがある）
//   アタリを見送って離された（let-go）あと LUCKY_WINDOW 秒以内にしゃくると、LUCKY_CHANCE の確率でそのイカが乗る
export const LUCKY_WINDOW = 1.5;
export const LUCKY_CHANCE = 0.3;
export const EGI_STOCK = 3; // 根掛かりで失うと減る

// 釣り方（2026-09-27）：'egi'＝ふつうのエギング／'jado'＝邪道エギング（ぱっぱの実釣。コウイカ狙い）。
// 邪道エギング：エギとスナップのつなぎ目にオモリ、背中にエサ（ササミ・キビナゴ。効きは同じ）。底をズルズル引いて止め、
//   ずっしり重みが乗ったら合わせる。夜は匂いで寄る。深夜は「コツコツ」だけで抱かないことがある（すぐ動かすと離れる）
export const METHOD_IDS_ENGINE = ['egi', 'jado', 'yaen'];
export const BAITS = ['sasami', 'kibinago'];
export const JADO_SINK = 1.6;        // オモリの分だけ速く沈む
export const JADO_DRAG = 1.2;        // ズル引き1回（リール2巻き）で寄る距離（m）
export const JADO_STOP = 1.0;        // 止めてこの秒数たつと抱く（ズル引きの直後は抱かない）
export const JADO_GOOD_STOP = 1.5;   // この秒数止めてから次のズル引き＝いいリズム
export const JADO_SNAG = 0.008;      // ズル引き1回で根掛かる確率（岩場は ROCK_SNAG 倍）。1釣行で0.5本ほど失うくらい
export const JADO_SNAG_IDLE = 0.001; // 止めている間の1秒あたり
export const ROCK_SNAG = 1.8;
export const ROCK_CHANCE = 0.35;     // 1投ごとの「岩まじりの底」の確率
export const BAIT_USE = { cast: 0.1, bite: 0.3 };   // エサの減り（投げるたび／アタリ・コツコツのたび）
export const KOTSU_SHARE = 0.45;     // 深夜（夜）に、寄ったイカが抱かずにコツコツだけで終わる割合
export const KOTSU_SPOOK = 1.2;      // コツコツの後すぐ動かすと、離れていくことがある
export const KOTSU_WAIT = 2.0;       // コツコツの後これだけ待てると、抱く気になる
export const JADO_HUG = 0.22;        // 抱く勢いの大きさ（ボットで、初心者のボウズが2割ほどになるよう合わせた）
export const JADO_CUTTLE = 1.6;      // 底のエサに寄りやすいコウイカの仲間（コウイカ・シリヤケ・モンゴウ）

// ヤエン（2026-09-27、ぱっぱの実釣と回答。ikabu-research/new-methods-design.md）：
//   死にアジを底に置いて待つ → ドラグ「ジーッ」＝イカが抱いて走る → 待つ（見えない「イカの集中」と「アジの残り」）→
//   寄せる（抵抗した時は手を止める）→ 糸を上げて浮けばイカ・浮かなければタコ（糸を切る）→ 45度まで寄ったらヤエン投入 →
//   ヤエンが根元まで届けば、イカが驚いて下がったところで勝手に刺さる（合わせ不要）。届く前にアジを食べ終えたら離れる
export const YAEN_SINK = 0.9;          // アジが沈む速さ（m/秒）
export const YAEN_SPOIL = 45;          // 底で待ってこの秒数たつとアジが傷んで、その1投はおしまい
export const YAEN_BITE = 1 / 80;       // 近くにイカがいる時、1秒あたり抱く割合（アジが傷むまでに抱かない投げも多い）
export const TAKO_RATE = 0.003;        // 1秒あたりタコが抱く割合（イカがいなくても）
export const YAEN_RUN = [4, 7];        // 抱いて走る長さ（秒）と、走る距離
export const YAEN_FOCUS_TAU = [12, 22]; // 集中の上がり方（秒）：1-exp(-t/τ)。5秒で0.2〜0.35、30秒で0.75〜0.92
export const YAEN_EAT = [90, 140];     // 抱いてからアジを食べ終えるまで（秒）。寄せ＋ヤエンに30〜40秒かかる
export const YAEN_REEL = 0.8;          // 寄せる速さ（m/秒）。抵抗中は手を止める
export const YAEN_DIST = 10;           // 糸の角度が45度くらい＝ヤエンを入れられる距離（m）
export const YAEN_SLIDE = [0.7, 1.8];  // ヤエンが滑る速さ（m/秒）：竿を寝かせたまま／竿を立てている
export const YAEN_HOOK_FAIL = 0.05;    // 届いたのに針が飛ぶ（まれ）
export const TAKO_ROCK = 12;           // タコを寄せ続けると、この秒数で岩に入られる
// 寄せている間の抵抗（2026-09-27 ぱっぱ）：ジェットはあまりせず、ゆっくり後ろに下がる。
//   無理に巻くと強く引いて下がるか、アジを離す
export const YAEN_BACK = 0.3;          // 抵抗中、手を止めている時に下がる速さ（m/秒）
export const YAEN_PULL = 1.4;          // 抵抗中に巻いた時、強く引いて下がる速さ（m/秒）

// 外道（2026-09-27 ぱっぱ：外道の記録に残す。海藻・ゴミ・カサゴなど）。図鑑とは別に数える。
//   カサゴ … 底にいる時に「コン」と食う（岩の底ほど）。軽くてすぐ上がる
//   海藻   … 藻に掛かった時、ときどきそのまま付いてくる
//   長靴・空き缶 … 根掛かりのうち、ときどきゴミだった（エギは戻る）
export const GEDO = {
  kasago: { g: [80, 350], power: 0.35 },
  seaweed: { g: [50, 400] },
  boot: { g: [600, 1200] },
  can: { g: [30, 80] },
  namako: { g: [150, 400] },   // 邪道エギングで底を引いていると、ごくまれに（ぱっぱの実釣）
  tako: { g: [800, 2500] },    // ヤエンで。浮かなければタコ（ぱっぱの実釣）
};
export const KASAGO_RATE = { egi: 0.02, jado: 0.05 };   // 底にいる1秒あたり
export const WEED_GEDO = 0.4;    // 藻に掛かった時、海藻が付いてくる確率
export const JUNK_SHARE = 0.12;  // 根掛かりのうち、ゴミだった割合
export const NAMAKO_CHANCE = 0.006;   // 邪道エギングのズル引き1回で、ナマコが引っかかる
export const SIGNAL_GOOD = 0.7; // 「ラインが走る」アタリで、ちゃんと掛かるまでの猶予（秒）
export const SIGNAL_LATE = 1.2; // これを過ぎたらイカが離す
export const SLACK_LIMIT = 1.5; // ラインがゆるみっぱなしでバレるまで（秒）
export const TENSION_HOLD = 0.3; // しゃくった後これ以上押したままならテンションフォール
export const DOUBLE_JERK = 0.45; // この間隔以内の2回目のしゃくりは「2段しゃくり」

export const TIMES = ['morning', 'day', 'evening', 'night'];

// ---------------- エギ ----------------
// 沈下速度は実物の目安（秒/m）。ゲームでは TIME_SCALE 倍速で沈める（本物どおりだと待ち時間が長すぎる）
export const EGI_SIZES = [2.5, 3, 3.5];
export const EGI_TYPES = ['shallow', 'normal', 'deep'];
const SEC_PER_M = { 2.5: 4.2, 3: 3.8, 3.5: 3.5 }; // ノーマル
const TYPE_SINK = { shallow: 1.9, normal: 1, deep: 0.6 }; // シャローは遅く、ディープは速い
const TYPE_SNAG = { shallow: 0.5, normal: 1, deep: 1.6 }; // 速く沈むほど根掛かりしやすい
const SIZE_DIST = { 2.5: 0.85, 3: 0.93, 3.5: 1 }; // 重いほど遠くへ飛ぶ
const TIME_SCALE = 3.4;
export const DEFAULT_EGI = { size: 3, type: 'normal', color: 'orange' };

// ---------------- エギの色（布＝背中の色） ----------------
// YAMASHITA 公式「エギの色の選び方」ほか（2026-09-25 調査）：
//   布の色は「潮の色・活性」に合わせる（濁り・高活性＝オレンジ/ピンク、澄み・スレ＝茶/緑/青）、
//   下地は「光の色」＝時間帯に合わせる（マズメ＝赤・ピンク、日中＝金・銀、夜＝赤・夜光）。
//   ゲームでは布の7色だけを選び、時間帯の考え方もこの7色の合い具合に織り込む。効きは号数・棚より小さく ±25% 以内。
export const EGI_COLORS = ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'brown'];
export const EGI_COLOR_HEX = { red: '#d8342c', blue: '#2f6fc9', green: '#5a8a3a', purple: '#7a4bb0', orange: '#f47321', pink: '#f06aa6', brown: '#8a5a34' };
const FLASHY = ['orange', 'pink', 'red'];
const NATURAL = ['brown', 'green', 'blue'];
const COLOR_TOD = {
  morning: { red: 1.2, pink: 1.2, orange: 1.12, purple: 1.0, brown: 0.9, green: 0.9, blue: 0.85 },
  evening: { red: 1.2, pink: 1.2, orange: 1.12, purple: 1.0, brown: 0.9, green: 0.9, blue: 0.85 },
  day: { brown: 1.15, green: 1.15, blue: 1.1, orange: 1.0, purple: 0.95, pink: 0.9, red: 0.85 },
  night: { purple: 1.2, red: 1.15, pink: 1.1, orange: 0.95, green: 0.95, brown: 0.9, blue: 0.85 },
};
// 潮の濁りは実データが無いので、波の高さで代わりに見る（波1m以上＝濁りぎみ、0.5m未満＝澄みぎみ）
export const clarityOf = (cond) => (cond.wave >= 1.0 ? 'murky' : cond.wave < 0.5 ? 'clear' : 'mid');
export function colorFit(color, { tod, cond, mood }) {
  let k = COLOR_TOD[tod]?.[color] ?? 1;
  const cl = clarityOf(cond);
  if (cl === 'murky') k += FLASHY.includes(color) && color !== 'red' ? 0.1 : NATURAL.includes(color) ? -0.05 : 0;
  if (cl === 'clear') k += NATURAL.includes(color) ? 0.05 : FLASHY.includes(color) ? -0.05 : 0;
  if (mood === 'active') k += FLASHY.includes(color) ? 0.05 : 0;
  if (mood === 'calm') k += NATURAL.includes(color) ? 0.05 : FLASHY.includes(color) ? -0.05 : 0;
  return Math.min(1.25, Math.max(0.75, k));
}
// いまの条件でいちばん合う色（ヒント・振り返り用）
export function bestColors(opts) {
  const scored = EGI_COLORS.map((c) => [c, colorFit(c, opts)]).sort((a, b) => b[1] - a[1]);
  return scored.filter(([, v]) => v >= scored[0][1] - 0.001).map(([c]) => c);
}
// カラーローテーション：同じ色で ROTATE_AFTER 投続けてアタリが無く、色を替えた次の1投は気を引ける
export const ROTATE_AFTER = 2;
export const ROTATE_GAIN = 0.1;

export function normalizeEgi(e = {}) {
  const size = EGI_SIZES.includes(Number(e.size)) ? Number(e.size) : DEFAULT_EGI.size;
  const type = EGI_TYPES.includes(e.type) ? e.type : DEFAULT_EGI.type;
  const color = EGI_COLORS.includes(e.color) ? e.color : DEFAULT_EGI.color;
  return { size, type, color };
}
// 実物の沈下速度（秒/m）と、ゲームでの沈む速さ（m/秒）
export const egiSecPerMeter = (egi) => SEC_PER_M[egi.size] * TYPE_SINK[egi.type];
export const sinkRate = (egi) => TIME_SCALE / egiSecPerMeter(egi);
export const SINK = sinkRate(DEFAULT_EGI); // 既定のエギ（3号ノーマル）で約0.9m/秒
const FREE_FALL = 0.78; // しゃくった後のフリーフォールは、着水直後の沈下より少し遅い
const TENSION_FALL = 0.5; // テンションフォールはさらにゆっくり、手前に寄りながら沈む

// ---------------- イカ ----------------
// 山口県・日本海側（萩）の陸っぱりの実データで作る（2026-09-25）。根拠は C:\Users\my\ikabu-research\squid-seasons.md：
//   釣具店の釣果（アングル山口 2,043件・CAST釣果写真館 イカ235件ほか）、山口県水産研究センター研究報告、
//   そしてダディの実釣（モンゴウ・シリヤケは5月下旬〜7月、モンゴウはシャロー〜中層、シリヤケは駆け上がりの巻き上げで食う、
//   2024-07-18 もモンゴウ・シリヤケがまとまって釣れた、スルメイカは6月の夜、新子アオリは夜にも釣れる）。
//   推測で足さないこと。萩で記録のないヒイカは出さない。
//
// months … 月ごとの釣れやすさ（0 ほぼ釣れない／1 たまに／2 よく／3 最盛期。調査の表そのまま）
// zone   … 好きな棚。[上, 下] を水深に対する割合で（0＝水面、1＝底）。エギがこの中にあるほど抱く
// tod    … 時間帯ごとの出やすさの倍率
// g(m)   … その月の重さの範囲（グラム）。k は胴長の係数（胴長cm ≈ k × 重さ^(1/3)）
// ideal(m) … 合うエギの号数
// abund  … 数の多さ（春の親アオリは数が少なく大きい、秋の新子は小さいが数が出る。釣具店の釣果の件数の比を目安に）
const MONTH_W = [0, 0.25, 0.6, 1.0]; // 「たまに」は最盛期の 1/4 くらい
export const SPECIES = {
  aoriSpring: {
    abund: 0.4,
    id: 'aori', label: '春の親アオリイカ', months: { 4: 2, 5: 3, 6: 2, 7: 1 }, zone: [0.7, 1],
    tod: { morning: 1.4, day: 1.0, evening: 1.4, night: 0.5 }, g: () => [900, 2500], big: [2500, 3400], k: 2.5, power: 1.0, ideal: () => 3.5,
  },
  aoriKid: {
    abund: 1.2,
    id: 'aori', label: '秋の新子アオリイカ', months: { 9: 3, 10: 3, 11: 2, 12: 1, 1: 1, 2: 1, 3: 1 },
    // 秋はシャロー。12〜3月の越冬個体は深め
    zone: (m) => (m >= 9 && m <= 11 ? [0, 0.5] : [0.5, 1]),
    tod: { morning: 1.3, day: 1.2, evening: 1.4, night: 0.9 },   // ダディの実釣：10月の夜0時台に新子4杯
    g: (m) => ({ 9: [100, 300], 10: [200, 500], 11: [500, 800] })[m] ?? [200, 800],
    k: 2.5, power: 0.6,
    ideal: (m) => ({ 9: 2.5, 10: 2.5, 11: 3 })[m] ?? 3.5,
  },
  kouika: {
    abund: 0.45,
    id: 'kouika', label: 'コウイカ', months: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 3, 6: 2, 7: 1, 11: 1 }, zone: [0.75, 1],
    tod: { morning: 1.2, day: 1.0, evening: 1.2, night: 0.8 }, g: () => [300, 1000], big: [1000, 1800], k: 1.9, power: 0.6, ideal: () => 3,
  },
  mongo: {
    abund: 0.55,
    // ダディの実釣：コウイカが終わりかける5月下旬から6月、1〜2.5kg の大型。意外にシャロー〜中層を泳ぐ
    id: 'mongo', label: '大型モンゴウイカ', months: { 5: 1, 6: 3, 7: 2 }, zone: [0.1, 0.65],
    tod: { morning: 1.2, day: 1.0, evening: 1.4, night: 0.6 }, g: () => [1000, 2500], k: 2.4, power: 0.9, ideal: () => 3.5,
  },
  shiriyake: {
    abund: 0.25,
    // ダディの実釣：モンゴウと同じ頃に入る。大きくない。ボトム。駆け上がりから巻き上げたときに食いつく
    id: 'shiriyake', label: 'シリヤケイカ', months: { 5: 1, 6: 2, 7: 2 }, zone: [0.8, 1], lift: true,
    tod: { morning: 1.1, day: 1.0, evening: 1.1, night: 0.7 }, g: () => [200, 600], k: 2.0, power: 0.5, ideal: () => 3,
  },
  kensaki: {
    abund: 0.8,
    // 陸っぱりは夏の夜（6〜8月、7月が最盛期）。表層〜中層、常夜灯
    id: 'kensaki', label: '夜のケンサキイカ', months: { 5: 1, 6: 2, 7: 3, 8: 2, 9: 1, 10: 1, 11: 1, 12: 1, 1: 1 }, zone: [0, 0.55],
    tod: { morning: 0.2, day: 0.05, evening: 0.6, night: 1.5 }, g: () => [150, 600], k: 3.7, power: 0.7, ideal: () => 2.5,
  },
  surume: {
    // ダディの実釣：2023-06-10 0:59 に陸から。ふだんは船で釣るイカで、堤防からはめったに釣れない（ダディ）→ 6月の夜にまれに
    abund: 0.25,
    id: 'surume', label: 'スルメイカ', months: { 6: 1 }, zone: [0.1, 0.6],
    tod: { morning: 0.2, day: 0.05, evening: 0.5, night: 1.5 }, g: () => [200, 500], k: 3.9, power: 0.65, ideal: () => 2.5,
  },
  yari: {
    abund: 0.9,
    // 2〜3月が最盛期。夕まずめ〜夜、中層〜浅め
    id: 'yari', label: 'ヤリイカ', months: { 12: 1, 1: 2, 2: 3, 3: 3, 4: 1 }, zone: [0.2, 0.7],
    tod: { morning: 0.2, day: 0.1, evening: 0.9, night: 1.5 }, g: () => [150, 400], k: 4.8, power: 0.55, ideal: () => 2.5,
  },
};

// 季節モード（ダディ確定 2026-09-25）：春・初夏・夏・秋・冬。月と時間帯の代表で遊ぶ
export const SEASON_MODES = [
  { key: 'spring', months: [4, 5], month: 5, tod: 'evening', stars: 'aoriSpring' },
  { key: 'earlySummer', months: [6], month: 6, tod: 'evening', stars: 'mongo' },
  { key: 'summer', months: [7, 8], month: 7, tod: 'night', stars: 'kensaki' },
  { key: 'autumn', months: [9, 10, 11], month: 10, tod: 'day', stars: 'aoriKid' },
  { key: 'winter', months: [12, 1, 2, 3], month: 2, tod: 'night', stars: 'yari' },
];

export function seasonOf(month) {
  return SEASON_MODES.find((m) => m.months.includes(month))?.key ?? 'spring';
}

const zoneOf = (sp, month) => (typeof sp.zone === 'function' ? sp.zone(month) : sp.zone);
const monthW = (sp, month) => MONTH_W[sp.months[month] ?? 0];

// その月・時間帯に出るイカ（出やすさ w 付き）。画面の「周りのイカ」やエギのおすすめもこれを使う
export function speciesPool(month, tod) {
  return Object.entries(SPECIES)
    .map(([key, sp]) => ({ key, id: sp.id, label: sp.label, w: monthW(sp, month) * (sp.tod[tod] ?? 1) * (sp.abund ?? 1), g: sp.g(month), big: sp.big ?? null,
      k: sp.k, power: sp.power, ideal: sp.ideal(month), zone: zoneOf(sp, month), lift: Boolean(sp.lift) }))
    .filter((p) => p.w > 0);
}

// エギの号数が、そのイカに合っているか（1＝ぴったり。0.5号ずれるごとに下がる）
export const sizeMatch = (egiSize, ideal) => Math.max(0.35, 1 - 0.5 * Math.abs(egiSize - ideal));

// 棚が合っているか：好きな棚の中なら1、外れるほど下がる（最低 0.15）
export function zoneMatch(frac, zone) {
  const [a, b] = zone;
  if (frac >= a && frac <= b) return 1;
  const d = frac < a ? a - frac : frac - b;
  return Math.max(0.15, 1 - d / 0.35);
}

// その月・時間帯の「イカの濃さ」。秋の夕まずめ（10月）を 1.68 とした目安（以前の季節×時間帯の倍率に合わせてある）
const AVAIL_NORM = 1.07;
export const availability = (month, tod) => speciesPool(month, tod).reduce((a, p) => a + p.w, 0) / AVAIL_NORM;

// イカの気分：秋やまずめで、潮もそこそこなら「やる気あり」（ダート・2段が効く）。それ以外は「渋い」（控えめの誘い＋長いフォール）
export function moodOf(month, tod, cond) {
  const lively = seasonOf(month) === 'autumn' || tod === 'morning' || tod === 'evening';
  return lively && cond.expectation >= 4 ? 'active' : 'calm';
}

// ---------------- 海の状況 ----------------
// 「今日の萩の海」の実データ（YFJ の海況：期待値・風・突風・波・安全判定）をそのまま渡す。
// 渡さなければ「ふつうの日」（期待値5・風3m・波0.5m）として遊ぶ
export const DEFAULT_CONDITIONS = { expectation: 5, wind: 3, gust: 5, wave: 0.5, safety: 'ok' };

export function normalizeConditions(c = {}) {
  const n = { ...DEFAULT_CONDITIONS, ...c };
  n.expectation = Math.min(10, Math.max(0, Number(n.expectation) || 0));
  n.wind = Math.max(0, Number(n.wind) || 0);
  n.gust = Math.max(n.wind, Number(n.gust) || 0);
  n.wave = Math.max(0, Number(n.wave) || 0);
  return n;
}

// その投げで、エギの近くにいるイカの数（0〜2）。季節・時間帯・潮（期待値）で平均が決まる。
// 0 なら、どれだけ上手にしゃくっても抱かない＝本物どおりボウズの投げがある
export function meanSquid(month, tod, cond) {
  return availability(month, tod) * (0.1 + 0.08 * cond.expectation);
}
function sampleSquid(s) {
  const lambda = meanSquid(s.month, s.tod, s.cond);
  // ポアソン分布（平均 lambda）から引いて、2 匹で頭打ち
  let k = 0;
  let p = Math.exp(-lambda);
  let cum = p;
  const r = s.rand();
  while (r > cum && k < 2) {
    k += 1;
    p *= lambda / k;
    cum += p;
  }
  return k;
}

// ---------------- アタリ ----------------
// アタリの出方と、アワセの猶予（秒）。本物どおり、はっきりしたものと見逃しやすいものがある
//   run   ラインが走る（はっきり）
//   tap   竿先にコン（テンションフォールで出やすい。猶予は短い）
//   stop  ラインが止まる＝沈みが止まる（見逃しやすいが、猶予は長め）
//   slack ラインがフケる＝イカがエギを持ち上げて糸がたるむ（見逃しやすい）
export const BITES = {
  heavy: { good: 1.3, late: 2.2 },   // 邪道エギング：ずっしり重みが乗る（エサを抱えて離しにくい＝猶予は長め）
  run: { good: 0.7, late: 1.2 },
  tap: { good: 0.45, late: 0.8 },
  stop: { good: 0.9, late: 1.5 },
  slack: { good: 0.8, late: 1.3 },
};
const BITE_MIX = {
  tension: [{ kind: 'tap', w: 0.5 }, { kind: 'run', w: 0.35 }, { kind: 'stop', w: 0.15 }],
  free: [{ kind: 'run', w: 0.35 }, { kind: 'stop', w: 0.35 }, { kind: 'slack', w: 0.3 }],
};

// イカパンチ（2026-09-25）：寄ってきたイカが抱かずに足でエギを叩いていく。合わせても掛からない。
//   すぐしゃくる（PUNCH_SPOOK 秒以内）と警戒して気が引ける／ときどき離れていく。
//   しゃくらずに PUNCH_WAIT 秒待つと「抱かせる間」になって、気になる度合いが上がる（本物の定石）。
//   抱く判定とは別に起きる接触なので、パンチがあっても釣れる数そのものは直接は減らない
// ---------------- ボス（ごくまれ） ----------------
// 山口近海の実在の記録から（squid-seasons.md）。ふつうのイカの「近くにいる数」とは別に、条件が合うと1秒あたり rate の確率で抱く。
//   ソデイカ  … ダディの実釣：2021-05-09 12:39、アオリ狙いのエギに日中ボトムで食った。研報：萩沖・長門で5〜8月の記録。最大20kg
//   アカイカ  … 2023-04-01 萩市大島の沿岸で採捕（外套長55cm）。春の夜
//   ダイオウイカ … 2015年2月 角島、2022年2月 萩市大井浦、2023年3月 萩市大島（いずれも漂着）。冬の夜の伝説
export const BOSSES = {
  sodeika: { id: 'sodeika', months: [4, 5, 6, 7, 8], tods: ['morning', 'day', 'evening'], zone: [0.7, 1], rate: 0.0006, g: [6000, 16000], mantle: [55, 80], power: 1.5 },
  akaika: { id: 'akaika', months: [3, 4, 5], tods: ['evening', 'night'], zone: [0.2, 0.7], rate: 0.0003, g: [2500, 5000], mantle: [45, 60], power: 1.3 },
  daiou: { id: 'daiou', months: [12, 1, 2, 3], tods: ['night'], zone: [0.8, 1], rate: 0.0003, g: [60000, 150000], mantle: [70, 130], power: 1.8 },
};
export function bossesFor(month, tod) {
  return Object.values(BOSSES).filter((b) => b.months.includes(month) && b.tods.includes(tod));
}
// ボスはとても重いが、巻き寄せの遅さは BOSS_REEL_CAP（g）相当で頭打ち（ソデイカ約4〜5分、ダイオウイカ約6〜7分の大一番）
export const BOSS_REEL_CAP = 3500;

// ジェット噴射の間隔と疲れ（fight 中）
export const REEL_WEIGHT = 0.8; // 重さ1kgごとに巻き寄せが遅くなる割合（2kg級を30〜40mから寄せて約2分。体力の減りと合わせて調整）
export const STAMINA_MIN = 0.1;
export const STAMINA_DECAY = 0.006; // 1秒あたりの体力の減り（約2分半で 1→0.1）
export const JET_GAP = 1.2;
export const JET_BURST = 3;
export const JET_WINDOW = 8;
export const JET_REST = 4;

export const PUNCH_SHARE = 0.35;   // 抱く勢い（rate）に対するパンチの出やすさ
export const PUNCH_SPOOK = 1.2;
export const PUNCH_WAIT = 2.0;
export const PUNCH_GAIN = 0.25;

// 風が強いと糸がふくらんでアタリが取りにくい：アワセの猶予が短くなる（7m/s を超えるとじわじわ、最大 45% 短く）
export const windFactor = (cond) => 1 - Math.min(0.45, Math.max(0, (cond.gust - 6) * 0.06));
// 🔰初心者練習（2026-09-27、ぱっぱ：知り合いが難しすぎてやめかけた）：アワセの猶予2倍・寄り1.5倍・根掛かりなし・ファイトはやさしく
export const EASY = { window: 2, bite: 1.5, tension: 0.6, jet: 0.5, slack: 2 };
export function signalWindows(cond, kind = 'run', light = false, easy = false) {
  const k = windFactor(cond) * (light ? 0.6 : 1) * (easy ? EASY.window : 1);
  return { good: BITES[kind].good * k, late: BITES[kind].late * k };
}

// ---------------- 状態 ----------------
export function createEgi({ seed = String(Date.now()), month = 9, tod = 'evening', rand, conditions, egi, easy = false, method = 'egi', bait = 'sasami' } = {}) {
  const cond = normalizeConditions(conditions);
  const spec = normalizeEgi(egi);
  return {
    method: METHOD_IDS_ENGINE.includes(method) ? method : 'egi',
    bait: BAITS.includes(bait) ? bait : 'sasami',
    baitLeft: 1,       // エサの残り（1＝付けたて）
    rock: false,       // この投げの底が岩まじりか
    lastDrag: -99,     // 最後にズル引きした時刻
    kotsuAt: -99,      // 最後のコツコツ
    kotsuPending: false,
    gedo: [],          // この釣行の外道
    rand: rand ?? seeded(seed),
    month,
    tod,
    cond,
    spec, // 使っているエギ（号数・タイプ）
    mood: moodOf(month, tod, cond),
    easy, // 🔰初心者練習
    windows: signalWindows(cond, 'run', false, easy), // いまのアタリのアワセ猶予（アタリが出るたびに種類に合わせて入れ替える）
    bite: null, // いまのアタリ { kind, light }
    punchAt: -99, // 最後のイカパンチの時刻
    liftAt: -99, // 底からエギを持ち上げた時刻（シリヤケイカは巻き上げで食う）
    dryCasts: 0, // 同じ色でアタリの無かった投げの数（カラーローテーション用）
    rotated: false, // 色を替えた次の1投（気を引ける）
    signaled: false, // この投げでアタリがあったか
    reacted: false, // この投げで何かの反応（アタリ・イカパンチ）があったか
    quiet: 0, // 反応の無い投げが何投つづいているか（救済用）
    bonus: null, // この投げのボーナス 'last'（ラストチャンス）／'rescue'（救済）
    guarantee: false, // ラストチャンスで、アタリが1回出ることを保証している
    guaranteeFall: 0, // 保証つきの投げで、フォールさせた合計秒
    rescued: false, // この釣行で救済を使ったか（1回まで）
    punchPending: false, // パンチの後、まだ「待った／すぐしゃくった」が決まっていない
    squid: 0,
    weed: null, // この投げの藻場 { kind, from, to, height }（m）
    weedSeen: false,
    phase: 'ready',
    t: 0,
    casts: CASTS,
    egi: EGI_STOCK,
    pressing: false,
    pressAt: 0,
    tensionFall: false,
    power: 0,
    castDist: 0,
    dist: 0,
    depth: 0,
    bottom: 0,
    bottomFor: 0,
    jerks: [],
    darts: 0,
    lastJerk: -99,
    judged: true,
    interest: 0,
    hooking: null,
    signalAt: 0,
    tension: 0,
    slackFor: 0,
    catches: [],
    last: null,
    events: [],
  };
}

// 投げ終わってから次の投げまでにエギを替えられる（構え中・結果表示中だけ）
export function setEgi(s, egi) {
  if (s.phase !== 'ready' && s.phase !== 'result') return false;
  const before = s.spec?.color;
  s.spec = normalizeEgi(egi);
  if (before && s.spec.color !== before) {
    if (s.dryCasts >= ROTATE_AFTER) s.rotated = true;
    s.dryCasts = 0;
  }
  return true;
}

const emit = (s, type, data = {}) => s.events.push({ type, t: s.t, ...data });

// その回の投げを終えて、次の構えへ（もう投げられなければ終了）
function endCast(s, why) {
  s.last = why;
  s.dryCasts = s.signaled ? 0 : (s.dryCasts ?? 0) + 1;
  s.quiet = s.reacted ? 0 : (s.quiet ?? 0) + 1;
  s.tensionFall = false;
  s.phase = s.casts > 0 && s.egi > 0 ? 'result' : 'over';
  if (s.phase === 'over') emit(s, 'over', { total: totalWeight(s) });
}

export const totalWeight = (s) => s.catches.reduce((sum, c) => sum + c.weight, 0);

// しゃくり。kind='lift'（ふつうのしゃくり）／'dart'（大きく横へ跳ばす）
function jerk(s, kind = 'lift') {
  // 続けてしゃくった回数を数える（間があいたら数え直し）
  if (s.t - s.lastJerk > 0.9) {
    s.jerks = [];
    s.darts = 0;
  }
  const double = s.jerks.length > 0 && s.t - s.lastJerk <= DOUBLE_JERK;
  s.jerks.push(s.t);
  if (kind === 'dart') s.darts += 1;
  if (s.depth >= s.bottom - 0.6) s.liftAt = s.t;   // 底から持ち上げた（シリヤケイカが食いつく瞬間）
  if (s.punchPending && s.t - s.punchAt < PUNCH_SPOOK) {
    // パンチに合わせてしまった：掛からないうえに警戒される
    s.punchPending = false;
    s.interest = Math.max(0.05, s.interest - 0.2);
    const left = s.rand() < 0.3;
    if (left) s.squid = Math.max(0, s.squid - 1);
    emit(s, 'spooked', { left, squidLeft: s.squid });
  } else {
    s.punchPending = false;
  }
  // しゃくったら乗ってた：アタリを見送って離された直後のしゃくりで、ときどきそのイカが乗る
  const lg = s.letGo;
  s.letGo = null;
  if (lg && s.t - lg.at <= LUCKY_WINDOW && s.rand() < LUCKY_CHANCE) {
    s.hooking = lg.hooking;
    s.phase = 'fight';
    s.tension = 30;
    s.slackFor = 0;
    s.dist = Math.max(s.dist, 3);
    s.lastJerk = s.t;
    s.bite = null;
    emit(s, 'hook', { id: s.hooking.id, late: s.t - lg.at, lucky: true });
    return;
  }
  s.lastJerk = s.t;
  s.judged = false;
  s.tensionFall = false;
  const lift = kind === 'dart' ? 1.8 : 1.2;
  const pull = kind === 'dart' ? 2.5 : 1.5;
  s.depth = Math.max(0.5, s.depth - lift);
  s.dist = Math.max(0, s.dist - pull);
  s.bottomFor = 0;
  s.phase = 'action';
  emit(s, 'jerk', { streak: s.jerks.length, kind, double });
}

export function press(s) {
  if (s.pressing) return;
  s.pressing = true;
  s.pressAt = s.t;
  if (s.phase === 'ready') {
    s.phase = 'aiming';
    s.power = 0;
    s.aimFrom = s.t;
  } else if (s.method === 'yaen' && ['wait', 'run', 'draw', 'yaen'].includes(s.phase)) {
    yaenPress(s);
  } else if ((s.phase === 'sinking' || s.phase === 'action') && s.method === 'jado') {
    drag(s);
  } else if (s.phase === 'sinking' || s.phase === 'action') {
    jerk(s, 'lift');
  } else if (s.phase === 'signal') {
    const late = s.t - s.signalAt;
    const light = s.bite?.light;
    // 初心者練習は、猶予の中なら必ず掛かる
    const chance = s.easy ? (late <= s.windows.late ? 1 : 0) : late <= s.windows.good ? (light ? 0.8 : 0.92) : late <= s.windows.late ? 0.35 : 0;
    if (s.rand() < chance) {
      s.phase = 'fight';
      if (!s.hooking.gedo) s.squid = Math.max(0, s.squid - 1);
      s.tension = 30;
      s.slackFor = 0;
      s.dist = Math.max(s.dist, 3);
      emit(s, 'hook', { id: s.hooking.id, late, bite: s.bite?.kind });
    } else {
      if (!s.hooking?.gedo) s.squid = Math.max(0, s.squid - 1);
      s.hooking = null;
      s.interest = 0.1;
      s.phase = 'action';
      s.lastDrag = s.t;
      emit(s, 'miss', { late, squidLeft: s.squid });
    }
    s.bite = null;
  } else if (s.phase === 'result') {
    s.phase = 'ready';
    s.last = null;
    emit(s, 'ready');
  }
}

// ダート（上へ強くスワイプ）。沈下・フォール中だけ
export function dart(s) {
  if (s.method === 'yaen') { yaenSide(s); return; }
  if (s.method === 'jado') return;
  if (s.phase === 'sinking' || s.phase === 'action') jerk(s, 'dart');
}

// 邪道エギング：エサを付け直す／エサを替える（投げる前だけ）
export function rebait(s, bait = s.bait) {
  if (s.phase !== 'ready' && s.phase !== 'result') return false;
  s.bait = BAITS.includes(bait) ? bait : s.bait;
  s.baitLeft = 1;
  emit(s, 'rebait', { bait: s.bait });
  return true;
}

/* ---------------- ヤエン ---------------- */
const between = (s, [a, b]) => a + (b - a) * s.rand();
// 横のボタンに今できること：'lift'（糸を上げる）／'cut'（糸を切る）／'yaen'（ヤエン投入）／null
export function yaenSideAction(s) {
  const y = s.yaen;
  if (s.method !== 'yaen' || !y?.on || !['run', 'draw'].includes(s.phase)) return null;
  if (y.checked === 'tako') return 'cut';
  if (s.phase === 'draw' && s.dist <= YAEN_DIST) return 'yaen';
  return y.checked ? null : 'lift';
}
// イカの集中（0〜1）とアジの残り（0〜1）。画面には出さない
export const yaenFocus = (s) => (s.yaen?.on ? 1 - Math.exp(-(s.t - s.yaen.at) / s.yaen.tau) : 0);
export const yaenAji = (s) => (s.yaen?.on ? Math.max(0, 1 - (s.t - s.yaen.at) / s.yaen.eat) : 1);

function yaenPress(s) {
  const y = s.yaen;
  if (s.phase === 'wait') { emit(s, 'recover'); endCast(s, 'recover'); return; }   // 待っている間に押す＝回収して投げ直す
  if (s.phase === 'yaen' && y?.reached) { yaenSet(s); return; }                      // 根元に入った後に押す＝竿を寄せて掛ける
  if (s.phase === 'run') {
    // 走っている最中・食べ始めに寄せ始める。集中が足りないと、ここで離しやすい
    s.phase = 'draw';
    y.drawFrom = s.t;
    emit(s, 'draw', { sec: Math.round(s.t - y.at) });
    if (!y.tako && s.rand() < Math.max(0, 0.75 - yaenFocus(s)) * 1.3 * (s.easy ? 0.5 : 1)) yaenLetGo(s, 'early');
  }
}
function yaenSide(s) {
  const act = yaenSideAction(s);
  const y = s.yaen;
  if (act === 'lift') {
    // 糸を上げて、竿（の先の糸）が浮くか。浮けばイカ、浮かなければタコ
    y.checked = y.tako ? 'tako' : 'squid';
    emit(s, 'lift', { tako: y.tako });
  } else if (act === 'cut') {
    // タコ：糸を切っておしまい（アジも失う）。外道の記録に残す
    gedoCatch(s, 'tako');
    emit(s, 'cut', {});
    endCast(s, 'cut');
  } else if (act === 'yaen') {
    s.phase = 'yaen';
    y.yaenPos = 0;
    emit(s, 'yaen-in', { dist: s.dist });
  }
}
function yaenLetGo(s, why) {
  const y = s.yaen;
  emit(s, 'yaen-letgo', { why, focus: yaenFocus(s), aji: yaenAji(s), tako: y.tako });
  y.on = false;
  s.hooking = null;
  endCast(s, why === 'eaten' ? 'eaten' : 'released');
}
// 抱いた：イカ（アオリ中心・大型が出やすい）かタコか
function yaenBite(s, tako) {
  const pool = speciesPool(s.month, s.tod).filter((p) => p.id === 'aori');
  const sp = pool.length ? pickWeighted(pool, s.rand) : null;
  let hooking = null;
  if (!tako && sp) {
    const [g0, g1] = sp.big && s.rand() < 0.15 ? sp.big : sp.g;
    const weight = Math.round(g0 + (g1 - g0) * s.rand() ** 1.1);   // エギより重い方へ寄せる（ヤエンのご褒美）
    hooking = { id: sp.id, weight, mantle: Math.round(sp.k * Math.cbrt(weight)), power: sp.power };
  } else if (!tako) {
    hooking = { id: 'aori', weight: 900, mantle: 24, power: 1 };
  }
  s.yaen = {
    on: true, tako, at: s.t, tau: between(s, YAEN_FOCUS_TAU), eat: between(s, YAEN_EAT) * (s.easy ? 1.4 : 1),
    runUntil: s.t + between(s, YAEN_RUN), nextSound: s.t + 3, resistUntil: -1, checked: null, drawFrom: null, yaenPos: 0, pulled: 0,
  };
  s.hooking = hooking;
  s.phase = 'run';
  s.signaled = true;
  s.reacted = true;
  s.guarantee = false;
  emit(s, 'yaen-bite', { tako });
  emit(s, 'drag-sound', { kind: tako ? 'choro' : 'run' });
}
function yaenTick(s, dt) {
  const y = s.yaen;
  if (s.phase === 'wait') {
    const waited = s.t - (y?.waitFrom ?? s.t);
    const moodFactor = 0.6 + 0.08 * s.cond.expectation;
    const tod = s.tod === 'morning' ? 1.4 : s.tod === 'evening' ? 1.2 : s.tod === 'night' ? 1.0 : 0.7;   // 朝マズメに大型（ぱっぱの実釣）
    const rate = (s.squid > 0 ? YAEN_BITE * s.squid * moodFactor * tod * (s.easy ? EASY.bite : 1) : 0) + (s.bonus === 'last' || s.bonus === 'rescue' ? 0.08 : 0);
    const forced = s.guarantee && waited > 14;
    if (forced || s.rand() < rate * dt) { yaenBite(s, false); return; }
    if (!s.easy && s.rand() < TAKO_RATE * dt) { yaenBite(s, true); return; }
    if (waited > YAEN_SPOIL) { emit(s, 'spoiled'); endCast(s, 'spoiled'); }
    return;
  }
  // 抱いてから：アジを食べ終えたら離れていく
  if (!y.tako && yaenAji(s) <= 0) { yaenLetGo(s, 'eaten'); return; }
  // ドラグの鳴り方（ヒント）：走る → 止まる（食べ始め）→ ときどきジジッ。タコはちょろちょろ出て止まる
  if (s.phase === 'run' && s.t < y.runUntil) s.dist += (y.tako ? 0.5 : 1.3) * dt;
  if (s.t >= y.nextSound) {
    const kind = y.tako ? 'choro' : s.t < y.runUntil ? 'run' : 'jiji';
    y.nextSound = s.t + (y.tako ? between(s, [1.5, 3]) : between(s, [5, 9]));
    if (s.phase !== 'yaen' || kind === 'jiji') emit(s, 'drag-sound', { kind });
    if (kind === 'jiji' || kind === 'choro') { y.resistUntil = s.t + 1.2; y.pullSaid = false; }
  }
  const resisting = s.t < y.resistUntil;
  if (s.phase === 'draw') {
    if (s.pressing) {
      if (y.tako) {
        // タコは寄らない。寄せ続けると岩に入られる
        s.dist = Math.max(3, s.dist - 0.25 * dt);
        y.pulled += dt;
        if (y.pulled > TAKO_ROCK) { gedoCatch(s, 'tako'); emit(s, 'tako-rock'); endCast(s, 'tako-rock'); return; }
      } else if (resisting) {
        // 抵抗している時に巻く：強く引いて下がる。アジを離すこともある（集中が足りないほど）
        s.dist += YAEN_PULL * dt;
        if (!y.pullSaid) { y.pullSaid = true; emit(s, 'yaen-pull', {}); }
        if (s.rand() < (1.2 - yaenFocus(s)) * 1.0 * (s.easy ? 0.4 : 1) * dt) { yaenLetGo(s, 'resist'); return; }
      } else {
        s.dist = Math.max(2, s.dist - YAEN_REEL * dt);
        // 集中が足りないまま巻くと、アジを離す
        if (s.rand() < Math.max(0, 0.7 - yaenFocus(s)) * 0.5 * (s.easy ? 0.4 : 1) * dt) { yaenLetGo(s, 'early'); return; }
      }
    } else if (resisting && !y.tako) s.dist += YAEN_BACK * dt;   // 手を止めている：ゆっくり後ろに下がる
    return;
  }
  if (s.phase === 'yaen') {
    // ヤエンが糸を滑っていく。竿を立てている（押している）ほど速い
    if (y.reached) return;   // 根元に入った：あとは竿を寄せて掛ける（yaenPress）
    y.yaenPos += YAEN_SLIDE[s.pressing ? 1 : 0] * dt;
    if (y.yaenPos >= s.dist) {
      if (y.tako) { gedoCatch(s, 'tako'); emit(s, 'tako-rock'); endCast(s, 'tako-rock'); return; }
      y.yaenPos = s.dist;
      y.reached = true;
      y.reachAt = s.t;
      emit(s, 'yaen-reach', {});
    }
  }
}
// ヤエンが根元に入った後に竿を寄せる：針がイカの胴に刺さり、驚いて下がったところでフッキング完了（2026-09-27 ぱっぱ）
function yaenSet(s) {
  const y = s.yaen;
  if (s.rand() < YAEN_HOOK_FAIL) { emit(s, 'yaen-miss'); y.on = false; s.hooking = null; endCast(s, 'yaen-miss'); return; }
  y.on = false;
  s.phase = 'fight';
  s.tension = 30;
  s.slackFor = 0;
  s.squid = Math.max(0, s.squid - 1);
  s.hooking.bonus = true;   // ヤエンのやり取りはやさしめ（本番はここまで）
  emit(s, 'hook', { id: s.hooking.id, yaen: true });
}

// 外道を取り込む（ファイトの無いもの：海藻・ゴミ）
function gedoCatch(s, id) {
  const [g0, g1] = GEDO[id].g;
  const g = { id, weight: Math.round(g0 + (g1 - g0) * s.rand()) };
  s.gedo.push(g);
  emit(s, 'gedo', g);
}
// 根掛かり。ときどきゴミが引っかかっていただけ（エギは戻る）
function snagOrJunk(s) {
  if (s.rand() > 1 - JUNK_SHARE) {   // 大きい方の目で判定（小さい目＝根掛かりのテストと干渉させない）
    gedoCatch(s, s.rand() < 0.5 ? 'boot' : 'can');
    endCast(s, 'junk');
    return true;
  }
  s.egi -= 1;
  emit(s, 'snag', { egiLeft: s.egi });
  endCast(s, 'snag');
  return true;
}
// カサゴが食った（底で「コン」）
function startKasago(s) {
  const [g0, g1] = GEDO.kasago.g;
  s.hooking = { id: 'kasago', gedo: true, weight: Math.round(g0 + (g1 - g0) * s.rand() ** 1.3), mantle: 0, power: GEDO.kasago.power };
  s.bite = { kind: 'tap', light: false };
  s.windows = signalWindows(s.cond, 'tap', false, s.easy);
  s.phase = 'signal';
  s.signalAt = s.t;
  s.signaled = true;
  s.reacted = true;
  emit(s, 'signal', { kind: 'tap', light: false, gedo: true });
}

// 邪道エギング：ズル引き1回（リール2巻き）。着底してから。
// 止めて（JADO_GOOD_STOP 秒以上）から引くといいリズム＝気を引く。引きっぱなしは逆効果。引くたびに根掛かりの危険
function drag(s) {
  if (s.depth < s.bottom) return;
  const rhythm = s.t - s.lastDrag;
  if (s.kotsuPending && s.t - s.kotsuAt < KOTSU_SPOOK) {
    // コツコツの直後に動かしてしまった：離れていくことがある
    const left = s.rand() < 0.35;
    if (left) s.squid = Math.max(0, s.squid - 1);
    s.interest = Math.max(0.05, s.interest - 0.15);
    emit(s, 'spooked', { left, squidLeft: s.squid, kotsu: true });
  }
  s.kotsuPending = false;
  const good = rhythm >= JADO_GOOD_STOP;
  if (good) s.interest = Math.min(1, s.interest + 0.12);
  else if (rhythm < 0.8) s.interest = Math.max(0.05, s.interest - 0.05);
  s.dist = Math.max(0, s.dist - JADO_DRAG);
  s.lastDrag = s.t;
  s.lastJerk = s.t;
  s.phase = 'action';
  emit(s, 'drag', { good });
  if (!s.easy && s.rand() < JADO_SNAG * (s.rock ? ROCK_SNAG : 1)) snagOrJunk(s);
  else if (!s.rock && s.rand() > 1 - NAMAKO_CHANCE) { gedoCatch(s, 'namako'); endCast(s, 'gedo'); }   // 砂地の底で、ナマコが乗ってくる
  else if (s.dist <= 2) { emit(s, 'recover'); endCast(s, 'recover'); }
}

const CUTTLE = ['kouika', 'shiriyake', 'mongo'];
// 邪道エギングの、アタリの元（止めている間）。egi のフォール中の判定と同じ考え方で、底・匂い・コツコツを足したもの
function jadoAction(s, dt) {
  const stop = s.t - s.lastDrag;
  if (!s.easy && s.rand() < JADO_SNAG_IDLE * (s.rock ? ROCK_SNAG : 1) * dt) { snagOrJunk(s); return; }
  if (s.kotsuPending && s.t - s.kotsuAt >= KOTSU_WAIT) {
    s.kotsuPending = false;
    s.interest = Math.min(1, s.interest + 0.2);
    emit(s, 'kotsu-wait', { interest: s.interest });
  }
  if (stop > 10) s.interest = Math.max(0, s.interest - 0.05 * dt);
  if (stop < JADO_STOP) return;
  if (s.rand() < KASAGO_RATE.jado * (s.rock ? 1.6 : 0.6) * dt) { startKasago(s); return; }
  if (!(s.squid > 0 || s.guarantee)) return;
  const cands = contactWeights(s).filter((p) => p.w > 0).map((p) => (CUTTLE.includes(p.id) ? { ...p, w: p.w * JADO_CUTTLE } : p));
  const sumW = cands.reduce((a, p) => a + p.w, 0);
  const moodFactor = 0.6 + 0.08 * s.cond.expectation;
  const scent = 0.55 + 0.45 * s.baitLeft;                        // エサが新しいほど効く
  const night = s.tod === 'night' ? 1 + 0.6 * s.baitLeft : 1;    // 夜は匂いで寄る（ぱっぱの実釣）
  const rate = JADO_HUG * HUG_SCALE * s.interest * moodFactor * (sumW / AVAIL_NORM) * scent * night
    * (s.easy ? EASY.bite : 1) * (s.bonus === 'last' ? LAST_BOOST : 1);
  if (s.guarantee) s.guaranteeFall += dt;
  const forced = s.guarantee && s.guaranteeFall >= LAST_GUARANTEE;
  const pool = forced && !cands.length ? speciesPool(s.month, s.tod).filter((p) => p.w > 0) : cands;
  if (!(forced ? pool.length > 0 : cands.length && s.rand() < rate * dt)) return;
  s.baitLeft = Math.max(0, s.baitLeft - BAIT_USE.bite);
  s.reacted = true;
  // 深夜はコツコツだけで抱かないことがある（ぱっぱの実釣）。保証の時は出さない
  if (!forced && !s.guarantee && s.tod === 'night' && !s.kotsuPending && s.rand() < KOTSU_SHARE) {
    s.kotsuAt = s.t;
    s.kotsuPending = true;
    emit(s, 'kotsu', {});
    return;
  }
  const sure = forced || s.guarantee;
  const sp = pickWeighted(pool, s.rand);
  const [g0, g1] = sp.big && s.rand() < 0.06 ? sp.big : sp.g;
  const weight = Math.round(g0 + (g1 - g0) * s.rand() ** 1.6);
  s.hooking = { id: sp.id, weight, mantle: Math.round(sp.k * Math.cbrt(weight)), power: sp.power, ...(sure ? { bonus: true } : {}) };
  s.bite = { kind: 'heavy', light: false };
  s.windows = signalWindows(s.cond, 'heavy', false, s.easy || sure);
  s.phase = 'signal';
  s.signalAt = s.t;
  s.signaled = true;
  s.guarantee = false;
  emit(s, 'signal', { kind: 'heavy', light: false, ...(sure ? { bonus: true } : {}) });
}

export function release(s) {
  if (!s.pressing) return;
  s.pressing = false;
  if (s.tensionFall) {
    s.tensionFall = false;
    emit(s, 'fall', { mode: 'free' });
  }
  if (s.phase === 'aiming') {
    s.casts -= 1;
    s.castDist = Math.round((10 + s.power * 30) * SIZE_DIST[s.spec.size]);
    s.dist = s.castDist;
    s.depth = 0;
    s.bottom = 5 + Math.round(s.rand() * 5);
    s.weed = s.method === 'jado' || s.method === 'yaen' ? null : makeWeed(s);   // 邪道・ヤエンは底に置く釣り（藻場は出さない）
    s.yaen = null;
    s.rock = s.method === 'jado' && s.rand() < ROCK_CHANCE;
    s.lastDrag = s.t;
    s.kotsuPending = false;
    if (s.method === 'jado') s.baitLeft = Math.max(0, s.baitLeft - BAIT_USE.cast);
    s.weedSeen = false;
    s.bottomFor = 0;
    s.interest = 0.15;
    s.jerks = [];
    s.darts = 0;
    s.lastJerk = s.t;
    s.judged = true;
    s.hooking = null;
    s.bite = null;
    s.punchAt = -99;
    s.punchPending = false;
    s.liftAt = -99;
    s.signaled = false;
    s.reacted = false;
    s.letGo = null;
    s.bonus = null;
    s.guarantee = false;
    s.guaranteeFall = 0;
    if (s.rotated) { s.interest += ROTATE_GAIN; s.rotated = false; emit(s, 'rotation', {}); }
    s.squid = sampleSquid(s);
    // 邪道エギングは、夜はエサの匂いで寄ってくる（エサが新しいほど）。気になり具合もエサしだい
    if (s.method === 'jado') {
      if (s.squid === 0 && s.tod === 'night' && s.rand() < 0.35 * s.baitLeft) s.squid = 1;
      s.interest = 0.15 + 0.3 * s.baitLeft;
    }
    // 藻場がある投げは、近くにいるイカが多い（産卵・隠れ家に集まる）。イカがいない投げでも寄ってくることがあるが、
    // その確率は日の良し悪し（期待値）に比例させて、悪い日は救わない
    if (s.weed) {
      if (s.squid > 0) { if (s.rand() < 0.6) s.squid += 1; }
      else if (s.rand() < 0.5 * (s.cond.expectation / 10) ** 2) s.squid = 1;   // 期待値2で2%、7で25%、10で50%
    }
    // ラストチャンス／救済（初心者練習には入れない）
    if (!s.easy) {
      if (s.casts === 0) {
        s.bonus = 'last';
        s.squid = Math.max(s.squid, 1);
        s.guarantee = s.catches.length === 0;
      } else if (s.quiet >= RESCUE_AFTER && !s.rescued) {
        s.bonus = 'rescue';
        s.rescued = true;
        s.squid = Math.max(s.squid, 1);
      }
    }
    s.phase = 'sinking';
    emit(s, 'cast', { dist: s.castDist, bottom: s.bottom, egi: s.spec, weed: s.weed });
    if (s.bonus) {
      // 救済のヒント：同じ色で反応が無い投げが続いていれば色、そうでなければ棚（深さ）
      const hint = s.bonus === 'rescue' ? ((s.dryCasts ?? 0) >= 2 ? 'color' : 'zone') : null;
      emit(s, 'bonus', { kind: s.bonus, guarantee: s.guarantee, hint });
    }
  }
}

// しゃくりの誘いを評価する（フォールに入って2秒たったところで1回だけ）。
// やる気のある日はダートや2段しゃくりが効き、渋い日は控えめの1〜2回が効いてダートは嫌われる
function judgeRhythm(s) {
  const n = s.jerks.length;
  const active = s.mood === 'active';
  let gain;
  if (n >= 5) gain = active ? -0.2 : -0.25;
  else if (s.darts > 0) gain = active ? 0.4 : -0.05;
  else if (n === 1) gain = active ? 0.15 : 0.3;
  else if (n === 2) gain = active ? 0.35 : 0.25;
  else if (n === 3) gain = active ? 0.3 : 0.1;
  else gain = 0.05;
  // 棚が合っていないと、いくら誘ってもイカは寄ってこない（良い誘いほど棚の合い具合で割り引く）
  if (gain > 0) gain *= 0.25 + 0.75 * zoneFit(s);
  s.interest = Math.min(1, Math.max(0, s.interest + gain));
  s.judged = true;
  emit(s, 'rhythm', { streak: n, darts: s.darts, interest: s.interest, mood: s.mood });
}

// 底にいると根掛かりすることがある（ディープほど掛かりやすい）
function onBottom(s, dt) {
  s.bottomFor += dt;
  // 岩場の藻場のまわりの底は根が多い（1.5倍）
  const rocky = overWeed(s) && WEEDS[s.weed.kind].rocky ? 1.5 : 1;
  if (!s.easy && s.bottomFor > 1.5 && s.rand() < 0.12 * TYPE_SNAG[s.spec.type] * rocky * dt) {   // 初心者練習は根掛かりしない
    return snagOrJunk(s);
  }
  // カサゴ（外道）：底でじっとしていると、ときどき食う
  if (s.bottomFor > 2 && s.rand() < KASAGO_RATE.egi * rocky * dt) { startKasago(s); return true; }
  return false;
}

// いまのエギ（棚・号数）に対する、イカごとの抱きやすさ。
//   出やすさ（月・時間帯）× 棚が合っているか × 号数が合っているか。
//   シリヤケイカは「駆け上がりから巻き上げたとき」に食う（ダディの実釣）：底から持ち上げた直後（1.5秒）と、
//   手前の駆け上がり（残り8m以内）で抱きやすい
export const LIFT_WINDOW = 1.5;
export const SLOPE_DIST = 8;

// 藻場（2026-09-27、ぱっぱ：アマモなどの藻にイカは産卵する。近くで誘うと抱きやすいが、藻に掛かるのでシビア）
// 1投ごとに WEED_CHANCE の確率で、投げた距離の 55〜95% のあたり（着水点のまわり）に幅5〜8mの藻場ができる。
// height＝海底からの藻の高さ（m）。エギがその高さより下に入ると藻に掛かることがある（エギは減らない。その1投はおしまい）。
// rocky＝岩場の藻（まわりの底で根掛かりもしやすい）。boost＝エギが藻場の上にある時の抱く勢い（春・初夏／それ以外）
export const WEED_CHANCE = 0.6;
export const WEEDS = {
  amamo: { height: 1.2, rocky: false, boost: [3.0, 2.2] },       // アマモ：砂地。春の産卵場所の代表
  hondawara: { height: 2.0, rocky: true, boost: [2.4, 2.2] },    // ホンダワラ類：岩場。背が高く一番シビア
  umitoranoo: { height: 0.8, rocky: true, boost: [2.4, 2.0] },   // ウミトラノオ・ウミゾウメン：岩場。低く扱いやすい
};
export const WEED_SNAG = 0.45;   // 藻の高さより下にいる時、1秒あたり藻に掛かる確率（タイプで増減）
export const overWeed = (s) => Boolean(s.weed) && s.dist >= s.weed.from && s.dist <= s.weed.to;
// イカは藻場の「まわり」に集まる：前後 WEED_NEAR m まで抱きやすい（真上は藻に掛かる危険もある）
export const WEED_NEAR = 3;
export const nearWeed = (s) => Boolean(s.weed) && s.dist >= s.weed.from - WEED_NEAR && s.dist <= s.weed.to + WEED_NEAR;
export const weedBoost = (s) => {
  if (!nearWeed(s)) return 1;
  const w = WEEDS[s.weed.kind];
  const sp = seasonOf(s.month);
  return sp === 'spring' || sp === 'earlySummer' ? w.boost[0] : w.boost[1];
};
function makeWeed(s) {
  if (s.rand() >= WEED_CHANCE || s.castDist < 10) return null;
  const kinds = Object.keys(WEEDS);
  const kind = kinds[Math.floor(s.rand() * kinds.length)];
  const width = 5 + s.rand() * 3;
  const from = Math.max(3, s.castDist * (0.55 + s.rand() * 0.4) - width / 2);   // 着水点のまわり（手前すぎるとエギが寄る前に1投が終わる）
  return { kind, from: Math.round(from * 10) / 10, to: Math.round((from + width) * 10) / 10, height: WEEDS[kind].height };
}
// 藻場の上に入った合図（1投に1回）と、藻に掛かる判定。掛かったら true
function checkWeed(s, dt) {
  if (!s.weed) return false;
  const over = overWeed(s);
  if (over && !s.weedSeen) { s.weedSeen = true; emit(s, 'weedOver', { kind: s.weed.kind }); }
  if (!over || s.easy || s.depth < s.bottom - s.weed.height) return false;
  if (s.rand() < WEED_SNAG * TYPE_SNAG[s.spec.type] * dt) {
    if (s.rand() < WEED_GEDO) gedoCatch(s, 'seaweed');
    emit(s, 'weed', { kind: s.weed.kind });
    endCast(s, 'weed');
    return true;
  }
  return false;
}
export function contactWeights(s) {
  const frac = s.bottom > 0 ? Math.min(1, s.depth / s.bottom) : 0;
  const lifting = s.t - s.liftAt < LIFT_WINDOW;
  return speciesPool(s.month, s.tod).map((p) => {
    let w = p.w * zoneMatch(frac, p.zone) * sizeMatch(s.spec.size, p.ideal);
    if (p.lift) w *= (lifting ? 2 : 1) * (s.dist <= SLOPE_DIST ? 1.3 : 1);
    return { ...p, w };
  });
}
// 今のエギの棚が、その月・時間帯のイカの好きな棚にどれくらい合っているか（出やすさで重みづけ。0.15〜1）
export function zoneFit(s) {
  const frac = s.bottom > 0 ? Math.min(1, s.depth / s.bottom) : 0;
  const pool = speciesPool(s.month, s.tod);
  const total = pool.reduce((a, p) => a + p.w, 0);
  return total > 0 ? pool.reduce((a, p) => a + p.w * zoneMatch(frac, p.zone), 0) / total : 0;
}
// 棚が合わない所（合い具合 ZONE_OFF 未満）に ZONE_PATIENCE 秒以上いると、寄っていたイカが離れていく（1秒あたり ZONE_LEAVE の確率）
export const ZONE_OFF = 0.35;
export const ZONE_PATIENCE = 4;
export const ZONE_LEAVE = 0.1;

// 抱く勢いの全体の大きさ（以前の「底ほど抱く×季節×時間帯」と同じくらいになるよう合わせた係数）
const HUG_SCALE = 0.8;

export function tick(s, dt) {
  s.events = [];
  s.t += dt;
  switch (s.phase) {
    case 'aiming': {
      // 力は 0→1→0 を1.6秒で行き来する（ちょうどいい所で離す）
      const x = ((s.t - s.aimFrom) / 0.8) % 2;
      s.power = x <= 1 ? x : 2 - x;
      break;
    }
    case 'wait':
    case 'run':
    case 'draw':
    case 'yaen':
      yaenTick(s, dt);
      break;
    case 'sinking': {
      if (s.method === 'yaen') {
        s.depth = Math.min(s.bottom, s.depth + YAEN_SINK * dt);
        if (s.depth >= s.bottom) { s.phase = 'wait'; s.yaen = { on: false, waitFrom: s.t }; emit(s, 'bottom', {}); }
        break;
      }
      s.depth = Math.min(s.bottom, s.depth + sinkRate(s.spec) * (s.method === 'jado' ? JADO_SINK : 1) * dt);
      if (s.method === 'jado') {
        if (s.depth >= s.bottom) { s.phase = 'action'; s.lastDrag = s.t; emit(s, 'bottom', {}); }
        break;
      }
      if (checkWeed(s, dt)) break;
      if (s.depth >= s.bottom) onBottom(s, dt);
      break;
    }
    case 'action': {
      if (s.method === 'jado') { jadoAction(s, dt); break; }
      const since = s.t - s.lastJerk;
      // しゃくった後も押したまま＝テンションフォール（ゆっくり沈み、手前に寄ってくる）
      if (s.pressing && !s.tensionFall && s.t - s.pressAt >= TENSION_HOLD) {
        s.tensionFall = true;
        emit(s, 'fall', { mode: 'tension' });
      }
      const fall = sinkRate(s.spec) * (s.tensionFall ? TENSION_FALL : FREE_FALL);
      if (s.depth < s.bottom) {
        s.depth = Math.min(s.bottom, s.depth + fall * dt);
        if (s.tensionFall) s.dist = Math.max(0, s.dist - 0.35 * dt);
        if (checkWeed(s, dt)) break;
      } else if (checkWeed(s, dt) || onBottom(s, dt)) break;
      if (!s.judged && since >= 2) judgeRhythm(s);
      if (since > 9) s.interest = Math.max(0, s.interest - 0.1 * dt);
      // 棚が合わない所に居続けると、寄っていたイカが離れていく
      if (s.squid > 0 && zoneFit(s) < ZONE_OFF) {
        s.offZoneFor = (s.offZoneFor ?? 0) + dt;
        if (s.offZoneFor > ZONE_PATIENCE && s.rand() < ZONE_LEAVE * dt) {
          s.squid -= 1;
          s.offZoneFor = 0;
          emit(s, 'drift-away', { squidLeft: s.squid });
        }
      } else {
        s.offZoneFor = 0;
      }
      // パンチの後、しゃくらずに待てた（抱かせる間を作れた）
      if (s.punchPending && s.t - s.punchAt >= PUNCH_WAIT) {
        s.punchPending = false;
        s.interest = Math.min(1, s.interest + PUNCH_GAIN);
        emit(s, 'punch-wait', { interest: s.interest });
      }
      // ボス：近くのイカの数に関係なく、条件（月・時間帯・棚）が合うとごくまれに抱く
      if (since >= 1 && s.depth < s.bottom) {
        const frac = s.bottom > 0 ? s.depth / s.bottom : 0;
        const boss = bossesFor(s.month, s.tod).find((b) => zoneMatch(frac, b.zone) >= 1 && s.rand() < b.rate * s.interest * 2 * dt);
        if (boss) {
          const weight = Math.round(boss.g[0] + (boss.g[1] - boss.g[0]) * s.rand() ** 1.4);
          const mantle = Math.round(boss.mantle[0] + (boss.mantle[1] - boss.mantle[0]) * s.rand());
          s.hooking = { id: boss.id, weight, mantle, power: boss.power, boss: true };
          const kind = s.tensionFall ? 'run' : 'stop';   // 大物は走るか、重く止まる
          s.bite = { kind, light: false };
          s.windows = signalWindows(s.cond, kind, false, s.easy);
          s.phase = 'signal';
          s.signalAt = s.t;
          s.signaled = true;
          s.reacted = true;
          s.guarantee = false;
          emit(s, 'signal', { kind, light: false, tensionFall: s.tensionFall, boss: true });
          break;
        }
      }
      // フォール中（しゃくって1秒後から）にだけ抱く。近くにイカがいて、そのイカの好きな棚にエギがあるほど、
      // 気になっているほど抱きやすい。シリヤケイカだけは、底から持ち上げた直後（0.3秒後から）も食う
      const lifting = s.t - s.liftAt < LIFT_WINDOW;
      if ((since >= 1 || (lifting && since >= 0.3)) && s.depth < s.bottom && (s.squid > 0 || s.guarantee)) {
        const weights = contactWeights(s);
        // しゃくって1秒たつまでは、巻き上げで食うイカ（シリヤケ）だけが候補
        const cands = weights.filter((p) => p.w > 0 && (since >= 1 || p.lift));
        const sumW = cands.reduce((a, p) => a + p.w, 0);
        const moodFactor = 0.6 + 0.08 * s.cond.expectation; // 期待値0で0.6倍、10で1.4倍
        // 渋い日は長いテンションフォールが効き、やる気のある日は速いフリーフォールでも抱く
        const fallFactor = s.mood === 'calm' ? (s.tensionFall ? 1.25 : 0.85) : (s.tensionFall ? 1.0 : 1.1);
        const rate = 0.55 * HUG_SCALE * s.interest * moodFactor * fallFactor * (sumW / AVAIL_NORM)
          * colorFit(s.spec.color, { tod: s.tod, cond: s.cond, mood: s.mood }) * (s.easy ? EASY.bite : 1) * weedBoost(s)
          * (s.bonus === 'last' ? LAST_BOOST : 1);
        // ラストチャンスの保証：しゃくってフォールさせた時間が合計 LAST_GUARANTEE 秒に達したら、必ず抱く
        if (s.guarantee && since >= 1) s.guaranteeFall += dt;
        const forced = s.guarantee && s.guaranteeFall >= LAST_GUARANTEE;
        // 棚が合っていなくて候補がいない時も、保証の時は出やすさだけで選ぶ
        const pool = forced && !cands.length ? speciesPool(s.month, s.tod).filter((p) => p.w > 0) : cands;
        if (!forced && !s.punchPending && s.t - s.punchAt > 3 && s.rand() < PUNCH_SHARE * rate * dt) {
          s.punchAt = s.t;
          s.punchPending = true;
          s.reacted = true;
          emit(s, 'punch', { tensionFall: s.tensionFall });
        } else if (forced ? pool.length > 0 : cands.length && s.rand() < rate * dt) {
          // 保証中に出たアタリは、保証の時間を待たずに出たものでも「保証のアタリ」として扱う（先にふつうのアタリが出て、
          // 見逃しやすい形・ふつうのファイトで保証を使い切ってしまうのを防ぐ。9/27 良い日ほどボウズが多い逆転が出た）
          const sure = forced || s.guarantee;
          const sp = pickWeighted(pool, s.rand);
          // 重さは範囲の軽い方に寄せる。まれに大型（春の親アオリの3kg級など）
          const [g0, g1] = sp.big && s.rand() < 0.06 ? sp.big : sp.g;
          const weight = Math.round(g0 + (g1 - g0) * s.rand() ** 1.6);
          s.hooking = { id: sp.id, weight, mantle: Math.round(sp.k * Math.cbrt(weight)), power: sp.power, ...(sure ? { bonus: true } : {}) };
          // ラストチャンスの保証のアタリは「ラインが走る」はっきりした形で、アワセの猶予は🔰初心者練習なみに長め
          const kind = sure ? 'run' : pickWeighted(BITE_MIX[s.tensionFall ? 'tension' : 'free'], s.rand).kind;
          const light = !sure && s.rand() < (s.mood === 'calm' ? 0.3 : 0.2); // 軽い抱き（猶予が短い）
          s.bite = { kind, light };
          s.windows = signalWindows(s.cond, kind, light, s.easy || sure);
          s.phase = 'signal';
          s.signalAt = s.t;
          s.signaled = true;
          s.reacted = true;
          s.guarantee = false;
          emit(s, 'signal', { kind, light, tensionFall: s.tensionFall, ...(sure ? { bonus: true } : {}) });
          break;
        }
      }
      if (s.dist <= 2) {
        emit(s, 'recover');
        endCast(s, 'recover');
      }
      break;
    }
    case 'signal': {
      if (s.t - s.signalAt > s.windows.late) {
        s.letGo = s.method === 'jado' ? null : { at: s.t, hooking: s.hooking };   // しゃくったら乗ってた、のために少しだけ覚えておく
        if (!s.hooking?.gedo) s.squid = Math.max(0, s.squid - 1);
        s.hooking = null;
        s.bite = null;
        s.lastDrag = s.t;
        s.interest = 0.1;
        s.phase = 'action';
        s.lastJerk = s.t - 1; // 見送った直後は少し待つ
        emit(s, 'let-go', { squidLeft: s.squid });
      }
      break;
    }
    case 'fight': {
      const p = s.hooking.power;
      // イカの体力：ジェットのたび、また時間とともに減る。ゆるめた時に糸を引き出す力も体力に比例（大物も最後は寄る）
      s.hooking.stamina ??= 1;
      s.hooking.stamina = Math.max(STAMINA_MIN, s.hooking.stamina - STAMINA_DECAY * dt);
      if (s.pressing) {
        // 重いイカほど巻いても寄ってこない（2kg級は2分ほどのファイト＝ダディの実感 2026-09-25）
        s.dist = Math.max(0, s.dist - (2.2 / (1 + REEL_WEIGHT * Math.min(s.hooking.boss ? BOSS_REEL_CAP : Infinity, s.hooking.weight ?? 0) / 1000)) * dt);
        s.tension += (22 + p * 22) * dt * (s.easy || s.hooking?.bonus ? EASY.tension : 1);
      } else {
        s.tension -= 45 * dt;
        s.dist += 0.6 * p * s.hooking.stamina * dt;
      }
      // ジェット噴射：大きいイカほどよく走る。波が高いとやり取りが荒れる。
      // ただし連発すると疲れる（ダディ指摘 2026-09-25：春の大型アオリが走りすぎて寄せられない）：
      //   噴射のあと JET_GAP 秒は次を出せない／JET_BURST 回続けたら JET_REST 秒休む／噴射のたびに体力が減って出にくくなる
      const hk = s.hooking;
      hk.stamina ??= 1;
      hk.jets ??= [];
      const recent = hk.jets.filter((t) => s.t - t < JET_WINDOW);
      const resting = recent.length >= JET_BURST && s.t - recent[recent.length - 1] < JET_REST;
      const canJet = !resting && s.t - (hk.jets[hk.jets.length - 1] ?? -99) >= JET_GAP;
      if (canJet && s.rand() < 0.7 * p * hk.stamina * (1 + 0.3 * Math.min(3, s.cond.wave)) * (s.easy || s.hooking?.bonus ? EASY.jet : 1) * dt) {
        if (s.pressing) s.tension += 22 * (s.easy || s.hooking?.bonus ? EASY.tension : 1);   // 初心者練習は噴射の引きもやさしく
        else s.dist += 1;
        hk.jets.push(s.t);
        hk.stamina = Math.max(STAMINA_MIN, hk.stamina - 0.15);
        emit(s, 'jet');
      }
      s.tension = Math.max(0, s.tension);
      s.slackFor = s.tension <= 0 ? s.slackFor + dt : 0;
      if (s.tension >= 100) {
        emit(s, 'break', { id: s.hooking.id });
        s.hooking = null;
        endCast(s, 'break');
      } else if (s.slackFor > SLACK_LIMIT * (s.easy || s.hooking?.bonus ? EASY.slack : 1)) {
        emit(s, 'unhooked', { id: s.hooking.id });
        s.hooking = null;
        endCast(s, 'unhooked');
      } else if (s.dist <= 0 && s.hooking.gedo) {
        const g = { id: s.hooking.id, weight: s.hooking.weight };
        s.gedo.push(g);
        emit(s, 'landed', { ...g, gedo: true });
        s.hooking = null;
        endCast(s, 'gedo');
      } else if (s.dist <= 0) {
        const c = { id: s.hooking.id, weight: s.hooking.weight, mantle: s.hooking.mantle, ...(s.hooking.boss ? { boss: true } : {}) };
        s.catches.push(c);
        emit(s, 'landed', c);
        s.hooking = null;
        endCast(s, 'landed');
      }
      break;
    }
    default:
      break;
  }
  return s.events;
}

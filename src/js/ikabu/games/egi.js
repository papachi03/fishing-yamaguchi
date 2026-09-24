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
export const EGI_STOCK = 3; // 根掛かりで失うと減る
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
export const DEFAULT_EGI = { size: 3, type: 'normal' };

export function normalizeEgi(e = {}) {
  const size = EGI_SIZES.includes(Number(e.size)) ? Number(e.size) : DEFAULT_EGI.size;
  const type = EGI_TYPES.includes(e.type) ? e.type : DEFAULT_EGI.type;
  return { size, type };
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
// ジェット噴射の間隔と疲れ（fight 中）
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
export function signalWindows(cond, kind = 'run', light = false) {
  const k = windFactor(cond) * (light ? 0.6 : 1);
  return { good: BITES[kind].good * k, late: BITES[kind].late * k };
}

// ---------------- 状態 ----------------
export function createEgi({ seed = String(Date.now()), month = 9, tod = 'evening', rand, conditions, egi } = {}) {
  const cond = normalizeConditions(conditions);
  const spec = normalizeEgi(egi);
  return {
    rand: rand ?? seeded(seed),
    month,
    tod,
    cond,
    spec, // 使っているエギ（号数・タイプ）
    mood: moodOf(month, tod, cond),
    windows: signalWindows(cond), // いまのアタリのアワセ猶予（アタリが出るたびに種類に合わせて入れ替える）
    bite: null, // いまのアタリ { kind, light }
    punchAt: -99, // 最後のイカパンチの時刻
    liftAt: -99, // 底からエギを持ち上げた時刻（シリヤケイカは巻き上げで食う）
    punchPending: false, // パンチの後、まだ「待った／すぐしゃくった」が決まっていない
    squid: 0,
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
  s.spec = normalizeEgi(egi);
  return true;
}

const emit = (s, type, data = {}) => s.events.push({ type, t: s.t, ...data });

// その回の投げを終えて、次の構えへ（もう投げられなければ終了）
function endCast(s, why) {
  s.last = why;
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
  } else if (s.phase === 'sinking' || s.phase === 'action') {
    jerk(s, 'lift');
  } else if (s.phase === 'signal') {
    const late = s.t - s.signalAt;
    const light = s.bite?.light;
    const chance = late <= s.windows.good ? (light ? 0.8 : 0.92) : late <= s.windows.late ? 0.35 : 0;
    if (s.rand() < chance) {
      s.phase = 'fight';
      s.squid = Math.max(0, s.squid - 1);
      s.tension = 30;
      s.slackFor = 0;
      s.dist = Math.max(s.dist, 3);
      emit(s, 'hook', { id: s.hooking.id, late, bite: s.bite?.kind });
    } else {
      s.hooking = null;
      s.squid = Math.max(0, s.squid - 1);
      s.interest = 0.1;
      s.phase = 'action';
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
  if (s.phase === 'sinking' || s.phase === 'action') jerk(s, 'dart');
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
    s.squid = sampleSquid(s);
    s.phase = 'sinking';
    emit(s, 'cast', { dist: s.castDist, bottom: s.bottom, egi: s.spec });
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
  if (s.bottomFor > 1.5 && s.rand() < 0.12 * TYPE_SNAG[s.spec.type] * dt) {
    s.egi -= 1;
    emit(s, 'snag', { egiLeft: s.egi });
    endCast(s, 'snag');
    return true;
  }
  return false;
}

// いまのエギ（棚・号数）に対する、イカごとの抱きやすさ。
//   出やすさ（月・時間帯）× 棚が合っているか × 号数が合っているか。
//   シリヤケイカは「駆け上がりから巻き上げたとき」に食う（ダディの実釣）：底から持ち上げた直後（1.5秒）と、
//   手前の駆け上がり（残り8m以内）で抱きやすい
export const LIFT_WINDOW = 1.5;
export const SLOPE_DIST = 8;
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
    case 'sinking': {
      s.depth = Math.min(s.bottom, s.depth + sinkRate(s.spec) * dt);
      if (s.depth >= s.bottom) onBottom(s, dt);
      break;
    }
    case 'action': {
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
      } else if (onBottom(s, dt)) break;
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
      // フォール中（しゃくって1秒後から）にだけ抱く。近くにイカがいて、そのイカの好きな棚にエギがあるほど、
      // 気になっているほど抱きやすい。シリヤケイカだけは、底から持ち上げた直後（0.3秒後から）も食う
      const lifting = s.t - s.liftAt < LIFT_WINDOW;
      if ((since >= 1 || (lifting && since >= 0.3)) && s.depth < s.bottom && s.squid > 0) {
        const weights = contactWeights(s);
        // しゃくって1秒たつまでは、巻き上げで食うイカ（シリヤケ）だけが候補
        const cands = weights.filter((p) => p.w > 0 && (since >= 1 || p.lift));
        const sumW = cands.reduce((a, p) => a + p.w, 0);
        const moodFactor = 0.6 + 0.08 * s.cond.expectation; // 期待値0で0.6倍、10で1.4倍
        // 渋い日は長いテンションフォールが効き、やる気のある日は速いフリーフォールでも抱く
        const fallFactor = s.mood === 'calm' ? (s.tensionFall ? 1.25 : 0.85) : (s.tensionFall ? 1.0 : 1.1);
        const rate = 0.55 * HUG_SCALE * s.interest * moodFactor * fallFactor * (sumW / AVAIL_NORM);
        if (!s.punchPending && s.t - s.punchAt > 3 && s.rand() < PUNCH_SHARE * rate * dt) {
          s.punchAt = s.t;
          s.punchPending = true;
          emit(s, 'punch', { tensionFall: s.tensionFall });
        } else if (cands.length && s.rand() < rate * dt) {
          const sp = pickWeighted(cands, s.rand);
          // 重さは範囲の軽い方に寄せる。まれに大型（春の親アオリの3kg級など）
          const [g0, g1] = sp.big && s.rand() < 0.06 ? sp.big : sp.g;
          const weight = Math.round(g0 + (g1 - g0) * s.rand() ** 1.6);
          s.hooking = { id: sp.id, weight, mantle: Math.round(sp.k * Math.cbrt(weight)), power: sp.power };
          const kind = pickWeighted(BITE_MIX[s.tensionFall ? 'tension' : 'free'], s.rand).kind;
          const light = s.rand() < (s.mood === 'calm' ? 0.3 : 0.2); // 軽い抱き（猶予が短い）
          s.bite = { kind, light };
          s.windows = signalWindows(s.cond, kind, light);
          s.phase = 'signal';
          s.signalAt = s.t;
          emit(s, 'signal', { kind, light, tensionFall: s.tensionFall });
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
        s.hooking = null;
        s.bite = null;
        s.squid = Math.max(0, s.squid - 1);
        s.interest = 0.1;
        s.phase = 'action';
        s.lastJerk = s.t - 1; // 見送った直後は少し待つ
        emit(s, 'let-go', { squidLeft: s.squid });
      }
      break;
    }
    case 'fight': {
      const p = s.hooking.power;
      if (s.pressing) {
        s.dist = Math.max(0, s.dist - 2.2 * dt);
        s.tension += (22 + p * 22) * dt;
      } else {
        s.tension -= 45 * dt;
        s.dist += 0.6 * p * dt;
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
      if (canJet && s.rand() < 0.7 * p * hk.stamina * (1 + 0.3 * Math.min(3, s.cond.wave)) * dt) {
        if (s.pressing) s.tension += 22;
        else s.dist += 1;
        hk.jets.push(s.t);
        hk.stamina = Math.max(0.25, hk.stamina - 0.15);
        emit(s, 'jet');
      }
      s.tension = Math.max(0, s.tension);
      s.slackFor = s.tension <= 0 ? s.slackFor + dt : 0;
      if (s.tension >= 100) {
        emit(s, 'break', { id: s.hooking.id });
        s.hooking = null;
        endCast(s, 'break');
      } else if (s.slackFor > SLACK_LIMIT) {
        emit(s, 'unhooked', { id: s.hooking.id });
        s.hooking = null;
        endCast(s, 'unhooked');
      } else if (s.dist <= 0) {
        const c = { id: s.hooking.id, weight: s.hooking.weight, mantle: s.hooking.mantle };
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

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
const TOD_FACTOR = { morning: 1.4, day: 0.8, evening: 1.4, night: 1.0 };

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
// w は出やすさ、g は重さの範囲（グラム）、k は胴長の係数（胴長cm ≈ k × 重さ^(1/3)）、ideal は合うエギの号数
const SQUID = {
  aoriBig: { id: 'aori', g: [800, 2500], k: 2.5, power: 1.0, ideal: 3.5 },
  aoriKid: { id: 'aori', g: [100, 500], k: 2.5, power: 0.55, ideal: 2.5 },
  aoriMid: { id: 'aori', g: [300, 900], k: 2.5, power: 0.7, ideal: 3 },
  kouika: { id: 'kouika', g: [300, 900], k: 1.9, power: 0.6, ideal: 3 },
  mongo: { id: 'mongo', g: [800, 2500], k: 2.4, power: 0.9, ideal: 3.5 },
  shiriyake: { id: 'shiriyake', g: [200, 600], k: 2.0, power: 0.5, ideal: 3 },
  kensaki: { id: 'kensaki', g: [150, 450], k: 3.7, power: 0.6, ideal: 2.5 },
  yari: { id: 'yari', g: [150, 350], k: 4.8, power: 0.55, ideal: 2.5 },
  hiika: { id: 'hiika', g: [20, 60], k: 2.9, power: 0.25, ideal: 2 },
};

export function seasonOf(month) {
  if (month >= 3 && month <= 6) return 'spring';
  if (month >= 7 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

// 季節・時間帯ごとの顔ぶれ（山口の堤防からのエギングの目安）
export function speciesPool(month, tod) {
  const night = tod === 'night';
  const pool = {
    spring: [[SQUID.aoriBig, 5], [SQUID.kouika, 4], [SQUID.mongo, 2], [SQUID.shiriyake, 2]],
    summer: night ? [[SQUID.kensaki, 4], [SQUID.aoriMid, 2]] : [[SQUID.aoriMid, 3], [SQUID.kouika, 1]],
    autumn: night ? [[SQUID.aoriKid, 5], [SQUID.kensaki, 2]] : [[SQUID.aoriKid, 8], [SQUID.aoriMid, 1]],
    winter: night ? [[SQUID.yari, 6], [SQUID.hiika, 6]] : [[SQUID.aoriBig, 1], [SQUID.kouika, 1]],
  }[seasonOf(month)];
  return pool.map(([s, w]) => ({ ...s, w }));
}

// エギの号数が、そのイカに合っているか（1＝ぴったり。0.5号ずれるごとに下がる）
export const sizeMatch = (egiSize, ideal) => Math.max(0.35, 1 - 0.5 * Math.abs(egiSize - ideal));

// 季節で抱きやすさが違う（冬の日中はとても渋い）
const seasonRate = (month, tod) => {
  const s = seasonOf(month);
  if (s === 'winter') return tod === 'night' ? 1.0 : 0.35;
  if (s === 'autumn') return 1.2;
  return 0.9;
};

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
  return seasonRate(month, tod) * TOD_FACTOR[tod] * (0.1 + 0.08 * cond.expectation);
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

// いまの投げで、エギの号数がこの季節・時間帯のイカにどれくらい合っているか（出やすさで重みづけした平均）
function poolMatch(s) {
  const pool = speciesPool(s.month, s.tod);
  const total = pool.reduce((a, p) => a + p.w, 0);
  return pool.reduce((a, p) => a + p.w * sizeMatch(s.spec.size, p.ideal), 0) / total;
}

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
      // パンチの後、しゃくらずに待てた（抱かせる間を作れた）
      if (s.punchPending && s.t - s.punchAt >= PUNCH_WAIT) {
        s.punchPending = false;
        s.interest = Math.min(1, s.interest + PUNCH_GAIN);
        emit(s, 'punch-wait', { interest: s.interest });
      }
      // フォール中（しゃくって1秒後から）にだけ抱く。近くにイカがいて、底に近いほど、気になっているほど抱きやすい
      if (since >= 1 && s.depth < s.bottom && s.squid > 0) {
        const depthFactor = 0.4 + 0.6 * (s.depth / s.bottom);
        const moodFactor = 0.6 + 0.08 * s.cond.expectation; // 期待値0で0.6倍、10で1.4倍
        // 渋い日は長いテンションフォールが効き、やる気のある日は速いフリーフォールでも抱く
        const fallFactor = s.mood === 'calm' ? (s.tensionFall ? 1.25 : 0.85) : (s.tensionFall ? 1.0 : 1.1);
        const rate = 0.55 * s.interest * depthFactor * moodFactor * fallFactor * poolMatch(s)
          * TOD_FACTOR[s.tod] * seasonRate(s.month, s.tod);
        if (!s.punchPending && s.t - s.punchAt > 3 && s.rand() < PUNCH_SHARE * rate * dt) {
          s.punchAt = s.t;
          s.punchPending = true;
          emit(s, 'punch', { tensionFall: s.tensionFall });
        } else if (s.rand() < rate * dt) {
          const pool = speciesPool(s.month, s.tod).map((p) => ({ ...p, w: p.w * sizeMatch(s.spec.size, p.ideal) }));
          const sp = pickWeighted(pool, s.rand);
          const weight = Math.round(sp.g[0] + (sp.g[1] - sp.g[0]) * s.rand() ** 1.6);
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
      // ジェット噴射：大きいイカほどよく走る。波が高いとやり取りが荒れる
      if (s.rand() < 0.7 * p * (1 + 0.3 * Math.min(3, s.cond.wave)) * dt) {
        if (s.pressing) s.tension += 22;
        else s.dist += 1;
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

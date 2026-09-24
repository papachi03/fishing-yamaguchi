// しゃくって抱かせろ！：エギングのゲーム。画面を持たない純粋なロジック（node --test で試せる）。
// 操作はボタン1つ（press / release）。状況によって意味が変わる：
//   構え中 … 押している間に力をため、離すと投げる
//   沈下・アクション中 … 押すと「しゃくり」。フォール中にラインが走ったら、押すと「アワセ」
//   やり取り中 … 押している間だけ巻く（張りすぎると身切れ、ゆるめすぎるとバレ）
// 画面側は tick(dt) を毎フレーム呼び、state と state.events（起きたこと）を見て描く。
import { seeded, pickWeighted } from './rng.js';

export const CASTS = 5; // 1回の釣行で投げられる回数
export const EGI_STOCK = 3; // 根掛かりで失うと減る
export const SINK = 0.9; // 沈む速さ（m/秒）。本物より速め
export const FALL = 0.7; // しゃくった後のフォールの速さ
export const SIGNAL_GOOD = 0.7; // ラインが走ってから、ちゃんと掛かるまでの猶予（秒）
export const SIGNAL_LATE = 1.2; // これを過ぎたらイカが離す
export const SLACK_LIMIT = 1.5; // ラインがゆるみっぱなしでバレるまで（秒）

export const TIMES = ['morning', 'day', 'evening', 'night'];
const TOD_FACTOR = { morning: 1.4, day: 0.8, evening: 1.4, night: 1.0 };

// 季節と時間帯で出てくるイカ。w は出やすさ、g は重さの範囲（グラム）、k は胴長の係数（胴長cm ≈ k × 重さ^(1/3)）
const SQUID = {
  aoriBig: { id: 'aori', g: [800, 2500], k: 2.5, power: 1.0 },
  aoriKid: { id: 'aori', g: [100, 500], k: 2.5, power: 0.55 },
  aoriMid: { id: 'aori', g: [300, 900], k: 2.5, power: 0.7 },
  kouika: { id: 'kouika', g: [300, 900], k: 1.9, power: 0.6 },
  mongo: { id: 'mongo', g: [800, 2500], k: 2.4, power: 0.9 },
  shiriyake: { id: 'shiriyake', g: [200, 600], k: 2.0, power: 0.5 },
  kensaki: { id: 'kensaki', g: [150, 450], k: 3.7, power: 0.6 },
  yari: { id: 'yari', g: [150, 350], k: 4.8, power: 0.55 },
  hiika: { id: 'hiika', g: [20, 60], k: 2.9, power: 0.25 },
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

// 季節で抱きやすさが違う（冬の日中はとても渋い）
const seasonRate = (month, tod) => {
  const s = seasonOf(month);
  if (s === 'winter') return tod === 'night' ? 1.0 : 0.35;
  if (s === 'autumn') return 1.2;
  return 0.9;
};

// 海の状況。「今日の萩の海」の実データ（YFJ の海況：期待値・風・突風・波・安全判定）をそのまま渡す。
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

// 風が強いと糸がふくらんでアタリが取りにくい：アワセの猶予が短くなる（7m/s を超えるとじわじわ、最大 45% 短く）
export function signalWindows(cond) {
  const k = 1 - Math.min(0.45, Math.max(0, (cond.gust - 6) * 0.06));
  return { good: SIGNAL_GOOD * k, late: SIGNAL_LATE * k };
}

export function createEgi({ seed = String(Date.now()), month = 9, tod = 'evening', rand, conditions } = {}) {
  const cond = normalizeConditions(conditions);
  return {
    rand: rand ?? seeded(seed),
    month,
    tod,
    cond,
    windows: signalWindows(cond),
    squid: 0,
    phase: 'ready',
    t: 0,
    casts: CASTS,
    egi: EGI_STOCK,
    pressing: false,
    power: 0,
    castDist: 0,
    dist: 0,
    depth: 0,
    bottom: 0,
    bottomFor: 0,
    jerks: [],
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

const emit = (s, type, data = {}) => s.events.push({ type, t: s.t, ...data });

// その回の投げを終えて、次の構えへ（もう投げられなければ終了）
function endCast(s, why) {
  s.last = why;
  s.phase = s.casts > 0 && s.egi > 0 ? 'result' : 'over';
  if (s.phase === 'over') emit(s, 'over', { total: totalWeight(s) });
}

export const totalWeight = (s) => s.catches.reduce((sum, c) => sum + c.weight, 0);

function jerk(s) {
  // 続けてしゃくった回数を数える（間があいたら数え直し）
  if (s.t - s.lastJerk > 0.9) s.jerks = [];
  s.jerks.push(s.t);
  s.lastJerk = s.t;
  s.judged = false;
  s.depth = Math.max(0.5, s.depth - 1.2);
  s.dist = Math.max(0, s.dist - 1.5);
  s.bottomFor = 0;
  s.phase = 'action';
  emit(s, 'jerk', { streak: s.jerks.length });
}

export function press(s) {
  if (s.pressing) return;
  s.pressing = true;
  if (s.phase === 'ready') {
    s.phase = 'aiming';
    s.power = 0;
    s.aimFrom = s.t;
  } else if (s.phase === 'sinking' || s.phase === 'action') {
    jerk(s);
  } else if (s.phase === 'signal') {
    const late = s.t - s.signalAt;
    const chance = late <= s.windows.good ? 0.92 : late <= s.windows.late ? 0.35 : 0;
    if (s.rand() < chance) {
      s.phase = 'fight';
      s.squid = Math.max(0, s.squid - 1);
      s.tension = 30;
      s.slackFor = 0;
      s.dist = Math.max(s.dist, 3);
      emit(s, 'hook', { id: s.hooking.id, late });
    } else {
      s.hooking = null;
      s.squid = Math.max(0, s.squid - 1);
      s.interest = 0.1;
      s.phase = 'action';
      emit(s, 'miss', { late, squidLeft: s.squid });
    }
  } else if (s.phase === 'result') {
    s.phase = 'ready';
    s.last = null;
    emit(s, 'ready');
  }
}

export function release(s) {
  if (!s.pressing) return;
  s.pressing = false;
  if (s.phase === 'aiming') {
    s.casts -= 1;
    s.castDist = Math.round(10 + s.power * 30);
    s.dist = s.castDist;
    s.depth = 0;
    s.bottom = 5 + Math.round(s.rand() * 5);
    s.bottomFor = 0;
    s.interest = 0.15;
    s.jerks = [];
    s.lastJerk = s.t;
    s.judged = true;
    s.hooking = null;
    s.squid = sampleSquid(s);
    s.phase = 'sinking';
    emit(s, 'cast', { dist: s.castDist, bottom: s.bottom });
  }
}

// しゃくりのリズムを評価する（フォールに入って2秒たったところで1回だけ）
function judgeRhythm(s) {
  const n = s.jerks.length;
  const gain = n >= 2 && n <= 3 ? 0.35 : n === 1 ? 0.15 : n >= 5 ? -0.2 : 0.05;
  s.interest = Math.min(1, Math.max(0, s.interest + gain));
  s.judged = true;
  emit(s, 'rhythm', { streak: n, interest: s.interest });
}

// 底にいると根掛かりすることがある
function onBottom(s, dt) {
  s.bottomFor += dt;
  if (s.bottomFor > 1.5 && s.rand() < 0.12 * dt) {
    s.egi -= 1;
    emit(s, 'snag', { egiLeft: s.egi });
    endCast(s, 'snag');
    return true;
  }
  return false;
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
      s.depth = Math.min(s.bottom, s.depth + SINK * dt);
      if (s.depth >= s.bottom) onBottom(s, dt);
      break;
    }
    case 'action': {
      const since = s.t - s.lastJerk;
      if (s.depth < s.bottom) s.depth = Math.min(s.bottom, s.depth + FALL * dt);
      else if (onBottom(s, dt)) break;
      if (!s.judged && since >= 2) judgeRhythm(s);
      if (since > 9) s.interest = Math.max(0, s.interest - 0.1 * dt);
      // フォール中（しゃくって1秒後から）にだけ抱く。底に近いほど、気になっているほど抱きやすい
      if (since >= 1 && s.depth < s.bottom && s.squid > 0) {
        const depthFactor = 0.4 + 0.6 * (s.depth / s.bottom);
        const moodFactor = 0.6 + 0.08 * s.cond.expectation; // 期待値0で0.6倍、10で1.4倍
        const rate = 0.55 * s.interest * depthFactor * moodFactor * TOD_FACTOR[s.tod] * seasonRate(s.month, s.tod);
        if (s.rand() < rate * dt) {
          const sp = pickWeighted(speciesPool(s.month, s.tod), s.rand);
          const weight = Math.round(sp.g[0] + (sp.g[1] - sp.g[0]) * s.rand() ** 1.6);
          s.hooking = { id: sp.id, weight, mantle: Math.round(sp.k * Math.cbrt(weight)), power: sp.power };
          s.phase = 'signal';
          s.signalAt = s.t;
          emit(s, 'signal');
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
      // ジェット噴射：大きいイカほどよく走る
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

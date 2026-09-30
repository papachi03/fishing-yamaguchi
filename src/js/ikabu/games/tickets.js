// チケット🎫（2026-09-30 カードバトル構想の②）。遊ぶか、配布コードで手に入れる。お金は使わない。
//   設計：ikabu-research\cardbattle\設計案_イカ部カードバトル.md の 2章・2-3
//   ・どのゲームでも1戦遊ぶ＝1枚（1日5枚まで）／その日の最初の1戦＝+1／墨つなぎで今日の目標＝+1／墨のがれで60秒＝+1（各1日1回）
//   ・認定証を取る＝+10（認定証ごとに1回）／配布コード＝コードごとの枚数（1日の上限には数えない・同じコードは二度と使えない）
//   ・持てる上限 300枚。日付は UTC の日（墨つなぎの「今日の盤面」と同じ時計）
// 画面を持たない純粋な関数（node --test で試せる）。読み書きは records.js の readJSON/writeJSON
import { readJSON, writeJSON } from './records.js';

export const KEY_TICKETS = 'ikabu.tickets.v1';
export const CAP = 300;
export const DAILY_PLAY_MAX = 5;
export const CERT_BONUS = 10;

export const emptyTickets = () => ({ n: 0, earned: 0, spent: 0, day: null, today: { play: 0, first: 0, sumiGoal: 0, rush60: 0 }, certs: {}, codes: {} });

const roll = (rec, day) => {
  const r = { ...emptyTickets(), ...(rec ?? {}) };
  if (r.day !== day) { r.day = day; r.today = { play: 0, first: 0, sumiGoal: 0, rush60: 0 }; }
  else r.today = { play: 0, first: 0, sumiGoal: 0, rush60: 0, ...(r.today ?? {}) };
  return r;
};
const add = (r, n) => {
  const got = Math.max(0, Math.min(n, CAP - r.n));
  r.n += got; r.earned += got;
  return got;
};

// 1戦遊んだ。{ rec, got, why }：why は画面の「🎫+1」の内訳（play / first）
export function earnPlay(rec, { day }) {
  const r = roll(rec, day);
  const why = [];
  if (r.today.play < DAILY_PLAY_MAX) { r.today.play += 1; if (add(r, 1)) why.push('play'); }
  if (!r.today.first) { r.today.first = 1; if (add(r, 1)) why.push('first'); }
  return { rec: r, got: why.length, why };
}
// 墨つなぎで今日の目標に届いた（1日1回）
export function earnSumiGoal(rec, { day }) {
  const r = roll(rec, day);
  if (r.today.sumiGoal) return { rec: r, got: 0, why: [] };
  r.today.sumiGoal = 1;
  const got = add(r, 1);
  return { rec: r, got, why: got ? ['sumiGoal'] : [] };
}
// 墨のがれで60秒しのいだ（1日1回）
export function earnRush60(rec, { day, seconds }) {
  const r = roll(rec, day);
  if (seconds < 60 || r.today.rush60) return { rec: r, got: 0, why: [] };
  r.today.rush60 = 1;
  const got = add(r, 1);
  return { rec: r, got, why: got ? ['rush60'] : [] };
}
// 認定証を取った（認定証ごとに1回・10枚）
export function earnCert(rec, certId, { day }) {
  const r = roll(rec, day);
  if (r.certs[certId]) return { rec: r, got: 0, why: [] };
  r.certs[certId] = day;
  const got = add(r, CERT_BONUS);
  return { rec: r, got, why: got ? ['cert'] : [] };
}
// 配布コード（照合は codes.js。ここは「使った印」と枚数だけ）
export function earnCode(rec, codeId, amount, { day }) {
  const r = roll(rec, day);
  if (r.codes[codeId]) return { rec: r, got: 0, why: [] };
  r.codes[codeId] = day;
  const got = add(r, amount);
  return { rec: r, got, why: got ? ['code'] : [] };
}
// ガチャなどで使う。足りなければ false
export function spend(rec, amount, { day }) {
  const r = roll(rec, day);
  if (amount <= 0 || r.n < amount) return { rec: r, ok: false };
  r.n -= amount; r.spent += amount;
  return { rec: r, ok: true };
}
// 今日あと何枚もらえるか（遊びの分だけ。コードと認定証は数えない）
export function todayLeft(rec, { day }) {
  const r = roll(rec, day);
  return (DAILY_PLAY_MAX - r.today.play) + (r.today.first ? 0 : 1) + (r.today.sumiGoal ? 0 : 1) + (r.today.rush60 ? 0 : 1);
}

export const readTickets = () => ({ ...emptyTickets(), ...(readJSON(KEY_TICKETS) ?? {}) });
export const writeTickets = (r) => writeJSON(KEY_TICKETS, r);

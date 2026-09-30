// 配布コード（2026-09-30 打ち合わせで決定。設計案 2-3）。
//   ・コードは英数字・大文字・ハイフン区切り（例 IKABU-8K3T-P2WQ）。サイトの中には SHA-256 のハッシュだけを持つ（codes-table.json）
//   ・コードごとに枚数と有効期間。使ったコードはこのブラウザで二度と使えない（tickets.js の codes に印）
//   ・別の端末での使い回しは「リセマラと同じ」と割り切る（ぱっぱ）。厳密な1人1回が要る時は Worker＋KV に窓口を足す
//   ・作る道具：ikabu-research\cardbattle\tickets\make_codes.py（コード一覧は非公開・ハッシュ表だけをサイトに入れる）
import { earnCode } from './tickets.js';

export const SALT = 'ikabu-tickets-2026';

// 入力のゆらぎを吸収：全角→半角、小文字→大文字、空白除去、区切りはハイフンに
export function normalize(input) {
  return String(input ?? '')
    .replace(/[Ａ-Ｚａ-ｚ０-９－―‐]/g, (c) => (c === '－' || c === '―' || c === '‐' ? '-' : String.fromCharCode(c.charCodeAt(0) - 0xfee0)))
    .toUpperCase()
    .replace(/[\s_・.]/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function hashCode(code, salt = SALT) {
  const bytes = new TextEncoder().encode(`${salt}:${code}`);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// table: [{ id, h, n, from, until }]（from/until は 'YYYY-MM-DD'、無ければ無期限）
// 戻り：{ ok, reason, got, rec, entry }。reason は bad（合わない）/ notyet（まだ）/ expired（期限切れ）/ used（使用済み）
export async function redeem(input, { table, tickets, day }) {
  const code = normalize(input);
  if (code.length < 4) return { ok: false, reason: 'bad', got: 0, rec: tickets };
  const h = await hashCode(code);
  const entry = table.find((e) => e.h === h);
  if (!entry) return { ok: false, reason: 'bad', got: 0, rec: tickets };
  if (entry.from && day < entry.from) return { ok: false, reason: 'notyet', got: 0, rec: tickets, entry };
  if (entry.until && day > entry.until) return { ok: false, reason: 'expired', got: 0, rec: tickets, entry };
  if (tickets?.codes?.[entry.id]) return { ok: false, reason: 'used', got: 0, rec: tickets, entry };
  const r = earnCode(tickets, entry.id, entry.n, { day });
  return { ok: true, reason: 'ok', got: r.got, rec: r.rec, entry };
}

// 当て推量よけ：連続で外したら少し待たせる（3回外したら30秒）。状態は呼ぶ側が持つ
export const LOCK_AFTER = 3;
export const LOCK_MS = 30000;
export function lockState(fails, lastFailAt, now) {
  if (fails < LOCK_AFTER) return { locked: false, wait: 0 };
  const wait = Math.max(0, LOCK_MS - (now - lastFailAt));
  return { locked: wait > 0, wait };
}

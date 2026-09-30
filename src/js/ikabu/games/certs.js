// ゴールド認定証（2026-09-30 カードバトル構想の①）。3つのゲームの実績を全部そろえた人に「認定証」を出す。
//   墨つなぎ＝バッジ12個すべて／墨のがれ＝バッジ12個すべて／エギング＝図鑑コンプ か 部員レベル最大
//   3枚そろうと「山口イカ部 名誉部員証」。取った日は ikabu.certs.v1 に残す（記録の統合とは別。取り直しは起きない）
// このファイルは画面や文言（play-text.js）を読まない＝Node のテストからそのまま使える。図鑑の分母は引数で渡す
import { BADGES, RUSH_BADGES, readJSON, writeJSON } from './records.js';
import { levelOf, MAX_LEVEL } from './progress.js';

export const KEY_CERTS = 'ikabu.certs.v1';
export const CERT_IDS = ['sumi', 'rush', 'egi', 'honor'];

// 今の記録から、各認定証の「そろい具合」を出す。{ have, need, done }
export function certStatus({ sumi = null, egi = null, zukanIds = [] } = {}) {
  const sb = sumi?.badges ?? {};
  const rb = sumi?.rush?.badges ?? {};
  const sumiHave = BADGES.filter((b) => sb[b.id]).length;
  const rushHave = RUSH_BADGES.filter((b) => rb[b.id]).length;
  const zukanHave = zukanIds.filter((id) => egi?.species?.[id]).length;
  const level = levelOf(egi?.points ?? 0).level;
  const s = {
    sumi: { have: sumiHave, need: BADGES.length, done: sumiHave >= BADGES.length },
    rush: { have: rushHave, need: RUSH_BADGES.length, done: rushHave >= RUSH_BADGES.length },
    // エギングは2つの道のどちらか（図鑑をそろえる or レベル最大）。表示用に両方の進み具合を持つ
    egi: { have: zukanHave, need: zukanIds.length, level, maxLevel: MAX_LEVEL, done: (zukanIds.length > 0 && zukanHave >= zukanIds.length) || level >= MAX_LEVEL },
  };
  s.honor = { have: ['sumi', 'rush', 'egi'].filter((k) => s[k].done).length, need: 3, done: s.sumi.done && s.rush.done && s.egi.done };
  return s;
}

// そろった認定証に日付を付ける。新しく取れた id を fresh で返す（既に日付がある物は変えない）
export function awardCerts(certs, status, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const c = { ...(certs ?? {}) };
  const fresh = [];
  for (const id of CERT_IDS) {
    if (status[id]?.done && !c[id]) { c[id] = today; fresh.push(id); }
  }
  return { certs: c, fresh };
}

export const readCerts = () => readJSON(KEY_CERTS) ?? {};
export const writeCerts = (c) => writeJSON(KEY_CERTS, c);

// 釣り人キャラ（2026-10-02 ぱっぱ：舞台の釣り人をタップ→キャラ一覧→🎫で入手。見た目だけで、釣果には効かない）
// 画面を持たない純粋な関数（node --test で試せる）。読み書きは records.js の readJSON/writeJSON
import { readJSON, writeJSON } from './records.js';
import { spend } from './tickets.js';

export const KEY_ANGLERS = 'ikabu.anglers.v1';
// src は public からの住所。白いイカ（部長）は最初から使える
// jet：ジェットの瞬間だけ差し替える「驚いた顔」の絵（10/2 ぱっぱ：表情差分が欲しい）。src と同じ台紙・同じ位置
// padTop：絵の上に足した余白（立ち絵の高さ 991 に対して）。ヤリ・ケンサキは胴の先が長く、元の枠だと上が切れた（10/2 ぱっぱ指摘）
export const ANGLER_BASE_H = 991;
export const ANGLERS = [
  { id: 'shiro', cost: 0, src: '/assets/ikabu/hero-layers/squid.png', jet: '/assets/ikabu/anglers/shiro_jet.webp' },
  { id: 'aori', cost: 10, src: '/assets/ikabu/anglers/aori.webp', jet: '/assets/ikabu/anglers/aori_jet.webp', padTop: 110 },
  { id: 'kouika', cost: 10, src: '/assets/ikabu/anglers/kouika.webp', jet: '/assets/ikabu/anglers/kouika_jet.webp', padTop: 110 },
  { id: 'mongo', cost: 10, src: '/assets/ikabu/anglers/mongo.webp', jet: '/assets/ikabu/anglers/mongo_jet.webp', padTop: 110 },
  { id: 'yari', cost: 10, src: '/assets/ikabu/anglers/yari.webp', jet: '/assets/ikabu/anglers/yari_jet.webp', padTop: 110 },
  { id: 'kensaki', cost: 10, src: '/assets/ikabu/anglers/kensaki.webp', jet: '/assets/ikabu/anglers/kensaki_jet.webp', padTop: 110 },
  // かわいい系4体（2026-10-13 ぱっぱ：カードで人気のミミイカの仲間。ChatGPT で描いたスライム風。リールの位置は白イカに合わせて置いた）
  { id: 'mimi', cost: 10, src: '/assets/ikabu/anglers/mimi.webp', jet: '/assets/ikabu/anglers/mimi_jet.webp' },
  { id: 'dango', cost: 10, src: '/assets/ikabu/anglers/dango.webp', jet: '/assets/ikabu/anglers/dango_jet.webp' },
  { id: 'hawaii', cost: 10, src: '/assets/ikabu/anglers/hawaii.webp', jet: '/assets/ikabu/anglers/hawaii_jet.webp' },
  { id: 'hime', cost: 10, src: '/assets/ikabu/anglers/hime.webp', jet: '/assets/ikabu/anglers/hime_jet.webp' },
];
export const DEFAULT_ANGLER = 'shiro';
export const anglerOf = (id) => ANGLERS.find((a) => a.id === id) ?? ANGLERS[0];

// 墨のがれの舞台のイカ（2026-10-13 ぱっぱ：キャラはエギングと共通。一度入手すれば両方で使える）
// 表情は5つ（calm ふつう／worry 心配／panic 焦り／doom ピンチ／relief ほっと）。部長は前からの mascot の絵
export const RUSH_MOODS = ['calm', 'worry', 'panic', 'doom', 'relief'];
const SHIRO_RUSH = { calm: 'mascot/wink', worry: 'mascot/rush-worry', panic: 'mascot/rush-panic', doom: 'mascot/rush-doom', relief: 'mascot/rush-relief' };
export function rushFaceSrc(id, mood) {
  const m = RUSH_MOODS.includes(mood) ? mood : mood === 'drown' ? 'doom' : 'calm';
  const a = anglerOf(id);
  return a.id === DEFAULT_ANGLER ? `/assets/ikabu/${SHIRO_RUSH[m]}.webp` : `/assets/ikabu/rush-chars/${a.id}_${m}.webp`;
}
// キャラを替えた・入手した時に、同じページのもう一方のゲーム（エギング⇔墨のがれ）へ知らせる
export const ANGLERS_EVENT = 'ikabu:anglers';

export const emptyAnglers = () => ({ owned: [DEFAULT_ANGLER], current: DEFAULT_ANGLER });
export function normalizeAnglers(rec) {
  const r = { ...emptyAnglers(), ...(rec ?? {}) };
  const ids = ANGLERS.map((a) => a.id);
  r.owned = [...new Set([DEFAULT_ANGLER, ...(Array.isArray(r.owned) ? r.owned : [])].filter((x) => ids.includes(x)))];
  if (!r.owned.includes(r.current)) r.current = DEFAULT_ANGLER;
  return r;
}
export const readAnglers = () => normalizeAnglers(readJSON(KEY_ANGLERS));
export const writeAnglers = (r) => writeJSON(KEY_ANGLERS, r);

// 入手する：🎫が足りれば引いて、持ち物に足し、そのまま使う。{ rec, tickets, ok, why }
//   why: 'owned'（もう持っている）／'tickets'（足りない）／'unknown'
export function buyAngler(rec, tickets, id, { day }) {
  const r = normalizeAnglers(rec);
  const a = ANGLERS.find((x) => x.id === id);
  if (!a) return { rec: r, tickets, ok: false, why: 'unknown' };
  if (r.owned.includes(id)) return { rec: r, tickets, ok: false, why: 'owned' };
  const sp = spend(tickets, a.cost, { day });
  if (a.cost > 0 && !sp.ok) return { rec: r, tickets, ok: false, why: 'tickets' };
  return { rec: { ...r, owned: [...r.owned, id], current: id }, tickets: a.cost > 0 ? sp.rec : tickets, ok: true };
}
// 持っているキャラに替える
export function useAngler(rec, id) {
  const r = normalizeAnglers(rec);
  if (!r.owned.includes(id)) return { rec: r, ok: false };
  return { rec: { ...r, current: id }, ok: true };
}

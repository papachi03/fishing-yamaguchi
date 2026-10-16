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

// 色違い（2026-10-13 ぱっぱ：キャラの中で色を選ぶ。全10体×ピンク・ミント・むらさき、各🎫5。持っているキャラだけ）
// color '' は元の色。絵は anglers/{id}_{色}.webp・{id}_{色}_jet.webp・rush-chars/{id}_{色}_{表情}.webp
export const COLORS = ['pink', 'mint', 'purple'];
export const COLOR_COST = 5;
const okColor = (c) => COLORS.includes(c);
// 部長のメス（2026-10-16 ぱっぱ：女性アングラー版。オス／メスは最初から無料で切り替え。色違いはオスだけ）
//   絵の選び方では、色の代わりに FEMALE（'f'）を渡す＝ lookOf が返す。絵は anglers/shiro_f.webp・shiro_f_jet.webp・rush-chars/shiro_f_{表情}.webp
export const SEX_ANGLER = DEFAULT_ANGLER;
export const FEMALE = 'f';
const isFemale = (id, look) => look === FEMALE && anglerOf(id).id === SEX_ANGLER;
export function rushFaceSrc(id, mood, color = '') {
  const m = RUSH_MOODS.includes(mood) ? mood : mood === 'drown' ? 'doom' : 'calm';
  const a = anglerOf(id);
  if (isFemale(id, color)) return `/assets/ikabu/rush-chars/${a.id}_f_${m}.webp`;
  if (okColor(color)) return `/assets/ikabu/rush-chars/${a.id}_${color}_${m}.webp`;
  return a.id === DEFAULT_ANGLER ? `/assets/ikabu/${SHIRO_RUSH[m]}.webp` : `/assets/ikabu/rush-chars/${a.id}_${m}.webp`;
}
// エギングの立ち絵（ふつう・ジェット）。色違いは元の絵と同じ台紙（padTop も同じ）に置いてある
export const anglerSrc = (id, color = '') => (isFemale(id, color) ? `/assets/ikabu/anglers/${anglerOf(id).id}_f.webp` : okColor(color) ? `/assets/ikabu/anglers/${anglerOf(id).id}_${color}.webp` : anglerOf(id).src);
export const anglerJet = (id, color = '') => (isFemale(id, color) ? `/assets/ikabu/anglers/${anglerOf(id).id}_f_jet.webp` : okColor(color) ? `/assets/ikabu/anglers/${anglerOf(id).id}_${color}_jet.webp` : anglerOf(id).jet);
// いま使っているキャラの色（持っていない色・知らない色は元の色）
export const colorOf = (rec, id) => { const c = rec?.color?.[id] ?? ''; return okColor(c) && rec?.colors?.[id]?.includes(c) ? c : ''; };
// 絵を選ぶ時の見た目：部長がメスなら FEMALE（色違いより優先）、それ以外は色
export const sexOf = (rec) => (rec?.sex === FEMALE ? FEMALE : '');
export const lookOf = (rec, id) => (anglerOf(id).id === SEX_ANGLER && sexOf(rec) === FEMALE ? FEMALE : colorOf(rec, id));
// キャラを替えた・入手した時に、同じページのもう一方のゲーム（エギング⇔墨のがれ）へ知らせる
export const ANGLERS_EVENT = 'ikabu:anglers';

// colors：キャラごとに持っている色の一覧／color：キャラごとに今使っている色（'' は元の色）
export const emptyAnglers = () => ({ owned: [DEFAULT_ANGLER], current: DEFAULT_ANGLER, colors: {}, color: {} });
export function normalizeAnglers(rec) {
  const r = { ...emptyAnglers(), ...(rec ?? {}) };
  const ids = ANGLERS.map((a) => a.id);
  r.owned = [...new Set([DEFAULT_ANGLER, ...(Array.isArray(r.owned) ? r.owned : [])].filter((x) => ids.includes(x)))];
  if (!r.owned.includes(r.current)) r.current = DEFAULT_ANGLER;
  const colors = {}, color = {};
  for (const id of ids) {
    const have = Array.isArray(r.colors?.[id]) ? [...new Set(r.colors[id].filter(okColor))] : [];
    if (have.length) colors[id] = have;
    const c = r.color?.[id];
    if (okColor(c) && have.includes(c)) color[id] = c;
  }
  r.colors = colors; r.color = color;
  if (r.sex !== FEMALE) delete r.sex;   // sex：部長の見た目（'f'＝メス。無ければオス）
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
// 色違いを入手する：そのキャラを持っていて、🎫が足りれば引いて、その色にしてそのキャラを使う。{ rec, tickets, ok, why }
//   why: 'nochar'（キャラを持っていない）／'owned'（その色はもう持っている）／'tickets'（足りない）／'unknown'
export function buyColor(rec, tickets, id, color, { day }) {
  const r = normalizeAnglers(rec);
  if (!ANGLERS.some((a) => a.id === id) || !okColor(color)) return { rec: r, tickets, ok: false, why: 'unknown' };
  if (!r.owned.includes(id)) return { rec: r, tickets, ok: false, why: 'nochar' };
  if (r.colors[id]?.includes(color)) return { rec: r, tickets, ok: false, why: 'owned' };
  const sp = spend(tickets, COLOR_COST, { day });
  if (!sp.ok) return { rec: r, tickets, ok: false, why: 'tickets' };
  const out = { ...r, current: id, colors: { ...r.colors, [id]: [...(r.colors[id] ?? []), color] }, color: { ...r.color, [id]: color } };
  if (id === SEX_ANGLER) delete out.sex;   // 色違いはオスだけ（部長の色を選んだらオスにする）
  return { rec: out, tickets: sp.rec, ok: true };
}
// 部長のオス／メスを替える（無料・いつでも）。部長を使う。sex：'' オス／'f' メス
export function useSex(rec, sex) {
  const r = normalizeAnglers(rec);
  const next = { ...r, current: SEX_ANGLER };
  if (sex === FEMALE) next.sex = FEMALE; else delete next.sex;
  return { rec: next, ok: sex === '' || sex === FEMALE };
}
// 持っている色に替える（'' は元の色）。そのキャラを使う
export function useColor(rec, id, color) {
  const r = normalizeAnglers(rec);
  if (!r.owned.includes(id)) return { rec: r, ok: false };
  if (color !== '' && !r.colors[id]?.includes(color)) return { rec: r, ok: false };
  const next = { ...r.color }; if (color) next[id] = color; else delete next[id];
  const out = { ...r, current: id, color: next };
  if (id === SEX_ANGLER) delete out.sex;   // 色の丸はオスの部長に出す。押したらオス
  return { rec: out, ok: true };
}

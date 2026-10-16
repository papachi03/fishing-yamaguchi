// 磯場（2026-10-16 試遊版のテスト・ぱっぱ：ゴロタ・藻・サンゴが点在し高確率で根掛かる、カウントが命のフィールド）。
//   DOM に触らない（node --test で確かめる）。頭脳 egi.js と舞台 egi-ui.js の両方から使う。
//   ・地形は「その日の種」でくじ（今日の磯は全員同じ・翌日は別）。帯の並びは ゴロタ帯→溝→沖の根（1〜2回くり返す）→砂地
//   ・底の深さは投げた距離ではなく「エギが今いる距離」で決まる＝寄せてくるうちに溝で深く、根で浅くなる
//   ・部品（岩・サンゴ・藻）は高さ（m）を持ち、エギがその高さより下に入ると根掛かりの判定に入る
//   設計：ikabu-research\isoba\設計メモ.md／元の試作 field_random.py
import { seeded } from './rng.js';

export const ISO_RANGE = 44;   // 右端までの距離（m）。舞台の SCENE.rangeM と同じ
// 部品：h＝海底からの高さ(m)・w＝幅(m)・snag＝1秒あたりの掛かりやすさ・free＝掛かっても外れることがある割合・lose＝掛かったらエギを失うか
export const ISO_PARTS = {
  rock_l: { group: 'rock', h: 0.9, w: 2.6, snag: 0.7, free: 0.3, lose: true },
  rock_m: { group: 'rock', h: 0.7, w: 1.9, snag: 0.6, free: 0.3, lose: true },
  rock_s: { group: 'rock', h: 0.5, w: 1.5, snag: 0.5, free: 0.35, lose: true },
  rock_s2: { group: 'rock', h: 0.7, w: 2.0, snag: 0.6, free: 0.3, lose: true },
  coral_table: { group: 'coral', h: 0.8, w: 2.8, snag: 0.9, free: 0.1, lose: true },
  coral_branch: { group: 'coral', h: 1.0, w: 2.2, snag: 1.0, free: 0.05, lose: true },
  hondawara: { group: 'weed', h: 1.3, w: 1.8, snag: 0.45, free: 0, lose: false },   // 藻：掛かってもエギは戻る（今の藻場と同じ）
  amamo: { group: 'weed', h: 0.8, w: 1.9, snag: 0.4, free: 0, lose: false },
};
// 部品の絵（public/assets/ikabu/isoba/*.webp）の縦横 px（舞台で縦横比を保って置くため）
export const ISO_ART = { rock_l: [240, 121], rock_m: [240, 105], rock_s: [240, 114], rock_s2: [240, 83], coral_table: [240, 89], coral_branch: [240, 119], hondawara: [240, 150], amamo: [240, 158] };
export const ISO_ZONES = {
  goro: { name: ['ゴロタ帯', 'Boulders'], parts: ['rock_l', 'rock_m', 'rock_s'], every: 2.6, bottomSnag: 2.2 },
  mizo: { name: ['溝', 'Channel'], parts: ['hondawara', 'amamo'], every: 2.8, bottomSnag: 1.0 },
  ne: { name: ['沖の根', 'Reef'], parts: ['coral_table', 'rock_s2', 'coral_branch'], every: 2.6, bottomSnag: 2.6 },
  suna: { name: ['砂地', 'Sand'], parts: [], every: 0, bottomSnag: 0 },
};
// 磯はイカが岩や藻に付いている：投げるたびの寄りを多くする（egi.js の release）
export const ISO_SQUID = { more: 0.5, fresh: 0.35 };
// 磯場で得る経験値の倍率（今日の萩の海のハード 1.5 より上・仮置き。ハード＝海が見えない時はさらに上）
export const ISO_POINT = { normal: 1.8, hard: 2.4 };

export function makeIsoField(seed) {
  const r = seeded(`isoba:${seed}`);
  const u = (a, b) => a + (b - a) * r();
  const zones = [];
  let m = 0, d = u(1.5, 3);
  const push = (w, d1, kind) => { const to = Math.min(ISO_RANGE, m + w); zones.push({ from: m, to, d0: d, d1, kind }); m = to; d = d1; };
  push(u(5, 11), u(2, 3.5), 'goro');
  const reps = r() < 0.67 ? 1 : 2;
  for (let i = 0; i < reps && m < 34; i++) { push(u(4, 8), u(6, 9.5), 'mizo'); push(u(5, 10), u(3, 5), 'ne'); }
  zones.push({ from: m, to: ISO_RANGE, d0: d, d1: u(7.5, 10), kind: 'suna' });
  // 部品：帯の長さに応じた数を、帯の中にくじで置く（重ならないよう間を空ける）
  const parts = [];
  for (const z of zones) {
    const list = ISO_ZONES[z.kind].parts;
    if (!list.length) continue;
    const n = Math.max(1, Math.floor((z.to - z.from) / ISO_ZONES[z.kind].every));
    for (let i = 0; i < n; i++) {
      const kind = list[Math.floor(r() * list.length)];
      const slot = (z.to - z.from) / n;
      const at = z.from + slot * (i + 0.25 + r() * 0.5);
      parts.push({ kind, at: Math.round(at * 10) / 10, ...pick(ISO_PARTS[kind]) });
    }
  }
  return { seed: String(seed), zones, parts };
}
const pick = (p) => ({ h: p.h, w: p.w });

// 距離 m での底の深さ（m）
export function isoBottomAt(field, m) {
  const zs = field.zones;
  if (m <= zs[0].from) return zs[0].d0;
  for (const z of zs) if (m >= z.from && m <= z.to) return z.d0 + (z.d1 - z.d0) * ((m - z.from) / Math.max(0.01, z.to - z.from));
  return zs[zs.length - 1].d1;
}
export const isoZoneAt = (field, m) => field.zones.find((z) => m >= z.from && m <= z.to) ?? field.zones[field.zones.length - 1];
// 距離 m・深さ depth のエギが触れている部品（無ければ null）
export function isoPartAt(field, m, depth) {
  const bottom = isoBottomAt(field, m);
  for (const p of field.parts) if (Math.abs(m - p.at) <= p.w / 2 && depth >= bottom - p.h) return p;
  return null;
}
// 距離 m の真上にある部品（エギの深さに関係なく）。「岩の上に来た」の合図用
export const isoPartOver = (field, m) => field.parts.find((p) => Math.abs(m - p.at) <= p.w / 2) ?? null;
// その距離で底に着くまでのカウント（沈む速さ m/秒）
export const isoCount = (field, m, sink) => Math.round(isoBottomAt(field, m) / sink);

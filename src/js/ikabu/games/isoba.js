// 磯場（2026-10-16 試遊版のテスト・ぱっぱ：ゴロタ・藻・サンゴが点在し高確率で根掛かる、カウントが命のフィールド）。
//   DOM に触らない（node --test で確かめる）。頭脳 egi.js と舞台 egi-scene.js の両方から使う。
//   ・地形は「その日の種」でくじ（今日の磯は全員同じ・翌日は別）。帯の並びは ゴロタ帯→溝→沖の根（1〜2回くり返す）→砂地
//   ・底の深さは投げた距離ではなく「エギが今いる距離」で決まる＝寄せてくるうちに溝で深く、根で浅くなる
//   ・部品（岩・サンゴ・藻場）は高さ（m）と幅（m）を持ち、エギがその高さより下に入ると根掛かりの判定に入る
//   2026-10-16 ぱっぱ「同じ比率の大きさ・藻場の海藻が無い・斜面を無視して水平・足場の切れ込みが雑」→
//     部品ごとの大きさ＋1つずつくじで散らす／藻場は今の海と同じ揺れる海藻（weedSVG の描き方）を斜面に沿って並べる／
//     岩・サンゴは置く位置の斜面に合わせて回す（舞台側）／底の線はなだらかに／足場は絵の輪郭（ISO_ASHIBA.edge）から水中の岩を続ける
//   設計：ikabu-research\isoba\設計メモ.md／元の試作 field_random.py
import { seeded } from './rng.js';

export const ISO_RANGE = 44;   // 右端までの距離（m）。舞台の SCENE.rangeM と同じ
// 部品：vh＝絵の高さ(m・大きさ1のとき)・vw＝絵の幅(m)・snagH＝根掛かりの判定に使う高さの割合（絵の先のとがりは当たらない）
//   snag＝1秒あたりの掛かりやすさ・free＝掛かっても外れることがある割合・lose＝掛かったらエギを失うか・scale＝大きさのくじの範囲
export const ISO_PARTS = {
  rock_l: { group: 'rock', vh: 1.6, vw: 3.2, snagH: 0.75, snag: 0.7, free: 0.3, lose: true, scale: [0.9, 1.5] },
  rock_m: { group: 'rock', vh: 1.0, vw: 2.3, snagH: 0.75, snag: 0.6, free: 0.3, lose: true, scale: [0.8, 1.3] },
  rock_s: { group: 'rock', vh: 0.6, vw: 1.3, snagH: 0.8, snag: 0.5, free: 0.35, lose: true, scale: [0.7, 1.2] },
  rock_s2: { group: 'rock', vh: 0.8, vw: 2.3, snagH: 0.75, snag: 0.6, free: 0.3, lose: true, scale: [0.8, 1.3] },
  coral_table: { group: 'coral', vh: 1.0, vw: 2.7, snagH: 0.8, snag: 0.9, free: 0.1, lose: true, scale: [0.8, 1.4] },
  coral_branch: { group: 'coral', vh: 1.3, vw: 2.6, snagH: 0.8, snag: 1.0, free: 0.05, lose: true, scale: [0.8, 1.3] },
  // 藻場：今の海の藻場（egi.js の WEEDS）と同じ高さの目安。掛かってもエギは戻る
  hondawara: { group: 'weed', vh: 2.0, vw: 4.5, snagH: 0.7, snag: 0.45, free: 0, lose: false, scale: [0.8, 1.2] },
  amamo: { group: 'weed', vh: 1.2, vw: 4.5, snagH: 0.75, snag: 0.4, free: 0, lose: false, scale: [0.8, 1.2] },
};
// 部品の絵（public/assets/ikabu/isoba/*.webp）の縦横 px（舞台で縦横比を保って置くため）。藻は絵でなく海藻の線で描く
export const ISO_ART = { rock_l: [240, 121], rock_m: [240, 105], rock_s: [240, 114], rock_s2: [240, 83], coral_table: [240, 89], coral_branch: [240, 119] };
// 足場の絵（ashiba.webp 900×312）の右端の輪郭：[上からの割合, 左からの割合]。水中の岩をこの輪郭から続けて描く
export const ISO_ASHIBA = { w: 900, h: 312, edge: [[0.017, 0.239], [0.052, 0.285], [0.105, 0.287], [0.175, 0.283], [0.192, 0.38], [0.227, 0.436], [0.245, 0.448], [0.262, 0.674], [0.28, 0.762], [0.35, 0.774], [0.367, 0.818], [0.385, 0.848], [0.507, 0.866], [0.525, 0.885], [0.56, 0.917], [0.63, 0.927], [0.717, 0.936], [0.752, 0.952], [0.805, 0.975], [0.875, 0.987], [0.945, 0.994], [0.98, 0.997]] };
export const ISO_ZONES = {
  goro: { name: ['ゴロタ帯', 'Boulders'], parts: ['rock_l', 'rock_m', 'rock_m', 'rock_s'], every: 2.2, bottomSnag: 2.2 },
  mizo: { name: ['溝', 'Channel'], parts: ['hondawara', 'amamo'], every: 4.5, bottomSnag: 1.0 },   // 溝の斜面には藻場
  ne: { name: ['沖の根', 'Reef'], parts: ['coral_table', 'rock_s2', 'coral_branch', 'rock_l'], every: 2.4, bottomSnag: 2.6 },
  suna: { name: ['砂地', 'Sand'], parts: [], every: 0, bottomSnag: 0 },
};
// 磯はイカが岩や藻に付いている：投げるたびの寄りを多くする（egi.js の release）
export const ISO_SQUID = { more: 0.5, fresh: 0.35 };
// 磯場で得る経験値の倍率（今日の萩の海のハード 1.5 より上・仮置き。ハード＝海が見えない時はさらに上）
export const ISO_POINT = { normal: 1.8, hard: 2.4 };

const rnd1 = (v) => Math.round(v * 10) / 10;
export function makeIsoField(seed) {
  const r = seeded(`isoba:${seed}`);
  const u = (a, b) => a + (b - a) * r();
  const zones = [];
  let m = 0, d = u(1.5, 3);
  const push = (w, d1, kind) => { const to = Math.min(ISO_RANGE, m + w); zones.push({ from: m, to, d0: d, d1, kind }); m = to; d = d1; };
  push(u(6, 11), Math.min(3.5, d + u(0.3, 1.2)), 'goro');
  const reps = r() < 0.67 ? 1 : 2;
  // 溝・根の幅は深さの差の2.2倍以上にして、斜面がなだらかに見えるように（2026-10-16 ぱっぱ：崖になっていた）
  for (let i = 0; i < reps && m < 32; i++) {
    const dm = Math.min(9.5, d + u(2.5, 4.5)); push(Math.max(6, (dm - d) * 2.2 + u(0, 2)), dm, 'mizo');
    const dn = Math.max(3, d - u(2, 3.5)); push(Math.max(6, (d - dn) * 2.2 + u(0, 3)), dn, 'ne');
  }
  zones.push({ from: m, to: ISO_RANGE, d0: d, d1: Math.min(10, d + Math.min(u(2, 4), (ISO_RANGE - m) * 0.4)), kind: 'suna' });   // 砂地の下りも幅に応じてゆるく
  // 底の小さな起伏（帯の中をなだらかに波打たせる。砂地は静か）
  const bumps = Array.from({ length: 4 }, (_, i) => ({ k: 0.25 + i * 0.2 + r() * 0.15, ph: r() * 6.28, a: 0.05 + r() * 0.07 }));   // ゆるい起伏（強いとギザギザの崖に見えた 2026-10-16）
  const field = { seed: String(seed), zones, bumps, parts: [], decor: [] };
  for (const z of zones) {
    const Z = ISO_ZONES[z.kind];
    if (!Z.parts.length) continue;
    const n = Math.max(1, Math.floor((z.to - z.from) / Z.every));
    for (let i = 0; i < n; i++) {
      const kind = Z.parts[Math.floor(r() * Z.parts.length)];
      const P = ISO_PARTS[kind];
      const slot = (z.to - z.from) / n;
      const at = z.from + slot * (i + 0.2 + r() * 0.6);
      const scale = u(P.scale[0], P.scale[1]);
      if (P.group === 'weed') {
        // 藻場：幅3〜6m。描き方は今の海の藻場と同じ（揺れる海藻）。判定の高さは藻の高さ × snagH
        const w = u(3, 6), height = rnd1(P.vh * scale);
        field.parts.push({ kind, group: 'weed', at: rnd1(at), w: rnd1(w), h: rnd1(height * P.snagH), scale, from: rnd1(at - w / 2), to: rnd1(at + w / 2), height });
      } else {
        field.parts.push({ kind, group: P.group, at: rnd1(at), w: rnd1(P.vw * scale), h: rnd1(P.vh * scale * P.snagH), scale });
      }
    }
    // 飾り（判定なし）：ゴロタ帯と根には小石を散らして密度を出す
    if (z.kind === 'goro' || z.kind === 'ne') {
      const dn = Math.floor((z.to - z.from) / 1.1);
      for (let i = 0; i < dn; i++) field.decor.push({ kind: r() < 0.6 ? 'rock_s' : 'rock_s2', at: rnd1(u(z.from, z.to)), scale: rnd1(u(0.25, 0.55)) });
    }
  }
  return field;
}

// 距離 m での底の深さ（m）。帯の中は直線で、小さな起伏を重ねる（砂地は静か）
export function isoBottomAt(field, m) {
  // 前後1.2mを平均して山と谷を丸める（折れ線のままだと「とがった山」に見えた 2026-10-16）
  let sum = 0;
  for (const o of [-1.2, -0.6, 0, 0.6, 1.2]) sum += rawBottomAt(field, Math.min(ISO_RANGE, Math.max(0, m + o)));
  return sum / 5;
}
function rawBottomAt(field, m) {
  const zs = field.zones;
  let base;
  if (m <= zs[0].from) base = zs[0].d0;
  else {
    const z = zs.find((z) => m >= z.from && m <= z.to) ?? zs[zs.length - 1];
    const k = Math.min(1, Math.max(0, (m - z.from) / Math.max(0.01, z.to - z.from)));
    base = z.d0 + (z.d1 - z.d0) * k;   // 帯の中は直線（cos にすると真ん中が1.57倍急になり崖に見えた）。境目の角は起伏がぼかす
    if (z.kind === 'suna') return base;
  }
  let bump = 0;
  for (const b of field.bumps ?? []) bump += Math.sin(m * b.k + b.ph) * b.a;
  return Math.max(1, base + bump);
}
// 距離 m での底の傾き（1m 進むと何 m 深くなるか。沖へ向かって深くなる時が正）
export const isoSlopeAt = (field, m) => (isoBottomAt(field, m + 0.4) - isoBottomAt(field, m - 0.4)) / 0.8;
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

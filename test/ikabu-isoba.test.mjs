// 磯場（2026-10-16 試遊版のテスト）：地形のくじ・距離で変わる底・部品ごとの根掛かり
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIsoField, isoBottomAt, isoPartAt, isoZoneAt, ISO_RANGE, ISO_PARTS } from '../src/js/ikabu/games/isoba.js';
import { createEgi, press, release, tick } from '../src/js/ikabu/games/egi.js';

const DAYS = ['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20', '2026-11-01', '2026-12-25'];

test('地形：同じ種は同じ地形、日がちがえば別の地形。帯の並びは ゴロタ→溝→根→（溝→根）→砂地', () => {
  assert.deepEqual(makeIsoField('2026-10-16'), makeIsoField('2026-10-16'));
  const shapes = new Set(DAYS.map((d) => JSON.stringify(makeIsoField(d).zones.map((z) => [z.kind, Math.round(z.to)]))));
  assert.ok(shapes.size >= 5, `日ごとに地形が変わる（${shapes.size}通り）`);
  for (const d of DAYS) {
    const f = makeIsoField(d), k = f.zones.map((z) => z.kind);
    assert.equal(k[0], 'goro'); assert.equal(k[k.length - 1], 'suna');
    assert.ok(k.slice(1, -1).join(',').match(/^(mizo,ne)(,mizo,ne)?$/), k.join(','));
    assert.equal(f.zones[0].from, 0); assert.equal(f.zones[f.zones.length - 1].to, ISO_RANGE);
    for (let i = 1; i < f.zones.length; i++) assert.equal(f.zones[i].from, f.zones[i - 1].to, '帯のすき間なし');
    // 溝は深く、根は浅い
    for (const z of f.zones) if (z.kind === 'mizo') assert.ok(z.d1 >= 6); else if (z.kind === 'ne') assert.ok(z.d1 <= 5);
    // 部品は帯の種類に合ったもの、砂地には無い
    for (const p of f.parts) { const z = isoZoneAt(f, p.at); assert.notEqual(z.kind, 'suna'); }
  }
});

test('底の深さは距離で変わる（溝で深く・根で浅く）。部品の高さより下に入ると触れる', () => {
  const f = makeIsoField('2026-10-16');
  const mizo = f.zones.find((z) => z.kind === 'mizo'), ne = f.zones.find((z) => z.kind === 'ne');
  assert.ok(isoBottomAt(f, mizo.to) > isoBottomAt(f, ne.to) + 1, '溝の底は根より深い');
  const p = f.parts[0], b = isoBottomAt(f, p.at);
  assert.equal(isoPartAt(f, p.at, b - p.h - 0.3), null, '部品より上なら触れない');
  assert.equal(isoPartAt(f, p.at, b - p.h + 0.2)?.kind, p.kind, '部品の高さより下で触れる');
});

// 1投を機械で遊ぶ：指定の距離に投げて、底まで沈めてそのまま置く。根掛かり・藻に掛かったかを返す
function castAt(seed, dist, holdSec = 8, day = '2026-10-16') {
  const s = createEgi({ seed, stage: 'isoba', fieldSeed: day, month: 10, tod: 'evening' });
  s.squid = 0;
  press(s); s.power = Math.max(0, Math.min(1, (dist - 10) / 30)); release(s);
  s.squid = 0;   // イカは寄せない（根掛かりだけ見る）
  const why = []; let snagEv = null;
  for (let t = 0; t < holdSec + 12; t += 0.05) {
    tick(s, 0.05);
    for (const e of s.events) { if (e.type === 'snag' || e.type === 'weed') snagEv = e; }
    if (s.phase === 'result' || s.phase === 'ready') break;
  }
  return { s, snag: snagEv?.type ?? null, ev: snagEv };
}

test('ゴロタ帯・根に沈めて置くと根掛かりが多く、砂地では起きない（同じ回数で比べる）', () => {
  const f = makeIsoField('2026-10-16');
  const goro = f.zones[0], suna = f.zones[f.zones.length - 1];
  const rockPart = f.parts.find((p) => ISO_PARTS[p.kind].group === 'rock');
  const N = 60;
  let rock = 0, sand = 0;
  for (let i = 0; i < N; i++) {
    if (castAt(`r${i}`, Math.max(10, rockPart.at)).snag) rock += 1;
    if (castAt(`s${i}`, Math.min(40, (suna.from + suna.to) / 2)).snag) sand += 1;
  }
  assert.ok(rock > N * 0.4, `岩の上は掛かりやすい（${rock}/${N}）`);
  assert.ok(sand < N * 0.1, `砂地はほぼ掛からない（${sand}/${N}）`);
  void goro;
});

test('岩・サンゴは掛かるとエギを失い、藻はエギが戻る', () => {
  let lost = 0, kept = 0;
  for (let i = 0; i < 120; i++) {
    const r = castAt(`m${i}`, 10 + (i % 30));
    if (r.snag === 'snag') { assert.ok([undefined, 'rock', 'coral'].includes(r.ev.iso), r.ev.iso); assert.equal(r.s.egi, 2); lost += 1; }   // undefined＝底に置いたままの根掛かり（帯の倍率）
    if (r.snag === 'weed') { assert.equal(r.s.egi, 3); kept += 1; }
  }
  assert.ok(lost > 0, `岩・サンゴで失う回がある（${lost}）`);
});

test('堤防（ふつうの舞台）は今までどおり：field なし', () => {
  const s = createEgi({ seed: 'x', month: 10 });
  assert.equal(s.stage, 'pier'); assert.equal(s.field, null);
  const iso = createEgi({ seed: 'x', stage: 'isoba', method: 'yaen', fieldSeed: 'd' });
  assert.equal(iso.method, 'egi', '磯場はエギングだけ');
});

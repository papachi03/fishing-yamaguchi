// エギングゲームの判定。乱数を差し替えて、起きることを決め打ちで試す
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEgi, press, release, tick, speciesPool, seasonOf, totalWeight, CASTS, EGI_STOCK, SIGNAL_GOOD, SIGNAL_LATE, SINK,
} from '../src/js/ikabu/games/egi.js';

// 何も起きない乱数（0.99 = 確率の判定にほぼ通らない）。必要なときだけ値を差し替える
const calm = () => 0.99;
const run = (s, seconds, step = 0.05) => {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += step) events.push(...tick(s, step));
  return events;
};
const cast = (s, holdSec = 0.8) => {
  press(s);
  run(s, holdSec);
  release(s);
};

test('季節と時間帯で顔ぶれが変わる', () => {
  assert.equal(seasonOf(4), 'spring');
  assert.equal(seasonOf(10), 'autumn');
  assert.equal(seasonOf(1), 'winter');
  assert.equal(seasonOf(6), 'earlySummer');
  assert.equal(seasonOf(7), 'summer');
  const ids = (m, tod) => new Set(speciesPool(m, tod).map((p) => p.id));
  const top = (m, tod) => [...speciesPool(m, tod)].sort((a, b) => b.w - a.w)[0].id;
  // 山口・日本海側の実データ（squid-seasons.md）＋ダディの実釣
  assert.ok(ids(2, 'night').has('yari') && !ids(2, 'night').has('hiika'), '冬の夜はヤリイカ（萩ではヒイカの記録なし）');
  assert.equal(top(2, 'night'), 'yari');
  assert.ok(ids(6, 'evening').has('mongo') && ids(6, 'evening').has('shiriyake'), '初夏はモンゴウ・シリヤケ（ダディの実釣）');
  assert.equal(top(6, 'evening'), 'mongo');
  assert.equal(top(7, 'night'), 'kensaki', '夏の夜はケンサキイカ');
  assert.ok(ids(5, 'evening').has('aori') && ids(5, 'evening').has('kouika'), '春は親アオリ・コウイカ');
  assert.equal(top(10, 'day'), 'aori', '秋は新子のアオリイカ');
  assert.ok(!ids(8, 'day').has('aori'), '8月の日中はアオリイカがいない');
});

test('押している間に力がたまり、離すと投げて沈み始める', () => {
  const s = createEgi({ rand: calm });
  cast(s, 0.8); // ちょうど力いっぱい
  assert.equal(s.phase, 'sinking');
  assert.equal(s.casts, CASTS - 1);
  assert.ok(s.castDist >= 36, `遠くへ飛ぶ（${s.castDist}m、既定の3号）`);
  const s2 = createEgi({ rand: calm });
  cast(s2, 0.1);
  assert.ok(s2.castDist < 16, '力が弱いと近くに落ちる');
});

test('沈めると底に着き、底で待ちすぎると根掛かりしてエギを失う', () => {
  const s = createEgi({ rand: calm });
  cast(s);
  run(s, s.bottom / SINK + 0.1);
  assert.equal(s.depth, s.bottom, '底に着いた');
  s.rand = () => 0; // 根掛かりが必ず起きる
  const ev = run(s, 2);
  assert.ok(ev.some((e) => e.type === 'snag'));
  assert.equal(s.egi, EGI_STOCK - 1);
  assert.equal(s.phase, 'result');
});

test('2〜3回続けてしゃくって、2秒フォールさせると、イカの気になる度が上がる', () => {
  const s = createEgi({ rand: calm });
  cast(s);
  run(s, 3);
  const before = s.interest;
  press(s); release(s); run(s, 0.4);
  press(s); release(s);
  const ev = run(s, 2.1);
  const r = ev.find((e) => e.type === 'rhythm');
  assert.ok(r);
  assert.equal(r.streak, 2);
  assert.ok(s.interest > before + 0.3);
});

test('しゃくりすぎ（5回以上）は、かえって警戒される', () => {
  const s = createEgi({ rand: calm });
  cast(s);
  run(s, 3);
  s.interest = 0.5;
  for (let i = 0; i < 6; i++) {
    press(s); release(s); run(s, 0.3);
  }
  run(s, 2);
  assert.ok(s.interest < 0.5);
});

test('ラインが走ってすぐアワセると掛かり、遅すぎると離される', () => {
  const s = createEgi({ rand: () => 0 });
  cast(s);
  s.phase = 'signal';
  s.signalAt = s.t;
  s.hooking = { id: 'aori', weight: 900, mantle: 24, power: 0.8 };
  run(s, SIGNAL_GOOD / 2);
  const ev = [];
  press(s);
  assert.equal(s.phase, 'fight');

  const s2 = createEgi({ rand: calm });
  cast(s2);
  s2.phase = 'signal';
  s2.signalAt = s2.t;
  s2.hooking = { id: 'aori', weight: 900, mantle: 24, power: 0.8 };
  const ev2 = run(s2, SIGNAL_LATE + 0.2);
  assert.ok(ev2.some((e) => e.type === 'let-go'));
  assert.equal(s2.phase, 'action');
  assert.equal(ev.length, 0);
});

const hooked = (power = 0.6) => {
  const s = createEgi({ rand: calm });
  cast(s);
  s.phase = 'fight';
  s.tension = 30;
  s.dist = 12;
  s.hooking = { id: 'kouika', weight: 500, mantle: 15, power };
  return s;
};

test('巻きっぱなしだとテンションが上がりすぎて身切れする', () => {
  const s = hooked();
  press(s);
  const ev = run(s, 5);
  assert.ok(ev.some((e) => e.type === 'break'));
  assert.equal(s.catches.length, 0);
});

test('ゆるめっぱなしだとバレる', () => {
  const s = hooked();
  const ev = run(s, 4);
  assert.ok(ev.some((e) => e.type === 'unhooked'));
});

test('巻いて・ゆるめてを繰り返すと、取り込める', () => {
  const s = hooked();
  let landed = null;
  for (let i = 0; i < 40 && !landed; i++) {
    press(s);
    landed = run(s, 0.8).find((e) => e.type === 'landed') ?? landed;
    release(s);
    landed = run(s, 0.6).find((e) => e.type === 'landed') ?? landed;
  }
  assert.ok(landed, '取り込めた');
  assert.equal(s.catches.length, 1);
  assert.equal(totalWeight(s), 500);
  assert.equal(s.phase, 'result');
});

test('しゃくって手前まで寄せ切ると回収になる', () => {
  const s = createEgi({ rand: calm });
  cast(s, 0.1);
  run(s, 1);
  let ev = [];
  for (let i = 0; i < 20 && !ev.some((e) => e.type === 'recover'); i++) {
    press(s); release(s);
    ev = run(s, 0.3);
  }
  assert.ok(ev.some((e) => e.type === 'recover'));
  assert.equal(s.phase, 'result');
});

test('投げ終わると釣行はおしまい', () => {
  const s = createEgi({ rand: calm });
  for (let i = 0; i < CASTS; i++) {
    if (s.phase === 'result') press(s), release(s);
    cast(s, 0.1);
    for (let k = 0; k < 20 && s.phase !== 'result' && s.phase !== 'over'; k++) {
      press(s); release(s); run(s, 0.3);
    }
  }
  assert.equal(s.phase, 'over');
  assert.equal(s.casts, 0);
});

test('フォール中は、気になる度が高いといずれ抱いてくる', () => {
  let signals = 0;
  for (let k = 0; k < 20; k++) {
    const s = createEgi({ seed: 'hug-' + k, month: 10, tod: 'evening' });
    cast(s);
    run(s, 4);
    s.interest = 1;
    press(s); release(s); run(s, 0.3);
    press(s); release(s);
    const ev = run(s, 3.5);
    if (ev.some((e) => e.type === 'signal')) signals++;
  }
  assert.ok(signals >= 5, `抱いた回数 ${signals}/20`);
});

// ---- 実際に近い難しさ（2026-09-24 ぱっぱ指示：萩の海の状況で釣れ具合を疑似体験） ----
import { meanSquid, signalWindows, normalizeConditions } from '../src/js/ikabu/games/egi.js';

test('近くにイカがいない投げでは、どれだけ上手にしゃくっても抱かない', () => {
  const s = createEgi({ seed: 'none', month: 10, tod: 'evening' });
  cast(s);
  s.squid = 0;
  run(s, 4);
  s.interest = 1;
  let signal = false;
  for (let i = 0; i < 12 && !signal; i++) {
    press(s); release(s); run(s, 0.3);
    press(s); release(s);
    signal = run(s, 3).some((e) => e.type === 'signal');
  }
  assert.equal(signal, false);
});

test('掛けそこねたイカは離れていき、残りのイカも警戒する', () => {
  const s = createEgi({ rand: () => 0.99 });
  cast(s);
  s.squid = 2;
  s.interest = 0.9;
  s.phase = 'signal';
  s.signalAt = s.t;
  s.hooking = { id: 'aori', weight: 500, mantle: 20, power: 0.6 };
  run(s, 0.3);
  press(s); // 乱数 0.99 → 掛からない
  assert.equal(s.squid, 1);
  assert.ok(s.interest <= 0.1);
});

test('期待値が高い日・まずめ・秋ほど、エギの近くにイカが多い。冬の日中は少ない', () => {
  const good = meanSquid(10, 'evening', normalizeConditions({ expectation: 9 }));
  const bad = meanSquid(10, 'evening', normalizeConditions({ expectation: 1 }));
  const winterDay = meanSquid(1, 'day', normalizeConditions({ expectation: 5 }));
  assert.ok(good > bad * 2);
  assert.ok(winterDay < 0.35);
});

test('突風が強いとアタリが取りにくい（アワセの猶予が短い）', () => {
  const calmW = signalWindows(normalizeConditions({ gust: 4 }));
  const windy = signalWindows(normalizeConditions({ gust: 12 }));
  assert.equal(calmW.good, SIGNAL_GOOD);
  assert.ok(windy.good < SIGNAL_GOOD * 0.7);
});

// 人間らしく遊ぶ自動プレイ：底まで沈めて、2回しゃくって3秒フォール、アタリには0.25秒でアワセ、テンションを見ながら巻く
function botTrip(seed, month, tod, conditions) {
  const s = createEgi({ seed, month, tod, conditions });
  const step = 0.05;
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 20000) {
    if (s.phase === 'ready') { press(s); run(s, 0.8, step); release(s); continue; }
    if (s.phase === 'result') { press(s); release(s); continue; }
    if (s.phase === 'sinking') { const ev = run(s, step, step); if (s.depth >= s.bottom - 0.5) { press(s); release(s); } continue; }
    if (s.phase === 'action') {
      press(s); release(s); run(s, 0.4, step);
      if (s.phase !== 'action') continue;
      press(s); release(s);
      for (let k = 0; k < 60 && s.phase === 'action'; k++) run(s, step, step);
      continue;
    }
    if (s.phase === 'signal') { run(s, 0.25, step); press(s); release(s); continue; }
    if (s.phase === 'fight') {
      // 人はテンションのゲージを見て巻く：60未満なら巻く、70を超えたらゆるめる
      if (s.tension < 60 && !s.pressing) press(s);
      else if (s.tension > 70 && s.pressing) release(s);
      run(s, step, step);
      if (s.phase !== 'fight' && s.pressing) release(s);
      continue;
    }
    run(s, step, step);
  }
  return s.catches.length;
}

test('良い日（秋の夕まずめ・期待値8）は釣れやすく、悪い日（冬の日中・期待値2）はボウズが多い', () => {
  const N = 40;
  const good = Array.from({ length: N }, (_, i) => botTrip('g' + i, 10, 'evening', { expectation: 8 }));
  const bad = Array.from({ length: N }, (_, i) => botTrip('b' + i, 1, 'day', { expectation: 2 }));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const bouzu = (a) => a.filter((n) => n === 0).length / a.length;
  // 良い日でも毎投は釣れない（5投で平均1.5〜3.8杯）。悪い日は半分以上ボウズ
  assert.ok(avg(good) >= 1.5 && avg(good) <= 3.8, `良い日の平均 ${avg(good)}`);
  assert.ok(bouzu(bad) >= 0.5, `悪い日のボウズ率 ${bouzu(bad)}`);
  assert.ok(avg(good) > avg(bad) * 2);
});

// ---- 再現度（2026-09-24 ぱっぱ選択：エギの号数と沈下・フォールの種類／アタリの出方／しゃくりの種類） ----
import { sinkRate, egiSecPerMeter, sizeMatch, moodOf, dart, setEgi, BITES, TENSION_HOLD } from '../src/js/ikabu/games/egi.js';

test('エギ：シャローはゆっくり、ディープは速く沈む。3.5号ノーマルは本物の目安で約3.5秒/m', () => {
  assert.equal(egiSecPerMeter({ size: 3.5, type: 'normal' }), 3.5);
  assert.ok(sinkRate({ size: 3, type: 'shallow' }) < sinkRate({ size: 3, type: 'normal' }));
  assert.ok(sinkRate({ size: 3, type: 'deep' }) > sinkRate({ size: 3, type: 'normal' }));
  const a = createEgi({ rand: calm, egi: { size: 3, type: 'shallow' } });
  const b = createEgi({ rand: calm, egi: { size: 3, type: 'deep' } });
  cast(a); cast(b);
  run(a, 3); run(b, 3);
  assert.ok(b.depth > a.depth * 2, `ディープ ${b.depth.toFixed(1)}m／シャロー ${a.depth.toFixed(1)}m`);
});

test('エギ：重い号数ほど遠くへ飛ぶ', () => {
  const d = (size) => { const s = createEgi({ rand: calm, egi: { size } }); cast(s); return s.castDist; };
  assert.ok(d(3.5) > d(3) && d(3) > d(2.5));
});

test('エギ：ディープは底で根掛かりしやすく、シャローはしにくい', () => {
  const snagged = (type) => {
    const s = createEgi({ rand: () => 0.99, egi: { size: 3, type } });
    cast(s);
    run(s, 20);
    s.rand = () => 0.004; // 1コマあたりの根掛かり確率をこの値と比べる
    return run(s, 3).some((e) => e.type === 'snag');
  };
  assert.equal(snagged('deep'), true);
  assert.equal(snagged('shallow'), false);
});

test('エギは投げる前（構え中・結果表示中）だけ替えられる', () => {
  const s = createEgi({ rand: calm });
  assert.equal(setEgi(s, { size: 2.5, type: 'shallow' }), true);
  cast(s);
  assert.equal(setEgi(s, { size: 3.5 }), false);
  assert.deepEqual(s.spec, { size: 2.5, type: 'shallow' });
});

test('フォール：しゃくった後に押したままだとテンションフォール（ゆっくり沈み、手前に寄る）、離すとフリーフォール', () => {
  const s = createEgi({ rand: calm });
  cast(s);
  run(s, 2);
  press(s); // しゃくり
  const ev = run(s, TENSION_HOLD + 0.1);
  assert.ok(ev.some((e) => e.type === 'fall' && e.mode === 'tension'));
  assert.equal(s.tensionFall, true);
  const d0 = s.depth, x0 = s.dist;
  run(s, 1);
  const tensionSink = s.depth - d0;
  assert.ok(s.dist < x0, 'テンションフォールは手前に寄ってくる');
  release(s);
  assert.equal(s.tensionFall, false);
  const d1 = s.depth;
  run(s, 1);
  assert.ok(s.depth - d1 > tensionSink, 'フリーフォールの方が速く沈む');
});

test('アタリ：テンションフォールでは「竿先にコン」「走る」、フリーフォールでは「止まる」「フケる」も出る', () => {
  const kinds = { tension: new Set(), free: new Set() };
  for (let k = 0; k < 120; k++) {
    for (const mode of ['tension', 'free']) {
      const s = createEgi({ seed: `bite-${mode}-${k}`, month: 10, tod: 'evening', conditions: { expectation: 9 } });
      cast(s);
      run(s, 3);
      s.squid = 2;
      s.interest = 1;
      press(s);
      if (mode === 'free') release(s);
      const ev = run(s, 4).find((e) => e.type === 'signal');
      if (ev) kinds[mode].add(ev.kind);
    }
  }
  assert.ok(kinds.tension.has('tap') && !kinds.tension.has('slack'));
  assert.ok(kinds.free.has('stop') && kinds.free.has('slack') && !kinds.free.has('tap'));
});

test('アタリ：「竿先にコン」は猶予が短く、「止まる」は長い。軽い抱きはさらに短い', () => {
  assert.ok(BITES.tap.good < BITES.run.good && BITES.stop.good > BITES.run.good);
  const cond = normalizeConditions({});
  assert.ok(signalWindows(cond, 'run', true).good < signalWindows(cond, 'run').good);
});

test('しゃくり：テンポよく2回＝2段しゃくり', () => {
  const s = createEgi({ rand: calm });
  cast(s);
  run(s, 2);
  press(s); release(s);
  const first = run(s, 0.3);
  press(s); release(s);
  const ev = s.events.find((e) => e.type === 'jerk');
  assert.equal(ev.double, true);
});

test('しゃくり：やる気のある日はダートが効き、渋い日はダートで警戒される', () => {
  assert.equal(moodOf(10, 'evening', normalizeConditions({ expectation: 7 })), 'active');
  assert.equal(moodOf(1, 'day', normalizeConditions({ expectation: 3 })), 'calm');
  const after = (month, tod, exp) => {
    const s = createEgi({ rand: calm, month, tod, conditions: { expectation: exp } });
    cast(s);
    run(s, 2);
    s.interest = 0.5;
    dart(s);
    run(s, 2.1);
    return s.interest;
  };
  assert.ok(after(10, 'evening', 7) > 0.8);
  assert.ok(after(1, 'day', 3) < 0.5);
});

test('号数：秋の新子には2.5号、春の親イカには3.5号が合う', () => {
  assert.equal(sizeMatch(2.5, 2.5), 1);
  assert.ok(sizeMatch(3.5, 2.5) < sizeMatch(3, 2.5));
});

test('イカパンチ：すぐしゃくると警戒される、待てば抱く気が上がる（2026-09-25）', async () => {
  const M = await import('../src/js/ikabu/games/egi.js');
  const setup = () => {
    const s = M.createEgi({ seed: 'punch', month: 10, tod: 'evening', conditions: { expectation: 8 } });
    Object.assign(s, { phase: 'action', depth: 3, bottom: 9, dist: 20, squid: 2, interest: 0.5, lastJerk: 0, t: 5, judged: true });
    s.punchAt = s.t; s.punchPending = true;
    return s;
  };
  // すぐしゃくる → spooked（気になる度合いが下がる）
  const a = setup();
  a.t += 0.5; M.press(a); M.release(a);
  const sp = a.events.find((e) => e.type === 'spooked');
  assert.ok(sp, 'パンチ直後のしゃくりで警戒される');
  assert.ok(a.interest < 0.5);
  // 待つ → punch-wait（気になる度合いが上がる）。抱く・パンチの判定は起きないよう、イカが近くにいても乱数を大きく固定
  const b = setup();
  b.rand = () => 0.999;
  let waited = null;
  for (let i = 0; i < 50 && !waited; i++) { M.tick(b, 0.05); waited = b.events.find((e) => e.type === 'punch-wait'); }
  assert.ok(waited, '2秒待つと抱かせる間になる');
  assert.ok(b.interest > 0.5 && !b.punchPending);
});

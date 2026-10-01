// エギングゲームの判定。乱数を差し替えて、起きることを決め打ちで試す
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEgi, press, release, tick, speciesPool, seasonOf, totalWeight, CASTS, EGI_STOCK, SIGNAL_GOOD, SIGNAL_LATE, SINK,
  setTackle, landKindOf, normalizeTackle, TACKLE,
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

test('3回目からはスラックジャーク（スマホの連打の速さ 0.3秒でも出る）。待っていた2段目の残りの上がりは出さない', () => {
  const s = createEgi({ rand: calm });
  cast(s);
  run(s, 3);
  s.depth = s.bottom;
  const d0 = s.depth;
  const kinds = [];
  for (let i = 0; i < 4; i++) { press(s); kinds.push(s.events.filter((e) => e.type === 'jerk').map((e) => e.kind).pop()); release(s); run(s, 0.3); }
  assert.deepEqual(kinds, ['lift', 'lift', 'slack', 'slack']);
  // 上がったのは しゃくり2.6＋2回目の1.8＋0.3秒ぶんのなめらかな残り（1.6×0.3/0.5）＋スラック0.4×2。残りの続きは取り消し。沈んだ分があるので「それ以下」で見る
  assert.ok(d0 - s.depth <= 2.6 + 1.8 + 1.6 * 0.6 + 0.8 + 1e-9, String(d0 - s.depth));
});

test('テンポよく2回で止めると、押した瞬間にほぼ上がり、残りは0.5秒かけてなめらかに上がる（合計3.4m）', () => {
  const s = createEgi({ rand: calm });
  cast(s);
  run(s, 3);
  s.depth = s.bottom;
  press(s); release(s); run(s, 0.3);
  const d1 = s.depth;
  press(s); release(s);
  assert.ok(d1 - s.depth > 1.79 && d1 - s.depth < 1.81, '押した瞬間にほぼ上がる（10/2 ぱっぱ：遅れて跳ね上がるのは違和感）');
  const before = s.depth;
  const ev = [];
  for (let k = 0; k < 12; k++) ev.push(...tick(s, 0.05));
  assert.ok(ev.some((e) => e.type === 'jerk' && e.double && e.delayed), '遅れて「2段」の知らせ');
  assert.ok(before - s.depth > 1.0, String(before - s.depth));   // 残りの 1.6 が上がって、0.6秒ぶん沈んだ（約1.18）
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

test('良い日（秋の夕まずめ・期待値8）は釣れやすく、悪い日（冬の日中・期待値2）は救済とラストチャンスの分だけ', () => {
  const N = 40;
  const good = Array.from({ length: N }, (_, i) => botTrip('g' + i, 10, 'evening', { expectation: 8 }));
  const bad = Array.from({ length: N }, (_, i) => botTrip('b' + i, 1, 'day', { expectation: 2 }));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const bouzu = (a) => a.filter((n) => n === 0).length / a.length;
  // 良い日でも毎投は釣れない（5投で平均1.5〜4.2杯。最後の1投はラストチャンスで少し上がる）。
  // 悪い日は、上手な人なら救済とラストチャンス（2026-09-27）で取れる分（2杯まで）だけ。良い日はその2倍近く
  assert.ok(avg(good) >= 1.5 && avg(good) <= 4.2, `良い日の平均 ${avg(good)}`);
  assert.ok(avg(bad) <= 2, `悪い日の平均 ${avg(bad)}（ボウズ率 ${bouzu(bad)}）`);
  assert.ok(avg(good) > avg(bad) * 1.8, `良い日 ${avg(good)} / 悪い日 ${avg(bad)}`);
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
  assert.deepEqual(s.spec, { size: 2.5, type: 'shallow', color: 'orange', rig: 'normal' });
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
  const later = run(s, 0.6);   // 2段目は0.5秒遅れて上がり、その時に知らせる（2026-09-29 B案）
  const ev = [...s.events, ...(later ?? [])].find((e) => e.type === 'jerk' && e.double);
  assert.equal(ev?.double, true);
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

test('図鑑：季節モード（練習）の釣果は数えず、今日の萩の海の釣果だけ残る（ダディ指示 2026-09-25）', async () => {
  const { recordEgi, emptyEgi } = await import('../src/js/ikabu/games/records.js');
  const c = [{ id: 'mongo', weight: 2180, mantle: 30 }];
  const a = recordEgi(emptyEgi(), c, { counted: false });
  assert.deepEqual(a.fresh, []);
  assert.equal(a.rec.best, 0);
  assert.equal(Object.keys(a.rec.species).length, 0);
  const b = recordEgi(emptyEgi(), c, { counted: true, date: new Date(2026, 5, 10) });
  assert.deepEqual(b.fresh, ['mongo']);
  assert.equal(b.rec.species.mongo.first, '2026-06-10');
});

test('ボス：季節・時間帯が合うときだけ候補になる', async () => {
  const { bossesFor } = await import('../src/js/ikabu/games/egi.js');
  assert.deepEqual(bossesFor(5, 'day').map((b) => b.id), ['sodeika']);
  assert.ok(bossesFor(2, 'night').some((b) => b.id === 'daiou'));
  assert.deepEqual(bossesFor(10, 'day'), []);
});

test('エギの色：マズメは赤・ピンク、日中はナチュラル系、夜は紫が合う。濁りはオレンジ・ピンク（YAMASHITAの考え方）', async () => {
  const { colorFit, bestColors, normalizeConditions: nc } = await import('../src/js/ikabu/games/egi.js');
  const c = nc({ wave: 0.7 });
  assert.ok(colorFit('red', { tod: 'evening', cond: c, mood: 'active' }) > colorFit('blue', { tod: 'evening', cond: c, mood: 'active' }));
  assert.ok(bestColors({ tod: 'day', cond: c, mood: 'calm' }).every((x) => ['brown', 'green', 'blue'].includes(x)));
  assert.ok(bestColors({ tod: 'night', cond: c, mood: 'calm' }).includes('purple'));
  const murky = nc({ wave: 1.3 });
  assert.ok(colorFit('orange', { tod: 'day', cond: murky, mood: 'active' }) > colorFit('brown', { tod: 'day', cond: murky, mood: 'active' }));
  for (const col of ['red', 'blue', 'green', 'purple', 'orange', 'pink', 'brown']) {
    const v = colorFit(col, { tod: 'day', cond: c, mood: 'calm' });
    assert.ok(v >= 0.75 && v <= 1.25);
  }
});

// 🔰初心者練習（2026-09-27、ぱっぱ：知り合いが難しすぎてやめかけた）。初心者らしい自動プレイ：
// 2秒沈めたらしゃくる／しゃくったら3秒長押し（テンションフォール）／アタリには0.9秒遅れてアワセ／巻きは押しっぱなし（90超えで0.5秒離す）
function noviceTrip(seed, easy) {
  const s = createEgi({ seed, month: 10, tod: 'evening', conditions: { expectation: easy ? 10 : 7, wind: 1, gust: 2 }, easy });
  const step = 0.05;
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 30000) {
    if (s.phase === 'ready') { press(s); run(s, 0.8, step); release(s); continue; }
    if (s.phase === 'result') { press(s); release(s); continue; }
    if (s.phase === 'sinking') { run(s, 2.0, step); if (s.phase === 'sinking') { press(s); release(s); } continue; }
    if (s.phase === 'action') { press(s); for (let t = 0; t < 3 && s.phase === 'action'; t += step) tick(s, step); if (s.pressing) release(s); continue; }
    if (s.phase === 'signal') { run(s, 0.9, step); if (s.phase === 'signal') { press(s); release(s); } continue; }
    if (s.phase === 'fight') {
      if (!s.pressing) press(s);
      run(s, step, step);
      if (s.phase === 'fight' && s.tension > 90) { release(s); run(s, 0.5, step); }
      if (s.phase !== 'fight' && s.pressing) release(s);
      continue;
    }
    run(s, step, step);
  }
  return s.catches.length;
}

test('🔰初心者練習：初心者の動きでも秋は8割以上の釣行で釣れる。同じ動きの季節モードはそれより釣れない', () => {
  const N = 60;
  const got = (easy) => Array.from({ length: N }, (_, i) => noviceTrip(`n${easy}${i}`, easy)).filter((n) => n > 0).length / N;
  const easy = got(true);
  const normal = got(false);
  assert.ok(easy >= 0.8, `初心者練習 ${easy}`);
  // 季節モードもラストチャンス・救済（2026-09-27）で釣れることは増えたが、初心者練習よりは難しい
  assert.ok(normal < easy - 0.15, `季節モード ${normal} / 初心者練習 ${easy}`);
});

// 藻場（2026-09-27）
import { WEEDS, WEED_CHANCE, weedBoost, nearWeed } from '../src/js/ikabu/games/egi.js';

const castOnce = (seed, { easy = false, month = 10 } = {}) => {
  const s = createEgi({ seed, month, tod: 'evening', conditions: { expectation: 7 }, easy });
  press(s); run(s, 0.8); release(s);
  return s;
};

test('藻場：だいたい6割の投げに出て、3種類とも出る。場所は着水点のまわり', () => {
  const casts = Array.from({ length: 400 }, (_, i) => castOnce('w' + i));
  const withWeed = casts.filter((s) => s.weed);
  const share = withWeed.length / casts.length;
  assert.ok(Math.abs(share - WEED_CHANCE) < 0.12, `藻場の出る割合 ${share}`);
  for (const k of Object.keys(WEEDS)) assert.ok(withWeed.some((s) => s.weed.kind === k), `${k} が出ない`);
  for (const s of withWeed) assert.ok(s.weed.from >= 3 && s.weed.from <= s.castDist && s.weed.to <= s.castDist + 8, `${s.weed.from}-${s.weed.to} / ${s.castDist}`);
});

test('藻場のまわりは抱きやすい（春のアマモが一番）。離れていると効かない', () => {
  const s = castOnce('boost', { month: 5 });
  s.weed = { kind: 'amamo', from: 10, to: 16, height: 1.2 };
  s.dist = 12; assert.equal(weedBoost(s), 3.0);
  s.dist = 18; assert.ok(nearWeed(s)); assert.equal(weedBoost(s), 3.0);
  s.dist = 25; assert.equal(weedBoost(s), 1);
  s.month = 10; s.dist = 12; assert.equal(weedBoost(s), 2.2);
});

test('藻に掛かるとその1投はおしまい、エギは減らない。🔰初心者練習は藻に掛からない', () => {
  const s = castOnce('tangle');
  s.weed = { kind: 'hondawara', from: 0, to: 99, height: 2.0 };
  const egiBefore = s.egi;
  let tangled = false;
  for (let i = 0; i < 2000 && s.phase === 'sinking'; i++) { tick(s, 0.05); if (s.events.some((e) => e.type === 'weed')) tangled = true; }
  assert.ok(tangled, '藻に掛からなかった');
  assert.equal(s.last, 'weed');
  assert.equal(s.egi, egiBefore);
  const e = castOnce('tangle', { easy: true });
  e.weed = { kind: 'hondawara', from: 0, to: 99, height: 2.0 };
  for (let i = 0; i < 400 && e.phase === 'sinking'; i++) { tick(e, 0.05); assert.ok(!e.events.some((x) => x.type === 'weed')); }
});


// ラストチャンスと救済（2026-09-27、ぱっぱ：本物どおりだと釣れない日はほぼ釣れない＝離脱される）
import { RESCUE_AFTER, LAST_GUARANTEE } from '../src/js/ikabu/games/egi.js';

// 投げて、何もせず回収まで待つ（しゃくらない＝アタリは出ない）
function idleCast(s) {
  press(s); run(s, 0.8); release(s);
  const ev = [...s.events];
  for (let k = 0; k < 4000 && s.phase !== 'result' && s.phase !== 'over'; k++) { tick(s, 0.05); ev.push(...s.events); if (s.phase === 'sinking' && s.depth >= s.bottom) { s.dist = 0; s.phase = 'action'; } }
  if (s.phase === 'result') { press(s); release(s); }
  return ev;
}

test('救済：2投つづけて反応が無いと、次の投げは必ずイカが近くにいてヒントが出る', () => {
  const s = createEgi({ seed: 'rescue', month: 1, tod: 'day', conditions: { expectation: 1 } });
  const bonuses = [];
  for (let k = 0; k < RESCUE_AFTER + 1; k++) {
    const ev = idleCast(s);
    bonuses.push(ev.find((e) => e.type === 'bonus') ?? null);
  }
  assert.equal(bonuses[0], null);
  assert.equal(bonuses[RESCUE_AFTER - 1], null);
  assert.equal(bonuses[RESCUE_AFTER]?.kind, 'rescue');
  assert.ok(['color', 'zone'].includes(bonuses[RESCUE_AFTER].hint));
});

test('ラストチャンス：最後の1投はボーナス。まだボウズなら、しゃくってフォールさせれば必ずアタリが出る（はっきりした形）', () => {
  for (let i = 0; i < 20; i++) {
    const s = createEgi({ seed: 'last' + i, month: 1, tod: 'day', conditions: { expectation: 1 } });
    for (let k = 0; k < CASTS - 1; k++) idleCast(s);
    press(s); run(s, 0.8); release(s);
    const bonus = s.events.find((e) => e.type === 'bonus');
    assert.equal(bonus?.kind, 'last');
    assert.equal(bonus.guarantee, true);
    assert.ok(s.squid >= 1);
    // 沈めて、しゃくって、長押しのテンションフォールをくり返す
    run(s, 2);
    let signal = null;
    for (let k = 0; k < 10 && !signal && s.phase !== 'over' && s.phase !== 'result'; k++) {
      press(s);
      for (let t = 0; t < LAST_GUARANTEE + 1 && !signal; t += 0.05) { tick(s, 0.05); signal = s.events.find((e) => e.type === 'signal'); }
      if (s.pressing) release(s);
    }
    assert.ok(signal, `アタリが出ない（${i}）`);
    assert.equal(signal.kind, 'run');
    assert.equal(signal.light, false);
  }
});

test('ラストチャンス：もう釣れている釣行では、アタリの保証はしない。🔰初心者練習にはボーナスは無い', () => {
  const s = createEgi({ seed: 'last-got', month: 10, tod: 'evening', conditions: { expectation: 7 } });
  for (let k = 0; k < CASTS - 1; k++) idleCast(s);
  s.catches.push({ id: 'aori', weight: 500 });
  press(s); run(s, 0.8); release(s);
  const bonus = s.events.find((e) => e.type === 'bonus');
  assert.equal(bonus?.kind, 'last');
  assert.equal(bonus.guarantee, false);
  const e = createEgi({ seed: 'last-easy', month: 10, tod: 'evening', conditions: { expectation: 7 }, easy: true });
  let seen = false;
  for (let k = 0; k < CASTS; k++) { const ev = idleCast(e); if (ev.some((x) => x.type === 'bonus')) seen = true; }
  assert.equal(seen, false);
});

// しゃくったら乗ってた（2026-09-27、YAMASHITA 川上さんのエギングレッスンより）
import { LUCKY_WINDOW, LUCKY_CHANCE } from '../src/js/ikabu/games/egi.js';

// アタリを出して、何もせず離されるまで待つ
function letGoOnce(seed) {
  const s = createEgi({ seed, month: 10, tod: 'evening', conditions: { expectation: 9 } });
  press(s); run(s, 0.8); release(s);
  run(s, 2);
  s.squid = 2; s.interest = 1;
  for (let k = 0; k < 40 && s.phase !== 'signal'; k++) { press(s); for (let t = 0; t < 3 && s.phase === 'action'; t += 0.05) tick(s, 0.05); if (s.pressing) release(s); }
  if (s.phase !== 'signal') return null;
  let ev = [];
  for (let t = 0; t < 5 && s.phase === 'signal'; t += 0.05) { tick(s, 0.05); ev.push(...s.events); }
  return ev.some((e) => e.type === 'let-go') ? s : null;
}

test('しゃくったら乗ってた：離された直後のしゃくりで、ときどき乗る。時間が過ぎたら乗らない', () => {
  let tried = 0, lucky = 0, lateLucky = 0;
  for (let i = 0; i < 200 && tried < 60; i++) {
    const s = letGoOnce('lucky' + i);
    if (!s) continue;
    tried += 1;
    // 直後（0.5秒後）にしゃくる
    run(s, 0.5); press(s);
    if (s.events.some((e) => e.type === 'hook' && e.lucky)) { lucky += 1; assert.equal(s.phase, 'fight'); assert.ok(s.hooking); }
    release(s);
  }
  for (let i = 0; i < 200; i++) {
    const s = letGoOnce('late' + i);
    if (!s) continue;
    s.squid = 0;   // 待つ間に次のアタリが出て、それを見送った直後になるのを防ぐ
    run(s, LUCKY_WINDOW + 0.3); press(s);
    if (s.events.some((e) => e.type === 'hook' && e.lucky)) lateLucky += 1;
    release(s);
  }
  assert.ok(tried >= 30, `試せた数 ${tried}`);
  const share = lucky / tried;
  assert.ok(Math.abs(share - LUCKY_CHANCE) < 0.2, `乗った割合 ${share}`);
  assert.equal(lateLucky, 0);
});

// 誘いのスレ（2026-09-28）：同じ誘いの型が4回続くと「慣れてきた」、型を変えると「反応した」
const lureCycle = (s, jerks, tension) => {
  const ev = [];
  for (let j = 0; j < jerks; j++) { press(s); ev.push(...run(s, 0.05)); release(s); ev.push(...run(s, 0.3)); }
  if (tension) press(s);
  ev.push(...run(s, 3));
  if (tension) release(s);
  return ev;
};
const lureEvents = (ev) => ev.filter((e) => e.type === 'lure-stale' || e.type === 'lure-fresh').map((e) => e.type);

test('誘いのスレ：同じ型の4回目で「慣れてきた」、型を変えると「反応した」', () => {
  const s = createEgi({ seed: 'lure1', rand: calm });
  cast(s);
  run(s, 3);
  const seen = [];
  for (let i = 0; i < 5; i++) seen.push(...lureEvents(lureCycle(s, 2, true)));
  assert.deepEqual(seen, ['lure-stale'], '同じ型では4回目に1回だけ知らせる');
  assert.ok(s.lureSame >= 4);
  assert.deepEqual(lureEvents(lureCycle(s, 3, false)), ['lure-fresh'], '型を変えたら気を引ける');
  assert.equal(s.lureSame, 1);
});

test('誘いのスレ：初心者練習・シャクリの無いフォールでは数えない', () => {
  const easy = createEgi({ seed: 'lure2', rand: calm, easy: true });
  cast(easy);
  run(easy, 3);
  const seen = [];
  for (let i = 0; i < 6; i++) seen.push(...lureEvents(lureCycle(easy, 2, true)));
  assert.deepEqual(seen, [], '初心者練習では出さない');
  const s = createEgi({ seed: 'lure3', rand: calm });
  cast(s);
  run(s, 3);
  assert.equal(s.lureSame, 0, '着水直後のフォール（シャクリなし）は数えない');
});

// ---------- タックル（ロッド・ドラグ）2026-10-01 ぱっぱ：取り込み優先（締め・硬め）は寄せが速いがジェットで張りが跳ね、駆け引き優先（ゆるめ・柔らかめ）は時間がかかるが受け流す ----------
// 同じ手（巻き0.8秒・ゆるめ0.6秒）で、取り込みにかかる時間を比べる。ジェットは乱数で起こす
function fightWith(tackle, jetRand) {
  const s = createEgi({ rand: jetRand, tackle });
  cast(s);
  s.phase = 'fight'; s.tension = 30; s.dist = 12;
  s.hooking = { id: 'aori', weight: 900, mantle: 20, power: 0.8 };
  // 人はテンションのゲージを見て巻く：60未満なら巻く、70を超えたらゆるめる（botTrip と同じ手）
  let why = null; let time = 0; let peak = 0;
  const step = 0.05;
  while (!why && time < 180) {
    if (s.tension < 60 && !s.pressing) press(s);
    else if (s.tension > 70 && s.pressing) release(s);
    for (const e of tick(s, step)) if (['landed', 'break', 'unhooked'].includes(e.type)) why = e.type;
    peak = Math.max(peak, s.tension);
    time += step;
  }
  return { why, time: Math.round(time), peak };
}
test('タックル：締め×硬めは、ゆるめ×柔らかめより速く取り込める（ジェット無し）', () => {
  const fast = fightWith({ rod: 'stiff', drag: 'tight' }, calm);
  const slow = fightWith({ rod: 'soft', drag: 'loose' }, calm);
  assert.equal(fast.why, 'landed'); assert.equal(slow.why, 'landed');
  assert.ok(fast.time < slow.time * 0.7, `取り込み優先 ${fast.time}s / 駆け引き優先 ${slow.time}s`);
});
test('タックル：ジェットが続く相手には、締めは身切れしやすく、ゆるめは受け流せる', () => {
  const jets = () => 0.01;   // 乱数を小さくしてジェットを間隔いっぱいに起こす（ファイト中はほかの判定に乱数を使わない）
  const tight = fightWith({ rod: 'stiff', drag: 'tight' }, jets);
  const loose = fightWith({ rod: 'soft', drag: 'loose' }, jets);
  assert.equal(tight.why, 'break', `締め：${tight.why}`);
  assert.equal(loose.why, 'landed', `ゆるめ：${loose.why}（${loose.time}s）`);
});
test('タックルは投げる前だけ替えられる。知らない値は既定に戻る', () => {
  const s = createEgi({ rand: calm });
  assert.equal(setTackle(s, { rod: 'soft', drag: 'loose' }), true);
  cast(s);
  assert.equal(setTackle(s, { rod: 'stiff' }), false);
  assert.deepEqual(s.tackle, { rod: 'soft', drag: 'loose' });
  assert.deepEqual(normalizeTackle({ rod: 'x', drag: 'y' }), { rod: 'stiff', drag: 'normal' });
  assert.ok(TACKLE.drag.tight.reel > TACKLE.drag.loose.reel);
});
test('取り込み方は重さで決まる：〜500g ぶっこ抜き、500g〜1.5kg タモ、1.5kg〜 ギャフ', () => {
  assert.equal(landKindOf(300), 'lift'); assert.equal(landKindOf(500), 'net'); assert.equal(landKindOf(1499), 'net'); assert.equal(landKindOf(1500), 'gaff');
});
test('ラトル入りは、やる気のある日に寄る数が増える（同じ乱数で、ノーマル以上）', () => {
  const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
  const mk = (rig) => createEgi({ rand: seq([0.3]), month: 10, tod: 'evening', conditions: { expectation: 9 }, egi: { rig } });
  const a0 = mk('normal'); cast(a0);
  const a1 = mk('rattle'); cast(a1);
  assert.equal(a1.mood, 'active');
  assert.ok(a1.squid >= a0.squid, `ノーマル${a0.squid} ラトル${a1.squid}`);
});

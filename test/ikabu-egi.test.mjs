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
  const ids = (m, tod) => new Set(speciesPool(m, tod).map((p) => p.id));
  assert.ok(ids(1, 'night').has('yari') && ids(1, 'night').has('hiika'), '冬の夜はヤリイカ・ヒイカ');
  assert.ok(ids(4, 'day').has('kouika') && ids(4, 'day').has('mongo'), '春はコウイカ・モンゴウ');
  assert.deepEqual([...ids(10, 'day')], ['aori'], '秋の日中は新子のアオリイカ');
});

test('押している間に力がたまり、離すと投げて沈み始める', () => {
  const s = createEgi({ rand: calm });
  cast(s, 0.8); // ちょうど力いっぱい
  assert.equal(s.phase, 'sinking');
  assert.equal(s.casts, CASTS - 1);
  assert.ok(s.castDist >= 38, `遠くへ飛ぶ（${s.castDist}m）`);
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

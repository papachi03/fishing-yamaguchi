// 釣り方の追加（2026-09-27）：部員レベル・釣りスキルの解放・邪道エギング・外道の記録
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEgi, press, release, tick, dart, rebait, sinkRate, BITES, JADO_SINK, JADO_DRAG, KOTSU_WAIT, CASTS, EGI_STOCK,
} from '../src/js/ikabu/games/egi.js';
import { levelOf, LEVELS, methodState, nextSeasonMonth, unlockedBetween, catchPoints, POINTS } from '../src/js/ikabu/games/progress.js';
import { emptyEgi, recordEgiCatch, recordEgiTrip, recordGedo, mergeEgi } from '../src/js/ikabu/games/records.js';

const run = (s, seconds, step = 0.05) => {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += step) events.push(...tick(s, step));
  return events;
};
const cast = (s) => { press(s); run(s, 0.8); release(s); };
const toBottom = (s) => { for (let k = 0; k < 2000 && s.phase === 'sinking'; k++) tick(s, 0.05); };

/* ---------- 部員レベル ---------- */

test('レベル：ポイント0はLv1。境目ちょうどで上がる。次までの残りが分かる', () => {
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(LEVELS[1] - 1).level, 1);
  assert.equal(levelOf(LEVELS[1]).level, 2);
  assert.equal(levelOf(LEVELS[2]).level, 3);
  const l = levelOf(LEVELS[1] + 10);
  assert.equal(l.need, LEVELS[2] - LEVELS[1] - 10);
  assert.ok(l.frac > 0 && l.frac < 1);
  assert.equal(levelOf(-5).level, 1);
});

test('1杯のポイント：10pt＋100gごとに1pt、図鑑の初登録は＋30pt', () => {
  assert.equal(catchPoints({ weight: 450 }), 14);
  assert.equal(catchPoints({ weight: 450 }, { fresh: true }), 44);
});

test('釣りスキル：レベルが足りない／季節ではない／使える／準備中', () => {
  assert.equal(methodState('egi', { level: 1, month: 9 }), 'ok');
  assert.equal(methodState('jado', { level: 2, month: 5 }), 'level');
  assert.equal(methodState('jado', { level: 3, month: 5 }), 'ok');
  assert.equal(methodState('jado', { level: 3, month: 3 }), 'ok');        // リアルタイムは3月から
  assert.equal(methodState('jado', { level: 3, month: 9 }), 'season');
  // 季節モードは選んだ季節（春・初夏）で見る
  assert.equal(methodState('jado', { level: 3, month: 6, mode: 'practice' }), 'ok');
  assert.equal(methodState('jado', { level: 3, month: 10, mode: 'practice' }), 'season');
  assert.equal(methodState('jado', { level: 9, month: 5, mode: 'beginner' }), 'beginner');
  assert.equal(methodState('yaen', { level: 4, month: 5 }), 'level');
  assert.equal(methodState('yaen', { level: 5, month: 5 }), 'ok');
  assert.equal(methodState('yaen', { level: 5, month: 9 }), 'season');
  assert.equal(methodState('tailor', { level: 8, month: 2 }), 'soon');
});

test('次の季節：邪道は9月なら3月、5月ならその月。解放は Lv3・5・8', () => {
  assert.equal(nextSeasonMonth('jado', 9), 3);
  assert.equal(nextSeasonMonth('jado', 5), 5);
  assert.equal(nextSeasonMonth('tailor', 5), 12);
  assert.deepEqual(unlockedBetween(2, 3), ['jado']);
  assert.deepEqual(unlockedBetween(1, 8), ['jado', 'yaen', 'tailor']);
  assert.deepEqual(unlockedBetween(3, 4), []);
});

/* ---------- 記録：ポイントと外道 ---------- */

test('記録：釣るとポイントがたまる。練習（数えない）ではたまらない。釣行の完走で＋3', () => {
  let r = emptyEgi();
  r = recordEgiCatch(r, { id: 'kouika', weight: 520, mantle: 15 }).rec;
  assert.equal(r.points, catchPoints({ weight: 520 }, { fresh: true }));
  const p = r.points;
  r = recordEgiCatch(r, { id: 'kouika', weight: 300, mantle: 12 }, { counted: false }).rec;
  assert.equal(r.points, p);
  r = recordEgiTrip(r, [], {}).rec;
  assert.equal(r.points, p + POINTS.trip);
});

test('外道の記録：数・一番重い・初めての日。図鑑（species）には入らない', () => {
  let r = emptyEgi();
  const a = recordGedo(r, { id: 'kasago', weight: 180 }, { date: new Date(2026, 4, 3) });
  assert.equal(a.fresh, true);
  r = recordGedo(a.rec, { id: 'kasago', weight: 250 }).rec;
  assert.deepEqual(r.gedo.kasago, { count: 2, weight: 250, first: '2026-05-03' });
  assert.equal(r.points, POINTS.gedo * 2);
  assert.deepEqual(r.species, {});
  assert.equal(recordGedo(r, { id: 'boot', weight: 900 }, { counted: false }).rec.gedo.boot, undefined);
});

test('引き継ぎ：ポイントは多い方、外道は数・重さの大きい方と早い日付を残す（古い記録にも対応）', () => {
  const a = { ...emptyEgi(), points: 120, gedo: { kasago: { count: 2, weight: 200, first: '2026-05-01' } } };
  const b = { best: 0, sessions: 1, species: {}, bestOne: null, points: 80, gedo: { kasago: { count: 5, weight: 150, first: '2026-04-20' }, can: { count: 1, weight: 40, first: '2026-06-01' } } };
  const m = mergeEgi(a, b);
  assert.equal(m.points, 120);
  assert.deepEqual(m.gedo.kasago, { count: 5, weight: 200, first: '2026-04-20' });
  assert.equal(m.gedo.can.count, 1);
  const old = mergeEgi({ best: 10, sessions: 1, species: {}, bestOne: null }, null);   // 前の形の記録（points・gedo なし）
  assert.equal(old.best, 10);
  assert.equal(mergeEgi({ best: 10, sessions: 1, species: {}, bestOne: null }, { best: 0, sessions: 0, species: {}, bestOne: null }).points, 0);
});

/* ---------- 邪道エギング ---------- */

test('邪道：オモリの分だけ速く沈み、着底したら底での釣りになる（藻場は出ない）', () => {
  const s = createEgi({ seed: 'j1', method: 'jado', month: 5, tod: 'evening' });
  cast(s);
  assert.equal(s.weed, null);
  const t0 = s.t;
  toBottom(s);
  assert.equal(s.phase, 'action');
  assert.equal(s.depth, s.bottom);
  const sec = s.t - t0;
  assert.ok(sec < s.bottom / sinkRate(s.spec) * 0.75, `着底まで ${sec.toFixed(1)}秒`);
  assert.ok(Math.abs(sec - s.bottom / (sinkRate(s.spec) * JADO_SINK)) < 0.2);
});

test('邪道：押す＝ズル引き（手前へ寄る・底のまま）。ダートはできない', () => {
  const s = createEgi({ seed: 'j2', method: 'jado', month: 5, tod: 'evening', rand: () => 0.99 });
  cast(s); toBottom(s);
  const d0 = s.dist;
  run(s, 2);
  press(s); release(s);
  assert.ok(s.events.some((e) => e.type === 'drag' && e.good), '止めてから引いた＝いいリズム');
  assert.equal(s.dist, d0 - JADO_DRAG);
  assert.equal(s.depth, s.bottom);
  const before = s.dist;
  dart(s);
  assert.equal(s.dist, before);
});

test('邪道：引きっぱなしは気を引かず、止めてから引くと気を引く', () => {
  const mk = () => { const s = createEgi({ seed: 'j3', method: 'jado', month: 5, rand: () => 0.99 }); cast(s); toBottom(s); return s; };
  const a = mk(); const i0 = a.interest;
  for (let k = 0; k < 3; k++) { press(a); release(a); run(a, 0.3); }
  assert.ok(a.interest < i0, '連打で下がる');
  const b = mk(); const j0 = b.interest;
  for (let k = 0; k < 3; k++) { run(b, 2); press(b); release(b); }
  assert.ok(b.interest > j0, '止めてから引くと上がる');
});

test('邪道：アタリは「ずっしり」（猶予が長い）。止めている間にだけ出る', () => {
  assert.ok(BITES.heavy.good > BITES.run.good && BITES.heavy.late > BITES.run.late);
  let seen = 0;
  for (let i = 0; i < 30; i++) {
    const s = createEgi({ seed: 'h' + i, method: 'jado', month: 5, tod: 'evening', conditions: { expectation: 9 } });
    cast(s); toBottom(s); s.squid = 2; s.interest = 1;
    for (let k = 0; k < 12 && s.phase === 'action'; k++) {
      const ev = run(s, 3);
      const sig = ev.find((e) => e.type === 'signal');
      if (sig) { assert.ok(['heavy', 'tap'].includes(sig.kind)); if (sig.kind === 'heavy') seen += 1; break; }
      if (s.phase === 'action') { press(s); release(s); }
    }
  }
  assert.ok(seen >= 15, `ずっしりのアタリ ${seen}/30`);
});

test('邪道：深夜のコツコツ。すぐ動かすと警戒され、待つと抱く気になる', () => {
  let kotsu = 0, waited = 0;
  for (let i = 0; i < 60 && (kotsu < 3 || waited < 1); i++) {
    const s = createEgi({ seed: 'k' + i, method: 'jado', month: 5, tod: 'night', conditions: { expectation: 9 } });
    cast(s); toBottom(s); s.squid = 2; s.interest = 1;
    const ev = run(s, 8);
    if (ev.some((e) => e.type === 'kotsu')) {
      kotsu += 1;
      if (s.kotsuPending) { run(s, KOTSU_WAIT + 0.1); if (s.events.some((e) => e.type === 'kotsu-wait') || !s.kotsuPending) waited += 1; }
    }
  }
  assert.ok(kotsu >= 3, `コツコツ ${kotsu}`);
  // すぐ動かした場合
  const s = createEgi({ seed: 'kspook', method: 'jado', month: 5, tod: 'night', rand: () => 0.1 });
  cast(s); toBottom(s);
  s.kotsuPending = true; s.kotsuAt = s.t; s.lastDrag = s.t - 2;
  press(s); release(s);
  assert.ok(s.events.some((e) => e.type === 'spooked' && e.kotsu));
});

test('邪道：エサは投げるたび・アタリのたびに減り、投げる前なら付け直せる', () => {
  const s = createEgi({ seed: 'b1', method: 'jado', bait: 'kibinago', month: 5, rand: () => 0.99 });
  assert.equal(s.bait, 'kibinago');
  cast(s);
  assert.ok(s.baitLeft < 1);
  assert.equal(rebait(s), false);   // 投げている最中は付け直せない
  toBottom(s); s.dist = 1; press(s); release(s);   // 手前まで引いて回収
  assert.equal(s.phase, 'result');
  assert.equal(rebait(s, 'sasami'), true);
  assert.equal(s.baitLeft, 1);
  assert.equal(s.bait, 'sasami');
});

test('邪道：ズル引きは根掛かりの危険がある（初心者練習は無し）。ときどきゴミが上がる（エギは減らない）', () => {
  const s = createEgi({ seed: 'sn', method: 'jado', month: 5, rand: () => 0.01 });
  cast(s); toBottom(s); s.lastDrag = s.t - 2;
  press(s); release(s);
  assert.ok(s.events.some((e) => e.type === 'snag'));
  assert.equal(s.egi, EGI_STOCK - 1);
  const j = createEgi({ seed: 'junk', method: 'jado', month: 5, rand: () => 0.01 });
  cast(j); toBottom(j); j.rand = () => 0.995; j.rock = true;
  // 根掛かりの判定（小さい目）を通すため、1回だけ小さい目を出してからゴミの判定（大きい目）
  const seq = [0.01, 0.995, 0.3];
  j.rand = () => seq.shift() ?? 0.99;
  j.lastDrag = j.t - 2; press(j); release(j);
  assert.ok(j.events.some((e) => e.type === 'gedo' && (e.id === 'boot' || e.id === 'can')), JSON.stringify(j.events));
  assert.equal(j.egi, EGI_STOCK);
  assert.equal(j.last, 'junk');
  const e = createEgi({ seed: 'sn', method: 'jado', month: 5, rand: () => 0.01, easy: true });
  cast(e); toBottom(e); e.lastDrag = e.t - 2; press(e); release(e);
  assert.ok(!e.events.some((x) => x.type === 'snag'));
});

test('邪道：砂の底を引いていると、ごくまれにナマコ（外道・その1投はおしまい）', () => {
  const s = createEgi({ seed: 'nm', method: 'jado', month: 5, rand: () => 0.99 });
  cast(s); toBottom(s); s.rock = false; s.lastDrag = s.t - 2;
  const seq = [0.5, 0.9999, 0.5];   // 根掛かりの目（外れ）→ナマコの目（当たり）→重さ
  s.rand = () => seq.shift() ?? 0.99;
  press(s); release(s);
  assert.ok(s.events.some((e) => e.type === 'gedo' && e.id === 'namako'));
  assert.equal(s.last, 'gedo');
  assert.equal(s.gedo[0].id, 'namako');
});

/* ---------- 外道：カサゴ ---------- */

test('カサゴ：底で食う外道。取り込むと外道に入り、釣果（イカ）には入らない', () => {
  let got = null;
  for (let i = 0; i < 80 && !got; i++) {
    const s = createEgi({ seed: 'ks' + i, method: 'jado', month: 9, tod: 'day', conditions: { expectation: 5 } });
    cast(s); toBottom(s); s.squid = 0; s.rock = true;
    for (let k = 0; k < 400 && s.phase === 'action'; k++) tick(s, 0.05);
    if (s.phase === 'signal' && s.hooking?.id === 'kasago') {
      press(s); release(s);   // すぐ合わせる
      for (let k = 0; k < 4000 && s.phase === 'fight'; k++) {
        if (s.tension < 55 && !s.pressing) press(s);
        else if (s.tension > 70 && s.pressing) release(s);
        tick(s, 0.05);
      }
      if (s.last === 'gedo') got = s;
    }
  }
  assert.ok(got, 'カサゴが上がらない');
  assert.equal(got.catches.length, 0);
  assert.equal(got.gedo[0].id, 'kasago');
});

/* ---------- 遊んだ感じ（ボット） ---------- */

// 初心者のつもりのボット：底で2秒止めてズル引き、アタリには0.5秒で合わせ、張りを見ながら巻く
function noviceJadoTrip(seed, { month = 5, tod = 'evening', expectation = 6 } = {}) {
  const s = createEgi({ seed, method: 'jado', month, tod, conditions: { expectation } });
  let guard = 0;
  while (s.phase !== 'over' && guard++ < 200000) {
    if (s.phase === 'ready') { press(s); run(s, 0.7); release(s); continue; }
    if (s.phase === 'result') { if (s.baitLeft < 0.5) rebait(s); press(s); release(s); continue; }
    if (s.phase === 'sinking') { tick(s, 0.05); continue; }
    if (s.phase === 'action') { run(s, 2); if (s.phase === 'action') { press(s); release(s); } continue; }
    if (s.phase === 'signal') { run(s, 0.5); if (s.phase === 'signal') { press(s); release(s); } continue; }
    if (s.phase === 'fight') {
      if (s.tension < 55 && !s.pressing) press(s);
      else if (s.tension > 72 && s.pressing) release(s);
      tick(s, 0.05);
      continue;
    }
    tick(s, 0.05);
  }
  return s;
}

test('ボット：春の夕方の邪道エギングは、初心者でもボウズは半分以下（コウイカが主役）', () => {
  const trips = Array.from({ length: 60 }, (_, i) => noviceJadoTrip('nv' + i));
  const bouzu = trips.filter((s) => s.catches.length === 0).length / trips.length;
  const kou = trips.flatMap((s) => s.catches).filter((c) => ['kouika', 'shiriyake', 'mongo'].includes(c.id)).length;
  const all = trips.flatMap((s) => s.catches).length;
  assert.ok(bouzu <= 0.5, `ボウズ ${Math.round(bouzu * 100)}%`);
  assert.ok(kou / Math.max(1, all) >= 0.5, `コウイカの仲間 ${kou}/${all}`);
  assert.ok(trips.every((s) => s.casts === 0 || s.egi === 0));
  assert.equal(CASTS, 5);
});

/* ---------- ヤエン ---------- */
import { yaenSideAction, yaenFocus, yaenAji, YAEN_DIST, YAEN_SPOIL } from '../src/js/ikabu/games/egi.js';

// 底で待って、抱かれるまで進める（抱いたら true）
function toBite(s, tako = false) {
  cast(s);
  for (let k = 0; k < 4000 && s.phase === 'sinking'; k++) tick(s, 0.05);
  assert.equal(s.phase, 'wait');
  s.squid = 2;
  const r = s.rand;
  s.rand = () => (tako ? 0.999 : 0.0);   // イカ：抱く目が必ず出る／タコ：イカは抱かず、タコの目で（下で差し替える）
  if (tako) { s.squid = 0; s.rand = () => 0.0; }
  tick(s, 0.05);
  s.rand = r;
  return s.phase === 'run';
}

test('ヤエン：アジを底に置いて待つ。抱かれないとアジが傷んでおしまい。待っている間に押すと回収', () => {
  const s = createEgi({ seed: 'yw', method: 'yaen', month: 5, rand: () => 0.99 });
  cast(s);
  for (let k = 0; k < 4000 && s.phase === 'sinking'; k++) tick(s, 0.05);
  assert.equal(s.phase, 'wait');
  run(s, YAEN_SPOIL + 1);
  assert.equal(s.last, 'spoiled');
  press(s); release(s);   // 次の一投へ
  cast(s);
  for (let k = 0; k < 4000 && s.phase === 'sinking'; k++) tick(s, 0.05);
  press(s); release(s);
  assert.equal(s.last, 'recover');
});

test('ヤエン：抱くとドラグが鳴って走る。集中は時間とともに上がり、アジは減っていく', () => {
  const s = createEgi({ seed: 'yb', method: 'yaen', month: 5, rand: () => 0.99 });
  assert.ok(toBite(s));
  assert.equal(s.yaen.tako, false);
  assert.ok(s.events.some((e) => e.type === 'drag-sound' && e.kind === 'run'));
  const d0 = s.dist;
  run(s, 3);
  assert.ok(s.dist > d0, '走って糸が出る');
  const f1 = yaenFocus(s), a1 = yaenAji(s);
  run(s, 20);
  assert.ok(yaenFocus(s) > f1 && yaenAji(s) < a1);
  assert.ok(yaenFocus(s) > 0.6, `23秒で集中 ${yaenFocus(s).toFixed(2)}`);
});

test('ヤエン：待ちすぎるとアジを食べ終えて離れる', () => {
  const s = createEgi({ seed: 'ye', method: 'yaen', month: 5, rand: () => 0.99 });
  toBite(s);
  run(s, 150);
  assert.equal(s.last, 'eaten');
});

test('ヤエン：糸を上げて浮けばイカ。寄せて45度でヤエン投入→根元に入ったら竿を寄せて掛ける', () => {
  const s = createEgi({ seed: 'yh', method: 'yaen', month: 5, rand: () => 0.99 });
  toBite(s);
  assert.equal(yaenSideAction(s), 'lift');
  dart(s);
  assert.ok(s.events.some((e) => e.type === 'lift' && e.tako === false));
  run(s, 30);
  press(s);   // 寄せ始める
  assert.equal(s.phase, 'draw');
  // 抵抗（ジジッ）の間は手を止め、それ以外は巻く
  for (let k = 0; k < 4000 && s.phase === 'draw' && s.dist > YAEN_DIST; k++) {
    const want = s.t >= s.yaen.resistUntil;
    if (want && !s.pressing) press(s); else if (!want && s.pressing) release(s);
    tick(s, 0.05);
  }
  assert.equal(yaenSideAction(s), 'yaen');
  dart(s);
  assert.equal(s.phase, 'yaen');
  let reach = null;
  for (let k = 0; k < 4000 && !reach; k++) { tick(s, 0.05); reach = s.events.find((e) => e.type === 'yaen-reach'); }
  assert.ok(reach, '根元に入らない');
  run(s, 1);
  assert.equal(s.phase, 'yaen', '届いただけでは掛からない');
  release(s); press(s);   // 竿を寄せる
  const hook = s.events.find((e) => e.type === 'hook');
  assert.ok(hook?.yaen);
  assert.equal(s.phase, 'fight');
});

test('ヤエン：寄せている間の抵抗はゆっくり下がる。抵抗中に巻くと強く引いて下がる', () => {
  const s = createEgi({ seed: 'yp', method: 'yaen', month: 5, rand: () => 0.99 });
  toBite(s);
  run(s, 30);
  press(s); release(s);   // 寄せ始めて、手を止める
  assert.equal(s.phase, 'draw');
  s.yaen.resistUntil = s.t + 1;
  const d0 = s.dist;
  run(s, 0.8);
  assert.ok(s.dist > d0 && s.dist - d0 < 0.5, `手を止めている時は少しだけ下がる ${(s.dist - d0).toFixed(2)}`);
  s.yaen.resistUntil = s.t + 1;
  const d1 = s.dist;
  press(s);
  const ev = run(s, 0.8);
  assert.ok(s.dist - d1 > 0.8, `巻くと強く下がる ${(s.dist - d1).toFixed(2)}`);
  assert.ok(ev.some((e) => e.type === 'yaen-pull'));
});

test('ヤエン：タコは糸を上げても浮かない→糸を切る（外道の記録へ）。粘ると岩に入られる', () => {
  const s = createEgi({ seed: 'yt', method: 'yaen', month: 5, rand: () => 0.99 });
  assert.ok(toBite(s, true));
  assert.equal(s.yaen.tako, true);
  dart(s);   // 糸を上げる
  assert.ok(s.events.some((e) => e.type === 'lift' && e.tako));
  assert.equal(yaenSideAction(s), 'cut');
  dart(s);
  assert.equal(s.last, 'cut');
  assert.equal(s.gedo[0].id, 'tako');
  const u = createEgi({ seed: 'yt2', method: 'yaen', month: 5, rand: () => 0.99 });
  toBite(u, true);
  press(u);
  run(u, 20);
  assert.equal(u.last, 'tako-rock');
});

test('ヤエン：抵抗（ジジッ）の最中も巻き続けると、離されやすい', () => {
  let kept = 0, stopped = 0;
  for (let i = 0; i < 40; i++) {
    for (const careful of [false, true]) {
      const s = createEgi({ seed: 'yr' + i, method: 'yaen', month: 5 });
      s.rand = () => 0.0; cast(s); for (let k = 0; k < 4000 && s.phase === 'sinking'; k++) tick(s, 0.05);
      s.squid = 2; s.rand = () => 0.0; tick(s, 0.05);
      s.rand = Math.random;
      if (s.phase !== 'run' || s.yaen.tako) continue;
      run(s, 28); press(s);
      let stopUntil = -1;
      for (let k = 0; k < 1200 && s.phase === 'draw' && s.dist > YAEN_DIST; k++) {
        const ev = tick(s, 0.05);
        if (careful && ev.some((e) => e.type === 'drag-sound' && e.kind === 'jiji')) stopUntil = s.t + 1.3;
        const want = s.t >= stopUntil;
        if (want && !s.pressing) press(s); else if (!want && s.pressing) release(s);
      }
      if (s.phase === 'draw') { if (careful) stopped++; else kept++; }
    }
  }
  assert.ok(stopped > kept, `止めた ${stopped} / 巻きっぱなし ${kept}`);
});

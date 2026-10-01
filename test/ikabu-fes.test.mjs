// ガチャ限定フェスとシークレット（2026-10-01）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FES, activeFes, gachaPool, weightFor, todOf, jst, limitLabel, isSecret, isUpcoming } from '../src/js/ikabu/games/fes.js';
import { pickCard, pull, emptyCards } from '../src/js/ikabu/games/gacha.js';
import { checkDeck, starterDeck } from '../src/js/ikabu/games/battle.js';

const CARDS = JSON.parse(readFileSync(new URL('../src/js/ikabu/games/cards-data.json', import.meta.url), 'utf8'));
const FES_CARDS = [121, 122, 123], SECRETS = [124, 125];

test('限定5枚：フェス限定3・シークレット2。シークレットには帯を出さない', () => {
  for (const no of FES_CARDS) { const c = CARDS.find((x) => x.no === no); assert.equal(c.limit.fes, 'autumn2026'); assert.match(limitLabel(c), /フェス限定/); }
  for (const no of SECRETS) { const c = CARDS.find((x) => x.no === no); assert.ok(isSecret(c)); assert.equal(limitLabel(c), null); }
  // まだ始まっていないフェスのカード（2026-10-01 時点の冬）は isUpcoming。秋は始まっていれば false
  const w = CARDS.find((x) => x.no === 126), a = CARDS.find((x) => x.no === 121);
  assert.equal(isUpcoming(w, new Date('2026-10-01T03:00:00Z')), true); assert.equal(isUpcoming(w, new Date('2026-12-10T03:00:00Z')), false);
  assert.equal(isUpcoming(a, new Date('2026-10-20T03:00:00Z')), false);
});

test('フェスは日本時間の日付で開催中か決まる（10/10〜11/30）。確認用の force は期間外でも開く', () => {
  const at = (iso) => new Date(iso);
  assert.equal(activeFes(at('2026-10-09T14:59:00Z')), null);          // JST 10/9 23:59
  assert.equal(activeFes(at('2026-10-09T15:00:00Z'))?.id, 'autumn2026'); // JST 10/10 0:00
  assert.equal(activeFes(at('2026-11-30T14:00:00Z'))?.id, 'autumn2026'); // JST 11/30 23:00
  assert.equal(activeFes(at('2026-11-30T15:00:00Z')), null);          // JST 12/1
  assert.equal(activeFes(at('2026-10-01T03:00:00Z'), { force: 'autumn2026' })?.id, 'autumn2026');
  assert.equal(FES.length, 4);
  // 冬・春・初夏は期間が重ならず、秋の後に続く
  for (let i = 1; i < FES.length; i++) assert.ok(FES[i].from > FES[i - 1].until, FES[i].id);
  assert.equal(activeFes(at('2027-01-15T03:00:00Z'))?.id, 'winter2026');
  assert.equal(activeFes(at('2027-04-01T03:00:00Z'))?.id, 'spring2027');
  assert.equal(activeFes(at('2027-06-15T03:00:00Z'))?.id, 'summer2027');
});

test('時間帯：朝マズメ4〜8・昼9〜15・夕マズメ16〜18・夜19〜3。jst は日本時間', () => {
  assert.equal(todOf(5), 'morning'); assert.equal(todOf(12), 'day'); assert.equal(todOf(17), 'evening'); assert.equal(todOf(22), 'night'); assert.equal(todOf(2), 'night');
  assert.deepEqual(jst(new Date('2026-10-01T15:30:00Z')), { date: '2026-10-02', hour: 0, minute: 30 });
});

test('抽選の枠：通常は120枚だけ。フェスは＋3。シークレットは時間帯が合う時だけ混ざる', () => {
  const nos = (pool) => pool.map((c) => c.no);
  assert.equal(gachaPool(CARDS, { banner: 'normal', tod: 'day' }).length, 120);
  assert.deepEqual(nos(gachaPool(CARDS, { banner: 'autumn2026', tod: 'day' })).filter((n) => n > 120), FES_CARDS);
  assert.deepEqual(nos(gachaPool(CARDS, { banner: 'normal', tod: 'morning' })).filter((n) => n > 120), [124]);
  assert.deepEqual(nos(gachaPool(CARDS, { banner: 'normal', tod: 'evening' })).filter((n) => n > 120), [124]);
  assert.deepEqual(nos(gachaPool(CARDS, { banner: 'normal', tod: 'night' })).filter((n) => n > 120), [125]);
  assert.deepEqual(nos(gachaPool(CARDS, { banner: 'autumn2026', tod: 'night' })).filter((n) => n > 120).sort(), [121, 122, 123, 125]);
  assert.deepEqual(nos(gachaPool(CARDS, { banner: 'winter2026', tod: 'day' })).filter((n) => n > 120), [126, 127, 128]);
  assert.deepEqual(nos(gachaPool(CARDS, { banner: 'spring2027', tod: 'day' })).filter((n) => n > 120), [129, 130, 131]);
  assert.deepEqual(nos(gachaPool(CARDS, { banner: 'summer2027', tod: 'day' })).filter((n) => n > 120), [132, 133, 134]);
});

test('フェスの限定カードは同じレア度の中で3倍出やすい。通常の枠では重み1', () => {
  const pool = gachaPool(CARDS, { banner: 'autumn2026', tod: 'day' });
  const w = weightFor('autumn2026');
  assert.equal(w(CARDS.find((c) => c.no === 123)), 3); assert.equal(w(CARDS.find((c) => c.no === 46)), 1);
  assert.equal(weightFor('normal')(CARDS.find((c) => c.no === 123)), 1);
  // UR は通常6枚＋限定1枚（重み3）＝ 限定の出る割合は 3/9
  let hit = 0; const N = 9000;
  for (let i = 0; i < N; i++) if (pickCard(pool, 'UR', (i + 0.5) / N, w).no === 123) hit += 1;
  assert.ok(Math.abs(hit / N - 3 / 9) < 0.02, String(hit / N));
  // 通常の枠で引くと限定は絶対に出ない
  const out = pull(emptyCards(), gachaPool(CARDS, { banner: 'normal', tod: 'day' }), 200, { seed: 'fes-normal' });
  assert.ok(out.results.every((r) => r.card.no <= 120));
});

test('限定カードもデッキの決まりはそのまま（UR1・SSR2・同名2）', () => {
  const d = starterDeck(CARDS);
  assert.equal(checkDeck([...d.slice(0, 28), 123, 123], CARDS).ok, false);   // UR2枚
  assert.equal(checkDeck([...d.slice(0, 29), 123], CARDS).ok, true);
});

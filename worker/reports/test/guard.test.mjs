// 「同じ人」の数え方。IPv6は1人に /64 が配られるので、そこまでで丸めないと無限に別人になれる。
import test from 'node:test';
import assert from 'node:assert/strict';
import { ipGroupKey, ipHashOf, allowPost, allowReport } from '../src/guard.js';
import { makeEnv } from './fakes.mjs';

const req = (ip) => new Request('https://x.test/', { headers: ip ? { 'cf-connecting-ip': ip } : {} });

test('IPv4はそのまま1つ1つ別の人として数える', () => {
  assert.equal(ipGroupKey('203.0.113.1'), '203.0.113.1');
  assert.equal(ipGroupKey('203.0.113.2'), '203.0.113.2');
  assert.equal(ipGroupKey('unknown'), 'unknown');
});

test('IPv6は先頭4かたまり（/64）までで丸める', () => {
  const key = ipGroupKey('2001:db8:1:2:3:4:5:6');
  assert.equal(key, '2001:0db8:0001:0002::/64');
  // 後ろ64ビットをどう変えても同じキー
  for (const ip of ['2001:db8:1:2::1', '2001:0db8:0001:0002:ffff:ffff:ffff:ffff', '2001:DB8:1:2::abcd']) {
    assert.equal(ipGroupKey(ip), key, ip);
  }
  // 前半が違えば別のキー
  assert.notEqual(ipGroupKey('2001:db8:1:3::1'), key);
  assert.notEqual(ipGroupKey('2001:db8:2:2::1'), key);
});

test('省略記法（::）を含むIPv6も正しく丸める', () => {
  assert.equal(ipGroupKey('2001:db8::1'), '2001:0db8:0000:0000::/64');
  assert.equal(ipGroupKey('::1'), '0000:0000:0000:0000::/64');
  assert.equal(ipGroupKey('fe80::1234:5678:9abc:def0'), 'fe80:0000:0000:0000::/64');
});

test('IPv4射影（::ffff:…）は中身のIPv4で数える（全部を同じ/64に潰さない）', () => {
  assert.equal(ipGroupKey('::ffff:203.0.113.1'), '203.0.113.1');
  assert.notEqual(ipGroupKey('::ffff:203.0.113.1'), ipGroupKey('::ffff:203.0.113.2'));
});

test('ハッシュは一方向で、生のIPも丸めたキーも残さない', async () => {
  const env = makeEnv();
  const hash = await ipHashOf(req('2001:db8:1:2::1'), env);
  assert.match(hash, /^[0-9a-f]{16}$/);
  assert.ok(!hash.includes('2001'));
  assert.ok(!hash.includes('db8'));
  // 塩が違えば別の値になる（塩なしの総当たりで逆引きされない）
  assert.notEqual(hash, await ipHashOf(req('2001:db8:1:2::1'), makeEnv({ IP_SALT: 'another-salt' })));
  // /64 が同じなら同じハッシュ
  assert.equal(hash, await ipHashOf(req('2001:db8:1:2:ffff::9'), env));
});

test('投稿と通報の枠は別々に数える', async () => {
  const env = makeEnv();
  for (let i = 0; i < 3; i++) assert.equal(await allowPost(env, 'aaaa'), true);
  assert.equal(await allowPost(env, 'aaaa'), false, '投稿は1時間3件まで');
  assert.equal(await allowReport(env, 'aaaa'), true, '通報の枠は投稿に食われていない');
});

test('通報の枠は1時間10件・1日30件', async () => {
  const env = makeEnv();
  const t0 = Date.UTC(2026, 8, 20, 3, 0, 0);
  for (let i = 0; i < 10; i++) assert.equal(await allowReport(env, 'bbbb', t0), true, `${i}`);
  assert.equal(await allowReport(env, 'bbbb', t0), false);
  // 1時間たてば戻る。ただし1日の枠（30件）は残り続ける
  let allowed = 10;
  for (let h = 1; h < 6; h++) {
    for (let i = 0; i < 10; i++) if (await allowReport(env, 'bbbb', t0 + h * 3600000)) allowed += 1;
  }
  assert.equal(allowed, 30, '1日は30件で止まる');
});

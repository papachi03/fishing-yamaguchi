import test from 'node:test';
import assert from 'node:assert/strict';
import { egiColorOfDay, moonAge } from '../src/js/lib/egi-color.js';
import { composeMorningPost, morningDiscordContent, xWeightedLength, X_LIMIT } from '../src/js/lib/morning-post.js';

// 日本時間 7:00 の送信（UTC 22:00 の前日）
const at7 = (ymd) => new Date(`${ymd}T07:00:00+09:00`);
// 萩の予報（その日の0〜23時）。code と wave を時刻ごとに指定
const weather = (ymd, { code = 0, wave = 0.4, night = code, rainAt = null } = {}) => ({
  current: { precipitation: 0 },
  hourly: Array.from({ length: 24 }, (_, h) => ({
    time: `${ymd}T${String(h).padStart(2, '0')}:00`,
    code: h === rainAt ? 61 : h >= 20 ? night : code,
    wave,
  })),
});

test('月齢：満月・新月の既知の日', () => {
  assert.ok(Math.abs(moonAge(new Date('2026-09-26T16:49:00Z')) - 14.8) < 1.0, '2026-09-27 は満月の前後');
  const a = moonAge(new Date('2026-10-10T19:50:00Z'));
  assert.ok(a < 1.0 || a > 28.5, '2026-10-11 は新月の前後');
});

test('シーズン外（12月）と予報なしの日は出さない', () => {
  assert.equal(egiColorOfDay({ date: at7('2026-12-05'), weather: weather('2026-12-05') }), null);
  assert.equal(egiColorOfDay({ date: at7('2026-10-05'), weather: null }), null);
});

test('晴れの夕方は金テープ、満月の晴れた夜はケイムラ', () => {
  const e = egiColorOfDay({ date: at7('2026-09-27'), weather: weather('2026-09-27', { code: 0 }) });
  assert.equal(e.dusk, 'オレンジ×金');
  assert.equal(e.night, 'ケイムラ');
  assert.equal(e.murky, false);
});

test('くもりの夕方はケイムラ、新月の夜は赤テープ', () => {
  const e = egiColorOfDay({ date: at7('2026-10-11'), weather: weather('2026-10-11', { code: 3 }) });
  assert.equal(e.dusk, 'ケイムラ');
  assert.equal(e.night, '赤テープ');
});

test('雨や波1m以上の日は濁り扱い：夕方も夜も赤テープ', () => {
  const rain = egiColorOfDay({ date: at7('2026-09-27'), weather: weather('2026-09-27', { code: 0, rainAt: 10 }) });
  assert.equal(rain.murky, true);
  assert.equal(rain.dusk, 'オレンジ×赤');
  assert.equal(rain.night, '赤テープ');
  const wave = egiColorOfDay({ date: at7('2026-09-27'), weather: weather('2026-09-27', { wave: 1.2 }) });
  assert.equal(wave.murky, true);
});

test('満月でも夜が雨なら明るい月夜扱いにしない', () => {
  const e = egiColorOfDay({ date: at7('2026-09-27'), weather: weather('2026-09-27', { code: 0, night: 61 }) });
  assert.equal(e.moonBright, false);
});

test('どの組み合わせでもエギの行は38字分以内（Xの残りは40字分）', () => {
  for (const code of [0, 3, 61]) for (const ymd of ['2026-09-27', '2026-10-11']) for (const night of [0, 3]) {
    const e = egiColorOfDay({ date: at7(ymd), weather: weather(ymd, { code, night }) });
    assert.ok(xWeightedLength(e.line) + 1 <= 38, `${e.line} = ${xWeightedLength(e.line) + 1}`);
  }
});

// いちばん長いのは5地域すべて「穏やか」（3文字）で風が2桁の日。「中止」（2文字）ではない（2026-09-27 見落とし→直した）
test('いちばん長い日（5地域すべて「穏やか」・風2桁）でも、どの色の組み合わせでもエギの行を入れて280字以内', () => {
  const rows = ['萩', '長門', '下関', '下松', '防府'].map((nameJa) => ({ nameJa, level: 0, wind: 12.3 }));
  for (const code of [0, 3, 61]) for (const ymd of ['2026-09-27', '2026-10-11']) for (const night of [0, 3]) {
    const e = egiColorOfDay({ date: at7(ymd), weather: weather(ymd, { code, night }) });
    const text = composeMorningPost({ date: at7(ymd), rows, egiLine: e.line });
    assert.ok(text.includes(e.line), `${e.line} が外れた（${xWeightedLength(composeMorningPost({ date: at7(ymd), rows }))}字＋行）`);
    assert.ok(xWeightedLength(text) <= X_LIMIT, String(xWeightedLength(text)));
  }
});

test('280字を超える行は外し、堤防判定だけの下書きにする。Discordには理由と「入れていません」', () => {
  const rows = ['萩', '長門', '下関', '下松', '防府'].map((nameJa) => ({ nameJa, level: 3, wind: 12.3 }));
  const long = { line: '🦑' + 'エ'.repeat(60), reason: 'テスト。' };
  const text = composeMorningPost({ date: at7('2026-10-11'), rows, egiLine: long.line });
  assert.ok(!text.includes(long.line));
  assert.ok(xWeightedLength(text) <= X_LIMIT);
  const d = morningDiscordContent(text, false, at7('2026-10-11'), long);
  assert.match(d, /エギの色の理由：テスト。（今日は文字数が足りず/);
});

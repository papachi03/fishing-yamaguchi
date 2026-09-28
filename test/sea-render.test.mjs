// 海況の描画（sea-render.js）の言語対応。
//   1. 日本語（既定）の出力は test/fixtures/sea-dash-ja.txt と1文字も違わない
//      （YFJ 本体の sea.html・prerender-sea の見た目が変わっていない証拠。2026-09-29 海況データの乗り換えを取り込んだとき、
//       本家 main の sea-render.js と同じ入力で1文字も違わないことを確かめてから作り直した）
//   2. 英語（lang='en'）の出力に日本語の文字が1文字も残らない（固有名詞・投稿本文を除く画面すべて）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dashHTML, sourceNoteText } from '../src/js/pages/sea-render.js';
import { seasonalTargets, calcExpectation } from '../src/js/api/fishing.js';
import { describeWeather } from '../src/js/api/weather.js';
import { assessSafety, legendText, SAFETY_LEVELS } from '../src/js/api/safety.js';
import { reportCardHTML } from '../src/js/components/report-card.js';
import * as F from './fixtures/sea-fixture.mjs';

const JA = /[぀-ヿ㐀-鿿！-｠]/; // ひらがな・カタカナ・漢字・全角記号

// 固定ファイルと同じ手順で組み立てる（scratchpad の gen-sea-baseline.mjs と同じ並び）
function renderAll(lang) {
  const opt = lang ? { lang } : {};
  const parts = [];
  parts.push(dashHTML({ area: F.areaHagi, w: F.weather, t: F.tide, now: F.NOW, updatedLabel: 'UPDATED 12:00 JST', ...opt }));
  parts.push(dashHTML({ area: F.areaShimonoseki, w: F.weatherRough, t: F.tideProxy, now: F.NOW, updatedLabel: '9/24 12:00 時点の予報', notice: '最新の予報を取得できなかったため、9/24 12:00 時点の予報を表示しています。', ...opt }));
  parts.push(dashHTML({ area: F.areaHofu, w: null, t: F.tide, now: F.NOW, updatedLabel: 'UPDATED 12:00 JST', ...opt }));
  parts.push(sourceNoteText(F.areaHagi, F.tide, lang));
  parts.push(sourceNoteText(F.areaShimonoseki, F.tideProxy, lang));
  for (let m = 1; m <= 12; m++) parts.push(JSON.stringify(seasonalTargets(new Date(2026, m - 1, 15), lang)));
  parts.push(JSON.stringify(calcExpectation(F.areaHagi, F.tide, F.NOW, lang)));
  return parts.join('\n<!-- ===== -->\n');
}

test('日本語（lang 省略）の出力は英語対応の前と1文字も変わらない', () => {
  // Windows で git が改行を CRLF にして取り出すことがあるので、LF にそろえて比べる（中身の比較には関係ない）
  const expected = readFileSync(new URL('./fixtures/sea-dash-ja.txt', import.meta.url), 'utf8').replace(/
/g, '
');
  assert.equal(renderAll(undefined), expected);
  assert.equal(renderAll('ja'), expected, "lang='ja' を明示しても同じ");
});

test('英語の出力に日本語が残らない（固定入力の3エリア・12か月・出典行）', () => {
  // updatedLabel と notice は呼び出し側の文字列なので、英語ページ側で英語を渡す前提。ここでは英語に置き換えて調べる
  const html = renderAll('en').replace('9/24 12:00 時点の予報', 'Forecast as of 9/24 12:00').replace('最新の予報を取得できなかったため、9/24 12:00 時点の予報を表示しています。', 'x');
  const hit = html.match(new RegExp(`.{0,30}${JA.source}.{0,30}`));
  assert.equal(hit, null, `日本語が残っている: ${hit?.[0]}`);
  assert.match(html, /Hagi coast/);
  assert.match(html, /Koshigahama harbor/);
  assert.match(html, /Station: Shimonoseki \(Deshimachi\) \(nearest station, shared\)/);
  assert.match(html, /Source: JMA tide tables/);
  assert.match(html, /safety-badge">CAUTION</);
  assert.match(html, /safety-badge">STOP</);
  assert.match(html, /onshore wind \(blowing in from the sea, waves build\)/);
  assert.match(html, /swell with a 8 s period/);
  assert.match(html, /"squid":\["spear squid"\]/);
  assert.match(html, /"squid":\["bigfin reef squid"\]/);
  assert.match(html, /Month 9 \/ general guide/);
});

test('部品ごとの英語：天気名・安全判定・凡例・期待値', () => {
  assert.equal(describeWeather(0).text, '快晴');
  assert.equal(describeWeather(0, 'en').text, 'Clear');
  assert.equal(describeWeather(999, 'en').text, '—');
  const ja = assessSafety({ wind: 6, gust: 3, waveHeight: 0.2, wavePeriod: 3, windDir: 180, facing: 0, seaProfile: 'nihonkai' });
  const en = assessSafety({ wind: 6, gust: 3, waveHeight: 0.2, wavePeriod: 3, windDir: 180, facing: 0, seaProfile: 'nihonkai', lang: 'en' });
  assert.equal(ja.label, '危険');
  assert.deepEqual(ja.reasons, ['風速6.0m/s']);
  assert.equal(en.label, 'DANGER');
  assert.equal(en.level, ja.level, '判定そのものは言語で変わらない');
  assert.deepEqual(en.reasons, ['wind 6.0 m/s']);
  assert.equal(SAFETY_LEVELS[0].label, '穏やか', '一番下の段階は「穏やか」（2026-09-28 本家で変更）');
  assert.match(legendText('setouchi', 'en'), /^Wind up to 5 calm \/ 5–7 caution \/ 7–10 danger \/ 10\+ stop · Wave/);
  assert.match(legendText('setouchi'), /^風速 〜5 穏やか/);
  const exp = calcExpectation(F.areaHagi, F.tide, F.NOW, 'en');
  assert.doesNotMatch(exp.message + exp.reasons.join('') + exp.tideName, JA);
});

test('現地の声のカード：英語では見出し・タグだけ英語、投稿者の名前と本文はそのまま', () => {
  const post = { id: 'p1', name: 'ダディ', spotId: 'hagi-city', comment: '釣れました', fish: 'aji', wind: 'stronger', date: '2026-09-05', hasPhoto: false };
  const ja = reportCardHTML(post, (id) => id);
  const en = reportCardHTML(post, (id) => id, 'en');
  assert.match(ja, /萩市内（詳しい場所は非公開）/);
  assert.match(ja, /アジ/);
  assert.match(ja, /風：予報より強かった/);
  assert.match(ja, /不適切な投稿を知らせる/);
  assert.match(en, /report-place">Hagi \(exact location private\)</);
  assert.match(reportCardHTML({ ...post, spotId: 'unknown' }, (id) => id, 'en'), /Location unknown/);
  assert.match(en, /Horse mackerel \(aji\)/);
  assert.match(en, /Wind: stronger than forecast/);
  assert.match(en, /Report this post/);
  assert.match(en, /ダディ/, '投稿者の名前は翻訳しない');
  assert.match(en, /釣れました/, '本文は翻訳しない');
  assert.doesNotMatch(en, /の情報|場所不明/);
});

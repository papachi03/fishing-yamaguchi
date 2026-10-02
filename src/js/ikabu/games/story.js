// ストーリーモードの進み具合（2026-10-03）。画面を持たない純粋な関数（node --test で試せる）。
//   記録：{ v:1, name, cleared:{ 'ch1-1': '2026-10-03', … }, losses:{ 'ch1-1': 2 }, tickets:{ 'ch1-1': true } }
//   ・cleared … 初めて勝った日（再戦しても変わらない）
//   ・losses  … 負けた回数（2回負けるとヒントを出す）
//   ・tickets … その戦の🎫2枚をもう渡したか（初回クリアだけ。ぱっぱ 2026-10-03）
//   名前：遊ぶ人が決める。空なら「アオ」（ぱっぱ 2026-10-03）
import { readJSON, writeJSON } from './records.js';

export const KEY_STORY = 'ikabu.story.v1';
export const DEFAULT_NAME = 'アオ';
export const NAME_MAX = 8;
export const HINT_AFTER_LOSSES = 2;
export const STORY_TICKETS = 2;

export const emptyStory = () => ({ v: 1, name: '', cleared: {}, losses: {}, tickets: {} });
export const readStory = () => ({ ...emptyStory(), ...(readJSON(KEY_STORY) ?? {}) });
export const writeStory = (s) => writeJSON(KEY_STORY, s);

// 名前の整え方：前後の空白を取り、絵文字・記号は落とし、8文字まで。空なら「アオ」
export function cleanName(raw) {
  const s = String(raw ?? '').replace(/[\p{Extended_Pictographic}\p{Cc}\p{Cf}<>"'&]/gu, '').trim().slice(0, NAME_MAX);
  return s || DEFAULT_NAME;
}
export const heroName = (story) => cleanName(story?.name);

// 台本の {name} を主人公の名前に差し替える
export const fillName = (text, name) => String(text).replaceAll('{name}', name);

const key = (ch, i) => `ch${ch}-${i}`;
export const isCleared = (story, ch, i) => Boolean(story?.cleared?.[key(ch, i)]);
export const lossesOf = (story, ch, i) => story?.losses?.[key(ch, i)] ?? 0;
export const hintReady = (story, ch, i) => lossesOf(story, ch, i) >= HINT_AFTER_LOSSES;

// 章の中で、いま挑める戦（勝っていない最初の戦）。全部勝っていれば null
export function nextBattle(story, ch, count) {
  for (let i = 1; i <= count; i++) if (!isCleared(story, ch, i)) return i;
  return null;
}
// その戦を押せるか：勝ち済み（再戦）か、いま挑める戦
export const canPlay = (story, ch, i, count) => isCleared(story, ch, i) || nextBattle(story, ch, count) === i;
export const chapterCleared = (story, ch, count) => nextBattle(story, ch, count) === null;

// 勝った：初めてなら cleared に日付、🎫の印を付けて got=2。2回目からは got=0
export function recordWin(story, ch, i, { day }) {
  const s = { ...emptyStory(), ...story, cleared: { ...(story?.cleared ?? {}) }, tickets: { ...(story?.tickets ?? {}) } };
  const k = key(ch, i);
  const first = !s.cleared[k];
  if (first) s.cleared[k] = day;
  let got = 0;
  if (!s.tickets[k]) { s.tickets[k] = true; got = STORY_TICKETS; }
  return { story: s, first, got };
}
export function recordLoss(story, ch, i) {
  const s = { ...emptyStory(), ...story, losses: { ...(story?.losses ?? {}) } };
  const k = key(ch, i);
  s.losses[k] = (s.losses[k] ?? 0) + 1;
  return { story: s, hint: s.losses[k] >= HINT_AFTER_LOSSES };
}
// 引き継ぎ（2つの記録を合わせる：勝ちは早い日付を、負けは多い方を、🎫の印はどちらかにあれば付いたまま）
export function mergeStory(a, b) {
  const x = { ...emptyStory(), ...(a ?? {}) };
  if (!b) return x;
  const r = { ...x, cleared: { ...x.cleared }, losses: { ...x.losses }, tickets: { ...x.tickets } };
  if (!r.name && b.name) r.name = b.name;
  for (const [k, d] of Object.entries(b.cleared ?? {})) r.cleared[k] = !r.cleared[k] || d < r.cleared[k] ? d : r.cleared[k];
  for (const [k, n] of Object.entries(b.losses ?? {})) r.losses[k] = Math.max(r.losses[k] ?? 0, n);
  for (const k of Object.keys(b.tickets ?? {})) r.tickets[k] = true;
  return r;
}

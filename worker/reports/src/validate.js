// 入力の検証。ネットにもKVにも触らない純粋な関数だけを置く。
import { LIMITS, RESERVED_WORDS } from './config.js';
import { placeById } from '../../../src/js/data/spot-list.js';
import { FISH, WIND_FEEL } from '../../../src/js/data/report-options.js';

// 改行(\n)とタブ以外の制御文字。CR(\r)も消す（名前やコメントを複数行にさせない）
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const DAY_MS = 86400 * 1000;

/** 日本時間の日付（YYYY-MM-DD）。WorkerはUTCで動くので必ずこれを通す */
export const jstDate = (d) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const fail = (error) => ({ ok: false, error });

export function validatePost(f, now = new Date()) {
  // 空白（改行やタブも含む）は1つに畳んでから数える。複数行の名前を作らせないため
  const name = String(f.name ?? '').normalize('NFKC').replace(CONTROL, '').replace(/\s+/g, ' ').trim();
  if (!name) return fail('お名前を入れてください。');
  if ([...name].length > LIMITS.name) return fail(`お名前は${LIMITS.name}文字までです。`);
  // ゼロ幅文字などの書式文字をはさんで予約語をすり抜けるのを防ぐため、比べる前に全部落とす
  const key = name.toLowerCase().replace(/\s+/g, '').replace(/[\p{Cf}\p{Cc}]/gu, '');
  if (RESERVED_WORDS.some((w) => key.includes(w))) {
    return fail('そのお名前は使えません。別のお名前にしてください。');
  }

  const place = placeById(String(f.spotId ?? ''));
  if (!place) return fail('場所を選んでください。');

  const comment = String(f.comment ?? '').replace(/\r\n/g, '\n').replace(CONTROL, '').trim();
  if (!comment) return fail('コメントを入れてください。');
  if ([...comment].length > LIMITS.comment) return fail(`コメントは${LIMITS.comment}文字までです。`);

  const fish = f.fish ? String(f.fish) : '';
  if (fish && !FISH.some((x) => x.id === fish)) return fail('魚の選択が正しくありません。');

  const wind = f.wind ? String(f.wind) : '';
  if (wind && !WIND_FEEL.some((x) => x.id === wind)) return fail('風の体感の選択が正しくありません。');

  const today = jstDate(now);
  const date = f.date ? String(f.date) : today;
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return fail('日付が正しくありません。');
  }
  if (date > today) return fail('未来の日付は選べません。');
  if (date < jstDate(new Date(now.getTime() - LIMITS.maxAgeDays * DAY_MS))) {
    return fail(`${LIMITS.maxAgeDays}日より前の情報は投稿できません。`);
  }

  return { ok: true, post: { name, spotId: place.id, areaId: place.areaId, comment, fish, wind, date } };
}

// "Exif\0\0" が先頭64KBにあるか。フォームは写真を作り直して送るので、普通は入ってこない。
// フォームを通さない投稿で位置情報つきの写真が入るのを防ぐ（場所を伏せた人を守る）
function hasExif(bytes) {
  const sig = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
  const end = Math.min(bytes.length, 65536) - sig.length;
  for (let i = 0; i <= end; i++) {
    if (sig.every((b, j) => bytes[i + j] === b)) return true;
  }
  return false;
}

export function validatePhoto(bytes) {
  if (!bytes || bytes.length === 0) return { ok: true, hasPhoto: false };
  if (bytes.length > LIMITS.photoBytes) return fail('写真が大きすぎます（3MBまで）。');
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) {
    return fail('写真はJPEG形式だけ受け付けます。');
  }
  // ここに来る前に index.js が stripJpegMeta を通しているので、普通は起きない。
  // それでも残っていたら、場所が漏れるより断るほうを選ぶ（最後の砦）
  if (hasExif(bytes)) {
    return fail('写真の撮影情報を消せませんでした。恐れ入りますが、別の写真でお試しください。');
  }
  return { ok: true, hasPhoto: true };
}

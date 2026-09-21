// JPEGから個人情報を含みうるメタデータの箱（APPセグメント・コメント）を外す。
// ブラウザのAPIに触らないこと（サイトとWorkerの両方がimportする）。
//
// なぜ必要か：写真はブラウザで描き直して送るので普通はEXIFが消えるが、
// 端末やブラウザによっては書き出したJPEGに撮影情報を入れ直すものがある
// （2026-09-21、ダディの端末で「写真に撮影情報が残っています」が出て発覚）。
// 送信前にここで確実に落とし、Worker側でも同じ処理を通して二重に守る。

// 落とすもの：APP1（EXIF・XMP）、APP3〜APP15（メーカー独自情報など）、COM（コメント）
// 残すもの：APP0（JFIF＝表示に使う基本情報）、APP2（ICC＝色。位置情報は入らない）
const isDroppable = (marker) => marker === 0xe1 || (marker >= 0xe3 && marker <= 0xef) || marker === 0xfe;

// 長さを持たないマーカー（これ自体で完結する2バイト）
const isStandalone = (marker) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);

/**
 * @param {Uint8Array} bytes JPEGのバイト列
 * @returns {Uint8Array} メタデータの箱を外したバイト列（JPEGでなければそのまま返す）
 */
export function stripJpegMeta(bytes) {
  if (!bytes || bytes.length < 4) return bytes;
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return bytes; // JPEGでない＝validatePhotoが弾く

  const keep = [bytes.subarray(0, 2)]; // SOI
  let i = 2;
  let dropped = 0;

  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) break; // 構造が読めない：残りはそのまま通す
    const marker = bytes[i + 1];

    if (isStandalone(marker)) {
      keep.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xda) {
      // SOS以降は画像データ本体。ここで打ち切って全部残す
      keep.push(bytes.subarray(i));
      i = bytes.length;
      break;
    }
    if (i + 3 >= bytes.length) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) break; // 壊れている：残りはそのまま通す
    const end = i + 2 + len;
    if (isDroppable(marker)) dropped += end - i;
    else keep.push(bytes.subarray(i, end));
    i = end;
  }
  if (i < bytes.length) keep.push(bytes.subarray(i)); // 途中で読めなくなった分
  if (dropped === 0) return bytes;

  const out = new Uint8Array(bytes.length - dropped);
  let at = 0;
  for (const part of keep) {
    out.set(part, at);
    at += part.length;
  }
  return out.subarray(0, at);
}

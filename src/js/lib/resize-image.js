// 写真を縮小してJPEGに作り直す。
// 「場所不明」を選んだ人の写真から場所が漏れるのを防ぐための要の処理なので、
// 元のファイルをそのまま送る近道を作らないこと。
//
// 描き直すだけでは足りない：端末やブラウザによっては、書き出したJPEGに
// 撮影情報を入れ直すものがある（2026-09-21にダディの端末で発覚）。
// そのため最後に stripJpegMeta を必ず通してから返す。
import { stripJpegMeta } from './strip-jpeg-meta.js';

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // createImageBitmap が使えない・読めない端末向け。<img> はEXIFの向きを自動で反映する
    const src = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(src);
    }
  }
}

export async function resizeToJpeg(file, maxSide = 1600, quality = 0.82) {
  const img = await decode(file);
  const w = img.width || img.naturalWidth;
  const h = img.height || img.naturalHeight;
  if (!w || !h) throw new Error('image has no size');
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('jpeg encode failed');
  const clean = stripJpegMeta(new Uint8Array(await blob.arrayBuffer()));
  return new Blob([clean], { type: 'image/jpeg' });
}

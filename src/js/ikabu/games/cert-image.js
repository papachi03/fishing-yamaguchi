// 認定証の画像（2026-09-30）。土台の絵（題名・本文・「山口イカ部」まで描き込み済み）に、名前と日付だけをブラウザの中で重ねる。
//   土台：public/assets/ikabu/certs/cert_{sumi|rush|egi|honor}.webp（1200×800、元は ikabu-research\cardbattle\gen\cert_*.png）
//   名前は入力してもらう（記録に残すのは名前だけ・このブラウザの中だけ）。日付は認定証を取った日
export const CERT_W = 1200;
export const CERT_H = 800;
export const certArt = (id, small = false) => `/assets/ikabu/certs/cert_${id}${small ? '_300' : ''}.webp`;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${src}`));
    img.src = src;
  });
}
const familyOf = () => {
  try { return getComputedStyle(document.documentElement).getPropertyValue('--font-maru').trim() || 'serif'; } catch { return 'serif'; }
};

// 名前と日付を載せた canvas を返す。位置は compose_cert.py と同じ割合（名前＝縦65.5%、日付＝右下の罫線の上）
export async function drawCert(id, { name = '', date = '', assetHref = (p) => p, honorific = '殿' } = {}) {
  const img = await loadImage(assetHref(certArt(id)));
  const family = familyOf();
  try { await document.fonts.load(`900 44px ${family}`); } catch { /* 書体が無くても描ける */ }
  const c = document.createElement('canvas');
  c.width = CERT_W; c.height = CERT_H;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, CERT_W, CERT_H);
  g.fillStyle = '#28282f';
  g.textBaseline = 'alphabetic';
  if (name) {
    const text = `${name}　${honorific}`;
    let size = 44;
    g.font = `900 ${size}px ${family}`;
    while (g.measureText(text).width > CERT_W * 0.42 && size > 20) { size -= 2; g.font = `900 ${size}px ${family}`; }
    g.textAlign = 'center';
    g.fillText(text, CERT_W / 2, CERT_H * 0.655 + size * 0.85);
  }
  if (date) {
    g.font = `700 22px ${family}`;
    g.textAlign = 'center';
    g.fillText(date, CERT_W * 0.78, CERT_H * 0.775 + 20);
  }
  return c;
}

// バインダーのシェア（2026-10-01 ぱっぱ：引いたカードを見せびらかせる場所＝招待の代わりにもなる）。
//   ・持っているカードから「レア度の高い順」に12枚を選び、1080×1350（Instagram の 4:5）の画像を canvas で描く
//   ・スマホは共有画面（navigator.share の files）、PC は保存（download）
//   ・画像の下に「山口イカ部 テストプレイ中・公式LINE」を入れて、見た人が来られるようにする
//   ・🎫は付けない（2026-10-01 時点・ぱっぱ未決定）
import { RARITY_ORDER, rank } from './gacha.js';
import { LINE_ADD_URL } from './links.js';

export const SHARE_W = 1080, SHARE_H = 1350, SHARE_MAX = 12;

// 純粋：見せるカードを選ぶ（レア度の高い順→番号順）。戻り：[{ card, n }]
export function pickShareCards(cards, owned = {}, max = SHARE_MAX) {
  return cards
    .filter((c) => (owned[c.no] ?? 0) > 0)
    .sort((a, b) => rank(b.rarity) - rank(a.rarity) || a.no - b.no)
    .slice(0, max)
    .map((card) => ({ card, n: owned[card.no] }));
}
// 純粋：集計の1行（レア度ごとの種類数）
export function shareSummary(cards, owned = {}) {
  const by = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0]));
  let kinds = 0, total = 0;
  for (const c of cards) { const n = owned[c.no] ?? 0; if (n > 0) { kinds += 1; by[c.rarity] += 1; } total += n; }
  return { kinds, all: cards.length, total, by };
}

const TEXT = {
  title: (lang) => (lang === 'en' ? 'MY CARD BINDER' : 'MY CARD BINDER'),
  sub: (lang, s) => (lang === 'en' ? `${s.kinds} / ${s.all} kinds collected` : `${s.kinds} / ${s.all} 種類 あつめた`),
  foot1: (lang) => (lang === 'en' ? 'Yamaguchi Ika Club — test play now open' : '山口イカ部 テストプレイ中'),
  foot2: (lang) => (lang === 'en' ? `Join from the official LINE  ${LINE_ADD_URL}` : `公式LINEから参加 → ${LINE_ADD_URL}`),
  file: (lang) => (lang === 'en' ? 'ika-club-binder.png' : 'イカ部バインダー.png'),
  shareText: (lang) => (lang === 'en' ? `My Yamaguchi Ika Club card binder 🦑 Test play is open: ${LINE_ADD_URL}` : `山口イカ部のカードバインダー🦑 テストプレイ中、公式LINEから参加できます → ${LINE_ADD_URL}`),
};

const loadImg = (src) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error(`image failed: ${src}`)); im.src = src; });
const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

// 画像を描いて Blob（PNG）で返す。assetHref はサイトの住所の付け方（ikabu の i18n から）
export async function makeShareImage({ cards, owned, lang = 'ja', assetHref }) {
  const picked = pickShareCards(cards, owned);
  const s = shareSummary(cards, owned);
  const cardSrc = (no) => assetHref(`/assets/ikabu/cards/card_${String(no).padStart(3, '0')}_240.webp`);
  try { await Promise.all([document.fonts?.load('800 56px "Kaisei Tokumin"'), document.fonts?.load('800 30px "Shippori Mincho B1"')]); } catch { /* 書体が無くても描く */ }
  const [logo, back, ...arts] = await Promise.all([
    loadImg(assetHref('/assets/ikabu/gacha/logo.webp')),
    loadImg(assetHref('/assets/ikabu/cards/card_back.webp')),
    ...picked.map((p) => loadImg(cardSrc(p.card.no))),
  ]);

  const cv = document.createElement('canvas');
  cv.width = SHARE_W; cv.height = SHARE_H;
  const g = cv.getContext('2d');
  // 背景：紺のグラデーション＋金の縁
  const bg = g.createLinearGradient(0, 0, 0, SHARE_H);
  bg.addColorStop(0, '#0b2a2f'); bg.addColorStop(1, '#071a1e');
  g.fillStyle = bg; g.fillRect(0, 0, SHARE_W, SHARE_H);
  g.strokeStyle = '#d9b24a'; g.lineWidth = 6; rrect(g, 18, 18, SHARE_W - 36, SHARE_H - 36, 28); g.stroke();
  // ロゴと題
  const lw = 300, lh = Math.round((logo.height / logo.width) * lw);
  g.drawImage(logo, 54, 44, lw, lh);
  g.fillStyle = '#ffd166'; g.textBaseline = 'top'; g.textAlign = 'right';
  g.font = '800 54px "Kaisei Tokumin", "Shippori Mincho B1", serif';
  g.fillText(TEXT.title(lang), SHARE_W - 60, 62);
  g.fillStyle = '#f3efe4'; g.font = '800 30px "Shippori Mincho B1", "Kaisei Tokumin", serif';
  g.fillText(TEXT.sub(lang, s), SHARE_W - 60, 130);
  // レア度ごとの種類数（右上の2段目）
  g.font = '800 26px "Shippori Mincho B1", serif'; g.textAlign = 'right';
  const line = RARITY_ORDER.map((r) => `${r} ${s.by[r]}`).join('   ');
  g.fillStyle = '#d9b24a'; g.fillText(line, SHARE_W - 60, 178);
  // カードの格子：4列×3段、240×360 を 228×342 で
  // 12枚（3段）そろっても足もとの文字（SHARE_H-128）に重ならない大きさ：240+3*306+2*18 = 1194
  const cols = 4, cw = 204, ch = 306, gap = 18;
  const gx = Math.round((SHARE_W - (cols * cw + (cols - 1) * gap)) / 2), gy = 240;
  for (let i = 0; i < SHARE_MAX; i++) {
    const x = gx + (i % cols) * (cw + gap), y = gy + Math.floor(i / cols) * (ch + gap);
    const p = picked[i];
    g.save();
    rrect(g, x, y, cw, ch, 14); g.clip();
    if (p) {
      g.drawImage(arts[i], x, y, cw, ch);
    } else {
      g.globalAlpha = 0.28; g.drawImage(back, x, y, cw, ch); g.globalAlpha = 1;
    }
    g.restore();
    if (p) {
      // 枚数（右下）。レア度の印はカードの絵に元から付いているので重ねない
      if (p.n > 1) {
        g.fillStyle = 'rgba(11,42,47,0.88)'; rrect(g, x + cw - 70, y + ch - 44, 62, 36, 10); g.fill();
        g.fillStyle = '#ffd166'; g.font = '800 24px "Shippori Mincho B1", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(`×${p.n}`, x + cw - 39, y + ch - 26);
        g.textBaseline = 'top';
      }
    }
  }
  // 足もと：テストプレイ中・公式LINE
  g.textAlign = 'center';
  g.fillStyle = '#ffd166'; g.font = '800 34px "Kaisei Tokumin", "Shippori Mincho B1", serif';
  g.fillText(TEXT.foot1(lang), SHARE_W / 2, SHARE_H - 128);
  g.fillStyle = '#f3efe4'; g.font = '700 26px "Shippori Mincho B1", serif';
  g.fillText(TEXT.foot2(lang), SHARE_W / 2, SHARE_H - 78);
  return await new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

// 共有画面か保存。戻り：'shared' | 'saved' | 'cancel'
export async function shareBlob(blob, lang = 'ja') {
  const file = new File([blob], TEXT.file(lang), { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: TEXT.shareText(lang) });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancel';
      // 共有に失敗したら保存に切り替える
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = TEXT.file(lang); document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'saved';
}

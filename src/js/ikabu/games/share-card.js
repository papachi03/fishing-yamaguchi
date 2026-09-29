/* ==========================================================================
   山口イカ部 — シェアカード（X / LINE に貼る結果画像）を canvas で描く
   1200×630（OGP と同じ比率）。DOM は読まない。canvas を作り、画像とフォントを
   読み込んでから描く純粋な描画モジュール。

   使い方
     import { drawEgiCatchCard, drawEgiTripCard, drawSumiCard } from './share-card.js';
     const canvas = await drawEgiCatchCard(data, { lang: 'ja', variant: 'A', assetHref: (p) => p });
     canvas.toBlob((b) => ..., 'image/png');

   variant：'A' ワッペン（海色の地に白いステッカー）／'B' チケット（アイボリーの半券）
            ／'C' 深海ポスター（暗い海にイカが浮かぶ）
   assetHref：'/assets/ikabu/...' を実際の URL に直す関数（本番の base に合わせる）

   配色の約束（ikabu.css 冒頭）：オレンジの上の文字は墨、海の上のオレンジ文字は
   明るいオレンジ（#ffb37a）を大きな見出しだけに。白 on オレンジは使わない。
   ========================================================================== */

export const CARD_W = 1200;
export const CARD_H = 630;
const M = 48; // 安全マージン

const C = {
  sea: '#00616B', deep: '#00454D', seaLine: '#138c96',
  orange: '#F47321', orangeDeep: '#d95f12', orangeLight: '#ffb37a',
  ivory: '#F5EEDC', ink: '#16233A', inkSoft: '#41585c', white: '#ffffff', mist: '#e8f6f7',
};

const F = {
  maru: "'Zen Maru Gothic'",
  varsity: "'Big Shoulders Display'",
  text: "'Zen Kaku Gothic New'",
};

/* ---- 文言（ja / en） ------------------------------------------------- */
const T = {
  ja: {
    gameEgi: 'しゃくって抱かせろ！', gameSumi: '墨つなぎ', club: '山口イカ部',
    site: 'yamaguchifishing.com/ikabu',
    live: '今日の萩の海', season: '季節モード（練習）', seasonWith: (s) => `季節モード（練習）・${s}`, beginner: '初心者練習',
    gameNote: 'ゲームの記録', mantle: (cm) => `胴長 ${cm}cm`, mantleLabel: '胴長',
    egi: (size, color) => `エギ ${size} ${color}`, egiLabel: 'エギ',
    first: '初ゲット！', catchLabel: '釣果',
    trip: '今回の釣果', cups: (n) => `${n}杯`, cupUnit: '杯', biggest: '最大',
    bouzu: 'ボウズ…でも部員', motto: '釣れなくても部員', bouzuSub: '海に立った、それでいい。',
    today: '今日の一戦', sameBoard: '世界中で同じ盤面', free: 'フリープレイ',
    score: 'スコア', pts: '点', reached: (g) => `${g.toLocaleString('ja-JP')}点 達成！`, remain: (n, g) => `${g.toLocaleString('ja-JP')}点まで あと${n.toLocaleString('ja-JP')}点`,
    chain: '最大チェイン', flashes: 'フラッシュ', newBadge: '称号',
  },
  en: {
    gameEgi: 'Shakutte Dakasero!', gameSumi: 'Sumi Chain', club: 'Yamaguchi Ika Club',
    site: 'yamaguchifishing.com/ikabu',
    live: "Today's Hagi sea", season: 'Season mode (practice)', seasonWith: (s) => `Season mode (practice) · ${s}`, beginner: 'Beginner practice',
    gameNote: 'Game record', mantle: (cm) => `Mantle ${cm} cm`, mantleLabel: 'Mantle',
    egi: (size, color) => `Egi ${size} ${color}`, egiLabel: 'Egi',
    first: 'First catch!', catchLabel: 'Catch',
    trip: 'This trip', cups: (n) => `${n} squid`, cupUnit: n => (n === 1 ? 'squid' : 'squid'), biggest: 'Biggest',
    bouzu: 'Blank… still a member', motto: 'No catch, still a member', bouzuSub: 'You stood by the sea. That counts.',
    today: "Today's match", sameBoard: 'Same board worldwide', free: 'Free play',
    score: 'Score', pts: 'pts', reached: (g) => `${g.toLocaleString('en-US')} pts reached!`, remain: (n, g) => `${n.toLocaleString('en-US')} pts to ${g.toLocaleString('en-US')}`,
    chain: 'Max chain', flashes: 'Flashes', newBadge: 'New title',
  },
};

/* ---- 読み込み ----------------------------------------------------------- */
const imgCache = new Map();
function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((ok, ng) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.decoding = 'async';
    im.onload = () => ok(im);
    im.onerror = () => ng(new Error(`image failed: ${src}`));
    im.src = src;
  });
  imgCache.set(src, p);
  return p;
}

// フォントは「使う文字」を渡して読み込む（Google Fonts は文字の範囲ごとに分割配信されるため）
async function loadFonts(sample) {
  const text = sample + '0123456789,.gcm杯点';
  const specs = [
    `900 40px ${F.maru}`, `700 40px ${F.maru}`,
    `800 40px ${F.varsity}`,
    `700 40px ${F.text}`, `500 40px ${F.text}`,
  ];
  await Promise.all(specs.map((s) => document.fonts.load(s, text)));
}

function collectSample(data, s) {
  const parts = [];
  const walk = (v) => {
    if (typeof v === 'string') parts.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(data); walk(s);
  // 関数で作る文言のサンプル
  parts.push(s.mantle(0), s.egi('', ''), s.seasonWith(''), s.cups(0), s.remain(0));
  return parts.join('');
}

/* ---- 描画の小道具 ------------------------------------------------------- */
function font(weight, size, family) { return `${weight} ${size}px ${family}`; }

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// 幅に収まるまで文字を小さくする。返り値は使ったサイズ
function fitFont(ctx, text, weight, family, maxSize, maxWidth, minSize = 18) {
  let size = maxSize;
  for (;;) {
    ctx.font = font(weight, size, family);
    if (ctx.measureText(text).width <= maxWidth || size <= minSize) return size;
    size -= 2;
  }
}

function text(ctx, str, x, y, { weight = 700, size = 24, family = F.text, color = C.ink, align = 'left', baseline = 'alphabetic', maxWidth, letter = 0 } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (letter) ctx.letterSpacing = `${letter}px`;
  const used = maxWidth ? fitFont(ctx, str, weight, family, size, maxWidth) : (ctx.font = font(weight, size, family), size);
  ctx.fillText(str, x, y);
  ctx.restore();
  return used;
}

// 3本ストライプ（海・白・オレンジ・白・海）
function stripes(ctx, x, y, w, h, base = C.sea) {
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h * 0.3);
  ctx.fillStyle = C.white; ctx.fillRect(x, y + h * 0.3, w, h * 0.1);
  ctx.fillStyle = C.orange; ctx.fillRect(x, y + h * 0.4, w, h * 0.2);
  ctx.fillStyle = C.white; ctx.fillRect(x, y + h * 0.6, w, h * 0.1);
  ctx.fillStyle = base; ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
}

// 角丸のタグ（ピル）。文字色と地色を指定。返り値は幅
function pill(ctx, str, x, y, { bg = C.orange, fg = C.ink, size = 26, weight = 700, family = F.maru, padX = 22, h = size * 1.9, align = 'left', border, rotate = 0 } = {}) {
  ctx.save();
  ctx.font = font(weight, size, family);
  const w = ctx.measureText(str).width + padX * 2;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  if (rotate) { ctx.translate(x0 + w / 2, y + h / 2); ctx.rotate(rotate); ctx.translate(-(x0 + w / 2), -(y + h / 2)); }
  rr(ctx, x0, y, w, h, h / 2);
  ctx.fillStyle = bg; ctx.fill();
  if (border) { ctx.lineWidth = 3; ctx.strokeStyle = border; ctx.stroke(); }
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(str, x0 + w / 2, y + h / 2 + size * 0.06);
  ctx.restore();
  return w;
}

// エギの色チップ（丸・白フチ）
function chip(ctx, x, y, r, hex, ring = C.white) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hex || C.orange; ctx.fill();
  ctx.lineWidth = Math.max(3, r * 0.22); ctx.strokeStyle = ring; ctx.stroke();
  ctx.restore();
}

// 画像を枠に収めて描く（縦横比を保つ、中央寄せ）
function drawContain(ctx, im, x, y, w, h, { align = 'center' } = {}) {
  const k = Math.min(w / im.naturalWidth, h / im.naturalHeight);
  const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
  const dx = align === 'left' ? x : align === 'right' ? x + w - dw : x + (w - dw) / 2;
  ctx.drawImage(im, dx, y + (h - dh) / 2, dw, dh);
  return { x: dx, y: y + (h - dh) / 2, w: dw, h: dh };
}

// 大きな数字＋単位（Big Shoulders）。返り値は全体の幅
function bigNumber(ctx, num, unit, x, y, { size = 200, unitSize, color = C.white, align = 'left', maxWidth = 640, gap = 10 } = {}) {
  const numStr = typeof num === 'number' ? num.toLocaleString('en-US') : String(num);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  const us = unitSize ?? Math.round(size * 0.36);
  let s = size;
  const widthAt = (sz) => {
    ctx.font = font(800, sz, F.varsity); const a = ctx.measureText(numStr).width;
    ctx.font = font(800, Math.round(sz * us / size), F.varsity); const b = unit ? ctx.measureText(unit).width + gap : 0;
    return { a, b, total: a + b };
  };
  let m = widthAt(s);
  while (m.total > maxWidth && s > 60) { s -= 4; m = widthAt(s); }
  const x0 = align === 'right' ? x - m.total : align === 'center' ? x - m.total / 2 : x;
  ctx.fillStyle = color; ctx.textAlign = 'left';
  ctx.font = font(800, s, F.varsity); ctx.fillText(numStr, x0, y);
  if (unit) { ctx.font = font(800, Math.round(s * us / size), F.varsity); ctx.fillText(unit, x0 + m.a + gap, y); }
  ctx.restore();
  return { w: m.total, size: s, x: x0 };
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = CARD_W; c.height = CARD_H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
}

function modeLabel(s, data) {
  if (data.mode === 'beginner') return s.beginner;   // 🔰初心者練習（2026-09-27）
  if (data.mode === 'season') return data.seasonLabel ? s.seasonWith(data.seasonLabel) : s.season;
  return s.live;
}

function assetPaths(assetHref) {
  return {
    logo: assetHref('/assets/ikabu/logo_600.png'),
    squid: (id) => assetHref(`/assets/ikabu/zukan/deform/${id}.webp`),
    tile: (n) => assetHref(`/assets/ikabu/tiles/${n}_256.webp`),
  };
}

const TILE_NAMES = ['wave', 'sun', 'shell', 'star', 'anchor', 'rare'];

/* ==========================================================================
   共通の骨組み：各バリアントで「地」「イカの居場所」「モードのタグ」が変わる
   ========================================================================== */

function pickVariant(v) {
  const key = String(v || 'A').toUpperCase();
  return VARIANTS[key] || VARIANTS.A;
}

/* ---------- Variant A：ワッペン（海の地＋白いステッカー・バーシティ） ---------- */
const A = {
  bg(ctx) {
    ctx.fillStyle = C.sea; ctx.fillRect(0, 0, CARD_W, CARD_H);
    // うっすら波線
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 3;
    for (let y = 120; y < CARD_H; y += 44) {
      ctx.beginPath();
      for (let x = -20; x <= CARD_W + 20; x += 20) ctx.lineTo(x, y + Math.sin((x + y) / 60) * 6);
      ctx.stroke();
    }
    ctx.restore();
    stripes(ctx, 0, 0, CARD_W, 16, C.sea);
    stripes(ctx, 0, CARD_H - 16, CARD_W, 16, C.sea);
  },
  // 白いステッカー（少し傾ける）。中に描く関数を受け取る
  sticker(ctx, x, y, w, h, angle, draw) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(angle); ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    rr(ctx, x, y, w, h, 28); ctx.fillStyle = C.white; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = C.seaLine;
    rr(ctx, x + 14, y + 14, w - 28, h - 28, 20); ctx.stroke(); ctx.setLineDash([]);
    draw(ctx);
    ctx.restore();
  },
  footer(ctx, s, logo, dateLabel) {
    // 左下：サイト行、右下はステッカー側で描く
    text(ctx, s.site, M, CARD_H - 36, { size: 22, weight: 500, family: F.text, color: 'rgba(255,255,255,0.8)' });
    if (dateLabel) text(ctx, dateLabel, M, CARD_H - 66, { size: 24, weight: 700, family: F.varsity, color: 'rgba(255,255,255,0.9)', letter: 1 });
  },
  modeTag(ctx, s, data, x, y) {
    if (data.mode !== 'live') return pill(ctx, modeLabel(s, data), x, y, { bg: C.orange, fg: C.ink, size: 26 });
    return pill(ctx, modeLabel(s, data), x, y, { bg: C.white, fg: C.sea, size: 26 });
  },
};

/* ---------- Variant B：チケット（アイボリーの半券） ---------- */
const B = {
  bg(ctx) {
    ctx.fillStyle = C.ivory; ctx.fillRect(0, 0, CARD_W, CARD_H);
    // 細かいドット地
    ctx.save(); ctx.fillStyle = 'rgba(0,97,107,0.08)';
    for (let y = 8; y < CARD_H; y += 16) for (let x = 8; x < CARD_W; x += 16) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  },
  // 半券つきの白いチケット。stubX = ミシン目の位置
  ticket(ctx, x, y, w, h, stubX) {
    ctx.save();
    ctx.shadowColor = 'rgba(22,35,58,0.18)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    rr(ctx, x, y, w, h, 22); ctx.fillStyle = C.white; ctx.fill();
    ctx.shadowColor = 'transparent';
    // 切り欠き（上下の丸）
    ctx.fillStyle = C.ivory;
    ctx.beginPath(); ctx.arc(stubX, y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(stubX, y + h, 22, 0, Math.PI * 2); ctx.fill();
    // ミシン目
    ctx.setLineDash([6, 10]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,97,107,0.45)';
    ctx.beginPath(); ctx.moveTo(stubX, y + 30); ctx.lineTo(stubX, y + h - 30); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  },
  header(ctx, x, y, w, h, title, reserve = 260) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x + 22, y); ctx.lineTo(x + w - 22, y); ctx.arcTo(x + w, y, x + w, y + 22, 22); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + 22); ctx.arcTo(x, y, x + 22, y, 22); ctx.closePath();
    ctx.fillStyle = C.orange; ctx.fill();
    ctx.restore();
    text(ctx, title, x + 28, y + h / 2 + 2, { size: 38, weight: 900, family: F.maru, color: C.ink, baseline: 'middle', maxWidth: w - reserve - 60 });
  },
  modeTag(ctx, s, data, xRight, yMid) {
    const label = modeLabel(s, data);
    if (data.mode !== 'live') return pill(ctx, label, xRight, yMid - 24, { bg: C.ink, fg: C.white, size: 24, align: 'right', h: 48 });
    return pill(ctx, label, xRight, yMid - 24, { bg: C.white, fg: C.sea, size: 24, align: 'right', h: 48 });
  },
  // 本券の下端に3本ストライプ（チケットの角丸に合わせて切り抜く）
  bottomStripes(ctx, tx, ty, tw, th, stub) {
    ctx.save(); rr(ctx, tx, ty, tw, th, 22); ctx.clip();
    stripes(ctx, stub + 1, ty + th - 16, tx + tw - stub - 1, 16, C.sea);
    ctx.restore();
  },
  pillWidth(ctx, str, size = 24, padX = 22) { ctx.save(); ctx.font = font(700, size, F.maru); const w = ctx.measureText(str).width + padX * 2; ctx.restore(); return w; },
};

/* ---------- Variant C：深海ポスター ---------- */
const Cv = {
  bg(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, CARD_H);
    g.addColorStop(0, C.deep); g.addColorStop(1, '#0a6b75');
    ctx.fillStyle = g; ctx.fillRect(0, 0, CARD_W, CARD_H);
    // 光の筋
    ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = C.white;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(700 + i * 90, -20); ctx.lineTo(760 + i * 90, -20); ctx.lineTo(560 + i * 90, CARD_H + 20); ctx.lineTo(520 + i * 90, CARD_H + 20); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  },
  glow(ctx, cx, cy, r) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(255,179,122,0.55)'); g.addColorStop(1, 'rgba(255,179,122,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  },
  // 左上のななめリボン（モード）
  ribbon(ctx, s, data) {
    const label = modeLabel(s, data);
    const season = data.mode !== 'live';
    ctx.save();
    ctx.translate(0, 0); ctx.rotate(-Math.PI / 12);
    ctx.font = font(700, 26, F.maru);
    const w = Math.max(ctx.measureText(label).width + 140, 420);
    ctx.fillStyle = season ? C.orange : C.white;
    ctx.fillRect(-100, 92, w + 60, 52);
    ctx.fillStyle = season ? C.ink : C.sea; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2 - 50, 118);
    ctx.restore();
  },
  logoPlate(ctx, logo, site) {
    // 右下：アイボリーの札にロゴ＋サイト行
    const w = 250, h = 124, x = CARD_W - M - w, y = CARD_H - M - h;
    ctx.save(); rr(ctx, x, y, w, h, 16); ctx.fillStyle = C.ivory; ctx.fill(); ctx.restore();
    drawContain(ctx, logo, x + 14, y + 8, w - 28, 82);
    text(ctx, site, x + w / 2, y + h - 14, { size: 16, weight: 700, family: F.text, color: C.inkSoft, align: 'center' });
  },
};

const VARIANTS = { A, B, C: Cv };

/* ==========================================================================
   1. エギング：1杯の釣果カード
   ========================================================================== */
export async function drawEgiCatchCard(data, { lang = 'ja', assetHref = (p) => p, variant = 'A' } = {}) {
  const s = T[lang] || T.ja;
  const P = assetPaths(assetHref);
  const [logo, squid] = await Promise.all([loadImage(P.logo), loadImage(P.squid(data.speciesId)), loadFonts(collectSample(data, s))]);
  const { c, ctx } = makeCanvas();
  const V = pickVariant(variant);
  const egiLine = s.egi(data.egi?.size ?? '', data.egi?.colorName ?? '');
  const key = String(variant || 'A').toUpperCase();

  if (key === 'A') {
    V.bg(ctx);
    // 左：文字の柱
    text(ctx, s.gameEgi, M, 84, { size: 30, weight: 700, family: F.maru, color: C.white, maxWidth: 620 });
    V.modeTag(ctx, s, data, M, 108);
    text(ctx, data.speciesName, M, 236, { size: 68, weight: 900, family: F.maru, color: C.white, maxWidth: 640 });
    const n = bigNumber(ctx, data.weightG, 'g', M - 4, 420, { size: 210, color: C.orangeLight, maxWidth: 640 });
    text(ctx, s.mantle(data.mantleCm), M, 470, { size: 40, weight: 700, family: F.maru, color: C.white, maxWidth: 400 });
    // エギ
    chip(ctx, M + 18, 512, 16, data.egi?.colorHex);
    text(ctx, egiLine, M + 48, 523, { size: 30, weight: 700, family: F.maru, color: C.white, maxWidth: 560 });
    V.footer(ctx, s, logo, data.dateLabel);
    // 右：白いステッカーにイカ＋ロゴ
    V.sticker(ctx, 740, 60, 400, 510, 0.035, () => {
      drawContain(ctx, squid, 770, 92, 340, 320);
      drawContain(ctx, logo, 790, 430, 300, 110);
    });
    if (data.firstCatch) pill(ctx, s.first, 700, 44, { bg: C.orange, fg: C.ink, size: 30, weight: 900, h: 60, rotate: -0.12, border: C.white });
  } else if (key === 'B') {
    V.bg(ctx);
    const tx = 40, ty = 40, tw = CARD_W - 80, th = CARD_H - 80, stub = 400;
    V.ticket(ctx, tx, ty, tw, th, stub);
    // 半券（左）
    drawContain(ctx, logo, tx + 30, ty + 26, stub - tx - 60, 110);
    text(ctx, s.club.toUpperCase() === s.club ? 'MEMBER’S CATCH' : 'MEMBER’S CATCH', tx + 30, ty + 172, { size: 26, weight: 800, family: F.varsity, color: C.sea, letter: 2 });
    if (data.dateLabel) text(ctx, data.dateLabel, tx + 30, ty + 214, { size: 34, weight: 800, family: F.varsity, color: C.ink, letter: 1 });
    // 胴長
    text(ctx, s.mantleLabel, tx + 30, ty + 268, { size: 20, weight: 700, family: F.text, color: C.inkSoft });
    bigNumber(ctx, data.mantleCm, 'cm', tx + 28, ty + 340, { size: 84, color: C.sea, maxWidth: 300 });
    // エギ
    text(ctx, s.egiLabel, tx + 30, ty + 386, { size: 20, weight: 700, family: F.text, color: C.inkSoft });
    chip(ctx, tx + 48, ty + 418, 16, data.egi?.colorHex, C.mist);
    text(ctx, `${data.egi?.size ?? ''} ${data.egi?.colorName ?? ''}`, tx + 76, ty + 428, { size: 28, weight: 700, family: F.maru, color: C.ink, maxWidth: stub - tx - 110 });
    text(ctx, s.site, tx + 30, ty + th - 28, { size: 18, weight: 500, family: F.text, color: C.inkSoft });
    if (data.firstCatch) pill(ctx, s.first, tx + 30, ty + 448, { bg: C.orange, fg: C.ink, size: 26, weight: 900, h: 52, rotate: -0.06 });
    // 本券（右）
    const mx = stub + 20, mw = tx + tw - mx;
    V.header(ctx, stub + 1, ty, tx + tw - stub - 1, 90, s.gameEgi, V.pillWidth(ctx, modeLabel(s, data)));
    V.modeTag(ctx, s, data, tx + tw - 24, ty + 45);
    text(ctx, data.speciesName, mx + 8, ty + 190, { size: 66, weight: 900, family: F.maru, color: C.ink, maxWidth: 420 });
    bigNumber(ctx, data.weightG, 'g', mx + 4, ty + 400, { size: 200, color: C.sea, maxWidth: 420 });
    text(ctx, s.catchLabel, mx + 10, ty + 440, { size: 22, weight: 700, family: F.text, color: C.inkSoft });
    drawContain(ctx, squid, mx + 420, ty + 110, mw - 440, th - 190);
    V.bottomStripes(ctx, tx, ty, tw, th, stub);
  } else {
    V.bg(ctx);
    // イカを大きく右に、光を背負わせる
    V.glow(ctx, 900, 240, 320);
    drawContain(ctx, squid, 660, 30, 500, 420);
    V.ribbon(ctx, s, data);
    text(ctx, s.gameEgi, M, 196, { size: 30, weight: 700, family: F.maru, color: C.white, maxWidth: 560 });
    if (data.dateLabel) text(ctx, data.dateLabel, M, 234, { size: 26, weight: 800, family: F.varsity, color: 'rgba(255,255,255,0.85)', letter: 1 });
    text(ctx, data.speciesName, M, 300, { size: 56, weight: 900, family: F.maru, color: C.white, maxWidth: 560 });
    bigNumber(ctx, data.weightG, 'g', M - 6, 468, { size: 200, color: C.white, maxWidth: 580 });
    text(ctx, s.mantle(data.mantleCm), M, 520, { size: 36, weight: 700, family: F.maru, color: C.orangeLight, maxWidth: 400 });
    chip(ctx, M + 16, 562, 14, data.egi?.colorHex);
    text(ctx, egiLine, M + 42, 572, { size: 28, weight: 700, family: F.maru, color: C.white, maxWidth: 500 });
    V.logoPlate(ctx, logo, s.site);
    if (data.firstCatch) pill(ctx, s.first, 760, 440, { bg: C.orange, fg: C.ink, size: 30, weight: 900, h: 60, rotate: -0.1, border: C.white, align: 'center' });
  }
  return c;
}

/* ==========================================================================
   2. エギング：今回の釣果（まとめ）カード
   ========================================================================== */
export async function drawEgiTripCard(data, { lang = 'ja', assetHref = (p) => p, variant = 'A' } = {}) {
  const s = T[lang] || T.ja;
  const P = assetPaths(assetHref);
  const count = Number(data.count) || 0;
  const big = count > 0 ? data.biggest : null;
  const key = String(variant || 'A').toUpperCase();
  const bouzu = count === 0;
  const [logo, squid, ghost] = await Promise.all([
    loadImage(P.logo),
    big ? loadImage(P.squid(big.speciesId)) : null,
    bouzu && key === 'C' ? loadImage(P.squid('aori')) : null,   // C案のボウズ札だけ「逃したイカ」の影に使う
    loadFonts(collectSample(data, s)),
  ]);
  const { c, ctx } = makeCanvas();
  const V = pickVariant(variant);

  if (key === 'A') {
    V.bg(ctx);
    text(ctx, s.gameEgi, M, 84, { size: 30, weight: 700, family: F.maru, color: C.white, maxWidth: 620 });
    V.modeTag(ctx, s, data, M, 108);
    if (bouzu) {
      text(ctx, s.bouzu, M, 270, { size: 70, weight: 900, family: F.maru, color: C.white, maxWidth: 640 });
      pill(ctx, s.motto, M, 300, { bg: C.orange, fg: C.ink, size: 30, weight: 900, h: 62 });
      text(ctx, s.bouzuSub, M, 430, { size: 30, weight: 700, family: F.maru, color: 'rgba(255,255,255,0.9)', maxWidth: 640 });
    } else {
      text(ctx, s.trip, M, 220, { size: 44, weight: 900, family: F.maru, color: C.white, maxWidth: 640 });
      bigNumber(ctx, count, lang === 'en' ? (count === 1 ? 'squid' : 'squid') : s.cupUnit, M - 4, 420, { size: 210, color: C.orangeLight, maxWidth: 640, unitSize: 72 });
      text(ctx, `${s.biggest}：${big.speciesName}  ${Number(big.weightG).toLocaleString('en-US')}g`, M, 486, { size: 34, weight: 700, family: F.maru, color: C.white, maxWidth: 640 });
    }
    V.footer(ctx, s, logo, data.dateLabel);
    V.sticker(ctx, 740, 60, 400, 510, -0.03, () => {
      if (squid) drawContain(ctx, squid, 770, 92, 340, 320);
      else drawContain(ctx, logo, 770, 130, 340, 240);
      if (squid) drawContain(ctx, logo, 790, 430, 300, 110);
      else text(ctx, s.club, 940, 470, { size: 32, weight: 900, family: F.maru, color: C.sea, align: 'center' });
    });
  } else if (key === 'B') {
    V.bg(ctx);
    const tx = 40, ty = 40, tw = CARD_W - 80, th = CARD_H - 80, stub = 400;
    V.ticket(ctx, tx, ty, tw, th, stub);
    drawContain(ctx, logo, tx + 30, ty + 26, stub - tx - 60, 110);
    text(ctx, 'TRIP REPORT', tx + 30, ty + 172, { size: 26, weight: 800, family: F.varsity, color: C.sea, letter: 2 });
    if (data.dateLabel) text(ctx, data.dateLabel, tx + 30, ty + 214, { size: 34, weight: 800, family: F.varsity, color: C.ink, letter: 1 });
    if (big) {
      text(ctx, s.biggest, tx + 30, ty + 268, { size: 20, weight: 700, family: F.text, color: C.inkSoft });
      text(ctx, big.speciesName, tx + 30, ty + 306, { size: 30, weight: 900, family: F.maru, color: C.ink, maxWidth: stub - tx - 60 });
      bigNumber(ctx, big.weightG, 'g', tx + 28, ty + 380, { size: 76, color: C.sea, maxWidth: 300 });
    } else {
      text(ctx, s.trip, tx + 30, ty + 268, { size: 20, weight: 700, family: F.text, color: C.inkSoft });
      bigNumber(ctx, 0, lang === 'en' ? 'squid' : s.cupUnit, tx + 28, ty + 360, { size: 96, color: C.sea, maxWidth: 300, unitSize: 40 });
    }
    text(ctx, s.site, tx + 30, ty + th - 28, { size: 18, weight: 500, family: F.text, color: C.inkSoft });
    const mx = stub + 20, mw = tx + tw - mx;
    V.header(ctx, stub + 1, ty, tx + tw - stub - 1, 90, s.gameEgi, V.pillWidth(ctx, modeLabel(s, data)));
    V.modeTag(ctx, s, data, tx + tw - 24, ty + 45);
    if (bouzu) {
      text(ctx, s.bouzu, mx + 8, ty + 220, { size: 60, weight: 900, family: F.maru, color: C.ink, maxWidth: mw - 60 });
      pill(ctx, s.motto, mx + 8, ty + 260, { bg: C.orange, fg: C.ink, size: 28, weight: 900, h: 58 });
      text(ctx, s.bouzuSub, mx + 8, ty + 390, { size: 28, weight: 700, family: F.maru, color: C.inkSoft, maxWidth: mw - 60 });
      drawContain(ctx, logo, mx + 380, ty + 300, mw - 420, 180);
    } else {
      text(ctx, s.trip, mx + 8, ty + 180, { size: 44, weight: 900, family: F.maru, color: C.ink, maxWidth: 420 });
      bigNumber(ctx, count, lang === 'en' ? 'squid' : s.cupUnit, mx + 4, ty + 400, { size: 200, color: C.sea, maxWidth: 420, unitSize: 70 });
      drawContain(ctx, squid, mx + 420, ty + 110, mw - 440, th - 190);
    }
    V.bottomStripes(ctx, tx, ty, tw, th, stub);
  } else {
    V.bg(ctx);
    if (squid) { V.glow(ctx, 900, 240, 320); drawContain(ctx, squid, 660, 30, 500, 420); }
    else { V.glow(ctx, 900, 260, 300); }
    V.ribbon(ctx, s, data);
    text(ctx, s.gameEgi, M, 196, { size: 30, weight: 700, family: F.maru, color: C.white, maxWidth: 560 });
    if (data.dateLabel) text(ctx, data.dateLabel, M, 234, { size: 26, weight: 800, family: F.varsity, color: 'rgba(255,255,255,0.85)', letter: 1 });
    if (bouzu) {
      text(ctx, s.bouzu, M, 330, { size: 64, weight: 900, family: F.maru, color: C.white, maxWidth: 800 });
      pill(ctx, s.motto, M, 360, { bg: C.orange, fg: C.ink, size: 30, weight: 900, h: 62 });
      text(ctx, s.bouzuSub, M, 490, { size: 30, weight: 700, family: F.maru, color: C.orangeLight, maxWidth: 800 });
      // 空の海に「逃したイカ」の影をうっすら浮かべる
      if (ghost) { ctx.save(); ctx.globalAlpha = 0.16; drawContain(ctx, ghost, 700, 60, 420, 360); ctx.restore(); }
    } else {
      text(ctx, s.trip, M, 300, { size: 50, weight: 900, family: F.maru, color: C.white, maxWidth: 560 });
      bigNumber(ctx, count, lang === 'en' ? 'squid' : s.cupUnit, M - 6, 480, { size: 210, color: C.white, maxWidth: 580, unitSize: 76 });
      text(ctx, `${s.biggest}：${big.speciesName}  ${Number(big.weightG).toLocaleString('en-US')}g`, M, 546, { size: 32, weight: 700, family: F.maru, color: C.orangeLight, maxWidth: 560 });
    }
    V.logoPlate(ctx, logo, s.site);
  }
  return c;
}

/* ==========================================================================
   3. 墨つなぎ：スコアカード
   ========================================================================== */
export async function drawSumiCard(data, { lang = 'ja', assetHref = (p) => p, variant = 'A' } = {}) {
  const s = T[lang] || T.ja;
  const P = assetPaths(assetHref);
  const [logo, tiles] = await Promise.all([loadImage(P.logo), Promise.all(TILE_NAMES.map((n) => loadImage(P.tile(n)))), loadFonts(collectSample(data, s))]);
  const { c, ctx } = makeCanvas();
  const V = pickVariant(variant);
  const key = String(variant || 'A').toUpperCase();
  const goal = data.goal ?? 1500;
  const score = Number(data.score) || 0;
  const goalLine = data.reached ? s.reached(goal) : s.remain(Math.max(0, goal - score), goal);
  const stats = `${s.chain} ${data.maxChain ?? 0}　${s.flashes} ${data.flashes ?? 0}`;
  const badges = Array.isArray(data.newBadges) ? data.newBadges.filter(Boolean) : [];
  const dailyLabel = data.daily ? `${s.today}${data.dayLabel ? '　' + data.dayLabel : ''}` : s.free;

  // タイルを一列に並べる（実物の画像）
  const tileRow = (x, y, size, gap, list = tiles) => list.forEach((im, i) => ctx.drawImage(im, x + i * (size + gap), y, size, size));

  if (key === 'A') {
    V.bg(ctx);
    text(ctx, s.gameSumi, M, 96, { size: 44, weight: 900, family: F.maru, color: C.white, maxWidth: 620 });
    pill(ctx, dailyLabel, M, 118, { bg: data.daily ? C.orange : C.white, fg: data.daily ? C.ink : C.sea, size: 26 });
    if (data.daily) text(ctx, s.sameBoard, M, 214, { size: 24, weight: 700, family: F.maru, color: 'rgba(255,255,255,0.85)' });
    text(ctx, s.score, M, 262, { size: 24, weight: 700, family: F.text, color: 'rgba(255,255,255,0.85)' });
    bigNumber(ctx, score, s.pts, M - 4, 430, { size: 210, color: C.orangeLight, maxWidth: 640, unitSize: 64 });
    pill(ctx, goalLine, M, 456, { bg: data.reached ? C.orange : C.white, fg: data.reached ? C.ink : C.sea, size: 28, weight: 900, h: 56 });
    text(ctx, stats, M, 556, { size: 28, weight: 700, family: F.maru, color: C.white, maxWidth: 640 });
    V.footer(ctx, s, logo, null);
    V.sticker(ctx, 740, 60, 400, 510, 0.03, () => {
      // 盤面ふうにタイルを 3×2
      const sz = 96, gap = 14, x0 = 740 + (400 - (sz * 3 + gap * 2)) / 2, y0 = 96;
      tiles.forEach((im, i) => ctx.drawImage(im, x0 + (i % 3) * (sz + gap), y0 + Math.floor(i / 3) * (sz + gap), sz, sz));
      if (badges.length) {
        text(ctx, s.newBadge, 940, 356, { size: 20, weight: 700, family: F.text, color: C.inkSoft, align: 'center' });
        pill(ctx, badges[0], 940, 368, { bg: C.orange, fg: C.ink, size: 26, weight: 900, h: 52, align: 'center' });
      }
      drawContain(ctx, logo, 790, 440, 300, 100);
    });
  } else if (key === 'B') {
    V.bg(ctx);
    const tx = 40, ty = 40, tw = CARD_W - 80, th = CARD_H - 80, stub = 400;
    V.ticket(ctx, tx, ty, tw, th, stub);
    drawContain(ctx, logo, tx + 30, ty + 26, stub - tx - 60, 110);
    text(ctx, data.daily ? 'DAILY MATCH' : 'FREE PLAY', tx + 30, ty + 172, { size: 26, weight: 800, family: F.varsity, color: C.sea, letter: 2 });
    if (data.daily && data.dayLabel) text(ctx, data.dayLabel, tx + 30, ty + 214, { size: 34, weight: 800, family: F.varsity, color: C.ink, letter: 1 });
    if (data.daily) text(ctx, s.sameBoard, tx + 30, ty + 250, { size: 22, weight: 700, family: F.maru, color: C.inkSoft, maxWidth: stub - tx - 60 });
    // 半券にタイルを縦に
    tileRow(tx + 30, ty + 286, 48, 8);
    text(ctx, stats, tx + 30, ty + 380, { size: 22, weight: 700, family: F.maru, color: C.ink, maxWidth: stub - tx - 60 });
    if (badges.length) {
      text(ctx, s.newBadge, tx + 30, ty + 420, { size: 20, weight: 700, family: F.text, color: C.inkSoft });
      pill(ctx, badges[0], tx + 30, ty + 432, { bg: C.orange, fg: C.ink, size: 24, weight: 900, h: 50 });
    }
    text(ctx, s.site, tx + 30, ty + th - 28, { size: 18, weight: 500, family: F.text, color: C.inkSoft });
    const mx = stub + 20, mw = tx + tw - mx;
    V.header(ctx, stub + 1, ty, tx + tw - stub - 1, 90, s.gameSumi, V.pillWidth(ctx, dailyLabel, 22));
    pill(ctx, dailyLabel, tx + tw - 24, ty + 21, { bg: C.ink, fg: C.white, size: 22, align: 'right', h: 48 });
    text(ctx, s.score, mx + 10, ty + 160, { size: 24, weight: 700, family: F.text, color: C.inkSoft });
    bigNumber(ctx, score, s.pts, mx + 4, ty + 380, { size: 220, color: C.sea, maxWidth: mw - 60, unitSize: 64 });
    pill(ctx, goalLine, mx + 8, ty + 410, { bg: data.reached ? C.orange : C.mist, fg: data.reached ? C.ink : C.sea, size: 30, weight: 900, h: 60 });
    // 右上に大きめのタイル飾り
    [tiles[5], tiles[3], tiles[0]].forEach((im, i) => { ctx.save(); ctx.translate(mx + mw - 110 - i * 88, ty + 150 + (i % 2) * 20); ctx.rotate((i - 1) * 0.15); ctx.drawImage(im, -40, -40, 80, 80); ctx.restore(); });
    V.bottomStripes(ctx, tx, ty, tw, th, stub);
  } else {
    V.bg(ctx);
    // タイルを右側に大きくばらまく（光つき）
    V.glow(ctx, 900, 300, 300);
    const spots = [[770, 150, 120, -0.2], [910, 110, 100, 0.15], [1050, 200, 130, -0.1], [820, 300, 110, 0.25], [990, 340, 120, -0.18], [850, 430, 100, 0.1]];
    spots.forEach(([x, y, sz, r], i) => { ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.drawImage(tiles[i], -sz / 2, -sz / 2, sz, sz); ctx.restore(); });
    // リボン：今日の一戦 or フリープレイ
    ctx.save(); ctx.rotate(-Math.PI / 12); ctx.font = font(700, 26, F.maru);
    const lw = Math.max(ctx.measureText(dailyLabel).width + 140, 420);
    ctx.fillStyle = data.daily ? C.orange : C.white; ctx.fillRect(-100, 92, lw + 60, 52);
    ctx.fillStyle = data.daily ? C.ink : C.sea; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(dailyLabel, lw / 2 - 50, 118); ctx.restore();
    text(ctx, s.gameSumi, CARD_W - M, 84, { size: 40, weight: 900, family: F.maru, color: C.white, align: 'right', maxWidth: 480 });
    if (data.daily) text(ctx, s.sameBoard, M, 210, { size: 26, weight: 700, family: F.maru, color: C.orangeLight });
    text(ctx, s.score, M, 262, { size: 24, weight: 700, family: F.text, color: 'rgba(255,255,255,0.85)' });
    bigNumber(ctx, score, s.pts, M - 6, 450, { size: 230, color: C.white, maxWidth: 600, unitSize: 70 });
    pill(ctx, goalLine, M, 476, { bg: data.reached ? C.orange : C.white, fg: data.reached ? C.ink : C.sea, size: 28, weight: 900, h: 56 });
    text(ctx, stats + (badges.length ? `　${s.newBadge}：${badges[0]}` : ''), M, 574, { size: 26, weight: 700, family: F.maru, color: C.white, maxWidth: 640 });
    V.logoPlate(ctx, logo, s.site);
  }
  return c;
}

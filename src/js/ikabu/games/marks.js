// 墨つなぎのマーク（SVG 文字列）。色だけでなく形も全部ちがう（色覚に頼らない）。
// 0 いかり・1 太陽・2 波・3 星・4 貝、RARE 黒いレアイカ。views/play.js と match3-ui.js で共有（DOM に触らない）
import { RARE } from './match3.js';

export const MARK_COLORS = ['#16233a', '#f47321', '#138c96', '#e2b000', '#e0685f'];

const ICONS = [
  // いかり
  `<circle cx="32" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="5"/><path d="M32 18v34M18 30h28M14 40c2 12 10 18 18 18s16-6 18-18l-8 4M14 40l8 4" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  // 太陽
  `<circle cx="32" cy="32" r="12" fill="currentColor"/><g stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13.6 13.6l5.7 5.7M44.7 44.7l5.7 5.7M13.6 50.4l5.7-5.7M44.7 19.3l5.7-5.7"/></g>`,
  // 波
  `<path d="M6 24c6-8 12-8 18 0s12 8 18 0 12-8 18 0M6 40c6-8 12-8 18 0s12 8 18 0 12-8 18 0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  // 星
  `<path d="M32 6l7.6 16.4L57 24.6l-13 12.2L47.4 55 32 46.2 16.6 55l3.4-18.2-13-12.2 17.4-2.2z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>`,
  // 貝（ホタテ）
  `<path d="M32 58L8 30c0-14 10-22 24-22s24 8 24 22z" fill="currentColor"/><path d="M32 56L20 28M32 56V22M32 56l12-28" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity="0.9"/>`,
];

// 黒いレアイカ：胴が上、足が下（泳ぐ姿）。白い目で黒い地から浮く
const RARE_ICON = `<path d="M32 4l14 26c4 8-2 14-8 14H26c-6 0-12-6-8-14z" fill="#0b0f1a" stroke="#0b0f1a" stroke-width="3" stroke-linejoin="round"/><path d="M22 44q-4 12 2 18M28 45q-2 10 2 16M32 45v18M36 45q2 10-2 16M42 44q4 12-2 18" fill="none" stroke="#0b0f1a" stroke-width="4.5" stroke-linecap="round"/><circle cx="26" cy="38" r="3.4" fill="#fff"/><circle cx="38" cy="38" r="3.4" fill="#fff"/><circle cx="26.8" cy="38.6" r="1.4" fill="#0b0f1a"/><circle cx="38.8" cy="38.6" r="1.4" fill="#0b0f1a"/>`;

export function markSVG(kind, { size = 40 } = {}) {
  const inner = kind === RARE ? RARE_ICON : ICONS[kind];
  const color = kind === RARE ? '#0b0f1a' : MARK_COLORS[kind];
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false" style="color:${color}">${inner}</svg>`;
}

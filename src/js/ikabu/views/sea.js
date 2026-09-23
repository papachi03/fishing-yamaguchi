// sea：ページの見出しだけ本物、中身は準備中（第2段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '02',
  eyebrow: 'WIND & WAVES',
  title: pair('今日の海は、いかが？', "How's the sea today?"),
  desc: pair('萩・長門・下関の風と波。ジャーナル本編の海況（天気・潮・安全の目安）を、そのまま部室から見られるようにします。', "Wind and waves for Hagi, Nagato and Shimonoseki. The journal’s sea page (weather, tide and safety guide), viewed from the clubroom."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'sea', pair('それまでは、ジャーナル本編の海況ページをどうぞ。', "Until then, the journal’s sea page has everything."));
}

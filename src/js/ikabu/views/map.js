// map：ページの見出しだけ本物、中身は準備中（第2段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '01',
  eyebrow: 'YAMAGUCHI FIELD GUIDE',
  title: pair('海への入口を、地図から。', "Find your way to the coast."),
  desc: pair('公開されている遊漁船の案内と、イカの食文化を楽しむ立ち寄り先。ピンは「エリアの目安」で、釣り場そのものは示しません。', "Publicly listed boat-trip information and stops to explore local squid food culture. Pins mark areas, never exact fishing spots."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'map', pair('地図・遊漁船の案内・食文化スポットは、次の段階で入ります。', "The map, boat-trip listings and food stops arrive in the next phase."));
}

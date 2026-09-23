// recipe：ページの見出しだけ本物、中身は準備中（第2段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '03',
  eyebrow: 'THE IKA KITCHEN',
  title: pair('材料と作り方', "Ingredients & steps"),
  desc: pair('1品ずつのレシピページ。分量と手順を、台所で見やすく。', "One recipe per page, with quantities and steps laid out for the kitchen."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'recipe', pair('レシピ本体は「イカ食堂」と同時に入ります。', "Individual recipes open together with the kitchen page."));
}

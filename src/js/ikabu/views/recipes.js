// recipes：ページの見出しだけ本物、中身は準備中（第2段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '03',
  eyebrow: 'THE IKA KITCHEN',
  title: pair('今日のイカを、いただきます。', "Something good from the squid kitchen."),
  desc: pair('家庭で作る４つの加熱料理。人数に合わせて分量を切り替えられます。', "Four home recipes using cooked squid. Switch quantities for two or four servings."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'recipes', pair('レシピ4品と、2人分⇔4人分の切り替え・印刷が入ります。', "Four recipes, with two-or-four-serving switching and a print view."));
}

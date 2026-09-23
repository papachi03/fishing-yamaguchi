// atlas：ページの見出しだけ本物、中身は準備中（第2段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '04',
  eyebrow: 'SQUIDS OF THE WORLD',
  title: pair('世界は、イカでつながっている。', "An ocean of extraordinary squid."),
  desc: pair('沿岸から深海まで、山口→日本→世界の順に約12種。名前・暮らす海・ひとつの不思議を知ろう。', "About twelve species, from Yamaguchi to Japan to the world. Learn a name, a habitat and a little wonder."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'atlas', pair('図鑑の写真は、山口のイカはぱっぱの実写を優先し、無い種は出典つきの公開写真を使います。', "Yamaguchi species get our own photos first; others use openly licensed photographs with credits."));
}

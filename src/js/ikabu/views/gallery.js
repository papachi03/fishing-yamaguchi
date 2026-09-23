// gallery：ページの見出しだけ本物、中身は準備中（第2段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '05',
  eyebrow: 'THE PHOTO CLUB',
  title: pair('イカのある風景。', "Life, with a little squid."),
  desc: pair('海、生きもの、食卓。撮影者と撮影地を添えた、部の参考アルバム。', "Sea, wildlife and food. A club reference album, with photographers and locations credited."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'gallery', pair('実写と公開ライセンスの写真を、出典つきで並べます。', "Our own photographs and openly licensed pictures, every one credited."));
}

// studio：ページの見出しだけ本物、中身は準備中（第2段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '07',
  eyebrow: 'STICKERS, STORIES & LITTLE JOKES',
  title: pair('イカしたことばを、世界へ。', "A little ink. A little wit."),
  desc: pair('紺とオレンジのイカが、会話にも登場。スタンプ試作と、ダジャレの解説、これからの発信。', "Our navy-and-orange squid joins the conversation. Sticker concepts, pun explanations and the stories we want to tell."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'studio', pair('スタンプ案の画像とダジャレの解説が入ります。', "Sticker artwork and the pun glossary are on the way."));
}

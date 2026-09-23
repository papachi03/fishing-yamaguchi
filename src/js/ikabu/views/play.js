// play：ページの見出しだけ本物、中身は準備中（第3段階で入る）。
import { pair } from '../i18n.js';
import { pageHead, comingSoon } from './parts.js';

export const HEAD = {
  num: '06',
  eyebrow: 'THE PLAYGROUND',
  title: pair('同じイカで、世界と一戦。', "One board. A world of players."),
  desc: pair('エギングゲームと「墨つなぎ」。釣りに行けない日のために、ロゴのイカが働きます。', "An eging game and Ink Link, the three-match puzzle. For days you cannot get to the water."),
};

export function render(lang) {
  return pageHead(lang, HEAD) + comingSoon(lang, 'play', pair('ゲーム2本は第3段階で入ります。', "Both games arrive in phase three."));
}

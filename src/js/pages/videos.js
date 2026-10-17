// 釣り方別の動画（2026-10-17）。山口イカ部のエギングの「釣行のまとめ」から、遊んだ釣り方の見出し（#jado・#yaen・#tailor）へ来る
import { mountChrome, mountFooterBottom, initReveal } from '../main.js';

mountChrome('/videos.html');
mountFooterBottom(document.getElementById('footer-mount'));
initReveal();

// ゲームから来た釣り方（#yaen など）の扉と段を「あなたが遊んだ釣り」として光らせる
const came = location.hash.replace('#', '');
if (came) {
  document.querySelectorAll(`[data-method="${came}"]`).forEach((el) => el.classList.add('is-yours'));
}

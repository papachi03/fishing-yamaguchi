import { mountChrome, mountFooterBottom, initReveal } from '../main.js';
import { mountInstagram } from '../components/instagram.js';

mountChrome('/about.html');
mountFooterBottom(document.getElementById('footer-mount'));

// ABOUTでは最新9件（自動取得時は3列×3段）。全部見たい人はFollowリンクからInstagramへ
mountInstagram(document.getElementById('about-ig'), 9);

initReveal();

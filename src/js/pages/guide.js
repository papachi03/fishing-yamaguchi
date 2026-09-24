import { mountChrome, mountFooterBottom, initReveal } from '../main.js';
import { AMAZON_DISCLOSURE } from '../config/affiliate.js';

// 攻略記事はTACKLEの仲間として、ナビではTACKLEを点灯させる
mountChrome('/tackle.html');
mountFooterBottom(document.getElementById('footer-mount'));
document.getElementById('affiliate-note-top').textContent = AMAZON_DISCLOSURE;
initReveal();

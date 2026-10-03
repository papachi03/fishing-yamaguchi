// イカ部「games」（テストプレイ版のTOP）の入口。🎫と認定証の欄はここに集約
import { boot } from '../boot.js';
import { render } from '../views/games.js';
import { mountTrialNotice } from '../views/trial-notice.js';
import { mountTickets, mountTicketEarn } from '../games/tickets-ui.js';
import { mountCerts } from '../games/certs-ui.js';
import { mountInvite } from '../games/invite-ui.js';
import { mountHomescreen } from '../games/homescreen-ui.js';

const { lang } = boot(render);
mountTrialNotice(lang);
mountInvite(lang);   // 友だち紹介キャンペーン（テストプレイ版だけ・注意書きの直下。2026-10-01 ぱっぱ）
mountTicketEarn({ lang });
mountTickets(document.getElementById('ika-tickets'), { lang });
mountCerts(document.getElementById('ika-certs'), { lang });
// ホーム画面に追加の案内（2026-10-03 ぱっぱ：一番不便と言われている。スマホのブラウザで開いている時だけ）
mountHomescreen(document.querySelector('.ika-invite')?.closest('.wrap') ?? document.querySelector('.ika-trial-note')?.closest('.wrap') ?? document.querySelector('main .wrap'), { lang });

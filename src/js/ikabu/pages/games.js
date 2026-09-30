// イカ部「games」（テストプレイ版のTOP）の入口。🎫と認定証の欄はここに集約
import { boot } from '../boot.js';
import { render } from '../views/games.js';
import { mountTrialNotice } from '../views/trial-notice.js';
import { mountTickets, mountTicketEarn } from '../games/tickets-ui.js';
import { mountCerts } from '../games/certs-ui.js';

const { lang } = boot(render);
mountTrialNotice(lang);
mountTicketEarn({ lang });
mountTickets(document.getElementById('ika-tickets'), { lang });
mountCerts(document.getElementById('ika-certs'), { lang });

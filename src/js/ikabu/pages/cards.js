// イカ部「cards」（バインダー・対戦）の入口。まずは入口だけ
import { boot } from '../boot.js';
import { render } from '../views/cards.js';
import { mountTrialNotice } from '../views/trial-notice.js';
import { mountTicketEarn } from '../games/tickets-ui.js';
import { mountCerts } from '../games/certs-ui.js';

const { lang } = boot(render);
mountTrialNotice(lang);
mountTicketEarn({ lang });
mountCerts(null, { lang });

// イカ部「gacha」（フル画面のガチャ）の入口。本体は games/gacha-page.js
import { boot } from '../boot.js';
import { render } from '../views/gacha.js';
import { mountTrialNotice } from '../views/trial-notice.js';
import { mountHomescreen } from '../games/homescreen-ui.js';
import { mountTicketEarn } from '../games/tickets-ui.js';
import { mountCerts } from '../games/certs-ui.js';

const { lang } = boot(render);
mountTrialNotice(lang);
mountHomescreen(document.querySelector('main .wrap'), { lang, compact: true });   // 📲 ホーム画面に追加の小さな案内（2026-10-03）
mountTicketEarn({ lang });
mountCerts(null, { lang });   // 認定証の判定だけ（欄は無い）
import('../games/gacha-page.js').then((m) => m.mountGachaPage(document.getElementById('ika-gacha'), { lang })).catch((err) => console.error('gacha page', err));

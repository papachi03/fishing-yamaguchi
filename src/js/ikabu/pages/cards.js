// イカ部「cards」（バインダー・対戦）の入口。まずは入口だけ
import { boot } from '../boot.js';
import { render } from '../views/cards.js';
import { mountTrialNotice } from '../views/trial-notice.js';
import { mountHomescreen } from '../games/homescreen-ui.js';
import { mountTicketEarn } from '../games/tickets-ui.js';
import { mountCerts } from '../games/certs-ui.js';

const { lang } = boot(render);
mountTrialNotice(lang);
mountHomescreen(document.querySelector('main .wrap'), { lang, compact: true });   // 📲 ホーム画面に追加の小さな案内（2026-10-03）
mountTicketEarn({ lang });
mountCerts(null, { lang });
// バインダー → 対戦の入口（対戦のボタンはバインダーの中の #ika-battle に置く）
import('../games/binder-ui.js').then((m) => m.mountBinder(document.getElementById('ika-binder'), { lang }))
  .then(() => import('../games/battle-ui.js')).then((m) => m.mountBattle(document.getElementById('ika-battle'), { lang }))
  .then(() => import('../games/story-ui.js')).then((m) => m.mountStoryButton(document.getElementById('ika-battle'), { lang }))   // ストーリーモード（2026-10-03）
  .then(() => import('../games/deck-ui.js')).then((m) => m.mountDeckButton(document.querySelector('[data-deck-open]'), { lang }))
  .catch((err) => console.error('cards', err));

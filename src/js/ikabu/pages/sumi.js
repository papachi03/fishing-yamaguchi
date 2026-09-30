// イカ部「sumi」（墨つなぎだけの専用ページ）の入口。ゲームの結びつけはあそび場と同じ match3-ui.js
import { boot } from '../boot.js';
import { render } from '../views/sumi.js';
import { mountMatch3 } from '../games/match3-ui.js';
import { mountYouTube } from '../yt-facade.js';
import { mountCerts } from '../games/certs-ui.js';
import { mountTicketEarn } from '../games/tickets-ui.js';
import { mountTrialNotice } from '../views/trial-notice.js';

const { lang } = boot(render);
mountTrialNotice(lang);   // テストプレイ版だけ：記録・実績・レベルは正式版でリセットの注意書き
mountYouTube();
mountTicketEarn({ lang });   // チケット🎫の付与（2026-09-30）。欄はTOP（games）にある
mountCerts(null, { lang });   // ゴールド認定証の判定（欄はTOP）   // 遊び方の動画：押したら埋め込みに差し替える（2026-09-29 単体ページで呼び忘れていて、押しても再生されなかった）

const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('gameDemo') : null;
const m3 = mountMatch3(document.getElementById('ika-m3'), { lang, demo: demo?.startsWith('match3:') ? demo.slice(7) : null });
if (import.meta.env.DEV) window.__ikabuGames = { m3 };

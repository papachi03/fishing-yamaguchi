// イカ部「egi」（エギングゲームだけの専用ページ）の入口。ゲームの結びつけはあそび場と同じ egi-ui.js
import { boot } from '../boot.js';
import { render } from '../views/egi.js';
import { mountEgi } from '../games/egi-ui.js';
import { mountYouTube } from '../yt-facade.js';
import { mountCerts } from '../games/certs-ui.js';
import { mountTicketEarn } from '../games/tickets-ui.js';
import { mountTrialNotice } from '../views/trial-notice.js';

const { lang } = boot(render);
mountTrialNotice(lang);   // テストプレイ版だけ：記録・実績・レベルは正式版でリセットの注意書き
mountYouTube();
mountTicketEarn({ lang });   // チケット🎫の付与（2026-09-30）。欄はTOP（games）にある
mountCerts(null, { lang });   // ゴールド認定証の判定（欄はTOP）   // 遊び方の動画：押したら埋め込みに差し替える（2026-09-29 単体ページにも動画を出した）

// 開発時だけ：?gameDemo=egi:fight などで場面を作って止める（あそび場と同じスイッチ）
const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('gameDemo') : null;
const egi = mountEgi(document.getElementById('ika-egi'), { lang, demo: demo?.startsWith('egi:') ? demo.slice(4) : null });
if (import.meta.env.DEV) window.__ikabuGames = { egi };

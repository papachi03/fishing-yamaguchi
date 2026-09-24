// イカ部「egi」（エギングゲームだけの専用ページ）の入口。ゲームの結びつけはあそび場と同じ egi-ui.js
import { boot } from '../boot.js';
import { render } from '../views/egi.js';
import { mountEgi } from '../games/egi-ui.js';

const { lang } = boot(render);

// 開発時だけ：?gameDemo=egi:fight などで場面を作って止める（あそび場と同じスイッチ）
const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('gameDemo') : null;
const egi = mountEgi(document.getElementById('ika-egi'), { lang, demo: demo?.startsWith('egi:') ? demo.slice(4) : null });
if (import.meta.env.DEV) window.__ikabuGames = { egi };

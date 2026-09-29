// イカ部「sumi」（墨つなぎだけの専用ページ）の入口。ゲームの結びつけはあそび場と同じ match3-ui.js
import { boot } from '../boot.js';
import { render } from '../views/sumi.js';
import { mountMatch3 } from '../games/match3-ui.js';

const { lang } = boot(render);

const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('gameDemo') : null;
const m3 = mountMatch3(document.getElementById('ika-m3'), { lang, demo: demo?.startsWith('match3:') ? demo.slice(7) : null });
if (import.meta.env.DEV) window.__ikabuGames = { m3 };

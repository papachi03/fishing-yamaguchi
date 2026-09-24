// イカ部「play」の入口。遊び方・舞台・盤面の枠はビルド時に書き込み済み。ここで2つのゲームを結びつける
import { boot } from '../boot.js';
import { render } from '../views/play.js';
import { mountEgi } from '../games/egi-ui.js';
import { mountMatch3 } from '../games/match3-ui.js';

const { lang } = boot(render);

// 開発時だけのスイッチ（本番ビルドでは無視）。スクリーンショット用に場面を作って止める
//   ?gameDemo=egi:aiming|sinking|signal|fight|landed|snag|over
//   ?gameDemo=match3:chain|ink|over
const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('gameDemo') : null;
const demoOf = (game) => (demo && demo.startsWith(`${game}:`) ? demo.slice(game.length + 1) : null);

const egi = mountEgi(document.getElementById('ika-egi'), { lang, demo: demoOf('egi') });
const m3 = mountMatch3(document.getElementById('ika-m3'), { lang, demo: demoOf('match3') });
// 開発時だけ：自動プレイの検証用に外から触れるようにする
if (import.meta.env.DEV) window.__ikabuGames = { egi, m3 };

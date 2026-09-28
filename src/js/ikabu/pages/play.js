// イカ部「play」の入口。遊び方・舞台・盤面の枠はビルド時に書き込み済み。ここで2つのゲームを結びつける
import { boot } from '../boot.js';
import { render } from '../views/play.js';
import { mountEgi } from '../games/egi-ui.js';
import { mountMatch3 } from '../games/match3-ui.js';
import { mountYouTube } from '../yt-facade.js';

const { lang } = boot(render);
mountYouTube();   // 遊び方の動画：押すまで YouTube を読み込まない

// 開発時だけのスイッチ（本番ビルドでは無視）。スクリーンショット用に場面を作って止める
//   ?gameDemo=egi:aiming|sinking|signal|fight|landed|snag|over
//   ?gameDemo=match3:chain|ink|over
const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('gameDemo') : null;
const demoOf = (game) => (demo && demo.startsWith(`${game}:`) ? demo.slice(game.length + 1) : null);

const egi = mountEgi(document.getElementById('ika-egi'), { lang, demo: demoOf('egi') });
const m3 = mountMatch3(document.getElementById('ika-m3'), { lang, demo: demoOf('match3') });
// 開発時だけ：自動プレイの検証用に外から触れるようにする
if (import.meta.env.DEV) window.__ikabuGames = { egi, m3 };

// シェアの一言のリンク（…/play.html#egi・#sumi）：SNS のアプリ内ブラウザなどで、開いてもゲームの場所へ
// 移動しないことがあるので、読み込み後にもう一度そこへ（ぱっぱ 2026-09-28）。ブラウザがもう移動していたり、
// 見る人が自分でスクロールしていたら（上から50px以上動いていたら）何もしない
const jumpToGame = () => {
  const id = location.hash.slice(1);
  const target = (id === 'egi' || id === 'sumi') && document.getElementById(id);
  if (!target || scrollY > 50 || Math.abs(target.getBoundingClientRect().top) < 40) return;
  target.scrollIntoView({ block: 'start' });
};
if (document.readyState === 'complete') setTimeout(jumpToGame, 0);
else addEventListener('load', () => setTimeout(jumpToGame, 0), { once: true });

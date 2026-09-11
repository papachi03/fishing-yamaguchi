// サイトの配置先（ベースパス）。
// ローカル開発では "/"、GitHub Pages では "/fishing-yamaguchi/" のようにサブフォルダになる。
// データファイル（catches.js 等）は "/assets/..." のようにルート基準で書いてあるので、
// 画面に出す直前に url() を通してベースパスを付ける。
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (p) => (p && p.startsWith('/') ? BASE + p : p);

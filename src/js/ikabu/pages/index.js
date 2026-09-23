// イカ部トップの入口。静的な部分はビルド時に書き込み済み。ここでは掲示板の本物の投稿だけ差し替える
import { boot } from '../boot.js';
import { render, voiceCardHTML, SQUID_IDS } from '../views/index.js';
import { fetchPosts, photoUrl, reportsEnabled } from '../../api/reports.js';
import { bindReportButtons } from '../../components/report-flag.js';

const { lang } = boot(render);

/* ---------- 部員の掲示板：「現地の声」のうちイカだけ。無ければ見本のまま ---------- */

const voices = document.getElementById('ika-voices');

async function loadVoices() {
  if (!voices || !reportsEnabled) return;
  let posts = [];
  try {
    posts = (await fetchPosts({ limit: 50 })).filter((p) => SQUID_IDS.has(p.fish)).slice(0, 6);
  } catch {
    posts = [];
  }
  if (!posts.length) return; // 見本（ビルド時に書き込み済み）を残す
  voices.innerHTML = posts.map((p) => voiceCardHTML(p, lang, { photoUrl })).join('');
  bindReportButtons(voices);
}
loadVoices();

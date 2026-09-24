// イカ部トップの入口。静的な部分はビルド時に書き込み済み。
// ここでは (1) HERO のイラストを動く版に入れ替える、(2) 掲示板の本物の投稿を差し替える
import { boot } from '../boot.js';
import { render, voiceCardHTML, SQUID_IDS } from '../views/index.js';
import { mountHeroAnim } from '../hero-anim.js';
import { fetchPosts, photoUrl, reportsEnabled } from '../../api/reports.js';
import { bindReportButtons } from '../../components/report-flag.js';

const { lang } = boot(render);

/* ---------- 動くHERO：ビルド時の静止 SVG を動かす（レイヤーが読めなければ静止画に切り替える） ---------- */

// 開発時だけのスイッチ（本番ビルドでは無視）。スクリーンショット用
//   ?heroDemo=static        … 動かさない（ビルド時の静止 SVG のまま）
//   ?heroDemo=fallback      … わざと無いレイヤーを読ませ、静止画に切り替わることを確かめる
//   ?heroDemo=phase:<name>  … 物語の場面で止める（bite / hookset / fight / drag / ink / landing）。hooked = phase:hookset
const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('heroDemo') : null;
mountHeroAnim(document.querySelector('.ika-hero-view'), { lang, demo });

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

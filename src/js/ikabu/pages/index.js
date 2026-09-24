// イカ部トップの入口。静的な部分はビルド時に書き込み済み。
// ここでは (1) HERO のイラストを動く版に入れ替える、(2) 掲示板の本物の投稿を差し替える
import { boot } from '../boot.js';
import { render, voiceCardHTML, SQUID_IDS } from '../views/index.js';
import { mountHeroAnim, HERO_ANIM } from '../hero-anim.js';
import { fetchPosts, photoUrl, reportsEnabled } from '../../api/reports.js';
import { bindReportButtons } from '../../components/report-flag.js';

const { lang } = boot(render);

/* ---------- 動くHERO：レイヤーが読めたときだけ静止画と入れ替わる（読めなければ静止画のまま） ---------- */

// 開発時だけのスイッチ（本番ビルドでは無視）
//   ?heroDemo=hooked   … 抱いた姿勢で止める（スクリーンショット用）
//   ?heroDemo=fallback … わざと無いレイヤーを読ませ、静止画のまま残ることを確かめる
const demo = import.meta.env.DEV ? new URLSearchParams(location.search).get('heroDemo') : null;
const missing = Object.fromEntries(Object.entries(HERO_ANIM.layers).map(([k, v]) => [k, v.replace('/hero-layers/', '/hero-layers/_missing/')]));
mountHeroAnim(document.querySelector('.ika-hero-art'), {
  lang,
  demo,
  config: demo === 'fallback' ? { ...HERO_ANIM, layers: missing } : HERO_ANIM,
});

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

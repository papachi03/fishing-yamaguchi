// 山口イカ部 /ikabu/ ：土台（ヘッダー・フッター・投稿の仕組み）はジャーナルと共有し、見た目だけイカ部にする
import { mountChrome, mountFooterBottom, initReveal, url } from '../main.js';
import { vlogs } from '../data/vlogs.js';
import { fetchPosts, photoUrl, reportsEnabled } from '../api/reports.js';
import { reportCardHTML, esc } from '../components/report-card.js';
import { bindReportButtons } from '../components/report-flag.js';

mountChrome('/ikabu/');
mountFooterBottom(document.getElementById('footer-mount'));

/* ---------- 部活動の記録：ジャーナルの動画からイカの回を3本 ---------- */

// ジャーナル本編と同じ素材を、イカ部らしい一言に言い換えて出す
const ACTIVITY = [
  { vlog: 'kouika-present', tag: '大漁', note: '釣れない地域の友達に、10杯まるごとプレゼントした日。' },
  { vlog: 'mongo-dawn', tag: '朝練', note: '糸の走りだけで掛けた。ロッドより先に、目が気づく。' },
  { vlog: 'yariika-cd', tag: '夜練', note: 'CD式の灯火でヤリイカ。寒いけど、部員は行く。' },
];

document.getElementById('activity-cards').innerHTML = ACTIVITY.map(({ vlog, tag, note }) => {
  const v = vlogs.find((x) => x.id === vlog);
  if (!v) return '';
  return `
  <a class="ika-card" href="${url('/journal.html')}#${esc(v.id)}">
    <figure><img src="${url(v.poster)}" alt="" loading="lazy" decoding="async" /></figure>
    <div class="ika-card-body">
      <span class="ika-card-tag">${esc(tag)}</span>
      <h3>${esc(v.species)}${v.duration ? `　<small class="t-mono">${esc(v.duration)}</small>` : ''}</h3>
      <p>${esc(note)}</p>
    </div>
  </a>`;
}).join('');

/* ---------- 部員の掲示板：「現地の声」のうちイカだけ ---------- */

const SQUID = new Set(['aori', 'kensaki', 'yari', 'kouika', 'shiriyake']);

// 本物の投稿がまだ無いときの見本（ラフ案用。正式公開までに消すか、実投稿に置き換える）
const SAMPLES = [
  { id: 's1', name: 'ダディ', spotId: null, fish: 'yari', date: '2026-02-14', comment: '風は弱め。灯火にヤリイカが寄ってきて3杯。寒いけど部活日和。', hasPhoto: false },
  { id: 's2', name: 'イカ部員A', spotId: null, fish: 'kouika', date: '2026-04-02', comment: '昼のコウイカ、エギの色を変えたら急に来ました。詳しい場所は非公開で。', hasPhoto: false },
  { id: 's3', name: 'まぁいっか', spotId: null, fish: 'aori', date: '2026-09-20', comment: '釣れませんでした。でも夕日がよかったので部活成立。', hasPhoto: false },
];

const voices = document.getElementById('ika-voices');

async function loadVoices() {
  let posts = [];
  if (reportsEnabled) {
    try {
      posts = (await fetchPosts({ limit: 50 })).filter((p) => SQUID.has(p.fish)).slice(0, 6);
    } catch {
      posts = [];
    }
  }
  if (posts.length) {
    voices.innerHTML = posts.map((p) => reportCardHTML(p, photoUrl)).join('');
    bindReportButtons(voices);
  } else {
    voices.innerHTML = SAMPLES.map((p) => reportCardHTML(p, photoUrl).replace('class="report-card', 'class="report-card ika-sample')).join('');
    // 見本には「知らせる」ボタンを出さない
    voices.querySelectorAll('.report-flag').forEach((b) => b.remove());
  }
}
loadVoices();

initReveal();

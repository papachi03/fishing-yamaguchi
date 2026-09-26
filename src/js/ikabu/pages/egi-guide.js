// イカ部「egi-guide」（部員おすすめ：新子シーズンのエギ選び）の入口。本文はビルド時に書き込み済み。
// ここでは時間帯の絞り込みと、解説動画を押したときの読み込みだけ
import { boot } from '../boot.js';
import { render } from '../views/egi-guide.js';
import { mountYouTube } from '../yt-facade.js';

boot(render);

const chips = document.getElementById('ika-guide-types');
chips?.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-type]');
  if (!btn) return;
  const k = btn.dataset.type;
  chips.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  document.querySelectorAll('.ika-guide-group').forEach((g) => { g.hidden = k !== 'all' && g.dataset.type !== k; });
});

// 解説動画：押すまで YouTube を読み込まない
mountYouTube();

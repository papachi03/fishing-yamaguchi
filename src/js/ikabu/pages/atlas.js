// イカ部「atlas」の入口。13種はビルド時に書き込み済み。ここでは検索と絞り込み（hidden の付け外し）と件数
import { boot } from '../boot.js';
import { render } from '../views/atlas.js';

boot(render);

const input = document.getElementById('ika-atlas-search');
const filterBox = document.getElementById('ika-atlas-filter');
const list = document.getElementById('ika-atlas-list');
const count = document.getElementById('ika-atlas-count');
const empty = document.getElementById('ika-atlas-empty');
let habitat = 'all';

function apply() {
  const q = (input?.value ?? '').trim().toLowerCase();
  let shown = 0;
  list.querySelectorAll('.ika-atlas-group').forEach((group) => {
    let n = 0;
    group.querySelectorAll('.ika-species').forEach((card) => {
      const ok = (habitat === 'all' || card.dataset.habitat === habitat) && (!q || card.dataset.search.includes(q));
      card.hidden = !ok;
      if (ok) n++;
    });
    group.hidden = n === 0;
    const c = group.querySelector('[data-count]');
    if (c) c.textContent = String(n);
    shown += n;
  });
  const b = count?.querySelector('[data-total]');
  if (b) b.textContent = String(shown);
  if (empty) empty.hidden = shown > 0;
}

input?.addEventListener('input', apply);
filterBox?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ika-chip[data-habitat]');
  if (!btn) return;
  habitat = btn.dataset.habitat;
  filterBox.querySelectorAll('.ika-chip').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  apply();
});

// #sp-aori のように来たら、そのカードを開いておく
const target = location.hash && document.querySelector(`${CSS.escape(location.hash)}.ika-species`);
if (target) target.open = true;

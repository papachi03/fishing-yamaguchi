// イカ部「recipes」（イカ食堂の一覧）の入口。一覧はビルド時に書き込み済み。
// イカの種類ボタンで、カード（data-squid）を出し分ける。#kitchen-aori などで来たら、その種類で絞った状態から
import { boot } from '../boot.js';
import { render } from '../views/recipes.js';

boot(render);

const box = document.getElementById('ika-kitchen-filter');
const cards = [...document.querySelectorAll('#ika-recipe-list .ika-recipe-card')];
const empty = document.getElementById('ika-kitchen-empty');

const applyFilter = (id) => {
  box?.querySelectorAll('button[data-squid-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.squidFilter === id)));
  let shown = 0;
  for (const c of cards) {
    const on = id === 'all' || c.dataset.squid.split(' ').includes(id);
    c.hidden = !on;
    if (on) shown += 1;
  }
  if (empty) empty.hidden = shown > 0;
};

box?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-squid-filter]');
  if (btn) applyFilter(btn.dataset.squidFilter);
});

const fromHash = location.hash.match(/^#kitchen-(\w+)$/)?.[1];
if (fromHash && box?.querySelector(`[data-squid-filter="${fromHash}"]`)) applyFilter(fromHash);

// イカ部「recipe」（1品）の入口。本文はビルド時に書き込み済み（2人分）。
//   (1) 古い recipe.html?id=xxx で来たら、その品の静的ページへ送る
//   (2) 2人分⇔4人分の切り替え（data-qty の元の量から計算して書き換える）
//   (3) 印刷ボタン（印刷用の見た目は ikabu.css の @media print）
import { boot } from '../boot.js';
import { render, recipeById } from '../views/recipe.js';
import { t, recipeHref } from '../i18n.js';
import { scaleQty } from '../recipe-scale.js';

const { lang, recipeId } = boot(render);

if (!recipeId) {
  const id = new URLSearchParams(location.search).get('id');
  if (recipeById(id)) location.replace(recipeHref(id, lang) + location.hash);
}

const servingsBox = document.getElementById('ika-servings');
const list = document.getElementById('ika-ingredient-list');
const label = document.getElementById('ika-serves-label');

servingsBox?.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-servings]');
  if (!btn) return;
  const n = Number(btn.dataset.servings);
  servingsBox.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  list.querySelectorAll('.ika-qty').forEach((el) => {
    el.textContent = `${scaleQty(Number(el.dataset.qty), n)} ${el.dataset.unit}`;
  });
  if (label) label.textContent = t(lang, `${n}人分`, `${n} servings`);
});

document.getElementById('ika-print')?.addEventListener('click', () => window.print());

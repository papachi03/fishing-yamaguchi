import { mountChrome, mountFooterBottom, initReveal, fmtDateDot, url } from '../main.js';
import { catches } from '../data/catches.js';

mountChrome('/log.html');
mountFooterBottom(document.getElementById('footer-mount'));

const list = document.getElementById('log-list');
const filters = document.getElementById('log-filters');

const species = ['すべて', ...new Set(catches.map((c) => c.species))];
let active = 'すべて';

filters.innerHTML = species
  .map((s) => `<button data-s="${s}" class="${s === active ? 'active' : ''}">${s}</button>`)
  .join('');

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-s]');
  if (!btn) return;
  active = btn.dataset.s;
  filters.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.s === active));
  render();
});

function render() {
  const items = active === 'すべて' ? catches : catches.filter((c) => c.species === active);
  list.innerHTML = items
    .map((c) => {
      const bits = [fmtDateDot(c.date), c.method, c.time].filter(Boolean).join(' / ');
      return `
      <article class="log-item reveal" id="${c.id}">
        <figure>
          ${c.weight ? `<span class="log-weight-tag t-mono">${c.weight}</span>` : ''}
          <img src="${url(c.image)}" alt="${c.species}${c.weight ? ' ' + c.weight : ''}" loading="lazy" decoding="async" />
        </figure>
        <div class="log-cap">
          <span class="species">${c.species}</span>
          <span class="data t-mono">${bits || '&nbsp;'}</span>
        </div>
        ${c.description ? `<p class="log-desc">${c.description}</p>` : ''}
      </article>`;
    })
    .join('');
  initReveal();
}

render();

if (location.hash) {
  const target = document.querySelector(location.hash);
  if (target) setTimeout(() => target.scrollIntoView({ block: 'center' }), 60);
}

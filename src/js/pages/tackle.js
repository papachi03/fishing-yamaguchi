import { mountChrome, mountFooterBottom, initReveal } from '../main.js';
import { tackle, tackleCategories, tackleByCategory } from '../data/tackle.js';
import { AMAZON_DISCLOSURE } from '../config/affiliate.js';
import { tackleCardHTML } from '../components/tackle-card.js';

mountChrome('/tackle.html');
mountFooterBottom(document.getElementById('footer-mount'));

const root = document.getElementById('tackle-root');
const tabs = document.getElementById('tackle-tabs');
document.getElementById('affiliate-note-top').textContent = AMAZON_DISCLOSURE;

const TYPE_LABEL = { rod: 'ROD', reel: 'REEL', lure: 'LURE', line: 'LINE', gear: 'GEAR' };
const validIds = tackleCategories.map((c) => c.id);
let current = validIds.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'eging';

tabs.innerHTML = tackleCategories
  .map(
    (c) => `<button role="tab" data-cat="${c.id}" aria-selected="${c.id === current}"
      class="${c.id === current ? 'active' : ''}">${c.en}<small>${c.ja}</small></button>`
  )
  .join('');

tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-cat]');
  if (!btn) return;
  current = btn.dataset.cat;
  history.replaceState(null, '', `#${current}`);
  tabs.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.cat === current;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  render();
});

function render() {
  const cat = tackleCategories.find((c) => c.id === current);
  const items = tackleByCategory(current);
  const owned = items.filter((t) => t.owned);
  const picks = items.filter((t) => !t.owned);

  const group = (title, sub, list) =>
    list.length
      ? `
      <div class="tackle-group reveal">
        <div class="tackle-group-head">
          <h3 class="t-display">${title}</h3>
          <p>${sub}</p>
        </div>
        <div class="tackle-grid">${list.map((t) => tackleCardHTML(t, TYPE_LABEL)).join('')}</div>
      </div>`
      : '';

  root.innerHTML = `
    <div class="tackle-lead reveal">
      <p class="en t-display">${cat.en}</p>
      <p class="ja">${cat.lead}</p>
    </div>
    ${group('In My Bag', 'ダディが実際に使っているもの。動画や写真に写っている道具だけを載せています。', owned)}
    ${group('Standard Picks', 'これから揃えるなら、の定番。価格や在庫は各ストアのページで確認してください。', picks)}
  `;
  initReveal();
}

render();

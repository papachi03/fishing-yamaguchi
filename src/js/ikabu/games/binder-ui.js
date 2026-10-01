// バインダーの画面（2026-09-30）。ガチャで引いたカードを120枚の枠に並べる。
//   ・持っていない枠は裏面を暗くして「？」。持っている枠は表の絵＋右下に枚数（×2 など）
//   ・上に「集めた率」（全体とレア度ごと）・かけら・🎫。並べ替え（番号／レア度／名前／タイプ）と絞り込み（タイプ・レア度・所持）
//   ・タップで大きく（名前・効果・コスト・攻防・枚数）。ダブりの「墨のかけら」で交換（gacha.js の exchange）
import { t, esc, pageHref, assetHref } from '../i18n.js';
import CARDS from './cards-data.json';
import { readCards, writeCards, exchange, progress, SHARD_COST, RARITY_ORDER } from './gacha.js';
import { readTickets } from './tickets.js';
import { arrange, counts, SORTS, KIND_ORDER, KIND_LABEL } from './binder.js';
import { readJSON, writeJSON } from './records.js';
import { tierOf } from './gacha-show.js';
import { makeShareImage, shareBlob } from './binder-share.js';
import { isSecret, fesOf, limitLabel, fesPeriod } from './fes.js';

const KEY_VIEW = 'ikabu.binder.view';
const TX = {
  sort: { no: ['番号順', 'By number'], rarity: ['レア度順', 'By rarity'], name: ['名前順', 'By name'], kind: ['タイプ順', 'By type'] },
  all: ['すべて', 'All'], have: ['持っている', 'Owned'], missing: ['まだ', 'Missing'],
  collected: (lang, k, all) => (lang === 'en' ? `${k} / ${all} collected` : `${k} / ${all} 種類`),
  total: (lang, n) => (lang === 'en' ? `${n} cards in total` : `合計 ${n} 枚`),
  shards: ['墨のかけら', 'Ink shards'],
  gacha: ['ガチャへ', 'To the gacha'],
  top: ['← あそび場TOPへ', '← Back to TOP'],
  close: ['閉じる', 'Close'],
  share: ['📣 バインダーをシェア', '📣 Share my binder'],
  shareBusy: ['画像を作っています…', 'Making the image…'],
  shareDone: ['シェアしました！', 'Shared!'],
  shareSaved: ['画像を保存しました。SNSに貼ってください', 'Image saved. Post it anywhere you like'],
  shareNone: ['カードを1枚でも引くとシェアできます', 'Pull at least one card to share'],
  shareFail: ['画像を作れませんでした。もう一度お試しください', 'Could not make the image. Please try again'],
  owned: (lang, n) => (n > 0 ? (lang === 'en' ? `Owned ×${n}` : `所持 ×${n}`) : lang === 'en' ? 'Not yet' : 'まだ持っていない'),
  cost: ['コスト', 'Cost'], atk: ['攻', 'ATK'], def: ['防', 'DEF'],
  exchange: (lang, c) => (lang === 'en' ? `Exchange (${c} shards)` : `かけら ${c} 個で交換`),
  exchanged: ['交換しました！', 'Exchanged!'],
  notEnough: ['かけらが足りません', 'Not enough shards'],
  empty: ['まだカードがありません。ガチャで引いてみよう。', 'No cards yet. Try the gacha.'],
  hint: ['タップで大きく見る', 'Tap a card to enlarge'],
};
const rarityImg = (r) => `<img class="ika-bd-rimg" src="${assetHref(`/assets/ikabu/gacha/rarity_${tierOf(r)}.webp`)}" alt="${r}" decoding="async" />`;
const cardSrc = (no, small = false) => assetHref(`/assets/ikabu/cards/card_${String(no).padStart(3, '0')}${small ? '_240' : ''}.webp`);

export function mountBinder(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const view = { sort: 'no', kind: 'all', rarity: 'all', have: 'all', ...(readJSON(KEY_VIEW) ?? {}) };
  if (!SORTS.includes(view.sort)) view.sort = 'no';
  const seg = (name, items, cur) => `<div class="ika-bd-seg" role="group" data-seg="${name}">${items.map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${String(v === cur)}">${label}</button>`).join('')}</div>`;
  if (!document.getElementById('ika-gc-fonts')) {   // ガチャと同じ書体（明朝・デザイン書体）
    const l = document.createElement('link'); l.id = 'ika-gc-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Kaisei+Tokumin:wght@800&family=Shippori+Mincho+B1:wght@700;800&display=swap';
    document.head.appendChild(l);
  }
  root.innerHTML = `
    <div class="ika-bd-head">
      <div class="ika-bd-stats" data-bd-stats></div>
      <div class="ika-bd-links">
        <div id="ika-battle"></div>
        <a class="ika-gc-imgbtn" href="${pageHref('gacha', lang)}"><img src="${assetHref('/assets/ikabu/gacha/btn_gacha.webp')}" alt="${t(lang, ...TX.gacha)}" width="964" height="170" /></a>
        <button type="button" class="ika-gc-imgbtn" data-deck-open><img src="${assetHref('/assets/ikabu/gacha/btn_deck.webp')}" alt="${t(lang, 'デッキ編成', 'Deck builder')}" width="964" height="170" /></button>
        <button type="button" class="ika-btn ika-bd-share" data-bd-share>${t(lang, ...TX.share)}</button>
        <p class="ika-bd-share-msg" data-bd-share-msg role="status" aria-live="polite"></p>
      </div>
    </div>
    <div class="ika-bd-controls">
      ${seg('sort', SORTS.map((s) => [s, t(lang, ...TX.sort[s])]), view.sort)}
      ${seg('kind', [['all', t(lang, ...TX.all)], ...KIND_ORDER.map((k) => [k, t(lang, ...KIND_LABEL[k])])], view.kind)}
      ${seg('rarity', [['all', t(lang, ...TX.all)], ...RARITY_ORDER.map((r) => [r, r])], view.rarity)}
      ${seg('have', [['all', t(lang, ...TX.all)], ['have', t(lang, ...TX.have)], ['missing', t(lang, ...TX.missing)]], view.have)}
    </div>
    <p class="ika-bd-hint">${t(lang, ...TX.hint)}</p>
    <div class="ika-bd-grid" data-bd-grid></div>
    <div class="ika-bd-modal" data-bd-modal hidden>
      <div class="ika-bd-modal-in" role="dialog" aria-modal="true">
        <button type="button" class="ika-bd-close" data-bd-close aria-label="${t(lang, ...TX.close)}">×</button>
        <div class="ika-bd-modal-body" data-bd-body></div>
      </div>
    </div>`;
  const el = { stats: root.querySelector('[data-bd-stats]'), grid: root.querySelector('[data-bd-grid]'), modal: root.querySelector('[data-bd-modal]'), body: root.querySelector('[data-bd-body]') };

  function renderStats(rec) {
    const p = progress(rec, CARDS);
    const c = counts(CARDS, rec.owned);
    el.stats.innerHTML = `
      <p class="ika-bd-total"><b>${p.have}<small>/ ${p.all}</small></b><span>${t(lang, '種類を集めた', 'kinds collected')} ・ ${TX.total(lang, c.total)}</span></p>
      <ul class="ika-bd-byrarity">${RARITY_ORDER.map((r) => { const h = p.rarity[r]?.have ?? 0, a = p.rarity[r]?.all ?? 1; return `<li data-r="${r}">${rarityImg(r, 'ika-bd-rlogo')}<i class="ika-bd-bar" data-tier="${tierOf(r)}"><b style="width:${Math.round((h / a) * 100)}%"></b></i><span>${h}/${a}</span></li>`; }).join('')}</ul>
      <p class="ika-bd-wallet"><span>🎫 ${readTickets().n}</span><span>🖤 ${t(lang, ...TX.shards)} ${rec.shards}</span></p>`;
  }
  function renderGrid(rec) {
    const list = arrange(CARDS, rec.owned, view);
    if (!list.length) { el.grid.innerHTML = `<p class="ika-bd-empty">${t(lang, ...TX.empty)}</p>`; return; }
    el.grid.innerHTML = list.map((c) => {
      const n = rec.owned[c.no] ?? 0;
      const hidden = isSecret(c) && !n;   // シークレットは持つまで名前も出さない（どこで出るかは書かない）
      const lim = limitLabel(c, lang, { short: true });   // 格子では短い帯（長いと切れる）
      return `<button type="button" class="ika-bd-card${n ? '' : ' is-missing'}${c.limit ? ' is-limited' : ''}" data-no="${c.no}" data-tier="${tierOf(c.rarity)}" aria-label="${hidden ? '？？？' : esc(c.name)}${n ? ` ×${n}` : ''}">
        <img src="${n ? cardSrc(c.no, true) : assetHref('/assets/ikabu/cards/card_back.webp')}" alt="" width="240" height="360" loading="lazy" decoding="async" />
        ${n ? `<i class="ika-bd-n">×${n}</i>` : '<i class="ika-bd-q">?</i>'}
        ${lim ? `<i class="ika-bd-lim">${esc(lim)}</i>` : ''}
        <span class="ika-bd-no">${String(c.no).padStart(3, '0')}</span>
      </button>`;
    }).join('');
  }
  function render() { const rec = readCards(); renderStats(rec); renderGrid(rec); }
  render();

  root.querySelectorAll('.ika-bd-seg').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    view[g.dataset.seg] = b.dataset.v;
    g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    writeJSON(KEY_VIEW, view);
    renderGrid(readCards());
  }));

  // 大きく見る
  function openCard(no) {
    const c = CARDS.find((x) => x.no === no); if (!c) return;
    const rec = readCards(); const n = rec.owned[no] ?? 0;
    const cost = SHARD_COST[c.rarity];
    el.body.innerHTML = `
      <div class="ika-bd-big" data-tier="${tierOf(c.rarity)}"><img src="${n ? cardSrc(no) : assetHref('/assets/ikabu/cards/card_back.webp')}" alt="${esc(c.name)}" width="600" height="900" decoding="async" /></div>
      <div class="ika-bd-info">
        <p class="ika-bd-info-top">${rarityImg(c.rarity)}<span class="ika-bd-kind">${t(lang, ...KIND_LABEL[c.kind])}</span><span class="ika-bd-owned">${TX.owned(lang, n)}</span></p>
        <h2>${n || !isSecret(c) ? esc(c.name) : '？？？'}</h2>
        ${fesOf(c) ? `<p class="ika-bd-limnote">${esc(limitLabel(c, lang))}（${fesPeriod(fesOf(c), lang)}）</p>` : ''}
        ${!n && isSecret(c) ? `<p class="ika-bd-limnote">${t(lang, 'どこかで出会えるかも……', 'You might run into it somewhere…')}</p>` : ''}
        ${n ? `<p class="ika-bd-effect">${esc(c.effect)}</p>
        <p class="ika-bd-nums"><span>${t(lang, ...TX.cost)} ${c.cost}</span>${c.atk != null ? `<span>${t(lang, ...TX.atk)} ${c.atk}</span>` : ''}${c.def != null ? `<span>${t(lang, ...TX.def)} ${c.def}</span>` : ''}</p>` : ''}
        <p class="ika-bd-actions"><button type="button" class="ika-btn" data-bd-exchange="${no}" ${rec.shards < cost ? 'aria-disabled="true"' : ''}>${TX.exchange(lang, cost)}</button><span class="ika-bd-msg" data-bd-msg></span></p>
      </div>`;
    el.modal.hidden = false;
    el.body.querySelector('[data-bd-exchange]').addEventListener('click', (ev) => {
      const r = exchange(readCards(), c);
      const msg = el.body.querySelector('[data-bd-msg]');
      if (!r.ok) { msg.textContent = t(lang, ...TX.notEnough); return; }
      writeCards(r.rec); render(); openCard(no);
      el.body.querySelector('[data-bd-msg]').textContent = t(lang, ...TX.exchanged);
      ev.currentTarget.blur();
    });
  }
  el.grid.addEventListener('click', (e) => { const b = e.target.closest('.ika-bd-card'); if (b) openCard(Number(b.dataset.no)); });
  const close = () => { el.modal.hidden = true; };
  root.querySelector('[data-bd-close]').addEventListener('click', close);
  // シェア（2026-10-01）：持っているカードの画像を作って共有画面へ
  const shareBtn = root.querySelector('[data-bd-share]'), shareMsg = root.querySelector('[data-bd-share-msg]');
  let sharing = false;
  shareBtn.addEventListener('click', async () => {
    if (sharing) return;
    const rec = readCards();
    if (!Object.values(rec.owned ?? {}).some((n) => n > 0)) { shareMsg.textContent = t(lang, ...TX.shareNone); return; }
    sharing = true; shareBtn.disabled = true; shareMsg.textContent = t(lang, ...TX.shareBusy);
    try {
      const blob = await makeShareImage({ cards: CARDS, owned: rec.owned, lang, assetHref });
      const r = await shareBlob(blob, lang);
      shareMsg.textContent = r === 'shared' ? t(lang, ...TX.shareDone) : r === 'saved' ? t(lang, ...TX.shareSaved) : '';
    } catch (e) {
      console.warn('binder share failed', e);
      shareMsg.textContent = t(lang, ...TX.shareFail);
    } finally { sharing = false; shareBtn.disabled = false; }
  });
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.modal.hidden) close(); });
  addEventListener('storage', render);
  return { render };
}

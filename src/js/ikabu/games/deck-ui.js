// デッキ編成の画面（2026-10-01）。仕組みは deck.js・検査は battle.js の checkDeck
//   上：枚数と種類の内訳（決まりの幅・外れていると赤）と「保存」「スターターに戻す」「閉じる」
//   中：いまのデッキ（タップで1枚外す）／下：使えるカード（タップで1枚入れる。持っていないカードは薄い）
import { t, esc, assetHref } from '../i18n.js';
import CARDS from './cards-data.json';
import { readCards } from './gacha.js';
import { readJSON, writeJSON } from './records.js';
import { starterDeck, DECK_RULE } from './battle.js';
import { KEY_DECK, DECK_SLOTS, normalizeStore, availableCopies, addCard, removeCard, summary, recommendDeck } from './deck.js';
import { KIND_ORDER, KIND_LABEL } from './binder.js';
import { tierOf } from './gacha-show.js';

const cardSrc = (no) => assetHref(`/assets/ikabu/cards/card_${String(no).padStart(3, '0')}_240.webp`);
const TX = {
  title: ['デッキ編成', 'Deck builder'],
  save: ['保存', 'Save'], reset: ['スターターに戻す', 'Reset to starter'], close: ['閉じる', 'Close'],
  recommend: ['おすすめ編成', 'Auto build'],
  clear: ['全部外す', 'Clear all'],
  recommended: (lang, mark) => (lang === 'en' ? `Auto-built from your cards${mark ? ` (main mark: ${mark})` : ''}. Save if you like it` : `持っているカードで組みました${mark ? `（主のマーク：${mark}）` : ''}。気に入ったら保存してください`),
  marks: { anchor: ['いかり', 'anchor'], sun: ['太陽', 'sun'], wave: ['波', 'wave'], star: ['星', 'star'], shell: ['貝', 'shell'] },
  saved: ['保存しました', 'Saved'], use: ['このデッキを使う', 'Use this deck'], using: ['使用中', 'In use'], unsaved: ['保存していない変更があります', 'Unsaved changes'],
  deck: ['いまのデッキ', 'Your deck'], pool: ['使えるカード', 'Available cards'],
  poolNote: ['スターターの30枚は全員が持っています。ガチャで引いた分も使えます（同じカードは2枚まで）', 'Everyone has the 30 starter cards. Cards from the gacha can be added too (max 2 copies).'],
  tapRemove: ['タップで1枚外す', 'Tap to remove one'], tapAdd: ['タップのたびに 0→1→2枚と増え、上限に着いたら 2→1→0 と減る', 'Each tap adds a copy up to the limit, then removes one at a time'],
  why: { full: ['30枚でいっぱいです', 'Deck is full (30)'], copies: ['同じカードは2枚までです', 'Max 2 copies'], none: ['そのカードは持っていません', "You don't own that card"], SSR: ['SSRは2枚までです', 'Max 2 SSR'], UR: ['URは1枚までです', 'Max 1 UR'] },
  all: ['すべて', 'All'],
  kind: { squid: ['イカ', 'Squid'], tech: ['テクニック', 'Technique'], trap: ['トラップ', 'Trap'] },
  noEffect: ['特技なし', 'No ability'], atk: ['攻撃', 'ATK'], def: ['防御', 'DEF'], close: ['閉じる', 'Close'], cost: ['潮', 'Tide'],
};
// カードの詳細（潮・レア度・タイプ・攻防・効果の全文）。2026-10-01 ぱっぱ「編成の時に読めないのは不便」
const infoBtn = (c, lang) => `<button type="button" class="ika-dk-info" data-info="${c.no}" aria-label="${t(lang, '詳しく', 'Details')}">i</button>`;
const costBadge = (c) => `<i class="ika-dk-cost">${c.cost}</i>`;

export function mountDeckButton(btn, { lang = 'ja' } = {}) {
  if (!btn) return;
  btn.addEventListener('click', () => openDeck({ lang }));
}

export function openDeck({ lang = 'ja' } = {}) {
  const starter = starterDeck(CARDS);
  const owned = readCards().owned ?? {};
  const avail = availableCopies(owned, starter);
  let store = normalizeStore(readJSON(KEY_DECK), starter);
  let cur = store.active;
  let deck = store.slots[cur].nos.slice();
  let kind = 'all';
  const ov = document.createElement('div');
  ov.className = 'ika-dk';
  ov.innerHTML = `
    <div class="ika-dk-in">
      <div class="ika-dk-head">
        <h2>${t(lang, ...TX.title)}</h2>
        <div class="ika-dk-slots" data-dk-slots></div>
        <div class="ika-dk-sum" data-dk-sum></div>
        <p class="ika-dk-errors" data-dk-errors></p>
        <div class="ika-dk-btns"><button type="button" class="ika-btn ika-btn--primary" data-dk-save>${t(lang, ...TX.save)}</button><button type="button" class="ika-btn" data-dk-use>${t(lang, ...TX.use)}</button><button type="button" class="ika-btn" data-dk-recommend>${t(lang, ...TX.recommend)}</button><button type="button" class="ika-btn" data-dk-reset>${t(lang, ...TX.reset)}</button><button type="button" class="ika-btn" data-dk-clear>${t(lang, ...TX.clear)}</button><button type="button" class="ika-btn" data-dk-close>${t(lang, ...TX.close)}</button></div>
        <p class="ika-dk-msg" data-dk-msg role="status"></p>
      </div>
      <h3>${t(lang, ...TX.deck)} <small>${t(lang, ...TX.tapRemove)}</small></h3>
      <div class="ika-dk-deck" data-dk-deck></div>
      <h3>${t(lang, ...TX.pool)} <small>${t(lang, ...TX.tapAdd)}</small></h3>
      <p class="ika-dk-note">${t(lang, ...TX.poolNote)}</p>
      <p class="ika-dk-avail" data-dk-avail></p>
      <div class="ika-bd-seg" data-dk-kind>${[['all', t(lang, ...TX.all)], ...KIND_ORDER.map((k) => [k, t(lang, ...KIND_LABEL[k])])].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v === 'all')}">${l}${v === 'all' ? '' : ` <small>${CARDS.filter((c) => c.kind === v && (avail[c.no] ?? 0) > 0).length}</small>`}</button>`).join('')}</div>
      <div class="ika-dk-pool" data-dk-pool></div>
    </div>`;
  document.body.appendChild(ov);
  document.documentElement.classList.add('is-deck');
  const $ = (s) => ov.querySelector(s);
  const el = { slots: $('[data-dk-slots]'), use: $('[data-dk-use]'), sum: $('[data-dk-sum]'), errors: $('[data-dk-errors]'), deck: $('[data-dk-deck]'), pool: $('[data-dk-pool]'), msg: $('[data-dk-msg]'), save: $('[data-dk-save]') };
  let msgTimer = 0;
  const say = (text, ok = false) => { el.msg.textContent = text; el.msg.classList.toggle('is-ok', ok); clearTimeout(msgTimer); msgTimer = setTimeout(() => { el.msg.textContent = ''; }, 2400); };
  const byNo = new Map(CARDS.map((c) => [c.no, c]));
  const count = (no) => deck.filter((n) => n === no).length;

  const dirty = () => JSON.stringify(deck) !== JSON.stringify(store.slots[cur].nos);
  function renderSlots() {
    el.slots.innerHTML = store.slots.map((s, i) => `<button type="button" data-slot="${i}" aria-pressed="${String(i === cur)}">${esc(s.name)}${i === store.active ? `<i>${t(lang, ...TX.using)}</i>` : ''}</button>`).join('');
    el.use.disabled = cur === store.active;
    el.use.textContent = cur === store.active ? t(lang, ...TX.using) : t(lang, ...TX.use);
  }
  function renderAvail() {
    const parts = KIND_ORDER.map((k) => { const cs = CARDS.filter((c) => c.kind === k && (avail[c.no] ?? 0) > 0); const copies = cs.reduce((s, c) => s + (avail[c.no] ?? 0), 0); const used = deck.filter((n) => byNo.get(n)?.kind === k).length; return `<span><b>${t(lang, ...KIND_LABEL[k])}</b> ${cs.length}${t(lang, '種', ' kinds')}・${copies}${t(lang, '枚', ' copies')}<small>（${t(lang, '入れた', 'in deck')} ${used}）</small></span>`; });
    $('[data-dk-avail]').innerHTML = parts.join('');
  }
  function render() {
    renderSlots(); renderAvail();
    const s = summary(deck, CARDS);
    const bad = (k) => s[k] < DECK_RULE[k][0] || s[k] > DECK_RULE[k][1];
    el.sum.innerHTML = `<b class="${s.total === 30 ? '' : 'is-bad'}">${s.total}<small>/30</small></b>${KIND_ORDER.map((k) => `<span class="${bad(k) ? 'is-bad' : ''}">${t(lang, ...KIND_LABEL[k])} ${s[k]}<small>（${DECK_RULE[k][0]}〜${DECK_RULE[k][1]}）</small></span>`).join('')}`;
    el.errors.textContent = s.check.ok ? '' : s.check.errors.join('　');
    el.save.disabled = !s.check.ok;
    // いまのデッキ：種類→番号順にまとめて
    const uniq = [...new Set(deck)].map((n) => byNo.get(n)).filter(Boolean).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.no - b.no);
    el.deck.innerHTML = uniq.map((c) => `<div class="ika-dk-poolcell"><button type="button" class="ika-dk-card" data-no="${c.no}" data-tier="${tierOf(c.rarity)}" aria-label="${esc(c.name)} ×${count(c.no)}"><img src="${cardSrc(c.no)}" alt="" width="240" height="360" loading="lazy" />${costBadge(c)}<i>×${count(c.no)}</i></button>${infoBtn(c, lang)}</div>`).join('') || `<p class="ika-dk-note">—</p>`;
    // 使えるカード
    const pool = CARDS.filter((c) => (kind === 'all' || c.kind === kind)).sort((a, b) => ((avail[b.no] ?? 0) > 0) - ((avail[a.no] ?? 0) > 0) || a.no - b.no);
    el.pool.innerHTML = pool.map((c) => { const a = avail[c.no] ?? 0, h = count(c.no); return `<div class="ika-dk-poolcell"><button type="button" class="ika-dk-card${a ? '' : ' is-none'}${h > 0 ? ' is-in' : ''}" data-no="${c.no}" data-tier="${tierOf(c.rarity)}" aria-label="${esc(c.name)}"><img src="${cardSrc(c.no)}" alt="" width="240" height="360" loading="lazy" />${costBadge(c)}<i>${h}/${a}</i></button>${infoBtn(c, lang)}</div>`; }).join('');
  }
  const modal = document.createElement('div'); modal.className = 'ika-bd-modal'; modal.hidden = true;
  modal.innerHTML = `<div class="ika-bd-modal-in" role="dialog" aria-modal="true"><button type="button" class="ika-bd-close" data-close aria-label="${t(lang, ...TX.close)}">×</button><div data-body></div></div>`;
  ov.appendChild(modal);
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) modal.hidden = true; });
  function showInfo(no) {
    const c = byNo.get(no); if (!c) return;
    const stats = c.kind === 'squid' ? `<p class="ika-bt-sheet-stats"><span class="is-atk">${t(lang, ...TX.atk)} ${c.atk}</span><span class="is-def">${t(lang, ...TX.def)} ${c.def}</span></p>` : '';
    modal.querySelector('[data-body]').innerHTML = `<div class="ika-bd-big" data-tier="${tierOf(c.rarity)}"><img src="${assetHref(`/assets/ikabu/cards/card_${String(c.no).padStart(3, '0')}.webp`)}" alt="${esc(c.name)}" width="600" height="900" decoding="async" /></div>
      <div class="ika-bd-info"><p class="ika-bd-info-top"><img class="ika-bd-rimg" src="${assetHref(`/assets/ikabu/gacha/rarity_${tierOf(c.rarity)}.webp`)}" alt="${c.rarity}" /><span>${t(lang, ...TX.kind[c.kind])}</span><span>🌊 ${t(lang, ...TX.cost)} ${c.cost}</span><span>${t(lang, '入れている', 'In deck')} ${count(c.no)}／${avail[c.no] ?? 0}</span></p><h2>${esc(c.name)}</h2>${stats}<p class="ika-bd-effect">${c.effect ? esc(c.effect) : t(lang, ...TX.noEffect)}</p></div>`;
    modal.hidden = false;
  }
  ov.addEventListener('click', (e) => { const i = e.target.closest('[data-info]'); if (i) { e.stopPropagation(); showInfo(Number(i.dataset.info)); } }, true);
  el.deck.addEventListener('click', (e) => { if (e.target.closest('[data-info]')) return; const b = e.target.closest('[data-no]'); if (!b) return; deck = removeCard(deck, Number(b.dataset.no)); render(); });
  const dir = new Map();   // カードごとの向き：'up'（増やす）／'down'（減らす）
  el.pool.addEventListener('click', (e) => {
    if (e.target.closest('[data-info]')) return;
    const b = e.target.closest('[data-no]'); if (!b) return;
    const no = Number(b.dataset.no);
    const h = count(no), a = avail[no] ?? 0;
    let d = dir.get(no) ?? 'up';
    if (h === 0) d = 'up';
    if (h >= a && a > 0) d = 'down';
    if (d === 'down') { deck = removeCard(deck, no); if (count(no) === 0) dir.set(no, 'up'); else dir.set(no, 'down'); render(); return; }
    const r = addCard(deck, no, avail, CARDS);
    if (!r.ok) { if (r.why === 'full' && h > 0) { deck = removeCard(deck, no); dir.set(no, 'down'); render(); return; } say(t(lang, ...TX.why[r.why])); return; }
    deck = r.deck; dir.set(no, count(no) >= a ? 'down' : 'up'); render();
  });
  $('[data-dk-kind]').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; kind = b.dataset.v; $('[data-dk-kind]').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); });
  $('[data-dk-reset]').addEventListener('click', () => { deck = starter.slice(); render(); });
  $('[data-dk-clear]').addEventListener('click', () => { deck = []; render(); });   // 何も選んでいない状態に（2026-10-01 ぱっぱ）
  $('[data-dk-recommend]').addEventListener('click', () => { const r = recommendDeck(CARDS, avail); deck = r.deck; render(); say(TX.recommended(lang, r.mainMark ? t(lang, ...(TX.marks[r.mainMark] ?? [r.mainMark, r.mainMark])) : null), true); });
  const persist = () => writeJSON(KEY_DECK, store);
  el.save.addEventListener('click', () => { const s = summary(deck, CARDS); if (!s.check.ok) return; store.slots[cur].nos = deck.slice(); persist(); say(t(lang, ...TX.saved), true); render(); });
  el.use.addEventListener('click', () => { if (dirty() && !summary(deck, CARDS).check.ok) { say(t(lang, ...TX.unsaved)); return; } if (dirty()) { store.slots[cur].nos = deck.slice(); } store.active = cur; persist(); say(t(lang, ...TX.saved), true); render(); });
  el.slots.addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (!b) return; if (dirty()) { say(t(lang, ...TX.unsaved)); if (!confirm(t(lang, '保存していない変更を捨てて切り替えますか？', 'Discard unsaved changes and switch?'))) return; } cur = Number(b.dataset.slot); deck = store.slots[cur].nos.slice(); render(); });
  const close = () => { ov.remove(); document.documentElement.classList.remove('is-deck'); };
  $('[data-dk-close]').addEventListener('click', close);
  render();
  return { close };
}

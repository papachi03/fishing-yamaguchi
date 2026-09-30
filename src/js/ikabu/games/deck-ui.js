// デッキ編成の画面（2026-10-01）。仕組みは deck.js・検査は battle.js の checkDeck
//   上：枚数と種類の内訳（決まりの幅・外れていると赤）と「保存」「スターターに戻す」「閉じる」
//   中：いまのデッキ（タップで1枚外す）／下：使えるカード（タップで1枚入れる。持っていないカードは薄い）
import { t, esc, assetHref } from '../i18n.js';
import CARDS from './cards-data.json';
import { readCards } from './gacha.js';
import { readJSON, writeJSON } from './records.js';
import { starterDeck, DECK_RULE } from './battle.js';
import { KEY_DECK, availableCopies, addCard, removeCard, summary } from './deck.js';
import { KIND_ORDER, KIND_LABEL } from './binder.js';
import { tierOf } from './gacha-show.js';

const cardSrc = (no) => assetHref(`/assets/ikabu/cards/card_${String(no).padStart(3, '0')}_240.webp`);
const TX = {
  title: ['デッキ編成', 'Deck builder'],
  save: ['保存', 'Save'], reset: ['スターターに戻す', 'Reset to starter'], close: ['閉じる', 'Close'],
  saved: ['保存しました。次の対戦から使います', 'Saved. Used from the next battle'],
  deck: ['いまのデッキ', 'Your deck'], pool: ['使えるカード', 'Available cards'],
  poolNote: ['スターターの30枚は全員が持っています。ガチャで引いた分も使えます（同じカードは2枚まで）', 'Everyone has the 30 starter cards. Cards from the gacha can be added too (max 2 copies).'],
  tapRemove: ['タップで1枚外す', 'Tap to remove one'], tapAdd: ['タップで1枚入れる', 'Tap to add one'],
  why: { full: ['30枚でいっぱいです', 'Deck is full (30)'], copies: ['同じカードは2枚までです', 'Max 2 copies'], none: ['そのカードは持っていません', "You don't own that card"], SSR: ['SSRは2枚までです', 'Max 2 SSR'], UR: ['URは1枚までです', 'Max 1 UR'] },
  all: ['すべて', 'All'],
};

export function mountDeckButton(btn, { lang = 'ja' } = {}) {
  if (!btn) return;
  btn.addEventListener('click', () => openDeck({ lang }));
}

export function openDeck({ lang = 'ja' } = {}) {
  const starter = starterDeck(CARDS);
  const owned = readCards().owned ?? {};
  const avail = availableCopies(owned, starter);
  let deck = (readJSON(KEY_DECK)?.nos ?? starter).slice();
  let kind = 'all';
  const ov = document.createElement('div');
  ov.className = 'ika-dk';
  ov.innerHTML = `
    <div class="ika-dk-in">
      <div class="ika-dk-head">
        <h2>${t(lang, ...TX.title)}</h2>
        <div class="ika-dk-sum" data-dk-sum></div>
        <p class="ika-dk-errors" data-dk-errors></p>
        <div class="ika-dk-btns"><button type="button" class="ika-btn ika-btn--primary" data-dk-save>${t(lang, ...TX.save)}</button><button type="button" class="ika-btn" data-dk-reset>${t(lang, ...TX.reset)}</button><button type="button" class="ika-btn" data-dk-close>${t(lang, ...TX.close)}</button></div>
        <p class="ika-dk-msg" data-dk-msg role="status"></p>
      </div>
      <h3>${t(lang, ...TX.deck)} <small>${t(lang, ...TX.tapRemove)}</small></h3>
      <div class="ika-dk-deck" data-dk-deck></div>
      <h3>${t(lang, ...TX.pool)} <small>${t(lang, ...TX.tapAdd)}</small></h3>
      <p class="ika-dk-note">${t(lang, ...TX.poolNote)}</p>
      <div class="ika-bd-seg" data-dk-kind>${[['all', t(lang, ...TX.all)], ...KIND_ORDER.map((k) => [k, t(lang, ...KIND_LABEL[k])])].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v === 'all')}">${l}</button>`).join('')}</div>
      <div class="ika-dk-pool" data-dk-pool></div>
    </div>`;
  document.body.appendChild(ov);
  document.documentElement.classList.add('is-deck');
  const $ = (s) => ov.querySelector(s);
  const el = { sum: $('[data-dk-sum]'), errors: $('[data-dk-errors]'), deck: $('[data-dk-deck]'), pool: $('[data-dk-pool]'), msg: $('[data-dk-msg]'), save: $('[data-dk-save]') };
  let msgTimer = 0;
  const say = (text, ok = false) => { el.msg.textContent = text; el.msg.classList.toggle('is-ok', ok); clearTimeout(msgTimer); msgTimer = setTimeout(() => { el.msg.textContent = ''; }, 2400); };
  const byNo = new Map(CARDS.map((c) => [c.no, c]));
  const count = (no) => deck.filter((n) => n === no).length;

  function render() {
    const s = summary(deck, CARDS);
    const bad = (k) => s[k] < DECK_RULE[k][0] || s[k] > DECK_RULE[k][1];
    el.sum.innerHTML = `<b class="${s.total === 30 ? '' : 'is-bad'}">${s.total}<small>/30</small></b>${KIND_ORDER.map((k) => `<span class="${bad(k) ? 'is-bad' : ''}">${t(lang, ...KIND_LABEL[k])} ${s[k]}<small>（${DECK_RULE[k][0]}〜${DECK_RULE[k][1]}）</small></span>`).join('')}`;
    el.errors.textContent = s.check.ok ? '' : s.check.errors.join('　');
    el.save.disabled = !s.check.ok;
    // いまのデッキ：種類→番号順にまとめて
    const uniq = [...new Set(deck)].map((n) => byNo.get(n)).filter(Boolean).sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.no - b.no);
    el.deck.innerHTML = uniq.map((c) => `<button type="button" class="ika-dk-card" data-no="${c.no}" data-tier="${tierOf(c.rarity)}" aria-label="${esc(c.name)} ×${count(c.no)}"><img src="${cardSrc(c.no)}" alt="" width="240" height="360" loading="lazy" /><i>×${count(c.no)}</i></button>`).join('') || `<p class="ika-dk-note">—</p>`;
    // 使えるカード
    const pool = CARDS.filter((c) => (kind === 'all' || c.kind === kind)).sort((a, b) => ((avail[b.no] ?? 0) > 0) - ((avail[a.no] ?? 0) > 0) || a.no - b.no);
    el.pool.innerHTML = pool.map((c) => { const a = avail[c.no] ?? 0, h = count(c.no); return `<button type="button" class="ika-dk-card${a ? '' : ' is-none'}${h >= a && a ? ' is-max' : ''}" data-no="${c.no}" data-tier="${tierOf(c.rarity)}" aria-label="${esc(c.name)}"><img src="${cardSrc(c.no)}" alt="" width="240" height="360" loading="lazy" /><i>${h}/${a}</i></button>`; }).join('');
  }
  el.deck.addEventListener('click', (e) => { const b = e.target.closest('[data-no]'); if (!b) return; deck = removeCard(deck, Number(b.dataset.no)); render(); });
  el.pool.addEventListener('click', (e) => { const b = e.target.closest('[data-no]'); if (!b) return; const r = addCard(deck, Number(b.dataset.no), avail, CARDS); if (!r.ok) { say(t(lang, ...TX.why[r.why])); return; } deck = r.deck; render(); });
  $('[data-dk-kind]').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (!b) return; kind = b.dataset.v; $('[data-dk-kind]').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); render(); });
  $('[data-dk-reset]').addEventListener('click', () => { deck = starter.slice(); render(); });
  el.save.addEventListener('click', () => { const s = summary(deck, CARDS); if (!s.check.ok) return; writeJSON(KEY_DECK, { nos: deck }); say(t(lang, ...TX.saved), true); });
  const close = () => { ov.remove(); document.documentElement.classList.remove('is-deck'); };
  $('[data-dk-close]').addEventListener('click', close);
  render();
  return { close };
}

// キャラ一覧（エギングの釣り人・墨のがれのイカで共通。2026-10-13）：中身の HTML と、押した時の処理
//   ・キャラを🎫10で入手・使う（前からの動き）
//   ・持っているキャラの下に色の丸（元の色・ピンク・ミント・むらさき）。持っている色はタップで着替え、持っていない色は🎫5で入手
//   見た目は ikabu.css の .ika-egi-anglerpop / .ika-egi-ang / .ika-ang-cols
import { ANGLERS, COLORS, COLOR_COST, anglerOf, readAnglers, writeAnglers, buyAngler, useAngler, buyColor, useColor, colorOf, ANGLERS_EVENT } from './anglers.js';
import { readTickets, writeTickets } from './tickets.js';
import { EGI_TEXT } from './play-text.js';
import { t, esc, assetHref } from '../i18n.js';
import { utcDay } from './rng.js';

const T = EGI_TEXT.angler;
const SWATCH = { '': '#f3efe4', pink: '#f6a9c6', mint: '#9fe3bf', purple: '#c4a8ee' };

// face(id, color) → 一覧の絵の住所。ask：「入手する？」を出しているもの（'aori' や 'aori:pink'）
export function anglerPopHTML({ lang, title, note, ask, face }) {
  const rec = readAnglers(); const have = readTickets().n;
  const cards = ANGLERS.map((a) => {
    const owned = rec.owned.includes(a.id); const cur = rec.current === a.id; const col = colorOf(rec, a.id);
    const btn = cur ? `<span class="ika-egi-ang-state">${t(lang, T.using)}</span>`
      : owned ? `<button type="button" class="ika-chip" data-ang-use="${a.id}">${t(lang, T.use)}</button>`
      : ask === a.id ? `<button type="button" class="ika-chip ika-egi-ang-yes" data-ang-buy="${a.id}">${T.confirm(lang, a.cost)}</button>`
      : `<button type="button" class="ika-chip" data-ang-ask="${a.id}"${have < a.cost ? ' aria-disabled="true"' : ''} aria-label="${esc(t(lang, T.names[a.id]))} ${T.buy(lang, a.cost)}">${T.buy(lang, a.cost)}</button>`;
    let cols = '';
    if (owned) {
      const dots = ['', ...COLORS].map((c) => {
        const mine = c === '' || rec.colors[a.id]?.includes(c);
        const on = mine && col === c;
        const name = esc(t(lang, T.colors[c || 'orig']));
        const key = `${a.id}:${c}`;
        if (!mine && ask === key) return `<button type="button" class="ika-ang-colbuy" data-col-buy="${key}">${T.colorBuy(lang, COLOR_COST)}</button>`;
        return `<button type="button" class="ika-ang-col${on ? ' is-on' : ''}${mine ? '' : ' is-locked'}" style="--c:${SWATCH[c]}" data-col-${mine ? 'use' : 'ask'}="${key}" aria-pressed="${on}" aria-label="${name}${mine ? '' : ` 🎫${COLOR_COST}`}">${mine ? '' : '<i>🎫</i>'}</button>`;
      }).join('');
      cols = `<div class="ika-ang-cols">${dots}</div>`;
    }
    return `<div class="ika-egi-ang${cur ? ' is-cur' : ''}${owned ? '' : ' is-locked'}"><img src="${assetHref(face(a.id, owned ? col : ''))}" alt="" width="64" height="64" decoding="async"><b>${esc(t(lang, T.names[a.id]))}</b>${btn}${cols}</div>`;
  }).join('');
  return `<p class="ika-egi-colorpop-title">${title}<small>${T.have(lang, have)}</small></p><div class="ika-egi-ang-grid">${cards}</div><p class="ika-egi-colorpop-why">${note}</p><button type="button" class="ika-btn ika-egi-ang-close">${t(lang, T.close)}</button>`;
}

// 一覧の中を押した。戻り：{ close, ask, changed }。入手・着替えは保存して ANGLERS_EVENT を流す（もう一方のゲームもそろう）
export function anglerPopClick(e, { lang, ask, callout }) {
  if (e.target.closest('.ika-egi-ang-close')) return { close: true, ask: null };
  const fire = () => dispatchEvent(new CustomEvent(ANGLERS_EVENT));
  const tk = () => dispatchEvent(new CustomEvent('ikabu:tickets', { detail: { got: 0, why: [] } }));
  const use = e.target.closest('[data-ang-use]');
  if (use) { const r = useAngler(readAnglers(), use.dataset.angUse); if (r.ok) { writeAnglers(r.rec); fire(); } return { ask: null, changed: r.ok }; }
  const aAsk = e.target.closest('[data-ang-ask]');
  if (aAsk) {
    const a = anglerOf(aAsk.dataset.angAsk); const have = readTickets().n;
    if (have < a.cost) { callout(T.short(lang, a.cost - have), 'bad'); return { ask }; }
    return { ask: a.id };
  }
  const aBuy = e.target.closest('[data-ang-buy]');
  if (aBuy) {
    const id = aBuy.dataset.angBuy;
    const r = buyAngler(readAnglers(), readTickets(), id, { day: utcDay() });
    if (r.ok) { writeAnglers(r.rec); writeTickets(r.tickets); tk(); fire(); callout(T.got(lang, t(lang, T.names[id])), 'good'); }
    else if (r.why === 'tickets') callout(T.short(lang, anglerOf(id).cost - readTickets().n), 'bad');
    return { ask: null, changed: r.ok };
  }
  const cUse = e.target.closest('[data-col-use]');
  if (cUse) { const [id, c] = cUse.dataset.colUse.split(':'); const r = useColor(readAnglers(), id, c); if (r.ok) { writeAnglers(r.rec); fire(); } return { ask: null, changed: r.ok }; }
  const cAsk = e.target.closest('[data-col-ask]');
  if (cAsk) {
    const have = readTickets().n;
    if (have < COLOR_COST) { callout(T.short(lang, COLOR_COST - have), 'bad'); return { ask }; }
    return { ask: cAsk.dataset.colAsk };
  }
  const cBuy = e.target.closest('[data-col-buy]');
  if (cBuy) {
    const [id, c] = cBuy.dataset.colBuy.split(':');
    const r = buyColor(readAnglers(), readTickets(), id, c, { day: utcDay() });
    if (r.ok) { writeAnglers(r.rec); writeTickets(r.tickets); tk(); fire(); callout(T.colorGot(lang, t(lang, T.names[id]), t(lang, T.colors[c])), 'good'); }
    else if (r.why === 'tickets') callout(T.short(lang, COLOR_COST - readTickets().n), 'bad');
    return { ask: null, changed: r.ok };
  }
  return { ask };
}

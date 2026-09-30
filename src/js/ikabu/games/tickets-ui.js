// チケット🎫（2026-09-30）。2つの役目に分ける：
//   mountTicketEarn：どのページでも動く「付与」係。ゲームの終わり（'ikabu:game'）と認定証（'ikabu:cert'）を受けて枚数を足し、
//                    画面の隅に「🎫 +2」の小さな知らせを出す。付与したら 'ikabu:tickets' を投げる
//   mountTickets   ：TOP（games）の🎫の欄。枚数と「今日あと何枚」を表示し、配布コードの入力を受ける
//   ゲーム側は終わった時に 'ikabu:game'（detail: { game, goal, seconds, counted }）を投げる
import { utcDay } from './rng.js';
import { readTickets, writeTickets, earnPlay, earnSumiGoal, earnRush60, earnCert, earnBattle, todayLeft, CAP } from './tickets.js';
import { HUB_TEXT } from './play-text.js';
import { t } from '../i18n.js';
import { redeem, lockState } from './codes.js';
import CODE_TABLE from './codes-table.json';

let earnMounted = false;

// 付与係（ページに1回だけ）。toast=true で隅に「🎫 +n」を出す
export function mountTicketEarn({ lang = 'ja', toast = true } = {}) {
  if (earnMounted) return;
  earnMounted = true;
  const T = HUB_TEXT.tickets;
  let toastEl = null;
  const show = (got, why) => {
    if (!toast || got <= 0) return;
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ika-tickets-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = T.pop(lang, got, why);
    toastEl.classList.remove('is-on');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-on');
  };
  const apply = (fn) => {
    const day = utcDay();
    const out = fn(readTickets(), day);
    if (!out) return;
    writeTickets(out.rec);
    dispatchEvent(new CustomEvent('ikabu:tickets', { detail: { got: out.got, why: out.why } }));
    show(out.got, out.why);
  };
  addEventListener('ikabu:game', (e) => {
    const d = e.detail ?? {};
    if (d.counted === false) return;   // 練習（数えない釣行）は🎫も無し
    apply((rec, day) => {
      let got = 0, why = [], r = rec;
      if (d.game === 'battle') { const b = earnBattle(r, { day, win: Boolean(d.win) }); return { rec: b.rec, got: b.got, why: b.why }; }   // 対戦は「1戦」の枠と別
      const a = earnPlay(r, { day }); r = a.rec; got += a.got; why.push(...a.why);
      if (d.game === 'sumi' && d.goal) { const b = earnSumiGoal(r, { day }); r = b.rec; got += b.got; why.push(...b.why); }
      if (d.game === 'rush') { const c = earnRush60(r, { day, seconds: d.seconds ?? 0 }); r = c.rec; got += c.got; why.push(...c.why); }
      return { rec: r, got, why };
    });
  });
  addEventListener('ikabu:cert', (e) => {
    const fresh = e.detail?.fresh ?? [];
    if (!fresh.length) return;
    apply((rec, day) => {
      let got = 0, r = rec;
      for (const id of fresh) { const c = earnCert(r, id, { day }); r = c.rec; got += c.got; }
      return { rec: r, got, why: got ? ['cert'] : [] };
    });
  });
}

// TOPの🎫の欄
export function mountTickets(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const el = { n: root.querySelector('[data-tickets-n]'), left: root.querySelector('[data-tickets-left]'), pop: root.querySelector('[data-tickets-pop]') };
  const T = HUB_TEXT.tickets;
  const render = (rec) => {
    const day = utcDay();
    if (el.n) el.n.textContent = String(rec.n);
    if (el.left) el.left.textContent = T.left(lang, todayLeft(rec, { day }), rec.n >= CAP);
  };
  const pop = (got, why) => {
    if (!el.pop || got <= 0) return;
    el.pop.textContent = T.pop(lang, got, why);
    el.pop.classList.remove('is-on');
    void el.pop.offsetWidth;
    el.pop.classList.add('is-on');
  };
  render(readTickets());
  addEventListener('ikabu:tickets', (e) => { render(readTickets()); pop(e.detail?.got ?? 0, e.detail?.why ?? []); });
  addEventListener('storage', () => render(readTickets()));

  // 配布コード：入力→ハッシュで照合→枚数を足す。外れが3回続いたら30秒待ち
  const open = root.querySelector('[data-code-open]');
  const form = root.querySelector('[data-code-form]');
  const input = root.querySelector('#ika-tickets-input');
  const msg = root.querySelector('[data-code-msg]');
  let fails = 0, lastFail = 0, busy = false;
  const say = (text, ok = false) => { if (msg) { msg.textContent = text; msg.classList.toggle('is-ok', ok); } };
  open?.addEventListener('click', () => { form.hidden = false; open.hidden = true; say(''); input?.focus({ preventScroll: true }); });
  root.querySelector('[data-code-cancel]')?.addEventListener('click', () => { form.hidden = true; open.hidden = false; say(''); });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const lock = lockState(fails, lastFail, Date.now());
    if (lock.locked) { say(T.codeMsg.wait(lang, Math.ceil(lock.wait / 1000))); return; }
    busy = true;
    try {
      const day = utcDay();
      const r = await redeem(input?.value ?? '', { table: CODE_TABLE, tickets: readTickets(), day });
      if (r.ok) {
        fails = 0;
        writeTickets(r.rec); render(r.rec); pop(r.got, ['code']);
        say(r.got > 0 ? T.codeMsg.ok(lang, r.got) : t(lang, T.codeMsg.full), true);
        if (input) input.value = '';
      } else {
        if (r.reason === 'bad') { fails += 1; lastFail = Date.now(); }
        say(t(lang, T.codeMsg[r.reason] ?? T.codeMsg.bad));
      }
    } finally { busy = false; }
  });
  return { render: () => render(readTickets()) };
}

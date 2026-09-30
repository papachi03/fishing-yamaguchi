// チケット🎫の欄（あそび場の入口）と、ゲームの結果に合わせた付与（2026-09-30）。
//   ゲーム側は終わった時に 'ikabu:game'（detail: { game, goal, seconds, counted }）を投げる。認定証は 'ikabu:cert'（detail: { fresh }）
//   ここで枚数を足し、欄を更新し、「🎫+1」を出す。コード入力は codes.js（次の段階）
import { utcDay } from './rng.js';
import { readTickets, writeTickets, earnPlay, earnSumiGoal, earnRush60, earnCert, todayLeft, CAP } from './tickets.js';
import { HUB_TEXT } from './play-text.js';
import { t } from '../i18n.js';
import { redeem, lockState } from './codes.js';
import CODE_TABLE from './codes-table.json';

export function mountTickets(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const el = {
    n: root.querySelector('[data-tickets-n]'),
    left: root.querySelector('[data-tickets-left]'),
    pop: root.querySelector('[data-tickets-pop]'),
  };
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
    void el.pop.offsetWidth;   // アニメを頭から
    el.pop.classList.add('is-on');
  };
  const apply = (fn) => {
    const day = utcDay();
    const out = fn(readTickets(), day);
    if (!out) return;
    writeTickets(out.rec);
    render(out.rec);
    pop(out.got, out.why);
  };
  render(readTickets());

  addEventListener('ikabu:game', (e) => {
    const d = e.detail ?? {};
    if (d.counted === false) return;   // 練習（数えない釣行）は🎫も無し
    apply((rec, day) => {
      let got = 0, why = [];
      let r = rec;
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
  addEventListener('storage', () => render(readTickets()));

  // 配布コード（2026-09-30）：入力→ハッシュで照合→枚数を足す。外れが3回続いたら30秒待ち
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
      const before = readTickets();
      const r = await redeem(input?.value ?? '', { table: CODE_TABLE, tickets: before, day });
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

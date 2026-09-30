// 認定証の欄（あそび場の入口の下）を記録に合わせて更新する（2026-09-30）。
// 記録が書き換わるたび（records.js が 'ikabu:records' を投げる）に読み直すので、ゲームを遊んだ直後に反映される
import { KEY_EGI, KEY_M3, readRecord, emptyEgi, emptyM3 } from './records.js';
import { certStatus, awardCerts, readCerts, writeCerts, CERT_IDS } from './certs.js';
import { GAME_ZUKAN, HUB_TEXT } from './play-text.js';
import { t, assetHref } from '../i18n.js';
import { drawCert } from './cert-image.js';
import { openShareView, shareUrl } from './share.js';

const KEY_NAME = 'ikabu.certs.name';   // 認定証に入れる名前（このブラウザだけ）

export function mountCerts(root, { lang = 'ja' } = {}) {
  const zukanIds = GAME_ZUKAN.map((z) => z.id);
  const sync = () => {
    const egi = { ...emptyEgi(), ...(readRecord(KEY_EGI).value ?? {}) };
    const sumi = { ...emptyM3(), ...(readRecord(KEY_M3).value ?? {}) };
    const status = certStatus({ sumi, egi, zukanIds });
    const { certs, fresh } = awardCerts(readCerts(), status);
    if (fresh.length) { writeCerts(certs); dispatchEvent(new CustomEvent('ikabu:cert', { detail: { fresh } })); }   // チケット🎫+10（2026-09-30）
    for (const id of CERT_IDS) {
      const li = root?.querySelector(`[data-cert="${id}"]`);
      if (!li) continue;
      const st = status[id];
      li.classList.toggle('is-earned', Boolean(certs[id]));
      li.classList.toggle('is-fresh', fresh.includes(id));
      const prog = li.querySelector('[data-cert-progress]');
      if (prog) prog.textContent = id === 'egi'
        ? HUB_TEXT.certs.egiProgress(lang, st.have, st.need, st.level, st.maxLevel)
        : HUB_TEXT.certs.progress(lang, st.have, st.need);
      const date = li.querySelector('[data-cert-date]');
      if (date) date.textContent = certs[id] ? HUB_TEXT.certs.since(lang, certs[id]) : '';
      const make = li.querySelector('[data-cert-make]');
      if (make) make.hidden = !certs[id];
    }
    last = { status, certs, fresh };
    return last;
  };
  let last = null;
  sync();
  addEventListener('ikabu:records', sync);
  addEventListener('storage', sync);

  if (!root) return { sync };   // 欄が無いページ（ゲームのページ）は判定だけ
  // 「認定証をつくる」→ 名前の入力欄を出す → 「画像にする」→ 名前と日付を載せた画像をシェア画面へ（保存は長押し・𝕏は投稿画面）
  const form = root.querySelector('#ika-cert-form');
  const input = root.querySelector('#ika-cert-name');
  let picked = null;
  if (input) { try { input.value = localStorage.getItem(KEY_NAME) ?? ''; } catch { /* 読めなくてもよい */ } }
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cert-make]');
    if (!btn || !form) return;
    picked = btn.closest('[data-cert]')?.dataset.cert ?? null;
    form.hidden = false;
    form.dataset.cert = picked;
    input?.focus({ preventScroll: true });
    form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = form.dataset.cert;
    if (!id || !last?.certs?.[id]) return;
    const name = (input?.value ?? '').trim().slice(0, 16);
    try { if (name) localStorage.setItem(KEY_NAME, name); } catch { /* 残せなくてもよい */ }
    const day = last.certs[id];
    const button = form.querySelector('button[type="submit"]');
    await openShareView({
      lang, button,
      text: t(lang, HUB_TEXT.certs.shareText[id]),
      url: shareUrl(lang, id === 'egi' ? 'egi' : 'sumi'),
      draw: () => drawCert(id, { name, date: day.replace(/-/g, '/'), assetHref, honorific: lang === 'en' ? '' : '殿' }),
    });
  });
  return { sync };
}

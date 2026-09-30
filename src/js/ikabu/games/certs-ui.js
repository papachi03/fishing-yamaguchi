// 認定証の欄（あそび場の入口の下）を記録に合わせて更新する（2026-09-30）。
// 記録が書き換わるたび（records.js が 'ikabu:records' を投げる）に読み直すので、ゲームを遊んだ直後に反映される
import { KEY_EGI, KEY_M3, readRecord, emptyEgi, emptyM3 } from './records.js';
import { certStatus, awardCerts, readCerts, writeCerts, CERT_IDS } from './certs.js';
import { GAME_ZUKAN, HUB_TEXT } from './play-text.js';
import { t } from '../i18n.js';

export function mountCerts(root, { lang = 'ja' } = {}) {
  if (!root) return null;
  const zukanIds = GAME_ZUKAN.map((z) => z.id);
  const sync = () => {
    const egi = { ...emptyEgi(), ...(readRecord(KEY_EGI).value ?? {}) };
    const sumi = { ...emptyM3(), ...(readRecord(KEY_M3).value ?? {}) };
    const status = certStatus({ sumi, egi, zukanIds });
    const { certs, fresh } = awardCerts(readCerts(), status);
    if (fresh.length) writeCerts(certs);
    for (const id of CERT_IDS) {
      const li = root.querySelector(`[data-cert="${id}"]`);
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
    }
    return { status, certs, fresh };
  };
  sync();
  addEventListener('ikabu:records', sync);
  addEventListener('storage', sync);
  return { sync };
}

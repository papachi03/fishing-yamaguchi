// 山口イカ部「写真部」の投稿（2026-10-01）。受け口は「現地の声」と同じ Worker（worker/reports/src/ikabu.js）
import { REPORTS_API_PROD, TURNSTILE_SITE_KEY_PROD } from '../../config/reports.js';

// 手元（npm run dev）では worker/reports/dev-server.mjs と、Cloudflare公式の「必ず通る」テスト用キーを使う
const DEV = import.meta.env.DEV;
const API = (DEV ? 'http://127.0.0.1:8787' : REPORTS_API_PROD).replace(/\/$/, '');
export const TURNSTILE_SITE_KEY = DEV ? '1x00000000000000000000AA' : TURNSTILE_SITE_KEY_PROD;
export const photoPostEnabled = Boolean(API && TURNSTILE_SITE_KEY);

export const ikabuPhotoUrl = (id) => `${API}/ikabu/photo/${encodeURIComponent(id)}`;

async function call(path, init = {}, timeoutMs = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(`${API}${path}`, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 掲載済みの投稿（新しい順）
export async function fetchIkabuPhotos(limit = 60) {
  if (!photoPostEnabled) return [];
  const res = await call(`/ikabu/photos?limit=${limit}`);
  if (!res.ok) throw new Error(`ikabu photos fetch failed: ${res.status}`);
  return (await res.json()).posts ?? [];
}

// 投稿（写真は送る前に縮小して撮影情報を落としてある）。戻り：{ ok, post, pending } か { ok:false, error }
//   2026-10-01 ぱっぱのiPhoneで「通信できませんでした」：送信が Worker に届いていなかった（見張りで確認）。
//   原因を見るため、失敗したら理由を画面に小さく出し、Worker に「どこで止まったか」の知らせ（/ikabu/diag・404で返るが記録に残る）を送る
// fetch がすぐ「Load failed」になる iPhone 向けの予備の送り方（昔からある XMLHttpRequest）
function xhrPost(url, formData, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.timeout = timeoutMs;
    x.onload = () => resolve({ status: x.status, text: x.responseText });
    x.onerror = () => reject(new Error('xhr error'));
    x.ontimeout = () => reject(new Error('xhr timeout'));
    x.send(formData);
  });
}
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

// 受付番号 cid の投稿が Worker に届いているか（iPhone が送信の途中で「失敗」と出しても、実は届いていることがある。2026-10-01 実測）
export async function checkArrived(cid, waitMs = 0) {
  if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
  try {
    const res = await call(`/ikabu/photos/status?cid=${encodeURIComponent(cid)}`, { cache: 'no-store' }, 10000);
    const d = await res.json().catch(() => null);
    return d?.ok && d.arrived ? { ok: true, post: { id: d.id }, pending: true, arrivedLate: true } : null;
  } catch {
    return null;
  }
}

// onStage(段階)：'sending'（送っている）・'checking'（届いたか確かめている）・'retry'（送り直している）。画面の案内に使う
export async function submitIkabuPhoto(formData, info = {}, onStage = () => {}) {
  const t0 = Date.now();
  onStage('sending');
  const cid = String(formData.get('cid') ?? '');
  const done = (data, status) => (data?.ok ? data : { ok: false, error: data?.error || `送信できませんでした（${status}）。時間をおいてもう一度お試しください。` });
  try {
    const res = await call('/ikabu/photos', { method: 'POST', body: formData }, 60000);
    return done(await res.json().catch(() => null), res.status);
  } catch (first) {
    // ①「失敗」と出ても届いていることがある → 少し待って Worker に聞く（Worker 側の処理は3秒ほどかかる）
    onStage('checking');
    if (cid) { const a = await checkArrived(cid, 3500); if (a) return a; }
    onStage('retry');
    // ② 本当に届いていない → XMLHttpRequest で送り直す（同じ受付番号なので、万一両方届いても1件）
    try {
      const r = await xhrPost(`${API}/ikabu/photos`, formData);
      if (r.status > 0) return done(parse(r.text), r.status);
    } catch { /* 下で確かめる */ }
    onStage('checking');
    if (cid) { const a = await checkArrived(cid, 3500); if (a) return a; }
    const e = first;
    const why = `${e?.name ?? 'Error'}: ${e?.message ?? e}`;
    const q = new URLSearchParams({ why, ms: String(Date.now() - t0), ...Object.fromEntries(Object.entries(info).map(([k, v]) => [k, String(v)])) });
    call(`/ikabu/diag?${q}`, {}, 8000).catch(() => {});
    // 技術的な理由は Worker の記録にだけ残し、画面には出さない（投稿する人を混乱させない。2026-10-01 ぱっぱ）
    return { ok: false, error: '送れませんでした。電波の良い場所で、もう一度「投稿する」を押してください。同じ写真を送り直しても二重にはなりません。', why };
  }
}

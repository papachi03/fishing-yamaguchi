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
export async function submitIkabuPhoto(formData) {
  try {
    const res = await call('/ikabu/photos', { method: 'POST', body: formData }, 60000);
    const data = await res.json().catch(() => null);
    if (data?.ok) return data;
    return { ok: false, error: data?.error || '送信できませんでした。時間をおいてもう一度お試しください。' };
  } catch {
    return { ok: false, error: '通信できませんでした。電波の良い場所でもう一度お試しください。' };
  }
}

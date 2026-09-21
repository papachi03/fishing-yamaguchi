// 「現地の声」Worker（worker/reports）との通信。
import { REPORTS_API_PROD, TURNSTILE_SITE_KEY_PROD } from '../config/reports.js';

// 手元（npm run dev）では worker/reports/dev-server.mjs と、Cloudflare公式の「必ず通る」テスト用キーを使う
const DEV = import.meta.env.DEV;
const API = (DEV ? 'http://127.0.0.1:8787' : REPORTS_API_PROD).replace(/\/$/, '');
export const TURNSTILE_SITE_KEY = DEV ? '1x00000000000000000000AA' : TURNSTILE_SITE_KEY_PROD;
export const reportsEnabled = Boolean(API && TURNSTILE_SITE_KEY);

export const photoUrl = (id) => `${API}/photo/${id}`;

async function call(path, init = {}, timeoutMs = 15000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(`${API}${path}`, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

// area・spot・fish は空文字なら送らない（Worker側は「絞り込み無し」）
export async function fetchPosts({ area = '', spot = '', fish = '', limit = 50 } = {}) {
  if (!reportsEnabled) return [];
  const q = new URLSearchParams({ limit: String(limit) });
  for (const [k, v] of Object.entries({ area, spot, fish })) if (v) q.set(k, v);
  const res = await call(`/posts?${q}`);
  if (!res.ok) throw new Error(`posts fetch failed: ${res.status}`);
  return (await res.json()).posts ?? [];
}

export async function submitPost(formData) {
  try {
    const res = await call('/posts', { method: 'POST', body: formData }, 60000);
    const data = await res.json().catch(() => null);
    if (data?.ok) return data;
    return { ok: false, error: data?.error || '送信できませんでした。時間をおいてもう一度お試しください。' };
  } catch {
    return { ok: false, error: '通信できませんでした。電波の良い場所でもう一度お試しください。' };
  }
}

export async function reportPost(id) {
  try {
    return (await call(`/posts/${encodeURIComponent(id)}/report`, { method: 'POST' })).ok;
  } catch {
    return false;
  }
}

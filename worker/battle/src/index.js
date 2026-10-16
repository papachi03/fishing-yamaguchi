/**
 * 山口イカ部カードバトル オンライン対戦（試遊版・2026-10-16 第1段階）
 *
 *   POST /rooms            部屋を作る → { code }（4桁）
 *   GET  /rooms/<code>/ws  その部屋へ WebSocket でつなぐ（部屋＝Durable Object BattleRoom）
 *
 * 試合の進行は src/match.js（site の battle.js をそのまま使う）。workers.dev で動かす（看板ドメインの下に置かない）
 */
export { BattleRoom } from './room.js';

const ALLOWED = ['https://ikabu-trial.hoodhomies.workers.dev', 'http://localhost:5180', 'http://127.0.0.1:5180', 'http://localhost:5173'];
const allowed = (req) => { const o = req.headers.get('Origin'); return !o || ALLOWED.includes(o) || /^https:\/\/ikabu-preview[\w-]*\.hoodhomies\.workers\.dev$/.test(o); };
const cors = (req) => ({ 'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Vary': 'Origin' });
const json = (req, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(req) } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (!allowed(req)) return json(req, { error: 'origin' }, 403);
    if (url.pathname === '/rooms' && req.method === 'POST') {
      for (let i = 0; i < 10; i++) {
        const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch(`https://room/claim?code=${code}`, { method: 'POST' });
        if (r.ok) return json(req, { code });
      }
      return json(req, { error: 'noRoom' }, 503);
    }
    const m = url.pathname.match(/^\/rooms\/(\d{4})\/ws$/);
    if (m && req.headers.get('Upgrade') === 'websocket') {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      return stub.fetch(req);
    }
    if (url.pathname === '/') return json(req, { ok: true, service: 'ikabu-battle' });
    return json(req, { error: 'notFound' }, 404);
  },
};

// オンライン対戦の通信（2026-10-16・第1段階・試遊版だけ）。相手は worker/battle（Cloudflare Durable Object＋WebSocket）
//   ・mirror()：サーバーが送る「自分から見た状態」を、battle-ui.js がそのまま読める st の形に組み直す（純粋な関数。node のテストでも使う）
//   ・createNet()：部屋を作る／入る・手を送って結果を待つ・相手の手や通信の切れを知らせる。切れたら30秒まで自動でつなぎ直す
//   ・ここでは DOM に触らない（画面は battle-ui.js）

// サーバーの x（カードの実体）は card を持たない（番号から引く）。相手の伏せ札・手札は hidden＝true の置き物
export function mirror(view, { cards, effects }) {
  const byNo = new Map(cards.map((c) => [c.no, c]));
  const fix = (x) => (x ? { ...x, card: x.hidden ? x.card : byNo.get(x.no), buffs: x.buffs ?? [], flags: x.flags ?? {} } : null);
  const pl = (p) => ({ ...p, front: p.front.map(fix), back: p.back.map(fix), hand: p.hand.map(fix), grave: p.grave.map(fix), deck: Array(p.deck).fill(null) });
  return { ...view, players: { me: pl(view.players.me), cpu: pl(view.players.cpu) }, effects, byNo, rnd: () => 0.5, pending: view.pending ?? null, ask: { me: true, cpu: true }, online: true };
}

const CODE_RE = /^\d{4}$/;
export const isCode = (s) => CODE_RE.test(String(s ?? '').trim());

// base：Worker の https の入口（例 https://ikabu-battle.example.workers.dev）
export function createNet({ base, WebSocketImpl = globalThis.WebSocket, fetchImpl = globalThis.fetch, storage = null } = {}) {
  const handlers = {};
  const emit = (type, m) => { for (const h of handlers[type] ?? []) h(m); };
  const KEY = 'ikabu.battle.online';
  let ws = null, code = null, token = null, seat = null, started = false, over = false, left = false, nextId = 1;
  const pending = new Map();   // id → { resolve, reject }
  const wsUrl = (c) => `${base.replace(/^http/, 'ws')}/rooms/${c}/ws`;

  const remember = () => { try { storage?.setItem(KEY, JSON.stringify({ code, token, at: Date.now() })); } catch {} };
  const forget = () => { try { storage?.removeItem(KEY); } catch {} };

  function open(c) {
    return new Promise((resolve, reject) => {
      const sock = new WebSocketImpl(wsUrl(c));
      let settled = false;
      sock.onopen = () => { sock.send(JSON.stringify({ t: 'hello', token })); };
      sock.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'seat') { seat = m.seat; token = m.token; code = c; remember(); if (!settled) { settled = true; resolve(m); } emit('seat', m); return; }
        if (m.t === 'err') { if (!settled) { settled = true; reject(new Error(m.msg)); } emit('err', m); return; }
        if (m.t === 'start') { started = true; emit('start', m); return; }
        if (m.t === 'res') { const p = pending.get(m.id); pending.delete(m.id); if (m.state?.winner) over = true; p?.resolve(m); return; }
        if (m.t === 'ev') { if (m.state?.winner) over = true; emit('ev', m); return; }
        if (m.t === 'state') { if (m.state?.winner) over = true; emit('state', m); return; }
        if (m.t === 'opp') { emit('opp', m); return; }
      };
      sock.onerror = () => { if (!settled) { settled = true; reject(new Error('connect')); } };
      sock.onclose = () => {
        if (ws === sock) ws = null;
        for (const [, p] of pending) p.reject(new Error('closed'));
        pending.clear();
        if (!settled) { settled = true; reject(new Error('closed')); return; }
        if (started && !over && !left) { emit('conn', { status: 'lost' }); retry(); } else emit('conn', { status: 'closed' });
      };
      ws = sock;
    });
  }
  // 切れたら 1.5 秒ごとに 30 秒までつなぎ直す（スマホで別のアプリに移ると切れる）
  let retrying = false;
  async function retry() {
    if (retrying) return; retrying = true;
    const until = Date.now() + 30_000;
    while (Date.now() < until && started && !over && !left) {
      await new Promise((r) => setTimeout(r, 1500));
      try { await open(code); emit('conn', { status: 'back' }); retrying = false; return; } catch {}
    }
    retrying = false;
    emit('conn', { status: 'gaveup' });
  }
  const send = (m) => { if (!ws || ws.readyState !== 1) throw new Error('notConnected'); ws.send(JSON.stringify(m)); };

  return {
    on(type, h) { (handlers[type] ??= []).push(h); return () => { handlers[type] = handlers[type].filter((x) => x !== h); }; },
    get code() { return code; }, get seat() { return seat; }, get started() { return started; }, get over() { return over; },
    // 部屋を作って入る → コードを返す（相手が入ると 'start' が来る）
    async create() {
      const res = await fetchImpl(`${base}/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error('create');
      const { code: c } = await res.json();
      await open(c);
      return c;
    },
    async join(c) { if (!isCode(c)) throw new Error('badCode'); await open(String(c).trim()); return c; },
    // 前回の部屋に戻る（ページを読み込み直した時）。30秒より前の記録は使わない
    async rejoin() {
      let saved = null; try { saved = JSON.parse(storage?.getItem(KEY) ?? 'null'); } catch {}
      if (!saved || Date.now() - saved.at > 20 * 60_000) { forget(); return null; }
      code = saved.code; token = saved.token;
      try { await open(code); started = true; return code; } catch { forget(); return null; }
    },
    // 手を送って結果（r と新しい状態）を待つ
    act(a) {
      const id = nextId++;
      return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); try { send({ t: 'act', id, ...a }); } catch (e) { pending.delete(id); reject(e); } });
    },
    leave() { left = true; forget(); try { send({ t: 'leave' }); } catch {} try { ws?.close(); } catch {} },
    close() { left = true; forget(); try { ws?.close(); } catch {} },
  };
}

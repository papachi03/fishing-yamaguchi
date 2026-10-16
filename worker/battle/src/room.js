// 対戦の部屋（Cloudflare Durable Object・1部屋＝1試合・2026-10-16）
//   ・席 a／b に WebSocket を1本ずつ。試合の進行は match.js（battle.js そのまま）。状態はこの部屋のメモリにだけ持つ（第1段階）
//   ・1ターン TURN_MS で自動納竿。通信が切れた席は LEAVE_MS 以内に同じ token で戻れば続き、戻らなければ負け
//   ・メッセージは JSON。スマホ→部屋：hello／act／leave／ping、部屋→スマホ：seat／start／res／ev／state／opp／err
import { createMatch, TURN_MS, LEAVE_MS } from './match.js';
import CARDS from '../../../src/js/ikabu/games/cards-data.json';
import EFFECTS from '../../../src/js/ikabu/games/cards-effects.json';

const IDLE_MS = 20 * 60_000;   // これより長く動きが無い部屋は「空き」として作り直してよい
const tokenOf = () => crypto.randomUUID();

export class BattleRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.reset();
  }
  reset() {
    for (const s of ['a', 'b']) { try { this.seats?.[s]?.ws?.close(1000, 'reset'); } catch {} }
    this.seats = { a: null, b: null };   // { token, ws, online }
    this.match = null; this.turnTimer = null; this.leaveTimers = {}; this.touched = Date.now(); this.code = null;
  }
  busy() { return !!this.match && !this.match.over() && Date.now() - this.touched < IDLE_MS; }

  async fetch(req) {
    const url = new URL(req.url);
    // 部屋を確保する（index.js がコードを決めて呼ぶ）。使用中なら 409
    if (url.pathname.endsWith('/claim')) {
      if (this.busy() || (this.seats.a && !this.match && Date.now() - this.touched < 5 * 60_000)) return new Response('busy', { status: 409 });
      this.reset(); this.code = url.searchParams.get('code');
      return new Response('ok');
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    let seat = null;
    server.addEventListener('message', (e) => { try { seat = this.onMessage(server, seat, JSON.parse(e.data)); } catch (err) { this.send(server, { t: 'err', msg: String(err?.message ?? err) }); } });
    server.addEventListener('close', () => this.onClose(server, seat));
    server.addEventListener('error', () => this.onClose(server, seat));
    return new Response(null, { status: 101, webSocket: client });
  }
  send(ws, m) { try { ws?.send(JSON.stringify(m)); } catch {} }
  toSeat(s, m) { const st = this.seats[s]; if (st?.online) this.send(st.ws, m); }
  other(s) { return s === 'a' ? 'b' : 'a'; }

  onMessage(ws, seat, m) {
    this.touched = Date.now();
    if (m.t === 'ping') { this.send(ws, { t: 'pong' }); return seat; }
    if (m.t === 'hello') {
      // 同じ token で戻ってきた（通信が切れた・ページを読み込み直した）
      const back = ['a', 'b'].find((s) => this.seats[s] && m.token && this.seats[s].token === m.token);
      if (back) {
        try { this.seats[back].ws?.close(1000, 'replaced'); } catch {}
        this.seats[back] = { ...this.seats[back], ws, online: true };
        clearTimeout(this.leaveTimers[back]);
        this.send(ws, { t: 'seat', seat: back, token: m.token, code: this.code, started: !!this.match });
        if (this.match) { this.send(ws, { t: 'state', state: this.match.viewFor(back), rejoin: true }); this.toSeat(this.other(back), { t: 'opp', status: 'back' }); }
        return back;
      }
      const free = ['a', 'b'].find((s) => !this.seats[s]);
      if (!free || this.match) { this.send(ws, { t: 'err', msg: 'full' }); try { ws.close(1000, 'full'); } catch {} return null; }
      const token = tokenOf();
      this.seats[free] = { token, ws, online: true };
      this.send(ws, { t: 'seat', seat: free, token, code: this.code, started: false });
      if (this.seats.a && this.seats.b) this.start();
      return free;
    }
    if (!seat) { this.send(ws, { t: 'err', msg: 'noSeat' }); return seat; }
    if (m.t === 'act') {
      if (!this.match) { this.send(ws, { t: 'res', id: m.id, r: { ok: false, why: 'notStarted' } }); return seat; }
      const { r, a } = this.match.act(seat, m);
      if (r.ok && (m.kind === 'end' || this.match.over())) this.armTurn();
      this.send(ws, { t: 'res', id: m.id, r, state: this.match.viewFor(seat) });
      if (r.ok && a) this.toSeat(this.other(seat), { t: 'ev', a, r, state: this.match.viewFor(this.other(seat)) });
      if (this.match.over()) this.finish();
      return seat;
    }
    if (m.t === 'leave') {
      if (this.match && !this.match.over()) { const a = this.match.resign(seat); this.broadcast(a); this.finish(); }
      else if (!this.match) { this.seats[seat] = null; }
      return seat;
    }
    return seat;
  }
  start() {
    this.match = createMatch({ cards: CARDS, effects: EFFECTS, seed: `${this.code}:${Date.now()}` });
    this.armTurn();   // 先に測り始める（状態に締切を入れて送るため）
    for (const s of ['a', 'b']) this.toSeat(s, { t: 'start', you: s, state: this.match.viewFor(s) });
  }
  // 持ち時間：次の席の番が始まった時に測り直す
  armTurn() {
    clearTimeout(this.turnTimer);
    if (!this.match || this.match.over()) { this.match && (this.match.deadline = 0); return; }
    this.match.deadline = Date.now() + TURN_MS;
    this.turnTimer = setTimeout(() => {
      const a = this.match?.autoEnd();
      if (!a) return;
      this.broadcast(a);
      if (this.match.over()) this.finish(); else this.armTurn();
    }, TURN_MS);
  }
  broadcast(a) { for (const s of ['a', 'b']) this.toSeat(s, { t: 'ev', a, r: { ok: true }, state: this.match.viewFor(s) }); }
  finish() { clearTimeout(this.turnTimer); for (const s of ['a', 'b']) clearTimeout(this.leaveTimers[s]); }
  onClose(ws, seat) {
    if (!seat || this.seats[seat]?.ws !== ws) return;
    this.seats[seat].online = false;
    if (!this.match) { this.seats[seat] = null; return; }   // まだ始まっていない：席を空ける
    if (this.match.over()) return;
    this.toSeat(this.other(seat), { t: 'opp', status: 'left', wait: LEAVE_MS });
    clearTimeout(this.leaveTimers[seat]);
    this.leaveTimers[seat] = setTimeout(() => {
      if (this.seats[seat]?.online || !this.match || this.match.over()) return;
      const a = this.match.resign(seat);
      if (a) { this.broadcast(a); this.finish(); }
    }, LEAVE_MS);
  }
}

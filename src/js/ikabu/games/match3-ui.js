// 墨つなぎの画面側。判定は match3.js（純粋ロジック）に任せ、ここは
//   1. タップ・ドラッグ・キーボードを swap / inkFlash に変える
//   2. 返ってきた steps（消えた段階の記録）を1段ずつ見せる（消える→落ちる→連鎖の吹き出し）
//   3. スコア・手数・墨・ヒント・結果カード・バッジ（localStorage）
import { createGame, swap, inkFlash, findHint, adjacent, SIZE, RARE, MOVES, INK_NEED, GOAL, BALL, LINE_V, colorOf, isLine, dailyGoals, starsOf, previewSwap, countColors } from './match3.js';
import { createSfx } from './sumi-sfx.js';
import { createRush, rushSwap, rushFlash, rushHint, rushTick, inked, openBottom, CAP, panicOf } from './inkrush.js';
import { readJSON as readPref, writeJSON as writePref } from './records.js';
import { utcDay } from './rng.js';
import { tileImg, tileSymbol, tileSrc } from './marks.js';
import { M3_TEXT as TX, MARKS, RARE_NAME } from './play-text.js';
import { recordM3, recordRush, emptyM3, KEY_M3, readRecord, writeRecord } from './records.js';
import { t, assetHref } from '../i18n.js';
import { openShareView, shareButtonHTML, shareUrl, sumiText, SHARE_VARIANT } from './share.js';

const N = SIZE * SIZE;
const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise(() => {});

export function mountMatch3(root, { lang = 'ja', demo = null } = {}) {
  if (!root) return null;
  const q = (id) => root.querySelector(`#${id}`);
  const el = {
    board: q('ika-m3-board'), score: q('ika-m3-score'), moves: q('ika-m3-moves'), best: q('ika-m3-best'), goalFill: q('ika-m3-goal-fill'), goalLabel: q('ika-m3-goal-label'), stars: q('ika-m3-stars'),
    inkFill: q('ika-m3-ink-fill'), ink: q('ika-m3-ink'), flash: q('ika-m3-flash'), hint: q('ika-m3-hint'), msg: q('ika-m3-msg'),
    callout: q('ika-m3-callout'), card: q('ika-m3-card'), mode: q('ika-m3-mode'), day: q('ika-m3-day'), badges: q('ika-m3-badges'), wrap: q('ika-m3-wrap'),
    rush: q('ika-m3-rush'), squid: q('ika-m3-rush-squid'), face: q('ika-m3-rush-face'), say: q('ika-m3-rush-say'), pool: q('ika-m3-rush-pool'), next: q('ika-m3-rush-next'), level: q('ika-m3-rush-level'), movesLabel: q('ika-m3-moves-label'), goal: q('ika-m3-goal'),
  };
  const cells = [...el.board.querySelectorAll('.ika-m3-cell')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = (ms) => (reduced ? 0 : ms);
  // 効果音（最初からオン。2026-09-27 ぱっぱ）と、その切り替え
  const sfx = createSfx({ on: readPref('ikabu.sumi.sound') ?? true });
  const soundBtn = q('ika-m3-sound');
  const syncSound = () => { if (!soundBtn) return; soundBtn.setAttribute('aria-pressed', String(sfx.on)); soundBtn.textContent = sfx.on ? '🔊' : '🔇'; soundBtn.title = t(lang, sfx.on ? TX.btn.soundOff : TX.btn.soundOn); };
  soundBtn?.addEventListener('click', () => { sfx.setOn(!sfx.on); writePref('ikabu.sumi.sound', sfx.on); syncSound(); if (sfx.on) sfx.pop(3); });
  syncSound();
  root.addEventListener('pointerdown', () => sfx.unlock(), { once: true, capture: true });
  // 演出の層（墨のしぶき・筆の線・爆発の輪・光の筋・マスコット）。盤面の上に重ねる
  const fxLayer = document.createElement('div');
  fxLayer.className = 'ika-m3-fx';
  fxLayer.setAttribute('aria-hidden', 'true');
  el.wrap.append(fxLayer);

  let rec = { ...emptyM3(), ...(readRecord(KEY_M3).value ?? {}) };   // 2026-09-27：控えから戻せる読み書き
  let g = null;
  let mode = 'daily';
  let shown = [];          // 画面に出ている盤面
  let selected = null;
  let targeting = false;
  let busy = false;
  let cursor = 0;
  let recorded = false;
  let lastResult = null;   // シェアする1戦の結果（share.js）
  let goalSaid = false;    // 目標達成のファンファーレ（1戦に1回）
  let goals = { star: GOAL, goal: GOAL, star3: GOAL };   // その日の盤面の目標（newGame で決める）
  let lastSaid = false;    // 「残り3手！」の知らせ（1戦に1回）
  const isRush = () => mode === 'rush' || mode === 'rushfree';   // 墨のがれ（今日の盤面／別の盤面）
  let mood = 'calm';
  // 墨のがれの時計（第3版・時間制）：100ms ごとに水位が上がる。演出中（busy）は溜めておいて、終わってからまとめて進める。裏のタブでは止まる
  let rushTimer = 0, rushLast = 0, rushPending = 0;
  const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  function stopRushClock() { if (rushTimer) clearInterval(rushTimer); rushTimer = 0; rushPending = 0; }
  function startRushClock() {
    stopRushClock();
    rushLast = performance.now();
    rushTimer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - rushLast) / 1000);
      rushLast = now;
      if (!g || g.over || !isRush() || document.hidden) return;
      rushPending += dt;
      if (busy) return;
      const dtAll = rushPending; rushPending = 0;
      const tk = rushTick(g, dtAll);
      if (tk.events.length || tk.steps.length) rushClockEvents(tk);
      else syncRush();
    }, 100);
  }
  async function rushClockEvents({ events, steps }) {
    busy = true;
    try {
      for (const ev of events) {
        if (ev.type === 'row') {
          // 各列の上から1つずつブロックが降り、空いた所の一番下まで落ちる（道をふさぐ）
          callout(t(lang, TX.rush.lidFall), 'blast');
          sfx.bomb();
          setSelected(null);
          renderBoard(g.board);
          if (!reduced) { const anims = []; for (const l of ev.landed) anims.push(cells[l.at].animate([{ transform: `translateY(${-l.rows * 108}%)` }, { transform: 'translateY(0) scale(1.1, 0.88)', offset: 0.8 }, { transform: 'none' }], { duration: 260 + l.rows * 70, easing: 'ease-in' }).finished); await Promise.all(anims).catch(() => {}); }
          void steps;
          await sleep(dur(150));
        } else if (ev.type === 'stuck') {
          setMsg(t(lang, TX.rush.stuck)); el.board.classList.add('is-shuffle'); await sleep(dur(300)); renderBoard(g.board); el.board.classList.remove('is-shuffle');
        }
      }
    } finally { busy = false; }
    syncHud();
    if (g.over) finish();
  }
  const demoHold = demo === 'chain';

  /* ---------- 盤面の描画 ---------- */
  const kindName = (k) => (k === RARE ? t(lang, RARE_NAME) : k === BALL ? t(lang, TX.panel.ball) : isLine(k) ? `${t(lang, MARKS[colorOf(k)].name)}（${t(lang, k >= LINE_V ? TX.panel.lineV : TX.panel.lineH)}）` : t(lang, MARKS[k].name));
  function paint(i, kind) {
    const c = cells[i];
    const color = colorOf(kind);
    c.dataset.kind = String(color ?? kind);
    c.dataset.special = kind === RARE ? 'rare' : kind === BALL ? 'ball' : isLine(kind) ? (kind >= LINE_V ? 'v' : 'h') : '';
    if (kind === null && isRush()) { const ink = inkedSet.has(i); c.dataset.kind = ink ? 'ink' : 'empty'; c.dataset.special = ''; c.innerHTML = ''; c.setAttribute('aria-label', t(lang, ink ? '墨' : '空き', ink ? 'Ink' : 'Empty')); c.disabled = false; c.classList.toggle('is-out', ink && i >= N - SIZE); return; }
    if (kind === BALL) c.innerHTML = `<img src="${assetHref('/assets/ikabu/tiles/ball_128.webp')}" width="56" height="56" alt="" decoding="async" draggable="false" onerror="this.remove()" /><b class="ika-m3-ballglow" aria-hidden="true"></b><i aria-hidden="true">◎</i>`;
    else c.innerHTML = `${tileImg(color ?? kind, { href: assetHref, size: 56 })}${isLine(kind) ? `<b class="ika-m3-line" aria-hidden="true"></b>` : ''}<i aria-hidden="true">${tileSymbol(color ?? kind)}</i>`;
    c.setAttribute('aria-label', TX.a11y.cell(lang, rowOf(i), colOf(i), kindName(kind)));
    c.disabled = false;
  }
  const INK_SVG = '<svg viewBox="-50 -50 100 100" aria-hidden="true"><path d="M0,-34 C14,-36 22,-22 30,-18 C42,-12 40,4 34,12 C40,24 26,36 14,32 C6,42 -8,40 -14,30 C-28,34 -40,20 -32,8 C-42,-4 -34,-22 -20,-22 C-18,-32 -8,-34 0,-34 Z" fill="#132033"/><ellipse cx="-10" cy="-14" rx="9" ry="5" fill="#ffffff" opacity="0.35"/><circle cx="18" cy="18" r="4" fill="#ffffff" opacity="0.18"/></svg>';
  // 一番下の穴：暗い開口。抜けている間は流れ（ika-m3-flow）がこの上を通る
  const HOLE_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="52" rx="38" ry="30" fill="#061220"/><ellipse cx="50" cy="46" rx="30" ry="20" fill="#0c1b2e"/><path d="M22 70 Q50 92 78 70" fill="none" stroke="#0c1b2e" stroke-width="6" stroke-linecap="round"/></svg>';
  const LID_SVG = '<svg class="ika-m3-inkwave" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true"><path class="ika-m3-wave" d="M0 30 Q25 18 50 30 T100 30 T150 30 T200 30 T250 30 T300 30 V100 H0 Z" fill="#132033"/><path class="ika-m3-wave is-2" d="M0 36 Q25 26 50 36 T100 36 T150 36 T200 36 T250 36 T300 36 V100 H0 Z" fill="#1f3050" opacity="0.55"/></svg>';
  let inkedSet = new Set();
  function renderBoard(board) {
    shown = [...board];
    if (isRush()) inkedSet = new Set(inked(board));
    board.forEach((k, i) => paint(i, k));
  }
  function setCursor(i, focus = true) {
    cells[cursor].tabIndex = -1;
    cursor = i;
    cells[cursor].tabIndex = 0;
    if (focus) cells[cursor].focus({ preventScroll: true });
  }
  const clearCan = () => cells.forEach((c) => c.classList.remove('is-can', 'is-can-special'));
  function setSelected(i) {
    if (selected != null) cells[selected].classList.remove('is-selected');
    clearCan();
    selected = i;
    if (i != null) {
      cells[i].classList.add('is-selected');
      cells[i].setAttribute('aria-selected', 'true');
      // 予告：そろう隣を光らせる。スペシャルが生まれる・使える手はオレンジで強く（2026-09-29）
      let anySpecial = false;
      for (const j of [i - 1, i + 1, i - SIZE, i + SIZE]) {
        if (!adjacent(i, j)) continue;
        const pv = previewSwap(g.board, i, j);
        if (!pv) continue;
        cells[j].classList.add(pv.special ? 'is-can-special' : 'is-can');
        if (pv.special) anySpecial = true;
      }
      setMsg(t(lang, anySpecial ? TX.msg.canSpecial : TX.msg.selected));
    } else {
      cells.forEach((c) => c.removeAttribute('aria-selected'));
    }
  }
  function setMsg(text) { el.msg.textContent = text; }
  let calloutTimer = 0;
  function callout(text, tone = '') {
    el.callout.textContent = text;
    el.callout.className = `ika-m3-callout${tone ? ` is-${tone}` : ''}`;
    el.callout.hidden = false;
    el.callout.classList.remove('is-pop');
    void el.callout.offsetWidth;
    el.callout.classList.add('is-pop');
    clearTimeout(calloutTimer);
    if (!demoHold) calloutTimer = setTimeout(() => { el.callout.hidden = true; }, 1100);
  }

  /* ---------- 演出（2026-09-27）：墨で塗って弾ける・筆・爆発・光の筋・マスコット ---------- */
  const cellBox = (i) => {
    const w = el.wrap.getBoundingClientRect(); const r = cells[i].getBoundingClientRect();
    return { x: r.left - w.left, y: r.top - w.top, w: r.width, h: r.height, cx: r.left - w.left + r.width / 2, cy: r.top - w.top + r.height / 2 };
  };
  const fxEl = (cls, style, html = '') => {
    const e = document.createElement('span');
    e.className = cls;
    Object.assign(e.style, style);
    e.innerHTML = html;
    fxLayer.append(e);
    setTimeout(() => e.remove(), 1400);
    return e;
  };
  // 墨のしぶき（ぽたっ→ぷるんと広がって弾ける＋小さな粒）
  const SPLAT = '<svg viewBox="-50 -50 100 100"><path d="M0,-30 C12,-32 18,-20 26,-18 C36,-15 35,-2 30,5 C38,14 28,28 16,26 C9,36 -7,35 -12,26 C-26,30 -35,18 -28,7 C-38,-2 -31,-18 -19,-18 C-16,-28 -7,-30 0,-30 Z" fill="#2a3a66" opacity="0.72"/><ellipse cx="-9" cy="-12" rx="8" ry="4.5" fill="#ffffff" opacity="0.55"/><circle cx="-36" cy="-30" r="5" fill="#ffffff" opacity="0.9"/><circle cx="38" cy="-28" r="4" fill="#ffffff" opacity="0.9"/><circle cx="34" cy="36" r="5" fill="#ffffff" opacity="0.85"/><circle cx="-32" cy="34" r="3.5" fill="#ffffff" opacity="0.85"/><circle cx="2" cy="-44" r="3" fill="#ffe27a"/><circle cx="-44" cy="4" r="3" fill="#ff9ec7"/><circle cx="44" cy="6" r="3" fill="#8ee6d2"/></svg>';
  function splat(i, delay = 0) {
    if (reduced) return;
    const b = cellBox(i);
    fxEl('ika-m3-splat', { left: `${b.x - b.w * 0.05}px`, top: `${b.y - b.h * 0.05}px`, width: `${b.w * 1.1}px`, height: `${b.h * 1.1}px`, animationDelay: `${delay}ms` }, SPLAT);
  }
  function sweep(f) {
    if (reduced) return;
    const w = el.board.getBoundingClientRect(); const wr = el.wrap.getBoundingClientRect(); const b = cellBox(f.at);
    const style = f.dir === 'h'
      ? { left: `${w.left - wr.left + 6}px`, width: `${w.width - 12}px`, top: `${b.cy - b.h * 0.22}px`, height: `${b.h * 0.44}px`, transformOrigin: `${b.cx - (w.left - wr.left)}px 50%` }
      : { top: `${w.top - wr.top + 6}px`, height: `${w.height - 12}px`, left: `${b.cx - b.w * 0.22}px`, width: `${b.w * 0.44}px`, transformOrigin: `50% ${b.cy - (w.top - wr.top)}px` };
    fxEl(`ika-m3-sweep is-${f.dir}`, style);
  }
  function ring(f) {
    if (reduced) return;
    const b = cellBox(f.at); const R = b.w * (f.r === 2 ? 5.4 : 3.4);
    fxEl('ika-m3-ring', { left: `${b.cx - R / 2}px`, top: `${b.cy - R / 2}px`, width: `${R}px`, height: `${R}px` });
    el.board.classList.remove('is-quake'); void el.board.offsetWidth; el.board.classList.add('is-quake');
  }
  function rays(f) {
    if (reduced) return;
    const a = cellBox(f.at);
    (f.cells ?? []).forEach((j, k) => {
      const b = cellBox(j);
      const len = Math.hypot(b.cx - a.cx, b.cy - a.cy);
      const ang = (Math.atan2(b.cy - a.cy, b.cx - a.cx) * 180) / Math.PI;
      fxEl('ika-m3-ray', { left: `${a.cx}px`, top: `${a.cy - 3}px`, width: `${len}px`, transform: `rotate(${ang}deg)`, animationDelay: `${k * 25}ms` });
    });
  }
  // 墨フラッシュ：マスコットがひょこっと顔を出して「ぶしゅー！」→ 盤面が墨色に
  async function mascotInk() {
    if (reduced) return;
    const m = fxEl('ika-m3-mascot', {}, `<img src="${assetHref('/assets/ikabu/mascot/squirt.webp')}" alt="" /><b>${t(lang, TX.msg.squirt)}</b>`);
    m.addEventListener('animationend', () => m.remove());
    await sleep(480);
    fxEl('ika-m3-tint', {});
    await sleep(260);
  }

  /* ---------- HUD ---------- */
  function syncHud() {
    el.score.textContent = g.score.toLocaleString();
    el.moves.textContent = isRush() ? fmtTime(g.rush.t) : String(g.moves);
    if (isRush()) syncRush();
    el.best.textContent = rec.best.toLocaleString();
    el.goalFill.style.width = `${Math.min(100, (g.score / goals.goal) * 100).toFixed(1)}%`;
    el.goalFill.parentElement.parentElement.classList.toggle('is-reached', g.score >= goals.goal);
    if (el.stars) { const n = starsOf(g.score, goals); el.stars.textContent = '★'.repeat(n) + '☆'.repeat(3 - n); el.stars.dataset.n = String(n); }
    // 残り3手：盤面の縁が脈打ち、手数が赤く大きく（2026-09-29 最後の緊張を作る）
    const last = !g.over && !isRush() && g.moves <= 3;
    root.classList.toggle('is-last', last);
    if (last && !lastSaid) { lastSaid = true; callout(t(lang, TX.hud.lastMoves), 'last'); }
    el.inkFill.style.width = `${Math.min(100, (g.charge / INK_NEED) * 100).toFixed(0)}%`;
    const full = g.charge >= INK_NEED && !g.over;
    if (full && !el.ink.classList.contains('is-full')) sfx.full();
    el.ink.classList.toggle('is-full', full);
    const reachedNow = g.score >= goals.goal;
    if (reachedNow && !goalSaid) {
      goalSaid = true;
      sfx.goal();
      if (!reduced) fxEl('ika-m3-mascot is-side', {}, `<img src="${assetHref('/assets/ikabu/mascot/yatta.webp')}" alt="" /><b>${t(lang, TX.msg.goalNow)}</b>`);
    }
    el.flash.disabled = !full || busy;
    el.flash.textContent = targeting ? t(lang, TX.btn.cancel) : t(lang, TX.btn.flash);
    el.hint.disabled = busy || g.over;
  }
  function syncBadges() {
    el.badges.querySelectorAll('.ika-m3-badge').forEach((li) => {
      const d = rec.badges[li.dataset.badge];
      li.classList.toggle('is-earned', Boolean(d));
      li.querySelector('[data-badge-date]').textContent = d ?? '';
    });
  }

  /* ---------- ゲーム開始 ---------- */
  function newGame() {
    const seed = mode === 'daily' || mode === 'rush' ? utcDay() : `free-${Date.now()}`;
    if (isRush()) { g = createRush({ seed }); goals = { star: GOAL, goal: Infinity, star3: Infinity, model: 0 }; }
    else { g = createGame({ seed }); goals = dailyGoals(seed); }
    if (el.rush) el.rush.hidden = !isRush();
    const rn = root.querySelector('#ika-m3-rush-note'); if (rn) rn.hidden = !isRush();
    if (el.goal) el.goal.hidden = isRush();
    if (el.movesLabel) el.movesLabel.textContent = t(lang, isRush() ? TX.rush.time : TX.hud.moves);
    if (isRush()) startRushClock(); else stopRushClock();
    if (isRush()) { mood = 'calm'; setMood('calm'); }
    if (el.goalLabel) el.goalLabel.textContent = `${t(lang, TX.hud.today)} ${goals.goal.toLocaleString()}`;
    recorded = false;
    goalSaid = false;
    lastSaid = false;
    busy = false; targeting = false;
    el.board.classList.remove('is-targeting');
    setSelected(null);
    el.card.hidden = true;
    el.callout.hidden = true;
    el.day.textContent = mode === 'daily' || mode === 'rush' ? `(${utcDay()} UTC)` : '';
    renderBoard(g.board);
    setCursor(cursor, false);
    setMsg('');
    syncHud();
  }

  /* ---------- 墨のがれ：イカの表情・次の墨・墨メーター（2026-09-29） ---------- */
  const FACE = { calm: 'wink', worry: 'surprise', panic: 'surprise', doom: 'sad', relief: 'banzai', drown: 'sad' };
  function setMood(m, { say = true } = {}) {
    if (!el.squid) return;
    el.squid.dataset.mood = m;
    el.face.src = assetHref(`/assets/ikabu/mascot/${FACE[m] ?? 'wink'}.webp`);
    if (say) el.say.textContent = t(lang, TX.rush.moods[m] ?? TX.rush.moods.calm);
  }
  const moodOf = (p) => (p >= 0.8 ? 'doom' : p >= 0.5 ? 'panic' : p >= 0.25 ? 'worry' : 'calm');
  const flows = new Map();   // 列 → 流れの部品（穴がある間だけ）
  function syncFlows() {
    const hs = isRush() && g && !g.over ? new Set(openBottom(g.board).map((i) => i % SIZE)) : new Set();
    for (const [c, e] of flows) if (!hs.has(c)) { e.remove(); flows.delete(c); }
    if (!hs.size) return;
    const wb = el.board.getBoundingClientRect(); const wr = el.wrap.getBoundingClientRect();
    for (const c of hs) {
      if (flows.has(c)) continue;
      const b = cellBox(c);
      const e = document.createElement('span'); e.className = 'ika-m3-flow';
      const bb = cellBox(N - SIZE + c);
      Object.assign(e.style, { left: `${bb.cx - bb.w * 0.3}px`, top: `${bb.y + bb.h * 0.6}px`, width: `${bb.w * 0.6}px`, height: `${wb.bottom - wr.top - bb.y + 20}px` });
      void b;
      fxLayer.append(e); flows.set(c, e);
    }
  }
  function syncRush() {
    if (!isRush() || !el.rush) { syncFlows(); return; }
    syncFlows();
    const p = panicOf(g);
    el.rush.style.setProperty('--ink', p.toFixed(3));
    el.rush.classList.toggle('is-doom', p >= 0.8 && !g.over);
    root.classList.toggle('is-doom', p >= 0.8 && !g.over);
    if (el.level) el.level.textContent = TX.rush.level(lang, Math.round(g.rush.level), CAP);
    if (el.next) el.next.textContent = g.over ? '' : TX.rush.nextLid(lang, Math.max(0, Math.ceil(g.rush.nextRow - g.rush.t)));
    el.moves.textContent = fmtTime(g.rush.t);
    const m = g.over ? 'drown' : moodOf(p);
    if (m !== mood) { mood = m; setMood(m); }
  }
  // 1手の後の出来事：墨が落ちる（舞台から盤面へ）・手詰まりの混ぜ直し
  async function rushAfter(r) {
    let drained = false;
    for (const ev of r.events ?? []) {
      if (ev.type === 'drain' && ev.amount > 0) {
        // 穴の開いた列に、墨の筋が上から下へ流れる
        if (!reduced) { const wb = el.board.getBoundingClientRect(); const wr = el.wrap.getBoundingClientRect();
          for (const c of ev.cols) { const b = cellBox(c); fxEl('ika-m3-stream', { left: `${b.cx - b.w * 0.3}px`, top: `${wb.top - wr.top}px`, width: `${b.w * 0.6}px`, height: `${wb.height}px` }); } }
        sfx.line();
        callout(TX.rush.drain(lang, ev.amount), 'flash');
        drained = true;
        await sleep(dur(520));
      } else if (ev.type === 'hole') {
        callout(t(lang, TX.rush.lidBreak), 'flash'); sfx.line();
        if (!g.over) { setMood('relief'); await sleep(dur(450)); mood = ''; }
      } else if (ev.type === 'stuck') {
        callout(t(lang, TX.rush.stuck), 'blast');
        await sleep(dur(400));
      }
    }
    if (drained && !g.over) { setMood('relief'); await sleep(dur(450)); mood = ''; }
    syncRush();
  }
  el.mode.addEventListener('click', (e) => {
    const b = e.target.closest('.ika-chip[data-mode]');
    if (!b || busy) return;
    mode = b.dataset.mode;
    el.mode.querySelectorAll('.ika-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    newGame();
  });

  /* ---------- 演出：入れ替え・消える・落ちる ---------- */
  function cellOffset(a, b) {
    const ra = cells[a].getBoundingClientRect();
    const rb = cells[b].getBoundingClientRect();
    return { dx: rb.left - ra.left, dy: rb.top - ra.top };
  }
  async function animSwap(a, b, back = false) {
    if (reduced) return;
    const { dx, dy } = cellOffset(a, b);
    const opts = { duration: 150, easing: 'ease-in-out', fill: 'forwards' };
    const frames = (x, y) => (back ? [{ transform: `translate(${x}px,${y}px)` }, { transform: 'translate(0,0)' }] : [{ transform: 'translate(0,0)' }, { transform: `translate(${x}px,${y}px)` }]);
    const A = cells[a].animate(frames(dx, dy), opts);
    const B = cells[b].animate(frames(-dx, -dy), opts);
    await Promise.all([A.finished, B.finished]).catch(() => {});
    A.cancel(); B.cancel();
  }
  async function shake(a, b) {
    for (const i of [a, b]) cells[i].classList.add('is-shake');
    await sleep(dur(320));
    for (const i of [a, b]) cells[i].classList.remove('is-shake');
  }

  // steps を順に見せる。各段：消えるマスをポップ → 盤面を更新して落とす → 吹き出し
  async function playSteps(steps, shuffled) {
    for (let k = 0; k < steps.length; k++) {
      const st = steps[k];
      const chain = st.kind === 'match' ? st.chain : 0;
      const combo = (st.fx ?? []).find((f) => f.type === 'combo');
      if (st.kind === 'flash') { await mascotInk(); sfx.flash(); callout(t(lang, st.big ? TX.msg.bigSquirt : TX.msg.flash), st.big ? 'huge' : 'flash'); }
      else if (combo) { callout(t(lang, TX.combo[combo.name] ?? TX.msg.blast), 'combo'); sfx.combo(); }
      else if (st.kind === 'blast') callout(t(lang, TX.msg.blast), 'blast');
      else if (chain >= 2) callout(lang === 'en' ? `${chain}${t(lang, TX.msg.chain)}` : `${chain}${t(lang, TX.msg.chain)}`, chain >= 4 ? 'huge' : chain >= 3 ? 'big' : 'chain');
      if (demoHold && chain >= 2) await never();   // 開発用：連鎖の吹き出しで止める
      // スペシャルの演出と音（ライン＝筆、レアイカ＝爆発の輪、墨ダマ＝光の筋）
      for (const f of st.fx ?? []) {
        if (f.type === 'line') { sweep(f); sfx.line(); }
        else if (f.type === 'bomb') { ring(f); sfx.bomb(); }
        else if (f.type === 'ball') { rays(f); sfx.ball(); }
      }
      // 消える：墨で塗られて、ぷるんと弾ける。墨フラッシュは順番に「ぽ・ぽ・ぽ」
      const seq = st.kind === 'flash';
      if (!seq) sfx.pop(Math.max(1, st.chain ?? 1));
      st.cleared.forEach((i, k) => {
        const delay = seq ? k * 45 : 0;
        splat(i, delay);
        if (seq) setTimeout(() => sfx.popSeq(k), delay);
        if (delay) setTimeout(() => cells[i].classList.add('is-clear'), delay); else cells[i].classList.add('is-clear');
      });
      if (st.points && !reduced && st.cleared.length) {
        const bx = st.cleared.map(cellBox); const cx = bx.reduce((a, b) => a + b.cx, 0) / bx.length; const cy = bx.reduce((a, b) => a + b.cy, 0) / bx.length;
        const sb = el.score.getBoundingClientRect(); const wb = el.wrap.getBoundingClientRect();
        const e = fxEl(`ika-m3-pts${(st.chain ?? 1) >= 3 || st.kind !== 'match' ? ' is-big' : ''}`, { left: `${cx}px`, top: `${cy}px` }, `+${st.points.toLocaleString()}`);
        e.style.setProperty('--fly-x', `${sb.left + sb.width / 2 - wb.left - cx}px`); e.style.setProperty('--fly-y', `${sb.top + sb.height / 2 - wb.top - cy}px`);
      }
      await sleep(dur(seq ? 300 + st.cleared.length * 45 : 300));
      for (const i of st.cleared) cells[i].classList.remove('is-clear');
      // 落ちる距離：消したあとの列を下に詰めた結果が st.board。生き残りは元の行との差、新しいマークは上から
      const after = [...shown];
      for (const i of st.cleared) after[i] = null;
      for (const c of st.created) after[c.at] = c.kind;
      const drops = new Array(N).fill(0);
      for (let c = 0; c < SIZE && !g.noRefill; c++) {
        const survivors = [];
        for (let r = SIZE - 1; r >= 0; r--) if (after[r * SIZE + c] !== null) survivors.push(r);
        const fresh = SIZE - survivors.length;
        for (let r = SIZE - 1, j = 0; r >= 0; r--, j++) drops[r * SIZE + c] = j < survivors.length ? r - survivors[j] : fresh;
      }
      renderBoard(st.board);
      for (const c of st.created) cells[c.at].classList.add('is-born');
      if (st.created.length) {
        const k = st.created[0].kind;
        callout(t(lang, k === RARE ? TX.msg.rare : k === BALL ? TX.panel.ballBorn : TX.panel.lineBorn), 'rare');
        sfx.born();
      }
      const anims = [];
      if (!reduced) {
        for (let i = 0; i < N; i++) {
          if (!drops[i]) continue;
          // 落ちて、着地でつぶれて「ぶるん」と揺れて戻る（グミのように。2026-09-27 ぱっぱ）
          const fall = 150 + drops[i] * 70;
          const total = fall + 320;
          const k = fall / total;
          anims.push(cells[i].animate([
            { transform: `translateY(${-drops[i] * 108}%) scale(0.96, 1.06)`, offset: 0 },
            { transform: 'translateY(0) scale(1.14, 0.84)', offset: k },
            { transform: 'translateY(-4%) scale(0.92, 1.08)', offset: k + (1 - k) * 0.35 },
            { transform: 'translateY(0) scale(1.05, 0.96)', offset: k + (1 - k) * 0.65 },
            { transform: 'translateY(0) scale(1, 1)', offset: 1 },
          ], { duration: total, easing: 'ease-in', composite: 'replace' }).finished);
          // 真下の動かなかったコマに、着地の揺れが伝わる
          const below = i + SIZE;
          if (below < N && !drops[below] && rowOf(i) === rowOf(below) - 1) {
            cells[below].animate([
              { transform: 'scale(1,1)' }, { transform: 'scale(1.08, 0.9)', offset: 0.35 }, { transform: 'scale(0.97, 1.03)', offset: 0.7 }, { transform: 'scale(1,1)' },
            ], { duration: 300, delay: fall, easing: 'ease-out' });
          }
        }
      }
      g.score; // 段ごとに点を足して見せる
      el.score.textContent = steps.slice(0, k + 1).reduce((sum, x) => sum + x.points, g.score - steps.reduce((sum, x) => sum + x.points, 0)).toLocaleString();
      await Promise.all(anims).catch(() => {});
      for (const c of st.created) cells[c.at].classList.remove('is-born');
    }
    if (shuffled) {
      setMsg(t(lang, TX.msg.shuffled));
      el.board.classList.add('is-shuffle');
      await sleep(dur(300));
      renderBoard(g.board);
      el.board.classList.remove('is-shuffle');
    }
  }

  async function trySwap(a, b) {
    if (busy || g.over || !adjacent(a, b)) return;
    busy = true;
    syncHud();
    setSelected(null);
    await animSwap(a, b);
    const r = isRush() ? rushSwap(g, a, b) : swap(g, a, b);
    if (!r.ok) {
      await animSwap(a, b, true);
      sfx.nope();
      await shake(a, b);
      setMsg(t(lang, TX.msg.nomatch));
      busy = false;
      syncHud();
      return;
    }
    // 入れ替えは成立：見た目も入れ替えてから段階を見せる
    [shown[a], shown[b]] = [shown[b], shown[a]];
    if (isRush()) renderBoard(shown); else { paint(a, shown[a]); paint(b, shown[b]); }
    setMsg('');
    await playSteps(r.steps, r.shuffled);
    if (isRush()) await rushAfter(r);
    busy = false;
    syncHud();
    if (g.over) finish();
  }
  async function useFlash(i) {
    if (busy || g.over) return;
    busy = true;
    targeting = false;
    el.board.classList.remove('is-targeting');
    syncHud();
    const r = isRush() ? rushFlash(g, i) : inkFlash(g, i);
    if (r.ok) await playSteps(r.steps, r.shuffled);
    if (r.ok && isRush()) await rushAfter(r);
    busy = false;
    syncHud();
    setMsg('');
    if (g.over) finish();
  }

  /* ---------- 結果とバッジ ---------- */
  function finish() {
    if (recorded) return;
    recorded = true;
    if (isRush()) { finishRush(); return; }
    const { rec: r, fresh } = recordM3(rec, g, { day: mode === 'daily' ? utcDay() : null });
    rec = r;
    writeRecord(KEY_M3, rec);
    syncBadges();
    syncHud();
    const R = TX.result;
    const reached = g.score >= goals.goal;
    const n = starsOf(g.score, goals);
    const next = n === 0 ? goals.star : n === 1 ? goals.goal : n === 2 ? goals.star3 : null;
    const starLine = next == null ? t(lang, R.perfect) : `${t(lang, R.toNext)} ${(next - g.score).toLocaleString()}`;
    // 最後の1手で目標を超えた：墨が画面いっぱいに（2026-09-29）
    if (reached && !reduced && g.moves === 0) fxEl('ika-m3-tint is-big', {});
    el.card.innerHTML = `
      <img class="ika-m3-card-mascot" src="${assetHref(`/assets/ikabu/mascot/${reached ? 'yatta' : 'sad'}.webp`)}" alt="" width="96" height="100" />
      <p class="ika-m3-card-title">${t(lang, R.title)}</p>
      <p class="ika-m3-card-score"><b>${g.score.toLocaleString()}</b><span class="ika-tag ${reached ? 'ika-tag--orange' : ''}">${reached ? t(lang, R.reached) : `${t(lang, R.missed)} ${(goals.goal - g.score).toLocaleString()}`}</span></p>
      <p class="ika-m3-card-stars"><span>${t(lang, R.stars)}</span><b data-n="${n}">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</b><small>${starLine}</small></p>
      <dl class="ika-m3-card-rows"><div><dt>${t(lang, TX.hud.model)}</dt><dd>${goals.model.toLocaleString()}</dd></div><div><dt>${t(lang, R.maxChain)}</dt><dd>${g.maxChain}</dd></div><div><dt>${t(lang, R.flashes)}</dt><dd>${g.flashes}</dd></div></dl>
      ${fresh.length ? `<p class="ika-m3-card-badges"><span>${t(lang, R.newBadge)}</span>${fresh.map((id) => `<b>★ ${t(lang, TX.badges[id].name)}</b>`).join('')}</p>` : ''}
      <div class="ika-m3-card-actions">
        <button type="button" class="ika-btn ika-btn--primary" data-again>${t(lang, TX.btn.restart)}</button>
        ${mode === 'daily' ? `<button type="button" class="ika-btn" data-free>${t(lang, TX.mode.free)}</button>` : ''}
        ${shareButtonHTML(lang)}
      </div>`;
    // シェア用（2026-09-27）：この1戦の結果
    lastResult = { score: g.score, reached, goal: goals.goal, maxChain: g.maxChain, flashes: g.flashes, daily: mode === 'daily', day: utcDay(), newBadges: fresh.map((id) => t(lang, TX.badges[id].name)) };
    el.card.hidden = false;
    el.card.querySelector('[data-again]')?.focus({ preventScroll: true });
  }
  function finishRush() {
    rec = recordRush(rec, g, { day: mode === 'rush' ? utcDay() : null });
    writeRecord(KEY_M3, rec);
    syncHud();
    const R = TX.rush;
    stopRushClock();
    syncFlows();
    const turns = Math.floor(g.rush.t);
    const best = rec.rush?.best ?? 0;
    if (!reduced) fxEl('ika-m3-tint is-big', {});
    el.card.innerHTML = `
      <img class="ika-m3-card-mascot" src="${assetHref('/assets/ikabu/mascot/sad.webp')}" alt="" width="96" height="100" />
      <p class="ika-m3-card-title">${t(lang, R.overTitle)} <small>${t(lang, R.overSub)}</small></p>
      <p class="ika-m3-card-score"><b>${fmtTime(turns)}</b><span class="ika-tag ${turns >= best ? 'ika-tag--orange' : ''}">${t(lang, R.time)}${turns >= best && turns > 0 ? ' ★' : ''}</span></p>
      <dl class="ika-m3-card-rows"><div><dt>${t(lang, R.flushed)}</dt><dd>${Math.round(g.rush.flushed)}</dd></div><div><dt>${t(lang, TX.hud.score)}</dt><dd>${g.score.toLocaleString()}</dd></div><div><dt>${t(lang, R.bestTurns)}</dt><dd>${fmtTime(best)}</dd></div></dl>
      <div class="ika-m3-card-actions">
        <button type="button" class="ika-btn ika-btn--primary" data-again>${t(lang, mode === 'rush' ? R.again : TX.btn.restart)}</button>
        <button type="button" class="ika-btn" data-rushfree>${t(lang, R.free)}</button>
      </div>`;
    lastResult = null;
    el.card.hidden = false;
    el.card.querySelector('[data-again]')?.focus({ preventScroll: true });
  }
  el.card.addEventListener('click', (e) => {
    if (e.target.closest('[data-rushfree]')) { mode = 'rushfree'; el.mode.querySelectorAll('.ika-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.mode === 'rush'))); newGame(); return; }
    if (e.target.closest('[data-share]')) {
      if (!lastResult) return;
      const r = lastResult;
      const dayLabel = r.day.replace(/-/g, '/').replace(/\/0/g, '/');
      openShareView({ lang, button: e.target.closest('[data-share]'), text: sumiText(lang, { score: r.score, daily: r.daily, dayLabel }), url: shareUrl(lang, 'sumi'),
        draw: async () => (await import('./share-card.js')).drawSumiCard({ score: r.score, goal: r.goal ?? GOAL, reached: r.reached, maxChain: r.maxChain, flashes: r.flashes, daily: r.daily, dayLabel, newBadges: r.newBadges },
          { lang, assetHref, variant: SHARE_VARIANT }) });
      return;
    }
    if (e.target.closest('[data-again]')) newGame();
    else if (e.target.closest('[data-free]')) {
      mode = 'free';
      el.mode.querySelectorAll('.ika-chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.mode === 'free')));
      newGame();
    }
  });

  /* ---------- 入力：タップ・ドラッグ・キーボード ---------- */
  let drag = null;
  el.board.addEventListener('pointerdown', (e) => {
    const c = e.target.closest('.ika-m3-cell');
    if (!c || busy) return;
    drag = { i: Number(c.dataset.i), x: e.clientX, y: e.clientY, done: false };
  });
  el.board.addEventListener('pointermove', (e) => {
    if (!drag || drag.done) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) < 18) return;
    drag.done = true;
    const i = drag.i;
    let j = -1;
    if (Math.abs(dx) > Math.abs(dy)) j = dx > 0 ? (colOf(i) < SIZE - 1 ? i + 1 : -1) : (colOf(i) > 0 ? i - 1 : -1);
    else j = dy > 0 ? (rowOf(i) < SIZE - 1 ? i + SIZE : -1) : (rowOf(i) > 0 ? i - SIZE : -1);
    if (j >= 0 && !targeting) { setCursor(i, false); trySwap(i, j); }
  });
  const endDrag = () => { if (drag?.done) setTimeout(() => { drag = null; }, 0); else drag = null; };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  el.board.addEventListener('click', (e) => {
    const c = e.target.closest('.ika-m3-cell');
    if (!c || busy || g.over) return;
    if (drag?.done) return;   // ドラッグで入れ替えた直後の click は無視
    const i = Number(c.dataset.i);
    setCursor(i, false);
    if (targeting) { useFlash(i); return; }
    if (selected == null) setSelected(i);
    else if (selected === i) { setSelected(null); setMsg(''); }
    else if (adjacent(selected, i)) trySwap(selected, i);
    else setSelected(i);
  });
  el.board.addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SIZE, ArrowDown: SIZE };
    if (e.key in moves) {
      e.preventDefault();
      const j = cursor + moves[e.key];
      if (j < 0 || j >= N) return;
      if ((e.key === 'ArrowLeft' && colOf(cursor) === 0) || (e.key === 'ArrowRight' && colOf(cursor) === SIZE - 1)) return;
      setCursor(j);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (targeting) { targeting = false; el.board.classList.remove('is-targeting'); setMsg(''); syncHud(); }
      setSelected(null);
    }
  });
  el.flash.addEventListener('click', () => {
    if (busy || g.over) return;
    targeting = !targeting;
    el.board.classList.toggle('is-targeting', targeting);
    if (targeting) { const n = countColors(g.board); cells.forEach((c, i) => { const col = colorOf(g.board[i]); if (col != null) c.dataset.count = String(n[col]); else delete c.dataset.count; }); }
    else cells.forEach((c) => delete c.dataset.count);
    setSelected(null);
    setMsg(targeting ? t(lang, TX.msg.pick) : '');
    syncHud();
    if (targeting) setCursor(cursor);
  });
  el.hint.addEventListener('click', () => {
    if (busy || g.over) return;
    const h = isRush() ? rushHint(g.board) : findHint(g.board);
    if (!h) return;
    for (const i of h) cells[i].classList.add('is-hint');
    setMsg(t(lang, TX.msg.hint));
    setTimeout(() => { for (const i of h) cells[i].classList.remove('is-hint'); }, 1800);
  });

  /* ---------- 開発用：場面を作る ---------- */
  function runDemo(name) {
    if (name === 'chain') {
      // 2段以上連鎖する入れ替えがある種を探し、その手を打つ
      for (let sd = 0; sd < 300; sd++) {
        for (let i = 0; i < N; i++) {
          for (const j of [i + 1, i + SIZE]) {
            if (!adjacent(i, j)) continue;
            const trial = createGame({ seed: `demo-${sd}` });
            const r = swap(trial, i, j);
            if (r.ok && r.steps.length >= 2) {
              g = createGame({ seed: `demo-${sd}` });
              renderBoard(g.board);
              syncHud();
              trySwap(i, j);
              return;
            }
          }
        }
      }
    } else if (name === 'ink') {
      g.charge = INK_NEED;
      syncHud();
      el.flash.click();
    } else if (name === 'over') {
      g.moves = 1;
      g.score = 1720; g.maxChain = 3; g.flashes = 1;
      const h = findHint(g.board);
      trySwap(h[0], h[1]);
    }
  }

  /* ---------- 起動：コマの絵を先に読んでから盤面を出す（ポップインしないように。2秒で諦めて出す） ---------- */
  async function preloadTiles() {
    const srcs = [...[0, 1, 2, 3, 4, RARE].map((k) => tileSrc(k, 128)), '/assets/ikabu/tiles/ball_128.webp', '/assets/ikabu/mascot/squirt.webp'];
    const jobs = srcs.map((src) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = () => res();
      im.src = assetHref(src);
    }));
    await Promise.race([Promise.all(jobs), sleep(2000)]);
  }
  newGame();
  syncBadges();
  preloadTiles().then(() => {
    renderBoard(g.board);
    if (demo) runDemo(demo);
  });

  return { get game() { return g; }, newGame, trySwap, useFlash, ...(import.meta.env.DEV ? { repaint: () => renderBoard(g.board) } : {}) };   // repaint：開発時だけ（盤面を書き換えて撮る）
}

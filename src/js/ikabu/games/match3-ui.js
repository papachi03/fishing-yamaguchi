// 墨つなぎの画面側。判定は match3.js（純粋ロジック）に任せ、ここは
//   1. タップ・ドラッグ・キーボードを swap / inkFlash に変える
//   2. 返ってきた steps（消えた段階の記録）を1段ずつ見せる（消える→落ちる→連鎖の吹き出し）
//   3. スコア・手数・墨・ヒント・結果カード・バッジ（localStorage）
import { createGame, swap, inkFlash, findHint, adjacent, SIZE, RARE, MOVES, INK_NEED, GOAL } from './match3.js';
import { utcDay } from './rng.js';
import { tileImg, tileSymbol, tileSrc } from './marks.js';
import { M3_TEXT as TX, MARKS, RARE_NAME } from './play-text.js';
import { readJSON, writeJSON, recordM3, emptyM3, KEY_M3 } from './records.js';
import { t, assetHref } from '../i18n.js';
import { openX, saveImage, shareButtonHTML, shareAfterHTML, shareUrl, sumiText, SHARE_VARIANT } from './share.js';

const N = SIZE * SIZE;
const rowOf = (i) => Math.floor(i / SIZE);
const colOf = (i) => i % SIZE;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise(() => {});

export function mountMatch3(root, { lang = 'ja', demo = null } = {}) {
  if (!root) return null;
  const q = (id) => root.querySelector(`#${id}`);
  const el = {
    board: q('ika-m3-board'), score: q('ika-m3-score'), moves: q('ika-m3-moves'), best: q('ika-m3-best'), goalFill: q('ika-m3-goal-fill'),
    inkFill: q('ika-m3-ink-fill'), ink: q('ika-m3-ink'), flash: q('ika-m3-flash'), hint: q('ika-m3-hint'), msg: q('ika-m3-msg'),
    callout: q('ika-m3-callout'), card: q('ika-m3-card'), mode: q('ika-m3-mode'), day: q('ika-m3-day'), badges: q('ika-m3-badges'), wrap: q('ika-m3-wrap'),
  };
  const cells = [...el.board.querySelectorAll('.ika-m3-cell')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = (ms) => (reduced ? 0 : ms);

  let rec = readJSON(KEY_M3) ?? emptyM3();
  let g = null;
  let mode = 'daily';
  let shown = [];          // 画面に出ている盤面
  let selected = null;
  let targeting = false;
  let busy = false;
  let cursor = 0;
  let recorded = false;
  let lastResult = null;   // シェアする1戦の結果（share.js）
  const demoHold = demo === 'chain';

  /* ---------- 盤面の描画 ---------- */
  const kindName = (k) => (k === RARE ? t(lang, RARE_NAME) : t(lang, MARKS[k].name));
  function paint(i, kind) {
    const c = cells[i];
    c.dataset.kind = String(kind);
    c.innerHTML = `${tileImg(kind, { href: assetHref, size: 56 })}<i aria-hidden="true">${tileSymbol(kind)}</i>`;
    c.setAttribute('aria-label', TX.a11y.cell(lang, rowOf(i), colOf(i), kindName(kind)));
    c.disabled = false;
  }
  function renderBoard(board) {
    shown = [...board];
    board.forEach((k, i) => paint(i, k));
  }
  function setCursor(i, focus = true) {
    cells[cursor].tabIndex = -1;
    cursor = i;
    cells[cursor].tabIndex = 0;
    if (focus) cells[cursor].focus({ preventScroll: true });
  }
  function setSelected(i) {
    if (selected != null) cells[selected].classList.remove('is-selected');
    selected = i;
    if (i != null) {
      cells[i].classList.add('is-selected');
      cells[i].setAttribute('aria-selected', 'true');
      setMsg(t(lang, TX.msg.selected));
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

  /* ---------- HUD ---------- */
  function syncHud() {
    el.score.textContent = g.score.toLocaleString();
    el.moves.textContent = String(g.moves);
    el.best.textContent = rec.best.toLocaleString();
    el.goalFill.style.width = `${Math.min(100, (g.score / GOAL) * 100).toFixed(1)}%`;
    el.goalFill.parentElement.parentElement.classList.toggle('is-reached', g.score >= GOAL);
    el.inkFill.style.width = `${Math.min(100, (g.charge / INK_NEED) * 100).toFixed(0)}%`;
    const full = g.charge >= INK_NEED && !g.over;
    el.ink.classList.toggle('is-full', full);
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
    const seed = mode === 'daily' ? utcDay() : `free-${Date.now()}`;
    g = createGame({ seed });
    recorded = false;
    busy = false; targeting = false;
    el.board.classList.remove('is-targeting');
    setSelected(null);
    el.card.hidden = true;
    el.callout.hidden = true;
    el.day.textContent = mode === 'daily' ? `(${utcDay()} UTC)` : '';
    renderBoard(g.board);
    setCursor(cursor, false);
    setMsg('');
    syncHud();
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
      if (st.kind === 'blast') callout(t(lang, TX.msg.blast), 'blast');
      else if (st.kind === 'flash') callout(t(lang, TX.msg.flash), 'flash');
      else if (chain >= 2) callout(lang === 'en' ? `${chain}${t(lang, TX.msg.chain)}` : `${chain}${t(lang, TX.msg.chain)}`, chain >= 3 ? 'big' : 'chain');
      if (demoHold && chain >= 2) await never();   // 開発用：連鎖の吹き出しで止める
      // 消える
      for (const i of st.cleared) cells[i].classList.add('is-clear');
      await sleep(dur(260));
      for (const i of st.cleared) cells[i].classList.remove('is-clear');
      // 落ちる距離：消したあとの列を下に詰めた結果が st.board。生き残りは元の行との差、新しいマークは上から
      const after = [...shown];
      for (const i of st.cleared) after[i] = null;
      for (const c of st.created) after[c.at] = c.kind;
      const drops = new Array(N).fill(0);
      for (let c = 0; c < SIZE; c++) {
        const survivors = [];
        for (let r = SIZE - 1; r >= 0; r--) if (after[r * SIZE + c] !== null) survivors.push(r);
        const fresh = SIZE - survivors.length;
        for (let r = SIZE - 1, j = 0; r >= 0; r--, j++) drops[r * SIZE + c] = j < survivors.length ? r - survivors[j] : fresh;
      }
      renderBoard(st.board);
      for (const c of st.created) cells[c.at].classList.add('is-born');
      if (st.created.length) callout(t(lang, TX.msg.rare), 'rare');
      const anims = [];
      if (!reduced) {
        for (let i = 0; i < N; i++) {
          if (!drops[i]) continue;
          anims.push(cells[i].animate([{ transform: `translateY(${-drops[i] * 100}%)` }, { transform: 'translateY(0)' }], { duration: 120 + drops[i] * 60, easing: 'cubic-bezier(0.3, 0.8, 0.4, 1.05)' }).finished);
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
    const r = swap(g, a, b);
    if (!r.ok) {
      await animSwap(a, b, true);
      await shake(a, b);
      setMsg(t(lang, TX.msg.nomatch));
      busy = false;
      syncHud();
      return;
    }
    // 入れ替えは成立：見た目も入れ替えてから段階を見せる
    [shown[a], shown[b]] = [shown[b], shown[a]];
    paint(a, shown[a]); paint(b, shown[b]);
    setMsg('');
    await playSteps(r.steps, r.shuffled);
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
    const r = inkFlash(g, i);
    if (r.ok) await playSteps(r.steps, r.shuffled);
    busy = false;
    syncHud();
    setMsg('');
  }

  /* ---------- 結果とバッジ ---------- */
  function finish() {
    if (recorded) return;
    recorded = true;
    const { rec: r, fresh } = recordM3(rec, g, { day: mode === 'daily' ? utcDay() : null });
    rec = r;
    writeJSON(KEY_M3, rec);
    syncBadges();
    syncHud();
    const R = TX.result;
    const reached = g.score >= GOAL;
    el.card.innerHTML = `
      <p class="ika-m3-card-title">${t(lang, R.title)}</p>
      <p class="ika-m3-card-score"><b>${g.score.toLocaleString()}</b><span class="ika-tag ${reached ? 'ika-tag--orange' : ''}">${reached ? t(lang, R.reached) : `${t(lang, R.missed)} ${(GOAL - g.score).toLocaleString()}`}</span></p>
      <dl class="ika-m3-card-rows"><div><dt>${t(lang, R.maxChain)}</dt><dd>${g.maxChain}</dd></div><div><dt>${t(lang, R.flashes)}</dt><dd>${g.flashes}</dd></div><div><dt>${t(lang, TX.hud.best)}</dt><dd>${rec.best.toLocaleString()}</dd></div></dl>
      ${fresh.length ? `<p class="ika-m3-card-badges"><span>${t(lang, R.newBadge)}</span>${fresh.map((id) => `<b>★ ${t(lang, TX.badges[id].name)}</b>`).join('')}</p>` : ''}
      <div class="ika-m3-card-actions">
        <button type="button" class="ika-btn ika-btn--primary" data-again>${t(lang, TX.btn.restart)}</button>
        ${mode === 'daily' ? `<button type="button" class="ika-btn" data-free>${t(lang, TX.mode.free)}</button>` : ''}
        ${shareButtonHTML(lang)}
      </div>
      ${shareAfterHTML()}`;
    // シェア用（2026-09-27）：この1戦の結果
    lastResult = { score: g.score, reached, maxChain: g.maxChain, flashes: g.flashes, daily: mode === 'daily', day: utcDay(), newBadges: fresh.map((id) => t(lang, TX.badges[id].name)) };
    el.card.hidden = false;
    el.card.querySelector('[data-again]')?.focus({ preventScroll: true });
  }
  el.card.addEventListener('click', (e) => {
    if (e.target.closest('[data-share]')) {
      if (!lastResult) return;
      const r = lastResult;
      const dayLabel = r.day.replace(/-/g, '/').replace(/\/0/g, '/');
      const button = e.target.closest('[data-share]');
      if (button.dataset.share === 'x') openX(sumiText(lang, { score: r.score, daily: r.daily, dayLabel }), shareUrl(lang, 'sumi'));
      else saveImage({ lang, button, after: el.card.querySelector('[data-share-after]'), filename: `ikabu-sumi-${r.score}.png`,
        draw: async () => (await import('./share-card.js')).drawSumiCard({ score: r.score, goal: GOAL, reached: r.reached, maxChain: r.maxChain, flashes: r.flashes, daily: r.daily, dayLabel, newBadges: r.newBadges },
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
    setSelected(null);
    setMsg(targeting ? t(lang, TX.msg.pick) : '');
    syncHud();
    if (targeting) setCursor(cursor);
  });
  el.hint.addEventListener('click', () => {
    if (busy || g.over) return;
    const h = findHint(g.board);
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
    const jobs = [0, 1, 2, 3, 4, RARE].map((k) => new Promise((res) => {
      const im = new Image();
      im.onload = im.onerror = () => res();
      im.src = assetHref(tileSrc(k, 128));
    }));
    await Promise.race([Promise.all(jobs), sleep(2000)]);
  }
  newGame();
  syncBadges();
  preloadTiles().then(() => {
    renderBoard(g.board);
    if (demo) runDemo(demo);
  });

  return { get game() { return g; }, newGame, trySwap, useFlash };
}

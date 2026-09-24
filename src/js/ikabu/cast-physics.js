// 投げの物理（あそび場のエギングゲームと HERO の投げ直しで共有）。DOM には触らない。
//
// 本物のキャストの見え方（ぱっぱ＝エギンガーの指摘）：
//   1. 振りかぶると竿先は上・後ろへ。エギはタラシ（短い糸）の先で振り子のように遅れて後ろへついていく
//   2. 竿を前へ振ると、遅れたエギが遠心力で頭の上を回り、竿が 10〜11 時の向きを通る頃に放たれる
//   3. 放たれたエギは前上方向の速さで飛び、重力と空気抵抗でゆるい放物線を描いて着水する
//   「浮き上がってから真下に落ちる」動きは絶対にしない

// タラシの先のエギ：竿先とひもでつながった質点（ベルレ積分＋ひもの長さの拘束）。
// 竿先が速く動くほど遅れて振り回される＝遠心力の見え方がそのまま出る
export function createPendulum(len) {
  const P = { x: 0, y: 0, px: 0, py: 0, ready: false, vx: 0, vy: 0 };
  return {
    get pos() { return { x: P.x, y: P.y }; },
    get vel() { return { x: P.vx, y: P.vy }; },
    // 竿先の真下に垂らした状態から始める
    reset(tip) {
      P.x = tip.x; P.y = tip.y + len; P.px = P.x; P.py = P.y; P.vx = 0; P.vy = 0; P.ready = true;
    },
    // tip：今の竿先、dt：秒。g は画面の見え方に合わせた重力（px/s²）
    step(tip, dt, g = 1500) {
      if (!P.ready) this.reset(tip);
      const n = 4;                           // 細かく刻んで安定させる
      const h = Math.min(dt, 0.05) / n;
      for (let i = 0; i < n; i++) {
        const vx = (P.x - P.px) * 0.995;
        const vy = (P.y - P.py) * 0.995;
        P.px = P.x; P.py = P.y;
        P.x += vx; P.y += vy + g * h * h;
        // ひもは伸びない（縮むのは自由＝たるむ）
        const dx = P.x - tip.x, dy = P.y - tip.y;
        const d = Math.hypot(dx, dy);
        if (d > len) { P.x = tip.x + (dx / d) * len; P.y = tip.y + (dy / d) * len; }
      }
      P.vx = (P.x - P.px) / h; P.vy = (P.y - P.py) / h;
      return this.pos;
    },
  };
}

// 前へ振る竿の動き（0→1）：ためてから一気に加速し、止まり際に少し行き過ぎて戻る
export function swingEase(k) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  if (k < 0.72) return (k / 0.72) ** 2.6 * 1.0;
  const u = (k - 0.72) / 0.28;
  return 1 + 0.09 * Math.sin(Math.PI * u) * (1 - u * 0.5);
}

// 放物線：from（放つ点）→ to（着水点）。k は 0→1。
// 空気抵抗のぶん、前半は速く進み後半は遅くなって落ち際が立つ。apex は直線より上に持ち上げる高さ（px）
export function flightPoint(from, to, k, apex) {
  k = Math.max(0, Math.min(1, k));
  const kx = k * (1.5 - 0.5 * k);                        // 横：放たれた直後が一番速い（微分 1.5 → 0.5）
  const lift = Math.sin(Math.PI * k) ** 0.9 * (1 - 0.18 * k);   // 縦：山は少し手前、落ち際は急
  return { x: from.x + (to.x - from.x) * kx, y: from.y + (to.y - from.y) * k - apex * lift };
}

// 飛ぶ向き（度）：+y を尻とする部品を、進む向きの反対に尻を向けて回す
export function headingDeg(from, to, k, apex) {
  const a = flightPoint(from, to, k, apex);
  const b = flightPoint(from, to, Math.min(1, k + 0.02), apex);
  const vx = b.x - a.x, vy = b.y - a.y;
  const L = Math.hypot(vx, vy) || 1;
  return (Math.atan2(vx / L, vy / L) * 180) / Math.PI;   // (−sinθ, cosθ) = −v̂
}

// 飛ぶ時間（秒）と山の高さ：フルキャストは高く長く「ふわっと」（≈2.1秒）、弱い投げは低く短いロブ（≈0.7秒）。
// dist01 は 0〜1 に正規化した飛距離。apex は放つ点と着水点を結ぶ直線からの持ち上げ（px）
export const flightTime = (dist01) => 0.7 + 1.4 * Math.max(0, Math.min(1, dist01));
export const flightApex = (dist01, scale = 1) => (40 + 200 * Math.max(0, Math.min(1, dist01))) * scale;

// 飛んでいるエギを追う糸：竿先から出ていく糸が長く垂れ、エギの後ろへ流れる（スプールから引き出される見え方）。
// vdir はエギの進行方向（単位ベクトル）、k は飛びの進み（0→1）で、進むほど糸が多く出てたるむ
export function trailingLineD(tip, egi, vdir, k, sway = 0) {
  const L = Math.hypot(egi.x - tip.x, egi.y - tip.y) || 1;
  const out = 0.25 + 0.55 * k;                        // 出ている糸の量（たるみの深さ）
  const c1 = { x: tip.x + (egi.x - tip.x) * 0.3 + sway, y: tip.y + (egi.y - tip.y) * 0.3 + L * 0.28 * out };
  const c2 = { x: egi.x - vdir.x * L * 0.32, y: egi.y - vdir.y * L * 0.32 + L * 0.12 * out };
  const f = (v) => v.toFixed(1);
  return `M${f(tip.x)},${f(tip.y)} C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(egi.x)},${f(egi.y)}`;
}

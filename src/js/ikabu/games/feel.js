// エギングの「手ざわり」：振動と、控えめな効果音（2026-09-25）。
//
// 振動：本物で「手に伝わるもの」だけを震わせる（ダディ案）。
//   イカパンチ＝トトッ／アタリ「コン」＝コッ／アタリ「走る」＝ジーッ／フッキング＝ドン／ジェット＝ブーッ（大きいイカほど長く）
//   ／身切れ・バラシ＝長めに1回。アタリ「止まる」「フケる」は目で糸を見て気づくものなので震わせない。
//   Vibration API がある端末（Android など）だけ。iPhone（Safari 含む全ブラウザ）は Apple の制限で振動できない。
// 音：2026-09-27 から既定はオン（ぱっぱ：気づかない人が多い。消したい人が探してオフにする）。小さく短く（音声ファイルは使わず Web Audio で作る）。
//   iPhone は最初に画面を触った後でないと鳴らせないため、最初の操作で unlock() を呼ぶ。

export const canVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !/iPhone|iPad|iPod/.test(navigator.userAgent ?? '');

const PATTERN = {
  punch: [12, 45, 12],
  tap: [28],
  run: [110],
  hook: [70],
  break: [260],
  landed: [30, 70, 30],
  whoosh: [90],
};
const jetPattern = (power = 0.5) => [Math.round(120 + 160 * Math.min(1, power))];

const VOLUME = 0.05; // 控えめに（最大 1）

export function createFeel({ vibrate = true, sound = false } = {}) {
  const st = { vibrate, sound, ctx: null };

  function buzz(kind, opt = {}) {
    if (!st.vibrate || !canVibrate()) return;
    // ブラウザは、画面を一度も触っていない間は振動を止める（警告が出る）。触る前は呼ばない
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const p = kind === 'jet' ? jetPattern(opt.power) : kind === 'hook' && opt.heavy != null ? [Math.round(50 + 90 * Math.min(1.6, opt.heavy))] : PATTERN[kind];
    if (!p) return;
    try { navigator.vibrate(p); } catch { /* 対応していない端末 */ }
  }

  function unlock() {
    if (!st.sound || st.ctx || typeof window === 'undefined') return;
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    try {
      st.ctx = new AC();
      st.ctx.resume?.();
    } catch { st.ctx = null; }
  }

  // 短い音を1つ。type: 'sine' | 'square' | 'sawtooth' | 'noise'
  function blip({ type = 'sine', f0 = 400, f1 = f0, dur = 0.06, at = 0, vol = 1 }) {
    const ctx = st.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(VOLUME * vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(ctx.destination);
    let src;
    if (type === 'noise') {
      const buf = ctx.createBuffer(1, Math.max(1, Math.round(ctx.sampleRate * dur)), ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f0;
      src.connect(bp).connect(g);
    } else {
      src = ctx.createOscillator();
      src.type = type;
      src.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0) src.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      src.connect(g);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ヤエン：イカが沖へ走っている間のドラグ「ジーーーッ」（鳴らし続ける。止まった＝食べ始めた合図）
  //   ノイズを高い帯域に通し、細かく刻んでドラグの爪の音に。drag(true) で鳴らし、drag(false) で止める（何度呼んでもよい）
  let dragNode = null;
  function drag(on) {
    const ctx = st.ctx;
    if (!on || !st.sound || !ctx) {
      if (dragNode && ctx) {
        const t = ctx.currentTime;
        try {
          dragNode.g.gain.cancelScheduledValues(t);
          dragNode.g.gain.setTargetAtTime(0.0001, t, 0.03);
          dragNode.srcs.forEach((x) => x.stop(t + 0.25));
        } catch { /* 止まっている */ }
      }
      dragNode = null;
      return;
    }
    if (dragNode) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3400; bp.Q.value = 2.2;
    const chop = ctx.createGain();
    chop.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.type = 'square'; lfo.frequency.value = 48;   // 1秒に48回の「ジ」
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(chop.gain);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(VOLUME * 0.9, t + 0.04);
    src.connect(bp).connect(chop).connect(g).connect(ctx.destination);
    src.start(t); lfo.start(t);
    dragNode = { g, srcs: [src, lfo] };
  }
  // ジェット噴射「シュワッ」：ノイズの帯域を低→高へ滑らせ、ふくらんで消える
  function whoosh(vol = 1) {
    const ctx = st.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = 0.55;
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * dur), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(VOLUME * 2.2 * vol, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function play(kind, opt = {}) {
    if (!st.sound || !st.ctx) return;
    switch (kind) {
      case 'punch': blip({ type: 'noise', f0: 2400, dur: 0.02 }); blip({ type: 'noise', f0: 2400, dur: 0.02, at: 0.06 }); break;
      case 'tap': blip({ type: 'sine', f0: 220, f1: 140, dur: 0.07, vol: 1.4 }); break;
      case 'run': for (let i = 0; i < 4; i++) blip({ type: 'square', f0: 900, dur: 0.018, at: i * 0.045, vol: 0.5 }); break;
      case 'hook': blip({ type: 'sine', f0: 110, f1: 70, dur: 0.12, vol: 1.6 }); break;
      case 'jet': { const n = 4 + Math.round(6 * Math.min(1, opt.power ?? 0.5)); for (let i = 0; i < n; i++) blip({ type: 'square', f0: 1100, dur: 0.015, at: i * 0.035, vol: 0.45 }); break; }
      case 'whoosh': whoosh(opt.vol ?? 1); break;
      case 'break': blip({ type: 'sine', f0: 700, f1: 180, dur: 0.18 }); break;
      case 'landed': blip({ type: 'sine', f0: 520, dur: 0.07 }); blip({ type: 'sine', f0: 780, dur: 0.09, at: 0.09 }); break;
      default: break;
    }
  }

  return {
    get vibrate() { return st.vibrate; },
    get sound() { return st.sound; },
    setVibrate(v) { st.vibrate = Boolean(v); },
    setSound(v) { st.sound = Boolean(v); if (st.sound) unlock(); else drag(false); },
    drag,
    unlock,
    // できごとを1つ伝える（振動と音をまとめて）
    fire(kind, opt) { buzz(kind, opt); play(kind, opt); },
  };
}
